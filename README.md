# IMETAL — Gestão de Pedidos

Sistema web para gestão de pedidos e clientes, com banco de dados, permissões por usuário, status configuráveis com trava de edição, filtros por coluna, paginação inteligente, gráficos e anexos.

**Em produção:** https://imetal.vercel.app (projeto `imetal`, time Vercel "Salvatore Seguros' projects").

## Stack

- **Next.js 16 (App Router) + TypeScript** — front-end e API no mesmo app.
- **Prisma + Postgres** (Neon, via integração nativa da Vercel) — `DATABASE_URL` pooled para as queries da aplicação, `DATABASE_URL_UNPOOLED` para migrações.
- **Anexos em Vercel Blob** em produção (`BLOB_READ_WRITE_TOKEN`); sem esse token, `lib/storage.ts` cai automaticamente para disco local em `storage/attachments/` — assim `npm run dev` funciona sem depender da nuvem. Em ambos os modos, o arquivo só é entregue através de uma rota autenticada que confere permissão a cada acesso — o cliente nunca recebe a URL pública do Blob diretamente.
- **Autenticação própria** (sessão em cookie httpOnly assinada com JWT) — sem serviços externos.
- **Tailwind CSS** + **Recharts** para gráficos.

## Deploy (Vercel)

O projeto está linkado localmente via `vercel link` (arquivo `.vercel/` — não versionado). Para subir uma nova versão manualmente:

```bash
git push                     # opcional, mantém o histórico no GitHub em dia
npx vercel deploy --prod     # builda remotamente e publica em produção
```

Hoje o deploy é manual porque o **GitHub App da Vercel não está instalado** no repositório `GBCOMPANYBR/IMETAL` — sem isso não dá pra conectar o projeto ao Git pra deploy automático a cada push. Pra ativar: `vercel.com/salvatore-seguros-projects/imetal/settings/git` → conectar repositório (isso instala o app no GitHub, pede autorização da organização).

Se o schema do Prisma mudar, rode a migração contra o banco de produção antes do deploy:
```bash
npx prisma migrate deploy
```

## Primeiro uso (ambiente local)

```bash
npm install
npx prisma migrate deploy   # aplica as migrações no Postgres apontado por DATABASE_URL
npm run db:seed             # importa Dados.xlsx e cria os usuários iniciais
npm run dev                 # http://localhost:3000
```

Copie `.env.example` para `.env` e preencha `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (pegue em Vercel → projeto → Storage → banco Postgres → aba ".env.local") e, se quiser testar upload de anexos como em produção, `BLOB_READ_WRITE_TOKEN` também.

O seed procura, na raiz do projeto: primeiro o arquivo apontado por `SEED_SOURCE_FILE` (se essa variável estiver definida), depois `Dados.xlsx`, depois `Pasta1.xlsx` (protótipo). Nenhum `.xlsx` é versionado no git (dados reais de clientes/valores) — copie o arquivo manualmente antes de rodar `db:seed` num ambiente novo.

Durante o desenvolvimento, use `npm run dev` em vez de `build`/`start`.

### Usuários

Criados fora do seed, direto em `/admin/usuarios` — o seed só garante que existe um ADMIN (`admin`, senha inicial `imetal123`, **troque assim que possível**). Não recria nem reseta os demais usuários.

### Trocando a base de pedidos por uma planilha atualizada

Quando o Felipe manda uma planilha nova (ex.: `Dados-26-08-2026.xlsx`) pra substituir os pedidos:

```bash
# 1. Apaga os pedidos atuais (NÃO mexe em usuários, status, clientes, etc.)
npx tsx -e "import { prisma } from './lib/prisma'; prisma.pedido.deleteMany({}).then(r => console.log(r.count, 'apagados')).finally(() => prisma.\$disconnect())"

# 2. Reimporta da planilha nova
SEED_SOURCE_FILE="Dados-26-08-2026.xlsx" npm run db:seed
```

**Só faça isso se ninguém tiver cadastrado/editado pedidos direto pelo sistema desde a última importação** — como é um "apaga tudo e reimporta", qualquer pedido criado ou editado só no site (não na planilha) seria perdido. Se houver dúvida, confirme antes.

O seed detecta automaticamente Status/Cliente/Faturamento/Tipo novos na planilha (cria via upsert, sem duplicar os que já existem) e avisa no terminal sobre linhas sem Status ou com Tipo inválido, indicando o ID original de cada uma pra conferência manual. A coluna "Anexos" da planilha é só uma contagem em texto — não existem arquivos de verdade nela, então os pedidos reimportados sempre nascem sem anexos (os que já tinham anexo real, anexado pela tela, perdem esse anexo se o pedido for reimportado — o arquivo em si continua no Blob, só o vínculo com o pedido se perde).

## Fórum (@-menções e pendências)

Ao digitar `@` no campo de Observações de um Pedido, é possível marcar um ou mais usuários — cada
marcação cria uma pendência individual, visível na aba **Fórum** do menu, com indicador (verde =
nova, amarelo = vista mas aberta) que atualiza por polling (sem WebSocket/SSE nesse projeto). Só
aparecem — e só podem ser marcadas — pessoas com acesso à empresa (Cliente) daquele Pedido, a
mesma regra já usada para restringir a visão de Pedidos por Cliente (veja "Estrutura das
permissões" abaixo); o servidor sempre revalida isso ao publicar, não confia no filtro da tela.

Depois de aplicar a migração `add_forum` (`npx prisma migrate deploy`), rode uma vez o backfill do
texto antigo de Observações (campo livre, sem estrutura, existente antes desse módulo):

```bash
npx tsx scripts/migrate-observacoes.ts
```

É idempotente — pode rodar de novo sem duplicar nada. Detalhes de arquitetura e o checklist de QA
manual (cenários de isolamento por empresa, requisição manipulada, etc.) estão em
`docs/QA-forum.md`.

## Alternativa: servidor próprio (sem Vercel)

O app não depende da Vercel — se um dia quiserem sair dela, `npm run build && npm start` roda em qualquer servidor Node. `DATABASE_URL` pode continuar apontando pro mesmo Postgres (Neon aceita conexão de fora da Vercel) ou pra outro banco Postgres; sem `BLOB_READ_WRITE_TOKEN` configurado, os anexos passam a ser salvos em disco local (`storage/attachments/`) automaticamente. Nesse cenário, use algo como `pm2` pra manter o processo no ar e faça backup da pasta `storage/`.

## Estrutura das permissões

- Cada usuário tem uma lista de **colunas visíveis** (`/admin/usuarios`). O backend nunca envia ao navegador um campo que o usuário não pode ver — não é apenas uma tela escondida.
- `canEdit` (por usuário) define se ele pode editar/criar pedidos. Quem tem `canEdit = false` só visualiza.
- Cada **Status** tem um campo "permite edição". Pedidos num status não editável ficam bloqueados para todos, exceto ADMIN.
- Apenas ADMIN exclui pedidos e anexos.
- Alterar as permissões de um usuário em `/admin/usuarios` vale imediatamente, sem precisar logout/login.
- O Fórum (acima) reaproveita essa mesma restrição por Cliente para decidir quem pode ser @-marcado, ler e responder numa conversa de um Pedido.

## Preparado para o Omie

O cadastro de Cliente guarda só o nome, propositalmente — os demais dados (endereço, contato, etc.) ficam no Omie. O código está organizado em `lib/` (regras) e `app/api/` (rotas) de forma que uma futura integração (por exemplo, sincronizar clientes ou pedidos com a API do Omie) pode ser adicionada como um módulo novo sem mexer nas regras de permissão existentes.
