"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PEDIDO_FIELDS, type FieldDef } from "@/lib/fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePedidoOptions } from "@/lib/useOptions";
import { anyFilterActive, buildPedidosQueryParams, type FiltersState } from "@/lib/pedido-query-client";
import ColumnFilter from "@/components/pedidos/ColumnFilter";
import PedidoFormModal, { type PedidoRecord } from "@/components/pedidos/PedidoFormModal";
import AttachmentsModal from "@/components/pedidos/AttachmentsModal";
import ObservacaoModal from "@/components/pedidos/ObservacaoModal";
import BulkEditModal from "@/components/pedidos/BulkEditModal";
import { useValuesVisibility } from "@/components/ValuesVisibilityProvider";

const ID_FIELD: FieldDef = { key: "id", label: "ID", type: "number", formEditable: false };

// Every row is a single line — content that doesn't fit is truncated with an ellipsis, and the
// full value is available as a native tooltip (title attribute) on hover, rather than resizable
// columns or wrapped multi-line cells.
const COLUMN_MAX_WIDTHS: Record<string, number> = {
  id: 70,
  status: 130,
  cliente: 160,
  pedidoCompra: 150,
  data: 110,
  qtd: 80,
  codigo: 130,
  descricao: 320,
  ncm: 100,
  valorUnitario: 120,
  valorTotal: 120,
  pagamento: 100,
  faturamento: 130,
  tipo: 100,
  observacao: 220,
  faturado: 100,
  dataFaturamento: 140,
  nf: 90,
  pdv: 90,
  anexos: 90,
  fotos: 90,
  editadoPor: 150,
};

/** Paints the row with the exact status color as configured in /admin/status — no blending, per the client's explicit call. */
function rowTint(color: string | undefined): React.CSSProperties {
  if (!color) return {};
  return { backgroundColor: color };
}

interface PedidoRow extends PedidoRecord {
  canEdit: boolean;
  anexosCount?: number;
  fotosCount?: number;
}

interface Props {
  visibleFields: string[];
  isAdmin: boolean;
  canEdit: boolean;
}

const PAGE_SIZE = 50;

export default function PedidosClient({ visibleFields, isAdmin, canEdit }: Props) {
  const visibleSet = useMemo(() => new Set(visibleFields), [visibleFields]);
  const columns = useMemo(() => PEDIDO_FIELDS.filter((f) => visibleSet.has(f.key)), [visibleSet]);
  const { options } = usePedidoOptions();
  const { hidden: valoresHidden } = useValuesVisibility();

  const [filters, setFilters] = useState<FiltersState>({});
  const [quickSearchInput, setQuickSearchInput] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<PedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<PedidoRow | "new" | null>(null);
  const [attachmentsFor, setAttachmentsFor] = useState<PedidoRow | null>(null);
  const [fotosFor, setFotosFor] = useState<PedidoRow | null>(null);
  const [observacaoFor, setObservacaoFor] = useState<PedidoRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canBulkEdit = isAdmin || canEdit;
  // Guards against a slower, stale request (e.g. from a filter the user already changed
  // away from) resolving after a newer one and overwriting the fresher results on screen.
  const loadSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuickSearch(quickSearchInput), 350);
    return () => clearTimeout(t);
  }, [quickSearchInput]);

  useEffect(() => {
    setPage(1);
  }, [filters, quickSearch]);

  async function load() {
    const seq = ++loadSeq.current;
    setLoading(true);
    const params = buildPedidosQueryParams({ filters, quickSearch, sort, dir, page });
    const res = await fetch(`/api/pedidos?${params.toString()}`);
    if (seq !== loadSeq.current) return; // a newer load() started while this one was in flight
    if (res.ok) {
      const body = await res.json();
      setItems(body.items);
      setTotal(body.total);
      setHasFilters(body.hasFilters);
    }
    setSelectedIds(new Set());
    setLoading(false);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = buildPedidosQueryParams({ filters, quickSearch, sort, dir });
      params.set("export", "1");
      const res = await fetch(`/api/pedidos?${params.toString()}`);
      if (!res.ok) return;
      const body = await res.json();
      const allColumns = [ID_FIELD, ...columns];
      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = allColumns.map((f) => escape(f.label)).join(",");
      const rows = (body.items as PedidoRow[]).map((pedido) =>
        allColumns.map((f) => escape(f.key === "id" ? pedido.id : cellText(pedido, f.key))).join(",")
      );
      const csv = "﻿" + [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, quickSearch, sort, dir, page]);

  const filtersActive = anyFilterActive(filters, quickSearch);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(fieldKey: string) {
    if (sort === fieldKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(fieldKey);
      setDir("asc");
    }
  }

  async function handleDelete(pedido: PedidoRow) {
    if (!confirm(`Excluir o pedido #${pedido.id}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/pedidos/${pedido.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Não foi possível excluir.");
    }
  }

  /** Plain-text version of a cell's value, used for CSV export (cellValue below returns JSX for the screen). */
  function cellText(pedido: PedidoRow, fieldKey: string): string {
    switch (fieldKey) {
      case "status":
        return pedido.status?.label ?? "";
      case "editadoPor":
        return (pedido.editadoPor as string | null | undefined) ?? "";
      case "cliente":
        return pedido.cliente?.name ?? "";
      case "faturamento":
        return pedido.faturamento?.label ?? "";
      case "tipo":
        return pedido.tipo?.label ?? "";
      case "faturado":
        return pedido.faturado?.label ?? "";
      case "pagamento":
        return pedido.pagamento?.label ?? "";
      case "data":
        return formatDate(pedido.data);
      case "dataFaturamento":
        return formatDate(pedido.dataFaturamento);
      case "qtd":
        return String(pedido.qtd ?? "");
      case "valorUnitario":
        return formatCurrency(pedido.valorUnitario, valoresHidden);
      case "valorTotal":
        return formatCurrency((pedido as unknown as { valorTotal?: number }).valorTotal, valoresHidden);
      case "anexos":
        return String(pedido.anexosCount ?? 0);
      case "fotos":
        return String(pedido.fotosCount ?? 0);
      default:
        return (pedido as unknown as Record<string, string | null | undefined>)[fieldKey] ?? "";
    }
  }

  function cellValue(pedido: PedidoRow, fieldKey: string): React.ReactNode {
    switch (fieldKey) {
      case "status":
        return pedido.status ? <span className="font-semibold text-slate-700">{pedido.status.label}</span> : "—";
      case "editadoPor":
        return (pedido.editadoPor as string | null | undefined) ?? "—";
      case "cliente":
        return pedido.cliente?.name ?? "—";
      case "faturamento":
        return pedido.faturamento?.label ?? "—";
      case "tipo":
        return pedido.tipo?.label ?? "—";
      case "faturado":
        return pedido.faturado?.label ?? "—";
      case "pagamento":
        return pedido.pagamento?.label ?? "—";
      case "data":
        return formatDate(pedido.data);
      case "dataFaturamento":
        return formatDate(pedido.dataFaturamento);
      case "qtd":
        return pedido.qtd ?? "—";
      case "valorUnitario":
        return formatCurrency(pedido.valorUnitario, valoresHidden);
      case "valorTotal":
        return (
          <span className="font-semibold text-slate-700">
            {formatCurrency((pedido as unknown as { valorTotal?: number }).valorTotal, valoresHidden)}
          </span>
        );
      case "observacao": {
        const text = (pedido.observacao as string | null | undefined) ?? "";
        return (
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate">{text || "—"}</span>
            <button
              onClick={() => setObservacaoFor(pedido)}
              title="Adicionar observação"
              className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + observação
            </button>
          </span>
        );
      }
      case "anexos":
        return (
          <button
            onClick={() => setAttachmentsFor(pedido)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            📎 {pedido.anexosCount ?? 0}
          </button>
        );
      case "fotos":
        return (
          <button
            onClick={() => setFotosFor(pedido)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            📷 {pedido.fotosCount ?? 0}
          </button>
        );
      default:
        return (pedido as unknown as Record<string, string | null | undefined>)[fieldKey] || "—";
    }
  }

  // "NÃO" is the seeded/expected label for this option list (see ChartsClient's equivalent
  // lookup) — if it's ever renamed in /admin/listas the shortcut button just stops rendering
  // instead of silently targeting the wrong id.
  const naoFaturadoOption = options.faturado.find((f) => f.label === "NÃO");
  const naoFaturadoActive =
    Boolean(naoFaturadoOption) &&
    filters.faturado?.type === "fk" &&
    filters.faturado.ids.length === 1 &&
    filters.faturado.ids[0] === naoFaturadoOption!.id;

  function toggleNaoFaturados() {
    if (!naoFaturadoOption) return;
    setFilters((prev) => {
      const next = { ...prev };
      if (naoFaturadoActive) {
        delete next.faturado;
      } else {
        next.faturado = { type: "fk", ids: [naoFaturadoOption.id] };
      }
      return next;
    });
  }

  const displayedTotal = useMemo(
    () => items.reduce((sum, p) => sum + ((p as unknown as { valorTotal?: number }).valorTotal ?? 0), 0),
    [items]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input
          value={quickSearchInput}
          onChange={(e) => setQuickSearchInput(e.target.value)}
          placeholder="Buscar em todos os campos visíveis..."
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {isAdmin && !loading && (
          <span className="text-sm font-medium text-slate-600">
            Total exibido: <span className="font-semibold text-slate-800">{formatCurrency(displayedTotal, valoresHidden)}</span>
          </span>
        )}
        {filtersActive && (
          <button
            onClick={() => {
              setFilters({});
              setQuickSearchInput("");
              setQuickSearch("");
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Limpar filtros
          </button>
        )}
        <div className="flex-1" />
        {naoFaturadoOption && (
          <button
            onClick={toggleNaoFaturados}
            title="Atalho: filtra a coluna Faturado por NÃO. Clique de novo pra tirar — os outros filtros aplicados continuam."
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              naoFaturadoActive ? "border-brand bg-brand text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Não Faturados
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Imprimir
        </button>
        {(isAdmin || canEdit) && (
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
          >
            + Novo Pedido
          </button>
        )}
      </div>

      {canBulkEdit && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand bg-brand/5 px-4 py-2 text-sm print:hidden">
          <span className="font-medium text-slate-700">{selectedIds.size} pedido(s) selecionado(s)</span>
          <button onClick={() => setShowBulkEdit(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-light">
            Aplicar Data Faturamento / NF / PDV em lote...
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Limpar seleção
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className={hasFilters ? "resize-y overflow-auto print:h-auto print:max-h-none print:resize-none print:overflow-visible" : "overflow-auto"}
          style={hasFilters ? { height: "70vh", minHeight: "260px", maxHeight: "90vh" } : undefined}
          title={hasFilters ? "Arraste o canto inferior direito para ajustar a altura" : undefined}
        >
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 print:static">
              <tr>
                {canBulkEdit && (
                  <th className="border-b border-slate-200 px-3 py-2 print:hidden">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                {[ID_FIELD, ...columns].map((f) => (
                  <th
                    key={f.key}
                    style={{ maxWidth: COLUMN_MAX_WIDTHS[f.key] ?? 150 }}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-500"
                  >
                    <div className="flex max-w-full items-center">
                      <span className="min-w-0 overflow-hidden">
                        <button
                          onClick={() => f.sortable !== false && toggleSort(f.key)}
                          className="truncate hover:text-slate-700 disabled:cursor-default disabled:opacity-50"
                          disabled={f.sortable === false}
                        >
                          {f.label} {sort === f.key ? (dir === "asc" ? "▲" : "▼") : ""}
                        </button>
                      </span>
                      {f.filterable !== false && (
                        <ColumnFilter
                          field={f}
                          value={filters[f.key]}
                          onChange={(v) => setFilters((prev) => ({ ...prev, [f.key]: v as never }))}
                          fkOptions={
                            f.type === "status"
                              ? options.status.map((s) => ({ id: s.id, label: s.label }))
                              : f.type === "cliente"
                              ? options.clientes.map((c) => ({ id: c.id, label: c.name }))
                              : f.type === "faturamento"
                              ? options.faturamento
                              : f.type === "tipo"
                              ? options.tipo
                              : f.type === "faturado"
                              ? options.faturado
                              : f.type === "pagamento"
                              ? options.pagamento
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-500 print:hidden">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length + 2 + (canBulkEdit ? 1 : 0)} className="px-3 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2 + (canBulkEdit ? 1 : 0)} className="px-3 py-10 text-center text-slate-400">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((pedido) => (
                  <tr
                    key={pedido.id}
                    style={visibleSet.has("status") ? rowTint(pedido.status?.color) : undefined}
                    className="border-b border-slate-100 last:border-0 transition hover:brightness-95"
                  >
                    {canBulkEdit && (
                      <td className="px-3 py-2 print:hidden">
                        <input type="checkbox" checked={selectedIds.has(pedido.id)} onChange={() => toggleSelect(pedido.id)} />
                      </td>
                    )}
                    <td className="truncate px-3 py-2 text-slate-700" style={{ maxWidth: COLUMN_MAX_WIDTHS.id }}>
                      {pedido.id}
                    </td>
                    {columns.map((f) => (
                      <td
                        key={f.key}
                        title={cellText(pedido, f.key) || undefined}
                        style={{ maxWidth: COLUMN_MAX_WIDTHS[f.key] ?? 150 }}
                        className="truncate px-3 py-2 text-slate-700"
                      >
                        {cellValue(pedido, f.key)}
                      </td>
                    ))}
                    <td className="px-3 py-2 print:hidden">
                      <div className="flex items-center justify-end gap-1">
                        {pedido.canEdit ? (
                          <button onClick={() => setEditing(pedido)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand" title="Editar">
                            ✎
                          </button>
                        ) : (
                          <span className="rounded p-1 text-slate-300" title="Status não permite edição">
                            🔒
                          </span>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(pedido)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Excluir">
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 print:hidden">
        {hasFilters ? (
          <span>{total} resultado(s) encontrado(s) — exibindo todos, com rolagem.</span>
        ) : (
          <>
            <span>
              Página {page} de {pageCount} — {total} pedido(s) no total
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <PedidoFormModal
          mode={editing === "new" ? "create" : "edit"}
          pedido={editing === "new" ? null : editing}
          visibleFields={visibleSet}
          isAdmin={isAdmin}
          options={options}
          onClose={() => setEditing(null)}
          onItemAdded={load}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {attachmentsFor && (
        <AttachmentsModal
          pedidoId={attachmentsFor.id}
          kind="anexos"
          codigo={attachmentsFor.codigo}
          publicToken={attachmentsFor.publicToken}
          canUpload={isAdmin || attachmentsFor.statusEditable !== false}
          isAdmin={isAdmin}
          onClose={() => setAttachmentsFor(null)}
          onChanged={load}
        />
      )}

      {fotosFor && (
        <AttachmentsModal
          pedidoId={fotosFor.id}
          kind="fotos"
          canUpload={isAdmin || fotosFor.statusEditable !== false}
          isAdmin={isAdmin}
          onClose={() => setFotosFor(null)}
          onChanged={load}
        />
      )}

      {observacaoFor && (
        <ObservacaoModal
          pedidoId={observacaoFor.id}
          current={(observacaoFor.observacao as string | null | undefined) ?? null}
          onClose={() => setObservacaoFor(null)}
          onSaved={load}
        />
      )}

      {showBulkEdit && (
        <BulkEditModal
          pedidoIds={Array.from(selectedIds)}
          visibleFields={visibleSet}
          faturadoOptions={options.faturado}
          onClose={() => setShowBulkEdit(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
