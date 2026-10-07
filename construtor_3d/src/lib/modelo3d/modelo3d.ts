// Conversão de base64 (formato de elemento.modelo3d ainda não salvo — ver o comentário abaixo)
// pro ArrayBuffer que o GLTFLoader do three.js usa, além do carregamento e extração de malhas de
// um .glb compartilhado por várias peças (ver Elemento.modelo3d/modelo3dNo)

import { Box3, type BufferGeometry, Float32BufferAttribute, Group, Mesh, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * elemento.modelo3d tanto pode ser a URL de um arquivo já salvo (a API guarda o .glb à parte, ver
 * ArquivosElemento) quanto o base64 de um arquivo recém-importado, ainda não salvo. Um .glb sempre
 * começa com os 4 bytes ASCII "glTF", que em base64 sempre começam com "Z"; uma URL sempre começa
 * com "/" — os dois nunca se confundem
 */
export function ehUrlDeArquivo(valor: string): boolean {
  return valor.startsWith('/');
}

export function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

// Um .glb vem em metros (convenção glTF); todo o resto do app trabalha em mm
export const METROS_PARA_MM = 1000;

/** Origem (canto) de uma caixa na convenção do app: mínimo em X/Y, máximo em Z (o Z é invertido
 * em relação a X/Y — ver SENTIDO_Z nos componentes de cena) */
export function origemDoCanto(caixa: Box3): Vector3 {
  return new Vector3(caixa.min.x, caixa.min.y, caixa.max.z);
}

/** Caminho de `no` a partir de `raiz`, como os índices dele (e de cada ancestral) na lista de
 * filhos do próprio pai (ex.: "2.0.1") — é como uma peça grava qual malha de um .glb com várias
 * partes é a dela (ver Elemento.modelo3dNo); noPeloCaminho faz o inverso */
export function caminhoDoNo(raiz: Object3D, no: Object3D): string {
  const indices: number[] = [];
  let atual: Object3D | null = no;
  while (atual && atual !== raiz && atual.parent) {
    indices.unshift(atual.parent.children.indexOf(atual));
    atual = atual.parent;
  }
  return indices.join('.');
}

function noPeloCaminho(raiz: Object3D, caminho: string): Object3D | null {
  let atual: Object3D = raiz;
  for (const parte of caminho.split('.')) {
    const filho: Object3D | undefined = atual.children[Number(parte)];
    if (!filho) return null;
    atual = filho;
  }
  return atual;
}

const gltfLoader = new GLTFLoader();

// Uma cena base (o .glb original, inteiro) por URL/conteúdo: várias peças do mesmo import
// compartilham o mesmo carregamento, sem baixar/decodificar o arquivo mais de uma vez. Nunca é
// removida do cache (fica pro resto da sessão, como o próprio gltfLoader) — extrairMalhaDoCanto
// sempre clona a geometria antes de mexer nela, então reaproveitar a mesma cena depois é seguro
const cacheCenaBase = new Map<string, Promise<Group>>();

function carregarCenaBase(modelo3d: string): Promise<Group> {
  let promessa = cacheCenaBase.get(modelo3d);
  if (promessa) return promessa;

  promessa = (
    ehUrlDeArquivo(modelo3d) ? gltfLoader.loadAsync(modelo3d) : gltfLoader.parseAsync(base64ParaArrayBuffer(modelo3d), '')
  ).then((gltf) => {
    gltf.scene.scale.setScalar(METROS_PARA_MM);
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene;
  });
  // Um carregamento que falhou não fica preso no cache pra sempre — uma tentativa futura
  // (ex.: depois de reconectar) começa do zero
  promessa.catch(() => cacheCenaBase.delete(modelo3d));
  cacheCenaBase.set(modelo3d, promessa);
  return promessa;
}

export interface MalhaExtraida {
  geometria: BufferGeometry;
  /** O mesmo objeto do arquivo (nunca copiado, pode ser compartilhado com outra extração da mesma
   * malha no futuro): quem usa isto nunca deve descartá-lo, só a geometria (ver Malha.geometria) */
  material: Mesh['material'];
}

// Inverte a ordem dos vértices de cada triângulo (sem mudar posição/forma), pra compensar uma
// malha "espelhada" — ver a chamada em extrairMalhaDoCanto
function inverterOrientacao(geometria: BufferGeometry) {
  const indice = geometria.index;
  if (indice) {
    const array = indice.array;
    for (let i = 0; i < array.length; i += 3) {
      const t = array[i + 1];
      array[i + 1] = array[i + 2];
      array[i + 2] = t;
    }
    indice.needsUpdate = true;
    return;
  }
  // Sem índice: cada trio de posições consecutivas já é um triângulo — troca o 2º e o 3º vértice
  // de cada um (posição e, se houver, normal/uv) em vez de reindexar
  for (const nome of ['position', 'normal', 'uv'] as const) {
    const atributo = geometria.getAttribute(nome);
    if (!atributo) continue;
    for (let v = 0; v < atributo.count; v += 3) {
      for (let k = 0; k < atributo.itemSize; k++) {
        const a = atributo.getComponent(v + 1, k);
        const b = atributo.getComponent(v + 2, k);
        atributo.setComponent(v + 1, k, b);
        atributo.setComponent(v + 2, k, a);
      }
    }
    atributo.needsUpdate = true;
  }
}

// Geometria de uma malha, copiada e já achatada no espaço do mundo (ver o comentário de
// espelhamento abaixo) — o primeiro passo comum tanto pra uma peça de malha única quanto pra uma
// de várias camadas (ver extrairMalhaDoCanto)
function geometriaNoMundo(malha: Mesh): BufferGeometry {
  const geometria = malha.geometry.clone();
  geometria.applyMatrix4(malha.matrixWorld);
  // Uma peça "espelhada" no arquivo (escala negativa em algum ancestral — comum em móvel
  // espelhado, layout simétrico) tem o sentido dos triângulos invertido depois de congelar o
  // matrixWorld nos vértices assim: o three.js sabe compensar isso sozinho pra desenhar a cena
  // ORIGINAL (olha o sinal do determinante do objeto na hora de decidir frente/verso), mas essa
  // malha nova nasce com transform limpo (sem espelhamento nenhum nela mesma) — perde a pista.
  // Sem corrigir aqui, a face vira "de trás" pro backface culling: some de frente, só aparece
  // olhando por trás da peça
  if (malha.matrixWorld.determinant() < 0) inverterOrientacao(geometria);
  return geometria;
}

// mergeGeometries recusa (devolve null, sem lançar) um conjunto onde uma geometria não tem um
// atributo que as outras têm — comum em arquivos de CAD, onde uma camada sem textura (ex.: o
// fundo de um compartimento, que ninguém vê) não exporta "uv" nenhum. Preenche com zero o que
// falta em cada uma, só pra equiparar o conjunto de atributos; não muda a aparência de quem já
// tinha o atributo, e quem não tinha não usava mesmo (sem mapa de textura pra ler esse uv)
function equipararAtributos(geometrias: BufferGeometry[]): void {
  const nomesDeTodas = new Set<string>();
  for (const geometria of geometrias) for (const nome of Object.keys(geometria.attributes)) nomesDeTodas.add(nome);

  for (const geometria of geometrias) {
    const vertices = geometria.attributes.position.count;
    for (const nome of nomesDeTodas) {
      if (geometria.getAttribute(nome)) continue;
      const referencia = geometrias.find((outra) => outra.getAttribute(nome));
      if (!referencia) continue;
      const itemSize = referencia.getAttribute(nome).itemSize;
      geometria.setAttribute(nome, new Float32BufferAttribute(new Float32Array(vertices * itemSize), itemSize));
    }
  }
}

// Reoriga a geometria (já no espaço do mundo) no canto, pronta pra virar o modelo de uma peça —
// passo final comum, depois de ter uma geometria só (de uma malha ou já mescladas de várias)
function reorigarNoCanto(geometria: BufferGeometry): BufferGeometry {
  geometria.computeBoundingBox();
  const origem = origemDoCanto(geometria.boundingBox ?? new Box3());
  geometria.translate(-origem.x, -origem.y, -origem.z);
  // Sem isso, a malha só ganha uma boundingSphere na hora em que o three.js precisar dela pela
  // primeira vez (frustum culling, raycasting do clique) — calculada tarde demais importa pouco
  // aqui, mas em cena grande (planta importada inteira) isso já causou peça sumindo ao orbitar: o
  // culling usa uma esfera desatualizada/errada até alguém forçar o recálculo. Melhor deixar
  // pronta, já no espaço final (depois do translate acima)
  geometria.computeBoundingSphere();
  return geometria;
}

/**
 * Carrega (ou reaproveita, se outra peça do mesmo import já pediu) o arquivo original de
 * `modelo3d` e extrai a malha de `modelo3dNo` dentro dele (ver Elemento.modelo3dNo), com uma
 * geometria própria (cópia, já no espaço do mundo) reorigada no canto — pronta pra virar o modelo
 * de uma peça, do jeito que as cenas do app esperam (origemDoCanto).
 *
 * `modelo3dNo` pode apontar tanto pra uma malha só quanto pra um nó com várias malhas-filhas
 * diretas (ver `pecaMesclada` em importarGlb.ts: corpo + fita de borda de um painel, por exemplo)
 * — nesse segundo caso, as malhas são mescladas numa geometria só, com um material por camada
 * (`MalhaExtraida.material` vira um array, na mesma ordem dos filhos do nó), preservando a
 * aparência de cada uma em vez de virarem peças soltas.
 */
export async function extrairMalhaDoCanto(modelo3d: string, modelo3dNo: string | undefined): Promise<MalhaExtraida> {
  const cenaBase = await carregarCenaBase(modelo3d);
  const no = modelo3dNo ? noPeloCaminho(cenaBase, modelo3dNo) : cenaBase;
  if (no instanceof Mesh) {
    return { geometria: reorigarNoCanto(geometriaNoMundo(no)), material: no.material };
  }

  const camadas = (no?.children ?? []).filter((filho): filho is Mesh => filho instanceof Mesh);
  if (camadas.length === 0) throw new Error('Malha não encontrada no modelo 3D.');

  const geometriasDasCamadas = camadas.map(geometriaNoMundo);
  equipararAtributos(geometriasDasCamadas);
  const geometria = mergeGeometries(geometriasDasCamadas, true);
  for (const geometriaDaCamada of geometriasDasCamadas) geometriaDaCamada.dispose();
  if (!geometria) throw new Error('Não foi possível juntar as camadas do modelo 3D.');
  // Uma camada (um "Geom3D" folha) sempre tem um material só na prática; se algum dia vier um
  // array (mesh com mais de um grupo de material nela mesma), usa só o primeiro — manter um
  // material por camada aqui é o que casa 1 pra 1 com os grupos que mergeGeometries criou acima
  const materialDaCamada = (camada: Mesh) => (Array.isArray(camada.material) ? camada.material[0] : camada.material);
  return { geometria: reorigarNoCanto(geometria), material: camadas.map(materialDaCamada) };
}
