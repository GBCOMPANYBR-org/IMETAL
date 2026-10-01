import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { pcmsoRiscoAddSchema } from "@/lib/saude/validation";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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
  const parsed = pcmsoRiscoAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  let risco = await prisma.sauRisco.findFirst({ where: { nome: { equals: parsed.data.nome, mode: "insensitive" } } });
  if (!risco) {
    risco = await prisma.sauRisco.create({ data: { nome: parsed.data.nome, criadoVia: "MANUAL" } });
  }

  const existing = await prisma.sauPcmsoFuncaoRisco.findUnique({
    where: { pcmsoFuncaoId_riscoId: { pcmsoFuncaoId: funcaoRowId, riscoId: risco.id } },
  });
  if (existing) return NextResponse.json({ error: "Esse risco já está nesta função." }, { status: 400 });

  const created = await prisma.sauPcmsoFuncaoRisco.create({
    data: { pcmsoFuncaoId: funcaoRowId, riscoId: risco.id },
    include: { risco: true },
  });

  return NextResponse.json(created, { status: 201 });
}
