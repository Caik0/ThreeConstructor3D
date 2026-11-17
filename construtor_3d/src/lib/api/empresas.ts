import { apiGet, apiPost, apiPut } from './client';

/** Campos da empresa editáveis pelo super admin (ver DadosEmpresaRequest na API) */
export interface DadosEmpresa {
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string | null;
  documentoFiscal: string | null;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  link: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  uf: string | null;
  estadoProvincia: string | null;
  pais: string | null;
  fotoEmpresa: string | null;
  obs: string | null;
  versao: string | null;
  padraoMedida: string;
  /** Limite de armazenamento em bytes; nulo = sem limite */
  espacoArmazenamento: number | null;
  idiomaPadraoId: number;
}

export interface Empresa extends DadosEmpresa {
  id: number;
  quemCadastrou: string | null;
  bloqueada: boolean;
  dataBloqueio: string | null;
  motivoBloqueio: string | null;
  quantidadeUsuarios: number;
  criadoEm: string;
}

export interface AdminInicial {
  nome: string;
  email: string;
  senha: string;
}

export interface Idioma {
  id: number;
  codigo: string;
  nome: string;
}

export const listarEmpresas = () => apiGet<Empresa[]>('/empresas');
export const criarEmpresa = (empresa: DadosEmpresa, admin: AdminInicial) => apiPost<Empresa>('/empresas', { empresa, admin });
export const atualizarEmpresa = (id: number, empresa: DadosEmpresa) => apiPut<Empresa>(`/empresas/${id}`, empresa);
export const bloquearEmpresa = (id: number, bloqueada: boolean, motivo: string | null) =>
  apiPut<Empresa>(`/empresas/${id}/bloqueio`, { bloqueada, motivo });
export const listarIdiomas = () => apiGet<Idioma[]>('/idiomas');
