import { describe,it,expect } from "vitest";
import {readPcmsoPage,addClinicalRule,type TextBox} from "./pcmso";
const b=(str:string,x:number,y:number,width=40):TextBox=>({str,transform:[1,0,0,1,x,y],width});
function table(name="Função: 5.1.1 - Operador") { return [b(name,20,500),b("Fonte Geradora",240,300,74),b("Exame",390,300,32),b("Periodicidade",465,300,65),b("Adm.",538,300,24),b("Após Adm.",570,300,52),b("Per.",633,300,19),b("Ret. Trab.",667,300,46),b("Mud. Risco",724,300,53),b("Dem.",785,300,24)]; }
describe("Tabelas explícitas de PCMSO",()=>{
 it("une nome em duas linhas e preserva os X nas colunas corretas",()=>{
  const data=[...table(),b("Audiometria tonal",365,280,77),b("ocupacional",376,268,53),b("12 meses",474,274,43),b("X",546,274,6),b("X",640,274,6),b("X",794,274,6),b("Fonte que não é exame",240,274,95)];
  const r=readPcmsoPage(data,4).role!; expect(r.nome).toBe("Operador");expect(r.exames).toHaveLength(1);expect(r.exames[0]).toMatchObject({nome:"Audiometria tonal ocupacional",meses:12,ocasioes:["ADMISSIONAL","PERIODICO","DEMISSIONAL"],pagina:4});
 });
 it("não associa exame a função de outra página",()=>{ expect(readPcmsoPage([b("Audiometria",390,270),b("12 meses",474,270)],5).role).toBeUndefined(); });
 it("não interpreta Não Aplicável como exame nem dispensa clínica geral",()=>{
  const r=readPcmsoPage([...table(),b("Não Aplicável",370,270,70)],3).role!;
  expect(r.exames).toEqual([]);expect(r.avisos[0]).toContain("regras gerais");
 });
 it("não inventa exames com base no nome da função",()=>{ const r=readPcmsoPage(table("Função: Soldador"),2).role!; expect(r.exames).toEqual([]);expect(r.avisos[0]).toContain("não significa ausência"); });
 it("marcações ausentes exigem revisão e não viram requisitos",()=>{ const r=readPcmsoPage([...table(),b("Exame exemplo",370,270,70),b("24 meses",474,270,43)],2).role!;expect(r.exames).toEqual([]);expect(r.avisos[0]).toContain("marcações"); });
 it("reconhece apenas regra clínica explícita Todas com intervalos iguais",()=>{
  const data=[b("Periodicidade",60,400),b("Clínico",30,300),b("Todas",100,300),b("12",200,300),b("12",250,300),b("12",300,300)];
  const clinical=readPcmsoPage(data,1).clinical!;expect(clinical.meses).toBe(12);
  expect(addClinicalRule([{nome:"A",pagina:2,exames:[],avisos:[]}],clinical)[0].exames[0].pagina).toBe(1);
  expect(readPcmsoPage([...data.slice(0,-1),b("6",300,300)],1).clinical).toBeUndefined();
 });
});
