"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { PEDIDO_FIELDS } from "@/lib/fields";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import type { PedidoOptions } from "@/lib/useOptions";

const FIELD_TO_FORM_KEY: Record<string, string> = {
  status: "statusId",
  cliente: "clienteId",
  faturamento: "faturamentoId",
  tipo: "tipoId",
  faturado: "faturadoId",
  pagamento: "pagamentoId",
  pedidoCompra: "pedidoCompra",
  data: "data",
  qtd: "qtd",
  codigo: "codigo",
  descricao: "descricao",
  ncm: "ncm",
  valorUnitario: "valorUnitario",
  observacao: "observacao",
  dataFaturamento: "dataFaturamento",
  nf: "nf",
  pdv: "pdv",
};

export interface PedidoRecord {
  id: number;
  statusEditable?: boolean;
  status?: { id: number; label: string; color: string; editable: boolean };
  cliente?: { id: number; name: string };
  faturamento?: { id: number; label: string };
  tipo?: { id: number; label: string };
  faturado?: { id: number; label: string };
  pagamento?: { id: number; label: string } | null;
  pedidoCompra?: string | null;
  data?: string | null;
  qtd?: number;
  codigo?: string | null;
  descricao?: string | null;
  ncm?: string | null;
  valorUnitario?: number;
  valorTotal?: number;
  observacao?: string | null;
  dataFaturamento?: string | null;
  nf?: string | null;
  pdv?: string | null;
  [key: string]: unknown;
}

interface Props {
  mode: "create" | "edit";
  pedido: PedidoRecord | null;
  visibleFields: Set<string>;
  isAdmin: boolean;
  options: PedidoOptions;
  onClose: () => void;
  onSaved: () => void;
  /** Create mode only: called after "Adicionar Item" saves the current pedido, so the table refreshes in the background while the form stays open for the next line item. */
  onItemAdded?: () => void;
}

/** Fields carried over to the next form when "Adicionar Item" is used — the rest of the form clears for the next line item. */
const CARRY_OVER_ON_ADD_ITEM = ["cliente", "pedidoCompra", "data", "status", "faturamento", "pagamento", "tipo"];

export default function PedidoFormModal({ mode, pedido, visibleFields, isAdmin, options, onClose, onSaved, onItemAdded }: Props) {
  const fields = useMemo(
    () =>
      PEDIDO_FIELDS.filter((f) => f.formEditable && visibleFields.has(f.key))
        .filter((f) => !(f.key === "faturado" && mode === "create"))
        // Only ADMIN can edit/erase existing Observações here — everyone else can only add to
        // it via the "+ observação" button in the table, which appends and never deletes.
        .filter((f) => !(f.key === "observacao" && mode === "edit" && !isAdmin)),
    [visibleFields, mode, isAdmin]
  );

  const initial: Record<string, string> = {};
  for (const f of fields) {
    if (!pedido) continue;
    switch (f.key) {
      case "status":
        initial.statusId = pedido.status?.id?.toString() ?? "";
        break;
      case "cliente":
        initial.clienteId = pedido.cliente?.id?.toString() ?? "";
        break;
      case "faturamento":
        initial.faturamentoId = pedido.faturamento?.id?.toString() ?? "";
        break;
      case "tipo":
        initial.tipoId = pedido.tipo?.id?.toString() ?? "";
        break;
      case "faturado":
        initial.faturadoId = pedido.faturado?.id?.toString() ?? "";
        break;
      case "pagamento":
        initial.pagamentoId = pedido.pagamento?.id?.toString() ?? "";
        break;
      case "data":
        initial.data = toDateInputValue(pedido.data ?? null);
        break;
      case "dataFaturamento":
        initial.dataFaturamento = toDateInputValue(pedido.dataFaturamento ?? null);
        break;
      case "qtd":
        initial.qtd = String(pedido.qtd ?? 0);
        break;
      case "valorUnitario":
        initial.valorUnitario = String(pedido.valorUnitario ?? 0);
        break;
      default:
        initial[f.key] = (pedido[f.key] as string | undefined) ?? "";
    }
  }

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [codigoRefLoading, setCodigoRefLoading] = useState(false);
  const [codigoRefFound, setCodigoRefFound] = useState(false);

  const qtd = Number(values.qtd ?? 0) || 0;
  const valorUnitario = Number(values.valorUnitario ?? 0) || 0;

  function setValue(fieldKey: string, v: string) {
    const formKey = FIELD_TO_FORM_KEY[fieldKey];
    setValues((prev) => ({ ...prev, [formKey]: v }));
    if (fieldKey === "codigo" || fieldKey === "cliente") setCodigoRefFound(false);
  }
  function getValue(fieldKey: string): string {
    return values[FIELD_TO_FORM_KEY[fieldKey]] ?? "";
  }

  /** Create mode only: offers the last registered Descrição/Valor Unitário/NCM for this Cliente +
   * Código as a starting point — the user can still change any of these fields afterwards. */
  async function handleCodigoBlur() {
    if (mode !== "create") return;
    const clienteId = getValue("cliente");
    const codigo = getValue("codigo").trim();
    if (!clienteId || !codigo) return;

    setCodigoRefFound(false);
    setCodigoRefLoading(true);
    try {
      const res = await fetch(`/api/pedidos/codigo-lookup?clienteId=${clienteId}&codigo=${encodeURIComponent(codigo)}`);
      if (!res.ok) return;
      const body = await res.json();
      const match = body.match as { descricao: string | null; valorUnitario: number | null; ncm: string | null } | null;
      if (!match) return;
      setValues((prev) => ({
        ...prev,
        ...(match.descricao !== null ? { descricao: match.descricao } : {}),
        ...(match.valorUnitario !== null ? { valorUnitario: String(match.valorUnitario) } : {}),
        ...(match.ncm !== null ? { ncm: match.ncm } : {}),
      }));
      setCodigoRefFound(true);
    } finally {
      setCodigoRefLoading(false);
    }
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const formKey = FIELD_TO_FORM_KEY[f.key];
      const raw = values[formKey];
      if (["statusId", "clienteId", "faturamentoId", "tipoId", "faturadoId", "pagamentoId"].includes(formKey)) {
        if (raw) payload[formKey] = Number(raw);
      } else if (formKey === "qtd" || formKey === "valorUnitario") {
        payload[formKey] = Number(raw || 0);
      } else {
        payload[formKey] = raw || null;
      }
    }
    return payload;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === "addItem" ? "addItem" : "save";

    setError(null);
    setAddedMessage(null);
    setSaving(true);
    try {
      const url = mode === "create" ? "/api/pedidos" : `/api/pedidos/${pedido!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Não foi possível salvar o pedido.");
        return;
      }
      const created = await res.json();

      if (action === "addItem" && mode === "create") {
        onItemAdded?.();
        setValues((prev) => {
          const next: Record<string, string> = {};
          for (const fieldKey of CARRY_OVER_ON_ADD_ITEM) {
            const formKey = FIELD_TO_FORM_KEY[fieldKey];
            if (prev[formKey] !== undefined) next[formKey] = prev[formKey];
          }
          return next;
        });
        setCodigoRefFound(false);
        setAddedMessage(`Pedido #${created.id} salvo. Preencha o próximo item.`);
      } else {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "Novo pedido" : `Editar pedido #${pedido?.id}`} onClose={onClose} widthClassName="max-w-3xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.type === "text" && (f.key === "descricao" || f.key === "observacao") ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
            {f.key === "status" && (
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.status.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {f.key === "cliente" && (
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.clientes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            {f.key === "faturamento" && (
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.faturamento.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {f.key === "tipo" && (
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.tipo.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {f.key === "faturado" && (
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.faturado.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {f.key === "pagamento" && (
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)}>
                <option value="">Selecione...</option>
                {options.pagamento.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {(f.key === "data" || f.key === "dataFaturamento") && (
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => setValue(f.key, e.target.value)} />
            )}
            {(f.key === "qtd" || f.key === "valorUnitario") && (
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {(f.key === "descricao" || f.key === "observacao") && (
              <textarea
                rows={2}
                placeholder={f.key === "observacao" ? "Anotações gerais sobre o pedido..." : undefined}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {["pedidoCompra", "codigo", "ncm", "nf", "pdv"].includes(f.key) && (
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={getValue(f.key)}
                onChange={(e) => setValue(f.key, e.target.value)}
                onBlur={f.key === "codigo" ? handleCodigoBlur : undefined}
              />
            )}
            {f.key === "codigo" && mode === "create" && (codigoRefLoading || codigoRefFound) && (
              <p className="mt-1 text-xs text-slate-400">
                {codigoRefLoading ? "Buscando cadastro anterior..." : "Descrição, Valor Unitário e NCM preenchidos com o último cadastro deste Código — pode alterar."}
              </p>
            )}
          </div>
        ))}

        {visibleFields.has("valorTotal") && (visibleFields.has("qtd") || visibleFields.has("valorUnitario")) && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Valor Total (automático)</label>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{formatCurrency(qtd * valorUnitario)}</div>
          </div>
        )}

        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        {addedMessage && <p className="sm:col-span-2 text-sm text-emerald-600">{addedMessage}</p>}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          {mode === "create" && (
            <button
              type="submit"
              name="action"
              value="addItem"
              disabled={saving}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-60"
              title="Salva este pedido e abre um novo já com Cliente, Pedido de Compra e Data preenchidos"
            >
              Adicionar Item...
            </button>
          )}
          <button type="submit" name="action" value="save" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
