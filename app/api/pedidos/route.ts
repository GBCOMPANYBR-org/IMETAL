import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCliente, requireAuth } from "@/lib/permissions";
import { PEDIDO_INCLUDE, serializePedido } from "@/lib/pedido-serializer";
import { parsePedidoQuery } from "@/lib/pedido-filters";
import { computeAnexosCounts } from "@/lib/attachment-group";
import { generateNextCodigo } from "@/lib/codigo-sequence";
import { findDisallowedKeys, pedidoCreateSchema } from "@/lib/pedido-payload";
import { runWithFkErrorHandling } from "@/lib/prisma-errors";

const PAGE_SIZE = 50;
// Safety net for the "no pagination while filtered" mode — real datasets here are small (low thousands).
const FILTERED_RESULT_CAP = 5000;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const { where, orderBy, hasFilters: hasFiltersFromQuery, page } = await parsePedidoQuery(searchParams, user);
  // Exporting always returns the full matching set, ignoring pagination — even with no filters applied.
  const isExport = searchParams.get("export") === "1";
  const hasFilters = hasFiltersFromQuery || isExport;

  const total = await prisma.pedido.count({ where });

  const skip = hasFilters ? undefined : (page - 1) * PAGE_SIZE;
  const take = hasFilters ? FILTERED_RESULT_CAP : PAGE_SIZE;

  const pedidos = await prisma.pedido.findMany({
    where,
    orderBy,
    include: PEDIDO_INCLUDE,
    skip,
    take,
  });

  const anexosCounts = await computeAnexosCounts(pedidos);

  return NextResponse.json({
    items: pedidos.map((p) => serializePedido(p, user, anexosCounts.get(p.id) ?? 0)),
    total,
    page: hasFilters ? 1 : page,
    pageSize: hasFilters ? total : PAGE_SIZE,
    hasFilters,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!user.isAdmin && !user.canEdit) {
    return NextResponse.json({ error: "Seu usuário não tem permissão para cadastrar pedidos." }, { status: 403 });
  }

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const disallowed = findDisallowedKeys(Object.keys(raw), user.visibleFields);
  if (disallowed.length > 0) {
    return NextResponse.json(
      { error: `Você não tem permissão para definir: ${disallowed.join(", ")}.` },
      { status: 403 }
    );
  }

  for (const required of ["status", "cliente", "faturamento", "tipo"]) {
    if (!user.visibleFields.has(required)) {
      return NextResponse.json(
        { error: "Seu usuário não tem permissão para visualizar campos obrigatórios do pedido." },
        { status: 403 }
      );
    }
  }

  const parsed = pedidoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  if (!canAccessCliente(user, data.clienteId)) {
    return NextResponse.json(
      { error: "Seu usuário não tem permissão para cadastrar pedidos para este Cliente." },
      { status: 403 }
    );
  }

  const faturadoNao = await prisma.faturado.findFirst({ where: { label: "NÃO" } });
  if (!faturadoNao) {
    return NextResponse.json(
      { error: "Cadastro de Faturado 'NÃO' não encontrado. Configure as opções de Faturado." },
      { status: 500 }
    );
  }

  const valorTotal = data.qtd * data.valorUnitario;
  // Left blank by the user — auto-assign the next "PRD00001"-style code so every Pedido has one.
  const codigo = data.codigo ?? (await generateNextCodigo());

  const result = await runWithFkErrorHandling(() =>
    prisma.pedido.create({
      data: {
        statusId: data.statusId,
        clienteId: data.clienteId,
        faturamentoId: data.faturamentoId,
        tipoId: data.tipoId,
        faturadoId: faturadoNao.id,
        pedidoCompra: data.pedidoCompra,
        data: data.data,
        qtd: data.qtd,
        codigo,
        descricao: data.descricao,
        ncm: data.ncm,
        valorUnitario: data.valorUnitario,
        valorTotal,
        pagamentoId: data.pagamentoId,
        observacao: data.observacao,
        dataFaturamento: data.dataFaturamento,
        nf: data.nf,
        pdv: data.pdv,
        createdById: user.id,
        updatedById: user.id,
      },
      include: PEDIDO_INCLUDE,
    })
  );
  if (result instanceof NextResponse) return result;

  // Not necessarily 0 — a freshly created Pedido can share a Código with existing ones that
  // already have attachments, and should immediately see them too.
  const anexosCounts = await computeAnexosCounts([result]);
  return NextResponse.json(serializePedido(result, user, anexosCounts.get(result.id) ?? 0), { status: 201 });
}
