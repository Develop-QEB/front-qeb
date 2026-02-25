import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, FlaskConical, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { notificacionesService } from '../../services/notificaciones.service';
import { UserAvatar } from '../ui/user-avatar';
import { useSocketNotificaciones } from '../../hooks/useSocket';
import { useMemo } from 'react';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  // Suscribirse a WebSocket para actualizaciones en tiempo real
  useSocketNotificaciones();

  // Fetch notification stats for the badge
  // Sin polling - actualizaciones via WebSocket
  const { data: notifData } = useQuery({
    queryKey: ['notificaciones', 'notificaciones', '', '', 'created_at', 'desc'],
    queryFn: () => notificacionesService.getAll({ limit: 200 }), 
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
});

const unreadCount = useMemo(() => {
  if (!notifData?.data || !user) return 0;
  const userId = String(user.id);
  //console.log('match test:', String("1057460,1057602").split(',').map(s => s.trim()).includes("1057602"));
  return notifData.data.filter(n => {
    if (n.estatus === 'Atendido') return false;
    if (n.tipo === 'Notificación') {
      return n.id_responsable !== undefined &&
             n.id_responsable !== null &&
             String(n.id_responsable) === userId;
    }
    // Tareas: filtrar por id_asignado
    if (n.id_asignado !== undefined && n.id_asignado !== null) {
      return String(n.id_asignado).split(',').map(s => s.trim()).includes(userId);
    }
    return false;
  }).length;
}, [notifData?.data, user?.id]);

  return (
    <header className="sticky top-0 z-[50] flex h-16 items-center gap-4 border-b border-purple-900/30 bg-[#1a1025]/80 backdrop-blur-sm px-6">
      <h1 className="text-lg font-light text-purple-200 tracking-wide uppercase">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Indicador de ambiente */}
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-500/20 text-amber-300 border-amber-500/30">
          <FlaskConical className="h-3 w-3" />
          BETA
        </span>

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
