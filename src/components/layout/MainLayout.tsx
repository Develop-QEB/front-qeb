import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { cn } from '../../lib/utils';
import { LoadingScreen } from '../ui/LoadingScreen';
import { QEBooh } from '../ui/Qebsillo'; // Se abre desde el boton del header (sin burbuja flotante)
import { usePrefetch } from '../../hooks/usePrefetch';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { LightThemeNotificationModal } from './LightThemeNotificationModal';
import { UpdateNotificationModal } from './UpdateNotificationModal';
import { NotificacionToaster } from '../ui/NotificacionToaster';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const { prefetchAllAsync } = usePrefetch();
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    prefetchAllAsync().finally(() => {
      if (!cancelled) setDataReady(true);
    });
    return () => { cancelled = true; };
  }, [prefetchAllAsync]);

  // Cerrar drawer móvil al cambiar de ruta
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  const handleLoadingFinished = useCallback(() => {
    setInitialLoading(false);
  }, []);

  if (initialLoading) {
    return <LoadingScreen ready={dataReady} onFinished={handleLoadingFinished} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundAttachment: 'fixed',
        background: isDark
          ? 'linear-gradient(to bottom right, #0f0a18, #1a1025, #0f0a18)'
          : 'linear-gradient(to bottom right, #ffffff, rgb(250 245 255 / 0.5), rgb(243 232 255 / 0.3))',
      }}
    >
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Backdrop mobile: solo visible cuando el drawer está abierto en móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <main
        className={cn(
          'min-h-screen transition-all duration-300 ml-0',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        <Outlet />
      </main>

      {/* QEBooh: ventana de chat. Se abre/cierra desde el boton del header. */}
      <QEBooh />

      {/* Toasts de notificación in-app (sin depender del navegador) */}
      <NotificacionToaster />

      {user && user.light_theme_notified !== true && (
        <LightThemeNotificationModal />
      )}

      <UpdateNotificationModal />
    </div>
  );
}
