import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { calcularELiberarFuncionario } from "@/lib/saude/motor-liberacao-db";

/**
 * Roda o motor sob demanda (não só lê o cache em SauChecklistLiberacao) — seção 25. Se
 * unidadeId/funcaoId não forem informados, usa a alocação ATIVA do funcionário.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("release.view");
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const funcionarioId = Number(url.searchParams.get("funcionarioId"));
  let unidadeId = Number(url.searchParams.get("unidadeId")) || null;
  let funcaoId = Number(url.searchParams.get("funcaoId")) || null;

  if (!Number.isInteger(funcionarioId) || funcionarioId <= 0) {
    return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });
  }

  const funcionario = await prisma.sauFuncionario.findUnique({ where: { id: funcionarioId } });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  if (!unidadeId || !funcaoId) {
    const ativa = await prisma.sauAlocacao.findFirst({ where: { funcionarioId, status: "ATIVA" } });
    if (!ativa) {
      return NextResponse.json({ error: "Funcionário não tem alocação ativa — informe unidade e função." }, { status: 400 });
    }
    unidadeId = ativa.unidadeId;
    funcaoId = ativa.funcaoId;
  }

  const unidade = await prisma.sauUnidade.findUnique({ where: { id: unidadeId }, include: { cliente: true } });
  const funcao = await prisma.sauFuncao.findUnique({ where: { id: funcaoId } });
  if (!unidade || !funcao) return NextResponse.json({ error: "Unidade ou função não encontrada." }, { status: 404 });

  const resultado = await calcularELiberarFuncionario({
    funcionarioId,
    unidadeId,
    funcaoId,
    calculadoPorId: auth.user.id,
  });

  const pcmsoVersao = resultado.pcmsoVersaoId
    ? await prisma.sauPcmsoVersao.findUnique({ where: { id: resultado.pcmsoVersaoId } })
    : null;

  return NextResponse.json({
    funcionario: { id: funcionario.id, nome: funcionario.nome },
    unidade: { id: unidade.id, nome: unidade.nome, cliente: { nome: unidade.cliente.nome } },
    funcao: { id: funcao.id, nome: funcao.nome },
    statusGeral: resultado.statusGeral,
    motivoGeral: resultado.motivoGeral,
    itens: resultado.itens,
    pcmsoVersao: pcmsoVersao ? { id: pcmsoVersao.id, versao: pcmsoVersao.versao } : null,
  });
}
