import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { authService } from '../../services/auth.service';

export function LightThemeNotificationModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user && user.light_theme_notified !== true) {
      setOpen(true);
    }
  }, [user]);

  const handleAcknowledge = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await authService.markLightThemeNotified();
      useAuthStore.getState().setUser({ ...user, light_theme_notified: true });
      setOpen(false);
    } catch (err) {
      console.error('Error marking light theme notified:', err);
      // Close anyway so user isn't stuck
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div
        className={`
          relative max-w-md w-full mx-4 rounded-2xl shadow-2xl border p-6
          ${isDark
            ? 'bg-[#1a1025] border-purple-500/30 text-white'
            : 'bg-white border-purple-200 text-gray-900'
          }
        `}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`
              flex items-center justify-center w-16 h-16 rounded-full
              ${isDark
                ? 'bg-purple-500/20'
                : 'bg-purple-100'
              }
            `}
          >
            <Sun className={`w-7 h-7 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
            <Moon className={`w-5 h-5 -ml-2 mt-3 ${isDark ? 'text-purple-300' : 'text-purple-500'}`} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center mb-4">
          Nuevo Tema Claro Disponible
        </h2>

        {/* Body */}
        <div className={`space-y-3 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <p>Querido usuario, valoramos mucho tu opinión.</p>
          <p>
            Hemos implementado un nuevo <strong className={isDark ? 'text-white' : 'text-gray-900'}>tema claro</strong> para mejorar tu experiencia.
          </p>
          <p>
            Puedes activarlo o desactivarlo presionando el icono de estrellita (
            <Sun className="inline h-4 w-4 text-yellow-500" />
            ) que se encuentra en la parte superior derecha, junto a las notificaciones.
          </p>

          {/* Callout box */}
          <div
            className={`
              rounded-xl p-4 mt-3 border
              ${isDark
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                : 'bg-purple-50 border-purple-200 text-purple-800'
              }
            `}
          >
            <p className="text-sm leading-relaxed">
              El tema claro aún está en fase de pruebas. Tu retroalimentación <strong>vale oro</strong> para nosotros.
              Si llegas a notar alguna sección donde el tema no se vea correctamente, por favor háznolo
              saber a través de los <strong>tickets de soporte</strong>. Tu ayuda nos permite mejorar más rápido.
            </p>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleAcknowledge}
          disabled={loading}
          className={`
            mt-6 w-full py-3 px-4 rounded-xl font-semibold text-white text-sm
            bg-gradient-to-r from-purple-600 to-purple-500
            hover:from-purple-700 hover:to-purple-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 shadow-lg shadow-purple-500/25
          `}
        >
          {loading ? 'Guardando...' : 'Enterado, muchas gracias'}
        </button>
      </div>
    </div>
  );
}
