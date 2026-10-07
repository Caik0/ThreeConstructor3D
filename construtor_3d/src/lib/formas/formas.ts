import { BoxGeometry, type BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { UNIDADE_EXIBICAO, formatarCm } from '../medidas/medidas';

export type TipoForma = 'caixa' | 'cilindro';

/** Formas oferecidas pra criar uma peça nova (botão "+") ou trocar a forma de uma já existente.
 * "cilindro" continua em FORMAS — peças já salvas com ele continuam carregando, redimensionando
 * e sendo pintadas normalmente —, só não aparece mais como opção nova: uma caixa com as 4 quinas
 * no raio máximo (metade da largura/profundidade) já faz o mesmo formato */
export const TIPOS_FORMA_NOVOS: TipoForma[] = ['caixa'];

export interface ParametroForma {
  chave: string;
  rotulo: string;
  min: number;
  max: number;
  padrao: number;
  /** false tira o campo do resumo "60 × 72 × 55 cm" (ex.: o raio de cada quina) — continua
   * editável normalmente, só não teria onde caber num resumo curto de medidas */
  naDescricao?: boolean;
}

interface DefinicaoForma {
  nome: string;
  parametros: ParametroForma[];
  /** Geometria centrada na origem */
  criarGeometria: (parametros: Record<string, number>) => BufferGeometry;
  /** Tamanho da caixa envolvente em cada eixo, em mm */
  tamanho: (parametros: Record<string, number>) => { x: number; y: number; z: number };
  /** Medidas escaladas por eixo, usado ao redimensionar o grupo que contém a peça */
  escalar: (
    parametros: Record<string, number>,
    fator: { x: number; y: number; z: number },
  ) => Record<string, number>;
}

// Medidas escaladas ficam com precisão de 0,1 mm
const arredondar = (valor: number) => Math.round(valor * 10) / 10;

// Segmentos por quarto de círculo nas quinas arredondadas: fixo, sem motivo pra deixar o usuário
// escolher (mais que isso não muda o visual, menos fica poligonal demais)
const SEGMENTOS_QUINA = 16;

/** As 4 quinas verticais de uma caixa, vistas de cima — mesmos nomes de direção usados em
 * FACES_TEXTURA.caixa (direita/esquerda/frente/fundo) em ModuloViewport.tsx */
export const QUINAS_CAIXA = ['frenteDireita', 'frenteEsquerda', 'fundoDireita', 'fundoEsquerda'] as const;
export type QuinaCaixa = (typeof QUINAS_CAIXA)[number];

/** Nome do parâmetro (em FORMAS.caixa.parametros) do raio de uma quina específica — usado também
 * no painel de propriedades, pra montar o campo "editar cada quina" (ver PainelElemento) */
export const chaveRaioQuina = (quina: QuinaCaixa) => `raio${quina[0].toUpperCase()}${quina.slice(1)}`;

type RaiosQuinas = Record<QuinaCaixa, number>;

function raiosDosParametros(p: Record<string, number>): RaiosQuinas {
  return Object.fromEntries(QUINAS_CAIXA.map((quina) => [quina, p[chaveRaioQuina(quina)] ?? 0])) as RaiosQuinas;
}

/** Alguma quina tem raio o bastante pra valer a pena arredondar (ver criarGeometriaCaixa) —
 * usado em ModuloViewport.tsx pra saber se a caixa perde as 4 faces retas dos lados */
export function algumaQuinaArredondada(p: Record<string, number>): boolean {
  return Object.values(raiosDosParametros(p)).some((raio) => raio >= 0.1);
}

// Nomes das faces pintáveis de cada tipo de forma, na mesma ordem dos grupos de material que o
// three.js gera (BoxGeometry: +x, -x, +y, -y, +z, -z; CylinderGeometry: lateral, topo, base). Uma
// parede, um piso ou uma peça de modelo 3D importado não são "caixa" de verdade, mas têm a mesma
// caixa envolvente retangular, então usam o mesmo conjunto de 6 faces dela (ver FACES_MODELO
// abaixo e as chamadas de definirTexturas em ModuloViewport.tsx)
export const FACES_TEXTURA: Record<TipoForma, string[]> = {
  caixa: ['direita', 'esquerda', 'topo', 'base', 'frente', 'fundo'],
  cilindro: ['lateral', 'topo', 'base'],
};

/** Faces de uma peça de modelo 3D importado (ou de qualquer elemento tratado como uma caixa
 * retangular comum — parede, piso): sempre as mesmas 6 de FACES_TEXTURA.caixa, já que a
 * identificação é pela caixa envolvente, não pela malha triangulada em si */
export const FACES_MODELO = FACES_TEXTURA.caixa;

/** Faces pintáveis de uma forma: caixa com alguma quina arredondada perde as 4 faces retas dos
 * lados (vira um contorno curvo só, ver algumaQuinaArredondada) e passa a usar as mesmas do
 * cilindro (lateral/topo/base) */
export function facesDaForma(forma: { tipo: TipoForma; parametros: Record<string, number> }): string[] {
  if (forma.tipo === 'caixa' && algumaQuinaArredondada(forma.parametros)) return FACES_TEXTURA.cilindro;
  return FACES_TEXTURA[forma.tipo];
}

// Contorno (visto de cima) de uma caixa com as 4 quinas verticais arredondadas, cada uma com seu
// próprio raio (0 = quina reta), centrado na origem. Cada raio já limitado (ver criarGeometriaCaixa)
// a no máximo metade da largura/profundidade, o que sozinho garante que duas quinas vizinhas nunca
// somam mais que o lado inteiro entre elas — não precisa checar os pares, só cada quina isolada
function contornoQuinasArredondadas(largura: number, profundidade: number, raios: RaiosQuinas): Shape {
  const x = largura / 2;
  const z = profundidade / 2;
  const { frenteDireita: fd, frenteEsquerda: fe, fundoDireita: td, fundoEsquerda: te } = raios;
  const forma = new Shape();
  forma.moveTo(-x + te, -z);
  forma.lineTo(x - td, -z);
  if (td > 0) forma.absarc(x - td, -z + td, td, -Math.PI / 2, 0, false);
  forma.lineTo(x, z - fd);
  if (fd > 0) forma.absarc(x - fd, z - fd, fd, 0, Math.PI / 2, false);
  forma.lineTo(-x + fe, z);
  if (fe > 0) forma.absarc(-x + fe, z - fe, fe, Math.PI / 2, Math.PI, false);
  forma.lineTo(-x, -z + te);
  if (te > 0) forma.absarc(-x + te, -z + te, te, Math.PI, Math.PI * 1.5, false);
  return forma;
}

// Caixa com as 4 quinas verticais arredondadas (cada uma com seu próprio raio) em vez das quinas
// retas de sempre; sem nenhum raio que valha a pena, continua a mesma BoxGeometry de sempre, sem
// custo extra nem risco de regressão nas caixas já existentes (imensa maioria, sem essa medida
// preenchida)
function criarGeometriaCaixa(largura: number, altura: number, profundidade: number, p: Record<string, number>): BufferGeometry {
  if (!algumaQuinaArredondada(p)) return new BoxGeometry(largura, altura, profundidade);

  const limite = Math.min(largura / 2, profundidade / 2);
  const raios = raiosDosParametros(p);
  for (const quina of QUINAS_CAIXA) raios[quina] = Math.min(Math.max(raios[quina], 0), limite);

  const geometria = new ExtrudeGeometry(contornoQuinasArredondadas(largura, profundidade, raios), {
    depth: altura,
    bevelEnabled: false,
    curveSegments: SEGMENTOS_QUINA,
  });

  // ExtrudeGeometry sempre junta topo e base num grupo só (a mesma malha de "tampa", só que
  // desenhada duas vezes) — separa em dois pra poder pintar cada um independente, na mesma ordem
  // lateral/topo/base do Cilindro (ver FACES_TEXTURA em ModuloViewport.tsx). A base sai primeiro
  // na tampa, o topo depois — sempre a mesma quantidade de triângulos nos dois
  const [tampas, lateral] = geometria.groups;
  const metade = tampas.count / 2;
  geometria.groups = [
    { start: lateral.start, count: lateral.count, materialIndex: 0 }, // lateral
    { start: tampas.start + metade, count: metade, materialIndex: 1 }, // topo
    { start: tampas.start, count: metade, materialIndex: 2 }, // base
  ];

  // A extrusão sai deitada (largura/profundidade no plano XY, altura ao longo de Z, começando
  // em zero); vira em pé (altura em Y, centrada na origem) igual a toda forma deste app
  geometria.rotateX(-Math.PI / 2);
  geometria.translate(0, -altura / 2, 0);
  return geometria;
}

// Para adicionar uma forma nova, basta incluir a definição aqui (e em Models/Formas.cs na API)
export const FORMAS: Record<TipoForma, DefinicaoForma> = {
  caixa: {
    nome: 'Caixa',
    parametros: [
      { chave: 'largura', rotulo: 'Largura', min: 0.1, max: 5000, padrao: 600 },
      { chave: 'altura', rotulo: 'Altura', min: 0.1, max: 5000, padrao: 720 },
      { chave: 'profundidade', rotulo: 'Profundidade', min: 0.1, max: 5000, padrao: 550 },
      { chave: 'raioFrenteDireita', rotulo: 'Raio frente-direita', min: 0, max: 2500, padrao: 0, naDescricao: false },
      { chave: 'raioFrenteEsquerda', rotulo: 'Raio frente-esquerda', min: 0, max: 2500, padrao: 0, naDescricao: false },
      { chave: 'raioFundoDireita', rotulo: 'Raio fundo-direita', min: 0, max: 2500, padrao: 0, naDescricao: false },
      { chave: 'raioFundoEsquerda', rotulo: 'Raio fundo-esquerda', min: 0, max: 2500, padrao: 0, naDescricao: false },
    ],
    criarGeometria: (p) => criarGeometriaCaixa(p.largura, p.altura, p.profundidade, p),
    tamanho: (p) => ({ x: p.largura, y: p.profundidade, z: p.altura }),
    escalar: (p, f) => {
      // Mesma regra do diâmetro do cilindro: cada raio acompanha o eixo horizontal que mudou
      const fatorRaio = f.x !== 1 ? f.x : f.y;
      const raios = raiosDosParametros(p);
      return {
        largura: arredondar(p.largura * f.x),
        altura: arredondar(p.altura * f.z),
        profundidade: arredondar(p.profundidade * f.y),
        ...Object.fromEntries(QUINAS_CAIXA.map((quina) => [chaveRaioQuina(quina), arredondar(raios[quina] * fatorRaio)])),
      };
    },
  },
  cilindro: {
    nome: 'Cilindro',
    parametros: [
      { chave: 'diametro', rotulo: 'Diâmetro', min: 0.1, max: 5000, padrao: 400 },
      { chave: 'altura', rotulo: 'Altura', min: 0.1, max: 5000, padrao: 900 },
    ],
    criarGeometria: (p) => new CylinderGeometry(p.diametro / 2, p.diametro / 2, p.altura, 48),
    tamanho: (p) => ({ x: p.diametro, y: p.diametro, z: p.altura }),
    // O círculo não pode virar elipse: o diâmetro acompanha o eixo horizontal que mudou
    escalar: (p, f) => ({
      diametro: arredondar(p.diametro * (f.x !== 1 ? f.x : f.y)),
      altura: arredondar(p.altura * f.z),
    }),
  },
};

export function parametrosPadrao(tipo: TipoForma): Record<string, number> {
  return Object.fromEntries(FORMAS[tipo].parametros.map((p) => [p.chave, p.padrao]));
}

/** Completa parâmetros que a forma ganhou depois de já existirem peças salvas (ex.: as quinas da
 * caixa) com o padrão deles, sem mexer nos que já vieram preenchidos — pra uma peça antiga
 * continuar válida e, ao ser salva de novo, já ir com o conjunto completo de parâmetros atual */
export function completarParametros(tipo: TipoForma, parametros: Record<string, number>): Record<string, number> {
  const completo = { ...parametrosPadrao(tipo), ...parametros };
  // Migração de uma versão beta bem curta desta mesma funcionalidade, que ainda tinha um raio só
  // ("raioCantos") pras 4 quinas juntas, antes de virar um por quina — nunca chegou a ficar tempo
  // nenhum em produção, mas por garantia: se sobrar algum, vira o raio das 4 quinas novas
  if (tipo === 'caixa' && 'raioCantos' in parametros) {
    const antigo = parametros.raioCantos;
    delete completo.raioCantos;
    for (const quina of QUINAS_CAIXA) {
      const chave = chaveRaioQuina(quina);
      if (!(chave in parametros)) completo[chave] = antigo;
    }
  }
  return completo;
}

export function parametrosValidos(tipo: TipoForma, parametros: Record<string, number>) {
  return FORMAS[tipo].parametros.every((p) => {
    const valor = parametros[p.chave] ?? p.padrao;
    return Number.isFinite(valor) && valor >= p.min && valor <= p.max;
  });
}

export function descreverForma(tipo: TipoForma, parametros: Record<string, number>) {
  const { nome, parametros: definicoes } = FORMAS[tipo];
  // Parâmetros ficam em mm; o texto mostra cm
  const medidas = definicoes.filter((p) => p.naDescricao !== false).map((p) => formatarCm(parametros[p.chave]) || '–');
  return `${nome} · ${medidas.join(' × ')} ${UNIDADE_EXIBICAO}`;
}
