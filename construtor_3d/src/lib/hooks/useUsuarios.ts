import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { atualizarPermissoesUsuario, atualizarUsuario, bloquearUsuario, criarUsuario, excluirUsuario, listarUsuarios } from '../api/usuarios';
import type { DadosCadastraisUsuario } from '../auth/auth';

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
    mutationFn: ({ nome, email, senha, admin, permissoes, dados }: { nome: string; email: string; senha: string; admin: boolean; permissoes: string[]; dados: DadosCadastraisUsuario }) =>
      criarUsuario(nome, email, senha, admin, permissoes, dados),
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
    mutationFn: ({ id, nome, email, dados }: { id: number; nome: string; email: string; dados: DadosCadastraisUsuario }) => atualizarUsuario(id, nome, email, dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY, exact: true }),
  });
}

export function useBloquearUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, bloqueado, motivo }: { id: number; bloqueado: boolean; motivo: string | null }) => bloquearUsuario(id, bloqueado, motivo),
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
