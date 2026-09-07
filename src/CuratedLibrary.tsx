import { useId, useState } from "react";
import rawCatalog from "../catalog/curated.json";
import { curatedGroups, readCuratedCatalog } from "./curatedCatalog";
import type { CuratedCatalog } from "./curatedCatalog";
import { createShareUrl } from "./sharedHymns";

const { catalog: staticCatalog, errors: staticErrors } = readCuratedCatalog(rawCatalog);

export default function CuratedLibrary({
  apiBase: _apiBase,
  catalogOverride,
}: {
  apiBase: string;
  catalogOverride?: CuratedCatalog;
}) {
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const instanceId = useId();
  const catalog = catalogOverride || staticCatalog;
  const errors = catalogOverride ? [] : staticErrors;
  const groups = curatedGroups(catalog);
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
            return (
              <div className="curated-category" key={group.id}>
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
                <div id={panelId} hidden={!expanded} role="region" aria-labelledby={buttonId}>
                  {expanded && <ul className="curated-subcategories">
                    {group.subcategories.map(subcategory => (
                      <li key={subcategory.id}>
                        <a
                          className="curated-set-link"
                          href={createShareUrl(window.location.href, { path: subcategory.source!.path, hymnId: null })}
                        >
                          <span>{subcategory.label}</span>
                          <span className="curated-arrow" aria-hidden="true">→</span>
                        </a>
                      </li>
                    ))}
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
