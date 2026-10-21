ALTER TABLE "Pedido" ADD COLUMN "parentPedidoId" INTEGER;
CREATE INDEX "Pedido_parentPedidoId_idx" ON "Pedido"("parentPedidoId");
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_parentPedidoId_fkey" FOREIGN KEY ("parentPedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
