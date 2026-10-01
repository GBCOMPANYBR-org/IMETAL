"use client";

import { useEffect, useState } from "react";
import {
  SAU_PERMISSION_KEYS,
  SAU_PERMISSION_LABELS,
  SAU_ROLES,
  SAU_ROLE_DEFAULTS,
  type SauPermissionKey,
  type SauRole,
} from "@/lib/saude/permission-keys";

interface UserRow {
  id: number;
  username: string;
  name: string;
  allClientes: boolean;
  sauAtivo: boolean;
  sauRole: SauRole | null;
  sauPermissions: Partial<Record<SauPermissionKey, boolean>>;
}

export default function AcessoManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/saude/acesso");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(row: UserRow, role: SauRole, ativo: boolean, permissions: Partial<Record<SauPermissionKey, boolean>>) {
    setSaving(true);
    const res = await fetch("/api/saude/acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.id, role, ativo, permissions }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Não foi possível salvar.");
      return;
    }
    await load();
  }

  function handleGrant(row: UserRow) {
    if (row.allClientes === false) {
      const ok = confirm(
        `"${row.name}" parece ser uma conta de cliente (visibilidade restrita a uma empresa em Pedidos). Conceder acesso à Saúde Ocupacional mesmo assim?`
      );
      if (!ok) return;
    }
    setExpandedId(row.id);
  }

  function handleRevoke(row: UserRow) {
    if (!confirm(`Revogar o acesso de "${row.name}" ao módulo de Saúde Ocupacional?`)) return;
    save(row, row.sauRole ?? "VISUALIZACAO", false, row.sauPermissions);
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Nenhum usuário tem acesso por padrão. Conceder aqui é a única forma de alguém abrir{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/saude</code>. Contas de cliente (marcadas abaixo)
        normalmente não devem receber acesso.
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Nome</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Login</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Acesso</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Perfil</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <UserRowView
                  key={row.id}
                  row={row}
                  expanded={expandedId === row.id}
                  saving={saving}
                  onGrant={() => handleGrant(row)}
                  onRevoke={() => handleRevoke(row)}
                  onCollapse={() => setExpandedId(null)}
                  onSave={(role, permissions) => {
                    save(row, role, true, permissions);
                    setExpandedId(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserRowView({
  row,
  expanded,
  saving,
  onGrant,
  onRevoke,
  onCollapse,
  onSave,
}: {
  row: UserRow;
  expanded: boolean;
  saving: boolean;
  onGrant: () => void;
  onRevoke: () => void;
  onCollapse: () => void;
  onSave: (role: SauRole, permissions: Partial<Record<SauPermissionKey, boolean>>) => void;
}) {
  const [role, setRole] = useState<SauRole>(row.sauRole ?? "VISUALIZACAO");
  const [permissions, setPermissions] = useState<Partial<Record<SauPermissionKey, boolean>>>(
    row.sauPermissions && Object.keys(row.sauPermissions).length > 0
      ? row.sauPermissions
      : Object.fromEntries(SAU_ROLE_DEFAULTS[role].map((k) => [k, true]))
  );

  function applyRoleDefaults(nextRole: SauRole) {
    setRole(nextRole);
    setPermissions(Object.fromEntries(SAU_PERMISSION_KEYS.map((k) => [k, SAU_ROLE_DEFAULTS[nextRole].includes(k)])));
  }

  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-4 py-2 font-medium text-slate-700">
          {row.name}
          {row.allClientes === false && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              conta de cliente
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-slate-600">{row.username}</td>
        <td className="px-4 py-2">
          <span className={`text-xs font-medium ${row.sauAtivo ? "text-emerald-600" : "text-slate-400"}`}>
            {row.sauAtivo ? "Concedido" : "Sem acesso"}
          </span>
        </td>
        <td className="px-4 py-2 text-slate-600">
          {row.sauRole ? SAU_ROLES.find((r) => r.value === row.sauRole)?.label : "—"}
        </td>
        <td className="px-4 py-2 text-right">
          {row.sauAtivo ? (
            <div className="inline-flex gap-2">
              <button onClick={() => (expanded ? onCollapse() : onGrant())} className="text-xs font-semibold text-brand hover:underline">
                Editar
              </button>
              <button onClick={onRevoke} className="text-xs font-semibold text-red-500 hover:underline">
                Revogar
              </button>
            </div>
          ) : (
            <button onClick={onGrant} className="text-xs font-semibold text-brand hover:underline">
              Conceder acesso
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={5} className="px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-500">Perfil</label>
              <select
                value={role}
                onChange={(e) => applyRoleDefaults(e.target.value as SauRole)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                {SAU_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">Escolher um perfil aplica um conjunto padrão de permissões, ajustável abaixo.</span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {SAU_PERMISSION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={permissions[key] ?? false}
                    onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {SAU_PERMISSION_LABELS[key]}
                </label>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={saving}
                onClick={() => onSave(role, permissions)}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
              >
                Salvar
              </button>
              <button onClick={onCollapse} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
