"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ShareFileButton from "@/components/pedidos/ShareFileButton";

interface Props {
  fileUrl: string;
  filename: string;
  isImage: boolean;
  onClose: () => void;
}

const clampZoom = (value: number) => Math.min(4, Math.max(1, Math.round(value * 10) / 10));

/** Visualizador mobile: sem nova aba e sem barra superior. Fotos/imagens aceitam
 * pinça com dois dedos; ao ampliar, um dedo arrasta o conteúdo na área rolável.
 * Em PDFs, preserva os gestos de zoom disponíveis no leitor nativo do navegador. */
export default function MobileAttachmentViewer({ fileUrl, filename, isImage, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{ distance: number; startZoom: number } | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setZoom(1);
    gestureRef.current = null;
  }, [fileUrl]);

  const touchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!isImage || event.touches.length !== 2) return;
    gestureRef.current = { distance: touchDistance(event.touches), startZoom: zoom };
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!isImage || event.touches.length !== 2 || !gestureRef.current) return;
    event.preventDefault();
    const next = clampZoom(gestureRef.current.startZoom * touchDistance(event.touches) / gestureRef.current.distance);
    setZoom(next);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={"Visualizar anexo " + filename} className="fixed inset-0 z-[120] flex flex-col bg-white">
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={(event) => { if (event.touches.length < 2) gestureRef.current = null; }}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-100"
        style={{ WebkitOverflowScrolling: "touch", touchAction: isImage ? "pan-x pan-y" : "auto" }}
      >
        {isImage ? (
          <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: zoom === 1 ? "100%" : `${zoom * 100}%`, height: zoom === 1 ? "100%" : `${zoom * 100}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt={filename} draggable={false} className="block h-full w-full select-none object-contain" />
          </div>
        ) : (
          <iframe
            title={filename}
            src={fileUrl}
            className="block border-0 bg-white"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minHeight: "100%" }}
          />
        )}
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-stretch gap-2">
          <ShareFileButton fileUrl={fileUrl} filename={filename} className="rounded-lg border border-slate-300 bg-white px-2 py-3 text-sm font-semibold text-slate-800" />
          <button type="button" onClick={onClose} className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-3 text-sm font-semibold text-white">Fechar anexo</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
