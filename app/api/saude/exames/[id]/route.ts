import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { exameUpdateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { calcularELiberarFuncionario } from "@/lib/saude/motor-liberacao-db";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Corrige um exame já cadastrado — nunca exclusão (seção 42: exame usado em liberação nunca é
 *  apagado), só correção, sempre auditada. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("exam.edit");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Exame inválido." }, { status: 400 });

  const before = await prisma.sauExame.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Exame não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = exameUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { tipoExameNome, blobUrl, filename, mimeType, size, ...resto } = parsed.data;

  let tipoExameId: number | undefined;
  if (tipoExameNome) {
    let tipoExame = await prisma.sauTipoExame.findFirst({ where: { nome: { equals: tipoExameNome, mode: "insensitive" } } });
    if (!tipoExame) tipoExame = await prisma.sauTipoExame.create({ data: { nome: tipoExameNome, criadoVia: "MANUAL" } });
    tipoExameId = tipoExame.id;
  }

  const atualizado = await prisma.sauExame.update({
    where: { id },
    data: { ...resto, ...(tipoExameId ? { tipoExameId } : {}) },
    include: { tipoExame: true, documento: true },
  });

  await registrarAuditoria({ entidade: "SauExame", entidadeId: id, acao: "ATUALIZOU", userId: auth.user.id, antes: before, depois: parsed.data });

  const ativa = await prisma.sauAlocacao.findFirst({ where: { funcionarioId: before.funcionarioId, status: "ATIVA" } });
  if (ativa) {
    await calcularELiberarFuncionario({
      funcionarioId: before.funcionarioId,
      unidadeId: ativa.unidadeId,
      funcaoId: ativa.funcaoId,
      calculadoPorId: auth.user.id,
    });
  }

  return NextResponse.json(atualizado);
}
