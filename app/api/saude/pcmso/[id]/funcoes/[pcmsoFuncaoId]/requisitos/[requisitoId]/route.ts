import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";
import { PERIODICIDADES } from "@/lib/saude/validation";
import { registrarAuditoria } from "@/lib/saude/auditoria";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Revisão humana de uma sugestão da IA (seção 10) — aprovar, rejeitar ou corrigir antes de
 * aprovar. Diferente do DELETE abaixo: rejeitar mantém a linha (status REJEITADO) em vez de
 * apagar, porque é a sugestão original da IA que precisa ficar registrada pra auditoria (seção
 * 10: "guardar informação originalmente sugerida pela IA; informação final aprovada").
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pcmsoFuncaoId: string; requisitoId: string }> }
): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const { pcmsoFuncaoId, requisitoId } = await params;
  const funcaoRowId = parseId(pcmsoFuncaoId);
  const id = parseId(requisitoId);
  if (funcaoRowId === null || id === null) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const before = await prisma.sauRequisito.findUnique({ where: { id } });
  if (!before || before.pcmsoFuncaoId !== funcaoRowId) {
    return NextResponse.json({ error: "Requisito não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as
    | { status?: "APROVADO" | "REJEITADO"; periodicidade?: string; obrigatorio?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  if (body.periodicidade && !PERIODICIDADES.includes(body.periodicidade as (typeof PERIODICIDADES)[number])) {
    return NextResponse.json({ error: "Periodicidade inválida." }, { status: 400 });
  }

  // "pcmso.approve" só é exigido pra publicar a versão inteira — aprovar/rejeitar um item
  // individual da matriz, como editar qualquer outro campo dela, usa pcmso.review.
  const isAprovar = body.status === "APROVADO";

  const atualizado = await prisma.sauRequisito.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.periodicidade && { periodicidade: body.periodicidade }),
      ...(body.obrigatorio !== undefined && { obrigatorio: body.obrigatorio }),
      ...(isAprovar && { aprovadoPorId: auth.user.id, aprovadoEm: new Date() }),
    },
    include: { tipoExame: true },
  });

  await registrarAuditoria({
    entidade: "SauRequisito",
    entidadeId: id,
    acao: body.status === "APROVADO" ? "APROVOU" : body.status === "REJEITADO" ? "REJEITOU" : "EDITOU",
    userId: auth.user.id,
    antes: { status: before.status, periodicidade: before.periodicidade, obrigatorio: before.obrigatorio },
    depois: body,
  });

  return NextResponse.json(atualizado);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pcmsoFuncaoId: string; requisitoId: string }> }
): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.review");
  if ("error" in auth) return auth.error;

  const { pcmsoFuncaoId, requisitoId } = await params;
  const funcaoRowId = parseId(pcmsoFuncaoId);
  const id = parseId(requisitoId);
  if (funcaoRowId === null || id === null) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const requisito = await prisma.sauRequisito.findUnique({ where: { id } });
  if (!requisito || requisito.pcmsoFuncaoId !== funcaoRowId) {
    return NextResponse.json({ error: "Requisito não encontrado." }, { status: 404 });
  }

  await prisma.sauRequisito.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
