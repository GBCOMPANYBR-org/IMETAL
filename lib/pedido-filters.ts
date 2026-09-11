import { Prisma } from "@prisma/client";
import type { AuthedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const FK_FIELDS: Record<string, string> = {
  status: "statusId",
  cliente: "clienteId",
  faturamento: "faturamentoId",
  tipo: "tipoId",
  faturado: "faturadoId",
  pagamento: "pagamentoId",
};

// Postgres int4 bounds — "id" is an Int column, so anything outside this range overflows and
// crashes the query (e.g. a Pedido de Compra number typed into quick search, which is often 10 digits).
const INT4_MAX = 2147483647;
const INT4_MIN = -2147483648;

/** Validates a route param as a Pedido id — returns null instead of a value Postgres would reject with an overflow. */
export function parsePedidoId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id >= INT4_MIN && id <= INT4_MAX ? id : null;
}

const TEXT_FIELDS = ["pedidoCompra", "codigo", "descricao", "ncm", "observacao", "nf", "pdv"];
const NUMBER_FIELDS = ["qtd", "valorUnitario", "valorTotal"];
const DATE_FIELDS = ["data", "dataFaturamento"];

// Fields with a real matching Prisma column/relation — the only ones safe to pass through to orderBy.
// "id" is handled separately since it has no permission gate.
const SORTABLE_FIELDS = new Set([...Object.keys(FK_FIELDS), ...TEXT_FIELDS, ...NUMBER_FIELDS, ...DATE_FIELDS]);

export interface ParsedPedidoQuery {
  where: Prisma.PedidoWhereInput;
  orderBy: Prisma.PedidoOrderByWithRelationInput;
  hasFilters: boolean;
  page: number;
}

// Uses UTC explicitly — `data`/`dataFaturamento` are always stored as UTC midnight (date-only
// values), and the rest of the codebase treats dates as UTC (see formatDate/toDateInputValue in
// lib/format.ts). setHours (local time) would shift this boundary whenever the server process
// runs in a non-UTC timezone.
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Parses a free-typed number that may use Brazilian formatting ("1.500,50", "1500,5" or "1.500"), or null if it isn't one. */
function parseSearchedNumber(q: string): number | null {
  const cleaned = q.trim();
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Pure thousands grouping with no decimal part, e.g. "1.500" or "12.345.678" — without
    // this, Number("1.500") would silently parse as 1.5 instead of 1500.
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Translates the set of Attachment group keys (see lib/attachment-group.ts) that currently have
 * at least one file into an OR'd list of Pedido where-conditions matching those groups. */
async function pedidoWhereForGroupsWithAttachments(): Promise<Prisma.PedidoWhereInput[]> {
  const groups = await prisma.attachment.findMany({ select: { codigo: true }, distinct: ["codigo"] });
  const or: Prisma.PedidoWhereInput[] = [];
  for (const { codigo: key } of groups) {
    const clienteCodigo = /^(\d+)::([\s\S]*)$/.exec(key);
    if (clienteCodigo) {
      or.push({ clienteId: Number(clienteCodigo[1]), codigo: clienteCodigo[2] });
      continue;
    }
    const soloPedido = /^__pedido_(\d+)$/.exec(key);
    if (soloPedido) or.push({ id: Number(soloPedido[1]) });
  }
  return or;
}

export async function parsePedidoQuery(searchParams: URLSearchParams, user: AuthedUser): Promise<ParsedPedidoQuery> {
  const visibleFields = user.visibleFields;
  const and: Prisma.PedidoWhereInput[] = [];
  let hasFilters = false;

  // Cliente-restricted users (e.g. a read-only login created for a single company) never see
  // Pedidos outside their allowed Clientes — this is an access boundary, not a user-chosen
  // filter, so it doesn't flip the "hasFilters" pagination mode below.
  if (!user.allClientes) {
    const ids = Array.from(user.visibleClienteIds);
    // Empty on purpose (no Cliente granted yet) — match nothing rather than leaking every Pedido.
    and.push({ clienteId: { in: ids.length > 0 ? ids : [-1] } });
  }

  {
    const min = searchParams.get("f_id_min");
    const max = searchParams.get("f_id_max");
    const range: Record<string, number> = {};
    if (min !== null && min !== "" && !Number.isNaN(Number(min)) && Number(min) >= INT4_MIN && Number(min) <= INT4_MAX) range.gte = Number(min);
    if (max !== null && max !== "" && !Number.isNaN(Number(max)) && Number(max) >= INT4_MIN && Number(max) <= INT4_MAX) range.lte = Number(max);
    if (Object.keys(range).length > 0) {
      and.push({ id: range });
      hasFilters = true;
    }
  }

  for (const [fieldKey, fkColumn] of Object.entries(FK_FIELDS)) {
    if (!visibleFields.has(fieldKey)) continue;
    const raw = searchParams.get(`f_${fieldKey}`);
    if (!raw) continue;
    const ids = raw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n));
    if (ids.length > 0) {
      and.push({ [fkColumn]: { in: ids } } as Prisma.PedidoWhereInput);
      hasFilters = true;
    }
  }

  for (const fieldKey of TEXT_FIELDS) {
    if (!visibleFields.has(fieldKey)) continue;
    const raw = searchParams.get(`f_${fieldKey}`);
    if (!raw) continue;
    and.push({ [fieldKey]: { contains: raw, mode: "insensitive" } } as Prisma.PedidoWhereInput);
    hasFilters = true;
  }

  for (const fieldKey of NUMBER_FIELDS) {
    if (!visibleFields.has(fieldKey)) continue;
    const min = searchParams.get(`f_${fieldKey}_min`);
    const max = searchParams.get(`f_${fieldKey}_max`);
    const range: Record<string, number> = {};
    // Number.isFinite (not just isNaN) — Prisma rejects Infinity/-Infinity for a Float column as
    // an invalid argument, which throws an unhandled PrismaClientValidationError and 500s the
    // route. Number("1e400") or Number("Infinity") both parse to Infinity in JS, so a value like
    // that typed into a Valor filter must be dropped here rather than passed through.
    if (min !== null && min !== "" && Number.isFinite(Number(min))) range.gte = Number(min);
    if (max !== null && max !== "" && Number.isFinite(Number(max))) range.lte = Number(max);
    if (Object.keys(range).length > 0) {
      and.push({ [fieldKey]: range } as Prisma.PedidoWhereInput);
      hasFilters = true;
    }
  }

  for (const fieldKey of DATE_FIELDS) {
    if (!visibleFields.has(fieldKey)) continue;
    const from = searchParams.get(`f_${fieldKey}_from`);
    const to = searchParams.get(`f_${fieldKey}_to`);
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.lte = endOfDay(d);
    }
    if (Object.keys(range).length > 0) {
      and.push({ [fieldKey]: range } as Prisma.PedidoWhereInput);
      hasFilters = true;
    }
  }

  if (visibleFields.has("editadoPor")) {
    const raw = searchParams.get("f_editadoPor");
    if (raw) {
      and.push({ updatedBy: { name: { contains: raw, mode: "insensitive" } } });
      hasFilters = true;
    }
  }

  if (visibleFields.has("anexos")) {
    const raw = searchParams.get("f_anexos");
    if (raw === "1" || raw === "0") {
      // Attachments are shared by Cliente+Código (see lib/attachment-group.ts), not owned by a
      // single Pedido anymore, so "has an attachment" can't be expressed as a relation filter on
      // pedidoId — resolve the (small) set of groups that have at least one file, then match
      // Pedidos against those groups directly.
      const or = await pedidoWhereForGroupsWithAttachments();
      if (raw === "1") {
        and.push(or.length > 0 ? { OR: or } : { id: -1 });
      } else {
        and.push(or.length > 0 ? { NOT: { OR: or } } : {});
      }
      hasFilters = true;
    }
  }

  if (visibleFields.has("fotos")) {
    const raw = searchParams.get("f_fotos");
    // Fotos aren't shared across Pedidos (unlike anexos), so this can stay a plain relation filter.
    if (raw === "1") {
      and.push({ fotos: { some: {} } });
      hasFilters = true;
    } else if (raw === "0") {
      and.push({ fotos: { none: {} } });
      hasFilters = true;
    }
  }

  const q = searchParams.get("q")?.trim();
  if (q) {
    hasFilters = true;
    const or: Prisma.PedidoWhereInput[] = [];
    for (const fieldKey of TEXT_FIELDS) {
      if (visibleFields.has(fieldKey)) {
        or.push({ [fieldKey]: { contains: q, mode: "insensitive" } } as Prisma.PedidoWhereInput);
      }
    }
    if (visibleFields.has("cliente")) or.push({ cliente: { name: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("status")) or.push({ status: { label: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("faturamento")) or.push({ faturamento: { label: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("tipo")) or.push({ tipo: { label: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("faturado")) or.push({ faturado: { label: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("pagamento")) or.push({ pagamento: { label: { contains: q, mode: "insensitive" } } });
    if (visibleFields.has("editadoPor")) or.push({ updatedBy: { name: { contains: q, mode: "insensitive" } } });

    // ID has no permission gate — always searchable, matching how it's always shown as the row key.
    if (/^\d+$/.test(q) && Number(q) <= INT4_MAX) or.push({ id: Number(q) });

    const asNumber = parseSearchedNumber(q);
    if (asNumber !== null) {
      const EPSILON = 0.005;
      const range = { gte: asNumber - EPSILON, lte: asNumber + EPSILON };
      if (visibleFields.has("valorTotal")) or.push({ valorTotal: range });
      if (visibleFields.has("valorUnitario")) or.push({ valorUnitario: range });
    }

    if (or.length > 0) and.push({ OR: or });
  }

  const sortParam = searchParams.get("sort");
  const dirParam = searchParams.get("dir") === "asc" ? "asc" : "desc";
  let orderBy: Prisma.PedidoOrderByWithRelationInput = { id: "desc" };
  if (sortParam === "id") {
    orderBy = { id: dirParam };
  } else if (sortParam && SORTABLE_FIELDS.has(sortParam) && visibleFields.has(sortParam)) {
    if (FK_FIELDS[sortParam]) {
      const relationField = sortParam === "cliente" ? "name" : "label";
      orderBy = { [sortParam]: { [relationField]: dirParam } } as Prisma.PedidoOrderByWithRelationInput;
    } else {
      orderBy = { [sortParam]: dirParam } as Prisma.PedidoOrderByWithRelationInput;
    }
  }

  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  return {
    where: and.length > 0 ? { AND: and } : {},
    orderBy,
    hasFilters,
    page,
  };
}
