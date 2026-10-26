import { Box3, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { Posicao, Rotacao } from '../projetos/projetos';
import { SINAL_DAS_ROTACOES } from './convencao';

const ORDEM_DOS_EIXOS = 'XZY';
const SINAL_NA_MATRIZ = SINAL_DAS_ROTACOES;

// Transformações no espaço dos dados: X para a direita, Z para cima, Y para a frente (em mm; ver
// convencao.ts) e rotações em graus, positivas no sentido anti-horário visto da ponta positiva do
// eixo (como no SketchUp). A cena aplica as rotações como X, depois a vertical (Z dos dados), depois
// a profundidade (Y dos dados) — ver aplicarRotacao em ModuloViewport/utilitarios.ts —, e a matriz dos
// dados precisa seguir EXATAMENTE a mesma ordem e sentido, senão a posição de um filho dentro de um
// pai girado, calculada aqui, não bate com onde o viewport desenha. Como o espaço dos dados é
// espelhado em relação à cena, o ângulo da interface entra na matriz com SINAL_DAS_ROTACOES

export const SEM_ROTACAO: Rotacao = { x: 0, y: 0, z: 0 };

// `|| 0` evita -0, que apareceria como "-0" nos campos
const arredondar = (valor: number, casas: number) => Math.round(valor * 10 ** casas) / 10 ** casas || 0;

/** Ângulo equivalente entre -180 (exclusive) e 180 graus */
export function normalizarGraus(graus: number) {
  const normalizado = ((((graus + 180) % 360) + 360) % 360) - 180;
  return (normalizado === -180 ? 180 : normalizado) || 0;
}

// Ordem 'XZY' = Rx · Rz · Ry: X, depois a vertical (Z), depois a profundidade (Y)
const euler = (rotacao: Rotacao) =>
  new Euler(
    SINAL_NA_MATRIZ * MathUtils.degToRad(rotacao.x),
    SINAL_NA_MATRIZ * MathUtils.degToRad(rotacao.y),
    SINAL_NA_MATRIZ * MathUtils.degToRad(rotacao.z),
    ORDEM_DOS_EIXOS,
  );

/** Transformação da origem de um elemento no espaço do pai: gira em torno da origem e posiciona */
export function matrizLocal(posicao: Posicao, rotacao: Rotacao): Matrix4 {
  return new Matrix4().compose(
    new Vector3(posicao.x, posicao.y, posicao.z),
    new Quaternion().setFromEuler(euler(rotacao)),
    new Vector3(1, 1, 1),
  );
}

/** Posição e rotação de uma transformação sem escala, arredondadas (0,1 mm e 0,01 grau) */
export function decompor(matriz: Matrix4): { posicao: Posicao; rotacao: Rotacao } {
  const posicao = new Vector3();
  const quaternion = new Quaternion();
  matriz.decompose(posicao, quaternion, new Vector3());
  const angulos = new Euler().setFromQuaternion(quaternion, ORDEM_DOS_EIXOS);
  const graus = (radianos: number) => normalizarGraus(arredondar(SINAL_NA_MATRIZ * MathUtils.radToDeg(radianos), 2));

  return {
    posicao: { x: arredondar(posicao.x, 1), y: arredondar(posicao.y, 1), z: arredondar(posicao.z, 1) },
    rotacao: { x: graus(angulos.x), y: graus(angulos.y), z: graus(angulos.z) },
  };
}

/** Caixa alinhada aos eixos do pai que envolve a caixa [min, max] do elemento, girada e posicionada */
export function envolverCaixa(min: Posicao, max: Posicao, posicao: Posicao, rotacao: Rotacao) {
  const caixa = new Box3(new Vector3(min.x, min.y, min.z), new Vector3(max.x, max.y, max.z)).applyMatrix4(
    matrizLocal(posicao, rotacao),
  );
  return {
    min: { x: caixa.min.x, y: caixa.min.y, z: caixa.min.z },
    max: { x: caixa.max.x, y: caixa.max.y, z: caixa.max.z },
  };
}

/**
 * Fator de escala nos eixos próprios de um elemento girado, dado o fator nos eixos do pai.
 * Exato para rotações em múltiplos de 90°; em outros ângulos é uma aproximação sem cisalhamento
 */
export function fatorNosEixosProprios(fator: Posicao, rotacao: Rotacao): Posicao {
  const colunas = new Matrix4().makeRotationFromEuler(euler(rotacao)).elements;
  // A coluna i é a direção do eixo próprio i no espaço do pai
  const eixo = (i: number) =>
    arredondar(Math.hypot(colunas[4 * i] * fator.x, colunas[4 * i + 1] * fator.y, colunas[4 * i + 2] * fator.z), 9);
  return { x: eixo(0), y: eixo(1), z: eixo(2) };
}
