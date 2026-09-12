import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("training speed remains a saved 0.05-step practice suggestion", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /function changeTargetSpeed\(amount: number\)/);
  assert.match(source, /Math\.round\(\(hymn\.targetSpeed \+ amount\) \* 20\) \/ 20/);
  assert.match(source, /onClick=\{\(\) => changeTargetSpeed\(-0\.05\)\}/);
  assert.match(source, /onClick=\{\(\) => changeTargetSpeed\(0\.05\)\}/);
  assert.match(source, /Velocidade de treino desejada/);
  assert.match(source, /Ajuste o vídeo do YouTube para este valor antes de praticar\./);
  assert.doesNotMatch(source, /setPlaybackRate/);
});

test("training speed keeps historical bounds and the reset slot is visually stable", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/playbackSpeedObserver.css", import.meta.url), "utf8");

  assert.match(source, /Math\.min\(2, Math\.max\(0\.25,/);
  assert.match(source, /disabled=\{hymn\.targetSpeed <= 0\.25\}/);
  assert.match(source, /disabled=\{hymn\.targetSpeed >= 2\}/);
  assert.match(styles, /\.speed-stepper:not\(:has\(\.speed-reset\)\)::after/);
  assert.match(styles, /content: "Restaurar"/);
});
