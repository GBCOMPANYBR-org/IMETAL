-- DropForeignKey
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_pagamentoId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
