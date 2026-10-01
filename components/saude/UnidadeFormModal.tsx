"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export interface UnidadeRecord {
  id: number;
  clienteId: number;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  status: "ATIVO" | "INATIVO";
  observacoes: string | null;
}

export default function UnidadeFormModal({
  clienteId,
  unidade,
  onClose,
  onSaved,
}: {
  clienteId: number;
  unidade: UnidadeRecord | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = unidade === "new";
  const base = isNew ? null : unidade;

  const [nome, setNome] = useState(base?.nome ?? "");
  const [cnpj, setCnpj] = useState(base?.cnpj ?? "");
  const [endereco, setEndereco] = useState(base?.endereco ?? "");
  const [cidade, setCidade] = useState(base?.cidade ?? "");
  const [estado, setEstado] = useState(base?.estado ?? "");
  const [contato, setContato] = useState(base?.contato ?? "");
  const [telefone, setTelefone] = useState(base?.telefone ?? "");
  const [email, setEmail] = useState(base?.email ?? "");
  const [status, setStatus] = useState<UnidadeRecord["status"]>(base?.status ?? "ATIVO");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      clienteId,
      nome,
      cnpj: cnpj || null,
      endereco: endereco || null,
      cidade: cidade || null,
      estado: estado || null,
      contato: contato || null,
      telefone: telefone || null,
      email: email || null,
      status,
    };

    const res = await fetch(isNew ? "/api/saude/unidades" : `/api/saude/unidades/${base!.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível salvar.");
      return;
    }
    onSaved();
  }

  return (
    <Modal title={isNew ? "Nova unidade" : `Editar ${base?.nome}`} onClose={onClose} widthClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <Field label="Nome" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required className={INPUT_CLS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="CNPJ">
            <input value={cnpj ?? ""} onChange={(e) => setCnpj(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as UnidadeRecord["status"])} className={INPUT_CLS}>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </Field>
        </div>

        <Field label="Endereço">
          <input value={endereco ?? ""} onChange={(e) => setEndereco(e.target.value)} className={INPUT_CLS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade">
            <input value={cidade ?? ""} onChange={(e) => setCidade(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="Estado">
            <input value={estado ?? ""} onChange={(e) => setEstado(e.target.value)} maxLength={2} className={INPUT_CLS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contato">
            <input value={contato ?? ""} onChange={(e) => setContato(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="Telefone">
            <input value={telefone ?? ""} onChange={(e) => setTelefone(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        <Field label="E-mail">
          <input type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
        </Field>

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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
