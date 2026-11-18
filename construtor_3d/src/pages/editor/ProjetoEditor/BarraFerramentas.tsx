import { useEffect, useState } from 'react';
import { nomeDaTecla } from '../../../lib/configuracoes/configuracoes';
import { useConfiguracoesStore } from '../../../store/configuracoesStore';
import { useGradeStore } from '../../../store/gradeStore';
import { useAuthStore } from '../../../store/authStore';
import { PERMISSAO_DA_FERRAMENTA, selecaoCompleta, useEditorStore } from '../../../store/editorStore';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES, temPermissao } from '../../../lib/permissoes/permissoes';
import { FERRAMENTAS } from './ferramentas';
import styles from './ProjetoEditor.module.css';

export default function BarraFerramentas() {
  const ferramenta = useEditorStore((s) => s.ferramenta);
  const definirFerramenta = useEditorStore((s) => s.definirFerramenta);
  const usuario = useAuthStore((s) => s.usuario);
  // Teclas de atalho que o usuário escolheu (Configurações)
  const atalhos = useConfiguracoesStore((s) => s.configuracoes.atalhos);
  const ferramentasPermitidas = FERRAMENTAS.filter((f) => {
    const chave = PERMISSAO_DA_FERRAMENTA[f.id];
    return !chave || temPermissao(usuario, chave);
  });

  const gradeVisivel = useGradeStore((s) => s.visivel);
  const alternarGrade = useGradeStore((s) => s.alternar);

  // Colisão do que está selecionado: aparece só com seleção (vãos não têm colisão) e vale pra todos
  // os selecionados; "ativa" quando todos têm
  const podeEditarColisao = useTemPermissao(PERMISSOES.ELEMENTO_EDITAR_NOME_COLISAO);
  const elementos = useEditorStore((s) => s.elementos);
  const selecionada = useEditorStore((s) => s.selecionada);
  const selecionadasExtra = useEditorStore((s) => s.selecionadasExtra);
  const atualizar = useEditorStore((s) => s.atualizar);
  const alvos = selecaoCompleta({ selecionada, selecionadasExtra }).filter(
    (chave) => elementos[chave] && elementos[chave].tipo !== 'abertura',
  );
  // Shift segurado com a ferramenta Mover: o viewport ignora a colisão enquanto durar; o botão
  // aparece desativado pra mostrar isso (o valor guardado no elemento não muda)
  const [shift, setShift] = useState(false);
  useEffect(() => {
    const atualizar = (e: KeyboardEvent | PointerEvent) => setShift(e.shiftKey);
    const soltar = () => setShift(false);
    window.addEventListener('keydown', atualizar);
    window.addEventListener('keyup', atualizar);
    window.addEventListener('pointermove', atualizar, true);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', atualizar);
      window.removeEventListener('keyup', atualizar);
      window.removeEventListener('pointermove', atualizar, true);
      window.removeEventListener('blur', soltar);
    };
  }, []);
  const suspensa = shift && ferramenta === 'mover';
  const colisaoDosAlvos = alvos.length > 0 && alvos.every((chave) => elementos[chave].colisao);
  const colisaoAtiva = colisaoDosAlvos && !suspensa;
  const rotuloColisao = colisaoDosAlvos ? 'Desativar colisão do selecionado' : 'Ativar colisão do selecionado';

  return (
    <div
      role="group"
      aria-label="Ferramentas"
      className={`${styles.grupoFerramentas} ${styles.ferramentasPrincipais}`}
    >
      {ferramentasPermitidas.map((f) => (
        <button
          key={f.id}
          type="button"
          className={styles.ferramenta}
          aria-pressed={ferramenta === f.id}
          aria-label={f.rotulo}
          aria-keyshortcuts={atalhos[f.id] ? nomeDaTecla(atalhos[f.id]) : undefined}
          title={atalhos[f.id] ? `${f.rotulo} (${nomeDaTecla(atalhos[f.id])})` : f.rotulo}
          onClick={() => definirFerramenta(f.id)}
        >
          {f.icone}
        </button>
      ))}
      <button
        type="button"
        className={styles.ferramenta}
        aria-pressed={gradeVisivel}
        aria-label={gradeVisivel ? 'Ocultar grade do ambiente' : 'Mostrar grade do ambiente'}
        title={gradeVisivel ? 'Ocultar grade do ambiente' : 'Mostrar grade do ambiente'}
        onClick={alternarGrade}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" strokeDasharray={gradeVisivel ? undefined : '2 2'} />
        </svg>
      </button>
      {podeEditarColisao && alvos.length > 0 && (
        <button
          type="button"
          className={styles.ferramenta}
          aria-pressed={colisaoAtiva}
          aria-label={rotuloColisao}
          title={`${rotuloColisao}. Bloqueia o movimento contra outro elemento que também tenha a colisão ativada.`}
          onClick={() => alvos.forEach((chave) => atualizar(chave, { colisao: !colisaoDosAlvos }))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="9" width="8" height="8" rx="1" />
            <rect x="13" y="9" width="8" height="8" rx="1" strokeDasharray={colisaoAtiva ? undefined : '2 2'} />
            {colisaoAtiva && <path d="M12 3v3M8.5 4.5l1.5 2M15.5 4.5l-1.5 2" />}
          </svg>
        </button>
      )}
    </div>
  );
}
