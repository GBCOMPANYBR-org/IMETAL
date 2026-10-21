import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, NEW_PEDIDO_CURSOR_PREFIX } from "@/lib/permissions";
import { getNovosPedidos } from "@/lib/pedidos-novos";
export async function POST() {
  const auth=await requireAuth();
  if("error" in auth) return auth.error;
  if(!auth.user.canAlertNewPedido) return NextResponse.json({error:"Sem permissão para alerta de pedido novo."},{status:403});
  const {ids,maxId}=await getNovosPedidos(auth.user);
  // Marcação individual de leitura, sem migração de schema.
  await prisma.$transaction(async tx=>{
    await tx.fieldPermission.deleteMany({where:{userId:auth.user.id,fieldKey:{startsWith:NEW_PEDIDO_CURSOR_PREFIX}}});
    await tx.fieldPermission.create({data:{userId:auth.user.id,fieldKey:`${NEW_PEDIDO_CURSOR_PREFIX}${maxId}`,canView:true}});
  });
  return NextResponse.json({ids});
}
