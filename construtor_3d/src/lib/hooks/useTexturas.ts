import { useQuery } from '@tanstack/react-query';
import { listarTexturas } from '../api/texturas';

export const TEXTURAS_KEY = ['texturas'];

/** Texturas (imagens) já usadas pelo usuário antes, prontas pra reaproveitar sem importar de novo */
export function useTexturas() {
  return useQuery({
    queryKey: TEXTURAS_KEY,
    queryFn: listarTexturas,
  });
}
