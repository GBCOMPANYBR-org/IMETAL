import LogsClient from "@/components/admin/LogsClient";

export default function LogsAdminPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-800">LOG's</h1>
      <p className="mb-4 text-sm text-slate-500">
        Acompanhe quantos acessos cada login está gerando — filtre por período, cliente ou usuário, compare vários
        de uma vez, e oculte os nomes quando for usar a tela como prova de uso pra um cliente.
      </p>
      <LogsClient />
    </div>
  );
}
