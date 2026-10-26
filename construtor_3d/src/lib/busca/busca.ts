/** Texto sem acentos, em minúsculas e sem espaços nas pontas, pra comparar buscas ("Cozinha" acha "cozinha") */
export const normalizarBusca = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/** Se algum dos `campos` contém o que foi digitado; busca vazia aceita tudo */
export function correspondeBusca(busca: string, ...campos: (string | null | undefined)[]): boolean {
  const termo = normalizarBusca(busca);
  if (termo === '') return true;
  return campos.some((campo) => campo && normalizarBusca(campo).includes(termo));
}
