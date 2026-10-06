import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  // Leva pra onde o usuário tentou ir antes de cair aqui: Login lê isso pra voltar depois de
  // entrar, em vez de sempre mandar pro mesmo lugar
  if (!token) {
    return <Navigate to="/login" state={{ de: location }} replace />;
  }

  return <>{children}</>;
}
