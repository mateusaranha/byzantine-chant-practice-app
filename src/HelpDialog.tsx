import { useEffect, useRef, useState } from "react";
import AppGuide from "./AppGuide";
import StudyGuide from "./StudyGuide";
import StudyReferences from "./StudyReferences";

export type HelpPage = "guide" | "about";
type HelpArea = "study" | "app" | "references";

const HELP_AREAS: { id: HelpArea; label: string; title: string }[] = [
  { id: "study", label: "Guia de estudo", title: "Guia de estudo" },
  { id: "app", label: "Como usar", title: "Como usar o Psaltikon" },
  { id: "references", label: "Referências", title: "Referências para explorar" },
];

export default function HelpDialog({
  page,
  trigger,
  onClose,
}: {
  page: HelpPage;
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<HelpArea, number>>({ study: 0, app: 0, references: 0 });
  const [area, setArea] = useState<HelpArea>("study");
  const title = page === "about"
    ? "Sobre o Psaltikon"
    : HELP_AREAS.find((item) => item.id === area)?.title ?? "Ajuda e guia";

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
    if (page === "guide" && copyRef.current) copyRef.current.scrollTop = scrollPositions.current[area];
    titleRef.current?.focus({ preventScroll: true });
  }, [area, page]);

  function selectArea(nextArea: HelpArea) {
    if (nextArea === area) return;
    if (copyRef.current) scrollPositions.current[area] = copyRef.current.scrollTop;
    setArea(nextArea);
  }

  return (
    <dialog
      ref={dialogRef}
      className={`help-dialog ${page === "guide" ? "study-guide" : ""}`}
      aria-labelledby="help-title"
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
        <h2 id="help-title" ref={titleRef} tabIndex={-1}>{title}</h2>
        <button className="help-close" onClick={onClose} aria-label={`Fechar ${title}`}>
          Fechar <span aria-hidden="true">×</span>
        </button>
      </div>
      {page === "guide" && (
        <nav className="help-navigation" aria-label="Áreas de ajuda">
          {HELP_AREAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="help-navigation-button"
              aria-current={area === item.id ? "page" : undefined}
              onClick={() => selectArea(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div ref={copyRef} className="help-copy" tabIndex={0} role="region" aria-label={`Conteúdo: ${title}`}>
        {page === "about" ? <About /> : area === "study" ? <StudyGuide />
          : area === "app" ? <AppGuide /> : <StudyReferences />}
      </div>
    </dialog>
  );
}

function About() {
  return (
    <>
      <p>
        O Psaltikon reúne texto, gravação e marcações visuais para auxiliar a preparação, a prática
        e a memorização de hinos de canto bizantino.
      </p>
      <p>
        As marcações podem ajudar a recordar o que foi aprendido pela escuta. Elas não descrevem a
        melodia por si mesmas nem substituem o aprendizado da notação musical bizantina ou a
        formação musical.
      </p>
      <h3>Nota de escopo</h3>
      <p>
        O Psaltikon é um projeto independente. O Guia de estudo e as referências registram a
        experiência pessoal de seu criador na preparação e na prática paroquial do canto; não
        constituem um método formal de ensino nem uma orientação oficial de uma paróquia, diocese
        ou escola de música.
      </p>
      <p>
        Para a formação musical e as decisões sobre a prática litúrgica, devem ser consideradas a
        orientação de um professor qualificado e a tradição da comunidade local.
      </p>
    </>
  );
}
