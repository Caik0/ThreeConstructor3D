import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

// <select> com o visual dos campos do sistema (mesmo da busca): filtros de lista e campos de formulário
export default function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.select, className].filter(Boolean).join(' ')} {...props} />;
}
