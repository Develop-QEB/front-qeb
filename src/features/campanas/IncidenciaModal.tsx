import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';

const TIPOS_INCIDENCIA = [
  'Siniestro',
  'Grafiti',
  'Vandalismo',
  'Daño por clima',
  'Otro',
];

interface Props {
  campanaId: number;
  campanaNombre: string;
  isOpen: boolean;
  onClose: () => void;
}

export function IncidenciaModal({ campanaId, campanaNombre, isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('');
  const [nota, setNota] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const params = new URLSearchParams({ incidencia: '1', tipoIncidencia: tipo });
    navigate(`/campanas/${campanaId}/tareas?${params.toString()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-orange-500/30 rounded-xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Reportar Incidencia</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-4 truncate" title={campanaNombre}>
          Campaña: <span className="text-zinc-200">{campanaNombre}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo de incidencia *</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500/50"
            >
              <option value="">Seleccionar...</option>
              {TIPOS_INCIDENCIA.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Notas (opcional)</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              placeholder="Describe la incidencia..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!tipo}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            Ir a Gestión de Artes
          </button>
        </div>
      </div>
    </div>
  );
}
