import type { Ferramenta } from '../../../store/editorStore';

// CONTEÚDO DA PÁGINA DE AJUDA (/ajuda).
//
// Pra documentar algo novo, acrescente uma seção em SECOES (ou um bloco numa seção existente) —
// a página monta o índice, a busca e os links (/ajuda#id-da-secao) sozinha. Regras de ouro:
//   • Ao criar ou mudar um atalho, uma ferramenta ou um botão, atualize o texto aqui no mesmo commit.
//   • As ferramentas (nome, tecla, ícone) NÃO são escritas aqui: vêm de pages/editor/ProjetoEditor/
//     ferramentas.tsx. Uma ferramenta nova só precisa da descrição em DESCRICAO_DAS_FERRAMENTAS —
//     e o compilador reclama enquanto ela não existir (o tipo é Record<Ferramenta, string>).
//   • Só escreva o que o sistema realmente faz. Ctrl vale também como ⌘ no Mac: use 'Ctrl/⌘'.
//
// Em textos, **assim** vira negrito. Em atalhos, ' + ' separa as teclas de uma combinação e ' ou '
// separa combinações alternativas (ex.: 'Ctrl/⌘ + Shift + Z ou Ctrl/⌘ + Y').

export interface Atalho {
  teclas: string;
  descricao: string;
}

export type Bloco =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'passos'; itens: string[] }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'dica'; texto: string }
  | { tipo: 'atalhos'; titulo?: string; itens: Atalho[] }
  /** Cartões das ferramentas do editor, gerados do registro (nome, tecla, ícone) + DESCRICAO_DAS_FERRAMENTAS */
  | { tipo: 'ferramentas' }
  /** Tabela "tecla → ferramenta" gerada do mesmo registro, pra nunca divergir da barra */
  | { tipo: 'atalhos-das-ferramentas' };

/** Ícone da aba e do título de uma seção (desenhos em Ajuda.tsx); sem escolher, usa o genérico "livro" */
export type IconeAjuda =
  | 'comecar'
  | 'ferramentas'
  | 'teclado'
  | 'estrutura'
  | 'camera'
  | 'formulas'
  | 'modulos'
  | 'colisao'
  | 'celular'
  | 'livro';

export interface SecaoAjuda {
  /** Vira a âncora da seção: /ajuda#id */
  id: string;
  icone?: IconeAjuda;
  titulo: string;
  /** Uma frase sob o título e no índice */
  resumo: string;
  blocos: Bloco[];
}

export const DESCRICAO_DAS_FERRAMENTAS: Record<Ferramenta, string> = {
  selecionar:
    'Seleciona elementos com o clique. **Ctrl/⌘ + clique** seleciona vários; **duplo clique** abre o conteúdo de um grupo ou peça (e **Esc** sai dele). Arrastar com o botão esquerdo gira a câmera em volta da cena.',
  mover:
    'Mostra setas nos eixos X, Y e Z do elemento selecionado: arraste uma seta para mover. O elemento para ao encostar em outro sólido e pode "grudar" na face de um vizinho próximo. Com vários selecionados, todos se movem juntos.',
  girar:
    'Mostra anéis para girar o elemento selecionado em X, Y e Z, em passos de 15°. Com vários selecionados, eles giram em conjunto em torno do principal.',
  parede:
    'Desenha paredes clicando os cantos no piso. O segundo ponto se marca por clique; a partir dele, a cada canto marcado o cursor já vai para o campo de **extensão** da barra, e você digita o comprimento direto (**Enter** confirma o valor; com o campo ainda intocado, **Enter** conclui e **Esc** cancela o desenho). O seletor **Posição de construção** define para onde vai a espessura a partir da linha que você marca: **Centro** (dividida nos dois lados), **Direita** (jogada para a parte externa do contorno) ou **Esquerda** (tirada da parte interna, mantendo a externa); a extensão marcada vale para essa linha, qualquer que seja o sentido em que você desenha. Clicar perto do primeiro ponto fecha o contorno e cria o piso.',
  trena:
    'Mede distâncias: clique para marcar pontos sobre qualquer peça, parede ou piso. Mostra o comprimento de cada trecho e o total.',
  pintura:
    'Balde de tinta: pinta a face clicada com uma cor ou uma textura. Faces reunidas num grupo de faces podem ser pintadas de uma vez.',
};

export const SECOES: SecaoAjuda[] = [
  {
    id: 'primeiros-passos',
    icone: 'comecar',
    titulo: 'Primeiros passos',
    resumo: 'Criar um projeto, montar peças e salvar.',
    blocos: [
      {
        tipo: 'texto',
        texto:
          'O Construtor 3D é um editor de módulos de marcenaria e cozinha no navegador: você monta peças, grupos e paredes em 3D e define as medidas por números ou por fórmulas.',
      },
      {
        tipo: 'passos',
        itens: [
          'Na página inicial escolha **Novo projeto** (ou **Abrir projeto** para continuar um já salvo).',
          'No editor, crie peças e grupos pelos botões do painel **Estrutura** (**+ Caixa**, **+ Grupo**, **+ Parede**…).',
          'Com uma peça ou grupo selecionado, o elemento novo nasce **ao lado direito** dele, no mesmo plano e no mesmo grupo; sem seleção, entra no grupo aberto.',
          'Ajuste nome, medidas, posição e rotação no painel de **Propriedades**.',
          'Salve com o botão **Salvar** ou **Ctrl/⌘ + S**. Enquanto houver mudanças não salvas, o topo avisa, e o sistema pergunta antes de você sair da página.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Errou? **Ctrl/⌘ + Z** desfaz e **Ctrl/⌘ + Shift + Z** refaz — também pelos botões de seta no topo.',
      },
    ],
  },
  {
    id: 'ferramentas',
    icone: 'ferramentas',
    titulo: 'Ferramentas do editor',
    resumo: 'O que cada ferramenta da barra faz e qual a tecla dela.',
    blocos: [
      { tipo: 'ferramentas' },
      {
        tipo: 'dica',
        texto:
          'Se uma ferramenta não aparece na sua barra, sua conta não tem a permissão dela — peça a um administrador do sistema.',
      },
    ],
  },
  {
    id: 'atalhos',
    icone: 'teclado',
    titulo: 'Atalhos de teclado e mouse',
    resumo: 'Tudo que dá pra fazer sem tirar a mão do teclado.',
    blocos: [
      {
        tipo: 'atalhos',
        titulo: 'No editor',
        itens: [
          { teclas: 'Ctrl/⌘ + S', descricao: 'Salvar' },
          { teclas: 'Ctrl/⌘ + Z', descricao: 'Desfazer' },
          { teclas: 'Ctrl/⌘ + Shift + Z ou Ctrl/⌘ + Y', descricao: 'Refazer' },
          { teclas: 'Esc', descricao: 'Limpar a seleção; sem nada selecionado, sair do grupo aberto' },
          { teclas: 'Delete', descricao: 'Remover o elemento selecionado' },
        ],
      },
      { tipo: 'atalhos-das-ferramentas' },
      {
        tipo: 'texto',
        texto:
          'As teclas de letra não funcionam enquanto você digita num campo, nem durante as ferramentas **Parede**, **Trena** e **Pintar**, que têm atalhos próprios (abaixo).',
      },
      {
        tipo: 'atalhos',
        titulo: 'Ferramenta Parede',
        itens: [
          { teclas: 'Enter', descricao: 'Concluir o desenho das paredes' },
          { teclas: 'Esc', descricao: 'Cancelar o desenho' },
          { teclas: 'Backspace ou Delete', descricao: 'Desfazer o último canto marcado' },
          { teclas: 'Ctrl', descricao: 'Levar o cursor de volta ao campo de extensão da última parede (ele já abre sozinho a cada canto marcado, do segundo em diante)' },
        ],
      },
      {
        tipo: 'atalhos',
        titulo: 'Ferramenta Trena',
        itens: [
          { teclas: 'Esc', descricao: 'Limpar todos os pontos' },
          { teclas: 'Backspace ou Delete', descricao: 'Remover o último ponto' },
        ],
      },
      {
        tipo: 'atalhos',
        titulo: 'Campos de medida',
        itens: [
          { teclas: 'Enter', descricao: 'Aplicar o valor digitado (aceita contas, como 60+1,8, e fórmulas)' },
          { teclas: 'Esc', descricao: 'Desfazer a digitação e voltar ao valor atual' },
        ],
      },
      {
        tipo: 'atalhos',
        titulo: 'Mouse e toque',
        itens: [
          { teclas: 'Clique', descricao: 'Selecionar o elemento' },
          { teclas: 'Ctrl/⌘ + clique', descricao: 'Selecionar vários (na cena e na lista Estrutura)' },
          { teclas: 'Duplo clique', descricao: 'Abrir o conteúdo de um grupo ou peça' },
          { teclas: 'Arrastar (botão esquerdo)', descricao: 'Girar a câmera em volta da cena' },
          { teclas: 'Arrastar (botão direito)', descricao: 'Mover a vista' },
          { teclas: 'Roda do mouse', descricao: 'Aproximar e afastar' },
          { teclas: 'Um dedo / pinça / dois dedos', descricao: 'No toque: girar a câmera / aproximar e afastar / mover a vista' },
        ],
      },
    ],
  },
  {
    id: 'estrutura',
    icone: 'estrutura',
    titulo: 'Estrutura e elementos',
    resumo: 'A lista de elementos, agrupar, duplicar, substituir e ocultar.',
    blocos: [
      {
        tipo: 'texto',
        texto:
          'O painel **Estrutura** é a árvore do projeto: grupos contêm peças, peças podem conter outras peças. Clique numa linha para selecionar; **arraste** uma linha para reorganizar; o ícone de olho oculta ou mostra o elemento na cena.',
      },
      {
        tipo: 'lista',
        itens: [
          '**Agrupar** envolve o elemento selecionado num grupo novo; **Desagrupar** desfaz.',
          '**Duplicar** cria uma cópia do elemento ao lado do original.',
          '**Substituir** troca um elemento por outro módulo do catálogo, mantendo o lugar e a rotação.',
          '**Remover** apaga o elemento e tudo que está dentro dele.',
          '**Focar módulo** esconde tudo, menos o módulo selecionado; **Enquadrar** ajusta a câmera (veja Câmera e vistas).',
          '**Vista explodida** afasta as peças de um grupo para ver como ele é montado.',
        ],
      },
    ],
  },
  {
    id: 'camera-e-vistas',
    icone: 'camera',
    titulo: 'Câmera e vistas',
    resumo: 'Enquadrar em topo, frente, laterais e mais.',
    blocos: [
      {
        tipo: 'texto',
        texto:
          'O botão **Enquadrar** (canto inferior direito da cena) aproxima a câmera do que está selecionado — ou, sem seleção, do ambiente. A seta ao lado abre o menu de vistas: **Isométrica**, **Topo**, **Base**, **Frente**, **Fundo**, **Esquerda** e **Direita**. O botão passa a repetir a última vista escolhida.',
      },
    ],
  },
  {
    id: 'medidas-e-formulas',
    icone: 'formulas',
    titulo: 'Medidas e fórmulas',
    resumo: 'Contas nos campos, referência ao pai e variáveis globais.',
    blocos: [
      {
        tipo: 'texto',
        texto:
          'As medidas aparecem em **centímetros** e os ângulos em graus. Todo campo numérico aceita contas (**60+1,8**) e fórmulas.',
      },
      {
        tipo: 'lista',
        itens: [
          'Sem prefixo, a fórmula acessa outro campo ou variável do **mesmo elemento**: `largura/2`.',
          'Com **Parent!** (ou o atalho **P!**) acessa o elemento pai: `Parent!largura/2`. **P!P!altura** chega ao avô.',
          '**lenX / lenY / lenZ** dão o tamanho de qualquer elemento em qualquer eixo, seja qual for o tipo.',
          'As **variáveis globais** do projeto (botão no topo do editor) valem em qualquer campo: use **Global!nome** ou **G!nome**.',
          'O cadeado ao lado de uma medida **trava** o valor quando o grupo é redimensionado.',
        ],
      },
    ],
  },
  {
    id: 'modulos',
    icone: 'modulos',
    titulo: 'Módulos, categorias, ferragens e furos',
    resumo: 'O catálogo reutilizável e o que ele permite.',
    blocos: [
      {
        tipo: 'texto',
        texto:
          'Um **módulo** é uma peça ou grupo salvo à parte, pronto para usar em qualquer projeto. Selecione o elemento e use **Salvar como módulo**; depois traga-o com **+ Módulo**. A tela **Módulos** lista o catálogo, com busca por nome e abas por categoria.',
      },
      {
        tipo: 'lista',
        itens: [
          '**Categoria** (Estrutura, Ferragem, Furação): escolha no painel de Propriedades. Ajuda a separar chapas de dobradiças, puxadores e furos no catálogo.',
          '**+ Ferragem** insere uma ferragem do catálogo dentro do elemento selecionado, com posição e rotação definidas antes de criar.',
          '**+ Furo** cria um furo **passante** (atravessa o módulo) ou **na face** de um elemento selecionado: você escolhe a face, a posição, o diâmetro e a profundidade. O furo é marcado em cinza escuro; o material não é recortado.',
          '**Preencher vão**: um vão de porta ou janela pode receber um módulo, ajustado à largura e à altura dele; sem preencher, o vão fica aberto. Se mudar o tamanho do vão depois, preencha de novo.',
          '**Cópia dinâmica** (no painel de Propriedades de um elemento dentro de outro): repete o elemento ao longo de um eixo conforme o tamanho do pai — **um a cada…** (espaçamento) ou **quantidade fixa** —, ótimo para dobradiças e prateleiras. As cópias seguem a regra na quantidade e na posição no eixo, mas cada uma pode ser ajustada à parte (tamanho, medidas…). Desmarcar apaga as cópias; mudar o modelo depois não altera as que já existem — use **Recriar cópias**.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Uma cópia automática não pode ser apagada sozinha (a regra criaria outra): para ter menos cópias, mude a quantidade ou o espaçamento no modelo.',
      },
    ],
  },
  {
    id: 'colisao',
    icone: 'colisao',
    titulo: 'Colisão e encaixe',
    resumo: 'Por que um elemento para ao encostar em outro.',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Dois elementos só se bloqueiam se os **dois** têm a **Colisão** ligada. Com algo selecionado, o botão de colisão aparece na barra de ferramentas (ao lado das ferramentas) e liga ou desliga para toda a seleção.',
          'Quem colide são as **peças, paredes e pisos**; um grupo não é um bloco sólido. Por isso um objeto entra numa sala (grupo de paredes) e bate nas paredes, e cabe no vão entre os painéis de um armário.',
          'Ao mover, o elemento **encosta** no obstáculo, sem deixar vão, e desliza ao longo dele.',
          'Segure **Shift** enquanto move para desligar a colisão do elemento selecionado: ele atravessa os outros até você soltar a tecla.',
          'Perto de uma face de um vizinho (até 3 cm), o elemento "gruda" nela — o encaixe magnético.',
          'O chão também é sólido: nada com colisão ligada o atravessa.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Uma parede girada fora de ângulos retos (por exemplo 89,26° em vez de 90°) deixa uma cunha de vão contra um armário reto. Acerte o ângulo no painel de Propriedades da parede.',
      },
    ],
  },

];
