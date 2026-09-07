import { parseShareRequest, selectSharedHymns } from "./sharedHymns";
import type { PublishedSet } from "./sharedHymns";

export type CuratedCategory = { id: string; label: string };
export type CuratedSubcategory = { id: string; label: string; categoryId: string };
export type CuratedEntry = {
  id: string;
  title: string;
  subcategoryId: string;
  order: number;
  source: { path: string; hymnId: string };
  note?: string;
};
export type CuratedCatalog = {
  version: 2;
  categories: CuratedCategory[];
  subcategories: CuratedSubcategory[];
  entries: CuratedEntry[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const order = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const id = (value: unknown): value is string => text(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const byLabel = <T extends { label: string }>(a: T, b: T) =>
  a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });

// Keep valid entries available at runtime, but expose every editorial error to CI.
export function readCuratedCatalog(value: unknown): { catalog: CuratedCatalog; errors: string[] } {
  const catalog: CuratedCatalog = { version: 2, categories: [], subcategories: [], entries: [] };
  const errors: string[] = [];
  if (
    !record(value) ||
    value.version !== 2 ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.subcategories) ||
    !Array.isArray(value.entries)
  ) {
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
    if (!record(category) || !id(category.id) || !text(category.label) || categoryDuplicates.has(category.id)) {
      errors.push(`Categoria ${index + 1}: campos inválidos ou ID duplicado.`);
      continue;
    }
    catalog.categories.push({ id: category.id, label: category.label.trim() });
  }

  const categoryIds = new Set(catalog.categories.map(category => category.id));
  const subcategoryDuplicates = duplicateIds(value.subcategories);
  for (const [index, subcategory] of value.subcategories.entries()) {
    if (
      !record(subcategory) ||
      !id(subcategory.id) ||
      !text(subcategory.label) ||
      !id(subcategory.categoryId) ||
      !categoryIds.has(subcategory.categoryId) ||
      subcategoryDuplicates.has(subcategory.id)
    ) {
      errors.push(`Subcategoria ${index + 1}: campos, categoria ou ID inválidos/duplicados.`);
      continue;
    }
    catalog.subcategories.push({
      id: subcategory.id,
      label: subcategory.label.trim(),
      categoryId: subcategory.categoryId,
    });
  }

  const subcategoryIds = new Set(catalog.subcategories.map(subcategory => subcategory.id));
  const entryDuplicates = duplicateIds(value.entries);
  const sources = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    if (
      !record(entry) ||
      !id(entry.id) ||
      entryDuplicates.has(entry.id) ||
      !text(entry.title) ||
      !order(entry.order) ||
      !id(entry.subcategoryId) ||
      !subcategoryIds.has(entry.subcategoryId) ||
      (entry.note !== undefined && !text(entry.note)) ||
      !record(entry.source) ||
      !text(entry.source.path) ||
      !text(entry.source.hymnId)
    ) {
      errors.push(`Hino ${index + 1}: campos, subcategoria ou ID inválidos/duplicados.`);
      continue;
    }
    const { path, hymnId } = entry.source;
    const route = parseShareRequest(`?${new URLSearchParams({ conjunto: path, hino: hymnId })}`);
    const sourceKey = JSON.stringify([path, hymnId]);
    if (!route || "error" in route || sources.has(sourceKey)) {
      errors.push(`Hino ${entry.id}: referência inválida ou repetida.`);
      continue;
    }
    sources.add(sourceKey);
    catalog.entries.push({
      id: entry.id,
      title: entry.title.trim(),
      subcategoryId: entry.subcategoryId,
      order: entry.order,
      source: { path, hymnId },
      ...(entry.note === undefined ? {} : { note: entry.note as string }),
    });
  }

  catalog.categories.sort(byLabel);
  catalog.subcategories.sort(byLabel);
  catalog.entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }));
  return { catalog, errors };
}

export function curatedGroups(catalog: CuratedCatalog) {
  return catalog.categories
    .map(category => ({
      ...category,
      subcategories: catalog.subcategories
        .filter(subcategory => subcategory.categoryId === category.id)
        .map(subcategory => ({
          ...subcategory,
          entries: catalog.entries.filter(entry => entry.subcategoryId === subcategory.id),
        }))
        .filter(subcategory => subcategory.entries.length > 0),
    }))
    .filter(category => category.subcategories.length > 0);
}

export async function validateCuratedSources(catalog: CuratedCatalog, load: (path: string) => Promise<PublishedSet>) {
  const errors: string[] = [];
  const sets = new Map<string, Promise<PublishedSet>>();
  for (const entry of catalog.entries) {
    try {
      if (!sets.has(entry.source.path)) sets.set(entry.source.path, load(entry.source.path));
      selectSharedHymns(await sets.get(entry.source.path)!, entry.source.hymnId);
    } catch (reason) {
      errors.push(`Hino ${entry.id} (${entry.source.path}, ${entry.source.hymnId}): ${reason instanceof Error ? reason.message : "referência inválida"}`);
    }
  }
  return errors;
}
