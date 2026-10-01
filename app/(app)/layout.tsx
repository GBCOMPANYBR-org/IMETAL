import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import TopNav from "@/components/TopNav";
import { ValuesVisibilityProvider } from "@/components/ValuesVisibilityProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/trocar-senha");
  }

  const canSeeValores = user.visibleFields.has("valorTotal") || user.visibleFields.has("valorUnitario");
  // Shown when the account was explicitly granted SauUserAccess (lib/saude/permissions.ts), or
  // when the account is a site-wide ADMIN — admins can always reach /saude/configuracoes to
  // grant themselves (or anyone else) access even before any SauUserAccess row exists for them;
  // see the same bootstrap exception in app/(saude)/saude/layout.tsx. Absent for everyone else,
  // including every client login.
  const canAccessSaude = user.isAdmin || (await getCurrentSauUser()) !== null;

  return (
    <ValuesVisibilityProvider>
      <div className="min-h-screen">
        <TopNav
          name={user.name}
          role={user.role}
          isAdmin={user.isAdmin}
          canViewGraficos={user.canViewGraficos}
          canSeeValores={canSeeValores}
          canAccessSaude={canAccessSaude}
        />
        <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      </div>
    </ValuesVisibilityProvider>
  );
}
