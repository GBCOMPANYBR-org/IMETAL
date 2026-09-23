import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

// A line chart with more than 8 series stops being readable and the categorical
// palette itself is only validated up to 8 slots — cap here so the API can never
// be asked (via URL) for more than the UI ever offers.
const MAX_USERS = 8;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Mirrors lib/pedido-filters.ts's endOfDay — UTC boundary so the cutoff doesn't
// shift with the server process's local timezone.
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const clienteIdParam = searchParams.get("clienteId");
  const userIdsParam = searchParams.get("userIds");

  const defaultEnd = startOfDay(new Date());
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

  let start = startParam && !Number.isNaN(new Date(startParam).getTime()) ? startOfDay(new Date(startParam)) : defaultStart;
  let end = endParam && !Number.isNaN(new Date(endParam).getTime()) ? endOfDay(new Date(endParam)) : endOfDay(defaultEnd);
  if (start > end) {
    [start, end] = [startOfDay(end), endOfDay(start)];
  }

  const explicitUserIds = (userIdsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_USERS);
  const clienteId = clienteIdParam ? Number(clienteIdParam) : null;

  let mode: "users" | "aggregate" = "aggregate";
  let scopeUserIds: number[] | null = null;
  let seriesDefs: { key: string; label: string }[] = [];

  if (explicitUserIds.length > 0) {
    mode = "users";
    const users = await prisma.user.findMany({
      where: { id: { in: explicitUserIds } },
      select: { id: true, username: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    // Preserve the order the caller selected, not the DB's default order.
    seriesDefs = explicitUserIds
      .map((id) => byId.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ key: `u${u.id}`, label: u.name || u.username }));
    scopeUserIds = seriesDefs.map((s) => Number(s.key.slice(1)));
  } else if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    const links = await prisma.userCliente.findMany({ where: { clienteId }, select: { userId: true } });
    scopeUserIds = links.map((l) => l.userId);
    seriesDefs = [{ key: "total", label: cliente ? cliente.name : "Total" }];
  } else {
    seriesDefs = [{ key: "total", label: "Total de acessos" }];
  }

  const events =
    scopeUserIds && scopeUserIds.length === 0
      ? []
      : await prisma.loginEvent.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            ...(scopeUserIds ? { userId: { in: scopeUserIds } } : {}),
          },
          select: { userId: true, createdAt: true },
        });

  const byDay = new Map<string, Map<string, number>>();
  for (const ev of events) {
    const day = toDayKey(ev.createdAt);
    const seriesKey = mode === "users" ? `u${ev.userId}` : "total";
    if (!byDay.has(day)) byDay.set(day, new Map());
    const dayMap = byDay.get(day)!;
    dayMap.set(seriesKey, (dayMap.get(seriesKey) ?? 0) + 1);
  }

  // Fill every day in range, even at zero, so the lines stay continuous.
  const data: Record<string, number | string>[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = toDayKey(cursor);
    const dayMap = byDay.get(day);
    const row: Record<string, number | string> = { date: day };
    for (const s of seriesDefs) row[s.key] = dayMap?.get(s.key) ?? 0;
    data.push(row);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return NextResponse.json({ mode, series: seriesDefs, data, totalCount: events.length });
}
