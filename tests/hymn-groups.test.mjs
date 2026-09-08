import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadHymnState() {
  const source = await readFile(new URL("../src/hymnState.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function fixture(newHymn) {
  return ["A", "B", "C", "D", "E"].map((title) => ({
    ...newHymn(),
    id: title.toLowerCase(),
    title,
    lyrics: title,
  }));
}

test("groups keep selected hymns together and move as one layout item", async () => {
  const { createHymnGroup, hymnLayout, hymnLayoutKey, moveHymnLayoutItem, newHymn } = await loadHymnState();
  const grouped = createHymnGroup(fixture(newHymn), ["b", "d"], "  Apolytikion  ");
  const group = hymnLayout(grouped)[1];

  assert.equal(group.type, "group");
  assert.equal(group.group.name, "Apolytikion");
  assert.deepEqual(group.hymns.map((hymn) => hymn.id), ["b", "d"]);
  assert.deepEqual(grouped.map((hymn) => hymn.id), ["a", "b", "d", "c", "e"]);

  const moved = moveHymnLayoutItem(grouped, hymnLayoutKey(group), 1);
  assert.deepEqual(moved.map((hymn) => hymn.id), ["a", "c", "b", "d", "e"]);
  assert.equal(moved[2].group.id, moved[3].group.id);
});

test("group members can be reordered, added, removed, renamed and ungrouped", async () => {
  const {
    addHymnsToGroup,
    createHymnGroup,
    moveHymnInGroup,
    newHymn,
    removeHymnFromGroup,
    renameHymnGroup,
    ungroupHymns,
  } = await loadHymnState();
  let hymns = createHymnGroup(fixture(newHymn), ["b", "c"], "Versões");
  const groupId = hymns.find((hymn) => hymn.id === "b").group.id;

  hymns = addHymnsToGroup(hymns, ["d"], groupId);
  assert.deepEqual(hymns.filter((hymn) => hymn.group?.id === groupId).map((hymn) => hymn.id), ["b", "c", "d"]);
  hymns = moveHymnInGroup(hymns, "d", -1);
  assert.deepEqual(hymns.filter((hymn) => hymn.group?.id === groupId).map((hymn) => hymn.id), ["b", "d", "c"]);
  hymns = renameHymnGroup(hymns, groupId, "Outras versões");
  assert.ok(hymns.filter((hymn) => hymn.group?.id === groupId).every((hymn) => hymn.group.name === "Outras versões"));
  hymns = removeHymnFromGroup(hymns, "d");
  assert.equal(hymns.find((hymn) => hymn.id === "d").group, undefined);
  assert.deepEqual(hymns.map((hymn) => hymn.id), ["a", "b", "c", "d", "e"]);
  hymns = ungroupHymns(hymns, groupId);
  assert.ok(hymns.every((hymn) => hymn.group === undefined));
});

test("workspace restoration preserves valid groups and removes incomplete metadata", async () => {
  const { readWorkspace, restoreHymns, writeWorkspace } = await loadHymnState();
  const old = restoreHymns({ version: 3, hymns: [{ id: "old", title: "Antigo", lyrics: "α" }] });
  assert.equal(old[0].group, undefined);

  const restored = restoreHymns({ version: 3, hymns: [
    { id: "a", title: "A", lyrics: "α", group: { id: "g", name: "Grupo" } },
    { id: "outside", title: "Fora", lyrics: "β" },
    { id: "b", title: "B", lyrics: "γ", group: { id: "g", name: "Nome divergente" } },
    { id: "single", title: "Único", lyrics: "δ", group: { id: "s", name: "Incompleto" } },
  ] });
  assert.deepEqual(restored.map((hymn) => hymn.id), ["a", "b", "outside", "single"]);
  assert.equal(restored[0].group.name, "Grupo");
  assert.equal(restored[1].group.name, "Grupo");
  assert.equal(restored[3].group, undefined);

  let raw = "";
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  writeWorkspace(storage, restored);
  const reread = readWorkspace(storage);
  assert.equal(reread.status, "ready");
  assert.deepEqual(reread.hymns.map((hymn) => hymn.group?.name || null), ["Grupo", "Grupo", null, null]);
});

test("group presentation and organizer expose the accessible interactions", async () => {
  const [view, organizer, styles] = await Promise.all([
    readFile(new URL("../src/HymnGroupList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/ReorderHymnsDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(view, /aria-expanded=\{expanded\}/);
  assert.match(view, /hymn-group-items-collapsed/);
  assert.match(view, /\{item\.hymns\.length\} itens/);
  assert.match(organizer, /Criar grupo/);
  assert.match(organizer, /Renomear grupo/);
  assert.match(organizer, /Desfazer grupo/);
  assert.match(organizer, /Adicionar ao grupo/);
  assert.match(organizer, /Remover.*do grupo/);
  assert.match(styles, /\.hymn-group-deck::before,.hymn-group-deck::after/);
  assert.match(styles, /@media \(max-width:520px\)[\s\S]*\.hymn-group-deck/);
  assert.match(styles, /@media print \{[\s\S]*\.hymn-group-items-collapsed \{ display:contents!important; \}/);
});
