import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alterarCategoriaTextura, listarTexturas } from '../api/texturas';
import type { CategoriaTextura } from '../textura/categorias';

export const TEXTURAS_KEY = ['texturas'];

/** Texturas (imagens) já usadas pelo usuário antes, prontas pra reaproveitar sem importar de novo */
export function useTexturas() {
  return useQuery({
    queryKey: TEXTURAS_KEY,
    queryFn: listarTexturas,
  });
}

/** Muda o tipo (madeira, espelho, metálica...) de uma textura do catálogo */
export function useAlterarCategoriaTextura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoria }: { id: number; categoria: CategoriaTextura }) => alterarCategoriaTextura(id, categoria),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEXTURAS_KEY, exact: true }),
  });
}
