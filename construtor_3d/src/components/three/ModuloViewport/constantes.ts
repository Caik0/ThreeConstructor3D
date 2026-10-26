// Constantes do viewport 3D: cores, tolerâncias, passos e limiares (distâncias em mm, ângulos em graus).

export const COR_PECA = 0xb8b8b8;
export const COR_PAREDE = 0xcdc4b3;
export const COR_PISO = 0x9c8a72;
export const COR_SELECIONADA = 0xb51b33;
export const COR_SELECIONADA_TEXTURA = 0xff9a9a;
// Tolerância (mm) para não acusar colisão em elementos apenas encostados (grudados pelo encaixe)
export const TOLERANCIA_COLISAO = 1;
// Vão mais distante ainda mostrado numa etiqueta de distância (mm): sem isso, uma parede bem longe
// mas alinhada mostraria um número gigante sem ajudar a posicionar o que está sendo arrastado
export const DISTANCIA_MAXIMA_VIZINHO = 3000;
// Opacidade do que fica fora do grupo aberto, como o esmaecimento do SketchUp
export const OPACIDADE_FORA_DO_CONTEXTO = 0.2;
// Deslocamento máximo do ponteiro (px) para contar como clique e não como arrasto. 4px já bastava
// pra mouse, mas um toque no celular quase sempre se move mais que isso sozinho (área de contato
// do dedo, pulso da mão) — ficava interpretando um toque parado como arraste (girava a câmera ou
// arrastava um vértice sem querer), bem notado nas ferramentas de clique preciso (parede, trena)
export const TOLERANCIA_CLIQUE = 10;
// Passo do movimento pelas setas, em mm
export const PASSO_MOVIMENTO = 10;
// Passo da rotação pelos anéis, em graus
export const PASSO_ROTACAO = 15;
// Sentido do Y dos dados na cena (ver lib/transformacoes/convencao.ts, onde está a explicação da
// convenção dos eixos); os pontos onde os dados viram a cena usam `SENTIDO_Z * y`, ex.:
// container.position.set(x, z, SENTIDO_Z * y)
export { SENTIDO_Z } from '../../../lib/transformacoes/convencao';
// Cores dos eixos na ordem da cena (como no SketchUp): X vermelho, altura (Z dos dados) azul e
// profundidade (Y dos dados) verde. Valem pros eixos desenhados e pras setas de mover/girar
export const CORES_EIXOS = [0xe5484d, 0x3e7bfa, 0x46a758];
// Cor do manipulador de mover/girar enquanto está sendo arrastado (a mesma padrão do three.js)
export const COR_MANIPULADOR_ATIVO = 0xffff00;
// Comprimento mínimo dos eixos da seleção, em mm
export const COMPRIMENTO_MINIMO_EIXOS = 300;
// Destaque da seleção: linha contínua, vermelha forte em objetos (peças) e azul em grupos
export const COR_DESTAQUE_OBJETO = 0xff1a2e;
export const COR_DESTAQUE_GRUPO = 0x1f7bff;
// Piso e caixa tracejada da planta do ambiente (etapa "Planta do ambiente" do assistente)
export const COR_PISO_SALA = 0xd7d2c8;
export const COR_CAIXA_SALA = 0x8e9aa8;
// Pé-direito padrão das paredes desenhadas quando o projeto não tem planta do ambiente
export const PE_DIREITO_PADRAO = 2700;
export const ESPESSURA_PADRAO_PAREDE = 100;
// Distância (mm) para clicar perto do primeiro ponto e fechar o contorno de paredes
export const LIMIAR_FECHAR_CONTORNO = 150;
// Distância (graus) do ângulo reto (múltiplo de 90°) mais próximo pra travar nele ao marcar o
// próximo canto de uma parede, facilitando desenhar linhas retas sem precisão de pixel
export const LIMIAR_TRAVAR_ANGULO = 4;

// Furações (categoria 'furacao') ficam escuras, pra se destacarem da peça em que estão
export const COR_FURO = 0x1c1c1c;

// Distância em pixels de tela pra "imantar" a trena num vértice (ver verticeMaisProximo) —
// generoso o bastante pro dedo no celular, sem grudar sozinho num clique mais afastado
export const LIMIAR_IMA_VERTICE = 24;

export const COR_TRENA = 0xf5a623;
// Raio (mm) do marcador de cada ponto da trena
export const RAIO_MARCADOR_TRENA = 15;

export const EIXOS_GAP = ['x', 'y', 'z'] as const;
// Os outros dois eixos de cada um, pra testar se dois elementos estão "de frente um pro outro"
// nessa direção (sobrepostos nos dois eixos perpendiculares) antes de contar como vizinho
export const PERPENDICULARES_GAP: Record<(typeof EIXOS_GAP)[number], [(typeof EIXOS_GAP)[number], (typeof EIXOS_GAP)[number]]> = {
  x: ['y', 'z'],
  y: ['x', 'z'],
  z: ['x', 'y'],
};
