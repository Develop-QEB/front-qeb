import { Save, FileEdit, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export interface ModifiedCircuito {
  id: number;
  primary: string;
  secondary?: string;
}

interface SaveChangesConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
  /** Etiqueta del cambio general (ej. "propuesta", "campaña") */
  contextLabel: string;
  hasGeneralChanges: boolean;
  modifiedCircuitos: ModifiedCircuito[];
}

export function SaveChangesConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSaving = false,
  contextLabel,
  hasGeneralChanges,
  modifiedCircuitos,
}: SaveChangesConfirmModalProps) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  if (!isOpen) return null;
  const total = (hasGeneralChanges ? 1 : 0) + modifiedCircuitos.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !isSaving && onClose()}
      />
      <div
        className={`relative ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200`}
      >
        <div className={`px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Save className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Confirmar guardado
              </h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {total} cambio{total !== 1 ? 's' : ''} pendiente{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
          {hasGeneralChanges && (
            <div
              className={`flex items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'}`}
            >
              <FileEdit className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                  Cambios en la {contextLabel}
                </p>
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  Datos generales modificados
                </p>
              </div>
            </div>
          )}

          {modifiedCircuitos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}
                >
                  {modifiedCircuitos.length} circuito{modifiedCircuitos.length !== 1 ? 's' : ''}{' '}
                  modificado{modifiedCircuitos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul
                className={`rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'} divide-y ${isDark ? 'divide-zinc-700/50' : 'divide-gray-200'} max-h-[280px] overflow-y-auto`}
              >
                {modifiedCircuitos.map((c) => (
                  <li key={c.id} className="px-3 py-2 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}
                      >
                        {c.primary}
                      </p>
                      {c.secondary && (
                        <p
                          className={`text-[11px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}
                        >
                          {c.secondary}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasGeneralChanges && modifiedCircuitos.length === 0 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
              <AlertCircle className="h-4 w-4 text-zinc-400" />
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Sin cambios pendientes
              </p>
            </div>
          )}
        </div>

        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving || total === 0}
            className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
