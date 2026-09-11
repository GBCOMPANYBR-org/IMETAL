export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "status"
  | "cliente"
  | "faturamento"
  | "tipo"
  | "faturado"
  | "pagamento"
  | "attachments";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Computed fields are never accepted from the client on create/update. */
  computed?: boolean;
  /** Fields that can be typed directly in a create/edit form. */
  formEditable: boolean;
  /** Defaults to true — set false for fields with no matching column on Pedido (e.g. anexos, editadoPor). */
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * Canonical list of every configurable column on a Pedido.
 * This drives: the permission checkboxes on the user admin screen,
 * the table columns, the filters, and the create/edit form.
 * "id" is intentionally excluded — it is always visible as the row key.
 */
export const PEDIDO_FIELDS: FieldDef[] = [
  { key: "status", label: "Status", type: "status", formEditable: true },
  { key: "cliente", label: "Cliente", type: "cliente", formEditable: true },
  { key: "pedidoCompra", label: "Pedido de Compra", type: "text", formEditable: true },
  { key: "data", label: "Data", type: "date", formEditable: true },
  { key: "qtd", label: "Qtd", type: "number", formEditable: true },
  { key: "codigo", label: "Código", type: "text", formEditable: true },
  { key: "descricao", label: "Descrição", type: "text", formEditable: true },
  { key: "ncm", label: "NCM", type: "text", formEditable: true },
  { key: "valorUnitario", label: "Valor Unitário", type: "currency", formEditable: true },
  { key: "valorTotal", label: "Valor Total", type: "currency", formEditable: false, computed: true },
  { key: "pagamento", label: "Pagamento", type: "pagamento", formEditable: true },
  { key: "faturamento", label: "Faturamento", type: "faturamento", formEditable: true },
  { key: "tipo", label: "Tipo", type: "tipo", formEditable: true },
  { key: "observacao", label: "Observações", type: "text", formEditable: true },
  { key: "faturado", label: "Faturado", type: "faturado", formEditable: true },
  { key: "dataFaturamento", label: "Data Faturamento", type: "date", formEditable: true },
  { key: "nf", label: "NF", type: "text", formEditable: true },
  { key: "pdv", label: "PDV", type: "text", formEditable: true },
  { key: "anexos", label: "Anexos", type: "attachments", formEditable: false, sortable: false },
  { key: "fotos", label: "Fotos", type: "attachments", formEditable: false, sortable: false },
  { key: "editadoPor", label: "Editado por", type: "text", formEditable: false, computed: true, sortable: false },
];

export const PEDIDO_FIELD_KEYS = PEDIDO_FIELDS.map((f) => f.key);

export function isValidFieldKey(key: string): boolean {
  return PEDIDO_FIELD_KEYS.includes(key);
}
