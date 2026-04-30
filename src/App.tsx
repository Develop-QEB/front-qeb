import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { useAuthStore } from './store/authStore';
import { getPermissions } from './lib/permissions';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientesPage = lazy(() => import('./features/clientes/ClientesPage').then(m => ({ default: m.ClientesPage })));
const ProveedoresPage = lazy(() => import('./features/proveedores/ProveedoresPage').then(m => ({ default: m.ProveedoresPage })));
const InventariosPage = lazy(() => import('./features/inventarios/InventariosPage').then(m => ({ default: m.InventariosPage })));
const SolicitudesPage = lazy(() => import('./features/solicitudes/SolicitudesPage').then(m => ({ default: m.SolicitudesPage })));
const PropuestasPage = lazy(() => import('./features/propuestas/PropuestasPage').then(m => ({ default: m.PropuestasPage })));
const CompartirPropuestaPage = lazy(() => import('./features/propuestas/CompartirPropuestaPage').then(m => ({ default: m.CompartirPropuestaPage })));
const ClientePropuestaPage = lazy(() => import('./features/propuestas/ClientePropuestaPage').then(m => ({ default: m.ClientePropuestaPage })));
const ClientePropuestaMapPage = lazy(() => import('./features/propuestas/ClientePropuestaMapPage').then(m => ({ default: m.ClientePropuestaMapPage })));
const CampanasPage = lazy(() => import('./features/campanas/CampanasPage').then(m => ({ default: m.CampanasPage })));
const CampanaDetailPage = lazy(() => import('./features/campanas/CampanaDetailPage').then(m => ({ default: m.CampanaDetailPage })));
const TareaSeguimientoPage = lazy(() => import('./features/campanas/TareaSeguimientoPage').then(m => ({ default: m.TareaSeguimientoPage })));
const NotificacionesPage = lazy(() => import('./features/notificaciones/NotificacionesPage').then(m => ({ default: m.NotificacionesPage })));
const CorreosPage = lazy(() => import('./features/correos/CorreosPage').then(m => ({ default: m.CorreosPage })));
const PerfilPage = lazy(() => import('./features/perfil/PerfilPage').then(m => ({ default: m.PerfilPage })));
const UsuariosAdminPage = lazy(() => import('./features/admin/UsuariosAdminPage').then(m => ({ default: m.UsuariosAdminPage })));
const ChatbotHistorialPage = lazy(() => import('./features/admin/ChatbotHistorialPage').then(m => ({ default: m.ChatbotHistorialPage })));
const DevTicketsPage = lazy(() => import('./features/tickets/DevTicketsPage').then(m => ({ default: m.DevTicketsPage })));
const TicketsPage = lazy(() => import('./features/tickets/TicketsPage').then(m => ({ default: m.TicketsPage })));
const HistorialTicketsPage = lazy(() => import('./features/tickets/HistorialTicketsPage').then(m => ({ default: m.HistorialTicketsPage })));
const RankingTicketsPage = lazy(() => import('./features/tickets/RankingTicketsPage').then(m => ({ default: m.RankingTicketsPage })));
const ReportesEspecialesPage = lazy(() => import('./features/reportes-especiales/ReportesEspecialesPage').then(m => ({ default: m.ReportesEspecialesPage })));
const HistorialAccionesPage = lazy(() => import('./features/historial/HistorialAccionesPage').then(m => ({ default: m.HistorialAccionesPage })));

// IDs de usuarios programadores con acceso a /dev/tickets
const DEV_USERS_IDS = [1057460, 1057462]; // Mario, Jos

const HISTORIAL_TICKETS_EMAILS = [
  'akary.lopez@datistic.mx',
  'bladimir@qeb.mx',
  'contacto@qeb.mx',
  'mario.salcido@deepia.dev',
];

// Obtener la primera ruta disponible según permisos del usuario
function getFirstAvailableRoute(permissions: ReturnType<typeof getPermissions>): string {
  if (permissions.canSeeDashboard) return '/';
  if (permissions.canSeeSolicitudes) return '/solicitudes';
  if (permissions.canSeePropuestas) return '/propuestas';
  if (permissions.canSeeCampanas) return '/campanas';
  if (permissions.canSeeClientes) return '/clientes';
  if (permissions.canSeeProveedores) return '/proveedores';
  if (permissions.canSeeInventarios) return '/inventarios';
  return '/solicitudes';
}

// Componente para la ruta principal - redirige según permisos
function HomeRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // Si puede ver Dashboard, mostrarlo
  if (permissions.canSeeDashboard) {
    return <DashboardPage />;
  }
  // Si no, redirigir a la primera ruta disponible
  return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
}

// Componente para proteger ruta de Inventarios
function InventariosRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  if (!user || !permissions.canSeeInventarios) {
    return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
  }
  return <InventariosPage />;
}

// Componente para proteger ruta de Admin (solo Administrador)
function AdminUsuariosRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  if (!user || !permissions.canSeeAdminUsuarios) {
    return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
  }
  return <UsuariosAdminPage />;
}

function AdminChatbotRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  if (!user || !permissions.canSeeAdminUsuarios) {
    return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
  }
  return <ChatbotHistorialPage />;
}

// Componente para proteger ruta de Gestión de Artes
function GestionArtesRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  if (!user || !permissions.canSeeGestionArtes) {
    return <Navigate to="/campanas" replace />;
  }
  return <TareaSeguimientoPage />;
}

// Componente para proteger ruta de Historial Tickets
function HistorialTicketsRoute() {
  const user = useAuthStore((state) => state.user);
  if (!user || !HISTORIAL_TICKETS_EMAILS.includes(user.email.toLowerCase())) {
    return <Navigate to="/" replace />;
  }
  return <HistorialTicketsPage />;
}

// Componente para proteger ruta de Rankings (solo rol DEV)
function RankingTicketsRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user || user.rol !== 'DEV') {
    return <Navigate to="/" replace />;
  }
  return <RankingTicketsPage />;
}

function ReportesEspecialesRoute() {
  const user = useAuthStore((state) => state.user);
  if (!user || (user.rol !== 'DEV' && user.rol !== 'Administrador')) {
    return <Navigate to="/" replace />;
  }
  return <ReportesEspecialesPage />;
}

function HistorialAccionesRoute() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);
  if (!user || !permissions.canSeeHistorialAcciones) {
    return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
  }
  return <HistorialAccionesPage />;
}

// Componente para proteger ruta de Dev Tickets (solo programadores)
function DevTicketsRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user || !DEV_USERS_IDS.includes(user.id)) {
    return <Navigate to="/" replace />;
  }
  return <DevTicketsPage />;
}
 
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Suspense fallback={null}><HomeRoute /></Suspense>} />
            <Route path="/clientes" element={<Suspense fallback={null}><ClientesPage /></Suspense>} />
            <Route path="/proveedores" element={<Suspense fallback={null}><ProveedoresPage /></Suspense>} />
            <Route path="/inventarios" element={<Suspense fallback={null}><InventariosRoute /></Suspense>} />
            <Route path="/inventarios/analisis/:analisisId" element={<Suspense fallback={null}><InventariosRoute /></Suspense>} />
            <Route path="/solicitudes" element={<Suspense fallback={null}><SolicitudesPage /></Suspense>} />
            <Route path="/propuestas" element={<Suspense fallback={null}><PropuestasPage /></Suspense>} />
            <Route path="/propuestas/compartir/:id" element={<Suspense fallback={null}><CompartirPropuestaPage /></Suspense>} />
            <Route path="/campanas" element={<Suspense fallback={null}><CampanasPage /></Suspense>} />
            <Route path="/campanas/detail/:id" element={<Suspense fallback={null}><CampanaDetailPage /></Suspense>} />
            <Route path="/campanas/:id/tareas" element={<Suspense fallback={null}><GestionArtesRoute /></Suspense>} />
            <Route path="/notificaciones" element={<Suspense fallback={null}><NotificacionesPage /></Suspense>} />
            <Route path="/correos" element={<Suspense fallback={null}><CorreosPage /></Suspense>} />
            <Route path="/perfil" element={<Suspense fallback={null}><PerfilPage /></Suspense>} />
            <Route path="/admin/usuarios" element={<Suspense fallback={null}><AdminUsuariosRoute /></Suspense>} />
            <Route path="/admin/chatbot" element={<Suspense fallback={null}><AdminChatbotRoute /></Suspense>} />
            <Route path="/tickets" element={<Suspense fallback={null}><TicketsPage /></Suspense>} />
            <Route path="/admin/tickets-historial" element={<Suspense fallback={null}><HistorialTicketsRoute /></Suspense>} />
            <Route path="/admin/tickets-ranking" element={<Suspense fallback={null}><RankingTicketsRoute /></Suspense>} />
            <Route path="/dev/tickets" element={<Suspense fallback={null}><DevTicketsRoute /></Suspense>} />
            <Route path="/reportes-especiales" element={<Suspense fallback={null}><ReportesEspecialesRoute /></Suspense>} />
            <Route path="/historial-acciones" element={<Suspense fallback={null}><HistorialAccionesRoute /></Suspense>} />
          </Route>

          {/* Public route for clients - no auth required */}
          <Route path="/cliente/propuesta/:id" element={<Suspense fallback={null}><ClientePropuestaPage /></Suspense>} />
          <Route path="/cliente/propuesta/:id/mapa" element={<Suspense fallback={null}><ClientePropuestaMapPage /></Suspense>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
