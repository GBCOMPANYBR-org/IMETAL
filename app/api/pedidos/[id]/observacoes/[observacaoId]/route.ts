import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";

/**
 * Deletes a single Observação (Fórum message) — ADMIN only. Cascades at the DB level to any
 * ObservacaoMention rows it created (see the migration's ON DELETE CASCADE), so if the deleted
 * message was the origin of a pendência, that pendência disappears from the Fórum too.
 *
 * The legacy `Pedido.observacao` mirror column (see POST in ../route.ts) is intentionally left
 * untouched — it's an append-only concatenated blob with no reliable way to surgically remove one
 * line, and it already exists purely as a fallback for the old table preview/search, not as a
 * source of truth.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; observacaoId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, observacaoId } = await params;
  const pedidoId = parsePedidoId(id);
  const obsId = parsePedidoId(observacaoId);
  if (pedidoId === null || obsId === null) {
    return NextResponse.json({ error: "Observação não encontrada." }, { status: 404 });
  }

  const observacao = await prisma.observacao.findFirst({ where: { id: obsId, pedidoId } });
  if (!observacao) {
    return NextResponse.json({ error: "Observação não encontrada." }, { status: 404 });
  }

  await prisma.observacao.delete({ where: { id: observacao.id } });

  return NextResponse.json({ ok: true });
}
