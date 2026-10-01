import { getCurrentSauUser } from "@/lib/saude/permissions";
import LiberacaoPage from "@/components/saude/LiberacaoPage";

export default async function SaudeLiberacaoPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("release.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver liberação.</p>;
  }

  return <LiberacaoPage />;
}
