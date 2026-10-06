import { useAuthStore } from '../../store/authStore';
import { temPermissao, type PermissaoChave } from '../permissoes/permissoes';

/** Gate de ferramenta dentro de um componente; pra filtrar um array fora de um componente, use
 * `temPermissao` direto (não dá pra chamar hook dentro de .filter/.map) */
export function useTemPermissao(chave: PermissaoChave): boolean {
  return useAuthStore((s) => temPermissao(s.usuario, chave));
}
