import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, canEditPedidoWithStatus, requireAdmin, requireAuth } from "@/lib/permissions";
import { PEDIDO_INCLUDE, serializePedido } from "@/lib/pedido-serializer";
import { findDisallowedKeys, pedidoUpdateSchema } from "@/lib/pedido-payload";
import { deleteAttachmentFile } from "@/lib/storage";
import { runWithFkErrorHandling } from "@/lib/prisma-errors";
import { parsePedidoId } from "@/lib/pedido-filters";
import { attachmentGroupKey, computeAnexosCounts, computeNfAnexosCounts, computePropostasCounts, nfGroupKey } from "@/lib/attachment-group";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: PEDIDO_INCLUDE });
  if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const anexosCounts = await computeAnexosCounts([pedido]);
  const propostasCounts = await computePropostasCounts([pedido]);
  const nfAnexosCounts = await computeNfAnexosCounts([pedido]);
  return NextResponse.json(
    serializePedido(pedido, user, anexosCounts.get(pedido.id) ?? 0, propostasCounts.get(pedido.id) ?? 0, nfAnexosCounts.get(pedido.id) ?? 0)
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const existing = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { status: true } });
  if (!existing || !canAccessCliente(user, existing.clienteId)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  // Trocar somente o status é uma permissão independente de editar o Pedido inteiro.
  // ADMIN sempre pode; USER precisa da opção "Pode alterar status dos pedidos".
  const rawKeys = Object.keys(raw);
  const statusOnlyChange = rawKeys.length === 1 && rawKeys[0] === "statusId";
  if (statusOnlyChange) {
    if (!user.canChangePedidoStatus) {
      return NextResponse.json({ error: "Seu usuário não tem permissão para alterar o status dos pedidos." }, { status: 403 });
    }
  } else if (!canEditPedidoWithStatus(user, existing.status.editable)) {
    return NextResponse.json(
      { error: "Este pedido está com um status que não permite edição." },
      { status: 423 }
    );
  }

  const disallowed = findDisallowedKeys(Object.keys(raw), user.visibleFields);
  if (disallowed.length > 0) {
    return NextResponse.json(
      { error: `Você não tem permissão para alterar: ${disallowed.join(", ")}.` },
      { status: 403 }
    );
  }

  const parsed = pedidoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.clienteId !== undefined && !canAccessCliente(user, data.clienteId)) {
    return NextResponse.json(
      { error: "Seu usuário não tem permissão para mover este pedido para este Cliente." },
      { status: 403 }
    );
  }

  const nextQtd = data.qtd ?? existing.qtd;
  const nextValorUnitario = data.valorUnitario ?? existing.valorUnitario;

  // Registra a transição real para "Finalizado" (não apenas qualquer edição posterior do pedido).
  // Se o pedido for reaberto, limpamos o timestamp; uma nova finalização gera uma nova novidade.
  let finalizadoAtUpdate: Date | null | undefined;
  if (data.statusId !== undefined && data.statusId !== existing.statusId) {
    const nextStatus = await prisma.status.findUnique({ where: { id: data.statusId }, select: { label: true } });
    if (nextStatus?.label === "Finalizado") finalizadoAtUpdate = new Date();
    else if (existing.status.label === "Finalizado") finalizadoAtUpdate = null;
  }

  const result = await runWithFkErrorHandling(() =>
    prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        ...(data.statusId !== undefined ? { statusId: data.statusId } : {}),
        ...(finalizadoAtUpdate !== undefined ? { finalizadoAt: finalizadoAtUpdate } : {}),
        ...(data.clienteId !== undefined ? { clienteId: data.clienteId } : {}),
        ...(data.faturamentoId !== undefined ? { faturamentoId: data.faturamentoId } : {}),
        ...(data.tipoId !== undefined ? { tipoId: data.tipoId } : {}),
        ...(data.faturadoId !== undefined ? { faturadoId: data.faturadoId } : {}),
        ...(data.pedidoCompra !== undefined ? { pedidoCompra: data.pedidoCompra } : {}),
        ...(data.data !== undefined ? { data: data.data } : {}),
        ...(data.qtd !== undefined ? { qtd: data.qtd } : {}),
        ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
        ...(data.ncm !== undefined ? { ncm: data.ncm } : {}),
        ...(data.valorUnitario !== undefined ? { valorUnitario: data.valorUnitario } : {}),
        ...(data.pagamentoId !== undefined ? { pagamentoId: data.pagamentoId } : {}),
        ...(data.previsao !== undefined ? { previsao: data.previsao } : {}),
        ...(data.dataFaturamento !== undefined ? { dataFaturamento: data.dataFaturamento } : {}),
        ...(data.nf !== undefined ? { nf: data.nf } : {}),
        ...(data.pdv !== undefined ? { pdv: data.pdv } : {}),
        valorTotal: nextQtd * nextValorUnitario,
        updatedById: user.id,
      },
      include: PEDIDO_INCLUDE,
    })
  );
  if (result instanceof NextResponse) return result;

  const anexosCounts = await computeAnexosCounts([result]);
  const propostasCounts = await computePropostasCounts([result]);
  const nfAnexosCounts = await computeNfAnexosCounts([result]);
  return NextResponse.json(
    serializePedido(result, user, anexosCounts.get(result.id) ?? 0, propostasCounts.get(result.id) ?? 0, nfAnexosCounts.get(result.id) ?? 0)
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const pedidoId = parsePedidoId(id);
  if (pedidoId === null) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const groupKey = attachmentGroupKey(pedido);
  const nfKey = nfGroupKey(pedido);

  await prisma.pedido.delete({ where: { id: pedidoId } });

  // Attachments (anexo/proposta) are shared by Código — only clean them up if no other Pedido
  // still shares this group (a synthetic "__pedido_<id>" key is unique to this Pedido, so it's
  // always safe to clean).
  const stillShared =
    !groupKey.startsWith("__pedido_") &&
    (await prisma.pedido.count({ where: { codigo: pedido.codigo, clienteId: pedido.clienteId } })) > 0;
  if (!stillShared) {
    const orphaned = await prisma.attachment.findMany({ where: { codigo: groupKey } });
    if (orphaned.length > 0) {
      await prisma.attachment.deleteMany({ where: { codigo: groupKey } });
      await Promise.all(orphaned.map((a) => deleteAttachmentFile(a.storedPath)));
    }
  }

  // Same idea for anexos de NF, grouped by Cliente+número da NF instead of Código.
  const nfStillShared =
    !nfKey.startsWith("__pedido_nf_") &&
    (await prisma.pedido.count({ where: { nf: pedido.nf, clienteId: pedido.clienteId } })) > 0;
  if (!nfStillShared) {
    const orphanedNf = await prisma.attachment.findMany({ where: { codigo: nfKey, kind: "nf" } });
    if (orphanedNf.length > 0) {
      await prisma.attachment.deleteMany({ where: { codigo: nfKey, kind: "nf" } });
      await Promise.all(orphanedNf.map((a) => deleteAttachmentFile(a.storedPath)));
    }
  }

  return NextResponse.json({ ok: true });
}
