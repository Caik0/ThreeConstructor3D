import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './BotaoIcone.module.css';

interface BotaoIconeProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  icone: ReactNode;
  /** Vira aria-label e title: esses botões só têm o ícone, sem texto visível */
  rotulo: string;
}

// Botão quadrado só com ícone (renomear, excluir, etc.), usado nas listas de cards
export default function BotaoIcone({ icone, rotulo, className, ...props }: BotaoIconeProps) {
  return (
    <button
      type="button"
      className={[styles.botao, className].filter(Boolean).join(' ')}
      aria-label={rotulo}
      title={rotulo}
      {...props}
    >
      {icone}
    </button>
  );
}
