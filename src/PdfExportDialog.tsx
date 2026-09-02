import { useEffect, useRef, useState } from "react";

export type PdfTextMode = "screen" | "greek" | "transliterated" | "both";

export type PdfExportSettings = {
  textMode: PdfTextMode;
  includeColours: boolean;
  includeMelismas: boolean;
};

export const DEFAULT_PDF_EXPORT_SETTINGS: PdfExportSettings = {
  textMode: "screen",
  includeColours: true,
  includeMelismas: true,
};

const TEXT_OPTIONS: { value: PdfTextMode; label: string; description: string }[] = [
  {
    value: "screen",
    label: "Como está na tela",
    description: "Respeita a leitura grega ou transliterada escolhida em cada hino.",
  },
  { value: "greek", label: "Grego", description: "Exporta todos os hinos com a letra grega." },
  {
    value: "transliterated",
    label: "Transliterado",
    description: "Exporta todos os hinos com a leitura em alfabeto latino.",
  },
  {
    value: "both",
    label: "Grego e transliterado",
    description: "Apresenta as duas leituras em páginas separadas, agrupadas por hino.",
  },
];

export default function PdfExportDialog({
  trigger,
  onClose,
  onExport,
}: {
  trigger: HTMLButtonElement;
  onClose: () => void;
  onExport: (settings: PdfExportSettings) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [textMode, setTextMode] = useState<PdfTextMode>(DEFAULT_PDF_EXPORT_SETTINGS.textMode);
  const [includeColours, setIncludeColours] = useState(true);
  const [includeMelismas, setIncludeMelismas] = useState(true);

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

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog pdf-export-dialog"
      aria-labelledby="pdf-export-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="help-heading">
        <h2 id="pdf-export-title" ref={titleRef} tabIndex={-1}>Exportar PDF</h2>
        <button className="help-close" type="button" onClick={onClose}>Cancelar</button>
      </div>
      <form
        className="help-copy pdf-export-form"
        onSubmit={(event) => {
          event.preventDefault();
          onExport({ textMode, includeColours, includeMelismas });
        }}
      >
        <p>Escolha quais leituras e marcações devem aparecer. Títulos, modos e ordem dos hinos serão preservados.</p>

        <fieldset className="pdf-choice-group">
          <legend>Texto do PDF</legend>
          {TEXT_OPTIONS.map((option) => (
            <label className="pdf-option" key={option.value}>
              <input
                type="radio"
                name="pdf-text-mode"
                value={option.value}
                checked={textMode === option.value}
                onChange={() => setTextMode(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="pdf-choice-group pdf-annotation-options">
          <legend>Marcações no PDF</legend>
          <label className="pdf-option">
            <input
              type="checkbox"
              checked={includeColours}
              onChange={(event) => setIncludeColours(event.target.checked)}
            />
            <span><strong>Incluir cores</strong></span>
          </label>
          <label className="pdf-option">
            <input
              type="checkbox"
              checked={includeMelismas}
              onChange={(event) => setIncludeMelismas(event.target.checked)}
            />
            <span><strong>Incluir sublinhados</strong></span>
          </label>
        </fieldset>

        <p className="pdf-export-note">
          Essas escolhas valem somente para esta exportação. Ocultar marcações aqui não altera os hinos salvos.
        </p>
        <div className="pdf-dialog-actions">
          <button className="cloud-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="cloud-primary" type="submit">Continuar para impressão</button>
        </div>
      </form>
    </dialog>
  );
}
