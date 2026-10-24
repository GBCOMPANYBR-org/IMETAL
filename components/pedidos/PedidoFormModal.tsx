"use client";

import { useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
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
  previsao: "previsao",
  dataFaturamento: "dataFaturamento",
  nf: "nf",
  pdv: "pdv",
};

export interface PedidoRecord {
  id: number;
  statusEditable?: boolean;
  publicToken?: string | null;
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
  previsao?: string | null;
  dataFaturamento?: string | null;
  nf?: string | null;
  pdv?: string | null;
  fotoCapa?: { id: number; filename: string; mimeType: string } | null;
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
        // Observações is never edited here, not even by admin — it's an append-only Fórum
        // thread now (lib/mentions.ts), managed exclusively through the "+ observação" button /
        // ObservacaoModal, which is also where @-mentions are created.
        .filter((f) => f.key !== "observacao"),
    [visibleFields, mode]
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
      case "previsao":
        initial.previsao = toDateInputValue(pedido.previsao ?? null);
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
  // Só em criação — na edição, Observações é gerenciado à parte pelo "+ observação" / Fórum
  // (ver comentário no filtro de `fields` acima). Sem @ marcação aqui ainda (não existe pedidoId
  // pra buscar quem pode ser marcado); dá pra marcar alguém depois, editando já com o pedido criado.
  const [observacaoText, setObservacaoText] = useState("");
  const [codigoRefLoading, setCodigoRefLoading] = useState(false);
  const [codigoRefFound, setCodigoRefFound] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportPdf(file: File | null) {
    setImportFile(null);
    setImportWarnings([]);
    setImportConfirmed(false);
    setImportError(null);
    if (!file) return;
    setImportLoading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch("/api/pedidos/importar-pdf", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) { setImportError(result.error ?? "Não foi possível ler o pedido."); return; }
      const draft = result.draft as Record<string, string | number | null>;
      setValues(prev => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(draft)) {
          if (value !== null && value !== undefined && key !== "previsao") next[key] = String(value);
        }
        // Previsão nunca é importada, nem do histórico do produto.
        if (visibleFields.has("previsao")) next.previsao = "";
        return next;
      });
      setImportWarnings(result.warnings ?? []);
      setImportFile(file);
      setCodigoRefFound(false);
    } catch { setImportError("Não foi possível enviar o PDF para leitura."); }
    finally { setImportLoading(false); }
  }

  // Foto de capa — só um arquivo, disponível em criação e edição (diferente de Observações, que
  // só existe na criação). `capaFile` é o novo arquivo escolhido (ainda não enviado); `removeCapa`
  // marca que a foto já existente (modo edição) deve ser removida caso nenhum novo arquivo seja
  // escolhido no lugar dela.
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [removeCapa, setRemoveCapa] = useState(false);
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string | null>(null);

  // Pop-up pedido pelo Felipe: toda vez que o status for alterado para "Em andamento", pedir a
  // data de Previsão na hora — "alterado" é o que importa (não dispara se o pedido já abriu nesse
  // status, nem ao selecionar de novo o mesmo valor). Só faz sentido se "previsao" estiver visível
  // pra este usuário; senão o campo nem aparece no formulário pra receber o valor.
  const [previsaoPromptValue, setPrevisaoPromptValue] = useState("");
  const [showPrevisaoPrompt, setShowPrevisaoPrompt] = useState(false);

  function handleStatusChange(newStatusId: string) {
    const previous = getValue("status");
    setValue("status", newStatusId);
    if (!visibleFields.has("previsao") || newStatusId === previous) return;
    const label = options.status.find((o) => String(o.id) === newStatusId)?.label;
    if (label?.trim().toLowerCase() === "em andamento") {
      setPrevisaoPromptValue(getValue("previsao"));
      setShowPrevisaoPrompt(true);
    }
  }

  function confirmPrevisaoPrompt() {
    setValue("previsao", previsaoPromptValue);
    setShowPrevisaoPrompt(false);
  }

  function handleCapaFileChange(file: File | null) {
    setCapaFile(file);
    setRemoveCapa(false);
    setCapaPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

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

  /** Create mode only: offers the last registered Descrição/Valor Unitário/NCM/Pagamento/Faturamento/Tipo for this Cliente +
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
      const match = body.match as { descricao: string | null; valorUnitario: number | null; ncm: string | null; pagamentoId: number | null; faturamentoId: number | null; tipoId: number | null } | null;
      if (!match) return;
      setValues((prev) => ({
        ...prev,
        ...(match.descricao !== null ? { descricao: match.descricao } : {}),
        ...(match.valorUnitario !== null ? { valorUnitario: String(match.valorUnitario) } : {}),
        ...(match.ncm !== null ? { ncm: match.ncm } : {}),
        ...(match.pagamentoId !== null && options.pagamento.some((option) => option.id === match.pagamentoId) ? { pagamentoId: String(match.pagamentoId) } : {}),
        ...(match.faturamentoId !== null && options.faturamento.some((option) => option.id === match.faturamentoId) ? { faturamentoId: String(match.faturamentoId) } : {}),
        ...(match.tipoId !== null && options.tipo.some((option) => option.id === match.tipoId) ? { tipoId: String(match.tipoId) } : {}),
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
    if (importWarnings.some(w => /já cadastrado/i.test(w)) && !importConfirmed) {
      setError("Confirme que deseja continuar mesmo com um número de pedido de compra já cadastrado.");
      return;
    }

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

      // Anexa o pedido original só DEPOIS da confirmação e da criação do registro.
      if (mode === "create" && importFile) {
        try {
          const blob = await upload(`pedidos/${created.id}/${importFile.name}`, importFile, {
            access: "public", handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({pedidoId: created.id, kind: "anexos"}),
          });
          const attachment = await fetch(`/api/pedidos/${created.id}/attachments`, {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({blobUrl:blob.url,filename:importFile.name,mimeType:"application/pdf",size:importFile.size}),
          });
          if (!attachment.ok) throw new Error("Registro de anexo falhou");
        } catch(e) {
          console.error("Importação: falha ao anexar PDF original",e);
          setError(`Pedido #${created.id} criado, mas não foi possível anexar o PDF original.`);
        }
      }
      if (mode === "create" && observacaoText.trim()) {
        const obsRes = await fetch(`/api/pedidos/${created.id}/observacoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: observacaoText.trim() }),
        });
        if (!obsRes.ok) {
          setError(`Pedido #${created.id} salvo, mas não foi possível salvar a observação.`);
        }
      }

      if (capaFile) {
        try {
          const blob = await upload(`pedidos/${created.id}/${capaFile.name}`, capaFile, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({ pedidoId: created.id, kind: "fotoCapa" }),
          });
          const capaRes = await fetch(`/api/pedidos/${created.id}/foto-capa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blobUrl: blob.url,
              filename: capaFile.name,
              mimeType: capaFile.type || "application/octet-stream",
              size: capaFile.size,
            }),
          });
          if (!capaRes.ok) {
            setError(`Pedido #${created.id} salvo, mas não foi possível salvar a foto de capa.`);
          }
        } catch (err) {
          console.error("Erro ao enviar foto de capa:", err);
          setError(`Pedido #${created.id} salvo, mas não foi possível enviar a foto de capa.`);
        }
      } else if (removeCapa && mode === "edit") {
        await fetch(`/api/pedidos/${created.id}/foto-capa`, { method: "DELETE" }).catch(() => undefined);
      }

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
        setImportFile(null);
        setImportWarnings([]);
        setImportConfirmed(false);
        setObservacaoText("");
        handleCapaFileChange(null);
        setAddedMessage(`Pedido #${created.id} salvo. Preencha o próximo item.`);
      } else {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Modal title={mode === "create" ? "Novo pedido" : `Editar pedido #${pedido?.id}`} onClose={onClose} widthClassName="max-w-3xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === "create" && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-800" htmlFor="pedido-import-pdf">Importar pedido de compra (PDF)</label>
            <p className="mb-2 text-xs text-slate-600">Leitura automática gratuita de pedidos da Veolia. Confira os dados antes de salvar. A previsão permanece vazia.</p>
            <input id="pedido-import-pdf" type="file" accept=".pdf,application/pdf" disabled={importLoading || saving}
              onChange={e => void handleImportPdf(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700" />
            {importLoading && <p className="mt-2 text-sm text-slate-600">Lendo o pedido PDF...</p>}
            {importError && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{importError}</p>}
            {importFile && <p className="mt-2 text-xs font-semibold text-emerald-700">PDF lido: {importFile.name}. Dados inseridos abaixo para conferência. O arquivo será anexado após salvar.</p>}
            {importWarnings.map((warning, index) => <p key={index} className="mt-1 text-xs font-medium text-amber-800">{warning}</p>)}
            {importWarnings.some(w => /já cadastrado/i.test(w)) && <label className="mt-2 flex items-start gap-2 text-sm text-red-800">
              <input type="checkbox" checked={importConfirmed} onChange={e=>setImportConfirmed(e.target.checked)} />
              Confirmo que revisei a possível duplicidade e desejo cadastrar mesmo assim.
            </label>}
          </div>
        )}
        {fields.map((f) => (
          <div key={f.key} className={f.type === "text" && f.key === "descricao" ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
            {f.key === "status" && (
              <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={getValue(f.key)} onChange={(e) => handleStatusChange(e.target.value)}>
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
            {(f.key === "data" || f.key === "dataFaturamento" || f.key === "previsao") && (
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
            {f.key === "descricao" && (
              <textarea
                rows={2}
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
                {codigoRefLoading ? "Buscando cadastro anterior..." : "Descrição, Valor Unitário, NCM, Pagamento, Faturamento e Tipo preenchidos com o último cadastro deste Código — pode alterar."}
              </p>
            )}
          </div>
        ))}

        {mode === "create" && visibleFields.has("observacao") && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-600">Observações (opcional)</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={observacaoText}
              onChange={(e) => setObservacaoText(e.target.value)}
              placeholder="Primeira observação do pedido — sem @ marcação aqui; marque alguém depois pelo botão &quot;+ observação&quot;"
            />
          </div>
        )}

        {visibleFields.has("fotoCapa") && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-600">Foto de Capa (opcional)</label>
            <div className="flex items-center gap-3">
              {(capaPreviewUrl || (!removeCapa && pedido?.fotoCapa)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capaPreviewUrl ?? `/api/pedidos/${pedido!.id}/foto-capa`}
                  alt="Foto de capa"
                  className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCapaFileChange(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
                {(capaFile || (!removeCapa && pedido?.fotoCapa)) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCapaFileChange(null);
                      setRemoveCapa(true);
                    }}
                    className="mt-1 text-xs text-red-600 hover:underline"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">Aparece em miniatura ao passar o mouse sobre a Descrição na lista de Pedidos.</p>
          </div>
        )}

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

    {showPrevisaoPrompt && (
      <Modal title="Previsão de entrega" onClose={() => setShowPrevisaoPrompt(false)} widthClassName="max-w-sm">
        <p className="mb-3 text-sm text-slate-600">
          Este pedido foi marcado como <span className="font-medium">Em andamento</span>. Qual a previsão de entrega ao cliente?
        </p>
        <input
          type="date"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={previsaoPromptValue}
          onChange={(e) => setPrevisaoPromptValue(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPrevisaoPrompt(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={confirmPrevisaoPrompt}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
          >
            Salvar
          </button>
        </div>
      </Modal>
    )}
    </>
  );
}
