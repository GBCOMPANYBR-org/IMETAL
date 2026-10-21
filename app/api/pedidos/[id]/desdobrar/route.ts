import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";
import { z } from "zod";

const schema = z.object({
  quantidade: z.number().positive().finite(),
  statusId: z.number().int().positive(),
  faturadoId: z.number().int().positive(),
  nf: z.string().trim().max(100).nullable().optional(),
  pdv: z.string().trim().max(100).nullable().optional(),
  dataFaturamento: z.string().nullable().optional(),
  previsao: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{id:string}> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const id = parsePedidoId((await params).id);
  if (id === null) return NextResponse.json({error:"ID inválido."},{status:400});
  const parsed = schema.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:"Dados inválidos.",details:parsed.error.flatten()},{status:400});
  const d = parsed.data;
  const date = (value:string|null|undefined) => value ? new Date(value+"T12:00:00") : null;
  if ((d.dataFaturamento && !Number.isFinite(date(d.dataFaturamento)?.getTime())) ||
      (d.previsao && !Number.isFinite(date(d.previsao)?.getTime())))
    return NextResponse.json({error:"Data inválida."},{status:400});
  try {
    const result = await prisma.$transaction(async tx => {
      const original = await tx.pedido.findUnique({where:{id}});
      if (!original) throw new Error("NOT_FOUND");
      if (original.qtd <= 0 || d.quantidade >= original.qtd)
        throw new Error("INVALID_QUANTITY");
      const [status,faturado] = await Promise.all([
        tx.status.findUnique({where:{id:d.statusId}}),
        tx.faturado.findUnique({where:{id:d.faturadoId}}),
      ]);
      if (!status || !faturado) throw new Error("INVALID_OPTIONS");
      // Optimistic compare-and-swap protects against concurrent splits.
      const saldo = original.qtd-d.quantidade;
      const changed = await tx.pedido.updateMany({
        where:{id, qtd:original.qtd},
        data:{qtd:saldo,valorTotal:Math.round(saldo*original.valorUnitario*100)/100,updatedById:auth.user.id}
      });
      if (changed.count !== 1) throw new Error("CONCURRENT_UPDATE");
      const novo = await tx.pedido.create({data:{
        parentPedidoId:original.parentPedidoId ?? original.id,
        statusId:d.statusId,clienteId:original.clienteId,
        pedidoCompra:original.pedidoCompra,data:original.data,
        qtd:d.quantidade,codigo:original.codigo,descricao:original.descricao,ncm:original.ncm,
        valorUnitario:original.valorUnitario,
        valorTotal:Math.round(d.quantidade*original.valorUnitario*100)/100,
        pagamentoId:original.pagamentoId,faturamentoId:original.faturamentoId,
        tipoId:original.tipoId,observacao:original.observacao,
        faturadoId:d.faturadoId,previsao:d.previsao===undefined?original.previsao:date(d.previsao),
        dataFaturamento:d.dataFaturamento===undefined?null:date(d.dataFaturamento),
        nf:d.nf||null,pdv:d.pdv||null,
        createdById:auth.user.id,updatedById:auth.user.id,
        finalizadoAt:status.label.toLowerCase()==="finalizado"?new Date():null,
      }});
      return {originalId:id,novoId:novo.id,saldo,quantidade:d.quantidade};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return NextResponse.json(result,{status:201});
  } catch(e) {
    const message=e instanceof Error?e.message:"";
    const errors:Record<string,[number,string]>={
      NOT_FOUND:[404,"Pedido não encontrado."],
      INVALID_QUANTITY:[409,"A quantidade deve ser menor que o saldo disponível."],
      INVALID_OPTIONS:[400,"Status ou faturamento inválido."],
      CONCURRENT_UPDATE:[409,"O pedido foi alterado. Atualize a tabela e tente novamente."],
    };
    if (errors[message]) return NextResponse.json({error:errors[message][1]},{status:errors[message][0]});
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2034")
      return NextResponse.json({error:"Pedido alterado simultaneamente. Tente novamente."},{status:409});
    console.error("Falha ao desdobrar pedido",e);
    return NextResponse.json({error:"Não foi possível desdobrar o pedido."},{status:500});
  }
}
