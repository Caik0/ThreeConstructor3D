import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

// Como RotaAdmin, mas só para o dono da plataforma. O backend repete a checagem em
// EmpresasController — esconder a tela não é a única defesa
export default function RotaSuperAdmin({ children }: { children: React.ReactNode }) {
  const usuario = useAuthStore((state) => state.usuario);

  if (!usuario?.superAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
