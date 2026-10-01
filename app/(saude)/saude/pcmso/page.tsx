import { getCurrentSauUser } from "@/lib/saude/permissions";
import PcmsoManager from "@/components/saude/PcmsoManager";

export default async function SaudePcmsoPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("pcmso.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver PCMSOs.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">PCMSO</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload e matriz de exigências por unidade — leitura por IA chega na Etapa 07, por enquanto a conferência é manual.
      </p>
      <div className="mt-6">
        <PcmsoManager canUpload={user.permissions.has("pcmso.upload")} />
      </div>
    </div>
  );
}
