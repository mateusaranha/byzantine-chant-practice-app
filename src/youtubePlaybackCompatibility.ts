const PATCH_MARKER = "__psaltikonGranularPlaybackPatched" as const;
const GRANULAR_STEP = 0.05;
const FALLBACK_MIN_RATE = 0.25;
const FALLBACK_MAX_RATE = 2;
const EPSILON = 0.001;
const VERIFY_DELAY_MS = 180;

type PlayerStateEvent = { data: number };

type PlayerLike = {
  getAvailablePlaybackRates: () => number[];
  getPlaybackRate: () => number;
  getPlayerState?: () => number;
  setPlaybackRate: (rate: number) => void;
};

type PlayerOptions = {
  events?: {
    onStateChange?: (event: PlayerStateEvent) => void;
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

function sameRate(a: number, b: number) {
  return Math.abs(a - b) < EPSILON;
}

function validRates(rates: number[]) {
  return [...new Set(rates.filter((rate) => Number.isFinite(rate) && rate > 0))].sort((a, b) => a - b);
}

function granularRange(min: number, max: number, nativeRates: number[] = []) {
  const granular = new Set(nativeRates);
  const firstStep = Math.ceil((min - EPSILON) / GRANULAR_STEP);
  const lastStep = Math.floor((max + EPSILON) / GRANULAR_STEP);

  for (let step = firstStep; step <= lastStep; step += 1) {
    granular.add(Math.round(step * GRANULAR_STEP * 100) / 100);
  }

  return [...granular].sort((a, b) => a - b);
}

export function granularPlaybackRates(rates: number[]) {
  const nativeRates = validRates(rates);

  // The current embedded player can temporarily report only [1] through the
  // public IFrame API even though its own speed slider remains available from
  // 0.25x to 2x. Returning only [1] here makes Psaltikon disable both +/-
  // buttons after a native speed change such as 1.25x. Keep the historical
  // Psaltikon range as a defensive fallback until YouTube exposes the finer
  // values consistently through getAvailablePlaybackRates().
  if (nativeRates.length <= 1) {
    return granularRange(FALLBACK_MIN_RATE, FALLBACK_MAX_RATE, nativeRates);
  }

  return granularRange(nativeRates[0], nativeRates[nativeRates.length - 1], nativeRates);
}

function nativeFallback(rates: number[], before: number, requested: number) {
  const nativeRates = validRates(rates);
  if (requested > before + EPSILON) {
    return nativeRates.find((rate) => rate > before + EPSILON) ?? before;
  }
  if (requested < before - EPSILON) {
    return [...nativeRates].reverse().find((rate) => rate < before - EPSILON) ?? before;
  }
  return before;
}

function installGranularPlaybackCompatibility() {
  const psaltikonWindow = window as unknown as PsaltikonWindow;
  const yt = psaltikonWindow.YT;
  const OriginalPlayer = yt?.Player;
  if (!yt || !OriginalPlayer || OriginalPlayer[PATCH_MARKER]) return;

  const WrappedPlayer = function (element: HTMLElement, options: PlayerOptions) {
    let player: PlayerLike | null = null;
    let nativeSetPlaybackRate: ((rate: number) => void) | null = null;
    let nativeGetAvailablePlaybackRates: (() => number[]) | null = null;
    let pendingRate: number | null = null;
    let verificationTimer = 0;

    const verifyRequestedRate = (requested: number, before: number, fallbackRates: number[]) => {
      window.clearTimeout(verificationTimer);
      verificationTimer = window.setTimeout(() => {
        if (!player || !nativeSetPlaybackRate) return;
        const actual = player.getPlaybackRate();
        if (sameRate(actual, requested)) {
          pendingRate = null;
          return;
        }

        const fallback = nativeFallback(fallbackRates, before, requested);
        pendingRate = null;
        if (!sameRate(fallback, actual)) nativeSetPlaybackRate(fallback);
      }, VERIFY_DELAY_MS);
    };

    const originalEvents = options.events || {};
    const originalStateChange = originalEvents.onStateChange;
    const wrappedEvents = {
      ...originalEvents,
      onStateChange(event: PlayerStateEvent) {
        originalStateChange?.(event);
        if (event.data !== 1 || pendingRate === null || !player || !nativeSetPlaybackRate || !nativeGetAvailablePlaybackRates) return;

        const requested = pendingRate;
        const before = player.getPlaybackRate();
        const fallbackRates = nativeGetAvailablePlaybackRates();
        nativeSetPlaybackRate(requested);
        verifyRequestedRate(requested, before, fallbackRates);
      },
    };

    player = new OriginalPlayer(element, { ...options, events: wrappedEvents });
    nativeSetPlaybackRate = player.setPlaybackRate.bind(player);
    nativeGetAvailablePlaybackRates = player.getAvailablePlaybackRates.bind(player);

    player.getAvailablePlaybackRates = () => granularPlaybackRates(nativeGetAvailablePlaybackRates!());
    player.setPlaybackRate = (requested: number) => {
      if (!nativeSetPlaybackRate || !nativeGetAvailablePlaybackRates || !player) return;
      const before = player.getPlaybackRate();
      const fallbackRates = nativeGetAvailablePlaybackRates();
      const state = player.getPlayerState?.();
      pendingRate = requested;
      nativeSetPlaybackRate(requested);

      // The current embedded YouTube player exposes a 0.05-step native slider,
      // while getAvailablePlaybackRates() can still report only the older presets.
      // Try the finer requested value first. If YouTube clamps/rejects it, fall back
      // to the next native preset instead of leaving Psaltikon's control stuck.
      // Requests made before first playback are retried once when PLAYING begins.
      if (state === undefined || state === 1 || state === 2 || state === 3) {
        verifyRequestedRate(requested, before, fallbackRates);
      }
    };

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
    installGranularPlaybackCompatibility();
  };
  installGranularPlaybackCompatibility();
}
