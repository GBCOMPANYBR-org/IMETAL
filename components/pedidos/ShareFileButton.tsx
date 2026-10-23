"use client";

import { useEffect, useState } from "react";

interface Props {
  fileUrl: string;
  filename: string;
  className: string;
}

function downloadFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

/** Compartilha o próprio arquivo protegido pela sessão, não uma URL que exige login.
 * Pré-carrega ao abrir o visualizador para preservar o gesto do usuário no iOS. */
export default function ShareFileButton({ fileUrl, filename, className }: Props) {
  const [prepared, setPrepared] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPrepared(null);
    setError("");
    (async () => {
      try {
        const response = await fetch(fileUrl, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Não foi possível carregar o arquivo.");
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        if (!cancelled) setPrepared(file);
      } catch {
        if (!cancelled) setError("Não foi possível preparar o arquivo para compartilhar.");
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, filename]);

  async function onShare() {
    if (!prepared || busy) return;
    setBusy(true);
    setError("");
    try {
      const shareData = { files: [prepared], title: prepared.name };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadFile(prepared);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Não foi possível compartilhar. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <button type="button" onClick={onShare} disabled={!prepared || busy} className={className + " w-full disabled:opacity-50"} aria-label={"Compartilhar " + filename}>
        {busy ? "Compartilhando..." : "Compartilhar"}
      </button>
      {error && <p role="alert" className="mt-1 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
