import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  atualizarEmpresa,
  bloquearEmpresa,
  criarEmpresa,
  listarEmpresas,
  listarIdiomas,
  type AdminInicial,
  type DadosEmpresa,
} from '../api/empresas';

export const EMPRESAS_KEY = ['empresas'];

export function useEmpresas(habilitada = true) {
  return useQuery({ queryKey: EMPRESAS_KEY, queryFn: listarEmpresas, enabled: habilitada });
}

/** Os idiomas quase não mudam: ficam em cache pela sessão toda */
export function useIdiomas() {
  return useQuery({ queryKey: ['idiomas'], queryFn: listarIdiomas, staleTime: Infinity });
}

export function useCriarEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ empresa, admin }: { empresa: DadosEmpresa; admin: AdminInicial }) => criarEmpresa(empresa, admin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPRESAS_KEY }),
  });
}

export function useAtualizarEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, empresa }: { id: number; empresa: DadosEmpresa }) => atualizarEmpresa(id, empresa),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPRESAS_KEY }),
  });
}

export function useBloquearEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bloqueada, motivo }: { id: number; bloqueada: boolean; motivo: string | null }) => bloquearEmpresa(id, bloqueada, motivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPRESAS_KEY }),
  });
}
