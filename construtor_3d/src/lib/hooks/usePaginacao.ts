import { useState } from 'react';

export const TAMANHOS_DE_PAGINA = [10, 25, 50, 100] as const;

export interface Paginacao<T> {
  /** Página atual, a partir de 1 (sempre dentro do intervalo válido) */
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
  /** Número do primeiro e do último item mostrados (0 e 0 se não houver itens) */
  inicio: number;
  fim: number;
  itens: T[];
  irParaPagina: (pagina: number) => void;
  mudarTamanho: (tamanho: number) => void;
}

/** Paginação no navegador de uma lista já filtrada. Volta para a página 1 quando `chave` muda
 * (use a combinação de busca e filtros), e nunca fica numa página que deixou de existir */
export function usePaginacao<T>(lista: T[], chave: string, tamanhoInicial = 10): Paginacao<T> {
  const [estado, setEstado] = useState({ pagina: 1, chave });
  const [tamanho, setTamanho] = useState(tamanhoInicial);

  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pedida = estado.chave === chave ? estado.pagina : 1;
  const pagina = Math.min(Math.max(1, pedida), totalPaginas);
  const inicioIndice = (pagina - 1) * tamanho;

  return {
    pagina,
    tamanho,
    total,
    totalPaginas,
    inicio: total === 0 ? 0 : inicioIndice + 1,
    fim: Math.min(total, inicioIndice + tamanho),
    itens: lista.slice(inicioIndice, inicioIndice + tamanho),
    irParaPagina: (nova) => setEstado({ pagina: nova, chave }),
    mudarTamanho: (novo) => {
      setTamanho(novo);
      setEstado({ pagina: 1, chave });
    },
  };
}
