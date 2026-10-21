import type { ElementoEntrada, ElementoModulo, ResumoDaConversao, TipoElemento } from '../projetos/projetos';
import { converterParaConvencaoAtual } from '../projetos/converterConvencao';
import { CONVENCAO_EIXOS_EM_USO } from '../transformacoes/convencao';
import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from './client';

export interface Modulo {
  id: number;
  nome: string;
  tipo: TipoElemento;
  criadoEm: string;
  elemento: ElementoModulo;
  /** Convenção dos eixos em que a API tem o módulo salvo (ausente = 1, a antiga); o `elemento` aqui
   * já vem convertido pra convenção em uso */
  convencaoEixos?: number;
  /** Preenchido quando o módulo foi convertido ao ler (ainda não salvo na convenção nova) */
  conversao?: ResumoDaConversao | null;
}

/** Módulo salvo numa convenção de eixos mais antiga que a em uso: converte a árvore pra atual,
 * mantendo o mesmo desenho (ver converterConvencao.ts) */
function normalizar(modulo: Modulo): Modulo {
  if ((modulo.convencaoEixos ?? 1) >= CONVENCAO_EIXOS_EM_USO) return modulo;
  const { elementos, formulasConvertidas } = converterParaConvencaoAtual([modulo.elemento]);
  return { ...modulo, elemento: elementos[0], convencaoEixos: CONVENCAO_EIXOS_EM_USO, conversao: { formulasConvertidas } };
}

export function listarModulos() {
  return apiGet<Modulo[]>('/modulos').then((modulos) => modulos.map(normalizar));
}

export function obterModulo(id: number) {
  return apiGet<Modulo>(`/modulos/${id}`).then(normalizar);
}

// Um módulo nunca referencia elementos de um projeto: mesmo que a subárvore salva já tenha ids
// (o elemento veio de um projeto salvo), a API de módulos sempre trata como criação
function semIds(entrada: ElementoEntrada): ElementoEntrada {
  return { ...entrada, id: undefined, filhos: entrada.filhos?.map(semIds) };
}

export function salvarModulo(nome: string, elemento: ElementoEntrada) {
  return apiPost<Modulo>('/modulos', {
    nome,
    elemento: semIds(elemento),
    convencaoEixos: CONVENCAO_EIXOS_EM_USO,
  }).then(normalizar);
}

export function renomearModulo(id: number, nome: string) {
  return apiPut<Modulo>(`/modulos/${id}`, { nome }).then(normalizar);
}

/** Substitui a árvore inteira de um módulo já salvo (editar e salvar de novo) */
export function salvarConteudoModulo(id: number, elemento: ElementoEntrada) {
  return apiPut<Modulo>(`/modulos/${id}/elemento`, {
    elemento: semIds(elemento),
    convencaoEixos: CONVENCAO_EIXOS_EM_USO,
  }).then(normalizar);
}

export function excluirModulo(id: number) {
  return apiDelete(`/modulos/${id}`);
}

/** Um .glb solto na pasta de importação do servidor, esperando virar módulo sozinho */
export interface ModuloPendente {
  nome: string;
  /** URL pra buscar os bytes do arquivo (fetch comum, não passa pela API JSON) */
  url: string;
}

export function listarPendentes() {
  return apiGet<ModuloPendente[]>('/modulos/pendentes');
}

/** Tira `nome` da fila de importação — com ou sem sucesso, ele não é oferecido de novo depois */
export function concluirPendente(nome: string, sucesso: boolean) {
  return apiPost<void>('/modulos/pendentes/concluir', { nome, sucesso });
}

/** Envia o .glb original inteiro (base64, sem separar nada) uma vez só por importação; toda peça
 * encontrada nele deve apontar pra essa mesma URL depois, cada uma com seu próprio modelo3dNo.
 * Só usada hoje por arquivo pequeno — a importação normal usa enviarModelo3dArquivo, abaixo */
export function enviarModelo3d(base64: string) {
  return apiPost<{ url: string }>('/modulos/modelo3d', { base64 });
}

/** Mesma coisa que enviarModelo3d acima, mas manda o .glb direto (multipart), sem converter pra
 * base64 antes: base64 infla o arquivo em ~33% e cria mais uma cópia dele em memória só pra
 * transporte — evitado aqui, já que essa é a rota usada pela importação normal (ver
 * lib/modelo3d/importarGlb.ts), inclusive pra arquivo grande (até 1 GB, ver
 * Formas.Modelo3dTamanhoMaximo no backend) */
export function enviarModelo3dArquivo(bytes: ArrayBuffer, nomeArquivo: string) {
  const form = new FormData();
  form.append('arquivo', new Blob([bytes]), nomeArquivo);
  return apiPostForm<{ url: string }>('/modulos/modelo3d/upload', form);
}
