import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lastFinalizadosViewedAt: true },
  });
  if (!record) return NextResponse.json({ ids: [] });

  // Captura primeiro os IDs e só depois avança o cursor individual do administrador.
  // Assim a tela consegue filtrar exatamente o lote que fez o alerta aparecer.
  const now = new Date();
  const pedidos = await prisma.pedido.findMany({
    where: {
      finalizadoAt: record.lastFinalizadosViewedAt
        ? { gt: record.lastFinalizadosViewedAt, lte: now }
        : { not: null, lte: now },
      status: { label: "Finalizado" },
    },
    select: { id: true },
    orderBy: { finalizadoAt: "desc" },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastFinalizadosViewedAt: now },
  });

  return NextResponse.json({ ids: pedidos.map((p) => p.id) });
}
