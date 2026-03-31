import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useModalTracker } from '../../hooks/useModalTracker';
import { useThemeStore } from '../../store/themeStore';

interface Props {
  campanaId: number;
  campanaNombre: string;
  isOpen: boolean;
  onClose: () => void;
}

export function IncidenciaModal({ campanaId, campanaNombre, isOpen, onClose }: Props) {
  useModalTracker('Nueva Incidencia', isOpen);
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [tipo, setTipo] = useState('');
  const [nota, setNota] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (tipo === 'Bloqueo') {
      const params = new URLSearchParams({ campanaId: String(campanaId), campanaNombre });
      navigate(`/inventarios?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ incidencia: '1', tipoIncidencia: tipo, tab: 'testigo', subtab: 'instaladas' });
      navigate(`/campanas/${campanaId}/tareas?${params.toString()}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className={`${isDark ? 'bg-zinc-900 border-orange-500/30' : 'bg-white border-orange-300/50'} border rounded-xl p-5 w-full max-w-sm shadow-xl`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reportar Incidencia</h2>
          </div>
          <button onClick={onClose} className={`${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-4 truncate`} title={campanaNombre}>
          Campaña: <span className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{campanaNombre}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-1 block`}>Tipo de incidencia *</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className={`w-full ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500/50`}
            >
              <option value="">Seleccionar...</option>
              <option value="Re-impresión">Re-impresión</option>
              <option value="Bloqueo">Bloqueo</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className={`flex-1 px-3 py-2 text-sm ${isDark ? 'text-zinc-400 border-zinc-700 hover:bg-zinc-800' : 'text-gray-500 border-gray-300 hover:bg-gray-100'} border rounded-lg transition-colors`}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!tipo}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 ${isDark ? 'disabled:bg-zinc-700 disabled:text-zinc-500' : 'disabled:bg-gray-200 disabled:text-gray-400'} text-white rounded-lg transition-colors`}
          >
            <AlertTriangle className="h-4 w-4" />
            {tipo === 'Bloqueo' ? 'Ir a Inventarios' : 'Ir a Gestión de Artes'}
          </button>
        </div>
      </div>
    </div>
  );
}
