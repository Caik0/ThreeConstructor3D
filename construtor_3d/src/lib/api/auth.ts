import type { Autenticacao, CadastroDados, LoginDados, Usuario } from '../auth/auth';
import { apiGet, apiPost } from './client';

export function cadastrar(dados: CadastroDados) {
  return apiPost<Autenticacao>('/auth/cadastro', dados);
}

export function login(dados: LoginDados) {
  return apiPost<Autenticacao>('/auth/login', dados);
}

/** Usuário do token atual; usada só pra revalidar a sessão salva ao abrir a aplicação */
export function obterUsuarioAtual() {
  return apiGet<Usuario>('/auth/eu');
}
