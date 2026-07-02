import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { cn } from '../../lib/utils';
import { LoadingScreen } from '../ui/LoadingScreen';
import { QEBooh } from '../ui/Qebsillo'; // Se abre desde el boton del header (sin burbuja flotante)
import { usePrefetch } from '../../hooks/usePrefetch';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
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
  useEffect(() => {
    let cancelled = false;
    prefetchAllAsync().finally(() => {
      if (!cancelled) setDataReady(true);
    });
    return () => { cancelled = true; };
  }, [prefetchAllAsync]);

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

      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
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
