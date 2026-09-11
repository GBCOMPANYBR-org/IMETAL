-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_label_key" ON "Pagamento"("label");

-- Seed one Pagamento row per distinct value already used across existing Pedidos (e.g. 30DDL,
-- 60DDL, 30/60DDL) — the free-text values already in the table become the initial list options.
INSERT INTO "Pagamento" ("label")
SELECT DISTINCT "pagamento" FROM "Pedido" WHERE "pagamento" IS NOT NULL;

-- AlterTable: add the FK column, backfill it from the old free-text column, then drop that column.
ALTER TABLE "Pedido" ADD COLUMN "pagamentoId" INTEGER;

UPDATE "Pedido" p
SET "pagamentoId" = pg."id"
FROM "Pagamento" pg
WHERE p."pagamento" = pg."label";

ALTER TABLE "Pedido" DROP COLUMN "pagamento";

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
