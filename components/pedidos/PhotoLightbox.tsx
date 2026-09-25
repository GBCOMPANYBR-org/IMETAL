"use client";

import { useEffect } from "react";
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
  const item = items[index];
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
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
          className="shrink-0 rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
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

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${basePath}/${item.id}`}
          alt={item.filename}
          className="h-full w-full object-contain"
        />

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

      <div className="flex justify-center px-4 py-3">
        <a
          href={`${basePath}/${item.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/30 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10"
        >
          Abrir original em nova aba
        </a>
      </div>
    </div>,
    document.body
  );
}
