import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("YouTube integration observes real playback speed without commanding it", async () => {
  const source = await readFile(new URL("../src/youtubePlaybackCompatibility.ts", import.meta.url), "utf8");

  assert.match(source, /getPlaybackRate\?: \(\) => number/);
  assert.match(source, /onPlaybackRateChange\(event: PlayerEvent\)/);
  assert.match(source, /lastObservedRate = event\.data/);
  assert.match(source, /readCurrentRate\(event\.target\)/);
  assert.doesNotMatch(source, /setPlaybackRate/);
  assert.doesNotMatch(source, /getAvailablePlaybackRates/);
  assert.doesNotMatch(source, /GRANULAR_STEP/);
});

test("observed speed is compared with the saved suggestion and exposed accessibly", async () => {
  const source = await readFile(new URL("../src/youtubePlaybackCompatibility.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/playbackSpeedObserver.css", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

  assert.match(source, /parseDesiredRate\(control: HTMLElement\)/);
  assert.match(source, /corresponde à sugestão/);
  assert.match(source, /ajuste no player/);
  assert.match(source, /control\.setAttribute\("aria-label"/);
  assert.match(source, /new MutationObserver\(refreshLabel\)/);
  assert.match(styles, /content: attr\(data-video-speed\)/);
  assert.match(main, /import "\.\/youtubePlaybackCompatibility"/);
});
