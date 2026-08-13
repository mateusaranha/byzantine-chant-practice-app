import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedHymnPath, normalizeLogin, slugify, validateHymnSet } from "../src/index.js";

test("normalizes GitHub logins and collection slugs", () => {
  assert.equal(normalizeLogin(" MateusAranha "), "mateusaranha");
  assert.equal(slugify("Dormição da Theotokos — 15 de agosto"), "dormicao-da-theotokos-15-de-agosto");
});

test("limits a publisher to their own hymn directory", () => {
  assert.equal(isOwnedHymnPath("hinos/mateusaranha/dormicao.json", "MateusAranha"), true);
  assert.equal(isOwnedHymnPath("hinos/outro/dormicao.json", "mateusaranha"), false);
  assert.equal(isOwnedHymnPath("src/App.tsx", "mateusaranha"), false);
});

test("validates a saved hymn set", () => {
  const set = validateHymnSet({ title: "Domingo", hymns: [{ title: "Hino" }] });
  assert.equal(set.slug, "domingo");
  assert.equal(set.hymns.length, 1);
  assert.throws(() => validateHymnSet({ title: "Vazio", hymns: [] }), /entre 1 e/);
});
