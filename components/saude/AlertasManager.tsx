"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TIPO_LABEL: Record<string, string> = {
  ASO_VENCENDO: "ASO vencendo",
  ASO_VENCIDO: "ASO vencido",
  EXAME_VENCENDO: "Exame vencendo",
  EXAME_VENCIDO: "Exame vencido",
  PCMSO_VENCENDO: "PCMSO vencendo",
  PCMSO_VENCIDO: "PCMSO vencido",
  FUNCIONARIO_PENDENTE: "Funcionário com pendência",
};

const TIPO_CLS: Record<string, string> = {
  ASO_VENCENDO: "bg-amber-100 text-amber-700",
  EXAME_VENCENDO: "bg-amber-100 text-amber-700",
  PCMSO_VENCENDO: "bg-amber-100 text-amber-700",
  ASO_VENCIDO: "bg-red-100 text-red-700",
  EXAME_VENCIDO: "bg-red-100 text-red-700",
  PCMSO_VENCIDO: "bg-red-100 text-red-700",
  FUNCIONARIO_PENDENTE: "bg-red-100 text-red-700",
};

interface Alerta {
  id: number;
  tipo: string;
  prazoEm: string | null;
  funcionario: { id: number; nome: string } | null;
  unidade: { nome: string; cliente: { nome: string } } | null;
  pcmsoVersao: { versao: string } | null;
  exame: { tipoExame: { nome: string } } | null;
}

function formatDate(v: string | null): string {
  return v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v)) : "—";
}

function descrever(a: Alerta): string {
  if (a.exame) return `${a.funcionario?.nome ?? ""} — ${a.exame.tipoExame.nome}`;
  if (a.pcmsoVersao && a.unidade) return `${a.unidade.cliente.nome} — ${a.unidade.nome} (v${a.pcmsoVersao.versao})`;
  if (a.funcionario) return a.funcionario.nome;
  return "—";
}

export default function AlertasManager({ canManage }: { canManage: boolean }) {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [filtro, setFiltro] = useState<string>("TODOS");

  useEffect(() => {
    fetch("/api/saude/alertas")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAlertas)
      .catch(() => undefined);
  }, []);

  const visiveis = alertas?.filter((a) => filtro === "TODOS" || a.tipo === filtro) ?? [];
  const tiposPresentes = [...new Set((alertas ?? []).map((a) => a.tipo))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFiltro("TODOS")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === "TODOS" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todos ({alertas?.length ?? 0})
        </button>
        {tiposPresentes.map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltro(tipo)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === tipo ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {TIPO_LABEL[tipo] ?? tipo}
          </button>
        ))}
      </div>

      {alertas === null ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Nenhum alerta aberto.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Tipo</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Referente a</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_CLS[a.tipo] ?? "bg-slate-100 text-slate-600"}`}>
                      {TIPO_LABEL[a.tipo] ?? a.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {a.funcionario ? (
                      <Link href={`/saude/funcionarios/${a.funcionario.id}`} className="hover:underline">
                        {descrever(a)}
                      </Link>
                    ) : (
                      descrever(a)
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(a.prazoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && <RegrasAlerta />}
    </div>
  );
}

interface Regra {
  id: number;
  tipo: string;
  dias: number;
}

const TIPOS_COM_PRAZO = ["EXAME_VENCENDO", "PCMSO_VENCENDO"];

function RegrasAlerta() {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [tipo, setTipo] = useState(TIPOS_COM_PRAZO[0]);
  const [dias, setDias] = useState(30);

  async function load() {
    const res = await fetch("/api/saude/alertas/regras");
    if (res.ok) setRegras(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/saude/alertas/regras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, dias }),
    });
    load();
  }

  async function handleRemove(id: number) {
    await fetch(`/api/saude/alertas/regras/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-slate-700">Antecedência dos alertas</h2>
      <p className="mt-1 text-xs text-slate-400">Sem nenhuma regra cadastrada, o padrão é 90/60/30/15/7 dias.</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {regras.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {TIPO_LABEL[r.tipo] ?? r.tipo}: {r.dias}d
            <button onClick={() => handleRemove(r.id)} className="text-slate-400 hover:text-red-500">
              ×
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
          {TIPOS_COM_PRAZO.map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </select>
        <input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
        <span className="text-xs text-slate-400">dias antes</span>
        <button type="submit" className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
          Adicionar
        </button>
      </form>
    </div>
  );
}
