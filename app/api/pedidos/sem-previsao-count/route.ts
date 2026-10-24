import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// Somente administradores podem consultar pedidos Em andamento sem previsão.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const count = await prisma.pedido.count({
    where: { status: { label: { equals: "Em andamento", mode: "insensitive" } }, previsao: null },
  });
  return NextResponse.json({ count });
}
