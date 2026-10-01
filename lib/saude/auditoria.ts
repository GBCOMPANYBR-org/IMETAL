import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Single audit sink for the Saúde Ocupacional module — see SauAuditoria in schema.prisma. */
export async function registrarAuditoria(params: {
  entidade: string;
  entidadeId: string | number;
  acao: string;
  userId?: number | null;
  antes?: Prisma.InputJsonValue | null;
  depois?: Prisma.InputJsonValue | null;
  detalhes?: string;
}): Promise<void> {
  await prisma.sauAuditoria.create({
    data: {
      entidade: params.entidade,
      entidadeId: String(params.entidadeId),
      acao: params.acao,
      userId: params.userId ?? null,
      antes: params.antes ?? undefined,
      depois: params.depois ?? undefined,
      detalhes: params.detalhes,
    },
  });
}
