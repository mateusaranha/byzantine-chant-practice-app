import { readFile } from "node:fs/promises";
import { curated, shared } from "./catalog-modules.mjs";

try {
  const raw = JSON.parse(await readFile(new URL("../catalog/curated.json", import.meta.url), "utf8"));
  const { catalog, errors } = curated.readCuratedCatalog(raw);
  errors.push(...await curated.validateCuratedSources(catalog, async path =>
    shared.readPublishedSet(JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8")))));
  if (errors.length) throw new Error(errors.join("\n"));
  const associated = catalog.subcategories.filter((subcategory) => subcategory.source).length;
  console.log(`Catálogo curado válido: ${associated} conjuntos associados.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
