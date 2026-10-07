import { useAuthStore } from '../../../store/authStore';
import { useUsuarioAtual } from '../../../lib/hooks/useAuth';
import styles from './Perfil.module.css';

export default function Perfil() {
  // Mostra logo o que já está salvo (sem esperar a rede) e deixa a consulta só confirmar/atualizar
  const usuarioSalvo = useAuthStore((s) => s.usuario);
  const { data: usuario } = useUsuarioAtual();
  const atual = usuario ?? usuarioSalvo;

  return (
    <section className={styles.painel}>
      <h1 className={styles.titulo}>Meu perfil</h1>

      {atual && (
        <dl className={styles.dados}>
          <div className={styles.linha}>
            <dt>Nome</dt>
            <dd>{atual.nome}</dd>
          </div>
          <div className={styles.linha}>
            <dt>E-mail</dt>
            <dd>{atual.email}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
