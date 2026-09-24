"use client";

import { useEffect, useState } from "react";
import PendenciaListItem from "@/components/forum/PendenciaListItem";
import ObservacaoThread from "@/components/forum/ObservacaoThread";
import type { PendenciaListItemDTO } from "@/lib/forum-types";

type StatusTab = "open" | "resolved";

interface Props {
  isAdmin: boolean;
}

export default function ForumClient({ isAdmin }: Props) {
  const [tab, setTab] = useState<StatusTab>("open");
  const [items, setItems] = useState<PendenciaListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function load(status: StatusTab) {
    setLoading(true);
    const res = await fetch(`/api/forum/pendencias?status=${status}`);
    const data: PendenciaListItemDTO[] = res.ok ? await res.json() : [];
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load(tab);
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function handleResolved() {
    // The resolved item leaves the "open" list immediately — no need for a full reload.
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex w-full max-w-sm shrink-0 flex-col border-r border-slate-200">
        <div className="flex gap-1 border-b border-slate-200 p-2">
          <button
            type="button"
            onClick={() => setTab("open")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "open" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Abertas
          </button>
          <button
            type="button"
            onClick={() => setTab("resolved")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "resolved" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Concluídas
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">{tab === "open" ? "Nenhuma pendência em aberto." : "Nenhuma pendência concluída."}</p>
          ) : (
            items.map((item) => (
              <PendenciaListItem key={item.id} item={item} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} />
            ))
          )}
        </div>
      </div>

      <div className="flex-1">
        {selected ? (
          <ObservacaoThread key={selected.id} pendencia={selected} isAdmin={isAdmin} onResolved={handleResolved} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Selecione uma pendência à esquerda.</div>
        )}
      </div>
    </div>
  );
}
