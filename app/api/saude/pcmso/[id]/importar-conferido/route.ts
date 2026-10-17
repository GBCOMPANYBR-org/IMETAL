import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { suggestedRoleSchema } from "@/lib/saude/ocr/pcmso";

const schema = z.object({ documentId: z.number().int().positive(), conferido: z.literal(true), funcao: suggestedRoleSchema });
class ImportError extends Error { constructor(message: string, public status: number) { super(message); } }

/** Uma função de cada vez, após conferência explícita. Nunca publica nem altera versão vigente. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 300000) { await reader.cancel(); return NextResponse.json({ error: "Dados acima do limite." }, { status: 413 }); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { body = null; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira a função, exames, intervalos e ocasiões antes de confirmar." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      const versao = await tx.sauPcmsoVersao.findUnique({ where: { id } });
      if (!versao) throw new ImportError("PCMSO não encontrado.", 404);
      if (versao.documentoId !== parsed.data.documentId) throw new ImportError("O documento mudou. Recarregue e faça nova leitura.", 409);
      if (!["EM_PROCESSAMENTO", "AGUARDANDO_REVISAO"].includes(versao.status)) throw new ImportError("Importe apenas em uma versão em revisão. Crie uma nova versão para alterar um PCMSO publicado.", 409);
      const draft = parsed.data.funcao;
      let funcao = await tx.sauFuncao.findFirst({ where: { nome: { equals: draft.nome, mode: "insensitive" } } });
      if (!funcao) funcao = await tx.sauFuncao.create({ data: { nome: draft.nome, criadaVia: "MANUAL" } });
      const row = await tx.sauPcmsoFuncao.upsert({ where: { pcmsoVersaoId_funcaoId: { pcmsoVersaoId: id, funcaoId: funcao.id } }, create: { pcmsoVersaoId: id, funcaoId: funcao.id }, update: {} });
      let added = 0, skipped = 0;
      for (const exam of draft.exames) {
        let tipo = await tx.sauTipoExame.findFirst({ where: { nome: { equals: exam.nome, mode: "insensitive" } } });
        if (!tipo) tipo = await tx.sauTipoExame.create({ data: { nome: exam.nome, criadoVia: "MANUAL" } });
        for (const ocasiao of new Set(exam.ocasioes)) {
          // Preserva cadastros existentes, inclusive divergências de intervalo e rejeições.
          const existing = await tx.sauRequisito.findFirst({ where: { pcmsoFuncaoId: row.id, tipoExameId: tipo.id, periodicidade: ocasiao } });
          if (existing) { skipped++; continue; }
          await tx.sauRequisito.create({ data: {
            pcmsoFuncaoId: row.id, tipoExameId: tipo.id, periodicidade: ocasiao,
            periodicidadeDetalhe: ocasiao === "PERIODICO" ? `${exam.meses} meses` : null,
            obrigatorio: true, status: "MANUAL", origemPagina: exam.pagina,
            origemTrecho: `Conferido a partir da tabela: ${exam.trecho}\nIntervalo na tabela: ${exam.meses} meses.`, criadoPorId: auth.user.id,
          } }); added++;
        }
      }
      await tx.sauAuditoria.create({ data: { entidade: "SauPcmsoFuncao", entidadeId: String(row.id), acao: "IMPORTOU_TABELA_CONFERIDA", userId: auth.user.id, depois: { documentId: parsed.data.documentId, pagina: draft.pagina, added, skipped } } });
      return { added, skipped, funcaoId: row.id };
    }, { isolationLevel: "Serializable", timeout: 20000 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && "code" in e && ["P2034", "P2002"].includes(String(e.code))) return NextResponse.json({ error: "Outro cadastro foi atualizado ao mesmo tempo. Tente confirmar novamente." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível salvar. Nenhuma alteração desta tentativa foi aplicada." }, { status: 500 });
  }
}
