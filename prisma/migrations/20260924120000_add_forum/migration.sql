-- CreateTable
CREATE TABLE "Observacao" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migratedFromLegacy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Observacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacaoMention" (
    "id" SERIAL NOT NULL,
    "observacaoId" INTEGER NOT NULL,
    "mentionedUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "resolutionType" TEXT,

    CONSTRAINT "ObservacaoMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Observacao_pedidoId_createdAt_idx" ON "Observacao"("pedidoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObservacaoMention_observacaoId_mentionedUserId_key" ON "ObservacaoMention"("observacaoId", "mentionedUserId");

-- CreateIndex
CREATE INDEX "ObservacaoMention_mentionedUserId_resolvedAt_viewedAt_idx" ON "ObservacaoMention"("mentionedUserId", "resolvedAt", "viewedAt");

-- AddForeignKey
ALTER TABLE "Observacao" ADD CONSTRAINT "Observacao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observacao" ADD CONSTRAINT "Observacao_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacaoMention" ADD CONSTRAINT "ObservacaoMention_observacaoId_fkey" FOREIGN KEY ("observacaoId") REFERENCES "Observacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacaoMention" ADD CONSTRAINT "ObservacaoMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacaoMention" ADD CONSTRAINT "ObservacaoMention_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
