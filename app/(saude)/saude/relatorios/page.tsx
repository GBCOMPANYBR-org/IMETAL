import { getCurrentSauUser } from "@/lib/saude/permissions";
import RelatoriosPage from "@/components/saude/RelatoriosPage";

export default async function SaudeRelatoriosPage() {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("report.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver relatórios.</p>;
  }

  return <RelatoriosPage />;
}
