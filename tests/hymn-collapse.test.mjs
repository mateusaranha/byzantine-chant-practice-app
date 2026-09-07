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

test("hymn panel state persists locally per hymn and remains separate from tool-panel state", async () => {
  const {
    HYMN_PANEL_STATE_KEY,
    readHymnPanelOpen,
    readToolsPanelOpen,
    writeHymnPanelOpen,
    writeToolsPanelOpen,
  } = await loadWorkspacePreferences();
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readHymnPanelOpen(storage, "hymn-a"), true);
  assert.equal(readHymnPanelOpen(storage, "hymn-b"), true);

  assert.equal(writeHymnPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readHymnPanelOpen(storage, "hymn-a"), false);
  assert.equal(readHymnPanelOpen(storage, "hymn-b"), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);

  assert.equal(writeToolsPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readHymnPanelOpen(storage, "hymn-a"), false);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);

  assert.equal(writeHymnPanelOpen(storage, "hymn-a", true), true);
  assert.equal(readHymnPanelOpen(storage, "hymn-a"), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);

  values.set(HYMN_PANEL_STATE_KEY, "{dados interrompidos");
  assert.equal(readHymnPanelOpen(storage, "hymn-a"), true);
  assert.equal(readHymnPanelOpen({ getItem: () => { throw new Error("blocked"); } }, "hymn-a"), true);
});

test("collapsing a hymn is local-only, accessible, pauses video and stays printable", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/hymnCollapse.css", import.meta.url), "utf8");

  assert.match(app, /persistHymnPanel \? readHymnPanelOpen\(localStorage, hymn\.id\) : true/);
  assert.match(app, /playerRef\.current\?\.pauseVideo\(\)/);
  assert.match(app, /!hymnPanelOpen \|\| !hymn\.videoId \|\| !playerHostRef\.current/);
  assert.match(app, /aria-label=\{`Recolher hino/);
  assert.match(app, /aria-label=\{`Expandir hino/);
  assert.match(app, /aria-controls=\{workspaceId\}/);
  assert.match(app, /hymn-workspace-collapsed/);

  const localIndex = app.indexOf("function LocalWorkspace()");
  const sharedIndex = app.indexOf("function SharedWorkspace");
  assert.ok(localIndex >= 0 && sharedIndex > localIndex);
  assert.match(app.slice(localIndex, sharedIndex), /persistHymnPanel/);
  assert.doesNotMatch(app.slice(sharedIndex), /persistHymnPanel/);

  assert.match(css, /\.collapsed-hymn-summary/);
  assert.match(
    css,
    /\.workspace\.hymn-workspace-collapsed\s*\{\s*display:none;\s*\}/,
    "collapsed workspace rule must be more specific than the base .workspace display:grid rule",
  );
  assert.match(
    css,
    /@media print[\s\S]*\.workspace\.hymn-workspace-collapsed[\s\S]*display:grid !important/,
  );
});
