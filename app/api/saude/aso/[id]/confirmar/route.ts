import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { calcularELiberarFuncionario } from "@/lib/saude/motor-liberacao-db";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** "Confirmar e salvar" (seção 17) — só a partir daqui o ASO entra de vez no histórico do
 *  funcionário e passa a contar pro motor de liberação. Dispara o recálculo da alocação
 *  vinculada, se houver (seção 43). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("aso.review");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ASO inválido." }, { status: 400 });

  const aso = await prisma.sauAso.findUnique({ where: { id }, include: { alocacao: true } });
  if (!aso) return NextResponse.json({ error: "ASO não encontrado." }, { status: 404 });

  const atualizado = await prisma.sauAso.update({
    where: { id },
    data: { status: "CONFIRMADO", confirmadoPorId: auth.user.id, confirmadoEm: new Date() },
  });

  await registrarAuditoria({ entidade: "SauAso", entidadeId: id, acao: "CONFIRMOU", userId: auth.user.id });

  if (aso.alocacao) {
    await calcularELiberarFuncionario({
      funcionarioId: aso.funcionarioId,
      unidadeId: aso.alocacao.unidadeId,
      funcaoId: aso.alocacao.funcaoId,
      calculadoPorId: auth.user.id,
    });
  }

  return NextResponse.json(atualizado);
}
