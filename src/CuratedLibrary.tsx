import { useRef, useState } from "react";
import rawCatalog from "../catalog/curated.json";
import { curatedGroups, readCuratedCatalog } from "./curatedCatalog";
import { createShareUrl } from "./sharedHymns";
import ShareDialog from "./ShareDialog";

const { catalog, errors } = readCuratedCatalog(rawCatalog);
const groups = curatedGroups(catalog);

export default function CuratedLibrary({ apiBase }: { apiBase: string }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ path: string; hymnId: string; trigger: HTMLButtonElement } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const category = groups.find(group => group.id === categoryId);

  return (
    <section className="cloud-card curated-library" aria-labelledby="curated-title">
      <h3 id="curated-title" ref={heading} tabIndex={-1}>Biblioteca curada</h3>
      <p>Hinos selecionados e organizados por tema para estudo. Uma seleção do curador, sem caráter oficial.</p>
      {errors.length > 0 && <p className="cloud-notice error" role="alert">Parte do catálogo está indisponível. O restante da biblioteca continua disponível.</p>}
      {category ? <>
        <button className="cloud-secondary" onClick={() => {
          setCategoryId(null);
          requestAnimationFrame(() => categoryButtons.current.get(category.id)?.focus());
        }}>Voltar às categorias</button>
        <h4>{category.label}</h4>
        <div className="curated-entries">
          {category.entries.map(entry => (
            <article className="curated-entry" key={entry.id}>
              <h5>{entry.title}</h5>
              {entry.note && <details><summary>Sobre esta versão</summary><p>{entry.note}</p></details>}
              <div className="curated-actions">
                <a className="cloud-primary" href={createShareUrl(window.location.href, entry.source)}>Estudar agora</a>
                <button className="cloud-secondary" aria-haspopup="dialog" onClick={event => setSharing({ ...entry.source, trigger: event.currentTarget })}>Compartilhar</button>
              </div>
            </article>
          ))}
        </div>
        <p className="curated-hint">O estudo abre em uma área temporária. Lá, “Adicionar ao meu espaço” guarda uma cópia sem substituir seus hinos.</p>
      </> : groups.length ? (
        <div className="curated-categories">
          {groups.map(group => <button className="cloud-secondary" key={group.id}
            ref={element => {
              if (element) categoryButtons.current.set(group.id, element);
              else categoryButtons.current.delete(group.id);
            }}
            onClick={() => {
              setCategoryId(group.id);
              requestAnimationFrame(() => heading.current?.focus());
            }}>
            <strong>{group.label}</strong><span>{group.entries.length} {group.entries.length === 1 ? "versão" : "versões"}</span>
          </button>)}
        </div>
      ) : <p className="cloud-empty">A seleção de hinos está sendo preparada. Enquanto isso, explore os conjuntos publicados abaixo.</p>}
      {sharing && <ShareDialog apiBase={apiBase} path={sharing.path} initialHymnId={sharing.hymnId} trigger={sharing.trigger} onClose={() => setSharing(null)} />}
    </section>
  );
}
