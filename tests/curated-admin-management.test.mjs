import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { curated } from "../scripts/catalog-modules.mjs";

const path = "hinos/mateusaranha/teste.json";

function fixture() {
  return {
    version: 3,
    categories: [
      { id: "filled", label: "Com conteúdo" },
      { id: "empty", label: "Vazia" },
    ],
    subcategories: [
      { id: "filled-set", label: "Associada", categoryId: "filled", source: { path } },
      { id: "filled-empty", label: "Sem conjunto", categoryId: "filled" },
    ],
  };
}

test("public groups hide empty editorial structure while admin groups retain it", () => {
  const { catalog, errors } = curated.readCuratedCatalog(fixture());
  assert.deepEqual(errors, []);

  const publicGroups = curated.curatedGroups(catalog);
  assert.deepEqual(publicGroups.map(group => group.id), ["filled"]);
  assert.deepEqual(publicGroups[0].subcategories.map(subcategory => subcategory.id), ["filled-set"]);

  const adminGroups = curated.curatedGroups(catalog, { includeEmpty: true });
  assert.deepEqual(adminGroups.map(group => group.id), ["filled", "empty"]);
  assert.deepEqual(adminGroups[0].subcategories.map(subcategory => subcategory.id), ["filled-set", "filled-empty"]);
  assert.deepEqual(adminGroups[1].subcategories, []);
});

test("curated UI exposes destructive actions only through admin state and preserves published sets", async () => {
  const source = await readFile(new URL("../src/CuratedLibrary.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/libraryProgressive.css", import.meta.url), "utf8");

  assert.match(source, /curatedGroups\(catalog, \{ includeEmpty: canEdit \}\)/);
  assert.match(source, /Somente o curador pode alterar a Biblioteca curada/);
  assert.match(source, /Remover da Biblioteca curada/);
  assert.match(source, /Excluir subcategoria/);
  assert.match(source, /Excluir categoria/);
  assert.match(source, /Sem conjunto associado/);
  assert.match(source, /O conjunto publicado e todos os seus hinos serão preservados/);
  assert.match(source, /Nenhum conjunto ou hino será apagado/);
  assert.match(source, /\/api\/curated\?subcategoryId=/);
  assert.match(source, /\/api\/curated\/subcategories\?id=/);
  assert.match(source, /\/api\/curated\/categories\?id=/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /canEdit && categoryActions\(group\)/);
  assert.match(source, /canEdit && subcategoryActions\(subcategory\)/);
  assert.match(styles, /\.curated-action-menu/);
  assert.match(styles, /\.curated-empty-subcategory/);
  assert.match(styles, /\.curated-admin-note/);
});
