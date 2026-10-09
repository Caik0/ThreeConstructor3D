import { useFormContext } from 'react-hook-form';
import type { NovoProjetoDados } from '../../../../lib/projetos/projetos';
import styles from '../NovoProjeto.module.css';

export default function EtapaInformacoes() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NovoProjetoDados>();

  return (
    <div className={styles.campos}>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Nome do projeto</span>
        <input
          className={styles.input}
          placeholder="Ex.: Cozinha apartamento 302"
          aria-invalid={Boolean(errors.nome)}
          {...register('nome', {
            validate: (valor) => valor.trim() !== '' || 'Informe o nome do projeto',
            maxLength: { value: 100, message: 'Use no máximo 100 caracteres' },
          })}
        />
        {errors.nome && (
          <span className={styles.erro} role="alert">
            {errors.nome.message}
          </span>
        )}
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>
          Descrição <em>(opcional)</em>
        </span>
        <textarea
          className={styles.input}
          rows={4}
          placeholder="Cliente, ambiente, observações…"
          aria-invalid={Boolean(errors.descricao)}
          {...register('descricao', {
            maxLength: { value: 500, message: 'Use no máximo 500 caracteres' },
          })}
        />
        {errors.descricao && (
          <span className={styles.erro} role="alert">
            {errors.descricao.message}
          </span>
        )}
      </label>
    </div>
  );
}
