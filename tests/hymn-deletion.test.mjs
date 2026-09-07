import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every local hymn can be deleted while more than one remains", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const localStart = app.indexOf("function LocalWorkspace()");
  const sharedStart = app.indexOf("function SharedWorkspace");

  assert.ok(localStart >= 0 && sharedStart > localStart);
  const localWorkspace = app.slice(localStart, sharedStart);

  assert.match(localWorkspace, /canDelete=\{hymns\.length > 1\}/);
  assert.doesNotMatch(localWorkspace, /canDelete=\{index > 0\}/);
  assert.match(localWorkspace, /current\.filter\(\(item\) => item\.id !== hymn\.id\)/);
  assert.match(app, /Remover este hino e todas as suas marcações\?/
  );
});

test("multiple hymns can be selected and deleted without removing the last one", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const dialog = await readFile(new URL("../src/ReorderHymnsDialog.tsx", import.meta.url), "utf8");
  const localStart = app.indexOf("function LocalWorkspace()");
  const sharedStart = app.indexOf("function SharedWorkspace");
  const localWorkspace = app.slice(localStart, sharedStart);
  const sharedWorkspace = app.slice(sharedStart);

  assert.match(dialog, /type="checkbox"/);
  assert.match(dialog, /checked=\{selectedIds\.has\(hymn\.id\)\}/);
  assert.match(dialog, /onDeleteSelected\(\[\.\.\.selectedIds\]\)/);
  assert.match(dialog, /selectedCount === hymns\.length/);
  assert.match(dialog, /disabled=\{!selectedCount \|\| allSelected\}/);
  assert.match(dialog, /Pelo menos um hino precisa permanecer/);
  assert.match(dialog, /Remover \${selectedCount} \${noun} e todas as suas marcações\?/);

  assert.match(localWorkspace, /if \(!selectedIds\.size \|\| selectedIds\.size >= current\.length\) return current/);
  assert.match(localWorkspace, /current\.filter\(\(hymn\) => !selectedIds\.has\(hymn\.id\)\)/);
  assert.match(localWorkspace, /onDeleteSelected=/);
  assert.doesNotMatch(sharedWorkspace, /onDeleteSelected=/);
});
