import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), create: vi.fn(), latest: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/saude/permissions", () => ({ requireSaudeAccess: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  sauAso: { findUnique: mocks.find }, sauPcmsoVersao: { findUnique: mocks.find },
  sauAsoAnalise: { create: mocks.create, findFirst: mocks.latest },
  sauPcmsoAnalise: { create: mocks.create, findFirst: mocks.latest },
} }));
vi.mock("@/lib/saude/auditoria", () => ({ registrarAuditoria: mocks.audit }));
import { handleExtraction } from "./route";
const data = { documentId: 9, pages: [{ page: 1, method: "ocr", text: "Documento de teste" }], text: "Documento de teste conferido", edited: true };
function request(body: unknown) { return new Request("http://localhost/test", { method: "POST", body: JSON.stringify(body) }); }

describe("Transcrição local com revisão manual", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 1 } });
    mocks.find.mockResolvedValue({ documentoId: 9 }); mocks.create.mockResolvedValue({ id: 2 });
    mocks.latest.mockResolvedValue({ resultadoEstruturado: data });
  });
  it.each(["aso", "pcmso"] as const)("exige permissão de revisão de %s e salva apenas transcrição", async kind => {
    const res = await handleExtraction(request(data), "1", kind);
    expect(res.status).toBe(201); expect(mocks.auth).toHaveBeenCalledWith(`${kind}.review`);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ provider: "local-ocr", resultadoEstruturado: data });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("nega acesso antes de consultar registros", async () => {
    mocks.auth.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await handleExtraction(request(data), "1", "aso")).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejeita transcrição de documento diferente", async () => {
    expect((await handleExtraction(request({ ...data, documentId: 10 }), "1", "aso")).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([{}, { ...data, text: "" }, { ...data, pages: [] }, { ...data, pages: [{ page: 3, method: "ocr", text: "x" }] }])("rejeita conteúdo inválido", async body => {
    expect((await handleExtraction(request(body), "1", "pcmso")).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejeita corpos acima do limite", async () => {
    expect((await handleExtraction(request({ text: "x".repeat(4000001) }), "1", "aso")).status).toBe(413);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("recarrega transcrição com cache privado", async () => {
    const res = await handleExtraction(new Request("http://localhost/test"), "1", "aso");
    expect(await res.json()).toEqual({ extraction: data });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("não exibe transcrição de versão antiga do arquivo", async () => {
    mocks.latest.mockResolvedValue({ resultadoEstruturado: { ...data, documentId: 7 } });
    const res = await handleExtraction(new Request("http://localhost/test"), "1", "pcmso");
    expect(await res.json()).toEqual({ extraction: null });
  });
});
