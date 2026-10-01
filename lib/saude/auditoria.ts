import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Round-trips through JSON so values that aren't directly JSON-serializable (Date, Set, a
// Prisma result object) land in the Json column the same way they'd read back — callers can
// pass whatever they already have in hand (a zod-parsed payload, a Prisma row) without having
// to sanitize it themselves first.
function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Single audit sink for the Saúde Ocupacional module — see SauAuditoria in schema.prisma. */
export async function registrarAuditoria(params: {
  entidade: string;
  entidadeId: string | number;
  acao: string;
  userId?: number | null;
  antes?: unknown;
  depois?: unknown;
  detalhes?: string;
}): Promise<void> {
  await prisma.sauAuditoria.create({
    data: {
      entidade: params.entidade,
      entidadeId: String(params.entidadeId),
      acao: params.acao,
      userId: params.userId ?? null,
      antes: toJsonSafe(params.antes),
      depois: toJsonSafe(params.depois),
      detalhes: params.detalhes,
    },
  });
}
