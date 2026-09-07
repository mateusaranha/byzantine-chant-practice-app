import HelpSection from "./HelpSection";

export default function AppGuide() {
  return (
    <>
      <p>
        Estas orientações explicam onde o trabalho fica guardado e o que acontece ao criar uma cópia de segurança, exportar um PDF, publicar, organizar ou usar a Biblioteca pública. Elas complementam o Guia de estudo sem fazer parte das etapas de preparação do canto.
      </p>

      <HelpSection title="Salvar e recuperar seu trabalho">
        <p>
          Os hinos, as gravações escolhidas, as marcações e os ajustes são salvos automaticamente neste navegador. Não é preciso apertar um botão a cada alteração. Esse salvamento pertence a este navegador e dispositivo: ele não sincroniza o trabalho com outros aparelhos e pode ser perdido se os dados do site forem apagados.
        </p>
        <p>
          Algumas preferências da interface também podem ser lembradas somente neste navegador. Por exemplo, se você deixar a barra de ferramentas de um hino recolhida, o Psaltikon tenta manter essa escolha quando você voltar. Essas preferências ficam separadas do conteúdo dos hinos: não fazem parte das publicações nem da cópia de segurança.
        </p>
        <p>
          Salvar automaticamente no navegador não é o mesmo que publicar em <strong>Meus conjuntos</strong> ou na <strong>Biblioteca curada</strong>. O trabalho local continua separado das versões públicas até que você escolha publicá-las.
        </p>
        <p>
          <strong>Exportar cópia de segurança</strong> baixa um arquivo com todos os hinos do seu espaço e seus dados de estudo. Guarde-o em um local conhecido para recuperar o trabalho, levá-lo a outro dispositivo ou se proteger antes de uma mudança importante. A exportação não precisa de login e não publica nem compartilha os hinos.
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

      <HelpSection title="Explorar a Biblioteca pública">
        <p>
          O botão <strong>Biblioteca online</strong> abre a <strong>Biblioteca pública</strong>. Inicialmente aparecem apenas duas áreas principais: <strong>Biblioteca curada</strong> e <strong>Meus conjuntos</strong> para usuários autorizados a publicar, ou <strong>Conjuntos publicados</strong> para os demais visitantes. Os conteúdos dessas áreas só aparecem depois que você escolhe qual deseja explorar. Qualquer pessoa pode consultar o conteúdo público sem entrar com uma conta.
        </p>
        <p>
          A <strong>Biblioteca curada</strong> usa uma navegação simples em dois níveis: <strong>categoria → subcategoria</strong>. As categorias aparecem em uma lista compacta; ao escolher uma delas, suas subcategorias são mostradas na própria página. Ao escolher uma subcategoria, o Psaltikon abre diretamente o conjunto completo associado a ela, com todos os hinos daquele material de estudo.
        </p>
        <p>
          O material aberto pela Biblioteca curada é exibido como uma <strong>área temporária, sem alterar seu espaço</strong>. Você pode estudar e fazer ajustes ali sem modificar a publicação original. Para conservar o material e seus ajustes, use <strong>Adicionar ao meu espaço</strong>.
        </p>
        <p>
          Em <strong>Meus conjuntos</strong>, seus próprios conjuntos aparecem primeiro, mas os materiais publicados por outros autores também continuam disponíveis. Para visitantes sem permissão de publicação, essa área aparece como <strong>Conjuntos publicados</strong>.
        </p>
        <p>
          Nessa lista, <strong>Abrir</strong> funciona de forma diferente da Biblioteca curada: ele pede confirmação e substitui o espaço atual pelo conjunto escolhido. Exporte antes uma cópia de segurança se houver hinos no espaço atual que você queira preservar.
        </p>
      </HelpSection>

      <HelpSection title="Publicar e adicionar à Biblioteca curada">
        <p>
          Publicar é diferente de fazer uma cópia de segurança. Pessoas autorizadas podem salvar os hinos abertos em <strong>Meus conjuntos</strong>; essa publicação fica pública. Alterações feitas depois apenas no seu espaço não aparecem na versão publicada até que ela seja salva novamente.
        </p>
        <p>
          Para o curador, o formulário também oferece <strong>Biblioteca curada</strong> e <strong>Ambos</strong>. Em <strong>Biblioteca curada</strong>, o conteúdo-base é publicado para servir à curadoria, mas não aparece também em Meus conjuntos. Em <strong>Ambos</strong>, o mesmo conteúdo-base aparece nas duas áreas, sem ser duplicado.
        </p>
        <p>
          Ao adicionar à Biblioteca curada, escolha primeiro uma <strong>categoria</strong>. A lista seguinte mostra somente as subcategorias pertencentes à categoria escolhida. Você pode selecionar uma subcategoria existente ou criar uma nova já dentro dessa categoria. O conjunto inteiro que está aberto é associado à subcategoria; não é necessário cadastrar cada hino separadamente.
        </p>
        <p>
          Cada subcategoria aponta para um único conjunto. Se ela já possui material associado, salvar nela permite atualizar essa associação; se o conjunto atual for outro, o Psaltikon pede confirmação antes de substituir a associação. Um conjunto também pode ser publicado primeiro e adicionado à curadoria mais tarde.
        </p>
        <p>
          O <strong>nome do conjunto</strong> e os nomes usados para organizar a <strong>categoria</strong> e a <strong>subcategoria</strong> são coisas diferentes. Não é necessário republicar um conjunto apenas para corrigir o nome de uma categoria ou subcategoria.
        </p>
      </HelpSection>

      <HelpSection title="Organizar a Biblioteca curada">
        <p>
          O curador pode administrar parte da organização diretamente na página da <strong>Biblioteca curada</strong>. Visitantes comuns não veem esses controles de edição.
        </p>
        <p>
          Ao lado dos nomes de categorias e subcategorias aparece um controle com lápis. Clique nele para alterar o nome no próprio lugar. Confirme com <strong>✓</strong> ou Enter; use <strong>×</strong> ou Esc para cancelar.
        </p>
        <p>
          Renomear uma categoria ou subcategoria altera apenas o nome exibido. A categoria continua contendo as mesmas subcategorias, e a subcategoria continua associada ao mesmo conjunto. Não é necessário excluir, recriar ou republicar o material.
        </p>
        <p>
          A criação de novas categorias e subcategorias continua disponível durante o processo de publicação. A edição posterior dos nomes, porém, pode ser feita diretamente na Biblioteca curada.
        </p>
        <p>
          <strong>Remover da Biblioteca curada</strong> preserva o conjunto-base. Se ele tinha sido salvo somente na curadoria, volta a aparecer em <strong>Meus conjuntos</strong> antes de a associação ser retirada. Depois disso, uma subcategoria vazia pode ser excluída; uma categoria só pode ser excluída quando não possui mais subcategorias.
        </p>
      </HelpSection>

      <HelpSection title="Compartilhar e adicionar ao seu espaço">
        <p>
          Um link de compartilhamento abre a versão publicada mais recente em uma área temporária, sem alterar seu espaço. Os ajustes feitos ali são descartados ao sair ou atualizar a página, e não modificam a publicação original.
        </p>
        <p>
          <strong>Adicionar ao meu espaço</strong> acrescenta uma cópia local independente aos seus hinos. A partir daí, essa cópia pode ser modificada normalmente sem alterar o material público original.
        </p>
      </HelpSection>
    </>
  );
}
