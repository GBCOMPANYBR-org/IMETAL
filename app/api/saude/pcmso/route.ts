import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { pcmsoVersaoCreateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.view");
  if ("error" in auth) return auth.error;

  const versoes = await prisma.sauPcmsoVersao.findMany({
    include: { unidade: { include: { cliente: true } } },
    orderBy: [{ unidadeId: "asc" }, { inicioVigencia: "desc" }],
  });

  return NextResponse.json(versoes);
}

/**
 * Registra uma versão de PCMSO cujo arquivo já foi enviado direto ao Blob pelo navegador (ver
 * /api/saude/blob/upload) — aqui só criamos o SauDocumento (referência controlada, nunca a URL
 * crua do blob exposta ao cliente dali em diante) e o SauPcmsoVersao em si, como
 * AGUARDANDO_REVISAO: sem leitura por IA ainda (Etapa 07), a montagem da matriz é toda manual
 * nesta etapa.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.upload");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = pcmsoVersaoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const unidade = await prisma.sauUnidade.findUnique({ where: { id: parsed.data.unidadeId } });
  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada." }, { status: 404 });

  const { blobUrl, filename, mimeType, size, ...versaoData } = parsed.data;

  const versao = await prisma.$transaction(async (tx) => {
    const documento = await tx.sauDocumento.create({
      data: {
        nomeOriginal: filename,
        storedPath: blobUrl,
        mimeType,
        tamanho: size,
        categoria: "PCMSO",
        unidadeId: parsed.data.unidadeId,
        uploadedById: auth.user.id,
      },
    });

    return tx.sauPcmsoVersao.create({
      data: {
        ...versaoData,
        documentoId: documento.id,
        responsavelCadastroId: auth.user.id,
        status: "AGUARDANDO_REVISAO",
      },
      include: { unidade: { include: { cliente: true } }, documento: true },
    });
  });

  await registrarAuditoria({
    entidade: "SauPcmsoVersao",
    entidadeId: versao.id,
    acao: "CRIOU",
    userId: auth.user.id,
    depois: { unidadeId: parsed.data.unidadeId, versao: parsed.data.versao },
  });

  return NextResponse.json(versao, { status: 201 });
}
