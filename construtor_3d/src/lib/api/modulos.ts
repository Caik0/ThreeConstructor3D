import type { ElementoEntrada, ElementoModulo, TipoElemento } from '../projetos/projetos';
import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from './client';

export interface Modulo {
  id: number;
  nome: string;
  tipo: TipoElemento;
  criadoEm: string;
  elemento: ElementoModulo;
}

export function listarModulos() {
  return apiGet<Modulo[]>('/modulos');
}

export function obterModulo(id: number) {
  return apiGet<Modulo>(`/modulos/${id}`);
}

// Um módulo nunca referencia elementos de um projeto: mesmo que a subárvore salva já tenha ids
// (o elemento veio de um projeto salvo), a API de módulos sempre trata como criação
function semIds(entrada: ElementoEntrada): ElementoEntrada {
  return { ...entrada, id: undefined, filhos: entrada.filhos?.map(semIds) };
}

export function salvarModulo(nome: string, elemento: ElementoEntrada) {
  return apiPost<Modulo>('/modulos', { nome, elemento: semIds(elemento) });
}

export function renomearModulo(id: number, nome: string) {
  return apiPut<Modulo>(`/modulos/${id}`, { nome });
}

/** Substitui a árvore inteira de um módulo já salvo (editar e salvar de novo) */
export function salvarConteudoModulo(id: number, elemento: ElementoEntrada) {
  return apiPut<Modulo>(`/modulos/${id}/elemento`, { elemento: semIds(elemento) });
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
