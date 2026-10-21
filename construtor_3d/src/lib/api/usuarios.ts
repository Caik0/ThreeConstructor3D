import type { Usuario } from '../auth/auth';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export function listarUsuarios() {
  return apiGet<Usuario[]>('/usuarios');
}

/** Nasce sem admin e sem permissões; o admin ajusta isso depois pelo botão "Permissões" */
export function criarUsuario(nome: string, email: string, senha: string) {
  return apiPost<Usuario>('/usuarios', { nome, email, senha });
}

export function atualizarPermissoesUsuario(id: number, admin: boolean, permissoes: string[]) {
  return apiPut<Usuario>(`/usuarios/${id}/permissoes`, { admin, permissoes });
}

export function atualizarUsuario(id: number, nome: string, email: string) {
  return apiPut<Usuario>(`/usuarios/${id}`, { nome, email });
}

export function excluirUsuario(id: number) {
  return apiDelete(`/usuarios/${id}`);
}
