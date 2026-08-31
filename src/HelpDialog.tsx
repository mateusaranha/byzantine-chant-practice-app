import { useEffect, useRef } from "react";

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
  const title = page === "guide" ? "Guia de estudo" : "Sobre o Psaltikon";

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
      <div className="help-copy" tabIndex={0} role="region" aria-label={`Conteúdo: ${title}`}>
        {page === "guide" ? <StudyGuide /> : <About />}
      </div>
    </dialog>
  );
}

function StudyGuide() {
  return (
    <>
      <p>
        Este guia apresenta minha maneira de usar o Psaltikon para preparar e praticar hinos.
        É uma prática pessoal, desenvolvida pela escuta e pela experiência, não um método formal
        de ensino. As marcações ajudam a recordar o que foi ouvido, mas não substituem o
        aprendizado da notação musical bizantina.
      </p>

      <h3>1. Encontrar o texto e as gravações</h3>
      <p>
        Começo pelo <a href="https://dcs.goarch.org/goa/dcs/dcs.html" target="_blank" rel="noopener noreferrer" aria-label="Digital Chant Stand da GOARCH (abre em nova aba)">Digital Chant Stand da GOARCH</a>.
        {" "}Abro o dia e o ofício em que aparece o hino que quero estudar e localizo seu texto.
        Pode ser, por exemplo, o apolytikion do santo do dia nas Matinas, depois do <em>Theos Kyrios</em>,
        ou o kondakion depois dos tropários da Pequena Entrada.
      </p>
      <p>
        Depois, procuro gravações no YouTube usando as primeiras palavras do hino em grego.
        Quando os resultados não ajudam, experimento outras palavras do trecho inicial ou busco
        pelo título e pelo modo indicados acima da letra no ofício. Também recorro à aba “Vídeos” do Google.
      </p>
      <p>
        Nem sempre a primeira busca funciona: alguns hinos são mais fáceis de identificar,
        enquanto outros exigem algumas tentativas.
      </p>

      <h3>2. Escolher uma gravação de referência</h3>
      <p>
        A capacidade de avaliar uma gravação como referência de estudo vai se desenvolvendo com o
        tempo e com a escuta. Para quem está começando, uma orientação prática é procurar
        interpretações de psaltai reconhecidos, como Theodoros Vasilikos e Thrasyvoulos Stanitsas.
      </p>
      <p>
        Esses nomes oferecem um ponto de partida. Ainda considero tanto o contexto da minha
        paróquia quanto aquilo que consigo cantar bem.
      </p>
      <p>
        Há interpretações que aprecio, mas que são mais lentas e desenvolvidas, como as versões <em>argá</em>.
        {" "}No nosso contexto paroquial, geralmente precisamos de uma execução mais dinâmica, e essas
        versões poderiam ficar extensas demais. Isso não é um julgamento sobre sua qualidade:
        elas apenas não correspondem ao que procuro para aquela ocasião.
      </p>
      <p>
        Também considero a dificuldade da execução. Às vezes gosto muito de uma gravação, mas ainda
        não consigo reproduzir bem suas ornamentações. Nesses casos, posso escolher outra interpretação,
        com uma elaboração mais simples, que consigo cantar com mais segurança e na qual as
        características melódicas do modo continuam claras.
      </p>
      <p>
        Conforme desenvolvo minha escuta e familiaridade com o canto, sinto mais segurança para
        explorar gravações menos conhecidas. Costumo escutar muitas interpretações, indo além dos
        primeiros resultados e dos vídeos mais vistos. Às vezes encontro canais pequenos de psaltai
        de paróquias gregas, com registros pontuais e poucas visualizações, mas interpretações muito
        boas ou características.
      </p>
      <p>
        Isso não acontece em toda busca, e ter poucas visualizações não torna uma gravação melhor.
        O que considero proveitoso é escutar diferentes interpretações e dar espaço também às que
        não aparecem entre os resultados mais populares.
      </p>
      <p>
        A gravação que escolho como referência não é necessariamente a mais elaborada nem aquela
        que mais admiro ao escutar. Procuro uma interpretação que se encaixe na ocasião e que me
        ajude a cantar bem, dentro das minhas possibilidades atuais.
      </p>

      <h3>3. Usar cores e sublinhados</h3>
      <p>
        Faço as marcações a partir da gravação escolhida. Diferentes interpretações de um mesmo
        tropário podem me levar a dividir o texto de maneiras diferentes.
      </p>
      <p>
        Uso as cores para destacar trechos que, ao escutar, percebo como uma unidade: algo com início,
        desenvolvimento e conclusão. Reconhecer esses trechos visualmente me ajuda a lembrar como
        cantá-los. Essa divisão nasce da escuta e da experimentação; não pretende ser uma análise
        formal da estrutura musical do hino.
      </p>
      <p>
        As cores não têm significados próprios: servem apenas para distinguir visualmente os trechos.
        Nenhuma cor indica uma nota, um modo ou uma maneira específica de cantar.
      </p>
      <p>
        Os sublinhados também são lembretes. Um sublinhado simples chama minha atenção para uma sílaba
        em que há algum movimento ou ornamentação que preciso recordar. O sinal não informa qual é
        esse movimento: isso eu aprendo e memorizo ouvindo a gravação.
      </p>
      <p>
        Uso o sublinhado duplo quando, além desse movimento, o canto permanece um pouco mais naquela
        sílaba. Ele me lembra de uma passagem mais prolongada, sem indicar uma duração exata ou um
        tipo específico de ornamentação.
      </p>
      <p>
        As marcações, portanto, fazem sentido em conjunto com a memória da gravação. São apoios
        pessoais para a escuta e o canto, não uma substituição da notação musical bizantina.
      </p>

      <h3>4. Praticar o hino</h3>
      <p>
        Primeiro, canto junto com a gravação várias vezes. Depois de algum tempo, começo a alternar:
        ora canto acompanhando a gravação, ora canto sozinho.
      </p>
      <p>
        Repito esse processo até sentir confiança para cantar razoavelmente bem olhando apenas a
        letra, sem marcações e sem o apoio da gravação.
      </p>
      <p>
        O resultado não é igual em todos os hinos. Alguns ficam mais satisfatórios; outros ainda
        apresentam dificuldades e ficam dentro do que consigo realizar naquele momento. Procuro
        reconhecer essas limitações sem desvalorizar o esforço de aprender e praticar.
      </p>
      <p>
        Com o tempo, vou adquirindo familiaridade com o canto, reconhecendo movimentos melódicos e
        encontrando mais facilidade para aprender outros hinos. Não preciso esperar uma execução
        perfeita para reconhecer esse progresso.
      </p>
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
        melodia por si mesmas nem substituem o aprendizado da notação musical bizantina, a formação
        musical ou a orientação de um professor.
      </p>
      <p>
        O Guia de estudo apresenta a maneira como o criador do Psaltikon utiliza a ferramenta, como
        uma experiência pessoal que pode ajudar outros usuários a começar.
      </p>
    </>
  );
}
