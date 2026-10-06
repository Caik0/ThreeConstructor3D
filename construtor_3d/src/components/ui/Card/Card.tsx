import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Card.module.css';

interface CardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Área de destaque no topo do card (ex.: uma miniatura), sangrando até a borda */
  media?: ReactNode;
  variant?: 'default' | 'accent';
  /** Etiqueta curta abaixo do título (ex.: "Rápido e Flexível") */
  badge?: string;
  /** Destaque no canto superior direito (ex.: "Recomendado") */
  tag?: string;
  /** Card de escolha: mostra o indicador de seleção; use junto com onClick */
  selected?: boolean;
  /** Rota de destino: o card vira um link */
  to?: string;
  /** Ação ao clicar: o card vira um botão */
  onClick?: () => void;
  /** Conteúdo extra; em cards clicáveis use apenas conteúdo inline (sem botões/links) */
  children?: ReactNode;
}

export default function Card({
  title,
  description,
  icon,
  media,
  variant = 'default',
  badge,
  tag,
  selected,
  to,
  onClick,
  children,
}: CardProps) {
  const interactive = Boolean(to || onClick);
  const selectable = selected !== undefined;
  const className = [
    styles.card,
    styles[variant],
    interactive && styles.interactive,
    selected && styles.selected,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {media && <div className={styles.media}>{media}</div>}
      {tag && <span className={styles.tag}>{tag}</span>}
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.title}>
        {selectable && <span className={styles.radio} aria-hidden="true" />}
        {title}
      </span>
      {badge && <span className={styles.badge}>{badge}</span>}
      {description && <span className={styles.description}>{description}</span>}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={selectable ? selected : undefined}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
