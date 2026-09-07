import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { curated, shared, curatedModuleUrl } from "../scripts/catalog-modules.mjs";
const { readCuratedCatalog, curatedGroups, validateCuratedSources } = curated;
const path = "hinos/mateusaranha/teste.json";
const fixture = () => ({
  version: 3,
  categories: [
    { id: "second", label: "Zeta" },
    { id: "first", label: "Alfa" },
    { id: "empty", label: "Vazia" },
  ],
  subcategories: [
    { id: "first-b", label: "Beta", categoryId: "first", source: { path } },
    { id: "first-a", label: "Alfa", categoryId: "first", source: { path } },
    { id: "second-a", label: "Única", categoryId: "second", source: { path } },
    { id: "empty-a", label: "Sem conjunto", categoryId: "empty" },
  ],
});
const published = () => shared.readPublishedSet({ title: "Teste", hymns: [
  { id: "stable", title: "Hino", lyrics: "Κύριε", highlights: [{ start: 0, end: 5, color: "sage" }] },
  { id: "other", title: "Outro", lyrics: "Θεοτόκε" },
] });

test("catalog uses alphabetical categories and subcategories with one set source", () => {
  const source = fixture();
  const snapshot = structuredClone(source);
  const { catalog, errors } = readCuratedCatalog(source);
  assert.deepEqual(errors, []);
  assert.deepEqual(source, snapshot);
  const groups = curatedGroups(catalog);
  assert.deepEqual(groups.map(group => group.id), ["first", "second"]);
  assert.deepEqual(groups[0].subcategories.map(group => group.id), ["first-a", "first-b"]);
  assert.equal(groups.some(group => group.id === "empty"), false);
  assert.deepEqual(groups[0].subcategories[0].source, { path });
});

test("empty catalog is valid and malformed catalogs fail safely", () => {
  assert.deepEqual(readCuratedCatalog({ version: 3, categories: [], subcategories: [] }).errors, []);
  for (const invalid of [null, [], {}, { ...fixture(), version: 2 }, { ...fixture(), subcategories: {} }]) {
    const result = readCuratedCatalog(invalid);
    assert.ok(result.errors.length);
    assert.deepEqual(curatedGroups(result.catalog), []);
  }
});

test("invalid hierarchy, duplicate ids and broken set paths are reported", () => {
  for (const change of [
    source => { source.subcategories[0].categoryId = "missing"; },
    source => { source.subcategories.push({ ...source.subcategories[0] }); },
    source => { source.subcategories[0].source = { path: "../config.json" }; },
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
  const source = catalog.subcategories.find(subcategory => subcategory.source)?.source;
  const url = shared.createShareUrl("https://example.org/psaltikon/", { path: source.path, hymnId: null });
  const route = shared.parseShareRequest(new URL(url).search);
  assert.equal(shared.selectSharedHymns(published(), route.hymnId).length, 2);
});

test("broken curated set sources fail before deploy", async () => {
  const { catalog } = readCuratedCatalog(fixture());
  assert.equal((await validateCuratedSources(catalog, async () => { throw new Error("missing file"); })).length, 3);
});

test("real catalog references existing publications and never copies hymn content", async () => {
  const raw = JSON.parse(await readFile(new URL("../catalog/curated.json", import.meta.url), "utf8"));
  const { catalog, errors } = readCuratedCatalog(raw);
  assert.deepEqual(errors, []);
  assert.deepEqual(await validateCuratedSources(catalog, async source => shared.readPublishedSet(
    JSON.parse(await readFile(new URL(`../${source}`, import.meta.url), "utf8")))), []);
  for (const subcategory of raw.subcategories) {
    assert.equal("lyrics" in subcategory, false);
    assert.equal("highlights" in subcategory, false);
    if (subcategory.source) assert.deepEqual(Object.keys(subcategory.source), ["path"]);
  }
});

test("curated UI keeps the public hierarchy compact and opens whole sets", async () => {
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
  };
  for (const [dependency, url] of Object.entries(dependencies)) js = js.replaceAll(JSON.stringify(dependency), JSON.stringify(url));
  const { default: Component } = await import(dataUrl(js));
  const html = renderToStaticMarkup(createElement(Component, { apiBase: "https://publisher.example" }));
  assert.match(html, /Biblioteca curada/);
  assert.match(html, /Alfa/);
  assert.match(html, /Zeta/);
  assert.doesNotMatch(html, /Estudar agora|Compartilhar|versão|versões/);
  assert.match(source, /hymnId: null/);
  assert.match(source, /curated-set-link/);
  assert.doesNotMatch(source, /subcategory\.entries|curated-entry/);
});
