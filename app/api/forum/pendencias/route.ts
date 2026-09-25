import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { stripMentionSyntax } from "@/lib/mentions";

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

  const params = new URL(req.url).searchParams;
  const status = params.get("status") === "resolved" ? "resolved" : "open";
  // "received" (padrão) = pendências marcadas pra mim; "sent" = pendências que eu criei marcando
  // outra pessoa, pra eu acompanhar se já resolveram.
  const direction = params.get("direction") === "sent" ? "sent" : "received";

  // Combinado via AND (em vez de espalhar os objetos) porque tanto o filtro de "sent" quanto o
  // clienteScopeWhere tocam a chave `observacao` — um spread faria o segundo sobrescrever o
  // primeiro em vez de combinar os dois filtros.
  const directionWhere: Prisma.ObservacaoMentionWhereInput =
    direction === "received" ? { mentionedUserId: user.id } : { observacao: { authorId: user.id } };

  const mentions = await prisma.observacaoMention.findMany({
    where: {
      AND: [directionWhere, { resolvedAt: status === "resolved" ? { not: null } : null }, clienteScopeWhere(user)],
    },
    include: {
      mentionedUser: { select: { id: true, name: true, username: true } },
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
      mentionedUser: m.mentionedUser,
      preview: stripMentionSyntax(m.observacao.text).slice(0, PREVIEW_LENGTH),
      observacaoId: m.observacao.id,
    }))
  );
}
