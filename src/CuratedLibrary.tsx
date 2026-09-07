import { useRef, useState } from "react";
import rawCatalog from "../catalog/curated.json";
import { curatedGroups, readCuratedCatalog } from "./curatedCatalog";
import type { CuratedCatalog } from "./curatedCatalog";
import { createShareUrl } from "./sharedHymns";
import ShareDialog from "./ShareDialog";

const { catalog: staticCatalog, errors: staticErrors } = readCuratedCatalog(rawCatalog);

export default function CuratedLibrary({
  apiBase,
  catalogOverride,
}: {
  apiBase: string;
  catalogOverride?: CuratedCatalog;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ path: string; hymnId: string; trigger: HTMLButtonElement } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const subcategoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const catalog = catalogOverride || staticCatalog;
  const errors = catalogOverride ? [] : staticErrors;
  const groups = curatedGroups(catalog);
  const category = groups.find(group => group.id === categoryId);
  const subcategory = category?.subcategories.find(group => group.id === subcategoryId);

  function focusHeading() {
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <section className="cloud-card curated-library" aria-labelledby="curated-title">
      <h3 id="curated-title" ref={heading} tabIndex={-1}>Biblioteca curada</h3>
      <p>Hinos selecionados e organizados por tema para estudo. Uma seleção do curador, sem caráter oficial.</p>
      {errors.length > 0 && <p className="cloud-notice error" role="alert">Parte do catálogo está indisponível. O restante da biblioteca continua disponível.</p>}

      {subcategory && category ? <>
        <button className="cloud-secondary" onClick={() => {
          setSubcategoryId(null);
          requestAnimationFrame(() => subcategoryButtons.current.get(subcategory.id)?.focus());
        }}>← {category.label}</button>
        <h4>{subcategory.label}</h4>
        <div className="curated-entries">
          {subcategory.entries.map(entry => (
            <article className="curated-entry" key={entry.id}>
              <h5>{entry.title}</h5>
              {entry.note && <details><summary>Sobre este hino</summary><p>{entry.note}</p></details>}
              <div className="curated-actions">
                <a className="cloud-primary" href={createShareUrl(window.location.href, entry.source)}>Estudar agora</a>
                <button className="cloud-secondary" aria-haspopup="dialog" onClick={event => setSharing({ ...entry.source, trigger: event.currentTarget })}>Compartilhar</button>
              </div>
            </article>
          ))}
        </div>
        <p className="curated-hint">O estudo abre em uma área temporária. Lá, “Adicionar ao meu espaço” guarda uma cópia sem substituir seus hinos.</p>
      </> : category ? <>
        <button className="cloud-secondary" onClick={() => {
          setCategoryId(null);
          requestAnimationFrame(() => categoryButtons.current.get(category.id)?.focus());
        }}>← Categorias</button>
        <h4>{category.label}</h4>
        <div className="curated-categories">
          {category.subcategories.map(group => <button className="cloud-secondary" key={group.id}
            ref={element => {
              if (element) subcategoryButtons.current.set(group.id, element);
              else subcategoryButtons.current.delete(group.id);
            }}
            onClick={() => {
              setSubcategoryId(group.id);
              focusHeading();
            }}>
            <strong>{group.label}</strong><span>{group.entries.length} {group.entries.length === 1 ? "hino" : "hinos"}</span>
          </button>)}
        </div>
      </> : groups.length ? (
        <div className="curated-categories">
          {groups.map(group => <button className="cloud-secondary" key={group.id}
            ref={element => {
              if (element) categoryButtons.current.set(group.id, element);
              else categoryButtons.current.delete(group.id);
            }}
            onClick={() => {
              setCategoryId(group.id);
              setSubcategoryId(null);
              focusHeading();
            }}>
            <strong>{group.label}</strong><span>{group.subcategories.length} {group.subcategories.length === 1 ? "subcategoria" : "subcategorias"}</span>
          </button>)}
        </div>
      ) : <p className="cloud-empty">A seleção de hinos está sendo preparada. Enquanto isso, explore os conjuntos publicados.</p>}

      {sharing && <ShareDialog apiBase={apiBase} path={sharing.path} initialHymnId={sharing.hymnId} trigger={sharing.trigger} onClose={() => setSharing(null)} />}
    </section>
  );
}
