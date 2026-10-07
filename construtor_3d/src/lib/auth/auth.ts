// Mesmos limites validados na API (ver Models/LimitesUsuario.cs)
export const NOME_COMPRIMENTO_MINIMO = 2;
export const NOME_COMPRIMENTO_MAXIMO = 100;
export const SENHA_COMPRIMENTO_MINIMO = 8;

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  /** Acesso total, ignora `permissoes` (ver lib/permissoes/permissoes.ts) */
  admin: boolean;
  /** Chaves de PermissaoChave liberadas; irrelevante se `admin` for true */
  permissoes: string[] | null;
  criadoEm: string;
}

export interface CadastroDados {
  nome: string;
  email: string;
  senha: string;
}

export interface LoginDados {
  email: string;
  senha: string;
}

export interface Autenticacao {
  token: string;
  usuario: Usuario;
}
