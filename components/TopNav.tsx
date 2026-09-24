"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useValuesVisibility } from "@/components/ValuesVisibilityProvider";

// No realtime infra in this project (no WebSocket/SSE/Pusher) — polling is the pragmatic choice:
// zero new infra, and an SSE connection held open per browser tab would sit on Neon's already
// shared pooled connection for no real benefit (a "you have a pendência" dot tolerates latency
// fine). Paused while the tab is hidden so it doesn't burn invocations in background tabs.
const POLL_INTERVAL_MS = 28_000;

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

interface Props {
  name: string;
  role: "ADMIN" | "USER";
  isAdmin: boolean;
  canViewGraficos: boolean;
  /** Se este usuário tem algum campo de valor (Valor Unitário/Total) visível — só nesse caso faz sentido oferecer o toggle de ocultar. */
  canSeeValores: boolean;
}

const LINK_CLS = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
const ACTIVE_CLS = "bg-brand text-white";
const INACTIVE_CLS = "text-slate-600 hover:bg-slate-100";

export default function TopNav({ name, role, isAdmin, canViewGraficos, canSeeValores }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { hidden, toggle } = useValuesVisibility();
  const forumIndicator = useForumIndicator();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-2.5">
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
        </nav>
        <div className="flex items-center gap-3">
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
    </header>
  );
}
