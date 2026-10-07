import type {
  ElementoEntrada,
  NovoProjetoDados,
  Projeto,
  ProjetoResumo,
} from '../projetos/projetos';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export function listarProjetos() {
  return apiGet<ProjetoResumo[]>('/projetos');
}

export function obterProjeto(id: number) {
  return apiGet<Projeto>(`/projetos/${id}`);
}

export function criarProjeto(dados: NovoProjetoDados) {
  return apiPost<Projeto>('/projetos', dados);
}

/** Apaga o projeto com todas as peças e grupos */
export function excluirProjeto(id: number) {
  return apiDelete(`/projetos/${id}`);
}

/** Envia a árvore completa (elementos salvos que não vierem são removidos) e as variáveis globais
 * do projeto, num único salvamento */
export function salvarElementos(id: number, elementos: ElementoEntrada[], variaveisGlobais: Record<string, number>) {
  return apiPut<Projeto>(`/projetos/${id}/elementos`, { elementos, variaveisGlobais });
}
