"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

interface UnidadeOption {
  id: number;
  nome: string;
  clienteId: number;
}

interface ClienteOption {
  id: number;
  nome: string;
  unidades: UnidadeOption[];
}

interface FuncaoOption {
  id: number;
  nome: string;
}

interface AlocacaoRecord {
  id: number;
  dataInicio: string;
  dataFim: string | null;
  status: "ATIVA" | "ENCERRADA";
  observacoes: string | null;
  cliente: { nome: string };
  unidade: { nome: string };
  funcao: { nome: string };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function AlocacaoSection({ funcionarioId, canEdit }: { funcionarioId: number; canEdit: boolean }) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoRecord[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await fetch(`/api/saude/funcionarios/${funcionarioId}`);
    if (res.ok) {
      const data = await res.json();
      setAlocacoes(data.alocacoes);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId]);

  const ativa = alocacoes?.find((a) => a.status === "ATIVA") ?? null;
  const historico = alocacoes?.filter((a) => a.status !== "ATIVA") ?? [];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Alocação</h2>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-brand hover:underline">
            + Nova alocação
          </button>
        )}
      </div>

      {alocacoes === null ? (
        <p className="mt-2 text-sm text-slate-400">Carregando...</p>
      ) : ativa ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <span className="font-semibold text-emerald-700">{ativa.cliente.nome}</span>
          <span className="text-emerald-700"> — {ativa.unidade.nome}</span>
          <span className="text-emerald-600"> · {ativa.funcao.nome}</span>
          <div className="mt-0.5 text-xs text-emerald-600">desde {formatDate(ativa.dataInicio)}</div>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">Sem alocação ativa.</p>
      )}

      {historico.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico</h3>
          <ul className="mt-1.5 space-y-1.5">
            {historico.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                <span className="font-medium text-slate-600">{a.cliente.nome} — {a.unidade.nome}</span> · {a.funcao.nome} ·{" "}
                {formatDate(a.dataInicio)} a {formatDate(a.dataFim)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <AlocacaoFormModal
          funcionarioId={funcionarioId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AlocacaoFormModal({
  funcionarioId,
  onClose,
  onSaved,
}: {
  funcionarioId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [unidadeId, setUnidadeId] = useState<number | "">("");
  const [funcaoNome, setFuncaoNome] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saude/clientes").then((res) => (res.ok ? res.json() : [])).then(setClientes).catch(() => undefined);
    fetch("/api/saude/funcoes").then((res) => (res.ok ? res.json() : [])).then(setFuncoes).catch(() => undefined);
  }, []);

  const unidadesDoCliente = clientes.find((c) => c.id === clienteId)?.unidades ?? [];

  async function resolveFuncaoId(): Promise<number | null> {
    const trimmed = funcaoNome.trim();
    const existing = funcoes.find((f) => f.nome.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    const res = await fetch("/api/saude/funcoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: trimmed }),
    });
    if (!res.ok) return null;
    const created = (await res.json()) as FuncaoOption;
    return created.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !unidadeId || !funcaoNome.trim()) {
      setError("Preencha cliente, unidade e função.");
      return;
    }
    setSaving(true);
    setError(null);

    const funcaoId = await resolveFuncaoId();
    if (funcaoId === null) {
      setSaving(false);
      setError("Não foi possível salvar a função informada.");
      return;
    }

    const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/alocacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, unidadeId, funcaoId, dataInicio, observacoes: observacoes || null }),
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
    <Modal title="Nova alocação" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Cliente <span className="text-red-400">*</span>
          </span>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(Number(e.target.value) || "");
              setUnidadeId("");
            }}
            className={INPUT_CLS}
          >
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Unidade <span className="text-red-400">*</span>
          </span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(Number(e.target.value) || "")} disabled={!clienteId} className={INPUT_CLS}>
            <option value="">Selecione...</option>
            {unidadesDoCliente.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Função <span className="text-red-400">*</span>
          </span>
          <input value={funcaoNome} onChange={(e) => setFuncaoNome(e.target.value)} list="saude-funcoes-alocacao" placeholder="ex.: Montador" className={INPUT_CLS} />
          <datalist id="saude-funcoes-alocacao">
            {funcoes.map((f) => (
              <option key={f.id} value={f.nome} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Data inicial <span className="text-red-400">*</span>
          </span>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={INPUT_CLS} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Observações</span>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={INPUT_CLS} />
        </label>

        <p className="text-xs text-slate-400">Se houver uma alocação ativa, ela será encerrada automaticamente nesta data.</p>

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
