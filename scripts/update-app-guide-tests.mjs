import { readFile, writeFile } from "node:fs/promises";

const path = "tests/build.test.mjs";
let source = await readFile(path, "utf8");

const replacements = [
  [
    'assert.match(javascript, /Usar a biblioteca e compartilhar conjuntos/);',
    'assert.match(javascript, /Explorar a Biblioteca pública/);\n  assert.match(javascript, /Publicar e adicionar à Biblioteca curada/);\n  assert.match(javascript, /Compartilhar e adicionar ao seu espaço/);',
  ],
  [
    `  const libraryGuideIndex = appGuideSource.indexOf('title="Usar a biblioteca e compartilhar conjuntos"');\n  assert.ok(\n    storageGuideIndex >= 0 && storageGuideIndex < pdfGuideIndex && pdfGuideIndex < libraryGuideIndex,\n    "operational guidance must keep backup, PDF and library in a clear order",\n  );`,
    `  const libraryGuideIndex = appGuideSource.indexOf('title="Explorar a Biblioteca pública"');\n  const publishGuideIndex = appGuideSource.indexOf('title="Publicar e adicionar à Biblioteca curada"');\n  const shareGuideIndex = appGuideSource.indexOf('title="Compartilhar e adicionar ao seu espaço"');\n  assert.ok(\n    storageGuideIndex >= 0 &&\n      storageGuideIndex < pdfGuideIndex &&\n      pdfGuideIndex < libraryGuideIndex &&\n      libraryGuideIndex < publishGuideIndex &&\n      publishGuideIndex < shareGuideIndex,\n    "operational guidance must keep backup, PDF, library, publishing and sharing in a clear order",\n  );`,
  ],
  [
    'assert.match(appGuideSource, /Alterações feitas depois apenas no seu espaço não aparecem na versão pública/);',
    'assert.match(appGuideSource, /Alterações feitas depois apenas no seu espaço não aparecem na versão publicada/);\n  assert.match(appGuideSource, /categoria → subcategoria → hinos/);\n  assert.match(appGuideSource, /Todos os hinos do conjunto/);\n  assert.match(appGuideSource, /Selecionar hinos individualmente/);\n  assert.match(appGuideSource, /não aparece também em Meus conjuntos/);\n  assert.match(appGuideSource, /adicionado à curadoria mais tarde/);',
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`Expected test snippet not found: ${from}`);
  source = source.replace(from, to);
}

await writeFile(path, source);

// Trigger the temporary workflow after it has been added to the branch.
