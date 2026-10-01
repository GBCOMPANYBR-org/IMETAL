import type { PcmsoAnalysisResult, AsoAnalysisResult } from "@/lib/saude/ai/types";

export interface AnalyzeDocumentInput {
  bytes: Buffer;
  mimeType: string;
}

/**
 * Fronteira entre o módulo e qualquer provedor de IA (seção 33) — o resto do sistema só conhece
 * esta interface, nunca o SDK de um fornecedor específico. Trocar de provedor um dia é trocar só
 * a implementação em lib/saude/ai/anthropic-service.ts, sem tocar nas rotas que chamam
 * getAIService().
 */
export interface AIService {
  analyzePcmso(input: AnalyzeDocumentInput): Promise<{ result: PcmsoAnalysisResult; model: string; raw: unknown }>;
  analyzeAso(input: AnalyzeDocumentInput): Promise<{ result: AsoAnalysisResult; model: string; raw: unknown }>;
}

/** Erro esperado quando a IA não está configurada neste ambiente — tratado pela rota como um
 *  erro de usuário (400), não um 500, já que não é um bug: só falta a chave. */
export class AIServiceNotConfiguredError extends Error {
  constructor() {
    super(
      "IA não configurada neste ambiente — defina ANTHROPIC_API_KEY nas variáveis de ambiente para habilitar a leitura automática."
    );
    this.name = "AIServiceNotConfiguredError";
  }
}
