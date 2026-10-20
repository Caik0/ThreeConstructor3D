// Colisão do arraste (caixas orientadas), medição de vãos até os vizinhos e etiquetas de distância.

import { Box3, BufferGeometry, Group, Matrix4, Mesh, type Object3D, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { formatarCm } from '../../../lib/medidas/medidas';
import { type Parede } from '../../../lib/projetos/projetos';
import { type ElementoEditor, estaDentro } from '../../../store/editorStore';
import { DISTANCIA_MAXIMA_VIZINHO, EIXOS_GAP, PERPENDICULARES_GAP, TOLERANCIA_COLISAO } from './constantes';
import { celulasParede, vaoParaRecorte } from './paredes';
import { type Colisor, type ObjetoElemento, type VaoVizinho } from './tipos';
import { limparEtiquetas } from './utilitarios';

/** Caixa orientada do `local` (caixa no espaço do próprio elemento) levada pro mundo por `matriz`.
 * Montada à mão: OBB.applyMatrix4 do three.js só SOMA a translação ao centro, sem girá-lo (supõe uma
 * caixa centrada na origem do objeto), o que desloca qualquer caixa fora do centro quando há rotação */
function orientadaNoMundo(local: Box3, matriz: Matrix4): OBB {
  const e = matriz.elements;
  const sx = Math.hypot(e[0], e[1], e[2]) || 1;
  const sy = Math.hypot(e[4], e[5], e[6]) || 1;
  const sz = Math.hypot(e[8], e[9], e[10]) || 1;

  const orientada = new OBB();
  orientada.halfSize.copy(local.getSize(new Vector3())).multiplyScalar(0.5);
  orientada.halfSize.x *= sx;
  orientada.halfSize.y *= sy;
  orientada.halfSize.z *= sz;
  orientada.rotation.set(e[0] / sx, e[4] / sy, e[8] / sz, e[1] / sx, e[5] / sy, e[9] / sz, e[2] / sx, e[6] / sy, e[10] / sz);
  orientada.center.copy(local.getCenter(new Vector3())).applyMatrix4(matriz);
  return orientada;
}

/** Menor caixa alinhada aos eixos que contém a orientada (exata quando ela já está alinhada) */
function envolventeDaOrientada(o: OBB): Box3 {
  const e = o.rotation.elements;
  const meia = new Vector3(
    Math.abs(e[0]) * o.halfSize.x + Math.abs(e[3]) * o.halfSize.y + Math.abs(e[6]) * o.halfSize.z,
    Math.abs(e[1]) * o.halfSize.x + Math.abs(e[4]) * o.halfSize.y + Math.abs(e[7]) * o.halfSize.z,
    Math.abs(e[2]) * o.halfSize.x + Math.abs(e[5]) * o.halfSize.y + Math.abs(e[8]) * o.halfSize.z,
  );
  return new Box3(o.center.clone().sub(meia), o.center.clone().add(meia));
}

/** Caixa, no espaço do contêiner `referencia` (sem a posição/rotação dele), que une tudo que tem
 * geometria dentro de `raizes` e dos descendentes delas — as mesmas coisas que Box3.setFromObject
 * contava */
function caixaLocalDe(raizes: Object3D[], referencia: Object3D): Box3 {
  referencia.updateWorldMatrix(true, false);
  const inversa = referencia.matrixWorld.clone().invert();
  const caixa = new Box3();
  const parte = new Box3();
  for (const raiz of raizes) {
    raiz.traverse((objeto) => {
      objeto.updateWorldMatrix(false, false);
      const geometria = (objeto as Mesh).geometry as BufferGeometry | undefined;
      if (!geometria) return;
      if (geometria.boundingBox === null) geometria.computeBoundingBox();
      if (!geometria.boundingBox) return;
      parte.copy(geometria.boundingBox).applyMatrix4(new Matrix4().multiplyMatrices(inversa, objeto.matrixWorld));
      caixa.union(parte);
    });
  }
  return caixa;
}

/** Caixa do elemento inteiro no espaço dele mesmo: tudo que tem geometria dentro do contêiner (as
 * peças de dentro dele e a caixa declarada de um grupo) — é o que se move junto no arraste */
function caixaLocalDoContainer(container: Object3D): Box3 {
  return caixaLocalDe([container], container);
}

/** Caixa só da geometria PRÓPRIA do elemento (a malha, ou o modelo 3D importado), sem os filhos nem
 * a caixa tracejada do grupo; nula se ele ainda não tem geometria */
function caixaLocalDoProprio(objeto: ObjetoElemento): Box3 | null {
  const proprios = [objeto.malha, objeto.modelo].filter((o): o is NonNullable<typeof o> => !!o);
  if (proprios.length === 0) return null;
  const caixa = caixaLocalDe(proprios, objeto.container);
  return caixa.isEmpty() ? null : caixa;
}

/** Encolhe a caixa de cada lado, sem deixar virar do avesso quando é mais fina que a tolerância */
function encolher(caixa: Box3, folga: number): Box3 {
  for (const eixo of ['x', 'y', 'z'] as const) {
    const meio = (caixa.min[eixo] + caixa.max[eixo]) / 2;
    caixa.min[eixo] = Math.min(caixa.min[eixo] + folga, meio);
    caixa.max[eixo] = Math.max(caixa.max[eixo] - folga, meio);
  }
  return caixa;
}

// Formas de colisão de uma parede, uma por célula que sobrou do recorte dos vãos, já em coordenadas
// do mundo. Cada célula é uma caixa ORIENTADA: numa parede girada (até 0,7° fora de 90° dá vão de
// dezenas de mm), a caixa alinhada aos eixos seria bem maior que a parede de verdade
function caixasColisaoParede(objeto: ObjetoElemento, parede: Parede, vaos: ElementoEditor[]): Colisor[] {
  return celulasParede(parede.comprimento, parede.altura, vaos).map((c) => {
    const local = new Box3(new Vector3(c.x0, c.y0, -parede.espessura / 2), new Vector3(c.x1, c.y1, parede.espessura / 2));
    const orientada = orientadaNoMundo(local, objeto.container.matrixWorld);
    return { caixa: envolventeDaOrientada(orientada), orientada };
  });
}

// Uma forma sólida por elemento que participa de colisão com `chaveMovida` (pulando o próprio, os
// filhos dele e quem o contém, e quem tem colisão desativada) — uma parede com vão vira uma caixa
// por célula que sobrou do recorte, não a parede inteira, assim um módulo passa pelo vão de verdade.
//
// GRUPOS NÃO SÃO SÓLIDOS: a caixa de um grupo inclui o espaço vazio dele (o "Paredes 1" é a caixa
// da sala inteira), o que impedia qualquer objeto de fora de entrar nele. Quem colide são as peças,
// paredes e pisos de dentro do grupo, cada um pela geometria própria — então um objeto entra na sala
// e bate nas paredes, e um módulo bate nas peças do outro, não no vazio entre elas.
// Compartilhado entre haColisao (só precisa saber se bateu) e as etiquetas de distância (precisam
// da caixa de cada vizinho, pra achar o vão mais próximo)
function* colisoresColidiveis(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
): Generator<Colisor> {
  for (const [chave, objeto] of objetos) {
    const elemento = elementos[chave];
    if (!elemento?.colisao) continue;
    if (estaDentro(elementos, chave, chaveMovida) || estaDentro(elementos, chaveMovida, chave)) continue;

    if (elemento.tipo === 'grupo') continue;

    if (elemento.parede) {
      yield* caixasColisaoParede(objeto, elemento.parede, objeto.vaos ?? []);
      continue;
    }
    const local = caixaLocalDoProprio(objeto);
    if (!local) continue;
    const orientada = orientadaNoMundo(local, objeto.container.matrixWorld);
    yield { caixa: envolventeDaOrientada(orientada), orientada };
  }
}

// Só as caixas alinhadas aos eixos, pras medições de vão (etiquetas de distância)
function* caixasColidiveis(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
): Generator<Box3> {
  for (const colisor of colisoresColidiveis(objetos, elementos, chaveMovida)) yield colisor.caixa;
}

// Colisão: bloqueia o movimento entre dois elementos só quando os DOIS têm colisão ativada
// (assim, desativar a colisão de um módulo faz ele atravessar tudo, e nada o atravessa também).
// `alvo` já tem a posição/rotação propostas aplicadas; a caixa é encolhida por uma tolerância
// para elementos apenas encostados (grudados pelo encaixe) não acusarem colisão entre si
export function haColisao(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  alvo: Object3D,
): boolean {
  if (!elementos[chaveMovida]?.colisao) return false;

  const movida = orientadaNoMundo(encolher(caixaLocalDoContainer(alvo), TOLERANCIA_COLISAO), alvo.matrixWorld);
  return colideComAmbiente(objetos, elementos, chaveMovida, movida);
}

// Se a caixa orientada `movida` bate no chão ou em algum elemento sólido que não seja da família de
// `chaveDona`. A caixa alinhada só descarta rápido os que estão longe; quem decide é a orientada
function colideComAmbiente(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveDona: string,
  movida: OBB,
): boolean {
  const envolvente = envolventeDaOrientada(movida);
  // O piso também é sólido: nada com colisão ativada atravessa o chão (y=0 no mundo), mesmo
  // dentro de um grupo elevado (a caixa já está no espaço do mundo, não no do pai)
  if (envolvente.min.y < 0) return true;

  for (const colisor of colisoresColidiveis(objetos, elementos, chaveDona)) {
    if (!envolvente.intersectsBox(colisor.caixa)) continue;
    if (movida.intersectsOBB(colisor.orientada)) return true;
  }
  return false;
}

// Colisão de um elemento da seleção múltipla que ainda não foi movido: testa a caixa dele
// deslocada de `deslocamento` (o mesmo movimento do elemento principal, em coordenadas do mundo)
// contra `elementos`, onde toda a seleção já está sem colisão (só o que está fora da seleção conta)
export function haColisaoDeslocada(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  temColisao: boolean,
  chave: string,
  deslocamento: Vector3,
): boolean {
  const objeto = objetos.get(chave);
  if (!temColisao || !objeto) return false;

  const movida = orientadaNoMundo(
    encolher(caixaLocalDoContainer(objeto.container), TOLERANCIA_COLISAO),
    objeto.container.matrixWorld,
  );
  movida.center.add(deslocamento);
  return colideComAmbiente(objetos, elementos, chave, movida);
}

// Pro elemento sendo arrastado (já na posição proposta, com colisão resolvida), acha o vão até o
// vizinho mais próximo em cada uma das 6 direções (±x, ±y, ±z da cena) — só conta como vizinho
// numa direção quem está "de frente" nela (sobreposto nos outros dois eixos), senão qualquer
// elemento fora do caminho afetaria uma direção que ele nem está bloqueando de verdade
function vaosVizinhos(
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  caixaMovida: Box3,
): Partial<Record<string, VaoVizinho>> {
  const melhores: Partial<Record<string, VaoVizinho>> = {};

  for (const caixa of caixasColidiveis(objetos, elementos, chaveMovida)) {
    for (const eixo of EIXOS_GAP) {
      const [b, c] = PERPENDICULARES_GAP[eixo];
      if (caixaMovida.min[b] >= caixa.max[b] || caixaMovida.max[b] <= caixa.min[b]) continue;
      if (caixaMovida.min[c] >= caixa.max[c] || caixaMovida.max[c] <= caixa.min[c]) continue;

      let sentido: 1 | -1 | null = null;
      let distancia = 0;
      if (caixa.min[eixo] >= caixaMovida.max[eixo]) {
        sentido = 1;
        distancia = caixa.min[eixo] - caixaMovida.max[eixo];
      } else if (caixa.max[eixo] <= caixaMovida.min[eixo]) {
        sentido = -1;
        distancia = caixaMovida.min[eixo] - caixa.max[eixo];
      }
      if (sentido === null || distancia > DISTANCIA_MAXIMA_VIZINHO) continue;

      const chaveGap = `${eixo}${sentido}`;
      if ((melhores[chaveGap]?.distancia ?? Infinity) <= distancia) continue;

      // Ponto médio do vão, centralizado na área onde os dois se sobrepõem nos outros 2 eixos
      const posicao = new Vector3();
      posicao[eixo] = sentido === 1 ? caixaMovida.max[eixo] + distancia / 2 : caixaMovida.min[eixo] - distancia / 2;
      posicao[b] = (Math.max(caixaMovida.min[b], caixa.min[b]) + Math.min(caixaMovida.max[b], caixa.max[b])) / 2;
      posicao[c] = (Math.max(caixaMovida.min[c], caixa.min[c]) + Math.min(caixaMovida.max[c], caixa.max[c])) / 2;

      melhores[chaveGap] = { distancia, posicao };
    }
  }

  return melhores;
}

// Redesenha as etiquetas de distância até o vizinho colidível mais próximo em cada direção —
// chamado a cada quadro durante o arraste pela ferramenta Mover, só quando o elemento arrastado
// tem colisão ativada (sem colisão, "distância até vizinho" não faz sentido nenhum)
function atualizarEtiquetasDistancia(
  grupo: Group,
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  alvo: Object3D,
  classeEtiqueta: string,
) {
  limparEtiquetas(grupo);
  if (!elementos[chaveMovida]?.colisao) {
    grupo.visible = false;
    return;
  }

  const caixaMovida = new Box3().setFromObject(alvo);
  const gaps = vaosVizinhos(objetos, elementos, chaveMovida, caixaMovida);

  for (const gap of Object.values(gaps)) {
    if (!gap) continue;
    const html = document.createElement('div');
    html.className = classeEtiqueta;
    html.textContent = `${formatarCm(gap.distancia)} cm`;
    const etiqueta = new CSS2DObject(html);
    etiqueta.position.copy(gap.posicao);
    grupo.add(etiqueta);
  }

  grupo.visible = grupo.children.length > 0;
}

// Um vão (porta/janela) só se move dentro do plano da parede-mãe, então a distância que importa
// pra ele é 2D: até o vão vizinho mais próximo da mesma parede, ou até a borda da própria
// parede (as "faces" dela), em cada uma das 4 direções — a profundidade não entra, já que ele não
// se move nela. Ao contrário do módulo genérico, não depende de `colisao` (todo vão nasce com ela
// desativada, e a opção nem aparece pra ele no painel — ver PainelElemento)
function atualizarEtiquetasDistanciaAbertura(
  grupo: Group,
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  alvo: Object3D,
  classeEtiqueta: string,
) {
  limparEtiquetas(grupo);
  const elemento = elementos[chaveMovida];
  const pai = elemento?.pai ? elementos[elemento.pai] : undefined;
  const objetoParede = elemento?.pai ? objetos.get(elemento.pai) : undefined;
  if (!elemento?.abertura || !pai?.parede || !objetoParede) {
    grupo.visible = false;
    return;
  }

  const { comprimento, altura } = pai.parede;
  const x0 = alvo.position.x;
  const x1 = x0 + elemento.abertura.largura;
  const y0 = alvo.position.y;
  const y1 = y0 + elemento.abertura.altura;

  // Outros vãos da mesma parede (menos o que está sendo arrastado)
  const vizinhos = Object.values(elementos)
    .filter((e) => e.pai === elemento.pai && e.chave !== chaveMovida)
    .map(vaoParaRecorte)
    .filter((v) => v !== null);

  // A borda da própria parede sempre conta como candidato; um vão vizinho só conta se estiver
  // "de frente" nessa direção (sobreposto no eixo perpendicular) e mais perto que a borda
  function distanciaAteVizinho(direcao: 'esquerda' | 'direita' | 'cima' | 'baixo'): number {
    let menor =
      direcao === 'esquerda' ? x0 : direcao === 'direita' ? comprimento - x1 : direcao === 'baixo' ? y0 : altura - y1;

    for (const v of vizinhos) {
      const vx0 = v.deslocamento;
      const vx1 = v.deslocamento + v.largura;
      const vy0 = v.peitoril;
      const vy1 = v.peitoril + v.altura;

      if (direcao === 'esquerda' || direcao === 'direita') {
        if (y0 >= vy1 || y1 <= vy0) continue;
        if (direcao === 'direita' && vx0 >= x1) menor = Math.min(menor, vx0 - x1);
        else if (direcao === 'esquerda' && vx1 <= x0) menor = Math.min(menor, x0 - vx1);
      } else {
        if (x0 >= vx1 || x1 <= vx0) continue;
        if (direcao === 'cima' && vy0 >= y1) menor = Math.min(menor, vy0 - y1);
        else if (direcao === 'baixo' && vy1 <= y0) menor = Math.min(menor, y0 - vy1);
      }
    }
    return Math.max(0, menor);
  }

  const etiquetar = (local: Vector3, distancia: number) => {
    if (distancia <= 0) return;
    const html = document.createElement('div');
    html.className = classeEtiqueta;
    html.textContent = `${formatarCm(distancia)} cm`;
    const etiqueta = new CSS2DObject(html);
    etiqueta.position.copy(objetoParede.container.localToWorld(local.clone()));
    grupo.add(etiqueta);
  };

  const direita = distanciaAteVizinho('direita');
  etiquetar(new Vector3(x1 + direita / 2, (y0 + y1) / 2, 0), direita);
  const esquerda = distanciaAteVizinho('esquerda');
  etiquetar(new Vector3(x0 - esquerda / 2, (y0 + y1) / 2, 0), esquerda);
  const cima = distanciaAteVizinho('cima');
  etiquetar(new Vector3((x0 + x1) / 2, y1 + cima / 2, 0), cima);
  const baixo = distanciaAteVizinho('baixo');
  etiquetar(new Vector3((x0 + x1) / 2, y0 - baixo / 2, 0), baixo);

  grupo.visible = grupo.children.length > 0;
}

// Ponto de entrada único das etiquetas de distância, chamado dos dois lugares do objectChange
// (colisão barrada e sucesso): um vão usa a medição 2D dentro da própria parede; qualquer outro
// elemento usa a medição 3D contra os vizinhos colidíveis da cena
export function atualizarEtiquetasDistanciaDoArraste(
  grupo: Group,
  objetos: Map<string, ObjetoElemento>,
  elementos: Record<string, ElementoEditor>,
  chaveMovida: string,
  alvo: Object3D,
  classeEtiqueta: string,
) {
  if (elementos[chaveMovida]?.abertura) {
    atualizarEtiquetasDistanciaAbertura(grupo, objetos, elementos, chaveMovida, alvo, classeEtiqueta);
  } else {
    atualizarEtiquetasDistancia(grupo, objetos, elementos, chaveMovida, alvo, classeEtiqueta);
  }
}

// Depois de corrigir alvo.position (encaixe ou colisão), realinha o estado interno do
// TransformControls para o arraste continuar suave a partir daqui, em vez de "puxar" o objeto
// de volta na próxima vez que o mouse se mexer. `pointStart`/`pointEnd`/`_positionStart` não são
// API pública da biblioteca (checados na versão instalada: object.position = _offset(pointEnd -
// pointStart) + _positionStart); se uma atualização do three.js remover ou renomear esses campos,
// o pior efeito é o arraste voltar a puxar por um quadro, sem quebrar
export function reancorarArraste(transform: TransformControls, posicao: Vector3) {
  const interno = transform as unknown as { pointStart?: Vector3; pointEnd?: Vector3; _positionStart?: Vector3 };
  interno._positionStart?.copy(posicao);
  if (interno.pointStart && interno.pointEnd) interno.pointStart.copy(interno.pointEnd);
}
