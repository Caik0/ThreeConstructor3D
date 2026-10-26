// Geometria dos pontos do construtor de paredes: vértices e segmentos próximos, travamento em ângulo reto e arraste de vértices.

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { MEDIDA_MINIMA, type Posicao } from '../../../lib/projetos/projetos';
import { anguloGraus, distanciaXY, type ElementoEditor, limitesLocais } from '../../../store/editorStore';
import { SINAL_DO_FUNDO } from '../../../lib/transformacoes/convencao';
import { LIMIAR_FECHAR_CONTORNO, LIMIAR_IMA_VERTICE, LIMIAR_TRAVAR_ANGULO, SENTIDO_Z } from './constantes';
import { type ObjetoElemento } from './tipos';
import { visivelNaCena } from './utilitarios';

// Os 8 cantos da caixa de cada elemento visível (peça, grupo ou parede), em coordenadas de
// mundo — já considerando rotação, por isso transforma cada canto individualmente em vez de usar
// Box3().setFromObject (que daria a caixa ALINHADA aos eixos da cena, maior que a peça de verdade
// se ela estiver girada, com cantos que não existem de verdade)
export function verticesVisiveis(elementos: Record<string, ElementoEditor>, objetos: Map<string, ObjetoElemento>): Vector3[] {
  const pontos: Vector3[] = [];
  for (const [chave, elemento] of Object.entries(elementos)) {
    const objeto = objetos.get(chave);
    if (!objeto || !visivelNaCena(objeto.container)) continue;
    const caixa = limitesLocais(elemento);
    if (!caixa) continue;
    for (const x of [caixa.min.x, caixa.max.x]) {
      for (const y of [caixa.min.y, caixa.max.y]) {
        for (const z of [caixa.min.z, caixa.max.z]) {
          // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo,
          // espelhado (mesma fronteira de posicaoCena, mais abaixo)
          pontos.push(new Vector3(x, z, SENTIDO_Z * y).applyMatrix4(objeto.container.matrixWorld));
        }
      }
    }
  }
  return pontos;
}

// Vértice (dentre `pontos`) mais perto do ponteiro NA TELA, dentro de LIMIAR_IMA_VERTICE — em
// pixels, não em distância 3D, porque é assim que o olho julga "perto": um canto bem atrás de
// outra peça, mas alinhado com o clique na tela, ainda deve imantar
export function verticeMaisProximo(
  pontos: Vector3[],
  e: { clientX: number; clientY: number },
  camera: PerspectiveCamera,
  dom: HTMLElement,
): Vector3 | null {
  const area = dom.getBoundingClientRect();
  const alvoX = e.clientX - area.left;
  const alvoY = e.clientY - area.top;
  const projetado = new Vector3();
  let melhor: Vector3 | null = null;
  let menorDistancia = LIMIAR_IMA_VERTICE;
  for (const ponto of pontos) {
    projetado.copy(ponto).project(camera);
    if (projetado.z < -1 || projetado.z > 1) continue; // atrás da câmera
    const px = ((projetado.x + 1) / 2) * area.width;
    const py = ((1 - projetado.y) / 2) * area.height;
    const distancia = Math.hypot(px - alvoX, py - alvoY);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = ponto;
    }
  }
  return melhor;
}

// Índice do vértice mais próximo de `ponto`, dentro de LIMIAR_FECHAR_CONTORNO; null se nenhum
export function indiceVerticeProximo(pontos: Posicao[], ponto: Posicao): number | null {
  let melhor: number | null = null;
  let menorDistancia = LIMIAR_FECHAR_CONTORNO;
  pontos.forEach((p, indice) => {
    const d = distanciaXY(p, ponto);
    if (d <= menorDistancia) {
      menorDistancia = d;
      melhor = indice;
    }
  });
  return melhor;
}

// Índice do segmento (entre pontos[i] e pontos[i+1]) mais próximo de `ponto`: perto o bastante da
// linha (perpendicular) e projetado dentro do próprio segmento, não perto demais das pontas (que
// já são tratadas por `indiceVerticeProximo`). Usado pra inserir um vértice no meio de uma parede
export function indiceSegmentoProximo(pontos: Posicao[], ponto: Posicao): number | null {
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const comprimento = distanciaXY(a, b);
    if (comprimento < MEDIDA_MINIMA) continue;

    const dx = (b.x - a.x) / comprimento;
    const dy = (b.y - a.y) / comprimento;
    const projecao = (ponto.x - a.x) * dx + (ponto.y - a.y) * dy;
    if (projecao < LIMIAR_FECHAR_CONTORNO || projecao > comprimento - LIMIAR_FECHAR_CONTORNO) continue;

    const perpendicular = Math.abs((ponto.x - a.x) * dy - (ponto.y - a.y) * dx);
    if (perpendicular <= LIMIAR_FECHAR_CONTORNO) return i;
  }
  return null;
}

// Ponto travado no ângulo reto (múltiplo de 90°) mais próximo da direção âncora→ponto, quando
// estiver a poucos graus dele — mantém a mesma distância, só ajusta a direção. Null se não há
// ângulo reto perto o bastante (ou a distância é curta demais pro ângulo fazer sentido)
function calcularTravamento(ancora: Posicao, ponto: Posicao): { ponto: Posicao; diferenca: number } | null {
  const distancia = distanciaXY(ancora, ponto);
  if (distancia < MEDIDA_MINIMA) return null;

  const angulo = anguloGraus(ancora, ponto);
  const anguloTravado = Math.round(angulo / 90) * 90;
  const diferenca = Math.abs(angulo - anguloTravado);
  if (diferenca > LIMIAR_TRAVAR_ANGULO) return null;

  const rad = MathUtils.degToRad(anguloTravado);
  return {
    // `anguloGraus` mede "pra trás" como positivo; no Y dos dados isso entra com SINAL_DO_FUNDO
    ponto: { x: ancora.x + Math.cos(rad) * distancia, y: ancora.y + SINAL_DO_FUNDO * Math.sin(rad) * distancia, z: 0 },
    diferenca,
  };
}

// Trava a direção âncora→ponto no ângulo reto mais próximo, ou devolve o ponto como veio. Usado
// pra marcar o próximo canto (só tem uma âncora: o último ponto confirmado). Facilita desenhar
// paredes alinhadas com os eixos sem precisão de pixel, como a inferência de eixos do SketchUp
export function travarNaLinhaReta(ancora: Posicao, ponto: Posicao): Posicao {
  return calcularTravamento(ancora, ponto)?.ponto ?? ponto;
}

// O mesmo travamento, mas pra arrastar um vértice já existente: ele tem até dois vizinhos (o
// anterior e o seguinte na sequência, ou nenhum nas pontas de um traçado aberto), e trava contra
// o que tiver o ângulo mais próximo de um reto, pra continuar reto dos dois lados quando possível
export function travarVerticeArrastado(pontos: Posicao[], indice: number, ponto: Posicao, fechado: boolean): Posicao {
  const anterior = indice > 0 ? pontos[indice - 1] : fechado ? pontos.at(-1) : undefined;
  const seguinte = indice < pontos.length - 1 ? pontos[indice + 1] : fechado ? pontos[0] : undefined;

  const candidatoAnterior = anterior ? calcularTravamento(anterior, ponto) : null;
  const candidatoSeguinte = seguinte ? calcularTravamento(seguinte, ponto) : null;

  if (candidatoAnterior && candidatoSeguinte) {
    return candidatoAnterior.diferenca <= candidatoSeguinte.diferenca
      ? candidatoAnterior.ponto
      : candidatoSeguinte.ponto;
  }
  return (candidatoAnterior ?? candidatoSeguinte)?.ponto ?? ponto;
}

// Ao soltar um vértice arrastado perto de um vizinho imediato, funde os dois (remove o arrastado)
// em vez de só mover — como fechar o contorno, mas pra qualquer par de cantos vizinhos
export function moverOuFundirVertice(pontos: Posicao[], indice: number, novoPonto: Posicao, fechado: boolean): Posicao[] {
  if (pontos.length > 2) {
    const antes = indice > 0 ? indice - 1 : fechado ? pontos.length - 1 : null;
    const depois = indice < pontos.length - 1 ? indice + 1 : fechado ? 0 : null;
    const pertoDeAntes = antes !== null && distanciaXY(novoPonto, pontos[antes]) <= LIMIAR_FECHAR_CONTORNO;
    const pertoDeDepois = depois !== null && distanciaXY(novoPonto, pontos[depois]) <= LIMIAR_FECHAR_CONTORNO;
    if (pertoDeAntes || pertoDeDepois) return pontos.filter((_, i) => i !== indice);
  }
  return pontos.map((p, i) => (i === indice ? novoPonto : p));
}
