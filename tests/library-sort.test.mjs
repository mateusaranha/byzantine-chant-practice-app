import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadLibrarySort() {
  const source = await readFile(new URL("../src/librarySort.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

const items = [
  { path: "hinos/mateus/z.json", slug: "fallback-z", title: "Zoodochos", updatedAt: "2026-08-20T12:00:00Z" },
  { path: "hinos/mateus/a.json", slug: "fallback-a", title: "Ágios", updatedAt: "2026-08-30T12:00:00Z" },
  { path: "hinos/mateus/d.json", slug: "dormicao", title: "Dormição", updatedAt: "2026-08-25T12:00:00Z" },
  { path: "hinos/mateus/s.json", slug: "sem-data", title: "Sem data", updatedAt: null },
];

test("sorts library titles in both directions without mutating the response", async () => {
  const { sortLibraryItems } = await loadLibrarySort();
  const original = structuredClone(items);
  assert.deepEqual(
    sortLibraryItems(items, { by: "name", direction: "asc" }).map((item) => item.title),
    ["Ágios", "Dormição", "Sem data", "Zoodochos"],
  );
  assert.deepEqual(
    sortLibraryItems(items, { by: "name", direction: "desc" }).map((item) => item.title),
    ["Zoodochos", "Sem data", "Dormição", "Ágios"],
  );
  assert.deepEqual(items, original);
});

test("sorts updates in both directions and keeps unknown dates last", async () => {
  const { sortLibraryItems } = await loadLibrarySort();
  assert.deepEqual(
    sortLibraryItems(items, { by: "updatedAt", direction: "desc" }).map((item) => item.title),
    ["Ágios", "Dormição", "Zoodochos", "Sem data"],
  );
  assert.deepEqual(
    sortLibraryItems(items, { by: "updatedAt", direction: "asc" }).map((item) => item.title),
    ["Zoodochos", "Dormição", "Ágios", "Sem data"],
  );
});

test("uses the readable slug when an old item has no title", async () => {
  const { libraryItemLabel } = await loadLibrarySort();
  assert.equal(libraryItemLabel({ path: "hinos/mateus/paraclisis.json", slug: "paraclisis" }), "Paraclisis");
});

test("repeated clicks invert a criterion and switching restores its natural direction", async () => {
  const { nextLibrarySort } = await loadLibrarySort();
  const alphabetical = { by: "name", direction: "asc" };
  assert.deepEqual(nextLibrarySort(alphabetical, "name"), { by: "name", direction: "desc" });
  assert.deepEqual(nextLibrarySort(alphabetical, "updatedAt"), { by: "updatedAt", direction: "desc" });
  assert.deepEqual(nextLibrarySort({ by: "updatedAt", direction: "desc" }, "updatedAt"), {
    by: "updatedAt",
    direction: "asc",
  });
  assert.deepEqual(nextLibrarySort({ by: "updatedAt", direction: "asc" }, "name"), alphabetical);
});
