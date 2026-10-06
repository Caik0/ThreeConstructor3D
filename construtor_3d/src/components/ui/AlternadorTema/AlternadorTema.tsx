import { useTema } from '../../../lib/hooks/useTema';
import styles from './AlternadorTema.module.css';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function IconeSol() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg {...iconProps}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

interface AlternadorTemaProps {
  className?: string;
}

// Botão que alterna entre os temas claro e escuro; o ícone mostra o tema para o qual ele muda
export default function AlternadorTema({ className }: AlternadorTemaProps) {
  const { tema, alternar } = useTema();
  const proximo = tema === 'claro' ? 'escuro' : 'claro';

  return (
    <button
      type="button"
      className={className ? `${styles.botao} ${className}` : styles.botao}
      onClick={alternar}
      aria-label={`Mudar para o tema ${proximo}`}
      title={`Mudar para o tema ${proximo}`}
    >
      {tema === 'claro' ? <IconeLua /> : <IconeSol />}
    </button>
  );
}
