"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

interface UnidadeOption {
  id: number;
  nome: string;
}

interface ClienteOption {
  id: number;
  nome: string;
  unidades: UnidadeOption[];
}

export default function PcmsoUploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [unidadeId, setUnidadeId] = useState<number | "">("");
  const [versao, setVersao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [inicioVigencia, setInicioVigencia] = useState("");
  const [medicoResponsavel, setMedicoResponsavel] = useState("");
  const [crm, setCrm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saude/clientes").then((res) => (res.ok ? res.json() : [])).then(setClientes).catch(() => undefined);
  }, []);

  const unidadesDoCliente = clientes.find((c) => c.id === clienteId)?.unidades ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadeId || !versao.trim() || !inicioVigencia || !file) {
      setError("Preencha unidade, versão, início de vigência e selecione o arquivo.");
      return;
    }

    setSaving(true);
    setError(null);
    setProgress(0);

    try {
      const blob = await upload(`saude/pcmso/${unidadeId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/saude/blob/upload",
        clientPayload: JSON.stringify({ kind: "pcmso", unidadeId }),
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      });

      const res = await fetch("/api/saude/pcmso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidadeId,
          versao,
          titulo: titulo || null,
          dataDocumento: dataDocumento || null,
          inicioVigencia,
          medicoResponsavel: medicoResponsavel || null,
          crm: crm || null,
          blobUrl: blob.url,
          filename: file.name,
          mimeType: file.type || "application/pdf",
          size: file.size,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível salvar.");
        setSaving(false);
        return;
      }

      onSaved();
    } catch {
      setError("Falha no envio do arquivo.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo PCMSO" onClose={onClose} widthClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Cliente <span className="text-red-400">*</span>
            </span>
            <select
              value={clienteId}
              onChange={(e) => {
                setClienteId(Number(e.target.value) || "");
                setUnidadeId("");
              }}
              className={INPUT_CLS}
            >
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Unidade <span className="text-red-400">*</span>
            </span>
            <select value={unidadeId} onChange={(e) => setUnidadeId(Number(e.target.value) || "")} disabled={!clienteId} className={INPUT_CLS}>
              <option value="">Selecione...</option>
              {unidadesDoCliente.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Versão <span className="text-red-400">*</span>
            </span>
            <input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="ex.: v2.1" className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Data do documento</span>
            <input type="date" value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Início de vigência <span className="text-red-400">*</span>
            </span>
            <input type="date" value={inicioVigencia} onChange={(e) => setInicioVigencia(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Médico responsável</span>
            <input value={medicoResponsavel} onChange={(e) => setMedicoResponsavel(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">CRM</span>
            <input value={crm} onChange={(e) => setCrm(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Arquivo (PDF) <span className="text-red-400">*</span>
          </span>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>

        {progress !== null && saving && <p className="text-xs text-slate-400">Enviando... {progress}%</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50">
            {saving ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
