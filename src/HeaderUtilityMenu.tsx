import { useEffect, useRef, useState } from "react";
import "./headerUtilityMenu.css";

type HeaderUtilityMenuProps = {
  onExportBackup: () => void;
  onImportBackup: () => void;
  onExportPdf: (trigger: HTMLButtonElement) => void;
};

const POPOVER_ID = "header-more-actions-popover";

export default function HeaderUtilityMenu({
  onExportBackup,
  onImportBackup,
  onExportPdf,
}: HeaderUtilityMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) setOpen(false);
    }

    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  function restoreTriggerFocus() {
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  function exportBackup() {
    setOpen(false);
    onExportBackup();
    restoreTriggerFocus();
  }

  function importBackup() {
    setOpen(false);
    onImportBackup();
    restoreTriggerFocus();
  }

  function exportPdf() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setOpen(false);
    onExportPdf(trigger);
  }

  return (
    <div className="header-more-actions" ref={rootRef}>
      <button
        ref={triggerRef}
        className="header-more-trigger"
        type="button"
        aria-label="Mais ações"
        title="Mais ações"
        aria-expanded={open}
        aria-controls={POPOVER_ID}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div className="header-more-popover" id={POPOVER_ID} role="group" aria-label="Ações adicionais">
          <button className="header-more-item" type="button" onClick={exportPdf}>
            Exportar PDF para celular
          </button>
          <div className="header-more-separator" aria-hidden="true" />
          <button className="header-more-item" type="button" onClick={exportBackup}>
            Exportar cópia de segurança
          </button>
          <button className="header-more-item" type="button" onClick={importBackup}>
            Importar cópia de segurança
          </button>
        </div>
      )}
    </div>
  );
}
