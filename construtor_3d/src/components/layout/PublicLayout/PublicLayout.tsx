import { Link, Outlet } from 'react-router-dom';
import AlternadorTema from '../../ui/AlternadorTema/AlternadorTema';
import { useAuthStore } from '../../../store/authStore';
import styles from './PublicLayout.module.css';

// Todo o sistema pede login (ver router/routes.tsx: este layout só é alcançado dentro de um
// ProtectedRoute), então quem chega aqui sempre tem uma sessão — não precisa tratar o caso sem
// usuário, só o instante entre o logout e o redirecionamento pro login
export default function PublicLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        {usuario && (
          <nav className={styles.nav}>
            <Link to="/perfil" className={styles.linkConta}>
              {usuario.nome}
            </Link>
            <button type="button" className={styles.sair} onClick={logout}>
              Sair
            </button>
          </nav>
        )}
        <AlternadorTema />
      </header>
      <main>
        <Outlet />
      </main>
      <footer className={styles.footer}>{/* Footer aqui depois */}</footer>
    </div>
  );
}
