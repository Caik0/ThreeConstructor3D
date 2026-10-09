import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute/ProtectedRoute';
import RotaAdmin from '../components/layout/RotaAdmin/RotaAdmin';

// Layouts
import PublicLayout from '../components/layout/PublicLayout/PublicLayout';
import AuthLayout from '../components/layout/AuthLayout/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout/DashboardLayout';

// Páginas
import Home from '../pages/public/Home/Home';
import Sobre from '../pages/public/Sobre/Sobre';
import Servicos from '../pages/public/Servicos/Servicos';
import Status from '../pages/public/Status/Status';
import ProjetosList from '../pages/public/Projetos/ProjetosList';
import NovoProjeto from '../pages/public/Projetos/NovoProjeto';
import ModulosList from '../pages/public/Modulos/ModulosList';

// Editor
import ProjetoEditor from '../pages/editor/ProjetoEditor/ProjetoEditor';
import ModuloEditor from '../pages/editor/ProjetoEditor/ModuloEditor';

// Auth
import Login from '../pages/auth/Login/Login';
import Cadastro from '../pages/auth/Cadastro/Cadastro';

// Dashboard
import OrcamentosList from '../pages/dashboard/Orcamentos/OrcamentosList';
import NovoOrcamento from '../pages/dashboard/Orcamentos/NovoOrcamento';
import OrcamentoDetalhe from '../pages/dashboard/Orcamentos/OrcamentoDetalhe';
import Perfil from '../pages/dashboard/Perfil/Perfil';
import AdminUsuarios from '../pages/dashboard/Admin/AdminUsuarios';

export const router = createBrowserRouter([
  // Todo o sistema pede login: só /login e /cadastro (AuthLayout, mais abaixo) ficam de fora
  {
    element: (
      <ProtectedRoute>
        <PublicLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <Home /> },
      { path: '/sobre', element: <Sobre /> },
      { path: '/servicos', element: <Servicos /> },
      { path: '/status', element: <Status /> },
      { path: '/projetos', element: <ProjetosList /> },
      { path: '/projetos/novo', element: <NovoProjeto /> },
      { path: '/modulos', element: <ModulosList /> },
    ],
  },
  // Tela cheia, fora do PublicLayout — mesma exigência de login
  {
    path: '/projetos/:id',
    element: (
      <ProtectedRoute>
        <ProjetoEditor />
      </ProtectedRoute>
    ),
  },
  {
    path: '/modulos/:id',
    element: (
      <ProtectedRoute>
        <ModuloEditor />
      </ProtectedRoute>
    ),
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/cadastro', element: <Cadastro /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/orcamentos', element: <OrcamentosList /> },
      { path: '/orcamentos/novo', element: <NovoOrcamento /> },
      { path: '/orcamentos/:id', element: <OrcamentoDetalhe /> },
      { path: '/perfil', element: <Perfil /> },
      {
        path: '/admin/usuarios',
        element: (
          <RotaAdmin>
            <AdminUsuarios />
          </RotaAdmin>
        ),
      },
    ],
  },
]);
