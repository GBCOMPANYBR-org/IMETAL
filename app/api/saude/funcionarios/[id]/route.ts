import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { funcionarioUpdateSchema } from "@/lib/saude/validation";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.view");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const funcionario = await prisma.sauFuncionario.findUnique({
    where: { id },
    include: {
      funcaoPrincipal: true,
      alocacoes: {
        orderBy: { dataInicio: "desc" },
        include: { cliente: true, unidade: true, funcao: true },
      },
    },
  });
  if (!funcionario) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  return NextResponse.json(funcionario);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = funcionarioUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const before = await prisma.sauFuncionario.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  const result = await runWithUniqueErrorHandling(
    () => prisma.sauFuncionario.update({ where: { id }, data: parsed.data }),
    "Já existe um funcionário com essa matrícula ou CPF."
  );
  if (result instanceof NextResponse) return result;

  await registrarAuditoria({
    entidade: "SauFuncionario",
    entidadeId: id,
    acao: "ATUALIZOU",
    userId: auth.user.id,
    antes: before,
    depois: parsed.data,
  });

  return NextResponse.json(result);
}
