-- DropIndex
DROP INDEX "Attachment_codigo_idx";

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'anexo';

-- CreateTable
CREATE TABLE "FotoCapa" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfAnexo" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotoCapa_pedidoId_key" ON "FotoCapa"("pedidoId");

-- CreateIndex
CREATE INDEX "Attachment_codigo_kind_idx" ON "Attachment"("codigo", "kind");

-- AddForeignKey
ALTER TABLE "FotoCapa" ADD CONSTRAINT "FotoCapa_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoCapa" ADD CONSTRAINT "FotoCapa_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfAnexo" ADD CONSTRAINT "NfAnexo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfAnexo" ADD CONSTRAINT "NfAnexo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

