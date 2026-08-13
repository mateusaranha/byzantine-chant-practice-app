import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("the production build contains the app shell and migration features", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Psaltikon/);
  assert.match(html, /manifest\.webmanifest/);

  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascriptName = assetNames.find((name) => name.endsWith(".js"));
  const stylesheetName = assetNames.find((name) => name.endsWith(".css"));
  assert.ok(javascriptName, "JavaScript bundle was not generated");
  assert.ok(stylesheetName, "Stylesheet was not generated");

  const javascript = await readFile(new URL(`../dist/assets/${javascriptName}`, import.meta.url), "utf8");
  const stylesheet = await readFile(new URL(`../dist/assets/${stylesheetName}`, import.meta.url), "utf8");
  assert.match(javascript, /psaltikon-backup-/);
  assert.match(javascript, /Export backup/);
  assert.match(javascript, /Clear colours/);
  assert.match(javascript, /Clear melismas/);
  assert.match(javascript, /Biblioteca online/);
  assert.match(javascript, /Solicitar permissão para publicar/);
  assert.match(javascript, /Salvar conjunto no GitHub/);
  assert.match(javascript, /Sobre o Psaltikon/);
  assert.match(javascript, /não pretende substituir o aprendizado da notação bizantina/);
  assert.match(javascript, /Ἀγγελικαὶ δυνάμεις/);
  assert.match(stylesheet, /\.about-modal/);
  assert.match(stylesheet, /@media \(width<=520px\)/);
  assert.match(stylesheet, /max-height:calc\(100vh\s*-\s*20px\)/);
});
