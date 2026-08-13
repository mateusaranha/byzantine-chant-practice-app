# Psaltikon

Aplicativo independente para praticar canto bizantino com letra grega e gravação de referência lado a lado.

## Recursos

- número ilimitado de hinos;
- texto grego politônico com fonte incorporada;
- marca-textos para separar frases melódicas;
- sublinhado simples e duplo para melismas;
- velocidade-alvo e repetição do vídeo;
- exportação de PDF em formato vertical para celular;
- backup em JSON para transferir todos os hinos e marcações;
- instalação na tela inicial do celular e suporte offline para a interface.

Os dados ficam no `localStorage` do navegador. Para trocar de aparelho ou domínio, use **Export backup** e depois **Import backup**.

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
```

## Publicação

O fluxo `.github/workflows/deploy-pages.yml` compila e publica o aplicativo automaticamente no GitHub Pages a cada atualização da branch `main`.

No repositório, selecione **Settings → Pages → Source: GitHub Actions** caso o GitHub solicite essa configuração na primeira publicação.
