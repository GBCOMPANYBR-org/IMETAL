"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export interface FuncaoOption {
  id: number;
  nome: string;
}

export interface FuncionarioRecord {
  id: number;
  matricula: string;
  nome: string;
  cpf: string;
  rg: string | null;
  dataNascimento: string | null;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  telefone: string | null;
  email: string | null;
  setor: string | null;
  funcaoPrincipalId: number | null;
  funcaoPrincipal: FuncaoOption | null;
  status: "ATIVO" | "INATIVO" | "AFASTADO";
  observacoes: string | null;
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export default function FuncionarioFormModal({
  funcionario,
  onClose,
  onSaved,
}: {
  funcionario: FuncionarioRecord | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = funcionario === "new";
  const base = isNew ? null : funcionario;

  const [matricula, setMatricula] = useState(base?.matricula ?? "");
  const [nome, setNome] = useState(base?.nome ?? "");
  const [cpf, setCpf] = useState(base?.cpf ?? "");
  const [rg, setRg] = useState(base?.rg ?? "");
  const [dataNascimento, setDataNascimento] = useState(toDateInput(base?.dataNascimento ?? null));
  const [dataAdmissao, setDataAdmissao] = useState(toDateInput(base?.dataAdmissao ?? null));
  const [telefone, setTelefone] = useState(base?.telefone ?? "");
  const [email, setEmail] = useState(base?.email ?? "");
  const [setor, setSetor] = useState(base?.setor ?? "");
  const [funcaoNome, setFuncaoNome] = useState(base?.funcaoPrincipal?.nome ?? "");
  const [status, setStatus] = useState<FuncionarioRecord["status"]>(base?.status ?? "ATIVO");
  const [observacoes, setObservacoes] = useState(base?.observacoes ?? "");

  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saude/funcoes")
      .then((res) => (res.ok ? res.json() : []))
      .then(setFuncoes)
      .catch(() => undefined);
  }, []);

  async function resolveFuncaoId(): Promise<number | null | undefined> {
    const trimmed = funcaoNome.trim();
    if (!trimmed) return null;

    const existing = funcoes.find((f) => f.nome.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    const res = await fetch("/api/saude/funcoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: trimmed }),
    });
    if (!res.ok) return undefined;
    const created = (await res.json()) as FuncaoOption;
    return created.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const funcaoPrincipalId = await resolveFuncaoId();
    if (funcaoPrincipalId === undefined) {
      setSaving(false);
      setError("Não foi possível salvar a função informada.");
      return;
    }

    const payload = {
      matricula,
      nome,
      cpf,
      rg: rg || null,
      dataNascimento: dataNascimento || null,
      dataAdmissao: dataAdmissao || null,
      telefone: telefone || null,
      email: email || null,
      setor: setor || null,
      funcaoPrincipalId,
      status,
      observacoes: observacoes || null,
    };

    const res = await fetch(isNew ? "/api/saude/funcionarios" : `/api/saude/funcionarios/${base!.id}`, {
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
    <Modal title={isNew ? "Novo funcionário" : `Editar ${base?.nome}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Matrícula" required>
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} required className={INPUT_CLS} />
          </Field>
          <Field label="CPF" required>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} required className={INPUT_CLS} />
          </Field>
        </div>

        <Field label="Nome completo" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required className={INPUT_CLS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="RG">
            <input value={rg ?? ""} onChange={(e) => setRg(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="Setor">
            <input value={setor ?? ""} onChange={(e) => setSetor(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de nascimento">
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="Data de admissão">
            <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input value={telefone ?? ""} onChange={(e) => setTelefone(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Função principal">
            <input
              value={funcaoNome}
              onChange={(e) => setFuncaoNome(e.target.value)}
              list="saude-funcoes"
              placeholder="ex.: Montador"
              className={INPUT_CLS}
            />
            <datalist id="saude-funcoes">
              {funcoes.map((f) => (
                <option key={f.id} value={f.nome} />
              ))}
            </datalist>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as FuncionarioRecord["status"])} className={INPUT_CLS}>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="AFASTADO">Afastado</option>
            </select>
          </Field>
        </div>

        <Field label="Observações">
          <textarea value={observacoes ?? ""} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={INPUT_CLS} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
          >
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
