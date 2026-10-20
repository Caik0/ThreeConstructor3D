// Utilitários pequenos do viewport 3D: ponteiro, visibilidade, rotação, limites e limpeza de objetos three.js.

import { Group, MathUtils, Mesh, MeshBasicMaterial, type Object3D, Vector2 } from 'three';
import { LIMITE_POSICAO, type Posicao, type Rotacao } from '../../../lib/projetos/projetos';
import { normalizarGraus } from '../../../lib/transformacoes/transformacoes';
import { SENTIDO_Z } from './constantes';
import { type ObjetoElemento } from './tipos';

// Coordenadas normalizadas (-1..1) do ponteiro dentro do canvas, como o Raycaster espera
export function ponteiroNormalizado(e: { clientX: number; clientY: number }, dom: HTMLElement): Vector2 {
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
export function visivelNaCena(objeto: Object3D): boolean {
  for (let atual: Object3D | null = objeto; atual !== null; atual = atual.parent) {
    if (!atual.visible) return false;
  }
  return true;
}

// Malhas clicáveis de todos os elementos visíveis (peças, paredes, pisos e modelos 3D importados),
// usada tanto pra selecionar quanto pra medir com a trena
export function malhasVisiveis(objetos: Map<string, ObjetoElemento>): Mesh[] {
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

// Grupo com meshes cujo material é próprio (descartado junto): usado pelos marcadores
export function limparMalhasProprias(grupo: Group) {
  for (const filho of [...grupo.children]) {
    if (filho instanceof Mesh) {
      filho.geometry.dispose();
      (filho.material as MeshBasicMaterial).dispose();
    }
    grupo.remove(filho);
  }
}

// Grupo com meshes que compartilham um material externo (só a geometria é descartada aqui)
export function limparGeometrias(grupo: Group) {
  for (const filho of [...grupo.children]) {
    if (filho instanceof Mesh) filho.geometry.dispose();
    grupo.remove(filho);
  }
}

// As etiquetas (CSS2DObject) não têm geometria/material de GPU: só sair da cena já basta (o
// próprio CSS2DObject tira o <div> do DOM, ver o listener "removed" da classe)
export function limparEtiquetas(grupo: Group) {
  for (const filho of [...grupo.children]) grupo.remove(filho);
}

// Rotação guardada (positiva no sentido anti-horário visto da ponta positiva do eixo) para a cena.
// Z nos dados é altura — vira o Y nativo da cena (vertical, three.js), direto. Y nos dados é
// profundidade — vira o Z nativo (aponta pra -Z da cena), por isso só esse ângulo troca de sinal
export function aplicarRotacao(objeto: Object3D, rotacao: Rotacao) {
  objeto.rotation.set(
    MathUtils.degToRad(rotacao.x),
    MathUtils.degToRad(rotacao.z),
    SENTIDO_Z * MathUtils.degToRad(rotacao.y),
  );
}

export function rotacaoDaCena(objeto: Object3D): Rotacao {
  const graus = (radianos: number) => normalizarGraus(Math.round(MathUtils.radToDeg(radianos) * 100) / 100);
  return {
    x: graus(objeto.rotation.x),
    y: graus(SENTIDO_Z * objeto.rotation.z),
    z: graus(objeto.rotation.y),
  };
}

export function limitarPosicao(valor: number) {
  return Math.max(-LIMITE_POSICAO, Math.min(LIMITE_POSICAO, Math.round(valor)));
}

// Distância entre dois pontos em qualquer direção (a trena mede em 3D — ao contrário das paredes,
// sempre no piso — já que o ponto pode estar em cima de qualquer peça, em qualquer altura)
export function distancia3D(a: Posicao, b: Posicao): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
