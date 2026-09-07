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
