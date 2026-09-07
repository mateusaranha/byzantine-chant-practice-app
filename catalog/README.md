# Catálogo curado (MVP da #43)

`curated.json` contém somente metadados editoriais. O conteúdo dos hinos continua exclusivamente em `hinos/<autor>/<conjunto>.json`; o catálogo guarda referências para essas publicações e é incorporado ao build da interface. Alterações no catálogo são validadas antes do deploy do Pages.

## Acrescentar conteúdo

O fluxo preferencial para o administrador é pela própria Biblioteca pública:

1. prepare e publique o conjunto pelo fluxo normal do Psaltikon;
2. marque **Também adicionar à Biblioteca curada** e escolha uma categoria existente; em conjuntos com vários hinos, escolha também qual hino será promovido;
3. o conjunto é salvo normalmente em `hinos/`;
4. o Worker, em uma operação separada e restrita ao administrador, valida o conjunto, o `hymnId` e a categoria e acrescenta somente a referência ao catálogo;
5. se a promoção falhar, o conjunto já salvo não é desfeito;
6. um conjunto já publicado também pode ser carregado e promovido posteriormente pela mesma área, sem duplicar conteúdo.

A interface deliberadamente não cria categorias novas nem funciona como CMS completo. Categorias e metadados editoriais mais específicos continuam podendo ser mantidos manualmente no JSON.

### Edição manual

Se necessário, acrescente uma categoria em `categories`, com `id` estável, `label` e `order` numérico, e uma entrada em `entries`:

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

Depois rode `npm run validate:curated`. O build e os checks do Pages também executam a validação, inclusive quando uma publicação altera um conjunto referenciado.

Os IDs editoriais usam letras minúsculas sem acentos, números e hífens. Cada categoria e entrada precisa de ID único. `categoryIds` aceita várias categorias; não repita a entrada nem sua referência `path + hymnId`. Se a interface promover para uma segunda categoria uma referência que já existe, ela acrescenta a categoria à entrada existente em vez de criar outra cópia.

Uma nova gravação com marcações próprias deve ser publicada como outro hino, com outro ID, e ganhar sua própria entrada. `order` crescente define a ordem de categorias e itens; empates seguem a posição no JSON. O nome do arquivo não determina a ordem. Categorias vazias ficam ocultas. `{ "version": 1, "categories": [], "entries": [] }` é um estado válido.

O título é deliberadamente editorial e pode diferir do título de preparação do autor. Não copie letra, marcações, modo ou links de vídeo para o catálogo. `note` é texto simples opcional, mostrado em **Sobre esta versão**. A promoção simples pela interface usa inicialmente o título do hino publicado; ajustes editoriais mais finos podem ser feitos depois no catálogo.

## Identidade e manutenção

- A referência acompanha **a publicação mais recente**, como os links já existentes; não é um snapshot revisado e imutável. Mudanças no conteúdo-base aparecem no estudo sem republicar os metadados.
- Preserve caminho e ID ao atualizar hinos curados. Se precisarem mudar, atualize as referências no mesmo trabalho. IDs só precisam ser únicos dentro do conjunto; `primary-hymn` pode existir em conjuntos diferentes.
- Promover um hino já publicado significa acrescentar sua referência. Retirar da curadoria significa remover a entrada ou associação de categoria, sem excluir o conjunto.
- Somente o administrador definido na configuração atual pode usar o endpoint de promoção. A permissão de publicar conjuntos, sozinha, não concede curadoria.
- O build rejeita catálogo malformado, campos inválidos, IDs duplicados, categorias inexistentes, referências repetidas e conjuntos/hinos inexistentes, ambíguos ou incompatíveis com o leitor público.
- O Worker continua permitindo alterações/exclusões nos conjuntos dos autores. A validação protege o próximo deploy, **não impede uma exclusão já publicada pelo Worker**. Nesse intervalo, o leitor existente informa indisponibilidade e preserva o trabalho local.
- Um item inválido em runtime não derruba a biblioteca: erros de metadados geram aviso e os demais itens válidos continuam disponíveis; falhas da fonte aparecem no fluxo de estudo/compartilhamento. O CI nunca aceita silenciosamente os erros.

## Experiência

A entrada da Biblioteca pública usa **progressive disclosure**:

**Biblioteca pública → Biblioteca curada → categoria → versão → Estudar agora**

ou

**Biblioteca pública → Meus conjuntos / Conjuntos publicados**

A tela inicial não expande simultaneamente catálogo, conjuntos, publicação e administração. No estudo temporário, **Adicionar ao meu espaço** cria uma cópia independente com as proteções existentes. **Compartilhar** reutiliza o diálogo atual.

Busca, filtros, agrupamento mais rico de variantes e gestão editorial completa continuam fora deste fluxo mínimo e devem ser adicionados apenas quando o conteúdo real justificar.
