import { AlertTriangle, ArrowUpDown, Star } from 'lucide-react';
import { ORDEN_RAPIDO_OPCIONES, ORDEN_RAPIDO_DEFAULT, type OrdenRapido } from '../../lib/tableroVistas';

// Filtros rapidos de orden + "solo incompletos". Van en la barra de filtros de
// la pagina, no dentro del tablero, porque aplican igual a la Vista Tabla y a
// la Vista Tablero: el usuario no deberia tener que reordenar al cambiar de
// vista.

interface OrdenRapidoChipsProps {
  isDark: boolean;
  orden: OrdenRapido;
  onOrdenChange: (orden: OrdenRapido) => void;
  soloIncompletos: boolean;
  onSoloIncompletosChange: (valor: boolean) => void;
  /** Texto del tooltip del filtro de incompletos ("propuestas" / "campanas"). */
  entidadPlural: string;
}

export function OrdenRapidoChips({
  isDark,
  orden,
  onOrdenChange,
  soloIncompletos,
  onSoloIncompletosChange,
  entidadPlural,
}: OrdenRapidoChipsProps) {
  const chipBase = 'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border';
  const chipOff = isDark
    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
    : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300';
  const chipOn = isDark
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    : 'bg-purple-100 text-purple-700 border-purple-200';
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <>
      <span className={`text-xs ${sub} mr-1 inline-flex items-center gap-1`}>
        <ArrowUpDown className="h-3 w-3" />
        Ordenar:
      </span>
      {ORDEN_RAPIDO_OPCIONES.map(opt => (
        <button
          key={opt.value}
          onClick={() => onOrdenChange(opt.value)}
          title={opt.hint}
          className={`${chipBase} ${orden === opt.value ? chipOn : chipOff}`}
        >
          {/* La estrella marca el orden fijo del tablero (ultimo cambio arriba). */}
          {opt.value === ORDEN_RAPIDO_DEFAULT && <Star className="h-3 w-3" />}
          {opt.label}
        </button>
      ))}

      <div className={`h-4 w-px mx-1 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'}`} />

      <button
        onClick={() => onSoloIncompletosChange(!soloIncompletos)}
        title={`Solo ${entidadPlural} con menos reservas que caras esperadas`}
        className={`${chipBase} ${soloIncompletos
          ? (isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-300')
          : chipOff}`}
      >
        <AlertTriangle className="h-3 w-3" />
        Solo incompletos
      </button>
    </>
  );
}
