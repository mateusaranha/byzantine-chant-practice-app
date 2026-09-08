import { useEffect, useMemo, useRef, useState } from "react";
import {
  addHymnsToGroup,
  createHymnGroup,
  hymnLayout,
  hymnLayoutKey,
  moveHymnInGroup,
  moveHymnLayoutItem,
  removeHymnFromGroup,
  renameHymnGroup,
  ungroupHymns,
} from "./hymnState";
import type { Hymn, HymnGroup, HymnLayoutItem } from "./hymnState";

type GroupEditor =
  | { mode: "create"; name: string }
  | { mode: "rename"; group: HymnGroup; name: string };

export default function ReorderHymnsDialog({
  hymns,
  trigger,
  onChange,
  onDeleteSelected,
  onClose,
}: {
  hymns: Hymn[];
  trigger: HTMLButtonElement;
  onChange: (hymns: Hymn[]) => void;
  onDeleteSelected: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [targetGroupId, setTargetGroupId] = useState("");
  const [groupEditor, setGroupEditor] = useState<GroupEditor | null>(null);
  const layout = useMemo(() => hymnLayout(hymns), [hymns]);
  const groups = layout.filter((item): item is Extract<HymnLayoutItem, { type: "group" }> => item.type === "group");
  const selectedCount = selectedIds.size;
  const selectedUngroupedCount = hymns.filter(
    (hymn) => selectedIds.has(hymn.id) && !hymn.group,
  ).length;
  const allSelected = selectedCount === hymns.length;
  const groupMembershipKey = useMemo(
    () => hymns.map((hymn) => `${hymn.id}:${hymn.group?.id || ""}`).join("|"),
    [hymns],
  );
  const canAddToTarget = Boolean(targetGroupId && hymns.some(
    (hymn) => selectedIds.has(hymn.id) && hymn.group?.id !== targetGroupId,
  ));

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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [groupMembershipKey]);

  useEffect(() => {
    if (!groups.some((item) => item.group.id === targetGroupId)) {
      setTargetGroupId(groups[0]?.group.id || "");
    }
  }, [groups, targetGroupId]);

  function toggleSelected(hymnId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(hymnId)) next.delete(hymnId);
      else next.add(hymnId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function deleteSelected() {
    if (!selectedCount || allSelected) return;
    const noun = selectedCount === 1 ? "hino" : "hinos";
    if (!window.confirm(`Remover ${selectedCount} ${noun} e todas as suas marcações?`)) return;
    onDeleteSelected([...selectedIds]);
    setSelectedIds(new Set());
    setMessage(`${selectedCount} ${noun} removido${selectedCount === 1 ? "" : "s"}.`);
  }

  function moveLayoutItem(item: HymnLayoutItem, index: number, direction: -1 | 1) {
    onChange(moveHymnLayoutItem(hymns, hymnLayoutKey(item), direction));
    const label = item.type === "group" ? `Grupo “${item.group.name}”` : item.hymn.title || "Novo hino";
    setMessage(`${label} movido para a posição ${index + direction + 1}.`);
  }

  function moveGroupMember(hymn: Hymn, index: number, direction: -1 | 1) {
    onChange(moveHymnInGroup(hymns, hymn.id, direction));
    setMessage(`${hymn.title || "Novo hino"} movido dentro do grupo para a posição ${index + direction + 1}.`);
  }

  function saveGroupEditor() {
    if (!groupEditor) return;
    const name = groupEditor.name.trim();
    if (!name) {
      setMessage("Informe um nome para o grupo.");
      return;
    }
    if (groupEditor.mode === "create") {
      if (selectedUngroupedCount < 2) {
        setMessage("Selecione pelo menos 2 hinos que ainda não pertençam a um grupo.");
        return;
      }
      onChange(createHymnGroup(hymns, selectedIds, name));
      setSelectedIds(new Set());
      setMessage(`Grupo “${name}” criado.`);
    } else {
      onChange(renameHymnGroup(hymns, groupEditor.group.id, name));
      setMessage(`Grupo renomeado para “${name}”.`);
    }
    setGroupEditor(null);
  }

  function addSelectedToGroup() {
    if (!canAddToTarget) return;
    const group = groups.find((item) => item.group.id === targetGroupId)?.group;
    if (!group) return;
    const addedCount = hymns.filter(
      (hymn) => selectedIds.has(hymn.id) && hymn.group?.id !== targetGroupId,
    ).length;
    onChange(addHymnsToGroup(hymns, selectedIds, targetGroupId));
    setSelectedIds(new Set());
    setMessage(`${addedCount} ${addedCount === 1 ? "hino adicionado" : "hinos adicionados"} ao grupo “${group.name}”.`);
  }

  function removeFromGroup(hymn: Hymn) {
    onChange(removeHymnFromGroup(hymns, hymn.id));
    setMessage(`${hymn.title || "Novo hino"} removido do grupo.`);
  }

  function ungroup(group: HymnGroup) {
    onChange(ungroupHymns(hymns, group.id));
    setMessage(`Grupo “${group.name}” desfeito. Os hinos foram mantidos.`);
  }

  function selectionCheckbox(hymn: Hymn) {
    const title = hymn.title || "Novo hino";
    return (
      <input
        className="reorder-checkbox"
        type="checkbox"
        checked={selectedIds.has(hymn.id)}
        onChange={() => toggleSelected(hymn.id)}
        aria-label={`Selecionar ${title}`}
      />
    );
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
          Use as setas para ordenar hinos e grupos. A alteração é salva automaticamente. Selecione hinos para reuni-los em um grupo, movê-los para um grupo existente ou excluí-los.
        </p>
        <ol className="reorder-list">
          {layout.map((item, layoutIndex) => {
            if (item.type === "hymn") {
              const hymn = item.hymn;
              const title = hymn.title || "Novo hino";
              return (
                <li key={hymn.id} className={selectedIds.has(hymn.id) ? "reorder-selected" : undefined}>
                  {selectionCheckbox(hymn)}
                  <span className="reorder-number" aria-hidden="true">{String(layoutIndex + 1).padStart(2, "0")}</span>
                  <span className="reorder-hymn-copy">
                    <strong>{title}</strong>
                    {hymn.mode && <span>{hymn.mode}</span>}
                  </span>
                  <span className="reorder-buttons">
                    <button type="button" onClick={() => moveLayoutItem(item, layoutIndex, -1)} disabled={layoutIndex === 0} aria-label={`Mover ${title} para cima`} title="Mover para cima">↑</button>
                    <button type="button" onClick={() => moveLayoutItem(item, layoutIndex, 1)} disabled={layoutIndex === layout.length - 1} aria-label={`Mover ${title} para baixo`} title="Mover para baixo">↓</button>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.group.id} className="organize-group">
                <div className="organize-group-header">
                  <span className="reorder-number" aria-hidden="true">{String(layoutIndex + 1).padStart(2, "0")}</span>
                  <span className="organize-group-copy">
                    <strong>{item.group.name}</strong>
                    <span>{item.hymns.length} itens</span>
                  </span>
                  <span className="reorder-buttons">
                    <button type="button" onClick={() => moveLayoutItem(item, layoutIndex, -1)} disabled={layoutIndex === 0} aria-label={`Mover grupo ${item.group.name} para cima`} title="Mover grupo para cima">↑</button>
                    <button type="button" onClick={() => moveLayoutItem(item, layoutIndex, 1)} disabled={layoutIndex === layout.length - 1} aria-label={`Mover grupo ${item.group.name} para baixo`} title="Mover grupo para baixo">↓</button>
                  </span>
                </div>
                <div className="organize-group-actions">
                  <button type="button" onClick={() => setGroupEditor({ mode: "rename", group: item.group, name: item.group.name })}>Renomear grupo</button>
                  <button type="button" onClick={() => ungroup(item.group)}>Desfazer grupo</button>
                </div>
                <ol className="organize-group-members" aria-label={`Hinos do grupo ${item.group.name}`}>
                  {item.hymns.map((hymn, memberIndex) => {
                    const title = hymn.title || "Novo hino";
                    return (
                      <li key={hymn.id} className={selectedIds.has(hymn.id) ? "reorder-selected" : undefined}>
                        {selectionCheckbox(hymn)}
                        <span className="reorder-hymn-copy">
                          <strong>{title}</strong>
                          {hymn.mode && <span>{hymn.mode}</span>}
                        </span>
                        <span className="reorder-buttons organize-member-buttons">
                          <button type="button" onClick={() => moveGroupMember(hymn, memberIndex, -1)} disabled={memberIndex === 0} aria-label={`Mover ${title} para cima dentro do grupo`} title="Mover dentro do grupo para cima">↑</button>
                          <button type="button" onClick={() => moveGroupMember(hymn, memberIndex, 1)} disabled={memberIndex === item.hymns.length - 1} aria-label={`Mover ${title} para baixo dentro do grupo`} title="Mover dentro do grupo para baixo">↓</button>
                        </span>
                        <button type="button" className="remove-from-group" onClick={() => removeFromGroup(hymn)} aria-label={`Remover ${title} do grupo`}>Remover</button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>

        {groupEditor && (
          <div className="group-name-editor" role="group" aria-labelledby="group-name-editor-title">
            <label>
              <span id="group-name-editor-title">{groupEditor.mode === "create" ? "Criar grupo" : "Renomear grupo"}</span>
              <input
                autoFocus
                type="text"
                maxLength={120}
                value={groupEditor.name}
                onChange={(event) => setGroupEditor({ ...groupEditor, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveGroupEditor();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setGroupEditor(null);
                  }
                }}
                aria-label="Nome do grupo"
              />
            </label>
            <div>
              <button type="button" className="cloud-secondary" onClick={() => setGroupEditor(null)}>Cancelar</button>
              <button type="button" className="cloud-primary" onClick={saveGroupEditor} disabled={!groupEditor.name.trim()}>Salvar grupo</button>
            </div>
          </div>
        )}

        <div className="reorder-selection-actions">
          <p>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? "hino selecionado" : "hinos selecionados"}
            {allSelected && selectedCount > 0 && <span>Pelo menos um hino precisa permanecer para excluir.</span>}
          </p>
          <div className="organize-selection-buttons">
            <button type="button" className="cloud-primary" onClick={() => setGroupEditor({ mode: "create", name: "" })} disabled={selectedUngroupedCount < 2}>Criar grupo</button>
            <button type="button" className="cloud-secondary" onClick={clearSelection} disabled={!selectedCount}>Cancelar seleção</button>
            <button type="button" className="delete-selected-hymns" onClick={deleteSelected} disabled={!selectedCount || allSelected}>Excluir selecionados</button>
          </div>
          {!!groups.length && (
            <div className="add-to-group-controls">
              <label htmlFor="target-hymn-group">Adicionar seleção a</label>
              <select id="target-hymn-group" value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)}>
                {groups.map((item) => <option key={item.group.id} value={item.group.id}>{item.group.name}</option>)}
              </select>
              <button type="button" className="cloud-secondary" onClick={addSelectedToGroup} disabled={!canAddToTarget}>Adicionar ao grupo</button>
            </div>
          )}
        </div>
        <p className="reorder-status" role="status" aria-live="polite">{message}</p>
      </div>
    </dialog>
  );
}