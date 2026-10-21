import type {
  ElementoEntrada,
  NovoProjetoDados,
  Projeto,
  ProjetoResumo,
} from '../projetos/projetos';
import { converterParaConvencaoAtual } from '../projetos/converterConvencao';
import { CONVENCAO_EIXOS_EM_USO } from '../transformacoes/convencao';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

/** Projeto salvo numa convenção de eixos mais antiga que a em uso: converte os elementos pra atual,
 * mantendo o mesmo desenho (a planta é o ambiente inteiro, que anda junto — ver converterConvencao.ts) */
function normalizar(projeto: Projeto): Projeto {
  if ((projeto.convencaoEixos ?? 1) >= CONVENCAO_EIXOS_EM_USO) return projeto;
  const { elementos, formulasConvertidas } = converterParaConvencaoAtual(projeto.elementos, projeto.planta?.y ?? 0);
  return { ...projeto, elementos, convencaoEixos: CONVENCAO_EIXOS_EM_USO, conversao: { formulasConvertidas } };
}

export function listarProjetos() {
  return apiGet<ProjetoResumo[]>('/projetos');
}

export function obterProjeto(id: number) {
  return apiGet<Projeto>(`/projetos/${id}`).then(normalizar);
}

export function criarProjeto(dados: NovoProjetoDados) {
  return apiPost<Projeto>('/projetos', dados).then(normalizar);
}

/** Apaga o projeto com todas as peças e grupos */
export function excluirProjeto(id: number) {
  return apiDelete(`/projetos/${id}`);
}

/** Envia a árvore completa (elementos salvos que não vierem são removidos) e as variáveis globais
 * do projeto, num único salvamento */
export function salvarElementos(id: number, elementos: ElementoEntrada[], variaveisGlobais: Record<string, number>) {
  return apiPut<Projeto>(`/projetos/${id}/elementos`, {
    elementos,
    variaveisGlobais,
    convencaoEixos: CONVENCAO_EIXOS_EM_USO,
  }).then(normalizar);
}
