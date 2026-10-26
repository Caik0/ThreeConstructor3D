// CONVENÇÃO DOS EIXOS DOS DADOS — a única fonte do sentido do eixo Y e da versão do formato salvo.
//
// Os dados do app (posições, medidas, rotações) vivem num espaço próprio: X pra direita, Z pra cima
// e Y na profundidade. O ponto de origem de uma peça ou grupo é o canto MAIS ATRÁS à esquerda, embaixo
// (versão 2); o Y positivo cresce da origem pra FRENTE, em direção a quem olha, então uma peça ocupa
// sempre valores positivos de X, Y e Z a partir da origem.
//
// Na versão 1 (projetos e módulos salvos antes da mudança) a origem era o canto da FRENTE e o Y
// crescia pra TRÁS (longe de quem olha, como no SketchUp). Esses dados são convertidos ao serem
// lidos da API — ver lib/projetos/converterConvencao.ts.

/** Versão do formato dos eixos que o editor grava hoje */
export const CONVENCAO_EIXOS_ATUAL = 2;
/** Versão dos projetos e módulos anteriores à mudança de origem */
export const CONVENCAO_EIXOS_LEGADA = 1;

// Como o Y dos dados vira o Z da cena three.js (onde Z positivo aponta pra câmera, ou seja, pra
// frente): na cena, `z = SENTIDO_Z * y`. Com +1 o Y dos dados cresce pra frente e a caixa de uma peça
// (que cresce a partir da origem) ocupa Z de 0 até +profundidade, com a origem no fundo.
export const SENTIDO_Z: 1 | -1 = 1;

// Um deslocamento "para o fundo" da cena, medido no eixo Y dos dados, tem este sinal: com Y pra
// frente (versão 2) é -1; com Y pra trás (versão 1) seria +1. Serve pra contas de ângulo e de
// trigonometria no plano (paredes), que raciocinam em "graus anti-horários vistos de cima".
export const SINAL_DO_FUNDO = -SENTIDO_Z;

// Sinal que converte um ângulo da interface (positivo = anti-horário visto da ponta positiva do
// eixo, como no SketchUp) no ângulo da matriz de rotação usual do espaço dos dados. O espaço dos
// dados é espelhado em relação à cena quando o Y aponta pra frente (o determinante do mapa
// dados→cena é -SENTIDO_Z), o que inverte o sentido das rotações em X e Z.
export const SINAL_DAS_ROTACOES = -SENTIDO_Z;

/** Versão que o editor grava e espera ler; dados de versão menor são convertidos ao ler */
export const CONVENCAO_EIXOS_EM_USO: number = CONVENCAO_EIXOS_ATUAL;
