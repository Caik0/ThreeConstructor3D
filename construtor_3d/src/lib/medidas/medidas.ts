// Os dados (estado, API e banco) ficam em mm; a interface mostra e recebe cm

export const UNIDADE_EXIBICAO = 'cm';

export const mmParaCm = (mm: number) => mm / 10;

// Precisão de 0,1 mm, a mesma usada no restante do editor
export const cmParaMm = (cm: number) => Math.round(cm * 100) / 10;

/** Valor em mm formatado em cm, com vírgula decimal e sem separador de milhar ("60,5") */
export function formatarCm(mm: number) {
  if (!Number.isFinite(mm)) return '';
  return (mmParaCm(mm) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });
}

/** Ângulo com até duas casas e vírgula decimal ("22,5") */
export function formatarGraus(graus: number) {
  if (!Number.isFinite(graus)) return '';
  return (Math.round(graus * 100) / 100 || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

/** Como um campo mostra e interpreta valores (o estado guarda mm ou graus) */
export interface UnidadeCampo {
  /** Mostrado dentro do campo */
  simbolo: string;
  /** Lido por leitores de tela no rótulo */
  nome: string;
  formatar: (valor: number) => string;
  /** Resultado da conta digitada → valor guardado */
  converter: (digitado: number) => number;
}

export const UNIDADE_CM: UnidadeCampo = { simbolo: 'cm', nome: 'cm', formatar: formatarCm, converter: cmParaMm };

export const UNIDADE_GRAUS: UnidadeCampo = {
  simbolo: '°',
  nome: 'graus',
  formatar: formatarGraus,
  converter: (graus) => Math.round(graus * 100) / 100,
};

const NUMERO = /^(\d+(\.\d*)?|\.\d+)/;
const MULTIPLICACAO = new Set(['*', 'x', '×']);
const DIVISAO = new Set(['/', '÷']);

/**
 * Resultado de uma conta digitada num campo, como "60+1,8", "(120-3,6)/2" ou "3x18";
 * null se o texto não for uma conta válida. Aceita vírgula ou ponto decimal, + - * x × / ÷ e
 * parênteses. Não usa eval: é um analisador pequeno que só entende esses símbolos
 */
export function avaliarExpressao(texto: string): number | null {
  const fonte = texto.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
  if (fonte === '') return null;
  let i = 0;

  // fator := ('+' | '-') fator | número | '(' soma ')'
  const fator = (): number | null => {
    const simbolo = fonte[i];
    if (simbolo === '+' || simbolo === '-') {
      i++;
      const valor = fator();
      return valor === null ? null : simbolo === '-' ? -valor : valor;
    }
    if (simbolo === '(') {
      i++;
      const valor = soma();
      if (valor === null || fonte[i] !== ')') return null;
      i++;
      return valor;
    }
    const numero = NUMERO.exec(fonte.slice(i));
    if (!numero) return null;
    i += numero[0].length;
    return Number(numero[0]);
  };

  // produto := fator (('*' | 'x' | '×' | '/' | '÷') fator)*
  const produto = (): number | null => {
    let valor = fator();
    while (valor !== null && (MULTIPLICACAO.has(fonte[i]) || DIVISAO.has(fonte[i]))) {
      const operador = fonte[i++];
      const outro = fator();
      if (outro === null) return null;
      valor = DIVISAO.has(operador) ? valor / outro : valor * outro;
    }
    return valor;
  };

  // soma := produto (('+' | '-') produto)*
  const soma = (): number | null => {
    let valor = produto();
    while (valor !== null && (fonte[i] === '+' || fonte[i] === '-')) {
      const operador = fonte[i++];
      const outro = produto();
      if (outro === null) return null;
      valor = operador === '+' ? valor + outro : valor - outro;
    }
    return valor;
  };

  const resultado = soma();
  // Sobrou texto sem sentido (ex.: "60+1)") ou houve divisão por zero
  return resultado !== null && i === fonte.length && Number.isFinite(resultado) ? resultado : null;
}
