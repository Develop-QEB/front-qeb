import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Settings, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { notificacionesService } from '../../services/notificaciones.service';
import { correosService } from '../../services/correos.service';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user);

  // Fetch notification stats for the badge
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats'],
    queryFn: () => notificacionesService.getStats(),
    refetchInterval: 30000,
    enabled: !!user,
  });

  // Fetch correos stats for the badge
  const { data: correosStats } = useQuery({
    queryKey: ['correos-stats'],
    queryFn: () => correosService.getStats(),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = stats?.no_leidas || 0;
  const unreadCorreos = correosStats?.no_leidos || 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-purple-900/30 bg-[#1a1025]/80 backdrop-blur-sm px-6">
      <h1 className="text-lg font-light text-purple-200 tracking-wide uppercase">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Iconos */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-purple-900/30 transition-colors">
            <Settings className="h-5 w-5 text-purple-400/70 hover:text-purple-300" />
          </button>
          <Link
            to="/correos"
            className="relative p-2 rounded-full hover:bg-purple-900/30 transition-colors"
          >
            <Mail className="h-5 w-5 text-purple-400/70 hover:text-purple-300" />
            {unreadCorreos > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white px-1">
                {unreadCorreos > 99 ? '99+' : unreadCorreos}
              </span>
            )}
          </Link>
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
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-3 ml-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
            {user?.nombre?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
