import { notFound } from "next/navigation";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import PcmsoDetailClient from "@/components/saude/PcmsoDetailClient";

export default async function PcmsoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("pcmso.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver PCMSOs.</p>;
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  return <PcmsoDetailClient pcmsoId={id} canReview={user.permissions.has("pcmso.review")} canApprove={user.permissions.has("pcmso.approve")} />;
}
