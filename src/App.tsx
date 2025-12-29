import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { ProveedoresPage } from './features/proveedores/ProveedoresPage';
import { InventariosPage } from './features/inventarios/InventariosPage';
import { SolicitudesPage } from './features/solicitudes/SolicitudesPage';
import { PropuestasPage } from './features/propuestas/PropuestasPage';
import { CompartirPropuestaPage } from './features/propuestas/CompartirPropuestaPage';
import { ClientePropuestaPage } from './features/propuestas/ClientePropuestaPage';
import { CampanasPage } from './features/campanas/CampanasPage';
import { CampanaDetailPage } from './features/campanas/CampanaDetailPage';
import { TareaSeguimientoPage } from './features/campanas/TareaSeguimientoPage';
import { NotificacionesPage } from './features/notificaciones/NotificacionesPage';
import { CorreosPage } from './features/correos/CorreosPage';
import { PerfilPage } from './features/perfil/PerfilPage';

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  }, 
}); 
 
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/proveedores" element={<ProveedoresPage />} />
            <Route path="/inventarios" element={<InventariosPage />} />
            <Route path="/solicitudes" element={<SolicitudesPage />} />
            <Route path="/propuestas" element={<PropuestasPage />} />
            <Route path="/propuestas/compartir/:id" element={<CompartirPropuestaPage />} />
            <Route path="/campanas" element={<CampanasPage />} />
            <Route path="/campanas/detail/:id" element={<CampanaDetailPage />} />
            <Route path="/campanas/:id/tareas" element={<TareaSeguimientoPage />} />
            <Route path="/notificaciones" element={<NotificacionesPage />} />
            <Route path="/correos" element={<CorreosPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
          </Route>

          {/* Public route for clients - no auth required */}
          <Route path="/cliente/propuesta/:id" element={<ClientePropuestaPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
