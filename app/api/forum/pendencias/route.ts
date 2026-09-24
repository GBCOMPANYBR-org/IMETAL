import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

/**
 * Every route under app/api/forum re-checks Cliente access at read time (not just at the moment
 * the mention was created) — if an admin later revokes a user's access to a Cliente, that
 * user's pendências for it silently stop appearing here and in /count. This is a deliberate
 * consequence of "clientes não conseguem consultar conversas de outras empresas", not a bug: the
 * pendência stays in the database (audit trail intact) but is simply unreachable until access is
 * restored.
 */
function clienteScopeWhere(user: { allClientes: boolean; visibleClienteIds: Set<number> }): Prisma.ObservacaoMentionWhereInput {
  if (user.allClientes) return {};
  const ids = Array.from(user.visibleClienteIds);
  return { observacao: { pedido: { clienteId: { in: ids.length > 0 ? ids : [-1] } } } };
}

const PREVIEW_LENGTH = 160;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const statusParam = new URL(req.url).searchParams.get("status");
  const status = statusParam === "resolved" ? "resolved" : "open";

  const mentions = await prisma.observacaoMention.findMany({
    where: {
      mentionedUserId: user.id,
      resolvedAt: status === "resolved" ? { not: null } : null,
      ...clienteScopeWhere(user),
    },
    include: {
      observacao: {
        include: {
          author: { select: { id: true, name: true, username: true } },
          pedido: { select: { id: true, codigo: true, descricao: true, cliente: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    mentions.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      viewedAt: m.viewedAt,
      resolvedAt: m.resolvedAt,
      resolutionType: m.resolutionType,
      pedido: {
        id: m.observacao.pedido.id,
        codigo: m.observacao.pedido.codigo,
        descricao: m.observacao.pedido.descricao,
        cliente: m.observacao.pedido.cliente,
      },
      author: m.observacao.author,
      preview: m.observacao.text.slice(0, PREVIEW_LENGTH),
      observacaoId: m.observacao.id,
    }))
  );
}
