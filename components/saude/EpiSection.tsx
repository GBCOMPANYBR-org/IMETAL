"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

const TIPO_MOVIMENTO_LABEL: Record<string, string> = { ENTREGA: "Entrega", TROCA: "Troca", DEVOLUCAO: "Devolução" };
const TIPO_MOVIMENTO_CLS: Record<string, string> = {
  ENTREGA: "bg-emerald-100 text-emerald-700",
  TROCA: "bg-amber-100 text-amber-700",
  DEVOLUCAO: "bg-slate-200 text-slate-600",
};

interface EpiRecord {
  id: number;
  tipo: { nome: string };
  tipoMovimento: "ENTREGA" | "TROCA" | "DEVOLUCAO";
  ca: string;
  validadeCa: string | null;
  lote: string | null;
  quantidade: number;
  dataMovimento: string;
  motivo: string | null;
  responsavel: { name: string } | null;
  documento: { id: number } | null;
  substituiMovimento: { id: number } | null;
}

function formatDate(v: string | null): string {
  return v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v)) : "—";
}

function situacaoCa(validadeCa: string | null): { label: string; cls: string } | null {
  if (!validadeCa) return null;
  const dias = Math.floor((new Date(validadeCa).getTime() - new Date(new Date().toDateString()).getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { label: "CA vencido", cls: "text-red-600 font-semibold" };
  if (dias <= 30) return { label: "CA vencendo", cls: "text-amber-600 font-semibold" };
  return null;
}

export default function EpiSection({ funcionarioId, canEdit }: { funcionarioId: number; canEdit: boolean }) {
  const [movimentos, setMovimentos] = useState<EpiRecord[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [trocaAlvo, setTrocaAlvo] = useState<{ movimento: EpiRecord; tipo: "TROCA" | "DEVOLUCAO" } | null>(null);

  async function load() {
    const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/epi`);
    if (res.ok) setMovimentos(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId]);

  // Um movimento está "ativo" (ainda em uso) quando é ENTREGA/TROCA e nenhum outro movimento o
  // substituiu ainda — é exatamente o que dá direito a "Trocar"/"Devolver".
  const substituidoIds = new Set((movimentos ?? []).map((m) => m.substituiMovimento?.id).filter((id): id is number => id !== undefined && id !== null));
  const ativos = new Set(
    (movimentos ?? []).filter((m) => m.tipoMovimento !== "DEVOLUCAO" && !substituidoIds.has(m.id)).map((m) => m.id)
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">EPIs</h2>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-brand hover:underline">
            + Nova entrega
          </button>
        )}
      </div>

      {movimentos === null ? (
        <p className="mt-2 text-sm text-slate-400">Carregando...</p>
      ) : movimentos.length === 0 ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">Nenhum EPI registrado.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">EPI</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Movimento</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">CA</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Validade CA</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Lote</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Qtd.</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Data</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Responsável</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => {
                const situacao = situacaoCa(m.validadeCa);
                const ativo = ativos.has(m.id);
                return (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{m.tipo.nome}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIPO_MOVIMENTO_CLS[m.tipoMovimento]}`}>
                        {TIPO_MOVIMENTO_LABEL[m.tipoMovimento]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{m.ca}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDate(m.validadeCa)}
                      {situacao && <span className={`ml-1 text-xs ${situacao.cls}`}>({situacao.label})</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{m.lote ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{m.quantidade}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(m.dataMovimento)}</td>
                    <td className="px-3 py-2 text-slate-500">{m.responsavel?.name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {m.documento && (
                          <a href={`/api/saude/documentos/${m.documento.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                            ficha
                          </a>
                        )}
                        {canEdit && ativo && (
                          <>
                            <button onClick={() => setTrocaAlvo({ movimento: m, tipo: "TROCA" })} className="text-xs text-brand hover:underline">
                              trocar
                            </button>
                            <button onClick={() => setTrocaAlvo({ movimento: m, tipo: "DEVOLUCAO" })} className="text-xs text-slate-500 hover:underline">
                              devolver
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <EpiFormModal
          funcionarioId={funcionarioId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {trocaAlvo && (
        <EpiFormModal
          funcionarioId={funcionarioId}
          substitui={trocaAlvo.movimento}
          tipoMovimento={trocaAlvo.tipo}
          onClose={() => setTrocaAlvo(null)}
          onSaved={() => {
            setTrocaAlvo(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EpiFormModal({
  funcionarioId,
  substitui,
  tipoMovimento,
  onClose,
  onSaved,
}: {
  funcionarioId: number;
  substitui?: EpiRecord;
  tipoMovimento?: "TROCA" | "DEVOLUCAO";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDevolucao = tipoMovimento === "DEVOLUCAO";
  const [tipoEpiNome, setTipoEpiNome] = useState(substitui?.tipo.nome ?? "");
  const [ca, setCa] = useState("");
  const [validadeCa, setValidadeCa] = useState("");
  const [lote, setLote] = useState("");
  const [quantidade, setQuantidade] = useState(substitui?.quantidade ?? 1);
  const [motivo, setMotivo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let blobUrl: string | undefined;
      let mimeType: string | undefined;
      let size: number | undefined;

      if (file) {
        const blob = await upload(`saude/epi/${funcionarioId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/saude/blob/upload",
          clientPayload: JSON.stringify({ kind: "epi", funcionarioId }),
        });
        blobUrl = blob.url;
        mimeType = file.type || "application/octet-stream";
        size = file.size;
      }

      const res = await fetch(`/api/saude/funcionarios/${funcionarioId}/epi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoEpiNome,
          tipoMovimento: tipoMovimento ?? "ENTREGA",
          ca: isDevolucao ? undefined : ca,
          validadeCa: isDevolucao ? undefined : validadeCa || null,
          lote: isDevolucao ? undefined : lote || null,
          quantidade,
          motivo: motivo || null,
          substituiMovimentoId: substitui?.id,
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

  const titulo = isDevolucao ? "Devolver EPI" : tipoMovimento === "TROCA" ? "Trocar EPI" : "Nova entrega de EPI";

  return (
    <Modal title={titulo} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Tipo de EPI <span className="text-red-400">*</span>
          </span>
          <input
            value={tipoEpiNome}
            onChange={(e) => setTipoEpiNome(e.target.value)}
            placeholder="ex.: Luva de raspa"
            className={INPUT_CLS}
            disabled={!!substitui}
          />
        </label>

        {!isDevolucao && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">
                  CA <span className="text-red-400">*</span>
                </span>
                <input value={ca} onChange={(e) => setCa(e.target.value)} className={INPUT_CLS} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Validade do CA</span>
                <input type="date" value={validadeCa} onChange={(e) => setValidadeCa(e.target.value)} className={INPUT_CLS} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Lote</span>
              <input value={lote} onChange={(e) => setLote(e.target.value)} className={INPUT_CLS} />
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Quantidade</span>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value) || 1)}
            className={INPUT_CLS}
          />
        </label>

        {tipoMovimento && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Motivo da {isDevolucao ? "devolução" : "troca"} <span className="text-red-400">*</span>
            </span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="ex.: desgaste, dano, desligamento..."
              className={INPUT_CLS}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Ficha assinada (opcional)</span>
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
