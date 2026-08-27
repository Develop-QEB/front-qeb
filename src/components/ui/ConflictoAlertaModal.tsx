import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, X, Bell } from 'lucide-react';
import { useConflictoAlertaStore } from '../../store/conflictoAlertaStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

/**
 * Modal emergente (centro de pantalla) cuando llega una notificación de
 * conflictos de ocupación dirigida a este usuario. La empuja el hook de socket;
 * a diferencia del toast, no se cierra sola y no depende de las preferencias
 * de popup: es un aviso operativo raro que amerita interrupción.
 */
export function ConflictoAlertaModal() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const alerta = useConflictoAlertaStore((s) => s.alerta);
  const dismiss = useConflictoAlertaStore((s) => s.dismiss);
  const userRol = useAuthStore((s) => s.user?.rol);
  const navigate = useNavigate();

  if (!alerta) return null;
  // TEMPORAL (soft-launch): el modal emergente solo se muestra a DEV mientras
  // se prueba el módulo. El backend ya restringe los destinatarios, esto es el
  // cinturón extra en el cliente. Para liberar: quitar este guard.
  if (userRol !== 'DEV') return null;

  const irAuditoria = () => {
    dismiss();
    navigate('/inventarios?auditoria=1');
  };
  const irNotificacion = () => {
    dismiss();
    navigate(alerta.tareaId ? `/notificaciones?tareaId=${alerta.tareaId}` : '/notificaciones');
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4"
      onClick={dismiss}
    >
      <div
        role="alertdialog"
        aria-label={alerta.titulo}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border-amber-500/30 shadow-amber-500/10' : 'bg-white border-amber-300'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-5 flex items-start gap-3 border-b ${
          isDark
            ? 'border-amber-500/20 bg-gradient-to-r from-amber-900/25 to-orange-900/10'
            : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
            <AlertTriangle className={`h-6 w-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {alerta.titulo}
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-amber-300/60' : 'text-amber-600'}`}>
              Conflictos de ocupación de inventario
            </p>
          </div>
          <button
            onClick={dismiss}
            className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {alerta.descripcion && (
          <div className={`px-5 py-4 text-sm whitespace-pre-line max-h-64 overflow-y-auto ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
            {alerta.descripcion}
          </div>
        )}

        <div className={`p-4 border-t flex flex-col sm:flex-row sm:justify-end gap-2 ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={irNotificacion}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              isDark ? 'text-zinc-300 hover:bg-zinc-800 border border-zinc-700' : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <Bell className="h-4 w-4" />
            Ver notificación
          </button>
          {userRol === 'DEV' && (
            <button
              onClick={irAuditoria}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-medium hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              Ver Auditoría de Conflictos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
