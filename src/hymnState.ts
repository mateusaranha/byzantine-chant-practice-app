export type Highlight = { start: number; end: number; color: string };
export type Melisma = { start: number; end: number; kind: "simple" | "complex" };
export type RepeatMode = "off" | "once" | "three" | "continuous";
export type HymnGroup = { id: string; name: string };

export const WORKSPACE_KEY = "psaltikon-practice";

const HIGHLIGHT_COLOURS = new Set(["sage", "sky", "rose", "wheat", "lavender"]);
const REPEAT_MODES = new Set<RepeatMode>(["off", "once", "three", "continuous"]);

export type Hymn = {
  id: string;
  title: string;
  mode: string;
  lyrics: string;
  videoInput: string;
  videoId: string;
  targetSpeed: number;
  repeatMode: RepeatMode;
  fontSize: number;
  lineHeight: number;
  highlights: Highlight[];
  melismas: Melisma[];
  group?: HymnGroup;
};

export type HymnLayoutItem =
  | { type: "hymn"; hymn: Hymn }
  | { type: "group"; group: HymnGroup; hymns: Hymn[] };

export function newHymn(): Hymn {
  return {
    id: `hymn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    mode: "",
    lyrics: "",
    videoInput: "",
    videoId: "",
    targetSpeed: 1,
    repeatMode: "off",
    fontSize: 27,
    lineHeight: 1.9,
    highlights: [],
    melismas: [],
  };
}

export function normalizeHymn(value: Partial<Hymn>, fallbackId: string): Hymn {
  const lyrics = typeof value.lyrics === "string" ? value.lyrics : "";
  const savedSpeed =
    typeof value.targetSpeed === "number" && Number.isFinite(value.targetSpeed)
      ? value.targetSpeed
      : 1;
  const savedFontSize =
    typeof value.fontSize === "number" && Number.isFinite(value.fontSize)
      ? value.fontSize
      : 27;
  const savedLineHeight =
    typeof value.lineHeight === "number" && Number.isFinite(value.lineHeight)
      ? value.lineHeight
      : 1.9;
  const highlights = Array.isArray(value.highlights)
    ? value.highlights.filter(
        (mark): mark is Highlight =>
          Boolean(
            mark &&
              Number.isInteger(mark.start) &&
              Number.isInteger(mark.end) &&
              mark.start >= 0 &&
              mark.end > mark.start &&
              mark.end <= lyrics.length &&
              HIGHLIGHT_COLOURS.has(mark.color),
          ),
      ).map(({ start, end, color }) => ({ start, end, color }))
    : [];
  const melismas = Array.isArray(value.melismas)
    ? value.melismas.filter(
        (mark): mark is Melisma =>
          Boolean(
            mark &&
              Number.isInteger(mark.start) &&
              Number.isInteger(mark.end) &&
              mark.start >= 0 &&
              mark.end > mark.start &&
              mark.end <= lyrics.length &&
              (mark.kind === "simple" || mark.kind === "complex"),
          ),
      ).map(({ start, end, kind }) => ({ start, end, kind }))
    : [];
  const id = typeof value.id === "string" && value.id.trim() && value.id.length <= 200
    ? value.id
    : fallbackId;
  const group = value.group &&
    typeof value.group === "object" &&
    typeof value.group.id === "string" &&
    value.group.id.trim() &&
    value.group.id.length <= 200 &&
    typeof value.group.name === "string" &&
    value.group.name.trim() &&
    value.group.name.trim().length <= 120
      ? { id: value.group.id, name: value.group.name.trim() }
      : undefined;
  return {
    id,
    title: typeof value.title === "string" ? value.title : "Novo hino",
    mode: typeof value.mode === "string" ? value.mode : "",
    lyrics,
    videoInput: typeof value.videoInput === "string" ? value.videoInput : "",
    videoId: typeof value.videoId === "string" ? value.videoId : "",
    targetSpeed: Math.min(2, Math.max(0.25, Math.round(savedSpeed * 20) / 20)),
    repeatMode: REPEAT_MODES.has(value.repeatMode as RepeatMode) ? (value.repeatMode as RepeatMode) : "off",
    fontSize: Math.min(40, Math.max(20, Math.round(savedFontSize))),
    lineHeight: Math.min(2.4, Math.max(1.4, Math.round(savedLineHeight * 10) / 10)),
    highlights,
    melismas,
    ...(group ? { group } : {}),
  };
}

function uniqueHymnIds(hymns: Hymn[]): Hymn[] {
  const ids = new Set<string>();
  return hymns.map((hymn) => {
    if (!ids.has(hymn.id)) {
      ids.add(hymn.id);
      return hymn;
    }
    let id = newHymn().id;
    while (ids.has(id)) id = newHymn().id;
    ids.add(id);
    return { ...hymn, id };
  });
}

export function moveHymn(hymns: Hymn[], id: string, direction: -1 | 1): Hymn[] {
  const currentIndex = hymns.findIndex((hymn) => hymn.id === id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= hymns.length) return hymns;
  const next = [...hymns];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

function withoutGroup(hymn: Hymn): Hymn {
  if (!hymn.group) return hymn;
  const { group: _group, ...ungrouped } = hymn;
  return ungrouped;
}

export function newHymnGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function hymnLayout(hymns: Hymn[]): HymnLayoutItem[] {
  const groupCounts = new Map<string, number>();
  for (const hymn of hymns) {
    if (hymn.group) groupCounts.set(hymn.group.id, (groupCounts.get(hymn.group.id) || 0) + 1);
  }

  const emittedGroups = new Set<string>();
  const layout: HymnLayoutItem[] = [];
  for (const hymn of hymns) {
    const group = hymn.group;
    if (!group || (groupCounts.get(group.id) || 0) < 2) {
      layout.push({ type: "hymn", hymn });
      continue;
    }
    if (emittedGroups.has(group.id)) continue;
    emittedGroups.add(group.id);
    layout.push({
      type: "group",
      group,
      hymns: hymns.filter((item) => item.group?.id === group.id),
    });
  }
  return layout;
}

export function normalizeHymnGroups(hymns: Hymn[]): Hymn[] {
  return hymnLayout(hymns).flatMap((item) => {
    if (item.type === "hymn") return [withoutGroup(item.hymn)];
    return item.hymns.map((hymn) => ({ ...hymn, group: item.group }));
  });
}

export function hymnLayoutKey(item: HymnLayoutItem): string {
  return item.type === "group" ? `group:${item.group.id}` : `hymn:${item.hymn.id}`;
}

function flattenHymnLayout(layout: HymnLayoutItem[]): Hymn[] {
  return layout.flatMap((item) => item.type === "group" ? item.hymns : [item.hymn]);
}

function lastHymnIndex(hymns: Hymn[], predicate: (hymn: Hymn) => boolean): number {
  for (let index = hymns.length - 1; index >= 0; index -= 1) {
    if (predicate(hymns[index])) return index;
  }
  return -1;
}

export function moveHymnLayoutItem(hymns: Hymn[], key: string, direction: -1 | 1): Hymn[] {
  const layout = hymnLayout(normalizeHymnGroups(hymns));
  const currentIndex = layout.findIndex((item) => hymnLayoutKey(item) === key);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= layout.length) return hymns;
  const next = [...layout];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return flattenHymnLayout(next);
}

export function moveHymnInGroup(hymns: Hymn[], hymnId: string, direction: -1 | 1): Hymn[] {
  const normalized = normalizeHymnGroups(hymns);
  const hymn = normalized.find((item) => item.id === hymnId);
  if (!hymn?.group) return hymns;
  const members = normalized.filter((item) => item.group?.id === hymn.group?.id);
  const memberIndex = members.findIndex((item) => item.id === hymnId);
  const nextMember = members[memberIndex + direction];
  if (!nextMember) return hymns;
  const currentIndex = normalized.findIndex((item) => item.id === hymnId);
  const nextIndex = normalized.findIndex((item) => item.id === nextMember.id);
  const next = [...normalized];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function createHymnGroup(hymns: Hymn[], hymnIds: Iterable<string>, name: string): Hymn[] {
  const selectedIds = new Set(hymnIds);
  const selected = hymns.filter((hymn) => selectedIds.has(hymn.id) && !hymn.group);
  const trimmedName = name.trim().slice(0, 120);
  if (selected.length < 2 || !trimmedName) return hymns;

  const selectedUngroupedIds = new Set(selected.map((hymn) => hymn.id));
  const group: HymnGroup = { id: newHymnGroupId(), name: trimmedName };
  const firstSelectedIndex = hymns.findIndex((hymn) => selectedUngroupedIds.has(hymn.id));
  const insertionIndex = hymns
    .slice(0, firstSelectedIndex)
    .filter((hymn) => !selectedUngroupedIds.has(hymn.id)).length;
  const remaining = hymns.filter((hymn) => !selectedUngroupedIds.has(hymn.id));
  const grouped = selected.map((hymn) => ({ ...hymn, group }));
  return normalizeHymnGroups([
    ...remaining.slice(0, insertionIndex),
    ...grouped,
    ...remaining.slice(insertionIndex),
  ]);
}

export function addHymnsToGroup(hymns: Hymn[], hymnIds: Iterable<string>, groupId: string): Hymn[] {
  const normalized = normalizeHymnGroups(hymns);
  const target = normalized.find((hymn) => hymn.group?.id === groupId)?.group;
  if (!target) return hymns;
  const selectedIds = new Set(hymnIds);
  const selected = normalized.filter(
    (hymn) => selectedIds.has(hymn.id) && hymn.group?.id !== groupId,
  );
  if (!selected.length) return hymns;

  const remaining = normalized.filter((hymn) => !selected.some((item) => item.id === hymn.id));
  const lastTargetIndex = lastHymnIndex(remaining, (hymn) => hymn.group?.id === groupId);
  const additions = selected.map((hymn) => ({ ...hymn, group: target }));
  return normalizeHymnGroups([
    ...remaining.slice(0, lastTargetIndex + 1),
    ...additions,
    ...remaining.slice(lastTargetIndex + 1),
  ]);
}

export function renameHymnGroup(hymns: Hymn[], groupId: string, name: string): Hymn[] {
  const trimmedName = name.trim().slice(0, 120);
  if (!trimmedName || !hymns.some((hymn) => hymn.group?.id === groupId)) return hymns;
  return normalizeHymnGroups(hymns.map((hymn) => hymn.group?.id === groupId
    ? { ...hymn, group: { id: groupId, name: trimmedName } }
    : hymn));
}

export function ungroupHymns(hymns: Hymn[], groupId: string): Hymn[] {
  return hymns.map((hymn) => hymn.group?.id === groupId ? withoutGroup(hymn) : hymn);
}

export function removeHymnFromGroup(hymns: Hymn[], hymnId: string): Hymn[] {
  const normalized = normalizeHymnGroups(hymns);
  const hymn = normalized.find((item) => item.id === hymnId);
  if (!hymn?.group) return hymns;
  const groupId = hymn.group.id;
  const remaining = normalized.filter((item) => item.id !== hymnId);
  const lastGroupIndex = lastHymnIndex(remaining, (item) => item.group?.id === groupId);
  return normalizeHymnGroups([
    ...remaining.slice(0, lastGroupIndex + 1),
    withoutGroup(hymn),
    ...remaining.slice(lastGroupIndex + 1),
  ]);
}

export function restoreHymns(value: unknown): Hymn[] | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hymn> & { hymns?: unknown };
  if (Array.isArray(data.hymns)) {
    const savedHymns = data.hymns.filter(
      (hymn): hymn is Partial<Hymn> => Boolean(hymn && typeof hymn === "object"),
    );
    if (!savedHymns.length) return null;
    return normalizeHymnGroups(uniqueHymnIds(
      savedHymns.map((hymn, index) => normalizeHymn(hymn, `hymn-${index}`)),
    ));
  }

  const isLegacyHymn = ["lyrics", "videoInput", "videoId", "highlights"].some(
    (field) => field in data,
  );
  if (!isLegacyHymn) return null;
  return [
    normalizeHymn(
      {
        ...data,
        id: "primary-hymn",
        title: "Ἀγγελικαὶ δυνάμεις",
        mode: "Ἦχος πλάγιος τοῦ δευτέρου",
        melismas: [],
      },
      "primary-hymn",
    ),
  ];
}

export type WorkspaceReadResult =
  | { status: "empty" }
  | { status: "ready"; hymns: Hymn[] }
  | { status: "unreadable"; raw: string | null };

export function readWorkspace(storage: Pick<Storage, "getItem">): WorkspaceReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(WORKSPACE_KEY);
  } catch {
    return { status: "unreadable", raw: null };
  }
  if (raw === null) return { status: "empty" };
  try {
    const hymns = restoreHymns(JSON.parse(raw));
    return hymns ? { status: "ready", hymns } : { status: "unreadable", raw };
  } catch {
    return { status: "unreadable", raw };
  }
}

export function writeWorkspace(storage: Pick<Storage, "setItem">, hymns: Hymn[]) {
  storage.setItem(WORKSPACE_KEY, JSON.stringify({ version: 3, hymns }));
}