import { create } from 'zustand';
import type { Autenticacao, Usuario } from '../lib/auth/auth';

const CHAVE_TOKEN = 'token';
const CHAVE_USUARIO = 'usuario';

function usuarioSalvo(): Usuario | null {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? (JSON.parse(bruto) as Usuario) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  /** Guardado junto do token só pra exibir nome/e-mail sem esperar uma requisição; a fonte da
   * verdade continua sendo a API (ver useUsuarioAtual, que revalida ao carregar a aplicação) */
  usuario: Usuario | null;
  /** Login e cadastro chamam isso com a resposta da API */
  definirSessao: (autenticacao: Autenticacao) => void;
  /** Atualiza só os dados do usuário (ex.: permissões mudaram), sem mexer no token nem relogar */
  atualizarUsuario: (usuario: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(CHAVE_TOKEN),
  usuario: usuarioSalvo(),
  definirSessao: ({ token, usuario }) => {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    set({ token, usuario });
  },
  atualizarUsuario: (usuario) => {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    set({ usuario });
  },
  logout: () => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    set({ token: null, usuario: null });
  },
}));
