import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("YouTube player exposes loading, failure and retry feedback without autoplay", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/videoStatus.css", import.meta.url), "utf8");

  assert.match(source, /type PlayerLoadStatus = "loading" \| "ready" \| "error"/);
  assert.match(source, /onReady: markReady/);
  assert.match(source, /onError: markError/);
  assert.match(source, /YOUTUBE_LOAD_TIMEOUT_MS/);
  assert.match(source, /Carregando gravação…/);
  assert.match(source, /Não foi possível carregar a gravação\./);
  assert.match(source, /Tentar novamente/);
  assert.match(source, /onClick=\{retryVideo\}/);
  assert.match(source, /playerVars: \{ rel: 0, modestbranding: 1 \}/);
  assert.doesNotMatch(source, /playerVars: \{[^}]*autoplay\s*:\s*1/);
  assert.match(styles, /\.video-status/);
  assert.match(styles, /\.video-spinner/);
  assert.match(styles, /prefers-reduced-motion/);
});
