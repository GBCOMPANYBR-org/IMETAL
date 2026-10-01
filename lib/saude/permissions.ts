import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin as requirePedidosAdmin } from "@/lib/permissions";
import type { SauPermissionKey, SauRole } from "@/lib/saude/permission-keys";

export {
  SAU_ROLES,
  SAU_PERMISSION_KEYS,
  SAU_PERMISSION_LABELS,
  SAU_ROLE_DEFAULTS,
  type SauRole,
  type SauPermissionKey,
} from "@/lib/saude/permission-keys";

export interface SauAuthedUser {
  id: number;
  username: string;
  name: string;
  role: SauRole;
  permissions: Set<SauPermissionKey>;
}

/**
 * Loads the module-access record fresh from the database on every call, same reasoning as
 * getCurrentUser() in lib/permissions.ts: a revoked grant takes effect on the next request,
 * without requiring the user to log in again. Returns null both when the person isn't logged
 * in at all and when they are but have no (active) SauUserAccess row — the caller can't tell
 * these apart from this function alone, which is intentional: neither case gets in.
 */
export async function getCurrentSauUser(): Promise<SauAuthedUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const access = await prisma.sauUserAccess.findUnique({ where: { userId: user.id } });
  if (!access || !access.ativo) return null;

  const perms = await prisma.sauUserPermission.findMany({
    where: { userId: user.id, concedida: true },
  });

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: access.role as SauRole,
    permissions: new Set(perms.map((p) => p.chave as SauPermissionKey)),
  };
}

export async function requireSaudeAccess(
  key?: SauPermissionKey
): Promise<{ user: SauAuthedUser } | { error: NextResponse }> {
  const user = await getCurrentSauUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sem acesso ao módulo de Saúde Ocupacional." }, { status: 403 }) };
  }
  if (key && !user.permissions.has(key)) {
    return { error: NextResponse.json({ error: "Sem permissão para esta ação." }, { status: 403 }) };
  }
  return { user };
}

/**
 * Only the site-wide Pedidos ADMIN can grant or revoke module access — a brand-new
 * SauUserAccess row can't exist yet to authorize its own creation, so this bootstrap
 * authority has to come from outside the module. Every existing ADMIN account already has
 * this power over Pedidos permissions today; extending it to gate entry into Saúde
 * Ocupacional doesn't add a new person who can reach client data, since client-only logins
 * are never ADMIN. Everything *inside* the module, once granted, is governed by
 * SauUserPermission instead.
 */
export const requireSaudeGrantAuthority = requirePedidosAdmin;
