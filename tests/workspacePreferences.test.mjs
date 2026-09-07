import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadWorkspacePreferences() {
  const source = await readFile(new URL("../src/workspacePreferences.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

test("tools panel state persists locally per hymn and fails open safely", async () => {
  const { TOOLS_PANEL_STATE_KEY, readToolsPanelOpen, writeToolsPanelOpen } = await loadWorkspacePreferences();
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-b"), true);

  assert.equal(writeToolsPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);
  assert.equal(readToolsPanelOpen(storage, "hymn-b"), true);

  assert.equal(writeToolsPanelOpen(storage, "hymn-a", true), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);

  values.set(TOOLS_PANEL_STATE_KEY, "{dados interrompidos");
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);
  assert.equal(writeToolsPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);

  assert.equal(readToolsPanelOpen({ getItem: () => { throw new Error("blocked"); } }, "hymn-a"), true);
  assert.equal(writeToolsPanelOpen({
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
  }, "hymn-a", false), false);
});
