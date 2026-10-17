"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";
import DocumentTextReader from "./DocumentTextReader";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

const TIPO_LABEL: Record<string, string> = {
  ADMISSIONAL: "Admissional",
  PERIODICO: "Periódico",
  RETORNO_TRABALHO: "Retorno ao trabalho",
  MUDANCA_RISCO: "Mudança de risco",
  DEMISSIONAL: "Demissional",
  OUTRO: "Outro",
};

const STATUS_LABEL: Record<string, string> = { AGUARDANDO_REVISAO: "Aguardando revisão", CONFIRMADO: "Confirmado", CORRIGIDO: "Corrigido" };
const STATUS_CLS: Record<string, string> = {
  AGUARDANDO_REVISAO: "bg-amber-100 text-amber-700",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  CORRIGIDO: "bg-blue-100 text-blue-700",
};

interface AsoRecord {
  id: number;
  tipo: string;
  data: string;
  funcaoDeclarada: string | null;
  resultadoDeclarado: string | null;
  medicoNome: string | null;
  medicoCrm: string | null;
  status: string;
  documento: { id: number; nomeOriginal: string };
  alocacao: { unidade: { nome: string } } | null;
}

interface AlocacaoOption {
  id: number;
  unidade: { nome: string };
  status: string;
}

function formatDate(v: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(v));
}

export default function AsoSection({ funcionarioId, canUpload, canReview }: { funcionarioId: number; canUpload: boolean; canReview: boolean }) {
  const [asos, setAsos] = useState<AsoRecord[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  async function load() {
    const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/aso`);
    if (res.ok) setAsos(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">ASO</h2>
        {canUpload && (
          <button onClick={() => setShowUpload(true)} className="text-xs font-semibold text-brand hover:underline">
            + Novo ASO
          </button>
        )}
      </div>

      {asos === null ? (
        <p className="mt-2 text-sm text-slate-400">Carregando...</p>
      ) : asos.length === 0 ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">Nenhum ASO cadastrado.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {asos.map((a) => (
            <AsoCard key={a.id} aso={a} canReview={canReview} onChanged={load} />
          ))}
        </div>
      )}

      {showUpload && (
        <AsoUploadModal
          funcionarioId={funcionarioId}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AsoCard({ aso, canReview, onChanged }: { aso: AsoRecord; canReview: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = () => ({ tipo: aso.tipo, data: aso.data.slice(0, 10), funcaoDeclarada: aso.funcaoDeclarada || "", resultadoDeclarado: aso.resultadoDeclarado || "", medicoNome: aso.medicoNome || "", medicoCrm: aso.medicoCrm || "" });
  const [draft, setDraft] = useState(initial);

  async function submit(confirmar = false) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/saude/aso/${aso.id}${confirmar ? "/confirmar" : ""}`, {
        method: confirmar ? "POST" : "PATCH",
        ...(!confirmar && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Não foi possível salvar o ASO."); }
      setEditing(false); setReviewed(false); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }

  return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-slate-700">{TIPO_LABEL[aso.tipo] ?? aso.tipo} · {formatDate(aso.data)}</div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[aso.status]}`}>{STATUS_LABEL[aso.status]}</span>
    </div>
    <div className="mt-2 text-sm text-slate-600">
      {aso.alocacao && <p>Unidade: {aso.alocacao.unidade.nome}</p>}
      <p>Função: {aso.funcaoDeclarada || "Não preenchida"}</p>
      <p>Resultado declarado no ASO: <strong>{aso.resultadoDeclarado || "Não preenchido"}</strong></p>
      <p>Médico: {aso.medicoNome || "Não preenchido"} · CRM: {aso.medicoCrm || "Não preenchido"}</p>
      <a href={`/api/saude/documentos/${aso.documento.id}`} target="_blank" rel="noreferrer" className="text-brand underline">Ver documento original</a>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {canReview && <>
      <DocumentTextReader documentId={aso.documento.id} endpoint={`/api/saude/aso/${aso.id}/analisar`} />
      {editing ? <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3 rounded-lg bg-slate-50 p-3">
        <h3 className="text-sm font-semibold">Preencher campos após conferir o documento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Tipo<select className={INPUT_CLS} value={draft.tipo} onChange={e => setDraft({ ...draft, tipo: e.target.value })}>{Object.entries(TIPO_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm">Data<input type="date" required className={INPUT_CLS} value={draft.data} onChange={e => setDraft({ ...draft, data: e.target.value })} /></label>
          {([['funcaoDeclarada', 'Função declarada'], ['resultadoDeclarado', 'Resultado exatamente como escrito'], ['medicoNome', 'Médico'], ['medicoCrm', 'CRM']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input className={INPUT_CLS} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        </div>
        <p className="text-xs text-slate-500">Salvar campos não confirma nem libera o ASO. A confirmação continua sendo uma etapa separada.</p>
        <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-brand px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Salvando..." : "Salvar campos conferidos"}</button><button type="button" disabled={busy} onClick={() => setEditing(false)} className="text-sm underline">Cancelar edição</button></div>
      </form> : <button type="button" disabled={busy} onClick={() => { setDraft(initial()); setEditing(true); setReviewed(false); }} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand">Preencher / corrigir campos manualmente</button>}
      {!editing && aso.status !== "CONFIRMADO" && <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Conferi os campos salvos com o documento original.</label>
        <button type="button" disabled={busy || !reviewed} onClick={() => submit(true)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Confirmar ASO conferido"}</button>
      </div>}
    </>}
  </div>;
}

function AsoUploadModal({ funcionarioId, onClose, onSaved }: { funcionarioId: number; onClose: () => void; onSaved: () => void }) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoOption[]>([]);
  const [alocacaoId, setAlocacaoId] = useState<number | "">("");
  const [tipo, setTipo] = useState("PERIODICO");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [funcaoDeclarada, setFuncaoDeclarada] = useState("");
  const [resultadoDeclarado, setResultadoDeclarado] = useState("");
  const [medicoNome, setMedicoNome] = useState("");
  const [medicoCrm, setMedicoCrm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/saude/funcionarios/${funcionarioId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list: AlocacaoOption[] = data?.alocacoes ?? [];
        setAlocacoes(list);
        const ativa = list.find((a) => a.status === "ATIVA");
        if (ativa) setAlocacaoId(ativa.id);
      })
      .catch(() => undefined);
  }, [funcionarioId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecione o arquivo do ASO.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const blob = await upload(`saude/aso/${funcionarioId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/saude/blob/upload",
        clientPayload: JSON.stringify({ kind: "aso", funcionarioId }),
      });

      const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/aso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alocacaoId: alocacaoId || null,
          tipo,
          data,
          funcaoDeclarada: funcaoDeclarada || null,
          resultadoDeclarado: resultadoDeclarado || null,
          medicoNome: medicoNome || null,
          medicoCrm: medicoCrm || null,
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
    <Modal title="Novo ASO" onClose={onClose} widthClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT_CLS}>
              {Object.entries(TIPO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Alocação relacionada</span>
          <select value={alocacaoId} onChange={(e) => setAlocacaoId(Number(e.target.value) || "")} className={INPUT_CLS}>
            <option value="">Nenhuma</option>
            {alocacoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.unidade.nome} {a.status === "ATIVA" ? "(ativa)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Resultado informado no ASO</span>
          <input
            value={resultadoDeclarado}
            onChange={(e) => setResultadoDeclarado(e.target.value)}
            placeholder='ex.: "APTO" — exatamente como está no documento'
            className={INPUT_CLS}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Médico</span>
            <input value={medicoNome} onChange={(e) => setMedicoNome(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">CRM</span>
            <input value={medicoCrm} onChange={(e) => setMedicoCrm(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Função declarada</span>
          <input value={funcaoDeclarada} onChange={(e) => setFuncaoDeclarada(e.target.value)} className={INPUT_CLS} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Arquivo (PDF/imagem) <span className="text-red-400">*</span>
          </span>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>

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
