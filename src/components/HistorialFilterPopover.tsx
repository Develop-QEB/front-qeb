import { useState, useEffect } from 'react';
import { History, X, ChevronDown } from 'lucide-react';

export interface HistorialFilterValues {
  cambioEstatusDesde?: string;
  cambioEstatusHasta?: string;
  creacionDesde?: string;
  creacionHasta?: string;
}

/**
 * Popover de filtros por historial: rango de fechas para
 *  - cambios de estatus (cualquier cambio en el rango)
 *  - fecha de creacion
 * Se usa en los listados de Solicitudes, Propuestas y Campañas.
 * Independiente del filtro de periodo (catorcena) — no requiere catorcena.
 */
export function HistorialFilterPopover({
  values,
  onApply,
  onClear,
  isDark,
}: {
  values: HistorialFilterValues;
  onApply: (v: HistorialFilterValues) => void;
  onClear: () => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ceDesde, setCeDesde] = useState(values.cambioEstatusDesde || '');
  const [ceHasta, setCeHasta] = useState(values.cambioEstatusHasta || '');
  const [crDesde, setCrDesde] = useState(values.creacionDesde || '');
  const [crHasta, setCrHasta] = useState(values.creacionHasta || '');

  useEffect(() => {
    setCeDesde(values.cambioEstatusDesde || '');
    setCeHasta(values.cambioEstatusHasta || '');
    setCrDesde(values.creacionDesde || '');
    setCrHasta(values.creacionHasta || '');
  }, [values.cambioEstatusDesde, values.cambioEstatusHasta, values.creacionDesde, values.creacionHasta]);

  const isActive = !!(values.cambioEstatusDesde || values.cambioEstatusHasta || values.creacionDesde || values.creacionHasta);
  const canApply = !!(ceDesde || ceHasta || crDesde || crHasta);

  const handleApply = () => {
    onApply({
      cambioEstatusDesde: ceDesde || undefined,
      cambioEstatusHasta: ceHasta || undefined,
      creacionDesde: crDesde || undefined,
      creacionHasta: crHasta || undefined,
    });
    setOpen(false);
  };

  const handleClear = () => {
    setCeDesde(''); setCeHasta(''); setCrDesde(''); setCrHasta('');
    onClear();
    setOpen(false);
  };

  const inputCls = `w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`;
  const labelCls = `text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${isActive
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
          : `${isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'}`
          }`}
        title="Filtrar por fechas de historial (cambios de estatus / creacion)"
      >
        <History className="h-3 w-3" />
        <span>Historial</span>
        {isActive ? (
          <X className={`h-3 w-3 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); handleClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
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
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>Rango de fechas segun cambios de estatus o creacion</p>
            </div>

            <div className="p-3 space-y-3">
              <div>
                <p className={`text-[11px] font-medium mb-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Cambios de estatus</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Desde</label>
                    <input type="date" value={ceDesde} max={ceHasta || undefined} onChange={(e) => setCeDesde(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Hasta</label>
                    <input type="date" value={ceHasta} min={ceDesde || undefined} onChange={(e) => setCeHasta(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <p className={`text-[11px] font-medium mb-1.5 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Fecha de creacion</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Desde</label>
                    <input type="date" value={crDesde} max={crHasta || undefined} onChange={(e) => setCrDesde(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Hasta</label>
                    <input type="date" value={crHasta} min={crDesde || undefined} onChange={(e) => setCrHasta(e.target.value)} className={inputCls} />
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
