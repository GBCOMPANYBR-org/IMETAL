import { getCurrentSauUser } from "@/lib/saude/permissions";
import FuncionariosManager from "@/components/saude/FuncionariosManager";

export default async function SaudeFuncionariosPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("employee.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver funcionários.</p>;
  }
  const canEdit = user.permissions.has("employee.edit");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Funcionários</h1>
      <p className="mt-1 text-sm text-slate-500">Cadastro — status documental e alocação chegam nas próximas etapas.</p>
      <div className="mt-6">
        <FuncionariosManager canEdit={canEdit} />
      </div>
    </div>
  );
}
