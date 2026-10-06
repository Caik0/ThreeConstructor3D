import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import {
  excluirModulo,
  listarModulos,
  obterModulo,
  renomearModulo,
  salvarConteudoModulo,
  salvarModulo,
} from '../api/modulos';
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
    mutationFn: ({ nome, elemento }: { nome: string; elemento: ElementoEntrada }) => salvarModulo(nome, elemento),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODULOS_KEY, exact: true }),
  });
}

export function useRenomearModulo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => renomearModulo(id, nome),
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
