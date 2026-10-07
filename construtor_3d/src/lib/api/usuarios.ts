import type { Usuario } from '../auth/auth';
import { apiGet, apiPut } from './client';

export function listarUsuarios() {
  return apiGet<Usuario[]>('/usuarios');
}

export function atualizarPermissoesUsuario(id: number, admin: boolean, permissoes: string[]) {
  return apiPut<Usuario>(`/usuarios/${id}/permissoes`, { admin, permissoes });
}
