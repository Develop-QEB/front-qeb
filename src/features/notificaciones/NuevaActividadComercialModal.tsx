import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Briefcase, Loader2, Search, Send, X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  notificacionesService,
  ActividadRef,
  ActividadSubtipo,
} from '../../services/notificaciones.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Modal "Nueva Actividad Comercial". Reemplaza la accion manual que vivia en
// Historial de Acciones para asesores comerciales — ahora es una tarea real en
// el modulo de Notificaciones y Tareas con categoria='Actividad Comercial'.
export function NuevaActividadComercialModal({ isOpen, onClose }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [subtipo, setSubtipo] = useState<ActividadSubtipo>('Campaña');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ActividadRef | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [activarRecordatorio, setActivarRecordatorio] = useState(false);
  const [diasAntes, setDiasAntes] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setSubtipo('Campaña');
      setSearch('');
      setSelected(null);
      setDescripcion('');
      setFechaEntrega('');
      setActivarRecordatorio(false);
      setDiasAntes('1');
      setError(null);
      setCreatedId(null);
    }
  }, [isOpen]);

  const listQuery = useQuery({
    queryKey: ['actividad-comercial-refs', subtipo, debouncedSearch],
    queryFn: () => subtipo === 'Campaña'
      ? notificacionesService.getCampanasParaActividad(debouncedSearch || undefined)
      : notificacionesService.getPropuestasParaActividad(debouncedSearch || undefined),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: notificacionesService.crearActividadComercial,
    onSuccess: (data) => {
      setCreatedId(data.id);
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const asesorNombre = user?.nombre || 'Usuario';
  const nowLabel = useMemo(() => {
    return new Date().toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  }, [isOpen]);

  const minDate = new Date().toISOString().slice(0, 10);

  const handleSubmit = () => {
    setError(null);
    if (!selected) { setError(`Selecciona una ${subtipo.toLowerCase()}.`); return; }
    const desc = descripcion.trim();
    if (!desc) { setError('La descripción es obligatoria.'); return; }
    const dias = activarRecordatorio && fechaEntrega
      ? Math.max(0, Math.min(365, parseInt(diasAntes || '0', 10) || 0))
      : undefined;
    createMutation.mutate({
      subtipo,
      ref_id: selected.id,
      descripcion: desc,
      fecha_fin: fechaEntrega || undefined,
      activar_recordatorio: activarRecordatorio,
      recordar_dias_antes: dias,
    });
  };

  if (!isOpen) return null;

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm ${
    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
           : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
  }`;
  const labelCls = `text-xs font-medium mb-1 block ${isDark ? 'text-zinc-400' : 'text-gray-500'}`;
  const readonlyCls = `w-full rounded-lg border px-3 py-2 text-sm ${
    isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
           : 'bg-gray-50 border-gray-200 text-gray-600'
  }`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border max-h-[92vh] overflow-y-auto ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-start justify-between px-5 py-4 border-b sticky top-0 z-10 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-amber-500/15' : 'bg-amber-50'
            }`}>
              <Briefcase className={`h-5 w-5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                Nueva Actividad Comercial
              </h3>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Registra una tarea manual sobre una campaña o propuesta.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {createdId ? (
          <div className="px-5 py-8 text-center space-y-3">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
              <Send className={`h-6 w-6 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} />
            </div>
            <div className={`text-sm ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
              Actividad comercial creada.
            </div>
            <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              ID_accion: <span className="font-mono">{createdId}</span>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Datos automaticos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>ID_accion</label>
                <input className={readonlyCls} value="(se asigna al crear)" readOnly />
              </div>
              <div>
                <label className={labelCls}>Asesor</label>
                <input className={readonlyCls} value={asesorNombre} readOnly />
              </div>
              <div>
                <label className={labelCls}>Fecha/Hora de creación</label>
                <input className={readonlyCls} value={nowLabel} readOnly />
              </div>
            </div>

            {/* Tipo + selector de referencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo *</label>
                <select
                  className={inputCls}
                  value={subtipo}
                  onChange={(e) => {
                    setSubtipo(e.target.value as ActividadSubtipo);
                    setSelected(null);
                    setSearch('');
                  }}
                >
                  <option value="Campaña">Campaña</option>
                  <option value="Propuesta">Propuesta</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Buscar {subtipo.toLowerCase()} *</label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder={`Nombre, ID, cliente o marca...`}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                  />
                </div>
              </div>
            </div>

            {/* Resultados */}
            {!selected && (
              <div className={`rounded-lg border max-h-52 overflow-y-auto ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                {listQuery.isLoading && (
                  <div className={`px-3 py-3 text-xs flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                  </div>
                )}
                {!listQuery.isLoading && (listQuery.data?.length ?? 0) === 0 && (
                  <div className={`px-3 py-3 text-xs text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    Sin resultados. Prueba con otro término.
                  </div>
                )}
                {(listQuery.data || []).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200 border-b border-zinc-800/60'
                             : 'hover:bg-amber-50 text-gray-700 border-b border-gray-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.label}</div>
                      <div className={`text-[11px] mt-0.5 truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                        {item.cliente || '—'} · {item.marca || 'Sin marca'}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Seleccionado + cliente/marca */}
            {selected && (
              <div className={`rounded-lg border p-3 ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {subtipo} seleccionada
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                      {selected.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className={`text-xs px-2 py-1 rounded ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Cambiar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={labelCls}>Cliente</label>
                    <input className={readonlyCls} value={selected.cliente || '—'} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Marca</label>
                    <input className={readonlyCls} value={selected.marca || '—'} readOnly />
                  </div>
                </div>
              </div>
            )}

            {/* Descripcion */}
            <div>
              <label className={labelCls}>Descripción Actividad *</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Describe la actividad..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {/* Fecha + recordatorio */}
            <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <label className={labelCls}>Fecha de entrega / actividad (opcional)</label>
              <input
                type="date"
                className={inputCls}
                value={fechaEntrega}
                min={minDate}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
              <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                Déjalo vacío si no aplica.
              </p>
            </div>

            {fechaEntrega && (
              <div className={`rounded-lg p-3 ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={activarRecordatorio}
                    onChange={(e) => setActivarRecordatorio(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                  <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                    Activar recordatorio
                  </span>
                </label>
                {activarRecordatorio && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Recordar</span>
                    <input
                      type="number" min={0} max={365} value={diasAntes}
                      onChange={(e) => setDiasAntes(e.target.value)}
                      className={`w-16 rounded-lg border px-2 py-1 text-sm text-center ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                    <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      día(s) antes de la fecha de entrega
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className={`text-xs flex items-center gap-2 px-3 py-2 rounded ${
                isDark ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                <AlertCircle className="h-3 w-3 shrink-0" /> {error}
              </div>
            )}

            <div className={`pt-3 border-t flex justify-end gap-2 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg text-sm ${
                  isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {createMutation.isPending ? 'Guardando...' : 'Crear actividad'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
