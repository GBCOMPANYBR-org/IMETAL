"use client";

import { useEffect, useState } from "react";

type StatusGeral = "LIBERADO" | "LIBERADO_ATENCAO" | "NAO_LIBERADO" | "REVISAO_NECESSARIA";
type ItemStatus = "REGULAR" | "ATENCAO" | "PENDENTE" | "VENCIDO" | "NAO_APLICAVEL" | "EM_ANALISE";

interface ChecklistItem {
  tipo: "ASO" | "EXAME";
  descricao: string;
  exigencia: string | null;
  status: ItemStatus;
  motivo: string;
  dataRegistro: string | null;
  prazo: string | null;
  documentoRelacionadoId: number | null;
}

interface LiberacaoResult {
  funcionario: { id: number; nome: string };
  unidade: { id: number; nome: string; cliente: { nome: string } };
  funcao: { id: number; nome: string };
  statusGeral: StatusGeral;
  motivoGeral: string | null;
  itens: ChecklistItem[];
  pcmsoVersao: { id: number; versao: string } | null;
}

const STATUS_GERAL_LABEL: Record<StatusGeral, string> = {
  LIBERADO: "🟢 LIBERADO",
  LIBERADO_ATENCAO: "🟡 LIBERADO COM ATENÇÃO",
  NAO_LIBERADO: "🔴 NÃO LIBERADO",
  REVISAO_NECESSARIA: "🔵 REVISÃO NECESSÁRIA",
};

const STATUS_GERAL_CLS: Record<StatusGeral, string> = {
  LIBERADO: "bg-emerald-50 border-emerald-200 text-emerald-800",
  LIBERADO_ATENCAO: "bg-amber-50 border-amber-200 text-amber-800",
  NAO_LIBERADO: "bg-red-50 border-red-200 text-red-800",
  REVISAO_NECESSARIA: "bg-blue-50 border-blue-200 text-blue-800",
};

const ITEM_PILL: Record<ItemStatus, string> = {
  REGULAR: "bg-emerald-100 text-emerald-700",
  ATENCAO: "bg-amber-100 text-amber-700",
  PENDENTE: "bg-red-100 text-red-700",
  VENCIDO: "bg-red-100 text-red-700",
  NAO_APLICAVEL: "bg-slate-100 text-slate-500",
  EM_ANALISE: "bg-blue-100 text-blue-700",
};

const ITEM_LABEL: Record<ItemStatus, string> = {
  REGULAR: "Regular",
  ATENCAO: "Atenção",
  PENDENTE: "Pendente",
  VENCIDO: "Vencido",
  NAO_APLICAVEL: "Não aplicável",
  EM_ANALISE: "Em análise",
};

export default function LiberacaoChecklist({ funcionarioId, unidadeId, funcaoId }: { funcionarioId: number; unidadeId?: number; funcaoId?: number }) {
  const [resultado, setResultado] = useState<LiberacaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ funcionarioId: String(funcionarioId) });
    if (unidadeId) params.set("unidadeId", String(unidadeId));
    if (funcaoId) params.set("funcaoId", String(funcaoId));

    setLoading(true);
    setError(null);
    fetch(`/api/saude/liberacao?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Não foi possível calcular a liberação.");
        }
        return res.json();
      })
      .then(setResultado)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [funcionarioId, unidadeId, funcaoId]);

  if (loading) return <p className="text-sm text-slate-400">Calculando...</p>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!resultado) return null;

  return (
    <div>
      <div className={`rounded-xl border px-4 py-3 ${STATUS_GERAL_CLS[resultado.statusGeral]}`}>
        <div className="font-semibold">{STATUS_GERAL_LABEL[resultado.statusGeral]}</div>
        <div className="mt-0.5 text-sm opacity-80">
          {resultado.unidade.cliente.nome} — {resultado.unidade.nome} · {resultado.funcao.nome}
          {resultado.pcmsoVersao && <> · PCMSO {resultado.pcmsoVersao.versao}</>}
        </div>
        {resultado.motivoGeral && <div className="mt-1 text-sm opacity-80">{resultado.motivoGeral}</div>}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-500">Item</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-500">Exigência</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-500">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {resultado.itens.map((item, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">{item.descricao}</td>
                <td className="px-4 py-2 text-slate-500">{item.exigencia ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ITEM_PILL[item.status]}`}>{ITEM_LABEL[item.status]}</span>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {item.motivo}
                  {item.documentoRelacionadoId && (
                    <>
                      {" "}
                      <a href={`/api/saude/documentos/${item.documentoRelacionadoId}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        ver documento
                      </a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
