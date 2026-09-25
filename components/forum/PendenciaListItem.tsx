import { formatDateTime } from "@/lib/format";
import type { PendenciaListItemDTO } from "@/lib/forum-types";

interface Props {
  item: PendenciaListItemDTO;
  direction: "received" | "sent";
  selected: boolean;
  onClick: () => void;
}

export default function PendenciaListItem({ item, direction, selected, onClick }: Props) {
  const isNew = !item.viewedAt && !item.resolvedAt;
  const isResolved = Boolean(item.resolvedAt);
  // "Recebidas": de quem é a mensagem. "Enviadas": pra quem eu marquei (é sempre eu quem escreveu).
  const person = direction === "received" ? item.author : item.mentionedUser;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left transition ${selected ? "bg-brand/5" : "hover:bg-slate-50"}`}
    >
      <div className="flex items-start gap-2">
        {!isResolved && <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? "bg-emerald-500" : "bg-amber-400"}`} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-800">
              {item.pedido.cliente.name} · #{item.pedido.id}
              {item.pedido.codigo ? ` · ${item.pedido.codigo}` : ""}
            </p>
            <span className="shrink-0 text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
          </div>
          {item.pedido.descricao && <p className="truncate text-xs text-slate-500">{item.pedido.descricao}</p>}
          <p className="mt-1 truncate text-xs text-slate-600">
            <span className="font-medium">{person?.name ?? "Usuário removido"}:</span> {item.preview}
          </p>
        </div>
      </div>
    </button>
  );
}
