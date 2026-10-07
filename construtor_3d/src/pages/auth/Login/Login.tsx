import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useLogin } from '../../../lib/hooks/useAuth';
import type { LoginDados } from '../../../lib/auth/auth';
import styles from '../Auth.module.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as Location<{ de?: Location } | undefined>;
  const entrar = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDados>({ mode: 'onTouched', defaultValues: { email: '', senha: '' } });

  const enviar = handleSubmit((dados) => {
    entrar.mutate(dados, {
      // Volta pra onde o usuário tentou ir antes do ProtectedRoute mandar pro login; sem isso, vai
      // pra lista de projetos, o principal destino protegido
      onSuccess: () => navigate(location.state?.de?.pathname ?? '/projetos', { replace: true }),
    });
  });

  return (
    <form className={styles.painel} noValidate onSubmit={enviar}>
      <h1 className={styles.titulo}>Entrar</h1>

      <div className={styles.campos}>
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
            autoComplete="current-password"
            className={styles.input}
            aria-invalid={Boolean(errors.senha)}
            {...register('senha', { required: 'Informe a senha' })}
          />
          {errors.senha && (
            <span className={styles.erro} role="alert">
              {errors.senha.message}
            </span>
          )}
        </label>
      </div>

      {entrar.isError && (
        <p className={styles.erroEnvio} role="alert">
          {entrar.error.message}
        </p>
      )}

      <button type="submit" className={styles.botaoPrimario} disabled={entrar.isPending}>
        {entrar.isPending ? 'Entrando…' : 'Entrar'}
      </button>

      <p className={styles.rodape}>
        Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
      </p>
    </form>
  );
}
