-- Alerta admin-only para Pedidos que acabaram de entrar em "Finalizado".
-- Idempotente porque Production foi preparado previamente pela rota administrativa temporária.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFinalizadosViewedAt" TIMESTAMP(3);
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "finalizadoAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Pedido_finalizadoAt_idx" ON "Pedido"("finalizadoAt");
