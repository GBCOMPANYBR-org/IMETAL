import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { getNovosPedidos } from "@/lib/pedidos-novos";
export async function GET() {
  const auth=await requireAuth();
  if("error" in auth) return auth.error;
  if(!auth.user.canAlertNewPedido) return NextResponse.json({count:0});
  const {count}=await getNovosPedidos(auth.user);
  return NextResponse.json({count});
}
