-- Controle de EPI (NR-06): catálogo de tipos + histórico de entregas/trocas/devoluções por
-- funcionário. Puramente aditivo — duas tabelas novas e uma coluna nova (nullable) em
-- SauAlerta; nenhuma tabela existente é alterada em dado já gravado.

-- CreateTable
CREATE TABLE "SauEpiTipo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauEpiTipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauEpiMovimento" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "tipoId" INTEGER NOT NULL,
    "tipoMovimento" TEXT NOT NULL DEFAULT 'ENTREGA',
    "ca" TEXT NOT NULL,
    "validadeCa" TIMESTAMP(3),
    "lote" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "dataMovimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "substituiMovimentoId" INTEGER,
    "responsavelId" INTEGER NOT NULL,
    "aceiteConfirmado" BOOLEAN NOT NULL DEFAULT true,
    "aceiteEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentoId" INTEGER,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauEpiMovimento_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SauAlerta" ADD COLUMN "epiMovimentoId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "SauEpiTipo_nome_key" ON "SauEpiTipo"("nome");

-- CreateIndex
CREATE INDEX "SauEpiMovimento_funcionarioId_tipoId_idx" ON "SauEpiMovimento"("funcionarioId", "tipoId");

-- AddForeignKey
ALTER TABLE "SauEpiMovimento" ADD CONSTRAINT "SauEpiMovimento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauEpiMovimento" ADD CONSTRAINT "SauEpiMovimento_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "SauEpiTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauEpiMovimento" ADD CONSTRAINT "SauEpiMovimento_substituiMovimentoId_fkey" FOREIGN KEY ("substituiMovimentoId") REFERENCES "SauEpiMovimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauEpiMovimento" ADD CONSTRAINT "SauEpiMovimento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauEpiMovimento" ADD CONSTRAINT "SauEpiMovimento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "SauDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_epiMovimentoId_fkey" FOREIGN KEY ("epiMovimentoId") REFERENCES "SauEpiMovimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
