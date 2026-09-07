import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { curated, shared, curatedModuleUrl } from "../scripts/catalog-modules.mjs";
const { readCuratedCatalog, curatedGroups, validateCuratedSources } = curated;
const path = "hinos/mateusaranha/teste.json";
const fixture = () => ({ version: 1,
  categories: [{ id: "second", label: "Segunda", order: 20 }, { id: "first", label: "Primeira", order: 10 }, { id: "empty", label: "Vazia", order: 30 }],
  entries: [{ id: "entry", title: "Título editorial", categoryIds: ["first", "second"], order: 20, source: { path, hymnId: "stable" } },
    { id: "other", title: "Outro", categoryIds: ["first"], order: 10, source: { path, hymnId: "other" } }],
});
const published = () => shared.readPublishedSet({ title: "Teste", hymns: [
  { id: "stable", title: "Hino", lyrics: "Κύριε", highlights: [{ start: 0, end: 5, color: "sage" }] },
  { id: "other", title: "Outro", lyrics: "Θεοτόκε" },
] });

test("empty catalog is valid; editorial order, multiple categories and hidden empty categories", () => {
  assert.deepEqual(readCuratedCatalog({ version: 1, categories: [], entries: [] }).errors, []);
  const source = fixture();
  const snapshot = structuredClone(source);
  const { catalog, errors } = readCuratedCatalog(source);
  assert.deepEqual(errors, []);
  assert.deepEqual(source, snapshot);
  const groups = curatedGroups(catalog);
  assert.deepEqual(groups.map(c => c.id), ["first", "second"]);
  assert.deepEqual(groups[0].entries.map(e => e.id), ["other", "entry"]);
  assert.equal(groups[0].entries[1], groups[1].entries[0]);
});

test("malformed catalogs fail safely", () => {
  for (const invalid of [null, [], {}, { ...fixture(), version: 2 }, { ...fixture(), entries: {} }]) {
    const result = readCuratedCatalog(invalid);
    assert.ok(result.errors.length);
    assert.deepEqual(curatedGroups(result.catalog), []);
  }
});

test("invalid entries are reported without hiding unrelated valid content", () => {
  const changes = [e => { e.id = ""; }, e => { e.title = 1; }, e => { e.order = Infinity; },
    e => { e.categoryIds = []; }, e => { e.categoryIds = ["missing"]; }, e => { e.categoryIds = ["first", "first"]; },
    e => { e.note = false; }, e => { e.source = null; }, e => { e.source.path = "../secret.json"; },
    e => { e.source.hymnId = " "; }, e => { e.source.hymnId = "x".repeat(201); }];
  for (const change of changes) {
    const source = fixture(); change(source.entries[0]);
    const { catalog, errors } = readCuratedCatalog(source);
    assert.ok(errors.length);
    assert.deepEqual(catalog.entries.map(e => e.id), ["other"]);
  }
});

test("duplicate identities and source references fail validation", () => {
  for (const change of [s => { s.entries[1].id = s.entries[0].id; },
    s => { s.entries[1].source = s.entries[0].source; },
    s => { s.categories.push({ ...s.categories[0] }); },
    s => { s.categories[0].label = null; }, s => { s.categories[0].order = "10"; }]) {
    const source = fixture(); change(source);
    assert.ok(readCuratedCatalog(source).errors.length);
  }
});

test("source validation reuses the public reader and loads each set once", async () => {
  const { catalog } = readCuratedCatalog(fixture());
  let loads = 0;
  assert.deepEqual(await validateCuratedSources(catalog, async source => { assert.equal(source, path); loads++; return published(); }), []);
  assert.equal(loads, 1);
  const url = shared.createShareUrl("https://example.org/psaltikon/", catalog.entries[1].source);
  const route = shared.parseShareRequest(new URL(url).search);
  assert.deepEqual(shared.selectSharedHymns(published(), route.hymnId)[0].highlights, [{ start: 0, end: 5, color: "sage" }]);
});

test("deleted sets, removed/ambiguous hymn IDs and invalid source content fail before deploy", async () => {
  const { catalog } = readCuratedCatalog(fixture());
  for (const loader of [async () => { throw new Error("missing file"); }, async () => shared.readPublishedSet({ title: "Teste", hymns: [{ id: "missing", lyrics: "a" }] }),
    async () => shared.readPublishedSet({ title: "Teste", hymns: [{ id: "stable", lyrics: "a" }, { id: "stable", lyrics: "b" }] }),
    async () => shared.readPublishedSet({ title: "Teste", hymns: [{ id: "stable", lyrics: 3 }] })]) {
    assert.equal((await validateCuratedSources(catalog, loader)).length, 2);
  }
});

test("real catalog references existing readable publications; no hymn content in catalog", async () => {
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

test("empty and partially invalid catalogs render useful UI without affecting the authors library", async () => {
  const { default: ts } = await import("typescript");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const source = await readFile(new URL("../src/CuratedLibrary.tsx", import.meta.url), "utf8");
  const dataUrl = js => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  for (const [raw, expected, absent] of [
    [{ version: 1, categories: [], entries: [] }, /A seleção de hinos está sendo preparada/, /Voltar às categorias/],
    [{ ...fixture(), entries: [null, fixture().entries[1]] }, /role="alert"/, /Segunda/],
  ]) {
    let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const dependencies = {
      react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
      "../catalog/curated.json": dataUrl(`export default ${JSON.stringify(raw)}`),
      "./curatedCatalog": curatedModuleUrl,
      "./sharedHymns": dataUrl("export const createShareUrl = () => '';"),
      "./ShareDialog": dataUrl("export default () => null;"),
    };
    for (const [path, url] of Object.entries(dependencies)) js = js.replaceAll(JSON.stringify(path), JSON.stringify(url));
    const { default: Component } = await import(dataUrl(js));
    const html = renderToStaticMarkup(createElement(Component, { apiBase: "https://publisher.example" }));
    assert.match(html, expected);
    assert.doesNotMatch(html, absent);
    assert.match(html, /Biblioteca curada/);
  }
});
