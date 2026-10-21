import { prisma } from "@/lib/prisma";
import { NEW_PEDIDO_ALERT_PERMISSION, NEW_PEDIDO_CURSOR_PREFIX, type AuthedUser } from "@/lib/permissions";

// Pedidos com o mesmo número de compra são um único alerta; sem número, cada ID é independente.
// Só a primeira criação daquele número conta como pedido novo. Respeita a visibilidade do cliente.
export async function getNovosPedidos(user: AuthedUser) {
  if (!user.canAlertNewPedido) return { count: 0, ids: [] as number[], maxId: 0 };
  const rows = await prisma.fieldPermission.findMany({
    where: { userId: user.id, OR: [{ fieldKey: NEW_PEDIDO_ALERT_PERMISSION }, { fieldKey: { startsWith: NEW_PEDIDO_CURSOR_PREFIX } }] },
    select: { fieldKey: true, canView: true },
  });
  if (!rows.some(p => p.fieldKey === NEW_PEDIDO_ALERT_PERMISSION && p.canView)) return { count: 0, ids: [] as number[], maxId: 0 };
  const cursor = Math.max(0, ...rows.filter(p=>p.fieldKey.startsWith(NEW_PEDIDO_CURSOR_PREFIX)).map(p=>Number(p.fieldKey.slice(NEW_PEDIDO_CURSOR_PREFIX.length)) || 0));
  const pedidos = await prisma.pedido.findMany({
    where: user.allClientes ? {} : { clienteId: { in: [...user.visibleClienteIds] } },
    select: { id: true, pedidoCompra: true },
    orderBy: { id: "asc" },
  });
  const seen = new Set<string>();
  const newGroups = new Set<string>();
  const ids: number[] = [];
  for (const p of pedidos) {
    const number = p.pedidoCompra?.trim();
    const key = number ? number.toLocaleUpperCase("pt-BR") : `__sem_numero_${p.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (p.id > cursor) newGroups.add(key);
    }
    if (newGroups.has(key)) ids.push(p.id);
  }
  return { count: newGroups.size, ids, maxId: pedidos.at(-1)?.id ?? cursor };
}
