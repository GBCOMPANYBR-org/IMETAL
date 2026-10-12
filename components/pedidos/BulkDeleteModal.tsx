"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

interface Props {
  pedidoIds: number[];
  onClose: () => void;
  onDone: () => void;
}

export default function BulkDeleteModal({ pedidoIds, onClose, onDone }: Props) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ deleted: number; failures: { id: number; reason: string }[] } | null>(null);

  async function removeSelected() {
    if (deleting || confirmation !== "EXCLUIR" || pedidoIds.length < 2) return;
    setDeleting(true);
    let deleted = 0;
    const failures: { id: number; reason: string }[] = [];
    for (const id of pedidoIds) {
      try {
        const response = await fetch(`/api/pedidos/${id}`, { method: "DELETE" });
        if (response.ok) {
          deleted++;
        } else {
          const body = await response.json().catch(() => ({}));
          failures.push({ id, reason: body.error ?? "Falha ao excluir." });
        }
      } catch {
        failures.push({ id, reason: "Erro de conexão." });
      }
    }
    setDeleting(false);
    setResult({ deleted, failures });
    onDone();
  }

  return (
    <Modal title={`Excluir ${pedidoIds.length} pedidos selecionados`} onClose={deleting ? () => {} : onClose} widthClassName="max-w-md">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">{result.deleted} pedido(s) excluído(s). {result.failures.length} não excluído(s).</p>
          {result.failures.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-auto text-xs text-red-700">
              {result.failures.map((failure) => <p key={failure.id}>Pedido #{failure.id}: {failure.reason}</p>)}
            </div>
          )}
          <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Fechar</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-red-700">Atenção: esta exclusão é definitiva e não pode ser desfeita.</p>
          <p className="text-sm text-slate-600">Pedidos selecionados: {pedidoIds.join(", ")}. Os anexos compartilhados com outros pedidos serão preservados conforme as regras atuais.</p>
          <div>
            <label htmlFor="confirm-bulk-delete" className="mb-1 block text-sm font-medium text-slate-700">Digite EXCLUIR para confirmar</label>
            <input id="confirm-bulk-delete" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={deleting} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            <button type="button" disabled={deleting || confirmation !== "EXCLUIR"} onClick={removeSelected} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Excluindo..." : `Excluir ${pedidoIds.length} pedidos`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
