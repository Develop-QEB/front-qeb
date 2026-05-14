import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import {
  MAINTENANCE_MODE,
  MAINTENANCE_TITLE,
  MAINTENANCE_MESSAGE,
  isUserAllowedDuringMaintenance,
} from '../../config/maintenance';

export function MaintenancePage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDark = useThemeStore((s) => s.theme === 'dark');

  if (!MAINTENANCE_MODE) {
    return <Navigate to="/" replace />;
  }

  if (user && isUserAllowedDuringMaintenance(user.rol)) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(to bottom right, #0f0a18, #1a1025, #0f0a18)'
          : 'linear-gradient(to bottom right, #ffffff, rgb(250 245 255 / 0.5), rgb(243 232 255 / 0.3))',
      }}
    >
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="flex justify-center">
          {isDark ? (
            <img src="/images/logo-bco.png" alt="QEB" className="h-24 w-auto" />
          ) : (
            <img src="/images/logo-ooh.png" alt="QEB" className="h-24 w-auto" />
          )}
        </div>

        <div
          className={`backdrop-blur-sm rounded-2xl p-10 border shadow-xl ${
            isDark
              ? 'bg-[#1a1025]/90 border-purple-900/30 shadow-purple-900/10'
              : 'bg-white/90 border-purple-200/50 shadow-purple-100/20'
          }`}
        >
          <h1
            className={`text-2xl font-light tracking-wide mb-4 ${
              isDark ? 'text-white' : 'text-gray-800'
            }`}
          >
            {MAINTENANCE_TITLE}
          </h1>
          <p
            className={`text-sm leading-relaxed whitespace-pre-line ${
              isDark ? 'text-zinc-300' : 'text-gray-600'
            }`}
          >
            {MAINTENANCE_MESSAGE}
          </p>
          <p className={`text-xs mt-6 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            Agradecemos tu comprension.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className={`text-xs underline-offset-4 hover:underline transition-colors ${
            isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
