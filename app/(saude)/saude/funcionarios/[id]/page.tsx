import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import AlocacaoSection from "@/components/saude/AlocacaoSection";
import FichaTabs from "@/components/saude/FichaTabs";

const STATUS_LABEL: Record<string, string> = { ATIVO: "Ativo", INATIVO: "Inativo", AFASTADO: "Afastado" };

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

  const alocacaoAtiva = await prisma.sauAlocacao.findFirst({
    where: { funcionarioId: id, status: "ATIVA" },
    select: { unidadeId: true, funcaoId: true },
  });

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

      <FichaTabs
        funcionarioId={funcionario.id}
        alocacaoAtiva={alocacaoAtiva}
        canUploadAso={user.permissions.has("aso.upload")}
        canReviewAso={user.permissions.has("aso.review")}
        canEditExame={user.permissions.has("exam.edit")}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
      </FichaTabs>
    </div>
  );
}
