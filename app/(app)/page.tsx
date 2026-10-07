import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PedidosClient from "@/components/pedidos/PedidosClient";

export default async function PedidosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Pedidos</h1>
      <PedidosClient visibleFields={Array.from(user.visibleFields)} isAdmin={user.isAdmin} canEdit={user.canEdit} canChangePedidoStatus={user.canChangePedidoStatus} />
    </div>
  );
}
