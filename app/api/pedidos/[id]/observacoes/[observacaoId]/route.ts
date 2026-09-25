import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";

/**
 * Deletes a single Observação (Fórum message) — ADMIN only. Cascades at the DB level to any
 * ObservacaoMention rows it created (see the migration's ON DELETE CASCADE), so if the deleted
 * message was the origin de uma pendência, that pendência disappears from the Fórum too.
 *
 * Also rebuilds the legacy `Pedido.observacao` mirror column (see POST in ../route.ts) by
 * re-joining whatever Observações remain, in order — same shape the append-loop would have
 * produced from scratch minus the deleted one. Leaving that column stale after a delete was a bug:
 * it's what the Pedidos table's hover/tooltip reads, so a deleted message kept showing up there
 * even though it was gone from the Fórum.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; observacaoId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

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

  await prisma.$transaction(async (tx) => {
    await tx.observacao.delete({ where: { id: observacao.id } });

    const remaining = await tx.observacao.findMany({
      where: { pedidoId },
      select: { text: true },
      orderBy: { createdAt: "asc" },
    });

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        observacao: remaining.length > 0 ? remaining.map((o) => o.text).join("\n") : null,
        updatedById: user.id,
        updatedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
