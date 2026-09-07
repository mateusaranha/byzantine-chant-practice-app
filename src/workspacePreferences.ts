export const TOOLS_PANEL_STATE_KEY = "psaltikon-tools-panel-state";

const MAX_TRACKED_HYMNS = 200;

type StoredToolsPanelState = {
  version: 1;
  collapsedHymnIds: string[];
};

function readCollapsedHymnIds(storage: Pick<Storage, "getItem">): Set<string> {
  try {
    const raw = storage.getItem(TOOLS_PANEL_STATE_KEY);
    if (!raw) return new Set();
    const value = JSON.parse(raw) as Partial<StoredToolsPanelState> | null;
    if (!value || value.version !== 1 || !Array.isArray(value.collapsedHymnIds)) return new Set();
    return new Set(
      value.collapsedHymnIds.filter(
        (id): id is string => typeof id === "string" && Boolean(id.trim()) && id.length <= 200,
      ),
    );
  } catch {
    return new Set();
  }
}

export function readToolsPanelOpen(storage: Pick<Storage, "getItem">, hymnId: string): boolean {
  return !readCollapsedHymnIds(storage).has(hymnId);
}

export function writeToolsPanelOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  hymnId: string,
  open: boolean,
): boolean {
  try {
    const collapsed = readCollapsedHymnIds(storage);
    if (open) collapsed.delete(hymnId);
    else collapsed.add(hymnId);
    const collapsedHymnIds = [...collapsed].slice(-MAX_TRACKED_HYMNS);
    storage.setItem(TOOLS_PANEL_STATE_KEY, JSON.stringify({ version: 1, collapsedHymnIds }));
    return true;
  } catch {
    return false;
  }
}
