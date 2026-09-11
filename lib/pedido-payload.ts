import { z } from "zod";

/** Maps the JSON body keys accepted by the Pedido API to the canonical field key used for permissions. */
export const FORM_KEY_TO_FIELD_KEY: Record<string, string> = {
  statusId: "status",
  clienteId: "cliente",
  pedidoCompra: "pedidoCompra",
  data: "data",
  qtd: "qtd",
  codigo: "codigo",
  descricao: "descricao",
  ncm: "ncm",
  valorUnitario: "valorUnitario",
  pagamentoId: "pagamento",
  faturamentoId: "faturamento",
  tipoId: "tipo",
  observacao: "observacao",
  faturadoId: "faturado",
  dataFaturamento: "dataFaturamento",
  nf: "nf",
  pdv: "pdv",
};

/** Returns the body keys that the user is not allowed to view/edit, or [] if the payload is fully permitted. */
export function findDisallowedKeys(bodyKeys: string[], visibleFields: Set<string>): string[] {
  return bodyKeys.filter((key) => {
    const fieldKey = FORM_KEY_TO_FIELD_KEY[key];
    if (!fieldKey) return false; // unknown keys are ignored by zod, not a permission concern
    return !visibleFields.has(fieldKey);
  });
}

// IMPORTANT: the transform must pass `undefined` straight through instead of collapsing it to
// `null`. Zod runs .transform() even when the key is entirely absent from the input (that's a
// valid value for an .optional() field) — so `(v) => v ?? null` turns "this key wasn't in the
// request body at all" into "clear this field", silently wiping it. That's exactly the bug that
// caused a bulk-edit PATCH (which only ever sends dataFaturamento/nf/pdv, see BulkEditModal) to
// null out pedidoCompra/data/codigo/descricao/ncm/pagamento/observacao on every pedido touched,
// even though the request never mentioned those fields. The route layer's `data.x !== undefined`
// guards only work if "absent" and "explicitly cleared" actually produce different values here.
const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null));

export const pedidoCreateSchema = z.object({
  statusId: z.number().int(),
  clienteId: z.number().int(),
  faturamentoId: z.number().int(),
  tipoId: z.number().int(),
  pedidoCompra: optionalTrimmedString,
  data: optionalDate,
  qtd: z.number().finite().nonnegative("Qtd não pode ser negativa.").default(0),
  codigo: optionalTrimmedString,
  descricao: optionalTrimmedString,
  ncm: optionalTrimmedString,
  valorUnitario: z.number().finite().nonnegative("Valor Unitário não pode ser negativo.").default(0),
  pagamentoId: z.number().int().optional(),
  observacao: optionalTrimmedString,
  dataFaturamento: optionalDate,
  nf: optionalTrimmedString,
  pdv: optionalTrimmedString,
});

export const pedidoUpdateSchema = z.object({
  statusId: z.number().int().optional(),
  clienteId: z.number().int().optional(),
  faturamentoId: z.number().int().optional(),
  tipoId: z.number().int().optional(),
  faturadoId: z.number().int().optional(),
  pedidoCompra: optionalTrimmedString,
  data: optionalDate,
  qtd: z.number().finite().nonnegative("Qtd não pode ser negativa.").optional(),
  codigo: optionalTrimmedString,
  descricao: optionalTrimmedString,
  ncm: optionalTrimmedString,
  valorUnitario: z.number().finite().nonnegative("Valor Unitário não pode ser negativo.").optional(),
  pagamentoId: z.number().int().optional(),
  observacao: optionalTrimmedString,
  dataFaturamento: optionalDate,
  nf: optionalTrimmedString,
  pdv: optionalTrimmedString,
});
