import { NOME_CATEGORIA, type CategoriaElemento } from '../../../lib/projetos/projetos';
import styles from './FiltroCategoria.module.css';

export type FiltroDeCategoria = CategoriaElemento | 'todas';

const OPCOES: FiltroDeCategoria[] = ['todas', 'estrutura', 'ferragem', 'furacao'];

interface FiltroCategoriaProps {
  valor: FiltroDeCategoria;
  onChange: (valor: FiltroDeCategoria) => void;
  /** Quantos itens há em cada categoria, mostrado ao lado do nome ("todas" é a soma) */
  contagens: Record<CategoriaElemento, number>;
}

// Abas simples pra separar módulos por categoria (estrutura, ferragem, furação)
export default function FiltroCategoria({ valor, onChange, contagens }: FiltroCategoriaProps) {
  const total = contagens.estrutura + contagens.ferragem + contagens.furacao;

  return (
    <div className={styles.filtro} role="group" aria-label="Filtrar por categoria">
      {OPCOES.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={styles.opcao}
          aria-pressed={valor === opcao}
          onClick={() => onChange(opcao)}
        >
          {opcao === 'todas' ? 'Todos' : NOME_CATEGORIA[opcao]}
          <span className={styles.contagem}>{opcao === 'todas' ? total : contagens[opcao]}</span>
        </button>
      ))}
    </div>
  );
}
