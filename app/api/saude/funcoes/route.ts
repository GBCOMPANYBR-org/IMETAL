import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { funcaoSchema } from "@/lib/saude/validation";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.view");
  if ("error" in auth) return auth.error;

  const funcoes = await prisma.sauFuncao.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(funcoes);
}

// Catálogo aberto (seção 9 da especificação) — qualquer pessoa com employee.edit pode criar uma
// função nova ao cadastrar um funcionário, sem precisar de uma tela de administração separada.
// Dedup case-insensitive em vez de deixar a unique constraint rejeitar: "montador" digitado
// depois de "Montador" já existir deve reaproveitar a função existente, não falhar.
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = funcaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const existing = await prisma.sauFuncao.findFirst({
    where: { nome: { equals: parsed.data.nome, mode: "insensitive" } },
  });
  if (existing) return NextResponse.json(existing);

  const created = await prisma.sauFuncao.create({ data: { nome: parsed.data.nome, criadaVia: "MANUAL" } });
  return NextResponse.json(created, { status: 201 });
}
