import { useState, type ReactNode } from 'react';
import { TAMANHOS_DE_PAGINA, type Paginacao } from '../../../lib/hooks/usePaginacao';
import styles from './TabelaPaginada.module.css';

interface TabelaPaginadaProps {
  /** A `<table>` (o cabeçalho `th` fica fixo no topo enquanto o corpo rola) ou uma grade de cartões */
  children: ReactNode;
  paginacao: Paginacao<unknown>;
  /** Nome dos itens no rodapé ("empresas", "usuários") */
  rotuloItens: string;
}

/** Moldura padrão das listas (tabela ou cartões): área com rolagem própria e cabeçalho fixo, botão de voltar ao topo
 * (aparece depois de rolar um pouco) e rodapé com a paginação */
export default function TabelaPaginada({ children, paginacao, rotuloItens }: TabelaPaginadaProps) {
  const [rolou, setRolou] = useState(false);
  const { pagina, totalPaginas, tamanho, total, inicio, fim, irParaPagina, mudarTamanho } = paginacao;
  const [area, setArea] = useState<HTMLDivElement | null>(null);

  return (
    <div className={styles.moldura}>
      <div className={styles.area} ref={setArea} onScroll={(e) => setRolou(e.currentTarget.scrollTop > 120)}>
        {children}
      </div>
      {rolou && (
        <button type="button" className={styles.topo} onClick={() => area?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo da lista" title="Voltar ao topo">
          ↑
        </button>
      )}
      <div className={styles.rodape}>
        <span aria-live="polite">{total === 0 ? `0 ${rotuloItens}` : `${inicio}–${fim} de ${total} ${rotuloItens}`}</span>
        <label className={styles.tamanho}>
          Por página
          <select value={tamanho} onChange={(e) => mudarTamanho(Number(e.target.value))}>
            {TAMANHOS_DE_PAGINA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.paginas}>
          <button type="button" disabled={pagina <= 1} onClick={() => irParaPagina(1)} aria-label="Primeira página">
            «
          </button>
          <button type="button" disabled={pagina <= 1} onClick={() => irParaPagina(pagina - 1)}>
            Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button type="button" disabled={pagina >= totalPaginas} onClick={() => irParaPagina(pagina + 1)}>
            Próxima
          </button>
          <button type="button" disabled={pagina >= totalPaginas} onClick={() => irParaPagina(totalPaginas)} aria-label="Última página">
            »
          </button>
        </div>
      </div>
    </div>
  );
}
