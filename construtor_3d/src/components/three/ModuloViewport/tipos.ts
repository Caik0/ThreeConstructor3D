// Tipos compartilhados entre o viewport 3D e os módulos de apoio dele.

import {
  Box3,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBB } from 'three/addons/math/OBB.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { type Forma, type Parede, type Piso, type Posicao } from '../../../lib/projetos/projetos';
import { type ElementoEditor } from '../../../store/editorStore';

// Objetos 3D de um elemento: o contêiner leva a posição relativa ao pai e recebe os
// contêineres dos filhos; peças têm também malha e arestas dentro dele
export interface ObjetoElemento {
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
  furacao?: boolean;
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
export interface Sala {
  grupo: Group;
  chao: Mesh<PlaneGeometry, MeshBasicMaterial>;
  caixa: LineSegments<BufferGeometry, LineDashedMaterial>;
}

// Pré-visualização do construtor de paredes: desenhada direto no piso da cena 3D, sobre o
// alvo real (não usa `objetos`, que só existe para elementos já salvos na árvore)
export interface DesenhoParede {
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
export interface DesenhoTrena {
  grupo: Group;
  linha: Line<BufferGeometry, LineBasicMaterial>;
  elastico: Line<BufferGeometry, LineBasicMaterial>;
  marcadores: Group;
  etiquetas: Group;
}

export interface Cena {
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

// Modelo 3D: não há "faces" de verdade, então cada triângulo vai pra face da caixa envolvente que
// mais se parece com a direção dele (a da maior componente da normal), e a imagem é projetada
// plana nessa face (u/v vistos de fora dela, como numa caixa). A geometria dividida é guardada na
// própria malha pra não refazer; a original volta quando as texturas saem
export interface OriginalMalha {
  geometria: BufferGeometry;
  material: Material | Material[];
  dividida?: BufferGeometry;
  materiais?: MeshStandardMaterial[];
}

// Um vão pronto pra recortar: deslocamento/peitoril vêm da posição do elemento dele (relativa à
// origem da parede-mãe), largura/altura são as medidas próprias dele
export interface VaoParaRecorte {
  deslocamento: number;
  peitoril: number;
  largura: number;
  altura: number;
}

// Um retângulo (no plano X/Y local da parede) que sobrou do recorte dos vãos
export interface CelulaParede {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// Uma forma sólida pra colisão: a caixa orientada (gira junto com o elemento, é a forma de verdade)
// e a caixa alinhada aos eixos que a envolve (só serve de filtro rápido e pras medições de vão)
export interface Colisor {
  caixa: Box3;
  orientada: OBB;
}

export interface VaoVizinho {
  distancia: number;
  posicao: Vector3;
}
