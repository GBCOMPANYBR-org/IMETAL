import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readAttachmentFile } from "@/lib/storage";
import { attachmentGroupKey } from "@/lib/attachment-group";
import { parsePedidoId } from "@/lib/pedido-filters";

// Same allowlist as the authenticated download route — see there for why.
const SAFE_INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; attachmentId: string }> }) {
  const { token, attachmentId } = await params;
  const attId = parsePedidoId(attachmentId);
  if (attId === null) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({
    where: { publicToken: token },
    select: { id: true, clienteId: true, codigo: true },
  });
  if (!pedido) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  // enabledForQr: true is load-bearing — this is the only gate keeping a public link from
  // handing out every file in the group, not just the ones someone chose to expose.
  const attachment = await prisma.attachment.findFirst({
    where: { id: attId, codigo: attachmentGroupKey(pedido), enabledForQr: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const bytes = await readAttachmentFile(attachment.storedPath).catch(() => null);
  if (!bytes) {
    return NextResponse.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 404 });
  }

  const isSafeInline = SAFE_INLINE_TYPES.has(attachment.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": isSafeInline ? attachment.mimeType : "application/octet-stream",
      "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.filename)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
