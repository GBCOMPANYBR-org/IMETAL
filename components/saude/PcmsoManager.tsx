"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PcmsoUploadModal from "@/components/saude/PcmsoUploadModal";

interface VersaoRecord {
  id: number;
  versao: string;
  status: "EM_PROCESSAMENTO" | "AGUARDANDO_REVISAO" | "ATIVO" | "SUBSTITUIDO" | "ARQUIVADO";
  inicioVigencia: string;
  fimVigencia: string | null;
  unidade: { nome: string; cliente: { nome: string } };
}

const STATUS_LABEL: Record<VersaoRecord["status"], string> = {
  EM_PROCESSAMENTO: "Em processamento",
  AGUARDANDO_REVISAO: "Aguardando revisão",
  ATIVO: "Ativo",
  SUBSTITUIDO: "Substituído",
  ARQUIVADO: "Arquivado",
};

const STATUS_CLS: Record<VersaoRecord["status"], string> = {
  EM_PROCESSAMENTO: "bg-slate-100 text-slate-500",
  AGUARDANDO_REVISAO: "bg-amber-100 text-amber-700",
  ATIVO: "bg-emerald-100 text-emerald-700",
  SUBSTITUIDO: "bg-slate-100 text-slate-500",
  ARQUIVADO: "bg-slate-100 text-slate-400",
};

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";
}

export default function PcmsoManager({ canUpload }: { canUpload: boolean }) {
  const [versoes, setVersoes] = useState<VersaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/saude/pcmso");
    if (res.ok) setVersoes(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {canUpload && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowUpload(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light">
            + Novo PCMSO
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : versoes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Nenhum PCMSO cadastrado.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Unidade</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Versão</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Vigência</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">
                    <Link href={`/saude/pcmso/${v.id}`} className="hover:underline">
                      {v.unidade.cliente.nome} — {v.unidade.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{v.versao}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {formatDate(v.inicioVigencia)} a {formatDate(v.fimVigencia)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <PcmsoUploadModal
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
