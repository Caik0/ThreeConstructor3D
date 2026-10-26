// Desenhos auxiliares da cena: eixos, sala (piso e caixa da planta), pré-visualização do construtor de paredes e da trena.

import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { type Posicao } from '../../../lib/projetos/projetos';
import {
  COR_CAIXA_SALA,
  COR_PAREDE,
  COR_PISO_SALA,
  COR_SELECIONADA,
  COR_TRENA,
  CORES_EIXOS,
  SENTIDO_Z,
} from './constantes';
import { type DesenhoParede, type DesenhoTrena, type Sala } from './tipos';
import { limparEtiquetas, limparGeometrias, limparMalhasProprias } from './utilitarios';

// Eixos no estilo do SketchUp: contínuos no sentido positivo e tracejados no negativo.
// A geometria tem comprimento 1; o tamanho real vem da escala do grupo
export function criarEixos(sobrepostos: boolean) {
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

export function descartarEixos(eixos: Group) {
  eixos.removeFromParent();
  for (const linha of eixos.children as Line<BufferGeometry, LineBasicMaterial>[]) {
    linha.geometry.dispose();
    linha.material.dispose();
  }
}

export function criarSala(): Sala {
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
export function atualizarSala(sala: Sala, planta: Posicao | null) {
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

export function descartarSala(sala: Sala) {
  sala.grupo.removeFromParent();
  sala.chao.geometry.dispose();
  sala.chao.material.dispose();
  sala.caixa.geometry.dispose();
  sala.caixa.material.dispose();
}

export function criarDesenhoParede(): DesenhoParede {
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

export function descartarDesenhoParede(desenho: DesenhoParede) {
  desenho.grupo.removeFromParent();
  limparGeometrias(desenho.segmentos);
  desenho.materialSegmento.dispose();
  limparMalhasProprias(desenho.marcadores);
  desenho.elastico.geometry.dispose();
  desenho.elastico.material.dispose();
  desenho.marcadorFechar.geometry.dispose();
  desenho.marcadorFechar.material.dispose();
}

export function criarDesenhoTrena(): DesenhoTrena {
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

export function descartarDesenhoTrena(desenho: DesenhoTrena) {
  desenho.grupo.removeFromParent();
  desenho.linha.geometry.dispose();
  desenho.linha.material.dispose();
  desenho.elastico.geometry.dispose();
  desenho.elastico.material.dispose();
  limparMalhasProprias(desenho.marcadores);
  limparEtiquetas(desenho.etiquetas);
}
