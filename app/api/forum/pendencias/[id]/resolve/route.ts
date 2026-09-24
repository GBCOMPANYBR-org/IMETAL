import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

const VALID_TYPES = new Set(["CONCLUIDA", "CIENTE"]);

/**
 * Closes an individual pendência — "Concluir pendência" or "Ciente, sem ação necessária", each
 * recorded as a distinct resolutionType for the audit trail. Only the mentioned user may resolve
 * their own pendência — no admin override — matching the requirement that a manipulated request
 * can't close someone else's item. The UPDATE is conditioned on resolvedAt IS NULL and scoped to
 * the caller's own id in the WHERE clause (not read-then-write), closing the race where two
 * clicks/devices could otherwise both "win". A later reply never reopens a resolved pendência,
 * and a fresh @-mention always creates an independent new one — both are natural consequences of
 * pendências being immutable once resolved and always created fresh per Observação.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const mentionId = Number(id);
  if (!Number.isInteger(mentionId)) {
    return NextResponse.json({ error: "Pendência não encontrada." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { type?: unknown } | null;
  const type = typeof body?.type === "string" ? body.type : "";
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Tipo de conclusão inválido." }, { status: 400 });
  }

  const existing = await prisma.observacaoMention.findFirst({
    where: { id: mentionId, mentionedUserId: user.id },
    select: { id: true, resolvedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pendência não encontrada." }, { status: 404 });
  }

  const updated = await prisma.$queryRaw<{ id: number }[]>`
    UPDATE "ObservacaoMention"
    SET "resolvedAt" = now(), "resolvedById" = ${user.id}, "resolutionType" = ${type}
    WHERE id = ${mentionId} AND "mentionedUserId" = ${user.id} AND "resolvedAt" IS NULL
    RETURNING id
  `;

  if (updated.length === 0) {
    return NextResponse.json({ error: "Esta pendência já foi tratada." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
