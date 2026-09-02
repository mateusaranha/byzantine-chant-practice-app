# Psaltikon

O **Psaltikon** é uma ferramenta gratuita para preparar, marcar, organizar e praticar hinos de canto bizantino. A letra e uma gravação do YouTube ficam lado a lado; cores distinguem trechos e sublinhados simples ou duplos funcionam como lembretes visuais do canto.

**Aplicativo:** <https://mateusaranha.github.io/byzantine-chant-practice-app/>

O Psaltikon é um auxílio intermediário de escuta e memorização. Ele não substitui o aprendizado da notação musical bizantina, a formação musical ou a orientação de um professor.

## Estado atual

- vários hinos no mesmo espaço, com reorganização da ordem;
- texto grego politônico e leitura transliterada automática;
- cinco cores, sublinhados simples ou duplos, borracha e desfazer;
- controles de treino para ocultar temporariamente cores ou sublinhados;
- YouTube, velocidade-alvo e repetição 1x, 3x ou contínua;
- tamanho e espaçamento do texto ajustáveis;
- backup em JSON e PDF para celular em grego, transliteração ou nas duas leituras, com marcações opcionais;
- biblioteca pública, publicação por usuários aprovados e links de compartilhamento;
- central de ajuda com guia de estudo, orientações de uso e referências;
- interface responsiva e instalável como PWA.

YouTube, login e biblioteca dependem de conexão. O restante do espaço de estudo funciona localmente e o shell do aplicativo fica disponível offline depois de carregado.

## Fluxo principal

1. Edite título, modo e letra em **Editar texto**.
2. Cole uma URL do YouTube e carregue a gravação.
3. Marque trechos com cores ou sublinhados e defina a velocidade de estudo.
4. Acrescente e reorganize hinos quando necessário.
5. Mantenha o trabalho no dispositivo, exporte backup/PDF ou publique um conjunto.

### Leitura transliterada

**Transliterado** converte a letra grega no navegador segundo a convenção aprovada a partir do livrinho da paróquia. A opção é temporária: somente o grego é salvo, e voltar para **Grego** recupera o texto e todas as marcações originais. Cores e sublinhados podem ser criados ou editados em qualquer uma das leituras, mas continuam armazenados como intervalos do texto grego. Quando a seleção atinge apenas parte de uma unidade indivisível — como o “h” de `ch` — ela é ajustada à unidade inteira.

A transliteração é um auxílio de leitura, não uma transcrição fonética completa. Pronúncia e particularidades da execução devem ser acompanhadas pela gravação; correções manuais ficam para uma etapa futura.

## Arquitetura

| Parte | Tecnologia | Responsabilidade |
|---|---|---|
| Interface | React 19, TypeScript e Vite | Edição, marcações, vídeo, backup, impressão e biblioteca |
| Hospedagem | GitHub Pages | Site estático gerado em `dist/` |
| Persistência local | `localStorage` | Espaço de trabalho e sessão do publicador |
| Biblioteca | JSONs neste repositório | Conjuntos públicos em `hinos/<login>/` |
| Serviço de publicação | Cloudflare Worker | OAuth, autorização e operações no GitHub |
| Acesso ao repositório | GitHub App do Psaltikon | Contents e Issues neste repositório |

Não há servidor da interface, banco de dados próprio, contas próprias do Psaltikon nem agente de IA em execução. O Worker não armazena hinos: valida cada requisição e usa a GitHub App para operar no repositório.

## Dados e permissões

**Trabalho local:** o espaço fica em `psaltikon-practice` no `localStorage` e é salvo automaticamente. Dados antigos são normalizados. Se uma leitura ou tentativa de salvamento falhar, o salvamento é pausado e a interface oferece recuperação antes de qualquer substituição. Importações, conjuntos da biblioteca e alterações de letras com marcações são validados e confirmados quando podem remover dados.

**Biblioteca e compartilhamento:** qualquer visitante pode abrir os conjuntos públicos sem login. Um link pode apontar para o conjunto inteiro ou para um hino específico e sempre lê a publicação mais recente. O material compartilhado abre em uma área temporária; **Adicionar ao meu espaço** cria uma cópia local independente sem sobrescrever trabalho válido.

**Publicação:** o login usa GitHub OAuth. A interface retira a sessão assinada da URL e a mantém no navegador por até oito horas. Somente contas em `config/approved-users.json` publicam; cada autor grava em `hinos/<seu-login>/`. A administração continua restrita ao administrador e toda exclusão é limitada a caminhos válidos sob `hinos/`.

Cada publicação aceita de 1 a 80 hinos e até 1,5 MB de dados de hinos. Os JSONs, títulos, letras e links publicados são públicos: não inclua informações privadas.

## Estrutura relevante

```text
src/App.tsx                     espaço de trabalho e persistência local
src/HelpDialog.tsx              navegação da central de ajuda
src/StudyGuide.tsx              preparação e prática dos hinos
src/AppGuide.tsx                backup, PDF, biblioteca e compartilhamento
src/CloudLibrary.tsx            biblioteca e administração
src/ShareDialog.tsx             compartilhamento de conjuntos e hinos
src/sharedHymns.ts              leitura pública e cópias compartilhadas
src/transliteration.ts          transliteração e projeção das marcações
src/fonts/                      fontes incorporadas
public/licenses/                licenças incluídas no site publicado
public/                         manifesto, ícones e service worker
hinos/<login>/                  conjuntos públicos versionados
config/approved-users.json      administrador e publicadores aprovados
publisher-worker/               OAuth, autorização e API da biblioteca
.github/workflows/              testes e deploys automáticos
tests/                          testes da interface e regressões principais
ROADMAP.md                      direção e prioridades ainda abertas
```

## Desenvolvimento

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

O teste da interface compila, verifica tipos e executa os testes funcionais:

```bash
npm test
```

Para testar manualmente a biblioteca contra outro serviço:

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

Use `publisher-worker/.dev.vars.example` como referência e mantenha credenciais reais em `.dev.vars`, já ignorado pelo Git.

## Deploy e configuração

Pull requests executam os testes da interface e do Worker. Um push na `main` testa e publica a interface no GitHub Pages; mudanças em `publisher-worker/**` testam e publicam o Worker com Wrangler.

O deploy do Worker utiliza estes secrets:

- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`;
- `PSALTIKON_APP_ID`, `PSALTIKON_CLIENT_ID` e `PSALTIKON_INSTALLATION_ID`;
- `PSALTIKON_CLIENT_SECRET` e `PSALTIKON_PRIVATE_KEY`.

Os valores públicos ficam em `publisher-worker/wrangler.jsonc`. O provisionamento da GitHub App está documentado em `publisher-worker/README.md`.

Renomear o repositório ou mudar URLs exige revisar em conjunto GitHub Pages, Worker, GitHub App, callback OAuth, CORS, manifesto, workflows e documentação. Salvar um conjunto ainda cria um commit na `main` e, por isso, também aciona o workflow do Pages.

## Segurança e manutenção

- workflows usam permissões mínimas e Actions fixadas por hash;
- credenciais ficam em secrets, nunca no repositório;
- leitura pública, publicação e administração são validadas separadamente no Worker;
- caminhos de gravação e exclusão permanecem limitados a `hinos/`;
- CodeQL, Dependabot e proteções configuradas no GitHub devem ser conferidos também na interface do repositório.

Antes de mudanças relevantes, leia `ROADMAP.md` e `AGENTS.md`.

## Licença

O código-fonte e a documentação produzidos para o Psaltikon são distribuídos sob a [licença MIT](LICENSE), Copyright (c) 2026 Mateus Aranha Martins.

A licença MIT não concede automaticamente direitos sobre conjuntos em `hinos/`, textos litúrgicos, gravações externas ou outros conteúdos de terceiros. A Noto Serif incorporada ao aplicativo permanece sob a SIL Open Font License 1.1. Consulte [os avisos de terceiros](THIRD_PARTY_NOTICES.md).
