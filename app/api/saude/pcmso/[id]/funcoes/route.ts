import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { pcmsoFuncaoAddSchema } from "@/lib/saude/validation";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Adiciona uma função à matriz desta versão de PCMSO — mesmo catálogo aberto (dedup
 *  case-insensitive) usado em funcionário/alocação, pra "Montador" nunca duplicar. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const pcmsoVersaoId = parseId((await params).id);
  if (pcmsoVersaoId === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });

  const versao = await prisma.sauPcmsoVersao.findUnique({ where: { id: pcmsoVersaoId } });
  if (!versao) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = pcmsoFuncaoAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  let funcao = await prisma.sauFuncao.findFirst({
    where: { nome: { equals: parsed.data.funcaoNome, mode: "insensitive" } },
  });
  if (!funcao) {
    funcao = await prisma.sauFuncao.create({ data: { nome: parsed.data.funcaoNome, criadaVia: "MANUAL" } });
  }

  const existing = await prisma.sauPcmsoFuncao.findUnique({
    where: { pcmsoVersaoId_funcaoId: { pcmsoVersaoId, funcaoId: funcao.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Essa função já está nesta versão do PCMSO." }, { status: 400 });
  }

  const pcmsoFuncao = await prisma.sauPcmsoFuncao.create({
    data: { pcmsoVersaoId, funcaoId: funcao.id },
    include: { funcao: true, riscos: { include: { risco: true } }, requisitos: { include: { tipoExame: true } } },
  });

  return NextResponse.json(pcmsoFuncao, { status: 201 });
}
