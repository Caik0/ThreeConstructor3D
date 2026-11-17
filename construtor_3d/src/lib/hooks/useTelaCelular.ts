import { useEffect, useState } from 'react';

// Mesmo ponto de corte (720px) que as telas de administração usam nos `@media` do CSS
const CONSULTA = '(max-width: 720px)';

/** Se a tela é de celular agora; reage a girar o aparelho ou redimensionar a janela */
export function useTelaCelular() {
  const [celular, setCelular] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA);
    const ouvir = () => setCelular(consulta.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return celular;
}
