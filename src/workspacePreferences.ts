export const TOOLS_PANEL_STATE_KEY = "psaltikon-tools-panel-state";
export const HYMN_PANEL_STATE_KEY = "psaltikon-hymn-panel-state";
export const TRAINING_VISIBILITY_STATE_KEY = "psaltikon-training-visibility-state";

const MAX_TRACKED_HYMNS = 200;

type StoredCollapsedState = {
  version: 1;
  collapsedHymnIds: string[];
};

type StoredTrainingVisibilityState = {
  version: 1;
  hiddenColourHymnIds: string[];
  hiddenMelismaHymnIds: string[];
};

export type TrainingVisibility = {
  coloursVisible: boolean;
  melismasVisible: boolean;
};

function validHymnIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is string => typeof id === "string" && Boolean(id.trim()) && id.length <= 200,
  );
}

function readCollapsedHymnIds(storage: Pick<Storage, "getItem">, key: string): Set<string> {
  try {
    const raw = storage.getItem(key);
    if (!raw) return new Set();
    const value = JSON.parse(raw) as Partial<StoredCollapsedState> | null;
    if (!value || value.version !== 1 || !Array.isArray(value.collapsedHymnIds)) return new Set();
    return new Set(validHymnIds(value.collapsedHymnIds));
  } catch {
    return new Set();
  }
}

function readTrainingVisibilityState(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(TRAINING_VISIBILITY_STATE_KEY);
    if (!raw) return { hiddenColourHymnIds: new Set<string>(), hiddenMelismaHymnIds: new Set<string>() };
    const value = JSON.parse(raw) as Partial<StoredTrainingVisibilityState> | null;
    if (!value || value.version !== 1) {
      return { hiddenColourHymnIds: new Set<string>(), hiddenMelismaHymnIds: new Set<string>() };
    }
    return {
      hiddenColourHymnIds: new Set(validHymnIds(value.hiddenColourHymnIds)),
      hiddenMelismaHymnIds: new Set(validHymnIds(value.hiddenMelismaHymnIds)),
    };
  } catch {
    return { hiddenColourHymnIds: new Set<string>(), hiddenMelismaHymnIds: new Set<string>() };
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

export function readTrainingVisibility(
  storage: Pick<Storage, "getItem">,
  hymnId: string,
): TrainingVisibility {
  const { hiddenColourHymnIds, hiddenMelismaHymnIds } = readTrainingVisibilityState(storage);
  return {
    coloursVisible: !hiddenColourHymnIds.has(hymnId),
    melismasVisible: !hiddenMelismaHymnIds.has(hymnId),
  };
}

export function writeTrainingVisibility(
  storage: Pick<Storage, "getItem" | "setItem">,
  hymnId: string,
  visibility: TrainingVisibility,
): boolean {
  try {
    const { hiddenColourHymnIds, hiddenMelismaHymnIds } = readTrainingVisibilityState(storage);
    if (visibility.coloursVisible) hiddenColourHymnIds.delete(hymnId);
    else hiddenColourHymnIds.add(hymnId);
    if (visibility.melismasVisible) hiddenMelismaHymnIds.delete(hymnId);
    else hiddenMelismaHymnIds.add(hymnId);
    storage.setItem(TRAINING_VISIBILITY_STATE_KEY, JSON.stringify({
      version: 1,
      hiddenColourHymnIds: [...hiddenColourHymnIds].slice(-MAX_TRACKED_HYMNS),
      hiddenMelismaHymnIds: [...hiddenMelismaHymnIds].slice(-MAX_TRACKED_HYMNS),
    }));
    return true;
  } catch {
    return false;
  }
}
