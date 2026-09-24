/**
 * One-off backfill for the Fórum feature: creates a single legacy `Observacao` row for every
 * Pedido whose old free-text `observacao` column is non-empty. Run once after applying the
 * "add_forum" migration:
 *
 *   npx tsx scripts/migrate-observacoes.ts
 *
 * Safe to re-run — a Pedido that already has any Observacao (from this script or from real
 * Fórum activity since) is skipped, so running it twice never creates duplicates.
 *
 * Deliberately creates ONE Observacao per Pedido, not one per line of the old blob: that text
 * was a `\n`-joined append log with no per-note author or timestamp, so splitting it into
 * separate "messages" would invent granularity the original data never had. The single row is
 * attributed to whoever last touched the Pedido (updatedBy, falling back to createdBy) and
 * flagged `migratedFromLegacy: true` so the Fórum UI can caption it as pre-Fórum history.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pedidos = await prisma.pedido.findMany({
    where: { observacao: { not: null } },
    select: { id: true, observacao: true, updatedById: true, createdById: true, updatedAt: true },
  });

  const nonEmpty = pedidos.filter((p) => p.observacao && p.observacao.trim() !== "");
  console.log(`Encontrados ${nonEmpty.length} pedidos com observação legada não vazia.`);

  let created = 0;
  let skipped = 0;

  for (const pedido of nonEmpty) {
    const alreadyMigrated = await prisma.observacao.findFirst({ where: { pedidoId: pedido.id }, select: { id: true } });
    if (alreadyMigrated) {
      skipped++;
      continue;
    }

    await prisma.observacao.create({
      data: {
        pedidoId: pedido.id,
        authorId: pedido.updatedById ?? pedido.createdById ?? null,
        text: pedido.observacao as string,
        createdAt: pedido.updatedAt,
        migratedFromLegacy: true,
      },
    });
    created++;
  }

  console.log(`Migração concluída: ${created} Observacao criadas, ${skipped} pedidos já tinham histórico e foram ignorados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
