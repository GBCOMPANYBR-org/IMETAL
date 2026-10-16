import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { readSaudeFile } from "@/lib/saude/storage";
import { getAIService, AIAnalysisError } from "@/lib/saude/ai/gateway-service";
import { AIServiceNotConfiguredError } from "@/lib/saude/ai/service";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export const maxDuration = 300;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Leitura por IA/OCR do ASO (seção 16). Só extrai e devolve — nunca escreve direto no SauAso.
 * Quem está revisando decide o que aceitar, usando os valores retornados aqui pra preencher a
 * tela de conferência (seção 17) e confirmando pelo fluxo normal (PATCH + POST /confirmar).
 * declaredFitnessResult nunca é interpretado como decisão médica, só transcrito.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("aso.review");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ASO inválido." }, { status: 400 });

  const aso = await prisma.sauAso.findUnique({ where: { id }, include: { documento: true } });
  if (!aso) return NextResponse.json({ error: "ASO não encontrado." }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readSaudeFile(aso.documento.storedPath);
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o documento original." }, { status: 500 });
  }

  const aiService = getAIService();

  let analise;
  try {
    const { result, model, raw } = await aiService.analyzeAso({ bytes, mimeType: aso.documento.mimeType });

    analise = await prisma.sauAsoAnalise.create({
      data: {
        asoId: id,
        provider: aiService.provider,
        model,
        status: "CONCLUIDO",
        resultadoBruto: JSON.parse(JSON.stringify(raw)),
        resultadoEstruturado: JSON.parse(JSON.stringify(result)),
        confianca: result.confidence,
        solicitadoPorId: auth.user.id,
        concluidoEm: new Date(),
      },
    });

    await registrarAuditoria({ entidade: "SauAsoAnalise", entidadeId: analise.id, acao: "ANALISOU", userId: auth.user.id, depois: { asoId: id } });

    return NextResponse.json({ analise, extraido: result });
  } catch (error) {
    if (error instanceof AIServiceNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const mensagem = error instanceof AIAnalysisError ? error.message : "Falha ao processar a análise.";
    await prisma.sauAsoAnalise.create({
      data: { asoId: id, provider: aiService.provider, model: aiService.model, status: "ERRO", erro: mensagem, solicitadoPorId: auth.user.id },
    });
    console.error("Erro na leitura de ASO por IA:", mensagem);
    return NextResponse.json({ error: error instanceof AIAnalysisError ? mensagem : "Não foi possível concluir a leitura do documento. Confira os dados manualmente." }, { status: error instanceof AIAnalysisError ? error.status : 502 });
  }
}
