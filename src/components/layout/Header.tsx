import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, FlaskConical, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { notificacionesService } from '../../services/notificaciones.service';
import { UserAvatar } from '../ui/user-avatar';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const environment = useEnvironmentStore((state) => state.environment);
  const isTestMode = environment === 'test';

  // Fetch notification stats for the badge
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats'],
    queryFn: () => notificacionesService.getStats(),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = stats?.no_leidas || 0;

  return (
    <header className="sticky top-0 z-[50] flex h-16 items-center gap-4 border-b border-purple-900/30 bg-[#1a1025]/80 backdrop-blur-sm px-6">
      <h1 className="text-lg font-light text-purple-200 tracking-wide uppercase">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Indicador de ambiente (solo si es pruebas) */}
        {isTestMode && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <FlaskConical className="h-3 w-3" />
            PRUEBAS
          </span>
        )}

        {/* Admin - Configuración de usuarios (solo Administrador) */}
        {user?.rol === 'Administrador' && (
          <Link
            to="/admin/usuarios"
            className="relative p-2 rounded-full hover:bg-purple-900/30 transition-colors"
            title="Administrar usuarios"
          >
            <Settings className="h-5 w-5 text-purple-400/70 hover:text-purple-300" />
          </Link>
        )}

        {/* Notificaciones */}
        <Link
          to="/notificaciones"
          className="relative p-2 rounded-full hover:bg-purple-900/30 transition-colors"
        >
          <Bell className="h-5 w-5 text-purple-400/70 hover:text-purple-300" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <Link to="/perfil" className="flex items-center gap-3 group">
          <UserAvatar
            nombre={user?.nombre}
            foto_perfil={user?.foto_perfil}
            size="xl"
            className="group-hover:ring-2 group-hover:ring-purple-400/50 transition-all"
          />
        </Link>
      </div>
    </header>
  );
}
