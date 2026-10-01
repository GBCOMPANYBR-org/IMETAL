import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import SaudeSidebar from "@/components/saude/SaudeSidebar";

// Deliberately does NOT render <TopNav> or inherit app/(app)/layout.tsx — the spec calls for a
// visually distinct shell (dark sidebar, light content) so the module reads as its own thing,
// and so nobody stumbles into it from the Pedidos chrome.
export default async function SaudeLayout({ children }: { children: React.ReactNode }) {
  const pedidosUser = await getCurrentUser();
  if (!pedidosUser) {
    redirect("/login");
  }
  if (pedidosUser.mustChangePassword) {
    redirect("/trocar-senha");
  }

  const sauUser = await getCurrentSauUser();
  if (!sauUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
            🩺
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-500">
            Você não tem acesso ao módulo de Saúde Ocupacional. Se você acredita que deveria ter,
            fale com um administrador.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SaudeSidebar name={sauUser.name} role={sauUser.role} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6 sm:px-10 sm:py-8">{children}</main>
    </div>
  );
}
