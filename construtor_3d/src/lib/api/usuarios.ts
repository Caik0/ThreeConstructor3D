import type { DadosCadastraisUsuario, Usuario } from '../auth/auth';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export function listarUsuarios() {
  return apiGet<Usuario[]>('/usuarios');
}

/** O admin já define na criação se o usuário é administrador e quais permissões ele tem */
export function criarUsuario(nome: string, email: string, senha: string, admin: boolean, permissoes: string[], dados: DadosCadastraisUsuario) {
  return apiPost<Usuario>('/usuarios', { nome, email, senha, admin, permissoes, dados });
}

export function atualizarPermissoesUsuario(id: number, admin: boolean, permissoes: string[]) {
  return apiPut<Usuario>(`/usuarios/${id}/permissoes`, { admin, permissoes });
}

export function atualizarUsuario(id: number, nome: string, email: string, dados: DadosCadastraisUsuario) {
  return apiPut<Usuario>(`/usuarios/${id}`, { nome, email, dados });
}

/** Bloqueado: o usuário não entra e as sessões abertas dele caem; o motivo só vale ao bloquear */
export function bloquearUsuario(id: number, bloqueado: boolean, motivo: string | null) {
  return apiPut<Usuario>(`/usuarios/${id}/bloqueio`, { bloqueado, motivo });
}

export function excluirUsuario(id: number) {
  return apiDelete(`/usuarios/${id}`);
}
