import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router/routes';
import SincronizadorSessao from './components/app/SincronizadorSessao';
import './styles/globals.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SincronizadorSessao />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;