import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { completarParametros, FORMAS, parametrosValidos } from '../formas/formas';
import type { Posicao, Rotacao, TipoElemento, Forma } from './projetos';

// CONVERSÃO DA CONVENÇÃO DOS EIXOS (versão 1 → 2) — ver lib/transformacoes/convencao.ts.
//
// Versão 1 (projetos e módulos salvos antes da mudança): a origem de uma peça ou grupo é o canto da
// FRENTE e o Y dos dados cresce pra TRÁS. Versão 2: a origem é o canto de TRÁS e o Y cresce pra FRENTE.
//
// As contas são feitas no espaço da CENA (three.js), que é o que o usuário vê, e não nos números
// do store — assim o resultado é, por construção, o MESMO desenho. A cena não muda: um elemento só
// troca o pivô, do canto da frente para o canto de trás, ou seja, o ponto de origem anda a
// profundidade `d` do elemento ao longo do próprio eixo Z. Nas coordenadas locais da cena:
//
//     ponto_v1 = ponto_v2 + (0, 0, -d)         (a frente da v1 é o Z=d da v2)
//
// e, como o filho é posicionado no espaço do pai (que também troca de pivô, com a profundidade dp):
//
//     L_v2 = T(0, 0, dp) · L_v1 · T(0, 0, -d)
//
// A raiz do projeto não tem pai, mas a planta (o ambiente) também passa a ter origem no fundo: o
// ambiente inteiro anda planta.y pra frente (T(0, 0, planta.y)), pra os elementos continuarem
// dentro dela.

/** Mesmo mapeamento dados→cena do viewport, mas com o sentido do Y explícito (±1) */
function matrizDaCena(posicao: Posicao, rotacao: Rotacao, sentidoZ: number): Matrix4 {
  const euler = new Euler(
    MathUtils.degToRad(rotacao.x),
    MathUtils.degToRad(rotacao.z),
    sentidoZ * MathUtils.degToRad(rotacao.y),
    'XYZ',
  );
  return new Matrix4().compose(
    new Vector3(posicao.x, posicao.z, sentidoZ * posicao.y),
    new Quaternion().setFromEuler(euler),
    new Vector3(1, 1, 1),
  );
}

// `|| 0` evita -0, que apareceria como "-0" nos campos
const arredondar = (valor: number, casas: number) => Math.round(valor * 10 ** casas) / 10 ** casas || 0;

function normalizarGraus(graus: number): number {
  const normalizado = ((((graus + 180) % 360) + 360) % 360) - 180;
  return (normalizado === -180 ? 180 : normalizado) || 0;
}

/** Inverso de matrizDaCena (mesmo que aplicarRotacao/rotacaoDaCena do viewport) */
function dadosDaMatriz(matriz: Matrix4, sentidoZ: number): { posicao: Posicao; rotacao: Rotacao } {
  const posicao = new Vector3();
  const quaternion = new Quaternion();
  matriz.decompose(posicao, quaternion, new Vector3());
  const euler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  const graus = (radianos: number) => normalizarGraus(arredondar(MathUtils.radToDeg(radianos), 2));
  return {
    posicao: {
      x: arredondar(posicao.x, 1),
      y: arredondar(posicao.z / sentidoZ, 1),
      z: arredondar(posicao.y, 1),
    },
    rotacao: { x: graus(euler.x), y: graus(sentidoZ * euler.z), z: graus(euler.y) },
  };
}

const SENTIDO_V1 = -1;
const SENTIDO_V2 = 1;

/** Campos de fórmula que dependem do sentido do Y ou da origem: o valor vira número fixo na conversão */
const CAMPOS_DE_POSICAO = ['posicaoX', 'posicaoY', 'posicaoZ', 'rotacaoX', 'rotacaoY', 'rotacaoZ'] as const;

/** O que a conversão precisa ler de um elemento (um Elemento de projeto, um ElementoModulo ou um ElementoEntrada) */
export interface ElementoConversivel {
  tipo: TipoElemento;
  posicao: Posicao;
  rotacao?: Rotacao | null;
  forma?: Forma | null;
  tamanho?: Posicao | null;
  verticesParede?: Posicao[] | null;
  piso?: { vertices: Posicao[]; espessura: number } | null;
  formulas?: Record<string, string> | null;
  filhos?: ElementoConversivel[] | null;
}

export interface ResultadoDaConversao<T> {
  elementos: T[];
  /** Quantas fórmulas de posição/rotação viraram valor fixo (o valor delas é preservado) */
  formulasConvertidas: number;
}

/** Medidas (largura, profundidade, altura) da caixa do elemento a partir da origem em canto, ou
 * nulo se ele não tem uma (parede, piso, vão, grupo muito antigo sem tamanho) */
function medidasDoElemento(e: ElementoConversivel): Posicao | null {
  if (e.tipo === 'peca' && e.forma) {
    const parametros = completarParametros(e.forma.tipo, e.forma.parametros);
    return parametrosValidos(e.forma.tipo, parametros) ? FORMAS[e.forma.tipo].tamanho(parametros) : null;
  }
  // Grupo, ou peça de modelo 3D importado: o tamanho fixo (a "caixa" do elemento)
  if ((e.tipo === 'peca' || e.tipo === 'grupo') && e.tamanho) return e.tamanho;
  return null;
}

/** Profundidade de um grupo antigo que ainda não guardava o tamanho: o quanto o conteúdo se estende pra
 * trás da origem (que na convenção 1 fica na frente), no desenho — o mesmo que o editor calcula ao
 * abrir esse grupo */
function profundidadeDoConteudo(grupo: ElementoConversivel): number {
  let maisAoFundo = 0;
  for (const filho of grupo.filhos ?? []) {
    const medidas = medidasDoElemento(filho);
    const matriz = matrizDaCena(filho.posicao, filho.rotacao ?? { x: 0, y: 0, z: 0 }, SENTIDO_V1);
    // A caixa do filho, no desenho da convenção 1: X de 0 a largura, Y de 0 a altura, Z de -profundidade a 0
    const [w, d, h] = medidas ? [medidas.x, medidas.y, medidas.z] : [0, 0, 0];
    for (const [x, y, z] of [[0, 0, 0], [w, 0, 0], [0, h, 0], [w, h, 0], [0, 0, -d], [w, 0, -d], [0, h, -d], [w, h, -d]]) {
      maisAoFundo = Math.min(maisAoFundo, new Vector3(x, y, z).applyMatrix4(matriz).z);
    }
    // Um filho que é grupo antigo, ele também: o que ele alcança conta
    if (!medidas && filho.tipo === 'grupo') {
      const d2 = profundidadeDoConteudo(filho);
      for (const z of [0, -d2]) maisAoFundo = Math.min(maisAoFundo, new Vector3(0, 0, z).applyMatrix4(matriz).z);
    }
  }
  return -maisAoFundo;
}

/** Profundidade (extensão no eixo Y dos dados) da caixa do elemento, a partir da origem em canto */
export function profundidadeDoElemento(e: ElementoConversivel): number {
  const medidas = medidasDoElemento(e);
  if (medidas) return medidas.y;
  if (e.tipo === 'grupo') return profundidadeDoConteudo(e);
  // Parede (origem no meio da espessura), piso (a origem é qualquer ponto), vão: sem caixa a partir do canto
  return 0;
}

/**
 * Converte uma árvore da convenção 1 para a 2, mantendo o mesmo desenho. `deslocamentoDaRaiz` é a
 * profundidade da planta (o ambiente), quando o projeto tem uma; 0 num módulo ou num projeto sem ela.
 */
export function converterParaConvencaoAtual<T extends ElementoConversivel>(
  elementos: T[],
  deslocamentoDaRaiz = 0,
): ResultadoDaConversao<T> {
  let formulasConvertidas = 0;

  function converter<E extends ElementoConversivel>(e: E, profundidadeDoPai: number): E {
    const d = profundidadeDoElemento(e);
    const rotacao = e.rotacao ?? { x: 0, y: 0, z: 0 };

    const antiga = matrizDaCena(e.posicao, rotacao, SENTIDO_V1);
    const nova = new Matrix4()
      .makeTranslation(0, 0, profundidadeDoPai)
      .multiply(antiga)
      .multiply(new Matrix4().makeTranslation(0, 0, -d));
    const { posicao, rotacao: rotacaoNova } = dadosDaMatriz(nova, SENTIDO_V2);

    // Fórmulas que dão a posição ou a rotação: o valor convertido vale, a fórmula (que raciocinava com
    // o Y e a origem antigos) deixa de existir
    let formulas = e.formulas ?? null;
    if (formulas) {
      const restantes = { ...formulas };
      for (const campo of CAMPOS_DE_POSICAO) {
        if (campo in restantes) {
          delete restantes[campo];
          formulasConvertidas++;
        }
      }
      formulas = Object.keys(restantes).length > 0 ? restantes : null;
    }

    const resultado = { ...e, posicao, rotacao: rotacaoNova } as unknown as Record<string, unknown>;
    if ('formulas' in e) resultado.formulas = formulas;
    // Cantos clicados do construtor de paredes, relativos à origem do grupo: o Y espelha em torno do
    // pivô (y' = d - y, com a origem passando da frente pro fundo)
    if (e.verticesParede) {
      resultado.verticesParede = e.verticesParede.map((v) => ({ ...v, y: arredondar(d - v.y, 1) }));
    }
    // Piso: o polígono vive no plano X/Y e não troca de pivô (d = 0); só o Y espelha
    if (e.piso) {
      resultado.piso = { ...e.piso, vertices: e.piso.vertices.map((v) => ({ ...v, y: arredondar(-v.y, 1) })) };
    }
    if (e.filhos) resultado.filhos = e.filhos.map((filho) => converter(filho, d));
    return resultado as unknown as E;
  }

  return { elementos: elementos.map((e) => converter(e, deslocamentoDaRaiz)), formulasConvertidas };
}
