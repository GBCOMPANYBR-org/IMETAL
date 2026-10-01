import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { pcmsoRequisitoAddSchema } from "@/lib/saude/validation";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Adiciona um exame exigido (um "requisito" — a linha da matriz, seção 11) a uma função desta
 *  versão. Sem IA nesta etapa, toda linha nasce com status MANUAL — já conta pro motor de
 *  liberação assim que a versão em si for publicada (ver /publicar), sem uma aprovação própria. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pcmsoFuncaoId: string }> }
): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const { id, pcmsoFuncaoId } = await params;
  const pcmsoVersaoId = parseId(id);
  const funcaoRowId = parseId(pcmsoFuncaoId);
  if (pcmsoVersaoId === null || funcaoRowId === null) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const pcmsoFuncao = await prisma.sauPcmsoFuncao.findUnique({ where: { id: funcaoRowId } });
  if (!pcmsoFuncao || pcmsoFuncao.pcmsoVersaoId !== pcmsoVersaoId) {
    return NextResponse.json({ error: "Função não encontrada nesta versão." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pcmsoRequisitoAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  let tipoExame = await prisma.sauTipoExame.findFirst({
    where: { nome: { equals: parsed.data.tipoExameNome, mode: "insensitive" } },
  });
  if (!tipoExame) {
    tipoExame = await prisma.sauTipoExame.create({ data: { nome: parsed.data.tipoExameNome, criadoVia: "MANUAL" } });
  }

  const requisito = await prisma.sauRequisito.create({
    data: {
      pcmsoFuncaoId: funcaoRowId,
      tipoExameId: tipoExame.id,
      periodicidade: parsed.data.periodicidade,
      periodicidadeDetalhe: parsed.data.periodicidadeDetalhe,
      obrigatorio: parsed.data.obrigatorio,
      status: "MANUAL",
      criadoPorId: auth.user.id,
    },
    include: { tipoExame: true },
  });

  return NextResponse.json(requisito, { status: 201 });
}
