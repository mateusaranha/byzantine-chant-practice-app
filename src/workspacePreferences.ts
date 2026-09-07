export const TOOLS_PANEL_STATE_KEY = "psaltikon-tools-panel-state";
export const HYMN_PANEL_STATE_KEY = "psaltikon-hymn-panel-state";

const MAX_TRACKED_HYMNS = 200;

type StoredCollapsedState = {
  version: 1;
  collapsedHymnIds: string[];
};

function readCollapsedHymnIds(storage: Pick<Storage, "getItem">, key: string): Set<string> {
  try {
    const raw = storage.getItem(key);
    if (!raw) return new Set();
    const value = JSON.parse(raw) as Partial<StoredCollapsedState> | null;
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

function writePanelOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  hymnId: string,
  open: boolean,
): boolean {
  try {
    const collapsed = readCollapsedHymnIds(storage, key);
    if (open) collapsed.delete(hymnId);
    else collapsed.add(hymnId);
    const collapsedHymnIds = [...collapsed].slice(-MAX_TRACKED_HYMNS);
    storage.setItem(key, JSON.stringify({ version: 1, collapsedHymnIds }));
    return true;
  } catch {
    return false;
  }
}

export function readToolsPanelOpen(storage: Pick<Storage, "getItem">, hymnId: string): boolean {
  return !readCollapsedHymnIds(storage, TOOLS_PANEL_STATE_KEY).has(hymnId);
}

export function writeToolsPanelOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  hymnId: string,
  open: boolean,
): boolean {
  return writePanelOpen(storage, TOOLS_PANEL_STATE_KEY, hymnId, open);
}

export function readHymnPanelOpen(storage: Pick<Storage, "getItem">, hymnId: string): boolean {
  return !readCollapsedHymnIds(storage, HYMN_PANEL_STATE_KEY).has(hymnId);
}

export function writeHymnPanelsOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  hymnIds: string[],
  open: boolean,
): boolean {
  try {
    const collapsed = readCollapsedHymnIds(storage, HYMN_PANEL_STATE_KEY);
    hymnIds.forEach((id) => open ? collapsed.delete(id) : collapsed.add(id));
    const collapsedHymnIds = [...collapsed].slice(-MAX_TRACKED_HYMNS);
    storage.setItem(HYMN_PANEL_STATE_KEY, JSON.stringify({ version: 1, collapsedHymnIds }));
    return true;
  } catch {
    return false;
  }
}

export function writeHymnPanelOpen(
  storage: Pick<Storage, "getItem" | "setItem">,
  hymnId: string,
  open: boolean,
): boolean {
  return writeHymnPanelsOpen(storage, [hymnId], open);
}
