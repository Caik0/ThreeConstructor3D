import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './VoltarLink.module.css';

interface VoltarLinkProps {
  /** Rota de destino */
  to: string;
  /** Texto do link, sem a seta (ex.: "Projetos") */
  children: ReactNode;
  /** Ajustes de posicionamento específicos da página (ex.: margem, alinhamento) */
  className?: string;
}

// Link "← Voltar" usado no topo de páginas que navegam de volta pra uma lista (projetos, módulos)
export default function VoltarLink({ to, children, className }: VoltarLinkProps) {
  return (
    <Link to={to} className={[styles.voltar, className].filter(Boolean).join(' ')}>
      ← {children}
    </Link>
  );
}
