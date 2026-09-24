"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import MentionTextarea from "@/components/forum/MentionTextarea";
import ObservacaoText from "@/components/forum/ObservacaoText";
import { formatDateTime } from "@/lib/format";
import type { ObservacaoDTO } from "@/lib/forum-types";

interface Props {
  pedidoId: number;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ObservacaoModal({ pedidoId, isAdmin, onClose, onSaved }: Props) {
  const [history, setHistory] = useState<ObservacaoDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    const res = await fetch(`/api/pedidos/${pedidoId}/observacoes`);
    setHistory(res.ok ? await res.json() : []);
    setLoadingHistory(false);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function handleDelete(observacaoId: number) {
    if (!confirm("Excluir esta observação? Esta ação não pode ser desfeita.")) return;
    setError(null);
    setDeletingId(observacaoId);
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/observacoes/${observacaoId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível excluir a observação.");
        return;
      }
      await loadHistory();
      onSaved();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/observacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível salvar a observação.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Observações" onClose={onClose} widthClassName="max-w-lg">
      <div className="mb-4">
        <p className="mb-1 text-xs font-medium text-slate-500">Histórico</p>
        {loadingHistory ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma observação registrada ainda.</p>
        ) : (
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            {history.map((o) => (
              <div key={o.id} className="text-sm">
                <div className="mb-0.5 flex items-baseline gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">{o.author?.name ?? "Usuário removido"}</span>
                  <span>{formatDateTime(o.createdAt)}</span>
                  {o.migratedFromLegacy && (
                    <span className="italic text-slate-400" title="Notas registradas antes do Fórum existir — podem conter várias datas diferentes.">
                      histórico anterior ao Fórum
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={deletingId === o.id}
                      onClick={() => handleDelete(o.id)}
                      className="ml-auto shrink-0 text-slate-300 transition hover:text-red-500 disabled:opacity-60"
                      title="Excluir observação"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <ObservacaoText text={o.text} mentions={o.mentions} />
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="mb-1 block text-sm font-medium text-slate-600">Nova observação</label>
      <MentionTextarea pedidoId={pedidoId} value={text} onChange={setText} rows={3} autoFocus placeholder="Digite o texto a adicionar... use @ para marcar alguém" />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
