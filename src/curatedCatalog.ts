import { parseShareRequest } from "./sharedHymns";
import type { PublishedSet } from "./sharedHymns";

export type CuratedCategory = { id: string; label: string };
export type CuratedSubcategory = {
  id: string;
  label: string;
  categoryId: string;
  source?: { path: string };
};
export type CuratedCatalog = {
  version: 3;
  categories: CuratedCategory[];
  subcategories: CuratedSubcategory[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const id = (value: unknown): value is string => text(value) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const byLabel = <T extends { label: string }>(a: T, b: T) =>
  a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });

// Keep valid subcategories available at runtime, but expose editorial errors to CI.
export function readCuratedCatalog(value: unknown): { catalog: CuratedCatalog; errors: string[] } {
  const catalog: CuratedCatalog = { version: 3, categories: [], subcategories: [] };
  const errors: string[] = [];
  if (
    !record(value) ||
    value.version !== 3 ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.subcategories)
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

    let source: { path: string } | undefined;
    if (subcategory.source !== undefined) {
      if (!record(subcategory.source) || !text(subcategory.source.path)) {
        errors.push(`Subcategoria ${subcategory.id}: referência de conjunto inválida.`);
        continue;
      }
      const path = subcategory.source.path.trim();
      const route = parseShareRequest(`?${new URLSearchParams({ conjunto: path })}`);
      if (!route || "error" in route || route.hymnId !== null) {
        errors.push(`Subcategoria ${subcategory.id}: referência de conjunto inválida.`);
        continue;
      }
      source = { path };
    }

    catalog.subcategories.push({
      id: subcategory.id,
      label: subcategory.label.trim(),
      categoryId: subcategory.categoryId,
      ...(source ? { source } : {}),
    });
  }

  catalog.categories.sort(byLabel);
  catalog.subcategories.sort(byLabel);
  return { catalog, errors };
}

export function curatedGroups(catalog: CuratedCatalog, { includeEmpty = false }: { includeEmpty?: boolean } = {}) {
  return catalog.categories
    .map(category => ({
      ...category,
      subcategories: catalog.subcategories.filter(
        subcategory => subcategory.categoryId === category.id && (includeEmpty || Boolean(subcategory.source)),
      ),
    }))
    .filter(category => includeEmpty || category.subcategories.length > 0);
}

export async function validateCuratedSources(
  catalog: CuratedCatalog,
  load: (path: string) => Promise<PublishedSet>,
) {
  const errors: string[] = [];
  const sets = new Map<string, Promise<PublishedSet>>();
  for (const subcategory of catalog.subcategories) {
    if (!subcategory.source) continue;
    try {
      if (!sets.has(subcategory.source.path)) sets.set(subcategory.source.path, load(subcategory.source.path));
      const published = await sets.get(subcategory.source.path)!;
      if (!published.hymns.length) throw new Error("conjunto vazio");
    } catch (reason) {
      errors.push(
        `Subcategoria ${subcategory.id} (${subcategory.source.path}): ${reason instanceof Error ? reason.message : "referência inválida"}`,
      );
    }
  }
  return errors;
}
