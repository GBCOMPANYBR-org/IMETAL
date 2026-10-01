import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSauUser } from "@/lib/saude/permissions";
import { recalcularAlertas } from "@/lib/saude/alertas";

export default async function SaudeDashboardPage() {
  const user = await getCurrentSauUser();

  await recalcularAlertas();

  const hoje = new Date();
  const em30Dias = new Date();
  em30Dias.setDate(em30Dias.getDate() + 30);

  const [
    funcionariosAtivos,
    pcmsoAtivos,
    asoAguardandoRevisao,
    alertasAbertos,
    statusChecklist,
    examesVencendo,
    examesVencidos,
  ] = await Promise.all([
    prisma.sauFuncionario.count({ where: { status: "ATIVO" } }),
    prisma.sauPcmsoVersao.count({ where: { status: "ATIVO" } }),
    prisma.sauAso.count({ where: { status: "AGUARDANDO_REVISAO" } }),
    prisma.sauAlerta.count({ where: { status: "ABERTO" } }),
    prisma.sauChecklistLiberacao.groupBy({ by: ["statusGeral"], _count: true }),
    prisma.sauExame.count({ where: { dataValidade: { gte: hoje, lte: em30Dias } } }),
    prisma.sauExame.count({ where: { dataValidade: { lt: hoje } } }),
  ]);

  const porStatus = Object.fromEntries(statusChecklist.map((s) => [s.statusGeral, s._count]));

  const liberacaoCards = [
    { label: "Liberados", value: porStatus.LIBERADO ?? 0, emoji: "🟢" },
    { label: "Liberados com atenção", value: porStatus.LIBERADO_ATENCAO ?? 0, emoji: "🟡" },
    { label: "Não liberados", value: porStatus.NAO_LIBERADO ?? 0, emoji: "🔴" },
    { label: "Revisão necessária", value: porStatus.REVISAO_NECESSARIA ?? 0, emoji: "🔵" },
  ];

  const cards = [
    { label: "Funcionários ativos", value: funcionariosAtivos, href: "/saude/funcionarios" },
    { label: "PCMSOs ativos", value: pcmsoAtivos, href: "/saude/pcmso" },
    { label: "ASOs aguardando revisão", value: asoAguardandoRevisao, href: null },
    { label: "Alertas abertos", value: alertasAbertos, href: "/saude/alertas" },
    { label: "Exames vencendo (30 dias)", value: examesVencendo, href: "/saude/relatorios" },
    { label: "Exames vencidos", value: examesVencidos, href: "/saude/relatorios" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-800">Olá, {user?.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-slate-500">Visão geral do módulo.</p>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Situação documental</h2>
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {liberacaoCards.map((c) => (
          <Link
            key={c.label}
            href="/saude/relatorios"
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand/40 hover:shadow-sm"
          >
            <div className="text-2xl font-semibold tabular-nums text-slate-800">
              {c.emoji} {c.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Geral</h2>
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c) =>
          c.href ? (
            <Link key={c.label} href={c.href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand/40 hover:shadow-sm">
              <div className="text-2xl font-semibold tabular-nums text-slate-800">{c.value}</div>
              <div className="mt-1 text-xs text-slate-500">{c.label}</div>
            </Link>
          ) : (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold tabular-nums text-slate-800">{c.value}</div>
              <div className="mt-1 text-xs text-slate-500">{c.label}</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
