"use client";

import { useEffect, useState } from "react";

const INPUT_CLS = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";

const PERIODICIDADE_LABEL: Record<string, string> = {
  ADMISSIONAL: "Admissional",
  PERIODICO: "Periódico",
  RETORNO_TRABALHO: "Retorno ao trabalho",
  MUDANCA_RISCO: "Mudança de risco",
  DEMISSIONAL: "Demissional",
  OUTRO: "Outro",
};

interface Requisito {
  id: number;
  tipoExame: { nome: string };
  periodicidade: string;
  periodicidadeDetalhe: string | null;
  obrigatorio: boolean;
}

interface Risco {
  id: number;
  risco: { nome: string };
}

interface PcmsoFuncao {
  id: number;
  funcao: { nome: string };
  riscos: Risco[];
  requisitos: Requisito[];
}

interface Versao {
  id: number;
  versao: string;
  status: "EM_PROCESSAMENTO" | "AGUARDANDO_REVISAO" | "ATIVO" | "SUBSTITUIDO" | "ARQUIVADO";
  inicioVigencia: string;
  fimVigencia: string | null;
  medicoResponsavel: string | null;
  crm: string | null;
  unidade: { nome: string; cliente: { nome: string } };
  documento: { id: number; nomeOriginal: string } | null;
  funcoes: PcmsoFuncao[];
}

const STATUS_LABEL: Record<Versao["status"], string> = {
  EM_PROCESSAMENTO: "Em processamento",
  AGUARDANDO_REVISAO: "Aguardando revisão",
  ATIVO: "Ativo",
  SUBSTITUIDO: "Substituído",
  ARQUIVADO: "Arquivado",
};

export default function PcmsoDetailClient({
  pcmsoId,
  canReview,
  canApprove,
}: {
  pcmsoId: number;
  canReview: boolean;
  canApprove: boolean;
}) {
  const [versao, setVersao] = useState<Versao | null>(null);
  const [novaFuncao, setNovaFuncao] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/saude/pcmso/${pcmsoId}`);
    if (res.ok) setVersao(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcmsoId]);

  async function handleAddFuncao(e: React.FormEvent) {
    e.preventDefault();
    if (!novaFuncao.trim()) return;
    const res = await fetch(`/api/saude/pcmso/${pcmsoId}/funcoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funcaoNome: novaFuncao }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível adicionar a função.");
      return;
    }
    setNovaFuncao("");
    setError(null);
    load();
  }

  async function handleRemoveFuncao(pcmsoFuncaoId: number) {
    if (!confirm("Remover esta função e tudo que está nela (riscos e exames)?")) return;
    await fetch(`/api/saude/pcmso/${pcmsoId}/funcoes/${pcmsoFuncaoId}`, { method: "DELETE" });
    load();
  }

  async function handlePublicar() {
    if (!confirm("Publicar esta versão? Ela passa a valer pro motor de liberação, e uma versão ativa anterior desta unidade será encerrada.")) return;
    setPublishing(true);
    const res = await fetch(`/api/saude/pcmso/${pcmsoId}/publicar`, { method: "POST" });
    setPublishing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível publicar.");
      return;
    }
    load();
  }

  if (!versao) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {versao.unidade.cliente.nome} — {versao.unidade.nome}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Versão {versao.versao} ·{" "}
            <span className="font-medium">{STATUS_LABEL[versao.status]}</span>
          </p>
        </div>
        {versao.documento && (
          <a
            href={`/api/saude/documentos/${versao.documento.id}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Ver documento original
          </a>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {versao.status !== "ATIVO" && versao.status !== "SUBSTITUIDO" && versao.status !== "ARQUIVADO" && canApprove && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700">Confira as funções, riscos e exames abaixo antes de publicar.</p>
          <button
            onClick={handlePublicar}
            disabled={publishing}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
          >
            {publishing ? "Publicando..." : "Aprovar e publicar"}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {versao.funcoes.map((pf) => (
          <FuncaoCard key={pf.id} pcmsoId={pcmsoId} pcmsoFuncao={pf} canReview={canReview} onRemoveFuncao={() => handleRemoveFuncao(pf.id)} onChanged={load} />
        ))}

        {canReview && (
          <form onSubmit={handleAddFuncao} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              placeholder="Adicionar função (ex.: Montador)"
              className={`${INPUT_CLS} flex-1`}
            />
            <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-light">
              Adicionar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function FuncaoCard({
  pcmsoId,
  pcmsoFuncao,
  canReview,
  onRemoveFuncao,
  onChanged,
}: {
  pcmsoId: number;
  pcmsoFuncao: PcmsoFuncao;
  canReview: boolean;
  onRemoveFuncao: () => void;
  onChanged: () => void;
}) {
  const [novoRisco, setNovoRisco] = useState("");
  const [novoExame, setNovoExame] = useState("");
  const [periodicidade, setPeriodicidade] = useState("PERIODICO");

  async function handleAddRisco(e: React.FormEvent) {
    e.preventDefault();
    if (!novoRisco.trim()) return;
    await fetch(`/api/saude/pcmso/${pcmsoId}/funcoes/${pcmsoFuncao.id}/riscos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoRisco }),
    });
    setNovoRisco("");
    onChanged();
  }

  async function handleAddRequisito(e: React.FormEvent) {
    e.preventDefault();
    if (!novoExame.trim()) return;
    await fetch(`/api/saude/pcmso/${pcmsoId}/funcoes/${pcmsoFuncao.id}/requisitos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoExameNome: novoExame, periodicidade, obrigatorio: true }),
    });
    setNovoExame("");
    onChanged();
  }

  async function handleRemoveRequisito(requisitoId: number) {
    await fetch(`/api/saude/pcmso/${pcmsoId}/funcoes/${pcmsoFuncao.id}/requisitos/${requisitoId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">{pcmsoFuncao.funcao.nome}</h3>
        {canReview && (
          <button onClick={onRemoveFuncao} className="text-xs font-semibold text-red-500 hover:underline">
            Remover função
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {pcmsoFuncao.riscos.map((r) => (
          <span key={r.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {r.risco.nome}
          </span>
        ))}
        {canReview && (
          <form onSubmit={handleAddRisco} className="flex items-center gap-1">
            <input
              value={novoRisco}
              onChange={(e) => setNovoRisco(e.target.value)}
              placeholder="+ risco"
              className="w-28 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs"
            />
          </form>
        )}
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="py-1 font-medium">Exame</th>
            <th className="py-1 font-medium">Periodicidade</th>
            <th className="py-1 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {pcmsoFuncao.requisitos.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-700">{r.tipoExame.nome}</td>
              <td className="py-1.5 text-slate-500">{PERIODICIDADE_LABEL[r.periodicidade] ?? r.periodicidade}</td>
              <td className="py-1.5 text-right">
                {canReview && (
                  <button onClick={() => handleRemoveRequisito(r.id)} className="text-xs text-red-400 hover:underline">
                    remover
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canReview && (
        <form onSubmit={handleAddRequisito} className="mt-2 flex items-center gap-2">
          <input value={novoExame} onChange={(e) => setNovoExame(e.target.value)} placeholder="+ exame (ex.: Audiometria)" className={`${INPUT_CLS} flex-1`} />
          <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className={INPUT_CLS}>
            {Object.entries(PERIODICIDADE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
            Adicionar
          </button>
        </form>
      )}
    </div>
  );
}
