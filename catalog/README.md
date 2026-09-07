# Catálogo curado

`curated.json` contém somente metadados editoriais. O conteúdo dos hinos continua exclusivamente em `hinos/<autor>/<conjunto>.json`; a Biblioteca curada guarda referências para essas publicações, sem copiar letra, marcações ou links de gravação.

## Estrutura

A navegação usa três níveis simples:

**Categoria → Subcategoria → Hinos**

Exemplo:

**Grandes Festas → Dormição da Theotokos → Apolytikion / Megalynarion / outras gravações preparadas**

Categorias e subcategorias aparecem em ordem alfabética automática. Os hinos dentro de uma subcategoria conservam `order` editorial, permitindo uma sequência que não precise ser alfabética.

O catálogo usa `version: 2`:

```json
{
  "version": 2,
  "categories": [
    { "id": "grandes-festas", "label": "Grandes Festas" }
  ],
  "subcategories": [
    {
      "id": "grandes-festas-dormicao",
      "label": "Dormição da Theotokos",
      "categoryId": "grandes-festas"
    }
  ],
  "entries": [
    {
      "id": "dormicao-apolytikion",
      "title": "Apolytikion da Dormição",
      "subcategoryId": "grandes-festas-dormicao",
      "order": 10,
      "source": {
        "path": "hinos/autor/dormicao.json",
        "hymnId": "id-exato-do-hino-publicado"
      }
    }
  ]
}
```

Uma gravação ou preparação diferente, com marcações próprias, continua sendo outro hino publicado e pode ganhar sua própria entrada. Não existe uma camada estrutural chamada “versão”.

## Salvamento pela interface

Para o administrador/curador, a área de publicação oferece três destinos:

- **Meus conjuntos** — publica normalmente e deixa o conjunto visível na listagem pública;
- **Biblioteca curada** — publica o conteúdo-base em `hinos/`, cria a referência curada e depois o marca como `listed: false`, para que não apareça também em Meus conjuntos/Conjuntos publicados;
- **Ambos** — usa o mesmo conteúdo-base, mantendo-o listado e também referenciado pela curadoria.

“Biblioteca curada” não cria uma segunda cópia do hino. `listed: false` muda apenas sua presença na listagem de conjuntos; os links e a referência curada continuam apontando para o mesmo arquivo publicado.

O fluxo de **somente curada** é conservador: primeiro o conteúdo-base é salvo de forma recuperável, depois a promoção é realizada e somente após o sucesso ele é ocultado da listagem. Se a promoção falhar, o conteúdo permanece em **Meus conjuntos**, em vez de ser perdido ou ficar inacessível.

Um conjunto já publicado também pode ser carregado e ter um de seus hinos promovido posteriormente.

## Criar categorias e subcategorias

O administrador não precisa editar o JSON para a operação comum. No próprio fluxo de curadoria existem:

- **+ Nova categoria**;
- **+ Nova subcategoria**.

A subcategoria sempre pertence a uma categoria. Essas operações e a promoção de hinos são restritas ao administrador já definido pelo Psaltikon; ser um publicador aprovado, sozinho, não concede permissão de curadoria.

A interface continua deliberadamente pequena: não há sistema de roles adicional, painel CMS, banco de dados, árvore profunda ou formulário editorial complexo.

## Edição manual

O catálogo continua versionado no repositório e pode ser editado manualmente quando necessário, por exemplo para ajustar `order`, título editorial ou `note`.

Os IDs usam letras minúsculas sem acentos, números e hífens. Categorias, subcategorias e entradas precisam de IDs válidos e únicos. Cada entrada referencia uma única subcategoria e um único `path + hymnId`; referências repetidas são rejeitadas.

Depois de edição manual, rode:

```bash
npm run validate:curated
```

O build e os checks do Pages também validam a estrutura e as fontes referenciadas antes do deploy.

## Identidade e manutenção

- A referência acompanha a publicação mais recente do arquivo-base; não é um snapshot imutável.
- Preserve caminho e `hymnId` ao atualizar material curado sempre que possível.
- Retirar um hino da curadoria significa remover sua entrada, sem apagar o conteúdo-base.
- O catálogo rejeita estrutura inválida, IDs duplicados, subcategorias sem categoria, hinos sem subcategoria, referências repetidas e fontes inexistentes ou ambíguas.
- Categorias ou subcategorias sem hinos ficam ocultas da navegação pública até receberem conteúdo.
- O Worker ainda pode permitir que o conteúdo-base seja alterado ou excluído conforme as regras dos conjuntos; a validação do catálogo protege os deploys seguintes, não transforma a publicação em snapshot.

## Experiência

A Biblioteca pública preserva progressive disclosure:

**Biblioteca pública → Biblioteca curada → Categoria → Subcategoria → Hino → Estudar agora**

ou

**Biblioteca pública → Meus conjuntos / Conjuntos publicados**

A tela inicial não expande simultaneamente catálogo, conjuntos, publicação e administração. Busca, filtros e gestão editorial mais sofisticada permanecem fora deste fluxo mínimo até que o conteúdo real justifique essa complexidade.
