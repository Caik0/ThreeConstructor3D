import { Matrix4, Vector3 } from 'three';
import type { Posicao, Rotacao } from '../projetos/projetos';
import { decompor, matrizLocal } from './transformacoes';

// EIXOS PRÓPRIOS DE UM ELEMENTO NOVO — como o "Alterar eixos" do SketchUp, mas na hora de criar.
//
// Um elemento sempre ocupa o sentido positivo dos três eixos próprios a partir da origem (ver
// convencao.ts), então escolher em qual canto da caixa fica a origem e pra que lado cada eixo aponta
// é o mesmo que girar o elemento: as 24 combinações possíveis (8 cantos × 3 escolhas pro X; o Y e o Z
// sempre apontam pra dentro da caixa e seguem a regra da mão direita) são exatamente as 24 rotações em
// múltiplos de 90° de uma caixa. Por isso nada novo é gravado: o resultado vira a posição, a rotação e
// as medidas próprias do elemento, e o viewport já desenha os eixos da seleção girados com ele.
//
// Padrão: origem no canto traseiro esquerdo inferior, X pra direita, Y pra frente e Z pra cima.

export type EixoDados = 'x' | 'y' | 'z';

/** Direção nos eixos do pai: o eixo e o sentido */
export interface Direcao {
  eixo: EixoDados;
  sinal: 1 | -1;
}

/** Pra onde apontam o X e o Y próprios do elemento; o Z é X × Y (regra da mão direita) */
export interface EixosIniciais {
  x: Direcao;
  y: Direcao;
}

/** Canto da caixa, por eixo do pai: 0 = lado mínimo (esquerda, fundo, base), 1 = máximo */
export type Canto = Record<EixoDados, 0 | 1>;

export const EIXOS_DADOS: EixoDados[] = ['x', 'y', 'z'];

export const EIXOS_PADRAO: EixosIniciais = { x: { eixo: 'x', sinal: 1 }, y: { eixo: 'y', sinal: 1 } };

export const NOMES_DIRECAO: Record<EixoDados, Record<1 | -1, string>> = {
  x: { 1: 'Direita', [-1]: 'Esquerda' },
  y: { 1: 'Frente', [-1]: 'Fundo' },
  z: { 1: 'Cima', [-1]: 'Baixo' },
};

const NOMES_CANTO: Record<EixoDados, [string, string]> = {
  x: ['esquerdo', 'direito'],
  y: ['traseiro', 'frontal'],
  z: ['inferior', 'superior'],
};

export const mesmaDirecao = (a: Direcao, b: Direcao) => a.eixo === b.eixo && a.sinal === b.sinal;

export const ehPadrao = (eixos: EixosIniciais) =>
  mesmaDirecao(eixos.x, EIXOS_PADRAO.x) && mesmaDirecao(eixos.y, EIXOS_PADRAO.y);

const vetor = ({ eixo, sinal }: Direcao) =>
  new Vector3(eixo === 'x' ? sinal : 0, eixo === 'y' ? sinal : 0, eixo === 'z' ? sinal : 0);

function direcaoDoVetor(v: Vector3): Direcao {
  const eixo = EIXOS_DADOS.find((e) => Math.round(v[e]) !== 0) ?? 'z';
  return { eixo, sinal: v[eixo] > 0 ? 1 : -1 };
}

/** Pra onde aponta o Z próprio: X × Y */
export function direcaoZ(eixos: EixosIniciais): Direcao {
  return direcaoDoVetor(new Vector3().crossVectors(vetor(eixos.x), vetor(eixos.y)));
}

/** O canto onde fica a origem: aquele de onde os três eixos apontam pra dentro da caixa */
export function cantoDaOrigem(eixos: EixosIniciais): Canto {
  const canto = { x: 0, y: 0, z: 0 } as Canto;
  for (const direcao of [eixos.x, eixos.y, direcaoZ(eixos)]) canto[direcao.eixo] = direcao.sinal > 0 ? 0 : 1;
  return canto;
}

export function nomeDoCanto(canto: Canto): string {
  return `canto ${NOMES_CANTO.y[canto.y]} ${NOMES_CANTO.x[canto.x]} ${NOMES_CANTO.z[canto.z]}`;
}

const sinalParaDentro = (canto: Canto, eixo: EixoDados): 1 | -1 => (canto[eixo] === 0 ? 1 : -1);

/** As três arestas que saem desse canto pra dentro da caixa: as direções possíveis de um eixo
 * próprio com a origem ali (configuração passo a passo: origem, X, Y e, por fim, o Z) */
export function direcoesDoCanto(canto: Canto): Direcao[] {
  return EIXOS_DADOS.map((eixo) => ({ eixo, sinal: sinalParaDentro(canto, eixo) }));
}

/** Com a origem nesse canto e esse X, o Y deixa o Z (X × Y) apontando pra dentro da caixa? Das duas
 * arestas que sobram pro Y só uma deixa: a outra exigiria espelhar o elemento, não só girá-lo */
export function yValido(canto: Canto, x: Direcao, y: Direcao): boolean {
  if (y.eixo === x.eixo) return false;
  const z = direcaoZ({ x, y });
  return z.sinal === sinalParaDentro(canto, z.eixo);
}

/**
 * Onde a origem fica e como o elemento é girado pra os eixos próprios apontarem como pedido, com a
 * caixa ocupando o mesmo lugar no pai: `caixaMin` é o canto mínimo dela (traseiro esquerdo inferior)
 * e `medidas` as extensões nos eixos do pai (largura em X, profundidade em Y, altura em Z). Devolve
 * também as medidas nos eixos PRÓPRIOS do elemento, que é como ele as guarda.
 */
export function transformacaoInicial(
  eixos: EixosIniciais,
  caixaMin: Posicao,
  medidas: Posicao,
): { posicao: Posicao; rotacao: Rotacao; medidasProprias: Posicao } {
  const z = direcaoZ(eixos);
  const origem = origemDaCaixa(eixos, caixaMin, medidas);
  const matriz = new Matrix4()
    .makeBasis(vetor(eixos.x), vetor(eixos.y), vetor(z))
    .setPosition(origem.x, origem.y, origem.z);
  return {
    ...decompor(matriz),
    medidasProprias: { x: medidas[eixos.x.eixo], y: medidas[eixos.y.eixo], z: medidas[z.eixo] },
  };
}

/** Posição da origem (nos eixos do pai) de uma caixa com esse canto mínimo e essas medidas */
export function origemDaCaixa(eixos: EixosIniciais, caixaMin: Posicao, medidas: Posicao): Posicao {
  const canto = cantoDaOrigem(eixos);
  return {
    x: caixaMin.x + canto.x * medidas.x,
    y: caixaMin.y + canto.y * medidas.y,
    z: caixaMin.z + canto.z * medidas.z,
  };
}

/**
 * Os eixos próprios que uma rotação representa (pra onde apontam o X e o Y do elemento nos eixos do
 * pai), ou nulo se ela não é um múltiplo de 90° — aí não há como descrever em direções inteiras
 */
export function eixosDaRotacao(rotacao: Rotacao): EixosIniciais | null {
  const matriz = matrizLocal({ x: 0, y: 0, z: 0 }, rotacao);
  const direcao = (coluna: number): Direcao | null => {
    const v = new Vector3().setFromMatrixColumn(matriz, coluna);
    const eixo = EIXOS_DADOS.find((e) => Math.abs(Math.abs(v[e]) - 1) < 1e-3);
    return eixo ? { eixo, sinal: v[eixo] > 0 ? 1 : -1 } : null;
  };
  const x = direcao(0);
  const y = direcao(1);
  return x && y ? { x, y } : null;
}
