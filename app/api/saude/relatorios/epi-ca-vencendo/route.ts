import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("report.view");
  if ("error" in auth) return auth.error;

  const dias = Number(new URL(request.url).searchParams.get("dias")) || 30;
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  // Só o movimento "ativo" (ENTREGA/TROCA ainda não substituída) representa um EPI em uso —
  // mesma regra do recálculo de alertas em lib/saude/alertas.ts.
  const movimentos = await prisma.sauEpiMovimento.findMany({
    where: { validadeCa: { lte: limite }, tipoMovimento: { in: ["ENTREGA", "TROCA"] }, substituidoPor: { none: {} } },
    include: { funcionario: true, tipo: true },
    orderBy: { validadeCa: "asc" },
  });

  const hoje = new Date();

  return NextResponse.json(
    movimentos.map((m) => ({
      funcionario: m.funcionario.nome,
      matricula: m.funcionario.matricula,
      epi: m.tipo.nome,
      ca: m.ca,
      lote: m.lote,
      validadeCa: m.validadeCa,
      situacao: m.validadeCa && m.validadeCa < hoje ? "VENCIDO" : "VENCENDO",
    }))
  );
}
