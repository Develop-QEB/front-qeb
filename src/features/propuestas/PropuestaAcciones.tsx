import { CheckCircle, Eye, MapPinned, Paintbrush, Share2 } from 'lucide-react';
import { Propuesta } from '../../types';
import { esPropuestaBloqueada } from './propuestaEstatus';

// Botones de accion de una propuesta: Aprobar, Asignar/Ver inventario, Prueba
// de color y Compartir. Era la ultima celda de PropuestaRow; se extrajo para
// que la tarjeta del tablero pinte EXACTAMENTE los mismos botones, con los
// mismos permisos y los mismos candados por estatus. Si una regla cambia,
// cambia en un solo lugar.
//
// `compact` solo achica padding e icono (tarjeta); la tabla lo deja en false
// y queda identica a como estaba.

// Estatus desde los que tiene sentido compartir con el cliente. Los de ajuste
// entran porque el asesor manda la vista compartir mientras corrige inventario
// o costos con el cliente. Se aceptan las dos grafias de "Cto Cliente".
const ESTATUS_COMPARTIR = ['Aprobada', 'Atendido', 'Pase a ventas', 'Ajuste Inventario', 'Ajuste Cto-Cliente', 'Ajuste CTO Cliente'];

export interface PropuestaAccionesProps {
  item: Propuesta;
  isDark: boolean;
  userRol: string;
  canAprobarPerm: boolean;
  canAsignarInventarioPerm: boolean;
  canCompartirPerm: boolean;
  canPruebaColor: boolean;
  onApprove: (item: Propuesta) => void;
  onAssign: (item: Propuesta) => void;
  onShare: (id: number) => void;
  onPruebaColor: (item: Propuesta) => void;
  compact?: boolean;
}

export function PropuestaAcciones({
  item,
  isDark,
  userRol,
  canAprobarPerm,
  canAsignarInventarioPerm,
  canCompartirPerm,
  canPruebaColor,
  onApprove,
  onAssign,
  onShare,
  onPruebaColor,
  compact = false,
}: PropuestaAccionesProps) {
  const isLocked = esPropuestaBloqueada(item, userRol);
  const btn = compact ? 'p-1.5 rounded-md' : 'p-2 rounded-lg';
  const ico = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const asignarDisabled = canAsignarInventarioPerm && (item.status === 'Aprobada' || isLocked);
  const puedeCompartir = ESTATUS_COMPARTIR.includes(item.status) && !isLocked;

  return (
    <div className="flex items-center gap-1">
      {canAprobarPerm && (
        <button
          onClick={() => onApprove(item)}
          disabled={item.status !== 'Pase a ventas' || isLocked}
          className={`${btn} border transition-all ${item.status !== 'Pase a ventas' || isLocked
            ? isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
            : isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300'
            }`}
          title={isLocked ? 'No disponible en este estatus' : (item.status !== 'Pase a ventas' ? 'Solo disponible con estatus Pase a ventas' : 'Aprobar propuesta')}
        >
          <CheckCircle className={ico} />
        </button>
      )}
      <button
        onClick={() => onAssign(item)}
        disabled={asignarDisabled}
        className={`${btn} border transition-all ${asignarDisabled
          ? isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
          : isDark ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 border-fuchsia-200 hover:border-fuchsia-300'
          }`}
        title={canAsignarInventarioPerm ? (isLocked ? 'No disponible en este estatus' : (item.status === 'Aprobada' ? 'No disponible para propuestas aprobadas' : (item.status === 'Pase a ventas' ? 'Ver Inventario (solo lectura)' : 'Asignar a Inventario'))) : 'Ver Propuesta'}
      >
        {canAsignarInventarioPerm && item.status !== 'Pase a ventas' ? <MapPinned className={ico} /> : <Eye className={ico} />}
      </button>
      {canPruebaColor && (
        <button
          onClick={() => onPruebaColor(item)}
          className={`${btn} border transition-all ${isDark
            ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40'
            : 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 border-fuchsia-200 hover:border-fuchsia-300'
          }`}
          title="Solicitar prueba de color"
        >
          <Paintbrush className={ico} />
        </button>
      )}
      {canCompartirPerm && (
        <button
          disabled={!puedeCompartir}
          onClick={() => puedeCompartir && onShare(item.id)}
          className={`${btn} border transition-all ${puedeCompartir
            ? isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 border-cyan-200 hover:border-cyan-300'
            : isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
            }`}
          title={isLocked ? 'No disponible en este estatus' : (puedeCompartir ? 'Compartir propuesta' : 'Disponible en Aprobada, Atendido, Pase a ventas, Ajuste Inventario y Ajuste Cto-Cliente')}
        >
          <Share2 className={ico} />
        </button>
      )}
    </div>
  );
}
