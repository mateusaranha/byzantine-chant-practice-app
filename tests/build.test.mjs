import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("the production build contains the app shell and migration features", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Psaltikon/);
  assert.match(html, /manifest\.webmanifest/);

  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascriptName = assetNames.find((name) => name.endsWith(".js"));
  assert.ok(javascriptName, "JavaScript bundle was not generated");

  const javascript = await readFile(new URL(`../dist/assets/${javascriptName}`, import.meta.url), "utf8");
  assert.match(javascript, /psaltikon-backup-/);
  assert.match(javascript, /Export backup/);
  assert.match(javascript, /Ἀγγελικαὶ δυνάμεις/);
});
