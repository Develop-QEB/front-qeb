import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, Search, User, MapPin, Loader2 } from 'lucide-react';
import { solicitudesService } from '../../services/solicitudes.service';

const TIPOS_INCIDENCIA = [
  'Grafiti',
  'Siniestro',
  'Vandalismo',
  'Daño por clima',
  'Robo de material',
  'Otro',
];

interface SelectedItem {
  id: string;
  ubicacion: string;
  rsv_id: string;
  plaza?: string;
  tipo_de_cara?: string;
}

export interface ReImpresionData {
  tipoIncidencia: string;
  descripcion: string;
  asignado: string;
  id_asignado: string;
  ids_reservas: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: SelectedItem[];
  onSubmit: (data: ReImpresionData) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}

export function ReImpresionModal({ isOpen, onClose, selectedItems, onSubmit, isSubmitting, error }: Props) {
  const [tipoIncidencia, setTipoIncidencia] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: number; nombre: string } | null>(null);

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['solicitudes-users', 'all-for-reimpresion'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: isOpen,
  });

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers.slice(0, 8);
    const s = userSearch.toLowerCase();
    return allUsers.filter(u => u.nombre.toLowerCase().includes(s)).slice(0, 8);
  }, [allUsers, userSearch]);

  const reservaIds = selectedItems
    .flatMap(i => i.rsv_id.split(',').map(r => r.trim()).filter(Boolean))
    .join(',');

  const handleSubmit = async () => {
    if (!tipoIncidencia || !selectedUser) return;
    await onSubmit({
      tipoIncidencia,
      descripcion,
      asignado: selectedUser.nombre,
      id_asignado: String(selectedUser.id),
      ids_reservas: reservaIds,
    });
    // Reset form on close
    setTipoIncidencia('');
    setDescripcion('');
    setUserSearch('');
    setSelectedUser(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-orange-500/30 rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Re-impresión por Incidencia</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Inventarios seleccionados */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 font-medium">
              {selectedItems.length} espacio(s) afectado(s)
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 rounded-lg">
                  <MapPin className="h-3 w-3 text-orange-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">{item.ubicacion || item.id}</span>
                  {item.plaza && <span className="text-[10px] text-zinc-500 flex-shrink-0">{item.plaza}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Tipo de incidencia */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo de incidencia *</label>
            <select
              value={tipoIncidencia}
              onChange={e => setTipoIncidencia(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500/50"
            >
              <option value="">Seleccionar...</option>
              {TIPOS_INCIDENCIA.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">¿Qué pasó? *</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Describe la incidencia detalladamente..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-600"
            />
          </div>

          {/* Asignar analista */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Asignar analista *</label>
            {selectedUser ? (
              <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-sm text-white">{selectedUser.nombre}</span>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserSearch(''); }} className="text-zinc-500 hover:text-zinc-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
                  <Search className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                  {isLoadingUsers && <Loader2 className="h-3.5 w-3.5 text-zinc-500 animate-spin" />}
                </div>
                {filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setUserSearch(''); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        <User className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                        <span>{u.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tipoIncidencia || !descripcion.trim() || !selectedUser || isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {isSubmitting ? 'Creando...' : 'Crear tarea de re-impresión'}
          </button>
        </div>
      </div>
    </div>
  );
}
