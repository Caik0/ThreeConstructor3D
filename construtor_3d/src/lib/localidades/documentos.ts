import { PAIS_BRASIL } from './localidades';

// DOCUMENTO FISCAL DA EMPRESA, conforme o país. No Brasil é o CPF/CNPJ (campo `cpfCnpj`, com os
// dígitos verificadores conferidos); nos outros países é o documento do país (campo `documentoFiscal`).
// Só alguns países têm regra própria; os demais aceitam o documento sem formato definido.

export interface RegraDocumento {
  /** Qual campo da empresa recebe o valor */
  campo: 'cpfCnpj' | 'documentoFiscal';
  rotulo: string;
  placeholder?: string;
  tamanho: number;
  /** Aplica a máscara enquanto digita */
  formatar: (texto: string) => string;
  /** Texto de erro; null se válido (vazio é válido: o documento não é obrigatório) */
  validar: (texto: string) => string | null;
}

const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** Aplica uma máscara onde cada "0" é um dígito: ("12345678901", "000.000.000-00") */
function mascarar(digitos: string, mascara: string): string {
  let resultado = '';
  let i = 0;
  for (const caractere of mascara) {
    if (i >= digitos.length) break;
    if (caractere === '0') resultado += digitos[i++];
    else resultado += caractere;
  }
  return resultado;
}

function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(digitos[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const primeiro = digitoVerificador(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(d[9]) && segundo === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const primeiro = digitoVerificador(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(d[12]) && segundo === Number(d[13]);
}

function formatarCpfCnpj(texto: string): string {
  const d = soDigitos(texto).slice(0, 14);
  return d.length <= 11 ? mascarar(d, '000.000.000-00') : mascarar(d, '00.000.000/0000-00');
}

/** NIF português: 9 dígitos, o último é verificador (módulo 11) */
function nifPortuguesValido(d: string): boolean {
  if (d.length !== 9) return false;
  const soma = [...d.slice(0, 8)].reduce((total, digito, i) => total + Number(digito) * (9 - i), 0);
  const verificador = 11 - (soma % 11);
  return Number(d[8]) === (verificador >= 10 ? 0 : verificador);
}

/** Limite do documento fiscal em qualquer país. O mais longo que cobrimos é o CNPJ formatado (18);
 * os demais (GSTIN indiano 15, IVA europeu até 14, NIT, CUIT formatado 13) cabem com folga */
export const DOCUMENTO_FISCAL_TAMANHO_MAXIMO = 20;

const livre = (rotulo: string, tamanho = DOCUMENTO_FISCAL_TAMANHO_MAXIMO): RegraDocumento => ({
  campo: 'documentoFiscal',
  rotulo,
  tamanho,
  formatar: (texto) => texto.toUpperCase().replace(/[^A-Z0-9 .\-/]/g, '').slice(0, tamanho),
  validar: () => null,
});

const PORTUGAL: RegraDocumento = {
  campo: 'documentoFiscal',
  rotulo: 'NIF',
  placeholder: '000000000',
  tamanho: 9,
  formatar: (texto) => soDigitos(texto).slice(0, 9),
  validar: (texto) => (nifPortuguesValido(texto) ? null : 'NIF inválido'),
};

const BRASIL: RegraDocumento = {
  campo: 'cpfCnpj',
  rotulo: 'CPF / CNPJ',
  placeholder: '000.000.000-00 ou 00.000.000/0000-00',
  tamanho: 18,
  formatar: formatarCpfCnpj,
  validar: (texto) => {
    const d = soDigitos(texto);
    if (d.length === 11) return cpfValido(d) ? null : 'CPF inválido';
    if (d.length === 14) return cnpjValido(d) ? null : 'CNPJ inválido';
    return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)';
  },
};

const POR_PAIS: Record<string, RegraDocumento> = {
  [PAIS_BRASIL]: BRASIL,
  PT: PORTUGAL,
  US: {
    campo: 'documentoFiscal',
    rotulo: 'EIN (Employer Identification Number)',
    placeholder: '00-0000000',
    tamanho: 10,
    formatar: (texto) => mascarar(soDigitos(texto).slice(0, 9), '00-0000000'),
    validar: (texto) => (soDigitos(texto).length === 9 ? null : 'O EIN tem 9 dígitos'),
  },
  AR: {
    campo: 'documentoFiscal',
    rotulo: 'CUIT',
    placeholder: '00-00000000-0',
    tamanho: 13,
    formatar: (texto) => mascarar(soDigitos(texto).slice(0, 11), '00-00000000-0'),
    validar: (texto) => (soDigitos(texto).length === 11 ? null : 'O CUIT tem 11 dígitos'),
  },
  ES: livre('NIF / CIF', 9),
  CL: livre('RUT', 12),
  UY: livre('RUT', 12),
  MX: livre('RFC', 13),
  CO: livre('NIT', 15),
  PE: livre('RUC', 11),
  GB: livre('Company number / VAT', 12),
};

/** Regra do documento fiscal do país (código ISO); país desconhecido ou ainda não escolhido usa texto livre */
export function regraDocumento(pais: string | null): RegraDocumento {
  return (pais && POR_PAIS[pais]) || livre('Documento fiscal (Tax ID)');
}

// CEP no Brasil (00000-000); nos outros países é um "código postal" sem formato fixo
export function regraCep(pais: string | null): { rotulo: string; tamanho: number; formatar: (texto: string) => string } {
  if (pais === PAIS_BRASIL) return { rotulo: 'CEP', tamanho: 9, formatar: (t) => mascarar(soDigitos(t).slice(0, 8), '00000-000') };
  return { rotulo: 'Código postal', tamanho: 12, formatar: (t) => t.toUpperCase().slice(0, 12) };
}

// TELEFONE E CELULAR, conforme o país. No Brasil: (00) 0000-0000 e (00) 00000-0000. Nos EUA e em
// Portugal, a máscara do país. Nos demais, só se filtram os caracteres que um telefone usa (dígitos,
// +, parênteses, espaço, hífen e ponto), para aceitar o número com o código internacional.
export type TipoTelefone = 'telefone' | 'celular';

export function regraTelefone(pais: string | null, tipo: TipoTelefone): { tamanho: number; placeholder: string; formatar: (texto: string) => string } {
  if (pais === PAIS_BRASIL) {
    const celular = tipo === 'celular';
    const mascara = celular ? '(00) 00000-0000' : '(00) 0000-0000';
    return { tamanho: mascara.length, placeholder: mascara, formatar: (t) => mascarar(soDigitos(t).slice(0, celular ? 11 : 10), mascara) };
  }
  if (pais === 'US') {
    return { tamanho: 14, placeholder: '(000) 000-0000', formatar: (t) => mascarar(soDigitos(t).slice(0, 10), '(000) 000-0000') };
  }
  if (pais === 'PT') {
    return { tamanho: 11, placeholder: '000 000 000', formatar: (t) => mascarar(soDigitos(t).slice(0, 9), '000 000 000') };
  }
  return { tamanho: 20, placeholder: '+00 000 000 0000', formatar: (t) => t.replace(/[^0-9+()\-. ]/g, '').slice(0, 20) };
}
