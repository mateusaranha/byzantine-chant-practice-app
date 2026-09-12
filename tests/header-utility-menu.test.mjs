import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const menuSource = await readFile(new URL("../src/HeaderUtilityMenu.tsx", import.meta.url), "utf8");
const menuStyles = await readFile(new URL("../src/headerUtilityMenu.css", import.meta.url), "utf8");

test("workspace header delegates occasional utilities to the compact menu", () => {
  assert.match(appSource, /import HeaderUtilityMenu from "\.\/HeaderUtilityMenu";/);
  assert.match(appSource, /className="header-actions workspace-header-actions"/);
  assert.match(appSource, /<HeaderUtilityMenu/);
  assert.match(appSource, /onExportBackup=\{exportBackup\}/);
  assert.match(appSource, /onImportBackup=\{\(\) => backupInputRef\.current\?\.click\(\)\}/);
  assert.match(appSource, /onExportPdf=\{\(trigger\) => setPdfTrigger\(trigger\)\}/);
});

test("utility menu keeps the three actions discoverable and keyboard dismissible", () => {
  assert.match(menuSource, /aria-label="Mais ações"/);
  assert.match(menuSource, /aria-expanded=\{open\}/);
  assert.match(menuSource, /event\.key !== "Escape"/);
  assert.match(menuSource, /document\.addEventListener\("pointerdown"/);
  assert.match(menuSource, /Exportar PDF para celular/);
  assert.match(menuSource, /Exportar cópia de segurança/);
  assert.match(menuSource, /Importar cópia de segurança/);
});

test("utility menu styles stay compact on narrow viewports", () => {
  assert.match(menuStyles, /\.header-more-trigger \{[\s\S]*width: 38px;/);
  assert.match(menuStyles, /@media \(max-width: 520px\)/);
  assert.match(menuStyles, /\.header-actions\.workspace-header-actions/);
  assert.match(menuStyles, /max-width: calc\(100vw - 20px\)/);
});
