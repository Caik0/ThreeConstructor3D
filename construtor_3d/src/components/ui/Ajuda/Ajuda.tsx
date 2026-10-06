import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Ajuda.module.css';

interface AjudaProps {
  /** Texto explicativo mostrado ao clicar */
  texto: string;
  /** Rótulo do botão para leitores de tela ("Ajuda" por padrão) */
  rotulo?: string;
}

const LARGURA_POPOVER = 260;
const ALTURA_ESTIMADA = 120;
const MARGEM = 8;

// Botão "?" que, ao ser clicado, mostra um texto explicativo num balão. Fecha ao clicar fora, com
// Esc ou clicando de novo no botão. Renderizado fora da árvore (createPortal) porque os painéis
// flutuantes do editor têm overflow e backdrop-filter, que prendem `position: fixed` dentro deles
export default function Ajuda({ texto, rotulo = 'Ajuda' }: AjudaProps) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const botaoRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const idPopover = useId();

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(e: PointerEvent) {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo) || popoverRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('pointerdown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  function alternar() {
    if (!aberto && botaoRef.current) {
      const retangulo = botaoRef.current.getBoundingClientRect();
      const espacoDireita = window.innerWidth - retangulo.left;
      const left =
        espacoDireita < LARGURA_POPOVER + MARGEM * 2
          ? Math.max(MARGEM, window.innerWidth - LARGURA_POPOVER - MARGEM)
          : retangulo.left;
      const top =
        retangulo.bottom + ALTURA_ESTIMADA + MARGEM > window.innerHeight
          ? Math.max(MARGEM, retangulo.top - ALTURA_ESTIMADA - MARGEM)
          : retangulo.bottom + MARGEM;
      setPosicao({ top, left });
    }
    setAberto((v) => !v);
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className={styles.botao}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={aberto ? idPopover : undefined}
        onClick={alternar}
      >
        ?
      </button>
      {aberto &&
        createPortal(
          <div
            ref={popoverRef}
            id={idPopover}
            role="tooltip"
            className={styles.popover}
            style={{ top: posicao.top, left: posicao.left, maxWidth: LARGURA_POPOVER }}
          >
            {texto}
          </div>,
          document.body,
        )}
    </>
  );
}
