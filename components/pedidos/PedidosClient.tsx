"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter, useSearchParams } from "next/navigation";
import { PEDIDO_FIELDS, type FieldDef } from "@/lib/fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { stripMentionSyntax } from "@/lib/mentions";
import { usePedidoOptions } from "@/lib/useOptions";
import { anyFilterActive, buildPedidosQueryParams, type FiltersState } from "@/lib/pedido-query-client";
import ColumnFilter from "@/components/pedidos/ColumnFilter";
import PedidoFormModal, { type PedidoRecord } from "@/components/pedidos/PedidoFormModal";
import AttachmentsModal from "@/components/pedidos/AttachmentsModal";
import ObservacaoModal from "@/components/pedidos/ObservacaoModal";
import DescricaoHoverPreview from "@/components/pedidos/DescricaoHoverPreview";
import BulkEditModal from "@/components/pedidos/BulkEditModal";
import BulkStatusModal from "@/components/pedidos/BulkStatusModal";
import BulkDeleteModal from "@/components/pedidos/BulkDeleteModal";
import Modal from "@/components/Modal";
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
  observacao: 90,
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
  propostasCount?: number;
  nfAnexosCount?: number;
  fotoCapa?: { id: number; filename: string; mimeType: string } | null;
}

interface Props {
  visibleFields: string[];
  isAdmin: boolean;
  canEdit: boolean;
  canChangePedidoStatus: boolean;
  canChangeFotoCapa: boolean;
}

const PAGE_SIZE = 50;

export default function PedidosClient({ visibleFields, isAdmin, canEdit, canChangePedidoStatus, canChangeFotoCapa }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleSet = useMemo(() => new Set(visibleFields), [visibleFields]);
  // "fotoCapa" fica de fora da tabela de propósito — continua em PEDIDO_FIELDS (permissão
  // toggleable em Usuários, igual as outras) porque é isso que libera o upload no formulário e a
  // prévia ao passar o mouse na Descrição, mas não deve aparecer como coluna própria.
  const availableColumns = useMemo(() => PEDIDO_FIELDS.filter((f) => f.key !== "fotoCapa" && visibleSet.has(f.key)), [visibleSet]);
  type ColumnPrefs = { order: string[]; hidden: string[]; widths: Record<string, number> };
  const [columnPrefs, setColumnPrefs] = useState<ColumnPrefs>({ order: [], hidden: [], widths: {} });
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("imetal-pedidos-column-prefs-v1") || "{}");
      if (Array.isArray(saved.order) && Array.isArray(saved.hidden) && saved.widths && typeof saved.widths === "object") {
        setColumnPrefs({order: saved.order.filter((v: unknown) => typeof v === "string"), hidden: saved.hidden.filter((v: unknown) => typeof v === "string"), widths: saved.widths});
      }
    } catch { /* Ignore invalid local settings. */ }
  }, []);
  const orderedColumns = useMemo(() => [...availableColumns].sort((a, b) => {
    const ai = columnPrefs.order.indexOf(a.key), bi = columnPrefs.order.indexOf(b.key);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  }), [availableColumns, columnPrefs.order]);
  const columns = useMemo(() => orderedColumns.filter(f => !columnPrefs.hidden.includes(f.key)), [orderedColumns, columnPrefs.hidden]);
  const columnWidth = (key: string) => {
    const n = Number(columnPrefs.widths[key]);
    return Number.isFinite(n) && n >= 60 && n <= 800 ? n : (COLUMN_MAX_WIDTHS[key] ?? 150);
  };
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const reorderColumn = (source: string, target: string) => {
    if (source === target || source === "id" || target === "id") return;
    const order = orderedColumns.map(f => f.key);
    const from = order.indexOf(source), to = order.indexOf(target);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, source);
    setColumnPrefs(prev => {
      const next = {...prev, order};
      localStorage.setItem("imetal-pedidos-column-prefs-v1", JSON.stringify(next));
      return next;
    });
  };
  const resizeState = useRef<{key: string; startX: number; width: number} | null>(null);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});
  const liveWidthsRef = useRef<Record<string, number>>({});
  const effectiveColumnWidth = (key: string) => liveWidths[key] ?? columnWidth(key);
  const startColumnResize = (event: React.PointerEvent<HTMLSpanElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    resizeState.current = {key, startX: event.clientX, width: effectiveColumnWidth(key)};
    const move = (e: PointerEvent) => {
      const active = resizeState.current;
      if (!active) return;
      const width = Math.max(60, Math.min(800, Math.round(active.width + e.clientX - active.startX)));
      liveWidthsRef.current = {...liveWidthsRef.current, [active.key]: width};
      setLiveWidths(prev => ({...prev, [active.key]: width}));
    };
    const finish = () => {
      const active = resizeState.current;
      if (active) {
        const width = liveWidthsRef.current[active.key] ?? active.width;
        setColumnPrefs(prev => {
          const next = {...prev, widths: {...prev.widths, [active.key]: width}};
          localStorage.setItem("imetal-pedidos-column-prefs-v1", JSON.stringify(next));
          return next;
        });
      }
      resizeState.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const updateColumnVisibility = (key: string, show: boolean) => {
    setColumnPrefs(prev => {
      const next = {...prev, hidden: show ? prev.hidden.filter(k => k !== key) : [...prev.hidden, key]};
      localStorage.setItem("imetal-pedidos-column-prefs-v1", JSON.stringify(next));
      return next;
    });
  };
  const restoreColumnDefaults = () => {
    const next = {order: [], hidden: [], widths: {}};
    localStorage.setItem("imetal-pedidos-column-prefs-v1", JSON.stringify(next));
    setColumnPrefs(next);
    setLiveWidths({});
    liveWidthsRef.current = {};
  };
  const { options } = usePedidoOptions();
  const { hidden: valoresHidden } = useValuesVisibility();

  const [showCoverPreview, setShowCoverPreview] = useState(true);
  const [hideCancelados, setHideCancelados] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.code !== "Digit1" || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setShowCoverPreview((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.code !== "Digit3" || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setPage(1);
      setHideCancelados((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [filters, setFilters] = useState<FiltersState>({});
  const [quickSearchInput, setQuickSearchInput] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const scrolledToHighlightRef = useRef(false);

  const [items, setItems] = useState<PedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [quickStatusPending, setQuickStatusPending] = useState<{ pedido: PedidoRow; statusId: number } | null>(null);
  const [quickPrevisaoPending, setQuickPrevisaoPending] = useState<PedidoRow | null>(null);
  const [quickPrevisao, setQuickPrevisao] = useState("");
  const [capaFor, setCapaFor] = useState<PedidoRow | null>(null);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [savingCapa, setSavingCapa] = useState(false);
  const [capaError, setCapaError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PedidoRow | "new" | null>(null);
  const [attachmentsFor, setAttachmentsFor] = useState<PedidoRow | null>(null);
  const [fotosFor, setFotosFor] = useState<PedidoRow | null>(null);
  const [propostasFor, setPropostasFor] = useState<PedidoRow | null>(null);
  const [nfAnexosFor, setNfAnexosFor] = useState<PedidoRow | null>(null);
  const [observacaoFor, setObservacaoFor] = useState<PedidoRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedFieldLabel, setCopiedFieldLabel] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  useEffect(() => {
    setCopiedFieldLabel(null);
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, [selectedIds]);

  const copyableFields: Record<string, string> = {
    pedidoCompra: "Pedido de Compra", codigo: "Código", descricao: "Descrição",
    ncm: "NCM", valorUnitario: "Valor Unitário",
  };

  async function copySelectedCell(pedido: PedidoRow, fieldKey: string) {
    if (!selectedIds.has(pedido.id) || !(fieldKey in copyableFields)) return;
    if (fieldKey === "valorUnitario" && valoresHidden) return;
    const value = cellText(pedido, fieldKey);
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldLabel(copyableFields[fieldKey]);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => {
        setCopiedFieldLabel(null);
        copyResetTimer.current = null;
      }, 5000);
    } catch {
      // Falha silenciosa na cópia.
    }
  }

  const canBulkEdit = isAdmin || canEdit;
  const canBulkSelect = canBulkEdit || canChangePedidoStatus;
  const showActionsColumn = isAdmin || canEdit;
  // Guards against a slower, stale request (e.g. from a filter the user already changed
  // away from) resolving after a newer one and overwriting the fresher results on screen.
  const loadSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuickSearch(quickSearchInput), 350);
    return () => clearTimeout(t);
  }, [quickSearchInput]);

  // "Ver pedido" from the Fórum links here as `/?pedidoId=123` — limpa filtros/busca (garante que
  // o pedido apareça em algum lugar da lista), pula pra página onde ele cai e deixa a linha
  // pronta pra ser rolada até a tela e destacada (ver o efeito logo abaixo). Roda uma vez por
  // acesso só, depois some o parâmetro da URL pra um refresh não repetir.
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (openedFromQueryRef.current) return;
    const pedidoIdParam = searchParams.get("pedidoId");
    if (!pedidoIdParam) return;
    openedFromQueryRef.current = true;
    const targetId = Number(pedidoIdParam);

    setFilters({});
    setQuickSearchInput("");
    setQuickSearch("");
    setSort(undefined);
    setDir("desc");

    fetch(`/api/pedidos/locate?id=${pedidoIdParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { page: number } | null) => {
        if (data) {
          scrolledToHighlightRef.current = false;
          setPage(data.page);
          setHighlightedId(targetId);
        }
      })
      .finally(() => router.replace("/", { scroll: false }));
  }, [searchParams, router]);

  // Card de "pedidos atrasados" do TopNav (admin) linka aqui como `/?atrasados=1` — monta o mesmo
  // filtro usado pra calcular a contagem lá (Previsão vencida + status ainda não finalizado/
  // cancelado) nos filtros normais da tela, pra reaproveitar toda a UI de filtro já existente.
  const atrasadosAtivo = searchParams.get("atrasados") === "1";
  useEffect(() => {
    if (!atrasadosAtivo) return;
    if (options.status.length === 0) return; // espera as opções carregarem pra achar os ids certos

    const naoTerminalIds = options.status.filter((s) => !["Finalizado", "Cancelado"].includes(s.label)).map((s) => s.id);
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    setFilters({
      status: { type: "fk", ids: naoTerminalIds },
      previsao: { type: "date", to: ontem.toISOString().slice(0, 10) },
    });
    setQuickSearchInput("");
    setQuickSearch("");
    setPage(1);
  }, [atrasadosAtivo, options.status]);

  // Alerta verde do TopNav chega como /?finalizadosNovos=1,2,3. Mantemos os IDs em
  // estado próprio porque esse é um lote pontual (não um filtro de coluna) e removemos o
  // parâmetro da URL sem perder o lote que acabou de ser aberto.
  const [finalizadosNovosIds, setFinalizadosNovosIds] = useState<number[]>([]);
  const [pedidosNovosIds, setPedidosNovosIds] = useState<number[]>([]);
  useEffect(() => {
    const raw = searchParams.get("finalizadosNovos") ?? searchParams.get("pedidosNovos");
    if (!raw) {
      setFinalizadosNovosIds([]);
      setPedidosNovosIds([]);
      return;
    }
    const ids = raw.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
    setFilters({});
    setQuickSearchInput("");
    setQuickSearch("");
    setPage(1);
    if(searchParams.has("pedidosNovos")) {setPedidosNovosIds(ids);setFinalizadosNovosIds([]);} else {setFinalizadosNovosIds(ids);setPedidosNovosIds([]);}
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [filters, quickSearch]);

  async function load() {
    const seq = ++loadSeq.current;
    setLoading(true);
    const params = buildPedidosQueryParams({ filters, quickSearch, sort, dir, page });
    if (finalizadosNovosIds.length > 0) params.set("finalizadosNovos", finalizadosNovosIds.join(","));
    if (pedidosNovosIds.length > 0) params.set("pedidosNovos", pedidosNovosIds.join(","));
    if (hideCancelados) params.set("hideCancelados", "1");
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
      if (hideCancelados) params.set("hideCancelados", "1");
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
  }, [filters, quickSearch, sort, dir, page, finalizadosNovosIds, pedidosNovosIds, hideCancelados]);

  const filtersActive = anyFilterActive(filters, quickSearch);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  // Rola até a linha vinda de "Ver pedido" assim que ela aparecer na página certa, e some o
  // destaque depois de 3s. `scrolledToHighlightRef` evita repetir a rolagem a cada recarregamento
  // da lista (polling, etc.) enquanto o mesmo pedido continua destacado.
  useEffect(() => {
    if (!highlightedId || scrolledToHighlightRef.current) return;
    const row = rowRefs.current.get(highlightedId);
    if (!row) return;
    scrolledToHighlightRef.current = true;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlightedId(null), 3000);
    return () => clearTimeout(timeout);
  }, [items, highlightedId]);

  function goToPage(target: number) {
    setPage(Math.min(pageCount, Math.max(1, target)));
  }

  function handlePageInputSubmit() {
    const parsed = Number(pageInput);
    if (Number.isInteger(parsed)) {
      goToPage(parsed);
    } else {
      setPageInput(String(page));
    }
  }

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
      case "previsao":
        return formatDate(pedido.previsao as string | null | undefined);
      case "dataFaturamento":
        return formatDate(pedido.dataFaturamento);
      case "qtd":
        return String(pedido.qtd ?? "");
      case "valorUnitario":
        return formatCurrency(pedido.valorUnitario, valoresHidden);
      case "valorTotal":
        return formatCurrency((pedido as unknown as { valorTotal?: number }).valorTotal, valoresHidden);
      case "descricao":
        return ((pedido.descricao as string | null | undefined) ?? "").toLocaleUpperCase("pt-BR");
      case "observacao":
        return stripMentionSyntax((pedido.observacao as string | null | undefined) ?? "");
      case "anexos":
        return String(pedido.anexosCount ?? 0);
      case "fotos":
        return String(pedido.fotosCount ?? 0);
      case "proposta":
        return String(pedido.propostasCount ?? 0);
      default:
        return (pedido as unknown as Record<string, string | null | undefined>)[fieldKey] ?? "";
    }
  }

  async function saveQuickStatus(pedido: PedidoRow, statusId: number, previsao?: string) {
    setChangingStatusId(pedido.id);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statusId,
          quickStatusChange: true,
          ...(previsao !== undefined ? { previsao } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.error ?? "Não foi possível alterar o status.");
        return false;
      }
      await load();
      return true;
    } finally {
      setChangingStatusId(null);
    }
  }

  async function changePedidoPrevisao(pedido: PedidoRow, previsao: string) {
    if (!canChangePedidoStatus || pedido.status?.label?.trim().toLowerCase() === "finalizado") return;
    setChangingStatusId(pedido.id);
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previsao, quickPrevisaoChange: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.error ?? "Não foi possível alterar a previsão.");
        return;
      }
      await load();
    } finally {
      setChangingStatusId(null);
    }
  }

  async function changePedidoStatus(pedido: PedidoRow, statusId: number) {
    if (!canChangePedidoStatus || statusId === pedido.status?.id) return;
    if (pedido.status?.label?.trim().toLowerCase() === "finalizado") {
      window.alert("Pedido Finalizado: para alterar o status novamente, abra a edição do pedido.");
      return;
    }
    const nextLabel = options.status.find((status) => status.id === statusId)?.label?.trim().toLowerCase();
    if (nextLabel === "em andamento") {
      setQuickPrevisao((pedido.previsao as string | null | undefined)?.slice(0, 10) ?? "");
      setQuickStatusPending({ pedido, statusId });
      return;
    }
    await saveQuickStatus(pedido, statusId);
  }

  async function saveQuickCapa() {
    if (!capaFor || !capaFile || savingCapa) return;
    setSavingCapa(true);
    setCapaError(null);
    try {
      if (capaFile.size > 20 * 1024 * 1024 || !capaFile.type.startsWith("image/")) throw new Error("Selecione uma imagem de até 20 MB.");
      const blob = await upload(`pedidos/${capaFor.id}/${capaFile.name}`, capaFile, {
        access: "public", handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ pedidoId: capaFor.id, kind: "fotoCapa" }),
      });
      const res = await fetch(`/api/pedidos/${capaFor.id}/foto-capa`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, filename: capaFile.name, mimeType: capaFile.type, size: capaFile.size }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Erro ao salvar foto de capa."); }
      setCapaFor(null); setCapaFile(null);
      await load();
    } catch (err) { setCapaError(err instanceof Error ? err.message : "Falha ao enviar imagem."); }
    finally { setSavingCapa(false); }
  }

  function cellValue(pedido: PedidoRow, fieldKey: string): React.ReactNode {
    switch (fieldKey) {
      case "status":
        if (!pedido.status) return "—";
        if (!canChangePedidoStatus) {
          return <span className="font-semibold text-slate-700">{pedido.status.label}</span>;
        }
        if (pedido.status.label.trim().toLowerCase() === "finalizado") {
          return <span className="font-semibold text-slate-700">{pedido.status.label}</span>;
        }
        return (
          <select
            value={pedido.status.id}
            disabled={changingStatusId === pedido.id}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => changePedidoStatus(pedido, Number(e.target.value))}
            title="Clique para alterar o status"
            className="max-w-full cursor-pointer appearance-none bg-transparent pr-4 font-semibold text-slate-700 outline-none disabled:cursor-wait disabled:opacity-60"
          >
            {options.status.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        );
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
      case "previsao": {
        const previsao = pedido.previsao as string | null | undefined;
        const finalizado = pedido.status?.label?.trim().toLowerCase() === "finalizado";
        const atrasado = Boolean(previsao) && new Date(previsao!) < new Date(new Date().toDateString()) && !["Finalizado", "Cancelado"].includes(pedido.status?.label ?? "");
        if (!canChangePedidoStatus || finalizado) {
          return <span className={atrasado ? "font-semibold text-red-600" : undefined}>{formatDate(previsao)}</span>;
        }
        return (
          <button
            type="button"
            disabled={changingStatusId === pedido.id}
            onClick={(e) => {
              e.stopPropagation();
              setQuickPrevisao(previsao?.slice(0, 10) ?? "");
              setQuickPrevisaoPending(pedido);
            }}
            title="Clique para alterar a previsão"
            className={`cursor-pointer bg-transparent text-left disabled:cursor-wait disabled:opacity-60 ${atrasado ? "font-semibold text-red-600" : ""}`}
          >
            {previsao ? formatDate(previsao) : "—"}
          </button>
        );
      }
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
        const text = stripMentionSyntax((pedido.observacao as string | null | undefined) ?? "");
        return (
          <span className="flex min-w-0 items-center gap-1 overflow-hidden">
            <span className="min-w-0 flex-1 truncate">{text || "—"}</span>
            <button
              onClick={() => setObservacaoFor(pedido)}
              title="Adicionar observação"
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + obs
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
      case "proposta":
        return (
          <button
            onClick={() => setPropostasFor(pedido)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            📄 {pedido.propostasCount ?? 0}
          </button>
        );
      case "descricao": {
        const text = ((pedido.descricao as string | null | undefined) ?? "").toLocaleUpperCase("pt-BR");
        const preview = showCoverPreview && pedido.fotoCapa ? (
          <DescricaoHoverPreview pedidoId={pedido.id} text={text} filename={pedido.fotoCapa.filename} />
        ) : (text || "—");
        const canQuickCapa = canChangeFotoCapa && pedido.status?.label?.trim().toLowerCase() !== "finalizado";
        return <span className="flex w-full min-w-0 items-center gap-1"><span className="min-w-0 flex-1 truncate">{preview}</span>{showCoverPreview && canQuickCapa && (
          <button type="button" className="shrink-0 rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Alterar foto de capa" onClick={() => { setCapaFor(pedido); setCapaFile(null); setCapaError(null); }}>📷</button>
        )}</span>;
      }
      case "nf": {
        const nf = (pedido.nf as string | null | undefined) ?? "";
        if (nf.trim()) {
          return (
            <button
              onClick={() => setNfAnexosFor(pedido)}
              className="text-brand hover:underline"
              title="Ver anexos da Nota Fiscal"
            >
              {nf}
            </button>
          );
        }
        return isAdmin ? (
          <button onClick={() => setNfAnexosFor(pedido)} className="text-slate-400 hover:text-brand" title="Anexar Nota Fiscal">
            ...
          </button>
        ) : (
          "—"
        );
      }
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
        {(finalizadosNovosIds.length > 0 || pedidosNovosIds.length > 0) && (
          <button
            onClick={() => {
              setFinalizadosNovosIds([]);
              setPedidosNovosIds([]);
              setPage(1);
              router.replace("/", { scroll: false });
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pedidosNovosIds.length > 0 ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
          >
            Ver todos os pedidos
          </button>
        )}
        {atrasadosAtivo && (
          <button
            onClick={() => {
              setFilters({});
              setQuickSearchInput("");
              setQuickSearch("");
              setPage(1);
              router.replace("/", { scroll: false });
            }}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Ver todos os pedidos
          </button>
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
          <div className="relative print:hidden">
            <div className="relative">
              <button type="button" aria-label="Escolher colunas visíveis" aria-expanded={columnsMenuOpen} onClick={() => setColumnsMenuOpen(v => !v)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" title="Mostrar ou ocultar colunas">Colunas</button>
              {columnsMenuOpen && <div className="absolute right-0 top-full z-50 mt-1 max-h-[65vh] w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between"><strong className="text-sm">Colunas visíveis</strong><button type="button" onClick={() => setColumnsMenuOpen(false)} aria-label="Fechar" className="text-slate-500">✕</button></div>
                <label className="mb-2 flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked disabled /> ID (fixa)</label>
                {availableColumns.map(field => <label key={field.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50"><input type="checkbox" checked={!columnPrefs.hidden.includes(field.key)} onChange={event => updateColumnVisibility(field.key, event.target.checked)} />{field.label}</label>)}
                <button type="button" onClick={restoreColumnDefaults} className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Restaurar padrão</button>
              </div>}
            </div>
          </div>
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

      {canBulkSelect && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand bg-brand/5 px-4 py-2 text-sm print:hidden">
          <span className="font-medium text-slate-700">{selectedIds.size} pedido(s) selecionado(s)</span>
          <span role="status" aria-live="polite" className="rounded-lg bg-slate-500 px-3 py-1.5 text-xs font-semibold text-white">{copiedFieldLabel ? `${copiedFieldLabel} copiado!` : "Clique para copiar"}</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-light">
            Aplicar Data Faturamento / NF / PDV em lote...
          </button>}
          {canChangePedidoStatus && selectedIds.size > 1 && <button onClick={() => setShowBulkStatus(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-light">
            Alterar status dos selecionados...
          </button>}
          {isAdmin && selectedIds.size > 1 && <button onClick={() => setShowBulkDelete(true)} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Excluir pedidos selecionados...</button>}
          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Limpar seleção
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-visible">
          <table className="border-collapse text-sm">
            <thead className="sticky top-[72px] z-30 bg-slate-50 shadow-sm print:static">
              <tr>
                {canBulkSelect && (
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
                    draggable={f.key !== "id"}
                    onDragStart={(event) => {
                      if (f.key === "id") { event.preventDefault(); return; }
                      setDraggedColumn(f.key);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", f.key);
                    }}
                    onDragOver={(event) => {
                      if (!draggedColumn || draggedColumn === f.key || f.key === "id") return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTarget(f.key);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const source = event.dataTransfer.getData("text/plain") || draggedColumn;
                      if (source) reorderColumn(source, f.key);
                      setDraggedColumn(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => { setDraggedColumn(null); setDropTarget(null); }}
                    style={{ position: "relative", width: effectiveColumnWidth(f.key), minWidth: effectiveColumnWidth(f.key), maxWidth: effectiveColumnWidth(f.key) }}
                    className={`border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-500 ${f.key !== "id" ? "cursor-grab active:cursor-grabbing" : ""} ${dropTarget === f.key ? "border-l-4 border-l-blue-500 bg-blue-50" : ""} ${draggedColumn === f.key ? "opacity-50" : ""}`}
                  >
                    <span role="separator" aria-orientation="vertical" aria-label={`Arrastar para ajustar largura de ${f.label}`} onPointerDown={(event) => startColumnResize(event, f.key)} className="group absolute right-0 top-0 z-20 flex h-full w-2 cursor-col-resize touch-none items-center justify-center" title="Arraste para ajustar a largura"><span aria-hidden="true" className="h-5 w-px rounded-full bg-slate-300/60 transition-all group-hover:h-7 group-hover:w-0.5 group-hover:bg-slate-500/80" /></span>
                    <div className="flex max-w-full items-center">
                      <span className="min-w-0 overflow-hidden">
                        <button
                          onClick={() => f.sortable !== false && toggleSort(f.key)}
                          className="block max-w-full truncate hover:text-slate-700 disabled:cursor-default disabled:opacity-50"
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
                {showActionsColumn && (
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-500 print:hidden">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length + 1 + (canBulkEdit ? 1 : 0) + (showActionsColumn ? 1 : 0)} className="px-3 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1 + (canBulkEdit ? 1 : 0) + (showActionsColumn ? 1 : 0)} className="px-3 py-10 text-center text-slate-400">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((pedido) => (
                  <tr
                    key={pedido.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(pedido.id, el);
                      else rowRefs.current.delete(pedido.id);
                    }}
                    style={
                      pedido.id === highlightedId
                        ? ({
                            "--row-blink-original": visibleSet.has("status") && pedido.status?.color ? pedido.status.color : "transparent",
                          } as React.CSSProperties)
                        : visibleSet.has("status")
                          ? rowTint(pedido.status?.color)
                          : undefined
                    }
                    className={`border-b border-slate-100 last:border-0 transition hover:brightness-95 ${
                      pedido.id === highlightedId ? "row-blink-highlight" : ""
                    }`}
                  >
                    {canBulkSelect && (
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
                        // A Descrição com foto de capa já mostra seu próprio title + prévia
                        // customizada (DescricaoHoverPreview) — o title nativo aqui duplicaria.
                        title={f.key === "descricao" && showCoverPreview && pedido.fotoCapa ? undefined : cellText(pedido, f.key) || undefined}
                        style={{ maxWidth: COLUMN_MAX_WIDTHS[f.key] ?? 150 }}
                        className="truncate px-3 py-2 text-slate-700"
                      >
                        {selectedIds.has(pedido.id) && f.key in copyableFields && !(f.key === "valorUnitario" && valoresHidden) ? (
                          <div className="flex min-w-0 items-center">
                            <button type="button" onClick={() => void copySelectedCell(pedido, f.key)} title={`Copiar ${copyableFields[f.key]}`} className="min-w-0 max-w-full cursor-pointer truncate text-left">
                              {f.key === "descricao" ? ((pedido.descricao as string | null | undefined) ?? "").toLocaleUpperCase("pt-BR") || "—" : cellValue(pedido, f.key)}
                            </button>
                            {f.key === "descricao" && showCoverPreview && canChangeFotoCapa && pedido.status?.label?.trim().toLowerCase() !== "finalizado" && (
                              <button type="button" className="shrink-0 rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Alterar foto de capa" onClick={() => { setCapaFor(pedido); setCapaFile(null); setCapaError(null); }}>📷</button>
                            )}
                          </div>
                        ) : cellValue(pedido, f.key)}
                      </td>
                    ))}
                    {showActionsColumn && (
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
                    )}
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
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => goToPage(1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                title="Primeira página"
              >
                «
              </button>
              <button
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="flex items-center gap-1.5">
                Página
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handlePageInputSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handlePageInputSubmit();
                    }
                  }}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center"
                />
                de {pageCount}
              </span>

              <button
                disabled={page >= pageCount}
                onClick={() => goToPage(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Próxima
              </button>
              <button
                disabled={page >= pageCount}
                onClick={() => goToPage(pageCount)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                title="Última página"
              >
                »
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

      {capaFor && (
        <Modal title={`Foto de capa — Pedido #${capaFor.id}`} onClose={() => { if (!savingCapa) { setCapaFor(null); setCapaFile(null); } }} widthClassName="max-w-sm">
          <p className="mb-3 text-sm text-slate-600">Selecione uma nova imagem para a capa do pedido. Ela não aparecerá na seção Fotos.</p>
          <input type="file" accept="image/*" className="w-full text-sm" onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)} disabled={savingCapa} />
          {capaError && <p className="mt-2 text-sm text-red-600">{capaError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" disabled={savingCapa} onClick={() => { setCapaFor(null); setCapaFile(null); }}>Cancelar</button>
            <button type="button" className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!capaFile || savingCapa} onClick={saveQuickCapa}>{savingCapa ? "Enviando..." : "Salvar capa"}</button>
          </div>
        </Modal>
      )}

      {attachmentsFor && (
        <AttachmentsModal
          pedidoId={attachmentsFor.id}
          kind="anexos"
          groupValue={attachmentsFor.codigo}
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

      {propostasFor && (
        <AttachmentsModal
          pedidoId={propostasFor.id}
          kind="propostas"
          groupValue={propostasFor.codigo}
          canUpload={isAdmin || propostasFor.statusEditable !== false}
          isAdmin={isAdmin}
          onClose={() => setPropostasFor(null)}
          onChanged={load}
        />
      )}

      {nfAnexosFor && (
        <AttachmentsModal
          pedidoId={nfAnexosFor.id}
          kind="nf"
          groupValue={nfAnexosFor.nf}
          canUpload={isAdmin}
          isAdmin={isAdmin}
          onClose={() => setNfAnexosFor(null)}
          onChanged={load}
        />
      )}

      {observacaoFor && (
        <ObservacaoModal pedidoId={observacaoFor.id} isAdmin={isAdmin} onClose={() => setObservacaoFor(null)} onSaved={load} />
      )}

      {quickPrevisaoPending && (
        <Modal title="Previsão de entrega" onClose={() => setQuickPrevisaoPending(null)} widthClassName="max-w-sm">
          <p className="mb-3 text-sm text-slate-600">Selecione a previsão de entrega ao cliente.</p>
          <input
            type="date"
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={quickPrevisao}
            onChange={(e) => setQuickPrevisao(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickPrevisaoPending(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={async () => {
                const pending = quickPrevisaoPending;
                setQuickPrevisaoPending(null);
                await changePedidoPrevisao(pending, quickPrevisao);
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {quickStatusPending && (
        <Modal title="Previsão de entrega" onClose={() => setQuickStatusPending(null)} widthClassName="max-w-sm">
          <p className="mb-3 text-sm text-slate-600">
            Este pedido será marcado como <span className="font-medium">Em andamento</span>. Qual a previsão de entrega ao cliente?
          </p>
          <input
            type="date"
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={quickPrevisao}
            onChange={(e) => setQuickPrevisao(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={async () => {
                const pending = quickStatusPending;
                setQuickStatusPending(null);
                await saveQuickStatus(pending.pedido, pending.statusId);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={async () => {
                const pending = quickStatusPending;
                setQuickStatusPending(null);
                await saveQuickStatus(pending.pedido, pending.statusId, quickPrevisao);
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {showBulkDelete && (
        <BulkDeleteModal
          pedidoIds={Array.from(selectedIds)}
          onClose={() => setShowBulkDelete(false)}
          onDone={load}
        />
      )}

      {showBulkStatus && (
        <BulkStatusModal
          pedidoIds={Array.from(selectedIds)}
          statusOptions={options.status}
          onClose={() => setShowBulkStatus(false)}
          onDone={load}
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
