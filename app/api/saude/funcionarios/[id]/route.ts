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


export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Funcionário inválido." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Trava o cadastro durante a verificação para evitar exclusão simultânea a novos registros.
      const locked = await tx.$queryRaw<{ id: number }[]>\`SELECT id FROM "SauFuncionario" WHERE id = \${id} FOR UPDATE\`;
      if (!locked.length) return "not-found" as const;

      const funcionario = await tx.sauFuncionario.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: {
              alocacoes: true, asos: true, exames: true, documentos: true,
              checklists: true, alertas: true, epiMovimentos: true,
            },
          },
        },
      });
      const { _count, ...before } = funcionario;
      if (Object.values(_count).some((count) => count > 0)) return "has-records" as const;

      await tx.sauFuncionario.delete({ where: { id } });
      await tx.sauAuditoria.create({
        data: {
          entidade: "SauFuncionario",
          entidadeId: String(id),
          acao: "EXCLUIU",
          userId: auth.user.id,
          antes: JSON.parse(JSON.stringify(before)),
          detalhes: "Cadastro sem registros vinculados.",
        },
      });
      return "deleted" as const;
    });

    if (result === "not-found") return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });
    if (result === "has-records") {
      return NextResponse.json(
        { error: "Não é possível excluir: o funcionário possui registros vinculados (ASO, exames, EPI, alocações ou outros históricos). Altere o status para Inativo." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir funcionário:", error);
    return NextResponse.json({ error: "Não foi possível excluir o funcionário. Verifique se existem registros vinculados." }, { status: 409 });
  }
}
