import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccessCliente } from "@/lib/permissions";
import { parsePedidoId } from "@/lib/pedido-filters";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

type ClientPayload = {
  pedidoId: number;
  kind: "anexos" | "fotos";
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth();

  if ("error" in auth) {
    return auth.error;
  }

  const { user } = auth;

  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error("Dados do upload não informados.");
        }

        let payload: ClientPayload;

        try {
          payload = JSON.parse(clientPayload) as ClientPayload;
        } catch {
          throw new Error("Dados do upload inválidos.");
        }

        const pedidoId = parsePedidoId(String(payload.pedidoId));

        if (pedidoId === null) {
          throw new Error("Pedido inválido.");
        }

        if (payload.kind !== "anexos" && payload.kind !== "fotos") {
          throw new Error("Tipo de arquivo inválido.");
        }

        const requiredField =
          payload.kind === "fotos" ? "fotos" : "anexos";

        if (!user.visibleFields.has(requiredField)) {
          throw new Error("Sem permissão para enviar arquivos.");
        }

        const pedido = await prisma.pedido.findUnique({
          where: { id: pedidoId },
          include: { status: true },
        });

        if (!pedido || !canAccessCliente(user, pedido.clienteId)) {
          throw new Error("Pedido não encontrado.");
        }

        if (!user.isAdmin && !pedido.status.editable) {
          throw new Error(
            "Este pedido está com um status que não permite edição."
          );
        }

        const expectedPrefix = `pedidos/${pedidoId}/`;

        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Destino de upload inválido.");
        }

        return {
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            pedidoId,
            kind: payload.kind,
            userId: user.id,
          }),
        };
      },

      onUploadCompleted: async () => {
        // O registro no banco será feito pela API do pedido
        // após o navegador concluir o upload.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Erro no Client Upload:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível autorizar o upload.",
      },
      { status: 400 }
    );
  }
}
