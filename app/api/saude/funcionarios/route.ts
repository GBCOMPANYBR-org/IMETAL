import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { funcionarioCreateSchema } from "@/lib/saude/validation";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.view");
  if ("error" in auth) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim();

  const funcionarios = await prisma.sauFuncionario.findMany({
    where: q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { matricula: { contains: q, mode: "insensitive" } },
            { cpf: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { funcaoPrincipal: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(funcionarios);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = funcionarioCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const result = await runWithUniqueErrorHandling(
    () => prisma.sauFuncionario.create({ data: parsed.data }),
    "Já existe um funcionário com essa matrícula ou CPF."
  );
  if (result instanceof NextResponse) return result;

  await registrarAuditoria({
    entidade: "SauFuncionario",
    entidadeId: result.id,
    acao: "CRIOU",
    userId: auth.user.id,
    depois: parsed.data,
  });

  return NextResponse.json(result, { status: 201 });
}
