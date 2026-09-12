import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadWorkspacePreferences() {
  const source = await readFile(new URL("../src/workspacePreferences.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
}

test("tools panel state persists locally per hymn and fails open safely", async () => {
  const { TOOLS_PANEL_STATE_KEY, readToolsPanelOpen, writeToolsPanelOpen } = await loadWorkspacePreferences();
  const { values, storage } = memoryStorage();

  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-b"), true);

  assert.equal(writeToolsPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);
  assert.equal(readToolsPanelOpen(storage, "hymn-b"), true);

  assert.equal(writeToolsPanelOpen(storage, "hymn-a", true), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);

  values.set(TOOLS_PANEL_STATE_KEY, "{dados interrompidos");
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), true);
  assert.equal(writeToolsPanelOpen(storage, "hymn-a", false), true);
  assert.equal(readToolsPanelOpen(storage, "hymn-a"), false);

  assert.equal(readToolsPanelOpen({ getItem: () => { throw new Error("blocked"); } }, "hymn-a"), true);
  assert.equal(writeToolsPanelOpen({
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
  }, "hymn-a", false), false);
});

test("training visibility persists independently per hymn and fails visible safely", async () => {
  const {
    TRAINING_VISIBILITY_STATE_KEY,
    readTrainingVisibility,
    writeTrainingVisibility,
  } = await loadWorkspacePreferences();
  const { values, storage } = memoryStorage();

  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: true,
    melismasVisible: true,
  });

  assert.equal(writeTrainingVisibility(storage, "hymn-a", {
    coloursVisible: false,
    melismasVisible: true,
  }), true);
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: false,
    melismasVisible: true,
  });
  assert.deepEqual(readTrainingVisibility(storage, "hymn-b"), {
    coloursVisible: true,
    melismasVisible: true,
  });

  assert.equal(writeTrainingVisibility(storage, "hymn-a", {
    coloursVisible: true,
    melismasVisible: false,
  }), true);
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: true,
    melismasVisible: false,
  });

  assert.equal(writeTrainingVisibility(storage, "hymn-a", {
    coloursVisible: false,
    melismasVisible: false,
  }), true);
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: false,
    melismasVisible: false,
  });

  assert.equal(writeTrainingVisibility(storage, "hymn-a", {
    coloursVisible: true,
    melismasVisible: true,
  }), true);
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: true,
    melismasVisible: true,
  });

  values.set(TRAINING_VISIBILITY_STATE_KEY, "{dados interrompidos");
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: true,
    melismasVisible: true,
  });
  assert.equal(writeTrainingVisibility(storage, "hymn-a", {
    coloursVisible: false,
    melismasVisible: true,
  }), true);
  assert.deepEqual(readTrainingVisibility(storage, "hymn-a"), {
    coloursVisible: false,
    melismasVisible: true,
  });

  assert.deepEqual(readTrainingVisibility({
    getItem: () => { throw new Error("blocked"); },
  }, "hymn-a"), {
    coloursVisible: true,
    melismasVisible: true,
  });
  assert.equal(writeTrainingVisibility({
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
  }, "hymn-a", {
    coloursVisible: false,
    melismasVisible: false,
  }), false);
});

test("training visibility storage keeps only the most recent 200 hidden hymns per annotation type", async () => {
  const { readTrainingVisibility, writeTrainingVisibility } = await loadWorkspacePreferences();
  const { storage } = memoryStorage();

  for (let index = 0; index < 205; index += 1) {
    assert.equal(writeTrainingVisibility(storage, `hymn-${index}`, {
      coloursVisible: false,
      melismasVisible: false,
    }), true);
  }

  assert.deepEqual(readTrainingVisibility(storage, "hymn-0"), {
    coloursVisible: true,
    melismasVisible: true,
  });
  assert.deepEqual(readTrainingVisibility(storage, "hymn-204"), {
    coloursVisible: false,
    melismasVisible: false,
  });
});
