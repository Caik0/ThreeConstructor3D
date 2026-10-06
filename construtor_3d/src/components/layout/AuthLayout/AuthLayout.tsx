import { Outlet } from 'react-router-dom';
import AlternadorTema from '../../ui/AlternadorTema/AlternadorTema';
import styles from './AuthLayout.module.css';

export default function AuthLayout() {
  return (
    <div className={styles.wrapper}>
      <AlternadorTema className={styles.alternadorTema} />
      <Outlet />
    </div>
  );
}
