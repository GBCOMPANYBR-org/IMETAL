import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

/**
 * Powers the "pedidos atrasados" alert card in TopNav (admin-only, a pedido do Felipe). Um
 * pedido conta como atrasado quando a Previsão de entrega já passou e o status ainda não é um
 * dos dois terminais ("Finalizado"/"Cancelado") — mesma regra usada pelo link de "Ver atrasados"
 * em PedidosClient.tsx (`/?atrasados=1`), pra o card e a lista sempre baterem o mesmo número.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const hoje = new Date(new Date().toDateString());

  const count = await prisma.pedido.count({
    where: {
      previsao: { lt: hoje },
      status: { label: { notIn: ["Finalizado", "Cancelado"] } },
    },
  });

  return NextResponse.json({ count });
}
