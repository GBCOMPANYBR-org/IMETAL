import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth, type AuthedUser } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";
import { parseMentionIds } from "@/lib/mentions";
import { filterEligibleMentionIds } from "@/lib/forum-access-db";

const MAX_LENGTH = 2000;

const OBSERVACAO_INCLUDE = {
  author: { select: { id: true, name: true, username: true } },
  mentions: {
    include: { mentionedUser: { select: { id: true, name: true, username: true } } },
  },
} as const;

/**
 * Loads the Pedido and checks the one access rule shared by every route in this file: the user
 * must be able to see the observação column at all, and must have access to this Pedido's
 * Cliente. Returns 404 (never 403) on failure — same "don't confirm the id exists" pattern used
 * throughout the Pedido routes — so a request from someone without access can't even probe which
 * Pedido ids are valid.
 */
async function loadAuthorizedPedido(pedidoId: number, user: AuthedUser) {
  if (!user.visibleFields.has("observacao")) return null;
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { status: true } });
  if (!pedido) return null;
  if (!canAccessCliente(user, pedido.clienteId)) return null;
  return pedido;
}

/** Full chronological history of a linha's observações — Fórum thread and the Pedido modal both read this. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await loadAuthorizedPedido(pedidoId, user);
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const observacoes = await prisma.observacao.findMany({
    where: { pedidoId },
    include: OBSERVACAO_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    observacoes.map((o) => ({
      id: o.id,
      text: o.text,
      createdAt: o.createdAt,
      migratedFromLegacy: o.migratedFromLegacy,
      author: o.author ? { id: o.author.id, name: o.author.name, username: o.author.username } : null,
      mentions: o.mentions.map((m) => ({
        id: m.id,
        mentionedUser: { id: m.mentionedUser.id, name: m.mentionedUser.name, username: m.mentionedUser.username },
        viewedAt: m.viewedAt,
        resolvedAt: m.resolvedAt,
        resolutionType: m.resolutionType,
      })),
    }))
  );
}

/**
 * Creates a new Observação — optionally @-mentioning one or more users via inline
 * "@[Nome](id)" tokens in the text (see lib/mentions.ts). Any user who can see the observação
 * column may post (even read-only users, same permission pattern as Anexos/Fotos uploads).
 *
 * Mentioned ids are always re-derived from the submitted text server-side and re-validated
 * against the Cliente of this Pedido — never trusted from any separate client-supplied list —
 * so a manipulated request can't attach a pendência to someone without access. If any mentioned
 * id fails that check, the whole request is rejected (no partial success).
 *
 * Also mirrors the text into the legacy `Pedido.observacao` column (append-only, same shape as
 * before this feature existed) purely so the existing table preview/search/filter by Observações
 * keep working — that column is never written anywhere else now (see lib/pedido-payload.ts).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await loadAuthorizedPedido(pedidoId, user);
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (!user.isAdmin && !pedido.status.editable) {
    return NextResponse.json({ error: "Este pedido está com um status que não permite edição." }, { status: 423 });
  }

  const raw = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Digite um texto para a observação." }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json({ error: `A observação não pode ter mais de ${MAX_LENGTH} caracteres.` }, { status: 400 });
  }

  const mentionedIds = parseMentionIds(text);
  if (mentionedIds.length > 0) {
    const eligibleIds = await filterEligibleMentionIds(mentionedIds, pedido.clienteId);
    if (eligibleIds.length !== mentionedIds.length) {
      return NextResponse.json(
        { error: "Uma ou mais pessoas marcadas não têm acesso a esta empresa e não podem ser marcadas aqui." },
        { status: 400 }
      );
    }
  }

  const observacao = await prisma.$transaction(async (tx) => {
    const created = await tx.observacao.create({
      data: {
        pedidoId,
        authorId: user.id,
        text,
        mentions: {
          createMany: {
            data: mentionedIds.map((mentionedUserId) => ({ mentionedUserId })),
            skipDuplicates: true,
          },
        },
      },
      include: OBSERVACAO_INCLUDE,
    });

    // Legacy mirror — single remaining writer of this column, append-only, unchanged shape.
    await tx.$queryRaw`
      UPDATE "Pedido"
      SET "observacao" = CASE
            WHEN "observacao" IS NULL OR "observacao" = '' THEN ${text}
            ELSE "observacao" || E'\n' || ${text}
          END,
          "updatedById" = ${user.id},
          "updatedAt" = now()
      WHERE id = ${pedidoId}
    `;

    return created;
  });

  return NextResponse.json({
    id: observacao.id,
    text: observacao.text,
    createdAt: observacao.createdAt,
    migratedFromLegacy: observacao.migratedFromLegacy,
    author: observacao.author ? { id: observacao.author.id, name: observacao.author.name, username: observacao.author.username } : null,
    mentions: observacao.mentions.map((m) => ({
      id: m.id,
      mentionedUser: { id: m.mentionedUser.id, name: m.mentionedUser.name, username: m.mentionedUser.username },
      viewedAt: m.viewedAt,
      resolvedAt: m.resolvedAt,
      resolutionType: m.resolutionType,
    })),
  });
}
