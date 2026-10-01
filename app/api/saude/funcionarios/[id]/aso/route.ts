import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { asoCreateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("aso.view");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const asos = await prisma.sauAso.findMany({
    where: { funcionarioId },
    include: { documento: true, alocacao: { include: { unidade: true } } },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(asos);
}

/**
 * Registra um ASO cujo arquivo já foi enviado ao Blob pelo navegador. Sem leitura por IA ainda
 * (Etapa 07) — os campos vêm digitados por quem está cadastrando, e por isso mesmo entram como
 * AGUARDANDO_REVISAO: a confirmação (ver /confirmar) continua sendo um passo humano separado,
 * nunca automático (seção 17/22) — mesmo sem IA envolvida, nada entra no histórico "de primeira".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("aso.upload");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const funcionario = await prisma.sauFuncionario.findUnique({ where: { id: funcionarioId } });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = asoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.alocacaoId) {
    const alocacao = await prisma.sauAlocacao.findUnique({ where: { id: parsed.data.alocacaoId } });
    if (!alocacao || alocacao.funcionarioId !== funcionarioId) {
      return NextResponse.json({ error: "Alocação inválida para este funcionário." }, { status: 400 });
    }
  }

  const { blobUrl, filename, mimeType, size, ...asoData } = parsed.data;

  const aso = await prisma.$transaction(async (tx) => {
    const documento = await tx.sauDocumento.create({
      data: {
        nomeOriginal: filename,
        storedPath: blobUrl,
        mimeType,
        tamanho: size,
        categoria: "ASO",
        funcionarioId,
        uploadedById: auth.user.id,
      },
    });

    return tx.sauAso.create({
      data: { ...asoData, funcionarioId, documentoId: documento.id, status: "AGUARDANDO_REVISAO" },
      include: { documento: true, alocacao: { include: { unidade: true } } },
    });
  });

  await registrarAuditoria({ entidade: "SauAso", entidadeId: aso.id, acao: "CRIOU", userId: auth.user.id, depois: { tipo: aso.tipo, data: aso.data } });

  return NextResponse.json(aso, { status: 201 });
}
