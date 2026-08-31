# Psaltikon

O **Psaltikon** é uma ferramenta gratuita para preparar, marcar, organizar e praticar hinos de canto bizantino. A letra e uma gravação do YouTube ficam lado a lado; cores dividem frases melódicas e sublinhados simples ou duplos indicam melismas.

**Aplicativo:** <https://mateusaranha.github.io/byzantine-chant-practice-app/>

O Psaltikon é um auxílio intermediário de escuta e memorização. Ele não substitui o aprendizado da notação musical bizantina, a formação musical ou a orientação de um professor.

## O que existe hoje

- vários hinos no mesmo espaço de trabalho;
- texto grego politônico com fonte local incorporada;
- cinco cores de marcação, melisma simples e melisma complexo;
- borracha, desfazer e limpeza independente de cores e melismas;
- vídeo do YouTube, velocidade-alvo e repetição 1x, 3x ou contínua;
- ajustes de tamanho e espaçamento do texto;
- impressão/PDF em formato vertical, iniciando cada hino em nova página;
- backup e restauração do espaço de trabalho em JSON;
- biblioteca pública de conjuntos, com publicação restrita a usuários aprovados;
- links públicos para estudar um conjunto ou hino publicado sem login nem navegação pela biblioteca;
- interface responsiva, instalável como PWA e com o shell disponível offline após ser carregado.

Recursos online — YouTube, login e biblioteca — continuam dependendo de conexão.

## Fluxo principal de uso

1. Edite título, modo e texto do hino em **Edit text**.
2. Cole uma URL do YouTube e carregue a gravação.
3. Selecione trechos do texto com uma cor, melisma ou borracha ativa.
4. Registre a velocidade-alvo e, se necessário, configure a repetição do vídeo.
5. Acrescente outros hinos e ajuste a apresentação de cada um.
6. Mantenha o trabalho no dispositivo, exporte backup/PDF ou publique o conjunto na biblioteca.

## Arquitetura atual

| Parte | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | React 19, TypeScript e Vite | Edição, marcações, vídeo, backup, impressão e biblioteca |
| Hospedagem | GitHub Pages | Entrega do site estático gerado em `dist/` |
| Persistência local | `localStorage` | Espaço de trabalho e sessão do publicador no navegador |
| Biblioteca | Arquivos JSON neste repositório | Conjuntos públicos versionados em `hinos/<login>/` |
| Serviço de publicação | Cloudflare Worker | OAuth, autorização e operações de leitura/gravação no GitHub |
| Acesso ao repositório | GitHub App do Psaltikon | Permissões limitadas a Contents e Issues neste repositório |

Não há servidor da interface, banco de dados próprio, contas próprias do Psaltikon nem agente de IA em execução. O Worker é um intermediário sem armazenamento de hinos: recebe uma requisição, aplica regras e usa a GitHub App para operar no repositório.

### Fluxos de dados

**Trabalho local:** a interface carrega `psaltikon-practice` do `localStorage`, normaliza dados antigos e salva automaticamente `{ version: 3, hymns }` após alterações. O backup exportado usa a versão 4 e inclui data de exportação. Importar ou abrir um conjunto substitui o espaço atual após confirmação.

**Leitura da biblioteca:** qualquer visitante pode listar e abrir os JSONs de `hinos/` pelo Worker, sem login. O conjunto carregado passa a ser uma cópia local editável.

**Compartilhamento:** na biblioteca, use **Compartilhar** ao lado do conjunto, escolha o conjunto inteiro ou um hino e copie o link. O link aponta para a versão publicada mais recente; alterações locais precisam ser publicadas antes de serem compartilhadas. Quem recebe abre diretamente uma área temporária de estudo, com letra, gravação e marcações, sem login e sem alterar o espaço local. Ajustes nessa área duram somente enquanto a página estiver aberta; sair ou atualizar a página os descarta. Backup e PDF exportam o material em estudo, mantendo suas marcações mesmo quando ocultas para treino.

**Guardar uma cópia compartilhada:** **Adicionar ao meu espaço** acrescenta uma cópia com novos identificadores aos hinos salvos no dispositivo e abre o espaço local. Só o hino inicial vazio e intocado é substituído. A ação relê o armazenamento antes de gravar; dados locais ilegíveis, falta de espaço ou mais de 80 hinos impedem a adição. A cópia guardada não acompanha automaticamente futuras alterações do autor.

Links usam `?conjunto=hinos/<autor>/<slug>.json` e, opcionalmente, `&hino=<id-publicado>`, sem incluir tokens ou conteúdo local. A seleção individual usa o identificador, não a posição do hino no conjunto; se ele for removido, o link informa a indisponibilidade. Hinos antigos sem identificador único podem ser compartilhados como parte do conjunto inteiro. Conjuntos excluídos, links inválidos e falhas de rede não substituem o trabalho local. Todo conteúdo compartilhado continua público.

**Publicação:** o login ocorre no GitHub por OAuth. O Worker devolve uma sessão assinada, válida por oito horas, que a interface guarda em `psaltikon-publisher-session`. Para salvar, a conta precisa constar em `config/approved-users.json`. Cada publicador grava somente em `hinos/<seu-login>/`; o administrador também pode excluir conjuntos de outros autores.

**Solicitação de acesso:** o Worker cria uma Issue com o prefixo `[Psaltikon access]`. O administrador aprova ou recusa pela interface; a aprovação atualiza `config/approved-users.json` e fecha a Issue.

Cada conjunto publicado:

- é um JSON público com título, autor, data e hinos;
- recebe um slug de até 72 caracteres;
- aceita de 1 a 80 hinos e até 1,5 MB de dados de hinos;
- é gravado diretamente na branch `main`, gerando um commit e preservando histórico.

Não publique informações privadas em títulos, letras ou links.

## Estrutura relevante

```text
src/App.tsx                     espaço de trabalho e persistência local
src/CloudLibrary.tsx            interface da biblioteca e administração
src/ShareDialog.tsx             seleção e cópia de links para material publicado
src/sharedHymns.ts              links, leitura pública e adição segura de cópias
src/styles.css                  layout responsivo e impressão
public/                         manifesto, ícones e service worker
hinos/<login>/                  conjuntos públicos versionados
config/approved-users.json      administrador e publicadores aprovados
publisher-worker/src/index.js   OAuth, autorização e API da biblioteca
publisher-worker/wrangler.jsonc valores públicos do Worker
.github/workflows/              testes e deploys automáticos
tests/                          teste do build da interface
ROADMAP.md                      prioridades, ideias e adiamentos
AGENTS.md                       instruções para futuros agentes
```

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para compilar e testar a interface:

```bash
npm test
```

`npm test` fornece uma URL fictícia ao build para também verificar a presença da biblioteca. Para testar manualmente contra outro serviço:

```bash
VITE_PUBLISHER_API_URL=https://worker.example npm run dev
```

O Worker tem instalação independente:

```bash
cd publisher-worker
npm ci
npm test
npm run dev
```

Para desenvolvimento local do Worker, use `publisher-worker/.dev.vars.example` como referência e mantenha o arquivo real em `.dev.vars`, que já está ignorado pelo Git. Nunca registre tokens, client secrets ou chaves privadas.

## API do Worker

- públicos: `GET /health`, `GET /auth/login`, `GET /auth/callback`, `GET /api/library` e `GET /api/library/item`;
- com sessão: `GET /api/session` e `POST /api/access/request`;
- publicador aprovado: `POST /api/sets` e `DELETE /api/sets`;
- administrador: `POST /api/admin/approve|reject|add|revoke`.

O CORS aceita somente a origem definida em `FRONTEND_URL`. Os valores públicos de repositório, administrador e frontend ficam em `publisher-worker/wrangler.jsonc`; credenciais ficam como secrets do GitHub Actions e do Cloudflare.

## Deploy

### Interface no GitHub Pages

Qualquer push na `main` aciona `.github/workflows/deploy-pages.yml`:

1. instala dependências;
2. compila e testa tipos;
3. injeta `VITE_PUBLISHER_API_URL` com a URL atual do Worker;
4. publica `dist/` no GitHub Pages.

Como os conjuntos também são gravados na `main`, salvar ou excluir um conjunto atualmente aciona esse workflow, embora não altere o código da interface.

### Worker na Cloudflare

Mudanças em `publisher-worker/**` ou no próprio workflow acionam `.github/workflows/deploy-publisher.yml`, que testa e publica com Wrangler. O workflow precisa destes secrets:

- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`;
- `PSALTIKON_APP_ID`, `PSALTIKON_CLIENT_ID` e `PSALTIKON_INSTALLATION_ID`;
- `PSALTIKON_CLIENT_SECRET` e `PSALTIKON_PRIVATE_KEY`.

O workflow os mapeia para secrets criptografados do Worker. Veja `publisher-worker/README.md` para o provisionamento da GitHub App.

Ao mudar nome do repositório, URLs públicas ou domínios, revise em conjunto o workflow do Pages, `wrangler.jsonc`, a GitHub App, o callback OAuth, CORS, manifesto e documentação.

## Segurança e manutenção

- os workflows declaram permissões mínimas para o `GITHUB_TOKEN`;
- Actions externas estão fixadas por hashes imutáveis, com a versão legível em comentário;
- a GitHub App deve continuar instalada somente neste repositório, com Contents e Issues em leitura/escrita;
- a leitura é pública, mas gravação, exclusão e administração são validadas no Worker;
- o caminho de gravação é limitado à pasta do publicador, salvo o poder adicional de exclusão do administrador;
- tokens de instalação e lista de aprovados têm cache curto em memória; os hinos não são armazenados no Worker;
- CodeQL, Dependabot e outras proteções configuradas na interface do GitHub não aparecem necessariamente nos arquivos do checkout e devem ser conferidas nas configurações do repositório.

Antes de mudanças relevantes, leia também `ROADMAP.md` e `AGENTS.md`.
