import React from 'react';
import { Circle, RefreshCw } from 'lucide-react';

// Tablero genérico de columnas por estatus, compartido por Propuestas y
// Campañas. Mismo lenguaje visual que el tablero de Actividad Comercial
// (ver features/historial/ActividadComercialBoard), con dos diferencias:
//
// 1. Es de SOLO LECTURA: no hay drag & drop. Cambiar estatus pasa por el modal
//    de cada módulo, que es el que valida permisos, aprobaciones y exige el
//    comentario de cambio de estado. Arrastrar se brincaría todo eso.
// 2. Soporta hasta ~7 columnas, así que scrollea en horizontal con ancho fijo
//    por columna en vez de usar un grid que las aplastaría.

export interface TableroColumnaColor {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface TableroColumna {
  /** Clave canónica de la columna. Es el valor con el que se agrupa. */
  key: string;
  label: string;
  descripcion?: string;
  color: TableroColumnaColor;
  /**
   * Otros estatus que caen en esta columna (variantes históricas en BD).
   * Se comparan normalizados — ver normalizaEstatus en lib/tableroVistas.
   */
  alias?: readonly string[];
}

interface TableroBoardProps<T> {
  /** Solo las columnas visibles, en el orden en que se deben pintar. */
  columnas: TableroColumna[];
  items: T[];
  /** Columna a la que pertenece el item. `null` si no cae en ninguna. */
  getColumnaKey: (item: T) => string | null;
  getId: (item: T) => number | string;
  renderCard: (item: T) => React.ReactNode;
  isDark: boolean;
  isLoading?: boolean;
  /** Qué se está contando, para los textos vacíos ("Sin propuestas"). */
  entidadPlural: string;
}

export function TableroBoard<T>({
  columnas,
  items,
  getColumnaKey,
  getId,
  renderCard,
  isDark,
  isLoading = false,
  entidadPlural,
}: TableroBoardProps<T>) {
  // Un solo recorrido sobre los items: con 5k propuestas, un filter por
  // columna serían 7 recorridos completos en cada render.
  const porColumna = React.useMemo(() => {
    const grupos = new Map<string, T[]>();
    columnas.forEach(c => grupos.set(c.key, []));
    items.forEach(item => {
      const key = getColumnaKey(item);
      if (key === null) return;
      grupos.get(key)?.push(item);
    });
    return grupos;
  }, [columnas, items, getColumnaKey]);

  // Items que no cayeron en ninguna columna visible: se avisa para que nadie
  // crea que el tablero muestra todo el universo filtrado.
  const fuera = React.useMemo(() => {
    let visibles = 0;
    porColumna.forEach(lista => { visibles += lista.length; });
    return items.length - visibles;
  }, [porColumna, items.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (columnas.length === 0) {
    return (
      <div className={`rounded-2xl border py-16 text-center ${isDark ? 'border-purple-500/20 bg-zinc-900/50 text-zinc-400' : 'border-gray-200 bg-white text-gray-500'}`}>
        <p className="text-sm font-medium">No hay columnas visibles</p>
        <p className="text-xs mt-1 opacity-70">Abre “Columnas” y elige al menos un estatus.</p>
      </div>
    );
  }

  const subText = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className="space-y-2">
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {columnas.map(col => {
          const lista = porColumna.get(col.key) || [];
          return (
            <div
              key={col.key}
              className={`flex-shrink-0 w-[270px] rounded-xl border ${col.color.border}`}
            >
              <div className={`flex items-start justify-between gap-2 px-3 py-2.5 rounded-t-xl ${col.color.bg}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.color.dot}`} />
                    <span className={`text-sm font-semibold truncate ${col.color.text}`} title={col.label}>
                      {col.label}
                    </span>
                  </div>
                  {col.descripcion && (
                    <p className={`text-[10px] mt-0.5 ${subText}`}>{col.descripcion}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {lista.length}
                </span>
              </div>
              <div className={`p-2 rounded-b-xl min-h-[240px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-2 ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50/60'}`}>
                {lista.map(item => (
                  <React.Fragment key={getId(item)}>{renderCard(item)}</React.Fragment>
                ))}
                {lista.length === 0 && (
                  <div className={`flex flex-col items-center justify-center py-10 ${isDark ? 'text-zinc-600' : 'text-gray-300'}`}>
                    <Circle className="h-7 w-7 mb-2 opacity-50" />
                    <span className="text-xs">Sin {entidadPlural}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {fuera > 0 && (
        <p className={`text-xs ${subText}`}>
          {fuera} {fuera === 1 ? `${entidadPlural.replace(/s$/, '')} no entra` : `${entidadPlural} no entran`} en las columnas visibles
          (otro estatus). Actívalas en “Columnas” para verlas.
        </p>
      )}
    </div>
  );
}

// ---------- Tarjeta ----------

interface TableroCardProps {
  isDark: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}

/** Chrome común de las tarjetas, para que los dos tableros se vean igual. */
export function TableroCard({ isDark, onClick, title, children }: TableroCardProps) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={`group rounded-xl border p-2.5 transition-all ${
        isDark
          ? 'bg-zinc-800/60 border-zinc-700/60 hover:border-zinc-600'
          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </div>
  );
}
