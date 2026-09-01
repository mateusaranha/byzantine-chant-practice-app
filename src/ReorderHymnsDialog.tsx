import { useEffect, useRef, useState } from "react";
import type { Hymn } from "./hymnState";

export default function ReorderHymnsDialog({
  hymns,
  trigger,
  onMove,
  onClose,
}: {
  hymns: Hymn[];
  trigger: HTMLButtonElement;
  onMove: (id: string, direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  function move(hymn: Hymn, index: number, direction: -1 | 1) {
    onMove(hymn.id, direction);
    const title = hymn.title || "Novo hino";
    setMessage(`${title} movido para a posição ${index + direction + 1}.`);
  }

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog reorder-dialog"
      aria-labelledby="reorder-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onClose();
      }}
    >
      <div className="help-heading">
        <h2 id="reorder-title" ref={titleRef} tabIndex={-1}>Organizar hinos</h2>
        <button className="help-close" onClick={onClose} aria-label="Fechar organização dos hinos">
          Fechar <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="help-copy reorder-copy">
        <p className="reorder-intro">
          Use as setas para colocar os hinos na ordem desejada. A alteração é salva automaticamente.
        </p>
        <ol className="reorder-list">
          {hymns.map((hymn, index) => {
            const title = hymn.title || "Novo hino";
            return (
              <li key={hymn.id}>
                <span className="reorder-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="reorder-hymn-copy">
                  <strong>{title}</strong>
                  {hymn.mode && <span>{hymn.mode}</span>}
                </span>
                <span className="reorder-buttons">
                  <button
                    type="button"
                    onClick={() => move(hymn, index, -1)}
                    disabled={index === 0}
                    aria-label={`Mover ${title} para cima`}
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(hymn, index, 1)}
                    disabled={index === hymns.length - 1}
                    aria-label={`Mover ${title} para baixo`}
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="reorder-status" role="status" aria-live="polite">{message}</p>
      </div>
    </dialog>
  );
}
