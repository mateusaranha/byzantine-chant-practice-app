import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadHymnState() {
  const source = await readFile(new URL("../src/hymnState.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

test("a new workspace starts with the same empty hymn used by the add command", async () => {
  const { newHymn, restoreHymns } = await loadHymnState();
  const hymn = newHymn();
  assert.equal(hymn.title, "");
  assert.equal(hymn.mode, "");
  assert.equal(hymn.lyrics, "");
  assert.equal(hymn.videoInput, "");
  assert.equal(hymn.videoId, "");
  assert.equal(hymn.targetSpeed, 1);
  assert.equal(hymn.repeatMode, "off");
  assert.deepEqual(hymn.highlights, []);
  assert.deepEqual(hymn.melismas, []);
  assert.equal(restoreHymns(null), null);
  assert.equal(restoreHymns({}), null);
  assert.equal(restoreHymns({ version: 3, hymns: [] }), null);
  assert.equal(restoreHymns({ version: 3, hymns: [null, "inválido"] }), null);

  const previouslyNamed = restoreHymns({
    version: 3,
    hymns: [{ title: "Novo hino", lyrics: "κείμενον" }],
  });
  assert.equal(previouslyNamed?.[0].title, "Novo hino");
});

test("saved and legacy workspaces are restored without replacing their content", async () => {
  const { restoreHymns } = await loadHymnState();
  const saved = restoreHymns({
    version: 3,
    hymns: [
      {
        id: "saved-hymn",
        title: "Hino salvo",
        mode: "Modo salvo",
        lyrics: "κείμενον",
        videoInput: "https://youtu.be/abcdefghijk",
        videoId: "abcdefghijk",
        targetSpeed: 0.85,
        repeatMode: "three",
        fontSize: 31,
        lineHeight: 2.1,
        highlights: [{ start: 0, end: 3, color: "sage" }],
        melismas: [{ start: 3, end: 6, kind: "simple" }],
      },
    ],
  });
  assert.equal(saved?.[0].title, "Hino salvo");
  assert.equal(saved?.[0].lyrics, "κείμενον");
  assert.equal(saved?.[0].targetSpeed, 0.85);
  assert.equal(saved?.[0].repeatMode, "three");
  assert.deepEqual(saved?.[0].highlights, [{ start: 0, end: 3, color: "sage" }]);
  assert.deepEqual(saved?.[0].melismas, [{ start: 3, end: 6, kind: "simple" }]);

  const legacy = restoreHymns({ lyrics: "παλαιόν", highlights: [] });
  assert.equal(legacy?.[0].title, "Ἀγγελικαὶ δυνάμεις");
  assert.equal(legacy?.[0].lyrics, "παλαιόν");
});

test("the production build contains the app shell and migration features", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const stateSource = await readFile(new URL("../src/hymnState.ts", import.meta.url), "utf8");
  const stylesSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const librarySource = await readFile(new URL("../src/CloudLibrary.tsx", import.meta.url), "utf8");
  assert.match(html, /Psaltikon/);
  assert.match(html, /manifest\.webmanifest/);

  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascriptName = assetNames.find((name) => name.endsWith(".js"));
  const stylesheetName = assetNames.find((name) => name.endsWith(".css"));
  const latinFontName = assetNames.find((name) => name.startsWith("noto-serif-latin-regular-") && name.endsWith(".woff"));
  assert.ok(javascriptName, "JavaScript bundle was not generated");
  assert.ok(stylesheetName, "Stylesheet was not generated");
  assert.ok(latinFontName, "Latin Noto Serif subset was not generated");

  const javascript = await readFile(new URL(`../dist/assets/${javascriptName}`, import.meta.url), "utf8");
  const stylesheet = await readFile(new URL(`../dist/assets/${stylesheetName}`, import.meta.url), "utf8");
  assert.match(javascript, /psaltikon-copia-seguranca-/);
  assert.match(javascript, /Exportar cópia de segurança/);
  assert.match(javascript, /Limpar cores/);
  assert.match(javascript, /Limpar melismas/);
  assert.match(javascript, /Nenhuma ferramenta de marcação/);
  assert.match(javascript, /Modo cursor/);
  assert.match(javascript, /Recolher/);
  assert.match(javascript, /Mostrar/);
  assert.match(javascript, /Ocultar cores/);
  assert.match(javascript, /Mostrar cores/);
  assert.match(javascript, /Ocultar sublinhados/);
  assert.match(javascript, /Mostrar sublinhados/);
  assert.match(javascript, /Novo hino/);
  assert.match(javascript, /Título do hino/);
  assert.match(javascript, /Biblioteca online/);
  assert.match(javascript, /Solicitar permissão para publicar/);
  assert.match(javascript, /Salvar conjunto no GitHub/);
  assert.match(javascript, /Sobre o Psaltikon/);
  assert.match(javascript, /não substituem o aprendizado da notação musical bizantina/);
  assert.match(javascript, /Guia de estudo/);
  assert.match(javascript, /As cores não têm significados próprios/);
  assert.match(javascript, /Nikos Karachalis: o caráter das Evlogitárias da Ressurreição/);
  assert.match(javascript, /Canais com notação e material para a prática/);
  assert.match(javascript, /Georgios Kakoulidis/);
  assert.match(javascript, /canal de Savvas Iliadis/);
  assert.match(javascript, /k8H7q4v926s/);
  assert.match(stylesheet, /\.help-dialog/);
  assert.match(stylesheet, /\.tools-panel/);
  assert.match(stylesheet, /\.selection-neutral/);
  assert.match(stylesheet, /\.training-hide-colours/);
  assert.match(stylesheet, /\.training-hide-melismas/);
  assert.match(stylesSource, /@media screen \{[\s\S]*\.lyrics\.training-hide-colours/);
  assert.match(stylesSource, /@media print \{[\s\S]*\.mark-sage \{ background:#d9e3cc!important; \}/);
  assert.match(stylesSource, /@media print \{[\s\S]*text-decoration-color:#3f3731!important/);
  assert.match(stylesSource, /font-family:"Noto Serif Transliteration"/);
  assert.match(stylesSource, /noto-serif-latin-regular\.woff/);
  assert.match(stylesSource, /\.lyrics\.lyrics-transliterated/);
  assert.match(stylesheet, /@media \(width<=520px\)/);
  assert.match(stylesheet, /max-height:calc\(100d?vh\s*-\s*20px\)/);
  assert.match(source, /useState<ActiveTool>\(null\)/);
  assert.match(source, /if \(!activeTool\) return;/);
  assert.match(source, /if \(!coloursVisible && \(isColourTool\(activeTool\) \|\| activeTool === "eraser"\)\) return;/);
  assert.match(source, /if \(!melismasVisible && \(isMelismaTool\(activeTool\) \|\| activeTool === "eraser"\)\) return;/);
  assert.match(source, /if \(toolsOpen\) setActiveTool\(null\)/);
  assert.match(source, /const \[coloursVisible, setColoursVisible\] = useState\(true\)/);
  assert.match(source, /const \[melismasVisible, setMelismasVisible\] = useState\(true\)/);
  assert.match(source, /disabled=\{!coloursVisible\}/);
  assert.match(source, /disabled=\{!melismasVisible\}/);
  assert.match(source, /aria-expanded=\{toolsOpen\}/);
  assert.match(source, /useState<Hymn\[\]>\(\(\) => \[newHymn\(\)\]\)/);
  assert.match(source, /hymn\.title \|\| "Novo hino"/);
  assert.match(source, /function addHymn\(\) \{\s+const hymn = newHymn\(\)/);
  assert.match(source, /const restored = restoreHymns\(JSON\.parse\(saved\)\)/);
  assert.match(source, /if \(restored\) setHymns\(restored\)/);
  assert.match(source, /\{ version: 4, exportedAt: new Date\(\)\.toISOString\(\), hymns \}/);
  assert.match(librarySource, /JSON\.stringify\(\{ title: name, slug, hymns \}\)/);
  assert.doesNotMatch(`${source}\n${stateSource}`, /const FIRST_HYMN|const SAMPLE/);
  assert.doesNotMatch(stateSource, /coloursVisible|melismasVisible|training-hide/);

  const visibleSource = `${source}\n${librarySource}`;
  for (const untranslated of [
    "Add another hymn",
    "Add the Greek lyrics",
    "Add your recording",
    "A quiet place for daily practice",
    "Clear colours",
    "Clear melismas",
    "Colours divide melodic phrases",
    "Cursor mode",
    "Eraser",
    "Edit text",
    "Export backup",
    "Export mobile PDF",
    "Greek lyrics for hymn",
    "Hide tools",
    "Hymn title",
    "Import backup",
    "Listen · Read · Repeat",
    "Long melisma",
    "Mode or note (optional)",
    "No repeat",
    "No annotation tool",
    "Paste or type the Greek text",
    "Please enter a valid YouTube link",
    "Practice method",
    "Practice speed",
    "Reference recording",
    "Repeat video",
    "Short melisma",
    "Show tools",
    "Target practice speed",
    "Text size",
    "Text tools",
    "Untitled hymn",
    "YouTube link",
  ]) {
    assert.equal(visibleSource.includes(untranslated), false, `untranslated interface text: ${untranslated}`);
  }
});
