import { prisma } from "@/lib/prisma";

/** Usado quando não há SauAlertaRegra cadastrada pra um tipo — mesmos valores de exemplo da
 *  especificação (seção 27). Configurável depois via /saude/configuracoes sem mudar código. */
const DIAS_PADRAO = [90, 60, 30, 15, 7];

function diasAte(data: Date, referencia: Date): number {
  return Math.floor((data.getTime() - referencia.getTime()) / (1000 * 60 * 60 * 24));
}

async function diasRegra(tipo: string): Promise<number[]> {
  const regras = await prisma.sauAlertaRegra.findMany({ where: { tipo, ativo: true } });
  return regras.length > 0 ? regras.map((r) => r.dias) : DIAS_PADRAO;
}

/**
 * Garante que exista (ou não) um alerta ABERTO para uma entidade, de acordo com o estado atual
 * — cria quando precisa, atualiza o prazo quando já existe, resolve sozinho quando a situação
 * deixou de se aplicar (exame renovado, PCMSO trocado...). Chave de "mesma entidade" é o campo
 * de referência (exameId, pcmsoVersaoId ou funcionarioId) + tipo-base (ignora VENCENDO vs
 * VENCIDO ao procurar o alerta existente, pra trocar de um pro outro sem duplicar linha).
 */
async function sincronizarAlerta(params: {
  tipoDesejado: string | null;
  tiposRelacionados: string[];
  prazoEm: Date | null;
  where: { exameId?: number; pcmsoVersaoId?: number; funcionarioId?: number; unidadeId?: number };
}): Promise<void> {
  const existente = await prisma.sauAlerta.findFirst({
    where: { tipo: { in: params.tiposRelacionados }, status: "ABERTO", ...params.where },
  });

  if (!params.tipoDesejado) {
    if (existente) {
      await prisma.sauAlerta.update({ where: { id: existente.id }, data: { status: "RESOLVIDO", resolvidoEm: new Date() } });
    }
    return;
  }

  if (existente && existente.tipo === params.tipoDesejado) {
    await prisma.sauAlerta.update({ where: { id: existente.id }, data: { prazoEm: params.prazoEm } });
    return;
  }

  if (existente) {
    await prisma.sauAlerta.update({ where: { id: existente.id }, data: { status: "RESOLVIDO", resolvidoEm: new Date() } });
  }

  await prisma.sauAlerta.create({ data: { tipo: params.tipoDesejado, prazoEm: params.prazoEm, ...params.where } });
}

/**
 * Recalcula todos os alertas do módulo sob demanda (seção 27) — chamado ao abrir /saude/alertas
 * e no dashboard. Não há infraestrutura de job/cron neste projeto (ver outras partes do app),
 * então "sob demanda" é a mesma estratégia já usada pelo motor de liberação.
 */
export async function recalcularAlertas(): Promise<void> {
  const hoje = new Date();

  const [diasExameVencendo, diasPcmsoVencendo] = await Promise.all([diasRegra("EXAME_VENCENDO"), diasRegra("PCMSO_VENCENDO")]);
  const maxExame = Math.max(...diasExameVencendo);
  const maxPcmso = Math.max(...diasPcmsoVencendo);

  const exames = await prisma.sauExame.findMany({ where: { dataValidade: { not: null } } });
  for (const exame of exames) {
    if (!exame.dataValidade) continue;
    const dias = diasAte(exame.dataValidade, hoje);
    const tipoDesejado = dias < 0 ? "EXAME_VENCIDO" : dias <= maxExame ? "EXAME_VENCENDO" : null;
    await sincronizarAlerta({
      tipoDesejado,
      tiposRelacionados: ["EXAME_VENCENDO", "EXAME_VENCIDO"],
      prazoEm: exame.dataValidade,
      where: { exameId: exame.id, funcionarioId: exame.funcionarioId },
    });
  }

  const pcmsoAtivos = await prisma.sauPcmsoVersao.findMany({ where: { status: "ATIVO", fimVigencia: { not: null } } });
  for (const versao of pcmsoAtivos) {
    if (!versao.fimVigencia) continue;
    const dias = diasAte(versao.fimVigencia, hoje);
    const tipoDesejado = dias < 0 ? "PCMSO_VENCIDO" : dias <= maxPcmso ? "PCMSO_VENCENDO" : null;
    await sincronizarAlerta({
      tipoDesejado,
      tiposRelacionados: ["PCMSO_VENCENDO", "PCMSO_VENCIDO"],
      prazoEm: versao.fimVigencia,
      where: { pcmsoVersaoId: versao.id, unidadeId: versao.unidadeId },
    });
  }

  const checklists = await prisma.sauChecklistLiberacao.findMany({ where: { statusGeral: "NAO_LIBERADO" } });
  const funcionariosComPendencia = new Set(checklists.map((c) => c.funcionarioId));
  const todosFuncionariosComChecklist = await prisma.sauChecklistLiberacao.findMany({ distinct: ["funcionarioId"], select: { funcionarioId: true } });
  for (const { funcionarioId } of todosFuncionariosComChecklist) {
    await sincronizarAlerta({
      tipoDesejado: funcionariosComPendencia.has(funcionarioId) ? "FUNCIONARIO_PENDENTE" : null,
      tiposRelacionados: ["FUNCIONARIO_PENDENTE"],
      prazoEm: null,
      where: { funcionarioId },
    });
  }
}
