import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

/**
 * Marks a pendência "viewed" (green → yellow) — idempotent, and scoped to the caller's own
 * mentions only ("mentionedUserId" in the WHERE, not just checked after the fact) so a
 * manipulated id can't mark someone else's pendência as viewed. Never reveals whether the id
 * belongs to someone else vs. doesn't exist — both return 404.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const mentionId = Number(id);
  if (!Number.isInteger(mentionId)) {
    return NextResponse.json({ error: "Pendência não encontrada." }, { status: 404 });
  }

  const existing = await prisma.observacaoMention.findFirst({
    where: { id: mentionId, mentionedUserId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pendência não encontrada." }, { status: 404 });
  }

  await prisma.$executeRaw`
    UPDATE "ObservacaoMention" SET "viewedAt" = now()
    WHERE id = ${mentionId} AND "mentionedUserId" = ${user.id} AND "viewedAt" IS NULL
  `;

  return NextResponse.json({ ok: true });
}
