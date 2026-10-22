import { useState } from 'react';
import type { ResumoDaConversao } from '../../../lib/projetos/projetos';
import styles from './AvisoConversao.module.css';

interface Props {
  /** Nulo quando o que foi aberto já estava na convenção atual: nada a avisar */
  conversao: ResumoDaConversao | null | undefined;
  tipo: 'projeto' | 'módulo';
}

// Projetos e módulos salvos antes da mudança dos eixos (origem atrás-esquerda, Y pra frente) são
// convertidos ao abrir, mantendo o mesmo desenho. O banco só passa a ter a versão nova no próximo
// "Salvar" — o aviso diz isso, e quantas fórmulas de posição/rotação viraram valor fixo
export default function AvisoConversao({ conversao, tipo }: Props) {
  const [fechado, setFechado] = useState(false);
  if (!conversao || fechado) return null;

  const { formulasConvertidas } = conversao;
  return (
    <div className={styles.aviso} role="status">
      <p>
        Este {tipo} foi salvo com os eixos antigos (origem na frente) e foi convertido para os atuais (origem atrás à
        esquerda, Y cresce para a frente). O desenho é o mesmo.
        {formulasConvertidas > 0 &&
          ` ${formulasConvertidas} ${formulasConvertidas === 1 ? 'fórmula de posição ou rotação virou' : 'fórmulas de posição ou rotação viraram'} valor fixo.`}{' '}
        Salve para gravar a conversão.
      </p>
      <button type="button" onClick={() => setFechado(true)} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  );
}
