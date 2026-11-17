import { useQuery } from '@tanstack/react-query';
import { idiomaAtual } from '../idioma/idioma';

// PAÍSES, ESTADOS E CIDADES vêm de APIs públicas, sem chave, consultadas direto do navegador:
//  - Brasil: IBGE (servicodados.ibge.gov.br), que é a fonte oficial de UFs e municípios;
//  - resto do mundo: countriesnow.space (países com ISO, estados e cidades).
// O país é guardado pelo código ISO 3166-1 alfa-2 ("BR"); o nome mostrado vem do próprio navegador
// (Intl.DisplayNames), no idioma da empresa. Se uma API cair, a tela cai para campo de texto livre
// (ver CampoLocalidade em AdminEmpresas), então o cadastro nunca fica travado por causa delas.

const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const COUNTRIES_NOW = 'https://countriesnow.space/api/v0.1/countries';

export const PAIS_BRASIL = 'BR';

export interface Opcao {
  /** O que é guardado no cadastro */
  valor: string;
  /** O que aparece na lista */
  rotulo: string;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao consultar ${new URL(url).host} (${resposta.status})`);
  return (await resposta.json()) as T;
}

/** A resposta da countriesnow traz `error: true` com status 200 quando não acha o dado */
async function buscarCountriesNow<T>(caminho: string): Promise<T> {
  const corpo = await buscarJson<{ error: boolean; msg: string; data: T }>(`${COUNTRIES_NOW}${caminho}`);
  if (corpo.error) throw new Error(corpo.msg);
  return corpo.data;
}

const ordenar = (opcoes: Opcao[]) => opcoes.sort((a, b) => a.rotulo.localeCompare(b.rotulo, idiomaAtual()));

interface PaisApi {
  name: string;
  Iso2: string;
}

function nomeDoPais(codigo: string, nomeIngles: string): string {
  try {
    return new Intl.DisplayNames([idiomaAtual()], { type: 'region' }).of(codigo) ?? nomeIngles;
  } catch {
    return nomeIngles;
  }
}

/** Países, pelo código ISO; o nome em inglês da API também vai junto porque os estados e cidades são consultados por ele */
async function listarPaises(): Promise<{ opcoes: Opcao[]; nomesEmIngles: Record<string, string> }> {
  const paises = await buscarCountriesNow<PaisApi[]>('/iso');
  const nomesEmIngles: Record<string, string> = {};
  const opcoes = paises
    .filter((p) => p.Iso2)
    .map((p) => {
      nomesEmIngles[p.Iso2] = p.name;
      return { valor: p.Iso2, rotulo: nomeDoPais(p.Iso2, p.name) };
    });
  return { opcoes: ordenar(opcoes), nomesEmIngles };
}

async function listarEstados(pais: string, nomeEmIngles: string): Promise<Opcao[]> {
  if (pais === PAIS_BRASIL) {
    const estados = await buscarJson<{ sigla: string; nome: string }[]>(`${IBGE}/estados?orderBy=nome`);
    return estados.map((e) => ({ valor: e.sigla, rotulo: `${e.nome} (${e.sigla})` }));
  }
  const dados = await buscarCountriesNow<{ states: { name: string }[] }>(`/states/q?country=${encodeURIComponent(nomeEmIngles)}`);
  return ordenar(dados.states.map((e) => ({ valor: e.name, rotulo: e.name })));
}

async function listarCidades(pais: string, nomeEmIngles: string, estado: string | null): Promise<Opcao[]> {
  if (pais === PAIS_BRASIL) {
    const municipios = await buscarJson<{ nome: string }[]>(`${IBGE}/estados/${encodeURIComponent(estado ?? '')}/municipios?orderBy=nome`);
    return municipios.map((m) => ({ valor: m.nome, rotulo: m.nome }));
  }
  const pais_ = encodeURIComponent(nomeEmIngles);
  const cidades = estado
    ? await buscarCountriesNow<string[]>(`/state/cities/q?country=${pais_}&state=${encodeURIComponent(estado)}`)
    : await buscarCountriesNow<string[]>(`/cities/q?country=${pais_}`);
  return ordenar([...new Set(cidades)].map((c) => ({ valor: c, rotulo: c })));
}

// As listas quase não mudam: ficam em cache por um dia
const UM_DIA = 24 * 60 * 60 * 1000;
const consultaEstavel = { staleTime: UM_DIA, gcTime: UM_DIA, retry: 1 };

export function usePaises() {
  const idioma = idiomaAtual();
  return useQuery({ queryKey: ['localidades', 'paises', idioma], queryFn: listarPaises, ...consultaEstavel });
}

/** Estados (UFs no Brasil) do país; `nomeEmIngles` vem de `usePaises` */
export function useEstados(pais: string | null, nomeEmIngles: string | undefined) {
  return useQuery({
    queryKey: ['localidades', 'estados', pais],
    queryFn: () => listarEstados(pais!, nomeEmIngles!),
    enabled: !!pais && !!nomeEmIngles,
    ...consultaEstavel,
  });
}

/** Cidades do estado. Países sem lista de estados consultam as cidades do país inteiro (`estado` nulo) */
export function useCidades(pais: string | null, nomeEmIngles: string | undefined, estado: string | null, semEstados: boolean) {
  const consultar = !!pais && !!nomeEmIngles && (semEstados || !!estado);
  return useQuery({
    queryKey: ['localidades', 'cidades', pais, semEstados ? null : estado],
    queryFn: () => listarCidades(pais!, nomeEmIngles!, semEstados ? null : estado),
    enabled: consultar,
    ...consultaEstavel,
  });
}
