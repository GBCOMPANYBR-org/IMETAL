import { prisma } from "@/lib/prisma";
import { makeOptionListRoutes } from "@/lib/option-list";

const routes = makeOptionListRoutes(prisma.pagamento, "Pagamento", "label");

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return routes.update(req, Number(id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return routes.remove(Number(id));
}
