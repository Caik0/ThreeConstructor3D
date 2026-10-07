import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useCadastrar } from '../../../lib/hooks/useAuth';
import { NOME_COMPRIMENTO_MAXIMO, SENHA_COMPRIMENTO_MINIMO, type CadastroDados } from '../../../lib/auth/auth';
import styles from '../Auth.module.css';

export default function Cadastro() {
  const navigate = useNavigate();
  const cadastrar = useCadastrar();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroDados>({ mode: 'onTouched', defaultValues: { nome: '', email: '', senha: '' } });

  const enviar = handleSubmit((dados) => {
    cadastrar.mutate(
      { ...dados, nome: dados.nome.trim(), email: dados.email.trim() },
      { onSuccess: () => navigate('/projetos', { replace: true }) },
    );
  });

  return (
    <form className={styles.painel} noValidate onSubmit={enviar}>
      <h1 className={styles.titulo}>Criar conta</h1>

      <div className={styles.campos}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            autoComplete="name"
            className={styles.input}
            aria-invalid={Boolean(errors.nome)}
            {...register('nome', {
              validate: (valor) => valor.trim() !== '' || 'Informe o seu nome',
              maxLength: { value: NOME_COMPRIMENTO_MAXIMO, message: `Use no máximo ${NOME_COMPRIMENTO_MAXIMO} caracteres` },
            })}
          />
          {errors.nome && (
            <span className={styles.erro} role="alert">
              {errors.nome.message}
            </span>
          )}
        </label>

        <label className={styles.campo}>
          <span className={styles.rotulo}>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            className={styles.input}
            aria-invalid={Boolean(errors.email)}
            {...register('email', { required: 'Informe o e-mail' })}
          />
          {errors.email && (
            <span className={styles.erro} role="alert">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className={styles.campo}>
          <span className={styles.rotulo}>Senha</span>
          <input
            type="password"
            autoComplete="new-password"
            className={styles.input}
            aria-invalid={Boolean(errors.senha)}
            {...register('senha', {
              required: 'Crie uma senha',
              minLength: { value: SENHA_COMPRIMENTO_MINIMO, message: `Use pelo menos ${SENHA_COMPRIMENTO_MINIMO} caracteres` },
            })}
          />
          {errors.senha && (
            <span className={styles.erro} role="alert">
              {errors.senha.message}
            </span>
          )}
        </label>
      </div>

      {cadastrar.isError && (
        <p className={styles.erroEnvio} role="alert">
          {cadastrar.error.message}
        </p>
      )}

      <button type="submit" className={styles.botaoPrimario} disabled={cadastrar.isPending}>
        {cadastrar.isPending ? 'Criando conta…' : 'Criar conta'}
      </button>

      <p className={styles.rodape}>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </form>
  );
}
