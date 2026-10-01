import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaudeAccess } from "@/lib/saude/permissions";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireSaudeAccess("pcmso.view");
  if ("error" in auth) return auth.error;

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "PCMSO inválido." }, { status: 400 });

  const versao = await prisma.sauPcmsoVersao.findUnique({
    where: { id },
    include: {
      unidade: { include: { cliente: true } },
      documento: true,
      funcoes: {
        include: {
          funcao: true,
          riscos: { include: { risco: true } },
          requisitos: { include: { tipoExame: true }, orderBy: { id: "asc" } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!versao) return NextResponse.json({ error: "PCMSO não encontrado." }, { status: 404 });

  return NextResponse.json(versao);
}
