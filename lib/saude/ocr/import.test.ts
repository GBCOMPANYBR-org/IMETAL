import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),transaction:vi.fn(),version:vi.fn(),func:vi.fn(),upsert:vi.fn(),type:vi.fn(),existing:vi.fn(),create:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/saude/permissions",()=>({requireSaudeAccess:m.auth}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:m.transaction}}));
import {POST} from "@/app/api/saude/pcmso/[id]/importar-conferido/route";
const data={documentId:9,conferido:true,funcao:{nome:"Operador",pagina:2,avisos:[],exames:[{nome:"Exame exemplo",meses:24,ocasioes:["ADMISSIONAL","PERIODICO"],pagina:2,trecho:"Exame exemplo 24 meses X X"}]}};
const call=(body:unknown=data)=>POST(new Request("http://localhost/test",{method:"POST",body:JSON.stringify(body)}),{params:Promise.resolve({id:"1"})});
describe("Cadastro conferido por função",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();m.auth.mockResolvedValue({user:{id:1}});m.version.mockResolvedValue({documentoId:9,status:"AGUARDANDO_REVISAO"});m.func.mockResolvedValue({id:3});m.type.mockResolvedValue({id:4});m.upsert.mockResolvedValue({id:5});m.existing.mockResolvedValue(null);m.create.mockResolvedValue({id:6});m.audit.mockResolvedValue({});
  m.transaction.mockImplementation(async fn=>fn({sauPcmsoVersao:{findUnique:m.version},sauFuncao:{findFirst:m.func},sauTipoExame:{findFirst:m.type},sauPcmsoFuncao:{upsert:m.upsert},sauRequisito:{findFirst:m.existing,create:m.create},sauAuditoria:{create:m.audit}}));
 });
 it("exige acesso antes de qualquer alteração",async()=>{m.auth.mockResolvedValue({error:new Response(null,{status:403})});expect((await call()).status).toBe(403);expect(m.transaction).not.toHaveBeenCalled();});
 it("exige conferência explícita",async()=>{expect((await call({...data,conferido:false})).status).toBe(400);expect(m.transaction).not.toHaveBeenCalled();});
 it.each(["ATIVO","SUBSTITUIDO","ARQUIVADO"])("não altera versão %s",async status=>{m.version.mockResolvedValue({documentoId:9,status});expect((await call()).status).toBe(409);expect(m.create).not.toHaveBeenCalled();});
 it("recusa documento trocado",async()=>{expect((await call({...data,documentId:10})).status).toBe(409);expect(m.create).not.toHaveBeenCalled();});
 it("salva fonte e um requisito por ocasião, intervalo só para periódico",async()=>{
  expect((await call()).status).toBe(200);expect(m.create).toHaveBeenCalledTimes(2);
  expect(m.create.mock.calls[0][0].data).toMatchObject({periodicidade:"ADMISSIONAL",periodicidadeDetalhe:null,status:"MANUAL",origemPagina:2});
  expect(m.create.mock.calls[1][0].data).toMatchObject({periodicidade:"PERIODICO",periodicidadeDetalhe:"24 meses"});expect(m.audit).toHaveBeenCalledOnce();
 });
 it("preserva requisitos existentes sem duplicar",async()=>{m.existing.mockResolvedValue({id:99});const r=await call();expect(await r.json()).toMatchObject({added:0,skipped:2});expect(m.create).not.toHaveBeenCalled();});
 it("reporta conflito de concorrência sem sucesso falso",async()=>{m.transaction.mockRejectedValue({code:"P2034"});expect((await call()).status).toBe(409);});
});
