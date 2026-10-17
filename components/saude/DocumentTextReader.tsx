"use client";

import { useEffect, useRef, useState } from "react";
import PcmsoSuggestions from "./PcmsoSuggestions";
import type { Extraction } from "@/lib/saude/ocr/types";

export default function DocumentTextReader({ documentId, endpoint, pcmso }: { documentId: number; endpoint: string; pcmso?: { id:number; locked:boolean; onChanged:()=>void } }) {
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [forceOcr, setForceOcr] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoaded(false);
    fetch(endpoint, { signal: abort.signal }).then(async res => {
      if (!res.ok) throw new Error("Não foi possível carregar a transcrição salva.");
      const body = await res.json(); setExtraction(body.extraction); setGeneration(v => v + 1);
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoaded(true); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, [endpoint]);

  async function read() {
    if (extraction && !confirm("Uma nova leitura substituirá o texto exibido. Continuar?")) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setNotice(""); setProgress("Abrindo documento...");
    try {
      const { extractDocument } = await import("@/lib/saude/ocr/extract");
      const result = await extractDocument(documentId, setProgress, abort.signal, forceOcr);
      setExtraction(result); setGeneration(v => v + 1);
      setNotice("Leitura concluída. Confira com o original e salve a transcrição.");
    } catch (e) {
      setError(abort.signal.aborted ? "Leitura cancelada." : e instanceof Error ? e.message : "Falha na leitura. Confira o documento manualmente.");
    } finally { setBusy(false); setProgress(""); controller.current = null; }
  }

  async function save() {
    if (!extraction) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(extraction) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Não foi possível salvar a transcrição."); }
      setNotice("Transcrição salva. Os campos e requisitos ainda precisam de conferência manual.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  return <section className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Leitura de texto e OCR">
    <h2 className="font-semibold text-slate-800">Texto/OCR — conferência manual</h2>
    <p className="mt-1 text-sm text-slate-600">Leitura no seu navegador, sem créditos de IA. Confira nomes, datas, tabelas e o resultado declarado no documento original. A transcrição não aprova cadastros. {pcmso ? "Tabelas reconhecidas geram sugestões de funções e exames para sua conferência abaixo." : "Confira e preencha os campos manualmente."}</p>
    <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={forceOcr} disabled={busy || saving} onChange={e => setForceOcr(e.target.checked)} />Usar OCR em todas as páginas do PDF (mais lento; útil se faltarem trechos ou tabelas)</label>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || saving || !loaded} onClick={read} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Lendo documento..." : "Extrair texto / OCR"}</button>
      {busy && <button type="button" onClick={() => controller.current?.abort()} className="text-sm underline">Cancelar leitura</button>}
      <a href={`/api/saude/documentos/${documentId}`} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Abrir original para comparar</a>
    </div>
    <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">{progress || notice}</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {extraction && <>
      <label className="mt-3 block text-sm font-medium">Texto extraído — revise e corrija
        <textarea value={extraction.text} disabled={busy || saving} maxLength={500000} onChange={e => { setExtraction({ ...extraction, text: e.target.value, edited: true }); setNotice("Alterações ainda não salvas."); }} rows={14} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm" />
      </label>
      <p className="my-2 text-xs text-slate-600">{extraction.pages.length} página(s). Tabelas podem perder o alinhamento na transcrição; confira o original.</p>
      <button type="button" disabled={busy || saving || !extraction.text.trim()} onClick={save} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand disabled:opacity-50">{saving ? "Salvando..." : "Salvar transcrição"}</button>
      {pcmso && !busy && (extraction.pcmsoSuggestions?.length ? <PcmsoSuggestions key={generation} roles={extraction.pcmsoSuggestions} pcmsoId={pcmso.id} documentId={documentId} onChanged={pcmso.onChanged} locked={pcmso.locked} /> : <p className="mt-3 text-sm text-amber-800">Nenhuma tabela de funções e exames reconhecida nesta leitura. Para transcrições antigas, clique novamente em Extrair texto / OCR, sem marcar OCR em todas as páginas. Imagens e tabelas não reconhecidas exigem cadastro manual.</p>)}
    </>}
  </section>;
}
