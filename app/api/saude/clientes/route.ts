import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { clienteSchema } from "@/lib/saude/validation";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.view");
  if ("error" in auth) return auth.error;

  const clientes = await prisma.sauCliente.findMany({
    include: { unidades: { orderBy: { nome: "asc" } } },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(clientes);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = clienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const result = await runWithUniqueErrorHandling(
    () => prisma.sauCliente.create({ data: parsed.data }),
    "Já existe um cliente com esse nome."
  );
  if (result instanceof NextResponse) return result;

  await registrarAuditoria({ entidade: "SauCliente", entidadeId: result.id, acao: "CRIOU", userId: auth.user.id, depois: parsed.data });

  return NextResponse.json(result, { status: 201 });
}
