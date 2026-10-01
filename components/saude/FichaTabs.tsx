"use client";

import { useState } from "react";
import LiberacaoChecklist from "@/components/saude/LiberacaoChecklist";

const TABS = ["Visão geral", "ASO", "Exames", "Documentos", "Histórico", "Liberação"] as const;

export default function FichaTabs({
  funcionarioId,
  alocacaoAtiva,
  children,
}: {
  funcionarioId: number;
  alocacaoAtiva: { unidadeId: number; funcaoId: number } | null;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<(typeof TABS)[number]>("Visão geral");

  return (
    <div>
      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => {
          const enabled = tab === "Visão geral" || tab === "Liberação";
          return (
            <button
              key={tab}
              disabled={!enabled}
              onClick={() => enabled && setActive(tab)}
              className={`px-3 py-2 text-sm font-medium transition ${
                !enabled
                  ? "cursor-not-allowed text-slate-300"
                  : active === tab
                    ? "border-b-2 border-brand text-brand"
                    : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {active === "Visão geral" && children}
        {active === "Liberação" &&
          (alocacaoAtiva ? (
            <LiberacaoChecklist funcionarioId={funcionarioId} unidadeId={alocacaoAtiva.unidadeId} funcaoId={alocacaoAtiva.funcaoId} />
          ) : (
            <p className="text-sm text-slate-400">Sem alocação ativa — nada para calcular.</p>
          ))}
      </div>
    </div>
  );
}
