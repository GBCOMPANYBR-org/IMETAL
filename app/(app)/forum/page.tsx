import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import ForumClient from "@/components/forum/ForumClient";

export default async function ForumPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Fórum</h1>
      <ForumClient isAdmin={user.isAdmin} />
    </div>
  );
}
