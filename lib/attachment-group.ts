import { prisma } from "@/lib/prisma";

/**
 * Every Pedido with the same Cliente AND the same (non-empty) Código shares one pool of
 * attachments — attaching a file to one of them makes it visible on all the others, so the same
 * file never has to be uploaded twice. Scoped by Cliente on purpose: Código is free text, not
 * globally unique, so two different Clientes could coincidentally use the same Código — sharing
 * across them would leak one company's files into another's, undermining the Cliente-restricted
 * login boundary elsewhere in the app. A Pedido with no Código gets a synthetic key unique to its
 * own id, so it never gets grouped together with any other Pedido.
 */
export function attachmentGroupKey(pedido: { id: number; clienteId: number; codigo: string | null }): string {
  const trimmed = pedido.codigo?.trim();
  return trimmed ? `${pedido.clienteId}::${trimmed}` : `__pedido_${pedido.id}`;
}

/** Batch-computes how many Attachment rows of a given `kind` each of these Pedidos' shared group currently has. */
async function computeAttachmentCountsByKind(
  pedidos: { id: number; clienteId: number; codigo: string | null }[],
  kind: "anexo" | "proposta"
): Promise<Map<number, number>> {
  const keyByPedidoId = new Map(pedidos.map((p) => [p.id, attachmentGroupKey(p)]));
  const distinctKeys = Array.from(new Set(keyByPedidoId.values()));
  if (distinctKeys.length === 0) return new Map();

  const grouped = await prisma.attachment.groupBy({
    by: ["codigo"],
    where: { codigo: { in: distinctKeys }, kind },
    _count: { _all: true },
  });
  const countByKey = new Map(grouped.map((g) => [g.codigo, g._count._all]));

  const result = new Map<number, number>();
  for (const [pedidoId, key] of keyByPedidoId) {
    result.set(pedidoId, countByKey.get(key) ?? 0);
  }
  return result;
}

/** Batch-computes how many anexos each of these Pedidos' shared group currently has. */
export function computeAnexosCounts(pedidos: { id: number; clienteId: number; codigo: string | null }[]) {
  return computeAttachmentCountsByKind(pedidos, "anexo");
}

/** Batch-computes how many propostas each of these Pedidos' shared group currently has. */
export function computePropostasCounts(pedidos: { id: number; clienteId: number; codigo: string | null }[]) {
  return computeAttachmentCountsByKind(pedidos, "proposta");
}
