import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadModule() {
  const { default: ts } = await import("typescript");
  const source = await readFile(new URL("../src/libraryUpdateTarget.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

const items = [
  { owner: "mateusaranha", slug: "grande-entrada", path: "hinos/mateusaranha/grande-entrada.json", title: "Grande Entrada" },
  { owner: "mateusaranha", slug: "nome-antigo", path: "hinos/mateusaranha/nome-antigo.json", title: "Nome Atual" },
  { owner: "outro", slug: "grande-entrada", path: "hinos/outro/grande-entrada.json", title: "Grande Entrada" },
];

test("finds an existing own publication by slug after page reload", async () => {
  const { findOwnPublicationByName } = await loadModule();
  assert.equal(
    findOwnPublicationByName(items, "mateusaranha", "Grande Entrada", "grande-entrada")?.path,
    "hinos/mateusaranha/grande-entrada.json",
  );
});

test("finds a uniquely renamed own publication by its current title", async () => {
  const { findOwnPublicationByName } = await loadModule();
  assert.equal(
    findOwnPublicationByName(items, "mateusaranha", "nome atual", "nome-atual")?.slug,
    "nome-antigo",
  );
});

test("never adopts another author's set and refuses ambiguous title-only matches", async () => {
  const { findOwnPublicationByName } = await loadModule();
  assert.equal(findOwnPublicationByName(items, "desconhecido", "Grande Entrada", "grande-entrada"), null);

  const ambiguous = [
    ...items,
    { owner: "mateusaranha", slug: "outro-slug", path: "hinos/mateusaranha/outro-slug.json", title: "Nome Atual" },
  ];
  assert.equal(findOwnPublicationByName(ambiguous, "mateusaranha", "Nome Atual", "nome-atual"), null);
});

test("CloudLibrary confirms recovered updates and keeps save-as-new protected", async () => {
  const source = await readFile(new URL("../src/CloudLibrary.tsx", import.meta.url), "utf8");
  assert.match(source, /findOwnPublicationByName/);
  assert.match(source, /Já existe um conjunto seu chamado/);
  assert.match(source, /Atualizar esse conjunto com o conteúdo atual\?/);
  assert.match(source, /mode === "new" \|\| !updateTarget/);
  assert.match(source, /publishBase\(name, slug, true, createsNewSet\)/);
});
