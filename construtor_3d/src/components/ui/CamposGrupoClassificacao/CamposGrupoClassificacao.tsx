import Select from '../Select/Select';
import type { EscolhaGrupoEClassificacao } from '../../../lib/hooks/useCadastros';
import styles from './CamposGrupoClassificacao.module.css';

/** Os dois seletores obrigatórios de um módulo: grupo e classificação.
 * Quem usa só cria a escolha com `useEscolhaGrupoEClassificacao` e a passa aqui */
export default function CamposGrupoClassificacao({ escolha }: { escolha: EscolhaGrupoEClassificacao }) {
  const { grupos, classificacoes, grupoId, classificacaoId, setGrupoId, setClassificacaoId } = escolha;

  return (
    <div className={styles.campos}>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Grupo</span>
        <Select value={grupoId ?? ''} disabled={grupos.isPending} onChange={(e) => setGrupoId(Number(e.target.value))}>
          {grupos.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </Select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Classificação</span>
        <Select value={classificacaoId ?? ''} disabled={classificacoes.isPending} onChange={(e) => setClassificacaoId(Number(e.target.value))}>
          {classificacoes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </label>
      {(grupos.isError || classificacoes.isError) && (
        <p role="alert" className={styles.erro}>
          Não foi possível carregar os grupos e as classificações.
        </p>
      )}
    </div>
  );
}
