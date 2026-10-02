-- Garante que no máximo um movimento de EPI substitua um dado movimento anterior — fecha uma
-- corrida onde duas trocas/devoluções simultâneas passariam pela checagem da API antes de
-- qualquer uma gravar. NULL não conta pra unicidade (ENTREGA, que não substitui nada, não é
-- afetada). Achado num pente-fino pós-deploy — tabela ainda vazia em produção, aditiva e segura.

-- CreateIndex
CREATE UNIQUE INDEX "SauEpiMovimento_substituiMovimentoId_key" ON "SauEpiMovimento"("substituiMovimentoId");
