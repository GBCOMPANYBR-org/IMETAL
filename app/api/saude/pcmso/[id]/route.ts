import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.view");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });

  const versao = await prisma.sauPcmsoVersao.findUnique({
    where: { id },
    include: {
      unidade: { include: { cliente: true } },
      documento: true,
      funcoes: {
        include: {
          funcao: true,
          riscos: { include: { risco: true } },
          requisitos: { include: { tipoExame: true }, orderBy: { id: "asc" } },
        },
        orderBy: { id: "asc" },
      },
      analises: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
  });
  if (!versao) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });

  return NextResponse.json(versao);
}

/** Corrige datas de cadastro sem republicar nem alterar a matriz de exames. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.approve");
  if ("error" in auth) return auth.error;
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parseDate = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  const inicio = parseDate(body?.inicioVigencia);
  const fim = body?.fimVigencia === null ? null : parseDate(body?.fimVigencia);
  if (!inicio || (body?.fimVigencia !== null && !fim) || (fim && fim < inicio)) return NextResponse.json({ error: "Informe datas válidas; o fim não pode ser anterior ao início." }, { status: 400 });
  const atual = await prisma.sauPcmsoVersao.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });
  if (["SUBSTITUIDO", "ARQUIVADO"].includes(atual.status)) return NextResponse.json({ error: "Não é possível editar a vigência de uma versão encerrada." }, { status: 409 });
  if (body?.expectedUpdatedAt !== atual.updatedAt.toISOString()) return NextResponse.json({ error: "O cadastro foi alterado. Recarregue a página antes de editar." }, { status: 409 });
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.sauPcmsoVersao.updateMany({ where: { id, updatedAt: atual.updatedAt }, data: { inicioVigencia: inicio, fimVigencia: fim } });
    if (!result.count) return false;
    await tx.sauAuditoria.create({ data: { entidade: "SauPcmsoVersao", entidadeId: String(id), acao: "CORRIGIU_VIGENCIA", userId: auth.user.id, antes: { inicioVigencia: atual.inicioVigencia.toISOString(), fimVigencia: atual.fimVigencia?.toISOString() ?? null }, depois: { inicioVigencia: inicio.toISOString(), fimVigencia: fim?.toISOString() ?? null } } });
    return true;
  });
  if (!updated) return NextResponse.json({ error: "O cadastro foi alterado. Recarregue a página." }, { status: 409 });
  return NextResponse.json({ saved: true });
}
