import { Box3, Matrix4, Vector3 } from 'three';
import { create } from 'zustand';
import { FORMAS, completarParametros, parametrosPadrao, parametrosValidos, type TipoForma } from '../lib/formas/formas';
import { avaliarExpressao, cmParaMm, mmParaCm } from '../lib/medidas/medidas';
import { PERMISSOES, temPermissao, type PermissaoChave } from '../lib/permissoes/permissoes';
import { useAuthStore } from './authStore';
import {
  ABERTURAS_POR_PAREDE_MAXIMO,
  MAXIMO_ELEMENTOS,
  MEDIDA_MINIMA,
  TAMANHO_NOME_ELEMENTO,
  TAMANHO_NOME_VARIAVEL,
  elementoValido,
  paredeValida,
  pisoValido,
  posicaoValida,
  tamanhoValido,
  type Abertura,
  type Elemento,
  type ElementoEntrada,
  type ElementoModulo,
  type Forma,
  type MembroGrupoDeFace,
  type Parede,
  type Piso,
  type Posicao,
  type Projeto,
  type Rotacao,
  type TipoAbertura,
  type TipoElemento,
} from '../lib/projetos/projetos';
import {
  SEM_ROTACAO,
  decompor,
  envolverCaixa,
  fatorNosEixosProprios,
  matrizLocal,
} from '../lib/transformacoes/transformacoes';

export interface ElementoEditor {
  /** Identifica o elemento no editor, inclusive os que ainda não foram salvos */
  chave: string;
  id?: number;
  tipo: TipoElemento;
  nome: string;
  /** Chave do grupo pai; null na raiz do projeto */
  pai: string | null;
  /** Origem relativa ao pai, em mm */
  posicao: Posicao;
  /** Rotação em graus em torno da origem, relativa ao pai */
  rotacao: Rotacao;
  /** Elemento sólido: bloqueia o movimento contra outro elemento também sólido */
  colisao: boolean;
  /** Oculto não aparece na cena 3D nem pode ser clicado nela (continua na Estrutura, e um grupo
   * oculto esconde o conteúdo junto, mesmo o que estiver com visivel:true) */
  visivel: boolean;
  /** Só em peças; uma peça tem forma OU modelo3d, nunca os dois */
  forma?: Forma;
  /** Só em peças importadas de um .glb: a URL do arquivo original (nunca separado em partes) —
   * várias peças do mesmo import compartilham a mesma URL, cada uma com seu modelo3dNo próprio.
   * Nunca muda depois de importado (não é reenviado a cada salvamento; ver montarEntradaElemento) */
  modelo3d?: string;
  /** Só junto de modelo3d: caminho da malha desta peça dentro do arquivo (ex.: "2.0.1") */
  modelo3dNo?: string;
  /**
   * Grupos: medidas fixas da caixa do grupo a partir da origem. Redimensionar o grupo escala
   * o conteúdo; alterar o conteúdo não muda essas medidas. Peças com modelo3d: o tamanho fixo da
   * malha importada (calculado uma vez, nunca editável)
   */
  tamanho?: Posicao;
  /** Só em paredes */
  parede?: Parede;
  /** Só em vãos (porta/janela), filhos de uma parede */
  abertura?: Abertura;
  /**
   * Só nos grupos criados pelo construtor de paredes: os cantos originalmente clicados, relativos
   * à origem do próprio grupo, e se o contorno estava fechado — guardados pra poder reabrir e
   * editar depois (a geometria das paredes, já esticada nas esquinas, não dá pra reconstruir isso)
   */
  verticesParede?: Posicao[];
  verticesParedeFechado?: boolean;
  /** Só em pisos: preenche a área interna de um contorno de paredes fechado, criado
   * automaticamente ao fechá-lo (ver `adicionarParedes`/`atualizarParedes`) */
  piso?: Piso;
  /**
   * Fórmulas ao vivo dos campos numéricos deste elemento (ex.: `{ posicaoX: "Parent!largura/2" }`),
   * pela mesma chave usada para referenciá-los de um filho (ver `camposEnderecaveisDoElemento`);
   * o valor resolvido continua no campo de sempre (posicao.x, forma.parametros.largura etc.).
   * Um campo sem entrada aqui é só um número comum
   */
  formulas?: Record<string, string>;
  /** Variáveis customizadas deste elemento: nome -> texto digitado (número ou fórmula) */
  variaveisFormulas?: Record<string, string>;
  /** Variáveis customizadas de uma face específica: face -> nome -> texto digitado (número ou
   * fórmula) — ver `Elemento.variaveisPorFaceFormulas` */
  variaveisPorFaceFormulas?: Record<string, Record<string, string>>;
  /** Campos travados (chaves endereçáveis): ignorados ao escalar o conteúdo de um grupo pai */
  travados?: string[];
  /** Cor sólida ("#rrggbb") ou imagem (URL de arquivo já salvo, ou data URL JPEG recém importada)
   * por face; ver `Elemento.texturas` e `ehCorSolida` */
  texturas?: Record<string, string>;
  /** Só em grupos: grupos de face pra pintar várias de uma vez — ver `Elemento.gruposDeFace` */
  gruposDeFace?: Record<string, MembroGrupoDeFace[]>;
  /** Código interno, nunca mostrado na cena — ver `Elemento.referenciaEstavel` */
  referenciaEstavel?: string;
  /** Só em peça/grupo: código gerado uma vez (ver `gerarIdUnico`); duplicar o elemento gera outro,
   * nunca reaproveita o mesmo */
  idUnico?: string;
  /** Só em peça/grupo: número de ordem entre os módulos do projeto, tipo "M-4" (ver
   * `gerarIdSequencial`); duplicar o elemento não carrega o número da origem */
  idSequencial?: string;
  /** Valor atual de cada variável customizada, já resolvido */
  variaveis?: Record<string, number>;
  /** Valor atual de cada variável customizada por face, já resolvido: face -> nome -> número */
  valoresPorFace?: Record<string, Record<string, number>>;
  /**
   * Mensagem de erro dos campos/variáveis cuja fórmula não pôde ser calculada agora, pela mesma
   * chave de `formulas` (variáveis usam o prefixo "variavel:")
   */
  errosFormula?: Record<string, string>;
}

export type Ferramenta = 'selecionar' | 'mover' | 'girar' | 'parede' | 'trena' | 'pintura';

// "Selecionar" é a ferramenta neutra, nunca precisa de permissão. Exportado pra BarraFerramentas
// esconder o botão de quem não tem a permissão (o guard de verdade está em definirFerramenta,
// abaixo — esconder o botão é só pra não ter um botão clicável que não faz nada)
export const PERMISSAO_DA_FERRAMENTA: Record<Ferramenta, PermissaoChave | null> = {
  selecionar: null,
  mover: PERMISSOES.FERRAMENTA_MOVER,
  girar: PERMISSOES.FERRAMENTA_GIRAR,
  parede: PERMISSOES.FERRAMENTA_PAREDE,
  trena: PERMISSOES.FERRAMENTA_TRENA,
  pintura: PERMISSOES.FERRAMENTA_PINTURA,
};

/** Chave de `filhos` que guarda a lista de elementos da raiz do projeto */
export const RAIZ = '';

type Elementos = Record<string, ElementoEditor>;

export interface Arvore {
  elementos: Elementos;
  /** Ordem dos filhos de cada grupo (e da raiz, em RAIZ) */
  filhos: Record<string, string[]>;
}

/** Caixa envolvente, em mm (Z positivo para trás) */
export interface Limites {
  min: Posicao;
  max: Posicao;
}

type AlteracaoElemento = Partial<
  Pick<ElementoEditor, 'nome' | 'forma' | 'posicao' | 'rotacao' | 'colisao' | 'visivel' | 'parede' | 'abertura'>
>;

interface EditorState extends Arvore {
  /** Só quando o conteúdo aberto é um projeto; nulo ao editar um módulo avulso */
  projetoId: number | null;
  /** Só quando o conteúdo aberto é um módulo avulso (editado direto, fora de um projeto) */
  moduloId: number | null;
  /** Planta do ambiente (X largura, Y pé-direito, Z profundidade); nula em projetos antigos e
   * sempre nula ao editar um módulo avulso (não existe "ambiente" fora de um projeto) */
  planta: Posicao | null;
  /** Variáveis globais do projeto (nome -> número já resolvido; o campo de criação/edição aceita
   * uma conta, mas o valor guardado é sempre só o número — não pode referenciar outra coisa, então
   * não tem "fórmula ao vivo" nem erro depois de criada). Vazio ao editar um módulo avulso (não
   * existe "projeto" fora de um). Qualquer elemento acessa com "Global!nome" nos campos/variáveis
   * dele, do mesmo jeito que "Parent!nome" acessa o pai (ver `resolverFormulaOuNumero`) */
  variaveisGlobais: Record<string, number>;
  selecionada: string | null;
  /** Demais elementos selecionados junto de `selecionada` (Ctrl/Cmd+Click), na ordem em que
   * entraram na seleção; a seleção completa é sempre `[selecionada, ...selecionadasExtra]`. Toda
   * ação que troca `selecionada` fora de `alternarSelecaoMultipla` já limpa isto sozinha (ver o
   * envelope de `set`, mais abaixo) */
  selecionadasExtra: string[];
  /** Grupo aberto para edição (como o duplo clique do SketchUp); null na raiz */
  contexto: string | null;
  ferramenta: Ferramenta;
  /**
   * Vista Explodida (como no SketchUp): afasta visualmente todo o conteúdo do grupo `chave` (em camadas, cada nível do centro do pai dele) do
   * centro dele, pela distância guardada aqui. Puramente visual — não altera `elementos` nem entra
   * no histórico de desfazer/refazer
   */
  explodido: { chave: string; distancia: number } | null;
  /** Há alterações ainda não salvas */
  alterado: boolean;
  /** Desfazer/refazer: estados anteriores e seguintes de elementos/filhos/seleção/contexto */
  historico: Historico;
  desfazer: () => void;
  refazer: () => void;
  carregar: (projeto: Projeto, manterSelecao?: boolean) => void;
  /** Abre um módulo avulso (peça ou grupo) pra editar direto, fora de qualquer projeto: o
   * contexto já nasce dentro dele, pra elementos novos não virarem irmãos soltos dele */
  carregarModulo: (modulo: { id: number; elemento: ElementoModulo }, manterSelecao?: boolean) => void;
  limpar: () => void;
  selecionar: (chave: string | null) => void;
  /** Clique na cena: seleciona o elemento do contexto aberto que contém a peça */
  selecionarPorPeca: (chavePeca: string | null) => void;
  /**
   * Ctrl/Cmd+Click: entra ou sai da seleção múltipla, sem afetar os demais já selecionados.
   * `resolverPeloContexto` repete a resolução de `selecionarPorPeca` (clique na cena, que pode
   * acertar uma peça funda demais); a Estrutura passa a própria chave da linha, sem resolver
   */
  alternarSelecaoMultipla: (chave: string, resolverPeloContexto?: boolean) => void;
  /** Duplo clique na cena: abre o grupo que contém a peça */
  abrirPorPeca: (chavePeca: string) => void;
  abrirContexto: (chave: string | null) => void;
  sair: () => void;
  definirFerramenta: (ferramenta: Ferramenta) => void;
  adicionarPeca: (tipo: TipoForma) => void;
  adicionarGrupo: () => void;
  /** Adiciona uma parede solta, com medidas padrão */
  adicionarParede: () => void;
  /**
   * Adiciona uma cadeia de paredes de uma vez (o construtor de paredes), a partir dos cantos
   * clicados; nascem num grupo novo, no grupo aberto, com a mesma altura e espessura. Numa cadeia
   * ABERTA, `engateInicio`/`engateFim` encostam a ponta correspondente na face de uma parede já
   * existente (um encontro em T de verdade, pra paredes internas dentro de um ambiente fechado)
   */
  adicionarParedes: (
    pontos: Posicao[],
    fechado: boolean,
    opcoes: { altura: number; espessura: number },
    engateInicio?: EngateParede,
    engateFim?: EngateParede,
  ) => void;
  /**
   * Reconstrói as paredes de `chaveAlvo` (um grupo de paredes ou uma parede avulsa) a partir de
   * uma nova lista de cantos, como reabrir o construtor de paredes em cima do que já existe. Uma
   * parede avulsa que ganha mais de um segmento vira um grupo; um grupo que fica com só um
   * segmento continua sendo um grupo (só com uma parede dentro). `engateInicio`/`engateFim`: ver
   * `adicionarParedes`
   */
  atualizarParedes: (
    chaveAlvo: string,
    pontos: Posicao[],
    fechado: boolean,
    opcoes: { altura: number; espessura: number },
    engateInicio?: EngateParede,
    engateFim?: EngateParede,
  ) => void;
  duplicar: (chave: string) => void;
  /** Insere a árvore de um módulo salvo (peça ou grupo) no grupo/peça aberto no momento, como uma
   * peça nova — cada elemento ganha uma chave própria, nunca reaproveita as do módulo original */
  importarModulo: (raiz: ElementoModulo) => void;
  remover: (chave: string) => void;
  atualizar: (chave: string, alteracao: AlteracaoElemento) => void;
  /** Envolve o elemento num grupo novo, no mesmo lugar */
  agrupar: (chave: string) => void;
  /** Desfaz o grupo, levando os filhos para o pai dele sem mudar de lugar */
  desagrupar: (chave: string) => void;
  /**
   * Move o elemento para um grupo (ou para a raiz) sem mudar de lugar na cena,
   * antes do irmão `antesDe` ou no fim da lista; no mesmo pai, só reordena
   */
  moverPara: (chave: string, novoPai: string | null, antesDe?: string) => void;
  /** Redimensiona o grupo escalando o conteúdo; devolve false se alguma peça sairia dos limites */
  redimensionarGrupo: (chave: string, tamanho: Posicao) => boolean;
  /**
   * Define o valor de um campo (limpando a fórmula dele, se houver) ou sua fórmula ao vivo
   * ("Parent!campo", como nos componentes dinâmicos do SketchUp); `campo` é a mesma chave usada
   * pra referenciá-lo de um filho (ver `camposEnderecaveisDoElemento`)
   */
  definirCampo: (chave: string, campo: string, entrada: { valor: number } | { formula: string }) => void;
  /** Cria ou atualiza uma variável customizada do elemento; o texto pode ser um número ou uma
   * fórmula com Parent!, resolvida do mesmo jeito que os campos */
  definirVariavel: (chave: string, nome: string, textoOuNumero: string) => void;
  /** Remove uma variável customizada */
  removerVariavel: (chave: string, nome: string) => void;
  /** Cria ou atualiza uma variável customizada de uma face específica do elemento (ver
   * `Elemento.variaveisPorFaceFormulas`); mesmas regras de `definirVariavel` */
  definirVariavelDeFace: (chave: string, face: string, nome: string, textoOuNumero: string) => void;
  /** Remove uma variável customizada de uma face específica */
  removerVariavelDeFace: (chave: string, face: string, nome: string) => void;
  /** Cria ou atualiza uma variável global do projeto (`variaveisGlobais`); qualquer elemento
   * referencia com "Global!nome", em qualquer campo ou variável dele */
  definirVariavelGlobal: (nome: string, valor: number) => void;
  /** Remove uma variável global; campos que a referenciavam (Global!nome) passam a dar erro,
   * como uma fórmula que perdeu a referência */
  removerVariavelGlobal: (nome: string) => void;
  /** Trava/destrava um campo (chave endereçável): travado, não muda quando o grupo pai é
   * redimensionado */
  /** Define (ou, com `null`, remove) a textura de uma face da peça */
  definirTextura: (chave: string, face: string, imagem: string | null) => void;
  /** Cria ou substitui um grupo de face de um grupo (ex.: "Caixa" -> a face "esquerda" da peça X +
   * a "direita" da peça Y), pra pintar todas de uma vez no balde de tinta — ver
   * `Elemento.gruposDeFace`. `membros` identifica cada face pela CHAVE viva do elemento (como a UI
   * já trabalha); a ação resolve o idUnico estável de cada um antes de guardar (gerando um novo se
   * o elemento ainda não tinha), já que é isso que sobrevive a um salvamento */
  definirGrupoDeFace: (chave: string, nomeGrupo: string, membros: { chave: string; face: string }[]) => void;
  /** Remove um grupo de face (as faces continuam com a textura que já tinham, só o grupo some) */
  removerGrupoDeFace: (chave: string, nomeGrupo: string) => void;
  /** Aplica (ou, com `null`, remove) uma textura em todas as faces de um grupo de uma vez, em
   * cada elemento dono de cada face dele (não necessariamente o mesmo elemento que o grupo) */
  aplicarTexturaPorGrupo: (chave: string, nomeGrupo: string, imagem: string | null) => void;
  alternarTrava: (chave: string, campo: string) => void;
  /** Gera um código novo (nunca usado no projeto) para cada peça/grupo em `chaves`; os demais
   * tipos e chaves inválidas são ignorados em silêncio */
  gerarIdUnico: (chaves: string[]) => void;
  /** Numera cada peça/grupo em `chaves` como "M-N", continuando depois do maior número "M-"
   * já usado no projeto (nunca reaproveita um número, mesmo que o módulo dele tenha sido
   * removido); os demais tipos e chaves inválidas são ignorados em silêncio */
  gerarIdSequencial: (chaves: string[]) => void;
  /** Adiciona um vão (elemento filho da parede) com medidas padrão centralizadas nela; edição e
   * remoção usam as ações genéricas `atualizar`/`remover`, como qualquer outro elemento */
  adicionarAbertura: (chaveParede: string, tipo: TipoAbertura) => void;
  /** Abre a Vista Explodida do grupo (distância inicial 0) */
  abrirExplosao: (chave: string) => void;
  /** Muda a distância da Vista Explodida aberta; não faz nada se nenhuma estiver aberta */
  definirDistanciaExplosao: (distancia: number) => void;
  /** Fecha a Vista Explodida, voltando o grupo ao normal */
  fecharExplosao: () => void;
  /** Alterna se o elemento aparece na cena 3D (e pode ser clicado nela) */
  alternarVisibilidade: (chave: string) => void;
  /** Mostra ou oculta todos os elementos do projeto de uma vez */
  definirVisibilidadeTodos: (visivel: boolean) => void;
}

// Afastamento entre elementos posicionados automaticamente, em mm
const ESPACO_ENTRE_ELEMENTOS = 100;
const ORIGEM: Posicao = { x: 0, y: 0, z: 0 };
// Medidas de um grupo novo, vazio (largura, profundidade, altura)
const TAMANHO_PADRAO_GRUPO: Posicao = { x: 600, y: 550, z: 720 };
// Altura de uma parede nova quando o projeto não tem planta (pé-direito) definida
const PE_DIREITO_PADRAO = 2700;
// Distância (mm) para um módulo "grudar" numa face de um irmão do mesmo grupo ao ser arrastado
const LIMIAR_ENCAIXE = 30;
// Quantas alterações desfazer/refazer guarda; mais que isso descarta as mais antigas
const LIMITE_HISTORICO = 100;
// Edições seguidas dentro dessa janela (digitação, arraste contínuo) viram um único passo de
// desfazer, em vez de um passo por tecla ou por quadro de arraste
const JANELA_COALESCENCIA_HISTORICO_MS = 600;
// Vista Explodida: distância máxima (mm) que a barra deixa afastar os filhos do centro do grupo
export const EXPLOSAO_DISTANCIA_MAXIMA = 1000;

/** Estado suficiente para desfazer/refazer uma alteração de conteúdo */
interface InstantaneoHistorico {
  elementos: Elementos;
  filhos: Arvore['filhos'];
  selecionada: string | null;
  contexto: string | null;
}

interface Historico {
  passado: InstantaneoHistorico[];
  futuro: InstantaneoHistorico[];
}

const HISTORICO_VAZIO: Historico = { passado: [], futuro: [] };

// Enquanto verdadeiro, a mudança de elementos/filhos em andamento não vira um passo de
// desfazer/refazer: usado por `carregar`/`limpar` (não são edições do usuário) e por
// `desfazer`/`refazer` (o próprio histórico já foi atualizado como parte da mudança)
let suprimirHistorico = false;
// Instante da última alteração de conteúdo que virou passo de histórico, para decidir se a
// próxima é uma continuação (mesma janela) ou um passo novo
let ultimaMutacaoHistoricoEm = 0;
// Chave do último elemento cuja alteração virou (ou continuou) um passo de histórico, para só
// coalescer edições seguidas do MESMO elemento (não a próxima edição de outra coisa que caia,
// por acaso, dentro da mesma janela de tempo)
let ultimaChaveHistorico: string | null = null;

function tirarInstantaneo(state: Pick<EditorState, 'elementos' | 'filhos' | 'selecionada' | 'contexto'>): InstantaneoHistorico {
  return { elementos: state.elementos, filhos: state.filhos, selecionada: state.selecionada, contexto: state.contexto };
}

let contadorNovos = 0;
const chaveNova = () => `novo-${++contadorNovos}`;
const listaDe = (pai: string | null) => pai ?? RAIZ;

const somar = (a: Posicao, b: Posicao): Posicao => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const subtrair = (a: Posicao, b: Posicao): Posicao => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
// Posições calculadas ficam com precisão de 0,1 mm, sem acumular erro de ponto flutuante
const arredondar = (valor: number) => Math.round(valor * 10) / 10;
const arredondarPosicao = (p: Posicao): Posicao => ({ x: arredondar(p.x), y: arredondar(p.y), z: arredondar(p.z) });

/** Grupos acima do elemento, do pai até a raiz */
export function ancestrais(elementos: Elementos, chave: string): string[] {
  const lista: string[] = [];
  for (let atual = elementos[chave]?.pai ?? null; atual !== null; atual = elementos[atual]?.pai ?? null) {
    lista.push(atual);
  }
  return lista;
}

/** O elemento é o próprio grupo ou está dentro dele, em qualquer nível */
export function estaDentro(elementos: Elementos, chave: string, grupo: string) {
  return chave === grupo || ancestrais(elementos, chave).includes(grupo);
}

/** Se um elemento do tipo `tipoPai` pode conter um filho do tipo `tipoFilho`: um grupo ou uma peça
 * aceitam qualquer coisa, menos um vão solto (só faz sentido dentro de uma parede); uma parede só
 * aceita vãos; os demais tipos (piso, vão) não têm filhos */
export function aceitaFilho(tipoPai: TipoElemento | undefined, tipoFilho: TipoElemento) {
  if (tipoPai === 'grupo' || tipoPai === 'peca') return tipoFilho !== 'abertura';
  if (tipoPai === 'parede') return tipoFilho === 'abertura';
  return false;
}

/** Transformação da origem do elemento no espaço do projeto (posições e rotações até a raiz) */
export function matrizNoMundo(elementos: Elementos, chave: string | null): Matrix4 {
  const matriz = new Matrix4();
  for (let atual = chave; atual !== null && elementos[atual]; atual = elementos[atual].pai) {
    matriz.premultiply(matrizLocal(elementos[atual].posicao, elementos[atual].rotacao));
  }
  return matriz;
}

/** Posição da origem do elemento no espaço do projeto */
export function posicaoNoMundo(elementos: Elementos, chave: string | null): Posicao {
  return decompor(matrizNoMundo(elementos, chave)).posicao;
}

/** Chaves abaixo de `pai`, em profundidade e na ordem da árvore */
export function ordemNaArvore(filhos: Arvore['filhos'], pai: string = RAIZ): string[] {
  return (filhos[pai] ?? []).flatMap((chave) => [chave, ...ordemNaArvore(filhos, chave)]);
}

/** Um elemento (e toda a subárvore dele) no formato enviado à API */
export function montarEntradaElemento(arvore: Arvore, chave: string): ElementoEntrada {
  const {
    id,
    tipo,
    nome,
    posicao,
    rotacao,
    colisao,
    visivel,
    forma,
    modelo3d,
    modelo3dNo,
    tamanho,
    parede,
    piso,
    abertura,
    formulas,
    variaveisFormulas,
    variaveisPorFaceFormulas,
    travados,
    texturas,
    gruposDeFace,
    referenciaEstavel,
    idUnico,
    idSequencial,
    verticesParede,
    verticesParedeFechado,
  } = arvore.elementos[chave];
  const base = {
    id,
    tipo,
    nome: nome.trim(),
    posicao,
    rotacao,
    colisao,
    visivel,
    formulas,
    variaveisFormulas,
    travados,
    referenciaEstavel,
    idUnico,
    idSequencial,
  };
  if (tipo === 'grupo') {
    return { ...base, tamanho, verticesParede, verticesParedeFechado, gruposDeFace, filhos: montarEntrada(arvore, chave) };
  }
  if (tipo === 'parede') return { ...base, parede, texturas, variaveisPorFaceFormulas, filhos: montarEntrada(arvore, chave) };
  if (tipo === 'piso') return { ...base, piso, texturas, variaveisPorFaceFormulas };
  if (tipo === 'abertura') return { ...base, abertura };
  // Peça: forma OU modelo3d (com o tamanho fixo da malha, ver Elemento.modelo3d)
  return {
    ...base,
    forma,
    texturas,
    variaveisPorFaceFormulas,
    modelo3d,
    modelo3dNo,
    tamanho,
    filhos: montarEntrada(arvore, chave),
  };
}

/** Árvore no formato enviado à API */
export function montarEntrada(arvore: Arvore, pai: string = RAIZ): ElementoEntrada[] {
  return (arvore.filhos[pai] ?? []).map((chave) => montarEntradaElemento(arvore, chave));
}

function unir(lista: Limites[]): Limites | null {
  if (lista.length === 0) return null;
  const extremo = (fn: (...valores: number[]) => number, lado: 'min' | 'max', eixo: keyof Posicao) =>
    fn(...lista.map((limites) => limites[lado][eixo]));
  return {
    min: { x: extremo(Math.min, 'min', 'x'), y: extremo(Math.min, 'min', 'y'), z: extremo(Math.min, 'min', 'z') },
    max: { x: extremo(Math.max, 'max', 'x'), y: extremo(Math.max, 'max', 'y'), z: extremo(Math.max, 'max', 'z') },
  };
}

// Caixa do elemento nos próprios eixos, sem posição nem rotação aplicadas (usada por `limites`,
// que a posiciona no espaço do pai, e pela Vista Explodida, que precisa do centro do filho já
// girado, mas ainda no referencial do grupo, não no do pai do grupo)
export function limitesLocais(elemento: ElementoEditor): Limites | null {
  // Caixas giradas ocupam, no espaço do pai, a caixa alinhada que as envolve
  if (elemento.forma) {
    const { tipo, parametros } = elemento.forma;
    return parametrosValidos(tipo, parametros) ? { min: ORIGEM, max: FORMAS[tipo].tamanho(parametros) } : null;
  }

  // Parede: comprimento no eixo local X a partir da origem, altura em Z a partir do chão, e
  // espessura em Y centralizada na origem (a origem é o eixo central da parede, não uma face)
  if (elemento.parede) {
    if (!paredeValida(elemento.parede)) return null;
    const { comprimento, altura, espessura } = elemento.parede;
    return { min: { x: 0, y: -espessura / 2, z: 0 }, max: { x: comprimento, y: espessura / 2, z: altura } };
  }

  // Vão: um retângulo raso no plano X/Z da parede-mãe (sem espessura própria; a posição do
  // elemento já é o deslocamento/peitoril dele)
  if (elemento.abertura) {
    const { largura, altura } = elemento.abertura;
    return { min: ORIGEM, max: { x: largura, y: 0, z: altura } };
  }

  // Piso: caixa alinhada aos eixos que envolve o polígono (cantos no plano X/Y), com a espessura
  // em Z a partir da origem — a posição do elemento já é o topo dele (ver `criarPiso`)
  if (elemento.piso) {
    if (!pisoValido(elemento.piso)) return null;
    const { vertices, espessura } = elemento.piso;
    return {
      min: { x: Math.min(...vertices.map((v) => v.x)), y: Math.min(...vertices.map((v) => v.y)), z: 0 },
      max: { x: Math.max(...vertices.map((v) => v.x)), y: Math.max(...vertices.map((v) => v.y)), z: espessura },
    };
  }

  // Grupo: a caixa fixa dele, independente do conteúdo. Peça com modelo3d: o tamanho fixo da
  // malha importada (mesmo campo, mesma lógica)
  return elemento.tamanho && tamanhoValido(elemento.tamanho) ? { min: ORIGEM, max: elemento.tamanho } : null;
}

/** Caixa envolvente do elemento no espaço do pai; null se não houver medidas válidas */
export function limites(arvore: Arvore, chave: string): Limites | null {
  const elemento = arvore.elementos[chave];
  if (!elemento || !posicaoValida(elemento.posicao)) return null;
  const { posicao, rotacao } = elemento;
  if (!Object.values(rotacao).every(Number.isFinite)) return null;

  if (elemento.forma || elemento.parede || elemento.piso || elemento.tamanho || elemento.abertura) {
    const local = limitesLocais(elemento);
    return local && envolverCaixa(local.min, local.max, posicao, rotacao);
  }

  const conteudo = limitesConteudo(arvore, chave);
  return conteudo && envolverCaixa(conteudo.min, conteudo.max, posicao, rotacao);
}

/** Caixa envolvente do conteúdo de um grupo, no espaço do próprio grupo */
export function limitesConteudo(arvore: Arvore, grupo: string): Limites | null {
  return unir(
    (arvore.filhos[grupo] ?? []).map((chave) => limites(arvore, chave)).filter((l) => l !== null),
  );
}

// Caixa envolvente do elemento no espaço do projeto inteiro (não só no do pai direto), subindo
// pela cadeia de pais e envolvendo a caixa de novo a cada nível que tiver rotação
function limitesNoMundo(arvore: Arvore, chave: string): Limites | null {
  const caixa = limites(arvore, chave);
  if (!caixa) return null;

  let atual = caixa;
  for (let pai = arvore.elementos[chave]?.pai ?? null; pai !== null; pai = arvore.elementos[pai]?.pai ?? null) {
    const elementoPai = arvore.elementos[pai];
    atual = envolverCaixa(atual.min, atual.max, elementoPai.posicao, elementoPai.rotacao);
  }
  return atual;
}

// Ajuste (num só espaço, seja o do pai ou o do projeto inteiro) para grudar `caixaMovida` numa
// face de alguma das `alvos`, eixo a eixo, dentro de `LIMIAR_ENCAIXE` mm. Encaixa face contra
// face (as duas se tocam) e face a face alinhada (as duas coincidem), como no SketchUp
function ajusteDeEncaixe(caixaMovida: Limites, alvos: Limites[]): Posicao {
  const ajuste = { x: 0, y: 0, z: 0 };

  for (const eixo of ['x', 'y', 'z'] as const) {
    const outrosEixos = (['x', 'y', 'z'] as const).filter((e) => e !== eixo);
    let menorDelta: number | null = null;

    for (const caixaAlvo of alvos) {
      // Só faz sentido encaixar se as outras duas dimensões se sobrepõem; senão os módulos
      // não estão de frente um para o outro nesse eixo
      const seEncontram = outrosEixos.every(
        (o) => caixaMovida.min[o] < caixaAlvo.max[o] && caixaMovida.max[o] > caixaAlvo.min[o],
      );
      if (!seEncontram) continue;

      const candidatos = [
        caixaAlvo.max[eixo] - caixaMovida.min[eixo], // face min encosta na face max do alvo
        caixaAlvo.min[eixo] - caixaMovida.max[eixo], // face max encosta na face min do alvo
        caixaAlvo.min[eixo] - caixaMovida.min[eixo], // faces min alinhadas
        caixaAlvo.max[eixo] - caixaMovida.max[eixo], // faces max alinhadas
      ];
      for (const delta of candidatos) {
        if (Math.abs(delta) <= LIMIAR_ENCAIXE && (menorDelta === null || Math.abs(delta) < Math.abs(menorDelta))) {
          menorDelta = delta;
        }
      }
    }

    if (menorDelta !== null) ajuste[eixo] = menorDelta;
  }

  return ajuste;
}

// Entre dois ajustes candidatos no mesmo eixo (irmãos e paredes), fica o de menor deslocamento;
// 0 quer dizer "sem candidato nesse eixo"
function menorAjuste(a: number, b: number): number {
  if (a === 0) return b;
  if (b === 0) return a;
  return Math.abs(a) <= Math.abs(b) ? a : b;
}

/**
 * Ajusta `posicaoProposta` (espaço do pai) para "grudar" num irmão do mesmo grupo ou numa parede
 * de qualquer lugar do projeto, quando estiver a até `LIMIAR_ENCAIXE` mm de distância. As paredes
 * marcam os limites físicos do ambiente, então grudam nelas mesmo módulos fora do grupo delas
 */
export function calcularEncaixe(arvore: Arvore, chave: string, posicaoProposta: Posicao): Posicao {
  const elemento = arvore.elementos[chave];
  const arvoreProposta: Arvore = {
    ...arvore,
    elementos: { ...arvore.elementos, [chave]: { ...elemento, posicao: posicaoProposta } },
  };
  const caixaMovida = limites(arvoreProposta, chave);
  if (!caixaMovida) return posicaoProposta;

  const irmaos = Object.values(arvore.elementos).filter((e) => e.pai === elemento.pai && e.chave !== chave);
  const caixasIrmaos = irmaos.map((irmao) => limites(arvore, irmao.chave)).filter((c) => c !== null);
  const ajusteIrmaos = ajusteDeEncaixe(caixaMovida, caixasIrmaos);

  // Paredes fora do grupo do elemento movido: comparadas no espaço do projeto inteiro, já que
  // não compartilham o espaço do pai com quem está sendo arrastado
  const paredesDeFora = Object.values(arvore.elementos).filter(
    (e) =>
      e.tipo === 'parede' &&
      e.pai !== elemento.pai &&
      !estaDentro(arvore.elementos, e.chave, chave) &&
      !estaDentro(arvore.elementos, chave, e.chave),
  );

  let ajusteParedes = { x: 0, y: 0, z: 0 };
  if (paredesDeFora.length > 0) {
    const matrizPai = matrizNoMundo(arvore.elementos, elemento.pai);
    const caixaMovidaMundo = envolverCaixaComMatriz(caixaMovida, matrizPai);
    const caixasParedesMundo = paredesDeFora
      .map((parede) => limitesNoMundo(arvore, parede.chave))
      .filter((c) => c !== null);
    const ajusteMundo = ajusteDeEncaixe(caixaMovidaMundo, caixasParedesMundo);

    if (ajusteMundo.x || ajusteMundo.y || ajusteMundo.z) {
      // O ajuste calculado está no espaço do projeto: só a rotação acumulada dos pais (sem a
      // translação) importa para trazê-lo de volta ao espaço em que `posicaoProposta` está
      const rotacaoInversaDoPai = new Matrix4().extractRotation(matrizPai).invert();
      const deltaNoPai = new Vector3(ajusteMundo.x, ajusteMundo.y, ajusteMundo.z).applyMatrix4(rotacaoInversaDoPai);
      ajusteParedes = { x: deltaNoPai.x, y: deltaNoPai.y, z: deltaNoPai.z };
    }
  }

  const ajuste = {
    x: menorAjuste(ajusteIrmaos.x, ajusteParedes.x),
    y: menorAjuste(ajusteIrmaos.y, ajusteParedes.y),
    z: menorAjuste(ajusteIrmaos.z, ajusteParedes.z),
  };

  return somar(posicaoProposta, ajuste);
}

// Caixa envolvente após aplicar uma transformação já composta (ao contrário de `envolverCaixa`,
// que monta a matriz a partir de posição e rotação)
function envolverCaixaComMatriz(caixa: Limites, matriz: Matrix4): Limites {
  const caixaTransformada = new Box3(
    new Vector3(caixa.min.x, caixa.min.y, caixa.min.z),
    new Vector3(caixa.max.x, caixa.max.y, caixa.max.z),
  ).applyMatrix4(matriz);
  return {
    min: { x: caixaTransformada.min.x, y: caixaTransformada.min.y, z: caixaTransformada.min.z },
    max: { x: caixaTransformada.max.x, y: caixaTransformada.max.y, z: caixaTransformada.max.z },
  };
}

// Ângulo do vetor a→b em graus, na mesma convenção usada em rotacao.z no resto do editor
// (rotação em torno do eixo Z não é espelhada pela cena, ao contrário do Y — ver SENTIDO_Z em
// ModuloViewport.tsx/ModuloMiniatura.tsx)
export function anguloGraus(a: Posicao, b: Posicao) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

// Planta baixa: paredes/piso vivem no plano X/Y (Z é a altura agora) — ver construirSegmentosParede
export function distanciaXY(a: Posicao, b: Posicao) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface SegmentoParede {
  posicao: Posicao;
  rotacaoZ: number;
  comprimento: number;
}

/**
 * Segmentos entre pontos consecutivos. Como uma esquina de verdade (e como o SketchUp desenha
 * duas paredes se encontrando): a parede que CHEGA na esquina atravessa ela por inteiro (estica a
 * ponta pra cobrir a espessura da próxima), e a que SAI da esquina começa encostada nessa outra,
 * sem também atravessar — só uma das duas ocupa o quadrado da esquina, não as duas ao mesmo tempo.
 * A ponta livre de uma sequência aberta não é tocada
 */
export function construirSegmentosParede(pontos: Posicao[], fechado: boolean, espessura: number): SegmentoParede[] {
  const sequencia = fechado ? [...pontos, pontos[0]] : pontos;
  const brutos = sequencia
    .slice(1)
    .map((fim, indice) => ({ inicio: sequencia[indice], fim }))
    // Cliques muito próximos entre si não viram parede
    .filter((segmento) => distanciaXY(segmento.inicio, segmento.fim) >= MEDIDA_MINIMA);

  const metadeEspessura = espessura / 2;
  // Encostar duas paredes exatamente na medida (a que chega esticada até a medida exata da face
  // externa da outra) faz as duas superfícies caírem no mesmíssimo plano — a placa de vídeo então
  // "pisca" entre uma e outra tentando decidir qual mostrar ali (z-fighting), como um risco
  // instável bem na esquina. Um empurrão de 2 mm (imperceptível numa parede) evita a coincidência:
  // a que chega estica 2 mm a mais, e a que sai começa 2 mm mais pra trás (dentro da primeira).
  // Uma parede mais fina que o dobro disso não tem "meia espessura menos a junta" sobrando pra
  // cortar — a junta encolhe pra caber, em vez de inverter o sinal do corte (o que faria a saída
  // deixar de se encostar na esquina, voltando ao próprio z-fighting que ela existe pra evitar)
  const JUNTA_EXTRA = Math.min(2, metadeEspessura);

  return brutos.map(({ inicio, fim }, indice) => {
    const comprimentoBase = distanciaXY(inicio, fim);
    const direcao = { x: (fim.x - inicio.x) / comprimentoBase, y: (fim.y - inicio.y) / comprimentoBase };
    const temAntes = indice > 0 || fechado;
    const temDepois = indice < brutos.length - 1 || fechado;

    const extensaoNaChegada = temDepois ? metadeEspessura + JUNTA_EXTRA : 0;
    // Um segmento mais curto que a própria espessura não pode perder mais comprimento do que
    // tem — senão a parede nasceria depois da própria ponta, ultrapassando a esquina em vez de
    // só encostar nela. Nesse caso extremo, corta só até sobrar o mínimo, em vez de ultrapassar
    const corteMaximo = Math.max(0, comprimentoBase - MEDIDA_MINIMA);
    const corteAplicado = temAntes ? Math.min(metadeEspessura - JUNTA_EXTRA, corteMaximo) : 0;
    const comprimento = Math.max(MEDIDA_MINIMA, comprimentoBase - corteAplicado + extensaoNaChegada);

    const inicioEstendido = corteAplicado > 0
      ? { x: inicio.x + direcao.x * corteAplicado, y: inicio.y + direcao.y * corteAplicado, z: 0 }
      : inicio;
    return { posicao: inicioEstendido, rotacaoZ: anguloGraus(inicio, fim), comprimento };
  });
}

// Caixa [min,max] de UM segmento de parede no espaço do pai — NÃO usa envolverCaixa/matrizLocal
// porque aquela rotaciona no sentido da cena (espelhado, ver SENTIDO_Z), enquanto rotacaoZ de uma
// parede é o ângulo cru de anguloGraus (atan2, sem espelhar); usar envolverCaixa aqui fazia a
// parede "pensar" que se estende pro lado oposto do que é renderizado, inflando a caixa do grupo
function limitesSegmentoParede(segmento: SegmentoParede, espessura: number, altura: number): Limites {
  const radianos = (segmento.rotacaoZ * Math.PI) / 180;
  const cos = Math.cos(radianos);
  const sin = Math.sin(radianos);
  const metade = espessura / 2;
  const cantos: [number, number][] = [
    [0, -metade],
    [0, metade],
    [segmento.comprimento, -metade],
    [segmento.comprimento, metade],
  ];
  const xs = cantos.map(([lx, ly]) => segmento.posicao.x + lx * cos - ly * sin);
  const ys = cantos.map(([lx, ly]) => segmento.posicao.y + lx * sin + ly * cos);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys), z: segmento.posicao.z },
    max: { x: Math.max(...xs), y: Math.max(...ys), z: segmento.posicao.z + altura },
  };
}

/** Ponta de uma cadeia aberta encostada na face de uma parede já existente (um T de verdade), em
 * vez de ficar solta no ar — só a espessura da parede-alvo importa pra saber o quanto recuar */
export interface EngateParede {
  espessura: number;
}

// Recua as pontas livres de uma cadeia ABERTA que foram encostadas numa parede já existente
// (ver EngateParede). Como essa parede-alvo já está pronta (não é reconstruída aqui), a ponta nova
// só precisa recuar até a face dela — nunca atravessar, ao contrário do encontro normal de cantos
// em construirSegmentosParede, onde uma das duas paredes efetivamente atravessa a esquina
export function aplicarEngatesNasPontas(
  segmentos: SegmentoParede[],
  engateInicio: EngateParede | undefined,
  engateFim: EngateParede | undefined,
): SegmentoParede[] {
  if (segmentos.length === 0 || (!engateInicio && !engateFim)) return segmentos;
  const resultado = segmentos.map((segmento) => ({ ...segmento }));

  const recuo = (espessuraAlvo: number, comprimentoDisponivel: number) => {
    const junta = Math.min(2, espessuraAlvo / 2);
    const corteMaximo = Math.max(0, comprimentoDisponivel - MEDIDA_MINIMA);
    return Math.min(Math.max(0, espessuraAlvo / 2 - junta), corteMaximo);
  };

  if (engateInicio) {
    const primeiro = resultado[0];
    const corte = recuo(engateInicio.espessura, primeiro.comprimento);
    if (corte > 0) {
      const radianos = (primeiro.rotacaoZ * Math.PI) / 180;
      primeiro.posicao = {
        x: primeiro.posicao.x + Math.cos(radianos) * corte,
        y: primeiro.posicao.y + Math.sin(radianos) * corte,
        z: primeiro.posicao.z,
      };
      primeiro.comprimento -= corte;
    }
  }

  if (engateFim) {
    const ultimo = resultado[resultado.length - 1];
    ultimo.comprimento -= recuo(engateFim.espessura, ultimo.comprimento);
  }

  return resultado;
}

export interface AlvoEdicaoParede {
  /** Chave do grupo de paredes ou da parede avulsa sendo editada */
  chave: string;
  /** Cantos no espaço do projeto (mundo), na ordem em que foram desenhados */
  pontos: Posicao[];
  fechado: boolean;
  altura: number;
  espessura: number;
}

/**
 * Descobre o que a ferramenta de paredes deve editar a partir do elemento selecionado: o grupo de
 * paredes que ele é ou está dentro (o construtor de paredes lembra os cantos originais), ou uma
 * parede avulsa (dois cantos: início e fim). Null se a seleção não é nada disso, e a ferramenta
 * então desenha do zero
 */
export function alvoEdicaoParede(elementos: Elementos, selecionada: string | null): AlvoEdicaoParede | null {
  const elemento = selecionada ? elementos[selecionada] : undefined;
  if (!elemento) return null;

  if (elemento.tipo === 'grupo' && elemento.verticesParede) {
    const primeira = Object.values(elementos).find((e) => e.pai === elemento.chave && e.tipo === 'parede');
    if (!primeira?.parede) return null;
    const matriz = matrizNoMundo(elementos, elemento.chave);
    return {
      chave: elemento.chave,
      pontos: elemento.verticesParede.map((v) => {
        const p = new Vector3(v.x, v.y, 0).applyMatrix4(matriz);
        return { x: p.x, y: p.y, z: 0 };
      }),
      fechado: elemento.verticesParedeFechado ?? false,
      altura: primeira.parede.altura,
      espessura: primeira.parede.espessura,
    };
  }

  if (elemento.tipo === 'parede' && elemento.parede) {
    const elementoPai = elemento.pai ? elementos[elemento.pai] : undefined;
    if (elementoPai?.tipo === 'grupo' && elementoPai.verticesParede) return alvoEdicaoParede(elementos, elemento.pai);

    const matriz = matrizNoMundo(elementos, elemento.chave);
    const inicio = new Vector3(0, 0, 0).applyMatrix4(matriz);
    const fim = new Vector3(elemento.parede.comprimento, 0, 0).applyMatrix4(matriz);
    return {
      chave: elemento.chave,
      pontos: [
        { x: inicio.x, y: inicio.y, z: 0 },
        { x: fim.x, y: fim.y, z: 0 },
      ],
      fechado: false,
      altura: elemento.parede.altura,
      espessura: elemento.parede.espessura,
    };
  }

  return null;
}

// Grupos salvos antes de terem medidas próprias recebem uma única vez o tamanho do conteúdo,
// com a origem no canto dele (sem mudar nada de lugar); dos mais internos para os mais externos
function completarTamanhos(arvore: Arvore): Elementos {
  const elementos = { ...arvore.elementos };
  const grupos = ordemNaArvore(arvore.filhos)
    .filter((chave) => elementos[chave].tipo === 'grupo' && !elementos[chave].tamanho)
    .reverse();

  for (const grupo of grupos) {
    const conteudo = limitesConteudo({ elementos, filhos: arvore.filhos }, grupo);
    if (!conteudo) {
      elementos[grupo] = { ...elementos[grupo], tamanho: TAMANHO_PADRAO_GRUPO };
      continue;
    }
    for (const filho of arvore.filhos[grupo] ?? []) {
      elementos[filho] = {
        ...elementos[filho],
        posicao: arredondarPosicao(subtrair(elementos[filho].posicao, conteudo.min)),
      };
    }
    elementos[grupo] = {
      ...elementos[grupo],
      posicao: arredondarPosicao(somar(elementos[grupo].posicao, conteudo.min)),
      tamanho: tamanhoDaCaixa(conteudo),
    };
  }

  return elementos;
}

// Medidas de uma caixa envolvente, com no mínimo 1 mm em cada eixo
function tamanhoDaCaixa({ min, max }: Limites): Posicao {
  const t = subtrair(max, min);
  return arredondarPosicao({ x: Math.max(t.x, 1), y: Math.max(t.y, 1), z: Math.max(t.z, 1) });
}

/**
 * Elementos com o conteúdo do grupo escalado para o novo tamanho (a partir da origem do grupo),
 * ou null se alguma peça ficaria com medidas ou posição fora dos limites
 */
export function escalarGrupo(arvore: Arvore, chave: string, tamanho: Posicao): Elementos | null {
  const grupo = arvore.elementos[chave];
  if (!grupo?.tamanho || !tamanhoValido(tamanho)) return null;

  const atual = grupo.tamanho;
  const fatorGrupo = { x: tamanho.x / atual.x, y: tamanho.y / atual.y, z: tamanho.z / atual.z };
  const escalar = (v: Posicao, fator: Posicao) =>
    arredondarPosicao({ x: v.x * fator.x, y: v.y * fator.y, z: v.z * fator.z });

  const elementos = { ...arvore.elementos, [chave]: { ...grupo, tamanho: arredondarPosicao(tamanho) } };
  // `fator` está nos eixos do grupo `pai`; um filho girado recebe o fator nos eixos próprios
  // (numa peça girada 90° em Y, a largura do grupo escala a profundidade dela)
  const escalarConteudo = (pai: string, fator: Posicao) => {
    for (const filho of arvore.filhos[pai] ?? []) {
      const elemento = elementos[filho];
      const fatorProprio = fatorNosEixosProprios(fator, elemento.rotacao);
      elementos[filho] = {
        ...elemento,
        posicao: escalar(elemento.posicao, fator),
        tamanho: elemento.tamanho && escalar(elemento.tamanho, fatorProprio),
        forma: elemento.forma && {
          tipo: elemento.forma.tipo,
          parametros: FORMAS[elemento.forma.tipo].escalar(elemento.forma.parametros, fatorProprio),
        },
        parede: elemento.parede && {
          comprimento: arredondar(elemento.parede.comprimento * fatorProprio.x),
          altura: arredondar(elemento.parede.altura * fatorProprio.z),
          espessura: arredondar(elemento.parede.espessura * fatorProprio.y),
        },
        // Vão: posicao (deslocamento/peitoril) já escala genericamente acima; só largura/altura
        // precisam do fator próprio, como o tamanho de um grupo
        abertura: elemento.abertura && {
          ...elemento.abertura,
          largura: arredondar(elemento.abertura.largura * fatorProprio.x),
          altura: arredondar(elemento.abertura.altura * fatorProprio.z),
        },
        piso: elemento.piso && {
          vertices: elemento.piso.vertices.map((v) => ({
            x: arredondar(v.x * fatorProprio.x),
            y: arredondar(v.y * fatorProprio.y),
            z: 0,
          })),
          espessura: arredondar(elemento.piso.espessura * fatorProprio.z),
        },
      };
      // Campos travados voltam ao valor de antes; e um tamanho travado num eixo não escala o
      // conteúdo naquele eixo (os filhos ficam como estavam)
      const travados = elemento.travados;
      let fatorFilhos = fatorProprio;
      if (travados?.length) {
        const campos = camposEnderecaveisDoElemento(elemento);
        for (const campo of travados) {
          const enderecavel = campos[campo];
          if (enderecavel) elementos[filho] = enderecavel.definir(elementos[filho], enderecavel.obter(elemento));
        }
        fatorFilhos = {
          x: travados.includes('largura') ? 1 : fatorProprio.x,
          y: travados.includes('profundidade') ? 1 : fatorProprio.y,
          z: travados.includes('altura') ? 1 : fatorProprio.z,
        };
      }
      // Grupo e peça recorrem no próprio conteúdo; parede, nos vãos dela (únicos filhos possíveis)
      if (elemento.tipo === 'grupo' || elemento.tipo === 'parede' || elemento.tipo === 'peca') escalarConteudo(filho, fatorFilhos);
    }
  };
  escalarConteudo(chave, fatorGrupo);

  const todosValidos = [chave, ...ordemNaArvore(arvore.filhos, chave)].every((c) => {
    const elemento = elementos[c];
    const paredePai = elemento.pai ? elementos[elemento.pai]?.parede : undefined;
    return elementoValido(elemento, paredePai);
  });
  return todosValidos ? elementos : null;
}

// Primeiro x livre à direita dos elementos de `pai`, ou null se não houver nenhum
function bordaDireita(arvore: Arvore, pai: string | null): number | null {
  const direitas = (arvore.filhos[listaDe(pai)] ?? [])
    .map((chave) => limites(arvore, chave))
    .filter((l) => l !== null)
    .map((l) => l.max.x);
  return direitas.length > 0 ? Math.max(...direitas) + ESPACO_ENTRE_ELEMENTOS : null;
}

// Como no SketchUp: fecha os grupos que não contêm a peça clicada e devolve
// o elemento do contexto que a contém
function resolverClique(state: EditorState, chavePeca: string) {
  let contexto = state.contexto;
  while (contexto !== null && !estaDentro(state.elementos, chavePeca, contexto)) {
    contexto = state.elementos[contexto]?.pai ?? null;
  }
  let chave = chavePeca;
  while (state.elementos[chave].pai !== contexto) {
    chave = state.elementos[chave].pai as string;
  }
  return { contexto, chave };
}

/** A seleção inteira (a primária mais as extras do Ctrl/Cmd+Click), na ordem em que entraram */
export function selecaoCompleta(state: { selecionada: string | null; selecionadasExtra: string[] }): string[] {
  return state.selecionada === null ? [] : [state.selecionada, ...state.selecionadasExtra];
}

// Sempre 7 dígitos (1000000..9999999): improvável colidir, mas confere contra os já usados no
// projeto mesmo assim, pra nunca repetir um código de verdade
function gerarCodigoUnico(usados: Set<string>): string {
  let codigo: string;
  do {
    codigo = String(1_000_000 + Math.floor(Math.random() * 9_000_000));
  } while (usados.has(codigo));
  return codigo;
}

const PADRAO_ID_SEQUENCIAL = /^M-(\d+)$/;

// Continua depois do maior número "M-" já usado no projeto inteiro (nunca reaproveita um número,
// mesmo que o módulo com ele tenha sido removido depois)
function proximoNumeroSequencial(elementos: Elementos): number {
  let maior = 0;
  for (const elemento of Object.values(elementos)) {
    const encontrado = elemento.idSequencial?.match(PADRAO_ID_SEQUENCIAL);
    if (encontrado) maior = Math.max(maior, Number(encontrado[1]));
  }
  return maior + 1;
}

function inserir(state: EditorState, elemento: ElementoEditor) {
  const lista = listaDe(elemento.pai);
  return {
    elementos: { ...state.elementos, [elemento.chave]: elemento },
    filhos: {
      ...state.filhos,
      [lista]: [...(state.filhos[lista] ?? []), elemento.chave],
      ...(elemento.tipo === 'grupo' || elemento.tipo === 'parede' || elemento.tipo === 'peca' ? { [elemento.chave]: [] } : {}),
    },
    selecionada: elemento.chave,
    alterado: true,
  };
}

// O teto de elementos só vale pra módulo (ver Formas.MaximoElementos no backend, que checa de novo
// na hora de salvar): um projeto pode ter vindo de uma importação de .glb bem maior que isso, e o
// backend não tem mais teto nenhum pra ele (ver ProjetosController.SalvarElementos)
const noLimite = (state: EditorState, novos = 1) =>
  state.moduloId !== null && Object.keys(state.elementos).length + novos > MAXIMO_ELEMENTOS;

// Mesmo guard por trás do botão (escondido sem a permissão, ver os componentes do editor) e do
// atalho de teclado correspondente (ProjetoEditor.tsx): os dois chamam a mesma action daqui, então
// um guard só aqui cobre os dois caminhos de disparo
const temPermissaoAtual = (chave: PermissaoChave) => temPermissao(useAuthStore.getState().usuario, chave);

const proximoNomeGrupo = (elementos: Elementos) =>
  `Grupo ${Object.values(elementos).filter((e) => e.tipo === 'grupo').length + 1}`;

const proximoNomeGrupoParedes = (elementos: Elementos) =>
  `Paredes ${Object.values(elementos).filter((e) => e.tipo === 'grupo' && /^Paredes \d+$/.test(e.nome)).length + 1}`;

const proximoNomePiso = (elementos: Elementos) =>
  `Piso ${Object.values(elementos).filter((e) => e.tipo === 'piso').length + 1}`;

const NOME_TIPO_ABERTURA: Record<TipoAbertura, string> = { porta: 'Porta', janela: 'Janela' };

const proximoNomeAbertura = (elementos: Elementos, tipo: TipoAbertura) =>
  `${NOME_TIPO_ABERTURA[tipo]} ${Object.values(elementos).filter((e) => e.abertura?.tipo === tipo).length + 1}`;

/** Total de nós na subárvore de um módulo (o próprio elemento + todos os descendentes) */
function contarElementoModulo(dados: ElementoModulo): number {
  return 1 + (dados.filhos ?? []).reduce((soma, filho) => soma + contarElementoModulo(filho), 0);
}

/** Converte a árvore de um módulo (como a API devolve) em entradas de `elementos`/`filhos`, cada
 * uma com chave nova — nunca reaproveita as chaves/ids do módulo original, que é sempre uma cópia
 * independente. Usada tanto pra importar um módulo num grupo/peça quanto pra abri-lo no editor
 * pra editar. Devolve a chave da raiz e MUTA os `elementos`/`filhos` recebidos.
 *
 * `idsUnicosDoDestino`: só ao IMPORTAR (não ao abrir o módulo pra editar), o conjunto de idUnico
 * já usados no projeto/módulo de destino. Presente, cada idUnico do módulo é regenerado contra
 * esse conjunto (nunca reaproveita o mesmo código em dois lugares) e o idSequencial é descartado
 * (é um número de ordem do projeto de origem, não faz sentido carregar pra outro)
 */
function converterElementoModulo(
  elementos: Elementos,
  filhos: Arvore['filhos'],
  dados: ElementoModulo,
  paiChave: string | null,
  idsUnicosDoDestino?: Set<string>,
): string {
  const chave = chaveNova();
  let idUnico = dados.idUnico ?? undefined;
  if (idsUnicosDoDestino && idUnico) {
    idUnico = gerarCodigoUnico(idsUnicosDoDestino);
    idsUnicosDoDestino.add(idUnico);
  }
  elementos[chave] = {
    chave,
    id: undefined,
    tipo: dados.tipo,
    nome: dados.nome,
    pai: paiChave,
    posicao: dados.posicao,
    rotacao: dados.rotacao ?? SEM_ROTACAO,
    colisao: dados.colisao,
    visivel: dados.visivel,
    forma: dados.forma
      ? { tipo: dados.forma.tipo, parametros: completarParametros(dados.forma.tipo, dados.forma.parametros) }
      : undefined,
    modelo3d: dados.modelo3d ?? undefined,
    modelo3dNo: dados.modelo3dNo ?? undefined,
    tamanho: dados.tamanho ?? undefined,
    parede: dados.parede ?? undefined,
    piso: dados.piso ?? undefined,
    abertura: dados.abertura ?? undefined,
    formulas: dados.formulas ?? undefined,
    variaveisFormulas: dados.variaveisFormulas ?? undefined,
    variaveisPorFaceFormulas: dados.variaveisPorFaceFormulas ?? undefined,
    travados: dados.travados ?? undefined,
    texturas: dados.texturas ?? undefined,
    gruposDeFace: dados.gruposDeFace ?? undefined,
    referenciaEstavel: dados.referenciaEstavel ?? undefined,
    idUnico,
    idSequencial: idsUnicosDoDestino ? undefined : (dados.idSequencial ?? undefined),
    verticesParede: dados.verticesParede ?? undefined,
    verticesParedeFechado: dados.verticesParedeFechado ?? undefined,
  };
  if (dados.tipo === 'grupo' || dados.tipo === 'parede' || dados.tipo === 'peca') {
    filhos[chave] = (dados.filhos ?? []).map((filho) =>
      converterElementoModulo(elementos, filhos, filho, chave, idsUnicosDoDestino),
    );
  }
  return chave;
}

// Espessura padrão do piso criado ao fechar um contorno de paredes, como uma laje fina
const PISO_ESPESSURA_PADRAO = 100;

/**
 * Cria (ou atualiza, reaproveitando nome/colisão/espessura) o piso que preenche a área interna de
 * um contorno de paredes fechado. A origem do piso já é o topo dele: a espessura desce a partir
 * daí, então mobília colocada em z=0 do grupo fica apoiada em cima do piso, não afundada nele
 */
function construirPiso(
  chaveGrupo: string,
  pontos: Posicao[],
  origem: Posicao,
  elementos: Elementos,
  pisoExistente: ElementoEditor | undefined,
): ElementoEditor {
  const espessura = pisoExistente?.piso?.espessura ?? PISO_ESPESSURA_PADRAO;
  return {
    // Preserva tudo que não muda de um piso já existente (nome, colisão, fórmulas, variáveis
    // customizadas...), só a posição e o polígono de verdade precisam ser recalculados
    ...pisoExistente,
    chave: pisoExistente?.chave ?? chaveNova(),
    tipo: 'piso',
    nome: pisoExistente?.nome ?? proximoNomePiso(elementos),
    pai: chaveGrupo,
    posicao: { x: 0, y: 0, z: -espessura },
    rotacao: SEM_ROTACAO,
    colisao: pisoExistente?.colisao ?? true,
    visivel: pisoExistente?.visivel ?? true,
    piso: { vertices: pontos.map((p) => subtrair(p, origem)), espessura },
  };
}

// Como no SketchUp: um campo "endereçável" pode ser lido (por um filho, via Parent!nome) e escrito
// (pelo recálculo, quando tem fórmula). `emGraus` marca os campos de rotação, cuja unidade
// guardada já é a mostrada; os demais são comprimentos, guardados em mm mas expostos em cm nas
// fórmulas (a mesma unidade mostrada no campo)
interface CampoEnderecavel {
  emGraus: boolean;
  obter: (elemento: ElementoEditor) => number;
  definir: (elemento: ElementoEditor, valorBruto: number) => ElementoEditor;
}

/** Campos numéricos deste elemento que podem ter fórmula ou ser referenciados por um filho */
function camposEnderecaveisDoElemento(elemento: ElementoEditor): Record<string, CampoEnderecavel> {
  const campos: Record<string, CampoEnderecavel> = {
    posicaoX: { emGraus: false, obter: (e) => e.posicao.x, definir: (e, v) => ({ ...e, posicao: { ...e.posicao, x: v } }) },
    posicaoY: { emGraus: false, obter: (e) => e.posicao.y, definir: (e, v) => ({ ...e, posicao: { ...e.posicao, y: v } }) },
    posicaoZ: { emGraus: false, obter: (e) => e.posicao.z, definir: (e, v) => ({ ...e, posicao: { ...e.posicao, z: v } }) },
    rotacaoX: { emGraus: true, obter: (e) => e.rotacao.x, definir: (e, v) => ({ ...e, rotacao: { ...e.rotacao, x: v } }) },
    rotacaoY: { emGraus: true, obter: (e) => e.rotacao.y, definir: (e, v) => ({ ...e, rotacao: { ...e.rotacao, y: v } }) },
    rotacaoZ: { emGraus: true, obter: (e) => e.rotacao.z, definir: (e, v) => ({ ...e, rotacao: { ...e.rotacao, z: v } }) },
  };

  if (elemento.forma) {
    for (const { chave } of FORMAS[elemento.forma.tipo].parametros) {
      campos[chave] = {
        emGraus: false,
        obter: (e) => e.forma!.parametros[chave],
        definir: (e, v) => ({ ...e, forma: { ...e.forma!, parametros: { ...e.forma!.parametros, [chave]: v } } }),
      };
    }
  }

  if (elemento.parede) {
    (['comprimento', 'altura', 'espessura'] as const).forEach((chave) => {
      campos[chave] = {
        emGraus: false,
        obter: (e) => e.parede![chave],
        definir: (e, v) => ({ ...e, parede: { ...e.parede!, [chave]: v } }),
      };
    });
  }

  if (elemento.piso) {
    campos.espessura = {
      emGraus: false,
      obter: (e) => e.piso!.espessura,
      definir: (e, v) => ({ ...e, piso: { ...e.piso!, espessura: v } }),
    };
  }

  if (elemento.tamanho) {
    campos.largura = { emGraus: false, obter: (e) => e.tamanho!.x, definir: (e, v) => ({ ...e, tamanho: { ...e.tamanho!, x: v } }) };
    campos.altura = { emGraus: false, obter: (e) => e.tamanho!.z, definir: (e, v) => ({ ...e, tamanho: { ...e.tamanho!, z: v } }) };
    campos.profundidade = {
      emGraus: false,
      obter: (e) => e.tamanho!.y,
      definir: (e, v) => ({ ...e, tamanho: { ...e.tamanho!, y: v } }),
    };
  }

  if (elemento.abertura) {
    campos.largura = { emGraus: false, obter: (e) => e.abertura!.largura, definir: (e, v) => ({ ...e, abertura: { ...e.abertura!, largura: v } }) };
    campos.altura = { emGraus: false, obter: (e) => e.abertura!.altura, definir: (e, v) => ({ ...e, abertura: { ...e.abertura!, altura: v } }) };
  }

  return campos;
}

// Tamanho do elemento nos próprios eixos (sem posição nem rotação aplicadas), na convenção
// "LenX/LenY/LenZ" dos componentes dinâmicos do SketchUp: funciona pra QUALQUER elemento (peça de
// qualquer forma, parede ou grupo), ao contrário de "largura"/"diametro"/etc., que só existem no
// tipo específico. Só leitura: não faz sentido escrever "a largura" de um jeito genérico quando
// cada forma guarda essa medida à sua própria maneira (ex.: um cilindro usa o mesmo diâmetro em X
// e Y) — pra isso o próprio campo (Parent!largura, Parent!diametro...) já resolve
export function tamanhoLocalDoElemento(elemento: ElementoEditor): Posicao | null {
  if (elemento.forma) {
    const { tipo, parametros } = elemento.forma;
    return parametrosValidos(tipo, parametros) ? FORMAS[tipo].tamanho(parametros) : null;
  }
  if (elemento.parede) {
    return paredeValida(elemento.parede)
      ? { x: elemento.parede.comprimento, y: elemento.parede.espessura, z: elemento.parede.altura }
      : null;
  }
  if (elemento.piso) {
    if (!pisoValido(elemento.piso)) return null;
    const { vertices, espessura } = elemento.piso;
    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    return { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys), z: espessura };
  }
  if (elemento.tamanho) {
    return tamanhoValido(elemento.tamanho) ? elemento.tamanho : null;
  }
  if (elemento.abertura) {
    return { x: elemento.abertura.largura, y: 0, z: elemento.abertura.altura };
  }
  return null;
}

/**
 * Deslocamento (na Vista Explodida) de um filho direto de `chaveGrupo`: afasta o filho do centro
 * do grupo, na mesma direção em que ele já está (como o SketchUp "explode" um componente/grupo em
 * cantos/prateleiras separados pra visualização, sem mudar a árvore nem a posição salva). Filho
 * exatamente no centro (raro; ex.: único filho do grupo) recebe um deslocamento padrão pra cima
 */
export function deslocamentoExplosao(
  elementos: Record<string, ElementoEditor>,
  chaveGrupo: string,
  chaveFilho: string,
  distancia: number,
): Posicao {
  const grupo = elementos[chaveGrupo];
  const filho = elementos[chaveFilho];
  if (!grupo || !filho || distancia <= 0) return ORIGEM;
  if (!posicaoValida(filho.posicao) || !Object.values(filho.rotacao).every(Number.isFinite)) return ORIGEM;

  const limitesGrupo = limitesLocais(grupo);
  const limitesFilho = limitesLocais(filho);
  if (!limitesGrupo || !limitesFilho) return ORIGEM;

  const centroGrupo = {
    x: (limitesGrupo.min.x + limitesGrupo.max.x) / 2,
    y: (limitesGrupo.min.y + limitesGrupo.max.y) / 2,
    z: (limitesGrupo.min.z + limitesGrupo.max.z) / 2,
  };
  // Caixa do filho já girada e posicionada no referencial do grupo (não no do pai do grupo): o
  // centro dela é o ponto certo mesmo quando o filho está rotacionado, como uma lateral de
  // armário (uma caixa girada 90°) — usar só posição + metade do tamanho local ignoraria a
  // rotação e "explodiria" na direção errada
  const caixaFilho = envolverCaixa(limitesFilho.min, limitesFilho.max, filho.posicao, filho.rotacao);
  const centroFilho = {
    x: (caixaFilho.min.x + caixaFilho.max.x) / 2,
    y: (caixaFilho.min.y + caixaFilho.max.y) / 2,
    z: (caixaFilho.min.z + caixaFilho.max.z) / 2,
  };

  const direcao = subtrair(centroFilho, centroGrupo);
  const comprimento = Math.hypot(direcao.x, direcao.y, direcao.z);
  // Sem direção clara (centros coincidem): explode pra cima por padrão — "cima" é Z agora
  const unitario = comprimento > 1e-6 ? { x: direcao.x / comprimento, y: direcao.y / comprimento, z: direcao.z / comprimento } : { x: 0, y: 0, z: 1 };

  return { x: unitario.x * distancia, y: unitario.y * distancia, z: unitario.z * distancia };
}

// Cada nível abaixo do primeiro se afasta um pouco menos que o de cima (o deslocamento de um nível
// soma com o de todos os ancestrais, já que os contêineres são aninhados na cena)
const FATOR_EXPLOSAO_POR_NIVEL = 0.6;

/**
 * Deslocamento (na Vista Explodida) de qualquer descendente de `chaveExplodido`, em qualquer nível:
 * cada elemento se afasta do centro do próprio pai, e como ele já anda junto com o pai, o resultado
 * é uma explosão em camadas (grupo → subgrupos → peças). Devolve null se o elemento não estiver
 * dentro do grupo explodido (nem for ele mesmo, que não se move)
 */
export function deslocamentoExplosaoRecursivo(
  elementos: Record<string, ElementoEditor>,
  chaveExplodido: string,
  chaveElemento: string,
  distancia: number,
): Posicao | null {
  const pai = elementos[chaveElemento]?.pai;
  if (pai === null || pai === undefined || !estaDentro(elementos, pai, chaveExplodido)) return null;
  // Nível 1 = filho direto do grupo explodido
  const nivel = ancestrais(elementos, chaveElemento).indexOf(chaveExplodido) + 1;
  return deslocamentoExplosao(elementos, pai, chaveElemento, distancia * FATOR_EXPLOSAO_POR_NIVEL ** (nivel - 1));
}

const NOMES_LEN: Record<string, keyof Posicao> = { lenx: 'x', leny: 'y', lenz: 'z' };

/** Nome de variável customizada válido: identificador simples, dentro do tamanho aceito pela API
 * (Formas.NomeVariavelComprimentoMaximo) e sem colidir com um campo já endereçável do elemento
 * (senão a referência via Parent! ficaria ambígua) */
export function nomeDeVariavelValido(elemento: ElementoEditor, nome: string): boolean {
  return (
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome) &&
    nome.length <= TAMANHO_NOME_VARIAVEL &&
    !(nome in camposEnderecaveisDoElemento(elemento))
  );
}

/** Nome de variável global válido: um identificador simples dentro do tamanho aceito pela API
 * (sem restrição de campos, já que uma variável global não pertence a nenhum elemento) */
export function nomeDeVariavelGlobalValido(nome: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome) && nome.length <= TAMANHO_NOME_VARIAVEL;
}

// "Global!" (uma variável do projeto, ver EditorState.variaveisGlobais) ou zero-ou-mais
// referências "Parent!" seguidas de um identificador (campo ou variável customizada); sem nenhum
// prefixo, o identificador refere o próprio elemento (self-reference). "Gl!" e "Pr!" são atalhos
// aceitos no lugar de "Global!"/"Parent!" (ex.: "Pr!Pr!altura" == "Parent!Parent!altura"), e
// "Parent!*N"/"Pr!*N" repete o prefixo N vezes de uma vez (ex.: "Pr!*3altura" == "Pr!Pr!Pr!altura")
// — os dois estilos podem aparecer misturados ("Parent!Pr!*2altura" sobe 3 níveis). Case-insensitive
// nas palavras "Global"/"Parent"/"Gl"/"Pr"
const REFERENCIA_PAI = /(global!|gl!|(?:(?:parent!|pr!)(?:\*\d+)?)*)([a-zA-Z_][a-zA-Z0-9_]*)/gi;
// Soma quantos níveis um prefixo já em minúsculas sobe: cada "Parent!"/"Pr!" vale 1, ou o número
// depois do "*" quando tem um (ver REFERENCIA_PAI) — não dá pra usar String.split com um separador
// só porque os dois estilos podem aparecer misturados no mesmo prefixo
const TOKEN_PARENT_OU_PR = /(?:parent!|pr!)(?:\*(\d+))?/g;
function contarNiveisPai(prefixo: string): number {
  let niveis = 0;
  for (const [, multiplicador] of prefixo.matchAll(TOKEN_PARENT_OU_PR)) niveis += multiplicador ? Number(multiplicador) : 1;
  return niveis;
}

/**
 * Resolve o texto digitado num campo: uma conta comum ("60+1,8") ou, como nos componentes
 * dinâmicos do SketchUp, uma fórmula com referências ao próprio elemento ("largura/2"), a algum
 * ancestral ("Parent!largura/2", "Parent!Parent!altura") ou a uma variável global do projeto
 * ("Global!alturaPadrao"). `formula` diz se havia alguma referência, pra quem chama decidir se
 * guarda o texto como fórmula viva ou só o número resolvido. `campoIgnorado` é o próprio campo (ou
 * variável) sendo calculado agora: uma self-reference a ele mesmo (ex.: o campo "largura" com
 * fórmula "largura*2") recalcularia um valor diferente a cada vez que qualquer coisa no projeto
 * mudasse, crescendo (ou encolhendo) sem parar — em vez disso conta como referência inválida, como
 * um erro de referência circular numa planilha
 */
export function resolverFormulaOuNumero(
  texto: string,
  elementos: Elementos,
  propria: string,
  campoIgnorado?: string,
  variaveisGlobais?: Record<string, number>,
): { valor: number; formula: boolean } | null {
  let temReferencia = false;
  let falhou = false;

  const substituido = texto.replace(REFERENCIA_PAI, (_correspondencia, prefixo: string, identificador: string) => {
    temReferencia = true;
    const prefixoMinusculo = prefixo.toLowerCase();
    if (prefixoMinusculo === 'global!' || prefixoMinusculo === 'gl!') {
      if (variaveisGlobais && identificador in variaveisGlobais) return String(variaveisGlobais[identificador]);
      falhou = true;
      return '0';
    }
    const niveis = contarNiveisPai(prefixoMinusculo);
    // Sem "Parent!" (niveis 0): refere o próprio elemento, não o pai dele
    let atual: string | null = niveis === 0 ? propria : (elementos[propria]?.pai ?? null);
    for (let i = 1; i < niveis && atual !== null; i++) {
      atual = elementos[atual]?.pai ?? null;
    }
    if (niveis === 0 && identificador === campoIgnorado) {
      falhou = true;
      return '0';
    }
    const elementoAlvo = atual !== null ? elementos[atual] : undefined;
    if (!elementoAlvo) {
      falhou = true;
      return '0';
    }

    const campo = camposEnderecaveisDoElemento(elementoAlvo)[identificador];
    if (campo) {
      const bruto = campo.obter(elementoAlvo);
      return String(campo.emGraus ? bruto : mmParaCm(bruto));
    }
    if (elementoAlvo.variaveis && identificador in elementoAlvo.variaveis) {
      return String(elementoAlvo.variaveis[identificador]);
    }
    // LenX/LenY/LenZ (como no SketchUp): o tamanho do elemento, de qualquer tipo que ele seja
    const eixoLen = NOMES_LEN[identificador.toLowerCase()];
    if (eixoLen) {
      const tamanhoLocal = tamanhoLocalDoElemento(elementoAlvo);
      if (tamanhoLocal) return String(mmParaCm(tamanhoLocal[eixoLen]));
    }
    falhou = true;
    return '0';
  });

  if (!temReferencia) {
    const valor = avaliarExpressao(texto);
    return valor === null ? null : { valor, formula: false };
  }
  if (falhou) return null;
  const valor = avaliarExpressao(substituido);
  return valor === null ? null : { valor, formula: true };
}

// Recalcula variáveis e campos com fórmula de um elemento (as variáveis primeiro, já que os
// campos podem referenciá-las); mantém o último valor válido e marca erro quando uma fórmula não
// resolve (pai removido, variável apagada, sintaxe inválida)
function recalcularElemento(elementos: Elementos, elemento: ElementoEditor, variaveisGlobais: Record<string, number>): ElementoEditor {
  let resultado = elemento;
  let erros = elemento.errosFormula;

  const definirErro = (campo: string, mensagem: string | null) => {
    if (mensagem === null) {
      if (!erros || !(campo in erros)) return;
      erros = { ...erros };
      delete erros[campo];
    } else {
      if (erros?.[campo] === mensagem) return;
      erros = { ...erros, [campo]: mensagem };
    }
  };
  const MENSAGEM_ERRO = 'Não foi possível calcular esta fórmula';
  // Uma referência ao próprio elemento (sem Parent!) tem que enxergar o que já foi recalculado
  // nesta mesma passada (ex.: uma variável nova, usada por um campo dele), não a cópia antiga
  const comResultado = () => (resultado === elemento ? elementos : { ...elementos, [elemento.chave]: resultado });

  if (elemento.variaveisFormulas) {
    let variaveis = resultado.variaveis;
    for (const [nome, formula] of Object.entries(elemento.variaveisFormulas)) {
      const resolvido = resolverFormulaOuNumero(formula, comResultado(), elemento.chave, nome, variaveisGlobais);
      if (resolvido === null) {
        definirErro(`variavel:${nome}`, MENSAGEM_ERRO);
        continue;
      }
      definirErro(`variavel:${nome}`, null);
      if (variaveis?.[nome] !== resolvido.valor) variaveis = { ...variaveis, [nome]: resolvido.valor };
    }
    if (variaveis !== resultado.variaveis) resultado = { ...resultado, variaveis };
  }

  if (elemento.variaveisPorFaceFormulas) {
    let valoresPorFace = resultado.valoresPorFace;
    for (const [face, formulasDaFace] of Object.entries(elemento.variaveisPorFaceFormulas)) {
      let valoresDaFace = valoresPorFace?.[face];
      for (const [nome, formula] of Object.entries(formulasDaFace)) {
        const resolvido = resolverFormulaOuNumero(formula, comResultado(), elemento.chave, nome, variaveisGlobais);
        if (resolvido === null) {
          definirErro(`variavelFace:${face}:${nome}`, MENSAGEM_ERRO);
          continue;
        }
        definirErro(`variavelFace:${face}:${nome}`, null);
        if (valoresDaFace?.[nome] !== resolvido.valor) valoresDaFace = { ...valoresDaFace, [nome]: resolvido.valor };
      }
      if (valoresDaFace !== valoresPorFace?.[face]) valoresPorFace = { ...valoresPorFace, [face]: valoresDaFace ?? {} };
    }
    if (valoresPorFace !== resultado.valoresPorFace) resultado = { ...resultado, valoresPorFace };
  }

  if (elemento.formulas) {
    const campos = camposEnderecaveisDoElemento(resultado);
    for (const [campo, formula] of Object.entries(elemento.formulas)) {
      const enderecavel = campos[campo];
      if (!enderecavel) continue; // o campo não existe mais nesse elemento (ex.: forma trocada)

      const resolvido = resolverFormulaOuNumero(formula, comResultado(), elemento.chave, campo, variaveisGlobais);
      if (resolvido === null) {
        definirErro(campo, MENSAGEM_ERRO);
        continue;
      }
      definirErro(campo, null);
      const bruto = enderecavel.emGraus ? resolvido.valor : cmParaMm(resolvido.valor);
      if (Math.abs(enderecavel.obter(resultado) - bruto) > 1e-6) {
        resultado = enderecavel.definir(resultado, bruto);
      }
    }
  }

  if (erros !== resultado.errosFormula) resultado = { ...resultado, errosFormula: erros };
  return resultado;
}

const CAMPOS_TAMANHO_GRUPO = ['largura', 'altura', 'profundidade'] as const;
const tamanhosIguais = (a: Posicao, b: Posicao) =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;

// Recalcula a árvore inteira, dos pais para os filhos (um filho só referencia ancestrais, então
// nunca há ciclo): cada elemento já enxerga os valores atualizados de quem está acima dele
function recalcularFormulas(elementosOriginais: Elementos, filhos: Arvore['filhos'], variaveisGlobais: Record<string, number>): Elementos {
  let elementos = elementosOriginais;
  for (const chave of ordemNaArvore(filhos)) {
    const elemento = elementos[chave];
    if (!elemento || (!elemento.formulas && !elemento.variaveisFormulas && !elemento.variaveisPorFaceFormulas)) continue;
    const atualizado = recalcularElemento(elementos, elemento, variaveisGlobais);
    if (atualizado === elemento) continue;
    if (elementos === elementosOriginais) elementos = { ...elementos };

    // Tamanho de grupo mudado por fórmula (ex.: "Global!largura"): escala o conteúdo igual a um
    // redimensionamento manual (ver redimensionarGrupo/escalarGrupo), respeitando os campos
    // travados de cada filho — sem isso a fórmula só mudaria o número do grupo, sem as peças de
    // dentro acompanharem (trava existe justamente pra quem não quiser que uma medida acompanhe)
    if (atualizado.tipo === 'grupo' && atualizado.tamanho && elemento.tamanho && !tamanhosIguais(elemento.tamanho, atualizado.tamanho)) {
      const escalado = escalarGrupo({ elementos, filhos }, chave, atualizado.tamanho);
      if (escalado) {
        elementos = { ...escalado, [chave]: atualizado };
        continue;
      }
      // Não dá pra escalar (alguma peça ficaria fora dos limites): mantém o tamanho antigo e marca
      // erro nos campos de tamanho com fórmula, como uma fórmula que não resolveu
      const errosFormula = { ...atualizado.errosFormula };
      for (const campo of CAMPOS_TAMANHO_GRUPO) {
        if (elemento.formulas && campo in elemento.formulas) {
          errosFormula[campo] = 'Não foi possível redimensionar: alguma peça ficaria fora dos limites';
        }
      }
      elementos[chave] = { ...atualizado, tamanho: elemento.tamanho, errosFormula };
      continue;
    }

    elementos[chave] = atualizado;
  }
  return elementos;
}

const estadoInicial: Pick<
  EditorState,
  | 'projetoId'
  | 'moduloId'
  | 'planta'
  | 'variaveisGlobais'
  | 'elementos'
  | 'filhos'
  | 'selecionada'
  | 'selecionadasExtra'
  | 'contexto'
  | 'ferramenta'
  | 'explodido'
  | 'alterado'
  | 'historico'
> = {
  projetoId: null,
  moduloId: null,
  planta: null,
  variaveisGlobais: {},
  elementos: {},
  filhos: { [RAIZ]: [] },
  selecionada: null,
  selecionadasExtra: [],
  contexto: null,
  ferramenta: 'selecionar',
  explodido: null,
  alterado: false,
  historico: HISTORICO_VAZIO,
};

export const useEditorStore = create<EditorState>((setBruto, get) => {
  // Depois de toda alteração de elementos/filhos, recalcula fórmulas ao vivo (Parent!...) antes de
  // aplicar — na MESMA chamada de `set`, pra virar um único passo de desfazer, não dois. As ~20
  // ações abaixo continuam chamando `set(...)` normalmente: é a mesma variável, só que agora
  // apontando pra este envelope (sombreando o parâmetro do zustand, sem precisar renomear nada)
  const setBrutoQualquer = setBruto as (
    parcial: (state: EditorState) => Partial<EditorState>,
    substituir?: boolean,
  ) => void;
  const set = ((parcial: unknown, substituir?: boolean) => {
    setBrutoQualquer((state: EditorState) => {
      const atualizacaoBruta = (typeof parcial === 'function' ? (parcial as (s: EditorState) => Partial<EditorState>)(state) : parcial) as Partial<EditorState>;
      // Uma seleção simples nova sempre cancela uma seleção múltipla em andamento — quem quiser
      // preservá-la (só `alternarSelecaoMultipla`) já devolve `selecionadasExtra` explicitamente
      const atualizacao =
        'selecionada' in atualizacaoBruta && !('selecionadasExtra' in atualizacaoBruta)
          ? { ...atualizacaoBruta, selecionadasExtra: [] as string[] }
          : atualizacaoBruta;
      const elementosBase = atualizacao.elementos ?? state.elementos;
      const filhosBase = atualizacao.filhos ?? state.filhos;
      const variaveisGlobaisBase = atualizacao.variaveisGlobais ?? state.variaveisGlobais;
      if (
        elementosBase === state.elementos &&
        filhosBase === state.filhos &&
        variaveisGlobaisBase === state.variaveisGlobais
      ) {
        return atualizacao;
      }

      const recalculados = recalcularFormulas(elementosBase, filhosBase, variaveisGlobaisBase);
      return recalculados === elementosBase ? atualizacao : { ...atualizacao, elementos: recalculados };
    }, substituir);
  }) as typeof setBruto;

  return {
  ...estadoInicial,

  carregar: (projeto, manterSelecao = false) => {
    suprimirHistorico = true;
    set((state) => {
      // Após salvar, elementos novos ganham id (e chave nova); a ordem da árvore é a mesma,
      // então seleção e contexto seguem pela posição na árvore
      const ordemAnterior = ordemNaArvore(state.filhos);
      const indiceSelecionada = state.selecionada ? ordemAnterior.indexOf(state.selecionada) : -1;
      const indiceContexto = state.contexto ? ordemAnterior.indexOf(state.contexto) : -1;

      const elementos: Elementos = {};
      const filhos: Arvore['filhos'] = {};
      const incluir = (lista: Elemento[], pai: string | null) => {
        filhos[listaDe(pai)] = lista.map((elemento) => {
          const chave = `el-${elemento.id}`;
          elementos[chave] = {
            chave,
            id: elemento.id,
            tipo: elemento.tipo,
            nome: elemento.nome,
            pai,
            posicao: elemento.posicao,
            rotacao: elemento.rotacao ?? SEM_ROTACAO,
            colisao: elemento.colisao,
            visivel: elemento.visivel ?? true,
            forma: elemento.forma
              ? { tipo: elemento.forma.tipo, parametros: completarParametros(elemento.forma.tipo, elemento.forma.parametros) }
              : undefined,
            modelo3d: elemento.modelo3d ?? undefined,
            modelo3dNo: elemento.modelo3dNo ?? undefined,
            tamanho: elemento.tamanho ?? undefined,
            parede: elemento.parede ?? undefined,
            piso: elemento.piso ?? undefined,
            abertura: elemento.abertura ?? undefined,
            formulas: elemento.formulas ?? undefined,
            variaveisFormulas: elemento.variaveisFormulas ?? undefined,
            variaveisPorFaceFormulas: elemento.variaveisPorFaceFormulas ?? undefined,
            travados: elemento.travados ?? undefined,
            texturas: elemento.texturas ?? undefined,
            gruposDeFace: elemento.gruposDeFace ?? undefined,
            referenciaEstavel: elemento.referenciaEstavel ?? undefined,
            idUnico: elemento.idUnico ?? undefined,
            idSequencial: elemento.idSequencial ?? undefined,
            verticesParede: elemento.verticesParede ?? undefined,
            verticesParedeFechado: elemento.verticesParedeFechado ?? undefined,
          };
          if (elemento.tipo === 'grupo' || elemento.tipo === 'parede' || elemento.tipo === 'peca') incluir(elemento.filhos, chave);
          return chave;
        });
      };
      incluir(projeto.elementos, null);

      const ordem = ordemNaArvore(filhos);
      return {
        projetoId: projeto.id,
        moduloId: null,
        planta: projeto.planta,
        variaveisGlobais: projeto.variaveisGlobais ?? {},
        elementos: completarTamanhos({ elementos, filhos }),
        filhos,
        selecionada: manterSelecao ? (ordem[indiceSelecionada] ?? null) : null,
        contexto: manterSelecao ? (ordem[indiceContexto] ?? null) : null,
        alterado: false,
        // Recarregar o mesmo projeto (depois de salvar, para pegar os ids novos) preserva o
        // histórico; abrir um projeto diferente começa um histórico vazio
        historico: state.projetoId === projeto.id ? state.historico : HISTORICO_VAZIO,
      };
    });
    suprimirHistorico = false;
  },

  carregarModulo: (modulo, manterSelecao = false) => {
    suprimirHistorico = true;
    set((state) => {
      // Mesma lógica de `carregar`: depois de salvar, a seleção/contexto seguem pela posição na
      // árvore, já que a raiz do módulo ganha uma chave nova a cada carregamento
      const ordemAnterior = ordemNaArvore(state.filhos);
      const indiceSelecionada = state.selecionada ? ordemAnterior.indexOf(state.selecionada) : -1;
      const indiceContexto = state.contexto ? ordemAnterior.indexOf(state.contexto) : -1;

      const elementos: Elementos = {};
      const filhos: Arvore['filhos'] = {};
      const raiz = converterElementoModulo(elementos, filhos, modulo.elemento, null);
      filhos[RAIZ] = [raiz];

      const ordem = ordemNaArvore(filhos);
      return {
        projetoId: null,
        moduloId: modulo.id,
        planta: null,
        variaveisGlobais: {},
        elementos: completarTamanhos({ elementos, filhos }),
        filhos,
        selecionada: manterSelecao ? (ordem[indiceSelecionada] ?? null) : null,
        // Abre dentro do módulo por padrão (pra elementos novos nascerem lá, não como irmãos
        // soltos dele); só volta pra fora se a seleção mantida já estava mais funda que a raiz
        contexto: manterSelecao ? (ordem[indiceContexto] ?? raiz) : raiz,
        alterado: false,
        historico: state.moduloId === modulo.id ? state.historico : HISTORICO_VAZIO,
      };
    });
    suprimirHistorico = false;
  },

  limpar: () => {
    suprimirHistorico = true;
    set(estadoInicial);
    suprimirHistorico = false;
  },

  // Selecionar um elemento abre o grupo onde ele está, como no Outliner do SketchUp
  selecionar: (chave) =>
    set((state) =>
      chave === null
        ? { selecionada: null }
        : { selecionada: chave, contexto: state.elementos[chave]?.pai ?? null },
    ),

  selecionarPorPeca: (chavePeca) =>
    set((state) => {
      if (chavePeca === null || !state.elementos[chavePeca]) return { selecionada: null };
      const { contexto, chave } = resolverClique(state, chavePeca);
      return { contexto, selecionada: chave };
    }),

  alternarSelecaoMultipla: (chave, resolverPeloContexto = false) =>
    set((state) => {
      if (!state.elementos[chave]) return state;
      const alvo = resolverPeloContexto ? resolverClique(state, chave).chave : chave;
      if (!state.elementos[alvo]) return state;

      // Já era a seleção primária: sai da seleção, promovendo a próxima extra (se houver)
      if (state.selecionada === alvo) {
        const [novaPrimaria, ...resto] = state.selecionadasExtra;
        return { selecionada: novaPrimaria ?? null, selecionadasExtra: resto };
      }
      // Já era uma extra: só sai do conjunto, sem mexer na primária
      if (state.selecionadasExtra.includes(alvo)) {
        return { selecionadasExtra: state.selecionadasExtra.filter((c) => c !== alvo) };
      }
      // Ainda não estava selecionado: entra como primária (se não houver nenhuma) ou como extra
      return state.selecionada === null
        ? { selecionada: alvo, selecionadasExtra: [] }
        : { selecionadasExtra: [...state.selecionadasExtra, alvo] };
    }),

  abrirPorPeca: (chavePeca) =>
    set((state) => {
      if (!state.elementos[chavePeca]) return state;
      const { contexto, chave } = resolverClique(state, chavePeca);
      const tipoAberto = state.elementos[chave].tipo;
      return tipoAberto === 'grupo' || tipoAberto === 'peca'
        ? { contexto: chave, selecionada: null }
        : { contexto, selecionada: chave };
    }),

  abrirContexto: (chave) => set({ contexto: chave, selecionada: null }),

  // Sai do grupo aberto deixando-o selecionado
  sair: () =>
    set((state) =>
      state.contexto === null
        ? state
        : { contexto: state.elementos[state.contexto]?.pai ?? null, selecionada: state.contexto },
    ),

  definirFerramenta: (ferramenta) => {
    const chave = PERMISSAO_DA_FERRAMENTA[ferramenta];
    if (chave && !temPermissaoAtual(chave)) return;
    set({ ferramenta });
  },

  adicionarPeca: (tipo) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_CRIAR_FORMA) || noLimite(state)) return state;

      const pai = state.contexto;
      const quantidade = Object.values(state.elementos).filter((e) => e.forma?.tipo === tipo).length;
      return inserir(state, {
        chave: chaveNova(),
        tipo: 'peca',
        nome: `${FORMAS[tipo].nome} ${quantidade + 1}`,
        pai,
        // A origem é o canto, então a peça começa logo à direita dos irmãos
        posicao: { x: bordaDireita(state, pai) ?? 0, y: 0, z: 0 },
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: true,
        forma: { tipo, parametros: parametrosPadrao(tipo) },
      });
    }),

  adicionarGrupo: () =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_CRIAR_GRUPO) || noLimite(state)) return state;

      const pai = state.contexto;
      return inserir(state, {
        chave: chaveNova(),
        tipo: 'grupo',
        nome: proximoNomeGrupo(state.elementos),
        pai,
        posicao: { x: bordaDireita(state, pai) ?? 0, y: 0, z: 0 },
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: true,
        tamanho: TAMANHO_PADRAO_GRUPO,
      });
    }),

  adicionarParede: () =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_CRIAR_PAREDE) || noLimite(state)) return state;

      const pai = state.contexto;
      const quantidade = Object.values(state.elementos).filter((e) => e.tipo === 'parede').length;
      return inserir(state, {
        chave: chaveNova(),
        tipo: 'parede',
        nome: `Parede ${quantidade + 1}`,
        pai,
        posicao: { x: bordaDireita(state, pai) ?? 0, y: 0, z: 0 },
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: true,
        // Altura padrão usa o pé-direito da planta, quando há uma
        parede: { comprimento: 1000, altura: state.planta?.z ?? PE_DIREITO_PADRAO, espessura: 100 },
      });
    }),

  // As paredes desenhadas de uma vez nascem dentro de um grupo novo (o tamanho dele é a caixa que
  // envolve todas), pra poderem ser movidas e selecionadas juntas como o cômodo que formam
  adicionarParedes: (pontos, fechado, opcoes, engateInicio, engateFim) =>
    set((state) => {
      const segmentosBrutos = construirSegmentosParede(pontos, fechado, opcoes.espessura);
      const segmentos = fechado ? segmentosBrutos : aplicarEngatesNasPontas(segmentosBrutos, engateInicio, engateFim);
      if (segmentos.length === 0) return state;

      // Reserva 1 elemento para o grupo, e mais 1 pro piso quando o contorno fecha. Só truncado
      // dentro de um módulo (ver noLimite acima) — um projeto não tem teto de elementos
      let usados = segmentos;
      if (state.moduloId !== null) {
        const reserva = 1 + (fechado && pontos.length >= 3 ? 1 : 0);
        const espacoDisponivel = MAXIMO_ELEMENTOS - Object.keys(state.elementos).length - reserva;
        if (espacoDisponivel <= 0) return state;
        usados = segmentos.slice(0, espacoDisponivel);
      }

      const caixaConjunto = unir(
        usados.map((segmento) => limitesSegmentoParede(segmento, opcoes.espessura, opcoes.altura)),
      );
      if (!caixaConjunto) return state;
      const origem = caixaConjunto.min;

      const pai = state.contexto;
      const lista = listaDe(pai);
      const elementos = { ...state.elementos };
      const chaveGrupo = chaveNova();
      const chavesParedes: string[] = [];
      const quantidadeAtual = Object.values(state.elementos).filter((e) => e.tipo === 'parede').length;

      for (const segmento of usados) {
        const chave = chaveNova();
        chavesParedes.push(chave);
        elementos[chave] = {
          chave,
          tipo: 'parede',
          nome: `Parede ${quantidadeAtual + chavesParedes.length}`,
          pai: chaveGrupo,
          posicao: subtrair(segmento.posicao, origem),
          rotacao: { x: 0, y: 0, z: segmento.rotacaoZ },
          colisao: true,
          visivel: true,
          parede: { comprimento: segmento.comprimento, altura: opcoes.altura, espessura: opcoes.espessura },
        };
      }

      elementos[chaveGrupo] = {
        chave: chaveGrupo,
        tipo: 'grupo',
        nome: proximoNomeGrupoParedes(state.elementos),
        pai,
        posicao: origem,
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: true,
        tamanho: tamanhoDaCaixa(caixaConjunto),
        verticesParede: pontos.map((p) => subtrair(p, origem)),
        verticesParedeFechado: fechado,
      };

      // Contorno fechado: preenche a área interna com um piso, como um cômodo de verdade
      let filhosDoGrupo = chavesParedes;
      if (fechado && pontos.length >= 3) {
        const piso = construirPiso(chaveGrupo, pontos, origem, elementos, undefined);
        elementos[piso.chave] = piso;
        filhosDoGrupo = [...chavesParedes, piso.chave];
      }

      return {
        elementos,
        filhos: {
          ...state.filhos,
          [lista]: [...(state.filhos[lista] ?? []), chaveGrupo],
          [chaveGrupo]: filhosDoGrupo,
        },
        selecionada: chaveGrupo,
        alterado: true,
      };
    }),

  // Reconstrói o alvo (grupo ou parede avulsa) a partir de uma nova lista de cantos: mesma lógica
  // de `adicionarParedes`, mas reaproveitando o lugar do alvo na árvore (e a própria chave, quando
  // o resultado continua sendo do mesmo "formato") em vez de inserir algo novo
  atualizarParedes: (chaveAlvo, pontos, fechado, opcoes, engateInicio, engateFim) =>
    set((state) => {
      const alvo = state.elementos[chaveAlvo];
      if (!alvo) return state;

      const segmentosBrutos = construirSegmentosParede(pontos, fechado, opcoes.espessura);
      const segmentos = fechado ? segmentosBrutos : aplicarEngatesNasPontas(segmentosBrutos, engateInicio, engateFim);
      if (segmentos.length === 0) return state;

      // Um único segmento e o alvo já era uma parede avulsa: atualiza ela no próprio lugar,
      // preservando nome, colisão e qualquer fórmula/variável que tivesse
      if (segmentos.length === 1 && alvo.tipo === 'parede') {
        const [segmento] = segmentos;
        return {
          elementos: {
            ...state.elementos,
            [chaveAlvo]: {
              ...alvo,
              posicao: segmento.posicao,
              rotacao: { x: 0, y: 0, z: segmento.rotacaoZ },
              parede: { comprimento: segmento.comprimento, altura: opcoes.altura, espessura: opcoes.espessura },
            },
          },
          selecionada: chaveAlvo,
          alterado: true,
        };
      }

      const caixaConjunto = unir(
        segmentos.map((segmento) => limitesSegmentoParede(segmento, opcoes.espessura, opcoes.altura)),
      );
      if (!caixaConjunto) return state;
      const origem = caixaConjunto.min;

      const elementos = { ...state.elementos };
      const filhos = { ...state.filhos };

      // Um piso já existente é reaproveitado (mesmo nome/colisão/espessura), pra não recriar do
      // zero a cada edição — mas só continua existindo se o contorno seguir fechado
      const filhosAntigos = alvo.tipo === 'grupo' ? (state.filhos[chaveAlvo] ?? []) : [];
      const pisoExistente = filhosAntigos.map((c) => state.elementos[c]).find((e) => e.tipo === 'piso');

      // Só as paredes e o piso são refeitos a partir dos cantos. Tudo o mais que estiver dentro do
      // grupo (módulos, peças, outros grupos) continua no lugar, com o que tiver dentro; e cada
      // parede nova herda a antiga de mesmo índice (nome, textura e os vãos dela), em vez de
      // nascer vazia. Só some o que sobrar de paredes antigas (contorno com menos segmentos)
      const paredesAntigas = alvo.tipo === 'grupo'
        ? filhosAntigos.filter((c) => state.elementos[c].tipo === 'parede')
        : [chaveAlvo];
      const outros = filhosAntigos.filter((c) => state.elementos[c].tipo !== 'parede' && state.elementos[c].tipo !== 'piso');

      const chaveGrupo = alvo.tipo === 'grupo' ? chaveAlvo : chaveNova();
      if (pisoExistente) {
        delete elementos[pisoExistente.chave];
        delete filhos[pisoExistente.chave];
      }
      for (const sobra of paredesAntigas.slice(segmentos.length)) {
        for (const removido of [sobra, ...ordemNaArvore(state.filhos, sobra)]) {
          delete elementos[removido];
          delete filhos[removido];
        }
      }

      const quantidadeAtual = Object.values(elementos).filter((e) => e.tipo === 'parede').length;
      const chavesParedes: string[] = [];
      segmentos.forEach((segmento, indice) => {
        const antiga = paredesAntigas[indice];
        const chave = antiga ?? chaveNova();
        chavesParedes.push(chave);
        const parede = { comprimento: segmento.comprimento, altura: opcoes.altura, espessura: opcoes.espessura };
        elementos[chave] = {
          ...(antiga ? state.elementos[antiga] : {
            chave,
            tipo: 'parede' as const,
            nome: `Parede ${quantidadeAtual + chavesParedes.length}`,
            colisao: true,
            visivel: true,
          }),
          pai: chaveGrupo,
          posicao: subtrair(segmento.posicao, origem),
          rotacao: { x: 0, y: 0, z: segmento.rotacaoZ },
          parede,
        };
        // Os vãos da parede que ficou menor precisam continuar dentro dela
        for (const chaveVao of filhos[chave] ?? []) {
          const vao = elementos[chaveVao];
          if (!vao?.abertura) continue;
          elementos[chaveVao] = {
            ...vao,
            posicao: {
              ...vao.posicao,
              x: Math.max(0, Math.min(vao.posicao.x, parede.comprimento - vao.abertura.largura)),
              z: Math.max(0, Math.min(vao.posicao.z, parede.altura - vao.abertura.altura)),
            },
          };
        }
      });

      // A origem do grupo muda com os cantos: o que ficou dentro é deslocado ao contrário, pra não
      // sair do lugar no projeto
      const deslocamento = subtrair(alvo.posicao, origem);
      for (const chave of outros) {
        const e = elementos[chave];
        elementos[chave] = {
          ...e,
          posicao: { x: e.posicao.x + deslocamento.x, y: e.posicao.y + deslocamento.y, z: e.posicao.z + deslocamento.z },
        };
      }

      elementos[chaveGrupo] = {
        ...(alvo.tipo === 'grupo' ? alvo : {}),
        chave: chaveGrupo,
        tipo: 'grupo',
        nome: alvo.tipo === 'grupo' ? alvo.nome : proximoNomeGrupoParedes(elementos),
        pai: alvo.pai,
        posicao: origem,
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: alvo.visivel ?? true,
        tamanho: tamanhoDaCaixa(caixaConjunto),
        verticesParede: pontos.map((p) => subtrair(p, origem)),
        verticesParedeFechado: fechado,
      };
      let filhosDoGrupo = chavesParedes;
      if (fechado && pontos.length >= 3) {
        const piso = construirPiso(chaveGrupo, pontos, origem, elementos, pisoExistente);
        elementos[piso.chave] = piso;
        filhosDoGrupo = [...chavesParedes, piso.chave];
      }
      filhos[chaveGrupo] = [...filhosDoGrupo, ...outros];

      if (alvo.tipo === 'parede') {
        // Promovendo uma parede avulsa pra grupo: troca a entrada dela pela do grupo, no mesmo
        // lugar da lista do pai
        const lista = listaDe(alvo.pai);
        filhos[lista] = (state.filhos[lista] ?? []).map((c) => (c === chaveAlvo ? chaveGrupo : c));
      }

      return { elementos, filhos, selecionada: chaveGrupo, alterado: true };
    }),

  duplicar: (chave) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_DUPLICAR)) return state;

      const original = state.elementos[chave];
      if (!original) return state;

      const origem = [chave, ...ordemNaArvore(state.filhos, chave)];
      if (noLimite(state, origem.length)) return state;

      // Copia a subárvore inteira com chaves novas
      const novasChaves = new Map(origem.map((c) => [c, chaveNova()]));
      const elementos = { ...state.elementos };
      const filhos = { ...state.filhos };
      // Um idUnico nunca se repete: a cópia ganha outro, contra tudo que já existe no projeto e
      // contra o que esta mesma duplicação já gerou pras outras peças da subárvore. O idSequencial
      // não é copiado — é o número de ordem do original, não faz sentido a cópia nascer com ele.
      // referenciaEstavel (ver Elemento.gruposDeFace) segue a mesma regra do idUnico — e por isso
      // precisa de um mapa antiga->nova: um grupo de face dentro da própria subárvore duplicada
      // referencia a referência ANTIGA de um descendente, que também está sendo trocada agora
      const idsUnicosUsados = new Set(
        Object.values(state.elementos)
          .map((e) => e.idUnico)
          .filter((v): v is string => Boolean(v)),
      );
      const referenciasUsadas = new Set(
        Object.values(state.elementos)
          .map((e) => e.referenciaEstavel)
          .filter((v): v is string => Boolean(v)),
      );
      const referenciaAntigaParaNova = new Map<string, string>();
      for (const c of origem) {
        const elemento = state.elementos[c];
        const nova = novasChaves.get(c) as string;
        const idUnico = elemento.idUnico && gerarCodigoUnico(idsUnicosUsados);
        if (idUnico) idsUnicosUsados.add(idUnico);
        let referenciaEstavel: string | undefined;
        if (elemento.referenciaEstavel) {
          referenciaEstavel = gerarCodigoUnico(referenciasUsadas);
          referenciasUsadas.add(referenciaEstavel);
          referenciaAntigaParaNova.set(elemento.referenciaEstavel, referenciaEstavel);
        }
        elementos[nova] = {
          ...elemento,
          chave: nova,
          id: undefined,
          pai: c === chave ? elemento.pai : (novasChaves.get(elemento.pai as string) as string),
          posicao: { ...elemento.posicao },
          rotacao: { ...elemento.rotacao },
          forma: elemento.forma && { ...elemento.forma, parametros: { ...elemento.forma.parametros } },
          tamanho: elemento.tamanho && { ...elemento.tamanho },
          parede: elemento.parede && { ...elemento.parede },
          abertura: elemento.abertura && { ...elemento.abertura },
          referenciaEstavel,
          idUnico: idUnico || undefined,
          idSequencial: undefined,
        };
        if (elemento.tipo === 'grupo' || elemento.tipo === 'parede' || elemento.tipo === 'peca') {
          filhos[nova] = (state.filhos[c] ?? []).map((f) => novasChaves.get(f) as string);
        }
      }
      // Agora que toda referenciaEstavel nova já existe, reescreve os grupos de face duplicados
      // pra apontar pros descendentes também duplicados, não pros originais
      for (const c of origem) {
        const elemento = state.elementos[c];
        if (!elemento.gruposDeFace) continue;
        const nova = novasChaves.get(c) as string;
        elementos[nova] = {
          ...elementos[nova],
          gruposDeFace: Object.fromEntries(
            Object.entries(elemento.gruposDeFace).map(([nomeGrupo, membros]) => [
              nomeGrupo,
              membros.map((membro) => ({
                ...membro,
                referencia: referenciaAntigaParaNova.get(membro.referencia) ?? membro.referencia,
              })),
            ]),
          ),
        };
      }

      // A cópia vai para a direita dos irmãos
      const copia = elementos[novasChaves.get(chave) as string];
      copia.nome = `${original.nome} (cópia)`.slice(0, TAMANHO_NOME_ELEMENTO);
      const limitesOriginal = limites(state, chave);
      const borda = bordaDireita(state, original.pai);
      if (limitesOriginal && borda !== null) {
        copia.posicao = { ...copia.posicao, x: original.posicao.x + (borda - limitesOriginal.min.x) };
      }

      const lista = listaDe(original.pai);
      const irmaos = filhos[lista] ?? [];
      const indice = irmaos.indexOf(chave);
      filhos[lista] = [...irmaos.slice(0, indice + 1), copia.chave, ...irmaos.slice(indice + 1)];

      return {
        elementos,
        filhos,
        selecionada: copia.chave,
        contexto: original.pai,
        alterado: true,
      };
    }),

  importarModulo: (raiz) =>
    set((state) => {
      if (noLimite(state, contarElementoModulo(raiz))) return state;

      const pai = state.contexto;
      const elementos = { ...state.elementos };
      const filhos = { ...state.filhos };
      const idsUnicosDoDestino = new Set(
        Object.values(state.elementos)
          .map((e) => e.idUnico)
          .filter((v): v is string => Boolean(v)),
      );

      const raizChave = converterElementoModulo(elementos, filhos, raiz, pai, idsUnicosDoDestino);
      // O módulo importado vai para a direita dos irmãos, como uma peça nova
      elementos[raizChave] = { ...elementos[raizChave], posicao: { x: bordaDireita(state, pai) ?? 0, y: 0, z: 0 } };

      const listaDoPai = listaDe(pai);
      filhos[listaDoPai] = [...(filhos[listaDoPai] ?? []), raizChave];

      return { elementos, filhos, selecionada: raizChave, alterado: true };
    }),

  remover: (chave) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_REMOVER)) return state;

      const elemento = state.elementos[chave];
      if (!elemento) return state;

      const removidos = new Set([chave, ...ordemNaArvore(state.filhos, chave)]);
      const elementos = { ...state.elementos };
      const filhos = { ...state.filhos };
      for (const c of removidos) {
        delete elementos[c];
        delete filhos[c];
      }
      const lista = listaDe(elemento.pai);
      filhos[lista] = (filhos[lista] ?? []).filter((c) => c !== chave);

      return {
        elementos,
        filhos,
        selecionada: state.selecionada && removidos.has(state.selecionada) ? null : state.selecionada,
        // Se o grupo aberto foi removido, volta para onde o elemento estava
        contexto: state.contexto && removidos.has(state.contexto) ? elemento.pai : state.contexto,
        alterado: true,
      };
    }),

  atualizar: (chave, alteracao) =>
    set((state) => ({
      elementos: { ...state.elementos, [chave]: { ...state.elementos[chave], ...alteracao } },
      alterado: true,
    })),

  agrupar: (chave) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_AGRUPAR)) return state;

      const elemento = state.elementos[chave];
      // Um vão não pode virar grupo: só pode estar direto dentro de uma parede
      if (!elemento || elemento.tipo === 'abertura' || noLimite(state)) return state;

      // O grupo nasce com a caixa do elemento: origem no canto dela e o mesmo tamanho
      const caixa = limites(state, chave);
      const grupo: ElementoEditor = {
        chave: chaveNova(),
        tipo: 'grupo',
        nome: proximoNomeGrupo(state.elementos),
        pai: elemento.pai,
        posicao: caixa ? caixa.min : { ...elemento.posicao },
        rotacao: SEM_ROTACAO,
        colisao: true,
        visivel: true,
        tamanho: caixa ? tamanhoDaCaixa(caixa) : TAMANHO_PADRAO_GRUPO,
      };
      const lista = listaDe(elemento.pai);
      return {
        elementos: {
          ...state.elementos,
          [grupo.chave]: grupo,
          [chave]: { ...elemento, pai: grupo.chave, posicao: subtrair(elemento.posicao, grupo.posicao) },
        },
        filhos: {
          ...state.filhos,
          [lista]: (state.filhos[lista] ?? []).map((c) => (c === chave ? grupo.chave : c)),
          [grupo.chave]: [chave],
        },
        selecionada: grupo.chave,
        contexto: elemento.pai,
        alterado: true,
      };
    }),

  desagrupar: (chave) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_AGRUPAR)) return state;

      const grupo = state.elementos[chave];
      if (!grupo || grupo.tipo !== 'grupo') return state;

      const conteudo = state.filhos[chave] ?? [];
      const elementos = { ...state.elementos };
      delete elementos[chave];
      for (const filho of conteudo) {
        // Compõe posição e rotação do grupo com as do filho, para ele não sair do lugar
        const noPai = decompor(
          matrizLocal(grupo.posicao, grupo.rotacao).multiply(
            matrizLocal(elementos[filho].posicao, elementos[filho].rotacao),
          ),
        );
        elementos[filho] = { ...elementos[filho], pai: grupo.pai, ...noPai };
      }

      const filhos = { ...state.filhos };
      delete filhos[chave];
      const lista = listaDe(grupo.pai);
      const irmaos = filhos[lista] ?? [];
      const indice = irmaos.indexOf(chave);
      filhos[lista] = [...irmaos.slice(0, indice), ...conteudo, ...irmaos.slice(indice + 1)];

      return {
        elementos,
        filhos,
        selecionada: state.selecionada === chave ? null : state.selecionada,
        contexto: state.contexto === chave ? grupo.pai : state.contexto,
        alterado: true,
      };
    }),

  moverPara: (chave, novoPai, antesDe) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento || antesDe === chave) return state;
      // Só grupos e paredes recebem elementos (paredes, só vãos), e nada entra em si mesmo
      if (
        novoPai !== null &&
        (!aceitaFilho(state.elementos[novoPai]?.tipo, elemento.tipo) || estaDentro(state.elementos, novoPai, chave))
      ) {
        return state;
      }
      // Raiz do projeto: só aceita o que um grupo aceitaria (nada de vão solto)
      if (novoPai === null && !aceitaFilho('grupo', elemento.tipo)) return state;

      const listaAntiga = listaDe(elemento.pai);
      const listaNova = listaDe(novoPai);
      const semElemento = (state.filhos[listaNova] ?? []).filter((c) => c !== chave);
      const indice = antesDe ? semElemento.indexOf(antesDe) : -1;
      const novaOrdem =
        indice === -1
          ? [...semElemento, chave]
          : [...semElemento.slice(0, indice), chave, ...semElemento.slice(indice)];

      const mesmoPai = elemento.pai === novoPai;
      const ordemAtual = state.filhos[listaNova] ?? [];
      if (mesmoPai && novaOrdem.every((c, i) => c === ordemAtual[i])) return state;

      // Mudando de grupo, a posição é recalculada para o elemento continuar no mesmo lugar
      const elementos = mesmoPai
        ? state.elementos
        : {
            ...state.elementos,
            [chave]: {
              ...elemento,
              pai: novoPai,
              // Posição e rotação no espaço do novo pai
              ...decompor(
                matrizNoMundo(state.elementos, novoPai).invert().multiply(matrizNoMundo(state.elementos, chave)),
              ),
            },
          };

      return {
        elementos,
        // No mesmo pai as duas listas são a mesma, e a nova ordem prevalece
        filhos: {
          ...state.filhos,
          [listaAntiga]: (state.filhos[listaAntiga] ?? []).filter((c) => c !== chave),
          [listaNova]: novaOrdem,
        },
        contexto: state.selecionada === chave ? novoPai : state.contexto,
        alterado: true,
      };
    }),

  redimensionarGrupo: (chave, tamanho) => {
    const elementos = escalarGrupo(get(), chave, tamanho);
    if (!elementos) return false;
    set({ elementos, alterado: true });
    return true;
  },

  desfazer: () => {
    suprimirHistorico = true;
    set((state) => {
      const anterior = state.historico.passado.at(-1);
      if (!anterior) return state;
      return {
        ...anterior,
        historico: {
          passado: state.historico.passado.slice(0, -1),
          futuro: [...state.historico.futuro, tirarInstantaneo(state)],
        },
        alterado: true,
      };
    });
    suprimirHistorico = false;
    ultimaMutacaoHistoricoEm = 0;
    ultimaChaveHistorico = null;
  },

  refazer: () => {
    suprimirHistorico = true;
    set((state) => {
      const proximo = state.historico.futuro.at(-1);
      if (!proximo) return state;
      return {
        ...proximo,
        historico: {
          passado: [...state.historico.passado, tirarInstantaneo(state)],
          futuro: state.historico.futuro.slice(0, -1),
        },
        alterado: true,
      };
    });
    suprimirHistorico = false;
    ultimaMutacaoHistoricoEm = 0;
    ultimaChaveHistorico = null;
  },

  definirCampo: (chave, campo, entrada) =>
    set((state) => {
      const elemento = state.elementos[chave];
      const enderecavel = elemento && camposEnderecaveisDoElemento(elemento)[campo];
      if (!elemento || !enderecavel) return state;

      const formulas = { ...elemento.formulas };
      let atualizado = elemento;
      if ('formula' in entrada) {
        formulas[campo] = entrada.formula;
      } else {
        delete formulas[campo];
        atualizado = enderecavel.definir(elemento, entrada.valor);
      }
      const errosFormula = { ...elemento.errosFormula };
      delete errosFormula[campo];

      return {
        elementos: { ...state.elementos, [chave]: { ...atualizado, formulas, errosFormula } },
        alterado: true,
      };
    }),

  definirVariavel: (chave, nome, textoOuNumero) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento) return state;
      return {
        elementos: {
          ...state.elementos,
          [chave]: { ...elemento, variaveisFormulas: { ...elemento.variaveisFormulas, [nome]: textoOuNumero } },
        },
        alterado: true,
      };
    }),

  definirVariavelDeFace: (chave, face, nome, textoOuNumero) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento) return state;
      const formulasDaFace = { ...elemento.variaveisPorFaceFormulas?.[face], [nome]: textoOuNumero };
      return {
        elementos: {
          ...state.elementos,
          [chave]: { ...elemento, variaveisPorFaceFormulas: { ...elemento.variaveisPorFaceFormulas, [face]: formulasDaFace } },
        },
        alterado: true,
      };
    }),

  definirTextura: (chave, face, imagem) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento?.forma && !elemento?.modelo3d && !elemento?.parede && !elemento?.piso) return state;
      const texturas = { ...elemento.texturas };
      if (imagem) texturas[face] = imagem;
      else delete texturas[face];
      return {
        elementos: {
          ...state.elementos,
          [chave]: { ...elemento, texturas: Object.keys(texturas).length > 0 ? texturas : undefined },
        },
        alterado: true,
      };
    }),

  definirGrupoDeFace: (chave, nomeGrupo, membros) =>
    set((state) => {
      if (!state.elementos[chave]) return state;
      let elementos = state.elementos;
      // Referência estável (nunca mostrada na cena, ao contrário de idUnico — ver
      // Elemento.referenciaEstavel), gerada na hora pra quem ainda não tinha
      const referenciasUsadas = new Set(
        Object.values(state.elementos)
          .map((e) => e.referenciaEstavel)
          .filter((v): v is string => Boolean(v)),
      );
      const membrosComReferencia: MembroGrupoDeFace[] = membros.map(({ chave: chaveMembro, face }) => {
        const alvo = elementos[chaveMembro];
        if (!alvo) return { referencia: chaveMembro, face }; // alvo sumiu da árvore; mantém como veio
        if (alvo.referenciaEstavel) return { referencia: alvo.referenciaEstavel, face };
        const referencia = gerarCodigoUnico(referenciasUsadas);
        referenciasUsadas.add(referencia);
        elementos = { ...elementos, [chaveMembro]: { ...alvo, referenciaEstavel: referencia } };
        return { referencia, face };
      });
      return {
        elementos: {
          ...elementos,
          [chave]: {
            ...elementos[chave],
            gruposDeFace: { ...elementos[chave].gruposDeFace, [nomeGrupo]: membrosComReferencia },
          },
        },
        alterado: true,
      };
    }),

  removerGrupoDeFace: (chave, nomeGrupo) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento?.gruposDeFace || !(nomeGrupo in elemento.gruposDeFace)) return state;
      const gruposDeFace = { ...elemento.gruposDeFace };
      delete gruposDeFace[nomeGrupo];
      return {
        elementos: {
          ...state.elementos,
          [chave]: { ...elemento, gruposDeFace: Object.keys(gruposDeFace).length > 0 ? gruposDeFace : undefined },
        },
        alterado: true,
      };
    }),

  aplicarTexturaPorGrupo: (chave, nomeGrupo, imagem) =>
    set((state) => {
      const membros = state.elementos[chave]?.gruposDeFace?.[nomeGrupo];
      if (!membros || membros.length === 0) return state;
      // A referência não muda durante o laço (só a textura), então mapear pra chave uma vez só é
      // seguro — mas CADA iteração tem que reler elementos[chaveAlvo] fresco (não uma foto de antes
      // de pintar), senão duas faces do MESMO elemento neste grupo (o normal com "Todos", que entra
      // com uma linha por face) se sobrescrevem: a segunda apagaria a primeira
      const chavePorReferencia = new Map(Object.values(state.elementos).map((e) => [e.referenciaEstavel, e.chave] as const));
      let elementos = state.elementos;
      for (const { referencia, face } of membros) {
        const chaveAlvo = chavePorReferencia.get(referencia);
        const alvo = chaveAlvo ? elementos[chaveAlvo] : undefined;
        if (!chaveAlvo || !alvo) continue;
        const texturas = { ...alvo.texturas };
        if (imagem) texturas[face] = imagem;
        else delete texturas[face];
        elementos = { ...elementos, [chaveAlvo]: { ...alvo, texturas: Object.keys(texturas).length > 0 ? texturas : undefined } };
      }
      return { elementos, alterado: true };
    }),

  alternarTrava: (chave, campo) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento) return state;
      const atuais = elemento.travados ?? [];
      const travados = atuais.includes(campo) ? atuais.filter((c) => c !== campo) : [...atuais, campo];
      return {
        elementos: { ...state.elementos, [chave]: { ...elemento, travados: travados.length > 0 ? travados : undefined } },
        alterado: true,
      };
    }),

  gerarIdUnico: (chaves) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.MODULO_GERAR_ID)) return state;

      // Quem já tem um idUnico mantém o mesmo (gerar de novo em cima do que já existe não faz
      // nada); só ganha um código quem ainda não tinha — regenerar de verdade é só ao duplicar ou
      // importar o módulo (ver duplicar/converterElementoModulo)
      const alvos = chaves.filter(
        (c) => (state.elementos[c]?.tipo === 'peca' || state.elementos[c]?.tipo === 'grupo') && !state.elementos[c]?.idUnico,
      );
      if (alvos.length === 0) return state;

      const usados = new Set(
        Object.values(state.elementos)
          .map((e) => e.idUnico)
          .filter((v): v is string => Boolean(v)),
      );
      const elementos = { ...state.elementos };
      for (const chave of alvos) {
        const codigo = gerarCodigoUnico(usados);
        usados.add(codigo);
        elementos[chave] = { ...elementos[chave], idUnico: codigo };
      }
      return { elementos, alterado: true };
    }),

  gerarIdSequencial: (chaves) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.MODULO_GERAR_ID)) return state;

      // Mesma regra do idUnico: quem já tem um número mantém o mesmo; só ganha número quem ainda
      // não tinha (duplicar limpa o número da cópia, ver duplicar — é assim que ela volta a
      // precisar de um novo)
      const alvos = chaves.filter(
        (c) => (state.elementos[c]?.tipo === 'peca' || state.elementos[c]?.tipo === 'grupo') && !state.elementos[c]?.idSequencial,
      );
      if (alvos.length === 0) return state;

      let proximo = proximoNumeroSequencial(state.elementos);
      const elementos = { ...state.elementos };
      for (const chave of alvos) {
        elementos[chave] = { ...elementos[chave], idSequencial: `M-${proximo}` };
        proximo += 1;
      }
      return { elementos, alterado: true };
    }),

  removerVariavel: (chave, nome) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento?.variaveisFormulas || !(nome in elemento.variaveisFormulas)) return state;
      const variaveisFormulas = { ...elemento.variaveisFormulas };
      delete variaveisFormulas[nome];
      const variaveis = { ...elemento.variaveis };
      delete variaveis[nome];
      const errosFormula = { ...elemento.errosFormula };
      delete errosFormula[`variavel:${nome}`];
      return {
        elementos: { ...state.elementos, [chave]: { ...elemento, variaveisFormulas, variaveis, errosFormula } },
        alterado: true,
      };
    }),

  removerVariavelDeFace: (chave, face, nome) =>
    set((state) => {
      const elemento = state.elementos[chave];
      if (!elemento?.variaveisPorFaceFormulas?.[face] || !(nome in elemento.variaveisPorFaceFormulas[face])) return state;
      const formulasDaFace = { ...elemento.variaveisPorFaceFormulas[face] };
      delete formulasDaFace[nome];
      const variaveisPorFaceFormulas = { ...elemento.variaveisPorFaceFormulas, [face]: formulasDaFace };
      const valoresDaFace = { ...elemento.valoresPorFace?.[face] };
      delete valoresDaFace[nome];
      const valoresPorFace = { ...elemento.valoresPorFace, [face]: valoresDaFace };
      const errosFormula = { ...elemento.errosFormula };
      delete errosFormula[`variavelFace:${face}:${nome}`];
      return {
        elementos: { ...state.elementos, [chave]: { ...elemento, variaveisPorFaceFormulas, valoresPorFace, errosFormula } },
        alterado: true,
      };
    }),

  definirVariavelGlobal: (nome, valor) =>
    set((state) => ({
      variaveisGlobais: { ...state.variaveisGlobais, [nome]: valor },
      alterado: true,
    })),

  removerVariavelGlobal: (nome) =>
    set((state) => {
      if (!(nome in state.variaveisGlobais)) return state;
      const variaveisGlobais = { ...state.variaveisGlobais };
      delete variaveisGlobais[nome];
      return { variaveisGlobais, alterado: true };
    }),

  // Um vão é um elemento de verdade, filho da parede (como uma peça dentro de um grupo): pode ser
  // selecionado, movido com as setas (arrastar em X/Z desloca/levanta o vão) e editado no painel
  // dele, em vez de só numa lista dentro do painel da parede
  adicionarAbertura: (chaveParede, tipo) =>
    set((state) => {
      const parede = state.elementos[chaveParede];
      if (!parede?.parede || noLimite(state)) return state;
      const { comprimento, altura: alturaParede } = parede.parede;
      const atuais = (state.filhos[chaveParede] ?? []).length;
      if (atuais >= ABERTURAS_POR_PAREDE_MAXIMO) return state;

      // Medidas padrão (porta: do chão; janela: peitoril de 90cm), encolhidas se a parede for
      // pequena demais pra caber do jeito ideal, sempre deixando pelo menos MEDIDA_MINIMA de vão
      const largura = Math.min(tipo === 'porta' ? 800 : 1200, Math.max(MEDIDA_MINIMA, comprimento));
      const peitoril = tipo === 'porta' ? 0 : Math.min(900, Math.max(0, alturaParede - MEDIDA_MINIMA));
      const altura = Math.min(tipo === 'porta' ? 2100 : 1200, Math.max(MEDIDA_MINIMA, alturaParede - peitoril));
      const deslocamento = Math.max(0, (comprimento - largura) / 2);

      return inserir(state, {
        chave: chaveNova(),
        tipo: 'abertura',
        nome: proximoNomeAbertura(state.elementos, tipo),
        pai: chaveParede,
        posicao: { x: deslocamento, y: 0, z: peitoril },
        rotacao: SEM_ROTACAO,
        colisao: false,
        visivel: true,
        abertura: { tipo, largura, altura },
      });
    }),

  abrirExplosao: (chave) =>
    set((state) => {
      const tipo = state.elementos[chave]?.tipo;
      return tipo === 'grupo' || tipo === 'peca' ? { explodido: { chave, distancia: 0 } } : state;
    }),

  definirDistanciaExplosao: (distancia) =>
    set((state) =>
      state.explodido
        ? { explodido: { ...state.explodido, distancia: Math.min(EXPLOSAO_DISTANCIA_MAXIMA, Math.max(0, distancia)) } }
        : state,
    ),

  fecharExplosao: () => set({ explodido: null }),

  alternarVisibilidade: (chave) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_VISIBILIDADE)) return state;

      const elemento = state.elementos[chave];
      if (!elemento) return state;
      return {
        elementos: { ...state.elementos, [chave]: { ...elemento, visivel: !elemento.visivel } },
        alterado: true,
      };
    }),

  definirVisibilidadeTodos: (visivel) =>
    set((state) => {
      if (!temPermissaoAtual(PERMISSOES.ESTRUTURA_VISIBILIDADE)) return state;
      return {
        elementos: Object.fromEntries(
          Object.entries(state.elementos).map(([chave, elemento]) => [chave, { ...elemento, visivel }]),
        ),
        alterado: true,
      };
    }),
  };
});

// Chave do único elemento que mudou de `antes` para `depois` (ex.: um campo editado no painel ou
// um quadro de arraste); null se a árvore mudou de formato (adicionar/remover/mover) ou se mais
// de um elemento mudou de uma vez, casos que nunca coalescem no mesmo passo de desfazer
function chaveUnicaAlterada(antes: Elementos, depois: Elementos): string | null {
  let unica: string | null = null;
  for (const chave of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    if (antes[chave] !== depois[chave]) {
      if (unica !== null) return null;
      unica = chave;
    }
  }
  return unica;
}

// Toda mudança de conteúdo (elementos ou filhos) que não venha de carregar/limpar/desfazer/refazer
// vira um passo de desfazer, tirado do estado de ANTES da mudança. Edições seguidas do MESMO
// elemento dentro de `JANELA_COALESCENCIA_HISTORICO_MS` (digitação, arraste contínuo) viram um
// único passo; adicionar, remover ou mover elementos na árvore nunca coalesce
useEditorStore.subscribe((state, estadoAnterior) => {
  if (suprimirHistorico) return;
  if (state.elementos === estadoAnterior.elementos && state.filhos === estadoAnterior.filhos) return;

  const filhosMudaram = state.filhos !== estadoAnterior.filhos;
  const chaveAlterada = filhosMudaram ? null : chaveUnicaAlterada(estadoAnterior.elementos, state.elementos);

  const agora = Date.now();
  const continuacao =
    chaveAlterada !== null &&
    chaveAlterada === ultimaChaveHistorico &&
    agora - ultimaMutacaoHistoricoEm < JANELA_COALESCENCIA_HISTORICO_MS &&
    estadoAnterior.historico.passado.length > 0;

  ultimaMutacaoHistoricoEm = agora;
  ultimaChaveHistorico = chaveAlterada;
  if (continuacao) return;

  useEditorStore.setState({
    historico: {
      passado: [...estadoAnterior.historico.passado, tirarInstantaneo(estadoAnterior)].slice(-LIMITE_HISTORICO),
      futuro: [],
    },
  });
});
