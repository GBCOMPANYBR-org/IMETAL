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
