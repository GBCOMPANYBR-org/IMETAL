import { prisma } from "@/lib/prisma";
import { attachmentGroupKey } from "@/lib/attachment-group";

type PedidoRef = { id: number; clienteId: number; codigo: string | null };
type Cover = { id: number; pedidoId: number; filename: string; mimeType: string; storedPath: string; uploadedAt: Date };

export async function sharedCoverPedidoIds(pedido: PedidoRef): Promise<number[]> {
  const codigo = pedido.codigo?.trim();
  if (!codigo) return [pedido.id];
  const matches = await prisma.pedido.findMany({
    where: { clienteId: pedido.clienteId, codigo: { not: null } },
    select: { id: true, codigo: true },
  });
  return matches.filter(p => p.codigo?.trim() === codigo).map(p => p.id);
}

export async function findSharedCover(pedido: PedidoRef): Promise<Cover | null> {
  const ids = await sharedCoverPedidoIds(pedido);
  return prisma.fotoCapa.findFirst({
    where: { pedidoId: { in: ids } },
    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
    select: { id: true, pedidoId: true, filename: true, mimeType: true, storedPath: true, uploadedAt: true },
  });
}

export async function computeSharedCovers(pedidos: PedidoRef[]) {
  const result = new Map<number, { id: number; filename: string; mimeType: string }>();
  if (!pedidos.length) return result;
  const clientes = [...new Set(pedidos.map(p => p.clienteId))];
  const codes = [...new Set(pedidos.map(p => p.codigo?.trim()).filter((x): x is string => Boolean(x)))];
  const possible = await prisma.pedido.findMany({
    where: { OR: [{ id: { in: pedidos.map(p => p.id) } }, { clienteId: { in: clientes }, codigo: { in: codes } }] },
    select: { id: true, clienteId: true, codigo: true, fotoCapa: { select: { id: true, filename: true, mimeType: true, uploadedAt: true } } },
  });
  const best = new Map<string, (typeof possible)[number]["fotoCapa"]>();
  for (const p of possible) {
    if (!p.fotoCapa) continue;
    const key = attachmentGroupKey(p);
    const old = best.get(key);
    if (!old || old.uploadedAt < p.fotoCapa.uploadedAt) best.set(key, p.fotoCapa);
  }
  for (const p of pedidos) {
    const cover = best.get(attachmentGroupKey(p));
    if (cover) result.set(p.id, { id: cover.id, filename: cover.filename, mimeType: cover.mimeType });
  }
  return result;
}
