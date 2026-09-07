import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public library keeps progressive disclosure and exposes simple admin curation", async () => {
  const source = await readFile(new URL("../src/CloudLibrary.tsx", import.meta.url), "utf8");
  const curated = await readFile(new URL("../src/CuratedLibrary.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/libraryProgressive.css", import.meta.url), "utf8");

  assert.match(source, /type LibraryView = "home" \| "curated" \| "sets"/);
  assert.match(source, /type SaveDestination = "sets" \| "curated" \| "both"/);
  assert.match(source, />Biblioteca curada</);
  assert.match(source, /view === "home"/);
  assert.match(source, /view === "curated" && <CuratedLibrary/);
  assert.match(source, /\["sets", "Meus conjuntos"\]/);
  assert.match(source, /\["curated", "Biblioteca curada"\]/);
  assert.match(source, /\["both", "Ambos"\]/);
  assert.match(source, /\+ Nova categoria/);
  assert.match(source, /\+ Nova subcategoria/);
  assert.match(source, /subcategoryId: curatedSubcategoryId/);
  assert.match(source, /publishBase\(name, slug, false\)/);
  assert.match(source, /conteúdo foi preservado em Meus conjuntos/);
  assert.match(curated, /subcategorias/);
  assert.match(curated, /hino" : "hinos/);
  assert.doesNotMatch(curated, /versão|versões/);
  assert.match(styles, /\.library-entry-grid/);
  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.save-destination/);
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /\.curation-field-row,.curation-create-row \{ grid-template-columns:1fr;/);
});
