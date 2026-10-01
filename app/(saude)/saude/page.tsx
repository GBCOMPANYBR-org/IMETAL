import { prisma } from "@/lib/prisma";
import { getCurrentSauUser } from "@/lib/saude/permissions";

export default async function SaudeDashboardPage() {
  const user = await getCurrentSauUser();

  const [funcionariosAtivos, pcmsoAtivos, asoAguardandoRevisao, alertasAbertos] = await Promise.all([
    prisma.sauFuncionario.count({ where: { status: "ATIVO" } }),
    prisma.sauPcmsoVersao.count({ where: { status: "ATIVO" } }),
    prisma.sauAso.count({ where: { status: "AGUARDANDO_REVISAO" } }),
    prisma.sauAlerta.count({ where: { status: "ABERTO" } }),
  ]);

  const cards = [
    { label: "Funcionários ativos", value: funcionariosAtivos },
    { label: "PCMSOs ativos", value: pcmsoAtivos },
    { label: "ASOs aguardando revisão", value: asoAguardandoRevisao },
    { label: "Alertas abertos", value: alertasAbertos },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800">Olá, {user?.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Módulo em construção — esta é a base (acesso e cadastros). Cadastros, leitura por IA e a
        tela de liberação chegam nas próximas etapas.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold tabular-nums text-slate-800">{c.value}</div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
