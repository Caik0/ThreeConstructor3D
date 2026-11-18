import { useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useUnidadeStore } from '../../../store/unidadeStore';
import styles from './ProjetoEditor.module.css';

/** Carrega a unidade escolhida pelo usuário pra este projeto/módulo (`escopo`: "projeto-12",
 * "modulo-3") ao abrir o editor, e volta pra cm ao sair */
export function useUnidadeDoEditor(escopo: string) {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const carregar = useUnidadeStore((s) => s.carregar);
  const limpar = useUnidadeStore((s) => s.limpar);
  useEffect(() => {
    carregar(usuarioId ?? 'anonimo', escopo);
    return limpar;
  }, [usuarioId, escopo, carregar, limpar]);
}

const PROXIMA = { cm: 'mm', mm: 'm', m: 'cm' } as const;

// Troca a unidade MOSTRADA das medidas (cm → mm → m). Só apresentação: os dados continuam em mm no
// banco, e fórmulas e contas com referências seguem em cm
export default function BotaoUnidade() {
  const unidade = useUnidadeStore((s) => s.unidade);
  const alternar = useUnidadeStore((s) => s.alternar);
  return (
    <div role="group" aria-label="Unidade de medida" className={styles.grupoFerramentas}>
      <button
        type="button"
        className={`${styles.ferramenta} ${styles.botaoUnidade}`}
        aria-label={`Unidade das medidas: ${unidade}. Alternar para ${PROXIMA[unidade]}`}
        title={`Unidade das medidas: ${unidade} (clique para ${PROXIMA[unidade]}). Só muda como os valores são mostrados e digitados; o que é salvo e as fórmulas seguem em cm.`}
        onClick={alternar}
      >
        {unidade}
      </button>
    </div>
  );
}
