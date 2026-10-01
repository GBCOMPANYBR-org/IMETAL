import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { clienteUpdateSchema } from "@/lib/saude/validation";
import { runWithUniqueErrorHandling } from "@/lib/saude/prisma-errors";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("employee.edit");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = clienteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const before = await prisma.sauCliente.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const result = await runWithUniqueErrorHandling(
    () => prisma.sauCliente.update({ where: { id }, data: parsed.data }),
    "Já existe um cliente com esse nome."
  );
  if (result instanceof NextResponse) return result;

  await registrarAuditoria({ entidade: "SauCliente", entidadeId: id, acao: "ATUALIZOU", userId: auth.user.id, antes: before, depois: parsed.data });

  return NextResponse.json(result);
}
