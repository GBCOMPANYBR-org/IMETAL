import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachmentGroupKey } from "@/lib/attachment-group";

/**
 * Public, unauthenticated — this is what the QR code printed/shown in the Anexos popup points
 * to. Only ever returns files an actual user explicitly marked `enabledForQr` on this Pedido's
 * shared group (see lib/attachment-group.ts); everything else about the Pedido stays private.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { publicToken: token },
    select: { id: true, clienteId: true, codigo: true, descricao: true },
  });
  if (!pedido) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const items = await prisma.attachment.findMany({
    where: { codigo: attachmentGroupKey(pedido), enabledForQr: true },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, mimeType: true, size: true },
  });

  return NextResponse.json({ codigo: pedido.codigo, descricao: pedido.descricao, items });
}
