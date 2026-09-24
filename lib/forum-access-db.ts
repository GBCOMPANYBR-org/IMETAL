// Database-backed callers of canMentionUser (lib/forum-access.ts). Split out of that file so the
// pure eligibility rule can be unit-tested without a live database connection.
import { prisma } from "@/lib/prisma";
import { PEDIDO_FIELD_KEYS } from "@/lib/fields";
import { canMentionUser, type MentionCandidate } from "@/lib/forum-access";

type UserWithPermissions = {
  id: number;
  name: string;
  username: string;
  role: string;
  active: boolean;
  allClientes: boolean;
  permissions: { fieldKey: string; canView: boolean }[];
  clientes: { clienteId: number }[];
};

function toMentionCandidate(record: UserWithPermissions): MentionCandidate {
  const isAdmin = record.role === "ADMIN";
  return {
    active: record.active,
    isAdmin,
    allClientes: isAdmin || record.allClientes,
    visibleClienteIds: new Set(record.clientes.map((c) => c.clienteId)),
    visibleFields: new Set(isAdmin ? PEDIDO_FIELD_KEYS : record.permissions.filter((p) => p.canView).map((p) => p.fieldKey)),
  };
}

/** Filters `userIds` down to those actually eligible to be @-mentioned on a Pedido of this Cliente — the server-side revalidation a manipulated request can't bypass. */
export async function filterEligibleMentionIds(userIds: number[], pedidoClienteId: number): Promise<number[]> {
  if (userIds.length === 0) return [];
  const records = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { permissions: true, clientes: true },
  });
  return records.filter((r) => canMentionUser(toMentionCandidate(r), pedidoClienteId)).map((r) => r.id);
}

/** Searches active, eligible users by name/username for the @ dropdown — same rule as above. */
export async function searchMentionableUsers(pedidoClienteId: number, query: string, take = 10) {
  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      OR: query ? [{ name: { contains: query, mode: "insensitive" } }, { username: { contains: query, mode: "insensitive" } }] : undefined,
    },
    include: { permissions: true, clientes: true },
    orderBy: { name: "asc" },
    take: 30,
  });
  return candidates
    .filter((r) => canMentionUser(toMentionCandidate(r), pedidoClienteId))
    .slice(0, take)
    .map((r) => ({ id: r.id, name: r.name, username: r.username }));
}
