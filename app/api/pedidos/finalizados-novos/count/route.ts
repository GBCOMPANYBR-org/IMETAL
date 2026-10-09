import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const count = await prisma.pedido.count({
    where: {
      status: { label: "Finalizado" },
      faturado: { label: { not: "SIM", mode: "insensitive" } },
    },
  });

  return NextResponse.json({ count });
}
