import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
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

  return (
    <ValuesVisibilityProvider>
      <div className="min-h-screen">
        <TopNav
          name={user.name}
          role={user.role}
          isAdmin={user.isAdmin}
          canViewGraficos={user.canViewGraficos}
          canSeeValores={canSeeValores}
        />
        <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      </div>
    </ValuesVisibilityProvider>
  );
}
