import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { alocacaoCreateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Cria uma nova alocação pro funcionário, encerrando a ativa anterior (se houver) em vez de
 * editá-la in-place — preserva o histórico completo (seção 6 da especificação). A alocação
 * anterior termina exatamente onde a nova começa.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const funcionario = await prisma.sauFuncionario.findUnique({ where: { id: funcionarioId } });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = alocacaoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const unidade = await prisma.sauUnidade.findUnique({ where: { id: parsed.data.unidadeId } });
  if (!unidade || unidade.clienteId !== parsed.data.clienteId) {
    return NextResponse.json({ error: "Unidade não pertence ao cliente selecionado." }, { status: 400 });
  }

  const funcao = await prisma.sauFuncao.findUnique({ where: { id: parsed.data.funcaoId } });
  if (!funcao) return NextResponse.json({ error: "Função não encontrada." }, { status: 404 });

  const alocacaoAnterior = await prisma.sauAlocacao.findFirst({
    where: { funcionarioId, status: "ATIVA" },
  });

  const nova = await prisma.$transaction(async (tx) => {
    if (alocacaoAnterior) {
      await tx.sauAlocacao.update({
        where: { id: alocacaoAnterior.id },
        data: { status: "ENCERRADA", dataFim: parsed.data.dataInicio },
      });
    }

    return tx.sauAlocacao.create({
      data: {
        funcionarioId,
        clienteId: parsed.data.clienteId,
        unidadeId: parsed.data.unidadeId,
        funcaoId: parsed.data.funcaoId,
        dataInicio: parsed.data.dataInicio,
        observacoes: parsed.data.observacoes,
        status: "ATIVA",
        createdById: auth.user.id,
      },
      include: { cliente: true, unidade: true, funcao: true },
    });
  });

  await registrarAuditoria({
    entidade: "SauAlocacao",
    entidadeId: nova.id,
    acao: "CRIOU",
    userId: auth.user.id,
    antes: alocacaoAnterior,
    depois: nova,
    detalhes: alocacaoAnterior ? `Encerrou a alocação ${alocacaoAnterior.id} e abriu uma nova.` : undefined,
  });

  return NextResponse.json(nova, { status: 201 });
}
