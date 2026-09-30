import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAdmin, requireAuth } from "@/lib/permissions";
import { deleteAttachmentFile, readAttachmentFile } from "@/lib/storage";
import { parsePedidoId } from "@/lib/pedido-filters";
import { attachmentGroupKey } from "@/lib/attachment-group";

// Mirrors attachments/[attachmentId]/route.ts — no PATCH here since propostas have no QR-code
// toggle (that's anexo-only).
const SAFE_INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; propostaId: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("proposta")) {
    return NextResponse.json({ error: "Sem permissão para visualizar propostas." }, { status: 403 });
  }

  const { id, propostaId } = await params;
  const pedidoId = parsePedidoId(id);
  const propId = parsePedidoId(propostaId);
  if (pedidoId === null || propId === null) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, clienteId: true, codigo: true },
  });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  // Shared by Código — the file may have been uploaded through a different sibling Pedido.
  const proposta = await prisma.attachment.findFirst({
    where: { id: propId, codigo: attachmentGroupKey(pedido), kind: "proposta" },
  });
  if (!proposta) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  const bytes = await readAttachmentFile(proposta.storedPath).catch(() => null);
  if (!bytes) {
    return NextResponse.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 404 });
  }

  const isSafeInline = SAFE_INLINE_TYPES.has(proposta.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": isSafeInline ? proposta.mimeType : "application/octet-stream",
      "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${encodeURIComponent(proposta.filename)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; propostaId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, propostaId } = await params;
  const pedidoId = parsePedidoId(id);
  const propId = parsePedidoId(propostaId);
  if (pedidoId === null || propId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Shared by Código — deleting it removes it for every Pedido that shares this group.
  const proposta = await prisma.attachment.findFirst({ where: { id: propId, codigo: attachmentGroupKey(pedido), kind: "proposta" } });
  if (!proposta) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  await prisma.attachment.delete({ where: { id: proposta.id } });
  await deleteAttachmentFile(proposta.storedPath);

  return NextResponse.json({ ok: true });
}
