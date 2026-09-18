-- AlterTable: add the opaque public token, nullable at first so we can backfill it.
ALTER TABLE "Pedido" ADD COLUMN "publicToken" TEXT;

UPDATE "Pedido" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

ALTER TABLE "Pedido" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_publicToken_key" ON "Pedido"("publicToken");

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "enabledForQr" BOOLEAN NOT NULL DEFAULT false;
