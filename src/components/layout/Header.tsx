import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, FlaskConical, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { notificacionesService } from '../../services/notificaciones.service';
import { UserAvatar } from '../ui/user-avatar';
import { useSocketNotificaciones } from '../../hooks/useSocket';
import { useMemo } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  useSocketNotificaciones();

  const { data: notifData } = useQuery({
    queryKey: ['notificaciones', '__badge__'],
    queryFn: () => notificacionesService.getAll({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const unreadCount = useMemo(() => {
    if (!notifData?.data || !user) return 0;
    const userId = String(user.id);
    return notifData.data.filter(n => {
      if (n.tipo === 'Notificación') {
        if (n.leida || n.estatus === 'Atendido') return false;
        return n.id_responsable !== undefined &&
               n.id_responsable !== null &&
               String(n.id_responsable) === userId;
      }
      // Tareas
      if (n.estatus === 'Atendido') return false;
      if (n.id_asignado !== undefined && n.id_asignado !== null) {
        return String(n.id_asignado).split(',').map(s => s.trim()).includes(userId);
      }
      if (n.id_responsable !== undefined && n.id_responsable !== null) {
        return String(n.id_responsable) === userId;
      }
      return false;
    }).length;
  }, [notifData?.data, user?.id]);

  return (
    <header className={`sticky top-0 z-[50] flex h-16 items-center gap-4 border-b backdrop-blur-sm px-6 ${
      isDark
        ? 'border-purple-900/30 bg-[#1a1025]/80'
        : 'border-purple-200/50 bg-white/80'
    }`}>
      <h1 className={`text-lg font-light tracking-wide uppercase ${isDark ? 'text-white' : 'text-gray-700'}`}>{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Indicador de ambiente */}
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          isDark
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          <FlaskConical className="h-3 w-3" />
          BETA
        </span>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Admin - Configuración de usuarios (solo Administrador) */}
        {user?.rol === 'Administrador' && (
          <Link
            to="/admin/usuarios"
            className={`relative p-2 rounded-full transition-colors ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'}`}
            title="Administrar usuarios"
          >
            <Settings className={`h-5 w-5 ${isDark ? 'text-zinc-500 hover:text-purple-300' : 'text-gray-400 hover:text-purple-600'}`} />
          </Link>
        )}

        {/* Notificaciones */}
        <Link
          to="/notificaciones"
          className={`relative p-2 rounded-full transition-colors ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'}`}
        >
          <Bell className={`h-5 w-5 ${isDark ? 'text-zinc-500 hover:text-purple-300' : 'text-gray-400 hover:text-purple-600'}`} />
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
            className="group-hover:ring-2 group-hover:ring-purple-300 transition-all"
          />
        </Link>
      </div>
    </header>
  );
}
