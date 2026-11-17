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
  /** Dono da plataforma: cadastra e bloqueia empresas (ver /api/empresas) */
  superAdmin: boolean;
  /** Chaves de PermissaoChave liberadas; irrelevante se `admin` for true */
  permissoes: string[] | null;
  criadoEm: string;
  /** Empresa do usuário: tudo o que ele vê pertence a ela */
  empresa: EmpresaResumo;
  /** Bloqueado: não entra e as sessões abertas caem; `dataBloqueio` e `motivoBloqueio` valem só enquanto estiver bloqueado */
  bloqueado: boolean;
  dataBloqueio: string | null;
  motivoBloqueio: string | null;
  ultimaAlteracaoSenha: string | null;
  telefone: string | null;
  celular: string | null;
  /** Documento no Brasil; `documentoFiscal` é o de outros países (só um dos dois vem preenchido) */
  cpfCnpj: string | null;
  documentoFiscal: string | null;
  cidade: string | null;
  /** Sigla do estado brasileiro; `estadoProvincia` é o equivalente fora do Brasil */
  uf: string | null;
  estadoProvincia: string | null;
  /** Código ISO alfa-2 (BR, PT, US…) */
  pais: string | null;
  obs: string | null;
}

/** Cadastro pessoal editável do usuário (tudo opcional) */
export interface DadosCadastraisUsuario {
  telefone: string | null;
  celular: string | null;
  cpfCnpj: string | null;
  documentoFiscal: string | null;
  cidade: string | null;
  uf: string | null;
  estadoProvincia: string | null;
  pais: string | null;
  obs: string | null;
}

export interface EmpresaResumo {
  id: number;
  nome: string;
  /** Código BCP 47 do idioma padrão da empresa (pt-BR, en-US, es-ES) */
  idiomaPadrao: string;
  /** Unidade de medida padrão da empresa (mm, cm, m) */
  padraoMedida: string;
}

export interface LoginDados {
  email: string;
  senha: string;
}

export interface Autenticacao {
  token: string;
  usuario: Usuario;
}
