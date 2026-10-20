import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";

export default async function NotaFiscalPage() {
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  if(user.mustChangePassword) redirect("/trocar-senha");
  // Até a implementação das permissões fiscais, somente ADMIN acessa este esqueleto.
  if(!user.isAdmin) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-xl font-bold">Nota Fiscal</h1><p className="mt-4">Acesso não autorizado. Solicite permissão ao administrador.</p></main>;
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-800">IMETAL · Nota Fiscal</h1><Link href="/inicio" className="rounded-lg border bg-white px-4 py-2 text-sm">⇄ Trocar módulo</Link></div>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold text-blue-900">Módulo em preparação — Preview</h2><p className="mt-2 text-sm text-blue-800">A emissão será permitida somente para pedidos cadastrados, em qualquer status, com múltiplas NF-e por pedido. Nenhuma emissão real está habilitada nesta etapa.</p></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">{["Consultar pedidos","Notas vinculadas","Materiais de clientes"].map(title=><div key={title} className="rounded-xl border bg-white p-5"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-500">Em desenvolvimento. Sem acesso ao Omie nesta etapa.</p></div>)}</div>
  </div></main>;
}
