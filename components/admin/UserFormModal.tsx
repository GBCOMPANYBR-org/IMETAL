"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { PEDIDO_FIELDS } from "@/lib/fields";

export interface UserRecord {
  id: number;
  username: string;
  name: string;
  role: "ADMIN" | "USER";
  canEdit: boolean;
  active: boolean;
  visibleFields: string[];
  allClientes: boolean;
  clienteIds: number[];
  canViewGraficos: boolean;
}

interface ClienteOption {
  id: number;
  name: string;
}

interface Props {
  mode: "create" | "edit";
  user: UserRecord | null;
  onClose: () => void;
  /** Called after a successful save — carries the one-time temporary password when one was generated. */
  onSaved: (result: { username: string; temporaryPassword?: string }) => void;
}

export default function UserFormModal({ mode, user, onClose, onSaved }: Props) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [generateTemporaryPassword, setGenerateTemporaryPassword] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "USER">(user?.role ?? "USER");
  const [canEdit, setCanEdit] = useState(user?.canEdit ?? true);
  const [active, setActive] = useState(user?.active ?? true);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set(user?.visibleFields ?? []));
  const [allClientes, setAllClientes] = useState(user?.allClientes ?? true);
  const [clienteIds, setClienteIds] = useState<Set<number>>(new Set(user?.clienteIds ?? []));
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [canViewGraficos, setCanViewGraficos] = useState(user?.canViewGraficos ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = visibleFields.size === PEDIDO_FIELDS.length;

  useEffect(() => {
    fetch("/api/options/clientes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ClienteOption[]) => setClientes(data))
      .catch(() => setClientes([]));
  }, []);

  function toggleField(key: string) {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCliente(id: number) {
    setClienteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        role,
        canEdit: role === "ADMIN" ? true : canEdit,
        active,
        visibleFields: Array.from(visibleFields),
        allClientes: role === "ADMIN" ? true : allClientes,
        clienteIds: Array.from(clienteIds),
        canViewGraficos: role === "ADMIN" ? true : canViewGraficos,
      };
      if (mode === "create") {
        payload.username = username;
        // No password field on create — the server always generates a temporary one and returns
        // it once; the new user is forced to set their own on first login.
      } else if (generateTemporaryPassword) {
        payload.generateTemporaryPassword = true;
      } else if (password) {
        payload.password = password;
      }

      const url = mode === "create" ? "/api/usuarios" : `/api/usuarios/${user!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível salvar o usuário.");
        return;
      }
      const saved = await res.json();
      onSaved({ username: saved.username, temporaryPassword: saved.temporaryPassword });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "Novo usuário" : `Editar usuário: ${user?.username}`} onClose={onClose} widthClassName="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Login</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={mode === "edit"}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {mode === "create" ? (
            <div className="sm:col-span-2">
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Uma senha temporária será gerada automaticamente e mostrada na próxima tela — o usuário será obrigado a trocá-la no primeiro acesso.
              </p>
            </div>
          ) : (
            <div className="sm:col-span-2 space-y-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">Senha</label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={generateTemporaryPassword}
                  onChange={(e) => {
                    setGenerateTemporaryPassword(e.target.checked);
                    if (e.target.checked) setPassword("");
                  }}
                />
                Gerar nova senha temporária (o usuário será obrigado a trocá-la no próximo login)
              </label>
              {!generateTemporaryPassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ou digite uma nova senha (deixe em branco para manter a atual)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Perfil</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="USER">Usuário</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={role === "ADMIN" ? true : canEdit} disabled={role === "ADMIN"} onChange={(e) => setCanEdit(e.target.checked)} />
            Pode editar pedidos (senão, acesso somente leitura)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Usuário ativo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={role === "ADMIN" ? true : canViewGraficos}
              disabled={role === "ADMIN"}
              onChange={(e) => setCanViewGraficos(e.target.checked)}
            />
            Pode acessar Gráficos
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-600">Colunas visíveis para este usuário</label>
            <button
              type="button"
              onClick={() => setVisibleFields(allSelected ? new Set() : new Set(PEDIDO_FIELDS.map((f) => f.key)))}
              className="text-xs font-medium text-brand hover:underline"
            >
              {allSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            {PEDIDO_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={visibleFields.has(f.key)} onChange={() => toggleField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Empresas visíveis para este usuário</label>
          {role === "ADMIN" ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              Administradores sempre veem pedidos de todas as empresas.
            </p>
          ) : (
            <>
              <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={allClientes} onChange={(e) => setAllClientes(e.target.checked)} />
                Ver pedidos de todas as empresas (uso interno IMETAL)
              </label>
              {!allClientes && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {clientes.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={clienteIds.has(c.id)} onChange={() => toggleCliente(c.id)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  {clienteIds.size === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Selecione ao menos uma empresa — sem isso, este usuário não verá nenhum pedido.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
