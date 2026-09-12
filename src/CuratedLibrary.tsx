import { useEffect, useId, useState, type FormEvent } from "react";
import rawCatalog from "../catalog/curated.json";
import { curatedGroups, readCuratedCatalog } from "./curatedCatalog";
import type { CuratedCatalog, CuratedCategory, CuratedSubcategory } from "./curatedCatalog";
import { createShareUrl } from "./sharedHymns";

const SESSION_KEY = "psaltikon-publisher-session";
const { catalog: staticCatalog, errors: staticErrors } = readCuratedCatalog(rawCatalog);

type EditTarget = {
  kind: "category" | "subcategory";
  id: string;
  draft: string;
};

type ActionMenu = {
  kind: "category" | "subcategory";
  id: string;
};

type CuratedMutationResult = {
  catalog?: unknown;
  relisted?: boolean;
  error?: string;
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
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null);
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const instanceId = useId();
  const errors = catalogOverride ? [] : staticErrors;
  const groups = curatedGroups(catalog, { includeEmpty: canEdit });

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

  useEffect(() => {
    if (!actionMenu) return undefined;
    function closeMenu(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(".curated-action-menu-shell")) return;
      setActionMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActionMenu(null);
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionMenu]);

  function beginEdit(kind: EditTarget["kind"], id: string, label: string) {
    setActionMenu(null);
    setActionMessage("");
    setActionError("");
    setEditError("");
    setEditing({ kind, id, draft: label });
  }

  function cancelEdit() {
    if (editBusy) return;
    setEditing(null);
    setEditError("");
  }

  function applyUpdatedCatalog(value: unknown) {
    const parsed = readCuratedCatalog(value);
    if (parsed.errors.length) throw new Error("O catálogo atualizado retornou uma estrutura inválida.");
    setCatalog(parsed.catalog);
    return parsed.catalog;
  }

  async function adminRequest(path: string, init: RequestInit) {
    if (!apiBase || !canEdit) throw new Error("Somente o curador pode alterar a Biblioteca curada.");
    const token = readStoredSession();
    if (!token) {
      setCanEdit(false);
      throw new Error("Sua sessão expirou. Entre novamente para editar a curadoria.");
    }
    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const result = await response.json().catch(() => ({})) as CuratedMutationResult;
    if (!response.ok) throw new Error(result.error || "Não foi possível alterar a Biblioteca curada.");
    return result;
  }

  async function runAction(label: string, operation: () => Promise<void>) {
    setActionBusy(label);
    setActionError("");
    setActionMessage("");
    try {
      await operation();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível alterar a Biblioteca curada.");
    } finally {
      setActionBusy("");
    }
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !canEdit || editBusy || !apiBase) return;
    const label = editing.draft.trim();
    if (!label) {
      setEditError(editing.kind === "category" ? "Informe o nome da categoria." : "Informe o nome da subcategoria.");
      return;
    }

    setEditBusy(true);
    setEditError("");
    setActionMessage("");
    setActionError("");
    try {
      const endpoint = editing.kind === "category" ? "/api/curated/categories" : "/api/curated/subcategories";
      const result = await adminRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ id: editing.id, label }),
      });
      applyUpdatedCatalog(result.catalog);
      setEditing(null);
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Não foi possível renomear este item.");
    } finally {
      setEditBusy(false);
    }
  }

  function removeAssociation(subcategory: CuratedSubcategory) {
    if (!subcategory.source?.path) return;
    const confirmed = window.confirm(
      `Remover “${subcategory.label}” da Biblioteca curada?\n\nO conjunto publicado e todos os seus hinos serão preservados. A subcategoria ficará vazia e poderá ser excluída depois.`,
    );
    if (!confirmed) return;
    void runAction(`remove:${subcategory.id}`, async () => {
      const result = await adminRequest(`/api/curated?subcategoryId=${encodeURIComponent(subcategory.id)}`, { method: "DELETE" });
      applyUpdatedCatalog(result.catalog);
      setActionMenu(null);
      setActionMessage(
        result.relisted
          ? `“${subcategory.label}” foi removida da Biblioteca curada. O conjunto foi preservado e voltou a aparecer em Meus conjuntos.`
          : `“${subcategory.label}” foi removida da Biblioteca curada. O conjunto e seus hinos foram preservados.`,
      );
    });
  }

  function deleteSubcategory(subcategory: CuratedSubcategory) {
    if (subcategory.source?.path) return;
    const confirmed = window.confirm(
      `Excluir a subcategoria vazia “${subcategory.label}”?\n\nIsso remove apenas sua organização na Biblioteca curada. Nenhum conjunto ou hino será apagado.`,
    );
    if (!confirmed) return;
    void runAction(`subcategory:${subcategory.id}`, async () => {
      const result = await adminRequest(`/api/curated/subcategories?id=${encodeURIComponent(subcategory.id)}`, { method: "DELETE" });
      applyUpdatedCatalog(result.catalog);
      setActionMenu(null);
      setActionMessage(`Subcategoria “${subcategory.label}” excluída. Nenhum conjunto ou hino foi apagado.`);
    });
  }

  function deleteCategory(category: CuratedCategory) {
    const hasSubcategories = catalog.subcategories.some(subcategory => subcategory.categoryId === category.id);
    if (hasSubcategories) return;
    const confirmed = window.confirm(
      `Excluir a categoria vazia “${category.label}”?\n\nIsso remove apenas a categoria da Biblioteca curada. Nenhum conjunto ou hino será apagado.`,
    );
    if (!confirmed) return;
    void runAction(`category:${category.id}`, async () => {
      const result = await adminRequest(`/api/curated/categories?id=${encodeURIComponent(category.id)}`, { method: "DELETE" });
      applyUpdatedCatalog(result.catalog);
      setExpandedCategoryId(current => current === category.id ? null : current);
      setActionMenu(null);
      setActionMessage(`Categoria “${category.label}” excluída. Nenhum conjunto ou hino foi apagado.`);
    });
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

  function categoryActions(category: CuratedCategory) {
    const open = actionMenu?.kind === "category" && actionMenu.id === category.id;
    const empty = !catalog.subcategories.some(subcategory => subcategory.categoryId === category.id);
    return (
      <div className="curated-action-menu-shell curated-category-actions">
        <button
          type="button"
          className="curated-actions-button"
          aria-label={`Ações da categoria “${category.label}”`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setActionMenu(current => current?.kind === "category" && current.id === category.id ? null : { kind: "category", id: category.id })}
          disabled={Boolean(actionBusy) || editBusy}
        >
          ⋯
        </button>
        {open && (
          <div className="curated-action-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => beginEdit("category", category.id, category.label)}>Renomear</button>
            {empty && (
              <button type="button" role="menuitem" className="danger" onClick={() => deleteCategory(category)}>
                Excluir categoria
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function subcategoryActions(subcategory: CuratedSubcategory) {
    const open = actionMenu?.kind === "subcategory" && actionMenu.id === subcategory.id;
    return (
      <div className="curated-action-menu-shell curated-subcategory-actions">
        <button
          type="button"
          className="curated-actions-button"
          aria-label={`Ações da subcategoria “${subcategory.label}”`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setActionMenu(current => current?.kind === "subcategory" && current.id === subcategory.id ? null : { kind: "subcategory", id: subcategory.id })}
          disabled={Boolean(actionBusy) || editBusy}
        >
          ⋯
        </button>
        {open && (
          <div className="curated-action-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => beginEdit("subcategory", subcategory.id, subcategory.label)}>Renomear</button>
            {subcategory.source?.path ? (
              <button type="button" role="menuitem" className="danger" onClick={() => removeAssociation(subcategory)}>
                Remover da Biblioteca curada
              </button>
            ) : (
              <button type="button" role="menuitem" className="danger" onClick={() => deleteSubcategory(subcategory)}>
                Excluir subcategoria
              </button>
            )}
          </div>
        )}
      </div>
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
      {canEdit && <p className="curated-admin-note">Modo de curadoria: itens vazios aparecem apenas para o administrador.</p>}
      {actionMessage && <p className="cloud-notice" role="status">{actionMessage}</p>}
      {actionError && <p className="cloud-notice error" role="alert">{actionError}</p>}

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
                      {canEdit && categoryActions(group)}
                    </>
                  )}
                </div>
                <div id={panelId} hidden={!expanded} role="region" aria-labelledby={buttonId}>
                  {expanded && (
                    group.subcategories.length ? (
                      <ul className="curated-subcategories">
                        {group.subcategories.map(subcategory => {
                          const subcategoryEditing = editing?.kind === "subcategory" && editing.id === subcategory.id;
                          return (
                            <li key={subcategory.id}>
                              {subcategoryEditing ? inlineEditor("subcategory", subcategory.id) : (
                                <div className={`curated-subcategory-row${canEdit ? " is-editable" : ""}`}>
                                  {subcategory.source?.path ? (
                                    <a
                                      className="curated-set-link"
                                      href={createShareUrl(window.location.href, { path: subcategory.source.path, hymnId: null })}
                                    >
                                      <span>{subcategory.label}</span>
                                      <span className="curated-arrow" aria-hidden="true">→</span>
                                    </a>
                                  ) : (
                                    <div className="curated-empty-subcategory">
                                      <span>{subcategory.label}</span>
                                      <small>Sem conjunto associado</small>
                                    </div>
                                  )}
                                  {canEdit && subcategoryActions(subcategory)}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : canEdit ? (
                      <p className="curated-empty-category">Categoria vazia. Use o menu de ações para renomeá-la ou excluí-la.</p>
                    ) : null
                  )}
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
