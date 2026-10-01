import { getCurrentUser } from "@/lib/permissions";
import AcessoManager from "@/components/saude/AcessoManager";

export default async function SaudeConfiguracoesPage() {
  // Grant authority is intentionally the site-wide Pedidos ADMIN, not a Saúde permission key —
  // see requireSaudeGrantAuthority in lib/saude/permissions.ts for why.
  const pedidosUser = await getCurrentUser();
  const isSiteAdmin = pedidosUser?.isAdmin ?? false;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-800">Configurações</h1>
      <p className="mt-1 text-sm text-slate-500">Acesso ao módulo e perfis de permissão.</p>

      <div className="mt-6">
        {isSiteAdmin ? (
          <AcessoManager />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Somente administradores do sistema podem gerenciar o acesso ao módulo de Saúde Ocupacional.
          </p>
        )}
      </div>
    </div>
  );
}
