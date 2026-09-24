import { describe, expect, it } from "vitest";
import { canMentionUser, type MentionCandidate } from "./forum-access";

const VEOLIA = 43;
const ECOLAB = 15;

function candidate(overrides: Partial<MentionCandidate> = {}): MentionCandidate {
  return {
    active: true,
    isAdmin: false,
    allClientes: false,
    visibleClienteIds: new Set(),
    visibleFields: new Set(["observacao"]),
    ...overrides,
  };
}

describe("canMentionUser", () => {
  it("excludes a user who only has access to VEOLIA from an ECOLAB pedido", () => {
    const user = candidate({ visibleClienteIds: new Set([VEOLIA]) });
    expect(canMentionUser(user, ECOLAB)).toBe(false);
  });

  it("includes a user with access to both VEOLIA and ECOLAB in either pedido", () => {
    const user = candidate({ visibleClienteIds: new Set([VEOLIA, ECOLAB]) });
    expect(canMentionUser(user, VEOLIA)).toBe(true);
    expect(canMentionUser(user, ECOLAB)).toBe(true);
  });

  it("includes an internal collaborator with allClientes regardless of which Cliente", () => {
    const user = candidate({ allClientes: true, visibleClienteIds: new Set() });
    expect(canMentionUser(user, VEOLIA)).toBe(true);
    expect(canMentionUser(user, ECOLAB)).toBe(true);
  });

  it("always includes admins, even with no explicit Cliente grants", () => {
    const user = candidate({ isAdmin: true, allClientes: false, visibleClienteIds: new Set() });
    expect(canMentionUser(user, VEOLIA)).toBe(true);
  });

  it("excludes an inactive user even if they would otherwise have access", () => {
    const user = candidate({ active: false, allClientes: true });
    expect(canMentionUser(user, VEOLIA)).toBe(false);
  });

  it("excludes a user without the observação column visible, even with Cliente access", () => {
    // Prevents a "ghost pendência": someone mentionable who then can't open the GET /observacoes
    // thread (same gate: user.visibleFields.has("observacao")) to see/resolve their own mention.
    const user = candidate({ allClientes: true, visibleFields: new Set() });
    expect(canMentionUser(user, VEOLIA)).toBe(false);
  });

  it("excludes a restricted user with no Cliente grants at all", () => {
    const user = candidate({ visibleClienteIds: new Set() });
    expect(canMentionUser(user, VEOLIA)).toBe(false);
  });
});
