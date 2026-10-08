import type { ReactNode } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { PERMISSAO_DA_FERRAMENTA, useEditorStore, type Ferramenta } from '../../../store/editorStore';
import { temPermissao } from '../../../lib/permissoes/permissoes';
import styles from './ProjetoEditor.module.css';

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

const FERRAMENTAS: { id: Ferramenta; rotulo: string; atalho: string; icone: ReactNode }[] = [
  {
    id: 'selecionar',
    rotulo: 'Selecionar',
    atalho: 'V',
    icone: (
      <svg {...iconProps}>
        <path d="M4 3l7 17 2.5-7.5L21 10z" />
      </svg>
    ),
  },
  {
    id: 'mover',
    rotulo: 'Mover',
    atalho: 'M',
    icone: (
      <svg {...iconProps}>
        <path d="M12 2v20M2 12h20" />
        <path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
      </svg>
    ),
  },
  {
    id: 'girar',
    rotulo: 'Girar',
    atalho: 'Q',
    icone: (
      <svg {...iconProps}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
    ),
  },
  {
    id: 'parede',
    rotulo: 'Parede',
    atalho: 'P',
    icone: (
      <svg {...iconProps}>
        <path d="M3 5h18M3 19h18M3 5v14M21 5v14M12 5v6M7 11v8M17 11v8" />
      </svg>
    ),
  },
  {
    id: 'trena',
    rotulo: 'Trena',
    atalho: 'T',
    icone: (
      <svg {...iconProps}>
        <circle cx="6" cy="18" r="3" />
        <path d="M8.1 15.9 19 5m-6 2 2 2m-6 2 2 2" />
      </svg>
    ),
  },
  {
    id: 'pintura',
    rotulo: 'Pintar',
    atalho: 'B',
    icone: (
      <svg {...iconProps}>
        <path d="M8 8a4 4 0 0 1 8 0" />
        <path d="M5 8h14l-1.6 9.7a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8Z" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
];

export default function BarraFerramentas() {
  const ferramenta = useEditorStore((s) => s.ferramenta);
  const definirFerramenta = useEditorStore((s) => s.definirFerramenta);
  const usuario = useAuthStore((s) => s.usuario);
  const ferramentasPermitidas = FERRAMENTAS.filter((f) => {
    const chave = PERMISSAO_DA_FERRAMENTA[f.id];
    return !chave || temPermissao(usuario, chave);
  });

  return (
    <div
      role="group"
      aria-label="Ferramentas"
      className={`${styles.grupoFerramentas} ${styles.ferramentasPrincipais}`}
    >
      {ferramentasPermitidas.map((f) => (
        <button
          key={f.id}
          type="button"
          className={styles.ferramenta}
          aria-pressed={ferramenta === f.id}
          aria-label={f.rotulo}
          aria-keyshortcuts={f.atalho}
          title={`${f.rotulo} (${f.atalho})`}
          onClick={() => definirFerramenta(f.id)}
        >
          {f.icone}
        </button>
      ))}
    </div>
  );
}
