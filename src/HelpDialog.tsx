import { useEffect, useRef, useState } from "react";
import StudyReferences from "./StudyReferences";
import HelpSection from "./HelpSection";

export type HelpPage = "guide" | "about";

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
  const guideScrollRef = useRef(0);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const title = page === "about" ? "Sobre o Psaltikon"
    : referencesOpen ? "Referências para explorar" : "Guia de estudo";

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
    if (copyRef.current) copyRef.current.scrollTop = referencesOpen ? 0 : guideScrollRef.current;
    titleRef.current?.focus({ preventScroll: true });
  }, [referencesOpen]);

  function toggleReferences() {
    if (!referencesOpen) guideScrollRef.current = copyRef.current?.scrollTop ?? 0;
    setReferencesOpen((open) => !open);
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
        <nav className="help-navigation" aria-label="Navegação do guia">
          <button className="help-link" onClick={toggleReferences}>
            {referencesOpen ? "← Voltar ao Guia de estudo" : "Referências para explorar →"}
          </button>
        </nav>
      )}
      <div ref={copyRef} className="help-copy" tabIndex={0} role="region" aria-label={`Conteúdo: ${title}`}>
        {page === "about" ? <About /> : (
          <>
            <div hidden={referencesOpen}><StudyGuide /></div>
            <div hidden={!referencesOpen}><StudyReferences /></div>
          </>
        )}
      </div>
    </dialog>
  );
}

function StudyGuide() {
  return (
    <>
      <p>
        Este guia reúne sugestões de preparação e estudo nascidas da experiência pessoal do criador do Psaltikon com a escuta, a prática e o uso da ferramenta na paróquia. É uma maneira possível de utilizá-la, não um método formal de ensino. As marcações ajudam a recordar o que foi ouvido, mas não substituem o aprendizado da notação musical bizantina.
      </p>

      <HelpSection title="1. Encontrar o texto e as gravações">
        <p>
          Um ponto de partida é o <a href="https://dcs.goarch.org/goa/dcs/dcs.html" target="_blank" rel="noopener noreferrer" aria-label="Digital Chant Stand da GOARCH (abre em nova aba)">Digital Chant Stand da GOARCH</a>. Escolha o dia e o ofício em que aparece o hino e localize seu texto. Pode ser, por exemplo, o apolytikion do santo do dia nas Matinas, depois do <em>Theos Kyrios</em>, ou o kondakion, último dos hinos cantados após a Pequena Entrada.
        </p>
        <p>
          Para encontrar gravações, experimente buscar no YouTube as primeiras palavras do hino em grego. Se os resultados não ajudarem, tente outras palavras do trecho inicial ou o título e o modo indicados acima da letra no ofício. A aba “Vídeos” do Google também pode ajudar.
        </p>
        <p>
          Nem sempre a primeira busca funciona: alguns hinos são mais fáceis de identificar, enquanto outros exigem algumas tentativas.
        </p>
      </HelpSection>

      <HelpSection title="2. Escolher uma gravação de referência">
        <p>
          A capacidade de avaliar uma gravação como referência de estudo se desenvolve com o tempo e com a escuta. Para quem está começando, uma orientação prática é procurar interpretações de psaltai reconhecidos, como Theodoros Vassilikos e Thrasyvoulos Stanitsas.
        </p>
        <p>
          Esses nomes oferecem um ponto de partida. Na escolha, também vale considerar o contexto paroquial e aquilo que é possível cantar com segurança.
        </p>
        <p>
          Há interpretações mais lentas e desenvolvidas, como as versões <em>argá</em>. Na experiência paroquial que deu origem a este guia, execuções mais dinâmicas costumam se ajustar melhor a certas ocasiões; uma versão pode ser muito apreciada e, ainda assim, ficar extensa demais para aquele contexto, sem que isso diminua sua qualidade. Nesses casos, experimente aumentar um pouco a velocidade de reprodução para ouvir como a melodia funciona com maior fluidez. Não há uma proporção fixa nem uma velocidade necessariamente correta: tente, por exemplo, 1,1×, 1,15× ou 1,25× e escute novamente, avaliando se o resultado preserva a naturalidade das frases e se aproxima da dinâmica procurada.
        </p>
        <p>
          A dificuldade da execução também importa. Quando as ornamentações de uma gravação ainda são difíceis de reproduzir, outra interpretação, com elaboração mais simples, pode permitir cantar com mais segurança e manter claras as características melódicas do modo.
        </p>
        <p>
          Com maior familiaridade, a exploração pode avançar para além dos primeiros resultados e dos vídeos mais vistos. Canais pequenos de psaltai de paróquias gregas às vezes guardam interpretações marcantes, mesmo com poucas gravações e visualizações.
        </p>
        <p>
          Isso não acontece em toda busca, e poucas visualizações não tornam uma gravação melhor. O proveito está em escutar diferentes interpretações e dar espaço também às menos conhecidas.
        </p>
        <p>
          A referência de treino não precisa ser a execução mais elaborada nem a mais admirada durante a escuta. Pode ser aquela que melhor se ajusta à ocasião e às possibilidades atuais de quem vai cantar.
        </p>
      </HelpSection>

      <HelpSection title="3. Usar cores e sublinhados">
        <p>
          Nesta proposta de uso, as marcações são feitas a partir da gravação escolhida. Diferentes interpretações de um mesmo tropário podem levar a divisões diferentes do texto.
        </p>
        <p>
          As cores destacam trechos percebidos pela escuta como uma unidade: algo com início, desenvolvimento e conclusão. Reconhecê-los visualmente ajuda a recordar como cantá-los. Essa divisão nasce da escuta e da experimentação, sem pretender ser uma análise formal da estrutura musical.
        </p>
        <p>
          As cores não têm significados próprios: servem apenas para distinguir visualmente os trechos. Nenhuma cor indica uma nota, um modo ou uma maneira específica de cantar.
        </p>
        <p>
          O sublinhado simples lembra que há algum movimento ou ornamentação naquela sílaba. Ele não informa qual é esse movimento: isso precisa ser aprendido e memorizado pela gravação.
        </p>
        <p>
          O sublinhado duplo acrescenta o lembrete de que o canto permanece um pouco mais naquela sílaba. Não indica uma duração exata nem um tipo específico de ornamentação.
        </p>
        <p>
          As marcações fazem sentido em conjunto com a memória da gravação. São apoios pessoais para a escuta e o canto, não uma substituição da notação musical bizantina.
        </p>
      </HelpSection>

      <HelpSection title="4. Praticar o hino">
        <p>
          Uma possibilidade de treino é começar cantando junto com a gravação várias vezes. Depois de algum tempo, alternar entre cantar com ela e cantar sozinho.
        </p>
        <p>
          O objetivo é ganhar confiança para cantar razoavelmente bem olhando apenas a letra, sem marcações e sem o apoio da gravação.
        </p>
        <p>
          O resultado pode variar entre os hinos. Alguns ficam mais satisfatórios; outros ainda apresentam dificuldades e refletem o que foi possível preparar naquele momento. Reconhecer essas limitações não precisa diminuir o valor do esforço de aprender e praticar.
        </p>
        <p>
          Com o tempo, o progresso pode aparecer na familiaridade com os movimentos melódicos e na maior facilidade para aprender outros hinos. Não é preciso esperar uma execução perfeita para reconhecê-lo.
        </p>
      </HelpSection>
    </>
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
