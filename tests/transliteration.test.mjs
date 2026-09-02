import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/transliteration.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { transliterateGreek, projectTransliteration, sourceRangeForTransliteration } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);
const convert = (greek) => transliterateGreek(greek).map((unit) => unit.text).join("");

test("the three approved samples follow the parish convention", () => {
  assert.equal(convert("Δόξα Πατρί και Υιώ και Αγίω Πνεύματι. Και νυν και αεί…"),
    "Dhóxa Patrí ke Iió ke Aghío Pnévmati. Ke nyn ke aí…");
  assert.equal(convert("Σώσον, Κύριε, τον λαόν σου, και ευλόγησον την κληρονομίαν σου"),
    "Sóson, Kýrie, ton laón su, ke evlóghison tin klironomían su");
  assert.equal(convert("Μήτηρ υπάρχουσα της ζωής"), "Mítir ypárchusa tis zoís");
});

test("the same approved spellings work with polytonic Greek", () => {
  assert.equal(convert("Δόξα Πατρὶ καὶ Υἱῷ καὶ Ἁγίῳ Πνεύματι."), "Dhóxa Patrí ké Iió ké Aghío Pnévmati.");
  assert.equal(convert("Κύριε Δέσποτα δῶρον ψυχάς χορηγός νῦν"), "Kýrie Dhéspota dhóron psychás chorigós nýn");
  assert.equal(convert("Ἀγγελικαὶ δυνάμεις"), "Angheliké dhynámis");
});

test("gamma looks at vowel sounds, including vowel pairs and hiatus", () => {
  assert.equal(convert("Ἅγιος γέννησις γίνεται Λόγος ἀγαθός"), "Ághios ghénnisis ghínete Lógos agathós");
  assert.equal(convert("γαι γοι γου γυ γαϊ γοϊ γάι"), "ghe ghi gu ghy gai goi gái");
});

test("vowel pairs and diaeresis are resolved before accents are removed", () => {
  assert.equal(convert("αί εί οί ού υί"), "é í í ú ií");
  assert.equal(convert("Μαΐου ἀΐδιος ἄυλος ἄϋλος αΰ οΐ"), "Maíu aídhios áylos áylos aý oí");
  assert.equal(convert("η οι ει ου αι"), "i i i u e");
});

test("av/af and ev/ef depend on the following consonant", () => {
  assert.equal(convert("Σταυρό αὐτοῦ Πνεῦμα εὐχαριστοῦμεν"), "Stavró aftú Pnévma efcharistúmen");
  assert.equal(convert("αὐλή εὔχομαι εὐλογία Εὐαγγέλιον"), "avlí éfchome evloghía Evanghélion");
  assert.equal(convert("αυθ αυκ αυξ αυπ αυσ αυτ αυφ αυχ αυψ"), "afth afk afx afp afs aft aff afch afps");
  assert.equal(convert("αυβ αυγ αυδ αυζ αυλ αυμ αυν αυρ αυα"), "avv avg avdh avz avl avm avn avr ava");
  assert.equal(convert("ευ, θεός\nαυ τα"), "ev, theós\nav ta");
});

test("consonant groups use the agreed internal forms, with b/d/g at word starts", () => {
  assert.equal(convert("λαμπρώς πάντοτε Ἀγγελικαί ἄγγελος ἀγκάλαις"), "lambrós pándote Angheliké ánghelos ankáles");
  assert.equal(convert("μπα ντα γκα (Μπα)·ντα\nγκα"), "ba da ga (Ba)·da\nga");
});

test("case, non-Greek text, punctuation and line breaks are preserved", () => {
  assert.equal(convert("ΔΟΞΑ ΚΥΡΙΕ ΠΝΕΥΜΑ\nΔόξα· Κύριε;"), "DHOXA KYRIE PNEVMA\nDhóxa· Kýrie;");
  const mixed = "Português: ação, café — 123 😀\n<Amen> & Kýrie";
  assert.equal(convert(mixed), mixed);
  assert.equal(convert(""), "");
  assert.equal(convert("µου ∆όξα"), "mu Dhóxa");
});

test("NFC and NFD have identical output while keeping their own UTF-16 offsets", () => {
  const greek = "😀 Δόξα Πατρὶ καὶ Υἱῷ· Μαΐου\nἈγγελικαί";
  for (const input of [greek.normalize("NFC"), greek.normalize("NFD")]) {
    const units = transliterateGreek(input);
    assert.equal(units.map((unit) => unit.text).join(""), convert(greek));
    assert.equal(units[0].start, 0);
    assert.equal(units[0].end, 2, "a surrogate pair occupies two original UTF-16 positions");
    assert.equal(units.at(-1).end, input.length);
    for (let i = 1; i < units.length; i++) assert.equal(units[i - 1].end, units[i].start);
    assert.equal(units.map((unit) => input.slice(unit.start, unit.end)).join(""), input);
  }
});

test("marks on expanded and contracted letters appear on their full Latin equivalents", () => {
  const units = transliterateGreek("δαι ψ");
  assert.deepEqual(projectTransliteration(units,
    [{ start: 0, end: 1, color: "sage" }, { start: 2, end: 3, color: "sky" }],
    [{ start: 1, end: 3, kind: "simple" }, { start: 4, end: 5, kind: "complex" }]), [
    { text: "dh", color: "sage", melisma: undefined },
    { text: "e", color: "sky", melisma: "simple" },
    { text: " ", color: undefined, melisma: undefined },
    { text: "ps", color: undefined, melisma: "complex" },
  ]);
});

test("Latin selections map back to complete Greek source units", () => {
  const units = transliterateGreek("δαι ψ"); // dh, e, space, ps
  assert.deepEqual(sourceRangeForTransliteration(units, 1, 2), { start: 0, end: 1 },
    "selecting only h expands to the whole δ");
  assert.deepEqual(sourceRangeForTransliteration(units, 2, 3), { start: 1, end: 3 },
    "a contracted e expands to the whole αι");
  assert.deepEqual(sourceRangeForTransliteration(units, 5, 6), { start: 4, end: 5 },
    "selecting only s expands to the whole ψ");
  assert.deepEqual(sourceRangeForTransliteration(units, 1, 5), { start: 0, end: 5 });
});

test("selection boundaries do not include adjacent transliteration units", () => {
  const units = transliterateGreek("χαι"); // ch, e
  assert.deepEqual(sourceRangeForTransliteration(units, 0, 2), { start: 0, end: 1 });
  assert.deepEqual(sourceRangeForTransliteration(units, 2, 3), { start: 1, end: 3 });
});

test("selection mapping follows UTF-16 offsets across emoji, accents and line breaks", () => {
  const input = "😀 χ\nαί";
  const units = transliterateGreek(input);
  const output = units.map((unit) => unit.text).join("");
  const h = output.indexOf("h");
  const accentedE = output.indexOf("é");
  assert.deepEqual(sourceRangeForTransliteration(units, h, h + 1), { start: 3, end: 4 });
  assert.deepEqual(sourceRangeForTransliteration(units, accentedE, accentedE + 1), {
    start: input.indexOf("α"), end: input.length,
  });
  assert.deepEqual(sourceRangeForTransliteration(units, 0, 2), { start: 0, end: 2 });
});

test("invalid or empty Latin selections are rejected", () => {
  const units = transliterateGreek("αι");
  for (const range of [[0, 0], [1, 0], [-1, 1], [0, 2], [0.5, 1], [0, Number.NaN]]) {
    assert.equal(sourceRangeForTransliteration(units, ...range), null);
  }
  assert.equal(sourceRangeForTransliteration([], 0, 1), null);
});

test("conflicting marks on an indivisible pair use first-mark precedence without changing data", () => {
  const colors = Object.freeze([
    Object.freeze({ start: 0, end: 1, color: "sage" }), Object.freeze({ start: 1, end: 2, color: "rose" }),
  ]);
  const melismas = Object.freeze([
    Object.freeze({ start: 0, end: 1, kind: "simple" }), Object.freeze({ start: 1, end: 2, kind: "complex" }),
  ]);
  const snapshot = JSON.stringify({ colors, melismas });
  const units = Object.freeze(transliterateGreek("αι").map(Object.freeze));
  assert.deepEqual(projectTransliteration(units, colors, melismas), [{ text: "e", color: "sage", melisma: "simple" }]);
  assert.equal(JSON.stringify({ colors, melismas }), snapshot);
});

test("mark boundaries never change contextual conversion or cut off combining accents", () => {
  const input = "😀 γαι Δόξα ευχαριστούμεν";
  const accent = input.indexOf("\u0301");
  const units = transliterateGreek(input);
  const rendered = projectTransliteration(units,
    [{ start: 4, end: 5, color: "rose" }], [{ start: accent, end: accent + 1, kind: "complex" }]);
  assert.equal(rendered.map((segment) => segment.text).join(""), "😀 ghe Dhóxa efcharistúmen");
  assert.equal(rendered.find((segment) => segment.melisma === "complex").text, "ó");
  assert.deepEqual(projectTransliteration([], [], []), []);
});

test("empty, reversed and out-of-bounds marks do not create visible annotations", () => {
  assert.deepEqual(projectTransliteration(transliterateGreek("αι"), [
    { start: 1, end: 1, color: "sage" }, { start: 2, end: 0, color: "sky" },
    { start: -3, end: 0, color: "rose" }, { start: 2, end: 4, color: "wheat" },
  ], []), [{ text: "e", color: undefined, melisma: undefined }]);
});
