export type LibrarySort = {
  by: "name" | "updatedAt";
  direction: "asc" | "desc";
};

export type SortableLibraryItem = {
  path: string;
  slug: string;
  title?: string;
  updatedAt?: string | null;
};

const titleCollator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

export function displaySlug(value: string) {
  const words = value.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function libraryItemLabel(item: SortableLibraryItem) {
  return String(item.title || "").trim() || displaySlug(item.slug);
}

export function nextLibrarySort(current: LibrarySort, by: LibrarySort["by"]): LibrarySort {
  if (current.by === by) {
    return { by, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { by, direction: by === "name" ? "asc" : "desc" };
}

function validTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function sortLibraryItems<T extends SortableLibraryItem>(items: T[], sort: LibrarySort): T[] {
  return [...items].sort((left, right) => {
    if (sort.by === "updatedAt") {
      const leftTimestamp = validTimestamp(left.updatedAt);
      const rightTimestamp = validTimestamp(right.updatedAt);
      if (leftTimestamp === null && rightTimestamp !== null) return 1;
      if (leftTimestamp !== null && rightTimestamp === null) return -1;
      if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
        return sort.direction === "asc"
          ? leftTimestamp - rightTimestamp
          : rightTimestamp - leftTimestamp;
      }
    }

    const byTitle = titleCollator.compare(libraryItemLabel(left), libraryItemLabel(right));
    if (byTitle !== 0) return sort.by === "name" && sort.direction === "desc" ? -byTitle : byTitle;
    return left.path.localeCompare(right.path);
  });
}
