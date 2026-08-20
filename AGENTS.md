# Instruções para agentes

1. Leia `README.md` e `ROADMAP.md` antes de alterações relevantes.
2. Examine o código afetado; o código atual é a fonte de verdade se a documentação divergir.
3. Preserve o que já funciona e priorize problemas concretos do uso pessoal/paroquial atual.
4. O notebook é o ambiente principal de preparação e edição. Preserve também boa consulta, reprodução, prática e controles no celular. Não imponha “mobile first” nem prejudique um dispositivo para melhorar o outro sem necessidade.
5. Não transforme ideias do roadmap em requisitos. Confirme o status e o escopo antes de implementar itens exploratórios.
6. Evite complexidade motivada apenas por escala pública, Ecclesia ou outros cenários hipotéticos. A arquitetura atual é deliberadamente simples.
7. Distinga GitHub como repositório do código de GitHub como armazenamento versionado de `hinos/` e `config/`.
8. Trate alterações em nome do repositório, URLs, autenticação ou deploy como mudanças coordenadas entre Pages, Worker, GitHub App, OAuth, CORS, manifesto e documentação.
9. Nunca registre secrets, tokens ou chaves. `.dev.vars` é local e ignorado; `.dev.vars.example` contém somente placeholders.
10. Prefira mudanças pequenas, compreensíveis, testáveis e reversíveis. Não faça refatorações amplas sem necessidade concreta.
11. Antes de entregar mudanças de código, rode `npm test` na raiz e `npm test` em `publisher-worker/`. Teste manualmente os fluxos afetados quando a automação não os cobre.
12. Atualize `README.md` quando mudar arquitetura, autenticação, armazenamento, deploy ou fluxo principal. Atualize `ROADMAP.md` quando mudar uma prioridade ou decisão estratégica. Pequenos ajustes visuais não exigem atualização documental.
13. Não altere ou remova os conjuntos em `hinos/` nem a lista de aprovados em `config/` salvo quando a tarefa pedir explicitamente dados da biblioteca.
14. Preserve a diferença entre leitura pública da biblioteca, publicação por usuários aprovados e administração exclusiva do administrador.
