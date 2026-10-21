import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { atualizarPermissoesUsuario, atualizarUsuario, criarUsuario, excluirUsuario, listarUsuarios } from '../api/usuarios';

export const USUARIOS_KEY = ['usuarios'];

export function useUsuariosAdmin() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: listarUsuarios,
  });
}

export function useCriarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nome, email, senha }: { nome: string; email: string; senha: string }) =>
      criarUsuario(nome, email, senha),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY, exact: true }),
  });
}

export function useAtualizarPermissoesUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, admin, permissoes }: { id: number; admin: boolean; permissoes: string[] }) =>
      atualizarPermissoesUsuario(id, admin, permissoes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY, exact: true }),
  });
}

export function useAtualizarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nome, email }: { id: number; nome: string; email: string }) => atualizarUsuario(id, nome, email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY, exact: true }),
  });
}

export function useExcluirUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: excluirUsuario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY, exact: true }),
  });
}
