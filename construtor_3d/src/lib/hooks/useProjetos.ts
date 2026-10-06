import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { criarProjeto, excluirProjeto, listarProjetos, obterProjeto, salvarElementos } from '../api/projetos';
import type { ElementoEntrada } from '../projetos/projetos';

const PROJETOS_KEY = ['projetos'];

export function useProjetos() {
  return useQuery({
    queryKey: PROJETOS_KEY,
    queryFn: listarProjetos,
  });
}

export function useProjeto(id: number) {
  return useQuery({
    queryKey: [...PROJETOS_KEY, id],
    queryFn: () => obterProjeto(id),
    enabled: Number.isInteger(id),
    // Não insiste quando o projeto não existe
    retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status === 404) && tentativas < 2,
  });
}

export function useCriarProjeto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: criarProjeto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJETOS_KEY, exact: true }),
  });
}

export function useExcluirProjeto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: excluirProjeto,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: [...PROJETOS_KEY, id] });
      return queryClient.invalidateQueries({ queryKey: PROJETOS_KEY, exact: true });
    },
  });
}

export function useSalvarElementos(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ elementos, variaveisGlobais }: { elementos: ElementoEntrada[]; variaveisGlobais: Record<string, number> }) =>
      salvarElementos(id, elementos, variaveisGlobais),
    onSuccess: (projeto) => {
      queryClient.setQueryData([...PROJETOS_KEY, id], projeto);
      return queryClient.invalidateQueries({ queryKey: PROJETOS_KEY, exact: true });
    },
  });
}

/** Cria um projeto novo já com a árvore de um .glb importado (ver ImportarProjetoGlb): sem planta
 * (o tamanho do ambiente não faz sentido aqui, o próprio arquivo já define as medidas) e sem teto
 * de elementos (ver ProjetosController.SalvarElementos) — o arquivo pode ter qualquer quantidade
 * de peças, só o tamanho dele em si é limitado (ver MODELO3D_TAMANHO_MAXIMO) */
export function useImportarProjetoGlb() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nome, elemento }: { nome: string; elemento: ElementoEntrada }) => {
      const projeto = await criarProjeto({ nome, descricao: '', pontoPartida: 'avancada' });
      try {
        return await salvarElementos(projeto.id, [elemento], {});
      } catch (erro) {
        // Projeto criado mas vazio (o salvamento dos elementos falhou) não serve pra nada —
        // melhor não deixar um projeto fantasma pra trás
        await excluirProjeto(projeto.id).catch(() => {});
        throw erro;
      }
    },
    onSuccess: (projeto) => {
      queryClient.setQueryData([...PROJETOS_KEY, projeto.id], projeto);
      return queryClient.invalidateQueries({ queryKey: PROJETOS_KEY, exact: true });
    },
  });
}
