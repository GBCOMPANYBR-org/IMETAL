"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import UnidadeFormModal, { type UnidadeRecord } from "@/components/saude/UnidadeFormModal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

interface ClienteRecord {
  id: number;
  nome: string;
  status: "ATIVO" | "INATIVO";
  observacoes: string | null;
  unidades: UnidadeRecord[];
}

export default function ClientesManager({ canEdit }: { canEdit: boolean }) {
  const [clientes, setClientes] = useState<ClienteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoCliente, setNovoCliente] = useState(false);
  const [unidadeTarget, setUnidadeTarget] = useState<{ clienteId: number; unidade: UnidadeRecord | "new" } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/saude/clientes");
    if (res.ok) setClientes(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setNovoCliente(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light">
            + Novo cliente
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : clientes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Nenhum cliente cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {clientes.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <span className="font-semibold text-slate-700">{c.nome}</span>
                  {c.status === "INATIVO" && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Inativo</span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => setUnidadeTarget({ clienteId: c.id, unidade: "new" })}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    + Nova unidade
                  </button>
                )}
              </div>

              {c.unidades.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">Nenhuma unidade cadastrada.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {c.unidades.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">{u.nome}</span>
                        {u.cidade && <span className="ml-2 text-slate-400">{u.cidade}{u.estado ? `/${u.estado}` : ""}</span>}
                        {u.status === "INATIVO" && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Inativo</span>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => setUnidadeTarget({ clienteId: c.id, unidade: u })}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Editar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {novoCliente && <ClienteFormModal onClose={() => setNovoCliente(false)} onSaved={() => { setNovoCliente(false); load(); }} />}

      {unidadeTarget && (
        <UnidadeFormModal
          clienteId={unidadeTarget.clienteId}
          unidade={unidadeTarget.unidade}
          onClose={() => setUnidadeTarget(null)}
          onSaved={() => {
            setUnidadeTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ClienteFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/saude/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, observacoes: observacoes || null }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível salvar.");
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Novo cliente" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Nome <span className="text-red-400">*</span>
          </span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required className={INPUT_CLS} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Observações</span>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={INPUT_CLS} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
