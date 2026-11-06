import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propuestaStatus?: string;
}

/**
 * Modal informativo que se muestra cuando se intenta abrir el modal de
 * Asignar Inventario sobre una propuesta ya pasada a ventas.
 * Mismo patron visual que StatusCampanaModal / resto de modales QEB:
 * useThemeStore (isDark), zinc-900/white, rounded-2xl, header con border-b.
 */
export function PropuestaAprobadaInfoModal({ isOpen, onClose, propuestaStatus }: Props) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'} border rounded-2xl w-full max-w-md mx-4 shadow-2xl`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              <AlertTriangle className={`h-5 w-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Propuesta no editable
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} mb-2`}>
            Esta propuesta ya pasó a ventas
            {propuestaStatus ? (
              <>
                {' '}(<span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{propuestaStatus}</span>)
              </>
            ) : null}
            .
          </p>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
            Para agregar circuitos a una campaña ya vendida, hazlo desde el módulo de{' '}
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Campañas</span>.
          </p>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2 p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
