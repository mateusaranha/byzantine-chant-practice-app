# Psaltikon

O **Psaltikon** é uma ferramenta gratuita para auxiliar o estudo e a prática do canto bizantino. Ele coloca a letra do hino e uma gravação de referência lado a lado, permitindo transformar aquilo que se ouve em marcações visuais simples.

**Aplicativo:** <https://mateusaranha.github.io/byzantine-chant-practice-app/>

O caminho ideal continua sendo aprender a própria notação musical bizantina. O Psaltikon não pretende substituí-la: funciona como uma ferramenta intermediária para quem ainda não lê a partitura com fluência suficiente para os hinos que precisa aprender.

## Como as marcações ajudam

- As **cores suaves** dividem a letra em pequenos trechos melódicos.
- O **sublinhado simples** identifica sílabas com ornamentação mais breve.
- O **sublinhado duplo** identifica sílabas com ornamentação mais pronunciada ou prolongada.
- A **velocidade-alvo** registra em qual velocidade a gravação deve ser praticada.

Essas indicações aproximam texto e escuta, ajudando a visualizar a estrutura da melodia e a memorizar o hino. Elas são um recurso prático de estudo, não uma transcrição da notação bizantina.

## Principais recursos

- número livre de hinos em uma mesma sessão;
- texto grego politônico com fonte incorporada;
- marca-textos para trechos melódicos;
- sublinhados simples e duplos para melismas;
- controles independentes para apagar cores ou melismas de cada hino;
- vídeo do YouTube ao lado da letra;
- indicação de velocidade-alvo e opções de repetição da gravação;
- ajuste do tamanho e do espaçamento do texto;
- PDF vertical, com um hino por página, otimizado para leitura no celular;
- backup e restauração de todo o espaço de estudo em JSON;
- biblioteca online de conjuntos compartilhados pelo GitHub;
- interface instalável no celular e disponível offline após o primeiro carregamento.

## Uso básico

1. Abra **Edit text** e informe o título, o modo e a letra do hino.
2. Cole o endereço da gravação do YouTube e pressione **Load**.
3. Se necessário, registre a velocidade-alvo da prática.
4. Selecione uma cor e marque cada trecho melódico na letra.
5. Use **Short** ou **Long** para sublinhar sílabas com ornamentação.
6. Acrescente outros hinos com **Add another hymn**.
7. Exporte um PDF para a liturgia ou um backup para guardar uma cópia completa.

O link **Sobre**, no rodapé do aplicativo, apresenta uma explicação curta do propósito pedagógico da ferramenta.

## Armazenamento e compartilhamento

O espaço de trabalho é salvo automaticamente no `localStorage` do navegador. Isso mantém letras, vídeos e marcações naquele navegador e dispositivo, mesmo depois de fechar a página. Limpar os dados do site remove essa cópia local.

Há duas formas de transferir ou compartilhar o conteúdo:

- **Export backup / Import backup:** cria e restaura um arquivo local com todos os hinos e marcações.
- **Biblioteca online:** conjuntos publicados ficam em `hinos/<usuario-do-github>/` neste repositório e podem ser abertos em qualquer dispositivo. Qualquer visitante pode ler; somente usuários aprovados podem publicar ou excluir conteúdo autorizado.

Os conjuntos da biblioteca e o histórico do repositório são públicos. Não publique informações privadas nas letras, títulos ou links.

## Visão técnica

O projeto tem duas partes:

- **Interface:** React, TypeScript e Vite, publicada como site estático no GitHub Pages.
- **Serviço de publicação:** Cloudflare Worker responsável pela autenticação com GitHub e pelas operações da biblioteca.

O Worker não mantém um banco de dados próprio para os hinos. Ele lê e grava arquivos JSON no repositório por meio de uma GitHub App instalada somente neste projeto. As configurações sensíveis ficam nos mecanismos protegidos do GitHub Actions e da Cloudflare e nunca devem ser incluídas no código-fonte.

### Estrutura relevante

```text
src/                    interface React
public/                 ícones, manifesto e suporte offline
hinos/                  conjuntos publicados, separados por usuário
config/                 lista de publicadores aprovados
publisher-worker/       serviço de autenticação e publicação
.github/workflows/      publicação automática do site e do Worker
tests/                  verificações do build da interface
```

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para gerar e verificar a versão de produção:

```bash
npm test
```

O serviço em `publisher-worker/` possui instalação e testes próprios:

```bash
cd publisher-worker
npm ci
npm test
```

Não crie arquivos locais com credenciais a partir dos exemplos sem confirmar que eles permanecem ignorados pelo Git. Nunca registre credenciais, tokens, chaves privadas ou valores de autenticação no repositório.

## Publicação e manutenção

- Alterações na branch `main` acionam a publicação automática do GitHub Pages.
- Alterações em `publisher-worker/` acionam os testes e a publicação do Worker.
- Os hinos publicados são arquivos JSON comuns e permanecem versionados no histórico do GitHub.
- Antes de atualizar dependências, execute os testes da interface e do Worker e confira o funcionamento do fluxo de login, leitura e publicação.
- Ao alterar o endereço público do site ou do Worker, revise também os endereços de retorno e as origens permitidas da autenticação.

## Privacidade e segurança

- O login acontece na página oficial do GitHub; o Psaltikon não recebe a senha do usuário.
- O aplicativo usa somente GitHub, Cloudflare e YouTube para suas funções online.
- A leitura da biblioteca não exige login.
- A publicação exige autenticação e aprovação do administrador.
- Cada publicador grava em sua própria pasta; ações administrativas permanecem restritas ao administrador.
- O código do projeto é público e pode ser auditado neste repositório.

O Psaltikon é uma ferramenta auxiliar de estudo e memorização pela escuta. Ele não substitui formação musical, orientação de um professor ou o aprendizado da notação bizantina.
