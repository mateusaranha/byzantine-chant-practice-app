import { useEffect, useRef, useState } from "react";
import type { Hymn } from "./hymnState";

export default function ReorderHymnsDialog({
  hymns,
  trigger,
  onMove,
  onDeleteSelected,
  onClose,
}: {
  hymns: Hymn[];
  trigger: HTMLButtonElement;
  onMove: (id: string, direction: -1 | 1) => void;
  onDeleteSelected: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === hymns.length;

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

  useEffect(() => {
    const currentIds = new Set(hymns.map((hymn) => hymn.id));
    setSelectedIds((current) => new Set([...current].filter((id) => currentIds.has(id))));
  }, [hymns]);

  function toggleSelected(hymnId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(hymnId)) next.delete(hymnId);
      else next.add(hymnId);
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedCount || allSelected) return;
    const noun = selectedCount === 1 ? "hino" : "hinos";
    if (!window.confirm(`Remover ${selectedCount} ${noun} e todas as suas marcações?`)) return;
    onDeleteSelected([...selectedIds]);
    setSelectedIds(new Set());
    setMessage(`${selectedCount} ${noun} removido${selectedCount === 1 ? "" : "s"}.`);
  }

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
          Selecione hinos para excluí-los em conjunto ou use as setas para reordenar. As alterações são salvas automaticamente.
        </p>
        <ol className="reorder-list">
          {hymns.map((hymn, index) => {
            const title = hymn.title || "Novo hino";
            return (
              <li key={hymn.id} className={selectedIds.has(hymn.id) ? "reorder-selected" : undefined}>
                <input
                  className="reorder-checkbox"
                  type="checkbox"
                  checked={selectedIds.has(hymn.id)}
                  onChange={() => toggleSelected(hymn.id)}
                  aria-label={`Selecionar ${title}`}
                />
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
        <div className="reorder-selection-actions">
          <p>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? "hino selecionado" : "hinos selecionados"}
            {allSelected && selectedCount > 0 && (
              <span>Pelo menos um hino precisa permanecer.</span>
            )}
          </p>
          <button
            type="button"
            className="delete-selected-hymns"
            onClick={deleteSelected}
            disabled={!selectedCount || allSelected}
          >
            Excluir selecionados
          </button>
        </div>
        <p className="reorder-status" role="status" aria-live="polite">{message}</p>
      </div>
    </dialog>
  );
}
