import { useMemo, useState } from 'react';
import { Check, ChevronDown, Columns3 } from 'lucide-react';
import type { TableroColumna } from './TableroBoard';

// Selector de columnas visibles del tablero.
//
// Las vistas guardadas (columnas + orden + incompletos + filtros de la barra)
// ya no viven aqui: estan en VistasGuardadasMenu, junto al boton "Filtros" de
// la pagina, porque una vista aplica igual en Tabla, Desglose y Tablero. Aqui
// queda solo lo que unicamente tiene sentido con el tablero a la vista.

interface TableroVistasControlsProps {
  isDark: boolean;
  /** Todas las columnas posibles del modulo, en orden canonico. */
  todasColumnas: readonly TableroColumna[];
  columnasVisibles: string[];
  onColumnasChange: (columnas: string[]) => void;
}

export function TableroVistasControls({
  isDark,
  todasColumnas,
  columnasVisibles,
  onColumnasChange,
}: TableroVistasControlsProps) {
  const keysValidas = useMemo(() => todasColumnas.map(c => c.key), [todasColumnas]);
  const [showColumnas, setShowColumnas] = useState(false);

  // Mantiene el orden canonico de las columnas aunque se activen en otro orden:
  // el tablero debe leerse siempre como el flujo del proceso.
  const toggleColumna = (key: string) => {
    const activas = new Set(columnasVisibles);
    if (activas.has(key)) activas.delete(key);
    else activas.add(key);
    onColumnasChange(keysValidas.filter(k => activas.has(k)));
  };

  const chipBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border';
  const chipOff = isDark
    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
    : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300';
  const chipOn = isDark
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    : 'bg-purple-100 text-purple-700 border-purple-200';
  const popover = `absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border shadow-2xl overflow-hidden ${
    isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'
  }`;
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className="relative">
      <button
        onClick={() => setShowColumnas(!showColumnas)}
        className={`${chipBase} ${columnasVisibles.length !== todasColumnas.length ? chipOn : chipOff}`}
      >
        <Columns3 className="h-3 w-3" />
        Columnas
        <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white">
          {columnasVisibles.length}/{todasColumnas.length}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {showColumnas && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowColumnas(false)} />
          <div className={popover}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <p className={`text-[10px] uppercase tracking-wide ${sub}`}>Columnas visibles</p>
              <p className={`text-[10px] mt-0.5 ${sub}`}>Para guardarlas con nombre usa "Vistas", junto a Filtros.</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {todasColumnas.map(col => {
                const activa = columnasVisibles.includes(col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleColumna(col.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                      isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'
                    } ${activa ? (isDark ? 'text-purple-200' : 'text-purple-700') : (isDark ? 'text-zinc-400' : 'text-gray-500')}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      activa ? 'bg-purple-600 border-purple-600' : isDark ? 'border-purple-500/50' : 'border-purple-300'
                    }`}>
                      {activa && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.color.dot}`} />
                    <span className="flex-1 text-left truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <button
                onClick={() => onColumnasChange([...keysValidas])}
                className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Todas
              </button>
              <button
                onClick={() => onColumnasChange([])}
                className={`text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Ninguna
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
