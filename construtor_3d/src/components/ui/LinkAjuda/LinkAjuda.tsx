import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './LinkAjuda.module.css';

interface LinkAjudaProps {
  /** Âncora da seção da ajuda a abrir (ver SECOES em pages/public/Ajuda/conteudo.ts), ex.: "atalhos" */
  secao?: string;
  /**
   * Roda antes de sair da tela (o editor salva aqui) e diz se pode seguir: `false` mantém a pessoa
   * onde está — por exemplo, quando o salvamento falhou e ela perderia o trabalho
   */
  antesDeAbrir?: () => Promise<boolean>;
}

// Botão "?" que abre a página de ajuda NA MESMA ABA e deixa gravado de onde a pessoa veio, pra o
// "Voltar" da ajuda trazê-la de volta ao projeto/módulo (e não à página inicial). No editor, o
// trabalho é salvo antes de sair (`antesDeAbrir`)
export default function LinkAjuda({ secao, antesDeAbrir }: LinkAjudaProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [abrindo, setAbrindo] = useState(false);

  async function abrir() {
    if (abrindo) return;
    setAbrindo(true);
    try {
      if (antesDeAbrir && !(await antesDeAbrir())) return;
      navigate({ pathname: '/ajuda', hash: secao ? `#${secao}` : '' }, { state: { voltarPara: pathname } });
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.botao}
      disabled={abrindo}
      onClick={abrir}
      aria-label="Ajuda e atalhos"
      title={antesDeAbrir ? 'Ajuda e atalhos (salva antes de abrir)' : 'Ajuda e atalhos'}
    >
      ?
    </button>
  );
}
