"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";

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

interface AsoExtraido {
  employeeName: string | null;
  jobFunction: string | null;
  asoType: string | null;
  date: string | null;
  declaredFitnessResult: string | null;
  doctorName: string | null;
  doctorCrm: string | null;
  warnings: string[];
}

function AsoCard({ aso, canReview, onChanged }: { aso: AsoRecord; canReview: boolean; onChanged: () => void }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [extraido, setExtraido] = useState<AsoExtraido | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    await fetch(`/api/saude/aso/${aso.id}/confirmar`, { method: "POST" });
    onChanged();
  }

  async function handleAnalisar() {
    setAnalyzing(true);
    setError(null);
    const res = await fetch(`/api/saude/aso/${aso.id}/analisar`, { method: "POST" });
    setAnalyzing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível analisar o documento.");
      return;
    }
    const body = await res.json();
    setExtraido(body.extraido);
  }

  async function handleAplicar() {
    if (!extraido) return;
    await fetch(`/api/saude/aso/${aso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(extraido.asoType && { tipo: extraido.asoType }),
        ...(extraido.date && { data: extraido.date }),
        funcaoDeclarada: extraido.jobFunction,
        resultadoDeclarado: extraido.declaredFitnessResult,
        medicoNome: extraido.doctorName,
        medicoCrm: extraido.doctorCrm,
      }),
    });
    setExtraido(null);
    onChanged();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">
          {TIPO_LABEL[aso.tipo] ?? aso.tipo} · {formatDate(aso.data)}
          {aso.alocacao && <span className="text-slate-400"> · {aso.alocacao.unidade.nome}</span>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[aso.status]}`}>{STATUS_LABEL[aso.status]}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {aso.resultadoDeclarado && (
          <>
            Resultado informado no ASO: <strong>{aso.resultadoDeclarado}</strong> ·{" "}
          </>
        )}
        {aso.medicoNome && (
          <>
            {aso.medicoNome}
            {aso.medicoCrm && ` (CRM ${aso.medicoCrm})`} ·{" "}
          </>
        )}
        <a href={`/api/saude/documentos/${aso.documento.id}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
          ver documento
        </a>
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600">{error}</p>}

      {canReview && aso.status === "AGUARDANDO_REVISAO" && (
        <div className="mt-2 flex items-center gap-2">
          <button onClick={handleConfirmar} className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-light">
            Confirmar e salvar
          </button>
          <button onClick={handleAnalisar} disabled={analyzing} className="rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5 disabled:opacity-50">
            {analyzing ? "Analisando..." : "🤖 Analisar com IA"}
          </button>
        </div>
      )}

      {extraido && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <div className="font-semibold">Informações extraídas</div>
          <div className="mt-1 space-y-0.5">
            {extraido.employeeName && <div>Funcionário no documento: {extraido.employeeName}</div>}
            {extraido.jobFunction && <div>Função: {extraido.jobFunction}</div>}
            {extraido.asoType && <div>Tipo: {TIPO_LABEL[extraido.asoType] ?? extraido.asoType}</div>}
            {extraido.date && <div>Data: {extraido.date}</div>}
            {extraido.declaredFitnessResult && (
              <div>
                Resultado: <strong>{extraido.declaredFitnessResult}</strong>
              </div>
            )}
            {extraido.doctorName && (
              <div>
                Médico: {extraido.doctorName} {extraido.doctorCrm && `(CRM ${extraido.doctorCrm})`}
              </div>
            )}
            {extraido.warnings.length > 0 && (
              <ul className="list-disc pl-4">
                {extraido.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={handleAplicar} className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
            Aplicar estes dados ao ASO
          </button>
        </div>
      )}
    </div>
  );
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
