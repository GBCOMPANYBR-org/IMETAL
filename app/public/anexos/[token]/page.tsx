import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { attachmentGroupKey } from "@/lib/attachment-group";
import { formatFileSize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublicAnexosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { publicToken: token },
    select: { id: true, clienteId: true, codigo: true, descricao: true },
  });
  if (!pedido) notFound();

  const items = await prisma.attachment.findMany({
    where: { codigo: attachmentGroupKey(pedido), enabledForQr: true },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, size: true },
  });

  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <img src="/logo.png" alt="IMETAL" className="mb-4 h-10 w-auto" />
        <h1 className="text-lg font-semibold text-slate-800">Anexos do item</h1>
        {(pedido.codigo || pedido.descricao) && (
          <p className="mt-1 text-sm text-slate-500">
            {pedido.codigo && <span className="font-medium text-slate-700">{pedido.codigo}</span>}
            {pedido.codigo && pedido.descricao ? " — " : ""}
            {pedido.descricao}
          </p>
        )}

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">Nenhum arquivo disponível no momento.</p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <a
                  href={`/api/public/anexos/${token}/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-medium text-brand hover:underline"
                  title={a.filename}
                >
                  {a.filename}
                </a>
                <span className="shrink-0 text-xs text-slate-400">{formatFileSize(a.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
