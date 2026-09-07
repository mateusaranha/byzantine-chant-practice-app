# Catálogo curado

`curated.json` contém somente metadados editoriais. O conteúdo dos hinos continua exclusivamente em `hinos/<autor>/<conjunto>.json`; a Biblioteca curada guarda referências para essas publicações, sem copiar letra, marcações ou links de gravação.

## Estrutura

A navegação pública usa dois níveis:

**Categoria → Subcategoria**

Exemplo:

**Grandes Festas → Natividade de Cristo**

A subcategoria aponta diretamente para um conjunto publicado completo. Ao abrir **Natividade de Cristo**, o Psaltikon carrega todos os hinos daquele conjunto na área temporária de estudo; não existe uma etapa intermediária de escolher hinos individuais na Biblioteca curada.

Categorias e subcategorias aparecem em ordem alfabética automática.

O catálogo usa `version: 3`:

```json
{
  "version": 3,
  "categories": [
    { "id": "grandes-festas", "label": "Grandes Festas" }
  ],
  "subcategories": [
    {
      "id": "grandes-festas-natividade",
      "label": "Natividade de Cristo",
      "categoryId": "grandes-festas",
      "source": {
        "path": "hinos/autor/natividade.json"
      }
    }
  ]
}
```

Uma subcategoria sem `source` pode existir enquanto está sendo preparada, mas fica oculta da navegação pública até receber um conjunto.

## Salvamento pela interface

Para o administrador/curador, a área de publicação oferece três destinos:

- **Meus conjuntos** — publica normalmente e deixa o conjunto visível na listagem pública;
- **Biblioteca curada** — publica o conteúdo-base em `hinos/`, associa o conjunto inteiro à subcategoria escolhida e depois o marca como `listed: false`, para que não apareça também em Meus conjuntos/Conjuntos publicados;
- **Ambos** — usa o mesmo conteúdo-base, mantendo-o listado e também referenciado pela curadoria.

“Biblioteca curada” não cria uma segunda cópia. `listed: false` muda apenas a presença do conjunto na listagem geral; a subcategoria continua apontando para o mesmo arquivo publicado.

O fluxo de **somente curada** é conservador: primeiro o conteúdo-base é salvo de forma recuperável, depois a associação curada é realizada e somente após o sucesso ele é ocultado da listagem. Se a associação falhar ou for cancelada, o conteúdo permanece em **Meus conjuntos**, em vez de ser perdido ou ficar inacessível.

Um conjunto já publicado também pode ser carregado e associado posteriormente a uma subcategoria.

## Uma subcategoria, um conjunto

Cada subcategoria possui no máximo um conjunto associado. Isso mantém o modelo editorial simples:

**Grandes Festas → Natividade de Cristo → conjunto completo da Natividade**

Se o curador tentar associar outro conjunto a uma subcategoria que já possui `source`, a interface pede confirmação. O Worker também exige confirmação explícita (`replace: true`) antes de substituir a referência existente.

Atualizar o arquivo publicado preservando o mesmo `path` atualiza automaticamente o material apresentado pela subcategoria, pois a curadoria referencia a publicação mais recente em vez de criar um snapshot.

## Criar categorias e subcategorias

O administrador não precisa editar o JSON para a operação comum. No próprio fluxo de curadoria existem:

- **+ Nova categoria**;
- **+ Nova subcategoria**.

A subcategoria sempre pertence a uma categoria. Essas operações e a associação de conjuntos são restritas ao administrador já definido pelo Psaltikon; ser um publicador aprovado, sozinho, não concede permissão de curadoria.

A interface continua deliberadamente pequena: não há sistema de roles adicional, painel CMS, banco de dados, árvore profunda ou formulário editorial complexo.

## Edição manual

O catálogo continua versionado no repositório e pode ser editado manualmente quando necessário.

Os IDs usam letras minúsculas sem acentos, números e hífens. Categorias e subcategorias precisam de IDs válidos e únicos. Quando presente, `source.path` deve apontar para um conjunto publicado válido em `hinos/<autor>/<conjunto>.json`.

Depois de edição manual, rode:

```bash
npm run validate:curated
```

O build e os checks do Pages também validam a estrutura e as fontes referenciadas antes do deploy.

## Identidade e manutenção

- A referência acompanha a publicação mais recente do arquivo-base; não é um snapshot imutável.
- Preserve o caminho do conjunto ao atualizar material curado sempre que possível.
- Retirar material da curadoria significa remover o `source` da subcategoria ou remover a própria subcategoria, sem apagar o conteúdo-base.
- O catálogo rejeita estrutura inválida, IDs duplicados, subcategorias sem categoria e caminhos de conjunto inválidos ou inexistentes.
- Categorias sem subcategorias associadas e subcategorias sem conjunto ficam ocultas da navegação pública.
- O Worker ainda pode permitir que o conteúdo-base seja alterado ou excluído conforme as regras dos conjuntos; a validação do catálogo protege os deploys seguintes, não transforma a publicação em snapshot.

## Experiência

A Biblioteca pública preserva progressive disclosure:

**Biblioteca pública → Biblioteca curada → Categoria → Subcategoria → conjunto completo de estudo**

ou

**Biblioteca pública → Meus conjuntos / Conjuntos publicados**

A tela inicial não expande simultaneamente catálogo, conjuntos, publicação e administração. Busca, filtros e gestão editorial mais sofisticada permanecem fora deste fluxo mínimo até que o conteúdo real justifique essa complexidade.
