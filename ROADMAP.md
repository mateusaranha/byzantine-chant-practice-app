# Roadmap do Psaltikon

Este documento registra direção, prioridades e decisões estratégicas. O funcionamento atual pertence ao `README.md`; tarefas concretas e discussões detalhadas pertencem às Issues. Uma ideia listada aqui **não é automaticamente um requisito**.

## Estado atual

- uso principal pessoal e paroquial, agora pronto para testes com poucas pessoas próximas;
- notebook como ambiente principal de preparação e edição, com celular importante para consulta e prática;
- arquitetura deliberadamente simples: GitHub Pages, Cloudflare Worker, GitHub App e JSONs no repositório;
- biblioteca pública e publicação restrita suficientes para o cenário atual.

Priorizar problemas observados em uso real, mudanças pequenas e clareza. Feedback de outros psaltis deve pesar mais que hipóteses sobre uma plataforma pública.

## Prioridades atuais

### 1. Testar com outro psaltis

Observar no notebook e no celular:

- entendimento inicial das marcações e dos controles de treino;
- preparação, reorganização, publicação e abertura de conjuntos;
- riscos de edição acidental ou perda de dados;
- clareza do guia e das mensagens de recuperação;
- controles que realmente fazem falta.

### 2. Renomear o repositório e melhorar a URL

Avaliar `psaltikon` ou nome semelhante, se disponível. Antes de renomear, coordenar GitHub Pages, `FRONTEND_URL`, `GITHUB_REPO`, GitHub App, OAuth, CORS, manifesto, workflows, links e documentação. Testar login, biblioteca e os dois deploys.

### 3. Melhorar fonte e espaçamento

Avaliar controles de menos/valor/mais no lugar dos sliders, com alvos confortáveis no celular e boa apresentação no notebook. Considerar restauração do valor padrão sem acrescentar ruído visual.

### 4. Avaliar internacionalização

Se o uso real justificar, mover textos da interface para um catálogo central e lembrar o idioma escolhido no navegador. Português brasileiro, inglês e espanhol são os candidatos iniciais; outros idiomas exigem revisão linguística. O seletor traduz a interface, não as letras dos hinos.

## Melhorias desejadas

Itens úteis, ainda sem prioridade fechada:

- indicador claro de “salvo neste dispositivo” versus “publicado no GitHub”;
- busca por conjunto ou autor;
- duplicação de hinos;
- recuperação simplificada de versões anteriores;
- correção manual opcional da transliteração;
- exemplo clicável que demonstre texto, vídeo, cores e sublinhados;
- biblioteca curada com festas e exemplos completos;
- agrupamento de versões de uma mesma obra, depois de definir o que constitui uma versão;
- verificar em uso real se o botão de velocidade muda de posição quando **Restaurar** aparece.

Revisar o limite de 80 hinos somente se o uso real mostrar necessidade.

## Ideias futuras e exploratórias

- uma experiência pública pode priorizar importação, exportação, PDF e links antes de contas complexas;
- tradução rápida de letras e integração com fontes litúrgicas externas continuam experimentos, não compromissos de produto;
- domínio próprio ou outra hospedagem só fazem sentido diante de público e manutenção justificáveis.

Essas ideias devem permanecer nas Issues enquanto não houver problema concreto, desenho revisado e prioridade definida.

## Segurança e manutenção

Camadas possíveis, sem urgência comprovada para o uso atual:

- `dependabot.yml` semanal para npm da interface, npm do Worker e GitHub Actions;
- Content Security Policy testada com YouTube, Worker, GitHub e fontes locais;
- limitação de requisições no Worker se abuso ou exposição maior justificar;
- evitar builds do Pages causados apenas por commits em `hinos/` ou `config/`, se o volume crescer;
- manter Actions fixadas por hash e revisar atualizações antes de aceitá-las.

## Decisões adiadas

### Biblioteca, autenticação e armazenamento

Não redesenhar a solução para antecipar escala hipotética. Banco multiusuário, contas próprias, bibliotecas privadas e sincronização complexa só devem ser reconsiderados diante de interesse público concreto e requisitos reais.

Nesse cenário, avaliar separadamente uma biblioteca pública curada e uma plataforma multiusuário. São produtos diferentes, com exigências distintas de permissões, moderação e migração.

### Ecclesia

Uma associação futura ao ecossistema `ecclesia.org.br` é apenas uma possibilidade. Se houver interesse concreto do responsável, reavaliar divulgação, links, autenticação e integração a partir dos requisitos apresentados.

### Segundo repositório ou fork

Se uma versão pública exigir mudanças profundas, preservar a ferramenta pessoal funcional e experimentar em um fork ou segundo repositório continua sendo uma estratégia possível, não uma decisão tomada.

### Cloudflare Pages e domínio próprio

Não migrar a interface ou adquirir domínio apenas por parecer mais moderno. Reavaliar somente se previews, identidade, desempenho ou manutenção produzirem vantagem concreta.

## Como manter este roadmap

- mover para o README apenas funcionalidades que já existem;
- usar Issues para bugs, melhorias pontuais e brainstorming;
- não preservar histórico completo de conversas ou ajustes visuais pequenos;
- atualizar este arquivo quando uma prioridade ou decisão estratégica realmente mudar.
