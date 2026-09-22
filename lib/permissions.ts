import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPayload } from "@/lib/auth";
import { PEDIDO_FIELD_KEYS } from "@/lib/fields";

export type Role = "ADMIN" | "USER";

export interface AuthedUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  canEdit: boolean;
  active: boolean;
  isAdmin: boolean;
  visibleFields: Set<string>;
  /** true when the user may see Pedidos from every Cliente (always true for ADMIN). */
  allClientes: boolean;
  /** Only meaningful when allClientes is false — the Cliente ids this user may see. */
  visibleClienteIds: Set<number>;
  /** Whether the user may open the Gráficos page at all (always true for ADMIN). */
  canViewGraficos: boolean;
  /** True until the user sets their own password — every page redirects to /trocar-senha while this holds. */
  mustChangePassword: boolean;
}

/**
 * Loads the current user fresh from the database on every call (role, canEdit and
 * field permissions are re-read each request) so an admin changing someone's
 * permissions takes effect immediately, without requiring the user to log in again.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await getSessionPayload();
  if (!session) return null;

  const record = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { permissions: true, clientes: true },
  });
  if (!record || !record.active) return null;

  const isAdmin = record.role === "ADMIN";
  const visibleFields = new Set<string>(
    isAdmin
      ? PEDIDO_FIELD_KEYS
      : record.permissions.filter((p) => p.canView).map((p) => p.fieldKey)
  );

  return {
    id: record.id,
    username: record.username,
    name: record.name,
    role: record.role as Role,
    canEdit: record.canEdit,
    active: record.active,
    isAdmin,
    visibleFields,
    // Admins always see every Cliente, regardless of the stored restriction.
    allClientes: isAdmin || record.allClientes,
    visibleClienteIds: new Set<number>(record.clientes.map((c) => c.clienteId)),
    canViewGraficos: isAdmin || record.canViewGraficos,
    mustChangePassword: record.mustChangePassword,
  };
}

export async function requireAuth(): Promise<{ user: AuthedUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { user };
}

export async function requireAdmin(): Promise<{ user: AuthedUser } | { error: NextResponse }> {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (!result.user.isAdmin) {
    return { error: NextResponse.json({ error: "Apenas administradores podem executar esta ação." }, { status: 403 }) };
  }
  return result;
}

/** Whether the given user may modify a pedido currently in the given status. */
export function canEditPedidoWithStatus(user: AuthedUser, statusEditable: boolean): boolean {
  if (user.isAdmin) return true;
  return user.canEdit && statusEditable;
}

/** Whether the given user is allowed to see/act on a Pedido belonging to this Cliente. */
export function canAccessCliente(user: AuthedUser, clienteId: number): boolean {
  if (user.allClientes) return true;
  return user.visibleClienteIds.has(clienteId);
}
