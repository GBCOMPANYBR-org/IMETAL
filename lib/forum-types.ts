// Shared shapes returned by the Fórum/observações API routes — kept in one place since
// components/pedidos/ObservacaoModal.tsx and components/forum/* both render the same thread.

export interface ObservacaoAuthor {
  id: number;
  name: string;
  username: string;
}

export interface ObservacaoMentionDTO {
  id: number;
  mentionedUser: ObservacaoAuthor;
  viewedAt: string | null;
  resolvedAt: string | null;
  resolutionType: "CONCLUIDA" | "CIENTE" | null;
}

export interface ObservacaoDTO {
  id: number;
  text: string;
  createdAt: string;
  migratedFromLegacy: boolean;
  author: ObservacaoAuthor | null;
  mentions: ObservacaoMentionDTO[];
}

export interface PendenciaListItemDTO {
  id: number;
  createdAt: string;
  viewedAt: string | null;
  resolvedAt: string | null;
  resolutionType: "CONCLUIDA" | "CIENTE" | null;
  pedido: { id: number; codigo: string | null; descricao: string | null; cliente: { id: number; name: string } };
  author: ObservacaoAuthor | null;
  preview: string;
  observacaoId: number;
}
