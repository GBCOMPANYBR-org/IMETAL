-- Alerta admin-only para Pedidos que acabaram de entrar em "Finalizado".
ALTER TABLE "User" ADD COLUMN "lastFinalizadosViewedAt" TIMESTAMP(3);
ALTER TABLE "Pedido" ADD COLUMN "finalizadoAt" TIMESTAMP(3);

CREATE INDEX "Pedido_finalizadoAt_idx" ON "Pedido"("finalizadoAt");
