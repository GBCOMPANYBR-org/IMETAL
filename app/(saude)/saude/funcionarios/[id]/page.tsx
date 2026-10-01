import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import AlocacaoSection from "@/components/saude/AlocacaoSection";

const STATUS_LABEL: Record<string, string> = { ATIVO: "Ativo", INATIVO: "Inativo", AFASTADO: "Afastado" };

const TABS = ["Visão geral", "ASO", "Exames", "Documentos", "Histórico", "Liberação"];

function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—";
}

export default async function FuncionarioFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentSauUser();
  if (!user?.permissions.has("employee.view")) {
    return <p className="text-sm text-slate-500">Sem permissão para ver funcionários.</p>;
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const funcionario = await prisma.sauFuncionario.findUnique({
    where: { id },
    include: { funcaoPrincipal: true },
  });
  if (!funcionario) notFound();

  const rows: [string, string][] = [
    ["Matrícula", funcionario.matricula],
    ["CPF", funcionario.cpf],
    ["RG", funcionario.rg ?? "—"],
    ["Data de nascimento", formatDate(funcionario.dataNascimento)],
    ["Data de admissão", formatDate(funcionario.dataAdmissao)],
    ["Telefone", funcionario.telefone ?? "—"],
    ["E-mail", funcionario.email ?? "—"],
    ["Setor", funcionario.setor ?? "—"],
    ["Função principal", funcionario.funcaoPrincipal?.nome ?? "—"],
  ];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{funcionario.nome}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{STATUS_LABEL[funcionario.status]}</p>
        </div>
      </div>

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className={`px-3 py-2 text-sm font-medium ${
              i === 0 ? "border-b-2 border-brand text-brand" : "cursor-not-allowed text-slate-300"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <dl>
          {rows.map(([label, value], i) => (
            <div key={label} className={`flex px-4 py-2.5 text-sm ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <dt className="w-48 shrink-0 text-slate-500">{label}</dt>
              <dd className="text-slate-700">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {funcionario.observacoes && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{funcionario.observacoes}</p>
      )}

      <AlocacaoSection funcionarioId={funcionario.id} canEdit={user.permissions.has("employee.edit")} />

      <p className="mt-6 text-xs text-slate-400">ASO, exames e situação de liberação chegam nas próximas etapas.</p>
    </div>
  );
}
