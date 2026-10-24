import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
export const runtime = "nodejs";
const clean = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const amount = (s: string) => Number(s.replace(/\./g,"").replace(",","."));
export async function POST(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const {user} = auth;
  if (!user.isAdmin && !user.canEdit) return NextResponse.json({error:"Sem permissão para cadastrar pedidos."},{status:403});
  const data = await req.formData().catch(()=>null);
  const file = data?.get("file");
  if (!(file instanceof File) || !/\.pdf$/i.test(file.name) || file.size > 8*1024*1024 || file.size < 50) return NextResponse.json({error:"Selecione um PDF de até 8 MB."},{status:400});
  const buffer = Buffer.from(await file.arrayBuffer());
  if(buffer.subarray(0,5).toString() !== "%PDF-") return NextResponse.json({error:"Arquivo PDF inválido."},{status:400});
  let text = "";
  try { const parse = (await import("pdf-parse")).default; text=(await parse(buffer,{max:2})).text; }
  catch(e) { console.error("Extração PDF",e); return NextResponse.json({error:"Falha ao ler texto do PDF; nenhum pedido criado."},{status:422}); }
  if(!/VEOLIA TECNOLOGIAS E SOLUCOES/i.test(text) || !/PURCHASE ORDER NUMBER/i.test(text)) return NextResponse.json({error:"Formato não suportado: use pedido textual da Veolia nesta versão."},{status:422});
  const order = text.match(/\b(\d{1,2}[A-Za-z]{3}\d{4})\s+(\d{9,12})\b/);
  const lines = [...text.matchAll(/^\s*(\d{5})\s+(\d{4,15})\s+(\d+(?:[.,]\d+)?)\s+EACH\s+([\d.,]+)\s+BRL\s*\/\s*1\s*EA\s+([\d.,]+)/gm)];
  if(!order || lines.length !== 1) return NextResponse.json({error:"Pedido ou itens não identificados com segurança (suporta 1 item). Nenhum cadastro criado."},{status:422});
  const m=lines[0], following=text.slice(m.index!+m[0].length);
  const descricao=following.match(/^\s*([^\n]+)\n\s*Harmonized System:/m)?.[1]?.trim();
  const ncm=following.match(/Harmonized System:\s*(\d{8})/i)?.[1];
  const qtd=Number(m[3].replace(",",".")), unit=amount(m[4]), total=amount(m[5]);
  if(!descricao || !ncm || !(qtd>0 && unit>0) || Math.abs(qtd*unit-total)>.02) return NextResponse.json({error:"Campos ou valores inconsistentes; nenhum cadastro criado."},{status:422});
  const clients=await prisma.cliente.findMany({where:user.allClientes?{}:{id:{in:[...user.visibleClienteIds]}},select:{id:true,name:true}});
  const client=clients.find(c=>clean(c.name).includes("veolia") && clean(c.name).includes("sorocaba")) ?? clients.find(c=>clean(c.name).includes("veolia"));
  if(!client) return NextResponse.json({error:"Cliente Veolia não encontrado entre os clientes autorizados."},{status:422});
  const duplicated=await prisma.pedido.findMany({where:{clienteId:client.id,pedidoCompra:order[2]},select:{id:true},take:8});
  const prior=await prisma.pedido.findFirst({where:{clienteId:client.id,codigo:{equals:m[2],mode:"insensitive"}},orderBy:{id:"desc"},select:{pagamentoId:true,faturamentoId:true,tipoId:true}});
  const months=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month=months.indexOf(order[1].slice(-7,-4).toLowerCase());
  const iso=month<0?null:`${order[1].slice(-4)}-${String(month+1).padStart(2,"0")}-${order[1].slice(0,-7).padStart(2,"0")}`;
  const visible=(k:string,v:unknown)=>user.visibleFields.has(k)?v:null;
  return NextResponse.json({draft:{
    clienteId:client.id,pedidoCompra:visible("pedidoCompra",order[2]),data:visible("data",iso),
    codigo:visible("codigo",m[2]),descricao:visible("descricao",descricao),qtd:visible("qtd",qtd),
    valorUnitario:visible("valorUnitario",unit),ncm:visible("ncm",ncm),
    pagamentoId:visible("pagamento",prior?.pagamentoId??null),
    faturamentoId:visible("faturamento",prior?.faturamentoId??null),tipoId:visible("tipo",prior?.tipoId??null),
    previsao:null
  },warnings:[
    ...(duplicated.length?[`Atenção: pedido de compra já cadastrado nos IDs ${duplicated.map(p=>p.id).join(", ")}.`]:[]),
    ...(!prior?["Sem histórico para sugerir Pagamento, Faturamento e Tipo."]:[]),
    "Previsão deixada em branco."
  ]});
}
