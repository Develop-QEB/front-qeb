import { Trash2, AlertTriangle } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

interface DeleteCircuitoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  ubicacion: string;
  articulo: string;
  formato?: string;
  tieneReservas: boolean;
  tienePareja: boolean;
  /** Si se define y es > 1, el modal muestra un resumen de borrado masivo de N circuitos */
  count?: number;
}

export function DeleteCircuitoConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  ubicacion,
  articulo,
  formato,
  tieneReservas,
  tienePareja,
  count,
}: DeleteCircuitoConfirmModalProps) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  if (!isOpen) return null;

  const bulk = count != null;
  const plural = (count ?? 0) > 1;
  const secondary = [articulo, formato].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !isDeleting && onClose()}
      />
      <div
        className={`relative ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-xl shadow-2xl w-[440px] max-w-[95vw] max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200`}
      >
        <div className={`px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {plural ? 'Eliminar circuitos' : 'Eliminar circuito'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
          <div
            className={`p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}
          >
            {bulk ? (
              <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                {count} circuito{plural ? 's' : ''} seleccionado{plural ? 's' : ''}
              </p>
            ) : (
              <>
                <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                  {ubicacion}
                </p>
                {secondary && (
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    {secondary}
                  </p>
                )}
              </>
            )}
          </div>

          {tieneReservas && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                {plural
                  ? 'Algunos circuitos tienen reservas activas — se liberarán al eliminarlos.'
                  : 'Este circuito tiene reservas activas — se liberarán al eliminarlo.'}
              </p>
            </div>
          )}

          {tienePareja && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                {plural
                  ? 'También se eliminarán sus pares RT/BF del mismo periodo.'
                  : 'También se eliminará su par RT/BF del mismo periodo.'}
              </p>
            </div>
          )}
        </div>

        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {plural ? `Eliminar ${count}` : 'Eliminar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
