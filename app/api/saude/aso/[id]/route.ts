import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { asoUpdateSchema } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Corrige campos extraídos/digitados antes (ou depois) da confirmação — o botão "Corrigir" da
 *  seção 17. Nunca mexe no documento original nem no resultado declarado em si sem deixar
 *  rastro: toda alteração grava SauAuditoria com antes/depois. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("aso.review");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ASO inválido." }, { status: 400 });

  const before = await prisma.sauAso.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "ASO não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = asoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const status = before.status === "CONFIRMADO" ? "CORRIGIDO" : before.status;

  const atualizado = await prisma.sauAso.update({
    where: { id },
    data: { ...parsed.data, status },
    include: { documento: true, alocacao: { include: { unidade: true } } },
  });

  await registrarAuditoria({
    entidade: "SauAso",
    entidadeId: id,
    acao: "CORRIGIU",
    userId: auth.user.id,
    antes: before,
    depois: parsed.data,
  });

  return NextResponse.json(atualizado);
}
