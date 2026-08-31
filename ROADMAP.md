# Roadmap do Psaltikon

Este documento separa prioridades atuais de possibilidades futuras. Uma ideia listada aqui **não é automaticamente um requisito**.

## Direção atual

O Psaltikon atende principalmente ao uso pessoal na preparação e prática de hinos, com possível uso por outro psaltis e testes com poucas pessoas próximas. A arquitetura atual — GitHub Pages, Cloudflare Worker, GitHub App e JSONs no repositório — é suficiente para esse cenário.

O notebook é o ambiente principal de preparação e edição. O celular é importante para consulta, reprodução, prática e controles ocasionais. Não adotar “mobile first” automaticamente: usar bem o espaço do notebook e manter telas pequenas confortáveis, sem melhorar um dispositivo à custa desnecessária do outro.

Priorizar problemas observados em uso real, mudanças pequenas e clareza. Feedback de outro psaltis deve pesar mais que hipóteses abstratas sobre uma plataforma pública.

## Próximas prioridades

### 1. Renomear o repositório e melhorar a URL

Avaliar `psaltikon` ou nome semelhante, se disponível. Antes de renomear, mapear e alterar de forma coordenada:

- URL do GitHub Pages e `FRONTEND_URL`;
- `GITHUB_REPO` do Worker;
- homepage e callback da GitHub App;
- CORS, manifesto, links e documentação;
- workflows e quaisquer referências externas.

Testar login, biblioteca, os dois deploys e redirecionamentos. Não tratar o redirecionamento automático do GitHub como substituto de atualizar as integrações.

### 2. Melhorar controles de fonte e espaçamento

Substituir os sliders por controles de menos/valor/mais, com alvos confortáveis para toque e boa apresentação no notebook. Considerar restaurar o padrão sem acrescentar ruído visual.

### 3. Avaliar internacionalização da interface

A interface atual foi padronizada em português brasileiro. Se o uso real justificar outros idiomas, estruturar futuramente os textos em um catálogo central, permitindo trocar o idioma inteiro e lembrar a escolha no navegador.

Português brasileiro e inglês são os candidatos naturais iniciais, mas os idiomas suportados ainda devem ser decididos. Grego ou outros idiomas só devem ser acrescentados com revisão linguística adequada. O seletor traduz a interface, não o texto dos hinos.

### 4. Testar com outro psaltis

Observar no notebook e no celular:

- primeiro uso e entendimento das marcações;
- preparação, publicação e abertura de conjuntos;
- riscos de edição acidental;
- clareza dos textos de ajuda;
- controles que realmente fazem falta.

## Melhorias desejadas de interface

Estas propostas precisam de desenho e teste antes de implementação:

- **Velocidade:** verificar em uso real se o botão de `+` muda de posição ou provoca toque acidental quando `Restaurar` aparece/desaparece; não há falha confirmada no código.

A borracha e os comandos independentes **Limpar cores** e **Limpar melismas** já existem. Melhorias futuras devem evitar duplicar esses comportamentos.

Concluído nesta etapa:

- **Guia de estudo e ajuda compacta:** conteúdo pessoal revisado pelo criador, acessível pelo rodapé e pelas dicas sob texto e vídeo, em janela com rolagem; “Sobre” alinhado ao significado aprovado das marcações.
- **Modo de treino:** cada hino possui controles independentes para ocultar temporariamente cores e sublinhados sem alterar marcações, backup, biblioteca ou PDF; ferramentas incompatíveis ficam indisponíveis enquanto a categoria está invisível.
- **Modo neutro/cursor:** cada hino pode ficar sem ferramenta de marcação ativa, evitando alterações acidentais.
- **Painel de ferramentas recolhível:** fonte, espaçamento e ferramentas de anotação podem ser ocultados durante a prática; recolher o painel ativa o modo neutro.
- **Primeiro acesso vazio:** na ausência de trabalho local válido, o aplicativo começa com o mesmo “Novo hino” vazio usado pelo comando de adicionar hino, sem substituir sessões existentes.
- **Interface em português:** os textos visíveis e de acessibilidade foram padronizados em português brasileiro; grego litúrgico, nomes próprios e termos técnicos necessários foram preservados.

## Ajuda e demonstração

O **Guia de estudo** reúne as quatro seções aprovadas: encontrar textos e gravações, escolher uma referência, usar cores e sublinhados e praticar o hino. A ajuda não ocupa permanentemente o espaço de estudo. Novas dicas, canais e referências dependem de indicação e revisão do criador; orientações de salvamento e recuperação ficam para uma melhoria futura.

Considerar um exemplo clicável com texto, vídeo, cores e melismas. O exemplo deve demonstrar o Psaltikon concretamente; não precisa ser o conteúdo inicial obrigatório de todo usuário.

## Evolução funcional possível

Ideias úteis, ainda sem prioridade fechada:

- link direto que abra um conjunto específico;
- indicador claro de “salvo neste dispositivo” versus “publicado no GitHub”;
- busca por conjunto ou autor;
- reordenação e duplicação de hinos;
- recuperação simplificada de versões anteriores;
- revisão do limite de 80 hinos somente se uso real mostrar necessidade;
- biblioteca pública curada com grandes festas e exemplos completos;
- agrupar diferentes versões de uma mesma obra litúrgica, após definir se “versão” significa gravação, melodia, marcação, fonte, idioma ou combinação desses elementos.

Importação, exportação, PDF e compartilhamento simples podem ser mais úteis para uma futura experiência pública do que contas e bibliotecas privadas complexas.

## Segurança e manutenção

Já concluído:

- permissões explícitas e mínimas nos workflows;
- GitHub Actions fixadas por hashes imutáveis;
- CodeQL executado e alertas do Dependabot ativados, conforme o histórico do projeto; essas configurações devem ser verificadas no GitHub porque não ficam representadas no checkout.

Próximas camadas possíveis, sem urgência para o uso atual:

- criar `dependabot.yml` semanal para npm da interface, npm do Worker e GitHub Actions;
- adicionar e testar uma Content Security Policy compatível com YouTube, Worker, GitHub e fontes locais;
- avaliar limitação de requisições no Worker se abuso ou exposição maior justificar;
- evitar builds do Pages causados apenas por commits em `hinos/` ou `config/`, se o volume tornar isso incômodo;
- manter a fixação por hash atualizada sem aceitar atualizações automáticas sem revisão.

## Decisões deliberadamente adiadas

### Biblioteca, autenticação e armazenamento

Não redesenhar agora a solução existente para antecipar escala hipotética. Não há necessidade comprovada de banco multiusuário, contas próprias, bibliotecas privadas ou sincronização complexa.

Se surgir interesse público concreto, avaliar separadamente:

1. biblioteca pública curada, com pouca ou nenhuma persistência individual; e
2. plataforma multiusuário, que exigiria requisitos reais para contas, permissões, moderação, sincronização e migração.

### Ecclesia

Uma associação futura ao ecossistema `ecclesia.org.br` é apenas possibilidade. Primeiro amadurecer e testar a ferramenta. Se houver interesse concreto do responsável, reavaliar a arquitetura a partir dos requisitos apresentados — divulgação, link, autenticação compartilhada ou integração efetiva não devem ser presumidos.

### Segundo repositório ou fork

Se uma versão pública exigir mudanças profundas, preservar a ferramenta pessoal funcional e experimentar em um fork ou segundo repositório continua sendo uma estratégia possível, não uma decisão tomada.

### Cloudflare Pages

Investigar futuramente se migrar a interface do GitHub Pages para Cloudflare Pages traria vantagem concreta em previews, domínio, desempenho ou manutenção. Não migrar apenas por parecer mais moderno. A mudança não está decidida nem é prioridade.

### Domínio próprio

Considerar apenas se o projeto ganhar público ou identidade estável que justifique custo e manutenção.

## Como manter este roadmap

Atualize-o quando prioridades ou decisões estratégicas mudarem. Mova um item para o README quando ele se tornar funcionamento real. Não registre cada ajuste visual pequeno nem preserve o histórico completo das conversas.
