import { LineSegments, Mesh, type Group, type Material } from 'three';

// Remove os filhos do grupo e libera geometrias e materiais da GPU
export function limparGrupo(grupo: Group) {
  for (const filho of [...grupo.children]) {
    if (filho instanceof Mesh || filho instanceof LineSegments) {
      filho.geometry.dispose();
      (filho.material as Material).dispose();
    }
    grupo.remove(filho);
  }
}
