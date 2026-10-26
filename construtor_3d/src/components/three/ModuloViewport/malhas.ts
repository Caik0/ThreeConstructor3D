// Malhas dos elementos: geometria das formas, materiais, texturas por face, modelos 3D importados, aparência (seleção e contexto), caixa do grupo, etiqueta e descarte.

import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FACES_MODELO, FACES_TEXTURA, facesDaForma, FORMAS } from '../../../lib/formas/formas';
import { type Forma, type Posicao } from '../../../lib/projetos/projetos';
import { extrairMalhaDoCanto } from '../../../lib/modelo3d/modelo3d';
import { ehCorSolida } from '../../../lib/textura/textura';
import { type ElementoEditor, limitesLocais } from '../../../store/editorStore';
import styles from './ModuloViewport.module.css';
import {
  COR_DESTAQUE_OBJETO,
  COR_FURO,
  COR_PECA,
  COR_SELECIONADA,
  COR_SELECIONADA_TEXTURA,
  OPACIDADE_FORA_DO_CONTEXTO,
  SENTIDO_Z,
} from './constantes';
import { type ObjetoElemento, type OriginalMalha } from './tipos';

// A geometria crua (FORMAS[tipo].criarGeometria) já nasce com a altura no Y nativo do three.js
// (convenção da própria biblioteca, ver criarGeometriaCaixa/CylinderGeometry) — mas `tamanho` é o
// Tamanho dos DADOS do app, onde quem é altura é o Z (ver FORMAS[tipo].tamanho); por isso
// tamanho.z alimenta o Y da cena aqui, e tamanho.y (profundidade) o Z dela
export function criarGeometria({ tipo, parametros }: Forma) {
  const geometria = FORMAS[tipo].criarGeometria(parametros);
  const tamanho = FORMAS[tipo].tamanho(parametros);
  geometria.translate(tamanho.x / 2, tamanho.z / 2, (SENTIDO_Z * tamanho.y) / 2);
  return geometria;
}

// Cria a malha e as arestas na primeira vez, e troca só a geometria nas seguintes
export function definirMalha(objeto: ObjetoElemento, chave: string, geometria: BufferGeometry, corBase: number) {
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
export function definirTexturas(objeto: ObjetoElemento, faces: string[], texturas: Record<string, string> | undefined) {
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

export function faceClicada(elemento: ElementoEditor, normal: { x: number; y: number; z: number }): string {
  if (elemento.forma && facesDaForma(elemento.forma) === FACES_TEXTURA.cilindro) {
    return Math.abs(normal.y) > 0.5 ? (normal.y >= 0 ? 'topo' : 'base') : 'lateral';
  }
  return FACES_TEXTURA.caixa[indiceFaceDaNormal(normal)];
}

export function dividirPorFaces(origem: BufferGeometry): BufferGeometry {
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

export function definirForma(objeto: ObjetoElemento, chave: string, forma: Forma, furacao: boolean) {
  definirMalha(objeto, chave, criarGeometria(forma), furacao ? COR_FURO : COR_PECA);
  objeto.furacao = furacao;
  objeto.forma = forma;
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
export function ajustarModelo(objeto: ObjetoElemento) {
  const { modelo, modeloTamanhoNativo: nativo, tamanhoAlvo: alvo } = objeto;
  if (!modelo || !nativo || !alvo) return;
  // `nativo` é medido direto na malha carregada (Box3 sobre o three.js) — sempre Y nativo/altura,
  // Z nativo/profundidade, como qualquer objeto three.js. `alvo` é o Tamanho dos dados do app,
  // onde quem é altura é o Z (ver FORMAS[tipo].tamanho) — por isso alvo.z / nativo.y (não alvo.y)
  modelo.scale.set(alvo.x / (nativo.x || 1), alvo.z / (nativo.y || 1), alvo.y / (nativo.z || 1));
  definirTexturasModelo(objeto, objeto.texturasAlvo);
}

export const chaveModelo3d = (modelo3d: string, modelo3dNo: string | undefined) => `${modelo3d}#${modelo3dNo ?? ''}`;

export function definirModelo3d(objeto: ObjetoElemento, chave: string, modelo3d: string, modelo3dNo: string | undefined) {
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

export function aplicarAparencia(objeto: ObjetoElemento, selecionado: boolean, foraDoContexto: boolean) {
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
export function atualizarCaixaGrupo(
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
export function definirEtiqueta(objeto: ObjetoElemento, elemento: ElementoEditor, esmaecida: boolean) {
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

export function descartarObjeto(objeto: ObjetoElemento) {
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
