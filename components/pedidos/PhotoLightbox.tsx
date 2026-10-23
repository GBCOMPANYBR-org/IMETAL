"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PhotoItem {
  id: number;
  filename: string;
}

interface Props {
  basePath: string;
  items: PhotoItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Visualizador de fotos em tela cheia com navegação anterior/próxima — evita ter que fechar e
 * reabrir uma foto por vez pra ver todas as fotos de um pedido. */
export default function PhotoLightbox({ basePath, items, index, onIndexChange, onClose }: Props) {
  const item = items[index];\n  const [imageFailed, setImageFailed] = useState(false);\n  useEffect(() => { setImageFailed(false); }, [item?.id]);
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onIndexChange, index, hasPrev, hasNext]);

  if (typeof document === "undefined" || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-900/95">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={item.filename}>
            {item.filename}
          </p>
          <p className="text-xs text-white/60">
            {index + 1} de {items.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/40 text-xl text-white transition hover:bg-white/10"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {hasPrev && (
          <button
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-2xl text-white transition hover:bg-black/60"
            aria-label="Foto anterior"
          >
            ‹
          </button>
        )}

        {imageFailed ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-sm text-white">
            <p>Não foi possível mostrar esta foto no visualizador.</p>
            <p className="text-white/70">O formato da imagem pode não ser compatível com este aparelho.</p>
            <a href={`${basePath}/${item.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/40 px-4 py-3 font-semibold">Abrir arquivo original</a>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={item.id}
            src={`${basePath}/${item.id}`}
            alt={item.filename}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain"
          />
        )}

        {hasNext && (
          <button
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-2xl text-white transition hover:bg-black/60"
            aria-label="Próxima foto"
          >
            ›
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-center">
        <a
          href={`${basePath}/${item.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/30 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-white/10"
        >
          Abrir original em nova aba
        </a>
        <button type="button" onClick={onClose} className="rounded-lg border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white sm:hidden">Fechar foto</button>
      </div>
    </div>,
    document.body
  );
}
