import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("training speed controls drive and persist the real YouTube playback rate", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /getAvailablePlaybackRates: \(\) => number\[\]/);
  assert.match(source, /getPlaybackRate: \(\) => number/);
  assert.match(source, /setPlaybackRate: \(rate: number\) => void/);
  assert.match(source, /onPlaybackRateChange:/);
  assert.match(source, /persistPlaybackRate\(data\)/);
  assert.match(source, /target\.setPlaybackRate\(preferredRate\)/);
  assert.match(source, /player\.setPlaybackRate\(nextRate\)/);
  assert.match(source, /player\.setPlaybackRate\(1\)/);
  assert.match(source, /A velocidade é aplicada automaticamente ao vídeo e salva neste hino\./);
});

test("speed controls use the video's supported rates and never move the reset action", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /supportedPlaybackRates\(target\.getAvailablePlaybackRates\(\)\)/);
  assert.match(source, /closestPlaybackRateIndex\(rates, hymnRef\.current\.targetSpeed\)/);
  assert.match(source, /disabled=\{!canDecreasePlaybackRate\}/);
  assert.match(source, /disabled=\{!canIncreasePlaybackRate\}/);
  assert.match(source, /className="speed-reset"[\s\S]*?disabled=\{!playbackControlsReady \|\| Math\.abs\(hymn\.targetSpeed - 1\) < 0\.001\}/);
  assert.doesNotMatch(source, /\{hymn\.targetSpeed !== 1 && \(\s*<button\s+className="speed-reset"/);
  assert.doesNotMatch(source, /changeTargetSpeed/);
});
