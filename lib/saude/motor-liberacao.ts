/**
 * Núcleo puro do motor de liberação (seção 20-23 da especificação) — compara o que o PCMSO
 * exige com o que o funcionário já tem e decide a situação. Dependency-free (sem Prisma) de
 * propósito, mesmo padrão de lib/forum-access.ts: quem busca os dados é
 * lib/saude/motor-liberacao-db.ts, o que deixa esta função testável com objetos simples, sem
 * banco — e é exatamente essa lógica (quem fica LIBERADO ou NÃO LIBERADO) que mais merece testes
 * diretos, por decidir se alguém pode ou não trabalhar num cliente.
 */

export type ItemStatus = "REGULAR" | "ATENCAO" | "PENDENTE" | "VENCIDO" | "NAO_APLICAVEL" | "EM_ANALISE";
export type StatusGeral = "LIBERADO" | "LIBERADO_ATENCAO" | "NAO_LIBERADO" | "REVISAO_NECESSARIA";

export const DIAS_ATENCAO_PADRAO = 30;

export interface RequisitoInput {
  requisitoId: number;
  tipoExameId: number;
  tipoExameNome: string;
  obrigatorio: boolean;
  /** Rastreabilidade (seção 36/45) — de onde veio a exigência. */
  pcmsoVersaoId: number;
  origemPagina: number | null;
  origemTrecho: string | null;
}

export interface ExameInput {
  exameId: number;
  tipoExameId: number;
  dataRealizacao: Date;
  dataValidade: Date | null;
  documentoId: number | null;
}

export interface AsoInput {
  asoId: number;
  data: Date;
  documentoId: number | null;
}

export interface ChecklistItemResult {
  tipo: "ASO" | "EXAME";
  descricao: string;
  exigencia: string | null;
  requisitoId: number | null;
  exameId: number | null;
  asoId: number | null;
  dataRegistro: Date | null;
  prazo: Date | null;
  status: ItemStatus;
  motivo: string;
  documentoRelacionadoId: number | null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

/** Escolhe, entre os exames de um tipo, o mais recente (maior dataRealizacao) — é esse que vale. */
function maisRecente(exames: ExameInput[]): ExameInput | null {
  if (exames.length === 0) return null;
  return exames.reduce((a, b) => (b.dataRealizacao > a.dataRealizacao ? b : a));
}

function avaliarExame(req: RequisitoInput, exame: ExameInput | null, dataReferencia: Date, diasAtencao: number): ChecklistItemResult {
  const base = {
    tipo: "EXAME" as const,
    descricao: req.tipoExameNome,
    exigencia: req.obrigatorio ? "Obrigatório" : "Recomendado",
    requisitoId: req.requisitoId,
    exameId: exame?.exameId ?? null,
    asoId: null,
  };

  if (!exame) {
    return { ...base, dataRegistro: null, prazo: null, status: "PENDENTE", motivo: "Não localizado.", documentoRelacionadoId: null };
  }

  if (!exame.dataValidade) {
    return {
      ...base,
      dataRegistro: exame.dataRealizacao,
      prazo: null,
      status: "REGULAR",
      motivo: `Realizado em ${formatDate(exame.dataRealizacao)}, sem validade definida.`,
      documentoRelacionadoId: exame.documentoId,
    };
  }

  const diasParaVencer = Math.floor((exame.dataValidade.getTime() - dataReferencia.getTime()) / (1000 * 60 * 60 * 24));

  if (diasParaVencer < 0) {
    return {
      ...base,
      dataRegistro: exame.dataRealizacao,
      prazo: exame.dataValidade,
      status: "VENCIDO",
      motivo: `Venceu em ${formatDate(exame.dataValidade)}.`,
      documentoRelacionadoId: exame.documentoId,
    };
  }

  if (diasParaVencer <= diasAtencao) {
    return {
      ...base,
      dataRegistro: exame.dataRealizacao,
      prazo: exame.dataValidade,
      status: "ATENCAO",
      motivo: `Vence em ${formatDate(exame.dataValidade)} (${diasParaVencer} dia(s)).`,
      documentoRelacionadoId: exame.documentoId,
    };
  }

  return {
    ...base,
    dataRegistro: exame.dataRealizacao,
    prazo: exame.dataValidade,
    status: "REGULAR",
    motivo: `Válido até ${formatDate(exame.dataValidade)}.`,
    documentoRelacionadoId: exame.documentoId,
  };
}

/**
 * O ASO em si não tem, hoje, uma regra de periodicidade modelada na matriz do PCMSO (seção 19
 * não cobre isso explicitamente) — por ora o item só confere que existe um ASO confirmado
 * vinculado à alocação atual. Fica marcado como uma simplificação conhecida, não como regra
 * definitiva: dá pra evoluir pra comparar contra a periodicidade quando isso for modelado.
 */
function avaliarAso(aso: AsoInput | null): ChecklistItemResult {
  if (!aso) {
    return {
      tipo: "ASO",
      descricao: "ASO",
      exigencia: "Obrigatório",
      requisitoId: null,
      exameId: null,
      asoId: null,
      dataRegistro: null,
      prazo: null,
      status: "PENDENTE",
      motivo: "Não localizado para esta alocação.",
      documentoRelacionadoId: null,
    };
  }

  return {
    tipo: "ASO",
    descricao: "ASO",
    exigencia: "Obrigatório",
    requisitoId: null,
    exameId: null,
    asoId: aso.asoId,
    dataRegistro: aso.data,
    prazo: null,
    status: "REGULAR",
    motivo: `Confirmado em ${formatDate(aso.data)}.`,
    documentoRelacionadoId: aso.documentoId,
  };
}

/**
 * Agrega os itens num status geral (seção 22-23). EM_ANALISE sempre vence (precisa de revisão
 * humana antes de qualquer outra coisa); depois, qualquer item obrigatório PENDENTE/VENCIDO
 * bloqueia; item opcional PENDENTE/VENCIDO ou qualquer ATENÇÃO rebaixa pra "com atenção"; só
 * tudo REGULAR é LIBERADO puro.
 */
export function agregarStatusGeral(itens: ChecklistItemResult[]): StatusGeral {
  if (itens.some((i) => i.status === "EM_ANALISE")) return "REVISAO_NECESSARIA";

  const bloqueante = itens.some((i) => i.exigencia === "Obrigatório" && (i.status === "PENDENTE" || i.status === "VENCIDO"));
  if (bloqueante) return "NAO_LIBERADO";

  const atencao = itens.some((i) => i.status === "ATENCAO" || ((i.status === "PENDENTE" || i.status === "VENCIDO") && i.exigencia !== "Obrigatório"));
  if (atencao) return "LIBERADO_ATENCAO";

  return "LIBERADO";
}

export interface CalcularChecklistInput {
  requisitos: RequisitoInput[];
  exames: ExameInput[];
  asoMaisRecente: AsoInput | null;
  dataReferencia: Date;
  diasAtencao?: number;
}

export interface CalcularChecklistResult {
  statusGeral: StatusGeral;
  itens: ChecklistItemResult[];
}

export function calcularChecklist(input: CalcularChecklistInput): CalcularChecklistResult {
  const diasAtencao = input.diasAtencao ?? DIAS_ATENCAO_PADRAO;

  const itensExame = input.requisitos.map((req) => {
    const examesDoTipo = input.exames.filter((e) => e.tipoExameId === req.tipoExameId);
    return avaliarExame(req, maisRecente(examesDoTipo), input.dataReferencia, diasAtencao);
  });

  const itens = [avaliarAso(input.asoMaisRecente), ...itensExame];

  return { statusGeral: agregarStatusGeral(itens), itens };
}
