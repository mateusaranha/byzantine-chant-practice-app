import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transforms) {
  let source = await readFile(path, "utf8");
  for (const [label, from, to] of transforms) {
    const next = source.replace(from, to);
    if (next === source) throw new Error(`${path}: transform not applied: ${label}`);
    source = next;
  }
  await writeFile(path, source);
}

await edit("src/CloudLibrary.tsx", [
  [
    "selection types",
    'type SaveDestination = "sets" | "curated" | "both";\ntype CuratedWrite = { changed: boolean; entry: { title: string }; catalog: CuratedCatalog };',
    'type SaveDestination = "sets" | "curated" | "both";\ntype CuratedSelectionMode = "all" | "individual";\ntype CuratedWrite = { changed: boolean; entries: { title: string }[]; catalog: CuratedCatalog };',
  ],
  [
    "selection state",
    '  const [curatedSubcategoryId, setCuratedSubcategoryId] = useState("");\n  const [curatedHymnId, setCuratedHymnId] = useState(() => hymns[0]?.id || "");',
    '  const [curatedSubcategoryId, setCuratedSubcategoryId] = useState("");\n  const [curatedSelectionMode, setCuratedSelectionMode] = useState<CuratedSelectionMode>("all");\n  const [selectedCuratedHymnIds, setSelectedCuratedHymnIds] = useState<string[]>(() => hymns.map((hymn) => hymn.id));',
  ],
  [
    "selection derivation",
    '  const selectedCuratedHymn = hymns.find((hymn) => hymn.id === curatedHymnId) || hymns[0];\n  const curatedCategories = curatedCatalog.categories;\n  const curatedSubcategories = curatedCatalog.subcategories.filter((subcategory) => subcategory.categoryId === curatedCategoryId);\n  const setsEntryLabel = session?.isApproved ? "Meus conjuntos" : "Conjuntos publicados";\n  const wantsCurated = session?.isAdmin && saveDestination !== "sets";\n\n  useEffect(() => {\n    if (selectedCuratedHymn && selectedCuratedHymn.id !== curatedHymnId) {\n      setCuratedHymnId(selectedCuratedHymn.id);\n    }\n  }, [selectedCuratedHymn, curatedHymnId]);',
    '  const curatedCategories = curatedCatalog.categories;\n  const curatedSubcategories = curatedCatalog.subcategories.filter((subcategory) => subcategory.categoryId === curatedCategoryId);\n  const availableCuratedHymnIds = hymns.map((hymn) => hymn.id);\n  const curatedHymnIds = curatedSelectionMode === "all"\n    ? availableCuratedHymnIds\n    : selectedCuratedHymnIds.filter((id) => availableCuratedHymnIds.includes(id));\n  const curatedHymnCount = curatedHymnIds.length;\n  const curatedHymnSummary = `${curatedHymnCount} ${curatedHymnCount === 1 ? "hino" : "hinos"}`;\n  const setsEntryLabel = session?.isApproved ? "Meus conjuntos" : "Conjuntos publicados";\n  const wantsCurated = session?.isAdmin && saveDestination !== "sets";\n\n  useEffect(() => {\n    setSelectedCuratedHymnIds((current) => {\n      const valid = current.filter((id) => hymns.some((hymn) => hymn.id === id));\n      return valid.length ? valid : hymns.map((hymn) => hymn.id);\n    });\n  }, [hymns]);',
  ],
  [
    "batch promotion request",
    '  async function promoteCurated(path: string) {\n    if (!session?.isAdmin) throw new Error("Somente o curador pode adicionar itens à Biblioteca curada.");\n    if (!selectedCuratedHymn?.id || !curatedSubcategoryId) throw new Error("Escolha o hino e a subcategoria da curadoria.");\n    const result = await api<CuratedWrite>(\n      apiBase,\n      "/api/curated",\n      {\n        method: "POST",\n        body: JSON.stringify({\n          path,\n          hymnId: selectedCuratedHymn.id,\n          subcategoryId: curatedSubcategoryId,\n        }),\n      },\n      token,\n    );\n    setCuratedCatalog(result.catalog);\n    return result;\n  }',
    '  async function promoteCurated(path: string) {\n    if (!session?.isAdmin) throw new Error("Somente o curador pode adicionar itens à Biblioteca curada.");\n    if (!curatedHymnIds.length || !curatedSubcategoryId) {\n      throw new Error("Escolha ao menos um hino e a subcategoria da curadoria.");\n    }\n    const result = await api<CuratedWrite>(\n      apiBase,\n      "/api/curated",\n      {\n        method: "POST",\n        body: JSON.stringify({\n          path,\n          hymnIds: curatedHymnIds,\n          subcategoryId: curatedSubcategoryId,\n        }),\n      },\n      token,\n    );\n    setCuratedCatalog(result.catalog);\n    return result;\n  }',
  ],
  [
    "curated selection validation",
    '    if (wantsCurated && !curatedSubcategoryId) {\n      setError("Escolha ou crie uma categoria e uma subcategoria para a Biblioteca curada.");\n      return;\n    }',
    '    if (wantsCurated && !curatedSubcategoryId) {\n      setError("Escolha ou crie uma categoria e uma subcategoria para a Biblioteca curada.");\n      return;\n    }\n    if (wantsCurated && !curatedHymnIds.length) {\n      setError("Selecione pelo menos um hino para adicionar à Biblioteca curada.");\n      return;\n    }',
  ],
  [
    "curated save messages",
    '              setError(`O hino foi adicionado à Biblioteca curada, mas também continua em Meus conjuntos. ${detail}`);',
    '              setError(`A seleção foi adicionada à Biblioteca curada, mas o conjunto também continua em Meus conjuntos. ${detail}`);',
  ],
  [
    "curated success messages",
    '          setMessage(\n            saveDestination === "curated"\n              ? "Salvo somente na Biblioteca curada. O conteúdo-base não foi duplicado nem listado em Meus conjuntos."\n              : promotion.changed\n                ? "Conjunto salvo e hino adicionado à Biblioteca curada."\n                : "Conjunto salvo. O hino já estava nessa subcategoria da Biblioteca curada.",\n          );',
    '          setMessage(\n            saveDestination === "curated"\n              ? `${curatedHymnSummary} ${curatedHymnCount === 1 ? "salvo" : "salvos"} somente na Biblioteca curada. O conteúdo-base não foi duplicado nem listado em Meus conjuntos.`\n              : promotion.changed\n                ? `Conjunto salvo e ${curatedHymnSummary} ${curatedHymnCount === 1 ? "adicionado" : "adicionados"} à Biblioteca curada.`\n                : `Conjunto salvo. ${curatedHymnSummary} já ${curatedHymnCount === 1 ? "estava" : "estavam"} nessa subcategoria da Biblioteca curada.`,\n          );',
  ],
  [
    "promote loaded messages",
    '      setMessage(\n        promotion.changed\n          ? "Hino adicionado à Biblioteca curada. O conjunto publicado não foi duplicado."\n          : "Este hino já estava nessa subcategoria da Biblioteca curada.",\n      );',
    '      setMessage(\n        promotion.changed\n          ? `${curatedHymnSummary} ${curatedHymnCount === 1 ? "adicionado" : "adicionados"} à Biblioteca curada. O conjunto publicado não foi duplicado.`\n          : `${curatedHymnSummary} já ${curatedHymnCount === 1 ? "estava" : "estavam"} nessa subcategoria da Biblioteca curada.`,\n      );',
  ],
  [
    "loaded set selection reset",
    '      setCuratedHymnId(published.hymns[0]?.id || "");',
    '      setCuratedSelectionMode("all");\n      setSelectedCuratedHymnIds(published.hymns.flatMap((hymn) => hymn.id ? [hymn.id] : []));',
  ],
  [
    "base copy",
    '                      <p>Serão publicados os {hymns.length} hinos que estão abertos agora.</p>',
    '                      <p>O conjunto-base contém os {hymns.length} hinos que estão abertos agora.</p>',
  ],
  [
    "destination defaults to all",
    '                                onChange={() => setSaveDestination(value)}',
    '                                onChange={() => {\n                                  setSaveDestination(value);\n                                  if (value !== "sets") {\n                                    setCuratedSelectionMode("all");\n                                    setSelectedCuratedHymnIds(hymns.map((hymn) => hymn.id));\n                                  }\n                                }}',
  ],
  [
    "hymn selection UI",
    '                          {hymns.length > 1 && (\n                            <label>\n                              Hino\n                              <select value={selectedCuratedHymn?.id || ""} onChange={(event) => setCuratedHymnId(event.target.value)}>\n                                {hymns.map((hymn, index) => (\n                                  <option key={hymn.id} value={hymn.id}>{hymn.title || `Hino ${index + 1}`}</option>\n                                ))}\n                              </select>\n                            </label>\n                          )}',
    '                          <fieldset className="curated-hymn-selection">\n                            <legend>Hinos a adicionar</legend>\n                            {hymns.length > 1 ? (\n                              <>\n                                <label className="curated-selection-option">\n                                  <input\n                                    type="radio"\n                                    name="curated-hymn-selection"\n                                    checked={curatedSelectionMode === "all"}\n                                    onChange={() => {\n                                      setCuratedSelectionMode("all");\n                                      setSelectedCuratedHymnIds(hymns.map((hymn) => hymn.id));\n                                    }}\n                                  />\n                                  <span><strong>Todos os {hymns.length} hinos do conjunto</strong><small>Opção recomendada para publicar o conjunto inteiro nesta subcategoria.</small></span>\n                                </label>\n                                <label className="curated-selection-option">\n                                  <input\n                                    type="radio"\n                                    name="curated-hymn-selection"\n                                    checked={curatedSelectionMode === "individual"}\n                                    onChange={() => {\n                                      setCuratedSelectionMode("individual");\n                                      setSelectedCuratedHymnIds(hymns.map((hymn) => hymn.id));\n                                    }}\n                                  />\n                                  <span><strong>Selecionar hinos individualmente</strong><small>Expanda a lista apenas quando não quiser adicionar o conjunto inteiro.</small></span>\n                                </label>\n                                {curatedSelectionMode === "individual" && (\n                                  <div className="curated-hymn-checklist">\n                                    <div className="curated-selection-summary">\n                                      <span>{curatedHymnSummary} selecionados</span>\n                                      <div>\n                                        <button type="button" className="cloud-secondary" onClick={() => setSelectedCuratedHymnIds(hymns.map((hymn) => hymn.id))}>Selecionar todos</button>\n                                        <button type="button" className="cloud-secondary" onClick={() => setSelectedCuratedHymnIds([])}>Limpar seleção</button>\n                                      </div>\n                                    </div>\n                                    <div className="curated-hymn-options">\n                                      {hymns.map((hymn, index) => (\n                                        <label key={hymn.id}>\n                                          <input\n                                            type="checkbox"\n                                            checked={selectedCuratedHymnIds.includes(hymn.id)}\n                                            onChange={(event) => setSelectedCuratedHymnIds((current) =>\n                                              event.target.checked\n                                                ? [...new Set([...current, hymn.id])]\n                                                : current.filter((id) => id !== hymn.id),\n                                            )}\n                                          />\n                                          <span>{hymn.title || `Hino ${index + 1}`}</span>\n                                        </label>\n                                      ))}\n                                    </div>\n                                  </div>\n                                )}\n                              </>\n                            ) : (\n                              <p className="curated-hymn-single">O hino aberto será adicionado a esta subcategoria.</p>\n                            )}\n                          </fieldset>',
  ],
  [
    "promote loaded button",
    '                            <button className="cloud-secondary" type="button" onClick={promoteLoadedSet} disabled={!curatedSubcategoryId || Boolean(busy)}>\n                              {busy === "curate" ? "Adicionando…" : "Adicionar este hino à curadoria agora"}\n                            </button>',
    '                            <button className="cloud-secondary" type="button" onClick={promoteLoadedSet} disabled={!curatedSubcategoryId || !curatedHymnIds.length || Boolean(busy)}>\n                              {busy === "curate" ? "Adicionando…" : `Adicionar ${curatedHymnSummary} à curadoria agora`}\n                            </button>',
  ],
  [
    "primary save button",
    '                      <button className="cloud-primary" onClick={saveSet} disabled={Boolean(busy)}>\n                        {busy === "save"\n                          ? "Salvando…"\n                          : updatesOwnSet\n                            ? "Atualizar publicação"\n                            : savedSlug\n                              ? "Salvar uma cópia"\n                              : "Salvar"}\n                      </button>',
    '                      <button className="cloud-primary" onClick={saveSet} disabled={Boolean(busy)}>\n                        {busy === "save"\n                          ? "Salvando…"\n                          : wantsCurated\n                            ? saveDestination === "both"\n                              ? `Salvar conjunto e adicionar ${curatedHymnSummary} à curadoria`\n                              : `Adicionar ${curatedHymnSummary} à Biblioteca curada`\n                            : updatesOwnSet\n                              ? "Atualizar publicação"\n                              : savedSlug\n                                ? "Salvar uma cópia"\n                                : "Salvar"}\n                      </button>',
  ],
  [
    "new set selection reset",
    '                            setSaveDestination("sets");',
    '                            setSaveDestination("sets");\n                            setCuratedSelectionMode("all");\n                            setSelectedCuratedHymnIds(hymns.map((hymn) => hymn.id));',
  ],
]);

await edit("src/libraryProgressive.css", [
  [
    "bulk selection styles",
    '\n@media (max-width:700px) {',
    '\n.curated-hymn-selection {\n  display:grid;\n  gap:8px;\n  margin:2px 0 0;\n  padding:11px 12px 12px;\n  border:1px solid #e0d4c3;\n  border-radius:3px;\n  background:#fffdf8;\n}\n.curated-hymn-selection legend {\n  padding:0 5px;\n  color:#776c62;\n  font:600 10px Arial,sans-serif;\n  letter-spacing:.08em;\n  text-transform:uppercase;\n}\n.publish-form .curated-selection-option {\n  display:flex;\n  grid-template-columns:none;\n  align-items:flex-start;\n  gap:9px;\n  color:#675b50;\n  font:12px/1.4 Arial,sans-serif;\n  letter-spacing:0;\n  text-transform:none;\n}\n.curated-selection-option input,.curated-hymn-options input { width:17px; height:17px; flex:0 0 auto; margin:1px 0 0; accent-color:var(--red); }\n.curated-selection-option span { display:grid; gap:2px; }\n.curated-selection-option strong { font-size:12px; }\n.curated-selection-option small,.curated-hymn-single { color:#81756a; font:11px/1.45 Arial,sans-serif; }\n.curated-hymn-checklist { display:grid; gap:8px; padding:9px 0 0 26px; }\n.curated-selection-summary { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#776c62; font:11px Arial,sans-serif; }\n.curated-selection-summary > div { display:flex; flex-wrap:wrap; gap:6px; }\n.curated-selection-summary .cloud-secondary { min-height:32px; padding:5px 8px; font-size:11px; }\n.curated-hymn-options { display:grid; gap:4px; max-height:260px; overflow:auto; padding-right:4px; }\n.publish-form .curated-hymn-options label {\n  display:flex;\n  grid-template-columns:none;\n  align-items:flex-start;\n  gap:8px;\n  padding:6px 7px;\n  border:1px solid #eadfce;\n  border-radius:3px;\n  background:#fff;\n  color:#675b50;\n  font:12px/1.35 Arial,sans-serif;\n  letter-spacing:0;\n  text-transform:none;\n}\n\n@media (max-width:700px) {',
  ],
  [
    "mobile bulk selection",
    '  .curation-field-row .cloud-secondary,.curation-create-row .cloud-secondary { width:100%; }\n}',
    '  .curation-field-row .cloud-secondary,.curation-create-row .cloud-secondary { width:100%; }\n  .curated-hymn-checklist { padding-left:0; }\n  .curated-selection-summary { align-items:flex-start; flex-direction:column; }\n}\n',
  ],
]);

await edit("publisher-worker/src/index.js", [
  [
    "batch promotion validation",
    /export function validateCuratedPromotion\(value, catalog, published\) \{[\s\S]*?\n\}\n\nexport function validateCuratedCategoryCreation/,
    `export function validateCuratedPromotion(value, catalog, published) {\n  if (!value || typeof value !== "object") throw new HttpError(400, "Dados de curadoria inválidos.");\n  const path = String(value.path || "").trim();\n  const subcategoryId = String(value.subcategoryId || "").trim();\n  const suppliedIds = Array.isArray(value.hymnIds) ? value.hymnIds : [value.hymnId];\n  const hymnIds = [...new Set(suppliedIds.map((item) => String(item || "").trim()).filter(Boolean))];\n  if (!isHymnPath(path) || !hymnIds.length || hymnIds.length > MAX_HYMNS || !CURATED_ID_PATTERN.test(subcategoryId)) {\n    throw new HttpError(400, "Referência ou subcategoria inválida.");\n  }\n  if (!validCuratedCatalog(catalog)) throw new HttpError(500, "O catálogo curado está inválido.");\n  if (!catalog.subcategories.some((subcategory) => subcategory?.id === subcategoryId)) {\n    throw new HttpError(400, "Subcategoria da Biblioteca curada não encontrada.");\n  }\n  if (!published || !Array.isArray(published.hymns)) throw new HttpError(400, "Conjunto publicado inválido.");\n  const hymns = hymnIds.map((hymnId) => {\n    const matches = published.hymns.filter((hymn) => hymn && hymn.id === hymnId);\n    if (matches.length !== 1) throw new HttpError(400, \`O hino publicado “\${hymnId}” não foi encontrado de forma única.\`);\n    return matches[0];\n  });\n  return { path, hymnIds, subcategoryId, hymns, hymnId: hymnIds[0], hymn: hymns[0] };\n}\n\nexport function validateCuratedCategoryCreation`,
  ],
  [
    "batch promotion write",
    /async function promoteCurated\(request, env\) \{[\s\S]*?\n\}\n\nasync function deleteSet/,
    `async function promoteCurated(request, env) {\n  await requireAdmin(request, env);\n  const body = await parseBody(request);\n  const catalog = structuredClone(await curatedCatalog(env));\n  const path = String(body.path || "").trim();\n  if (!isHymnPath(path)) throw new HttpError(400, "Caminho de conjunto inválido.");\n  const publishedStored = await readRepoJson(env, path);\n  if (!publishedStored) throw new HttpError(404, "Conjunto publicado não encontrado.");\n  const promotion = validateCuratedPromotion(body, catalog, publishedStored.data);\n  const usedIds = new Set(catalog.entries.map((entry) => entry?.id).filter(Boolean));\n  let nextOrder = catalog.entries\n    .filter((entry) => entry?.subcategoryId === promotion.subcategoryId)\n    .reduce((highest, entry) => Math.max(highest, Number(entry?.order) || 0), 0);\n  const entries = [];\n  let changed = false;\n\n  for (const hymn of promotion.hymns) {\n    const hymnId = hymn.id;\n    const sourceMatch = catalog.entries.find(\n      (entry) => entry?.source?.path === promotion.path && entry?.source?.hymnId === hymnId,\n    );\n    if (sourceMatch) {\n      if (sourceMatch.subcategoryId !== promotion.subcategoryId) {\n        nextOrder += 10;\n        sourceMatch.subcategoryId = promotion.subcategoryId;\n        sourceMatch.order = nextOrder;\n        changed = true;\n      }\n      entries.push(sourceMatch);\n      continue;\n    }\n\n    const baseId = curatedEntryId(promotion.path, hymnId);\n    let entryId = baseId;\n    let suffix = 2;\n    while (usedIds.has(entryId)) entryId = \`\${baseId}-\${suffix++}\`;\n    usedIds.add(entryId);\n    nextOrder += 10;\n    const entry = {\n      id: entryId,\n      title: String(hymn.title || "Hino sem título").trim().slice(0, 160) || "Hino sem título",\n      subcategoryId: promotion.subcategoryId,\n      order: nextOrder,\n      source: { path: promotion.path, hymnId },\n    };\n    catalog.entries.push(entry);\n    entries.push(entry);\n    changed = true;\n  }\n\n  if (changed) {\n    await writeRepoJson(env, CURATED_PATH, catalog, \`Curate Psaltikon hymns: \${entries.length}\`);\n  }\n  return { changed, entries, ...(entries.length === 1 ? { entry: entries[0] } : {}), catalog };\n}\n\nasync function deleteSet`,
  ],
]);

await edit("tests/library-progressive.test.mjs", [
  [
    "frontend bulk regression assertions",
    '  assert.match(source, /type SaveDestination = "sets" \\| "curated" \\| "both"/);',
    '  assert.match(source, /type SaveDestination = "sets" \\| "curated" \\| "both"/);\n  assert.match(source, /type CuratedSelectionMode = "all" \\| "individual"/);',
  ],
  [
    "frontend selection assertions",
    '  assert.match(source, /subcategoryId: curatedSubcategoryId/);',
    '  assert.match(source, /subcategoryId: curatedSubcategoryId/);\n  assert.match(source, /hymnIds: curatedHymnIds/);\n  assert.match(source, /Todos os \\{hymns\\.length\\} hinos do conjunto/);\n  assert.match(source, /Selecionar hinos individualmente/);\n  assert.match(source, /type="checkbox"/);\n  assert.match(source, /Selecionar todos/);\n  assert.match(source, /Limpar seleção/);',
  ],
  [
    "frontend selection styles assertion",
    '  assert.match(styles, /\\.save-destination/);',
    '  assert.match(styles, /\\.save-destination/);\n  assert.match(styles, /\\.curated-hymn-selection/);\n  assert.match(styles, /\\.curated-hymn-options/);',
  ],
]);

await edit("publisher-worker/tests/worker.test.mjs", [
  [
    "batch worker regression",
    '  assert.throws(() => validateCuratedPromotion({\n    path: "hinos/mateusaranha/dormicao.json",\n    hymnId: "apolytikion",\n    subcategoryId: "missing",\n  }, catalog, published), /Subcategoria/);\n});',
    '  assert.throws(() => validateCuratedPromotion({\n    path: "hinos/mateusaranha/dormicao.json",\n    hymnId: "apolytikion",\n    subcategoryId: "missing",\n  }, catalog, published), /Subcategoria/);\n\n  const batch = validateCuratedPromotion({\n    path: "hinos/mateusaranha/dormicao.json",\n    hymnIds: ["apolytikion", "kontakion", "apolytikion"],\n    subcategoryId: "grandes-festas-dormicao",\n  }, catalog, published);\n  assert.deepEqual(batch.hymnIds, ["apolytikion", "kontakion"]);\n  assert.deepEqual(batch.hymns, published.hymns);\n  assert.throws(() => validateCuratedPromotion({\n    path: "hinos/mateusaranha/dormicao.json",\n    hymnIds: ["apolytikion", "missing"],\n    subcategoryId: "grandes-festas-dormicao",\n  }, catalog, published), /missing/);\n});',
  ],
]);

console.log("Bulk curated hymn selection migration applied.");
