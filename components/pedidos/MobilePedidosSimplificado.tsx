"use client";

import { useEffect, useMemo, useState } from "react";
import AttachmentsModal from "@/components/pedidos/AttachmentsModal";
import Modal from "@/components/Modal";
import ObservacaoModal from "@/components/pedidos/ObservacaoModal";
import { formatDate } from "@/lib/format";
import { usePedidoOptions } from "@/lib/useOptions";
import { useValuesVisibility } from "@/components/ValuesVisibilityProvider";
import { useSearchParams, useRouter } from "next/navigation";

type Pedido = {
  id: number;
  cliente?: { name?: string } | null;
  status?: { id?: number; label?: string; color?: string } | null;
  faturado?: { label?: string } | null;
  descricao?: string | null;
  pedidoCompra?: string | null;
  valorUnitario?: number | string | null;
  qtd?: number | null;
  valorTotal?: number | string | null;
  previsao?: string | null;
  codigo?: string | null;
  publicToken?: string | null;
  anexosCount?: number;
  fotosCount?: number;
  statusEditable?: boolean;
  nfAnexosCount?: number;
  nf?: string | null;
  observacao?: string | null;
  data?: string | null;
  dataFaturamento?: string | null;
  ncm?: string | null;
  pdv?: string | null;
  editadoPor?: string | null;
  pagamento?: { label?: string } | null;
  faturamento?: { label?: string } | null;
  tipo?: { label?: string } | null;
};
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const isYes = (s?: string) => ["sim", "s", "yes"].includes(normalize((s || "").trim()));
const isFinal = (s?: string) => normalize((s || "").trim()) === "finalizado";

export default function MobilePedidosSimplificado({ canChangePedidoStatus, isAdmin }: { canChangePedidoStatus: boolean; isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hidden: valoresHidden } = useValuesVisibility();
  const { options } = usePedidoOptions();
  const [items, setItems] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [unified, setUnified] = useState(false);
  const [idAscending, setIdAscending] = useState(false);
  useEffect(() => { const read = () => { setUnified(localStorage.getItem("imetal_mobile_unificar") === "1"); setIdAscending(localStorage.getItem("imetal_mobile_id_ascending") === "1"); }; read(); window.addEventListener("imetal-mobile-unificar", read); return () => window.removeEventListener("imetal-mobile-unificar", read); }, []);
  const [mode, setMode] = useState<"simples" | "completa">("simples");
  const [attachment, setAttachment] = useState<{ pedido: Pedido; kind: "fotos" | "nf" } | null>(null);
  const [statusFor, setStatusFor] = useState<Pedido | null>(null);
  const [statusPending, setStatusPending] = useState<{ pedido: Pedido; statusId: number } | null>(null);
  const [statusPrevisao, setStatusPrevisao] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [forecast, setForecast] = useState<Pedido | null>(null);
  const [forecastDate, setForecastDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Pedido | null>(null);
  const [observacaoFor, setObservacaoFor] = useState<Pedido | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  async function load() {
    try {
      const res = await fetch("/api/pedidos?export=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Não foi possível carregar os pedidos.");
      const data = await res.json();
      setItems(data.items || []);
      setError(data.total > (data.items || []).length ? "A lista atingiu o limite de registros. Refine a busca no desktop para consultar pedidos antigos." : "");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar pedidos."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const alertIds = useMemo(() => { const raw = searchParams.get("finalizadosNovos") || searchParams.get("pedidosNovos"); return raw ? raw.split(",").map(Number).filter(n=>Number.isInteger(n) && n>0) : null; }, [searchParams]);
  const lateOnly = searchParams.get("atrasados") === "1";
  const filtered = useMemo(() => items.filter(p => {
    if (alertIds && !alertIds.includes(p.id)) return false;
    if (lateOnly && (!p.previsao || String(p.previsao).slice(0,10) >= new Date().toISOString().slice(0,10) || ["finalizado","cancelado"].includes(normalize(p.status?.label || "")))) return false;
    if (mode === "simples" && normalize(p.status?.label || "") === "cancelado") return false;
    if (!alertIds && !lateOnly && mode === "simples" && isFinal(p.status?.label) && isYes(p.faturado?.label)) return false;
    if (unbilledOnly && isYes(p.faturado?.label)) return false;
    if (statusFilter && p.status?.label !== statusFilter) return false;
    const q = normalize(search.trim());
    return !q || [String(p.id), p.cliente?.name || "", p.descricao || "", p.status?.label || "", p.pedidoCompra || ""].some(x => normalize(x).includes(q));
  }), [items, mode, unbilledOnly, search, statusFilter, alertIds, lateOnly]);
  const statusOptions = useMemo(() => [...new Set(items.map(p => p.status?.label).filter((v): v is string => Boolean(v)))].sort((a,b)=>a.localeCompare(b,"pt-BR")), [items]);
  const groups = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    filtered.forEach(p => {
      const name = unified ? "Todos os clientes" : (p.cliente?.name?.trim() || "SEM CLIENTE");
      map.set(name, [...(map.get(name) || []), p]);
    });
    return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0], "pt-BR")).map(([name, orders]) => ({
      name, orders: orders.sort((a,b) => unified && idAscending ? a.id - b.id : b.id - a.id),
      total: orders.reduce((sum,p) => sum + Number(p.valorTotal || 0), 0),
    }));
  }, [filtered, unified, idAscending]);
  const searching = search.trim().length > 0;
  const grandTotal = groups.reduce((sum,g) => sum + g.total, 0);
  const dot = (label: string, title: string, color: string, action: () => void) => (
    <button type="button" title={title} aria-label={title} onClick={action} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${color}`}>{label}</button>
  );
  return <section className="space-y-3 pb-24 text-slate-800">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-xl font-bold">Pedidos</h1>
      <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
        <button onClick={() => {setMode("simples");setUnbilledOnly(false);}} className={`rounded-md px-2 py-2 ${mode === "simples" ? "bg-slate-800 text-white" : ""}`}>Simples</button>
        <button onClick={() => {setMode("completa");setUnbilledOnly(false);}} className={`rounded-md px-2 py-2 ${mode === "completa" ? "bg-slate-800 text-white" : ""}`}>Completa</button>
      </div>
    </div>
    {(alertIds || lateOnly) && <button type="button" onClick={()=>{router.push("/");setStatusFilter("");setUnbilledOnly(false);}} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${lateOnly ? "border-red-300 bg-red-50 text-red-700" : searchParams.has("finalizadosNovos") ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>← Ver todos</button>}
    <input aria-label="Buscar pedidos" placeholder="Buscar ID, cliente, status ou descrição..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500" />
    {<select aria-label="Filtrar por status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todos os status</option>{statusOptions.map(st=><option key={st} value={st}>{st}</option>)}</select>}
    {(search.trim() || unbilledOnly || statusFilter || alertIds || lateOnly) && <button type="button" onClick={()=>{setSearch("");setUnbilledOnly(false);setStatusFilter("");if (alertIds || lateOnly) router.push("/");}} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Limpar filtros</button>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={()=>setUnbilledOnly(v=>!v)} aria-pressed={unbilledOnly} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${unbilledOnly ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"}`}>Não faturados {unbilledOnly ? "✓" : ""}</button>
      <div className="flex gap-2">
        <button onClick={()=>setExpanded(groups.map(g=>g.name))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">Expandir todos</button>
        <button onClick={()=>setExpanded([])} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">Recolher todos</button>
      </div>
    </div>
    {loading && <p className="py-8 text-center text-sm text-slate-500">Carregando pedidos...</p>}
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
    {!loading && groups.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}
    {groups.map(g => {
      const open = unified || searching || expanded.includes(g.name);
      return <div key={g.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" aria-expanded={open} onClick={()=>setExpanded(v=>v.includes(g.name)?v.filter(n=>n!==g.name):[...v,g.name])} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left">
          <div><p className="text-sm font-bold">{g.name}</p><p className="text-xs text-slate-500">{g.orders.length} {g.orders.length === 1 ? "pedido" : "pedidos"}</p></div>
          <span className="text-lg text-slate-500">{open ? "⌃" : "⌄"}</span>
        </button>
        {open && <div className="border-t border-slate-200">
          {g.orders.map(p=><div key={p.id} className="space-y-2 border-b border-slate-100 px-3 py-3 last:border-0">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-2 py-1.5" style={{backgroundColor:p.status?.color || "#f1f5f9"}}><span className="text-sm font-bold text-slate-900">ID {p.id}</span>{canChangePedidoStatus && !isFinal(p.status?.label) ? <button type="button" title="Alterar status" aria-label={`Alterar status do pedido ${p.id}`} onClick={()=>{setStatusError("");setStatusFor(p);}} className="cursor-pointer rounded px-1 py-0.5 text-right text-xs font-bold text-slate-900 underline-offset-2 focus-visible:outline focus-visible:outline-2">{p.status?.label || "Sem status"} ▾</button> : <span className="text-right text-xs font-bold text-slate-900">{p.status?.label || "Sem status"}</span>}</div>
            {unified && <p className="text-xs font-semibold text-slate-600">{p.cliente?.name || "SEM CLIENTE"}</p>}
            <p className="text-xs text-slate-500">Pedido de compra: <span className="font-semibold text-slate-700">{p.pedidoCompra || "—"}</span></p>
            <p className="text-sm font-bold">{p.descricao || "Sem descrição"}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Qtd: {p.qtd ?? "—"}</span>
              <div className="flex gap-2">
                
                {dot("F","Abrir fotos", (p.fotosCount || 0) > 0 ? "bg-green-600" : "bg-green-100 text-green-600 ring-1 ring-green-300",()=>setAttachment({pedido:p,kind:"fotos"}))}
                {(p.nfAnexosCount || 0) > 0 && dot("N","Visualizar notas fiscais","bg-sky-700",()=>setAttachment({pedido:p,kind:"nf"}))}
                {dot("P","Consultar previsão","bg-amber-600",()=>{setForecast(p);setForecastDate(p.previsao ? String(p.previsao).slice(0,10) : "");})}
                {dot("I",mode === "completa" ? "Ficha completa do pedido" : "Resumo do pedido","bg-violet-600",()=>setDetail(p))}
                
                {mode === "completa" && Boolean(p.observacao?.trim()) && dot("O","Observações","bg-cyan-600",()=>setObservacaoFor(p))}
              </div>
            </div>
            {mode === "completa" && !valoresHidden && <p className="text-xs text-slate-500">Valor: {money(Number(p.valorTotal || 0))} · Faturado: {p.faturado?.label || "—"}</p>}
          </div>)}
        </div>}
        {!valoresHidden && <div className="flex justify-between bg-slate-50 px-3 py-2 text-xs font-semibold"><span>Total do cliente</span><span>{money(g.total)}</span></div>}
      </div>;
    })}
    {!valoresHidden && <div className="sticky bottom-0 flex justify-between rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg"><span>Total geral · {filtered.length} pedidos</span><span>{money(grandTotal)}</span></div>}
    {attachment && <AttachmentsModal pedidoId={attachment.pedido.id} kind={attachment.kind} groupValue={attachment.kind === "nf" ? attachment.pedido.nf ?? undefined : undefined} canUpload={attachment.kind === "fotos" && (isAdmin || attachment.pedido.statusEditable !== false)} isAdmin={isAdmin} onClose={()=>setAttachment(null)} onChanged={()=>void load()}/>}
    {observacaoFor && <ObservacaoModal pedidoId={observacaoFor.id} isAdmin={isAdmin} onClose={()=>setObservacaoFor(null)} onSaved={()=>void load()}/>}
    {detail && <Modal title={`Pedido #${detail.id}`} onClose={()=>setDetail(null)} widthClassName="max-w-sm"><div className="space-y-2 text-sm"><p><strong>Cliente:</strong> {detail.cliente?.name}</p><p><strong>Status:</strong> {detail.status?.label}</p><p><strong>Descrição:</strong> {detail.descricao}</p><p><strong>Pedido de compra:</strong> {detail.pedidoCompra || "—"}</p><p><strong>Quantidade:</strong> {detail.qtd}</p>{!valoresHidden && <><p><strong>Valor unitário:</strong> {money(Number(detail.valorUnitario || 0))}</p><p><strong>Valor total:</strong> {money(Number(detail.valorTotal || 0))}</p></>}{mode === "completa" && <div className="mt-4 space-y-3 border-t border-slate-200 pt-3"><h3 className="font-bold">Dados gerais</h3><p><strong>Data:</strong> {detail.data ? formatDate(detail.data) : "—"}</p><p><strong>Código:</strong> {detail.codigo || "—"}</p><p><strong>Tipo:</strong> {detail.tipo?.label || "—"}</p><p><strong>NCM:</strong> {detail.ncm || "—"}</p><h3 className="font-bold">Produção</h3><p><strong>Previsão:</strong> {detail.previsao ? formatDate(detail.previsao) : "—"}</p><p><strong>PDV:</strong> {detail.pdv || "—"}</p><h3 className="font-bold">Faturamento</h3><p><strong>Faturamento:</strong> {detail.faturamento?.label || "—"}</p><p><strong>Faturado:</strong> {detail.faturado?.label || "—"}</p><p><strong>Pagamento:</strong> {detail.pagamento?.label || "—"}</p><p><strong>NF:</strong> {detail.nf || "—"}</p><p><strong>Data faturamento:</strong> {detail.dataFaturamento ? formatDate(detail.dataFaturamento) : "—"}</p><h3 className="font-bold">Observações e histórico</h3><p><strong>Observação:</strong> {detail.observacao || "—"}</p><p><strong>Editado por:</strong> {detail.editadoPor || "—"}</p></div>}</div></Modal>}
    {statusFor && <Modal title={`Alterar status — Pedido #${statusFor.id}`} onClose={()=>setStatusFor(null)} widthClassName="max-w-sm"><div className="space-y-3"><p className="text-sm text-slate-600">Selecione o novo status:</p><div className="space-y-2">{options.status.map(st=><button key={st.id} type="button" disabled={statusSaving || st.id === statusFor.status?.id} onClick={async()=>{const pedido=statusFor;setStatusError("");setStatusFor(null);if(normalize(st.label)==="em andamento"){setStatusPrevisao(pedido.previsao ? String(pedido.previsao).slice(0,10) : "");setStatusPending({pedido,statusId:st.id});return;}setStatusSaving(true);try{const res=await fetch(`/api/pedidos/${pedido.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({statusId:st.id,quickStatusChange:true})});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error || "Não foi possível alterar o status.");}await load();}catch(e){window.alert(e instanceof Error?e.message:"Erro ao alterar status.");}finally{setStatusSaving(false);}}} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"><span>{st.label}</span>{st.id===statusFor.status?.id && <span>Atual</span>}</button>)}</div>{statusError && <p role="alert" className="text-sm text-red-700">{statusError}</p>}</div></Modal>}
    {statusPending && <Modal title="Previsão de entrega" onClose={()=>setStatusPending(null)} widthClassName="max-w-sm"><div className="space-y-3"><p className="text-sm">O pedido será marcado como Em andamento. Informe a previsão de entrega, se disponível.</p><input type="date" value={statusPrevisao} onChange={e=>setStatusPrevisao(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"/><div className="flex justify-end gap-2"><button type="button" disabled={statusSaving} onClick={async()=>{const pending=statusPending;if(!pending)return;setStatusPending(null);setStatusSaving(true);try{const res=await fetch(`/api/pedidos/${pending.pedido.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({statusId:pending.statusId,quickStatusChange:true})});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error || "Não foi possível alterar o status.");}await load();}catch(e){window.alert(e instanceof Error?e.message:"Erro ao alterar status.");}finally{setStatusSaving(false);}}} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Pular</button><button type="button" disabled={statusSaving} onClick={async()=>{const pending=statusPending;if(!pending)return;setStatusPending(null);setStatusSaving(true);try{const res=await fetch(`/api/pedidos/${pending.pedido.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({statusId:pending.statusId,quickStatusChange:true,previsao:statusPrevisao})});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error || "Não foi possível alterar o status.");}await load();}catch(e){window.alert(e instanceof Error?e.message:"Erro ao alterar status.");}finally{setStatusSaving(false);}}} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Salvar</button></div></div></Modal>}
    {forecast && <Modal title={`Previsão — Pedido #${forecast.id}`} onClose={()=>setForecast(null)} widthClassName="max-w-sm"><div className="space-y-3"><input type="date" value={forecastDate} onChange={e=>setForecastDate(e.target.value)} disabled={!canChangePedidoStatus || isFinal(forecast.status?.label)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />{canChangePedidoStatus && !isFinal(forecast.status?.label) && <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={async()=>{setSaving(true);try{const res=await fetch(`/api/pedidos/${forecast.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({previsao:forecastDate,quickPrevisaoChange:true})});if(!res.ok)throw new Error("Não foi possível salvar a previsão.");setForecast(null);await load();}catch(e){window.alert(e instanceof Error?e.message:"Erro");}finally{setSaving(false);}}}>{saving?"Salvando...":"Salvar previsão"}</button>}</div></Modal>}
  </section>;
}
