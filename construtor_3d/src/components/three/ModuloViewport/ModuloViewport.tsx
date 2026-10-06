import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  GridHelper,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  MathUtils,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Shape,
  Sphere,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Intersection,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import CampoMedida from '../../ui/CampoMedida/CampoMedida';
import { FACES_MODELO, FACES_TEXTURA, facesDaForma, FORMAS, parametrosValidos } from '../../../lib/formas/formas';
import { formatarCm } from '../../../lib/medidas/medidas';
import {
  LIMITE_POSICAO,
  MEDIDA_MAXIMA,
  MEDIDA_MINIMA,
  PAREDE_COMPRIMENTO_MAXIMO,
  paredeValida,
  pisoValido,
  type Forma,
  type Parede,
  type Piso,
  type Posicao,
  type Rotacao,
} from '../../../lib/projetos/projetos';
import { useImportacaoAutomaticaTexturas } from '../../../lib/hooks/useImportacaoAutomaticaTexturas';
import { useTexturas } from '../../../lib/hooks/useTexturas';
import { extrairMalhaDoCanto } from '../../../lib/modelo3d/modelo3d';
import { ehCorSolida, lerTexturaJpeg } from '../../../lib/textura/textura';
import { normalizarGraus } from '../../../lib/transformacoes/transformacoes';
import {
  alvoEdicaoParede,
  anguloGraus,
  aplicarEngatesNasPontas,
  calcularEncaixe,
  construirSegmentosParede,
  deslocamentoExplosaoRecursivo,
  distanciaXY,
  estaDentro,
  limitesLocais,
  type ElementoEditor,
  type EngateParede,
  type Ferramenta,
} from '../../../store/editorStore';
import styles from './ModuloViewport.module.css';

const COR_PECA = 0xb8b8b8;
const COR_PAREDE = 0xcdc4b3;
const COR_PISO = 0x9c8a72;
const COR_SELECIONADA = 0xb51b33;
const COR_SELECIONADA_TEXTURA = 0xff9a9a;
// Tolerância (mm) para não acusar colisão em elementos apenas encostados (grudados pelo encaixe)
const TOLERANCIA_COLISAO = 1;
// Opacidade do que fica fora do grupo aberto, como o esmaecimento do SketchUp
const OPACIDADE_FORA_DO_CONTEXTO = 0.2;
// Deslocamento máximo do ponteiro (px) para contar como clique e não como arrasto. 4px já bastava
// pra mouse, mas um toque no celular quase sempre se move mais que isso sozinho (área de contato
// do dedo, pulso da mão) — ficava interpretando um toque parado como arraste (girava a câmera ou
// arrastava um vértice sem querer), bem notado nas ferramentas de clique preciso (parede, trena)
const TOLERANCIA_CLIQUE = 10;
// Passo do movimento pelas setas, em mm
const PASSO_MOVIMENTO = 10;
// Passo da rotação pelos anéis, em graus
const PASSO_ROTACAO = 15;
// Profundidade positiva (Y nos dados do app) aponta para longe de quem olha, como no SketchUp;
// no three.js o Z nativo positivo aponta para a câmera, então a cena usa -Z nesse eixo (ver os
// pontos onde os dados viram a cena, ex.: o `y` de container.position.set(x, z, SENTIDO_Z * y))
const SENTIDO_Z = -1;
// Cores dos eixos X, Y (altura) e Z, as mesmas das setas de mover
const CORES_EIXOS = [0xe5484d, 0x3e7bfa, 0x46a758];
// Comprimento mínimo dos eixos da seleção, em mm
const COMPRIMENTO_MINIMO_EIXOS = 300;
// Destaque da seleção: linha contínua, vermelha forte em objetos (peças) e azul em grupos
const COR_DESTAQUE_OBJETO = 0xff1a2e;
const COR_DESTAQUE_GRUPO = 0x1f7bff;
// Piso e caixa tracejada da planta do ambiente (etapa "Planta do ambiente" do assistente)
const COR_PISO_SALA = 0xd7d2c8;
const COR_CAIXA_SALA = 0x8e9aa8;
// Pé-direito padrão das paredes desenhadas quando o projeto não tem planta do ambiente
const PE_DIREITO_PADRAO = 2700;
const ESPESSURA_PADRAO_PAREDE = 100;
// Distância (mm) para clicar perto do primeiro ponto e fechar o contorno de paredes
const LIMIAR_FECHAR_CONTORNO = 150;
// Distância (graus) do ângulo reto (múltiplo de 90°) mais próximo pra travar nele ao marcar o
// próximo canto de uma parede, facilitando desenhar linhas retas sem precisão de pixel
const LIMIAR_TRAVAR_ANGULO = 4;

interface ModuloViewportProps {
  elementos: Record<string, ElementoEditor>;
  /** Planta do ambiente (X largura, Y pé-direito, Z profundidade); nula em projetos antigos */
  planta: Posicao | null;
  selecionada: string | null;
  /** Demais elementos selecionados junto de `selecionada` (Ctrl/Cmd+Click); recebem o mesmo
   * destaque dela, mas não o gizmo de mover/girar (esse continua só na primária) */
  selecaoExtra: string[];
  contexto: string | null;
  ferramenta: Ferramenta;
  /** Vista Explodida ativa (afasta os filhos diretos de `explodido.chave` do centro dele) */
  explodido: { chave: string; distancia: number } | null;
  /** `comCtrl`: Ctrl/Cmd estava pressionado no clique (alterna a seleção múltipla, em vez de
   * substituir a seleção) */
  onClicarPeca: (chavePeca: string | null, comCtrl: boolean) => void;
  onDuploCliquePeca: (chavePeca: string) => void;
  /** Arraste das setas (posição) ou dos anéis (rotação) */
  onTransformar: (chave: string, alteracao: { posicao?: Posicao; rotacao?: Rotacao }) => void;
  /**
   * Desenho de paredes concluído (Enter ou fechando o contorno), com os cantos e se fechou o
   * contorno; `chaveAlvo` é o grupo de paredes ou a parede avulsa sendo reeditada, ou null quando
   * é um desenho novo. `engateInicio`/`engateFim`: a ponta correspondente (só faz sentido num
   * contorno aberto) foi encostada numa parede já existente — ver EngateParede no editorStore
   */
  onConcluirParedes: (
    pontos: Posicao[],
    fechado: boolean,
    opcoes: { altura: number; espessura: number },
    chaveAlvo: string | null,
    engateInicio?: EngateParede,
    engateFim?: EngateParede,
  ) => void;
  onCancelarParede: () => void;
  onPintarFace: (chave: string, face: string, imagem: string | null) => void;
  /** Aplica (ou, com `null`, remove) uma textura em todas as faces de um grupo de uma vez — ver
   * `Elemento.gruposDeFace` */
  onPintarGrupo: (chave: string, nomeGrupo: string, imagem: string | null) => void;
}

// Objetos 3D de um elemento: o contêiner leva a posição relativa ao pai e recebe os
// contêineres dos filhos; peças têm também malha e arestas dentro dele
interface ObjetoElemento {
  container: Group;
  malha?: Mesh<BufferGeometry, MeshStandardMaterial | MeshStandardMaterial[]>;
  arestas?: LineSegments<BufferGeometry, LineBasicMaterial>;
  forma?: Forma;
  modelo?: Group;
  modeloTamanhoNativo?: Posicao;
  modelo3dCarregando?: string;
  descartado?: boolean;
  parede?: Parede;
  vaos?: ElementoEditor[];
  piso?: Piso;
  corBase?: number;
  texturas?: (string | null)[];
  texturasModelo?: (string | null)[];
  geometriaDividida?: boolean;
  tamanhoAlvo?: Posicao;
  texturasAlvo?: Record<string, string>;
  caixa?: LineSegments<BufferGeometry, LineBasicMaterial>;
  etiqueta?: CSS2DObject;
  etiquetaConteudo?: string;
}

// Piso e caixa tracejada da planta do ambiente: mesma origem em canto usada pelas peças e grupos
interface Sala {
  grupo: Group;
  chao: Mesh<PlaneGeometry, MeshBasicMaterial>;
  caixa: LineSegments<BufferGeometry, LineDashedMaterial>;
}

// Pré-visualização do construtor de paredes: desenhada direto no piso da cena 3D, sobre o
// alvo real (não usa `objetos`, que só existe para elementos já salvos na árvore)
interface DesenhoParede {
  grupo: Group;
  segmentos: Group;
  materialSegmento: MeshStandardMaterial;
  marcadores: Group;
  elastico: Mesh<BufferGeometry, MeshStandardMaterial>;
  marcadorFechar: Mesh<SphereGeometry, MeshBasicMaterial>;
}

// Trena: mesma ideia da pré-visualização das paredes (grupo à parte, escondido quando a
// ferramenta não está ativa), mas os pontos podem estar em qualquer Y (não só no piso) e cada
// segmento mostra a própria medida numa etiqueta, em vez de virar geometria de verdade
interface DesenhoTrena {
  grupo: Group;
  linha: Line<BufferGeometry, LineBasicMaterial>;
  elastico: Line<BufferGeometry, LineBasicMaterial>;
  marcadores: Group;
  etiquetas: Group;
}

interface Cena {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  transform: TransformControls;
  renderer: WebGLRenderer;
  raiz: Group;
  sala: Sala;
  eixosAmbiente: Group;
  eixosSelecao: Group;
  alvoEixos: Object3D | null;
  parede: DesenhoParede;
  trena: DesenhoTrena;
}

// A geometria crua (FORMAS[tipo].criarGeometria) já nasce com a altura no Y nativo do three.js
// (convenção da própria biblioteca, ver criarGeometriaCaixa/CylinderGeometry) — mas `tamanho` é o
// Tamanho dos DADOS do app, onde quem é altura é o Z (ver FORMAS[tipo].tamanho); por isso
// tamanho.z alimenta o Y da cena aqui, e tamanho.y (profundidade) o Z dela
function criarGeometria({ tipo, parametros }: Forma) {
  const geometria = FORMAS[tipo].criarGeometria(parametros);
  const tamanho = FORMAS[tipo].tamanho(parametros);
  geometria.translate(tamanho.x / 2, tamanho.z / 2, (SENTIDO_Z * tamanho.y) / 2);
  return geometria;
}

// Cria a malha e as arestas na primeira vez, e troca só a geometria nas seguintes
function definirMalha(objeto: ObjetoElemento, chave: string, geometria: BufferGeometry, corBase: number) {
  if (objeto.malha && objeto.arestas) {
    objeto.malha.geometry.dispose();
    objeto.arestas.geometry.dispose();
    objeto.malha.geometry = geometria;
    objeto.arestas.geometry = new EdgesGeometry(geometria, 30);
  } else {
    objeto.malha = new Mesh(geometria, new MeshStandardMaterial({ color: corBase }));
    objeto.malha.userData.chave = chave;
    objeto.arestas = new LineSegments(
      new EdgesGeometry(geometria, 30),
      new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    );
    objeto.container.add(objeto.malha, objeto.arestas);
  }
  objeto.corBase = corBase;
}

const materiaisDe = (malha: NonNullable<ObjetoElemento['malha']>) =>
  Array.isArray(malha.material) ? malha.material : [malha.material];

const carregadorTextura = new TextureLoader();

// Aplica cor sólida ou imagem por face: com algo em alguma face a malha passa a ter um material
// por face (as demais seguem com a cor base); sem nada, volta a ter um material só
function definirTexturas(objeto: ObjetoElemento, faces: string[], texturas: Record<string, string> | undefined) {
  const malha = objeto.malha;
  if (!malha) return;
  const valores = faces.map((face) => texturas?.[face] ?? null);
  const atuais = objeto.texturas ?? faces.map(() => null);
  if (valores.every((v, i) => v === atuais[i]) && Array.isArray(malha.material) === valores.some(Boolean)) return;

  if (!valores.some(Boolean)) {
    for (const material of materiaisDe(malha)) {
      material.map?.dispose();
      material.dispose();
    }
    malha.material = new MeshStandardMaterial({ color: objeto.corBase ?? COR_PECA });
    objeto.texturas = undefined;
    return;
  }

  if (!Array.isArray(malha.material)) {
    malha.material.dispose();
    malha.material = faces.map(() => new MeshStandardMaterial({ color: objeto.corBase ?? COR_PECA }));
  }
  const materiais = malha.material as MeshStandardMaterial[];
  objeto.texturas = valores;
  valores.forEach((valor, i) => {
    // Cor sólida é instantânea (sem imagem pra carregar); imagem só é reprocessada se mudou ou
    // ainda não tinha carregado (o mapa some quando a face volta a ficar sem imagem)
    if (valor !== null && ehCorSolida(valor)) {
      if (valor === atuais[i] && !materiais[i].map) return;
      materiais[i].map?.dispose();
      materiais[i].map = null;
      materiais[i].needsUpdate = true;
      materiais[i].color.set(valor);
      return;
    }
    if (valor === atuais[i] && (materiais[i].map || !valor)) return;
    materiais[i].map?.dispose();
    materiais[i].map = null;
    materiais[i].needsUpdate = true;
    if (!valor) {
      materiais[i].color.set(objeto.corBase ?? COR_PECA);
      return;
    }
    materiais[i].color.set(0xffffff);
    carregadorTextura.load(valor, (textura) => {
      if (objeto.descartado || objeto.texturas?.[i] !== valor) {
        textura.dispose();
        return;
      }
      textura.colorSpace = SRGBColorSpace;
      materiais[i].map = textura;
      materiais[i].needsUpdate = true;
    });
  });
}

// Modelo 3D: não há "faces" de verdade, então cada triângulo vai pra face da caixa envolvente que
// mais se parece com a direção dele (a da maior componente da normal), e a imagem é projetada
// plana nessa face (u/v vistos de fora dela, como numa caixa). A geometria dividida é guardada na
// própria malha pra não refazer; a original volta quando as texturas saem
interface OriginalMalha {
  geometria: BufferGeometry;
  material: Material | Material[];
  dividida?: BufferGeometry;
  materiais?: MeshStandardMaterial[];
}

// Direção dominante de uma normal → índice da face, na mesma ordem de FACES_TEXTURA.caixa
// (direita, esquerda, topo, base, frente, fundo). Usada tanto por dividirPorFaces (a partir da
// normal de cada triângulo, pra dividir a malha inteira) quanto pelo balde de tinta (a partir da
// normal que o próprio raycaster já devolve, pra descobrir só a face clicada)
function indiceFaceDaNormal(n: { x: number; y: number; z: number }): number {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  return ax >= ay && ax >= az ? (n.x >= 0 ? 0 : 1) : ay >= az ? (n.y >= 0 ? 2 : 3) : n.z >= 0 ? 4 : 5;
}

function faceClicada(elemento: ElementoEditor, normal: { x: number; y: number; z: number }): string {
  if (elemento.forma && facesDaForma(elemento.forma) === FACES_TEXTURA.cilindro) {
    return Math.abs(normal.y) > 0.5 ? (normal.y >= 0 ? 'topo' : 'base') : 'lateral';
  }
  return FACES_TEXTURA.caixa[indiceFaceDaNormal(normal)];
}

function dividirPorFaces(origem: BufferGeometry): BufferGeometry {
  const g = origem.index ? origem.toNonIndexed() : origem.clone();
  g.computeBoundingBox();
  const { min, max } = g.boundingBox as Box3;
  const tam = { x: max.x - min.x || 1, y: max.y - min.y || 1, z: max.z - min.z || 1 };
  const pos = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  const triangulos = pos.count / 3;

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const grupos: number[][] = FACES_MODELO.map(() => []);
  for (let t = 0; t < triangulos; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const n = b.sub(a).cross(c.sub(a));
    grupos[indiceFaceDaNormal(n)].push(t);
  }

  const posicoes: number[] = [];
  const normais: number[] = [];
  const uvs: number[] = [];
  const dividida = new BufferGeometry();
  let inicio = 0;
  grupos.forEach((triangulosDaFace, indice) => {
    for (const t of triangulosDaFace) {
      for (let k = 0; k < 3; k++) {
        const v = t * 3 + k;
        const x = pos.getX(v);
        const y = pos.getY(v);
        const z = pos.getZ(v);
        posicoes.push(x, y, z);
        if (normal) normais.push(normal.getX(v), normal.getY(v), normal.getZ(v));
        const nx = (x - min.x) / tam.x;
        const ny = (y - min.y) / tam.y;
        const nz = (z - min.z) / tam.z;
        // Olhando cada face de fora, com o topo da imagem pra cima (e, no topo/base, pro fundo)
        if (indice === 0) uvs.push(1 - nz, ny);
        else if (indice === 1) uvs.push(nz, ny);
        else if (indice === 2) uvs.push(nx, 1 - nz);
        else if (indice === 3) uvs.push(nx, nz);
        else if (indice === 4) uvs.push(nx, ny);
        else uvs.push(1 - nx, ny);
      }
    }
    if (triangulosDaFace.length > 0) dividida.addGroup(inicio, triangulosDaFace.length * 3, indice);
    inicio += triangulosDaFace.length * 3;
  });
  g.dispose();

  dividida.setAttribute('position', new Float32BufferAttribute(posicoes, 3));
  if (normal) dividida.setAttribute('normal', new Float32BufferAttribute(normais, 3));
  else dividida.computeVertexNormals();
  dividida.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  // Sem isso, essa geometria nasce sem boundingSphere (o culling do three.js só supre isso na
  // primeira vez que precisar dela, o que pode já ser tarde/desatualizado) — foi essa falta,
  // reintroduzida aqui toda vez que uma peça de modelo 3D ganha textura por face, que fazia peça
  // sumir ao orbitar mesmo depois de extrairMalhaDoCanto já calcular a dela na malha original
  dividida.computeBoundingBox();
  dividida.computeBoundingSphere();
  return dividida;
}

function malhasDoModelo(objeto: ObjetoElemento): Mesh[] {
  const malhas: Mesh[] = [];
  objeto.modelo?.traverse((filho) => {
    if (filho instanceof Mesh) malhas.push(filho);
  });
  return malhas;
}

// Devolve as malhas do modelo à geometria/material do arquivo, descartando só o que foi criado aqui
function restaurarTexturasModelo(objeto: ObjetoElemento) {
  for (const malha of malhasDoModelo(objeto)) {
    const original = malha.userData.original as OriginalMalha | undefined;
    if (!original) continue;
    malha.geometry = original.geometria;
    malha.material = original.material;
    original.dividida?.dispose();
    for (const material of original.materiais ?? []) {
      material.map?.dispose();
      material.dispose();
    }
    delete malha.userData.original;
  }
  objeto.texturasModelo = undefined;
}

function definirTexturasModelo(objeto: ObjetoElemento, texturas: Record<string, string> | undefined) {
  if (!objeto.modelo) return;
  const valores = FACES_MODELO.map((face) => texturas?.[face] ?? null);
  const atuais = objeto.texturasModelo ?? FACES_MODELO.map(() => null);
  if (valores.every((v, i) => v === atuais[i])) return;

  restaurarTexturasModelo(objeto);
  if (!valores.some(Boolean)) return;
  objeto.texturasModelo = valores;

  for (const malha of malhasDoModelo(objeto)) {
    const materialOriginal = Array.isArray(malha.material) ? malha.material[0] : malha.material;
    const original: OriginalMalha = { geometria: malha.geometry, material: malha.material };
    original.dividida = dividirPorFaces(malha.geometry);
    // Cor sólida já sai pronta (color); imagem começa branca (0xffffff), até a textura carregar
    original.materiais = valores.map(
      (valor) => new MeshStandardMaterial({ color: valor && ehCorSolida(valor) ? valor : 0xffffff, visible: valor !== null }),
    );
    malha.userData.original = original;
    malha.geometry = original.dividida;
    // Face sem textura segue com o material do arquivo; com textura, um material só com a cor/imagem
    malha.material = valores.map((valor, i) => (valor ? original.materiais![i] : materialOriginal));

    valores.forEach((valor, i) => {
      if (!valor || ehCorSolida(valor)) return;
      carregadorTextura.load(valor, (textura) => {
        if (objeto.descartado || objeto.texturasModelo?.[i] !== valor || malha.userData.original !== original) {
          textura.dispose();
          return;
        }
        textura.colorSpace = SRGBColorSpace;
        (original.materiais as MeshStandardMaterial[])[i].map = textura;
        (original.materiais as MeshStandardMaterial[])[i].needsUpdate = true;
      });
    });
  }
}

function definirForma(objeto: ObjetoElemento, chave: string, forma: Forma) {
  definirMalha(objeto, chave, criarGeometria(forma), COR_PECA);
  objeto.forma = forma;
}

// Parede: comprimento no eixo local X a partir da origem, altura em Y a partir do chão (mesma
// origem em canto das peças), mas espessura em Z CENTRALIZADA na origem — a origem é o eixo
// central da parede, como o SketchUp trata a linha desenhada, não uma das faces
// Sem vãos: uma caixa só, como sempre foi
function criarCaixaParede(comprimento: number, altura: number, espessura: number) {
  const geometria = new BoxGeometry(comprimento, altura, espessura);
  geometria.translate(comprimento / 2, altura / 2, 0);
  return geometria;
}

// Um vão pronto pra recortar: deslocamento/peitoril vêm da posição do elemento dele (relativa à
// origem da parede-mãe), largura/altura são as medidas próprias dele
interface VaoParaRecorte {
  deslocamento: number;
  peitoril: number;
  largura: number;
  altura: number;
}

function vaoParaRecorte(elemento: ElementoEditor): VaoParaRecorte | null {
  if (!elemento.abertura) return null;
  return {
    deslocamento: elemento.posicao.x,
    peitoril: elemento.posicao.z,
    largura: elemento.abertura.largura,
    altura: elemento.abertura.altura,
  };
}

// Um retângulo (no plano X/Y local da parede) que sobrou do recorte dos vãos
interface CelulaParede {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// Decompõe a face da parede numa grade (as bordas de cada vão cortam linhas verticais e
// horizontais) e devolve uma célula por retângulo que não cai dentro de nenhum vão — vira sozinho
// as vergas (acima), peitoris (abaixo) e ombreiras (dos lados) de cada abertura, sem precisar de
// nenhuma biblioteca de CSG (o three.js não recorta sólidos nativamente). Usada tanto pra montar
// a geometria da parede quanto pra checar colisão célula a célula (em vez da caixa inteira),
// assim um módulo consegue atravessar o vão de verdade, não só visualmente
function celulasParede(comprimento: number, altura: number, vaosElementos: ElementoEditor[]): CelulaParede[] {
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

function criarGeometriaParede({ comprimento, altura, espessura }: Parede, vaosElementos: ElementoEditor[]) {
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

// Caixas de colisão de uma parede, uma por célula que sobrou do recorte dos vãos, já em
// coordenadas do mundo (Box3.applyMatrix4 recalcula os cantos certos mesmo com a parede girada)
function caixasColisaoParede(objeto: ObjetoElemento, parede: Parede, vaos: ElementoEditor[]): Box3[] {
  return celulasParede(parede.comprimento, parede.altura, vaos).map((c) =>
    new Box3(
      new Vector3(c.x0, c.y0, -parede.espessura / 2),
      new Vector3(c.x1, c.y1, parede.espessura / 2),
    ).applyMatrix4(objeto.container.matrixWorld),
  );
}

function definirParede(
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
// 0,0) extrudado por uma espessura em Z a partir da origem. O Shape usa (x, y) diretamente — sem
// espelhar o Y — porque extrudar ao longo do eixo local da forma e depois girar -90° em X pra
// deitá-la já produz o sinal certo (equivale ao SENTIDO_Z de todo o resto da cena)
function criarGeometriaPiso({ vertices, espessura }: Piso) {
  const contorno = new Shape(vertices.map((v) => new Vector2(v.x, v.y)));
  const geometria = new ExtrudeGeometry(contorno, { depth: espessura, bevelEnabled: false });
  geometria.rotateX(-Math.PI / 2);
  return geometria;
}

function definirPiso(objeto: ObjetoElemento, chave: string, piso: Piso, comTexturas: boolean) {
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

// Libera só a geometria (cópia própria desta peça, ver extrairMalhaDoCanto) de um `modelo`
// substituído ou removido; o material é o mesmo objeto do arquivo original, compartilhado com
// outras extrações da mesma malha (inclusive futuras, do mesmo import) — nunca é descartado
function descartarGrupoGltf(grupo: Group) {
  grupo.traverse((objeto) => {
    if (objeto instanceof Mesh) objeto.geometry.dispose();
  });
  grupo.removeFromParent();
}

// Peça importada de um .glb: carrega de forma assíncrona (GLTFLoader não tem uma versão síncrona)
// e substitui a malha anterior quando terminar — a árvore pode mudar nesse meio-tempo (o elemento
// pode ser removido, ou outro carregamento pode começar antes deste terminar), então só aplica o
// resultado se `objeto` ainda for o carregamento mais recente pedido pra essa peça
// A malha sempre carrega no tamanho original do arquivo: a escala aplicada é a razão até o
// tamanho atual do elemento
function ajustarModelo(objeto: ObjetoElemento) {
  const { modelo, modeloTamanhoNativo: nativo, tamanhoAlvo: alvo } = objeto;
  if (!modelo || !nativo || !alvo) return;
  // `nativo` é medido direto na malha carregada (Box3 sobre o three.js) — sempre Y nativo/altura,
  // Z nativo/profundidade, como qualquer objeto three.js. `alvo` é o Tamanho dos dados do app,
  // onde quem é altura é o Z (ver FORMAS[tipo].tamanho) — por isso alvo.z / nativo.y (não alvo.y)
  modelo.scale.set(alvo.x / (nativo.x || 1), alvo.z / (nativo.y || 1), alvo.y / (nativo.z || 1));
  definirTexturasModelo(objeto, objeto.texturasAlvo);
}

const chaveModelo3d = (modelo3d: string, modelo3dNo: string | undefined) => `${modelo3d}#${modelo3dNo ?? ''}`;

function definirModelo3d(objeto: ObjetoElemento, chave: string, modelo3d: string, modelo3dNo: string | undefined) {
  const carregamento = chaveModelo3d(modelo3d, modelo3dNo);
  if (objeto.modelo3dCarregando === carregamento) return;
  objeto.modelo3dCarregando = carregamento;

  extrairMalhaDoCanto(modelo3d, modelo3dNo)
    .then(({ geometria, material }) => {
      if (objeto.descartado || objeto.modelo3dCarregando !== carregamento) {
        geometria.dispose();
        return;
      }
      if (objeto.modelo) {
        restaurarTexturasModelo(objeto);
        descartarGrupoGltf(objeto.modelo);
      }
      const malha = new Mesh(geometria, material);
      malha.userData.chave = chave;
      objeto.modelo = new Group();
      objeto.modelo.add(malha);
      const tamanhoNativo = new Box3().setFromObject(objeto.modelo).getSize(new Vector3());
      objeto.modeloTamanhoNativo = { x: tamanhoNativo.x, y: tamanhoNativo.y, z: tamanhoNativo.z };
      objeto.container.add(objeto.modelo);
      ajustarModelo(objeto);
    })
    .catch((erro: unknown) => {
      console.error('Não foi possível carregar o modelo 3D da peça:', erro);
      if (objeto.modelo3dCarregando === carregamento) objeto.modelo3dCarregando = undefined;
    });
}

function aplicarAparencia(objeto: ObjetoElemento, selecionado: boolean, foraDoContexto: boolean) {
  const { malha, arestas } = objeto;
  if (!malha || !arestas) return;

  materiaisDe(malha).forEach((material, i) => {
    const pintura = objeto.texturas?.[i] ?? null;
    // Cor sólida: cor própria de verdade (não pode virar branco feito imagem, senão desaparece).
    // Imagem (carregada ou ainda carregando — `material.map` só existe depois de pronta): sem cor
    // própria (branco), pra ela aparecer fiel quando terminar de carregar. Selecionada, um tom
    // avermelhado por cima nos dois casos (mais suave que o normal, pra não esconder o conteúdo)
    if (selecionado) {
      material.color.setHex(pintura !== null ? COR_SELECIONADA_TEXTURA : COR_SELECIONADA);
    } else if (pintura !== null && ehCorSolida(pintura)) {
      material.color.set(pintura);
    } else if (pintura !== null) {
      material.color.setHex(0xffffff);
    } else {
      material.color.setHex(objeto.corBase ?? COR_PECA);
    }
    if (material.transparent !== foraDoContexto) {
      material.transparent = foraDoContexto;
      material.depthWrite = !foraDoContexto;
      material.needsUpdate = true;
    }
    material.opacity = foraDoContexto ? OPACIDADE_FORA_DO_CONTEXTO : 1;
  });
  // Selecionada: arestas em vermelho forte, contínuas e opacas
  arestas.material.color.setHex(selecionado ? COR_DESTAQUE_OBJETO : 0x000000);
  arestas.material.opacity = foraDoContexto ? 0.1 : selecionado ? 1 : 0.3;
}

// Caixa contínua com as medidas fixas (grupo, ou peça de modelo 3D): `cor` é o azul do grupo ou o
// vermelho forte do objeto; `discreta` (grupo só aberto pra edição, sem estar selecionado) a deixa
// mais fraca
function atualizarCaixaGrupo(
  objeto: ObjetoElemento,
  tamanho: Posicao | undefined,
  visivel: boolean,
  cor: number,
  discreta: boolean,
) {
  if (!visivel || !tamanho) {
    if (objeto.caixa) objeto.caixa.visible = false;
    return;
  }

  // tamanho.z é a altura nos dados do app; o Y nativo do BoxGeometry é quem precisa dela (ver
  // criarGeometria acima)
  const caixa = new BoxGeometry(tamanho.x, tamanho.z, tamanho.y);
  const geometria = new EdgesGeometry(caixa);
  caixa.dispose();
  geometria.translate(tamanho.x / 2, tamanho.z / 2, (SENTIDO_Z * tamanho.y) / 2);

  if (objeto.caixa) {
    objeto.caixa.geometry.dispose();
    objeto.caixa.geometry = geometria;
  } else {
    objeto.caixa = new LineSegments(geometria, new LineBasicMaterial({ transparent: true }));
    objeto.container.add(objeto.caixa);
  }

  objeto.caixa.material.color.setHex(cor);
  objeto.caixa.material.opacity = discreta ? 0.45 : 1;
  objeto.caixa.visible = true;
}

// Etiqueta flutuante (código único e/ou "M-N") no centro da face frontal do módulo — a mesma face
// onde `criarGeometria`/`atualizarCaixaGrupo` colocam a origem local (y=0); `limitesLocais` já dá
// o tamanho em qualquer tipo de peça/grupo, então a conta é a mesma nos dois casos
function definirEtiqueta(objeto: ObjetoElemento, elemento: ElementoEditor, esmaecida: boolean) {
  const conteudo = `${elemento.idUnico ?? ''}|${elemento.idSequencial ?? ''}`;
  if (!elemento.idUnico && !elemento.idSequencial) {
    if (objeto.etiqueta) {
      objeto.etiqueta.removeFromParent();
      objeto.etiqueta = undefined;
      objeto.etiquetaConteudo = undefined;
    }
    return;
  }

  if (!objeto.etiqueta || objeto.etiquetaConteudo !== conteudo) {
    const html = document.createElement('div');
    html.className = styles.etiqueta;
    if (elemento.idUnico) {
      const codigo = document.createElement('span');
      codigo.className = styles.etiquetaCodigo;
      codigo.textContent = elemento.idUnico;
      html.appendChild(codigo);
    }
    if (elemento.idSequencial) {
      const numero = document.createElement('span');
      numero.className = styles.etiquetaNumero;
      numero.textContent = elemento.idSequencial;
      html.appendChild(numero);
    }

    objeto.etiqueta?.removeFromParent();
    objeto.etiqueta = new CSS2DObject(html);
    objeto.etiquetaConteudo = conteudo;

    const caixa = limitesLocais(elemento);
    if (caixa) {
      objeto.etiqueta.position.set((caixa.min.x + caixa.max.x) / 2, (caixa.min.z + caixa.max.z) / 2, 0);
    }
    objeto.container.add(objeto.etiqueta);
  }

  objeto.etiqueta.element.style.opacity = esmaecida ? '0.35' : '1';
}

// Coordenadas normalizadas (-1..1) do ponteiro dentro do canvas, como o Raycaster espera
function ponteiroNormalizado(e: { clientX: number; clientY: number }, dom: HTMLElement): Vector2 {
  const area = dom.getBoundingClientRect();
  return new Vector2(
    ((e.clientX - area.left) / area.width) * 2 - 1,
    -((e.clientY - area.top) / area.height) * 2 + 1,
  );
}

// Um container pode estar com visible=true mas dentro de um grupo oculto (visible só reflete o
// próprio elemento, o three.js não desce essa flag pros filhos); o raycaster também não pula
// objeto/ancestral invisível sozinho (só afeta o desenho), então tem que checar a cadeia inteira
// até a raiz da cena
function visivelNaCena(objeto: Object3D): boolean {
  for (let atual: Object3D | null = objeto; atual !== null; atual = atual.parent) {
    if (!atual.visible) return false;
  }
  return true;
}

// Malhas clicáveis de todos os elementos visíveis (peças, paredes, pisos e modelos 3D importados),
// usada tanto pra selecionar quanto pra medir com a trena
function malhasVisiveis(objetos: Map<string, ObjetoElemento>): Mesh[] {
  return [...objetos.values()].flatMap((objeto) => {
    if (!visivelNaCena(objeto.container)) return [];
    if (objeto.malha) return [objeto.malha];
    if (objeto.modelo) {
      const malhasDoModelo: Mesh[] = [];
      objeto.modelo.traverse((filho) => {
        if (filho instanceof Mesh) malhasDoModelo.push(filho);
      });
      return malhasDoModelo;
    }
    return [];
  });
}

// Distância em pixels de tela pra "imantar" a trena num vértice (ver verticeMaisProximo) —
// generoso o bastante pro dedo no celular, sem grudar sozinho num clique mais afastado
const LIMIAR_IMA_VERTICE = 24;

// Os 8 cantos da caixa de cada elemento visível (peça, grupo ou parede), em coordenadas de
// mundo — já considerando rotação, por isso transforma cada canto individualmente em vez de usar
// Box3().setFromObject (que daria a caixa ALINHADA aos eixos da cena, maior que a peça de verdade
// se ela estiver girada, com cantos que não existem de verdade)
function verticesVisiveis(elementos: Record<string, ElementoEditor>, objetos: Map<string, ObjetoElemento>): Vector3[] {
  const pontos: Vector3[] = [];
  for (const [chave, elemento] of Object.entries(elementos)) {
    const objeto = objetos.get(chave);
    if (!objeto || !visivelNaCena(objeto.container)) continue;
    const caixa = limitesLocais(elemento);
    if (!caixa) continue;
    for (const x of [caixa.min.x, caixa.max.x]) {
      for (const y of [caixa.min.y, caixa.max.y]) {
        for (const z of [caixa.min.z, caixa.max.z]) {
          // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo,
          // espelhado (mesma fronteira de posicaoCena, mais abaixo)
          pontos.push(new Vector3(x, z, SENTIDO_Z * y).applyMatrix4(objeto.container.matrixWorld));
        }
      }
    }
  }
  return pontos;
}

// Vértice (dentre `pontos`) mais perto do ponteiro NA TELA, dentro de LIMIAR_IMA_VERTICE — em
// pixels, não em distância 3D, porque é assim que o olho julga "perto": um canto bem atrás de
// outra peça, mas alinhado com o clique na tela, ainda deve imantar
function verticeMaisProximo(
  pontos: Vector3[],
  e: { clientX: number; clientY: number },
  camera: PerspectiveCamera,
  dom: HTMLElement,
): Vector3 | null {
  const area = dom.getBoundingClientRect();
  const alvoX = e.clientX - area.left;
  const alvoY = e.clientY - area.top;
  const projetado = new Vector3();
  let melhor: Vector3 | null = null;
  let menorDistancia = LIMIAR_IMA_VERTICE;
  for (const ponto of pontos) {
    projetado.copy(ponto).project(camera);
    if (projetado.z < -1 || projetado.z > 1) continue; // atrás da câmera
    const px = ((projetado.x + 1) / 2) * area.width;
    const py = ((1 - projetado.y) / 2) * area.height;
    const distancia = Math.hypot(px - alvoX, py - alvoY);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = ponto;
    }
  }
  return melhor;
}

function descartarObjeto(objeto: ObjetoElemento) {
  // Impede um carregamento de modelo 3D ainda em andamento de aplicar o resultado (ou vazar
  // memória de GPU) num objeto que já saiu da árvore antes dele terminar
  objeto.descartado = true;
  objeto.container.removeFromParent();
  objeto.malha?.geometry.dispose();
  if (objeto.malha) {
    for (const material of materiaisDe(objeto.malha)) {
      material.map?.dispose();
      material.dispose();
    }
  }
  objeto.arestas?.geometry.dispose();
  objeto.arestas?.material.dispose();
  objeto.caixa?.geometry.dispose();
  objeto.caixa?.material.dispose();
  if (objeto.modelo) {
    restaurarTexturasModelo(objeto);
    descartarGrupoGltf(objeto.modelo);
  }
  // A etiqueta não tem geometria/material de GPU (é só um <div>); remover da cena já basta, e o
  // próprio CSS2DObject tira o elemento do DOM (ver o listener "removed" da classe)
  objeto.etiqueta?.removeFromParent();
}

// Eixos no estilo do SketchUp: contínuos no sentido positivo e tracejados no negativo.
// A geometria tem comprimento 1; o tamanho real vem da escala do grupo
function criarEixos(sobrepostos: boolean) {
  const eixos = new Group();
  CORES_EIXOS.forEach((cor, indice) => {
    const direcao = new Vector3().setComponent(indice, indice === 2 ? SENTIDO_Z : 1);
    const positivo = new Line(
      new BufferGeometry().setFromPoints([new Vector3(), direcao]),
      new LineBasicMaterial({ color: cor, depthTest: !sobrepostos }),
    );
    const negativo = new Line(
      new BufferGeometry().setFromPoints([new Vector3(), direcao.clone().negate()]),
      new LineDashedMaterial({ color: cor, dashSize: 0.03, gapSize: 0.02, depthTest: !sobrepostos }),
    );
    negativo.computeLineDistances();
    // Sobrepostos: desenhados por cima das peças, já que a origem costuma ficar dentro delas
    positivo.renderOrder = negativo.renderOrder = sobrepostos ? 1 : 0;
    eixos.add(positivo, negativo);
  });
  return eixos;
}

function descartarEixos(eixos: Group) {
  eixos.removeFromParent();
  for (const linha of eixos.children as Line<BufferGeometry, LineBasicMaterial>[]) {
    linha.geometry.dispose();
    linha.material.dispose();
  }
}

function criarSala(): Sala {
  const chao = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: COR_PISO_SALA, transparent: true, opacity: 0.5, side: DoubleSide }),
  );
  chao.rotation.x = -Math.PI / 2;

  const caixa = new LineSegments(
    new BufferGeometry(),
    new LineDashedMaterial({ color: COR_CAIXA_SALA, transparent: true, opacity: 0.6 }),
  );

  const grupo = new Group();
  grupo.add(chao, caixa);
  grupo.visible = false;
  return { grupo, chao, caixa };
}

// Piso e caixa vão do canto (0,0,0) até a planta (largura, pé-direito, profundidade),
// a mesma convenção de origem usada pelas peças e pelos grupos. planta.z é o pé-direito (altura)
// nos dados do app; planta.y é a profundidade — o Y/Z nativos do three.js usados aqui embaixo
// continuam Y=altura/Z=profundidade, como qualquer objeto da cena (ver criarGeometria)
function atualizarSala(sala: Sala, planta: Posicao | null) {
  sala.grupo.visible = planta !== null;
  if (!planta) return;

  sala.chao.geometry.dispose();
  sala.chao.geometry = new PlaneGeometry(planta.x, planta.y);
  // Levemente abaixo da grade (y=0), para as duas não disputarem o mesmo plano
  sala.chao.position.set(planta.x / 2, -0.5, SENTIDO_Z * (planta.y / 2));

  const volume = new BoxGeometry(planta.x, planta.z, planta.y);
  const geometria = new EdgesGeometry(volume);
  volume.dispose();
  geometria.translate(planta.x / 2, planta.z / 2, (SENTIDO_Z * planta.y) / 2);
  sala.caixa.geometry.dispose();
  sala.caixa.geometry = geometria;

  const traco = Math.max(planta.x, planta.y, planta.z) / 80;
  sala.caixa.material.dashSize = traco;
  sala.caixa.material.gapSize = traco * 0.6;
  sala.caixa.computeLineDistances();
}

function descartarSala(sala: Sala) {
  sala.grupo.removeFromParent();
  sala.chao.geometry.dispose();
  sala.chao.material.dispose();
  sala.caixa.geometry.dispose();
  sala.caixa.material.dispose();
}

// Índice do vértice mais próximo de `ponto`, dentro de LIMIAR_FECHAR_CONTORNO; null se nenhum
function indiceVerticeProximo(pontos: Posicao[], ponto: Posicao): number | null {
  let melhor: number | null = null;
  let menorDistancia = LIMIAR_FECHAR_CONTORNO;
  pontos.forEach((p, indice) => {
    const d = distanciaXY(p, ponto);
    if (d <= menorDistancia) {
      menorDistancia = d;
      melhor = indice;
    }
  });
  return melhor;
}

// Índice do segmento (entre pontos[i] e pontos[i+1]) mais próximo de `ponto`: perto o bastante da
// linha (perpendicular) e projetado dentro do próprio segmento, não perto demais das pontas (que
// já são tratadas por `indiceVerticeProximo`). Usado pra inserir um vértice no meio de uma parede
function indiceSegmentoProximo(pontos: Posicao[], ponto: Posicao): number | null {
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const comprimento = distanciaXY(a, b);
    if (comprimento < MEDIDA_MINIMA) continue;

    const dx = (b.x - a.x) / comprimento;
    const dy = (b.y - a.y) / comprimento;
    const projecao = (ponto.x - a.x) * dx + (ponto.y - a.y) * dy;
    if (projecao < LIMIAR_FECHAR_CONTORNO || projecao > comprimento - LIMIAR_FECHAR_CONTORNO) continue;

    const perpendicular = Math.abs((ponto.x - a.x) * dy - (ponto.y - a.y) * dx);
    if (perpendicular <= LIMIAR_FECHAR_CONTORNO) return i;
  }
  return null;
}

// Ponto travado no ângulo reto (múltiplo de 90°) mais próximo da direção âncora→ponto, quando
// estiver a poucos graus dele — mantém a mesma distância, só ajusta a direção. Null se não há
// ângulo reto perto o bastante (ou a distância é curta demais pro ângulo fazer sentido)
function calcularTravamento(ancora: Posicao, ponto: Posicao): { ponto: Posicao; diferenca: number } | null {
  const distancia = distanciaXY(ancora, ponto);
  if (distancia < MEDIDA_MINIMA) return null;

  const angulo = anguloGraus(ancora, ponto);
  const anguloTravado = Math.round(angulo / 90) * 90;
  const diferenca = Math.abs(angulo - anguloTravado);
  if (diferenca > LIMIAR_TRAVAR_ANGULO) return null;

  const rad = MathUtils.degToRad(anguloTravado);
  return {
    ponto: { x: ancora.x + Math.cos(rad) * distancia, y: ancora.y + Math.sin(rad) * distancia, z: 0 },
    diferenca,
  };
}

// Trava a direção âncora→ponto no ângulo reto mais próximo, ou devolve o ponto como veio. Usado
// pra marcar o próximo canto (só tem uma âncora: o último ponto confirmado). Facilita desenhar
// paredes alinhadas com os eixos sem precisão de pixel, como a inferência de eixos do SketchUp
function travarNaLinhaReta(ancora: Posicao, ponto: Posicao): Posicao {
  return calcularTravamento(ancora, ponto)?.ponto ?? ponto;
}

// O mesmo travamento, mas pra arrastar um vértice já existente: ele tem até dois vizinhos (o
// anterior e o seguinte na sequência, ou nenhum nas pontas de um traçado aberto), e trava contra
// o que tiver o ângulo mais próximo de um reto, pra continuar reto dos dois lados quando possível
function travarVerticeArrastado(pontos: Posicao[], indice: number, ponto: Posicao, fechado: boolean): Posicao {
  const anterior = indice > 0 ? pontos[indice - 1] : fechado ? pontos.at(-1) : undefined;
  const seguinte = indice < pontos.length - 1 ? pontos[indice + 1] : fechado ? pontos[0] : undefined;

  const candidatoAnterior = anterior ? calcularTravamento(anterior, ponto) : null;
  const candidatoSeguinte = seguinte ? calcularTravamento(seguinte, ponto) : null;

  if (candidatoAnterior && candidatoSeguinte) {
    return candidatoAnterior.diferenca <= candidatoSeguinte.diferenca
      ? candidatoAnterior.ponto
      : candidatoSeguinte.ponto;
  }
  return (candidatoAnterior ?? candidatoSeguinte)?.ponto ?? ponto;
}

// Ao soltar um vértice arrastado perto de um vizinho imediato, funde os dois (remove o arrastado)
// em vez de só mover — como fechar o contorno, mas pra qualquer par de cantos vizinhos
function moverOuFundirVertice(pontos: Posicao[], indice: number, novoPonto: Posicao, fechado: boolean): Posicao[] {
  if (pontos.length > 2) {
    const antes = indice > 0 ? indice - 1 : fechado ? pontos.length - 1 : null;
    const depois = indice < pontos.length - 1 ? indice + 1 : fechado ? 0 : null;
    const pertoDeAntes = antes !== null && distanciaXY(novoPonto, pontos[antes]) <= LIMIAR_FECHAR_CONTORNO;
    const pertoDeDepois = depois !== null && distanciaXY(novoPonto, pontos[depois]) <= LIMIAR_FECHAR_CONTORNO;
    if (pertoDeAntes || pertoDeDepois) return pontos.filter((_, i) => i !== indice);
  }
  return pontos.map((p, i) => (i === indice ? novoPonto : p));
}

// Grupo com meshes cujo material é próprio (descartado junto): usado pelos marcadores
function limparMalhasProprias(grupo: Group) {
  for (const filho of [...grupo.children]) {
    if (filho instanceof Mesh) {
      filho.geometry.dispose();
      (filho.material as MeshBasicMaterial).dispose();
    }
    grupo.remove(filho);
  }
}

// Grupo com meshes que compartilham um material externo (só a geometria é descartada aqui)
function limparGeometrias(grupo: Group) {
  for (const filho of [...grupo.children]) {
    if (filho instanceof Mesh) filho.geometry.dispose();
    grupo.remove(filho);
  }
}

function criarDesenhoParede(): DesenhoParede {
  const materialSegmento = new MeshStandardMaterial({
    color: COR_PAREDE,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const segmentos = new Group();

  const marcadores = new Group();

  const elastico = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: COR_SELECIONADA, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  elastico.visible = false;

  const marcadorFechar = new Mesh(
    new SphereGeometry(90, 16, 12),
    new MeshBasicMaterial({ color: COR_SELECIONADA, transparent: true, opacity: 0.85 }),
  );
  marcadorFechar.visible = false;

  const grupo = new Group();
  grupo.add(segmentos, marcadores, elastico, marcadorFechar);
  grupo.visible = false;

  return { grupo, segmentos, materialSegmento, marcadores, elastico, marcadorFechar };
}

function descartarDesenhoParede(desenho: DesenhoParede) {
  desenho.grupo.removeFromParent();
  limparGeometrias(desenho.segmentos);
  desenho.materialSegmento.dispose();
  limparMalhasProprias(desenho.marcadores);
  desenho.elastico.geometry.dispose();
  desenho.elastico.material.dispose();
  desenho.marcadorFechar.geometry.dispose();
  desenho.marcadorFechar.material.dispose();
}

const COR_TRENA = 0xf5a623;
// Raio (mm) do marcador de cada ponto da trena
const RAIO_MARCADOR_TRENA = 15;

function criarDesenhoTrena(): DesenhoTrena {
  const linha = new Line(new BufferGeometry(), new LineBasicMaterial({ color: COR_TRENA }));
  const elastico = new Line(new BufferGeometry(), new LineBasicMaterial({ color: COR_TRENA, transparent: true, opacity: 0.6 }));
  elastico.visible = false;
  const marcadores = new Group();
  const etiquetas = new Group();

  const grupo = new Group();
  grupo.add(linha, elastico, marcadores, etiquetas);
  grupo.visible = false;

  return { grupo, linha, elastico, marcadores, etiquetas };
}

// As etiquetas (CSS2DObject) não têm geometria/material de GPU: só sair da cena já basta (o
// próprio CSS2DObject tira o <div> do DOM, ver o listener "removed" da classe)
function limparEtiquetas(grupo: Group) {
  for (const filho of [...grupo.children]) grupo.remove(filho);
}

function descartarDesenhoTrena(desenho: DesenhoTrena) {
  desenho.grupo.removeFromParent();
  desenho.linha.geometry.dispose();
  desenho.linha.material.dispose();
  desenho.elastico.geometry.dispose();
  desenho.elastico.material.dispose();
  limparMalhasProprias(desenho.marcadores);
  limparEtiquetas(desenho.etiquetas);
}

// Rotação guardada (positiva no sentido anti-horário visto da ponta positiva do eixo) para a cena.
// Z nos dados é altura — vira o Y nativo da cena (vertical, three.js), direto. Y nos dados é
// profundidade — vira o Z nativo (aponta pra -Z da cena), por isso só esse ângulo troca de sinal
function aplicarRotacao(objeto: Object3D, rotacao: Rotacao) {
  objeto.rotation.set(
    MathUtils.degToRad(rotacao.x),
    MathUtils.degToRad(rotacao.z),
    SENTIDO_Z * MathUtils.degToRad(rotacao.y),
  );
}

function rotacaoDaCena(objeto: Object3D): Rotacao {
  const graus = (radianos: number) => normalizarGraus(Math.round(MathUtils.radToDeg(radianos) * 100) / 100);
  return {
    x: graus(objeto.rotation.x),
    y: graus(SENTIDO_Z * objeto.rotation.z),
    z: graus(objeto.rotation.y),
  };
}

function limitarPosicao(valor: number) {
  return Math.max(-LIMITE_POSICAO, Math.min(LIMITE_POSICAO, Math.round(valor)));
}

// Distância entre dois pontos em qualquer direção (a trena mede em 3D — ao contrário das paredes,
// sempre no piso — já que o ponto pode estar em cima de qualquer peça, em qualquer altura)
function distancia3D(a: Posicao, b: Posicao): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Colisão: bloqueia o movimento entre dois elementos só quando os DOIS têm colisão ativada
// (assim, desativar a colisão de um módulo faz ele atravessar tudo, e nada o atravessa também).
// `alvo` já tem a posição/rotação propostas aplicadas; a caixa é encolhida por uma tolerância
// para elementos apenas encostados (grudados pelo encaixe) não acusarem colisão entre si
function haColisao(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  alvo: Object3D,
): boolean {
  if (!elementos[chaveMovida]?.colisao) return false;

  const caixaMovida = new Box3().setFromObject(alvo);
  caixaMovida.min.addScalar(TOLERANCIA_COLISAO);
  caixaMovida.max.addScalar(-TOLERANCIA_COLISAO);

  // O piso também é sólido: nada com colisão ativada atravessa o chão (y=0 no mundo), mesmo
  // dentro de um grupo elevado (a caixa já está no espaço do mundo, não no do pai)
  if (caixaMovida.min.y < 0) return true;

  for (const [chave, objeto] of objetos) {
    const elemento = elementos[chave];
    if (!elemento?.colisao) continue;
    // Não compara consigo mesmo, com os próprios filhos, nem com um grupo que o contenha
    if (estaDentro(elementos, chave, chaveMovida) || estaDentro(elementos, chaveMovida, chave)) continue;

    // Parede com vãos: uma caixa por célula que sobrou do recorte, não a parede inteira — assim
    // um módulo atravessa o vão de verdade (a caixa geral bateria mesmo passando só pelo buraco)
    if (elemento.parede) {
      if (caixasColisaoParede(objeto, elemento.parede, objeto.vaos ?? []).some((c) => caixaMovida.intersectsBox(c))) {
        return true;
      }
      continue;
    }

    if (caixaMovida.intersectsBox(new Box3().setFromObject(objeto.container))) return true;
  }
  return false;
}

// Depois de corrigir alvo.position (encaixe ou colisão), realinha o estado interno do
// TransformControls para o arraste continuar suave a partir daqui, em vez de "puxar" o objeto
// de volta na próxima vez que o mouse se mexer. `pointStart`/`pointEnd`/`_positionStart` não são
// API pública da biblioteca (checados na versão instalada: object.position = _offset(pointEnd -
// pointStart) + _positionStart); se uma atualização do three.js remover ou renomear esses campos,
// o pior efeito é o arraste voltar a puxar por um quadro, sem quebrar
function reancorarArraste(transform: TransformControls, posicao: Vector3) {
  const interno = transform as unknown as { pointStart?: Vector3; pointEnd?: Vector3; _positionStart?: Vector3 };
  interno._positionStart?.copy(posicao);
  if (interno.pointStart && interno.pointEnd) interno.pointStart.copy(interno.pointEnd);
}

// Posiciona a câmera para mostrar o objeto (e o extra, se houver) inteiros;
// devolve false se não há o que mostrar
function enquadrar({ camera, controls }: Cena, objeto: Object3D, extra?: Object3D) {
  const caixa = new Box3().setFromObject(objeto);
  if (extra) caixa.union(new Box3().setFromObject(extra));
  if (caixa.isEmpty()) return false;

  const centro = caixa.getCenter(new Vector3());
  const raio = caixa.getBoundingSphere(new Sphere()).radius;
  const distancia = (raio / Math.sin((camera.fov * Math.PI) / 360)) * 1.1;
  const direcao = new Vector3(1, 0.7, 1.3).normalize();

  camera.position.copy(centro).addScaledVector(direcao, distancia);
  camera.near = distancia / 100;
  camera.far = distancia * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(centro);
  controls.update();
  return true;
}

export default function ModuloViewport({
  elementos,
  planta,
  selecionada,
  selecaoExtra,
  contexto,
  ferramenta,
  explodido,
  onClicarPeca,
  onDuploCliquePeca,
  onTransformar,
  onConcluirParedes,
  onCancelarParede,
  onPintarFace,
  onPintarGrupo,
}: ModuloViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputImagemTintaRef = useRef<HTMLInputElement>(null);
  const cenaRef = useRef<Cena | null>(null);
  const objetosRef = useRef(new Map<string, ObjetoElemento>());
  const enquadradoRef = useRef(false);
  const callbacksRef = useRef({
    onClicarPeca,
    onDuploCliquePeca,
    onTransformar,
    onConcluirParedes,
    onCancelarParede,
    onPintarFace,
  });
  // Espelha a prop `elementos` para o listener de arraste (criado uma única vez) sempre ler
  // a árvore mais recente, e não a do momento em que a cena foi montada
  const elementosRef = useRef(elementos);
  // Idem para a ferramenta ativa: o clique/duplo clique de seleção (criado uma única vez) não
  // deve fazer nada enquanto o construtor de paredes estiver desenhando no piso
  const ferramentaRef = useRef(ferramenta);
  // Última posição do arraste sem colisão, para "segurar" o elemento nela ao encostar num sólido
  const ultimaPosicaoValidaRef = useRef(new Vector3());

  // Construtor de paredes: cantos já confirmados (clique a clique) e ponto sob o mouse no piso,
  // ambos em coordenadas de dados (mm, y sempre 0); zerados sempre que a ferramenta muda
  const [pontosParede, setPontosParede] = useState<Posicao[]>([]);
  const [mouseNoChao, setMouseNoChao] = useState<Posicao | null>(null);
  const [espessuraParede, setEspessuraParede] = useState(ESPESSURA_PADRAO_PAREDE);
  // Campo "Distância": Ctrl foca ele sem precisar clicar (ver aoTeclar), mantendo a direção que o
  // cursor já está apontando — só digita o comprimento e Enter
  const distanciaParedeInputRef = useRef<HTMLInputElement>(null);
  // Vértice sendo arrastado no momento (posição provisória, só aplicada de verdade ao soltar);
  // separado de `pontosParede` pra não precisar recriar os listeners de ponteiro a cada quadro
  const [verticeArrastado, setVerticeArrastado] = useState<{ indice: number; posicao: Posicao } | null>(null);
  // Chave do grupo de paredes (ou parede avulsa) sendo reeditado, se a ferramenta foi ativada com
  // um deles selecionado; null quando é um desenho novo
  const [chaveEdicaoParede, setChaveEdicaoParede] = useState<string | null>(null);
  // Se o traçado começou fechado (reeditando um contorno fechado) — Enter/Concluir preservam isso
  const [fechadoInicial, setFechadoInicial] = useState(false);
  // Altura das paredes sendo reeditadas (a delas mesmas, não a da planta); null num desenho novo
  const [alturaEdicaoParede, setAlturaEdicaoParede] = useState<number | null>(null);
  // Parede interna: a ponta correspondente (primeiro/último ponto de uma cadeia ABERTA) foi
  // clicada em cima de outra parede já existente, e vai se encostar na face dela (T de verdade) em
  // vez de ficar solta no ar — ver EngateParede/aplicarEngatesNasPontas
  const [engateInicio, setEngateInicio] = useState<EngateParede | null>(null);
  const [engateFim, setEngateFim] = useState<EngateParede | null>(null);
  const arrastandoIndiceRef = useRef<number | null>(null);

  // Trena: pontos já marcados (clique a clique, em coordenadas de dados) e o ponto sob o mouse
  // no momento, pra desenhar o segmento "elástico" até ele; zerados sempre que a ferramenta muda
  const [pontosTrena, setPontosTrena] = useState<Posicao[]>([]);
  const [mouseTrena, setMouseTrena] = useState<Posicao | null>(null);

  // Balde de tinta: a "tinta" carregada no momento (cor sólida ou imagem importada) — clicar numa
  // face pintável aplica ela ali. `imagemTinta` guarda o resultado já pronto de lerTexturaJpeg
  // (não o File), pra não reprocessar a cada clique
  const [modoTinta, setModoTinta] = useState<'cor' | 'imagem' | 'remover'>('cor');
  const [corTinta, setCorTinta] = useState('#c9c2b4');
  const [imagemTinta, setImagemTinta] = useState<string | null>(null);
  const [nomeImagemTinta, setNomeImagemTinta] = useState<string | null>(null);
  const [erroTinta, setErroTinta] = useState<string | null>(null);
  const [carregandoImagemTinta, setCarregandoImagemTinta] = useState(false);
  // Texturas já usadas antes, oferecidas na própria grade do painel de pintura (sem precisar de
  // um diálogo à parte) — ativo só com o modo "Imagem" aberto, pra não buscar/importar à toa
  const painelDeImagemAberto = ferramenta === 'pintura' && modoTinta === 'imagem';
  const texturasSalvas = useTexturas();
  const importandoTexturaAutomaticamente = useImportacaoAutomaticaTexturas(painelDeImagemAberto);
  // Foco num módulo (peça ou grupo): esconde tudo que não for ele, um ancestral dele (só pra
  // hierarquia de containers renderizar, ver o efeito de sincronização) ou algo dentro dele —
  // só na visualização (não mexe em elemento.visivel, não marca o projeto como alterado)
  const [chaveEmFoco, setChaveEmFoco] = useState<string | null>(null);

  useEffect(() => {
    elementosRef.current = elementos;
  }, [elementos]);

  // Sai do foco sozinho se o módulo focado deixar de existir (excluído, ou undo/redo) — senão a
  // condição de foco nunca bate com nada e a cena inteira fica escondida
  useEffect(() => {
    if (chaveEmFoco && !elementos[chaveEmFoco]) setChaveEmFoco(null);
  }, [elementos, chaveEmFoco]);

  useEffect(() => {
    ferramentaRef.current = ferramenta;
  }, [ferramenta]);

  useEffect(() => {
    callbacksRef.current = { onClicarPeca, onDuploCliquePeca, onTransformar, onConcluirParedes, onCancelarParede, onPintarFace };
  }, [onClicarPeca, onDuploCliquePeca, onTransformar, onConcluirParedes, onCancelarParede, onPintarFace]);

  // Ativar a ferramenta de paredes com um grupo de paredes (ou uma parede dele, ou uma parede
  // avulsa) selecionado carrega os cantos dele pra reeditar, em vez de começar um desenho vazio
  useEffect(() => {
    if (ferramenta !== 'parede') {
      setPontosParede([]);
      setMouseNoChao(null);
      setVerticeArrastado(null);
      setChaveEdicaoParede(null);
      setAlturaEdicaoParede(null);
      setEngateInicio(null);
      setEngateFim(null);
      return;
    }
    const alvo = alvoEdicaoParede(elementos, selecionada);
    setPontosParede(alvo?.pontos ?? []);
    setFechadoInicial(alvo?.fechado ?? false);
    setChaveEdicaoParede(alvo?.chave ?? null);
    setAlturaEdicaoParede(alvo?.altura ?? null);
    setEngateInicio(null);
    setEngateFim(null);
    if (alvo) setEspessuraParede(alvo.espessura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta]);

  // Trocar de ferramenta sempre limpa a trena (ela não guarda nada entre uma ativação e outra)
  useEffect(() => {
    if (ferramenta !== 'trena') {
      setPontosTrena([]);
      setMouseTrena(null);
    }
  }, [ferramenta]);

  // Monta a cena uma única vez
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const objetos = objetosRef.current;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Etiquetas dos módulos (ver definirEtiqueta): um <div> por cima do canvas, com um <div>
    // sobreposto por etiqueta, posicionado a cada quadro pelo próprio CSS2DRenderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 0.8));
    const luz = new DirectionalLight(0xffffff, 1.6);
    luz.position.set(3000, 5000, 4000);
    scene.add(luz);

    // Grade de referência: cobre bem além do limite de posição (LIMITE_POSICAO), pra nunca faltar
    // grade embaixo de uma peça movida pro fim do espaço válido; divisões de 100 mm, como antes
    const TAMANHO_GRADE = LIMITE_POSICAO * 3;
    const piso = new GridHelper(TAMANHO_GRADE, TAMANHO_GRADE / 100, 0x888888, 0x888888);
    piso.material.transparent = true;
    piso.material.opacity = 0.3;
    scene.add(piso);

    const camera = new PerspectiveCamera(45, 1, 10, 100000);
    camera.position.set(2000, 1600, 2600);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // Sem isso, a roda do mouse sempre aproxima/afasta em direção ao centro do orbit (`target`),
    // não de onde o cursor está — dentro de uma sala (paredes bem perto da câmera), isso faz o
    // zoom "puxar" pro lado errado o tempo todo
    controls.zoomToCursor = true;
    controls.target.set(0, 400, 0);
    controls.update();

    const raiz = new Group();
    scene.add(raiz);

    // Piso e caixa tracejada da planta do ambiente, ocultos até `planta` chegar do projeto
    const sala = criarSala();
    scene.add(sala.grupo);

    // Pré-visualização do construtor de paredes, desenhada direto no piso
    const parede = criarDesenhoParede();
    scene.add(parede.grupo);

    // Pré-visualização da trena
    const trena = criarDesenhoTrena();
    scene.add(trena.grupo);

    // Setas de X, Y e Z para mover o elemento selecionado
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setTranslationSnap(PASSO_MOVIMENTO);
    transform.setRotationSnap(MathUtils.degToRad(PASSO_ROTACAO));
    // Enquanto arrasta uma seta, a câmera não gira; ao começar, guarda a posição de partida
    // (sem colisão, já que o elemento estava parado ali) para poder voltar a ela se precisar
    transform.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
      if (e.value && transform.object) ultimaPosicaoValidaRef.current.copy(transform.object.position);
    });
    transform.addEventListener('objectChange', () => {
      const alvo = transform.object;
      if (!alvo) return;
      const chave = alvo.userData.chave as string;

      // Posição e rotação do contêiner já são relativas ao pai, como guardadas no elemento
      if (transform.mode === 'rotate') {
        callbacksRef.current.onTransformar(chave, { rotacao: rotacaoDaCena(alvo) });
        return;
      }

      alvo.position.set(
        limitarPosicao(alvo.position.x),
        limitarPosicao(alvo.position.y),
        limitarPosicao(alvo.position.z),
      );

      // Encaixe: gruda numa face de um irmão do mesmo grupo, se estiver perto o bastante. Z dos
      // dados é o Y nativo da cena (altura); Y dos dados é o Z nativo (profundidade, espelhado)
      const elementosAtuais = elementosRef.current;
      const posicaoBruta = { x: alvo.position.x, y: (SENTIDO_Z * alvo.position.z) || 0, z: alvo.position.y };
      const posicaoComEncaixe = calcularEncaixe({ elementos: elementosAtuais, filhos: {} }, chave, posicaoBruta);
      alvo.position.set(posicaoComEncaixe.x, posicaoComEncaixe.z, SENTIDO_Z * posicaoComEncaixe.y);

      // Colisão: barra o movimento que sobreporia outro elemento também sólido, "segurando"
      // o elemento na última posição válida e reancorando o arraste a partir dali
      alvo.updateWorldMatrix(true, true);
      if (haColisao(objetosRef.current, elementosAtuais, chave, alvo)) {
        alvo.position.copy(ultimaPosicaoValidaRef.current);
        alvo.updateWorldMatrix(true, true);
        reancorarArraste(transform, alvo.position);
        return;
      }
      ultimaPosicaoValidaRef.current.copy(alvo.position);

      callbacksRef.current.onTransformar(chave, {
        posicao: { x: alvo.position.x, y: (SENTIDO_Z * alvo.position.z) || 0, z: alvo.position.y },
      });
    });
    scene.add(transform.getHelper());

    // Eixos do ambiente na origem, 1 mm acima do piso para não disputar com a grade; vão até a
    // borda da própria grade (metade do tamanho dela), não só até o limite de posição das peças
    const eixosAmbiente = criarEixos(false);
    eixosAmbiente.scale.setScalar(TAMANHO_GRADE / 2);
    eixosAmbiente.position.y = 1;
    scene.add(eixosAmbiente);

    // Eixos da seleção (ou do grupo aberto); a posição acompanha o alvo a cada quadro
    const eixosSelecao = criarEixos(true);
    eixosSelecao.visible = false;
    scene.add(eixosSelecao);

    const cena: Cena = {
      camera,
      controls,
      transform,
      renderer,
      raiz,
      sala,
      eixosAmbiente,
      eixosSelecao,
      alvoEixos: null,
      parede,
      trena,
    };
    cenaRef.current = cena;
    enquadradoRef.current = false;

    const redimensionar = () => {
      const { clientWidth: largura, clientHeight: altura } = container;
      renderer.setSize(largura, altura);
      labelRenderer.setSize(largura, altura);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(redimensionar);
    observer.observe(container);
    redimensionar();

    const raycaster = new Raycaster();
    const pecaSobPonteiro = (e: MouseEvent) => {
      const ponteiro = ponteiroNormalizado(e, renderer.domElement);
      raycaster.setFromCamera(ponteiro, camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetos), false);
      return (acerto?.object.userData.chave as string | undefined) ?? null;
    };

    // Clique sem arrastar seleciona (ou limpa a seleção); clique nas setas não conta. Com o
    // construtor de paredes ativo, esses cliques são tratados por outro efeito (ver abaixo)
    const inicioClique = new Vector2();
    let clicouNasSetas = false;
    const aoPressionar = (e: PointerEvent) => {
      inicioClique.set(e.clientX, e.clientY);
      clicouNasSetas = transform.axis !== null;
    };
    const aoSoltar = (e: PointerEvent) => {
      if (ferramentaRef.current === 'parede' || ferramentaRef.current === 'trena' || ferramentaRef.current === 'pintura' || clicouNasSetas) return;
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return;
      callbacksRef.current.onClicarPeca(pecaSobPonteiro(e), e.ctrlKey || e.metaKey);
    };
    const aoDuploClique = (e: MouseEvent) => {
      if (ferramentaRef.current === 'parede' || ferramentaRef.current === 'trena' || ferramentaRef.current === 'pintura') return;
      const chave = pecaSobPonteiro(e);
      if (chave) callbacksRef.current.onDuploCliquePeca(chave);
    };
    renderer.domElement.addEventListener('pointerdown', aoPressionar);
    renderer.domElement.addEventListener('pointerup', aoSoltar);
    renderer.domElement.addEventListener('dblclick', aoDuploClique);

    renderer.setAnimationLoop(() => {
      controls.update();
      // Mantém os eixos na origem do alvo, inclusive durante o arraste das setas
      cena.alvoEixos?.getWorldPosition(eixosSelecao.position);
      cena.alvoEixos?.getWorldQuaternion(eixosSelecao.quaternion);
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', aoPressionar);
      renderer.domElement.removeEventListener('pointerup', aoSoltar);
      renderer.domElement.removeEventListener('dblclick', aoDuploClique);
      observer.disconnect();
      transform.detach();
      transform.getHelper().removeFromParent();
      transform.dispose();
      controls.dispose();
      for (const objeto of objetos.values()) descartarObjeto(objeto);
      objetos.clear();
      piso.geometry.dispose();
      piso.material.dispose();
      descartarSala(sala);
      descartarDesenhoParede(parede);
      descartarDesenhoTrena(trena);
      descartarEixos(eixosAmbiente);
      descartarEixos(eixosSelecao);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
      cenaRef.current = null;
    };
  }, []);

  // Sincroniza a cena com a árvore: só recria geometria quando a forma de uma peça muda
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const objetos = objetosRef.current;
    const lista = Object.values(elementos);

    // 1. Contêineres, geometrias e posições
    for (const elemento of lista) {
      let objeto = objetos.get(elemento.chave);
      if (!objeto) {
        objeto = { container: new Group() };
        objeto.container.userData.chave = elemento.chave;
        objetos.set(elemento.chave, objeto);
      }

      const { forma, parede, piso } = elemento;
      // Vãos são filhos dela na árvore, não um campo da própria parede: se algum deles mudou
      // (posição/medida), a geometria precisa recortar de novo mesmo sem `parede` ter mudado
      const vaosDaParede = parede ? lista.filter((e) => e.pai === elemento.chave && e.abertura) : undefined;
      const vaosMudaram =
        vaosDaParede &&
        (!objeto.vaos ||
          objeto.vaos.length !== vaosDaParede.length ||
          objeto.vaos.some((v, i) => v !== vaosDaParede[i]));
      const comTexturas = (!!parede || !!piso) && Object.keys(elemento.texturas ?? {}).length > 0;
      // Medidas inválidas (ex.: campo sendo digitado) mantêm a última forma válida
      if (forma && forma !== objeto.forma && parametrosValidos(forma.tipo, forma.parametros)) {
        definirForma(objeto, elemento.chave, forma);
      } else if (
        parede &&
        (parede !== objeto.parede || vaosMudaram || comTexturas !== !!objeto.geometriaDividida) &&
        paredeValida(parede)
      ) {
        definirParede(objeto, elemento.chave, parede, vaosDaParede ?? [], comTexturas);
      } else if (
        piso &&
        (piso !== objeto.piso || comTexturas !== !!objeto.geometriaDividida) &&
        pisoValido(piso)
      ) {
        definirPiso(objeto, elemento.chave, piso, comTexturas);
      } else if (elemento.modelo3d && chaveModelo3d(elemento.modelo3d, elemento.modelo3dNo) !== objeto.modelo3dCarregando) {
        definirModelo3d(objeto, elemento.chave, elemento.modelo3d, elemento.modelo3dNo);
      }
      if (elemento.forma && objeto.forma) definirTexturas(objeto, facesDaForma(objeto.forma), elemento.texturas);
      else if ((parede && objeto.parede) || (piso && objeto.piso)) definirTexturas(objeto, FACES_TEXTURA.caixa, elemento.texturas);
      // Renderiza a posição real sempre que ela é um número de verdade (NaN/Infinity só acontece
      // com um campo sendo digitado) — não usa posicaoValida aqui: aquele limite é uma folga
      // pensada pra sanear entrada do usuário e da API, não um teto pro que a cena pode desenhar
      if (Object.values(elemento.posicao).every(Number.isFinite)) {
        // Vista Explodida: afasta o container do lugar salvo só pra visualização (não mexe em
        // elemento.posicao, então não marca o projeto como alterado nem entra no desfazer)
        const deslocamento = explodido
          ? deslocamentoExplosaoRecursivo(elementos, explodido.chave, elemento.chave, explodido.distancia)
          : null;
        const x = elemento.posicao.x + (deslocamento?.x ?? 0);
        const y = elemento.posicao.y + (deslocamento?.y ?? 0);
        const z = elemento.posicao.z + (deslocamento?.z ?? 0);
        // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo, espelhado
        objeto.container.position.set(x, z, SENTIDO_Z * y);
      }
      if (Object.values(elemento.rotacao).every(Number.isFinite)) {
        aplicarRotacao(objeto.container, elemento.rotacao);
      }
      // Peça de modelo 3D é redimensionável: a malha sempre carrega no tamanho original do
      // arquivo, então a escala aplicada é sempre a razão até o tamanho atual do elemento —
      // roda em toda sincronização (não só quando o modelo troca), pra pegar mudanças de tamanho
      if (elemento.modelo3d) {
        objeto.tamanhoAlvo = elemento.tamanho;
        objeto.texturasAlvo = elemento.texturas;
        ajustarModelo(objeto);
      }
    }

    // 2. Hierarquia: cada contêiner dentro do contêiner do pai
    for (const elemento of lista) {
      const { container } = objetos.get(elemento.chave) as ObjetoElemento;
      const pai = elemento.pai === null ? cena.raiz : (objetos.get(elemento.pai) as ObjetoElemento).container;
      if (container.parent !== pai) pai.add(container);
    }

    // 3. Remove o que saiu da árvore (filhos mantidos já foram para o novo pai no passo 2)
    for (const [chave, objeto] of objetos) {
      if (!elementos[chave]) {
        descartarObjeto(objeto);
        objetos.delete(chave);
      }
    }

    // Seleção completa (a primária mais as extras do Ctrl/Cmd+Click): todas recebem o mesmo
    // destaque forte, sem distinção — só a primária (selecionada) fica com o gizmo, mais abaixo
    const naSelecao = (chave: string) => chave === selecionada || selecaoExtra.includes(chave);

    // 4. Aparência: seleção destaca todo o conteúdo; fora do grupo aberto fica esmaecido
    for (const elemento of lista) {
      const foraDoContexto = contexto !== null && !estaDentro(elementos, elemento.chave, contexto);
      const objeto = objetos.get(elemento.chave) as ObjetoElemento;
      aplicarAparencia(objeto, naSelecao(elemento.chave), foraDoContexto);
      if (elemento.tipo === 'peca' || elemento.tipo === 'grupo') definirEtiqueta(objeto, elemento, foraDoContexto);
    }

    // Caixa tracejada dos grupos selecionados ou abertos para edição
    for (const elemento of lista) {
      if (elemento.tipo !== 'grupo') continue;
      atualizarCaixaGrupo(
        objetos.get(elemento.chave) as ObjetoElemento,
        elemento.tamanho,
        naSelecao(elemento.chave) || elemento.chave === contexto,
        COR_DESTAQUE_GRUPO,
        !naSelecao(elemento.chave),
      );
    }

    // Peça de modelo 3D: como a malha vem de um arquivo importado (com os próprios materiais e
    // texturas), a seleção não recolore ela como as demais peças — só a caixa tracejada aparece,
    // e só quando selecionada (ao contrário do grupo, que a mostra sempre que aberto também)
    for (const elemento of lista) {
      if (elemento.tipo !== 'peca' || !elemento.modelo3d) continue;
      atualizarCaixaGrupo(
        objetos.get(elemento.chave) as ObjetoElemento,
        elemento.tamanho,
        naSelecao(elemento.chave),
        COR_DESTAQUE_OBJETO,
        false,
      );
    }

    // Visibilidade: cada elemento segue visivel (um grupo oculto já esconde o conteúdo junto,
    // mesmo o que estiver com visivel:true, porque o three.js não desenha filho de container
    // invisível). Editando paredes, esconde por cima o grupo (ou a parede avulsa) sendo editado —
    // some junto tudo o que está dentro dele (malha, arestas e a caixa tracejada), já que a
    // pré-visualização cinza do construtor já mostra o resultado, e as paredes reais por baixo só
    // atrapalhariam
    for (const elemento of lista) {
      (objetos.get(elemento.chave) as ObjetoElemento).container.visible = elemento.visivel !== false;
    }
    if (ferramenta === 'parede' && chaveEdicaoParede) {
      const alvoEdicao = objetos.get(chaveEdicaoParede);
      if (alvoEdicao) alvoEdicao.container.visible = false;
    }

    // Foco num módulo: esconde tudo que não for ele, um ancestral (a hierarquia de containers
    // precisa deles visíveis pra transmitir a posição até o módulo focado) ou algo dentro dele.
    // O módulo focado e o que está dentro dele seguem elemento.visivel normalmente (já aplicado
    // acima); um ancestral fica visível mesmo se estivesse oculto, só pra não travar a exibição
    if (chaveEmFoco && elementos[chaveEmFoco]) {
      for (const elemento of lista) {
        const objeto = objetos.get(elemento.chave) as ObjetoElemento;
        const ancestralDoFoco = elemento.chave !== chaveEmFoco && estaDentro(elementos, chaveEmFoco, elemento.chave);
        if (ancestralDoFoco) {
          objeto.container.visible = true;
        } else if (!estaDentro(elementos, elemento.chave, chaveEmFoco)) {
          objeto.container.visible = false;
        }
      }
    }

    // Eixos: com seleção, os do elemento selecionado; sem seleção, os do grupo aberto
    // (espaço em que as posições são medidas) ou, na raiz, os do ambiente
    const chaveEixos = selecionada ?? contexto;
    const alvoEixos = chaveEixos ? objetos.get(chaveEixos) : undefined;
    cena.eixosAmbiente.visible = alvoEixos === undefined;
    cena.eixosSelecao.visible = alvoEixos !== undefined;
    cena.alvoEixos = alvoEixos?.container ?? null;
    if (alvoEixos) {
      const tamanho = new Box3().setFromObject(alvoEixos.container).getSize(new Vector3());
      cena.eixosSelecao.scale.setScalar(
        Math.max(Math.max(tamanho.x, tamanho.y, tamanho.z) * 0.75, COMPRIMENTO_MINIMO_EIXOS),
      );
    }

    // Setas para mover, anéis para girar; o construtor de paredes não usa o gizmo 3D
    const gizmoAtivo = ferramenta === 'mover' || ferramenta === 'girar';
    const alvo = gizmoAtivo && selecionada ? objetos.get(selecionada) : undefined;
    cena.transform.setMode(ferramenta === 'girar' ? 'rotate' : 'translate');
    if (!alvo) cena.transform.detach();
    else if (cena.transform.object !== alvo.container) cena.transform.attach(alvo.container);

    // Piso e caixa tracejada da planta do ambiente (etapa "Planta do ambiente" do assistente)
    atualizarSala(cena.sala, planta);

    // No primeiro quadro com algo a mostrar, enquadra a raiz e, se houver, a planta do ambiente
    // (um projeto novo, sem peças, ainda mostra a planta vazia)
    if (!enquadradoRef.current && enquadrar(cena, cena.raiz, planta ? cena.sala.grupo : undefined)) {
      enquadradoRef.current = true;
    }
  }, [elementos, planta, selecionada, selecaoExtra, contexto, ferramenta, chaveEdicaoParede, explodido, chaveEmFoco]);

  const alturaParedes = alturaEdicaoParede ?? planta?.z ?? PE_DIREITO_PADRAO;

  // Construtor de paredes: clique no piso da cena 3D (câmera livre para orbitar entre os
  // cliques, como no resto do editor) marca um canto; Enter conclui, clique perto do primeiro
  // ponto fecha o contorno, Backspace desfaz o último ponto e Esc cancela. Clicar em cima de uma
  // parede já existente (não a que estiver sendo reeditada) engata a ponta ali — uma parede
  // interna de verdade, encostada em T na parede de fora, em vez de flutuando solta
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'parede') return;

    const raycaster = new Raycaster();
    const plano = new Plane(new Vector3(0, 1, 0), 0);
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    interface PontoClicado {
      ponto: Posicao;
      engate: EngateParede | null;
    }

    // Malhas de parede clicáveis pra engatar: qualquer parede visível, menos a que estiver sendo
    // reeditada agora (ela já fica invisível na cena enquanto editada, mas confere aqui também)
    function paredesParaEngate(): Mesh[] {
      return malhasVisiveis(objetosRef.current).filter((malha) => {
        const chave = malha.userData.chave as string | undefined;
        if (!chave || !elementosRef.current[chave]?.parede) return false;
        return !(chaveEdicaoParede !== null && estaDentro(elementosRef.current, chave, chaveEdicaoParede));
      });
    }

    // Projeta o ponto clicado no centro da parede atingida (a mesma linha que os cantos dela já
    // seguem), preso entre as duas pontas dela — vira o canto novo, junto da espessura dela pra
    // saber o quanto recuar depois (ver aplicarEngatesNasPontas)
    function engateNaParede(acerto: Intersection): PontoClicado | null {
      const chave = acerto.object.userData.chave as string | undefined;
      const elemento = chave ? elementosRef.current[chave] : undefined;
      const objeto = chave ? objetosRef.current.get(chave) : undefined;
      if (!elemento?.parede || !objeto) return null;
      const local = objeto.container.worldToLocal(acerto.point.clone());
      const x = Math.min(Math.max(local.x, 0), elemento.parede.comprimento);
      const mundo = objeto.container.localToWorld(new Vector3(x, 0, 0));
      return {
        ponto: { x: limitarPosicao(mundo.x), y: limitarPosicao(SENTIDO_Z * mundo.z), z: 0 },
        engate: { espessura: elemento.parede.espessura },
      };
    }

    function pontoNoChao(e: { clientX: number; clientY: number }): PontoClicado | null {
      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acertoParede] = raycaster.intersectObjects(paredesParaEngate(), false);
      const engate = acertoParede && engateNaParede(acertoParede);
      if (engate) return engate;

      const alvo = new Vector3();
      if (!raycaster.ray.intersectPlane(plano, alvo)) return null;
      return { ponto: { x: limitarPosicao(alvo.x), y: limitarPosicao(SENTIDO_Z * alvo.z), z: 0 }, engate: null };
    }

    function fechariaContorno(ponto: Posicao) {
      return pontosParede.length > 1 && distanciaXY(ponto, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO;
    }

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => {
      inicioClique.set(e.clientX, e.clientY);
      const clicado = pontoNoChao(e);
      const indice = clicado ? indiceVerticeProximo(pontosParede, clicado.ponto) : null;
      arrastandoIndiceRef.current = indice;
      // Enquanto arrasta um vértice, a câmera não gira (como no arraste das setas de mover)
      if (indice !== null) cena.controls.enabled = false;
    };
    const aoSoltar = (e: PointerEvent) => {
      const indiceArrastado = arrastandoIndiceRef.current;
      arrastandoIndiceRef.current = null;
      const arrastou = inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE;

      if (indiceArrastado !== null && arrastou) {
        // Arraste de verdade: aplica a nova posição, já travada reta (ou funde, se soltou perto
        // de um vizinho) — a mesma trava que a pré-visualização já mostrava durante o arraste
        cena.controls.enabled = true;
        setVerticeArrastado(null);
        const clicado = pontoNoChao(e);
        if (clicado) {
          const posicaoTravada = clicado.engate
            ? clicado.ponto
            : travarVerticeArrastado(pontosParede, indiceArrastado, clicado.ponto, fechadoInicial);
          setPontosParede((atual) => moverOuFundirVertice(atual, indiceArrastado, posicaoTravada, fechadoInicial));
          if (indiceArrastado === 0) setEngateInicio(clicado.engate);
          if (indiceArrastado === pontosParede.length - 1) setEngateFim(clicado.engate);
        }
        return;
      }
      if (indiceArrastado !== null) {
        // Só um clique num vértice, sem mover: reabilita a câmera e cai no tratamento de clique
        // comum abaixo — fechar o contorno tem prioridade sobre "clicou num vértice: nada a fazer"
        cena.controls.enabled = true;
        setVerticeArrastado(null);
      }

      if (arrastou) return; // foi um arraste da câmera (OrbitControls), ignora
      const clicado = pontoNoChao(e);
      if (!clicado) return;
      const { ponto, engate } = clicado;
      if (fechariaContorno(ponto)) {
        concluirDesenhoParede(true);
        return;
      }
      if (indiceVerticeProximo(pontosParede, ponto) !== null) return; // clicou num vértice: nada a fazer

      const indiceSegmento = indiceSegmentoProximo(pontosParede, ponto);
      if (indiceSegmento !== null) {
        // Clicou em cima de uma parede existente: insere um canto novo ali, dividindo-a em duas
        setPontosParede((atual) => [...atual.slice(0, indiceSegmento + 1), ponto, ...atual.slice(indiceSegmento + 1)]);
        return;
      }
      // Marcando um canto novo no fim: trava reto se estiver perto de um ângulo reto, do mesmo
      // jeito que a pré-visualização já mostrava — a não ser que tenha engatado numa parede, que
      // já dá a direção certa sozinho
      const ultimoConfirmado = pontosParede.at(-1);
      const pontoConfirmado = !engate && ultimoConfirmado ? travarNaLinhaReta(ultimoConfirmado, ponto) : ponto;
      if (pontosParede.length === 0) setEngateInicio(engate);
      setEngateFim(engate);
      setPontosParede((atual) => [...atual, pontoConfirmado]);
    };
    const aoMoverMouse = (e: PointerEvent) => {
      const clicado = pontoNoChao(e);
      const ultimoConfirmado = pontosParede.at(-1);
      const pontoPreview = clicado && (clicado.engate || !ultimoConfirmado)
        ? clicado.ponto
        : clicado && ultimoConfirmado
          ? travarNaLinhaReta(ultimoConfirmado, clicado.ponto)
          : null;
      setMouseNoChao(pontoPreview);

      const indiceArrastado = arrastandoIndiceRef.current;
      if (indiceArrastado !== null && clicado) {
        setVerticeArrastado({
          indice: indiceArrastado,
          posicao: clicado.engate
            ? clicado.ponto
            : travarVerticeArrastado(pontosParede, indiceArrastado, clicado.ponto, fechadoInicial),
        });
      }
    };
    const aoSairDaArea = () => setMouseNoChao(null);

    function aoTeclar(e: KeyboardEvent) {
      // Ctrl funciona mesmo com o campo de distância já focado (pra reselecionar o texto antes do
      // próximo número) — só não faz nada se o foco estiver em OUTRO campo (ex.: Espessura), pra
      // não roubar dele. Os demais atalhos abaixo continuam bloqueados por um campo focado
      if (e.key === 'Control') {
        if (e.repeat) return;
        const campo = distanciaParedeInputRef.current;
        const foco = document.activeElement;
        if (!campo || (foco instanceof HTMLInputElement && foco !== campo)) return;
        e.preventDefault();
        campo.focus();
        campo.select();
        return;
      }
      if (document.activeElement instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        callbacksRef.current.onCancelarParede();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        concluirDesenhoParede(deveFecharContorno());
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        desfazerUltimoPontoParede();
      }
    }

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    dom.addEventListener('pointermove', aoMoverMouse);
    dom.addEventListener('pointerleave', aoSairDaArea);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
      dom.removeEventListener('pointermove', aoMoverMouse);
      dom.removeEventListener('pointerleave', aoSairDaArea);
      window.removeEventListener('keydown', aoTeclar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta, pontosParede, alturaParedes, espessuraParede, fechadoInicial, chaveEdicaoParede]);

  // Trena: clique marca um ponto de medição — no que estiver sob o cursor (peça, parede, piso ou
  // modelo 3D); sem nada ali, no piso da cena (y=0). Cada ponto depois do primeiro fecha um
  // segmento com a distância dele mostrada em cima; Esc limpa tudo, Backspace desfaz o último
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'trena') return;

    const raycaster = new Raycaster();
    const plano = new Plane(new Vector3(0, 1, 0), 0);
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    function pontoDeMedicao(e: { clientX: number; clientY: number }): Posicao | null {
      // Vértice de alguma peça/grupo/parede perto do ponteiro na tela tem prioridade — mesmo
      // comportamento de qualquer ferramenta de CAD, pra medir de canto a canto sem depender de
      // acertar o pixel exato (bem mais difícil ainda no toque do celular)
      const ima = verticeMaisProximo(verticesVisiveis(elementosRef.current, objetosRef.current), e, camera, dom);
      if (ima) {
        return { x: limitarPosicao(ima.x), y: limitarPosicao(SENTIDO_Z * ima.z), z: limitarPosicao(ima.y) };
      }

      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetosRef.current), false);
      if (acerto) {
        // acerto.point é um ponto de verdade em 3D (não só no piso): Y nativo (altura) -> z dos
        // dados, Z nativo (profundidade) -> y dos dados
        return { x: limitarPosicao(acerto.point.x), y: limitarPosicao(SENTIDO_Z * acerto.point.z), z: acerto.point.y };
      }
      const alvo = new Vector3();
      if (!raycaster.ray.intersectPlane(plano, alvo)) return null;
      return { x: limitarPosicao(alvo.x), y: limitarPosicao(SENTIDO_Z * alvo.z), z: 0 };
    }

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => inicioClique.set(e.clientX, e.clientY);
    const aoSoltar = (e: PointerEvent) => {
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return; // foi orbitar
      const ponto = pontoDeMedicao(e);
      if (ponto) setPontosTrena((atual) => [...atual, ponto]);
    };
    const aoMoverMouse = (e: PointerEvent) => setMouseTrena(pontoDeMedicao(e));
    const aoSairDaArea = () => setMouseTrena(null);

    function aoTeclar(e: KeyboardEvent) {
      if (document.activeElement instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setPontosTrena([]);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setPontosTrena((atual) => atual.slice(0, -1));
      }
    }

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    dom.addEventListener('pointermove', aoMoverMouse);
    dom.addEventListener('pointerleave', aoSairDaArea);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
      dom.removeEventListener('pointermove', aoMoverMouse);
      dom.removeEventListener('pointerleave', aoSairDaArea);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [ferramenta]);

  // Balde de tinta: clique numa face pintável (peça, parede ou piso) aplica a tinta carregada
  // (cor sólida ou imagem importada/reaproveitada) só naquela face — a mesma infraestrutura de
  // texturas por face de sempre; cor sólida vai direto (ver Formas.EhCorSolida na API)
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'pintura') return;
    // "Remover" manda null de propósito (tira a textura da face); no modo Imagem, sem nada
    // carregado ainda, não tem o que aplicar
    const imagem = modoTinta === 'cor' ? corTinta : modoTinta === 'imagem' ? imagemTinta : null;
    if (modoTinta === 'imagem' && !imagem) return;

    const raycaster = new Raycaster();
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => inicioClique.set(e.clientX, e.clientY);
    const aoSoltar = (e: PointerEvent) => {
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return; // foi orbitar
      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetosRef.current), false);
      if (!acerto?.face) return;
      const chave = acerto.object.userData.chave as string | undefined;
      const elemento = chave ? elementosRef.current[chave] : undefined;
      if (!elemento || !(elemento.forma || elemento.modelo3d || elemento.parede || elemento.piso)) return;
      callbacksRef.current.onPintarFace(chave as string, faceClicada(elemento, acerto.face.normal), imagem);
    };

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
    };
  }, [ferramenta, modoTinta, corTinta, imagemTinta]);

  // Remove o último canto marcado — mesma ação do Backspace, só que também acessível por um
  // botão (ver .acoesParede): sem teclado físico (celular), Backspace nunca dispara
  function desfazerUltimoPontoParede() {
    setEngateFim(null);
    setPontosParede((atual) => atual.slice(0, -1));
  }

  // Transforma os pontos marcados em segmentos de parede e entrega ao editor; `fecharContorno`
  // acrescenta um segmento de volta ao primeiro ponto antes de calcular
  function concluirDesenhoParede(fecharContorno: boolean) {
    if (pontosParede.length < 2) {
      callbacksRef.current.onCancelarParede();
      return;
    }
    callbacksRef.current.onConcluirParedes(
      pontosParede,
      fecharContorno,
      { altura: alturaParedes, espessura: espessuraParede },
      chaveEdicaoParede,
      fecharContorno ? undefined : (engateInicio ?? undefined),
      fecharContorno ? undefined : (engateFim ?? undefined),
    );
  }

  // Concluir (Enter ou o botão) só fechava o contorno se ele já tivesse começado fechado
  // (reedição) — um desenho novo cujo último canto ficou perto do início (sem o usuário ter
  // clicado bem em cima do marcador pra disparar o fechamento automático) terminava aberto por
  // engano: faltava a parede de fechamento e o piso nunca era criado
  function deveFecharContorno() {
    return (
      fechadoInicial ||
      (pontosParede.length > 1 && distanciaXY(pontosParede.at(-1)!, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO)
    );
  }

  // Marca o próximo canto a uma distância digitada, na direção em que o mouse já está apontando
  // (a mesma do segmento elástico) — como no SketchUp, digitar o comprimento em vez de acertar o
  // clique exatamente onde quer. Fecha o contorno em vez de marcar um canto se o ponto calculado
  // cair perto do primeiro, igual a um clique ali
  function confirmarDistanciaParede(distanciaMm: number) {
    const ultimo = pontosParede.at(-1);
    if (!ultimo || !mouseNoChao) return;
    const direcao = { x: mouseNoChao.x - ultimo.x, y: mouseNoChao.y - ultimo.y };
    const comprimento = Math.hypot(direcao.x, direcao.y);
    if (comprimento < 1e-6) return;
    const ponto: Posicao = {
      x: limitarPosicao(ultimo.x + (direcao.x / comprimento) * distanciaMm),
      y: limitarPosicao(ultimo.y + (direcao.y / comprimento) * distanciaMm),
      z: 0,
    };
    if (pontosParede.length > 1 && distanciaXY(ponto, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO) {
      concluirDesenhoParede(true);
      return;
    }
    setEngateFim(null);
    setPontosParede((atual) => [...atual, ponto]);
  }

  // Redesenha a pré-visualização (blocos confirmados, marcadores e o segmento elástico até o
  // mouse) sempre que os pontos, o mouse no piso ou as medidas atuais mudam
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const { grupo, segmentos, materialSegmento, marcadores, elastico, marcadorFechar } = cena.parede;

    grupo.visible = ferramenta === 'parede';
    if (ferramenta !== 'parede') return;

    // Enquanto arrasta um vértice, a pré-visualização usa a posição provisória dele; o elástico
    // até o mouse e a detecção de fechamento não fazem sentido nesse momento (ver abaixo)
    const arrastando = verticeArrastado !== null;
    const pontosExibidos = verticeArrastado
      ? pontosParede.map((p, i) => (i === verticeArrastado.indice ? verticeArrastado.posicao : p))
      : pontosParede;

    limparGeometrias(segmentos);
    // Reflete o contorno como ele já estava (fechado ou não) — reeditar um contorno fechado
    // mostra a parede de fechamento também, não só as pontas soltas de um desenho novo. Os
    // engates nas pontas (ver aplicarEngatesNasPontas) já entram aqui, pra pré-visualização bater
    // com o resultado final — sem isso, pareceria que a parede interna atravessa a de fora
    const segmentosPreview = fechadoInicial
      ? construirSegmentosParede(pontosExibidos, true, espessuraParede)
      : aplicarEngatesNasPontas(
          construirSegmentosParede(pontosExibidos, false, espessuraParede),
          engateInicio ?? undefined,
          engateFim ?? undefined,
        );
    for (const segmento of segmentosPreview) {
      const bloco = new Mesh(
        criarGeometriaParede({ comprimento: segmento.comprimento, altura: alturaParedes, espessura: espessuraParede }, []),
        materialSegmento,
      );
      bloco.position.set(segmento.posicao.x, 0, SENTIDO_Z * segmento.posicao.y);
      bloco.rotation.y = MathUtils.degToRad(segmento.rotacaoZ);
      segmentos.add(bloco);
    }

    limparMalhasProprias(marcadores);
    for (const [indice, ponto] of pontosExibidos.entries()) {
      const destacado = verticeArrastado?.indice === indice;
      const esfera = new Mesh(
        new SphereGeometry(indice === 0 ? 70 : destacado ? 60 : 45, 16, 12),
        new MeshBasicMaterial({ color: destacado ? 0xffffff : COR_SELECIONADA }),
      );
      esfera.position.set(ponto.x, 0, SENTIDO_Z * ponto.y);
      marcadores.add(esfera);
    }

    // A "parede fantasma" até o mouse (e o destaque de fechar o contorno) só fazem sentido
    // desenhando do zero: reeditando um contorno existente, ela só atrapalharia a visão dele
    const mostrarPreviaAoMouse = !arrastando && !chaveEdicaoParede;
    const ultimoPonto = pontosExibidos.at(-1);
    const fechando =
      mostrarPreviaAoMouse &&
      mouseNoChao !== null &&
      pontosExibidos.length > 1 &&
      distanciaXY(mouseNoChao, pontosExibidos[0]) <= LIMIAR_FECHAR_CONTORNO;
    const comprimentoElastico =
      mostrarPreviaAoMouse && ultimoPonto && mouseNoChao ? distanciaXY(ultimoPonto, mouseNoChao) : 0;

    if (mostrarPreviaAoMouse && ultimoPonto && mouseNoChao && comprimentoElastico >= MEDIDA_MINIMA && !fechando) {
      elastico.geometry.dispose();
      elastico.geometry = criarGeometriaParede(
        { comprimento: comprimentoElastico, altura: alturaParedes, espessura: espessuraParede },
        [],
      );
      elastico.position.set(ultimoPonto.x, 0, SENTIDO_Z * ultimoPonto.y);
      elastico.rotation.y = MathUtils.degToRad(anguloGraus(ultimoPonto, mouseNoChao));
      elastico.visible = true;
    } else {
      elastico.visible = false;
    }

    marcadorFechar.visible = fechando;
    if (fechando) marcadorFechar.position.set(pontosExibidos[0].x, 0, SENTIDO_Z * pontosExibidos[0].y);
  }, [
    pontosParede,
    mouseNoChao,
    verticeArrastado,
    fechadoInicial,
    alturaParedes,
    espessuraParede,
    ferramenta,
    chaveEdicaoParede,
    engateInicio,
    engateFim,
  ]);

  // Redesenha a trena: a linha entre os pontos confirmados, um marcador em cada um, o segmento
  // elástico até o mouse e uma etiqueta de distância por segmento (inclusive a do elástico)
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const { grupo, linha, elastico, marcadores, etiquetas } = cena.trena;

    grupo.visible = ferramenta === 'trena';
    if (ferramenta !== 'trena') return;

    // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo, espelhado
    const posicaoCena = (p: Posicao) => new Vector3(p.x, p.z, SENTIDO_Z * p.y);
    const etiquetar = (a: Posicao, b: Posicao) => {
      const meio = posicaoCena({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
      const html = document.createElement('div');
      html.className = styles.etiquetaTrena;
      html.textContent = `${formatarCm(distancia3D(a, b))} cm`;
      const etiqueta = new CSS2DObject(html);
      etiqueta.position.copy(meio);
      etiquetas.add(etiqueta);
    };

    linha.geometry.dispose();
    linha.geometry = new BufferGeometry().setFromPoints(pontosTrena.map(posicaoCena));

    limparMalhasProprias(marcadores);
    for (const ponto of pontosTrena) {
      const esfera = new Mesh(new SphereGeometry(RAIO_MARCADOR_TRENA, 12, 8), new MeshBasicMaterial({ color: COR_TRENA }));
      esfera.position.copy(posicaoCena(ponto));
      marcadores.add(esfera);
    }

    limparEtiquetas(etiquetas);
    for (let i = 1; i < pontosTrena.length; i++) etiquetar(pontosTrena[i - 1], pontosTrena[i]);

    const ultimoPonto = pontosTrena.at(-1);
    if (ultimoPonto && mouseTrena && distancia3D(ultimoPonto, mouseTrena) >= MEDIDA_MINIMA) {
      elastico.geometry.dispose();
      elastico.geometry = new BufferGeometry().setFromPoints([posicaoCena(ultimoPonto), posicaoCena(mouseTrena)]);
      elastico.visible = true;
      etiquetar(ultimoPonto, mouseTrena);
    } else {
      elastico.visible = false;
    }
  }, [pontosTrena, mouseTrena, ferramenta]);

  async function importarImagemTinta(arquivo: File) {
    setCarregandoImagemTinta(true);
    setErroTinta(null);
    try {
      setImagemTinta(await lerTexturaJpeg(arquivo));
      setNomeImagemTinta(arquivo.name);
    } catch (e) {
      setErroTinta(e instanceof Error ? e.message : 'Não foi possível importar a imagem.');
    } finally {
      setCarregandoImagemTinta(false);
    }
  }

  function enquadrarAtual() {
    const cena = cenaRef.current;
    if (!cena) return;
    // Com um grupo aberto, enquadra só o grupo; na raiz, a árvore inteira e a planta do ambiente
    const grupo = contexto ? objetosRef.current.get(contexto)?.container : undefined;
    if (!grupo || !enquadrar(cena, grupo)) {
      enquadrar(cena, cena.raiz, planta ? cena.sala.grupo : undefined);
    }
  }

  // Clicar de novo na peça/grupo já focado (ou sem nada selecionado) sai do foco; com uma seleção
  // diferente, troca o foco pra ela — sempre reenquadrando o módulo focado
  function alternarFoco() {
    if (chaveEmFoco && (!selecionada || selecionada === chaveEmFoco)) {
      setChaveEmFoco(null);
      return;
    }
    if (!selecionada) return;
    setChaveEmFoco(selecionada);
    const cena = cenaRef.current;
    const alvo = objetosRef.current.get(selecionada);
    if (cena && alvo) enquadrar(cena, alvo.container);
  }

  const dicaFerramenta =
    ferramenta === 'selecionar'
      ? 'Clique para selecionar · Ctrl+clique seleciona vários · duplo clique edita o conteúdo · arraste para orbitar'
      : !selecionada
        ? `Clique em um elemento para ${ferramenta === 'mover' ? 'mover' : 'girar'}`
        : ferramenta === 'mover'
          ? 'Arraste as setas para mover em X, Y e Z'
          : `Arraste os anéis para girar em X, Y e Z (passos de ${PASSO_ROTACAO}°)`;
  const dica = contexto ? `${dicaFerramenta} · Esc sai` : dicaFerramenta;

  const ultimoPontoTrena = pontosTrena.at(-1);
  const distanciaSegmentoTrena = ultimoPontoTrena && mouseTrena ? distancia3D(ultimoPontoTrena, mouseTrena) : null;
  const distanciaTotalTrena =
    pontosTrena.slice(1).reduce((soma, ponto, i) => soma + distancia3D(pontosTrena[i], ponto), 0) +
    (distanciaSegmentoTrena ?? 0);

  const ultimoPontoParede = chaveEdicaoParede ? undefined : pontosParede.at(-1);
  const distanciaAtual = ultimoPontoParede && mouseNoChao ? distanciaXY(ultimoPontoParede, mouseNoChao) : null;
  const fechandoContorno =
    !chaveEdicaoParede &&
    mouseNoChao !== null &&
    pontosParede.length > 1 &&
    distanciaXY(mouseNoChao, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO;

  return (
    <div className={styles.viewport}>
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.acoes}>
        <button type="button" className={styles.botao} onClick={enquadrarAtual}>
          Enquadrar
        </button>
        <button
          type="button"
          className={styles.botao}
          aria-pressed={chaveEmFoco !== null}
          disabled={!selecionada && !chaveEmFoco}
          title={chaveEmFoco ? 'Mostrar o restante do projeto' : 'Esconder tudo, menos o módulo selecionado'}
          onClick={alternarFoco}
        >
          {chaveEmFoco && (!selecionada || selecionada === chaveEmFoco) ? 'Sair do foco' : 'Focar módulo'}
        </button>
      </div>
      {ferramenta === 'parede' ? (
        <div className={styles.barraParede}>
          <p className={`${styles.dicaParede} ${styles.dicaConstrutorParede}`}>
            {chaveEdicaoParede
              ? 'Arraste um canto para movê-lo · clique numa parede insere um canto ali · arraste um canto até o vizinho remove · clique perto do início fecha'
              : 'Clique no piso para marcar os cantos · clique perto do início fecha o contorno'}
          </p>
          <div className={styles.linhaParede}>
            <div className={styles.campoEspessura}>
              <CampoMedida
                rotulo="Espessura"
                valor={espessuraParede}
                min={MEDIDA_MINIMA}
                max={MEDIDA_MAXIMA}
                onConfirmar={setEspessuraParede}
              />
            </div>
            <span className={styles.infoParede}>Altura: {formatarCm(alturaParedes)} cm</span>
            {distanciaAtual !== null && fechandoContorno && (
              <span className={styles.infoParede}>Fechar contorno</span>
            )}
            {ultimoPontoParede && !fechandoContorno && (
              <div className={styles.campoDistanciaParede}>
                <CampoMedida
                  ref={distanciaParedeInputRef}
                  rotulo="Distância"
                  valor={distanciaAtual ?? 0}
                  min={MEDIDA_MINIMA}
                  max={PAREDE_COMPRIMENTO_MAXIMO}
                  mensagemRecusa="Aponte o mouse na direção da próxima parede antes de confirmar"
                  onConfirmar={(valor) => {
                    if (!mouseNoChao) return false;
                    confirmarDistanciaParede(valor);
                  }}
                />
              </div>
            )}
            <div className={styles.acoesParede}>
              <button type="button" className={styles.botaoSecundario} title="Cancelar (Esc)" onClick={onCancelarParede}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Desfazer o último canto (Backspace)"
                disabled={pontosParede.length === 0}
                onClick={desfazerUltimoPontoParede}
              >
                Desfazer
              </button>
              <button
                type="button"
                className={styles.botaoPrimario}
                title="Concluir (Enter)"
                disabled={pontosParede.length < 2}
                onClick={() => concluirDesenhoParede(deveFecharContorno())}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      ) : ferramenta === 'trena' ? (
        <div className={styles.barraParede}>
          <p className={styles.dicaParede}>Clique para marcar pontos de medição</p>
          <div className={styles.linhaParede}>
            {distanciaSegmentoTrena !== null && (
              <span className={styles.infoParede}>Segmento: {formatarCm(distanciaSegmentoTrena)} cm</span>
            )}
            {pontosTrena.length > 1 && (
              <span className={styles.infoParede}>Total: {formatarCm(distanciaTotalTrena)} cm</span>
            )}
            <div className={styles.acoesParede}>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Desfazer o último ponto (Backspace)"
                disabled={pontosTrena.length === 0}
                onClick={() => setPontosTrena((atual) => atual.slice(0, -1))}
              >
                Desfazer
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Limpar tudo (Esc)"
                disabled={pontosTrena.length === 0}
                onClick={() => setPontosTrena([])}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      ) : ferramenta === 'pintura' ? (
        <div className={styles.painelPintura}>
          <div className={styles.painelPinturaCabecalho}>
            <strong>Pintura</strong>
            <div role="group" aria-label="Tipo de tinta" className={styles.modoTinta}>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'cor'}
                onClick={() => setModoTinta('cor')}
              >
                Cor
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'imagem'}
                onClick={() => setModoTinta('imagem')}
              >
                Imagem
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'remover'}
                onClick={() => setModoTinta('remover')}
              >
                Remover
              </button>
            </div>
          </div>

          {modoTinta === 'cor' && (
            <label className={styles.corTinta}>
              <input type="color" value={corTinta} onChange={(e) => setCorTinta(e.target.value)} />
              {corTinta}
            </label>
          )}

          {modoTinta === 'imagem' && (
            <div className={styles.painelPinturaImagem}>
              <div className={styles.previewMaterial}>
                {imagemTinta ? (
                  ehCorSolida(imagemTinta) ? (
                    <span className={styles.previewSwatch} style={{ background: imagemTinta }} aria-hidden />
                  ) : (
                    <img className={styles.previewSwatch} src={imagemTinta} alt="" />
                  )
                ) : (
                  <span className={styles.previewSwatch} aria-hidden />
                )}
                <span className={styles.infoParede}>{nomeImagemTinta ?? 'Nenhuma textura escolhida'}</span>
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  disabled={carregandoImagemTinta}
                  onClick={() => inputImagemTintaRef.current?.click()}
                >
                  {carregandoImagemTinta ? 'Carregando…' : 'Importar…'}
                </button>
                <input
                  ref={inputImagemTintaRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = '';
                    if (arquivo) void importarImagemTinta(arquivo);
                  }}
                />
              </div>

              {importandoTexturaAutomaticamente && <p role="status">Importando texturas novas encontradas na pasta do servidor…</p>}
              {texturasSalvas.isPending ? (
                <p className={styles.dicaParede}>Carregando texturas…</p>
              ) : texturasSalvas.isError ? (
                <p className={styles.dicaParede} role="alert">
                  Não foi possível carregar as texturas.
                </p>
              ) : texturasSalvas.data.length === 0 ? (
                <p className={styles.dicaParede}>Nenhuma textura salva ainda — importe uma imagem acima.</p>
              ) : (
                <ul className={styles.gradeTexturas}>
                  {texturasSalvas.data.map((textura) => (
                    <li key={textura.id}>
                      <button
                        type="button"
                        className={textura.url === imagemTinta ? styles.itemTexturaAtivo : styles.itemTextura}
                        title="Usar esta textura"
                        onClick={() => {
                          setImagemTinta(textura.url);
                          setNomeImagemTinta('Textura salva');
                          setErroTinta(null);
                        }}
                      >
                        <img className={styles.imagemTextura} src={textura.url} alt="" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className={styles.dicaParede}>
            {modoTinta === 'remover'
              ? 'Clique numa face pra tirar a textura dela'
              : 'Clique numa face da peça, parede ou piso pra aplicar'}
          </p>

          {selecionada &&
            elementos[selecionada]?.gruposDeFace &&
            Object.keys(elementos[selecionada].gruposDeFace).length > 0 && (
              <div className={styles.gruposPintura}>
                <span className={styles.infoParede}>Pintar grupo:</span>
                {Object.keys(elementos[selecionada].gruposDeFace)
                  .sort()
                  .map((nomeGrupo) => (
                    <button
                      key={nomeGrupo}
                      type="button"
                      className={styles.botaoSecundario}
                      disabled={modoTinta === 'imagem' && !imagemTinta}
                      onClick={() =>
                        onPintarGrupo(
                          selecionada,
                          nomeGrupo,
                          modoTinta === 'cor' ? corTinta : modoTinta === 'imagem' ? imagemTinta : null,
                        )
                      }
                    >
                      {nomeGrupo}
                    </button>
                  ))}
              </div>
            )}

          {erroTinta && (
            <p className={styles.dicaParede} role="alert">
              {erroTinta}
            </p>
          )}
        </div>
      ) : (
        <span className={styles.dica}>{dica}</span>
      )}
    </div>
  );
}
