-- Campo "Previsão" (previsão de entrega ao cliente) — nullable, puramente aditivo.
ALTER TABLE "Pedido" ADD COLUMN "previsao" TIMESTAMP(3);
