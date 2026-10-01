import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { unidadeSchema } from "@/lib/saude/validation";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";
import { registrarAuditoria } from "@/lib/saude/auditoria";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = unidadeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const cliente = await prisma.sauCliente.findUnique({ where: { id: parsed.data.clienteId } });
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const result = await runWithUniqueErrorHandling(
    () => prisma.sauUnidade.create({ data: parsed.data }),
    "Esse cliente já tem uma unidade com esse nome."
  );
  if (result instanceof NextResponse) return result;

  await registrarAuditoria({ entidade: "SauUnidade", entidadeId: result.id, acao: "CRIOU", userId: auth.user.id, depois: parsed.data });

  return NextResponse.json(result, { status: 201 });
}
