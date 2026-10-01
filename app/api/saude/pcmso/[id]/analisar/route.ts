import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { readSaudeFile } from "@/lib/saude/storage";
import { getAIService } from "@/lib/saude/ai/anthropic-service";
import { AIServiceNotConfiguredError } from "@/lib/saude/ai/service";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Leitura por IA do PCMSO (seção 9/10). A IA só sugere — toda função/risco/exame vira linha com
 * status SUGERIDO_IA, nunca entra na matriz como regra válida até alguém revisar e aprovar
 * (ver PATCH .../requisitos/[requisitoId] e POST .../publicar). Reprocessar (chamar de novo)
 * cria uma nova SauPcmsoAnalise e uma nova leva de sugestões — a análise anterior nunca é
 * apagada (seção 38).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });

  const versao = await prisma.sauPcmsoVersao.findUnique({ where: { id }, include: { documento: true } });
  if (!versao) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });
  if (!versao.documento) return NextResponse.json({ error: "Esta versão não tem documento anexado." }, { status: 400 });

  let bytes: Buffer;
  try {
    bytes = await readSaudeFile(versao.documento.storedPath);
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o documento original." }, { status: 500 });
  }

  const aiService = getAIService();

  let analise;
  try {
    const { result, model, raw } = await aiService.analyzePcmso({ bytes, mimeType: versao.documento.mimeType });

    analise = await prisma.$transaction(async (tx) => {
      const criada = await tx.sauPcmsoAnalise.create({
        data: {
          pcmsoVersaoId: id,
          provider: "anthropic",
          model,
          status: "CONCLUIDO",
          resultadoBruto: JSON.parse(JSON.stringify(raw)),
          resultadoEstruturado: JSON.parse(JSON.stringify(result)),
          confiancaGeral: result.confidence.overall ?? undefined,
          solicitadoPorId: auth.user.id,
          concluidoEm: new Date(),
        },
      });

      for (const func of result.functions) {
        let funcao = await tx.sauFuncao.findFirst({ where: { nome: { equals: func.name, mode: "insensitive" } } });
        if (!funcao) funcao = await tx.sauFuncao.create({ data: { nome: func.name, criadaVia: "IA" } });

        let pcmsoFuncao = await tx.sauPcmsoFuncao.findUnique({ where: { pcmsoVersaoId_funcaoId: { pcmsoVersaoId: id, funcaoId: funcao.id } } });
        if (!pcmsoFuncao) pcmsoFuncao = await tx.sauPcmsoFuncao.create({ data: { pcmsoVersaoId: id, funcaoId: funcao.id } });

        for (const riscoNome of func.risks) {
          let risco = await tx.sauRisco.findFirst({ where: { nome: { equals: riscoNome, mode: "insensitive" } } });
          if (!risco) risco = await tx.sauRisco.create({ data: { nome: riscoNome, criadoVia: "IA" } });

          const existeLink = await tx.sauPcmsoFuncaoRisco.findUnique({
            where: { pcmsoFuncaoId_riscoId: { pcmsoFuncaoId: pcmsoFuncao.id, riscoId: risco.id } },
          });
          if (!existeLink) await tx.sauPcmsoFuncaoRisco.create({ data: { pcmsoFuncaoId: pcmsoFuncao.id, riscoId: risco.id } });
        }

        for (const exame of func.exams) {
          let tipoExame = await tx.sauTipoExame.findFirst({ where: { nome: { equals: exame.name, mode: "insensitive" } } });
          if (!tipoExame) tipoExame = await tx.sauTipoExame.create({ data: { nome: exame.name, criadoVia: "IA" } });

          await tx.sauRequisito.create({
            data: {
              pcmsoFuncaoId: pcmsoFuncao.id,
              tipoExameId: tipoExame.id,
              periodicidade: exame.periodicity,
              periodicidadeDetalhe: exame.periodicityDetail,
              obrigatorio: exame.mandatory,
              origemPagina: exame.page,
              origemTrecho: exame.excerpt,
              status: "SUGERIDO_IA",
              analiseId: criada.id,
            },
          });
        }
      }

      if (versao.status === "EM_PROCESSAMENTO") {
        await tx.sauPcmsoVersao.update({ where: { id }, data: { status: "AGUARDANDO_REVISAO" } });
      }

      return criada;
    });
  } catch (error) {
    if (error instanceof AIServiceNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.sauPcmsoAnalise.create({
      data: { pcmsoVersaoId: id, provider: "anthropic", model: process.env.SAUDE_AI_MODEL || "claude-sonnet-5", status: "ERRO", erro: mensagem, solicitadoPorId: auth.user.id },
    });
    console.error("Erro na leitura de PCMSO por IA:", error);
    return NextResponse.json({ error: "Não foi possível concluir a leitura do documento. Tente novamente ou cadastre manualmente." }, { status: 502 });
  }

  await registrarAuditoria({ entidade: "SauPcmsoAnalise", entidadeId: analise.id, acao: "ANALISOU", userId: auth.user.id, depois: { pcmsoVersaoId: id } });

  return NextResponse.json(analise, { status: 201 });
}
