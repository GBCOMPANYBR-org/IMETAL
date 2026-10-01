import { getCurrentSauUser } from "@/lib/saude/permissions";
import ClientesManager from "@/components/saude/ClientesManager";

export default async function SaudeClientesPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("employee.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver clientes.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Clientes / Unidades</h1>
      <p className="mt-1 text-sm text-slate-500">Cada unidade poderá ter seu próprio PCMSO vigente.</p>
      <div className="mt-6">
        <ClientesManager canEdit={user.permissions.has("employee.edit")} />
      </div>
    </div>
  );
}
