import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app guide documents current library navigation and curator management", async () => {
  const source = await readFile(new URL("../src/AppGuide.tsx", import.meta.url), "utf8");

  const exploreIndex = source.indexOf('title="Explorar a Biblioteca pública"');
  const publishIndex = source.indexOf('title="Publicar e adicionar à Biblioteca curada"');
  const organizeIndex = source.indexOf('title="Organizar a Biblioteca curada"');
  const shareIndex = source.indexOf('title="Compartilhar e adicionar ao seu espaço"');

  assert.ok(
    exploreIndex >= 0 && exploreIndex < publishIndex && publishIndex < organizeIndex && organizeIndex < shareIndex,
    "library guidance should progress from exploring to publishing, organizing and sharing",
  );

  assert.match(source, /Inicialmente aparecem apenas duas áreas principais/);
  assert.match(source, /suas subcategorias são mostradas na própria página/);
  assert.match(source, /área temporária, sem alterar seu espaço/);
  assert.match(source, /Abrir.*funciona de forma diferente da Biblioteca curada/);
  assert.match(source, /nome do conjunto.*categoria.*subcategoria/s);
  assert.match(source, /controle com lápis/);
  assert.match(source, /Confirme com <strong>✓<\/strong> ou Enter/);
  assert.match(source, /Renomear uma categoria ou subcategoria altera apenas o nome exibido/);
  assert.match(source, /não fazem parte das publicações nem da cópia de segurança/);
});
