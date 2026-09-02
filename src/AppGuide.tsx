import HelpSection from "./HelpSection";

export default function AppGuide() {
  return (
    <>
      <p>
        Estas orientações explicam onde o trabalho fica guardado e o que acontece ao criar uma cópia de segurança, exportar um PDF ou usar a biblioteca. Elas complementam o Guia de estudo sem fazer parte das etapas de preparação do canto.
      </p>

      <HelpSection title="Salvar e recuperar seu trabalho">
        <p>
          Os hinos, as gravações escolhidas, as marcações e os ajustes são salvos automaticamente neste navegador. Não é preciso apertar um botão a cada alteração. Esse salvamento pertence a este navegador e dispositivo: ele não sincroniza o trabalho com outros aparelhos e pode ser perdido se os dados do site forem apagados.
        </p>
        <p>
          <strong>Exportar cópia de segurança</strong> baixa um arquivo com todos os hinos do seu espaço. Guarde-o em um local conhecido para recuperar o trabalho, levá-lo a outro dispositivo ou se proteger antes de uma mudança importante. A exportação não precisa de login e não publica nem compartilha os hinos.
        </p>
        <p>
          <strong>Importar cópia de segurança</strong> recupera um arquivo exportado pelo Psaltikon. Depois de validar o arquivo e pedir confirmação, a importação substitui todos os hinos que estão no espaço atual. Se quiser conservar o trabalho atual, exporte uma cópia dele antes de importar outra.
        </p>
      </HelpSection>

      <HelpSection title="Exportar PDF para leitura ou impressão">
        <p>
          <strong>Exportar PDF para celular</strong> prepara os hinos para leitura, impressão ou consulta em outro aparelho, sem os controles da interface. O documento preserva títulos, modos e a ordem dos hinos, mas não inclui os vídeos e não substitui uma cópia de segurança: ele não pode ser importado para recuperar seu espaço.
        </p>
        <p>
          Em <strong>Como está na tela</strong>, cada hino respeita a leitura grega ou transliterada escolhida na interface. Você também pode exportar todos em <strong>Grego</strong>, todos em <strong>Transliterado</strong> ou usar <strong>Grego e transliterado</strong>. Na última opção, as duas leituras ficam agrupadas por hino, e a segunda começa em uma nova página.
        </p>
        <p>
          Cores e sublinhados podem ser incluídos ou removidos separadamente. Essas escolhas valem somente para o PDF e não alteram os hinos salvos. Elas também não dependem de as marcações estarem visíveis ou ocultas no modo de treino.
        </p>
        <p>
          Depois de confirmar as opções, o navegador ou o aparelho abre sua tela de impressão. Nela, escolha salvar como PDF ou imprimir. O nome e a posição dessas opções podem variar conforme o navegador e o dispositivo. As mesmas escolhas estão disponíveis ao exportar um conjunto compartilhado.
        </p>
      </HelpSection>

      <HelpSection title="Usar a biblioteca e compartilhar conjuntos">
        <p>
          A <strong>Biblioteca online</strong> reúne conjuntos públicos salvos no GitHub. Qualquer pessoa pode consultá-los e abri-los sem entrar com uma conta; somente pessoas autorizadas podem publicar. Na biblioteca, <strong>Abrir</strong> pede confirmação e substitui o espaço atual pelo conjunto escolhido. Exporte antes uma cópia de segurança se houver hinos que você queira preservar.
        </p>
        <p>
          Publicar é diferente de fazer uma cópia de segurança: a publicação torna públicos todos os hinos que estão abertos naquele momento. Alterações feitas depois apenas no seu espaço não aparecem na versão pública até que o conjunto seja salvo novamente na biblioteca.
        </p>
        <p>
          Um link de compartilhamento abre a versão publicada mais recente em uma área temporária, sem alterar seu espaço. Os ajustes feitos ali são descartados ao sair ou atualizar a página. <strong>Adicionar ao meu espaço</strong> acrescenta uma cópia local independente aos seus hinos; essa cópia pode ser modificada sem alterar a publicação original.
        </p>
      </HelpSection>
    </>
  );
}
