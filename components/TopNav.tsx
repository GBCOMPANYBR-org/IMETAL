"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useValuesVisibility } from "@/components/ValuesVisibilityProvider";

// No realtime infra in this project (no WebSocket/SSE/Pusher) — polling is the pragmatic choice:
// zero new infra, and an SSE connection held open per browser tab would sit on Neon's already
// shared pooled connection for no real benefit. Paused while the tab is hidden so it doesn't burn
// invocations in background tabs. The query behind this is two cheap COUNTs scoped to one user,
// so a short interval is fine even at this poll rate.
const POLL_INTERVAL_MS = 8_000;

function useForumIndicator() {
  const [state, setState] = useState<"new" | "open" | "none">("none");

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/forum/pendencias/count");
        if (!res.ok || cancelled) return;
        const { newCount, openCount } = (await res.json()) as { newCount: number; openCount: number };
        if (cancelled) return;
        setState(newCount > 0 ? "new" : openCount > 0 ? "open" : "none");
      } catch {
        // Transient network hiccup — next poll tick recovers, nothing to surface to the user.
      }
    }

    refresh();
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    function onVisibilityChange() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return state;
}

// Card de "pedidos atrasados" no lugar onde antes ficava o botão de Saúde Ocupacional — pedido
// do Felipe pra dar visibilidade imediata de pedidos cuja Previsão de entrega já venceu. Só
// busca quando `enabled` (admin-only: não-admin não tem a rota liberada em requireAdmin()).
function useAtrasadosCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/pedidos/atrasados-count");
        if (!res.ok || cancelled) return;
        const { count } = (await res.json()) as { count: number };
        if (!cancelled) setCount(count);
      } catch {
        // Transient network hiccup — next poll tick recovers, nothing to surface to the user.
      }
    }

    refresh();
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    function onVisibilityChange() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  return count;
}


function useFinalizadosNovosCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/pedidos/finalizados-novos/count");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        // Próximo polling recupera falhas transitórias.
      }
    }
    refresh();
    const interval = setInterval(() => { if (!document.hidden) refresh(); }, POLL_INTERVAL_MS);
    function onVisibilityChange() { if (!document.hidden) refresh(); }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  return [count, setCount] as const;
}
function useNovosCount(enabled: boolean) {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    if(!enabled) return;
    let cancelled=false;
    async function refresh(){
      try { const res=await fetch("/api/pedidos/novos/count"); if(res.ok&&!cancelled) setCount(((await res.json()) as {count:number}).count); } catch {}
    }
    refresh();
    const interval=setInterval(()=>{if(!document.hidden) refresh();},POLL_INTERVAL_MS);
    return ()=>{cancelled=true;clearInterval(interval);};
  },[enabled]);
  return count;
}
interface Props {
  name: string;
  role: "ADMIN" | "USER";
  isAdmin: boolean;
  canViewGraficos: boolean;
  /** Se este usuário tem algum campo de valor (Valor Unitário/Total) visível — só nesse caso faz sentido oferecer o toggle de ocultar. */
  canSeeValores: boolean;
  /** Se este usuário tem uma concessão ativa em SauUserAccess — ver lib/saude/permissions.ts. */
  canAccessSaude: boolean;
  canAlertNewPedido: boolean;
}

const LINK_CLS = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
const ACTIVE_CLS = "bg-brand text-white";
const INACTIVE_CLS = "text-slate-600 hover:bg-slate-100";

export default function TopNav({ name, role, isAdmin, canViewGraficos, canSeeValores, canAccessSaude, canAlertNewPedido }: Props) {
  const pathname = usePathname();
  // Detecta celulares pelo dispositivo, nao apenas pela largura do viewport.
  // Navegadores em modo "site para computador" podem informar 980px ou mais.
  useEffect(() => {
    const ua = navigator.userAgent;
    const phoneUA = /iPhone|iPod|Windows Phone|Android.*Mobile/i.test(ua);
    const smallTouchDevice = navigator.maxTouchPoints > 0 && Math.min(window.screen.width, window.screen.height) <= 600;
    const isPhone = phoneUA || smallTouchDevice;
    document.documentElement.classList.toggle("imetal-phone", isPhone);
    return () => document.documentElement.classList.remove("imetal-phone");
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileUnified, setMobileUnified] = useState(false);
  const [mobileIdAscending, setMobileIdAscending] = useState(false);
  useEffect(() => { setMobileUnified(localStorage.getItem("imetal_mobile_unificar") === "1"); setMobileIdAscending(localStorage.getItem("imetal_mobile_id_ascending") === "1"); }, []);
  const router = useRouter();
  const { hidden, toggle } = useValuesVisibility();
  const forumIndicator = useForumIndicator();
  const atrasadosCount = useAtrasadosCount(isAdmin);
  const novosCount = useNovosCount(canAlertNewPedido);
  const [novosDismissed, setNovosDismissed] = useState(false);
  useEffect(() => { if (novosCount === 0) setNovosDismissed(false); }, [novosCount]);
  const [finalizadosNovosCount, setFinalizadosNovosCount] = useFinalizadosNovosCount(isAdmin);

  async function handleNovos() {
    try {
      const res = await fetch("/api/pedidos/novos/open", {method:"POST"});
      if (!res.ok) return;
      const {ids} = await res.json() as {ids:number[]};
      setNovosDismissed(true);
      if (ids.length) router.push("/?pedidosNovos=" + ids.join(","));
    } catch { /* tenta novamente */ }
  }

  async function handleFinalizadosNovos() {
    try {
      const res = await fetch("/api/pedidos/finalizados-novos/open", { method: "POST" });
      if (!res.ok) return;
      const { ids } = (await res.json()) as { ids: number[] };
      if (ids.length > 0) router.push("/?finalizadosNovos=" + ids.join(","));
    } catch {
      // Mantém o alerta visível para o administrador tentar novamente.
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const topNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pathname !== "/") return;
    const el = topNavRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--imetal-topnav-height", `${el.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--imetal-topnav-height");
    };
  }, [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <><header ref={topNavRef} className={pathname === "/" ? "fixed inset-x-0 top-0 z-50 w-screen border-b border-slate-200 bg-white pt-[calc(env(safe-area-inset-top)+4px)] print:hidden md:pt-0 imetal-mobile-header" : "sticky top-0 z-30 border-b border-slate-200 bg-white pt-[calc(env(safe-area-inset-top)+4px)] print:hidden md:pt-0 imetal-mobile-header"}>
      <div className="imetal-mobile-nav flex items-center justify-between gap-2 px-4 py-2 md:hidden">
        <Link href="/" aria-label="Ir para Pedidos"><Image src="/logo.png" alt="IMETAL" width={110} height={38} priority className="h-8 w-auto" /></Link>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {canAlertNewPedido && novosCount > 0 && !novosDismissed && <button onClick={handleNovos} title="Novos pedidos" className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">★ {novosCount} pedido{novosCount === 1 ? "" : "s"} novo{novosCount === 1 ? "" : "s"}</button>}
          {isAdmin && finalizadosNovosCount > 0 && <button onClick={handleFinalizadosNovos} title="Pedidos finalizados não faturados" className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">✓ {finalizadosNovosCount} pedido{finalizadosNovosCount === 1 ? "" : "s"} finalizado{finalizadosNovosCount === 1 ? "" : "s"}</button>}
          {isAdmin && atrasadosCount > 0 && <Link href="/?atrasados=1" title="Pedidos atrasados" className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">⚠ {atrasadosCount} pedido{atrasadosCount === 1 ? "" : "s"} atrasado{atrasadosCount === 1 ? "" : "s"}</Link>}
          <button type="button" aria-label="Abrir menu" aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(v=>!v)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xl text-slate-700">☰</button>
        </div>
      </div>
      {mobileMenuOpen && <nav aria-label="Menu mobile" className="imetal-mobile-menu grid gap-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link onClick={()=>setMobileMenuOpen(false)} href="/" className="rounded-lg px-3 py-2 text-sm">Pedidos</Link>
        {canViewGraficos && <Link onClick={()=>setMobileMenuOpen(false)} href="/graficos" className="rounded-lg px-3 py-2 text-sm">Gráficos</Link>}
        <Link onClick={()=>setMobileMenuOpen(false)} href="/forum" className="rounded-lg px-3 py-2 text-sm">Fórum</Link>
        {isAdmin && <>
          <Link onClick={()=>setMobileMenuOpen(false)} href="/admin/usuarios" className="rounded-lg px-3 py-2 text-sm">Usuários</Link>
          <Link onClick={()=>setMobileMenuOpen(false)} href="/admin/logs" className="rounded-lg px-3 py-2 text-sm">LOG's</Link>
        </>}
        {canAccessSaude && <Link onClick={()=>setMobileMenuOpen(false)} href="/inicio" className="rounded-lg px-3 py-2 text-sm">Trocar sistema</Link>}
        {pathname === "/" && <button type="button" onClick={()=>{const next=localStorage.getItem("imetal_mobile_unificar") !== "1";localStorage.setItem("imetal_mobile_unificar",next?"1":"0");setMobileUnified(next);window.dispatchEvent(new Event("imetal-mobile-unificar"));setMobileMenuOpen(false);}} className="rounded-lg px-3 py-2 text-left text-sm">{mobileUnified ? "Dividir por cliente" : "Unificar pedidos"}</button>}
        {pathname === "/" && mobileUnified && <button type="button" onClick={()=>{const next=!mobileIdAscending;localStorage.setItem("imetal_mobile_id_ascending",next?"1":"0");setMobileIdAscending(next);window.dispatchEvent(new Event("imetal-mobile-unificar"));setMobileMenuOpen(false);}} className="rounded-lg px-3 py-2 text-left text-sm">{mobileIdAscending ? "ID: crescente ↑ (inverter para ↓)" : "ID: decrescente ↓ (inverter para ↑)"}</button>}
        {canSeeValores && <button onClick={toggle} className="rounded-lg px-3 py-2 text-left text-sm">{hidden ? "Mostrar valores" : "Ocultar valores"}</button>}
        <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-sm text-red-700">Sair</button>
      </nav>}
      <div className="imetal-desktop-nav mx-auto hidden max-w-[1600px] items-center gap-4 px-4 py-2.5 md:flex">
        <Image src="/logo.png" alt="IMETAL" width={120} height={41} priority className="h-8 w-auto" />
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          <Link href="/" className={`${LINK_CLS} ${isActive("/") ? ACTIVE_CLS : INACTIVE_CLS}`}>
            Pedidos
          </Link>
          {canViewGraficos && (
            <Link href="/graficos" className={`${LINK_CLS} ${isActive("/graficos") ? ACTIVE_CLS : INACTIVE_CLS}`}>
              Gráficos
            </Link>
          )}
          <Link href="/forum" className={`relative ${LINK_CLS} ${isActive("/forum") ? ACTIVE_CLS : INACTIVE_CLS}`}>
            Fórum
            {forumIndicator !== "none" && (
              <span
                className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${forumIndicator === "new" ? "bg-emerald-500" : "bg-amber-400"}`}
                title={forumIndicator === "new" ? "Você tem marcações novas" : "Você tem pendências abertas"}
              />
            )}
          </Link>
          {isAdmin && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <Link href="/admin/status" className={`${LINK_CLS} ${isActive("/admin/status") ? ACTIVE_CLS : INACTIVE_CLS}`}>
                Status
              </Link>
              <Link href="/admin/clientes" className={`${LINK_CLS} ${isActive("/admin/clientes") ? ACTIVE_CLS : INACTIVE_CLS}`}>
                Clientes
              </Link>
              <Link href="/admin/listas" className={`${LINK_CLS} ${isActive("/admin/listas") ? ACTIVE_CLS : INACTIVE_CLS}`}>
                Listas
              </Link>
              <Link href="/admin/usuarios" className={`${LINK_CLS} ${isActive("/admin/usuarios") ? ACTIVE_CLS : INACTIVE_CLS}`}>
                Usuários
              </Link>
              <Link href="/admin/logs" className={`${LINK_CLS} ${isActive("/admin/logs") ? ACTIVE_CLS : INACTIVE_CLS}`}>
                LOG's
              </Link>
            </>
          )}
          {canAccessSaude && (
            <Link
              href="/inicio"
              title="Trocar de sistema"
              className="rounded-lg bg-slate-100 px-2 py-1 text-sm transition hover:bg-slate-200"
            >
              🔄
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {canAlertNewPedido && novosCount > 0 && !novosDismissed && (
            <button type="button" onClick={handleNovos} className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-200" title="Novos números de pedido de compra">
              ★ {novosCount} pedido{novosCount === 1 ? "" : "s"} novo{novosCount === 1 ? "" : "s"}
            </button>
          )}
          {isAdmin && finalizadosNovosCount > 0 && (
            <button
              type="button"
              onClick={handleFinalizadosNovos}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              title="Pedidos Finalizados com Faturamento diferente de SIM"
            >
              ✓ {finalizadosNovosCount} pedido{finalizadosNovosCount === 1 ? "" : "s"} finalizado{finalizadosNovosCount === 1 ? "" : "s"}
            </button>
          )}
          {isAdmin && atrasadosCount > 0 && (
            <Link
              href="/?atrasados=1"
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              title="Pedidos com Previsão de entrega vencida"
            >
              ⚠️ {atrasadosCount} pedido{atrasadosCount === 1 ? "" : "s"} atrasado{atrasadosCount === 1 ? "" : "s"}
            </Link>
          )}
          {canSeeValores && (
            <button
              onClick={toggle}
              title={hidden ? "Mostrar valores" : "Ocultar valores"}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {hidden ? "👁 Valores ocultos" : "👁 Valores visíveis"}
            </button>
          )}
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-slate-700">{name}</div>
            <div className="text-xs text-slate-400">{role === "ADMIN" ? "Administrador" : "Usuário"}</div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </div>
    </header>{pathname === "/" && <div aria-hidden="true" style={{ height: "var(--imetal-topnav-height, 72px)" }} className="print:hidden" />}
    </>
  );
}
