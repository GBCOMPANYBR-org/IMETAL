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
  // Only shown when the account was explicitly granted SauUserAccess — see
  // lib/saude/permissions.ts. Absent for everyone else, including every client login.
  const canAccessSaude = (await getCurrentSauUser()) !== null;

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
