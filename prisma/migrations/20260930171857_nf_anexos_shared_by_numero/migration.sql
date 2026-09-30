-- Anexos de Nota Fiscal deixam de ser privados por Pedido (tabela NfAnexo) e passam a viver na
-- tabela Attachment já existente, com kind = 'nf', agrupados por Cliente + número da NF — assim
-- um anexo enviado num Pedido já aparece em qualquer outro Pedido faturado na mesma nota, sem
-- precisar reenviar o mesmo arquivo (ver nfGroupKey em lib/attachment-group.ts).
--
-- Copia as linhas já existentes (a funcionalidade tinha acabado de ir ao ar, mas já tem uso real)
-- pro novo formato antes de derrubar a tabela antiga. A expressão do `codigo` abaixo precisa bater
-- exatamente com nfGroupKey() no código da aplicação.
INSERT INTO "Attachment" (codigo, kind, "pedidoId", filename, "storedPath", "mimeType", size, "uploadedById", "uploadedAt", "enabledForQr")
SELECT
  CASE
    WHEN p.nf IS NOT NULL AND trim(p.nf) <> '' THEN 'nf::' || p."clienteId" || '::' || trim(p.nf)
    ELSE '__pedido_nf_' || p.id
  END,
  'nf',
  n."pedidoId",
  n.filename,
  n."storedPath",
  n."mimeType",
  n.size,
  n."uploadedById",
  n."uploadedAt",
  false
FROM "NfAnexo" n
JOIN "Pedido" p ON p.id = n."pedidoId";

DROP TABLE "NfAnexo";
