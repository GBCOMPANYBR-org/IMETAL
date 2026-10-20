"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function OfficeShell({children,isAdmin,canViewGraficos}:{children:React.ReactNode;isAdmin:boolean;canViewGraficos:boolean}) {
  const [collapsed,setCollapsed]=useState(false);
  const [ribbon,setRibbon]=useState(true);
  const path=usePathname();
  const sections=[
    {label:"Pedidos",href:"/",icon:"▤"},
    ...(canViewGraficos?[{label:"Gráficos",href:"/graficos",icon:"▥"}]:[]),
    {label:"Fórum",href:"/forum",icon:"☏"},
    ...(isAdmin?[{label:"Clientes",href:"/admin/clientes",icon:"♧"},{label:"Usuários",href:"/admin/usuarios",icon:"♙"},{label:"Nota Fiscal",href:"/nota-fiscal",icon:"▣"}]:[]),
    {label:"Trocar módulo",href:"/inicio",icon:"⇄"}
  ];
  const current=sections.find(x=>x.href!=="/"&&path.startsWith(x.href))?.label??"Pedidos";
  return <div className="flex min-h-[calc(100vh-64px)] bg-[#f3f6fb] print:block">
    <aside className={`shrink-0 border-r border-slate-200 bg-white print:hidden ${collapsed?"w-14":"w-52"}`}>
      <button type="button" onClick={()=>setCollapsed(!collapsed)} aria-label="Recolher menu" className="w-full border-b px-3 py-3 text-left text-sm text-slate-600">☰ {!collapsed&&"Módulos"}</button>
      <nav aria-label="Navegação Office" className="space-y-1 p-2">{sections.map(s=><Link key={s.href} href={s.href} title={s.label} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${(s.href==="/" ? path==="/" : path.startsWith(s.href))?"bg-blue-100 font-semibold text-blue-900":"text-slate-600 hover:bg-slate-100"}`}><span className="w-6 text-center text-lg">{s.icon}</span>{!collapsed&&s.label}</Link>)}</nav>
    </aside>
    <div className="min-w-0 flex-1">
      <div className="border-b bg-white px-4 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"><span className="border-b-2 border-blue-700 pb-1 font-semibold text-blue-800">Início · {current}</span><button type="button" onClick={()=>setRibbon(!ribbon)} className="text-xs text-slate-500">{ribbon?"Ocultar ferramentas ⌃":"Mostrar ferramentas ⌄"}</button></div>
        {ribbon&&<div className="flex flex-wrap gap-2 py-2">
          <Link href="/" className="rounded-lg border px-4 py-2 text-xs hover:bg-blue-50">▤ Pedidos</Link>
          <Link href="/forum" className="rounded-lg border px-4 py-2 text-xs hover:bg-blue-50">☏ Fórum</Link>
          {canViewGraficos&&<Link href="/graficos" className="rounded-lg border px-4 py-2 text-xs hover:bg-blue-50">▥ Gráficos</Link>}
          {isAdmin&&<Link href="/admin/usuarios" className="rounded-lg border px-4 py-2 text-xs hover:bg-blue-50">♙ Usuários</Link>}
          <Link href="/inicio" className="rounded-lg border px-4 py-2 text-xs hover:bg-blue-50">⇄ Trocar módulo</Link>
        </div>}
      </div>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  </div>;
}
