import { describe, expect, it } from "vitest";
import { formatMentionToken, parseMentionIds, stripMentionSyntax } from "./mentions";

describe("parseMentionIds", () => {
  it("extracts a single mention id", () => {
    expect(parseMentionIds("Olá @[João Silva](42), tudo bem?")).toEqual([42]);
  });

  it("extracts multiple distinct mentions in order", () => {
    expect(parseMentionIds("@[Ana](1) e @[Bruno](2), verifiquem isso.")).toEqual([1, 2]);
  });

  it("dedupes the same id mentioned twice in one message", () => {
    // Two separate tokens for the same person (e.g. picked twice by accident) must collapse to
    // one pendência, per "evite duplicar a pendência da mesma pessoa dentro do mesmo comentário".
    expect(parseMentionIds("@[Ana](1) ...depois de novo @[Ana Paula](1)")).toEqual([1]);
  });

  it("returns an empty array when there are no tokens", () => {
    expect(parseMentionIds("Texto normal sem marcação nenhuma.")).toEqual([]);
  });

  it("ignores brackets/parentheses that aren't a well-formed mention token", () => {
    expect(parseMentionIds("Valor unitário (R$ 10,00) [ver anexo] sem @ nenhum.")).toEqual([]);
    expect(parseMentionIds("Ele disse [oi](não um id) mas sem @ na frente.")).toEqual([]);
  });

  it("does not let a manipulated id-looking id near an existing name string fabricate an extra mention", () => {
    // Only real "@[...](\d+)" tokens count — free text mentioning an id in prose is not a mention.
    expect(parseMentionIds("O usuário de id 99 não foi marcado, só citado.")).toEqual([]);
  });
});

describe("formatMentionToken / stripMentionSyntax round-trip", () => {
  it("formats and re-parses the same id", () => {
    const token = formatMentionToken("Maria Souza", 7);
    expect(token).toBe("@[Maria Souza](7)");
    expect(parseMentionIds(`oi ${token}`)).toEqual([7]);
  });

  it("strips a closing bracket from the name so it can never prematurely close the token", () => {
    const token = formatMentionToken("Weird]Name", 3);
    expect(token).toBe("@[WeirdName](3)");
  });

  it("strips tokens down to a plain @Nome for display fallback", () => {
    expect(stripMentionSyntax("Oi @[João](1), viu isso?")).toBe("Oi @João, viu isso?");
  });
});
