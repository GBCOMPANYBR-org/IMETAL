import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";

const MAX_LENGTH = 2000;

/**
 * Appends a note to Observações — never replaces it. Any user who can see the observacao
 * column may add one (even read-only users, same permission pattern as Anexos/Fotos uploads);
 * only ADMIN can edit or delete existing text, through the regular Pedido edit form.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("observacao")) {
    return NextResponse.json({ error: "Sem permissão para adicionar observações." }, { status: 403 });
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { status: true } });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
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

  // Single atomic UPDATE — appends server-side so two people adding a note at the same moment
  // can never overwrite one another the way a read-then-write from the client could.
  const [updated] = await prisma.$queryRaw<{ observacao: string }[]>`
    UPDATE "Pedido"
    SET "observacao" = CASE
          WHEN "observacao" IS NULL OR "observacao" = '' THEN ${text}
          ELSE "observacao" || E'\n' || ${text}
        END,
        "updatedById" = ${user.id},
        "updatedAt" = now()
    WHERE id = ${pedidoId}
    RETURNING "observacao"
  `;

  return NextResponse.json({ observacao: updated.observacao });
}
