import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/lib/permissions";
import { getCurrentSauUser } from "@/lib/saude/permissions";

/**
 * Hub pós-login, a pedido do Elton: deixa o usuário escolher entre os sistemas que ele tem
 * acesso, em vez de sempre cair direto em Pedidos. Só mostra a escolha quando há mais de uma
 * opção disponível — quem só acessa Pedidos (a maioria hoje) nunca vê esta tela, é redirecionado
 * direto (ver app/login/page.tsx, que manda pra aqui por padrão).
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/trocar-senha");

  const canAccessSaude = user.isAdmin || (await getCurrentSauUser()) !== null;

  const modulos = [
    { href: "/", titulo: "Gestão de Pedidos", descricao: "Pedidos, clientes, gráficos e relatórios.", icone: "📦" },
    ...(canAccessSaude
      ? [{ href: "/saude", titulo: "Saúde Ocupacional", descricao: "PCMSO, ASO, exames e liberação de funcionários.", icone: "🩺" }]
      : []),
  ];

  if (modulos.length <= 1) {
    redirect(modulos[0].href);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/logo.png" alt="IMETAL" width={220} height={76} priority className="h-auto w-48" />
        </div>
        <p className="mb-4 text-center text-sm text-slate-500">
          Olá, <span className="font-medium text-slate-700">{user.name}</span>. Para onde você quer ir?
        </p>
        <div className="space-y-3">
          {modulos.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow"
            >
              <span className="text-3xl">{m.icone}</span>
              <span>
                <span className="block text-base font-semibold text-slate-700">{m.titulo}</span>
                <span className="block text-sm text-slate-500">{m.descricao}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
