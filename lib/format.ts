// Fixed placeholder (not tied to the real string length) so masking a value never leaks
// information about its magnitude — every hidden amount renders identically.
const HIDDEN_CURRENCY_PLACEHOLDER = "R$ ••••••";

export function formatCurrency(value: number | null | undefined, hidden = false): string {
  if (hidden) return HIDDEN_CURRENCY_PLACEHOLDER;
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** For real timestamps (e.g. Observacao.createdAt) — unlike formatDate, renders in the viewer's
 * local timezone rather than forcing UTC, since these aren't date-only values. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
