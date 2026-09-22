import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { isValidFieldKey } from "@/lib/fields";

const createSchema = z.object({
  username: z.string().trim().min(3, "Login deve ter ao menos 3 caracteres."),
  name: z.string().trim().min(1, "Informe o nome."),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  canEdit: z.boolean().default(true),
  active: z.boolean().default(true),
  visibleFields: z.array(z.string()).default([]),
  allClientes: z.boolean().default(true),
  clienteIds: z.array(z.number().int()).default([]),
  canViewGraficos: z.boolean().default(true),
});

function serializeUser(user: {
  id: number;
  username: string;
  name: string;
  role: string;
  canEdit: boolean;
  active: boolean;
  createdAt: Date;
  allClientes: boolean;
  canViewGraficos: boolean;
  permissions: { fieldKey: string; canView: boolean }[];
  clientes: { clienteId: number }[];
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    canEdit: user.canEdit,
    active: user.active,
    createdAt: user.createdAt,
    visibleFields: user.permissions.filter((p) => p.canView).map((p) => p.fieldKey),
    allClientes: user.allClientes,
    clienteIds: user.clientes.map((c) => c.clienteId),
    canViewGraficos: user.canViewGraficos,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    include: { permissions: true, clientes: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json(users.map(serializeUser));
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;
  const validFieldKeys = data.visibleFields.filter(isValidFieldKey);
  const temporaryPassword = generateRandomPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  // ADMIN always sees every Cliente — the restriction only makes sense for read-only/limited
  // logins created for a specific company.
  const allClientes = data.role === "ADMIN" ? true : data.allClientes;
  const validClienteIds = allClientes
    ? []
    : (await prisma.cliente.findMany({ where: { id: { in: data.clienteIds } }, select: { id: true } })).map(
        (c) => c.id
      );

  try {
    const created = await prisma.user.create({
      data: {
        username: data.username,
        name: data.name,
        passwordHash,
        role: data.role,
        canEdit: data.role === "ADMIN" ? true : data.canEdit,
        active: data.active,
        mustChangePassword: true,
        allClientes,
        canViewGraficos: data.role === "ADMIN" ? true : data.canViewGraficos,
        permissions: {
          create: validFieldKeys.map((fieldKey) => ({ fieldKey, canView: true })),
        },
        clientes: {
          create: validClienteIds.map((clienteId) => ({ clienteId })),
        },
      },
      include: { permissions: true, clientes: true },
    });
    // Only place this ever appears in plaintext — shown once in the response so the admin can
    // hand it to the new user; never logged, never stored anywhere.
    return NextResponse.json({ ...serializeUser(created), temporaryPassword }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe um usuário com esse login." }, { status: 409 });
  }
}
