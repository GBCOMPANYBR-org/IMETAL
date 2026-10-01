import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess, type SauPermissionKey } from "@/lib/saude/permissions";
import { readSaudeFile } from "@/lib/saude/storage";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const CATEGORIA_TO_PERMISSION: Record<string, SauPermissionKey> = {
  PCMSO: "pcmso.view",
  ASO: "aso.view",
  EXAME: "exam.view",
  FOTO_FUNCIONARIO: "employee.view",
  OUTRO: "employee.view",
};

/**
 * Único jeito de ler um documento do módulo — nunca uma URL de blob pública chega ao cliente
 * (seção 31: dificuldade de adivinhar a URL não é proteção). A checagem de permissão roda em
 * todo acesso, e cada leitura grava SauDocumentoAcesso.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });

  const documento = await prisma.sauDocumento.findUnique({ where: { id } });
  if (!documento) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const requiredKey = CATEGORIA_TO_PERMISSION[documento.categoria] ?? "employee.view";
  const auth = await requireSaudeAccess(requiredKey);
  if ("error" in auth) return auth.error;

  const bytes = await readSaudeFile(documento.storedPath);

  await prisma.sauDocumentoAcesso.create({
    data: { documentoId: id, userId: auth.user.id, acao: "VISUALIZOU" },
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": documento.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(documento.nomeOriginal)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
