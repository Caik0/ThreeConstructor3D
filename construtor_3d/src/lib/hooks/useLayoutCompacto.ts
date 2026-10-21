import { useEffect, useState } from 'react';

// Ponto de corte do layout compacto do editor, o mesmo no celular e no tablet: os painéis viram
// gavetas na parte de baixo, as ferramentas ficam numa barra fixa embaixo e o painel de
// propriedades não abre sozinho. O CSS não consegue ler esta constante, então o mesmo valor está
// repetido em `@media (max-width: …)` de ProjetoEditor.module.css e de ModuloViewport.module.css —
// mude os três juntos.
export const LARGURA_MAXIMA_LAYOUT_COMPACTO = 768;
const CONSULTA_LAYOUT_COMPACTO = `(max-width: ${LARGURA_MAXIMA_LAYOUT_COMPACTO}px)`;

/** Se a tela cabe no layout compacto agora (sem esperar o primeiro efeito, pra não piscar o layout errado) */
export const layoutCompactoAgora = () => window.matchMedia(CONSULTA_LAYOUT_COMPACTO).matches;

// No espaço apertado de um celular ou tablet, o painel de propriedades cobre boa parte da cena e
// atrapalha usar mover/girar — daí o layout compacto não abri-lo sozinho ao selecionar um módulo
export function useLayoutCompacto() {
  const [compacto, setCompacto] = useState(layoutCompactoAgora);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_LAYOUT_COMPACTO);
    const ouvir = () => setCompacto(consulta.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return compacto;
}
