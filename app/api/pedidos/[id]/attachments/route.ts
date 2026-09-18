import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { saveAttachmentFile } from "@/lib/storage";
import { parsePedidoId } from "@/lib/pedido-filters";
import { attachmentGroupKey } from "@/lib/attachment-group";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("anexos")) {
    return NextResponse.json({ error: "Sem permissão para visualizar anexos." }, { status: 403 });
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json([]);
  }
  const owner = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { id: true, clienteId: true, codigo: true } });
  if (!owner || !canAccessCliente(user, owner.clienteId)) {
    return NextResponse.json([]);
  }
  // Shared by Código — every Pedido with the same Código sees the same pool of attachments.
  const attachments = await prisma.attachment.findMany({
    where: { codigo: attachmentGroupKey(owner) },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true, enabledForQr: true, uploadedBy: { select: { name: true } } },
  });
  return NextResponse.json(attachments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("anexos")) {
    return NextResponse.json({ error: "Sem permissão para gerenciar anexos." }, { status: 403 });
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
  // Uploading is allowed for anyone who can see the anexos column — even a read-only user —
  // as long as the record itself isn't locked. Deleting an attachment stays ADMIN-only.
  if (!user.isAdmin && !pedido.status.editable) {
    return NextResponse.json({ error: "Este pedido está com um status que não permite edição." }, { status: 423 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que 20MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storedPath = await saveAttachmentFile(pedidoId, file.name, bytes);

  // codigo is the shared key — this file becomes visible on every Pedido with the same Código,
  // not just this one. pedidoId is kept only as a "uploaded via" reference.
  const attachment = await prisma.attachment.create({
    data: {
      codigo: attachmentGroupKey(pedido),
      pedidoId,
      filename: file.name,
      storedPath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedById: user.id,
    },
    select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true },
  });

  return NextResponse.json(attachment, { status: 201 });
}
