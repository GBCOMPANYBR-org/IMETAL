import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pcmsoFuncaoId: string; requisitoId: string }> }
): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const { pcmsoFuncaoId, requisitoId } = await params;
  const funcaoRowId = parseId(pcmsoFuncaoId);
  const id = parseId(requisitoId);
  if (funcaoRowId === null || id === null) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const requisito = await prisma.sauRequisito.findUnique({ where: { id } });
  if (!requisito || requisito.pcmsoFuncaoId !== funcaoRowId) {
    return NextResponse.json({ error: "Requisito não encontrado." }, { status: 404 });
  }

  await prisma.sauRequisito.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
