import { useEffect, useId, useRef, useState } from 'react';
import styles from './SelecaoMultipla.module.css';

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
  /** Opções com o mesmo grupo aparecem juntas, sob o título dele */
  grupo?: string;
}

interface SelecaoMultiplaProps {
  /** Texto do botão quando nada está marcado ("Qualquer permissão") */
  vazio: string;
  /** Texto do botão com itens marcados, antes da contagem ("Permissões" → "Permissões (2)") */
  rotulo: string;
  opcoes: OpcaoMultipla[];
  selecionadas: string[];
  onChange: (selecionadas: string[]) => void;
}

/** Largura máxima aproximada do painel, para decidir de que lado do botão ele abre */
const LARGURA_ESTIMADA_PAINEL = 360;

// Lista suspensa de múltipla escolha: o botão abre um painel de caixas de seleção. Fecha ao clicar
// fora ou com Esc. O painel é filho do próprio contêiner (position: absolute), então não serve
// dentro de áreas com overflow cortando; nos filtros das tabelas não há esse problema
export default function SelecaoMultipla({ vazio, rotulo, opcoes, selecionadas, onChange }: SelecaoMultiplaProps) {
  const [aberto, setAberto] = useState(false);
  // Painel alinhado pela direita do botão, quando à direita dele não sobra espaço na tela
  const [alinharDireita, setAlinharDireita] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idPainel = useId();

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
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

  function alternar(valor: string) {
    onChange(selecionadas.includes(valor) ? selecionadas.filter((v) => v !== valor) : [...selecionadas, valor]);
  }

  const grupos = new Map<string, OpcaoMultipla[]>();
  for (const opcao of opcoes) grupos.set(opcao.grupo ?? '', [...(grupos.get(opcao.grupo ?? '') ?? []), opcao]);

  return (
    <div className={styles.raiz} ref={raiz}>
      <button
        type="button"
        className={styles.botao}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        onClick={() => {
          const caixa = raiz.current?.getBoundingClientRect();
          if (caixa) {
            const direita = document.documentElement.clientWidth - caixa.left;
            setAlinharDireita(direita < LARGURA_ESTIMADA_PAINEL && caixa.right >= LARGURA_ESTIMADA_PAINEL);
          }
          setAberto((v) => !v);
        }}
      >
        {selecionadas.length === 0 ? vazio : `${rotulo} (${selecionadas.length})`}
        <span aria-hidden="true">▾</span>
      </button>
      {aberto && (
        <div id={idPainel} className={`${styles.painel} ${alinharDireita ? styles.painelDireita : ''}`} role="group" aria-label={rotulo}>
          {selecionadas.length > 0 && (
            <button type="button" className={styles.limpar} onClick={() => onChange([])}>
              Limpar seleção
            </button>
          )}
          {[...grupos.entries()].map(([grupo, itens]) => (
            <fieldset key={grupo} className={styles.grupo}>
              {grupo && <legend>{grupo}</legend>}
              {itens.map((opcao) => (
                <label key={opcao.valor} className={styles.opcao}>
                  <input type="checkbox" checked={selecionadas.includes(opcao.valor)} onChange={() => alternar(opcao.valor)} />
                  {opcao.rotulo}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
