# QA manual — Fórum (@-menções e pendências)

Checklist a rodar localmente (nunca contra produção) sempre que este módulo for alterado. Requer
um banco de testes com pelo menos dois Clientes e cinco usuários configurados conforme abaixo.

## Dados de teste

Clientes: **VEOLIA** e **ECOLAB**, cada um com pelo menos um Pedido.

| Usuário            | role  | allClientes | UserCliente          | visibleFields inclui "observacao" |
| ------------------ | ----- | ----------- | --------------------- | ---------------------------------- |
| `admin`             | ADMIN | —           | —                      | sim (implícito)                    |
| `imetal_geral`       | USER  | true        | —                      | sim                                 |
| `imetal_restrito`    | USER  | false       | ECOLAB                | sim                                 |
| `cliente_veolia`     | USER  | false       | VEOLIA                | sim                                 |
| `cliente_ecolab`     | USER  | false       | ECOLAB                | sim                                 |

## Cenários

1. **Isolamento por empresa (candidatos ao @).** Logado como `cliente_veolia`, abrir "+ observação"
   num Pedido da ECOLAB e digitar `@`. Esperado: `cliente_veolia` não aparece na lista de
   sugestões de nenhum Pedido ECOLAB (nem ele mesmo nem ninguém que só tenha VEOLIA).

2. **Acesso a múltiplas empresas.** Logado como `imetal_geral`, digitar `@` num Pedido VEOLIA e
   depois num Pedido ECOLAB. Esperado: aparece nos dois.

3. **Requisição manipulada.** Com uma ferramenta de HTTP (curl/devtools), enviar
   `POST /api/pedidos/<id-de-um-pedido-ECOLAB>/observacoes` com
   `{"text": "@[Teste](<id-do-cliente_veolia>)"}`. Esperado: `400`, nenhuma `Observacao` nem
   `ObservacaoMention` criada.

4. **Duas menções independentes.** Num comentário, marcar dois usuários elegíveis. Esperado: duas
   linhas em `ObservacaoMention` (uma por usuário), cada uma aparecendo só na lista de pendências
   da pessoa certa (`GET /api/forum/pendencias`). Marcar a mesma pessoa duas vezes no mesmo
   comentário deve gerar só uma pendência (`@@unique([observacaoId, mentionedUserId])`).

5. **Ciclo de vida de uma pendência.** Como a pessoa marcada: abrir o item no Fórum (a bolinha do
   menu, antes verde, deve virar amarela — `POST .../view` marcou `viewedAt`); responder pela tela
   do Fórum (a resposta aparece também no modal de Observações do Pedido); clicar em "Concluir
   pendência" (some da aba "Abertas", aparece em "Concluídas"). Marcar a mesma pessoa de novo no
   mesmo Pedido deve criar uma pendência nova e independente — a antiga continua concluída.

6. **Prioridade verde > amarelo.** Com uma pendência já vista (amarela) e uma pendência nova
   chegando para o mesmo usuário, a bolinha do menu deve virar verde.

7. **Isolamento de leitura.** Como `cliente_veolia`, chamar
   `GET /api/pedidos/<id-de-um-pedido-ECOLAB>/observacoes` diretamente. Esperado: `404` (nunca
   `403`, para não confirmar a existência do id).

8. **Exclusão de usuário com pendências.** Tentar `DELETE /api/usuarios/<id>` de alguém com
   pendências vinculadas (resolvidas ou não). Esperado: recusado com mensagem clara; `active:
   false` continua funcionando para desativar.

9. **Campo Observações fora do Fórum.** Abrir o formulário de edição de um Pedido (`PedidoFormModal`)
   como admin e como usuário comum — o campo "Observações" não deve mais aparecer em nenhum dos
   dois casos; a única forma de adicionar observação é pelo botão "+ observação" ou pelo Fórum.

## Comandos

```
npx prisma migrate deploy         # aplica prisma/migrations/20260924120000_add_forum
npx tsx scripts/migrate-observacoes.ts   # backfill do texto legado, uma vez
npx vitest run                    # testes unitários de lib/mentions.ts e lib/forum-access.ts
npm run dev
```
