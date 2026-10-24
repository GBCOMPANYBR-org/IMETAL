import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { extractionSchema } from "./types";

/** Guarda somente uma transcrição para conferência. Não cria requisitos nem altera ASO. */
export async function handleExtraction(request: Request, rawId: string, kind: "aso" | "pcmso") {
  const auth = await requireSaudeAccess(kind === "aso" ? "aso.review" : "pcmso.review");
  if ("error" in auth) return auth.error;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Registro inválido." }, { status: 400 });
  const record = kind === "aso"
    ? await prisma.sauAso.findUnique({ where: { id }, select: { documentoId: true } })
    : await prisma.sauPcmsoVersao.findUnique({ where: { id }, select: { documentoId: true } });
  if (!record) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  if (!record.documentoId) return NextResponse.json({ error: "Nenhum documento anexado." }, { status: 400 });

  if (request.method === "GET") {
    const latest = kind === "aso"
      ? await prisma.sauAsoAnalise.findFirst({ where: { asoId: id, provider: "local-ocr" }, orderBy: { id: "desc" }, select: { resultadoEstruturado: true } })
      : await prisma.sauPcmsoAnalise.findFirst({ where: { pcmsoVersaoId: id, provider: "local-ocr" }, orderBy: { id: "desc" }, select: { resultadoEstruturado: true } });
    const parsed = extractionSchema.safeParse(latest?.resultadoEstruturado);
    return NextResponse.json({ extraction: parsed.success && parsed.data.documentId === record.documentoId ? parsed.data : null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Limita a leitura antes do parse e não aceita a antiga chamada vazia para API de IA.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Extraia o texto no navegador antes de salvar." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4000000) { await reader.cancel(); return NextResponse.json({ error: "Transcrição muito grande." }, { status: 413 }); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return NextResponse.json({ error: "Transcrição inválida." }, { status: 400 }); }
  const parsed = extractionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Transcrição inválida." }, { status: 400 });
  if (parsed.data.documentId !== record.documentoId) return NextResponse.json({ error: "O documento foi alterado. Recarregue a página." }, { status: 409 });
  const data = {
    provider: "local-ocr", model: "pdfjs-tesseract-por", status: "CONCLUIDO" as const,
    resultadoEstruturado: JSON.parse(JSON.stringify(parsed.data)),
    solicitadoPorId: auth.user.id, concluidoEm: new Date(),
  };
  const analysis = kind === "aso"
    ? await prisma.sauAsoAnalise.create({ data: { ...data, asoId: id } })
    : await prisma.sauPcmsoAnalise.create({ data: { ...data, pcmsoVersaoId: id } });
  await registrarAuditoria({ entidade: kind === "aso" ? "SauAsoAnalise" : "SauPcmsoAnalise", entidadeId: analysis.id, acao: "EXTRAIU_TEXTO", userId: auth.user.id, depois: { documentId: record.documentoId, edited: parsed.data.edited, pages: parsed.data.pages.length } });
  return NextResponse.json({ saved: true, id: analysis.id }, { status: 201 });
}
