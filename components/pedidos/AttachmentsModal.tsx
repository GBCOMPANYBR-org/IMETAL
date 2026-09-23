"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";
import { formatFileSize } from "@/lib/format";

interface FileItem {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: { name: string } | null;
  enabledForQr?: boolean;
}

interface Props {
  pedidoId: number;
  /** "anexos" (default) are shared across every Pedido with the same Cliente+Código;
   * "fotos" are private to this Pedido — see lib/attachment-group.ts.
   */
  kind?: "anexos" | "fotos";
  codigo?: string | null;

  /** Anexos only — used to build the public QR-code link. */
  publicToken?: string | null;

  canUpload: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function AttachmentsModal({
  pedidoId,
  kind = "anexos",
  codigo,
  publicToken,
  canUpload,
  isAdmin,
  onClose,
  onChanged,
}: Props) {
  const isFotos = kind === "fotos";

  const basePath = `/api/pedidos/${pedidoId}/${
    isFotos ? "fotos" : "attachments"
  }`;

  const singular = isFotos ? "foto" : "anexo";

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const publicUrl =
    !isFotos &&
    publicToken &&
    typeof window !== "undefined"
      ? `${window.location.origin}/public/anexos/${publicToken}`
      : null;

  async function load() {
    setLoading(true);

    const res = await fetch(basePath);

    if (res.ok) {
      setItems(await res.json());
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, kind]);

  useEffect(() => {
    if (!publicUrl) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;

    QRCode.toDataURL(publicUrl, {
      width: 160,
      margin: 1,
    }).then((url) => {
      if (!cancelled) {
        setQrDataUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    const file = fileRef.current?.files?.[0];

    if (!file) return;

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      setError("Arquivo maior que 20MB.");
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      /*
       * O arquivo é enviado diretamente do navegador
       * para o Vercel Blob.
       *
       * Dessa forma ele não passa pelo limite de payload
       * da Serverless Function.
       */
      const blob = await upload(
        `pedidos/${pedidoId}/${file.name}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob/upload",

          clientPayload: JSON.stringify({
            pedidoId,
            kind,
          }),

          onUploadProgress(progressEvent) {
            setUploadProgress(
              Math.round(progressEvent.percentage)
            );
          },
        }
      );

      /*
       * Depois que o upload termina, enviamos somente
       * os metadados para a API do pedido.
       */
      const res = await fetch(basePath, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          blobUrl: blob.url,
          filename: file.name,
          mimeType:
            file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}));

        setError(
          body.error ??
            "O arquivo foi enviado, mas não foi possível registrá-lo."
        );

        return;
      }

      setUploadProgress(100);

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      await load();

      onChanged?.();
    } catch (err) {
      console.error("Erro no upload:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o arquivo."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (
      !confirm(
        `Excluir est${isFotos ? "a" : "e"} ${singular}?`
      )
    ) {
      return;
    }

    const res = await fetch(
      `${basePath}/${id}`,
      {
        method: "DELETE",
      }
    );

    if (res.ok) {
      await load();

      onChanged?.();
    }
  }

  async function handleToggleQr(item: FileItem) {
    setTogglingId(item.id);

    try {
      const res = await fetch(
        `${basePath}/${item.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            enabledForQr: !item.enabledForQr,
          }),
        }
      );

      if (res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  enabledForQr:
                    !it.enabledForQr,
                }
              : it
          )
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Modal
      title={
        isFotos
          ? "Fotos do pedido"
          : "Anexos do pedido"
      }
      onClose={onClose}
      widthClassName="max-w-lg"
    >
      {!isFotos && codigo?.trim() && (
        <p className="mb-3 text-xs text-slate-400">
          Compartilhado com todo pedido do
          mesmo Cliente com Código{" "}
          <span className="font-medium text-slate-500">
            {codigo}
          </span>
          .
        </p>
      )}

      {!isFotos &&
        qrDataUrl && (
          <div className="mb-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}

            <img
              src={qrDataUrl}
              alt="QR Code dos anexos habilitados"
              className="h-24 w-24 shrink-0"
            />

            <p className="text-xs text-slate-500">
              Este QR Code abre uma página
              pública só com os anexos marcados
              como{" "}
              <span className="font-medium text-slate-600">
                "Habilitado no QR"
              </span>{" "}
              abaixo. Ninguém precisa de login
              para acessar por ele.
            </p>
          </div>
        )}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Carregando...
        </p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhum
          {isFotos ? "a" : ""} {singular} neste
          pedido.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <a
                href={`${basePath}/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-brand hover:underline"
                title={a.filename}
              >
                {a.filename}
              </a>

              <span className="shrink-0 text-xs text-slate-400">
                {formatFileSize(a.size)}
              </span>

              {!isFotos && (
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-500"
                  title="Habilitado no QR Code"
                >
                  <input
                    type="checkbox"
                    checked={
                      a.enabledForQr ?? false
                    }
                    disabled={
                      togglingId === a.id
                    }
                    onChange={() =>
                      handleToggleQr(a)
                    }
                  />

                  QR
                </label>
              )}

              {isAdmin && (
                <button
                  onClick={() =>
                    handleDelete(a.id)
                  }
                  className="shrink-0 rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  title={`Excluir ${singular}`}
                >
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form
          onSubmit={handleUpload}
          className="mt-4 border-t border-slate-100 pt-4"
        >
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={
                isFotos
                  ? "image/*"
                  : undefined
              }
              disabled={uploading}
              className="flex-1 text-sm"
            />

            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
            >
              {uploading
                ? `Enviando... ${uploadProgress}%`
                : "Enviar"}
            </button>
          </div>

          {uploading && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Enviando arquivo...</span>
                <span className="font-medium">
                  {uploadProgress}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-brand transition-all duration-200"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>
            </div>
          )}
        </form>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}
