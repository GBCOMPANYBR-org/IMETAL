"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  pedidoId: number;
  text: string;
  filename: string;
}

/**
 * Texto truncado da Descrição + miniatura da foto de capa ao passar o mouse. A prévia é
 * portada pro final do <body> e posicionada via getBoundingClientRect — uma <td> truncada da
 * tabela tem overflow:hidden, que cortaria um popover posicionado normalmente ali dentro.
 */
export default function DescricaoHoverPreview({ pedidoId, text, filename }: Props) {
  const [hovering, setHovering] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  function handleEnter() {
    if (spanRef.current) setRect(spanRef.current.getBoundingClientRect());
    setHovering(true);
  }

  return (
    <>
      <span
        ref={spanRef}
        className="block truncate"
        title={text || undefined}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHovering(false)}
      >
        {text || "—"}
      </span>

      {hovering &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
            style={{
              left: Math.max(8, rect.left),
              top: rect.bottom + 6,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/pedidos/${pedidoId}/foto-capa`}
              alt={filename}
              className="max-h-48 w-full rounded object-contain"
            />
            {text && <p className="mt-1.5 max-w-[16rem] text-xs text-slate-600">{text}</p>}
          </div>,
          document.body
        )}
    </>
  );
}
