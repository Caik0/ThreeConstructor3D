import { useEffect, useState } from 'react';

// Distância, em px, entre a barra de cima do editor e os painéis flutuantes que ficam abaixo dela
const FOLGA_ENTRE_BARRA_E_PAINEIS = 12;

/**
 * A barra de cima do editor quebra em duas linhas quando a tela é estreita demais pra caber tudo
 * (sem isso os itens da direita vazavam pra fora da tela). Com a altura dela variando, os painéis
 * (Estrutura, Propriedades, trilha do grupo, Vista Explodida) não podem ficar num `top` fixo: o hook
 * mede a barra e grava `--base-paineis` (onde os painéis começam) no elemento pai dela — a raiz do
 * editor —, que o CSS lê em `top: var(--base-paineis, 80px)`.
 *
 * Devolve o ref (em formato de função, pra funcionar mesmo quando a barra só aparece depois de um
 * carregamento) que vai no `<header>` da barra.
 */
export function useBaseDosPaineis() {
  const [barra, setBarra] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const raiz = barra?.parentElement;
    if (!barra || !raiz) return;
    const medir = () => raiz.style.setProperty('--base-paineis', `${barra.offsetTop + barra.offsetHeight + FOLGA_ENTRE_BARRA_E_PAINEIS}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(barra);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty('--base-paineis');
    };
  }, [barra]);

  return setBarra;
}
