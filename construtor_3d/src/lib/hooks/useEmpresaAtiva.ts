import { useQueryClient } from '@tanstack/react-query';
import { obterUsuarioAtual } from '../api/auth';
import { useAuthStore } from '../../store/authStore';

/** Troca a empresa em que o super admin está agindo (nulo = volta para a própria). Descarta tudo o que
 * estava em cache (projetos, módulos, usuários… da empresa anterior) e recarrega o usuário, cuja
 * `empresa` passa a ser a escolhida (idioma e unidade padrão dela) */
export function useTrocarEmpresaAtiva() {
  const queryClient = useQueryClient();
  const definirEmpresaAtiva = useAuthStore((s) => s.definirEmpresaAtiva);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  return async (id: number | null) => {
    definirEmpresaAtiva(id);
    try {
      atualizarUsuario(await obterUsuarioAtual());
    } catch (erro) {
      definirEmpresaAtiva(null);
      throw erro;
    }
    await queryClient.resetQueries();
  };
}
