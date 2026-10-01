import { z } from "zod";

// Same reasoning as lib/pedido-payload.ts: `.transform()` runs even when a key is entirely
// absent from the request body (a valid value for `.optional()`), so the transform must pass
// `undefined` straight through instead of collapsing it to `null` — otherwise "field not sent"
// and "clear this field" become indistinguishable, silently wiping data on a partial PATCH.
const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null));

export const FUNCIONARIO_STATUS = ["ATIVO", "INATIVO", "AFASTADO"] as const;

export const funcionarioCreateSchema = z.object({
  matricula: z.string().trim().min(1, "Matrícula é obrigatória."),
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  cpf: z.string().trim().min(1, "CPF é obrigatório."),
  rg: optionalTrimmedString,
  dataNascimento: optionalDate,
  dataAdmissao: optionalDate,
  dataDesligamento: optionalDate,
  telefone: optionalTrimmedString,
  email: optionalTrimmedString,
  setor: optionalTrimmedString,
  funcaoPrincipalId: z.number().int().optional().nullable(),
  status: z.enum(FUNCIONARIO_STATUS).default("ATIVO"),
  observacoes: optionalTrimmedString,
});

export const funcionarioUpdateSchema = funcionarioCreateSchema.partial();

export const CLIENTE_STATUS = ["ATIVO", "INATIVO"] as const;

export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  status: z.enum(CLIENTE_STATUS).default("ATIVO"),
  observacoes: optionalTrimmedString,
});

export const clienteUpdateSchema = clienteSchema.partial();

export const unidadeSchema = z.object({
  clienteId: z.number().int(),
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  cnpj: optionalTrimmedString,
  endereco: optionalTrimmedString,
  cidade: optionalTrimmedString,
  estado: optionalTrimmedString,
  contato: optionalTrimmedString,
  telefone: optionalTrimmedString,
  email: optionalTrimmedString,
  status: z.enum(CLIENTE_STATUS).default("ATIVO"),
  observacoes: optionalTrimmedString,
});

export const unidadeUpdateSchema = unidadeSchema.partial().omit({ clienteId: true });

export const funcaoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
});

export const alocacaoCreateSchema = z.object({
  clienteId: z.number().int(),
  unidadeId: z.number().int(),
  funcaoId: z.number().int(),
  dataInicio: z.string().min(1, "Data de início é obrigatória.").transform((v) => new Date(v)),
  observacoes: optionalTrimmedString,
});

export const PERIODICIDADES = ["ADMISSIONAL", "PERIODICO", "RETORNO_TRABALHO", "MUDANCA_RISCO", "DEMISSIONAL", "OUTRO"] as const;

const requiredDate = z.string().min(1, "Data é obrigatória.").transform((v) => new Date(v));

export const pcmsoVersaoCreateSchema = z.object({
  unidadeId: z.number().int(),
  versao: z.string().trim().min(1, "Versão é obrigatória."),
  titulo: optionalTrimmedString,
  dataDocumento: optionalDate,
  inicioVigencia: requiredDate,
  fimVigencia: optionalDate,
  medicoResponsavel: optionalTrimmedString,
  crm: optionalTrimmedString,
  observacoes: optionalTrimmedString,
  blobUrl: z.string().url(),
  filename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
});

export const pcmsoFuncaoAddSchema = z.object({
  funcaoNome: z.string().trim().min(1, "Função é obrigatória."),
});

export const pcmsoRiscoAddSchema = z.object({
  nome: z.string().trim().min(1, "Risco é obrigatório."),
});

export const pcmsoRequisitoAddSchema = z.object({
  tipoExameNome: z.string().trim().min(1, "Exame é obrigatório."),
  periodicidade: z.enum(PERIODICIDADES),
  periodicidadeDetalhe: optionalTrimmedString,
  obrigatorio: z.boolean().default(true),
});

export const ASO_TIPOS = ["ADMISSIONAL", "PERIODICO", "RETORNO_TRABALHO", "MUDANCA_RISCO", "DEMISSIONAL", "OUTRO"] as const;

export const asoCreateSchema = z.object({
  alocacaoId: z.number().int().optional().nullable(),
  tipo: z.enum(ASO_TIPOS),
  data: requiredDate,
  funcaoDeclarada: optionalTrimmedString,
  resultadoDeclarado: optionalTrimmedString,
  medicoNome: optionalTrimmedString,
  medicoCrm: optionalTrimmedString,
  blobUrl: z.string().url(),
  filename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
});

export const asoUpdateSchema = z.object({
  tipo: z.enum(ASO_TIPOS).optional(),
  data: requiredDate.optional(),
  funcaoDeclarada: optionalTrimmedString,
  resultadoDeclarado: optionalTrimmedString,
  medicoNome: optionalTrimmedString,
  medicoCrm: optionalTrimmedString,
});

export const exameCreateSchema = z.object({
  tipoExameNome: z.string().trim().min(1, "Tipo de exame é obrigatório."),
  dataRealizacao: requiredDate,
  dataValidade: optionalDate,
  resultadoDocumental: optionalTrimmedString,
  laboratorio: optionalTrimmedString,
  profissional: optionalTrimmedString,
  observacoes: optionalTrimmedString,
  blobUrl: z.string().url().optional(),
  filename: z.string().trim().min(1).optional(),
  mimeType: z.string().trim().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const exameUpdateSchema = exameCreateSchema.omit({ tipoExameNome: true }).partial().extend({
  tipoExameNome: z.string().trim().min(1).optional(),
});
