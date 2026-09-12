import "./playbackSpeedObserver.css";

const PATCH_MARKER = "__psaltikonPlaybackObserverPatched" as const;
const EPSILON = 0.001;

type PlayerEvent = { data: number };
type PlayerReadyEvent = { target: PlayerLike };

type PlayerLike = {
  destroy?: () => void;
  getPlaybackRate?: () => number;
};

type PlayerOptions = {
  events?: {
    onReady?: (event: PlayerReadyEvent) => void;
    onError?: () => void;
    onStateChange?: (event: PlayerEvent) => void;
    onPlaybackRateChange?: (event: PlayerEvent) => void;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type PlayerConstructor = {
  new (element: HTMLElement, options: PlayerOptions): PlayerLike;
  prototype: unknown;
  [PATCH_MARKER]?: boolean;
};

type YouTubeGlobal = {
  Player?: PlayerConstructor;
};

type PsaltikonWindow = {
  YT?: YouTubeGlobal;
  onYouTubeIframeAPIReady?: () => void;
};

function parseDesiredRate(control: HTMLElement) {
  const text = control.querySelector(".speed-stepper output")?.textContent || "";
  const parsed = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRate(rate: number) {
  return `${rate.toFixed(2)}×`;
}

function updateObservedLabel(control: HTMLElement, rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  const copy = control.querySelector<HTMLElement>(".speed-copy");
  if (!copy) return;

  const desired = parseDesiredRate(control);
  const matches = desired !== null && Math.abs(desired - rate) < EPSILON;
  const message = matches
    ? `Vídeo agora: ${formatRate(rate)} · corresponde à sugestão`
    : `Vídeo agora: ${formatRate(rate)} · ajuste no player`;

  copy.dataset.videoSpeed = message;
  copy.dataset.videoSpeedMatch = matches ? "true" : "false";

  if (!control.dataset.baseAriaLabel) {
    control.dataset.baseAriaLabel = control.getAttribute("aria-label") || "Velocidade de treino";
  }
  control.setAttribute("aria-label", `${control.dataset.baseAriaLabel}. ${message}.`);
}

function clearObservedLabel(control: HTMLElement | null) {
  if (!control) return;
  const copy = control.querySelector<HTMLElement>(".speed-copy");
  if (copy) {
    delete copy.dataset.videoSpeed;
    delete copy.dataset.videoSpeedMatch;
  }
  if (control.dataset.baseAriaLabel) {
    control.setAttribute("aria-label", control.dataset.baseAriaLabel);
  }
}

function installPlaybackObserver() {
  const psaltikonWindow = window as unknown as PsaltikonWindow;
  const yt = psaltikonWindow.YT;
  const OriginalPlayer = yt?.Player;
  if (!yt || !OriginalPlayer || OriginalPlayer[PATCH_MARKER]) return;

  const WrappedPlayer = function (element: HTMLElement, options: PlayerOptions) {
    let player: PlayerLike | null = null;

    // YouTube replaces the mount element with its iframe during construction.
    // Keep the surrounding panel before that happens so the observer can still
    // find Psaltikon's speed UI when onReady/onPlaybackRateChange fire later.
    const videoPanel = element.closest<HTMLElement>(".video-panel");
    let control: HTMLElement | null = videoPanel?.querySelector<HTMLElement>(".speed-control") || null;
    let desiredObserver: MutationObserver | null = null;
    let lastObservedRate: number | null = null;

    const findControl = () => {
      if (control?.isConnected) return control;
      control = videoPanel?.querySelector<HTMLElement>(".speed-control") || null;
      return control;
    };

    const refreshLabel = () => {
      const target = findControl();
      if (target && lastObservedRate !== null) updateObservedLabel(target, lastObservedRate);
    };

    const readCurrentRate = (source: PlayerLike | null = player) => {
      const rate = source?.getPlaybackRate?.();
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return;
      lastObservedRate = rate;
      refreshLabel();
    };

    const observeDesiredRate = () => {
      desiredObserver?.disconnect();
      const output = findControl()?.querySelector(".speed-stepper output");
      if (!output) return;
      desiredObserver = new MutationObserver(refreshLabel);
      desiredObserver.observe(output, { childList: true, characterData: true, subtree: true });
    };

    const originalEvents = options.events || {};
    const originalReady = originalEvents.onReady;
    const originalStateChange = originalEvents.onStateChange;
    const originalPlaybackRateChange = originalEvents.onPlaybackRateChange;

    const wrappedEvents = {
      ...originalEvents,
      onReady(event: PlayerReadyEvent) {
        originalReady?.(event);
        observeDesiredRate();
        readCurrentRate(event.target);
      },
      onPlaybackRateChange(event: PlayerEvent) {
        originalPlaybackRateChange?.(event);
        if (Number.isFinite(event.data) && event.data > 0) {
          lastObservedRate = event.data;
          refreshLabel();
        } else {
          readCurrentRate();
        }
      },
      onStateChange(event: PlayerEvent) {
        originalStateChange?.(event);
        readCurrentRate();
      },
    };

    player = new OriginalPlayer(element, { ...options, events: wrappedEvents });

    const nativeDestroy = player.destroy?.bind(player);
    if (nativeDestroy) {
      player.destroy = () => {
        desiredObserver?.disconnect();
        clearObservedLabel(findControl());
        nativeDestroy();
      };
    }

    return player;
  } as unknown as PlayerConstructor;

  Object.setPrototypeOf(WrappedPlayer, OriginalPlayer);
  WrappedPlayer.prototype = OriginalPlayer.prototype;
  WrappedPlayer[PATCH_MARKER] = true;
  yt.Player = WrappedPlayer;
}

if (typeof window !== "undefined") {
  const psaltikonWindow = window as unknown as PsaltikonWindow;
  const previousReady = psaltikonWindow.onYouTubeIframeAPIReady;
  psaltikonWindow.onYouTubeIframeAPIReady = () => {
    previousReady?.();
    installPlaybackObserver();
  };
  installPlaybackObserver();
}
