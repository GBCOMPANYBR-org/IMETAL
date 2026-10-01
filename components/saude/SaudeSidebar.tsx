"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SauRole } from "@/lib/saude/permissions";

const NAV_ITEMS: { href: string; label: string; enabled: boolean }[] = [
  { href: "/saude", label: "Dashboard", enabled: true },
  { href: "/saude/funcionarios", label: "Funcionários", enabled: true },
  { href: "/saude/clientes", label: "Clientes / Unidades", enabled: true },
  { href: "/saude/pcmso", label: "PCMSO", enabled: false },
  { href: "/saude/aso", label: "ASO & Exames", enabled: false },
  { href: "/saude/liberacao", label: "Liberação", enabled: false },
  { href: "/saude/alertas", label: "Alertas", enabled: false },
  { href: "/saude/relatorios", label: "Relatórios", enabled: false },
  { href: "/saude/configuracoes", label: "Configurações", enabled: true },
];

const ROLE_LABELS: Record<SauRole, string> = {
  ADMINISTRADOR: "Administrador",
  SST: "SST",
  RH: "RH",
  GESTOR: "Gestor",
  VISUALIZACAO: "Visualização",
};

interface Props {
  name: string;
  role: SauRole;
}

export default function SaudeSidebar({ name, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/saude" ? pathname === "/saude" : pathname.startsWith(href));

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-brand text-slate-200 print:hidden">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent text-sm font-bold text-brand">
          IM
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">IMETAL</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Saúde Ocupacional</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href) ? "bg-brand-accent text-brand" : "text-slate-300 hover:bg-brand-light hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <div key={item.href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-500">
              <span>{item.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-600">em breve</span>
            </div>
          )
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← Gestão de Pedidos
        </Link>
        <div className="mt-3 text-sm font-medium text-white">{name}</div>
        <div className="text-xs text-slate-400">{ROLE_LABELS[role]}</div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-brand-light"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
