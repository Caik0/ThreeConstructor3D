// Vistas do botão Enquadrar (isométrica, topo, base, frente, fundo, esquerda, direita) e o enquadramento da câmera.

import { Box3, type Object3D, type PerspectiveCamera, Sphere, Vector3 } from 'three';
import { type Cena } from './tipos';

// Posiciona a câmera para mostrar o objeto (e o extra, se houver) inteiros;
// devolve false se não há o que mostrar
// Vistas do enquadramento: de que lado a câmera olha (direção do alvo até a câmera, no espaço da
// cena: X direita, Y pra cima, Z pra câmera — a "frente" dos dados é o +Z). Em Topo e Base o eixo
// vertical sobra um fio de Z só pra câmera não apontar exatamente pro "pra cima" e girar à toa
export const VISTAS = {
  isometrica: { rotulo: 'Isométrica', direcao: new Vector3(1, 0.7, 1.3) },
  topo: { rotulo: 'Topo', direcao: new Vector3(0, 1, 0.0001) },
  base: { rotulo: 'Base', direcao: new Vector3(0, -1, 0.0001) },
  frente: { rotulo: 'Frente', direcao: new Vector3(0, 0, 1) },
  fundo: { rotulo: 'Fundo', direcao: new Vector3(0, 0, -1) },
  esquerda: { rotulo: 'Esquerda', direcao: new Vector3(-1, 0, 0) },
  direita: { rotulo: 'Direita', direcao: new Vector3(1, 0, 0) },
} as const;
export type VistaId = keyof typeof VISTAS;
export const ORDEM_DAS_VISTAS: VistaId[] = ['isometrica', 'topo', 'base', 'frente', 'fundo', 'esquerda', 'direita'];

// Planos de corte da câmera acompanhando a distância até o alvo: perto de um objeto minúsculo o
// "perto" encolhe junto (senão ele some cortado), e longe o "longe" cresce (senão, depois de
// focar algo pequeno e afastar, tudo ficaria além do plano distante e a cena virava só o fundo cinza)
export function ajustarPlanosDeCorte(camera: PerspectiveCamera, alvo: Vector3) {
  const distancia = camera.position.distanceTo(alvo);
  const near = Math.max(1e-4, Math.min(10, distancia / 100));
  const far = Math.max(100000, distancia * 100);
  if (near === camera.near && far === camera.far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

export function enquadrar({ camera, controls }: Cena, objeto: Object3D | Object3D[], extra?: Object3D, vista: VistaId = 'isometrica') {
  const caixa = new Box3();
  for (const o of Array.isArray(objeto) ? objeto : [objeto]) caixa.union(new Box3().setFromObject(o));
  if (extra) caixa.union(new Box3().setFromObject(extra));
  if (caixa.isEmpty()) return false;

  const centro = caixa.getCenter(new Vector3());
  const raio = caixa.getBoundingSphere(new Sphere()).radius;
  const distancia = (raio / Math.sin((camera.fov * Math.PI) / 360)) * 1.1;
  const direcao = VISTAS[vista].direcao.clone().normalize();

  camera.position.copy(centro).addScaledVector(direcao, distancia);
  controls.target.copy(centro);
  ajustarPlanosDeCorte(camera, centro);
  controls.update();
  return true;
}
