import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { FORMAS } from '../../../lib/formas/formas';
import { extrairMalhaDoCanto } from '../../../lib/modelo3d/modelo3d';
import type { ElementoModulo } from '../../../lib/projetos/projetos';
import styles from './ModuloMiniatura.module.css';

const COR_PECA = 0xb8b8b8;
const COR_PAREDE = 0xcdc4b3;
// Mesma convenção do editor: Y positivo nos dados (profundidade) aponta pra longe da câmera, e
// vira o Z nativo da cena — mas o Z nativo positivo do three.js aponta pra câmera, daí o -Z aqui
const SENTIDO_Z = -1;

interface ModuloMiniaturaProps {
  elemento: ElementoModulo;
}

// Monta uma malha por peça/parede da subárvore, cada uma dentro de um grupo próprio que carrega a
// posição/rotação dela — igual à cena principal, só sem vãos, piso, cor de seleção ou interação:
// o suficiente pra dar uma ideia da forma numa miniatura estática. Peça de modelo 3D carrega de
// forma assíncrona (GLTFLoader não tem versão síncrona); a promessa correspondente entra em
// `carregamentos`, pra quem chamou saber quando a subárvore inteira está pronta pra enquadrar/renderizar
function montarSubarvore(no: ElementoModulo, pai: Group, carregamentos: Promise<void>[]) {
  // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo, espelhado
  // (mesma fronteira de ModuloViewport.tsx)
  const container = new Group();
  container.position.set(no.posicao.x, no.posicao.z, SENTIDO_Z * no.posicao.y);
  if (no.rotacao) {
    container.rotation.set(
      (no.rotacao.x * Math.PI) / 180,
      (no.rotacao.z * Math.PI) / 180,
      SENTIDO_Z * ((no.rotacao.y * Math.PI) / 180),
    );
  }
  pai.add(container);

  if (no.tipo === 'peca' && no.modelo3d) {
    const promessa = extrairMalhaDoCanto(no.modelo3d, no.modelo3dNo ?? undefined)
      .then(({ geometria, material }) => {
        const malha = new Mesh(geometria, material);
        // O material vem do arquivo original (compartilhado com outras extrações da mesma
        // malha): descartarSubarvore não deve liberá-lo, só a geometria (cópia própria daqui)
        malha.userData.materialCompartilhado = true;
        // Redimensionável: a malha carrega no tamanho original do arquivo, então escala pela
        // razão até o tamanho atual do elemento (que pode já ter sido redimensionado)
        if (no.tamanho) {
          // nativo é medido na malha (Y/Z nativos do three.js); no.tamanho é o Tamanho dos dados,
          // onde altura é z — mesma fronteira de ajustarModelo em ModuloViewport.tsx
          const nativo = new Box3().setFromObject(malha).getSize(new Vector3());
          malha.scale.set(
            no.tamanho.x / (nativo.x || 1),
            no.tamanho.z / (nativo.y || 1),
            no.tamanho.y / (nativo.z || 1),
          );
        }
        container.add(malha);
      })
      .catch((erro: unknown) => {
        console.error('Não foi possível carregar o modelo 3D da peça:', erro);
      });
    carregamentos.push(promessa);
  } else {
    let geometria: BufferGeometry | null = null;
    let cor = COR_PECA;
    if (no.tipo === 'peca' && no.forma) {
      const definicao = FORMAS[no.forma.tipo];
      geometria = definicao.criarGeometria(no.forma.parametros);
      const tamanho = definicao.tamanho(no.forma.parametros);
      geometria.translate(tamanho.x / 2, tamanho.z / 2, (SENTIDO_Z * tamanho.y) / 2);
    } else if (no.tipo === 'parede' && no.parede) {
      const { comprimento, altura, espessura } = no.parede;
      geometria = new BoxGeometry(comprimento, altura, espessura);
      geometria.translate(comprimento / 2, altura / 2, 0);
      cor = COR_PAREDE;
    }
    if (geometria) {
      container.add(new Mesh(geometria, new MeshStandardMaterial({ color: cor })));
    }
  }

  for (const filho of no.filhos ?? []) montarSubarvore(filho, container, carregamentos);
}

// Libera geometrias e materiais próprios da subárvore — as peças de modelo 3D só cedem a
// geometria (uma cópia própria); o material é o do arquivo original, compartilhado com outras
// extrações da mesma malha (ver montarSubarvore), então nunca é descartado aqui
function descartarSubarvore(raiz: Group) {
  raiz.traverse((objeto) => {
    if (!(objeto instanceof Mesh)) return;
    objeto.geometry.dispose();
    if (objeto.userData.materialCompartilhado) return;
    for (const material of Array.isArray(objeto.material) ? objeto.material : [objeto.material]) {
      material.dispose();
    }
  });
}

// Resolução interna do render, em pixels; o CSS decide o tamanho exibido (o canvas escala como
// qualquer imagem). Fixa porque o container pode estar oculto no momento do mount (ex.: dentro de
// um <dialog> ainda fechado), quando medir a largura em tela (clientWidth) sempre daria 0
const RESOLUCAO = 160;

// Miniatura estática (sem interação, um único render) de uma peça ou grupo salvo como módulo
export default function ModuloMiniatura({ elemento }: ModuloMiniaturaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // Contexto WebGL indisponível (ex.: limite de contextos simultâneos): sem miniatura, sem quebrar a página
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(RESOLUCAO, RESOLUCAO, false);

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 0.9));
    const luz = new DirectionalLight(0xffffff, 1.4);
    luz.position.set(3, 5, 4);
    scene.add(luz);

    const raiz = new Group();
    const carregamentos: Promise<void>[] = [];
    montarSubarvore(elemento, raiz, carregamentos);
    scene.add(raiz);

    let cancelado = false;
    Promise.all(carregamentos).then(() => {
      if (cancelado) return;

      const caixa = new Box3().setFromObject(raiz);
      const centro = caixa.isEmpty() ? new Vector3() : caixa.getCenter(new Vector3());
      const dimensoes = caixa.isEmpty() ? new Vector3(1, 1, 1) : caixa.getSize(new Vector3());
      const raio = Math.max(dimensoes.length() / 2, 1);

      const fov = 35;
      const camera = new PerspectiveCamera(fov, 1, raio / 100, raio * 100);
      // Ângulo isométrico fixo, como a câmera inicial do editor, a uma distância que enquadra tudo
      const distancia = raio / Math.sin(MathUtils.degToRad(fov) / 2);
      camera.position.set(
        centro.x + distancia * 0.62,
        centro.y + distancia * 0.5,
        centro.z + distancia * 0.62,
      );
      camera.lookAt(centro);

      renderer.render(scene, camera);
    });

    return () => {
      cancelado = true;
      descartarSubarvore(raiz);
      renderer.dispose();
    };
  }, [elemento]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
