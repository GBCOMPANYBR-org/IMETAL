import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { recalcularAlertas } from "@/lib/saude/alertas";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("release.view");
  if ("error" in auth) return auth.error;

  await recalcularAlertas();

  const alertas = await prisma.sauAlerta.findMany({
    where: { status: "ABERTO" },
    include: {
      funcionario: true,
      unidade: { include: { cliente: true } },
      pcmsoVersao: true,
      exame: { include: { tipoExame: true } },
    },
    orderBy: [{ tipo: "asc" }, { prazoEm: "asc" }],
  });

  return NextResponse.json(alertas);
}
