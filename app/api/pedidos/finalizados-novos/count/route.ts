import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lastFinalizadosViewedAt: true },
  });
  if (!record) return NextResponse.json({ count: 0 });

  const count = await prisma.pedido.count({
    where: {
      finalizadoAt: record.lastFinalizadosViewedAt
        ? { gt: record.lastFinalizadosViewedAt }
        : { not: null },
      status: { label: "Finalizado" },
    },
  });

  return NextResponse.json({ count });
}
