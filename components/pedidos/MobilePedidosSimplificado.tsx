"use client";

import { useEffect, useMemo, useState } from "react";
import AttachmentsModal from "@/components/pedidos/AttachmentsModal";
import Modal from "@/components/Modal";

type Pedido = {
  id: number;
  cliente?: { name?: string } | null;
  status?: { label?: string; color?: string } | null;
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
};
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const isYes = (s?: string) => ["sim", "s", "yes"].includes(normalize((s || "").trim()));
const isFinal = (s?: string) => normalize((s || "").trim()) === "finalizado";

export default function MobilePedidosSimplificado({ canChangePedidoStatus, isAdmin }: { canChangePedidoStatus: boolean; isAdmin: boolean }) {
  const [items, setItems] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [mode, setMode] = useState<"simples" | "completa">("simples");
  const [attachment, setAttachment] = useState<{ pedido: Pedido; kind: "anexos" | "fotos" } | null>(null);
  const [forecast, setForecast] = useState<Pedido | null>(null);
  const [forecastDate, setForecastDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Pedido | null>(null);
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
  const filtered = useMemo(() => items.filter(p => {
    if (mode === "simples" && isFinal(p.status?.label) && isYes(p.faturado?.label)) return false;
    if (unbilledOnly && isYes(p.faturado?.label)) return false;
    const q = normalize(search.trim());
    return !q || [String(p.id), p.cliente?.name || "", p.descricao || "", p.status?.label || "", p.pedidoCompra || ""].some(x => normalize(x).includes(q));
  }), [items, mode, unbilledOnly, search]);
  const groups = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    filtered.forEach(p => {
      const name = p.cliente?.name?.trim() || "SEM CLIENTE";
      map.set(name, [...(map.get(name) || []), p]);
    });
    return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0], "pt-BR")).map(([name, orders]) => ({
      name, orders: orders.sort((a,b) => b.id - a.id),
      total: orders.reduce((sum,p) => sum + Number(p.valorTotal || 0), 0),
    }));
  }, [filtered]);
  const searching = search.trim().length > 0;
  const grandTotal = groups.reduce((sum,g) => sum + g.total, 0);
  const dot = (label: string, title: string, color: string, action: () => void) => (
    <button type="button" title={title} aria-label={title} onClick={action} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${color}`}>{label}</button>
  );
  return <section className="space-y-3 pb-24 text-slate-800">
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-xl font-bold">Pedidos</h1>
      <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
        <button onClick={() => {setMode("simples");setExpanded([]);}} className={`rounded-md px-2 py-2 ${mode === "simples" ? "bg-slate-800 text-white" : ""}`}>Simples</button>
        <button onClick={() => {setMode("completa");setExpanded([]);}} className={`rounded-md px-2 py-2 ${mode === "completa" ? "bg-slate-800 text-white" : ""}`}>Completa</button>
      </div>
    </div>
    <input aria-label="Buscar pedidos" placeholder="Buscar ID, cliente, status ou descrição..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500" />
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
      const open = searching || expanded.includes(g.name);
      return <div key={g.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" aria-expanded={open} onClick={()=>setExpanded(v=>v.includes(g.name)?v.filter(n=>n!==g.name):[...v,g.name])} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left">
          <div><p className="text-sm font-bold">{g.name}</p><p className="text-xs text-slate-500">{g.orders.length} pedido(s)</p></div>
          <span className="text-lg text-slate-500">{open ? "⌃" : "⌄"}</span>
        </button>
        {open && <div className="border-t border-slate-200">
          {g.orders.map(p=><div key={p.id} className="space-y-2 border-b border-slate-100 px-3 py-3 last:border-0">
            <div className="flex items-start justify-between gap-2"><span className="text-sm font-bold">ID {p.id}</span><span className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold" style={{backgroundColor:p.status?.color || "#f1f5f9", color:p.status?.color ? "#172033" : "#475569"}}>{p.status?.label || "Sem status"}</span></div>
            <p className="text-xs text-slate-500">Pedido de compra: <span className="font-semibold text-slate-700">{p.pedidoCompra || "—"}</span></p>
            <p className="text-sm">{p.descricao || "Sem descrição"}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Qtd: {p.qtd ?? "—"}</span>
              <div className="flex gap-2">
                {(p.anexosCount || 0) > 0 && dot("A","Abrir anexos","bg-blue-600",()=>setAttachment({pedido:p,kind:"anexos"}))}
                {(p.fotosCount || 0) > 0 && dot("F","Abrir fotos","bg-green-600",()=>setAttachment({pedido:p,kind:"fotos"}))}
                {dot("P","Consultar previsão","bg-amber-600",()=>{setForecast(p);setForecastDate(p.previsao ? String(p.previsao).slice(0,10) : "");})}
                {dot("N","Abrir número do pedido","bg-violet-600",()=>setDetail(p))}
              </div>
            </div>
            {mode === "completa" && <p className="text-xs text-slate-500">Valor: {money(Number(p.valorTotal || 0))} · Faturado: {p.faturado?.label || "—"}</p>}
          </div>)}
        </div>}
        <div className="flex justify-between bg-slate-50 px-3 py-2 text-xs font-semibold"><span>Total do cliente</span><span>{money(g.total)}</span></div>
      </div>;
    })}
    <div className="sticky bottom-0 flex justify-between rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg"><span>Total geral · {filtered.length} pedidos</span><span>{money(grandTotal)}</span></div>
    {attachment && <AttachmentsModal pedidoId={attachment.pedido.id} kind={attachment.kind} groupValue={attachment.kind === "anexos" ? attachment.pedido.codigo ?? undefined : undefined} publicToken={attachment.kind === "anexos" ? attachment.pedido.publicToken ?? undefined : undefined} canUpload={isAdmin || attachment.pedido.statusEditable !== false} isAdmin={isAdmin} onClose={()=>setAttachment(null)} onChanged={()=>void load()}/>}
    {detail && <Modal title={`Pedido #${detail.id}`} onClose={()=>setDetail(null)} widthClassName="max-w-sm"><div className="space-y-2 text-sm"><p><strong>Cliente:</strong> {detail.cliente?.name}</p><p><strong>Status:</strong> {detail.status?.label}</p><p><strong>Descrição:</strong> {detail.descricao}</p><p><strong>Pedido de compra:</strong> {detail.pedidoCompra || "—"}</p><p><strong>Quantidade:</strong> {detail.qtd}</p><p><strong>Valor unitário:</strong> {money(Number(detail.valorUnitario || 0))}</p><p><strong>Valor total:</strong> {money(Number(detail.valorTotal || 0))}</p></div></Modal>}
    {forecast && <Modal title={`Previsão — Pedido #${forecast.id}`} onClose={()=>setForecast(null)} widthClassName="max-w-sm"><div className="space-y-3"><input type="date" value={forecastDate} onChange={e=>setForecastDate(e.target.value)} disabled={!canChangePedidoStatus || isFinal(forecast.status?.label)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />{canChangePedidoStatus && !isFinal(forecast.status?.label) && <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={async()=>{setSaving(true);try{const res=await fetch(`/api/pedidos/${forecast.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({previsao:forecastDate,quickPrevisaoChange:true})});if(!res.ok)throw new Error("Não foi possível salvar a previsão.");setForecast(null);await load();}catch(e){window.alert(e instanceof Error?e.message:"Erro");}finally{setSaving(false);}}}>{saving?"Salvando...":"Salvar previsão"}</button>}</div></Modal>}
  </section>;
}
