export type Highlight = { start: number; end: number; color: string };
export type Melisma = { start: number; end: number; kind: "simple" | "complex" };
export type RepeatMode = "off" | "once" | "three" | "continuous";

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
};

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

export function restoreHymns(value: unknown): Hymn[] | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hymn> & { hymns?: unknown };
  if (Array.isArray(data.hymns)) {
    const savedHymns = data.hymns.filter(
      (hymn): hymn is Partial<Hymn> => Boolean(hymn && typeof hymn === "object"),
    );
    if (!savedHymns.length) return null;
    return uniqueHymnIds(savedHymns.map((hymn, index) => normalizeHymn(hymn, `hymn-${index}`)));
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
