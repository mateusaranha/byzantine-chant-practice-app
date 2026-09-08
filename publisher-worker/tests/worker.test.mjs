import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isHymnPath,
  isOwnedHymnPath,
  normalizeLibraryMetadata,
  normalizeLogin,
  slugify,
  validateCuratedCategoryCreation,
  validateCuratedPromotion,
  validateCuratedSubcategoryCreation,
  validateHymnSet,
} from "../src/index.js";

test("normalizes GitHub logins and collection slugs", () => {
  assert.equal(normalizeLogin(" MateusAranha "), "mateusaranha");
  assert.equal(slugify("Dormição da Theotokos — 15 de agosto"), "dormicao-da-theotokos-15-de-agosto");
});

test("limits a publisher to hymn paths", () => {
  assert.equal(isHymnPath("hinos/mateusaranha/dormicao.json"), true);
  assert.equal(isHymnPath("hinos/outro-autor/dormicao.json"), true);
  assert.equal(isHymnPath("hinos/../config/approved-users.json"), false);
  assert.equal(isOwnedHymnPath("hinos/mateusaranha/dormicao.json", "MateusAranha"), true);
  assert.equal(isOwnedHymnPath("hinos/outro/dormicao.json", "mateusaranha"), false);
});

test("validates saved sets and curated-only listing metadata", () => {
  const listed = validateHymnSet({ title: "Domingo", hymns: [{ title: "Hino" }] });
  assert.equal(listed.slug, "domingo");
  assert.equal(listed.listed, true);
  assert.equal(listed.createOnly, false);
  assert.equal(validateHymnSet({ title: "Cópia", createOnly: true, hymns: [{ title: "Hino" }] }).createOnly, true);
  assert.equal(validateHymnSet({ title: "Curado", listed: false, hymns: [{ title: "Hino" }] }).listed, false);
  assert.throws(() => validateHymnSet({ title: "Vazio", hymns: [] }), /entre 1 e/);
});

test("normalizes public library metadata with backwards-compatible visibility", () => {
  assert.deepEqual(normalizeLibraryMetadata({
    title: "  Celebrações de setembro  ",
    updatedAt: "2026-08-30T22:41:35.287Z",
    listed: false,
  }), {
    title: "Celebrações de setembro",
    updatedAt: "2026-08-30T22:41:35.287Z",
    listed: false,
  });
  assert.equal(normalizeLibraryMetadata({ title: "Legado" }).listed, true);
});

test("validates category and subcategory creation", () => {
  const catalog = {
    version: 3,
    categories: [{ id: "grandes-festas", label: "Grandes Festas" }],
    subcategories: [{ id: "grandes-festas-dormicao", label: "Dormição", categoryId: "grandes-festas" }],
  };
  assert.deepEqual(validateCuratedCategoryCreation({ label: " Santos " }, catalog), { id: "santos", label: "Santos" });
  assert.deepEqual(validateCuratedSubcategoryCreation({ label: "Natividade", categoryId: "grandes-festas" }, catalog), {
    id: "grandes-festas-natividade",
    label: "Natividade",
    categoryId: "grandes-festas",
  });
  assert.throws(() => validateCuratedCategoryCreation({ label: "Grandes Festas" }, catalog), /já existe/);
  assert.throws(() => validateCuratedSubcategoryCreation({ label: "Dormição", categoryId: "grandes-festas" }, catalog), /já existe/);
});

test("validates curated promotion as one complete published set per subcategory", () => {
  const catalog = {
    version: 3,
    categories: [{ id: "grandes-festas", label: "Grandes Festas" }],
    subcategories: [{ id: "grandes-festas-dormicao", label: "Dormição", categoryId: "grandes-festas" }],
  };
  const published = {
    hymns: [
      { id: "apolytikion", title: "Apolytikion", lyrics: "κείμενον", videoId: "abcdefghijk" },
      { id: "kontakion", title: "Kontakion", lyrics: "κείμενον" },
    ],
  };
  const promotion = validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    subcategoryId: "grandes-festas-dormicao",
  }, catalog, published);
  assert.deepEqual(promotion, {
    path: "hinos/mateusaranha/dormicao.json",
    subcategoryId: "grandes-festas-dormicao",
    replace: false,
  });

  const replacement = validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao-revisada.json",
    subcategoryId: "grandes-festas-dormicao",
    replace: true,
  }, catalog, published);
  assert.equal(replacement.replace, true);

  assert.throws(() => validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    subcategoryId: "missing",
  }, catalog, published), /Subcategoria/);
  assert.throws(() => validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    subcategoryId: "grandes-festas-dormicao",
  }, catalog, { hymns: [] }), /Conjunto publicado inválido/);
});


test("protects save-as-new from overwriting an existing slug", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /createOnly && existing/);
  assert.match(source, /Já existe um conjunto com esse nome/);
  assert.match(source, /\{ createOnly: value\.createOnly \}/);
});

test("curated removal relists hidden sets before unlinking and deletes only empty structure", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /async function removeCuratedAssociation/);
  assert.match(source, /stored\.data\.listed === false/);
  assert.match(source, /stillCuratedElsewhere/);
  assert.match(source, /listed: true/);
  assert.match(source, /delete subcategory\.source/);
  assert.match(source, /Remova o conjunto da Biblioteca curada antes de excluí-lo definitivamente/);
  assert.match(source, /Remova o conjunto da subcategoria antes de excluí-la/);
  assert.match(source, /A categoria ainda possui subcategorias/);
  assert.match(source, /url\.pathname === "\/api\/curated" && request\.method === "DELETE"/);
});
