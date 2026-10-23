import { NextResponse } from "next/server";
import { head, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (!user.visibleFields.has("fotos")) {
    return NextResponse.json(
      { error: "Sem permissão para visualizar fotos." },
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
    select: { clienteId: true },
  });

  if (!owner || !canAccessCliente(user, owner.clienteId)) {
    return NextResponse.json([]);
  }

  // Diferente dos anexos, as fotos pertencem somente a este Pedido.
  const fotos = await prisma.foto.findMany({
    where: { pedidoId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      uploadedAt: true,
      uploadedBy: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json(fotos);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (!user.visibleFields.has("fotos")) {
    return NextResponse.json(
      { error: "Sem permissão para gerenciar fotos." },
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
    // Confirma diretamente no Vercel Blob que o arquivo existe.
    const blob = await head(blobUrl);

    // Confirma que o arquivo foi enviado para a pasta deste pedido.
    if (!blob.pathname.startsWith(`pedidos/${pedidoId}/`)) {
      return NextResponse.json(
        { error: "Arquivo não pertence a este pedido." },
        { status: 400 }
      );
    }

    // Segurança adicional no servidor.
    if (blob.size > MAX_FILE_SIZE) {
      await del(blobUrl).catch(() => undefined);

      return NextResponse.json(
        { error: "Arquivo maior que 20MB." },
        { status: 413 }
      );
    }

    // Fotos devem ser imagens.
    const contentType =
      blob.contentType ||
      mimeType ||
      "application/octet-stream";

    if (!contentType.startsWith("image/")) {
      await del(blobUrl).catch(() => undefined);

      return NextResponse.json(
        { error: "Somente arquivos de imagem são permitidos em Fotos." },
        { status: 415 }
      );
    }

    // Apenas as fotos recebem nome padrão; anexos e propostas não mudam.
    // Preserva extensão para downloads e compartilhamento.
    const extensionByMime: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "image/gif": "gif", "image/heic": "heic", "image/heif": "heif",
      "image/avif": "avif", "image/bmp": "bmp", "image/tiff": "tif",
    };
    const originalExtension = filename.match(/\\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
    const safeExtension = originalExtension && /^(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|jfif)$/.test(originalExtension) ? originalExtension : "jpg";
    const extension = extensionByMime[contentType.toLowerCase()] ?? safeExtension;
    const prefix = `IMG-ID${pedidoId}-`;

    // Lock transacional por pedido evita números repetidos em uploads simultâneos.
    const foto = await prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock retorna tipo PostgreSQL void; Prisma não consegue
      // desserializar void em $queryRaw. Projeta apenas um inteiro, mantendo o lock.
      await tx.$queryRaw`SELECT 1::integer AS locked FROM (SELECT pg_advisory_xact_lock(73105, ${pedidoId})) AS acquired`;
      const previous = await tx.foto.findMany({
        where: { pedidoId, filename: { startsWith: prefix } },
        select: { filename: true },
      });
      const pattern = new RegExp(`^IMG-ID${pedidoId}-(\\d+)(?:\\.[a-z0-9]+)?$`, "i");
      const maxNumber = previous.reduce((max, item) => {
        const match = item.filename.match(pattern);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      return tx.foto.create({
        data: {
          pedidoId,
          filename: `${prefix}${maxNumber + 1}.${extension}`,
          storedPath: blob.url,
          mimeType: contentType,
          size: blob.size,
          uploadedById: user.id,
        },
        select: {
          id: true, filename: true, mimeType: true, size: true, uploadedAt: true,
        },
      });
    });

    return NextResponse.json(foto, {
      status: 201,
    });
  } catch (error) {
    console.error("Erro ao registrar foto:", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível validar ou registrar a foto.",
      },
      { status: 400 }
    );
  }
}
