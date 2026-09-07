# Catálogo curado (MVP da #43)

`curated.json` contém somente metadados editoriais. O Vite incorpora esse JSON ao build da interface; alterações aparecem após o deploy do Pages, sem endpoint, banco de dados ou requisição adicional. O conteúdo dos hinos continua exclusivamente em `hinos/<autor>/<conjunto>.json`, lido pelo Worker ao estudar ou compartilhar.

## Acrescentar conteúdo

1. Prepare e publique o conjunto pelo fluxo normal do Psaltikon.
2. No JSON publicado, copie o caminho e o `id` do hino desejado. Use o ID publicado, nunca sua posição na lista ou o ID de uma cópia local.
3. Se necessário, acrescente uma categoria em `categories`, com `id` estável, `label` e `order` numérico.
4. Acrescente uma entrada em `entries`:

```json
{
  "id": "identificador-editorial-estavel",
  "title": "Título para exibição no catálogo",
  "categoryIds": ["categoria-existente"],
  "order": 10,
  "source": {
    "path": "hinos/autor/conjunto.json",
    "hymnId": "id-exato-do-hino-publicado"
  },
  "note": "Nota opcional sobre a versão, sua origem ou revisão."
}
```

5. Rode `npm run validate:curated` e abra uma PR. O build e os checks do Pages também executam a validação, inclusive quando uma publicação altera o conjunto referenciado.

Os IDs editoriais usam letras minúsculas sem acentos, números e hífens. Cada categoria e entrada precisa de ID único. `categoryIds` aceita várias categorias; não repita a entrada nem sua referência `path + hymnId`. Uma nova gravação com marcações próprias deve ser publicada como outro hino, com outro ID, e ganhar sua própria entrada.

`order` crescente define a ordem de categorias e itens; empates seguem a posição no JSON. O nome do arquivo não determina a ordem. Categorias vazias ficam ocultas. `{ "version": 1, "categories": [], "entries": [] }` é um estado válido.

O título é deliberadamente editorial: permite uma identificação legível sem carregar todos os conjuntos só para listar cartões, e pode diferir do título de preparação do autor. Não copie letra, marcações, modo ou links de vídeo para o catálogo. `note` é texto simples opcional, mostrado em “Sobre esta versão”. A amostra inicial contém duas referências reais; não pretende definir a taxonomia futura nem conferir caráter oficial ao material.

## Identidade e manutenção

- A referência acompanha **a publicação mais recente**, como os links já existentes; não é um snapshot revisado e imutável. Mudanças no conteúdo-base aparecem no estudo sem republicar os metadados.
- Preserve caminho e ID ao atualizar hinos curados. Se precisarem mudar, atualize as referências no mesmo trabalho. IDs só precisam ser únicos dentro do conjunto; `primary-hymn` pode existir em conjuntos diferentes.
- Promover um hino já publicado significa acrescentar sua referência. Retirar da curadoria significa remover a entrada, sem excluir o conjunto. Renomear categorias ou mudar suas associações não altera links compartilhados.
- O build rejeita catálogo malformado, campos inválidos, IDs duplicados, categorias inexistentes, referências repetidas e conjuntos/hinos inexistentes, ambíguos ou incompatíveis com o leitor público.
- O Worker continua permitindo alterações/exclusões nos conjuntos dos autores. A validação protege o próximo deploy, **não impede uma exclusão já publicada pelo Worker**. Nesse intervalo, o leitor existente informa indisponibilidade e preserva o trabalho local. Corrija/remova a referência e publique novamente. Não se adicionou bloqueio transversal ao publicador neste MVP.
- Um item inválido em runtime não derruba a biblioteca: erros de metadados geram aviso e os demais itens válidos continuam disponíveis; falhas da fonte aparecem no fluxo de estudo/compartilhamento. O CI nunca aceita silenciosamente os erros.

## Experiência e próximos passos

Biblioteca curada → categoria → versão → **Estudar agora** usa o link público existente. No estudo temporário, **Adicionar ao meu espaço** cria uma cópia independente com as proteções existentes. **Compartilhar** abre o diálogo existente já selecionando o hino. Conjuntos dos autores, login e publicação continuam disponíveis; o próprio autor vê **Meus conjuntos**.

A #43 permanece como umbrella. Busca/filtros, agrupamento de variantes e coleções mais elaboradas pertencem à fase 2; promoção por interface e gestão editorial à fase 3. Não há painel administrativo ou mudança de permissões nesta implementação.
