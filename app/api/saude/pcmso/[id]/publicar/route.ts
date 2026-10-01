import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { calcularELiberarFuncionario } from "@/lib/saude/motor-liberacao-db";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Publica uma versão de PCMSO: a partir daqui suas linhas (MANUAL nesta etapa; SUGERIDO_IA
 * revisadas a partir da Etapa 07) passam a valer pro motor de liberação. A versão ATIVO anterior
 * da mesma unidade (se houver) é encerrada — fimVigencia = início de vigência da nova, status
 * SUBSTITUIDO — nunca apagada (seção 8: a situação de um funcionário numa data passada continua
 * reconstruível pela versão que estava vigente naquele momento).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.approve");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });

  const versao = await prisma.sauPcmsoVersao.findUnique({ where: { id } });
  if (!versao) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });
  if (versao.status === "ATIVO") {
    return NextResponse.json({ error: "Esta versão já está publicada." }, { status: 400 });
  }

  const vigente = await prisma.sauPcmsoVersao.findFirst({
    where: { unidadeId: versao.unidadeId, status: "ATIVO", id: { not: id } },
  });

  const atualizado = await prisma.$transaction(async (tx) => {
    if (vigente) {
      await tx.sauPcmsoVersao.update({
        where: { id: vigente.id },
        data: { status: "SUBSTITUIDO", fimVigencia: vigente.fimVigencia ?? versao.inicioVigencia },
      });
    }
    return tx.sauPcmsoVersao.update({ where: { id }, data: { status: "ATIVO" } });
  });

  await registrarAuditoria({
    entidade: "SauPcmsoVersao",
    entidadeId: id,
    acao: "PUBLICOU",
    userId: auth.user.id,
    antes: vigente ? { versaoSubstituidaId: vigente.id } : null,
    depois: { status: "ATIVO" },
  });

  // Seção 44: publicar um PCMSO pode mudar a situação de quem já trabalha nesta unidade —
  // recalcula todo mundo com alocação ativa aqui, não só quem for olhar a ficha depois.
  const alocados = await prisma.sauAlocacao.findMany({
    where: { unidadeId: versao.unidadeId, status: "ATIVA" },
    distinct: ["funcionarioId", "funcaoId"],
    select: { funcionarioId: true, funcaoId: true },
  });
  await Promise.all(
    alocados.map((a) =>
      calcularELiberarFuncionario({
        funcionarioId: a.funcionarioId,
        unidadeId: versao.unidadeId,
        funcaoId: a.funcaoId,
        calculadoPorId: auth.user.id,
      })
    )
  );

  return NextResponse.json(atualizado);
}
