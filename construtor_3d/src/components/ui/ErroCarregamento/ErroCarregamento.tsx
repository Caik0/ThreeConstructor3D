import styles from './ErroCarregamento.module.css';

interface ErroCarregamentoProps {
  /** Frase antes dos dois-pontos (ex.: "Não foi possível carregar os projetos") */
  mensagem: string;
  /** Texto do erro em si (ex.: error.message) */
  erro: string;
  onTentarDeNovo: () => void;
}

// Mensagem de erro de uma consulta com um botão pra tentar de novo, usada nas listas (projetos,
// módulos) que carregam dados do servidor ao abrir a página
export default function ErroCarregamento({ mensagem, erro, onTentarDeNovo }: ErroCarregamentoProps) {
  return (
    <p role="alert">
      {mensagem}: {erro}{' '}
      <button type="button" className={styles.tentarDeNovo} onClick={onTentarDeNovo}>
        Tentar de novo
      </button>
    </p>
  );
}
