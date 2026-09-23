import { NextResponse } from "next/server";
import { head, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";
import { attachmentGroupKey } from "@/lib/attachment-group";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (!user.visibleFields.has("anexos")) {
    return NextResponse.json(
      { error: "Sem permissão para visualizar anexos." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);

  if (pedidoId === null) {
    return NextResponse.json([]);
  }

  const owner = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      clienteId: true,
      codigo: true,
    },
  });

  if (!owner || !canAccessCliente(user, owner.clienteId)) {
    return NextResponse.json([]);
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      codigo: attachmentGroupKey(owner),
    },
    orderBy: {
      uploadedAt: "desc",
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      uploadedAt: true,
      enabledForQr: true,
      uploadedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json(attachments);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (!user.visibleFields.has("anexos")) {
    return NextResponse.json(
      { error: "Sem permissão para gerenciar anexos." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const pedidoId = parsePedidoId(id);

  if (pedidoId === null) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 }
    );
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { status: true },
  });

  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 }
    );
  }

  if (!user.isAdmin && !pedido.status.editable) {
    return NextResponse.json(
      {
        error:
          "Este pedido está com um status que não permite edição.",
      },
      { status: 423 }
    );
  }

  let body: {
    blobUrl?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Dados do arquivo inválidos." },
      { status: 400 }
    );
  }

  const { blobUrl, filename, mimeType } = body;

  if (!blobUrl || !filename) {
    return NextResponse.json(
      { error: "Dados do arquivo incompletos." },
      { status: 400 }
    );
  }

  try {
    const blob = await head(blobUrl);

    if (!blob.pathname.startsWith(`pedidos/${pedidoId}/`)) {
      return NextResponse.json(
        { error: "Arquivo não pertence a este pedido." },
        { status: 400 }
      );
    }

    if (blob.size > MAX_FILE_SIZE) {
      await del(blobUrl).catch(() => undefined);

      return NextResponse.json(
        { error: "Arquivo maior que 20MB." },
        { status: 413 }
      );
    }

    const attachment = await prisma.attachment.create({
      data: {
        codigo: attachmentGroupKey(pedido),
        pedidoId,
        filename,
        storedPath: blob.url,
        mimeType:
          blob.contentType ||
          mimeType ||
          "application/octet-stream",
        size: blob.size,
        uploadedById: user.id,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json(attachment, {
      status: 201,
    });
  } catch (error) {
    console.error("Erro ao registrar anexo:", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível validar ou registrar o arquivo.",
      },
      { status: 400 }
    );
  }
}
