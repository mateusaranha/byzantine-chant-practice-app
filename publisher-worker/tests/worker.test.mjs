import assert from "node:assert/strict";
import test from "node:test";
import worker, {
  isOwnedHymnPath,
  normalizeLogin,
  runTranslationExperiment,
  slugify,
  translationMessages,
  validateHymnSet,
  validateTranslationRequest,
} from "../src/index.js";

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

test("validates the experimental Greek translation request", () => {
  assert.deepEqual(validateTranslationRequest({ text: "  Κύριε, ἐλέησον.  " }), {
    text: "Κύριε, ἐλέησον.",
    targetLanguage: "pt-BR",
  });
  assert.throws(() => validateTranslationRequest({ text: "Lord, have mercy." }), /conter grego/);
  assert.throws(
    () => validateTranslationRequest({ text: "Κύριε", targetLanguage: "en" }),
    /português brasileiro/,
  );
  assert.throws(() => validateTranslationRequest({ text: `Κ${"ύ".repeat(6_000)}` }), /no máximo/);
});

test("builds a constrained liturgical translation prompt", () => {
  const messages = translationMessages({ text: "Κύριε, ἐλέησον." });
  assert.equal(messages[1].content, "Κύριε, ἐλέησον.");
  assert.match(messages[0].content, /termos teológicos/);
  assert.match(messages[0].content, /somente a tradução/);
});

test("runs a translation without storing the hymn", async () => {
  let received;
  const ai = {
    async run(model, options) {
      received = { model, options };
      return { response: "Senhor, tem piedade." };
    },
  };
  const result = await runTranslationExperiment({ text: "Κύριε, ἐλέησον." }, ai);
  assert.equal(result.translation, "Senhor, tem piedade.");
  assert.match(result.notice, /não constitui uma tradução oficial/);
  assert.equal(received.model, "@cf/qwen/qwen3-30b-a3b-fp8");
  assert.equal(received.options.temperature, 0.1);
});

test("reports unavailable and empty AI responses", async () => {
  await assert.rejects(() => runTranslationExperiment({ text: "Κύριε" }), /ainda não está conectado/);
  await assert.rejects(
    () => runTranslationExperiment({ text: "Κύριε" }, { run: async () => ({ response: "" }) }),
    /não retornou uma tradução/,
  );
});

test("keeps the experimental endpoint hidden by default", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(new Request("https://worker.example/api/experiments/translate", { method: "POST" }), {
      FRONTEND_URL: "https://app.example/",
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Página não encontrada." });
  } finally {
    console.error = originalError;
  }
});
