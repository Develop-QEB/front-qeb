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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Proveedores', href: '/proveedores', icon: Building2 },
  { name: 'Solicitudes', href: '/solicitudes', icon: FileText },
  { name: 'Propuestas', href: '/propuestas', icon: Send },
  { name: 'Campañas', href: '/campanas', icon: Megaphone },
  { name: 'Inventarios', href: '/inventarios', icon: MapPin },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-[#1a1025] text-white transition-all duration-300 border-r border-purple-900/30',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header con Logo */}
        <div className="flex h-20 items-center justify-between px-4 border-b border-purple-900/30">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <img
                src="/images/logo-bco.png"
                alt="QEB"
                className="h-8 w-auto"
              />
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
              'p-1.5 rounded-md hover:bg-purple-900/30 transition-colors',
              collapsed && 'hidden'
            )}
          >
            <ChevronLeft
              className={cn('h-5 w-5 transition-transform text-purple-400', collapsed && 'rotate-180')}
            />
          </button>
        </div>

        {/* Boton toggle cuando collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="p-2 mx-auto mt-2 rounded-md hover:bg-purple-900/30 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 rotate-180 text-purple-400" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30'
                        : 'text-purple-300/70 hover:bg-purple-900/30 hover:text-white',
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

        {/* User section */}
        <div className="border-t border-purple-900/30 p-4">
          {!collapsed && user && (
            <div className="mb-3 px-2">
              <p className="text-sm font-medium truncate text-white">{user.nombre}</p>
              <p className="text-xs text-purple-400/60 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-light text-purple-300/70 hover:bg-purple-900/30 hover:text-white transition-all duration-200',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? 'Cerrar sesion' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Cerrar sesion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
