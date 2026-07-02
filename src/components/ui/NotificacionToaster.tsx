import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, X } from 'lucide-react';
import { useNotifToastStore, NotifToast } from '../../store/notifToastStore';
import { useThemeStore } from '../../store/themeStore';

function ToastItem({ toast }: { toast: NotifToast }) {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const dismiss = useNotifToastStore((s) => s.dismiss);
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  const esRecordatorio = toast.tipo === 'Recordatorio';

  // Animación de entrada
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Auto-cierre (salvo recordatorios, que requieren interacción)
  useEffect(() => {
    if (toast.requireInteraction) return;
    const t = setTimeout(() => dismiss(toast.id), 6000);
    return () => clearTimeout(t);
  }, [toast.id, toast.requireInteraction, dismiss]);

  const handleClick = () => {
    navigate(toast.tareaId ? `/notificaciones?tareaId=${toast.tareaId}` : '/notificaciones');
    dismiss(toast.id);
  };

  const Icon = esRecordatorio ? Clock : Bell;

  return (
    <div
      onClick={handleClick}
      role="button"
      className={`w-[26rem] max-w-[calc(100vw-2rem)] cursor-pointer rounded-2xl border shadow-2xl p-5 flex gap-4 transition-all duration-200 hover:scale-[1.01] ${
        shown ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
      } ${isDark ? 'bg-zinc-900 border-zinc-700/80 text-white shadow-black/50' : 'bg-white border-gray-200 text-gray-900'}`}
    >
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${esRecordatorio ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
        <Icon className={`h-5 w-5 ${esRecordatorio ? 'text-amber-400' : 'text-purple-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold leading-snug line-clamp-2">{toast.titulo}</p>
        {toast.descripcion && (
          <p className={`text-sm mt-1 line-clamp-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{toast.descripcion}</p>
        )}
        <p className={`text-xs mt-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Clic para abrir →</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
        className={`flex-shrink-0 self-start ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Contenedor global de toasts de notificación. Montar una sola vez (MainLayout). */
export function NotificacionToaster() {
  const toasts = useNotifToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
