import { AlertTriangle, Edit2, Eye, Paintbrush, Share2 } from 'lucide-react';
import { Campana } from '../../types';

// Botones de accion de una campana: Abrir, Compartir, Prueba de color, Editar
// e Incidencia. Era la ultima celda de CampanaRow; se extrajo para que la
// tarjeta del tablero pinte EXACTAMENTE los mismos botones con los mismos
// permisos y candados (Editar deshabilitado con APS o estatus cerrado).
//
// `compact` solo achica padding e icono (tarjeta); la tabla lo deja en false.

export interface CampanaAccionesProps {
  item: Campana;
  isDark: boolean;
  canEditPerm: boolean;
  canSeeGestionArtesPerm: boolean;
  canPruebaColor: boolean;
  /** Lo calcula la pagina (isEditDisabled): APS asignados o estatus cerrado. */
  isEditDisabled: boolean;
  onOpen: (id: number) => void;
  onShare: (propuestaId: number) => void;
  onEdit: (item: Campana) => void;
  onIncidencia: (item: Campana) => void;
  onPruebaColor: (item: Campana) => void;
  compact?: boolean;
}

export function CampanaAcciones({
  item,
  isDark,
  canEditPerm,
  canSeeGestionArtesPerm,
  canPruebaColor,
  isEditDisabled,
  onOpen,
  onShare,
  onEdit,
  onIncidencia,
  onPruebaColor,
  compact = false,
}: CampanaAccionesProps) {
  const btn = compact ? 'p-1.5 rounded-md' : 'p-2 rounded-lg';
  const ico = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onOpen(item.id)}
        className={`${btn} ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border-purple-500/20 hover:border-purple-500/40' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 border-purple-200 hover:border-purple-300'} border transition-all`}
        title="Abrir campaña"
      >
        <Eye className={ico} />
      </button>
      {item.propuesta_id && (
        <button
          onClick={() => onShare(item.propuesta_id!)}
          className={`${btn} ${isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 border-cyan-200 hover:border-cyan-300'} border transition-all`}
          title="Compartir campaña"
        >
          <Share2 className={ico} />
        </button>
      )}
      {canPruebaColor && item.propuesta_id && (
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
      {canEditPerm && (
        <button
          onClick={() => onEdit(item)}
          disabled={isEditDisabled}
          className={`${btn} border transition-all ${
            isEditDisabled
              ? isDark
                ? 'bg-zinc-800/30 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : isDark
                ? 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border-zinc-500/20 hover:border-zinc-500/40'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
          title={isEditDisabled ? 'No editable (tiene APS o status no permite edición)' : 'Editar campaña'}
        >
          <Edit2 className={ico} />
        </button>
      )}
      {canSeeGestionArtesPerm && (
        <button
          onClick={() => onIncidencia(item)}
          className={`${btn} border bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 border-orange-500/20 hover:border-orange-500/40 transition-all`}
          title="Reportar incidencia"
        >
          <AlertTriangle className={ico} />
        </button>
      )}
    </div>
  );
}
