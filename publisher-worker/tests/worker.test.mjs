import assert from "node:assert/strict";
import test from "node:test";
import {
  curatedEntryId,
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
    version: 2,
    categories: [{ id: "grandes-festas", label: "Grandes Festas" }],
    subcategories: [{ id: "grandes-festas-dormicao", label: "Dormição", categoryId: "grandes-festas" }],
    entries: [],
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

test("validates curated promotion by subcategory without copying hymn content", () => {
  const catalog = {
    version: 2,
    categories: [{ id: "grandes-festas", label: "Grandes Festas" }],
    subcategories: [{ id: "grandes-festas-dormicao", label: "Dormição", categoryId: "grandes-festas" }],
    entries: [],
  };
  const published = {
    hymns: [
      { id: "apolytikion", title: "Apolytikion", lyrics: "κείμενον", videoId: "abcdefghijk" },
      { id: "kontakion", title: "Kontakion", lyrics: "κείμενον" },
    ],
  };
  const promotion = validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    hymnId: "apolytikion",
    subcategoryId: "grandes-festas-dormicao",
  }, catalog, published);
  assert.equal(promotion.path, "hinos/mateusaranha/dormicao.json");
  assert.equal(promotion.subcategoryId, "grandes-festas-dormicao");
  assert.equal(promotion.hymn, published.hymns[0]);
  assert.equal(curatedEntryId(promotion.path, promotion.hymnId), "dormicao-apolytikion");
  assert.throws(() => validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    hymnId: "missing",
    subcategoryId: "grandes-festas-dormicao",
  }, catalog, published), /não foi encontrado/);
  assert.throws(() => validateCuratedPromotion({
    path: "hinos/mateusaranha/dormicao.json",
    hymnId: "apolytikion",
    subcategoryId: "missing",
  }, catalog, published), /Subcategoria/);
});
