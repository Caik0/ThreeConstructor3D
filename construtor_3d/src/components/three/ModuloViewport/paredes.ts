// Geometria de paredes (com vãos recortados) e pisos.

import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Parede, type Piso } from '../../../lib/projetos/projetos';
import { type ElementoEditor } from '../../../store/editorStore';
import { COR_PAREDE, COR_PISO, SENTIDO_Z } from './constantes';
import { definirMalha, dividirPorFaces } from './malhas';
import { type CelulaParede, type ObjetoElemento, type VaoParaRecorte } from './tipos';

// Parede: comprimento no eixo local X a partir da origem, altura em Y a partir do chão (mesma
// origem em canto das peças), mas espessura em Z CENTRALIZADA na origem — a origem é o eixo
// central da parede, como o SketchUp trata a linha desenhada, não uma das faces
// Sem vãos: uma caixa só, como sempre foi
function criarCaixaParede(comprimento: number, altura: number, espessura: number) {
  const geometria = new BoxGeometry(comprimento, altura, espessura);
  geometria.translate(comprimento / 2, altura / 2, 0);
  return geometria;
}

export function vaoParaRecorte(elemento: ElementoEditor): VaoParaRecorte | null {
  if (!elemento.abertura) return null;
  return {
    deslocamento: elemento.posicao.x,
    peitoril: elemento.posicao.z,
    largura: elemento.abertura.largura,
    altura: elemento.abertura.altura,
  };
}

// Decompõe a face da parede numa grade (as bordas de cada vão cortam linhas verticais e
// horizontais) e devolve uma célula por retângulo que não cai dentro de nenhum vão — vira sozinho
// as vergas (acima), peitoris (abaixo) e ombreiras (dos lados) de cada abertura, sem precisar de
// nenhuma biblioteca de CSG (o three.js não recorta sólidos nativamente). Usada tanto pra montar
// a geometria da parede quanto pra checar colisão célula a célula (em vez da caixa inteira),
// assim um módulo consegue atravessar o vão de verdade, não só visualmente
export function celulasParede(comprimento: number, altura: number, vaosElementos: ElementoEditor[]): CelulaParede[] {
  const aberturas = vaosElementos.map(vaoParaRecorte).filter((v) => v !== null);
  const paredeInteira = [{ x0: 0, x1: comprimento, y0: 0, y1: altura }];
  if (aberturas.length === 0) return paredeInteira;

  const bordasX = new Set([0, comprimento]);
  const bordasY = new Set([0, altura]);
  for (const abertura of aberturas) {
    bordasX.add(Math.min(comprimento, Math.max(0, abertura.deslocamento)));
    bordasX.add(Math.min(comprimento, Math.max(0, abertura.deslocamento + abertura.largura)));
    bordasY.add(Math.min(altura, Math.max(0, abertura.peitoril)));
    bordasY.add(Math.min(altura, Math.max(0, abertura.peitoril + abertura.altura)));
  }
  const xs = [...bordasX].sort((a, b) => a - b);
  const ys = [...bordasY].sort((a, b) => a - b);

  const celulas: CelulaParede[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const y0 = ys[j];
      const y1 = ys[j + 1];
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;

      // O centro da célula decide se ela é parede (sobra) ou vão (é pulada); como as bordas de
      // toda abertura já viraram linhas da grade, nenhuma célula atravessa a borda de um vão
      const centroX = (x0 + x1) / 2;
      const centroY = (y0 + y1) / 2;
      const dentroDeAlgumVao = aberturas.some(
        (a) =>
          centroX > a.deslocamento &&
          centroX < a.deslocamento + a.largura &&
          centroY > a.peitoril &&
          centroY < a.peitoril + a.altura,
      );
      if (dentroDeAlgumVao) continue;

      celulas.push({ x0, x1, y0, y1 });
    }
  }
  return celulas.length > 0 ? celulas : paredeInteira;
}

export function criarGeometriaParede({ comprimento, altura, espessura }: Parede, vaosElementos: ElementoEditor[]) {
  if (vaosElementos.length === 0) return criarCaixaParede(comprimento, altura, espessura);

  const blocos = celulasParede(comprimento, altura, vaosElementos).map((c) => {
    const bloco = new BoxGeometry(c.x1 - c.x0, c.y1 - c.y0, espessura);
    bloco.translate(c.x0 + (c.x1 - c.x0) / 2, c.y0 + (c.y1 - c.y0) / 2, 0);
    return bloco;
  });

  const geometria = mergeGeometries(blocos) ?? criarCaixaParede(comprimento, altura, espessura);
  for (const bloco of blocos) bloco.dispose();
  return geometria;
}

// Arestas de uma parede com vãos: o contorno de `criarGeometriaParede` é feito de vários blocos
// colados (um por célula que sobra do recorte, ver celulasParede), e EdgesGeometry não enxerga
// que as bordas onde dois blocos se tocam são o mesmo plano contínuo — o resultado é um risco
// (uma aresta "fantasma") em cada costura interna, riscando a parede toda em vez de só contornar
// o vão. Em vez de calcular as arestas em cima desses blocos, usa o contorno da caixa inteira (sem
// nenhum recorte, sempre limpo) e desenha o retângulo de cada vão por cima, à mão
function criarArestasParede(parede: Parede, vaos: ElementoEditor[]): BufferGeometry {
  const caixa = criarCaixaParede(parede.comprimento, parede.altura, parede.espessura);
  const base = new EdgesGeometry(caixa, 30);
  caixa.dispose();
  if (vaos.length === 0) return base;

  const pontos = [...base.getAttribute('position').array];
  base.dispose();

  for (const vaoElemento of vaos) {
    const vao = vaoParaRecorte(vaoElemento);
    if (!vao) continue;
    const cantos: [number, number][] = [
      [vao.deslocamento, vao.peitoril],
      [vao.deslocamento + vao.largura, vao.peitoril],
      [vao.deslocamento + vao.largura, vao.peitoril + vao.altura],
      [vao.deslocamento, vao.peitoril + vao.altura],
    ];
    // Um retângulo em cada face (frente e fundo), como uma moldura em volta do vão
    for (const z of [parede.espessura / 2, -parede.espessura / 2]) {
      for (let i = 0; i < cantos.length; i++) {
        const [ax, ay] = cantos[i];
        const [bx, by] = cantos[(i + 1) % cantos.length];
        pontos.push(ax, ay, z, bx, by, z);
      }
    }
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute('position', new Float32BufferAttribute(pontos, 3));
  return geometria;
}

export function definirParede(
  objeto: ObjetoElemento,
  chave: string,
  parede: Parede,
  vaos: ElementoEditor[],
  comTexturas: boolean,
) {
  definirMalha(objeto, chave, criarGeometriaParede(parede, vaos), COR_PAREDE);
  // Substitui as arestas que definirMalha calculou (em cima dos blocos do recorte, com costuras
  // fantasma — ver criarArestasParede) pelo contorno limpo
  if (objeto.arestas) {
    objeto.arestas.geometry.dispose();
    objeto.arestas.geometry = criarArestasParede(parede, vaos);
  }
  // Com texturas, a geometria é dividida por face (como nos modelos 3D), pra cada face da caixa da
  // parede (frente, fundo, topo, base, extremidades e laterais dos vãos) ter a sua imagem; as
  // arestas continuam as da geometria inteira
  if (comTexturas && objeto.malha) {
    const inteira = objeto.malha.geometry;
    objeto.malha.geometry = dividirPorFaces(inteira);
    inteira.dispose();
  }
  objeto.geometriaDividida = comTexturas;
  objeto.parede = parede;
  objeto.vaos = vaos;
}

// Piso: polígono no plano X/Y dos dados (mesma origem em canto, um vértice não precisa ficar em
// 0,0) extrudado por uma espessura em Z a partir da origem. Girar o Shape -90° em X pra deitá-lo
// leva o y da forma pra -Z na cena; como o Y dos dados é SENTIDO_Z * (Z da cena), o Shape recebe
// `-SENTIDO_Z * y` (com SENTIDO_Z = +1 o contorno entra espelhado, e o ExtrudeGeometry já refaz a
// orientação das faces sozinho)
function criarGeometriaPiso({ vertices, espessura }: Piso) {
  const contorno = new Shape(vertices.map((v) => new Vector2(v.x, -SENTIDO_Z * v.y)));
  const geometria = new ExtrudeGeometry(contorno, { depth: espessura, bevelEnabled: false });
  geometria.rotateX(-Math.PI / 2);
  return geometria;
}

export function definirPiso(objeto: ObjetoElemento, chave: string, piso: Piso, comTexturas: boolean) {
  definirMalha(objeto, chave, criarGeometriaPiso(piso), COR_PISO);
  // Com texturas, a geometria é dividida por face (topo, base e bordas), como nas paredes
  if (comTexturas && objeto.malha) {
    const inteira = objeto.malha.geometry;
    objeto.malha.geometry = dividirPorFaces(inteira);
    inteira.dispose();
  }
  objeto.geometriaDividida = comTexturas;
  objeto.piso = piso;
}
