import { useEffect, useRef } from 'react';
import { useImportacaoAutomatica } from '../../../lib/hooks/useImportacaoAutomatica';
import { useModulos } from '../../../lib/hooks/useModulos';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import { descreverElementoModulo, type ElementoModulo } from '../../../lib/projetos/projetos';
import ModuloMiniatura from '../../../components/three/ModuloMiniatura/ModuloMiniatura';
import dialogoStyles from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao.module.css';
import styles from './ProjetoEditor.module.css';

interface ImportarModuloDialogProps {
  aberto: boolean;
  onEscolher: (elemento: ElementoModulo) => void;
  onFechar: () => void;
}

// Lista os módulos salvos (peças e grupos guardados à parte, prontos pra importar); ao contrário
// do DialogoConfirmacao, a ação aqui é escolher um item da lista, não confirmar/cancelar um texto
export default function ImportarModuloDialog({ aberto, onEscolher, onFechar }: ImportarModuloDialogProps) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const consulta = useModulos();
  const podeGerenciarModulo = useTemPermissao(PERMISSOES.MODULOS_GERENCIAR);
  // Ao abrir, importa sozinho qualquer .glb solto na pasta do servidor (ver
  // Services/ImportacaoPendente), pra já aparecer na lista sem precisar passar pela tela de módulos
  // — só tenta se o usuário pode mesmo salvar módulo novo, senão a API rejeitaria (ver
  // ModulosController.Criar)
  const importandoAutomaticamente = useImportacaoAutomatica(aberto && podeGerenciarModulo);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={dialogoRef}
      className={dialogoStyles.dialogo}
      aria-label="Importar módulo"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className={dialogoStyles.conteudo}>
        <h2 className={dialogoStyles.titulo}>Importar módulo</h2>

        {importandoAutomaticamente && <p role="status">Importando módulos novos encontrados na pasta do servidor…</p>}

        {consulta.isPending ? (
          <p>Carregando módulos…</p>
        ) : consulta.isError ? (
          <p role="alert" className={dialogoStyles.erro}>
            Não foi possível carregar os módulos: {consulta.error.message}
          </p>
        ) : consulta.data.length === 0 ? (
          <p>
            Nenhum módulo salvo ainda. Selecione uma peça ou grupo na estrutura e use “Salvar como
            módulo” para reaproveitá-lo aqui ou em outro projeto depois.
          </p>
        ) : (
          <ul className={styles.listaModulos}>
            {consulta.data.map((modulo) => (
              <li key={modulo.id}>
                <button
                  type="button"
                  className={styles.itemModulo}
                  onClick={() => onEscolher(modulo.elemento)}
                >
                  <span className={styles.miniaturaModulo}>
                    <ModuloMiniatura elemento={modulo.elemento} />
                  </span>
                  <span className={styles.textoModulo}>
                    <span className={styles.nomeModulo}>{modulo.nome}</span>
                    <span className={styles.noMedidas}>{descreverElementoModulo(modulo.elemento)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={dialogoStyles.acoes}>
          <button type="button" className={dialogoStyles.cancelar} onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
