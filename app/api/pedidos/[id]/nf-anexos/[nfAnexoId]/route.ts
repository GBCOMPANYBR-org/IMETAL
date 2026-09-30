import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAdmin, requireAuth } from "@/lib/permissions";
import { deleteAttachmentFile, readAttachmentFile } from "@/lib/storage";
import { parsePedidoId } from "@/lib/pedido-filters";
import { nfGroupKey } from "@/lib/attachment-group";

// Mirrors propostas/[propostaId]/route.ts, grouped by Cliente+NF instead of Cliente+Código (see
// nfGroupKey) — the file may have been uploaded through a different sibling Pedido billed under
// the same nota. DELETE was already admin-only for every attachment kind in this file; here POST
// (../route.ts) is ALSO admin-only, unlike anexo/proposta.
const SAFE_INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; nfAnexoId: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("nf")) {
    return NextResponse.json({ error: "Sem permissão para visualizar a NF." }, { status: 403 });
  }

  const { id, nfAnexoId } = await params;
  const pedidoId = parsePedidoId(id);
  const nfId = parsePedidoId(nfAnexoId);
  if (pedidoId === null || nfId === null) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, clienteId: true, nf: true },
  });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const nfAnexo = await prisma.attachment.findFirst({
    where: { id: nfId, codigo: nfGroupKey(pedido), kind: "nf" },
  });
  if (!nfAnexo) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const bytes = await readAttachmentFile(nfAnexo.storedPath).catch(() => null);
  if (!bytes) {
    return NextResponse.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 404 });
  }

  const isSafeInline = SAFE_INLINE_TYPES.has(nfAnexo.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": isSafeInline ? nfAnexo.mimeType : "application/octet-stream",
      "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${encodeURIComponent(nfAnexo.filename)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; nfAnexoId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, nfAnexoId } = await params;
  const pedidoId = parsePedidoId(id);
  const nfId = parsePedidoId(nfAnexoId);
  if (pedidoId === null || nfId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, clienteId: true, nf: true },
  });
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // Shared by Cliente+NF — deleting it removes it for every Pedido billed under the same nota.
  const nfAnexo = await prisma.attachment.findFirst({
    where: { id: nfId, codigo: nfGroupKey(pedido), kind: "nf" },
  });
  if (!nfAnexo) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  await prisma.attachment.delete({ where: { id: nfAnexo.id } });
  await deleteAttachmentFile(nfAnexo.storedPath);

  return NextResponse.json({ ok: true });
}
