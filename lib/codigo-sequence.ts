import { prisma } from "@/lib/prisma";

const PREFIX = "PRD";
const DEFAULT_WIDTH = 5;
const CODIGO_PATTERN = /^PRD(\d+)$/;

/**
 * Auto-generates the next Código for a new Pedido left blank at creation — "PRD" followed by a
 * zero-padded sequential number (e.g. "PRD02070"), one past the highest existing PRD-numbered
 * Código in the system. Not scoped by Cliente: it's one global counter, so it never collides
 * regardless of which Cliente the new Pedido belongs to.
 */
export async function generateNextCodigo(): Promise<string> {
  const candidates = await prisma.pedido.findMany({
    where: { codigo: { startsWith: PREFIX } },
    select: { codigo: true },
    distinct: ["codigo"],
  });

  let maxNum = 0;
  let width = DEFAULT_WIDTH;
  for (const { codigo } of candidates) {
    const m = codigo ? CODIGO_PATTERN.exec(codigo) : null;
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (num > maxNum) {
      maxNum = num;
      width = m[1].length;
    }
  }

  return PREFIX + String(maxNum + 1).padStart(width, "0");
}
