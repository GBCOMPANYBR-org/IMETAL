"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldDef } from "@/lib/fields";
import type { FilterValue } from "@/lib/pedido-query-client";
import { isFilterActive } from "@/lib/pedido-query-client";

interface FkOption {
  id: number;
  label: string;
}

interface Props {
  field: FieldDef;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
  fkOptions?: FkOption[];
}

export default function ColumnFilter({ field, value, onChange, fkOptions }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isFilterActive(value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const isFk = ["status", "cliente", "faturamento", "tipo", "faturado", "pagamento"].includes(field.type);
  const isNumber = field.type === "number" || field.type === "currency";
  const isDate = field.type === "date";
  const isAttachments = field.type === "attachments";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`ml-1 rounded p-0.5 text-xs transition ${active ? "text-brand" : "text-slate-300 hover:text-slate-500"}`}
        title="Filtrar"
      >
        ▾
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {isFk && (
            <FkFilter
              options={fkOptions ?? []}
              value={value?.type === "fk" ? value.ids : []}
              onApply={(ids) => {
                onChange(ids.length > 0 ? { type: "fk", ids } : undefined);
                setOpen(false);
              }}
            />
          )}
          {!isFk && isNumber && (
            <NumberFilter
              min={value?.type === "number" ? value.min : undefined}
              max={value?.type === "number" ? value.max : undefined}
              onApply={(min, max) => {
                onChange(min !== undefined || max !== undefined ? { type: "number", min, max } : undefined);
                setOpen(false);
              }}
            />
          )}
          {!isFk && isDate && (
            <DateFilter
              from={value?.type === "date" ? value.from : undefined}
              to={value?.type === "date" ? value.to : undefined}
              onApply={(from, to) => {
                onChange(from || to ? { type: "date", from, to } : undefined);
                setOpen(false);
              }}
            />
          )}
          {isAttachments && (
            <AttachmentsFilter
              label={field.label}
              value={value?.type === "boolean" ? value.value : undefined}
              onApply={(v) => {
                onChange(v === undefined ? undefined : { type: "boolean", value: v });
                setOpen(false);
              }}
            />
          )}
          {!isFk && !isNumber && !isDate && !isAttachments && (
            <TextFilter
              value={value?.type === "text" ? value.value : ""}
              onApply={(v) => {
                onChange(v.trim() ? { type: "text", value: v } : undefined);
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TextFilter({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-2">
      <input
        autoFocus
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Contém..."
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onApply(v)}
      />
      <FilterActions onApply={() => onApply(v)} onClear={() => onApply("")} />
    </div>
  );
}

function NumberFilter({
  min,
  max,
  onApply,
}: {
  min?: number;
  max?: number;
  onApply: (min?: number, max?: number) => void;
}) {
  const [mn, setMn] = useState(min?.toString() ?? "");
  const [mx, setMx] = useState(max?.toString() ?? "");
  const apply = () => onApply(mn === "" ? undefined : Number(mn), mx === "" ? undefined : Number(mx));
  return (
    <div className="space-y-2">
      <input
        type="number"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Mínimo"
        value={mn}
        onChange={(e) => setMn(e.target.value)}
      />
      <input
        type="number"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Máximo"
        value={mx}
        onChange={(e) => setMx(e.target.value)}
      />
      <FilterActions
        onApply={apply}
        onClear={() => {
          setMn("");
          setMx("");
          onApply(undefined, undefined);
        }}
      />
    </div>
  );
}

function DateFilter({ from, to, onApply }: { from?: string; to?: string; onApply: (from?: string, to?: string) => void }) {
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  return (
    <div className="space-y-2">
      <input type="date" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={f} onChange={(e) => setF(e.target.value)} />
      <input type="date" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={t} onChange={(e) => setT(e.target.value)} />
      <FilterActions
        onApply={() => onApply(f || undefined, t || undefined)}
        onClear={() => {
          setF("");
          setT("");
          onApply(undefined, undefined);
        }}
      />
    </div>
  );
}

function FkFilter({ options, value, onApply }: { options: FkOption[]; value: number[]; onApply: (ids: number[]) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(value));
  return (
    <div className="space-y-2">
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {options.length === 0 && <p className="text-xs text-slate-400">Nenhuma opção cadastrada.</p>}
        {options.map((opt) => (
          <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.has(opt.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(opt.id);
                else next.delete(opt.id);
                setSelected(next);
              }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <FilterActions
        onApply={() => onApply(Array.from(selected))}
        onClear={() => {
          setSelected(new Set());
          onApply([]);
        }}
      />
    </div>
  );
}

function AttachmentsFilter({
  label,
  value,
  onApply,
}: {
  label: string;
  value: boolean | undefined;
  onApply: (v: boolean | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="radio" name={`${label}-filter`} checked={value === true} onChange={() => onApply(true)} />
        Com {label}
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="radio" name={`${label}-filter`} checked={value === false} onChange={() => onApply(false)} />
        Sem {label}
      </label>
      <div className="pt-1">
        <button onClick={() => onApply(undefined)} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          Limpar
        </button>
      </div>
    </div>
  );
}

function FilterActions({ onApply, onClear }: { onApply: () => void; onClear: () => void }) {
  return (
    <div className="flex justify-between gap-2 pt-1">
      <button onClick={onClear} className="text-xs font-medium text-slate-400 hover:text-slate-600">
        Limpar
      </button>
      <button onClick={onApply} className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-light">
        Aplicar
      </button>
    </div>
  );
}
