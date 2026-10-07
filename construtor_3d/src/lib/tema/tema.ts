// Tema escolhido pelo usuário. Sem escolha salva, o app segue o tema do sistema operacional
// (ver styles/tokens.css); a escolha explícita sempre tem prioridade sobre o sistema.

export type Tema = 'claro' | 'escuro';

const CHAVE_ARMAZENAMENTO = 'construtor3d.tema';
const CONSULTA_SISTEMA = '(prefers-color-scheme: dark)';

export function lerTemaSalvo(): Tema | null {
  try {
    const valor = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    return valor === 'claro' || valor === 'escuro' ? valor : null;
  } catch {
    // localStorage indisponível (ex.: navegação privada): segue o tema do sistema
    return null;
  }
}

export function salvarTemaEscolhido(tema: Tema) {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
  } catch {
    // A escolha só vale para esta sessão
  }
}

/** Marca o tema explícito no documento (ver o seletor [data-theme] em styles/tokens.css) */
export function aplicarTemaNoDocumento(tema: Tema) {
  document.documentElement.setAttribute('data-theme', tema === 'claro' ? 'light' : 'dark');
}

export function sistemaPrefereEscuro() {
  return window.matchMedia(CONSULTA_SISTEMA).matches;
}

export function assinarTemaDoSistema(notificar: () => void) {
  const consulta = window.matchMedia(CONSULTA_SISTEMA);
  consulta.addEventListener('change', notificar);
  return () => consulta.removeEventListener('change', notificar);
}
