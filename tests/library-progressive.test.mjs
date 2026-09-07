import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public library uses progressive disclosure and admin-only curation controls", async () => {
  const source = await readFile(new URL("../src/CloudLibrary.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/libraryProgressive.css", import.meta.url), "utf8");

  assert.match(source, /type LibraryView = "home" \| "curated" \| "sets"/);
  assert.match(source, />Biblioteca curada</);
  assert.match(source, /setsEntryLabel/);
  assert.match(source, /view === "home"/);
  assert.match(source, /view === "curated" && <CuratedLibrary/);
  assert.match(source, /view === "sets"/);
  assert.match(source, /Também adicionar à Biblioteca curada/);
  assert.match(source, /session\.isAdmin && curatedCategories\.length > 0/);
  assert.match(source, /\/api\/curated/);
  assert.match(source, /O conjunto foi salvo no GitHub, mas a curadoria não foi alterada/);
  assert.match(styles, /\.library-entry-grid/);
  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /\.library-entry-grid \{ grid-template-columns:1fr;/);
});
