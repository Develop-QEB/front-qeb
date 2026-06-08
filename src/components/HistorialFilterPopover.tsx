import { useState, useEffect } from 'react';
import { History, X, ChevronDown } from 'lucide-react';

// Filtro por historial — rangos de fecha aplicados al historial guardado del
// registro (tabla `historial`). Se usa en los listados de Solicitudes,
// Propuestas y Campanas. Independiente del filtro de Periodo (catorcena).
//
// UX: el usuario primero elige el MODO (creacion o cambio de estatus) y
// despues las fechas. Si elige "cambio de estatus" puede ademas elegir un
// estatus especifico (ej. "Pase a ventas") para filtrar solo los registros
// que tuvieron ese cambio en el rango.
export type HistorialFilterModo = 'creacion' | 'cambio_estatus';

export interface HistorialFilterValues {
  modo?: HistorialFilterModo;
  fechaDesde?: string;
  fechaHasta?: string;
  estatusValor?: string; // solo aplica si modo === 'cambio_estatus'
}

interface Props {
  values: HistorialFilterValues;
  estatusOptions: string[];   // Estatus posibles para esta entidad
  onApply: (v: HistorialFilterValues) => void;
  onClear: () => void;
  isDark: boolean;
}

function formatChip(values: HistorialFilterValues): string {
  if (!values.modo) return 'Historial';
  const desde = values.fechaDesde || '...';
  const hasta = values.fechaHasta || '...';
  if (values.modo === 'creacion') return `Creación: ${desde} → ${hasta}`;
  const estatus = values.estatusValor || 'cualquier estatus';
  return `Cambió a ${estatus}: ${desde} → ${hasta}`;
}

export function HistorialFilterPopover({
  values,
  estatusOptions,
  onApply,
  onClear,
  isDark,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<HistorialFilterModo>(values.modo || 'creacion');
  const [desde, setDesde] = useState(values.fechaDesde || '');
  const [hasta, setHasta] = useState(values.fechaHasta || '');
  const [estatus, setEstatus] = useState(values.estatusValor || '');

  useEffect(() => {
    setModo(values.modo || 'creacion');
    setDesde(values.fechaDesde || '');
    setHasta(values.fechaHasta || '');
    setEstatus(values.estatusValor || '');
  }, [values.modo, values.fechaDesde, values.fechaHasta, values.estatusValor]);

  const isActive = !!values.modo;
  const canApply = !!(desde || hasta);

  const handleApply = () => {
    onApply({
      modo,
      fechaDesde: desde || undefined,
      fechaHasta: hasta || undefined,
      estatusValor: modo === 'cambio_estatus' ? (estatus || undefined) : undefined,
    });
    setOpen(false);
  };

  const handleClear = () => {
    setModo('creacion');
    setDesde('');
    setHasta('');
    setEstatus('');
    onClear();
    setOpen(false);
  };

  const inputCls = `w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`;
  const labelCls = `text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`;

  const tabBase = `flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all`;
  const tabActive = isDark
    ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
    : 'bg-purple-50 text-purple-700 border border-purple-300';
  const tabInactive = isDark
    ? 'text-zinc-400 hover:text-zinc-200 border border-transparent'
    : 'text-gray-500 hover:text-gray-700 border border-transparent';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 max-w-[260px] truncate ${isActive
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
          : `${isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'}`
          }`}
        title="Filtrar por historial (cambios de estatus / fecha de creación)"
      >
        <History className="h-3 w-3 shrink-0" />
        <span className="truncate">{formatChip(values)}</span>
        {isActive ? (
          <X className={`h-3 w-3 shrink-0 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); handleClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-80 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <History className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Filtro por Historial
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>Selecciona qué filtrar y luego el rango de fechas</p>
            </div>

            {/* Selector de modo: que se filtra */}
            <div className="px-3 pt-3">
              <label className={labelCls}>Filtrar por</label>
              <div className={`flex gap-1 rounded-lg p-1 ${isDark ? 'bg-zinc-800/60' : 'bg-gray-100'}`}>
                <button
                  type="button"
                  onClick={() => setModo('creacion')}
                  className={`${tabBase} ${modo === 'creacion' ? tabActive : tabInactive}`}
                >
                  Fecha de creación
                </button>
                <button
                  type="button"
                  onClick={() => setModo('cambio_estatus')}
                  className={`${tabBase} ${modo === 'cambio_estatus' ? tabActive : tabInactive}`}
                >
                  Cambio de estatus
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Si modo=cambio_estatus, dropdown para elegir un estatus
                  especifico (o cualquiera). */}
              {modo === 'cambio_estatus' && (
                <div>
                  <label className={labelCls}>Estatus al que cambió</label>
                  <select
                    value={estatus}
                    onChange={(e) => setEstatus(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Cualquier estatus</option>
                    {estatusOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>
                  {modo === 'creacion' ? 'Rango de fechas de creación' : 'Rango de fechas del cambio'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Desde</label>
                    <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Hasta</label>
                    <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleClear}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg border ${isDark ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  Limpiar
                </button>
                <button
                  onClick={handleApply}
                  disabled={!canApply}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
