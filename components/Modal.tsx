"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}

export default function Modal({ title, onClose, children, widthClassName = "max-w-2xl" }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl ${widthClassName}`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] sm:px-5 sm:py-3">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-700 transition hover:bg-slate-100"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>\n        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:hidden"><button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 text-sm font-semibold text-slate-800">Fechar</button></div>
      </div>
    </div>,
    document.body
  );
}
