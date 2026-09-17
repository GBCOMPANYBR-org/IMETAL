"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

interface Props {
  pedidoId: number;
  current: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ObservacaoModal({ pedidoId, current, onClose, onSaved }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Modal title="Adicionar observação" onClose={onClose} widthClassName="max-w-lg">
      {current?.trim() && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-slate-500">Observações já registradas</p>
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {current}
          </div>
        </div>
      )}

      <label className="mb-1 block text-sm font-medium text-slate-600">Nova observação</label>
      <textarea
        autoFocus
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="Digite o texto a adicionar..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-1 text-xs text-slate-400">Este texto será acrescentado abaixo do que já existe — nada é apagado.</p>

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
