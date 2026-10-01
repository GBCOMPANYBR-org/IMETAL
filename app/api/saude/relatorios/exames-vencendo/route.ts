import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("report.view");
  if ("error" in auth) return auth.error;

  const dias = Number(new URL(request.url).searchParams.get("dias")) || 30;
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  const exames = await prisma.sauExame.findMany({
    where: { dataValidade: { lte: limite } },
    include: { funcionario: true, tipoExame: true },
    orderBy: { dataValidade: "asc" },
  });

  const hoje = new Date();

  return NextResponse.json(
    exames.map((e) => ({
      funcionario: e.funcionario.nome,
      matricula: e.funcionario.matricula,
      exame: e.tipoExame.nome,
      dataRealizacao: e.dataRealizacao,
      dataValidade: e.dataValidade,
      situacao: e.dataValidade && e.dataValidade < hoje ? "VENCIDO" : "VENCENDO",
    }))
  );
}
