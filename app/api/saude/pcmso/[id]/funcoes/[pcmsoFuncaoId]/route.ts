import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Remove uma função (e seus riscos/requisitos, em cascata) da matriz — só faz sentido corrigir
 *  um engano antes de publicar; a versão publicada em si nunca é apagada. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; pcmsoFuncaoId: string }> }
): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const { id, pcmsoFuncaoId } = await params;
  const pcmsoVersaoId = parseId(id);
  const funcaoRowId = parseId(pcmsoFuncaoId);
  if (pcmsoVersaoId === null || funcaoRowId === null) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const row = await prisma.sauPcmsoFuncao.findUnique({ where: { id: funcaoRowId } });
  if (!row || row.pcmsoVersaoId !== pcmsoVersaoId) {
    return NextResponse.json({ error: "Função não encontrada nesta versão." }, { status: 404 });
  }

  await prisma.sauPcmsoFuncao.delete({ where: { id: funcaoRowId } });
  return NextResponse.json({ ok: true });
}
