import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("YouTube playback compatibility exposes 0.05 steps within the native range", async () => {
  const source = await readFile(new URL("../src/youtubePlaybackCompatibility.ts", import.meta.url), "utf8");

  assert.match(source, /const GRANULAR_STEP = 0\.05/);
  assert.match(source, /granularPlaybackRates\(rates: number\[\]\)/);
  assert.match(source, /Math\.round\(step \* GRANULAR_STEP \* 100\) \/ 100/);
  assert.match(source, /player\.getAvailablePlaybackRates = \(\) => granularPlaybackRates/);
});

test("granular controls stay enabled when YouTube temporarily reports only normal speed", async () => {
  const source = await readFile(new URL("../src/youtubePlaybackCompatibility.ts", import.meta.url), "utf8");

  assert.match(source, /const FALLBACK_MIN_RATE = 0\.25/);
  assert.match(source, /const FALLBACK_MAX_RATE = 2/);
  assert.match(source, /if \(nativeRates\.length <= 1\)/);
  assert.match(source, /granularRange\(FALLBACK_MIN_RATE, FALLBACK_MAX_RATE, nativeRates\)/);
});

test("granular requests retry on first playback and fall back safely when YouTube clamps them", async () => {
  const source = await readFile(new URL("../src/youtubePlaybackCompatibility.ts", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

  assert.match(source, /pendingRate = requested/);
  assert.match(source, /event\.data !== 1/);
  assert.match(source, /nativeFallback\(fallbackRates, before, requested\)/);
  assert.match(source, /nativeSetPlaybackRate\(fallback\)/);
  assert.match(source, /state === undefined \|\| state === 1 \|\| state === 2 \|\| state === 3/);
  assert.match(main, /import "\.\/youtubePlaybackCompatibility"/);
});
