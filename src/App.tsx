import { useEffect, useMemo, useRef, useState } from "react";
import CloudLibrary from "./CloudLibrary";
import HelpDialog from "./HelpDialog";
import PdfExportDialog, { DEFAULT_PDF_EXPORT_SETTINGS } from "./PdfExportDialog";
import ReorderHymnsDialog from "./ReorderHymnsDialog";
import type { HelpPage } from "./HelpDialog";
import type { PdfExportSettings } from "./PdfExportDialog";
import {
  moveHymn,
  newHymn,
  normalizeHymn,
  readWorkspace,
  restoreHymns,
  writeWorkspace,
} from "./hymnState";
import type { Highlight, Hymn, Melisma, RepeatMode } from "./hymnState";
import { addSharedToWorkspace, loadPublishedSet, parseShareRequest, selectSharedHymns, workspaceUrl } from "./sharedHymns";
import type { SharedRoute } from "./sharedHymns";
import { projectTransliteration, transliterateGreek } from "./transliteration";

type ActiveTool =
  | "sage"
  | "sky"
  | "rose"
  | "wheat"
  | "lavender"
  | "melisma-simple"
  | "melisma-complex"
  | "eraser"
  | null;
type PlayerStateEvent = { data: number };
type YouTubePlayer = {
  destroy: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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
  { name: "Verde-sálvia", value: "sage" },
  { name: "Azul-celeste", value: "sky" },
  { name: "Rosa", value: "rose" },
  { name: "Trigo", value: "wheat" },
  { name: "Lavanda", value: "lavender" },
] as const;

function isColourTool(tool: ActiveTool) {
  return COLORS.some((color) => color.value === tool);
}

function isMelismaTool(tool: ActiveTool) {
  return tool === "melisma-simple" || tool === "melisma-complex";
}

const PUBLISHER_API_URL = String(import.meta.env.VITE_PUBLISHER_API_URL || "").replace(/\/$/, "");

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

function LyricsSegments({ segments }: { segments: ReturnType<typeof projectTransliteration> }) {
  return segments.map((segment, index) => (
    <span
      key={index}
      className={[
        segment.color ? `mark-${segment.color}` : "",
        segment.melisma ? `melisma-${segment.melisma}` : "",
      ].filter(Boolean).join(" ")}
    >
      {segment.text}
    </span>
  ));
}

function PrintPresentation({
  hymn,
  segments,
  transliterated,
  label,
}: {
  hymn: Hymn;
  segments: ReturnType<typeof projectTransliteration>;
  transliterated: boolean;
  label?: string;
}) {
  return (
    <article className="panel lyrics-panel print-presentation">
      <div className="panel-heading">
        <div className="hymn-heading-fields">
          <p className="section-label">Κείμενον</p>
          {label && <p className="print-script-label">{label}</p>}
          <h2>{hymn.title || "Novo hino"}</h2>
          {hymn.mode && <p className="mode">{hymn.mode}</p>}
        </div>
      </div>
      <div
        className={`lyrics ${transliterated ? "lyrics-transliterated" : ""}`}
        lang={transliterated ? "grc-Latn" : "grc"}
      >
        <LyricsSegments segments={segments} />
      </div>
      {hymn.targetSpeed !== 1 && (
        <p className="print-meta">Velocidade de treino: {hymn.targetSpeed.toFixed(2)}×</p>
      )}
    </article>
  );
}

function HymnWorkspace({
  hymn,
  index,
  canDelete,
  printRequest,
  printSettings,
  onChange,
  onDelete,
  onOpenGuide,
}: {
  hymn: Hymn;
  index: number;
  canDelete: boolean;
  printRequest: number;
  printSettings: PdfExportSettings;
  onChange: (hymn: Hymn) => void;
  onDelete: () => void;
  onOpenGuide: (trigger: HTMLButtonElement) => void;
}) {
  const [editing, setEditing] = useState(!hymn.lyrics);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [coloursVisible, setColoursVisible] = useState(true);
  const [melismasVisible, setMelismasVisible] = useState(true);
  const [transliterated, setTransliterated] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const repeatModeRef = useRef<RepeatMode>(hymn.repeatMode);
  const repeatsDoneRef = useRef(0);
  const toolsId = `hymn-tools-${hymn.id}`;
  const lyricsId = `hymn-lyrics-${hymn.id}`;

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

  const transliteration = useMemo(() => transliterateGreek(hymn.lyrics), [hymn.lyrics]);
  const transliteratedSegments = useMemo(
    () => projectTransliteration(transliteration, hymn.highlights, hymn.melismas),
    [transliteration, hymn.highlights, hymn.melismas],
  );

  function remember() {
    setHistory((current) => [
      ...current.slice(-19),
      { highlights: hymn.highlights, melismas: hymn.melismas },
    ]);
  }

  function markSelection() {
    if (transliterated) return;
    if (!activeTool) return;
    if (!coloursVisible && (isColourTool(activeTool) || activeTool === "eraser")) return;
    if (!melismasVisible && (isMelismaTool(activeTool) || activeTool === "eraser")) return;
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

  function toggleTools() {
    if (toolsOpen) setActiveTool(null);
    setToolsOpen(!toolsOpen);
  }

  function changeReading(showTransliteration: boolean) {
    setActiveTool(null);
    window.getSelection()?.removeAllRanges();
    setTransliterated(showTransliteration);
  }

  function toggleColours() {
    if (coloursVisible && (isColourTool(activeTool) || activeTool === "eraser")) {
      setActiveTool(null);
    }
    setColoursVisible((visible) => !visible);
  }

  function toggleMelismas() {
    if (melismasVisible && (isMelismaTool(activeTool) || activeTool === "eraser")) {
      setActiveTool(null);
    }
    setMelismasVisible((visible) => !visible);
  }

  return (
    <section
      className={[
        "hymn-block",
        hymn.lyrics ? "printable-hymn" : "empty-hymn-block",
        `print-text-${printSettings.textMode}`,
        printSettings.includeColours ? "" : "print-hide-colours",
        printSettings.includeMelismas ? "" : "print-hide-melismas",
      ].filter(Boolean).join(" ")}
      id={hymn.id}
      aria-label={`Hino ${index + 1}`}
    >
      <div className="hymn-strip">
        <span>Hino {String(index + 1).padStart(2, "0")}</span>
        {canDelete && (
          <button
            className="delete-hymn"
            onClick={() => {
              if (window.confirm("Remover este hino e todas as suas marcações?")) onDelete();
            }}
            aria-label={`Remover hino ${index + 1}`}
            title="Remover hino"
          >
            ×
          </button>
        )}
      </div>

      <div className="workspace screen-workspace">
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
                    aria-label={`Título do hino ${index + 1}`}
                    placeholder="Título do hino"
                  />
                  <input
                    className="mode-editor"
                    value={hymn.mode}
                    onChange={(event) => onChange({ ...hymn, mode: event.target.value })}
                    aria-label={`Modo ou observação do hino ${index + 1}`}
                    placeholder="Modo ou observação (opcional)"
                  />
                </>
              ) : (
                <>
                  <h2>{hymn.title || "Novo hino"}</h2>
                  {hymn.mode && <p className="mode">{hymn.mode}</p>}
                </>
              )}
            </div>
            <button className="text-button" onClick={() => {
              changeReading(false);
              setEditing(!editing);
            }}>
              {editing ? "Concluir" : transliterated ? "Editar grego" : "Editar texto"}
            </button>
          </div>

          {!editing && hymn.lyrics && (
            <div className="reading-controls">
              <div className="study-control-row">
                <div className="reading-options" role="group" aria-label={`Leitura do hino ${index + 1}`}>
                  <button
                    className={`tool-button reading-toggle ${transliterated ? "" : "active"}`}
                    aria-pressed={!transliterated}
                    aria-controls={lyricsId}
                    onClick={() => changeReading(false)}
                  >Grego</button>
                  <button
                    className={`tool-button reading-toggle ${transliterated ? "active" : ""}`}
                    aria-pressed={transliterated}
                    aria-controls={lyricsId}
                    onClick={() => changeReading(true)}
                  >Transliterado</button>
                </div>

                <div className="training-controls" aria-label={`Recursos de treino do hino ${index + 1}`}>
                  <span className="tool-label">Treino</span>
                  <button
                    className={`tool-button training-toggle ${coloursVisible ? "" : "active"}`}
                    onClick={toggleColours}
                    aria-pressed={!coloursVisible}
                    aria-label={coloursVisible ? "Ocultar cores" : "Mostrar cores"}
                    title={coloursVisible ? "Ocultar cores durante o treino" : "Mostrar novamente as cores"}
                  >
                    <span aria-hidden="true">{coloursVisible ? "◉" : "○"}</span>
                    {coloursVisible ? "Ocultar cores" : "Mostrar cores"}
                  </button>
                  <button
                    className={`tool-button training-toggle ${melismasVisible ? "" : "active"}`}
                    onClick={toggleMelismas}
                    aria-pressed={!melismasVisible}
                    aria-label={melismasVisible ? "Ocultar sublinhados" : "Mostrar sublinhados"}
                    title={melismasVisible ? "Ocultar sublinhados durante o treino" : "Mostrar novamente os sublinhados"}
                  >
                    <span aria-hidden="true">{melismasVisible ? "μ̲" : "μ"}</span>
                    {melismasVisible ? "Ocultar sublinhados" : "Mostrar sublinhados"}
                  </button>
                </div>
              </div>
              {transliterated && (
                <>
                  <p className="transliteration-note" id={`${lyricsId}-note`}>
                    Para editar o texto ou as marcações, volte para Grego.
                  </p>
                  <details className="transliteration-help">
                    <summary>Como ler a transliteração</summary>
                    <p>
                      Convenção baseada no livrinho da paróquia: <strong>y</strong> soa como <strong>i</strong>;
                      {" "}<strong>ch</strong> representa o χ grego, não o “ch” de “chuva”.
                      É um auxílio de leitura; continue usando a gravação como referência.
                    </p>
                    <p>Ao exportar o PDF, você pode escolher o grego, a transliteração ou as duas leituras.</p>
                  </details>
                </>
              )}
            </div>
          )}

          <div className={`tools-panel ${toolsOpen ? "" : "collapsed"}`}>
            <div className="tools-panel-heading">
              <span className="tool-label">
                Ferramentas de texto{toolsOpen ? "" : " · Modo cursor"}
              </span>
              <button
                className="tools-toggle"
                onClick={toggleTools}
                aria-expanded={toolsOpen}
                aria-controls={toolsId}
              >
                {toolsOpen ? "Recolher" : "Mostrar"}
                <span className="tools-toggle-icon" aria-hidden="true">
                  {toolsOpen ? "⌃" : "⌄"}
                </span>
              </button>
            </div>

            {toolsOpen && (
              <div id={toolsId} className="tools-panel-content">
                <div className="type-controls" aria-label={`Configurações de exibição do hino ${index + 1}`}>
                  <label>
                    Tamanho do texto
                    <input
                      type="range"
                      min="20"
                      max="40"
                      value={hymn.fontSize}
                      onChange={(event) => onChange({ ...hymn, fontSize: +event.target.value })}
                    />
                  </label>
                  <label>
                    Espaçamento
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

                {!editing && !transliterated && (
                  <div
                    className="highlighter-bar"
                    role="toolbar"
                    aria-label={`Ferramentas de marcação do hino ${index + 1}`}
                  >
                    <div className="annotation-row">
                      <div className="annotation-section selection-tools" role="group" aria-label="Cursor e borracha">
                        <button
                          className={`tool-button cursor-tool ${activeTool === null ? "active" : ""}`}
                          onClick={() => setActiveTool(null)}
                          aria-label="Nenhuma ferramenta de marcação"
                          aria-pressed={activeTool === null}
                          title="Selecionar texto sem alterar marcações"
                        >
                          <span aria-hidden="true">↖</span> Cursor
                        </button>
                        <button
                          className={`tool-button ${activeTool === "eraser" ? "active" : ""}`}
                          onClick={() => setActiveTool("eraser")}
                          disabled={!coloursVisible || !melismasVisible}
                          aria-label="Borracha"
                          aria-pressed={activeTool === "eraser"}
                        >
                          Borracha
                        </button>
                      </div>

                      <div className="annotation-section colour-controls" role="group" aria-label="Cores dos trechos">
                        <span className="tool-label">Trecho</span>
                        <div className="swatches">
                          {COLORS.map((color) => (
                            <button
                              key={color.value}
                              className={`swatch swatch-${color.value} ${activeTool === color.value ? "active" : ""}`}
                              onClick={() => setActiveTool(color.value)}
                              disabled={!coloursVisible}
                              aria-label={`Marcador ${color.name.toLowerCase()}`}
                              aria-pressed={activeTool === color.value}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="annotation-row">
                      <div className="annotation-section melisma-controls" role="group" aria-label="Sublinhados">
                        <span className="tool-label">Sublinhado</span>
                        <div className="melisma-options">
                          <button
                            className={`melisma-tool ${activeTool === "melisma-simple" ? "active" : ""}`}
                            onClick={() => setActiveTool("melisma-simple")}
                            disabled={!melismasVisible}
                            aria-label="Sublinhado simples"
                            aria-pressed={activeTool === "melisma-simple"}
                            title="Sublinhado simples"
                          >
                            <span className="melisma-sample simple">μ</span> Simples
                          </button>
                          <button
                            className={`melisma-tool ${activeTool === "melisma-complex" ? "active" : ""}`}
                            onClick={() => setActiveTool("melisma-complex")}
                            disabled={!melismasVisible}
                            aria-label="Sublinhado duplo"
                            aria-pressed={activeTool === "melisma-complex"}
                            title="Sublinhado duplo"
                          >
                            <span className="melisma-sample complex">μ</span> Duplo
                          </button>
                        </div>
                      </div>

                      <div className="annotation-section annotation-action-controls" role="group" aria-label="Ações de marcação">
                        <button
                          className="tool-button undo-tool"
                          onClick={undo}
                          disabled={!history.length || !coloursVisible || !melismasVisible}
                        >
                          <span aria-hidden="true">↶</span> Desfazer
                        </button>
                        <div className="clear-controls" role="group" aria-label="Limpar marcações">
                          <span className="tool-label">Limpar</span>
                          <button
                            className="tool-button clear"
                            onClick={() => {
                              remember();
                              onChange({ ...hymn, highlights: [] });
                            }}
                            disabled={!coloursVisible || !hymn.highlights.length}
                            aria-label="Limpar todas as cores deste hino"
                            title="Limpar cores: manter os sublinhados e remover somente as cores dos trechos"
                          >
                            Cores
                          </button>
                          <button
                            className="tool-button clear-melismas"
                            onClick={() => {
                              remember();
                              onChange({ ...hymn, melismas: [] });
                            }}
                            disabled={!melismasVisible || !hymn.melismas.length}
                            aria-label="Limpar todos os sublinhados deste hino"
                            title="Limpar sublinhados: manter as cores dos trechos e remover somente os sublinhados"
                          >
                            Sublinhados
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <textarea
              className="lyrics-editor"
              value={hymn.lyrics}
              onChange={(event) => {
                if (
                  (hymn.highlights.length || hymn.melismas.length) &&
                  !window.confirm("Alterar a letra removerá todas as cores e todos os sublinhados deste hino. Continuar?")
                ) return;
                setHistory([]);
                onChange({
                  ...hymn,
                  lyrics: event.target.value,
                  highlights: [],
                  melismas: [],
                });
              }}
              aria-label={`Texto grego do hino ${index + 1}`}
              placeholder="Cole ou digite o texto grego aqui…"
              spellCheck={false}
            />
          ) : hymn.lyrics ? (
            <>
              <div
                ref={lyricsRef}
                id={lyricsId}
                className={[
                  "lyrics",
                  transliterated ? "lyrics-transliterated" : "",
                  activeTool ? `selection-${activeTool}` : "selection-neutral",
                  coloursVisible ? "" : "training-hide-colours",
                  melismasVisible ? "" : "training-hide-melismas",
                ]
                  .filter(Boolean)
                  .join(" ")}
                lang={transliterated ? "grc-Latn" : "grc"}
                aria-describedby={transliterated ? `${lyricsId}-note` : undefined}
                style={{
                  fontSize: hymn.fontSize,
                  lineHeight: hymn.lineHeight,
                }}
                onMouseUp={markSelection}
                onTouchEnd={markSelection}
              >
                <LyricsSegments segments={transliterated ? transliteratedSegments : segments} />
              </div>
            </>
          ) : (
            <button className="empty-lyrics" onClick={() => setEditing(true)}>
              Adicionar texto grego
            </button>
          )}
          <p className="practice-hint">
            Cores e sublinhados podem servir como lembretes do que você escutou na gravação.
            {" "}Veja uma sugestão de uso no <button className="help-link" aria-haspopup="dialog" onClick={(event) => onOpenGuide(event.currentTarget)}>Guia de estudo</button>.
          </p>
          {hymn.targetSpeed !== 1 && (
            <p className="print-meta">Velocidade de treino: {hymn.targetSpeed.toFixed(2)}×</p>
          )}
        </article>

        <aside className="panel video-panel">
          <div className="panel-heading compact">
            <div>
              <p className="section-label">Ἄκουσμα</p>
              <h2>Gravação de referência</h2>
            </div>
            <div className="speed-badge" aria-label={`Praticar a ${hymn.targetSpeed.toFixed(2)} vezes a velocidade normal`}>
              <span>Praticar a</span>
              <strong>{hymn.targetSpeed.toFixed(2)}×</strong>
            </div>
          </div>
          <div className="video-frame">
            {hymn.videoId ? (
              <div
                ref={playerHostRef}
                className="youtube-player"
                aria-label={`Gravação de referência do hino ${index + 1}`}
              />
            ) : (
              <div className="video-empty">
                <div className="play-icon" aria-hidden="true">▶</div>
                <h3>Adicione sua gravação</h3>
                <p>Cole abaixo um link do YouTube para manter o canto e o texto lado a lado.</p>
              </div>
            )}
          </div>

          <div className="speed-control" aria-label={`Velocidade de treino desejada para o hino ${index + 1}`}>
            <div className="speed-copy">
              <span>Velocidade de treino desejada</span>
              <p>Ajuste o vídeo do YouTube para este valor antes de praticar.</p>
            </div>
            <div className="speed-stepper">
              <button
                onClick={() => changeTargetSpeed(-0.05)}
                disabled={hymn.targetSpeed <= 0.25}
                aria-label="Diminuir a velocidade de treino em 0,05"
              >
                −
              </button>
              <output aria-live="polite">{hymn.targetSpeed.toFixed(2)}×</output>
              <button
                onClick={() => changeTargetSpeed(0.05)}
                disabled={hymn.targetSpeed >= 2}
                aria-label="Aumentar a velocidade de treino em 0,05"
              >
                +
              </button>
              {hymn.targetSpeed !== 1 && (
                <button
                  className="speed-reset"
                  onClick={() => onChange({ ...hymn, targetSpeed: 1 })}
                  aria-label="Restaurar a velocidade de treino original"
                >
                  Restaurar
                </button>
              )}
            </div>
          </div>

          {hymn.videoId && (
            <div className="repeat-controls" aria-label={`Repetição do vídeo do hino ${index + 1}`}>
              <span>Repetir vídeo</span>
              <div className="repeat-options">
                {([
                  ["off", "Sem repetição"],
                  ["once", "Repetir 1×"],
                  ["three", "Repetir 3×"],
                  ["continuous", "Contínuo"],
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
            <label htmlFor={`youtube-url-${hymn.id}`}>Link do YouTube</label>
            <div className="input-row">
              <input
                id={`youtube-url-${hymn.id}`}
                value={hymn.videoInput}
                onChange={(event) => onChange({ ...hymn, videoInput: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && loadVideo()}
                placeholder="https://youtube.com/watch?v=…"
              />
              <button onClick={loadVideo}>Carregar</button>
            </div>
            {hymn.videoInput && !youtubeId(hymn.videoInput) && (
              <p className="error">Informe um link válido do YouTube.</p>
            )}
          </div>

          <p className="practice-hint video-guide-hint">
            Como escolher uma gravação e praticar? <button className="help-link" aria-haspopup="dialog" onClick={(event) => onOpenGuide(event.currentTarget)}>Abra o Guia de estudo</button>.
          </p>
        </aside>
      </div>
      {hymn.lyrics && printSettings.textMode !== "screen" && (
        <div className="print-presentations" aria-hidden="true">
          {(printSettings.textMode === "greek" || printSettings.textMode === "both") && (
            <PrintPresentation
              hymn={hymn}
              segments={segments}
              transliterated={false}
              label={printSettings.textMode === "both" ? "Grego" : undefined}
            />
          )}
          {(printSettings.textMode === "transliterated" || printSettings.textMode === "both") && (
            <PrintPresentation
              hymn={hymn}
              segments={transliteratedSegments}
              transliterated
              label={printSettings.textMode === "both" ? "Transliteração" : undefined}
            />
          )}
        </div>
      )}
    </section>
  );
}

function LocalWorkspace() {
  const [hymns, setHymns] = useState<Hymn[]>(() => [newHymn()]);
  const [hydrated, setHydrated] = useState(false);
  const [storageProblem, setStorageProblem] = useState<
    { kind: "read"; raw: string | null; writeFailed?: boolean } | { kind: "write" } | null
  >(null);
  const [printRequest, setPrintRequest] = useState(0);
  const [printSettings, setPrintSettings] = useState<PdfExportSettings>(DEFAULT_PDF_EXPORT_SETTINGS);
  const [pdfTrigger, setPdfTrigger] = useState<HTMLButtonElement | null>(null);
  const [cloudOpen, setCloudOpen] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).has("psaltikon_token"),
  );
  const [help, setHelp] = useState<{ page: HelpPage; trigger: HTMLButtonElement } | null>(null);
  const [reorderTrigger, setReorderTrigger] = useState<HTMLButtonElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = readWorkspace(localStorage);
    if (stored.status === "ready") setHymns(stored.hymns);
    if (stored.status === "unreadable") setStorageProblem({ kind: "read", raw: stored.raw });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || storageProblem) return;
    try {
      writeWorkspace(localStorage, hymns);
    } catch {
      setStorageProblem({ kind: "write" });
    }
  }, [hymns, hydrated, storageProblem]);

  function retryWorkspaceSave() {
    try {
      writeWorkspace(localStorage, hymns);
      setStorageProblem(null);
    } catch {
      setStorageProblem((current) => current?.kind === "read"
        ? { ...current, writeFailed: true }
        : { kind: "write" });
    }
  }

  function replaceUnreadableWorkspace() {
    if (!window.confirm("Substituir os dados que não puderam ser lidos pelo espaço que está aberto agora? Esta ação não pode ser desfeita.")) return;
    retryWorkspaceSave();
  }

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

  function exportLyricsPdf(settings: PdfExportSettings) {
    setPrintSettings(settings);
    setPrintRequest((current) => current + 1);
    setPdfTrigger(null);
    window.setTimeout(async () => {
      await document.fonts.ready;
      window.print();
    }, 180);
  }

  function exportBackup() {
    downloadBackup(hymns);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const restored = restoreHymns(data);
      if (!restored) throw new Error("Cópia de segurança inválida");
      const currentLabel = hymns.length === 1 ? "o hino atual" : `os ${hymns.length} hinos atuais`;
      if (!window.confirm(`Importar esta cópia de segurança substituirá ${currentLabel}. Continuar?`)) return;
      setHymns(restored);
      window.alert("Cópia de segurança importada com sucesso.");
    } catch {
      window.alert("Este arquivo não é uma cópia de segurança válida do Psaltikon.");
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
        <div className="header-note">Escute · Leia · Repita</div>
        <div className="header-actions">
          {PUBLISHER_API_URL && (
            <button className="backup-button cloud-trigger" onClick={() => setCloudOpen((open) => !open)}>
              Biblioteca online
            </button>
          )}
          <button className="backup-button" onClick={exportBackup} title="Salvar todos os hinos e marcações em um arquivo">
            Exportar cópia de segurança
          </button>
          <button
            className="backup-button"
            onClick={() => backupInputRef.current?.click()}
            title="Substituir o espaço atual por uma cópia de segurança do Psaltikon"
          >
            Importar cópia de segurança
          </button>
          <input
            ref={backupInputRef}
            className="backup-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            aria-label="Importar cópia de segurança do Psaltikon"
          />
          <button
            className="export-pdf"
            onClick={(event) => setPdfTrigger(event.currentTarget)}
            title="PDF em formato vertical para leitura confortável no celular"
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">↓</span>
            Exportar PDF para celular
          </button>
        </div>
      </header>

      {storageProblem && (
        <section className="workspace-storage-notice" role="alert" aria-label="Problema no salvamento automático">
          <div>
            <strong>Salvamento automático pausado</strong>
            {storageProblem.kind === "read" ? (
              <p>
                O trabalho salvo neste dispositivo não pôde ser lido. Nada foi substituído. Você pode exportar
                os dados originais antes de substituí-los pelo espaço aberto agora.
                {storageProblem.writeFailed ? " A tentativa de salvar novamente também falhou." : ""}
              </p>
            ) : (
              <p>
                Não foi possível salvar as últimas alterações neste dispositivo. Elas continuam nesta página,
                mas podem ser perdidas ao fechá-la. Exporte uma cópia de segurança antes de sair.
              </p>
            )}
          </div>
          <div className="workspace-storage-actions">
            {storageProblem.kind === "read" && storageProblem.raw !== null && (
              <button onClick={() => downloadUnreadableWorkspace(storageProblem.raw!)}>Baixar dados não lidos</button>
            )}
            <button onClick={storageProblem.kind === "read" ? replaceUnreadableWorkspace : retryWorkspaceSave}>
              {storageProblem.kind === "read" ? "Substituir pelo espaço atual" : "Tentar salvar novamente"}
            </button>
          </div>
        </section>
      )}

      {PUBLISHER_API_URL && cloudOpen && (
        <CloudLibrary
          apiBase={PUBLISHER_API_URL}
          hymns={hymns}
          onClose={() => setCloudOpen(false)}
          onLoad={(savedHymns, title) => {
            setHymns(savedHymns.map((hymn, index) => normalizeHymn(hymn, `hymn-${index}`)));
            document.title = `${title} · Psaltikon`;
          }}
        />
      )}

      <div className="hymn-list">
        {hymns.map((hymn, index) => (
          <HymnWorkspace
            key={hymn.id}
            hymn={hymn}
            index={index}
            canDelete={index > 0}
            printRequest={printRequest}
            printSettings={printSettings}
            onChange={updateHymn}
            onOpenGuide={(trigger) => setHelp({ page: "guide", trigger })}
            onDelete={() => setHymns((current) => current.filter((item) => item.id !== hymn.id))}
          />
        ))}
      </div>

      <div className="hymn-list-actions">
        <button className="add-hymn" onClick={addHymn}>
          <span aria-hidden="true">+</span>
          Adicionar outro hino
        </button>
        {hymns.length > 1 && (
          <button className="organize-hymns" onClick={(event) => setReorderTrigger(event.currentTarget)}>
            <span aria-hidden="true">↕</span>
            Organizar hinos
          </button>
        )}
      </div>

      <footer>
        <span>Ἄσωμεν τῷ Κυρίῳ · Um espaço tranquilo para a prática diária</span>
        <nav className="footer-help" aria-label="Ajuda do Psaltikon">
          <button
            className="about-link"
            onClick={(event) => setHelp({ page: "guide", trigger: event.currentTarget })}
            aria-haspopup="dialog"
            aria-expanded={help?.page === "guide"}
          >
            Ajuda e guia
          </button>
          <button
            className="about-link"
            onClick={(event) => setHelp({ page: "about", trigger: event.currentTarget })}
            aria-haspopup="dialog"
            aria-expanded={help?.page === "about"}
          >
            Sobre
          </button>
        </nav>
      </footer>

      {help && <HelpDialog page={help.page} trigger={help.trigger} onClose={() => setHelp(null)} />}
      {pdfTrigger && (
        <PdfExportDialog
          trigger={pdfTrigger}
          onClose={() => setPdfTrigger(null)}
          onExport={exportLyricsPdf}
        />
      )}
      {reorderTrigger && (
        <ReorderHymnsDialog
          hymns={hymns}
          trigger={reorderTrigger}
          onMove={(id, direction) => setHymns((current) => moveHymn(current, id, direction))}
          onClose={() => setReorderTrigger(null)}
        />
      )}
    </main>
  );
}

function downloadBackup(hymns: Hymn[]) {
  const backup = JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), hymns }, null, 2);
  const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `psaltikon-copia-seguranca-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadUnreadableWorkspace(raw: string) {
  const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `psaltikon-dados-nao-lidos-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function SharedWorkspace({ route }: { route: SharedRoute }) {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copying, setCopying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [printRequest, setPrintRequest] = useState(0);
  const [printSettings, setPrintSettings] = useState<PdfExportSettings>(DEFAULT_PDF_EXPORT_SETTINGS);
  const [pdfTrigger, setPdfTrigger] = useState<HTMLButtonElement | null>(null);
  const [help, setHelp] = useState<{ page: HelpPage; trigger: HTMLButtonElement } | null>(null);
  const localUrl = workspaceUrl(window.location.href);

  useEffect(() => {
    if ("error" in route) { setError(route.error); return; }
    const controller = new AbortController();
    setError("");
    setHymns([]);
    const timeout = window.setTimeout(() => {
      controller.abort();
      setError("O carregamento demorou demais. Confira sua conexão e tente novamente.");
    }, 20000);
    loadPublishedSet(PUBLISHER_API_URL, route.path, controller.signal).then((published) => {
      if (controller.signal.aborted) return;
      const selected = selectSharedHymns(published, route.hymnId);
      setHymns(selected);
      setTitle(route.hymnId === null ? published.title : selected[0].title);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o material. Confira sua conexão.");
    }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [route, attempt]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title || "Material compartilhado"} · Psaltikon`;
    return () => { document.title = previous; };
  }, [title]);

  function addToMyWorkspace() {
    if (copying) return;
    setCopying(true);
    setCopyError("");
    try {
      addSharedToWorkspace(localStorage, hymns);
      window.location.assign(localUrl);
    } catch (reason) {
      setCopying(false);
      setCopyError(reason instanceof Error && reason.name === "Error" ? reason.message : "Não foi possível guardar a cópia neste dispositivo. Confira o espaço disponível e a permissão de armazenamento do navegador.");
    }
  }

  function exportPdf(settings: PdfExportSettings) {
    setPrintSettings(settings);
    setPrintRequest((current) => current + 1);
    setPdfTrigger(null);
    window.setTimeout(async () => { await document.fonts.ready; window.print(); }, 180);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">Ψ</div>
        <div><p className="eyebrow">Μελέτη Ψαλτικής</p><h1>Psaltikon</h1></div>
        <div className="header-note">Escute · Leia · Repita</div>
        <div className="header-actions">
          <a className="backup-button" href={localUrl}>Meu espaço</a>
          {!!hymns.length && <>
            <button className="backup-button" onClick={() => downloadBackup(hymns)}>Exportar cópia de segurança</button>
            <button
              className="export-pdf"
              onClick={(event) => setPdfTrigger(event.currentTarget)}
              aria-haspopup="dialog"
            >
              Exportar PDF para celular
            </button>
          </>}
        </div>
      </header>
      <section className="shared-notice" aria-label="Material compartilhado">
        <p className="section-label">Material compartilhado · público</p>
        <h2>{title || "Abrir material compartilhado"}</h2>
        <p>Você pode treinar e ajustar este material sem alterar a publicação nem seu trabalho local.</p>
        <p>“Adicionar ao meu espaço” guarda uma cópia com seus ajustes, sem substituir seus hinos. Sair ou atualizar esta página descarta os ajustes temporários.</p>
        {error ? <>
          <p role="alert">{error}</p>
          {!("error" in route) && <button className="cloud-secondary" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>}
        </> : !hymns.length ? <p role="status">Carregando letra, gravação e marcações…</p> : (
          <button className="cloud-primary" onClick={addToMyWorkspace} disabled={copying}>
            {copying ? "Adicionando…" : "Adicionar ao meu espaço"}
          </button>
        )}
        {copyError && <p role="alert">{copyError}</p>}
      </section>
      <div className="hymn-list">
        {hymns.map((hymn, index) => (
          <HymnWorkspace key={hymn.id} hymn={hymn} index={index} canDelete={false}
            printRequest={printRequest} printSettings={printSettings}
            onChange={(updated) => setHymns((current) => current.map((item) => item.id === updated.id ? updated : item))}
            onDelete={() => {}}
            onOpenGuide={(trigger) => setHelp({ page: "guide", trigger })} />
        ))}
      </div>
      <footer>
        <span>Ἄσωμεν τῷ Κυρίῳ · Um espaço tranquilo para a prática diária</span>
        <button
          className="about-link"
          onClick={(event) => setHelp({ page: "guide", trigger: event.currentTarget })}
          aria-haspopup="dialog"
          aria-expanded={help?.page === "guide"}
        >
          Ajuda e guia
        </button>
      </footer>
      {help && <HelpDialog page={help.page} trigger={help.trigger} onClose={() => setHelp(null)} />}
      {pdfTrigger && (
        <PdfExportDialog
          trigger={pdfTrigger}
          onClose={() => setPdfTrigger(null)}
          onExport={exportPdf}
        />
      )}
    </main>
  );
}

export default function Home() {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const route = useMemo(() => parseShareRequest(search), [search]);
  // The autosaving workspace is never mounted for shared links, including
  // loading/error states. Merely visiting a link cannot overwrite local work.
  return route ? <SharedWorkspace key={search} route={route} /> : <LocalWorkspace />;
}
