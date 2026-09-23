"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, toDateInputValue } from "@/lib/format";

interface ClienteOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  username: string;
  name: string;
  allClientes: boolean;
  clienteIds: number[];
}

interface SeriesDef {
  key: string;
  label: string;
}

interface ByUserRow {
  userId: number;
  username: string;
  name: string;
  count: number;
}

interface ChartResponse {
  mode: "users" | "aggregate";
  series: SeriesDef[];
  data: Record<string, number | string>[];
  totalCount: number;
  byUser: ByUserRow[];
}

// Fixed categorical order (never cycled) — see the dataviz skill's validated palette.
// Slot 1 (blue) doubles as the single-line color for the aggregate view, matching the
// brand tone already used on the Gráficos page.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const AGGREGATE_COLOR = "#0f2c52";

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

export default function LogsClient() {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [dataFrom, setDataFrom] = useState(() => defaultRange().from);
  const [dataTo, setDataTo] = useState(() => defaultRange().to);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [hideNames, setHideNames] = useState(false);
  const [result, setResult] = useState<ChartResponse>({ mode: "aggregate", series: [], data: [], totalCount: 0, byUser: [] });
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);

  useEffect(() => {
    fetch("/api/options/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/usuarios")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UserOption[]) => setUsers(data))
      .catch(() => setUsers([]));
  }, []);

  const availableUsers = useMemo(
    () => (clienteId ? users.filter((u) => u.clienteIds.includes(clienteId)) : users),
    [users, clienteId]
  );

  // Selecting a Cliente can drop users out of the pickable list — keep the selection in sync
  // instead of silently querying for users the dropdown no longer shows.
  useEffect(() => {
    setSelectedUserIds((prev) => prev.filter((id) => availableUsers.some((u) => u.id === id)));
  }, [availableUsers]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dataFrom) params.set("start", dataFrom);
    if (dataTo) params.set("end", dataTo);
    if (clienteId) params.set("clienteId", String(clienteId));
    if (selectedUserIds.length > 0) params.set("userIds", selectedUserIds.join(","));

    const seq = ++loadSeq.current;
    setLoading(true);
    fetch(`/api/logs/chart-data?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { mode: "aggregate", series: [], data: [], totalCount: 0, byUser: [] }))
      .then((data: ChartResponse) => {
        if (seq === loadSeq.current) setResult(data);
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  }, [dataFrom, dataTo, clienteId, selectedUserIds]);

  const displaySeries = useMemo(
    () =>
      result.series.map((s, i) => ({
        ...s,
        displayLabel: hideNames && result.mode === "users" ? `Usuário ${i + 1}` : s.label,
        color: result.mode === "users" ? CATEGORICAL[i % CATEGORICAL.length] : AGGREGATE_COLOR,
      })),
    [result, hideNames]
  );

  // Ranked by count (the backend already sorts it that way) — numbering off that order reads
  // naturally as "most active first" even with names hidden.
  const displayByUser = useMemo(
    () => result.byUser.map((u, i) => ({ ...u, displayLabel: hideNames ? `Usuário ${i + 1}` : `${u.name} (${u.username})` })),
    [result.byUser, hideNames]
  );

  const hasFilters = clienteId !== null || selectedUserIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
        <div className="flex gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Período de</label>
            <input
              type="date"
              value={dataFrom}
              onChange={(e) => setDataFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">até</label>
            <input
              type="date"
              value={dataTo}
              onChange={(e) => setDataTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Usuários (selecione vários para comparar, até {CATEGORICAL.length})
          </label>
          <select
            multiple
            value={selectedUserIds.map(String)}
            onChange={(e) => setSelectedUserIds(Array.from(e.target.selectedOptions).map((o) => Number(o.value)).slice(0, CATEGORICAL.length))}
            className="h-20 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.username})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setHideNames((v) => !v)}
          title="Oculta os nomes/logins na legenda e no gráfico — mantém só a contagem de acessos, útil pra mostrar pro cliente que a ferramenta está em uso sem expor outros logins"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            hideNames ? "border-brand bg-brand text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100"
          }`}
        >
          {hideNames ? "🙈 Usuários ocultos" : "👁 Ocultar usuários"}
        </button>

        <button
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          🖨 Imprimir
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setClienteId(null);
              setSelectedUserIds([]);
            }}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Print-only header — the sticky nav (with its own logo) is hidden on print, so this
          carries the branding, title and applied period onto the printed page. */}
      <div className="hidden print:mb-4 print:block">
        <div className="flex items-center justify-between border-b border-slate-300 pb-3">
          <Image src="/logo.png" alt="IMETAL" width={140} height={48} className="h-10 w-auto" />
          <div className="text-right">
            <h1 className="text-lg font-semibold text-slate-800">Log de Acessos</h1>
            <p className="text-xs text-slate-500">
              {formatDate(dataFrom)} até {formatDate(dataTo)}
              {hideNames && " — identificação de usuários ocultada"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Total de acessos no período</h2>
        <p className="mt-1 text-3xl font-bold text-slate-800">{result.totalCount}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">
          Acessos por dia{displaySeries.length === 1 ? ` — ${displaySeries[0].displayLabel}` : ""}
        </h2>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Carregando...</p>
        ) : result.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Sem dados para os filtros selecionados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} width={40} />
              <Tooltip labelFormatter={(v) => formatDate(v as string)} />
              {displaySeries.length > 1 && <Legend />}
              {displaySeries.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.displayLabel} stroke={s.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Acessos por usuário</h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Carregando...</p>
        ) : displayByUser.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sem acessos para os filtros selecionados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                <th className="py-1.5 pr-3">{hideNames ? "Login" : "Usuário"}</th>
                <th className="py-1.5 text-right">Acessos</th>
              </tr>
            </thead>
            <tbody>
              {displayByUser.map((u) => (
                <tr key={u.userId} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-3 text-slate-700">{u.displayLabel}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-800">{u.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
