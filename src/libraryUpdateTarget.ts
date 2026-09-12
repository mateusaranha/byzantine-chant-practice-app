export type PublishedLibraryItem = {
  owner: string;
  slug: string;
  path: string;
  title?: string;
};

function normalizedTitle(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function findOwnPublicationByName(
  items: PublishedLibraryItem[],
  owner: string,
  name: string,
  requestedSlug: string,
): PublishedLibraryItem | null {
  const trimmedOwner = owner.trim();
  const trimmedName = name.trim();
  if (!trimmedOwner || !trimmedName) return null;

  const ownItems = items.filter((item) => item.owner === trimmedOwner);
  const slugMatch = ownItems.find((item) => item.slug === requestedSlug);
  if (slugMatch) return slugMatch;

  const wantedTitle = normalizedTitle(trimmedName);
  const titleMatches = ownItems.filter(
    (item) => item.title && normalizedTitle(item.title) === wantedTitle,
  );

  return titleMatches.length === 1 ? titleMatches[0] : null;
}
