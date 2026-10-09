import { NextResponse } from "next/server";
import { head, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { deleteAttachmentFile, readAttachmentFile } from "@/lib/storage";
import { parsePedidoId } from "@/lib/pedido-filters";

// One cover photo per Pedido (1:1 — FotoCapa.pedidoId is unique). Same "any user with access can
// upload" permission model as anexos/fotos — see prisma/schema.prisma for why this doesn't need
// its own admin-only rule the way nf-anexos does.
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SAFE_INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("fotoCapa")) {
    return NextResponse.json({ error: "Sem permissão para visualizar a foto de capa." }, { status: 403 });
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { clienteId: true } });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const fotoCapa = await prisma.fotoCapa.findUnique({ where: { pedidoId } });
  if (!fotoCapa) {
    return NextResponse.json({ error: "Este pedido não tem foto de capa." }, { status: 404 });
  }

  const bytes = await readAttachmentFile(fotoCapa.storedPath).catch(() => null);
  if (!bytes) {
    return NextResponse.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 404 });
  }

  const isSafeInline = SAFE_INLINE_TYPES.has(fotoCapa.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": isSafeInline ? fotoCapa.mimeType : "application/octet-stream",
      "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${encodeURIComponent(fotoCapa.filename)}"`,
      "X-Content-Type-Options": "nosniff",
      // A thumbnail shown on every hover over Descrição in the lista — worth letting the
      // browser cache it for a bit instead of refetching on every single hover.
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("fotoCapa") && !user.canChangeFotoCapa) {
    return NextResponse.json({ error: "Sem permissão para definir a foto de capa." }, { status: 403 });
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

  if (pedido.status.label.trim().toLowerCase() === "finalizado") {
    return NextResponse.json({ error: "Não é possível alterar a capa de um pedido Finalizado." }, { status: 423 });
  }
  if (!user.isAdmin && !pedido.status.editable && !user.canChangeFotoCapa) {
    return NextResponse.json({ error: "Este pedido está com um status que não permite edição." }, { status: 423 });
  }

  let body: { blobUrl?: string; filename?: string; mimeType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }

  const { blobUrl, filename, mimeType } = body;
  if (!blobUrl || !filename) {
    return NextResponse.json({ error: "Dados do arquivo incompletos." }, { status: 400 });
  }

  try {
    const blob = await head(blobUrl);

    if (!blob.pathname.startsWith(`pedidos/${pedidoId}/`)) {
      return NextResponse.json({ error: "Arquivo não pertence a este pedido." }, { status: 400 });
    }

    if (blob.size > MAX_FILE_SIZE) {
      await del(blobUrl).catch(() => undefined);
      return NextResponse.json({ error: "Arquivo maior que 20MB." }, { status: 413 });
    }

    const contentType = blob.contentType || mimeType || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      await del(blobUrl).catch(() => undefined);
      return NextResponse.json({ error: "A foto de capa precisa ser uma imagem." }, { status: 415 });
    }

    // Só uma foto de capa por pedido — substitui a anterior (apaga o arquivo antigo do Blob).
    const previous = await prisma.fotoCapa.findUnique({ where: { pedidoId } });

    const fotoCapa = await prisma.fotoCapa.upsert({
      where: { pedidoId },
      create: {
        pedidoId,
        filename,
        storedPath: blob.url,
        mimeType: contentType,
        size: blob.size,
        uploadedById: user.id,
      },
      update: {
        filename,
        storedPath: blob.url,
        mimeType: contentType,
        size: blob.size,
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
      select: { id: true, filename: true, mimeType: true },
    });

    if (previous && previous.storedPath !== blob.url) {
      await deleteAttachmentFile(previous.storedPath);
    }

    return NextResponse.json(fotoCapa, { status: 201 });
  } catch (error) {
    console.error("Erro ao registrar foto de capa:", error);
    return NextResponse.json({ error: "Não foi possível validar ou registrar o arquivo." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.visibleFields.has("fotoCapa")) {
    return NextResponse.json({ error: "Sem permissão para remover a foto de capa." }, { status: 403 });
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
    return NextResponse.json(
      { error: "Este pedido está com um status que não permite edição." },
      { status: 423 }
    );
  }

  const fotoCapa = await prisma.fotoCapa.findUnique({ where: { pedidoId } });
  if (!fotoCapa) {
    return NextResponse.json({ ok: true });
  }

  await prisma.fotoCapa.delete({ where: { pedidoId } });
  await deleteAttachmentFile(fotoCapa.storedPath);

  return NextResponse.json({ ok: true });
}
