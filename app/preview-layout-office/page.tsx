"use client";

import { useState } from "react";
import Link from "next/link";

const modules = [
  { name: "Início", icon: "⌂", href: "/dashboard", actions: ["Visão geral", "Indicadores", "Atualizar"] },
  { name: "Pedidos", icon: "▤", href: "/pedidos", actions: ["Novo pedido", "Consultar", "Filtrar", "Exportar"] },
  { name: "Produção", icon: "⚙", href: "/producao", actions: ["Acompanhar", "Prazos", "Atualizar status"] },
  { name: "Faturamento", icon: "▣", href: "/faturamento", actions: ["Consultar", "Filtrar", "Relatórios"] },
  { name: "Clientes", icon: "♙", href: "/clientes", actions: ["Consultar", "Cadastrar", "Pesquisar"] },
  { name: "Relatórios", icon: "▥", href: "/relatorios", actions: ["Indicadores", "Exportar", "Imprimir"] },
  { name: "Saúde Ocupacional", icon: "✚", href: "/saude-ocupacional", actions: ["Funcionários", "Exames", "Documentos"] },
];
export default function LayoutOfficePreview() {
  const [active, setActive] = useState("Pedidos");
  const [collapsed, setCollapsed] = useState(false);
  const [ribbon, setRibbon] = useState(true);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const selected = modules.find((item) => item.name === active) ?? modules[1];
  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-800">
      <header className="bg-[#173b69] text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-white/15 px-3 py-2 text-lg font-black tracking-wide">IMETAL</span><div><div className="text-sm font-semibold">Gestão Integrada</div><div className="text-xs text-blue-200">Prévia de navegação • Estilo híbrido Office</div></div></div>
          <div className="flex items-center gap-3 text-xs"><span className="rounded-full bg-amber-300 px-3 py-1 font-bold text-slate-900">SOMENTE PREVIEW</span><Link className="rounded-lg border border-white/40 px-3 py-2 hover:bg-white/10" href="/dashboard">Voltar ao sistema</Link></div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className={`shrink-0 border-r border-slate-200 bg-white shadow-sm transition-all ${collapsed ? "w-[72px]" : "w-[230px]"}`}>
          <div className="flex items-center justify-between border-b px-4 py-3"><span className={`text-xs font-bold uppercase tracking-wider text-slate-500 ${collapsed ? "hidden" : ""}`}>Módulos</span><button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded p-2 hover:bg-slate-100" title="Expandir ou recolher menu">☰</button></div>
          <nav aria-label="Módulos da IMETAL" className="space-y-1 p-2">{modules.map((item) => <button type="button" key={item.name} onClick={() => { setActive(item.name); setNotice(""); }} title={item.name} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${active === item.name ? "bg-blue-100 text-blue-900" : "text-slate-600 hover:bg-slate-100"}`}><span className="w-6 text-center text-xl" aria-hidden="true">{item.icon}</span>{!collapsed && <span>{item.name}</span>}</button>)}</nav>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-5 pt-3">
            <div className="flex items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-5"><span className="border-b-2 border-blue-700 pb-3 text-sm font-semibold text-blue-800">Início</span><span className="pb-3 text-sm text-slate-500">Exibir</span><span className="pb-3 text-sm text-slate-500">Ajuda</span></div><button type="button" onClick={() => setRibbon(!ribbon)} className="mb-2 rounded px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">{ribbon ? "Ocultar ferramentas ⌃" : "Mostrar ferramentas ⌄"}</button></div>
            {ribbon && <div className="flex flex-wrap gap-2 border-t border-slate-100 py-3">{selected.actions.map((action, index) => <button type="button" key={action} onClick={() => setNotice(`“${action}” é ilustrativo nesta prévia. As ações reais serão ligadas aos controles de permissão existentes.`)} className="flex min-w-[92px] flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-medium hover:border-blue-300 hover:bg-blue-50"><span className="text-2xl text-blue-800" aria-hidden="true">{["⊞","⌕","☷","⇩","▤"][index % 5]}</span>{action}</button>)}<div className="ml-auto flex items-center text-xs text-slate-400">Ferramentas de {active}</div></div>}
          </div>
          <section className="p-5 md:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">IMETAL / {active}</p><h1 className="mt-1 text-2xl font-bold">{active}</h1></div><Link href={selected.href} className="rounded-lg bg-[#173b69] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Abrir módulo atual ↗</Link></div>
            {notice && <div role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</div>}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Área de trabalho — {active}</h2><p className="mt-1 text-sm text-slate-500">Demonstração do novo menu. Os dados e telas originais permanecem intactos.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar ferramentas..." aria-label="Pesquisar ferramentas" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:w-64" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selected.actions.filter((action) => action.toLowerCase().includes(query.toLowerCase())).map((action) => <button type="button" key={action} onClick={() => setNotice(`Ação “${action}” demonstrativa. Nenhum registro foi alterado.`)} className="rounded-xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:bg-blue-50"><div className="mb-3 text-2xl text-blue-700">▦</div><div className="text-sm font-semibold">{action}</div><div className="mt-1 text-xs text-slate-500">Acesso rápido do módulo</div></button>)}</div></div>
            <p className="mt-4 text-xs text-slate-500">Protótipo isolado para avaliar menu lateral + Ribbon. Não substitui a navegação existente nem altera permissões, dados ou faturamento.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
