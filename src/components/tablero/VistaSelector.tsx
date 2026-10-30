import { Star, type LucideIcon } from 'lucide-react';

// Selector compacto de vista del modulo (Tabla / Desglose / Tablero...).
//
// Sustituye a los 2-3 botones sueltos que tenian las paginas: un solo grupo
// segmentado con icono + etiqueta (la etiqueta se esconde en pantallas chicas
// y queda el icono con tooltip), mas una estrella para FIJAR la vista actual
// como la que abre el modulo. Asi cabe en la barra aunque haya tres vistas y
// la estrella no se repite tres veces.

export interface VistaOpcion<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
}

interface VistaSelectorProps<T extends string> {
  isDark: boolean;
  opciones: readonly VistaOpcion<T>[];
  value: T;
  onChange: (vista: T) => void;
  /** Vista con la que abre el modulo (null = la default del modulo). */
  fija: T | null;
  onFijar: (vista: T | null) => void;
}

export function VistaSelector<T extends string>({
  isDark,
  opciones,
  value,
  onChange,
  fija,
  onFijar,
}: VistaSelectorProps<T>) {
  const esFijaLaActual = fija === value;

  return (
    <div
      className={`inline-flex items-center rounded-xl border p-1 gap-0.5 ${
        isDark ? 'bg-zinc-800/60 border-zinc-700/50' : 'bg-gray-100 border-gray-200'
      }`}
      role="tablist"
      aria-label="Vista"
    >
      {opciones.map(op => {
        const activa = op.key === value;
        const Icon = op.icon;
        return (
          <button
            key={op.key}
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(op.key)}
            title={op.key === fija ? `${op.label} (vista fija)` : op.label}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activa
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-white text-purple-700 border border-purple-200 shadow-sm'
                : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200 border border-transparent'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden lg:inline">{op.label}</span>
            {/* Marca discreta en la vista fija para que se vea cual es sin abrir nada */}
            {op.key === fija && !activa && (
              <Star className="h-2.5 w-2.5 text-amber-400" fill="currentColor" />
            )}
          </button>
        );
      })}

      <div className={`h-5 w-px mx-0.5 ${isDark ? 'bg-zinc-700/60' : 'bg-gray-300'}`} />

      <button
        onClick={() => onFijar(esFijaLaActual ? null : value)}
        title={esFijaLaActual
          ? 'El módulo abre en esta vista. Clic para quitarla como fija.'
          : 'Fijar esta vista: el módulo abrirá siempre aquí'}
        className={`p-2 rounded-lg transition-all ${
          esFijaLaActual
            ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
            : isDark ? 'text-zinc-500 hover:text-amber-300 hover:bg-zinc-800' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-200'
        }`}
      >
        <Star className="h-4 w-4" fill={esFijaLaActual ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
