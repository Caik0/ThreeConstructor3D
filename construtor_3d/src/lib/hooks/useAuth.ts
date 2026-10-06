import { useMutation, useQuery } from '@tanstack/react-query';
import { cadastrar, login, obterUsuarioAtual } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuthStore } from '../../store/authStore';

export function useCadastrar() {
  const definirSessao = useAuthStore((s) => s.definirSessao);
  return useMutation({
    mutationFn: cadastrar,
    onSuccess: definirSessao,
  });
}

export function useLogin() {
  const definirSessao = useAuthStore((s) => s.definirSessao);
  return useMutation({
    mutationFn: login,
    onSuccess: definirSessao,
  });
}

/** Revalida a sessão salva ao abrir a aplicação: confirma que o token ainda é válido e atualiza
 * nome/e-mail caso tenham mudado. Um token expirado ou inválido responde 401, e o client já limpa
 * a sessão sozinho (ver lib/api/client.ts) — não precisa tratar o erro aqui */
export function useUsuarioAtual() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['usuario-atual'],
    queryFn: obterUsuarioAtual,
    enabled: token !== null,
    retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status === 401) && tentativas < 2,
  });
}
