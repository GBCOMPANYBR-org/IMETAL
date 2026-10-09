import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  // Consultar pendências atuais sem marcar como visualizadas.
  const pedidos = await prisma.pedido.findMany({
    where: {
      status: { label: "Finalizado" },
      faturamento: { label: { not: "SIM", mode: "insensitive" } },
    },
    select: { id: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json({ ids: pedidos.map((p) => p.id) });
}
