import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { curated, shared, curatedModuleUrl } from "../scripts/catalog-modules.mjs";
const { readCuratedCatalog, curatedGroups, validateCuratedSources } = curated;
const path = "hinos/mateusaranha/teste.json";
const fixture = () => ({
  version: 2,
  categories: [
    { id: "second", label: "Zeta" },
    { id: "first", label: "Alfa" },
    { id: "empty", label: "Vazia" },
  ],
  subcategories: [
    { id: "first-b", label: "Beta", categoryId: "first" },
    { id: "first-a", label: "Alfa", categoryId: "first" },
    { id: "second-a", label: "Única", categoryId: "second" },
    { id: "empty-a", label: "Sem hinos", categoryId: "empty" },
  ],
  entries: [
    { id: "later", title: "Depois", subcategoryId: "first-a", order: 20, source: { path, hymnId: "stable" } },
    { id: "first", title: "Primeiro", subcategoryId: "first-a", order: 10, source: { path, hymnId: "other" } },
    { id: "beta", title: "Beta", subcategoryId: "first-b", order: 10, source: { path, hymnId: "third" } },
    { id: "zeta", title: "Zeta", subcategoryId: "second-a", order: 10, source: { path, hymnId: "fourth" } },
  ],
});
const published = () => shared.readPublishedSet({ title: "Teste", hymns: [
  { id: "stable", title: "Hino", lyrics: "Κύριε", highlights: [{ start: 0, end: 5, color: "sage" }] },
  { id: "other", title: "Outro", lyrics: "Θεοτόκε" },
  { id: "third", title: "Terceiro", lyrics: "Ἅγιος" },
  { id: "fourth", title: "Quarto", lyrics: "Δόξα" },
] });

test("catalog uses alphabetical categories/subcategories and editorial hymn order", () => {
  const source = fixture();
  const snapshot = structuredClone(source);
  const { catalog, errors } = readCuratedCatalog(source);
  assert.deepEqual(errors, []);
  assert.deepEqual(source, snapshot);
  const groups = curatedGroups(catalog);
  assert.deepEqual(groups.map(group => group.id), ["first", "second"]);
  assert.deepEqual(groups[0].subcategories.map(group => group.id), ["first-a", "first-b"]);
  assert.deepEqual(groups[0].subcategories[0].entries.map(entry => entry.id), ["first", "later"]);
  assert.equal(groups.some(group => group.id === "empty"), false);
});

test("empty catalog is valid and malformed catalogs fail safely", () => {
  assert.deepEqual(readCuratedCatalog({ version: 2, categories: [], subcategories: [], entries: [] }).errors, []);
  for (const invalid of [null, [], {}, { ...fixture(), version: 1 }, { ...fixture(), subcategories: {} }, { ...fixture(), entries: {} }]) {
    const result = readCuratedCatalog(invalid);
    assert.ok(result.errors.length);
    assert.deepEqual(curatedGroups(result.catalog), []);
  }
});

test("invalid hierarchy and duplicate source references are reported", () => {
  for (const change of [
    source => { source.subcategories[0].categoryId = "missing"; },
    source => { source.subcategories.push({ ...source.subcategories[0] }); },
    source => { source.entries[0].subcategoryId = "missing"; },
    source => { source.entries[1].source = source.entries[0].source; },
    source => { source.categories.push({ ...source.categories[0] }); },
  ]) {
    const source = fixture();
    change(source);
    assert.ok(readCuratedCatalog(source).errors.length);
  }
});

test("source validation reuses the public reader and loads each set once", async () => {
  const { catalog } = readCuratedCatalog(fixture());
  let loads = 0;
  assert.deepEqual(await validateCuratedSources(catalog, async source => {
    assert.equal(source, path);
    loads++;
    return published();
  }), []);
  assert.equal(loads, 1);
  const url = shared.createShareUrl("https://example.org/psaltikon/", catalog.entries[1].source);
  const route = shared.parseShareRequest(new URL(url).search);
  assert.equal(shared.selectSharedHymns(published(), route.hymnId).length, 1);
});

test("broken curated sources fail before deploy", async () => {
  const { catalog } = readCuratedCatalog(fixture());
  assert.equal((await validateCuratedSources(catalog, async () => { throw new Error("missing file"); })).length, 4);
});

test("real catalog references existing publications and never copies hymn content", async () => {
  const raw = JSON.parse(await readFile(new URL("../catalog/curated.json", import.meta.url), "utf8"));
  const { catalog, errors } = readCuratedCatalog(raw);
  assert.deepEqual(errors, []);
  assert.deepEqual(await validateCuratedSources(catalog, async source => shared.readPublishedSet(
    JSON.parse(await readFile(new URL(`../${source}`, import.meta.url), "utf8")))), []);
  for (const entry of raw.entries) {
    assert.equal("lyrics" in entry, false);
    assert.equal("highlights" in entry, false);
  }
});

test("curated UI renders hierarchy without the old versions terminology", async () => {
  const { default: ts } = await import("typescript");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const source = await readFile(new URL("../src/CuratedLibrary.tsx", import.meta.url), "utf8");
  const dataUrl = js => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dependencies = {
    react: import.meta.resolve("react"),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "../catalog/curated.json": dataUrl(`export default ${JSON.stringify(fixture())}`),
    "./curatedCatalog": curatedModuleUrl,
    "./sharedHymns": dataUrl("export const createShareUrl = () => '';"),
    "./ShareDialog": dataUrl("export default () => null;"),
  };
  for (const [dependency, url] of Object.entries(dependencies)) js = js.replaceAll(JSON.stringify(dependency), JSON.stringify(url));
  const { default: Component } = await import(dataUrl(js));
  const html = renderToStaticMarkup(createElement(Component, { apiBase: "https://publisher.example" }));
  assert.match(html, /Biblioteca curada/);
  assert.match(html, /2 subcategorias/);
  assert.doesNotMatch(html, /versão|versões/);
});
