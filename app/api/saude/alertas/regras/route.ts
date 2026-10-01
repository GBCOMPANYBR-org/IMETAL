import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("release.view");
  if ("error" in auth) return auth.error;

  const regras = await prisma.sauAlertaRegra.findMany({ orderBy: [{ tipo: "asc" }, { dias: "desc" }] });
  return NextResponse.json(regras);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("release.manage");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const tipo = typeof body?.tipo === "string" ? body.tipo : null;
  const dias = Number(body?.dias);

  if (!tipo || !Number.isInteger(dias) || dias <= 0) {
    return NextResponse.json({ error: "Informe tipo e uma quantidade de dias válida." }, { status: 400 });
  }

  const regra = await prisma.sauAlertaRegra.upsert({
    where: { tipo_dias: { tipo, dias } },
    create: { tipo, dias },
    update: { ativo: true },
  });

  return NextResponse.json(regra, { status: 201 });
}
