import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { parsePedidoId, parsePedidoQuery } from "@/lib/pedido-filters";

const PAGE_SIZE = 50;

/**
 * Given a Pedido id, returns which page it falls on in the default (no filters, no search,
 * sorted by id desc) view of the Pedidos list — used by "Ver pedido" links (Fórum, etc.) to jump
 * straight to the right page instead of opening an edit modal. Deliberately ignores whatever
 * filters/sort the caller's list happens to have active: the default view is the one guaranteed
 * to contain every Pedido the user can see, so this always finds it.
 *
 * The position math (`id desc` → position = how many ids are greater, +1) is only valid because
 * we call parsePedidoQuery with no query params, which is documented to default to `{ id: "desc" }`
 * — if that default ever changes, this needs to change with it.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const idParam = new URL(req.url).searchParams.get("id");
  const targetId = idParam ? parsePedidoId(idParam) : null;
  if (targetId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const { where } = await parsePedidoQuery(new URLSearchParams(), user);

  const target = await prisma.pedido.findFirst({ where: { AND: [where, { id: targetId }] }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const countAhead = await prisma.pedido.count({ where: { AND: [where, { id: { gt: targetId } }] } });
  const page = Math.floor(countAhead / PAGE_SIZE) + 1;

  return NextResponse.json({ page });
}
