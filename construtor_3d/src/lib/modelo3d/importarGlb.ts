import { Box3, Mesh, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { enviarModelo3dArquivo } from '../api/modulos';
import { MEDIDA_MINIMA, TAMANHO_NOME_ELEMENTO, type ElementoEntrada, type Posicao } from '../projetos/projetos';
import { caminhoDoNo, METROS_PARA_MM, origemDoCanto } from './modelo3d';

const gltfLoader = new GLTFLoader();

// `caixa` está no espaço do arquivo .glb (Y é altura, Z é profundidade — convenção do próprio
// formato glTF, sempre); o resultado já é Posicao na convenção do app (Z é altura, Y é
// profundidade — ver origemDoCanto/posicaoRelativa abaixo), por isso tamanho.z alimenta o y do
// resultado e tamanho.y alimenta o z
function tamanhoDaCaixa(caixa: Box3): Posicao {
  const tamanho = caixa.getSize(new Vector3());
  return {
    x: Math.max(tamanho.x, MEDIDA_MINIMA),
    y: Math.max(tamanho.z, MEDIDA_MINIMA),
    z: Math.max(tamanho.y, MEDIDA_MINIMA),
  };
}

function nomeSemExtensao(nomeArquivo: string) {
  return nomeArquivo.replace(/\.[^./]+$/, '') || nomeArquivo;
}

// Só o necessário pra montar a árvore (posição/tamanho de cada nó): a geometria de verdade nunca
// é lida aqui, só a caixa dela no espaço do mundo — quem separa a malha em si é extrairMalhaDoCanto,
// em memória, na hora de abrir no editor (ver ModuloViewport/ModuloMiniatura)
interface Malha {
  nome: string;
  /** Caminho da malha dentro do arquivo original (ver Elemento.modelo3dNo) */
  caminho: string;
  caixa: Box3;
}

const nomeDoNo = (no: Object3D, padrao: string) => (no.name.trim() || padrao).slice(0, TAMANHO_NOME_ELEMENTO);

// Deslocamento da origem (canto) de `caixa` em relação à do pai. `origem`/`origemPai` vêm de
// origemDoCanto, ainda no espaço do arquivo (Y altura, Z profundidade invertida — convenção do
// glTF); o resultado já sai na convenção do app (Z altura, Y profundidade — ver tamanhoDaCaixa),
// por isso as expressões de Y/Z do arquivo trocam de lugar no objeto devolvido
function posicaoRelativa(caixa: Box3, origemPai: Vector3): Posicao {
  const origem = origemDoCanto(caixa);
  return { x: origem.x - origemPai.x, y: origemPai.z - origem.z, z: origem.y - origemPai.y };
}

/**
 * Converte um .glb em um módulo preservando a hierarquia de nós do arquivo: um nó com filhos vira
 * um grupo, uma malha vira uma peça. Assim as partes que quem modelou agrupou (ex.: uma dobradiça
 * com haste, base e parafusos) continuam agrupadas, e dá pra mover, redimensionar ou remover
 * pedaços do modelo depois de importado.
 *
 * O arquivo original é enviado ao servidor uma vez só, inteiro, sem separar nada (ver
 * enviarModelo3dArquivo): toda peça encontrada nele aponta pra essa mesma URL (modelo3d), cada uma com o
 * caminho da própria malha dentro do arquivo (modelo3dNo). A separação em si só acontece depois,
 * em memória, ao abrir o módulo no editor — nunca vira arquivo novo no servidor.
 */
export async function converterGlbEmModulo(bytes: ArrayBuffer, nomeArquivo: string): Promise<ElementoEntrada> {
  const gltf = await gltfLoader.parseAsync(bytes, '');
  gltf.scene.scale.setScalar(METROS_PARA_MM);
  gltf.scene.updateMatrixWorld(true);

  const malhas = new Map<Object3D, Malha>();
  gltf.scene.traverse((objeto) => {
    if (!(objeto instanceof Mesh)) return;
    malhas.set(objeto, {
      nome: nomeDoNo(objeto, `Parte ${malhas.size + 1}`),
      caminho: caminhoDoNo(gltf.scene, objeto),
      caixa: new Box3().setFromObject(objeto),
    });
  });

  if (malhas.size === 0) throw new Error('O modelo não tem nenhuma malha visível.');

  const urlBase = (await enviarModelo3dArquivo(bytes, nomeArquivo)).url;

  // Caixa (no espaço do modelo inteiro) de um nó = união das malhas dele e de tudo abaixo
  const caixas = new Map<Object3D, Box3 | null>();
  const caixaDoNo = (no: Object3D): Box3 | null => {
    if (caixas.has(no)) return caixas.get(no) ?? null;
    let caixa: Box3 | null = malhas.get(no)?.caixa.clone() ?? null;
    for (const filho of no.children) {
      const caixaFilho = caixaDoNo(filho);
      if (caixaFilho) caixa = caixa ? caixa.union(caixaFilho) : caixaFilho.clone();
    }
    caixas.set(no, caixa);
    return caixa;
  };

  let contadorGrupos = 0;
  let contadorPecas = 0;

  function pecaDaMalha(malha: Malha, origemPai: Vector3): ElementoEntrada {
    return {
      tipo: 'peca',
      nome: malha.nome,
      posicao: posicaoRelativa(malha.caixa, origemPai),
      colisao: true,
      visivel: true,
      modelo3d: urlBase,
      modelo3dNo: malha.caminho,
      tamanho: tamanhoDaCaixa(malha.caixa),
    };
  }

  // O GLTFLoader renomeia nó duplicado pra manter nome único na cena (ver `createUniqueName` nele):
  // duas malhas que no arquivo original eram as DUAS "Geom3D" (mesmo nome cru) chegam aqui como
  // "Geom3D_15"/"Geom3D_16" — por isso a comparação ignora um sufixo "_<número>" só dele, o próprio
  // GLTFLoader que acrescentou, não o nome de verdade do arquivo
  const SUFIXO_NOME_UNICO_GLTF = /_\d+$/;
  const nomeBase = (no: Object3D) => no.name.trim().replace(SUFIXO_NOME_UNICO_GLTF, '');

  // Duas ou mais malhas-folha (sem filho próprio) debaixo do mesmo nó, todas com o MESMO nome
  // base (geralmente um placeholder genérico do exportador, tipo "Geom3D") não são partes
  // distintas de verdade — partes de verdade têm nomes diferentes entre si (ex.: a haste e a base
  // de uma dobradiça). Nomes iguais e sem sentido próprio só acontecem quando são camadas visuais
  // da MESMA peça (o corpo e a fita de borda de um painel, por exemplo): nesse caso vira uma peça
  // só, com uma malha mesclada por camada (ver pecaMesclada/extrairMalhaDoCanto), em vez de um
  // grupo com uma "peça" solta e sem nome útil pra cada camada
  function camadasDaMesmaPeca(no: Object3D): Object3D[] | null {
    if (no.children.length < 2) return null;
    const folhas = no.children.filter((filho) => malhas.has(filho) && filho.children.length === 0);
    if (folhas.length !== no.children.length) return null;
    const primeiroNomeBase = nomeBase(folhas[0]);
    return folhas.every((folha) => nomeBase(folha) === primeiroNomeBase) ? folhas : null;
  }

  function pecaMesclada(no: Object3D, caixa: Box3, origemPai: Vector3): ElementoEntrada {
    return {
      tipo: 'peca',
      nome: nomeDoNo(no, `Peça ${++contadorPecas}`),
      posicao: posicaoRelativa(caixa, origemPai),
      colisao: true,
      visivel: true,
      modelo3d: urlBase,
      modelo3dNo: caminhoDoNo(gltf.scene, no),
      tamanho: tamanhoDaCaixa(caixa),
    };
  }

  function converterNo(no: Object3D, origemPai: Vector3): ElementoEntrada | null {
    const caixa = caixaDoNo(no);
    if (!caixa) return null;
    const origemMinha = origemDoCanto(caixa);
    const malha = malhas.get(no);

    if (!malha && camadasDaMesmaPeca(no)) return pecaMesclada(no, caixa, origemPai);

    const filhos: ElementoEntrada[] = [];
    // Uma malha que também tem nós filhos vira um grupo com a própria malha como uma das peças
    if (malha && no.children.some((f) => caixaDoNo(f))) filhos.push(pecaDaMalha(malha, origemMinha));
    for (const filho of no.children) {
      const convertido = converterNo(filho, origemMinha);
      if (convertido) filhos.push(convertido);
    }

    if (malha && filhos.length === 0) return pecaDaMalha(malha, origemPai);

    // Nó só de passagem (um único filho): não vira um grupo à toa, o filho assume o lugar dele
    if (filhos.length === 1 && !malha) {
      return { ...filhos[0], posicao: posicaoRelativa(caixa, origemPai) };
    }

    return {
      tipo: 'grupo',
      nome: nomeDoNo(no, `Grupo ${++contadorGrupos}`),
      posicao: posicaoRelativa(caixa, origemPai),
      colisao: true,
      visivel: true,
      tamanho: tamanhoDaCaixa(caixa),
      filhos,
    };
  }

  const caixaGeral = caixaDoNo(gltf.scene) as Box3;
  const origemGeral = origemDoCanto(caixaGeral);
  const nome = nomeSemExtensao(nomeArquivo).slice(0, TAMANHO_NOME_ELEMENTO);

  const topo: ElementoEntrada[] = [];
  for (const filho of gltf.scene.children) {
    const convertido = converterNo(filho, origemGeral);
    if (convertido) topo.push(convertido);
  }

  // Um único grupo no topo já é o módulo: ganha o nome do arquivo, sem grupo extra em volta
  if (topo.length === 1 && topo[0].tipo === 'grupo') {
    return { ...topo[0], nome, posicao: { x: 0, y: 0, z: 0 } };
  }

  return {
    tipo: 'grupo',
    nome,
    posicao: { x: 0, y: 0, z: 0 },
    colisao: true,
    visivel: true,
    tamanho: tamanhoDaCaixa(caixaGeral),
    filhos: topo,
  };
}
