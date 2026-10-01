import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("report.view");
  if ("error" in auth) return auth.error;

  const checklists = await prisma.sauChecklistLiberacao.findMany({
    where: { statusGeral: { in: ["NAO_LIBERADO", "REVISAO_NECESSARIA"] } },
    include: {
      funcionario: true,
      unidade: { include: { cliente: true } },
      funcao: true,
      itens: { where: { status: { in: ["PENDENTE", "VENCIDO", "EM_ANALISE"] } } },
    },
    orderBy: [{ unidadeId: "asc" }, { funcionarioId: "asc" }],
  });

  return NextResponse.json(
    checklists.map((c) => ({
      funcionario: c.funcionario.nome,
      matricula: c.funcionario.matricula,
      cliente: c.unidade.cliente.nome,
      unidade: c.unidade.nome,
      funcao: c.funcao.nome,
      status: c.statusGeral,
      pendencias: c.itens.map((i) => `${i.descricao}: ${i.motivo}`).join(" | "),
    }))
  );
}
