import { z } from "zod";
import { PERIODICIDADES, ASO_TIPOS } from "@/lib/saude/validation";

/**
 * Schema estruturado da leitura de PCMSO (seção 34 da especificação). Aninhado por função (em
 * vez do exemplo "achatado" da especificação) porque é isso que vira direto SauPcmsoFuncao +
 * SauPcmsoFuncaoRisco + SauRequisito — mas cobre os mesmos conceitos (functions/risks/exams/
 * periodicities/warnings/confidence). "rules" da especificação é o próprio conjunto de
 * requisitos aqui dentro, não um campo à parte.
 *
 * `confidence` por item é o que decide o que aparece destacado pra revisão (seção 35) — nunca
 * inventar quando a IA não tiver certeza: campo ausente ou confidence baixo vira "não
 * identificado com segurança" na tela, nunca um palpite silencioso.
 */
export const pcmsoExameSchema = z.object({
  name: z.string().describe("Nome do exame exatamente como seria usado no sistema, ex.: 'Audiometria'."),
  periodicity: z.enum(PERIODICIDADES).describe("Classificação da periodicidade num destes valores fixos."),
  periodicityDetail: z.string().nullable().describe("Texto literal da periodicidade como está no documento, se diferente da classificação."),
  mandatory: z.boolean().describe("Se o documento trata este exame como obrigatório."),
  page: z.number().int().nullable().describe("Página do PDF onde esta exigência aparece, se identificável."),
  excerpt: z.string().nullable().describe("Trecho curto do documento que sustenta esta exigência."),
  confidence: z.number().min(0).max(1).nullable(),
});

export const pcmsoFuncaoSchema = z.object({
  name: z.string().describe("Nome do cargo/função exatamente como está no documento."),
  risks: z.array(z.string()).describe("Riscos ocupacionais listados para esta função."),
  exams: z.array(pcmsoExameSchema),
});

export const pcmsoAnalysisSchema = z.object({
  functions: z.array(pcmsoFuncaoSchema),
  warnings: z.array(z.string()).describe("Avisos sobre ambiguidade, baixa confiança ou trechos ilegíveis."),
  confidence: z.object({ overall: z.number().min(0).max(1).nullable() }),
});

export type PcmsoAnalysisResult = z.infer<typeof pcmsoAnalysisSchema>;

/**
 * Schema estruturado da leitura de ASO (seção 34). `declaredFitnessResult` é sempre o texto
 * literal do documento ("APTO"/"INAPTO"/etc.) — a IA nunca decide aptidão, só transcreve o que
 * o profissional escreveu (seção 16/22).
 */
export const asoAnalysisSchema = z.object({
  employeeName: z.string().nullable().describe("Nome do funcionário como está no documento."),
  employeeCpf: z.string().nullable(),
  employeeMatricula: z.string().nullable(),
  companyName: z.string().nullable().describe("Nome da empresa/cliente citado no documento."),
  jobFunction: z.string().nullable(),
  asoType: z.enum(ASO_TIPOS).nullable(),
  date: z.string().nullable().describe("Data do ASO em formato ISO (AAAA-MM-DD), se identificável."),
  declaredFitnessResult: z.string().nullable().describe("Resultado EXATAMENTE como escrito no documento — nunca uma conclusão da IA."),
  doctorName: z.string().nullable(),
  doctorCrm: z.string().nullable(),
  risks: z.array(z.string()),
  exams: z.array(z.object({ name: z.string(), date: z.string().nullable() })),
  warnings: z.array(z.string()),
  confidence: z.object({ overall: z.number().min(0).max(1).nullable() }),
});

export type AsoAnalysisResult = z.infer<typeof asoAnalysisSchema>;
