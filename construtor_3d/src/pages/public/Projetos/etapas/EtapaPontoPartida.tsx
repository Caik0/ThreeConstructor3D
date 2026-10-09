import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import Card from '../../../../components/ui/Card/Card';
import {
  PONTOS_PARTIDA,
  type NovoProjetoDados,
  type PontoPartida,
} from '../../../../lib/projetos/projetos';
import styles from '../NovoProjeto.module.css';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ICONES: Record<PontoPartida, ReactNode> = {
  modulos: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  completo: (
    <svg {...iconProps}>
      <path d="M12 3 2 8l10 5 10-5z" />
      <path d="m2 13 10 5 10-5" />
    </svg>
  ),
  avulsas: (
    <svg {...iconProps}>
      <rect x="4" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="3" width="4" height="18" rx="1" />
      <rect x="16" y="3" width="4" height="18" rx="1" />
    </svg>
  ),
  avancada: (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
};

export default function EtapaPontoPartida() {
  const { control, setValue } = useFormContext<NovoProjetoDados>();
  const selecionado = useWatch({ control, name: 'pontoPartida' });

  return (
    <div className={styles.opcoes}>
      {PONTOS_PARTIDA.map((ponto) => (
        <Card
          key={ponto.id}
          icon={ICONES[ponto.id]}
          title={ponto.titulo}
          badge={ponto.badge}
          description={ponto.descricao}
          tag={ponto.recomendado ? 'Recomendado' : undefined}
          selected={selecionado === ponto.id}
          onClick={() => setValue('pontoPartida', ponto.id, { shouldDirty: true })}
        />
      ))}
    </div>
  );
}
