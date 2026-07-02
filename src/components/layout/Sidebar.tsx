import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Send,
  Megaphone,
  MapPin,
  LogOut,
  ChevronLeft,
  HelpCircle,
  Bot,
  Ticket,
  BarChart3,
  History,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { usePrefetch } from '../../hooks/usePrefetch';
import { getPermissions } from '../../lib/permissions';
import { AyudaModal } from './AyudaModal';
import { ticketsService } from '../../services/tickets.service';
import { useSocketTicketsHistorial } from '../../hooks/useSocket';

const HISTORIAL_TICKETS_EMAILS = [
  'akary.lopez@datistic.mx',
  'bladimir@qeb.mx',
  'contacto@qeb.mx',
  'mario.salcido@deepia.dev',
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

type PrefetchKey = 'prefetchClientes' | 'prefetchProveedores' | 'prefetchSolicitudes' | 'prefetchPropuestas' | 'prefetchCampanas' | 'prefetchInventarios';

type PermissionKey = 'canSeeDashboard' | 'canSeeClientes' | 'canSeeProveedores' | 'canSeeSolicitudes' | 'canSeePropuestas' | 'canSeeCampanas' | 'canSeeInventarios';


const navigation: { name: string; href: string; icon: React.ElementType; prefetchKey?: PrefetchKey; permissionKey: PermissionKey }[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissionKey: 'canSeeDashboard' },
  { name: 'Clientes', href: '/clientes', icon: Users, prefetchKey: 'prefetchClientes', permissionKey: 'canSeeClientes' },
  { name: 'Proveedores', href: '/proveedores', icon: Building2, prefetchKey: 'prefetchProveedores', permissionKey: 'canSeeProveedores' },
  { name: 'Solicitudes', href: '/solicitudes', icon: FileText, prefetchKey: 'prefetchSolicitudes', permissionKey: 'canSeeSolicitudes' },
  { name: 'Propuestas', href: '/propuestas', icon: Send, prefetchKey: 'prefetchPropuestas', permissionKey: 'canSeePropuestas' },
  { name: 'Campañas', href: '/campanas', icon: Megaphone, prefetchKey: 'prefetchCampanas', permissionKey: 'canSeeCampanas' },
  { name: 'Inventarios', href: '/inventarios', icon: MapPin, prefetchKey: 'prefetchInventarios', permissionKey: 'canSeeInventarios' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const prefetch = usePrefetch();
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [ayudaTutorial, setAyudaTutorial] = useState('asesores-solicitudes');

  const handleLogout = () => {
    queryClient.clear();
    logout();
  };

  const handleMouseEnter = (prefetchKey?: PrefetchKey) => {
    if (prefetchKey && prefetch[prefetchKey]) {
      prefetch[prefetchKey]();
    }
  };

  const permissions = getPermissions(user?.rol);
  const canSeeHistorialTickets = user?.email && HISTORIAL_TICKETS_EMAILS.includes(user.email.toLowerCase());

  const { data: ticketsUnreadCount = 0 } = useQuery({
    queryKey: ['tickets-unread-count'],
    queryFn: () => ticketsService.getUnreadCount(),
    enabled: !!canSeeHistorialTickets,
    refetchInterval: 60000,
  });

  const { data: chatUnreadCount = 0 } = useQuery({
    queryKey: ['tickets-chat-unread-count'],
    queryFn: () => ticketsService.getChatUnreadCount(),
    refetchInterval: 60000,
  });

  // Real-time: invalidar todos los unread counts cuando llega un mensaje/chat nuevo
  useSocketTicketsHistorial();

  const filteredNavigation = navigation.filter(item => {
    if (!permissions[item.permissionKey]) {
      return false;
    }
    return true;
  });

  const hoverBg = isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50';
  const borderColor = isDark ? 'border-purple-900/30' : 'border-purple-200/50';

  const actionBtnCls = cn(
    'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
    isDark
      ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
      : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700'
  );

  return (
    <>
    <aside
      className={cn(
        `fixed left-0 top-0 z-40 h-screen transition-all duration-300 border-r shadow-lg ${
          isDark
            ? 'bg-[#1a1025] text-white border-purple-900/30 shadow-purple-900/10'
            : 'bg-white text-gray-800 border-purple-200/50 shadow-purple-100/10'
        }`,
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header con Logo */}
        <div className={`flex h-20 items-center justify-between px-4 border-b ${borderColor}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              {isDark ? (
                <img src="/images/logo-bco.png" alt="QEB" className="h-8 w-auto" />
              ) : (
                <img src="/images/logo-ooh.png" alt="QEB" className="h-8 w-auto" />
              )}
            </div>
          ) : (
            <img
              src="/images/imagotipo.png"
              alt="QEB"
              className="h-8 w-8 mx-auto object-contain"
            />
          )}
          <button
            onClick={onToggle}
            className={cn(
              `p-1.5 rounded-md transition-colors text-purple-500 ${hoverBg}`,
              collapsed && 'hidden'
            )}
          >
            <ChevronLeft
              className={cn('h-5 w-5 transition-transform text-purple-500', collapsed && 'rotate-180')}
            />
          </button>
        </div>

        {/* Boton toggle cuando collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className={`p-2 mx-auto mt-2 rounded-md transition-colors ${hoverBg}`}
          >
            <ChevronLeft className="h-5 w-5 rotate-180 text-purple-500" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {filteredNavigation.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  onMouseEnter={() => handleMouseEnter(item.prefetchKey)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                      isActive
                        ? isDark
                          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                          : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                        : isDark
                          ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                          : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                      collapsed && 'justify-center px-2'
                    )
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin section */}
        {(permissions.canSeeAdminUsuarios || canSeeHistorialTickets || permissions.canSeeHistorialAcciones) && (
          <div className={`border-t ${borderColor} px-2 py-3 space-y-1`}>
            {permissions.canSeeAdminUsuarios && [
              { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
            ].map(item => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                      : isDark
                        ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                        : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            ))}
            {canSeeHistorialTickets && (
              <NavLink
                to="/admin/tickets-historial"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200 relative',
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                      : isDark
                        ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                        : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? 'Historial de Tickets' : undefined}
              >
                <div className="relative">
                  <Ticket className="h-5 w-5 flex-shrink-0" />
                  {ticketsUnreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#1a1025]" />
                  )}
                </div>
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    Historial de Tickets
                    {ticketsUnreadCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white min-w-[18px] text-center">
                        {ticketsUnreadCount}
                      </span>
                    )}
                  </span>
                )}
              </NavLink>
            )}
            {permissions.canSeeAdminUsuarios && (
              <NavLink
                to="/admin/chatbot"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                      : isDark
                        ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                        : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? 'Historial QEBooh' : undefined}
              >
                <Bot className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Historial QEBooh</span>}
              </NavLink>
            )}
            {(user?.rol === 'DEV' || user?.rol === 'Administrador') && (
              <NavLink
                to="/reportes-especiales"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                      : isDark
                        ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                        : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? 'Reportes de Tickets' : undefined}
              >
                <BarChart3 className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Reportes de Tickets</span>}
              </NavLink>
            )}
            {permissions.canSeeHistorialAcciones && (
              <NavLink
                to="/historial-acciones"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/30'
                        : 'bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200'
                      : isDark
                        ? 'text-zinc-400 hover:bg-purple-900/30 hover:text-purple-300'
                        : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? 'Historial de Acciones' : undefined}
              >
                <History className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Historial de Acciones</span>}
              </NavLink>
            )}
          </div>
        )}

        {/* User section */}
        <div className={`border-t ${borderColor} p-4`}>
          {!collapsed && user && (
            <div className="mb-3 px-2">
              <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{user.nombre}</p>
              <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{user.email}</p>
            </div>
          )}
          <button
            onClick={() => setAyudaOpen(true)}
            className={cn(actionBtnCls, collapsed && 'justify-center px-2', 'relative')}
            title={collapsed ? 'Ayuda' : undefined}
          >
            <HelpCircle className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Ayuda</span>}
            {chatUnreadCount > 0 && (
              <span className="absolute top-1.5 left-6 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-red-500/30" />
            )}
          </button>
          <button
            onClick={handleLogout}
            className={cn(actionBtnCls, collapsed && 'justify-center px-2')}
            title={collapsed ? 'Cerrar sesion' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Cerrar sesion</span>}
          </button>
        </div>
      </div>
    </aside>

    <AyudaModal
      isOpen={ayudaOpen}
      onClose={() => setAyudaOpen(false)}
      tutorialId={ayudaTutorial}
      onSelect={setAyudaTutorial}
      chatUnreadCount={chatUnreadCount}
    />
    </>
  );
}
