import { descreverForma, FACES_MODELO, FACES_TEXTURA, facesDaForma, parametrosValidos, type TipoForma } from '../formas/formas';
import { formatarCm } from '../medidas/medidas';

export type PontoPartida = 'modulos' | 'completo' | 'avulsas' | 'avancada';

export const PONTOS_PARTIDA: {
  id: PontoPartida;
  titulo: string;
  badge: string;
  descricao: string;
  recomendado?: boolean;
}[] = [
  {
    id: 'modulos',
    titulo: 'Serviços com Módulos',
    badge: 'Rápido e Flexível',
    descricao:
      'Monte ambientes com módulos pré-configurados ajustando medidas, acabamentos e acessórios rapidamente.',
    recomendado: true,
  },
  {
    id: 'completo',
    titulo: 'Serviço Completo',
    badge: 'Personalizado e Automático',
    descricao:
      'Defina medidas personalizadas e gere automaticamente a lista completa de peças para produção.',
  },
  {
    id: 'avulsas',
    titulo: 'Peças Avulsas',
    badge: 'Sob Medida e Individual',
    descricao:
      'Informe peças individuais para fabricação rápida sem a necessidade de montar um ambiente completo.',
  },
  {
    id: 'avancada',
    titulo: 'Criação Avançada',
    badge: 'Do Zero e Profissional',
    descricao: 'Acesse o editor completo com cenário em branco para criar ambientes do zero.',
  },
];

// Mesmos limites de Models/Formas.cs e Dtos/ProjetoDtos.cs na API
export const MAXIMO_ELEMENTOS = 500;
export const PROFUNDIDADE_MAXIMA = 12;
export const TAMANHO_NOME_ELEMENTO = 60;
export const TAMANHO_MAXIMO_GRUPO = 20000;
// Mesmo limite de Formas.NomeVariavelComprimentoMaximo na API: nome de variável de elemento ou
// global (ver nomeDeVariavelValido/nomeDeVariavelGlobalValido no editorStore)
export const TAMANHO_NOME_VARIAVEL = 40;

export interface Forma {
  tipo: TipoForma;
  parametros: Record<string, number>;
}

/**
 * Posição da origem do elemento, relativa ao pai, em mm. Como no SketchUp, a origem é um canto:
 * a peça ocupa o sentido positivo dos três eixos a partir dela
 */
export interface Posicao {
  x: number;
  y: number;
  z: number;
}

/**
 * Rotação em graus em torno da origem, relativa ao pai (ordem X, Y, Z). Positivo é anti-horário
 * visto da ponta positiva do eixo, como no SketchUp
 */
export interface Rotacao {
  x: number;
  y: number;
  z: number;
}

export type TipoElemento = 'peca' | 'grupo' | 'parede' | 'piso' | 'abertura';

// Mesmos limites de Models/Formas.cs na API
// A precisão do editor é de 0,1 mm (ver cmParaMm/arredondar); esse já é o mínimo possível
export const MEDIDA_MINIMA = 0.1;
export const MEDIDA_MAXIMA = 5000;
// O encontro de paredes (construirSegmentosParede) estende cada segmento um pouco além do canto
// bruto que o usuário desenhou, pela metade da espessura da parede — por isso qualquer limite
// comparado com uma medida já "assada" (comprimento de parede, posição, tamanho do grupo) precisa
// dessa folga de MEDIDA_MAXIMA por cima do valor bruto, senão um cômodo desenhado bem no limite
// nominal sempre estoura o limite de verdade
export const PAREDE_COMPRIMENTO_MAXIMO = TAMANHO_MAXIMO_GRUPO + MEDIDA_MAXIMA;
export const LIMITE_POSICAO = TAMANHO_MAXIMO_GRUPO + MEDIDA_MAXIMA;
export const PISO_VERTICES_MAXIMO = 200;
export const ABERTURAS_POR_PAREDE_MAXIMO = 20;
// Tamanho máximo de um arquivo .glb importado como módulo (mesmo valor de
// Formas.Modelo3dTamanhoMaximo no backend — checado de novo lá, este aqui só evita ler/processar
// um arquivo grande demais no navegador antes de descobrir que ele vai ser rejeitado)
export const MODELO3D_TAMANHO_MAXIMO = 1024 * 1024 * 1024;

export type TipoAbertura = 'porta' | 'janela';

/**
 * Vão retangular numa parede (porta ou janela), em mm: um elemento filho dela, como uma peça
 * dentro de um grupo. A posição do elemento (relativa à origem da parede) é o próprio
 * deslocamento/peitoril: `posicao.x` é a distância do início da parede até a borda esquerda do
 * vão, `posicao.z` é a altura do chão até a base dele (0 = alcança o chão, como uma porta); `y`
 * fica sempre 0. Porta e janela só mudam nos valores padrão — geometricamente são o mesmo buraco
 * retangular, sem folha nem vidro desenhados
 */
export interface Abertura {
  tipo: TipoAbertura;
  largura: number;
  altura: number;
}

/** Medidas de uma parede, em mm, a partir da origem: comprimento no eixo local X, altura em Y (o
 * pé-direito, por padrão) e espessura em Z da MALHA da parede em si (convenção do three.js, onde
 * a vertical continua sendo Y — não confundir com posicao/tamanho do elemento, onde Z é a
 * vertical; ver SENTIDO_Z em ModuloViewport.tsx) */
export interface Parede {
  comprimento: number;
  altura: number;
  espessura: number;
}

/**
 * Piso criado automaticamente ao fechar um contorno de paredes, preenchendo a área interna dele:
 * um polígono no plano X/Y dos dados do elemento (Z é a vertical — cantos relativos à origem do
 * próprio elemento, na mesma ordem do contorno das paredes), que vira uma malha extrudada por uma
 * espessura no Y nativo da cena (three.js, onde a vertical continua sendo Y — ver
 * criarGeometriaPiso em ModuloViewport.tsx), com o topo encostando na origem
 */
export interface Piso {
  vertices: Posicao[];
  espessura: number;
}

/** Um membro de um grupo de face (ver `Elemento.gruposDeFace`): a face `face` do elemento com
 * aquela `referencia` (um descendente, direto ou não, do grupo dono dessa lista). Usa
 * `Elemento.referenciaEstavel` — gerada sozinha na hora, nunca mostrada na cena — em vez da chave
 * do elemento em memória (que é só desta sessão do editor e quebraria a referência assim que o
 * projeto fosse salvo e recarregado) ou do `idUnico` (que É mostrado como etiqueta flutuante sobre
 * a peça — usá-lo aqui geraria rótulos indesejados só por uma peça ter entrado num grupo de face) */
export interface MembroGrupoDeFace {
  referencia: string;
  face: string;
}

/** Nó da árvore de montagem, como grupos e geometria no Outliner do SketchUp */
export interface Elemento {
  id: number;
  tipo: TipoElemento;
  nome: string;
  posicao: Posicao;
  rotacao: Rotacao;
  /** Elemento sólido: bloqueia o movimento contra outro elemento também sólido */
  colisao: boolean;
  /** Oculto não aparece na cena 3D nem pode ser clicado nela */
  visivel: boolean;
  /** Só em peças; uma peça tem forma OU modelo3d, nunca os dois */
  forma: Forma | null;
  /** Só em peças importadas de um .glb: a URL do arquivo ORIGINAL (nunca separado em partes) —
   * várias peças do mesmo import compartilham a mesma URL, cada uma com seu `modelo3dNo` próprio.
   * Nunca muda depois de importado (não é reenviado a cada salvamento; ver montarEntradaElemento) */
  modelo3d: string | null;
  /** Só junto de `modelo3d`: caminho da malha desta peça dentro do arquivo (ex.: "2.0.1"), pra
   * saber qual pedaço dele é dela — ver lib/modelo3d/importarGlb.ts */
  modelo3dNo: string | null;
  /** Grupos: medidas fixas (x largura, y altura, z profundidade); nulo em grupos antigos. Peças
   * com modelo3d: o tamanho fixo da malha (calculado uma vez na importação) */
  tamanho: Posicao | null;
  /** Só em paredes */
  parede: Parede | null;
  /** Só em vãos (porta/janela), filhos de uma parede */
  abertura: Abertura | null;
  /** Fórmulas ao vivo dos campos numéricos (ex.: `{ posicaoX: "Parent!largura/2" }`), como nos
   * componentes dinâmicos do SketchUp; nulo se não houver nenhuma */
  formulas: Record<string, string> | null;
  /** Variáveis customizadas do elemento: nome -> texto digitado (número ou fórmula) */
  variaveisFormulas: Record<string, string> | null;
  /** Variáveis customizadas de uma face específica da peça (pensado pra furação/ferragem no
   * futuro): face -> nome -> texto digitado (número ou fórmula), nas mesmas faces de `texturas`;
   * nulo se não houver nenhuma. Resolve pro número igual a `variaveisFormulas`, mas ainda não pode
   * ser referenciada em outra fórmula (nem da própria peça, nem de fora) — só fica guardada e
   * calculada, pronta pra quando existir algo que precise ler o valor de uma face específica */
  variaveisPorFaceFormulas: Record<string, Record<string, string>> | null;
  /** Campos travados (mesmas chaves das fórmulas, ex.: `largura`, `posicaoX`): não mudam quando
   * um grupo pai é redimensionado e escala o conteúdo; nulo se não houver nenhum */
  travados: string[] | null;
  /** Cor sólida ("#rrggbb") ou imagem (URL de arquivo salvo) por face da peça:
   * `direita`/`esquerda`/`topo`/`base`/`frente`/`fundo` na caixa, `lateral`/`topo`/`base` no
   * cilindro; nulo se não houver nenhuma (ver `ehCorSolida`) */
  texturas: Record<string, string> | null;
  /** Só em grupos: grupos de face pra pintar de uma vez no balde de tinta (ex.: "Caixa" = a face
   * "esquerda" da peça X + a "direita" da peça Y + a "fundo" da peça Z) — um grupo de módulos
   * (gaveteiro, armário) é pintado como um conjunto, então cada membro aponta pra uma face de um
   * DESCENDENTE deste grupo, não uma face dele mesmo (um grupo não tem face própria). Nome do
   * grupo -> lista de membros; nulo se não houver nenhum */
  gruposDeFace: Record<string, MembroGrupoDeFace[]> | null;
  /** Código interno gerado sozinho na hora em que o elemento entra num grupo de face pela primeira
   * vez (ver `MembroGrupoDeFace`) — nunca aparece na cena nem em lugar nenhum da interface, ao
   * contrário de `idUnico`. Regenerado se o elemento for duplicado, como o idUnico; nulo se o
   * elemento nunca entrou num grupo de face */
  referenciaEstavel: string | null;
  /** Só em peça/grupo: código gerado uma vez, regenerado se o elemento for duplicado; nulo se
   * nunca foi gerado */
  idUnico: string | null;
  /** Só em peça/grupo: número de ordem entre os módulos do projeto, tipo "M-4"; nulo se nunca
   * foi gerado */
  idSequencial: string | null;
  /** Só nos grupos de paredes: os cantos originalmente clicados (relativos à origem do grupo),
   * pra poder reabrir e editar depois; nulo nos demais grupos/paredes */
  verticesParede: Posicao[] | null;
  /** Se o contorno clicado estava fechado; só importa junto de `verticesParede` */
  verticesParedeFechado: boolean | null;
  /** Só em pisos */
  piso: Piso | null;
  /** Grupos e peças contêm qualquer elemento; paredes só vãos (aberturas); pisos e vãos não têm filhos */
  filhos: Elemento[];
}

/** Elemento salvo num módulo, como a API devolve: mesmo formato de `Elemento`, mas nunca tem id
 * (um módulo nunca é um elemento de projeto, só uma cópia independente pronta pra importar) */
export interface ElementoModulo extends Omit<Elemento, 'id' | 'filhos'> {
  filhos: ElementoModulo[] | null;
}

/** Elemento enviado ao salvar; sem id quando ainda não existe no banco */
export interface ElementoEntrada {
  id?: number;
  tipo: TipoElemento;
  nome: string;
  posicao: Posicao;
  rotacao?: Rotacao;
  colisao?: boolean;
  visivel?: boolean;
  forma?: Forma;
  modelo3d?: string;
  modelo3dNo?: string;
  tamanho?: Posicao;
  parede?: Parede;
  abertura?: Abertura;
  formulas?: Record<string, string>;
  variaveisFormulas?: Record<string, string>;
  variaveisPorFaceFormulas?: Record<string, Record<string, string>>;
  travados?: string[];
  texturas?: Record<string, string>;
  gruposDeFace?: Record<string, MembroGrupoDeFace[]>;
  referenciaEstavel?: string;
  idUnico?: string;
  idSequencial?: string;
  verticesParede?: Posicao[];
  verticesParedeFechado?: boolean;
  piso?: Piso;
  filhos?: ElementoEntrada[];
}

export interface NovoProjetoDados {
  nome: string;
  descricao: string;
  pontoPartida: PontoPartida;
}

interface ProjetoBase {
  id: number;
  nome: string;
  descricao: string | null;
  pontoPartida: PontoPartida;
  criadoEm: string;
  atualizadoEm: string;
}

// Item de GET /api/projetos
export interface ProjetoResumo extends ProjetoBase {
  totalPecas: number;
}

// Resposta de GET /api/projetos/{id}
export interface Projeto extends ProjetoBase {
  /** Nula em projetos criados antes de a planta existir */
  planta: Posicao | null;
  /** Variáveis globais do projeto (nome -> valor); qualquer elemento acessa com "Global!nome".
   * Nula em projetos sem nenhuma criada ainda */
  variaveisGlobais: Record<string, number> | null;
  elementos: Elemento[];
}

export function posicaoValida(posicao: Posicao) {
  return Object.values(posicao).every((v) => Number.isFinite(v) && Math.abs(v) <= LIMITE_POSICAO);
}

/** Medidas de grupo entre o mínimo possível e o máximo aceito pela API. Usa a mesma folga de
 * PAREDE_COMPRIMENTO_MAXIMO: o tamanho de um grupo de paredes é calculado a partir da caixa que
 * envolve as paredes já com a espessura somada, não do contorno bruto desenhado */
export function tamanhoValido(tamanho: Posicao | undefined) {
  return (
    tamanho !== undefined &&
    Object.values(tamanho).every(
      (v) => Number.isFinite(v) && v >= MEDIDA_MINIMA && v <= TAMANHO_MAXIMO_GRUPO + MEDIDA_MAXIMA,
    )
  );
}

/**
 * Vão dentro dos limites da parede-mãe (não passa da borda nem do teto). `posicao` é a do próprio
 * elemento do vão (x = deslocamento, z = peitoril, relativos à origem da parede)
 */
export function aberturaValida(
  abertura: Abertura,
  posicao: Pick<Posicao, 'x' | 'z'>,
  parede: Pick<Parede, 'comprimento' | 'altura'>,
) {
  const { tipo, largura, altura } = abertura;
  const { x: deslocamento, z: peitoril } = posicao;
  return (
    (tipo === 'porta' || tipo === 'janela') &&
    [deslocamento, largura, altura, peitoril].every(Number.isFinite) &&
    largura >= MEDIDA_MINIMA &&
    altura >= MEDIDA_MINIMA &&
    deslocamento >= 0 &&
    peitoril >= 0 &&
    deslocamento + largura <= parede.comprimento &&
    peitoril + altura <= parede.altura
  );
}

export function paredeValida(parede: Parede | undefined) {
  if (!parede) return false;
  const { comprimento, altura, espessura } = parede;
  return (
    Number.isFinite(comprimento) &&
    comprimento >= MEDIDA_MINIMA &&
    comprimento <= PAREDE_COMPRIMENTO_MAXIMO &&
    [altura, espessura].every((v) => Number.isFinite(v) && v >= MEDIDA_MINIMA && v <= MEDIDA_MAXIMA)
  );
}

// Parâmetros ficam em mm; o texto mostra cm, no mesmo estilo de descreverForma
export function descreverParede({ comprimento, altura, espessura }: Parede) {
  const medidas = [comprimento, altura, espessura].map((v) => formatarCm(v) || '–').join(' × ');
  return `Parede · ${medidas} cm`;
}

const NOME_TIPO_ABERTURA: Record<TipoAbertura, string> = { porta: 'Porta', janela: 'Janela' };

export function descreverAbertura({ tipo, largura, altura }: Abertura) {
  const medidas = [largura, altura].map((v) => formatarCm(v) || '–').join(' × ');
  return `${NOME_TIPO_ABERTURA[tipo]} · ${medidas} cm`;
}

/** Piso válido: pelo menos 3 cantos (um polígono de verdade), sem passar do limite, e espessura
 * como uma peça */
export function pisoValido(piso: Piso | undefined) {
  if (!piso) return false;
  const { vertices, espessura } = piso;
  return (
    vertices.length >= 3 &&
    vertices.length <= PISO_VERTICES_MAXIMO &&
    vertices.every(posicaoValida) &&
    Number.isFinite(espessura) &&
    espessura >= MEDIDA_MINIMA &&
    espessura <= MEDIDA_MAXIMA
  );
}

export function descreverPiso({ vertices, espessura }: Piso) {
  return `Piso · ${vertices.length} cantos · ${formatarCm(espessura) || '–'} cm`;
}

function contarDescendentes(elemento: ElementoModulo): number {
  return (elemento.filhos ?? []).reduce((total, filho) => total + 1 + contarDescendentes(filho), 0);
}

// Parâmetros ficam em mm; o texto mostra cm, no mesmo estilo de descreverForma. Ordem
// largura/altura/profundidade, como nas formas normais — não a ordem crua x/y/z (altura é z, não y)
export function descreverModelo3d(tamanho: Posicao) {
  const medidas = [tamanho.x, tamanho.z, tamanho.y].map((v) => formatarCm(v) || '–').join(' × ');
  return `Modelo 3D · ${medidas} cm`;
}

/** Descrição de uma peça ou grupo salvo como módulo (a raiz é sempre um dos dois), no mesmo
 * estilo do Outliner */
export function descreverElementoModulo(elemento: ElementoModulo) {
  if (elemento.tipo === 'peca' && elemento.forma) {
    return descreverForma(elemento.forma.tipo, elemento.forma.parametros);
  }
  if (elemento.tipo === 'peca' && elemento.modelo3d && elemento.tamanho) {
    return descreverModelo3d(elemento.tamanho);
  }
  const total = contarDescendentes(elemento);
  return `Grupo · ${total} ${total === 1 ? 'elemento' : 'elementos'}`;
}

/**
 * Nomes das faces endereçáveis do elemento (pra pintura, variáveis por face etc.): as da forma
 * numa peça paramétrica, as 6 da caixa envolvente numa peça de modelo 3D importado, parede ou
 * piso (identificadas pela caixa, não pela malha triangulada em si — ver FACES_MODELO) — lista
 * vazia num grupo, vão ou peça sem forma/modelo3d (nunca aconteceria na prática)
 */
export function facesDoElemento(elemento: Pick<ElementoEntrada, 'tipo' | 'forma' | 'modelo3d'>): string[] {
  if (elemento.tipo === 'peca' && elemento.forma) return facesDaForma(elemento.forma);
  if (elemento.tipo === 'peca' && elemento.modelo3d) return FACES_MODELO;
  if (elemento.tipo === 'parede' || elemento.tipo === 'piso') return FACES_TEXTURA.caixa;
  return [];
}

/** Nome de grupo de face válido: um rótulo livre (não é identificador de fórmula, só uma
 * etiqueta), dentro do tamanho aceito pela API */
export function nomeDeGrupoDeFaceValido(nome: string): boolean {
  return nome.trim().length > 0 && nome.length <= TAMANHO_NOME_ELEMENTO;
}

/**
 * `paredePai` só é necessário pra validar um elemento do tipo "abertura" (precisa caber na
 * parede-mãe); nos demais tipos é ignorado
 */
export function elementoValido(
  elemento: Pick<
    ElementoEntrada,
    'tipo' | 'nome' | 'posicao' | 'rotacao' | 'forma' | 'modelo3d' | 'tamanho' | 'parede' | 'piso' | 'abertura'
  >,
  paredePai?: Pick<Parede, 'comprimento' | 'altura'>,
) {
  const nome = elemento.nome.trim();
  if (nome === '' || nome.length > TAMANHO_NOME_ELEMENTO || !posicaoValida(elemento.posicao)) {
    return false;
  }
  if (elemento.rotacao && !Object.values(elemento.rotacao).every(Number.isFinite)) return false;
  if (elemento.tipo === 'grupo') return tamanhoValido(elemento.tamanho);
  if (elemento.tipo === 'parede') return paredeValida(elemento.parede);
  if (elemento.tipo === 'piso') return pisoValido(elemento.piso);
  if (elemento.tipo === 'abertura') {
    return elemento.abertura !== undefined && paredePai !== undefined && aberturaValida(elemento.abertura, elemento.posicao, paredePai);
  }
  // Peça: forma OU modelo3d (com o tamanho fixo da malha), nunca os dois
  if (elemento.modelo3d !== undefined) return elemento.forma === undefined && tamanhoValido(elemento.tamanho);
  return elemento.forma !== undefined && parametrosValidos(elemento.forma.tipo, elemento.forma.parametros);
}
