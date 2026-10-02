import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { epiMovimentoCreateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("epi.view");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const movimentos = await prisma.sauEpiMovimento.findMany({
    where: { funcionarioId },
    include: { tipo: true, documento: true, responsavel: { select: { id: true, name: true } }, substituiMovimento: true },
    orderBy: { dataMovimento: "desc" },
  });

  return NextResponse.json(movimentos);
}

/**
 * Entrega, troca ou devolução de EPI (NR-06). Nunca edita um movimento existente — cada
 * chamada cria uma linha nova; troca/devolução apontam (`substituiMovimentoId`) para o
 * movimento anterior que estão encerrando, mesmo princípio de "fechar e abrir de novo" usado
 * em SauAlocacao. CA e validade ficam no movimento (não no catálogo do tipo), porque podem
 * mudar de lote pra lote do mesmo EPI.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("epi.edit");
  if ("error" in auth) return auth.error;

  const funcionarioId = parseId((await params).id);
  if (funcionarioId === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const funcionario = await prisma.sauFuncionario.findUnique({ where: { id: funcionarioId } });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = epiMovimentoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { substituiMovimentoId, tipoMovimento } = parsed.data;

  let anterior: { ca: string; validadeCa: Date | null; lote: string | null; tipoId: number } | null = null;
  if (substituiMovimentoId) {
    const encontrado = await prisma.sauEpiMovimento.findUnique({
      where: { id: substituiMovimentoId },
      include: { substituidoPor: true },
    });
    if (!encontrado || encontrado.funcionarioId !== funcionarioId) {
      return NextResponse.json({ error: "Entrega/troca anterior não encontrada para este funcionário." }, { status: 400 });
    }
    if (encontrado.substituidoPor.length > 0) {
      return NextResponse.json({ error: "Esta entrega/troca já foi substituída por outro movimento." }, { status: 409 });
    }
    anterior = encontrado;
  }

  let tipoEpi = await prisma.sauEpiTipo.findFirst({
    where: { nome: { equals: parsed.data.tipoEpiNome, mode: "insensitive" } },
  });
  if (!tipoEpi) {
    tipoEpi = await prisma.sauEpiTipo.create({ data: { nome: parsed.data.tipoEpiNome } });
  }

  // Troca/devolução só podem encerrar um movimento do mesmo tipo de EPI — a tela já impede isso
  // desabilitando o campo, mas a API precisa garantir o mesmo pra quem chamar direto.
  if (anterior && anterior.tipoId !== tipoEpi.id) {
    return NextResponse.json({ error: "O tipo de EPI não bate com o movimento que está sendo substituído." }, { status: 400 });
  }

  const { tipoEpiNome, blobUrl, filename, mimeType, size, dataMovimento, ca, validadeCa, lote, ...resto } = parsed.data;

  // Devolução não introduz um CA novo — copia do movimento que está encerrando. Para
  // ENTREGA/TROCA, `ca` já vem garantido pelo zod (superRefine em lib/saude/validation.ts).
  const caFinal = tipoMovimento === "DEVOLUCAO" ? anterior!.ca : ca!;
  const validadeCaFinal = tipoMovimento === "DEVOLUCAO" ? anterior!.validadeCa : validadeCa;
  const loteFinal = tipoMovimento === "DEVOLUCAO" ? anterior!.lote : lote;

  const movimento = await runWithUniqueErrorHandling(
    () =>
      prisma.$transaction(async (tx) => {
        let documentoId: number | null = null;
        if (blobUrl && filename && mimeType && size !== undefined) {
          const documento = await tx.sauDocumento.create({
            data: { nomeOriginal: filename, storedPath: blobUrl, mimeType, tamanho: size, categoria: "EPI_FICHA", funcionarioId, uploadedById: auth.user.id },
          });
          documentoId = documento.id;
        }

        return tx.sauEpiMovimento.create({
          data: {
            ...resto,
            ca: caFinal,
            validadeCa: validadeCaFinal,
            lote: loteFinal,
            funcionarioId,
            tipoId: tipoEpi.id,
            dataMovimento: dataMovimento ?? undefined,
            responsavelId: auth.user.id,
            documentoId,
          },
          include: { tipo: true, documento: true, responsavel: { select: { id: true, name: true } }, substituiMovimento: true },
        });
      }),
    "Esta entrega/troca já foi substituída por outro movimento."
  );
  if (movimento instanceof NextResponse) return movimento;

  await registrarAuditoria({
    entidade: "SauEpiMovimento",
    entidadeId: movimento.id,
    acao: movimento.tipoMovimento,
    userId: auth.user.id,
    depois: { tipoId: tipoEpi.id, ca: movimento.ca, lote: movimento.lote, quantidade: movimento.quantidade },
  });

  return NextResponse.json(movimento, { status: 201 });
}
