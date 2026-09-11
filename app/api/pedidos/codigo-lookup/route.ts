import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";

/**
 * Used by the "Novo Pedido" form: as a convenience, typing a Código that already has a prior
 * Pedido for the same Cliente offers the last registered Descrição/Valor Unitário/NCM as a
 * starting point — never applied automatically to the payload, just pre-filled for the user to
 * keep or change. Scoped by Cliente (not Código alone) for the same reason attachment-sharing is: Código
 * is free text, not globally unique, so a cross-Cliente match could leak one company's pricing
 * into another's form.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.isAdmin && !user.canEdit) {
    return NextResponse.json({ error: "Seu usuário não tem permissão para cadastrar pedidos." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clienteId = Number(searchParams.get("clienteId"));
  const codigo = searchParams.get("codigo")?.trim();

  if (!Number.isInteger(clienteId) || !codigo) {
    return NextResponse.json({ match: null });
  }
  if (!canAccessCliente(user, clienteId)) {
    return NextResponse.json({ match: null });
  }

  const last = await prisma.pedido.findFirst({
    where: { clienteId, codigo: { equals: codigo, mode: "insensitive" } },
    orderBy: { id: "desc" },
    select: { descricao: true, valorUnitario: true, ncm: true },
  });

  if (!last) {
    return NextResponse.json({ match: null });
  }

  return NextResponse.json({
    match: {
      descricao: user.visibleFields.has("descricao") ? last.descricao : null,
      valorUnitario: user.visibleFields.has("valorUnitario") ? last.valorUnitario : null,
      ncm: user.visibleFields.has("ncm") ? last.ncm : null,
    },
  });
}
