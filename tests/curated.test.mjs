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
  assert.match(source, /method: "PATCH"/);
  assert.doesNotMatch(source, /subcategory\.entries|curated-entry/);
});

test("inline categories toggle exclusively and preserve whole-set destinations", async () => {
  const { default: ts } = await import("typescript");
  const dataUrl = js => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  // Exercise the component's event handlers without adding a DOM dependency.
  const hooksUrl = dataUrl(`
    let values = [];
    let cursor = 0;
    export const resetHooks = () => { cursor = 0; };
    export const resetState = () => { values = []; cursor = 0; };
    export const useEffect = () => {};
    export const useId = () => 'curated-test';
    export const useState = initial => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], update => {
        values[index] = typeof update === 'function' ? update(values[index]) : update;
      }];
    };
  `);
  const hooks = await import(hooksUrl);
  const source = await readFile(new URL("../src/CuratedLibrary.tsx", import.meta.url), "utf8");
  let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [dependency, url] of Object.entries({
    react: hooksUrl,
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "../catalog/curated.json": dataUrl(`export default ${JSON.stringify(fixture())}`),
    "./curatedCatalog": curatedModuleUrl,
    "./sharedHymns": import.meta.resolve("../scripts/catalog-modules.mjs"),
  })) {
    // The catalog loader exports shared helpers together, so expose the actual URL builder.
    const resolved = dependency === "./sharedHymns"
      ? dataUrl(`import { shared } from ${JSON.stringify(url)}; export const createShareUrl = shared.createShareUrl;`)
      : url;
    js = js.replaceAll(JSON.stringify(dependency), JSON.stringify(resolved));
  }
  const { default: Component } = await import(dataUrl(js));
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: "https://example.org/psaltikon/" } };
  try {
    const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
      : value && typeof value === "object" && value.props ? [value, ...nodes(value.props.children)] : [];
    const render = catalogOverride => {
      hooks.resetHooks();
      return nodes(Component({ apiBase: "", catalogOverride }));
    };
    const buttons = tree => tree.filter(node => node.type === "button");
    const links = tree => tree.filter(node => node.type === "a");
    let tree = render();
    assert.equal(buttons(tree).length, 2); // Empty category is not public.
    assert.ok(buttons(tree).every(node => node.props["aria-expanded"] === false));
    assert.equal(links(tree).length, 0);
    buttons(tree)[0].props.onClick();
    tree = render();
    assert.deepEqual(buttons(tree).map(node => node.props["aria-expanded"]), [true, false]);
    const trigger = buttons(tree)[0];
    const panel = tree.find(node => node.props.id === trigger.props["aria-controls"]);
    assert.equal(panel.props.hidden, false);
    assert.equal(panel.props["aria-labelledby"], trigger.props.id);
    assert.equal(links(tree).length, 2);
    for (const link of links(tree)) {
      assert.deepEqual(shared.parseShareRequest(new URL(link.props.href).search), { path, hymnId: null });
    }
    buttons(tree)[1].props.onClick();
    tree = render();
    assert.deepEqual(buttons(tree).map(node => node.props["aria-expanded"]), [false, true]);
    assert.equal(links(tree).length, 1);
    buttons(tree)[1].props.onClick();
    tree = render();
    assert.ok(buttons(tree).every(node => !node.props["aria-expanded"]));
    assert.equal(links(tree).length, 0);
    hooks.resetState();
    assert.equal(buttons(render({ version: 3, categories: [], subcategories: [] })).length, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
