import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { atualizarPermissoesUsuario, listarUsuarios } from '../api/usuarios';

export const USUARIOS_KEY = ['usuarios'];

export function useUsuariosAdmin() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: listarUsuarios,
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
