import { parseShareRequest, selectSharedHymns } from "./sharedHymns";
import type { PublishedSet } from "./sharedHymns";

export type CuratedCategory = { id: string; label: string; order: number };
export type CuratedEntry = {
  id: string;
  title: string;
  categoryIds: string[];
  order: number;
  source: { path: string; hymnId: string };
  note?: string;
};
export type CuratedCatalog = { version: 1; categories: CuratedCategory[]; entries: CuratedEntry[] };

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const order = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const id = (value: unknown): value is string => text(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

// Keep valid entries available at runtime, but expose every editorial error to CI.
export function readCuratedCatalog(value: unknown): { catalog: CuratedCatalog; errors: string[] } {
  const catalog: CuratedCatalog = { version: 1, categories: [], entries: [] };
  const errors: string[] = [];
  if (!record(value) || value.version !== 1 || !Array.isArray(value.categories) || !Array.isArray(value.entries)) {
    return { catalog, errors: ["Catálogo: versão ou estrutura inválida."] };
  }
  const duplicateIds = (items: unknown[]) => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of items) if (record(item) && text(item.id)) {
      if (seen.has(item.id)) duplicates.add(item.id);
      seen.add(item.id);
    }
    return duplicates;
  };
  const categoryDuplicates = duplicateIds(value.categories);
  for (const [index, category] of value.categories.entries()) {
    if (!record(category) || !id(category.id) || !text(category.label) || !order(category.order) || categoryDuplicates.has(category.id)) {
      errors.push(`Categoria ${index + 1}: campos inválidos ou ID duplicado.`);
      continue;
    }
    catalog.categories.push({ id: category.id, label: category.label, order: category.order });
  }
  const categoryIds = new Set(catalog.categories.map(category => category.id));
  const entryDuplicates = duplicateIds(value.entries);
  const sources = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    if (!record(entry) || !id(entry.id) || entryDuplicates.has(entry.id) || !text(entry.title) || !order(entry.order) ||
        !Array.isArray(entry.categoryIds) || !entry.categoryIds.length ||
        !entry.categoryIds.every(category => text(category) && categoryIds.has(category)) ||
        new Set(entry.categoryIds).size !== entry.categoryIds.length ||
        (entry.note !== undefined && !text(entry.note)) ||
        !record(entry.source) || !text(entry.source.path) || !text(entry.source.hymnId)) {
      errors.push(`Item ${index + 1}: campos, categorias ou ID inválidos/duplicados.`);
      continue;
    }
    const { path, hymnId } = entry.source;
    const route = parseShareRequest(`?${new URLSearchParams({ conjunto: path, hino: hymnId })}`);
    const sourceKey = JSON.stringify([path, hymnId]);
    if (!route || "error" in route || sources.has(sourceKey)) {
      errors.push(`Item ${entry.id}: referência inválida ou repetida (use múltiplas categoryIds).`);
      continue;
    }
    sources.add(sourceKey);
    catalog.entries.push({ id: entry.id, title: entry.title, order: entry.order,
      categoryIds: entry.categoryIds as string[], source: { path, hymnId },
      ...(entry.note === undefined ? {} : { note: entry.note as string }) });
  }
  catalog.categories.sort((a, b) => a.order - b.order);
  catalog.entries.sort((a, b) => a.order - b.order);
  return { catalog, errors };
}

export function curatedGroups(catalog: CuratedCatalog) {
  return catalog.categories.map(category => ({
    ...category, entries: catalog.entries.filter(entry => entry.categoryIds.includes(category.id)),
  })).filter(category => category.entries.length > 0);
}

export async function validateCuratedSources(catalog: CuratedCatalog, load: (path: string) => Promise<PublishedSet>) {
  const errors: string[] = [];
  const sets = new Map<string, Promise<PublishedSet>>();
  for (const entry of catalog.entries) {
    try {
      if (!sets.has(entry.source.path)) sets.set(entry.source.path, load(entry.source.path));
      selectSharedHymns(await sets.get(entry.source.path)!, entry.source.hymnId);
    } catch (reason) {
      errors.push(`Item ${entry.id} (${entry.source.path}, ${entry.source.hymnId}): ${reason instanceof Error ? reason.message : "referência inválida"}`);
    }
  }
  return errors;
}
