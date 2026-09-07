import { readFile } from "node:fs/promises";
import ts from "typescript";

// Use the same TypeScript reader in the browser, validation command and tests.
async function moduleUrl(name, dependencies = {}) {
  const source = await readFile(new URL(`../src/${name}.ts`, import.meta.url), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [path, url] of Object.entries(dependencies)) js = js.replaceAll(`"${path}"`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const hymnUrl = await moduleUrl("hymnState");
const sharedUrl = await moduleUrl("sharedHymns", { "./hymnState": hymnUrl });
export const shared = await import(sharedUrl);
export const curatedModuleUrl = await moduleUrl("curatedCatalog", { "./sharedHymns": sharedUrl });
export const curated = await import(curatedModuleUrl);
