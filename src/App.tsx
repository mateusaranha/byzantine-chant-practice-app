import { useEffect, useMemo, useRef, useState } from "react";

type Highlight = { start: number; end: number; color: string };
type Melisma = { start: number; end: number; kind: "simple" | "complex" };
type RepeatMode = "off" | "once" | "three" | "continuous";
type ActiveTool = string | "melisma-simple" | "melisma-complex" | "eraser";
type PlayerStateEvent = { data: number };
type YouTubePlayer = {
  destroy: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type Hymn = {
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

type HistoryEntry = {
  highlights: Highlight[];
  melismas: Melisma[];
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars: Record<string, number>;
          events: { onStateChange: (event: PlayerStateEvent) => void };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const COLORS = [
  { name: "Sage", value: "sage" },
  { name: "Sky", value: "sky" },
  { name: "Rose", value: "rose" },
  { name: "Wheat", value: "wheat" },
  { name: "Lavender", value: "lavender" },
];

const SAMPLE = `Ἀγγελικαὶ δυνάμεις ἐπὶ τὸ μνῆμά σου,
καὶ οἱ φυλάσσοντες ἀπενεκρώθησαν·
καὶ ἵστατο Μαρία ἐν τῷ τάφῳ,
ζητοῦσα τὸ ἄχραντόν σου σῶμα.

Ἐσκύλευσας τὸν ᾅδην,
μὴ πειρασθεὶς ὑπ᾿ αὐτοῦ·
ὑπήντησας τῇ Παρθένῳ,
δωρούμενος τὴν ζωήν.

Ὁ ἀναστὰς ἐκ τῶν νεκρῶν,
Κύριε, δόξα σοι.`;

const FIRST_HYMN: Hymn = {
  id: "primary-hymn",
  title: "Ἀγγελικαὶ δυνάμεις",
  mode: "Ἦχος πλάγιος τοῦ δευτέρου",
  lyrics: SAMPLE,
  videoInput: "",
  videoId: "",
  targetSpeed: 1,
  repeatMode: "off",
  fontSize: 27,
  lineHeight: 1.9,
  highlights: [],
  melismas: [],
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function youtubeId(value: string) {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2];
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function newHymn(): Hymn {
  return {
    ...FIRST_HYMN,
    id: `hymn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New hymn",
    mode: "",
    lyrics: "",
    videoInput: "",
    videoId: "",
    highlights: [],
    melismas: [],
  };
}

function normalizeHymn(value: Partial<Hymn>, fallbackId: string): Hymn {
  const savedSpeed =
    typeof value.targetSpeed === "number" && Number.isFinite(value.targetSpeed)
      ? value.targetSpeed
      : 1;
  return {
    ...FIRST_HYMN,
    ...value,
    id: typeof value.id === "string" ? value.id : fallbackId,
    title: typeof value.title === "string" ? value.title : "New hymn",
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

function subtractRange<T extends { start: number; end: number }>(
  items: T[],
  start: number,
  end: number,
) {
  const next: T[] = [];
  for (const item of items) {
    if (item.end <= start || item.start >= end) next.push(item);
    else {
      if (item.start < start) next.push({ ...item, end: start });
      if (item.end > end) next.push({ ...item, start: end });
    }
  }
  return next;
}

function HymnWorkspace({
  hymn,
  index,
  canDelete,
  printRequest,
  onChange,
  onDelete,
}: {
  hymn: Hymn;
  index: number;
  canDelete: boolean;
  printRequest: number;
  onChange: (hymn: Hymn) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(!hymn.lyrics);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("sage");
  const lyricsRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const repeatModeRef = useRef<RepeatMode>(hymn.repeatMode);
  const repeatsDoneRef = useRef(0);

  useEffect(() => {
    if (printRequest > 0) setEditing(false);
  }, [printRequest]);

  useEffect(() => {
    repeatModeRef.current = hymn.repeatMode;
    repeatsDoneRef.current = 0;
  }, [hymn.repeatMode]);

  useEffect(() => {
    if (!hymn.videoId || !playerHostRef.current) return;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT || !playerHostRef.current) return;
      playerRef.current?.destroy();
      const mount = document.createElement("div");
      playerHostRef.current.replaceChildren(mount);
      playerRef.current = new window.YT.Player(mount, {
        videoId: hymn.videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: ({ data }) => {
            if (data !== 0 || !playerRef.current) return;
            const mode = repeatModeRef.current;
            const limit =
              mode === "once" ? 1 : mode === "three" ? 3 : mode === "continuous" ? Infinity : 0;
            if (repeatsDoneRef.current < limit) {
              repeatsDoneRef.current += 1;
              playerRef.current.seekTo(0, true);
              playerRef.current.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [hymn.videoId]);

  const segments = useMemo(() => {
    const boundaries = new Set([0, hymn.lyrics.length]);
    hymn.highlights.forEach(({ start, end }) => {
      boundaries.add(start);
      boundaries.add(end);
    });
    hymn.melismas.forEach(({ start, end }) => {
      boundaries.add(start);
      boundaries.add(end);
    });
    const points = [...boundaries]
      .filter((point) => point >= 0 && point <= hymn.lyrics.length)
      .sort((a, b) => a - b);
    return points.slice(0, -1).map((start, segmentIndex) => {
      const end = points[segmentIndex + 1];
      const highlight = hymn.highlights.find((mark) => mark.start <= start && mark.end >= end);
      const melisma = hymn.melismas.find((mark) => mark.start <= start && mark.end >= end);
      return {
        text: hymn.lyrics.slice(start, end),
        color: highlight?.color,
        melisma: melisma?.kind,
      };
    });
  }, [hymn.lyrics, hymn.highlights, hymn.melismas]);

  function remember() {
    setHistory((current) => [
      ...current.slice(-19),
      { highlights: hymn.highlights, melismas: hymn.melismas },
    ]);
  }

  function markSelection() {
    const selection = window.getSelection();
    const container = lyricsRef.current;
    if (!selection || selection.isCollapsed || !selection.rangeCount || !container) return;
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;
    const beforeStart = range.cloneRange();
    beforeStart.selectNodeContents(container);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange();
    beforeEnd.selectNodeContents(container);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    const start = beforeStart.toString().length;
    const end = beforeEnd.toString().length;
    if (start === end) return;

    remember();
    let highlights = hymn.highlights;
    let melismas = hymn.melismas;

    if (activeTool === "eraser") {
      highlights = subtractRange(highlights, start, end);
      melismas = subtractRange(melismas, start, end);
    } else if (activeTool === "melisma-simple" || activeTool === "melisma-complex") {
      melismas = subtractRange(melismas, start, end);
      melismas.push({
        start,
        end,
        kind: activeTool === "melisma-simple" ? "simple" : "complex",
      });
      melismas.sort((a, b) => a.start - b.start);
    } else {
      highlights = subtractRange(highlights, start, end);
      highlights.push({ start, end, color: activeTool });
      highlights.sort((a, b) => a.start - b.start);
    }

    onChange({ ...hymn, highlights, melismas });
    selection.removeAllRanges();
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    onChange({ ...hymn, ...previous });
    setHistory((current) => current.slice(0, -1));
  }

  function loadVideo() {
    onChange({ ...hymn, videoId: youtubeId(hymn.videoInput) });
  }

  function changeTargetSpeed(amount: number) {
    const next = Math.min(2, Math.max(0.25, Math.round((hymn.targetSpeed + amount) * 20) / 20));
    onChange({ ...hymn, targetSpeed: next });
  }

  return (
    <section
      className={`hymn-block ${hymn.lyrics ? "printable-hymn" : "empty-hymn-block"}`}
      id={hymn.id}
      aria-label={`Hymn ${index + 1}`}
    >
      <div className="hymn-strip">
        <span>Hymn {String(index + 1).padStart(2, "0")}</span>
        {canDelete && (
          <button
            className="delete-hymn"
            onClick={() => {
              if (window.confirm("Remove this hymn and all its annotations?")) onDelete();
            }}
            aria-label={`Remove hymn ${index + 1}`}
            title="Remove hymn"
          >
            ×
          </button>
        )}
      </div>

      <div className="workspace">
        <article className="panel lyrics-panel">
          <div className="panel-heading">
            <div className="hymn-heading-fields">
              <p className="section-label">Κείμενον</p>
              {editing ? (
                <>
                  <input
                    className="title-editor"
                    value={hymn.title}
                    onChange={(event) => onChange({ ...hymn, title: event.target.value })}
                    aria-label={`Title for hymn ${index + 1}`}
                    placeholder="Hymn title"
                  />
                  <input
                    className="mode-editor"
                    value={hymn.mode}
                    onChange={(event) => onChange({ ...hymn, mode: event.target.value })}
                    aria-label={`Mode for hymn ${index + 1}`}
                    placeholder="Mode or note (optional)"
                  />
                </>
              ) : (
                <>
                  <h2>{hymn.title || "Untitled hymn"}</h2>
                  {hymn.mode && <p className="mode">{hymn.mode}</p>}
                </>
              )}
            </div>
            <button className="text-button" onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Edit text"}
            </button>
          </div>

          <div className="type-controls" aria-label={`Text display settings for hymn ${index + 1}`}>
            <label>
              Text size
              <input
                type="range"
                min="20"
                max="40"
                value={hymn.fontSize}
                onChange={(event) => onChange({ ...hymn, fontSize: +event.target.value })}
              />
            </label>
            <label>
              Spacing
              <input
                type="range"
                min="1.4"
                max="2.4"
                step="0.1"
                value={hymn.lineHeight}
                onChange={(event) => onChange({ ...hymn, lineHeight: +event.target.value })}
              />
            </label>
          </div>

          {!editing && (
            <div className="highlighter-bar" aria-label={`Annotations for hymn ${index + 1}`}>
              <span className="tool-label">Phrase</span>
              <div className="swatches">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`swatch swatch-${color.value} ${activeTool === color.value ? "active" : ""}`}
                    onClick={() => setActiveTool(color.value)}
                    aria-label={`${color.name} highlighter`}
                    title={color.name}
                  />
                ))}
              </div>
              <span className="annotation-divider" aria-hidden="true" />
              <span className="tool-label">Melisma</span>
              <button
                className={`melisma-tool ${activeTool === "melisma-simple" ? "active" : ""}`}
                onClick={() => setActiveTool("melisma-simple")}
                aria-label="Short melisma"
                title="Short melisma"
              >
                <span className="melisma-sample simple">μ</span> Short
              </button>
              <button
                className={`melisma-tool ${activeTool === "melisma-complex" ? "active" : ""}`}
                onClick={() => setActiveTool("melisma-complex")}
                aria-label="Long melisma"
                title="Long or complex melisma"
              >
                <span className="melisma-sample complex">μ</span> Long
              </button>
              <span className="annotation-divider" aria-hidden="true" />
              <button
                className={`tool-button ${activeTool === "eraser" ? "active" : ""}`}
                onClick={() => setActiveTool("eraser")}
                aria-label="Eraser"
              >
                Eraser
              </button>
              <button className="tool-button" onClick={undo} disabled={!history.length}>
                Undo
              </button>
              <button
                className="tool-button clear"
                onClick={() => {
                  remember();
                  onChange({ ...hymn, highlights: [], melismas: [] });
                }}
                disabled={!hymn.highlights.length && !hymn.melismas.length}
              >
                Clear
              </button>
            </div>
          )}

          {editing ? (
            <textarea
              className="lyrics-editor"
              value={hymn.lyrics}
              onChange={(event) => {
                setHistory([]);
                onChange({
                  ...hymn,
                  lyrics: event.target.value,
                  highlights: [],
                  melismas: [],
                });
              }}
              aria-label={`Greek lyrics for hymn ${index + 1}`}
              placeholder="Paste or type the Greek text here…"
              spellCheck={false}
            />
          ) : hymn.lyrics ? (
            <div
              ref={lyricsRef}
              className={`lyrics selection-${activeTool}`}
              lang="grc"
              style={{ fontSize: hymn.fontSize, lineHeight: hymn.lineHeight }}
              onMouseUp={markSelection}
              onTouchEnd={markSelection}
            >
              {segments.map((segment, segmentIndex) => (
                <span
                  key={segmentIndex}
                  className={[
                    segment.color ? `mark-${segment.color}` : "",
                    segment.melisma ? `melisma-${segment.melisma}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {segment.text}
                </span>
              ))}
            </div>
          ) : (
            <button className="empty-lyrics" onClick={() => setEditing(true)}>
              Add the Greek lyrics
            </button>
          )}
          <p className="practice-hint">
            Colours divide melodic phrases; a single or double underline marks the melismatic syllables.
          </p>
          {hymn.targetSpeed !== 1 && (
            <p className="print-meta">Practice speed: {hymn.targetSpeed.toFixed(2)}×</p>
          )}
        </article>

        <aside className="panel video-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Ἄκουσμα</p>
              <h2>Reference recording</h2>
            </div>
            <div className="speed-badge" aria-label={`Practice at ${hymn.targetSpeed.toFixed(2)} times speed`}>
              <span>Practice at</span>
              <strong>{hymn.targetSpeed.toFixed(2)}×</strong>
            </div>
          </div>
          <div className="video-frame">
            {hymn.videoId ? (
              <div
                ref={playerHostRef}
                className="youtube-player"
                aria-label={`Reference recording for hymn ${index + 1}`}
              />
            ) : (
              <div className="video-empty">
                <div className="play-icon" aria-hidden="true">▶</div>
                <h3>Add your recording</h3>
                <p>Paste a YouTube link below to keep the chant and its text side by side.</p>
              </div>
            )}
          </div>

          <div className="speed-control" aria-label={`Target practice speed for hymn ${index + 1}`}>
            <div className="speed-copy">
              <span>Target practice speed</span>
              <p>Set the YouTube player to this value before practising.</p>
            </div>
            <div className="speed-stepper">
              <button
                onClick={() => changeTargetSpeed(-0.05)}
                disabled={hymn.targetSpeed <= 0.25}
                aria-label="Decrease target speed by 0.05"
              >
                −
              </button>
              <output aria-live="polite">{hymn.targetSpeed.toFixed(2)}×</output>
              <button
                onClick={() => changeTargetSpeed(0.05)}
                disabled={hymn.targetSpeed >= 2}
                aria-label="Increase target speed by 0.05"
              >
                +
              </button>
              {hymn.targetSpeed !== 1 && (
                <button
                  className="speed-reset"
                  onClick={() => onChange({ ...hymn, targetSpeed: 1 })}
                  aria-label="Reset target speed to original"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {hymn.videoId && (
            <div className="repeat-controls" aria-label={`Video repetition for hymn ${index + 1}`}>
              <span>Repeat video</span>
              <div className="repeat-options">
                {([
                  ["off", "No repeat"],
                  ["once", "Repeat once"],
                  ["three", "Repeat 3×"],
                  ["continuous", "Continuous"],
                ] as [RepeatMode, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    className={hymn.repeatMode === value ? "active" : ""}
                    onClick={() => onChange({ ...hymn, repeatMode: value })}
                    aria-pressed={hymn.repeatMode === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="video-input">
            <label htmlFor={`youtube-url-${hymn.id}`}>YouTube link</label>
            <div className="input-row">
              <input
                id={`youtube-url-${hymn.id}`}
                value={hymn.videoInput}
                onChange={(event) => onChange({ ...hymn, videoInput: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && loadVideo()}
                placeholder="https://youtube.com/watch?v=…"
              />
              <button onClick={loadVideo}>Load</button>
            </div>
            {hymn.videoInput && !youtubeId(hymn.videoInput) && (
              <p className="error">Please enter a valid YouTube link.</p>
            )}
          </div>

          <div className="practice-card">
            <span className="ornament" aria-hidden="true">✣</span>
            <div>
              <h3>Practice method</h3>
              <p>Listen to one phrase, pause, sing it back, then follow the full recording without stopping.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function Home() {
  const [hymns, setHymns] = useState<Hymn[]>([FIRST_HYMN]);
  const [hydrated, setHydrated] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("psaltikon-practice");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data.hymns) && data.hymns.length) {
          setHymns(data.hymns.map((hymn: Partial<Hymn>, index: number) => normalizeHymn(hymn, `hymn-${index}`)));
        } else {
          setHymns([
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
          ]);
        }
      } catch {}
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("psaltikon-practice", JSON.stringify({ version: 3, hymns }));
  }, [hymns, hydrated]);

  function updateHymn(updated: Hymn) {
    setHymns((current) => current.map((hymn) => (hymn.id === updated.id ? updated : hymn)));
  }

  function addHymn() {
    const hymn = newHymn();
    setHymns((current) => [...current, hymn]);
    window.setTimeout(() => {
      document.getElementById(hymn.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function exportLyricsPdf() {
    setPrintRequest((current) => current + 1);
    window.setTimeout(async () => {
      await document.fonts.ready;
      window.print();
    }, 180);
  }

  function exportBackup() {
    const backup = JSON.stringify(
      { version: 4, exportedAt: new Date().toISOString(), hymns },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `psaltikon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.hymns) || !data.hymns.length) throw new Error("Invalid backup");
      setHymns(
        data.hymns.map((hymn: Partial<Hymn>, index: number) =>
          normalizeHymn(hymn, `hymn-${index}`),
        ),
      );
      window.alert("Backup imported successfully.");
    } catch {
      window.alert("This file is not a valid Psaltikon backup.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">Ψ</div>
        <div>
          <p className="eyebrow">Μελέτη Ψαλτικής</p>
          <h1>Psaltikon</h1>
        </div>
        <div className="header-note">Listen · Read · Repeat</div>
        <div className="header-actions">
          <button className="backup-button" onClick={exportBackup} title="Save all hymns and annotations">
            Export backup
          </button>
          <button className="backup-button" onClick={() => backupInputRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={backupInputRef}
            className="backup-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            aria-label="Import Psaltikon backup"
          />
          <button
            className="export-pdf"
            onClick={exportLyricsPdf}
            title="Portrait PDF sized for comfortable reading on a phone"
          >
            <span aria-hidden="true">↓</span>
            Export mobile PDF
          </button>
        </div>
      </header>

      <div className="hymn-list">
        {hymns.map((hymn, index) => (
          <HymnWorkspace
            key={hymn.id}
            hymn={hymn}
            index={index}
            canDelete={index > 0}
            printRequest={printRequest}
            onChange={updateHymn}
            onDelete={() => setHymns((current) => current.filter((item) => item.id !== hymn.id))}
          />
        ))}
      </div>

      <button className="add-hymn" onClick={addHymn}>
        <span aria-hidden="true">+</span>
        Add another hymn
      </button>

      <footer>Ἄσωμεν τῷ Κυρίῳ · A quiet place for daily practice</footer>
    </main>
  );
}
