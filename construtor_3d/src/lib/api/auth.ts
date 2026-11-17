import type { Autenticacao, LoginDados, Usuario } from '../auth/auth';
import { apiGet, apiPost } from './client';

export function login(dados: LoginDados) {
  return apiPost<Autenticacao>('/auth/login', dados);
}

/** Usuário do token atual; usada só pra revalidar a sessão salva ao abrir a aplicação */
export function obterUsuarioAtual() {
  return apiGet<Usuario>('/auth/eu');
}
