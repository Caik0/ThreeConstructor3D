import type { Configuracoes } from '../configuracoes/configuracoes';
import { apiGet, apiPut } from './client';

/** `configuracoes` nulo = o usuário nunca salvou nada (vale o padrão); o formato é validado no front */
export function obterConfiguracoes() {
  return apiGet<{ configuracoes: unknown | null }>('/configuracoes');
}

export function salvarConfiguracoes(configuracoes: Configuracoes) {
  return apiPut<{ configuracoes: unknown }>('/configuracoes', { configuracoes });
}
