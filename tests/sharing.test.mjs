import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(name, dependencies = {}) {
  const source = await readFile(new URL(`../src/${name}.ts`, import.meta.url), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [path, url] of Object.entries(dependencies)) js = js.replaceAll(`"${path}"`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}

const hymnUrl = await moduleUrl("hymnState");
const { newHymn } = await import(hymnUrl);
const { parseShareRequest, createShareUrl, workspaceUrl, readPublishedSet, selectSharedHymns, loadPublishedSet, addSharedToWorkspace } =
  await import(await moduleUrl("sharedHymns", { "./hymnState": hymnUrl }));
const path = "hinos/mateusaranha/exemplo.json";
const fixture = () => ({
  title: "Conjunto de teste",
  hymns: [{ ...newHymn(), id: "primary-hymn", title: "Primeiro", lyrics: "Κύριε ἐλέησον", videoId: "abcdefghijk",
    videoInput: "https://youtu.be/abcdefghijk", targetSpeed: 0.85, repeatMode: "three",
    highlights: [{ start: 0, end: 5, color: "sage" }], melismas: [{ start: 6, end: 8, kind: "complex" }] },
  { ...newHymn(), id: "second", title: "Segundo", lyrics: "Θεοτόκε" }],
});

function memoryStorage(initial = null) {
  return {
    value: initial, writes: 0,
    getItem(key) { assert.equal(key, "psaltikon-practice"); return this.value; },
    setItem(key, value) { assert.equal(key, "psaltikon-practice"); this.value = value; this.writes++; },
  };
}

test("sharing URLs preserve the Pages subpath and exclude credentials and local data", () => {
  const url = new URL(createShareUrl("https://example.org/psaltikon/?other=private#psaltikon_token=secret", { path, hymnId: "ἦχος & 1" }));
  assert.equal(url.pathname, "/psaltikon/");
  assert.equal(url.hash, "");
  assert.deepEqual(parseShareRequest(url.search), { path, hymnId: "ἦχος & 1" });
  assert.equal(url.searchParams.has("other"), false);
  assert.equal(workspaceUrl(url.href), "https://example.org/psaltikon/");
  assert.deepEqual(parseShareRequest(new URL(createShareUrl(url.href, { path, hymnId: null })).search), { path, hymnId: null });
});

test("invalid or ambiguous links never fall through to opening the local workspace", () => {
  assert.equal(parseShareRequest("?unrelated=true"), null);
  for (const search of ["?conjunto=", "?hino=x", "?conjunto=../config/approved-users.json", "?conjunto=https://evil.test/hinos/a/b.json",
    "?conjunto=hinos/../b.json", `?conjunto=${path}&conjunto=${path}`, `?conjunto=${path}&hino=`, `?conjunto=${path}&hino=a&hino=b`]) {
    assert.equal(typeof parseShareRequest(search)?.error, "string", search);
  }
});

test("published identity selects the same hymn after reordering and fails if it is removed", () => {
  const source = fixture();
  const original = structuredClone(source);
  const first = selectSharedHymns(readPublishedSet(source), "primary-hymn")[0];
  assert.deepEqual(source, original);
  source.hymns.reverse();
  const reordered = selectSharedHymns(readPublishedSet(source), "primary-hymn")[0];
  assert.equal(first.title, reordered.title);
  assert.deepEqual(first.highlights, reordered.highlights);
  assert.equal(first.videoId, reordered.videoId);
  assert.deepEqual(readPublishedSet(original).hymns[0].melismas, original.hymns[0].melismas);
  source.hymns.pop();
  assert.throws(() => selectSharedHymns(readPublishedSet(source), "primary-hymn"), /não está mais disponível/);
});

test("old missing/duplicate IDs remain readable as a set but cannot point at the wrong hymn", () => {
  const source = fixture();
  source.hymns[1].id = source.hymns[0].id;
  const published = readPublishedSet(source);
  assert.deepEqual(published.hymnIds, [null, null]);
  assert.equal(new Set(published.hymns.map(h => h.id)).size, 2);
  assert.throws(() => selectSharedHymns(published, "primary-hymn"));
  delete source.hymns[0].id;
  assert.equal(selectSharedHymns(readPublishedSet(source), null).length, 2);
});

test("invalid published content is rejected instead of silently discarding annotations", () => {
  for (const invalid of [null, {}, { title: "Teste", hymns: [] }, { title: "Teste", hymns: [null] }]) assert.throws(() => readPublishedSet(invalid));
  const source = fixture();
  source.hymns[0].highlights[0].end = 999;
  assert.throws(() => readPublishedSet(source), /dados inválidos/);
  source.hymns[0].highlights = [];
  source.hymns[0].melismas[0].kind = "invalid";
  assert.throws(() => readPublishedSet(source), /dados inválidos/);
});

test("loading is a public GET and each opening gets the latest publication", async (t) => {
  let calls = 0;
  const source = fixture();
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, `https://publisher.example/api/library/item?path=${encodeURIComponent(path)}`);
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers, undefined);
    assert.equal(init.method, undefined);
    calls++;
    return Response.json(source);
  });
  assert.equal((await loadPublishedSet("https://publisher.example", path)).hymns[0].title, "Primeiro");
  source.hymns[0].title = "Atualizado";
  assert.equal((await loadPublishedSet("https://publisher.example", path)).hymns[0].title, "Atualizado");
  assert.equal(calls, 2);
});

test("unavailable service, deleted publications and cancellation are handled", async (t) => {
  await assert.rejects(loadPublishedSet("", path), /não está disponível/);
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 404 }));
  await assert.rejects(loadPublishedSet("https://publisher.example", path), /excluído/);
  globalThis.fetch = async (_url, init) => { init.signal.throwIfAborted(); };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadPublishedSet("https://publisher.example", path, controller.signal), { name: "AbortError" });
});

test("adding a copy preserves existing work and marks, creates unique IDs and does not mutate the source", () => {
  const original = fixture().hymns;
  const source = readPublishedSet(fixture()).hymns;
  const snapshot = structuredClone(source);
  const storage = memoryStorage(JSON.stringify({ version: 3, hymns: original }));
  assert.equal(addSharedToWorkspace(storage, source), 2);
  const saved = JSON.parse(storage.value).hymns;
  assert.deepEqual(saved.slice(0, 2), original);
  assert.deepEqual(saved[2].highlights, source[0].highlights);
  assert.deepEqual(saved[2].melismas, source[0].melismas);
  assert.equal(saved[2].videoId, source[0].videoId);
  assert.equal(saved[2].targetSpeed, source[0].targetSpeed);
  assert.equal(new Set(saved.map(h => h.id)).size, 4);
  assert.equal(storage.writes, 1);
  assert.deepEqual(source, snapshot);
});

test("first access and an untouched blank hymn receive the copy without a spare empty hymn", () => {
  for (const initial of [null, JSON.stringify({ version: 3, hymns: [newHymn()] })]) {
    const storage = memoryStorage(initial);
    addSharedToWorkspace(storage, fixture().hymns);
    assert.equal(JSON.parse(storage.value).hymns.length, 2);
  }
});

test("unreadable storage, capacity overflow and storage failure never report a successful copy", () => {
  for (const initial of ["{broken", "{}", JSON.stringify({ version: 3, hymns: Array.from({ length: 80 }, () => fixture().hymns[0]) })]) {
    const storage = memoryStorage(initial);
    assert.throws(() => addSharedToWorkspace(storage, fixture().hymns));
    assert.equal(storage.value, initial);
    assert.equal(storage.writes, 0);
  }
  assert.throws(() => addSharedToWorkspace({ getItem: () => null, setItem: () => { throw new DOMException("Full", "QuotaExceededError"); } }, fixture().hymns), { name: "QuotaExceededError" });
});

test("all existing published sets remain readable without modifying their content", async () => {
  const root = new URL("../hinos/", import.meta.url);
  for (const owner of await readdir(root, { withFileTypes: true })) {
    if (!owner.isDirectory()) continue;
    for (const file of await readdir(new URL(`${owner.name}/`, root))) {
      if (!file.endsWith(".json")) continue;
      const data = JSON.parse(await readFile(new URL(`${owner.name}/${file}`, root), "utf8"));
      const snapshot = structuredClone(data);
      const parsed = readPublishedSet(data);
      assert.equal(parsed.hymns.length, data.hymns.length);
      parsed.hymns.forEach((hymn, index) => {
        assert.equal(hymn.lyrics, data.hymns[index].lyrics);
        assert.deepEqual(hymn.highlights, data.hymns[index].highlights || []);
        assert.deepEqual(hymn.melismas, data.hymns[index].melismas || []);
      });
      assert.deepEqual(data, snapshot);
    }
  }
});
