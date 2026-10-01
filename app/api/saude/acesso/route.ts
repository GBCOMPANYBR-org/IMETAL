import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSaudeGrantAuthority,
  SAU_PERMISSION_KEYS,
  SAU_ROLES,
  SAU_ROLE_DEFAULTS,
  type SauPermissionKey,
  type SauRole,
} from "@/lib/saude/permissions";
import { registrarAuditoria } from "@/lib/saude/auditoria";

// Only the site-wide ADMIN (same authority that already manages Pedidos permissions) can grant
// or revoke entry into the Saúde Ocupacional module — see requireSaudeGrantAuthority for why.

export async function GET(): Promise<NextResponse> {
  const auth = await requireSaudeGrantAuthority();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { sauAccess: true, sauPermissions: true },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      allClientes: u.allClientes,
      sauAtivo: u.sauAccess?.ativo ?? false,
      sauRole: (u.sauAccess?.role as SauRole | undefined) ?? null,
      sauPermissions: Object.fromEntries(u.sauPermissions.map((p) => [p.chave, p.concedida])),
    }))
  );
}

interface GrantBody {
  userId: number;
  role: SauRole;
  ativo: boolean;
  permissions?: Partial<Record<SauPermissionKey, boolean>>;
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSaudeGrantAuthority();
  if ("error" in auth) return auth.error;

  let body: GrantBody;
  try {
    body = (await request.json()) as GrantBody;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { userId, role, ativo, permissions } = body;

  if (typeof userId !== "number" || !SAU_ROLES.some((r) => r.value === role) || typeof ativo !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const before = await prisma.sauUserAccess.findUnique({ where: { userId } });

  await prisma.$transaction(async (tx) => {
    await tx.sauUserAccess.upsert({
      where: { userId },
      create: { userId, role, ativo, concedidoPorId: auth.user.id },
      update: { role, ativo, concedidoPorId: auth.user.id, concedidoEm: new Date() },
    });

    for (const key of SAU_PERMISSION_KEYS) {
      const concedida = permissions?.[key] ?? SAU_ROLE_DEFAULTS[role].includes(key);
      await tx.sauUserPermission.upsert({
        where: { userId_chave: { userId, chave: key } },
        create: { userId, chave: key, concedida },
        update: { concedida },
      });
    }
  });

  await registrarAuditoria({
    entidade: "SauUserAccess",
    entidadeId: userId,
    acao: before ? "ATUALIZOU_ACESSO" : "CONCEDEU_ACESSO",
    userId: auth.user.id,
    antes: before ? { role: before.role, ativo: before.ativo } : null,
    depois: { role, ativo },
  });

  return NextResponse.json({ ok: true });
}
