import { describe, expect, it } from "vitest";
import { calcularChecklist, type RequisitoInput, type ExameInput, type AsoInput } from "./motor-liberacao";

const HOJE = new Date("2026-10-01T00:00:00Z");

function requisito(overrides: Partial<RequisitoInput> = {}): RequisitoInput {
  return {
    requisitoId: 1,
    tipoExameId: 10,
    tipoExameNome: "Audiometria",
    obrigatorio: true,
    pcmsoVersaoId: 1,
    origemPagina: null,
    origemTrecho: null,
    ...overrides,
  };
}

function exame(overrides: Partial<ExameInput> = {}): ExameInput {
  return {
    exameId: 1,
    tipoExameId: 10,
    dataRealizacao: new Date("2026-01-01T00:00:00Z"),
    dataValidade: new Date("2027-01-01T00:00:00Z"),
    documentoId: null,
    ...overrides,
  };
}

const ASO_REGULAR: AsoInput = { asoId: 1, data: new Date("2026-01-01T00:00:00Z"), documentoId: null };

describe("calcularChecklist", () => {
  it("libera quando o ASO e todos os exames obrigatórios estão em dia", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [exame()],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("LIBERADO");
    expect(result.itens.every((i) => i.status === "REGULAR")).toBe(true);
  });

  it("não libera quando falta um exame obrigatório", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("NAO_LIBERADO");
    expect(result.itens.find((i) => i.tipo === "EXAME")?.status).toBe("PENDENTE");
  });

  it("não libera quando um exame obrigatório está vencido", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [exame({ dataValidade: new Date("2026-09-01T00:00:00Z") })],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("NAO_LIBERADO");
    expect(result.itens.find((i) => i.tipo === "EXAME")?.status).toBe("VENCIDO");
  });

  it("libera com atenção quando um exame obrigatório está perto de vencer", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [exame({ dataValidade: new Date("2026-10-15T00:00:00Z") })],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("LIBERADO_ATENCAO");
  });

  it("não libera quando o ASO não foi localizado, mesmo com todos os exames em dia", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [exame()],
      asoMaisRecente: null,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("NAO_LIBERADO");
    expect(result.itens.find((i) => i.tipo === "ASO")?.status).toBe("PENDENTE");
  });

  it("um exame recomendado (não obrigatório) pendente só rebaixa pra atenção, não bloqueia", () => {
    const result = calcularChecklist({
      requisitos: [requisito({ obrigatorio: false })],
      exames: [],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.statusGeral).toBe("LIBERADO_ATENCAO");
  });

  it("escolhe o exame mais recente quando há mais de um do mesmo tipo", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [
        exame({ exameId: 1, dataRealizacao: new Date("2024-01-01T00:00:00Z"), dataValidade: new Date("2025-01-01T00:00:00Z") }),
        exame({ exameId: 2, dataRealizacao: new Date("2026-06-01T00:00:00Z"), dataValidade: new Date("2027-06-01T00:00:00Z") }),
      ],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    const item = result.itens.find((i) => i.tipo === "EXAME");
    expect(item?.exameId).toBe(2);
    expect(item?.status).toBe("REGULAR");
  });

  it("exame sem data de validade conta como regular indefinidamente", () => {
    const result = calcularChecklist({
      requisitos: [requisito()],
      exames: [exame({ dataValidade: null })],
      asoMaisRecente: ASO_REGULAR,
      dataReferencia: HOJE,
    });
    expect(result.itens.find((i) => i.tipo === "EXAME")?.status).toBe("REGULAR");
    expect(result.statusGeral).toBe("LIBERADO");
  });
});
