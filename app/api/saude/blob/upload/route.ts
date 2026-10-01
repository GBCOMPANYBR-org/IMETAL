import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireSaudeAccess } from "@/lib/saude/permissions";

// Same direct-to-browser-to-Blob pattern as app/api/blob/upload/route.ts (Pedidos) — avoids the
// serverless function body-size limit for a PCMSO/ASO PDF. Kept as its own route (not shared
// with the Pedidos one) so the permission check and the "saude/" path prefix stay specific to
// this module, and so neither upload path can be reused to write into the other's storage area.

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

type ClientPayload = {
  kind: "pcmso" | "aso";
  unidadeId?: number;
  funcionarioId?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
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

        const requiredKey = payload.kind === "pcmso" ? "pcmso.upload" : "aso.upload";
        const auth = await requireSaudeAccess(requiredKey);
        if ("error" in auth) {
          throw new Error("Sem permissão para enviar este documento.");
        }

        if (payload.kind === "pcmso") {
          if (!payload.unidadeId) throw new Error("Unidade não informada.");
          if (!pathname.startsWith(`saude/pcmso/${payload.unidadeId}/`)) {
            throw new Error("Destino de upload inválido.");
          }
        } else {
          if (!payload.funcionarioId) throw new Error("Funcionário não informado.");
          if (!pathname.startsWith(`saude/aso/${payload.funcionarioId}/`)) {
            throw new Error("Destino de upload inválido.");
          }
        }

        return {
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: auth.user.id, kind: payload.kind }),
        };
      },

      onUploadCompleted: async () => {
        // O registro no banco é feito por uma chamada separada depois do upload concluir
        // (ver POST /api/saude/pcmso), mesmo padrão do upload de anexos de Pedido.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Erro no upload de documento Saúde Ocupacional:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível autorizar o upload." },
      { status: 400 }
    );
  }
}
