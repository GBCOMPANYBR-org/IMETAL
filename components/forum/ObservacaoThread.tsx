"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MentionTextarea from "@/components/forum/MentionTextarea";
import ObservacaoText from "@/components/forum/ObservacaoText";
import { formatDateTime, formatFileSize } from "@/lib/format";
import type { ObservacaoDTO, PendenciaListItemDTO } from "@/lib/forum-types";

interface Attachment {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: { name: string } | null;
}

interface Props {
  pendencia: PendenciaListItemDTO;
  direction: "received" | "sent";
  isAdmin: boolean;
  onResolved: () => void;
}

export default function ObservacaoThread({ pendencia, direction, isAdmin, onResolved }: Props) {
  const pedidoId = pendencia.pedido.id;
  const [observacoes, setObservacoes] = useState<ObservacaoDTO[]>([]);
  const [attachments, setAttachments] = useState<Attachment[] | null>(null); // null = hidden (no permission)
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  async function loadThread() {
    setLoading(true);
    const res = await fetch(`/api/pedidos/${pedidoId}/observacoes`);
    setObservacoes(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    loadThread();
    fetch(`/api/pedidos/${pedidoId}/attachments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Attachment[] | null) => setAttachments(data))
      .catch(() => setAttachments(null));

    fetch(`/api/forum/pendencias/${pendencia.id}/view`, { method: "POST" }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, pendencia.id]);

  useEffect(() => {
    if (!loading) highlightRef.current?.scrollIntoView({ block: "center" });
  }, [loading]);

  async function handleReply() {
    if (!replyText.trim()) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/observacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível enviar a resposta.");
        return;
      }
      setReplyText("");
      await loadThread();
    } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    setError(null);
    setResolving(true);
    try {
      const res = await fetch(`/api/forum/pendencias/${pendencia.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CONCLUIDA" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível concluir a pendência.");
        return;
      }
      onResolved();
    } finally {
      setResolving(false);
    }
  }

  async function handleDelete(observacaoId: number) {
    if (!confirm("Excluir esta mensagem? Esta ação não pode ser desfeita.")) return;
    setError(null);
    setDeletingId(observacaoId);
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/observacoes/${observacaoId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível excluir a mensagem.");
        return;
      }
      // A mensagem de origem sumindo apaga a pendência inteira (cascade no banco) — fecha a conversa.
      if (observacaoId === pendencia.observacaoId) {
        onResolved();
      } else {
        await loadThread();
      }
    } finally {
      setDeletingId(null);
    }
  }

  const isResolved = Boolean(pendencia.resolvedAt);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {pendencia.pedido.cliente.name} · Pedido #{pendencia.pedido.id}
            </p>
            <p className="text-xs text-slate-500">{pendencia.pedido.codigo ? `${pendencia.pedido.codigo} — ` : ""}{pendencia.pedido.descricao ?? "Sem descrição"}</p>
          </div>
          <Link href={`/?pedidoId=${pedidoId}`} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Ver pedido
          </Link>
        </div>

        {isResolved ? (
          <p className="mt-2 text-xs font-medium text-emerald-600">
            {pendencia.resolutionType === "CONCLUIDA" ? "Pendência concluída" : "Marcada como ciente"}
          </p>
        ) : direction === "received" ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={resolving}
              onClick={handleResolve}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-light disabled:opacity-60"
            >
              Concluir pendência
            </button>
          </div>
        ) : (
          // Enviada por mim — só quem foi marcado pode concluir (ver ../.../resolve/route.ts).
          <p className="mt-2 text-xs text-slate-400">Aguardando {pendencia.mentionedUser.name}.</p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : observacoes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma observação ainda.</p>
        ) : (
          observacoes.map((o) => {
            const isOrigin = o.id === pendencia.observacaoId;
            return (
              <div
                key={o.id}
                ref={isOrigin ? highlightRef : undefined}
                className={`rounded-lg border p-3 text-sm ${isOrigin ? "border-brand-accent bg-brand-accent/10" : "border-slate-200 bg-white"}`}
              >
                <div className="mb-1 flex items-baseline gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{o.author?.name ?? "Usuário removido"}</span>
                  <span>{formatDateTime(o.createdAt)}</span>
                  {o.migratedFromLegacy && (
                    <span className="italic text-slate-400" title="Notas registradas antes do Fórum existir — podem conter várias datas diferentes.">
                      histórico anterior ao Fórum
                    </span>
                  )}
                  {isOrigin && <span className="font-semibold text-brand">— marcação de origem</span>}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={deletingId === o.id}
                      onClick={() => handleDelete(o.id)}
                      className="ml-auto shrink-0 text-slate-300 transition hover:text-red-500 disabled:opacity-60"
                      title="Excluir mensagem"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <ObservacaoText text={o.text} mentions={o.mentions} />
              </div>
            );
          })
        )}

        {attachments !== null && attachments.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Anexos do pedido</p>
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/pedidos/${pedidoId}/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand hover:underline"
                  >
                    {a.filename}
                  </a>
                  <span className="ml-1.5 text-xs text-slate-400">({formatFileSize(a.size)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <MentionTextarea pedidoId={pedidoId} value={replyText} onChange={setReplyText} rows={2} placeholder="Responder... use @ para marcar alguém" />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleReply}
            disabled={sending || !replyText.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Responder"}
          </button>
        </div>
      </div>
    </div>
  );
}
