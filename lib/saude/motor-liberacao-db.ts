import { prisma } from "@/lib/prisma";
import {
  calcularChecklist,
  type RequisitoInput,
  type ExameInput,
  type AsoInput,
  type StatusGeral,
  type ChecklistItemResult,
} from "@/lib/saude/motor-liberacao";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export interface MotorResultado {
  funcionarioId: number;
  unidadeId: number;
  funcaoId: number;
  alocacaoId: number | null;
  statusGeral: StatusGeral;
  itens: ChecklistItemResult[];
  pcmsoVersaoId: number | null;
  motivoGeral: string | null;
}

/**
 * Busca o PCMSO vigente, os requisitos aprovados, os exames e o ASO do funcionário, roda o
 * núcleo puro (lib/saude/motor-liberacao.ts) e persiste o resultado em SauChecklistLiberacao —
 * chamado sempre que algo que afeta a situação do funcionário muda (seção 43): novo exame, novo
 * ASO confirmado, PCMSO publicado, nova alocação, correção manual de requisito. Nunca duplicar
 * esta lógica em várias telas — qualquer recálculo passa por aqui.
 */
export async function calcularELiberarFuncionario(params: {
  funcionarioId: number;
  unidadeId: number;
  funcaoId: number;
  dataReferencia?: Date;
  calculadoPorId?: number | null;
}): Promise<MotorResultado> {
  const dataReferencia = params.dataReferencia ?? new Date();

  const alocacao = await prisma.sauAlocacao.findFirst({
    where: { funcionarioId: params.funcionarioId, unidadeId: params.unidadeId, funcaoId: params.funcaoId },
    orderBy: { dataInicio: "desc" },
  });

  const pcmsoVersao = await prisma.sauPcmsoVersao.findFirst({
    where: {
      unidadeId: params.unidadeId,
      status: "ATIVO",
      inicioVigencia: { lte: dataReferencia },
      OR: [{ fimVigencia: null }, { fimVigencia: { gte: dataReferencia } }],
    },
    orderBy: { inicioVigencia: "desc" },
  });

  let resultado: { statusGeral: StatusGeral; itens: ChecklistItemResult[] };
  let pcmsoVersaoId: number | null = null;
  let motivoGeral: string | null = null;

  if (!pcmsoVersao) {
    resultado = {
      statusGeral: "NAO_LIBERADO",
      itens: [
        {
          tipo: "EXAME",
          descricao: "PCMSO",
          exigencia: "Obrigatório",
          requisitoId: null,
          exameId: null,
          asoId: null,
          dataRegistro: null,
          prazo: null,
          status: "PENDENTE",
          motivo: "Nenhum PCMSO vigente encontrado para esta unidade na data de referência.",
          documentoRelacionadoId: null,
        },
      ],
    };
    motivoGeral = "PCMSO não vigente para esta unidade.";
  } else {
    const pcmsoFuncao = await prisma.sauPcmsoFuncao.findUnique({
      where: { pcmsoVersaoId_funcaoId: { pcmsoVersaoId: pcmsoVersao.id, funcaoId: params.funcaoId } },
      include: { requisitos: { where: { status: { in: ["APROVADO", "MANUAL"] } }, include: { tipoExame: true } } },
    });

    pcmsoVersaoId = pcmsoVersao.id;

    if (!pcmsoFuncao) {
      resultado = {
        statusGeral: "REVISAO_NECESSARIA",
        itens: [
          {
            tipo: "EXAME",
            descricao: "Função no PCMSO",
            exigencia: "Obrigatório",
            requisitoId: null,
            exameId: null,
            asoId: null,
            dataRegistro: null,
            prazo: null,
            status: "EM_ANALISE",
            motivo: "Esta função não consta na matriz do PCMSO vigente desta unidade — revisão necessária.",
            documentoRelacionadoId: null,
          },
        ],
      };
      motivoGeral = "Função não coberta pelo PCMSO vigente.";
    } else {
      const requisitos: RequisitoInput[] = pcmsoFuncao.requisitos.map((r) => ({
        requisitoId: r.id,
        tipoExameId: r.tipoExameId,
        tipoExameNome: r.tipoExame.nome,
        obrigatorio: r.obrigatorio,
        pcmsoVersaoId: pcmsoVersao.id,
        origemPagina: r.origemPagina,
        origemTrecho: r.origemTrecho,
      }));

      const tipoExameIds = [...new Set(requisitos.map((r) => r.tipoExameId))];

      const examesRows = tipoExameIds.length
        ? await prisma.sauExame.findMany({ where: { funcionarioId: params.funcionarioId, tipoExameId: { in: tipoExameIds } } })
        : [];
      const exames: ExameInput[] = examesRows.map((e) => ({
        exameId: e.id,
        tipoExameId: e.tipoExameId,
        dataRealizacao: e.dataRealizacao,
        dataValidade: e.dataValidade,
        documentoId: e.documentoId,
      }));

      const asoRow = await prisma.sauAso.findFirst({
        where: { funcionarioId: params.funcionarioId, status: "CONFIRMADO", ...(alocacao ? { alocacaoId: alocacao.id } : {}) },
        orderBy: { data: "desc" },
      });
      const asoMaisRecente: AsoInput | null = asoRow ? { asoId: asoRow.id, data: asoRow.data, documentoId: asoRow.documentoId } : null;

      resultado = calcularChecklist({ requisitos, exames, asoMaisRecente, dataReferencia });
    }
  }

  const anterior = await prisma.sauChecklistLiberacao.findUnique({
    where: { funcionarioId_unidadeId_funcaoId: { funcionarioId: params.funcionarioId, unidadeId: params.unidadeId, funcaoId: params.funcaoId } },
  });

  const checklist = await prisma.$transaction(async (tx) => {
    const salvo = await tx.sauChecklistLiberacao.upsert({
      where: { funcionarioId_unidadeId_funcaoId: { funcionarioId: params.funcionarioId, unidadeId: params.unidadeId, funcaoId: params.funcaoId } },
      create: {
        funcionarioId: params.funcionarioId,
        unidadeId: params.unidadeId,
        funcaoId: params.funcaoId,
        alocacaoId: alocacao?.id ?? null,
        statusGeral: resultado.statusGeral,
        calculadoPorId: params.calculadoPorId ?? null,
      },
      update: {
        alocacaoId: alocacao?.id ?? null,
        statusGeral: resultado.statusGeral,
        calculadoEm: new Date(),
        calculadoPorId: params.calculadoPorId ?? null,
      },
    });

    await tx.sauChecklistItem.deleteMany({ where: { checklistId: salvo.id } });
    await tx.sauChecklistItem.createMany({
      data: resultado.itens.map((item) => ({
        checklistId: salvo.id,
        tipo: item.tipo,
        descricao: item.descricao,
        exigencia: item.exigencia,
        requisitoId: item.requisitoId,
        exameId: item.exameId,
        asoId: item.asoId,
        dataRegistro: item.dataRegistro,
        prazo: item.prazo,
        status: item.status,
        motivo: item.motivo,
        documentoRelacionadoId: item.documentoRelacionadoId,
      })),
    });

    return salvo;
  });

  if (!anterior || anterior.statusGeral !== resultado.statusGeral) {
    await registrarAuditoria({
      entidade: "SauChecklistLiberacao",
      entidadeId: checklist.id,
      acao: "RECALCULOU",
      userId: params.calculadoPorId ?? null,
      antes: anterior ? { statusGeral: anterior.statusGeral } : null,
      depois: { statusGeral: resultado.statusGeral },
    });
  }

  return {
    funcionarioId: params.funcionarioId,
    unidadeId: params.unidadeId,
    funcaoId: params.funcaoId,
    alocacaoId: alocacao?.id ?? null,
    statusGeral: resultado.statusGeral,
    itens: resultado.itens,
    pcmsoVersaoId,
    motivoGeral,
  };
}
