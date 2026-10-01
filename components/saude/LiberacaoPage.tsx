"use client";

import { useEffect, useState } from "react";
import LiberacaoChecklist from "@/components/saude/LiberacaoChecklist";

interface FuncionarioOption {
  id: number;
  nome: string;
  matricula: string;
}

export default function LiberacaoPage() {
  const [q, setQ] = useState("");
  const [opcoes, setOpcoes] = useState<FuncionarioOption[]>([]);
  const [selecionado, setSelecionado] = useState<FuncionarioOption | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setOpcoes([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/saude/funcionarios?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then(setOpcoes)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-800">Liberação para Trabalho</h1>
      <p className="mt-1 text-sm text-slate-500">Selecione um funcionário para ver a situação documental na alocação ativa.</p>

      <div className="relative mt-5 max-w-sm">
        <input
          value={selecionado ? selecionado.nome : q}
          onChange={(e) => {
            setSelecionado(null);
            setQ(e.target.value);
          }}
          placeholder="Buscar funcionário..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {!selecionado && opcoes.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            {opcoes.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                    setSelecionado(f);
                    setOpcoes([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {f.nome} <span className="text-slate-400">· {f.matricula}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selecionado && (
        <div className="mt-6">
          <LiberacaoChecklist funcionarioId={selecionado.id} />
        </div>
      )}
    </div>
  );
}
