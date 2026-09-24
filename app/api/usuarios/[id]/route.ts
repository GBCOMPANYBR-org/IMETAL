import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { isValidFieldKey } from "@/lib/fields";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres.").optional().or(z.literal("")),
    /** Ignores `password` above — generates a new random one and forces a change on next login. */
    generateTemporaryPassword: z.boolean().optional(),
    role: z.enum(["ADMIN", "USER"]).optional(),
    canEdit: z.boolean().optional(),
    active: z.boolean().optional(),
    visibleFields: z.array(z.string()).optional(),
    allClientes: z.boolean().optional(),
    clienteIds: z.array(z.number().int()).optional(),
    canViewGraficos: z.boolean().optional(),
  })
  // The handler below only resyncs UserCliente rows when clienteIds is present — sending
  // allClientes alone would silently leave stale/empty Cliente grants in place while flipping
  // the flag, hiding every Pedido from the user with no indication why. The shipped UI always
  // sends both together, so this only guards against a future/external caller doing it wrong.
  .refine((data) => data.allClientes === undefined || data.clienteIds !== undefined, {
    message: "clienteIds deve ser enviado junto de allClientes.",
    path: ["clienteIds"],
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

async function countActiveAdmins() {
  return prisma.user.count({ where: { role: "ADMIN", active: true } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const targetId = Number(id);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const demotingSelf = target.role === "ADMIN" && (data.role === "USER" || data.active === false);
  if (demotingSelf && target.id === auth.user.id) {
    const admins = await countActiveAdmins();
    if (admins <= 1) {
      return NextResponse.json(
        { error: "Não é possível remover o acesso de administrador do único ADMIN ativo." },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.canEdit !== undefined) updateData.canEdit = data.canEdit;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.allClientes !== undefined) updateData.allClientes = data.allClientes;
  if (data.canViewGraficos !== undefined) updateData.canViewGraficos = data.canViewGraficos;
  const effectiveRole = data.role ?? target.role;
  if (effectiveRole === "ADMIN") {
    updateData.canEdit = true;
    // ADMIN always sees every Cliente and always has Gráficos access — these restrictions only
    // apply to non-admin logins.
    updateData.allClientes = true;
    updateData.canViewGraficos = true;
  }
  let temporaryPassword: string | undefined;
  if (data.generateTemporaryPassword) {
    temporaryPassword = generateRandomPassword();
    updateData.passwordHash = await hashPassword(temporaryPassword);
    updateData.mustChangePassword = true;
  } else if (data.password) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.visibleFields !== undefined) {
      await tx.fieldPermission.deleteMany({ where: { userId: targetId } });
      const validFieldKeys = data.visibleFields.filter(isValidFieldKey);
      if (validFieldKeys.length > 0) {
        await tx.fieldPermission.createMany({
          data: validFieldKeys.map((fieldKey) => ({ userId: targetId, fieldKey, canView: true })),
        });
      }
    }
    if (data.clienteIds !== undefined && effectiveRole !== "ADMIN") {
      await tx.userCliente.deleteMany({ where: { userId: targetId } });
      const validClientes = await tx.cliente.findMany({ where: { id: { in: data.clienteIds } }, select: { id: true } });
      if (validClientes.length > 0) {
        await tx.userCliente.createMany({
          data: validClientes.map((c) => ({ userId: targetId, clienteId: c.id })),
        });
      }
    } else if (effectiveRole === "ADMIN") {
      await tx.userCliente.deleteMany({ where: { userId: targetId } });
    }
    return tx.user.update({
      where: { id: targetId },
      data: updateData,
      include: { permissions: true, clientes: true },
    });
  });

  return NextResponse.json({ ...serializeUser(updated), temporaryPassword });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const targetId = Number(id);

  if (targetId === auth.user.id) {
    return NextResponse.json({ error: "Você não pode excluir o seu próprio usuário." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (target.role === "ADMIN" && target.active) {
    const admins = await countActiveAdmins();
    if (admins <= 1) {
      return NextResponse.json({ error: "Não é possível excluir o único ADMIN ativo." }, { status: 409 });
    }
  }

  // ObservacaoMention.mentionedUserId has no onDelete: Cascade — it carries pendência audit
  // history (who resolved it and how) that must survive the mentioned user going away. Block the
  // hard delete instead, same as the "last active ADMIN" guard above; `active: false` remains the
  // supported way to retire an account that has Fórum history.
  const mentionCount = await prisma.observacaoMention.count({ where: { mentionedUserId: targetId } });
  if (mentionCount > 0) {
    return NextResponse.json(
      { error: "Este usuário tem pendências de Fórum vinculadas — desative-o em vez de excluir." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: targetId } });
  return NextResponse.json({ ok: true });
}
