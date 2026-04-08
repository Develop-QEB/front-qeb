import { useState, useEffect } from 'react';
import { RefreshCw, Monitor, Apple } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { authService } from '../../services/auth.service';

export function UpdateNotificationModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    authService.getLatestVersion().then(v => {
      if (v && v.numero && user.version_notified !== v.numero) {
        setLatestVersion(v.numero);
        setOpen(true);
      }
    }).catch(() => {});
  }, [user]);

  const handleAcknowledge = async () => {
    if (!user || !latestVersion) return;
    setLoading(true);
    try {
      await authService.markVersionNotified(latestVersion);
      useAuthStore.getState().setUser({ ...user, version_notified: latestVersion });
      setOpen(false);
    } catch {
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !latestVersion) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div
        className={`
          relative max-w-lg w-full mx-4 rounded-2xl shadow-2xl border p-6
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
              ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}
            `}
          >
            <RefreshCw className={`w-8 h-8 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center mb-2">
          Nueva Actualización Disponible
        </h2>
        <p className={`text-center text-sm mb-4 ${isDark ? 'text-purple-300' : 'text-purple-600'} font-medium`}>
          Versión {latestVersion}
        </p>

        {/* Body */}
        <div className={`space-y-3 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <p>
            Hemos realizado mejoras importantes en el sistema. Para asegurar que todo funcione correctamente,
            te pedimos que <strong className={isDark ? 'text-white' : 'text-gray-900'}>borres la cache de tu navegador</strong> una
            sola vez.
          </p>

          {/* Instructions */}
          <div className={`rounded-xl p-4 border space-y-3 ${isDark ? 'bg-zinc-900/50 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Monitor className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <div>
                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Windows (Chrome, Edge)</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Presiona <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Ctrl</kbd> + <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Shift</kbd> + <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Delete</kbd>
                </p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  Selecciona "Imagenes y archivos en cache" y haz clic en "Borrar datos"
                </p>
              </div>
            </div>

            <div className={`border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}>
                <Apple className={`w-4 h-4 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Mac (Safari / Chrome)</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Presiona <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Cmd</kbd> + <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Shift</kbd> + <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-gray-200 text-gray-700'}`}>Delete</kbd>
                </p>
              </div>
            </div>
          </div>

          {/* Validation callout */}
          <div
            className={`
              rounded-xl p-4 border
              ${isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }
            `}
          >
            <p className="text-sm leading-relaxed">
              Para confirmar que la cache se borro correctamente, deberas ver en la esquina superior derecha
              una etiqueta que diga <strong>v{latestVersion}</strong> junto a "Activo".
            </p>
          </div>

          <p className={`text-xs text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            Solo es necesario hacerlo una vez. Gracias por tu paciencia.
          </p>
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
          {loading ? 'Guardando...' : 'Entendido, muchas gracias'}
        </button>
      </div>
    </div>
  );
}
