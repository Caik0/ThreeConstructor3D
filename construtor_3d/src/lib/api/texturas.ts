import type { CategoriaTextura } from '../textura/categorias';
import { apiGet, apiPost, apiPut } from './client';

// Catálogo de imagens de textura já usadas pelo usuário em alguma face (peça, parede ou piso) —
// entra sozinho aqui assim que uma textura nova é usada (ver ArquivosElemento.ResolverTexturas na
// API), sem uma ação separada de "salvar". Cor sólida não entra: fica só no campo do elemento
export interface Textura {
  id: number;
  url: string;
  /** Tipo da textura (madeira, espelho, metálica...); novas entram como "geral" */
  categoria: CategoriaTextura;
  criadoEm: string;
}

export function listarTexturas() {
  return apiGet<Textura[]>('/texturas');
}

/** Muda o tipo de uma textura do catálogo */
export function alterarCategoriaTextura(id: number, categoria: CategoriaTextura) {
  return apiPut<Textura>(`/texturas/${id}/categoria`, { categoria });
}

/** Importa uma imagem (data URL JPEG) direto pro catálogo, sem estar ligada a nenhuma face —
 * usado pra processar uma imagem baixada da pasta de importação do servidor (ver pendentes) */
export function importarTextura(base64: string) {
  return apiPost<Textura>('/texturas', { base64 });
}

/** Uma imagem solta na pasta de importação do servidor, esperando virar textura do catálogo sozinha */
export interface TexturaPendente {
  nome: string;
  /** URL pra buscar os bytes do arquivo (fetch comum, não passa pela API JSON) */
  url: string;
}

export function listarTexturasPendentes() {
  return apiGet<TexturaPendente[]>('/texturas/pendentes');
}

/** Tira `nome` da fila de importação — com ou sem sucesso, ela não é oferecida de novo depois */
export function concluirTexturaPendente(nome: string, sucesso: boolean) {
  return apiPost<void>('/texturas/pendentes/concluir', { nome, sucesso });
}
