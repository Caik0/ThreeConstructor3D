import { NavLink, Outlet } from 'react-router-dom';
import AlternadorTema from '../../ui/AlternadorTema/AlternadorTema';
import { useAuthStore } from '../../../store/authStore';
import styles from './DashboardLayout.module.css';

const LINKS = [
  { to: '/projetos', rotulo: 'Meus projetos' },
  { to: '/orcamentos', rotulo: 'Orçamentos' },
  { to: '/perfil', rotulo: 'Meu perfil' },
];

export default function DashboardLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const links = usuario?.admin ? [...LINKS, { to: '/admin/usuarios', rotulo: 'Usuários' }] : LINKS;

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTopo}>
          <AlternadorTema />
        </div>

        <nav className={styles.nav}>
          {links.map(({ to, rotulo }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? styles.linkAtivo : styles.link)}
            >
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarRodape}>
          {usuario && <span className={styles.nomeUsuario}>{usuario.nome}</span>}
          <button type="button" className={styles.sair} onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
