import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("annotation history supports undo and redo without editing hidden markings", () => {
  assert.match(source, /const \[redoHistory, setRedoHistory\] = useState<HistoryEntry\[\]>\(\[\]\)/);
  assert.match(source, /function remember\(\) \{[\s\S]*setRedoHistory\(\[\]\);[\s\S]*\}/);

  assert.match(
    source,
    /function undo\(\) \{[\s\S]*setRedoHistory\(\(current\) => \[[\s\S]*highlights: hymn\.highlights, melismas: hymn\.melismas[\s\S]*onChange\(\{ \.\.\.hymn, \.\.\.previous \}\)[\s\S]*setHistory\(\(current\) => current\.slice\(0, -1\)\)/,
  );
  assert.match(
    source,
    /function redo\(\) \{[\s\S]*setHistory\(\(current\) => \[[\s\S]*highlights: hymn\.highlights, melismas: hymn\.melismas[\s\S]*onChange\(\{ \.\.\.hymn, \.\.\.next \}\)[\s\S]*setRedoHistory\(\(current\) => current\.slice\(0, -1\)\)/,
  );

  assert.match(source, /aria-label="Desfazer última alteração nas marcações"/);
  assert.match(source, /aria-label="Refazer última alteração nas marcações"/);
  assert.match(source, /<span aria-hidden="true">↶<\/span>/);
  assert.match(source, /<span aria-hidden="true">↷<\/span>/);

  assert.match(source, /disabled=\{!history\.length \|\| !coloursVisible \|\| !melismasVisible\}/);
  assert.match(source, /disabled=\{!redoHistory\.length \|\| !coloursVisible \|\| !melismasVisible\}/);
  assert.match(source, /setHistory\(\[\]\);\s*setRedoHistory\(\[\]\);/);
});
