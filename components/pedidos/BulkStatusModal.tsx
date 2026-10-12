"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

interface StatusOption { id: number; label: string }
interface Props {
  pedidoIds: number[];
  statusOptions: StatusOption[];
  onClose: () => void;
  onDone: () => void;
}

export default function BulkStatusModal({ pedidoIds, statusOptions, onClose, onDone }: Props) {
  const [statusId, setStatusId] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { id: number; error: string }[] } | null>(null);
  const chosen = statusOptions.find((option) => String(option.id) === statusId);
  const isEmAndamento = chosen?.label.trim().toLowerCase() === "em andamento";

  async function apply() {
    if (!statusId || saving || pedidoIds.length < 2) return;
    if (chosen?.label.trim().toLowerCase() === "finalizado" && !window.confirm(`ATENÇÃO: Você está prestes a finalizar ${pedidoIds.length} pedidos. Após finalizar, não será possível alterar o status pela alteração rápida ou em lote. Deseja continuar?`)) return;
    setSaving(true);
    const failed: { id: number; error: string }[] = [];
    let ok = 0;
    // Executa sequencialmente para não sobrecarregar a API e manter a contagem confiável.
    for (const id of pedidoIds) {
      try {
        const response = await fetch(`/api/pedidos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quickStatusChange: true,
            statusId: Number(statusId),
            ...(isEmAndamento && previsao ? { previsao } : {}),
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          failed.push({ id, error: body.error ?? "Não foi possível alterar o status." });
        } else {
          ok++;
        }
      } catch {
        failed.push({ id, error: "Erro de conexão." });
      }
    }
    setSaving(false);
    setResult({ ok, failed });
    onDone();
  }

  return (
    <Modal title={`Alterar status em lote — ${pedidoIds.length} pedidos`} onClose={saving ? () => {} : onClose} widthClassName="max-w-md">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">{result.ok} pedido(s) atualizado(s) com sucesso. {result.failed.length} não atualizado(s).</p>
          {result.failed.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-auto text-xs text-red-700">
              {result.failed.map((item) => <p key={item.id}>Pedido #{item.id}: {item.error}</p>)}
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Fechar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">O novo status será aplicado a todos os pedidos selecionados que permitirem a alteração. Pedidos Finalizados permanecem bloqueados para troca rápida.</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="bulk-status">Novo status</label>
            <select id="bulk-status" value={statusId} onChange={(event) => setStatusId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione o status...</option>
              {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          {isEmAndamento && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="bulk-previsao">Previsão de entrega (opcional)</label>
              <input id="bulk-previsao" type="date" value={previsao} onChange={(event) => setPrevisao(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancelar</button>
            <button type="button" disabled={!statusId || saving} onClick={apply} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Atualizando..." : `Aplicar a ${pedidoIds.length} pedidos`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
