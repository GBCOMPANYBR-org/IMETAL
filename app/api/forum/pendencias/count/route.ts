import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

function clienteScopeWhere(user: { allClientes: boolean; visibleClienteIds: Set<number> }): Prisma.ObservacaoMentionWhereInput {
  if (user.allClientes) return {};
  const ids = Array.from(user.visibleClienteIds);
  return { observacao: { pedido: { clienteId: { in: ids.length > 0 ? ids : [-1] } } } };
}

/**
 * Powers the Fórum nav indicator — polled client-side (no realtime infra in this project). Green
 * takes priority over yellow by construction: the client only needs to check newCount first.
 */
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const scope = clienteScopeWhere(user);

  const [newCount, openCount] = await Promise.all([
    prisma.observacaoMention.count({ where: { mentionedUserId: user.id, resolvedAt: null, viewedAt: null, ...scope } }),
    prisma.observacaoMention.count({ where: { mentionedUserId: user.id, resolvedAt: null, ...scope } }),
  ]);

  return NextResponse.json({ newCount, openCount });
}
