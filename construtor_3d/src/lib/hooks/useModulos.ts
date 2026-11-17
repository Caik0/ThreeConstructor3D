import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import {
  excluirModulo,
  listarModulos,
  obterModulo,
  atualizarModulo,
  salvarConteudoModulo,
  salvarModulo,
} from '../api/modulos';
import type { GrupoEClassificacao } from '../api/modulos';
import type { ElementoEntrada } from '../projetos/projetos';

export const MODULOS_KEY = ['modulos'];

export function useModulos() {
  return useQuery({
    queryKey: MODULOS_KEY,
    queryFn: listarModulos,
  });
}

export function useModulo(id: number) {
  return useQuery({
    queryKey: [...MODULOS_KEY, id],
    queryFn: () => obterModulo(id),
    enabled: Number.isInteger(id),
    // Não insiste quando o módulo não existe
    retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status === 404) && tentativas < 2,
  });
}

export function useSalvarModulo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nome, elemento, grupoId, classificacaoId }: { nome: string; elemento: ElementoEntrada } & GrupoEClassificacao) =>
      salvarModulo(nome, elemento, { grupoId, classificacaoId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true }),
  });
}

export function useAtualizarModulo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nome, grupoId, classificacaoId }: { id: number; nome: string } & GrupoEClassificacao) =>
      atualizarModulo(id, nome, { grupoId, classificacaoId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true }),
  });
}

/** Substitui a árvore inteira de um módulo já salvo, ao editá-lo e salvar de novo */
export function useSalvarConteudoModulo(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (elemento: ElementoEntrada) => salvarConteudoModulo(id, elemento),
    onSuccess: (modulo) => {
      queryClient.setQueryData([...MODULOS_KEY, id], modulo);
      return queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true });
    },
  });
}

export function useExcluirModulo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: excluirModulo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true }),
  });
}
