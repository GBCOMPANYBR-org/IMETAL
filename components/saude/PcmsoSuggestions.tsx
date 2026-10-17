"use client";
import { useState } from "react";
import { occasions, type SuggestedRole } from "@/lib/saude/ocr/pcmso";
const labels: Record<string,string> = { ADMISSIONAL:"Admissional", PERIODICO:"Periódico", RETORNO_TRABALHO:"Retorno", MUDANCA_RISCO:"Mudança de risco", DEMISSIONAL:"Demissional" };

export default function PcmsoSuggestions({ roles, pcmsoId, documentId, onChanged, locked }: { roles: SuggestedRole[]; pcmsoId:number; documentId:number; onChanged:()=>void; locked:boolean }) {
  return <section className="mt-4 space-y-3" aria-label="Sugestões de funções e exames">
    <h3 className="font-semibold">Funções e exames identificados ({roles.length})</h3>
    <p className="text-sm">Confira cada função e suas marcações com o original. As sugestões vêm das tabelas do PDF; alterações na transcrição acima não alteram estas sugestões. Riscos, condições especiais e regras gerais precisam de conferência separada.</p>
    {locked && <p role="alert" className="text-sm text-amber-800">Esta versão não está em revisão. Crie uma nova versão para cadastrar as sugestões.</p>}
    {roles.map((role,index) => <RoleReview key={`${role.pagina}-${index}`} role={role} pcmsoId={pcmsoId} documentId={documentId} onChanged={onChanged} locked={locked} />)}
  </section>;
}
function RoleReview({role,pcmsoId,documentId,onChanged,locked}:{role:SuggestedRole;pcmsoId:number;documentId:number;onChanged:()=>void;locked:boolean}) {
  const [draft,setDraft]=useState(role); const [checked,setChecked]=useState(false); const [busy,setBusy]=useState(false); const [done,setDone]=useState(false); const [notice,setNotice]=useState("");
  function update(next:SuggestedRole) { setDraft(next); setChecked(false); }
  async function save() {
    setBusy(true); setNotice("");
    try {
      const response=await fetch(`/api/saude/pcmso/${pcmsoId}/importar-conferido`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentId,conferido:checked,funcao:draft})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error || "Não foi possível cadastrar.");
      setDone(true); setNotice(`Função cadastrada. ${body.added} requisito(s) incluído(s). ${body.skipped} já existente(s) preservado(s); confira eventuais diferenças no cadastro abaixo.`); onChanged();
    } catch(e) { setNotice(e instanceof Error?e.message:"Falha ao cadastrar."); } finally { setBusy(false); }
  }
  const disabled=busy||done||locked;
  return <details className="rounded-lg border border-slate-300 bg-white p-3">
    <summary className="cursor-pointer font-medium">{role.nome} — {draft.exames.length} exame(s) · pág. {role.pagina}{done?" · Cadastrada":" · Conferir"}</summary>
    <fieldset disabled={disabled} className="mt-3 space-y-3">
      <label className="block text-sm">Nome da função<input value={draft.nome} maxLength={200} onChange={e=>update({...draft,nome:e.target.value})} className="mt-1 block w-full rounded border p-2" /></label>
      {role.avisos.map((warning,index)=><p key={index} className="text-sm text-amber-800">{warning}</p>)}
      <a href={`/api/saude/documentos/${documentId}#page=${role.pagina}`} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Conferir página {role.pagina} no original</a>
      {draft.exames.map((exam,index)=><div key={index} className="space-y-2 rounded border p-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 text-sm">Exame<input value={exam.nome} maxLength={200} onChange={e=>update({...draft,exames:draft.exames.map((v,i)=>i===index?{...v,nome:e.target.value}:v)})} className="block w-full rounded border p-2" /></label>
          <label className="text-sm">Intervalo (meses)<input type="number" min={1} max={120} value={exam.meses || ""} onChange={e=>update({...draft,exames:draft.exames.map((v,i)=>i===index?{...v,meses:Number(e.target.value)}:v)})} className="block w-24 rounded border p-2" /></label>
          <button type="button" onClick={()=>update({...draft,exames:draft.exames.filter((_,i)=>i!==index)})} className="text-sm text-red-700 underline">Excluir sugestão</button>
        </div>
        <div className="flex flex-wrap gap-3">{occasions.map(o=><label key={o} className="text-xs"><input type="checkbox" checked={exam.ocasioes.includes(o)} onChange={e=>update({...draft,exames:draft.exames.map((v,i)=>i===index?{...v,ocasioes:e.target.checked?[...v.ocasioes,o]:v.ocasioes.filter(a=>a!==o)}:v)})} /> {labels[o]}</label>)}</div>
        <details className="text-xs text-slate-600"><summary className="cursor-pointer">Origem: página {exam.pagina}</summary><p className="mt-1">{exam.trecho}</p><a href={`/api/saude/documentos/${documentId}#page=${exam.pagina}`} target="_blank" rel="noreferrer" className="underline">Abrir página</a></details>
      </div>)}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />Conferi esta função, os exames, intervalos e ocasiões com o documento original.</label>
      <button type="button" disabled={disabled||!checked||!draft.nome.trim()||draft.exames.some(e=>!e.nome.trim()||!e.ocasioes.length||e.meses<1||e.meses>120)} onClick={save} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Cadastrando...":done?"Cadastrada":"Confirmar cadastro desta função e exames"}</button>
    </fieldset>
    <p role="status" className="mt-2 text-sm">{notice}</p>
  </details>;
}
