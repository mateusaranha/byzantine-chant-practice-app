import { useEffect, useId, useState, type FormEvent } from "react";
import rawCatalog from "../catalog/curated.json";
import { curatedGroups, readCuratedCatalog } from "./curatedCatalog";
import type { CuratedCatalog } from "./curatedCatalog";
import { createShareUrl } from "./sharedHymns";

const SESSION_KEY = "psaltikon-publisher-session";
const { catalog: staticCatalog, errors: staticErrors } = readCuratedCatalog(rawCatalog);

type EditTarget = {
  kind: "category" | "subcategory";
  id: string;
  draft: string;
};

function readStoredSession() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function normalizedCatalog(value: CuratedCatalog) {
  const result = readCuratedCatalog(value);
  return result.errors.length ? value : result.catalog;
}

export default function CuratedLibrary({
  apiBase,
  catalogOverride,
}: {
  apiBase: string;
  catalogOverride?: CuratedCatalog;
}) {
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CuratedCatalog>(() => normalizedCatalog(catalogOverride || staticCatalog));
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const instanceId = useId();
  const errors = catalogOverride ? [] : staticErrors;
  const groups = curatedGroups(catalog);

  useEffect(() => {
    setCatalog(normalizedCatalog(catalogOverride || staticCatalog));
  }, [catalogOverride]);

  useEffect(() => {
    if (!apiBase) return undefined;
    let cancelled = false;
    const base = apiBase.replace(/\/$/, "");

    void fetch(`${base}/api/curated`)
      .then(async response => response.ok ? response.json() : null)
      .then(value => {
        if (cancelled || !value) return;
        const result = readCuratedCatalog(value);
        if (!result.errors.length) setCatalog(result.catalog);
      })
      .catch(() => {
        // Keep the bundled/parent catalog as a resilient public fallback.
      });

    const token = readStoredSession();
    if (!token) {
      setCanEdit(false);
      return () => { cancelled = true; };
    }
    void fetch(`${base}/api/session`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => response.ok ? response.json() : null)
      .then(session => {
        if (!cancelled) setCanEdit(Boolean(session?.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setCanEdit(false);
      });

    return () => { cancelled = true; };
  }, [apiBase]);

  function beginEdit(kind: EditTarget["kind"], id: string, label: string) {
    setEditError("");
    setEditing({ kind, id, draft: label });
  }

  function cancelEdit() {
    if (editBusy) return;
    setEditing(null);
    setEditError("");
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !canEdit || editBusy || !apiBase) return;
    const label = editing.draft.trim();
    if (!label) {
      setEditError(editing.kind === "category" ? "Informe o nome da categoria." : "Informe o nome da subcategoria.");
      return;
    }
    const token = readStoredSession();
    if (!token) {
      setCanEdit(false);
      setEditError("Sua sessão expirou. Entre novamente para editar a curadoria.");
      return;
    }

    setEditBusy(true);
    setEditError("");
    try {
      const endpoint = editing.kind === "category" ? "/api/curated/categories" : "/api/curated/subcategories";
      const response = await fetch(`${apiBase.replace(/\/$/, "")}${endpoint}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: editing.id, label }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível renomear este item.");
      const parsed = readCuratedCatalog(result.catalog);
      if (parsed.errors.length) throw new Error("O catálogo atualizado retornou uma estrutura inválida.");
      setCatalog(parsed.catalog);
      setEditing(null);
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Não foi possível renomear este item.");
    } finally {
      setEditBusy(false);
    }
  }

  function inlineEditor(kind: EditTarget["kind"], id: string) {
    if (editing?.kind !== kind || editing.id !== id) return null;
    const subject = kind === "category" ? "categoria" : "subcategoria";
    return (
      <form
        className={`curated-inline-editor curated-${kind}-editor`}
        onSubmit={submitRename}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
          }
        }}
      >
        <input
          autoFocus
          maxLength={100}
          aria-label={`Nome da ${subject}`}
          value={editing.draft}
          onChange={event => setEditing(current => current ? { ...current, draft: event.target.value } : current)}
          disabled={editBusy}
        />
        <button type="submit" className="curated-inline-save" aria-label={`Salvar nome da ${subject}`} title="Salvar" disabled={editBusy}>✓</button>
        <button type="button" className="curated-inline-cancel" aria-label={`Cancelar edição da ${subject}`} title="Cancelar" onClick={cancelEdit} disabled={editBusy}>×</button>
        {editError && <span className="curated-inline-error" role="alert">{editError}</span>}
      </form>
    );
  }

  return (
    <section className="curated-library" aria-labelledby={`${instanceId}-title`}>
      <h3 id={`${instanceId}-title`}>Biblioteca curada</h3>
      <p>Materiais selecionados e organizados por tema para estudo. Uma seleção do curador, sem caráter oficial.</p>
      {errors.length > 0 && (
        <p className="cloud-notice error" role="alert">
          Parte do catálogo está indisponível. O restante da biblioteca continua disponível.
        </p>
      )}

      {groups.length ? (
        <div className="curated-categories">
          {groups.map(group => {
            const expanded = expandedCategoryId === group.id;
            const buttonId = `${instanceId}-${group.id}-button`;
            const panelId = `${instanceId}-${group.id}-panel`;
            const categoryEditing = editing?.kind === "category" && editing.id === group.id;
            return (
              <div className="curated-category" key={group.id}>
                <div className={`curated-category-heading${canEdit && !categoryEditing ? " is-editable" : ""}`}>
                  {categoryEditing ? inlineEditor("category", group.id) : (
                    <>
                      <h4>
                        <button
                          className="curated-category-toggle"
                          id={buttonId}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          onClick={() => setExpandedCategoryId(current => current === group.id ? null : group.id)}
                        >
                          <span>{group.label}</span>
                          <span className="curated-arrow" aria-hidden="true">{expanded ? "↑" : "→"}</span>
                        </button>
                      </h4>
                      {canEdit && (
                        <button
                          type="button"
                          className="curated-edit-button curated-category-edit"
                          aria-label={`Editar nome da categoria “${group.label}”`}
                          title="Editar nome"
                          onClick={() => beginEdit("category", group.id, group.label)}
                        >
                          ✎
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div id={panelId} hidden={!expanded} role="region" aria-labelledby={buttonId}>
                  {expanded && <ul className="curated-subcategories">
                    {group.subcategories.map(subcategory => {
                      const subcategoryEditing = editing?.kind === "subcategory" && editing.id === subcategory.id;
                      return (
                        <li key={subcategory.id}>
                          {subcategoryEditing ? inlineEditor("subcategory", subcategory.id) : (
                            <div className={`curated-subcategory-row${canEdit ? " is-editable" : ""}`}>
                              <a
                                className="curated-set-link"
                                href={createShareUrl(window.location.href, { path: subcategory.source!.path, hymnId: null })}
                              >
                                <span>{subcategory.label}</span>
                                <span className="curated-arrow" aria-hidden="true">→</span>
                              </a>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="curated-edit-button curated-subcategory-edit"
                                  aria-label={`Editar nome da subcategoria “${subcategory.label}”`}
                                  title="Editar nome"
                                  onClick={() => beginEdit("subcategory", subcategory.id, subcategory.label)}
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="cloud-empty">A seleção de materiais está sendo preparada. Enquanto isso, explore os conjuntos publicados.</p>
      )}
    </section>
  );
}
