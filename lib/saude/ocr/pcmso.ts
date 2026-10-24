import { z } from "zod";

export const occasions = ["ADMISSIONAL", "PERIODICO", "RETORNO_TRABALHO", "MUDANCA_RISCO", "DEMISSIONAL"] as const;
export const suggestedExamSchema = z.object({
  nome: z.string().trim().min(1).max(200), meses: z.number().int().min(1).max(120),
  ocasioes: z.array(z.enum(occasions)).min(1).max(5), pagina: z.number().int().min(1).max(100),
  trecho: z.string().max(2000),
});
export const suggestedRoleSchema = z.object({
  nome: z.string().trim().min(1).max(200), pagina: z.number().int().min(1).max(100),
  exames: z.array(suggestedExamSchema).max(100), avisos: z.array(z.string().max(500)).max(20),
});
export type SuggestedRole = z.infer<typeof suggestedRoleSchema>;
export type SuggestedExam = z.infer<typeof suggestedExamSchema>;
export interface TextBox { str: string; transform: number[]; width: number }
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const x = (b: TextBox) => b.transform[4];
const y = (b: TextBox) => b.transform[5];
const center = (b: TextBox) => x(b) + b.width / 2;
function join(items: TextBox[]) {
  return [...items].sort((a,b) => Math.abs(y(a)-y(b)) > 2 ? y(b)-y(a) : x(a)-x(b)).map(b => b.str.trim()).join(" ").replace(/\s+/g," ").trim();
}

/** Leitura geométrica de tabelas explícitas. Não deduz exames pelo nome da profissão. */
export function readPcmsoPage(items: TextBox[], pagina: number): { role?: SuggestedRole; clinical?: SuggestedExam } {
  const boxes = items.filter(b => b.str.trim());
  const functionLabel = boxes.find(b => /^funcao\s*:/i.test(norm(b.str)));
  if (!functionLabel) {
    // Regra geral só é reconhecida se a tabela disser literalmente Clínico / Todas,
    // com o mesmo intervalo nas três faixas etárias. Outros eventos exigem revisão manual.
    const clinical = boxes.find(b => norm(b.str) === "clinico");
    if (clinical && boxes.some(b => /periodicidade/i.test(b.str))) {
      const row = boxes.filter(b => Math.abs(y(b)-y(clinical)) < 2);
      const intervals = row.filter(b => /^\d+$/.test(b.str.trim())).map(b => Number(b.str));
      if (row.some(b => norm(b.str) === "todas") && intervals.length === 3 && intervals.every(n => n === intervals[0]) && intervals[0] > 0 && intervals[0] <= 120) {
        return { clinical: { nome: "Exame clínico", meses: intervals[0], ocasioes: ["PERIODICO"], pagina, trecho: join(row) } };
      }
    }
    return {};
  }
  const title = join(boxes.filter(b => Math.abs(y(b)-y(functionLabel)) < 2 && x(b) >= x(functionLabel)));
  const nome = title.replace(/^fun[cç][aã]o\s*:\s*/i, "").replace(/^\d+(?:\s*\.\s*\d+)*\s*[-–]\s*/, "").trim();
  if (!nome || nome.length > 200) return {};
  const role: SuggestedRole = { nome, pagina, exames: [], avisos: [] };
  const header = boxes.find(b => norm(b.str) === "exame" && y(b) < y(functionLabel));
  const period = header && boxes.find(b => norm(b.str) === "periodicidade" && Math.abs(y(b)-y(header)) < 2);
  const source = header && boxes.find(b => norm(b.str) === "fonte geradora" && Math.abs(y(b)-y(header)) < 2);
  if (!header || !period || !source) {
    role.avisos.push("Tabela de exames não reconhecida. Confira e cadastre os exames manualmente.");
    return { role };
  }
  const left = (center(source) + center(header)) / 2;
  const right = x(period) - 2;
  const columns = ["adm.", "per.", "ret. trab.", "mud. risco", "dem."].map(label => boxes.find(b => norm(b.str) === label && Math.abs(y(b)-y(header)) < 2));
  const after = boxes.find(b => norm(b.str) === "apos adm." && Math.abs(y(b)-y(header)) < 2);
  const below = boxes.filter(b => y(b) < y(header)-3);
  const anchors = below.filter(b => /^\d+\s*mes(?:es)?$/i.test(b.str.trim()) && x(b) >= right && center(b) < (columns[0] ? x(columns[0]) : x(period)+period.width+8)).sort((a,b) => y(b)-y(a));
  for (let i=0; i<anchors.length; i++) {
    const anchor = anchors[i];
    const top = i === 0 ? Math.min(y(header)-3,y(anchor)+18) : (y(anchors[i-1])+y(anchor))/2;
    const bottom = i === anchors.length-1 ? y(anchor)-18 : (y(anchor)+y(anchors[i+1]))/2;
    const cells = below.filter(b => y(b) < top && y(b) > bottom);
    const name = join(cells.filter(b => center(b)>left && center(b)<right));
    const meses = Number(anchor.str.match(/\d+/)?.[0]);
    if (!name || name.length>200 || !meses || meses>120 || /nao aplicavel/i.test(norm(name)) || columns.some(c => !c)) {
      role.avisos.push("Uma linha de exames ficou ambígua. Confira a tabela original."); continue;
    }
    const marks = cells.filter(b => /^[xX]$/.test(b.str.trim()));
    const ocasioes = occasions.filter((_, index) => marks.some(m => Math.abs(center(m)-center(columns[index]!)) < 12));
    if (!ocasioes.length) { role.avisos.push(`Confira as ocasiões de ${name}; marcações não identificadas.`); continue; }
    if (after && marks.some(m => Math.abs(center(m)-center(after)) < 12)) role.avisos.push(`${name}: há marcação em Após Adm.; cadastre essa regra manualmente.`);
    role.exames.push({ nome:name, meses, ocasioes:[...ocasioes], pagina, trecho: join(cells) });
  }
  if (!anchors.length) {
    const notApplicable = below.some(b => /nao aplicavel/.test(norm(b.str)) && center(b)>left && center(b)<right);
    role.avisos.push(notApplicable ? "Tabela de exames complementares: Não Aplicável. Confira também as regras gerais de exame clínico." : "Nenhuma linha com periodicidade reconhecida. Confira o original; isso não significa ausência de exames.");
  }
  return { role };
}

export function addClinicalRule(roles: SuggestedRole[], clinical?: SuggestedExam): SuggestedRole[] {
  return roles.map(role => ({ ...role, exames: clinical ? [{ ...clinical, ocasioes: [...clinical.ocasioes] }, ...role.exames] : role.exames,
    avisos: [...role.avisos, clinical ? "Exame clínico periódico incluído pela tabela geral. Confira e cadastre separadamente as regras de admissão, demissão, retorno e mudança de risco e eventuais condições." : "Confira as regras gerais de exame clínico: não foram associadas automaticamente."] }));
}
