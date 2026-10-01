"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

interface ExameRecord {
  id: number;
  tipoExame: { nome: string };
  dataRealizacao: string;
  dataValidade: string | null;
  laboratorio: string | null;
  origem: string;
  documento: { id: number } | null;
}

function formatDate(v: string | null): string {
  return v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v)) : "—";
}

export default function ExamesSection({ funcionarioId, canEdit }: { funcionarioId: number; canEdit: boolean }) {
  const [exames, setExames] = useState<ExameRecord[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/exames`);
    if (res.ok) setExames(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Exames</h2>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-brand hover:underline">
            + Novo exame
          </button>
        )}
      </div>

      {exames === null ? (
        <p className="mt-2 text-sm text-slate-400">Carregando...</p>
      ) : exames.length === 0 ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">Nenhum exame cadastrado.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Exame</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Realizado em</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Válido até</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Origem</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {exames.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{e.tipoExame.nome}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(e.dataRealizacao)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(e.dataValidade)}</td>
                  <td className="px-4 py-2 text-slate-500">{e.origem}</td>
                  <td className="px-4 py-2">
                    {e.documento && (
                      <a href={`/api/saude/documentos/${e.documento.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                        ver documento
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExameFormModal
          funcionarioId={funcionarioId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ExameFormModal({ funcionarioId, onClose, onSaved }: { funcionarioId: number; onClose: () => void; onSaved: () => void }) {
  const [tipoExameNome, setTipoExameNome] = useState("");
  const [dataRealizacao, setDataRealizacao] = useState(new Date().toISOString().slice(0, 10));
  const [dataValidade, setDataValidade] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [profissional, setProfissional] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoExameNome.trim()) {
      setError("Informe o tipo de exame.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let blobUrl: string | undefined;
      let mimeType: string | undefined;
      let size: number | undefined;

      if (file) {
        const blob = await upload(`saude/exame/${funcionarioId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/saude/blob/upload",
          clientPayload: JSON.stringify({ kind: "exame", funcionarioId }),
        });
        blobUrl = blob.url;
        mimeType = file.type || "application/octet-stream";
        size = file.size;
      }

      const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/exames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoExameNome,
          dataRealizacao,
          dataValidade: dataValidade || null,
          laboratorio: laboratorio || null,
          profissional: profissional || null,
          ...(blobUrl ? { blobUrl, filename: file!.name, mimeType, size } : {}),
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
    <Modal title="Novo exame" onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Tipo de exame <span className="text-red-400">*</span>
          </span>
          <input value={tipoExameNome} onChange={(e) => setTipoExameNome(e.target.value)} placeholder="ex.: Audiometria" className={INPUT_CLS} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Realizado em</span>
            <input type="date" value={dataRealizacao} onChange={(e) => setDataRealizacao(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Válido até</span>
            <input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Laboratório</span>
            <input value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Profissional</span>
            <input value={profissional} onChange={(e) => setProfissional(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Arquivo (opcional)</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
