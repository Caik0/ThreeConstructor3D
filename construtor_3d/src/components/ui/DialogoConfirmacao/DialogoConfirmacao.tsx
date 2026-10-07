import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './DialogoConfirmacao.module.css';

interface DialogoConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** Explica o que vai acontecer */
  children: ReactNode;
  textoConfirmar: string;
  /** Texto do botão enquanto a ação está em andamento */
  textoConfirmando: string;
  confirmando?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

// Janela modal de confirmação para ações que não têm volta. Usa <dialog>, que já prende o foco
// dentro da janela e fecha com Esc; "Cancelar" recebe o foco, para Enter não confirmar por engano
export default function DialogoConfirmacao({
  aberto,
  titulo,
  children,
  textoConfirmar,
  textoConfirmando,
  confirmando = false,
  erro,
  onConfirmar,
  onCancelar,
}: DialogoConfirmacaoProps) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={dialogoRef}
      className={styles.dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idDescricao}
      // Esc: o estado de quem abriu decide se fecha (não fecha durante a ação)
      onCancel={(e) => {
        e.preventDefault();
        if (!confirmando) onCancelar();
      }}
      // Clique no fundo escurecido (fora do conteúdo) cancela
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirmando) onCancelar();
      }}
    >
      <div className={styles.conteudo}>
        <h2 id={idTitulo} className={styles.titulo}>
          {titulo}
        </h2>
        <div id={idDescricao} className={styles.descricao}>
          {children}
        </div>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <div className={styles.acoes}>
          <button type="button" className={styles.cancelar} onClick={onCancelar} disabled={confirmando} autoFocus>
            Cancelar
          </button>
          <button type="button" className={styles.confirmar} onClick={onConfirmar} disabled={confirmando}>
            {confirmando ? textoConfirmando : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
}
