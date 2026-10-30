import { Edit2, Eye, MessageSquare, PlayCircle, Trash2 } from 'lucide-react';
import { Solicitud } from '../../types';

// Botones de accion de una solicitud: Ver, Editar, Atender, Estatus/comentarios
// y Rechazar. Era la ultima celda de SolicitudRow; se extrajo para que la
// tarjeta del tablero pinte EXACTAMENTE los mismos botones con los mismos
// permisos y candados: una 'Atendida' ya se fue a Propuestas y aqui no se
// edita, no cambia de estatus ni se rechaza.
//
// `compact` solo achica padding e icono (tarjeta); la tabla lo deja en false.

/** Misma regla en fila, celda de estatus y tarjeta: una Atendida ya se fue a Propuestas. */
export function puedeCambiarStatusSolicitud(s: Pick<Solicitud, 'status'>): boolean {
  return s.status !== 'Atendida';
}

export interface SolicitudAccionesProps {
  item: Solicitud;
  isDark: boolean;
  canEditPerm: boolean;
  canAtenderPerm: boolean;
  canDeletePerm: boolean;
  canChangeEstadoPerm: boolean;
  onView: (item: Solicitud) => void;
  onEdit: (item: Solicitud) => void;
  onAtender: (item: Solicitud) => void;
  onStatus: (item: Solicitud) => void;
  onDelete: (id: number) => void;
  compact?: boolean;
}

export function SolicitudAcciones({
  item,
  isDark,
  canEditPerm,
  canAtenderPerm,
  canDeletePerm,
  canChangeEstadoPerm,
  onView,
  onEdit,
  onAtender,
  onStatus,
  onDelete,
  compact = false,
}: SolicitudAccionesProps) {
  const isDesactivada = item.status === 'Desactivada';
  const isAprobada = item.status === 'Aprobada';
  const isAtendida = item.status === 'Atendida';

  const canEdit = !isDesactivada && !isAprobada && !isAtendida;
  const canAtender = isAprobada;
  const canChangeStatus = puedeCambiarStatusSolicitud(item);
  const canDelete = !isDesactivada && !isAprobada && !isAtendida;

  const btn = compact ? 'p-1.5 rounded-md' : 'p-2 rounded-lg';
  const ico = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const off = `${isDark ? 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30' : 'bg-gray-100 text-gray-400 border-gray-200'} cursor-not-allowed`;

  return (
    <div className="flex items-center gap-1">
      {/* Ver */}
      <button
        onClick={(e) => { e.stopPropagation(); onView(item); }}
        className={`${btn} transition-all border ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border-purple-500/20 hover:border-purple-500/40' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 border-purple-200 hover:border-purple-300'}`}
        title="Ver detalles"
      >
        <Eye className={ico} />
      </button>

      {/* Editar */}
      {canEditPerm && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          disabled={!canEdit}
          className={`${btn} transition-all border ${canEdit
            ? isDark ? 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border-zinc-500/20 hover:border-zinc-500/40' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-gray-200 hover:border-gray-300'
            : off
            }`}
          title={canEdit ? 'Editar solicitud' : 'No disponible'}
        >
          <Edit2 className={ico} />
        </button>
      )}

      {/* Atender */}
      {canAtenderPerm && (
        <button
          onClick={(e) => { e.stopPropagation(); onAtender(item); }}
          disabled={!canAtender}
          className={`${btn} transition-all border ${canAtender
            ? isDark ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 border-fuchsia-200 hover:border-fuchsia-300'
            : off
            }`}
          title={canAtender ? 'Atender solicitud' : 'Solo disponible para solicitudes aprobadas'}
        >
          <PlayCircle className={ico} />
        </button>
      )}

      {/* Estatus/Comentarios */}
      <button
        onClick={(e) => { e.stopPropagation(); if (canChangeStatus) onStatus(item); }}
        disabled={!canChangeStatus}
        className={`${btn} transition-all border ${canChangeStatus
          ? isDark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border-amber-500/20 hover:border-amber-500/40' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border-amber-200 hover:border-amber-300'
          : off
          }`}
        title={!canChangeStatus ? 'No disponible' : canChangeEstadoPerm ? 'Ver/Cambiar estatus' : 'Ver estatus y comentarios'}
      >
        <MessageSquare className={ico} />
      </button>

      {/* Rechazar (marca status='Rechazada' + libera reservas, NO elimina) */}
      {canDeletePerm && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          disabled={!canDelete}
          className={`${btn} transition-all border ${canDelete
            ? isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20 hover:border-red-500/40' : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200 hover:border-red-300'
            : off
            }`}
          title={canDelete ? 'Rechazar solicitud' : 'No disponible'}
        >
          <Trash2 className={ico} />
        </button>
      )}
    </div>
  );
}
