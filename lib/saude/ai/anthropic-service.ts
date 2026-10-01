import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { pcmsoAnalysisSchema, asoAnalysisSchema, type PcmsoAnalysisResult, type AsoAnalysisResult } from "@/lib/saude/ai/types";
import { PERIODICIDADES, ASO_TIPOS } from "@/lib/saude/validation";
import { AIServiceNotConfiguredError, type AIService, type AnalyzeDocumentInput } from "@/lib/saude/ai/service";

const DEFAULT_MODEL = "claude-sonnet-5";

function documentBlock(bytes: Buffer, mimeType: string): ContentBlockParam {
  if (mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } };
  }

  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  const normalized = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  if ((imageTypes as readonly string[]).includes(normalized)) {
    return { type: "image", source: { type: "base64", media_type: normalized as (typeof imageTypes)[number], data: bytes.toString("base64") } };
  }

  throw new Error(`Tipo de arquivo não suportado para leitura por IA: ${mimeType}.`);
}

// Mantido manualmente em sincronia com pcmsoAnalysisSchema (lib/saude/ai/types.ts) — sem
// zod-to-json-schema no projeto, e são só dois schemas, então uma dependência a mais não
// compensa. A validação zod depois da resposta é o que garante que os dois não divergem em
// silêncio: se a IA retornar algo fora do formato, o parse falha e vira AIAnaliseInvalidaError.
const PCMSO_TOOL: Tool = {
  name: "registrar_leitura_pcmso",
  description: "Registra a leitura estruturada de um PCMSO: funções, riscos ocupacionais e exames exigidos por função.",
  input_schema: {
    type: "object",
    properties: {
      functions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            risks: { type: "array", items: { type: "string" } },
            exams: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  periodicity: { type: "string", enum: [...PERIODICIDADES] },
                  periodicityDetail: { type: ["string", "null"] },
                  mandatory: { type: "boolean" },
                  page: { type: ["integer", "null"] },
                  excerpt: { type: ["string", "null"] },
                  confidence: { type: ["number", "null"] },
                },
                required: ["name", "periodicity", "mandatory"],
              },
            },
          },
          required: ["name", "risks", "exams"],
        },
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: { type: "object", properties: { overall: { type: ["number", "null"] } }, required: ["overall"] },
    },
    required: ["functions", "warnings", "confidence"],
  },
};

const ASO_TOOL: Tool = {
  name: "registrar_leitura_aso",
  description: "Registra a leitura estruturada de um ASO — apenas o que está escrito no documento, sem concluir aptidão.",
  input_schema: {
    type: "object",
    properties: {
      employeeName: { type: ["string", "null"] },
      employeeCpf: { type: ["string", "null"] },
      employeeMatricula: { type: ["string", "null"] },
      companyName: { type: ["string", "null"] },
      jobFunction: { type: ["string", "null"] },
      asoType: { type: ["string", "null"], enum: [...ASO_TIPOS, null] },
      date: { type: ["string", "null"], description: "AAAA-MM-DD" },
      declaredFitnessResult: { type: ["string", "null"], description: "Texto exatamente como escrito no documento." },
      doctorName: { type: ["string", "null"] },
      doctorCrm: { type: ["string", "null"] },
      risks: { type: "array", items: { type: "string" } },
      exams: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" }, date: { type: ["string", "null"] } }, required: ["name"] },
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: { type: "object", properties: { overall: { type: ["number", "null"] } }, required: ["overall"] },
    },
    required: [
      "employeeName",
      "employeeCpf",
      "employeeMatricula",
      "companyName",
      "jobFunction",
      "asoType",
      "date",
      "declaredFitnessResult",
      "doctorName",
      "doctorCrm",
      "risks",
      "exams",
      "warnings",
      "confidence",
    ],
  },
};

export class AIAnaliseInvalidaError extends Error {
  constructor(details: string) {
    super(`A IA retornou um resultado em formato inesperado: ${details}`);
    this.name = "AIAnaliseInvalidaError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AIServiceNotConfiguredError();
  return new Anthropic({ apiKey });
}

async function runTool<T>(params: { client: Anthropic; model: string; tool: Tool; instruction: string; doc: ContentBlockParam; schema: { parse: (v: unknown) => T } }) {
  const response = await params.client.messages.create({
    model: params.model,
    max_tokens: 8192,
    tools: [params.tool],
    tool_choice: { type: "tool", name: params.tool.name },
    messages: [{ role: "user", content: [params.doc, { type: "text", text: params.instruction }] }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new AIAnaliseInvalidaError("nenhuma resposta estruturada retornada.");
  }

  const parsed = params.schema.parse(toolUse.input);
  return { result: parsed, rawInput: toolUse.input, usage: response.usage };
}

/** Implementação via Anthropic (Claude) — ver lib/saude/ai/service.ts para a interface que o
 *  resto do módulo conhece. Modelo configurável por env var pra poder subir de versão sem
 *  redeploy de código. */
export class AnthropicAIService implements AIService {
  private readonly model = process.env.SAUDE_AI_MODEL || DEFAULT_MODEL;

  async analyzePcmso(input: AnalyzeDocumentInput): Promise<{ result: PcmsoAnalysisResult; model: string; raw: unknown }> {
    const client = getClient();
    const doc = documentBlock(input.bytes, input.mimeType);
    const { result, rawInput, usage } = await runTool({
      client,
      model: this.model,
      tool: PCMSO_TOOL,
      doc,
      schema: pcmsoAnalysisSchema,
      instruction:
        "Leia este PCMSO (Programa de Controle Médico de Saúde Ocupacional) e extraia, para cada função/cargo citado: " +
        "os riscos ocupacionais e os exames exigidos (com periodicidade, obrigatoriedade, página e trecho de origem quando " +
        "identificáveis). Não invente informação que não está no documento — se algo estiver ilegível ou ambíguo, registre " +
        "em warnings e deixe confidence baixo em vez de adivinhar.",
    });
    return { result, model: this.model, raw: { rawInput, usage } };
  }

  async analyzeAso(input: AnalyzeDocumentInput): Promise<{ result: AsoAnalysisResult; model: string; raw: unknown }> {
    const client = getClient();
    const doc = documentBlock(input.bytes, input.mimeType);
    const { result, rawInput, usage } = await runTool({
      client,
      model: this.model,
      tool: ASO_TOOL,
      doc,
      schema: asoAnalysisSchema,
      instruction:
        "Leia este ASO (Atestado de Saúde Ocupacional) e extraia os dados exatamente como estão escritos: funcionário, " +
        "empresa, função, tipo de ASO, data, médico/CRM, riscos e exames citados. O campo declaredFitnessResult deve ser " +
        "o texto literal do resultado (ex.: 'APTO', 'INAPTO') — nunca uma conclusão sua. Não decida se a pessoa está apta; " +
        "apenas transcreva o que o documento diz.",
    });
    return { result, model: this.model, raw: { rawInput, usage } };
  }
}

let instance: AIService | null = null;

/** Único ponto de entrada pro resto do módulo — nunca importar AnthropicAIService diretamente
 *  fora daqui, pra trocar de provedor sem caçar imports espalhados. */
export function getAIService(): AIService {
  if (!instance) instance = new AnthropicAIService();
  return instance;
}
