import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, FlaskConical, Settings, Bot } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useChatStore } from '../../store/chatStore';
import { notificacionesService } from '../../services/notificaciones.service';
import { UserAvatar } from '../ui/user-avatar';
import { useSocketNotificaciones } from '../../hooks/useSocket';
import { ThemeToggle } from '../ui/ThemeToggle';
import { authService } from '../../services/auth.service';

interface HeaderProps {
  title: string;
  badgeCount?: number;
}

export function Header({ title, badgeCount }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const toggleChat = useChatStore((s) => s.toggle);
  // El Header es la instancia global: maneja los popups de notificaciones.
  useSocketNotificaciones(user?.id, { popups: true });

  // Cargar preferencias de notificaciones en cache (las consume el hook de socket
  // para decidir si muestra popup). Opt-out: si falla, se asume todo activo.
  useQuery({
    queryKey: ['notif-preferencias'],
    queryFn: () => notificacionesService.getPreferencias(),
    staleTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  // Antes pediamos getAll(limit:200) y filtrabamos en cliente. Para usuarios
  // con muchas tareas historicas (ej. Rodrigo Margain con 405) el limit se
  // llenaba con Atendidos viejos y el conteo era incorrecto. Ahora el back
  // calcula badge_count en el endpoint /notificaciones/stats con la misma
  // logica (estatus NOT IN Atendido/Rechazado/Cancelado, filtrado por
  // id_responsable o id_asignado).
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats', '__badge__'],
    queryFn: () => notificacionesService.getStats(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const unreadCount = stats?.badge_count ?? 0;

  return (
    <header className={`sticky top-0 z-[50] flex h-16 items-center gap-4 border-b backdrop-blur-sm px-6 ${
      isDark
        ? 'border-purple-900/30 bg-[#1a1025]/80'
        : 'border-purple-200/50 bg-white/80'
    }`}>
      <h1 className={`text-lg font-light tracking-wide uppercase ${isDark ? 'text-white' : 'text-gray-700'}`}>
        {title}
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-red-500 text-[11px] font-bold text-white px-1.5 align-middle">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Indicador de ambiente */}
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          isDark
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
        }`}>
          Activo
        </span>
        <VersionBadge isDark={isDark} />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* QEBooh - asistente IA */}
        <button
          onClick={toggleChat}
          className={`relative p-2 rounded-full transition-colors ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'}`}
          title="QEBooh - Asistente IA"
        >
          <Bot className={`h-5 w-5 ${isDark ? 'text-zinc-500 hover:text-purple-300' : 'text-gray-400 hover:text-purple-600'}`} />
        </button>

        {/* Admin - Configuración de usuarios (solo Administrador) */}
        {['Administrador', 'DEV'].includes(user?.rol || '') && (
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

function VersionBadge({ isDark }: { isDark: boolean }) {
  const { data: version } = useQuery({
    queryKey: ['app-version'],
    queryFn: () => authService.getLatestVersion(),
    staleTime: 5 * 60 * 1000,
  });

  if (!version?.numero) return null;

  return (
    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border ${
      isDark
        ? 'bg-purple-500/15 text-purple-300 border-purple-500/25'
        : 'bg-purple-50 text-purple-600 border-purple-200'
    }`}>
      v{version.numero}
    </span>
  );
}
