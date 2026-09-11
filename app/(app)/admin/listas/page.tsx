"use client";

import { useState } from "react";
import SimpleListManager from "@/components/admin/SimpleListManager";

const TABS = [
  { key: "faturamento", label: "Faturamento", endpoint: "/api/options/faturamento" },
  { key: "tipo", label: "Tipo", endpoint: "/api/options/tipo" },
  { key: "faturado", label: "Faturado", endpoint: "/api/options/faturado" },
  { key: "pagamento", label: "Pagamento", endpoint: "/api/options/pagamento" },
] as const;

export default function ListasAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("faturamento");
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-800">Listas de opções</h1>
      <p className="mb-4 text-sm text-slate-500">Faturamento, Tipo, Faturado e Pagamento — adicione, edite ou remova as opções disponíveis nos pedidos.</p>
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-300 p-0.5" style={{ width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.key ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <SimpleListManager key={active.key} endpoint={active.endpoint} fieldName="label" itemLabel={active.label} />
    </div>
  );
}
