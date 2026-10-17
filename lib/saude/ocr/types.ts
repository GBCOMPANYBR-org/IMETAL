import { z } from "zod";

export const extractionSchema = z.object({
  documentId: z.number().int().positive(),
  pages: z.array(z.object({
    page: z.number().int().positive().max(100),
    method: z.enum(["text", "ocr"]),
    text: z.string().max(100000),
  })).min(1).max(100),
  text: z.string().trim().min(1, "Nenhum texto identificado. Confira o arquivo original.").max(500000),
  edited: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.pages.some((p, i) => p.page !== i + 1) || v.pages.reduce((n, p) => n + p.text.length, 0) > 500000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Páginas inválidas ou texto acima do limite." });
  }
});
export type Extraction = z.infer<typeof extractionSchema>;
