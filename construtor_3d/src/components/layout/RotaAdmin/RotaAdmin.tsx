import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

interface RotaAdminProps {
  children: React.ReactNode;
}

// Vem sempre depois de ProtectedRoute (então já há sessão); aqui só falta checar que é admin.
// O backend tem a mesma checagem em UsuariosController — esconder a tela não é a única defesa
export default function RotaAdmin({ children }: RotaAdminProps) {
  const usuario = useAuthStore((state) => state.usuario);

  if (!usuario?.admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
