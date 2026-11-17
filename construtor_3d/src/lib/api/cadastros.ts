import { apiDelete, apiGet, apiPost, apiPut } from './client';

/** Os cadastros simples da empresa que existem hoje. Os de componente virão como recursos à parte
 * (listas próprias, distintas das de módulo) e reaproveitarão tudo daqui */
export type RecursoCadastro = 'grupos-modulo' | 'classificacoes-modulo';

/** Um grupo ou uma classificação. `usos` = quantos registros (hoje, módulos) o usam */
export interface ItemCadastro {
  id: number;
  nome: string;
  /** O padrão (um por empresa) pode ser renomeado, mas não excluído */
  padrao: boolean;
  usos: number;
}

export function listarCadastro(recurso: RecursoCadastro) {
  return apiGet<ItemCadastro[]>(`/${recurso}`);
}

export function criarCadastro(recurso: RecursoCadastro, nome: string) {
  return apiPost<ItemCadastro>(`/${recurso}`, { nome });
}

export function renomearCadastro(recurso: RecursoCadastro, id: number, nome: string) {
  return apiPut<ItemCadastro>(`/${recurso}/${id}`, { nome });
}

export function excluirCadastro(recurso: RecursoCadastro, id: number) {
  return apiDelete(`/${recurso}/${id}`);
}
