export type Highlight = { start: number; end: number; color: string };
export type Melisma = { start: number; end: number; kind: "simple" | "complex" };
export type RepeatMode = "off" | "once" | "three" | "continuous";

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
    title: "Novo hino",
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
  const savedSpeed =
    typeof value.targetSpeed === "number" && Number.isFinite(value.targetSpeed)
      ? value.targetSpeed
      : 1;
  return {
    ...newHymn(),
    ...value,
    id: typeof value.id === "string" ? value.id : fallbackId,
    title: typeof value.title === "string" ? value.title : "Novo hino",
    mode: typeof value.mode === "string" ? value.mode : "",
    lyrics: typeof value.lyrics === "string" ? value.lyrics : "",
    highlights: Array.isArray(value.highlights) ? value.highlights : [],
    melismas: Array.isArray(value.melismas) ? value.melismas : [],
    targetSpeed: Math.min(2, Math.max(0.25, Math.round(savedSpeed * 20) / 20)),
    repeatMode: ["off", "once", "three", "continuous"].includes(value.repeatMode || "")
      ? (value.repeatMode as RepeatMode)
      : "off",
  };
}

export function restoreHymns(value: unknown): Hymn[] | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hymn> & { hymns?: unknown };
  if (Array.isArray(data.hymns)) {
    const savedHymns = data.hymns.filter(
      (hymn): hymn is Partial<Hymn> => Boolean(hymn && typeof hymn === "object"),
    );
    if (!savedHymns.length) return null;
    return savedHymns.map((hymn, index) => normalizeHymn(hymn, `hymn-${index}`));
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
