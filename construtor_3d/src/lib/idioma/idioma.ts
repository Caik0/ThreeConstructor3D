import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

// Idioma padrão da empresa do usuário (Empresa.IdiomaPadraoId na API; código BCP 47). Hoje a
// interface só tem textos em português: o idioma define o formato de datas e o `lang` da página.
// Os números do editor continuam com vírgula decimal (os campos aceitam "60,5" e contas), qualquer
// que seja o idioma. Traduzir os textos é um passo à parte

export const IDIOMA_PADRAO = 'pt-BR';

const IDIOMAS_SUPORTADOS = ['pt-BR', 'en-US', 'es-ES'];

/** Idioma de datas e do `lang`; fora da sessão (login), o padrão */
export function idiomaAtual(): string {
  const codigo = useAuthStore.getState().usuario?.empresa?.idiomaPadrao;
  return codigo && IDIOMAS_SUPORTADOS.includes(codigo) ? codigo : IDIOMA_PADRAO;
}

export const formatarData = (valor: string | number | Date) => new Date(valor).toLocaleDateString(idiomaAtual());

export const formatarDataHora = (valor: string | number | Date) =>
  new Date(valor).toLocaleString(idiomaAtual(), { dateStyle: 'short', timeStyle: 'short' });

/** Acompanha o idioma da empresa no `lang` do documento (leitores de tela, hifenização, tradutor do navegador) */
export function useAplicarIdioma() {
  const codigo = useAuthStore((s) => s.usuario?.empresa?.idiomaPadrao);
  useEffect(() => {
    document.documentElement.lang = codigo && IDIOMAS_SUPORTADOS.includes(codigo) ? codigo : IDIOMA_PADRAO;
  }, [codigo]);
}
