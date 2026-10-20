import styles from './CampoBusca.module.css';

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Também é o rótulo acessível do campo */
  placeholder: string;
  className?: string;
}

// Barra de pesquisa das listas; o "x" de limpar vem do próprio type="search" do navegador
export default function CampoBusca({ valor, onChange, placeholder, className }: CampoBuscaProps) {
  return (
    <input
      type="search"
      className={`${styles.busca} ${className ?? ''}`}
      value={valor}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
