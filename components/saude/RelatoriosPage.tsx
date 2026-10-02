"use client";

import { useState } from "react";

type Relatorio = "nao-liberados" | "exames-vencendo" | "epi-ca-vencendo";

const RELATORIO_LABEL: Record<Relatorio, string> = {
  "nao-liberados": "Funcionários não liberados",
  "exames-vencendo": "Exames vencendo / vencidos",
  "epi-ca-vencendo": "CA de EPI vencendo / vencido",
};

function formatDate(v: string | null): string {
  return v ? new Intl.DateTimeFormat("pt-BR").format(new Date(v)) : "—";
}

// Mesmo padrão de exportação usado em components/pedidos/PedidosClient.tsx — CSV construído no
// navegador (sem rota/arquivo no servidor), BOM UTF-8 pra abrir certo no Excel.
function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers.map(escape).join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<Relatorio>("nao-liberados");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGerar() {
    setLoading(true);
    const res = await fetch(`/api/saude/relatorios/${tipo}`);
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }

  const colunas = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Relatórios</h1>
          <p className="mt-1 text-sm text-slate-500">Exporta pra CSV/Excel ou imprime direto da tela.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Relatorio)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {Object.entries(RELATORIO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button onClick={handleGerar} disabled={loading} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50">
          {loading ? "Gerando..." : "Gerar"}
        </button>
        {rows && rows.length > 0 && (
          <>
            <button
              onClick={() => exportCsv(`${tipo}-${new Date().toISOString().slice(0, 10)}.csv`, rows)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Exportar CSV
            </button>
            <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Imprimir
            </button>
          </>
        )}
      </div>

      {rows && (
        <div className="mt-5">
          <h2 className="mb-2 hidden text-lg font-semibold text-slate-800 print:block">{RELATORIO_LABEL[tipo]}</h2>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Nenhum resultado.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {colunas.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2 text-left font-semibold text-slate-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {colunas.map((c) => (
                        <td key={c} className="px-4 py-2 text-slate-700">
                          {typeof r[c] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r[c] as string) ? formatDate(r[c] as string) : String(r[c] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
