import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { exameCreateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { calcularELiberarFuncionario } from "@/lib/saude/motor-liberacao-db";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("exam.view");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const exames = await prisma.sauExame.findMany({
    where: { funcionarioId },
    include: { tipoExame: true, documento: true },
    orderBy: { dataRealizacao: "desc" },
  });

  return NextResponse.json(exames);
}

/**
 * Cadastro avulso de exame (seção 18) — "origem" fica sempre MANUAL aqui; ASO confirmado grava
 * exame com origem ASO num fluxo separado (a implementar quando a extração ligar exame a ASO).
 * O exame pertence ao funcionário, não à unidade: é essa independência que o motor de liberação
 * usa pra reaproveitar entre clientes diferentes (seção 19) sem nenhum código extra aqui.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("exam.edit");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const funcionario = await prisma.sauFuncionario.findUnique({ where: { id: funcionarioId } });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = exameCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  let tipoExame = await prisma.sauTipoExame.findFirst({
    where: { nome: { equals: parsed.data.tipoExameNome, mode: "insensitive" } },
  });
  if (!tipoExame) {
    tipoExame = await prisma.sauTipoExame.create({ data: { nome: parsed.data.tipoExameNome, criadoVia: "MANUAL" } });
  }

  const { tipoExameNome, blobUrl, filename, mimeType, size, ...resto } = parsed.data;

  const exame = await prisma.$transaction(async (tx) => {
    let documentoId: number | null = null;
    if (blobUrl && filename && mimeType && size !== undefined) {
      const documento = await tx.sauDocumento.create({
        data: { nomeOriginal: filename, storedPath: blobUrl, mimeType, tamanho: size, categoria: "EXAME", funcionarioId, uploadedById: auth.user.id },
      });
      documentoId = documento.id;
    }

    return tx.sauExame.create({
      data: { ...resto, funcionarioId, tipoExameId: tipoExame.id, origem: "MANUAL", documentoId, criadoPorId: auth.user.id },
      include: { tipoExame: true, documento: true },
    });
  });

  await registrarAuditoria({ entidade: "SauExame", entidadeId: exame.id, acao: "CRIOU", userId: auth.user.id, depois: { tipoExameId: tipoExame.id } });

  // Seção 43: novo exame é gatilho de recálculo — se o funcionário tem alocação ativa, sua
  // situação pode ter acabado de mudar.
  const ativa = await prisma.sauAlocacao.findFirst({ where: { funcionarioId, status: "ATIVA" } });
  if (ativa) {
    await calcularELiberarFuncionario({ funcionarioId, unidadeId: ativa.unidadeId, funcaoId: ativa.funcaoId, calculadoPorId: auth.user.id });
  }

  return NextResponse.json(exame, { status: 201 });
}
