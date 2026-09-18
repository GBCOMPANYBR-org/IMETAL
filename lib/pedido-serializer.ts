import { Prisma } from "@prisma/client";
import type { AuthedUser } from "@/lib/permissions";
import { canEditPedidoWithStatus } from "@/lib/permissions";

export const PEDIDO_INCLUDE = {
  status: true,
  cliente: true,
  faturamento: true,
  tipo: true,
  faturado: true,
  pagamento: true,
  updatedBy: { select: { name: true } },
  // Fotos aren't shared across Pedidos like attachments are, so a plain relation count works.
  _count: { select: { fotos: true } },
} satisfies Prisma.PedidoInclude;

export type PedidoWithRelations = Prisma.PedidoGetPayload<{ include: typeof PEDIDO_INCLUDE }>;

/**
 * Converts a Pedido row into a plain JSON-safe object that only contains the
 * fields the given user is allowed to view. Fields the user cannot view are
 * simply absent from the payload — the client never receives that data.
 *
 * `anexosCount` is passed in rather than read off the Pedido relation because attachments are
 * shared across every Pedido with the same Código (see lib/attachment-group.ts) — it isn't a
 * simple per-row count anymore.
 */
export function serializePedido(pedido: PedidoWithRelations, user: AuthedUser, anexosCount: number) {
  const can = (key: string) => user.visibleFields.has(key);
  const editable = canEditPedidoWithStatus(user, pedido.status.editable);

  const out: Record<string, unknown> = {
    id: pedido.id,
    canEdit: editable,
    // Always present (unlike `status` below, which is gated by visibleFields) — the Anexos
    // modal needs to know if uploads are allowed even for users who can't see the status field.
    statusEditable: pedido.status.editable,
  };

  if (can("status")) {
    out.status = {
      id: pedido.status.id,
      label: pedido.status.label,
      color: pedido.status.color,
      editable: pedido.status.editable,
    };
  }
  if (can("cliente")) {
    out.cliente = { id: pedido.cliente.id, name: pedido.cliente.name };
  }
  if (can("pedidoCompra")) out.pedidoCompra = pedido.pedidoCompra;
  if (can("data")) out.data = pedido.data;
  if (can("qtd")) out.qtd = pedido.qtd;
  if (can("codigo")) out.codigo = pedido.codigo;
  if (can("descricao")) out.descricao = pedido.descricao;
  if (can("ncm")) out.ncm = pedido.ncm;
  if (can("valorUnitario")) out.valorUnitario = pedido.valorUnitario;
  if (can("valorTotal")) out.valorTotal = pedido.valorTotal;
  if (can("pagamento")) out.pagamento = pedido.pagamento ? { id: pedido.pagamento.id, label: pedido.pagamento.label } : null;
  if (can("faturamento")) out.faturamento = { id: pedido.faturamento.id, label: pedido.faturamento.label };
  if (can("tipo")) out.tipo = { id: pedido.tipo.id, label: pedido.tipo.label };
  if (can("observacao")) out.observacao = pedido.observacao;
  if (can("faturado")) out.faturado = { id: pedido.faturado.id, label: pedido.faturado.label };
  if (can("dataFaturamento")) out.dataFaturamento = pedido.dataFaturamento;
  if (can("nf")) out.nf = pedido.nf;
  if (can("pdv")) out.pdv = pedido.pdv;
  if (can("anexos")) {
    out.anexosCount = anexosCount;
    // Lets the Anexos modal build the public QR-code link without a separate request.
    out.publicToken = pedido.publicToken;
  }
  if (can("fotos")) out.fotosCount = pedido._count.fotos;
  if (can("editadoPor")) out.editadoPor = pedido.updatedBy?.name ?? null;

  return out;
}
