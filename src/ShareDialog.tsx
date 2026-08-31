import { useEffect, useRef, useState } from "react";
import { createShareUrl, loadPublishedSet } from "./sharedHymns";
import type { PublishedSet } from "./sharedHymns";

export default function ShareDialog({ apiBase, path, trigger, onClose }: {
  apiBase: string;
  path: string;
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [published, setPublished] = useState<PublishedSet | null>(null);
  const [selection, setSelection] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const url = published ? createShareUrl(window.location.href, { path, hymnId: selection || null }) : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger.focus();
    };
  }, [trigger]);

  useEffect(() => {
    const controller = new AbortController();
    setPublished(null);
    setError("");
    const timeout = window.setTimeout(() => {
      controller.abort();
      setError("O carregamento demorou demais. Confira sua conexão e tente novamente.");
    }, 20000);
    loadPublishedSet(apiBase, path, controller.signal).then((data) => {
      if (!controller.signal.aborted) setPublished(data);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a publicação.");
    }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [apiBase, path, attempt]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado. Você já pode enviá-lo.");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setMessage("Não foi possível copiar automaticamente. Copie o endereço selecionado abaixo.");
    }
  }

  return (
    <dialog ref={dialogRef} className="help-dialog share-dialog" aria-labelledby="share-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="help-heading">
        <h2 id="share-title">Compartilhar publicação</h2>
        <button className="help-close" onClick={onClose}>Fechar</button>
      </div>
      <div className="help-copy">
        <p>O link abre a versão publicada mais recente, com gravação e marcações. Alterações feitas apenas no seu espaço não entram no link: salve o conjunto na biblioteca antes de compartilhar essas alterações.</p>
        <p>O conteúdo é público. Quem recebe não precisa entrar com GitHub nem abrir a biblioteca.</p>
        {error ? (
          <><p role="alert">{error}</p><button className="cloud-secondary" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></>
        ) : !published ? <p role="status">Carregando a publicação…</p> : (
          <div className="share-form">
            <label htmlFor="share-selection">O que compartilhar em “{published.title}”?</label>
            <select id="share-selection" value={selection} onChange={(event) => { setSelection(event.target.value); setMessage(""); }}>
              <option value="">Conjunto inteiro ({published.hymns.length} hinos)</option>
              {published.hymns.map((hymn, index) => (
                <option key={hymn.id} value={published.hymnIds[index] || `unavailable-${index}`} disabled={!published.hymnIds[index]}>
                  {index + 1}. {hymn.title || "Hino sem título"}{!published.hymnIds[index] ? " (somente no conjunto)" : ""}
                </option>
              ))}
            </select>
            {published.hymnIds.some((id) => id === null) && <p>Alguns hinos antigos não têm um identificador único. Eles podem ser compartilhados no conjunto inteiro.</p>}
            <button className="cloud-primary" onClick={copyLink}>Copiar link</button>
            <label htmlFor="share-url">Link para enviar</label>
            <input id="share-url" ref={linkRef} value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
            <p role="status">{message}</p>
          </div>
        )}
      </div>
    </dialog>
  );
}
