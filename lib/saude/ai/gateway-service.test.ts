import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (value: unknown) => value } }));
import { GatewayAIService } from "./gateway-service";

const pdf = { bytes: Buffer.from("synthetic document"), mimeType: "application/pdf" };
const pcmso = { functions: [], warnings: ["Documento de teste sem funções"], confidence: { overall: null } };

describe("Leitura de documentos pelo Gateway", () => {
  beforeEach(() => {
    generate.mockReset();
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("SAUDE_AI_GATEWAY_MODEL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("falha antes do envio quando não há autenticação", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    await expect(new GatewayAIService().analyzePcmso(pdf)).rejects.toThrow("IA não configurada");
    expect(generate).not.toHaveBeenCalled();
  });

  it("aceita OIDC e envia bytes de PDF, sem guardar o corpo da resposta", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "test-oidc");
    generate.mockResolvedValue({ output: pcmso, finishReason: "stop", usage: { inputTokens: 3 }, response: { body: "private" } });
    const result = await new GatewayAIService().analyzePcmso(pdf);
    expect(result.result).toEqual(pcmso);
    expect(result.raw).toEqual({ usage: { inputTokens: 3 }, finishReason: "stop" });
    expect(generate.mock.calls[0][0].messages[0].content[0]).toMatchObject({ type: "file", mediaType: "application/pdf", data: pdf.bytes });
  });

  it("transcreve ASO sem concluir aptidão e normaliza JPEG", async () => {
    const aso = { employeeName: "Pessoa Teste", employeeCpf: null, employeeMatricula: null, companyName: null, jobFunction: null, asoType: null, date: null, declaredFitnessResult: "INAPTO", doctorName: null, doctorCrm: null, risks: [], exams: [], warnings: [], confidence: { overall: null } };
    generate.mockResolvedValue({ output: aso, finishReason: "stop", usage: {} });
    const result = await new GatewayAIService().analyzeAso({ ...pdf, mimeType: "image/jpg" });
    expect(result.result.declaredFitnessResult).toBe("INAPTO");
    expect(generate.mock.calls[0][0].messages[0].content[0]).toMatchObject({ type: "image", mediaType: "image/jpeg" });
  });

  it.each(["length", "content-filter", "error"])("rejeita resposta incompleta: %s", async finishReason => {
    generate.mockResolvedValue({ output: pcmso, finishReason, usage: {} });
    await expect(new GatewayAIService().analyzePcmso(pdf)).rejects.toThrow("completa e válida");
  });

  it("rejeita estrutura inválida", async () => {
    generate.mockResolvedValue({ output: { functions: "invalid" }, finishReason: "stop", usage: {} });
    await expect(new GatewayAIService().analyzePcmso(pdf)).rejects.toThrow("completa e válida");
  });

  it.each([401, 402, 403, 429, 500])("não expõe erros brutos (%s)", async statusCode => {
    generate.mockRejectedValue({ statusCode, message: "secret document and credential", requestBody: "private" });
    const error = await new GatewayAIService().analyzePcmso(pdf).catch(error => error);
    expect(error.message).not.toMatch(/secret|credential|private/);
    expect(error.status).toBe(statusCode === 429 ? 429 : statusCode === 500 ? 502 : 503);
  });

  it("rejeita formato inválido antes de chamar o provedor", async () => {
    await expect(new GatewayAIService().analyzePcmso({ ...pdf, mimeType: "text/html" })).rejects.toThrow("Formato não suportado");
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejeita arquivo vazio ou acima do limite", async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(20 * 1024 * 1024 + 1)]) {
      await expect(new GatewayAIService().analyzePcmso({ ...pdf, bytes })).rejects.toThrow("20 MB");
    }
    expect(generate).not.toHaveBeenCalled();
  });
});
