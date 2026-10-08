import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import { useEditorStore, selecaoCompleta } from '../../../store/editorStore';
import styles from './ProjetoEditor.module.css';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// Um selo com um "★" pra sugerir um código só daquele módulo, único no projeto
function IconeIdUnico() {
  return (
    <svg {...iconProps}>
      <path d="M3 4h8l10 10-8 8L3 14z" />
      <circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Uma lista numerada (1, 2, 3…), pra sugerir a numeração de ordem entre os módulos
function IconeIdSequencial() {
  return (
    <svg {...iconProps}>
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 6h12" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 12h12" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 18h12" />
    </svg>
  );
}

// Botões de etiquetar módulo(s): aparecem só com uma peça/grupo selecionada (a seleção pode ter
// vários, com Ctrl/Cmd+Click). Ver ModuloViewport (etiqueta flutuante sobre a peça) e
// editorStore.gerarIdUnico/gerarIdSequencial
export default function AcoesModulos() {
  const selecionada = useEditorStore((s) => s.selecionada);
  const selecionadasExtra = useEditorStore((s) => s.selecionadasExtra);
  const elementos = useEditorStore((s) => s.elementos);
  const gerarIdUnico = useEditorStore((s) => s.gerarIdUnico);
  const gerarIdSequencial = useEditorStore((s) => s.gerarIdSequencial);
  const podeGerarId = useTemPermissao(PERMISSOES.MODULO_GERAR_ID);

  const chaves = selecaoCompleta({ selecionada, selecionadasExtra }).filter((chave) => {
    const tipo = elementos[chave]?.tipo;
    return tipo === 'peca' || tipo === 'grupo';
  });

  if (chaves.length === 0 || !podeGerarId) return null;

  const plural = chaves.length > 1;

  return (
    <>
      <span className={`${styles.divisor} ${styles.divisorFerramentas}`} aria-hidden="true" />
      <div role="group" aria-label="Etiqueta do módulo" className={styles.grupoFerramentas}>
        <button
          type="button"
          className={styles.ferramenta}
          aria-label={plural ? 'Gerar ID único para cada módulo selecionado' : 'Gerar ID único'}
          title={plural ? 'Gerar ID único para cada módulo selecionado' : 'Gerar ID único'}
          onClick={() => gerarIdUnico(chaves)}
        >
          <IconeIdUnico />
        </button>
        <button
          type="button"
          className={styles.ferramenta}
          aria-label={plural ? 'Gerar ID sequencial para cada módulo selecionado' : 'Gerar ID sequencial'}
          title={plural ? 'Gerar ID sequencial para cada módulo selecionado' : 'Gerar ID sequencial (M-1, M-2…)'}
          onClick={() => gerarIdSequencial(chaves)}
        >
          <IconeIdSequencial />
        </button>
      </div>
    </>
  );
}
