import { getCurrentSauUser } from "@/lib/saude/permissions";
import AlertasManager from "@/components/saude/AlertasManager";

export default async function SaudeAlertasPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("release.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver alertas.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Alertas</h1>
      <p className="mt-1 text-sm text-slate-500">Exames e PCMSOs vencendo/vencidos, funcionários com pendência.</p>
      <div className="mt-6">
        <AlertasManager canManage={user.permissions.has("release.manage")} />
      </div>
    </div>
  );
}
