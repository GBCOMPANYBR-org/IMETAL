/**
 * Whether `candidate` is eligible to be @-mentioned (and, symmetrically, to read/reply in the
 * Fórum thread) on a Pedido belonging to `pedidoClienteId`. This is the single rule shared by:
 * the @ search endpoint (who shows up while typing), the POST that creates mentions (server-side
 * revalidation — never trust the client's picked ids), and the GET that reads a thread's history
 * (who may open it). Keeping all three on this one function is what prevents a "ghost pendência":
 * someone who could be mentioned but who then can't open their own Fórum item.
 *
 * Deliberately dependency-free (no prisma import) — see lib/forum-access-db.ts for the
 * database-backed callers that build a MentionCandidate from a User record. Keeping this file
 * free of any import with its own side effects (like instantiating PrismaClient, which needs
 * DATABASE_URL at construction time) is what lets forum-access.test.ts run without a database.
 */
export interface MentionCandidate {
  active: boolean;
  isAdmin: boolean;
  allClientes: boolean;
  visibleClienteIds: Set<number>;
  visibleFields: Set<string>;
}

export function canMentionUser(candidate: MentionCandidate, pedidoClienteId: number): boolean {
  if (!candidate.active) return false;
  if (!candidate.visibleFields.has("observacao")) return false;
  if (candidate.isAdmin || candidate.allClientes) return true;
  return candidate.visibleClienteIds.has(pedidoClienteId);
}
