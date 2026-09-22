import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireAuth } from "@/lib/permissions";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres."),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const validCurrent = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!validCurrent) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
