-- CreateTable
CREATE TABLE "SauUserAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "concedidoPorId" INTEGER,
    "concedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauUserAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauUserPermission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "concedida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SauUserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauFuncionario" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "dataAdmissao" TIMESTAMP(3),
    "dataDesligamento" TIMESTAMP(3),
    "telefone" TEXT,
    "email" TEXT,
    "fotoStoredPath" TEXT,
    "setor" TEXT,
    "funcaoPrincipalId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SauFuncionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauCliente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "pedidosClienteId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauUnidade" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauFuncao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criadaVia" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAlocacao" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "observacoes" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauAlocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauPcmsoVersao" (
    "id" SERIAL NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "versao" TEXT NOT NULL,
    "titulo" TEXT,
    "dataDocumento" TIMESTAMP(3),
    "inicioVigencia" TIMESTAMP(3) NOT NULL,
    "fimVigencia" TIMESTAMP(3),
    "medicoResponsavel" TEXT,
    "crm" TEXT,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EM_PROCESSAMENTO',
    "documentoId" INTEGER,
    "responsavelCadastroId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SauPcmsoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauPcmsoFuncao" (
    "id" SERIAL NOT NULL,
    "pcmsoVersaoId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,

    CONSTRAINT "SauPcmsoFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauRisco" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoVia" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "SauRisco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauPcmsoFuncaoRisco" (
    "id" SERIAL NOT NULL,
    "pcmsoFuncaoId" INTEGER NOT NULL,
    "riscoId" INTEGER NOT NULL,

    CONSTRAINT "SauPcmsoFuncaoRisco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauTipoExame" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoVia" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "SauTipoExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauRequisito" (
    "id" SERIAL NOT NULL,
    "pcmsoFuncaoId" INTEGER NOT NULL,
    "tipoExameId" INTEGER NOT NULL,
    "periodicidade" TEXT NOT NULL,
    "periodicidadeDetalhe" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "origemPagina" INTEGER,
    "origemTrecho" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MANUAL',
    "analiseId" INTEGER,
    "criadoPorId" INTEGER,
    "aprovadoPorId" INTEGER,
    "aprovadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SauRequisito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauPcmsoAnalise" (
    "id" SERIAL NOT NULL,
    "pcmsoVersaoId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "resultadoBruto" JSONB,
    "resultadoEstruturado" JSONB,
    "confiancaGeral" DOUBLE PRECISION,
    "erro" TEXT,
    "solicitadoPorId" INTEGER,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "SauPcmsoAnalise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAso" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "alocacaoId" INTEGER,
    "tipo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "funcaoDeclarada" TEXT,
    "resultadoDeclarado" TEXT,
    "medicoNome" TEXT,
    "medicoCrm" TEXT,
    "documentoId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_REVISAO',
    "confirmadoPorId" INTEGER,
    "confirmadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SauAso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAsoAnalise" (
    "id" SERIAL NOT NULL,
    "asoId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "resultadoBruto" JSONB,
    "resultadoEstruturado" JSONB,
    "confianca" JSONB,
    "erro" TEXT,
    "solicitadoPorId" INTEGER,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "SauAsoAnalise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauExame" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "tipoExameId" INTEGER NOT NULL,
    "dataRealizacao" TIMESTAMP(3) NOT NULL,
    "dataValidade" TIMESTAMP(3),
    "resultadoDocumental" TEXT,
    "laboratorio" TEXT,
    "profissional" TEXT,
    "documentoId" INTEGER,
    "origem" TEXT NOT NULL,
    "asoOrigemId" INTEGER,
    "observacoes" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SauExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauChecklistLiberacao" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "alocacaoId" INTEGER,
    "statusGeral" TEXT NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculadoPorId" INTEGER,

    CONSTRAINT "SauChecklistLiberacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauChecklistItem" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "exigencia" TEXT,
    "requisitoId" INTEGER,
    "exameId" INTEGER,
    "asoId" INTEGER,
    "dataRegistro" TIMESTAMP(3),
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "documentoRelacionadoId" INTEGER,

    CONSTRAINT "SauChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAlerta" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "unidadeId" INTEGER,
    "pcmsoVersaoId" INTEGER,
    "exameId" INTEGER,
    "asoId" INTEGER,
    "prazoEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),
    "resolvidoPorId" INTEGER,

    CONSTRAINT "SauAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAlertaRegra" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SauAlertaRegra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauDocumento" (
    "id" SERIAL NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "hash" TEXT,
    "categoria" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "unidadeId" INTEGER,
    "uploadedById" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauDocumentoAcesso" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "acessadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauDocumentoAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauAuditoria" (
    "id" SERIAL NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "userId" INTEGER,
    "antes" JSONB,
    "depois" JSONB,
    "detalhes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SauUserAccess_userId_key" ON "SauUserAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SauUserPermission_userId_chave_key" ON "SauUserPermission"("userId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "SauFuncionario_matricula_key" ON "SauFuncionario"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "SauFuncionario_cpf_key" ON "SauFuncionario"("cpf");

-- CreateIndex
CREATE INDEX "SauFuncionario_nome_idx" ON "SauFuncionario"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SauCliente_nome_key" ON "SauCliente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SauUnidade_clienteId_nome_key" ON "SauUnidade"("clienteId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "SauFuncao_nome_key" ON "SauFuncao"("nome");

-- CreateIndex
CREATE INDEX "SauAlocacao_funcionarioId_status_idx" ON "SauAlocacao"("funcionarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SauPcmsoVersao_documentoId_key" ON "SauPcmsoVersao"("documentoId");

-- CreateIndex
CREATE INDEX "SauPcmsoVersao_unidadeId_status_idx" ON "SauPcmsoVersao"("unidadeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SauPcmsoFuncao_pcmsoVersaoId_funcaoId_key" ON "SauPcmsoFuncao"("pcmsoVersaoId", "funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "SauRisco_nome_key" ON "SauRisco"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SauPcmsoFuncaoRisco_pcmsoFuncaoId_riscoId_key" ON "SauPcmsoFuncaoRisco"("pcmsoFuncaoId", "riscoId");

-- CreateIndex
CREATE UNIQUE INDEX "SauTipoExame_nome_key" ON "SauTipoExame"("nome");

-- CreateIndex
CREATE INDEX "SauRequisito_pcmsoFuncaoId_status_idx" ON "SauRequisito"("pcmsoFuncaoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SauAso_documentoId_key" ON "SauAso"("documentoId");

-- CreateIndex
CREATE INDEX "SauAso_funcionarioId_tipo_idx" ON "SauAso"("funcionarioId", "tipo");

-- CreateIndex
CREATE INDEX "SauExame_funcionarioId_tipoExameId_dataValidade_idx" ON "SauExame"("funcionarioId", "tipoExameId", "dataValidade");

-- CreateIndex
CREATE UNIQUE INDEX "SauChecklistLiberacao_funcionarioId_unidadeId_funcaoId_key" ON "SauChecklistLiberacao"("funcionarioId", "unidadeId", "funcaoId");

-- CreateIndex
CREATE INDEX "SauAlerta_tipo_status_idx" ON "SauAlerta"("tipo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SauAlertaRegra_tipo_dias_key" ON "SauAlertaRegra"("tipo", "dias");

-- CreateIndex
CREATE INDEX "SauDocumento_categoria_idx" ON "SauDocumento"("categoria");

-- CreateIndex
CREATE INDEX "SauDocumentoAcesso_documentoId_acessadoEm_idx" ON "SauDocumentoAcesso"("documentoId", "acessadoEm");

-- CreateIndex
CREATE INDEX "SauAuditoria_entidade_entidadeId_idx" ON "SauAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "SauAuditoria_createdAt_idx" ON "SauAuditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "SauUserAccess" ADD CONSTRAINT "SauUserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauUserAccess" ADD CONSTRAINT "SauUserAccess_concedidoPorId_fkey" FOREIGN KEY ("concedidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauUserPermission" ADD CONSTRAINT "SauUserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauFuncionario" ADD CONSTRAINT "SauFuncionario_funcaoPrincipalId_fkey" FOREIGN KEY ("funcaoPrincipalId") REFERENCES "SauFuncao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauUnidade" ADD CONSTRAINT "SauUnidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "SauCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlocacao" ADD CONSTRAINT "SauAlocacao_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlocacao" ADD CONSTRAINT "SauAlocacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "SauCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlocacao" ADD CONSTRAINT "SauAlocacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "SauUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlocacao" ADD CONSTRAINT "SauAlocacao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "SauFuncao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlocacao" ADD CONSTRAINT "SauAlocacao_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoVersao" ADD CONSTRAINT "SauPcmsoVersao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "SauUnidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoVersao" ADD CONSTRAINT "SauPcmsoVersao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "SauDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoVersao" ADD CONSTRAINT "SauPcmsoVersao_responsavelCadastroId_fkey" FOREIGN KEY ("responsavelCadastroId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoFuncao" ADD CONSTRAINT "SauPcmsoFuncao_pcmsoVersaoId_fkey" FOREIGN KEY ("pcmsoVersaoId") REFERENCES "SauPcmsoVersao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoFuncao" ADD CONSTRAINT "SauPcmsoFuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "SauFuncao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoFuncaoRisco" ADD CONSTRAINT "SauPcmsoFuncaoRisco_pcmsoFuncaoId_fkey" FOREIGN KEY ("pcmsoFuncaoId") REFERENCES "SauPcmsoFuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoFuncaoRisco" ADD CONSTRAINT "SauPcmsoFuncaoRisco_riscoId_fkey" FOREIGN KEY ("riscoId") REFERENCES "SauRisco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauRequisito" ADD CONSTRAINT "SauRequisito_pcmsoFuncaoId_fkey" FOREIGN KEY ("pcmsoFuncaoId") REFERENCES "SauPcmsoFuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauRequisito" ADD CONSTRAINT "SauRequisito_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES "SauTipoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauRequisito" ADD CONSTRAINT "SauRequisito_analiseId_fkey" FOREIGN KEY ("analiseId") REFERENCES "SauPcmsoAnalise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauRequisito" ADD CONSTRAINT "SauRequisito_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauRequisito" ADD CONSTRAINT "SauRequisito_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoAnalise" ADD CONSTRAINT "SauPcmsoAnalise_pcmsoVersaoId_fkey" FOREIGN KEY ("pcmsoVersaoId") REFERENCES "SauPcmsoVersao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauPcmsoAnalise" ADD CONSTRAINT "SauPcmsoAnalise_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAso" ADD CONSTRAINT "SauAso_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAso" ADD CONSTRAINT "SauAso_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "SauAlocacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAso" ADD CONSTRAINT "SauAso_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "SauDocumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAso" ADD CONSTRAINT "SauAso_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAsoAnalise" ADD CONSTRAINT "SauAsoAnalise_asoId_fkey" FOREIGN KEY ("asoId") REFERENCES "SauAso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAsoAnalise" ADD CONSTRAINT "SauAsoAnalise_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauExame" ADD CONSTRAINT "SauExame_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauExame" ADD CONSTRAINT "SauExame_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES "SauTipoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauExame" ADD CONSTRAINT "SauExame_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "SauDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauExame" ADD CONSTRAINT "SauExame_asoOrigemId_fkey" FOREIGN KEY ("asoOrigemId") REFERENCES "SauAso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauExame" ADD CONSTRAINT "SauExame_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistLiberacao" ADD CONSTRAINT "SauChecklistLiberacao_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistLiberacao" ADD CONSTRAINT "SauChecklistLiberacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "SauUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistLiberacao" ADD CONSTRAINT "SauChecklistLiberacao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "SauFuncao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistLiberacao" ADD CONSTRAINT "SauChecklistLiberacao_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "SauAlocacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistLiberacao" ADD CONSTRAINT "SauChecklistLiberacao_calculadoPorId_fkey" FOREIGN KEY ("calculadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistItem" ADD CONSTRAINT "SauChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "SauChecklistLiberacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistItem" ADD CONSTRAINT "SauChecklistItem_requisitoId_fkey" FOREIGN KEY ("requisitoId") REFERENCES "SauRequisito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistItem" ADD CONSTRAINT "SauChecklistItem_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "SauExame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistItem" ADD CONSTRAINT "SauChecklistItem_asoId_fkey" FOREIGN KEY ("asoId") REFERENCES "SauAso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauChecklistItem" ADD CONSTRAINT "SauChecklistItem_documentoRelacionadoId_fkey" FOREIGN KEY ("documentoRelacionadoId") REFERENCES "SauDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "SauUnidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_pcmsoVersaoId_fkey" FOREIGN KEY ("pcmsoVersaoId") REFERENCES "SauPcmsoVersao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "SauExame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_asoId_fkey" FOREIGN KEY ("asoId") REFERENCES "SauAso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAlerta" ADD CONSTRAINT "SauAlerta_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauDocumento" ADD CONSTRAINT "SauDocumento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "SauFuncionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauDocumento" ADD CONSTRAINT "SauDocumento_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "SauUnidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauDocumento" ADD CONSTRAINT "SauDocumento_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauDocumentoAcesso" ADD CONSTRAINT "SauDocumentoAcesso_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "SauDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauDocumentoAcesso" ADD CONSTRAINT "SauDocumentoAcesso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SauAuditoria" ADD CONSTRAINT "SauAuditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
