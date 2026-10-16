"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FuncionarioFormModal, { type FuncionarioRecord } from "@/components/saude/FuncionarioFormModal";

const STATUS_LABEL: Record<FuncionarioRecord["status"], string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  AFASTADO: "Afastado",
};

const STATUS_CLS: Record<FuncionarioRecord["status"], string> = {
  ATIVO: "bg-emerald-100 text-emerald-700",
  INATIVO: "bg-slate-100 text-slate-500",
  AFASTADO: "bg-amber-100 text-amber-700",
};

export default function FuncionariosManager({ canEdit }: { canEdit: boolean }) {
  const [funcionarios, setFuncionarios] = useState<FuncionarioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<FuncionarioRecord | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load(query: string) {
    setLoading(true);
    const res = await fetch(`/api/saude/funcionarios${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    if (res.ok) setFuncionarios(await res.json());
    setLoading(false);
  }

  async function removeFuncionario(f: FuncionarioRecord) {
    if (!window.confirm("Excluir definitivamente o cadastro de " + f.nome + "?")) return;
    setDeleteError(null);
    setDeletingId(f.id);
    try {
      const res = await fetch("/api/saude/funcionarios/" + f.id, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.error ?? "Não foi possível excluir o funcionário.");
      } else {
        await load(q);
      }
    } catch {
      setDeleteError("Erro de conexão ao excluir o funcionário.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(q), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, matrícula ou CPF..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {canEdit && (
          <button
            onClick={() => setEditing("new")}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
          >
            + Novo funcionário
          </button>
        )}
      </div>

      {deleteError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : funcionarios.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          Nenhum funcionário encontrado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Nome</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Matrícula</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Função</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Status</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">
                    <Link href={`/saude/funcionarios/${f.id}`} className="hover:underline">
                      {f.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{f.matricula}</td>
                  <td className="px-4 py-2 text-slate-600">{f.funcaoPrincipal?.nome ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setEditing(f)} className="cursor-pointer text-xs font-semibold text-brand hover:underline">Editar</button>
                        <button type="button" onClick={() => void removeFuncionario(f)} disabled={deletingId !== null} className="cursor-pointer text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50">{deletingId === f.id ? "Excluindo..." : "Excluir"}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <FuncionarioFormModal
          funcionario={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(q);
          }}
        />
      )}
    </div>
  );
}
