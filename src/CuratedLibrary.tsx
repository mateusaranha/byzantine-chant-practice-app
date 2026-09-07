import { useRef, useState } from "react";
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
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const catalog = catalogOverride || staticCatalog;
  const errors = catalogOverride ? [] : staticErrors;
  const groups = curatedGroups(catalog);
  const category = groups.find(group => group.id === categoryId);

  function focusHeading() {
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <section className="cloud-card curated-library" aria-labelledby="curated-title">
      <h3 id="curated-title" ref={heading} tabIndex={-1}>Biblioteca curada</h3>
      <p>Materiais selecionados e organizados por tema para estudo. Uma seleção do curador, sem caráter oficial.</p>
      {errors.length > 0 && (
        <p className="cloud-notice error" role="alert">
          Parte do catálogo está indisponível. O restante da biblioteca continua disponível.
        </p>
      )}

      {category ? <>
        <button className="cloud-secondary" onClick={() => {
          setCategoryId(null);
          requestAnimationFrame(() => categoryButtons.current.get(category.id)?.focus());
        }}>← Biblioteca curada</button>
        <h4>{category.label}</h4>
        <div className="curated-categories">
          {category.subcategories.map(subcategory => (
            <a
              className="cloud-secondary curated-set-link"
              key={subcategory.id}
              href={createShareUrl(window.location.href, { path: subcategory.source!.path, hymnId: null })}
            >
              <strong>{subcategory.label}</strong>
              <span aria-hidden="true">→</span>
            </a>
          ))}
        </div>
        <p className="curated-hint">
          Cada item abre diretamente o conjunto completo de hinos em uma área temporária de estudo.
        </p>
      </> : groups.length ? (
        <div className="curated-categories">
          {groups.map(group => (
            <button
              className="cloud-secondary"
              key={group.id}
              ref={element => {
                if (element) categoryButtons.current.set(group.id, element);
                else categoryButtons.current.delete(group.id);
              }}
              onClick={() => {
                setCategoryId(group.id);
                focusHeading();
              }}
            >
              <strong>{group.label}</strong>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="cloud-empty">A seleção de materiais está sendo preparada. Enquanto isso, explore os conjuntos publicados.</p>
      )}
    </section>
  );
}
