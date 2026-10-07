import { useEffect } from 'react';
import { useUsuarioAtual } from '../../lib/hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

/** Mantido montado o app inteiro: toda vez que useUsuarioAtual revalida (ao focar a aba, ao
 * montar uma tela nova), propaga o usuário fresco pra store — é assim que uma permissão alterada
 * por um admin chega pra quem já está logado, sem precisar relogar */
export default function SincronizadorSessao() {
  const { data } = useUsuarioAtual();
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  useEffect(() => {
    if (data) atualizarUsuario(data);
  }, [data, atualizarUsuario]);

  return null;
}
