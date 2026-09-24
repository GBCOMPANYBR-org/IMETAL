import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";
import { searchMentionableUsers } from "@/lib/forum-access-db";

/**
 * Candidates for the @ dropdown in this Pedido's observações — gated by the exact same rule as
 * reading/posting in the thread (lib/forum-access.ts), so anyone who can be mentioned here can
 * also always open their own resulting pendência. This is a *visual* convenience only; the POST
 * that creates the mention re-validates every id server-side regardless of what this endpoint
 * returned.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("observacao")) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { clienteId: true } });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const users = await searchMentionableUsers(pedido.clienteId, q);
  return NextResponse.json(users);
}
