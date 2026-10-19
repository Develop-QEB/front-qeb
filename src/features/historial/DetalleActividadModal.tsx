import { X, Briefcase, Pencil, Calendar, AlertTriangle, Building2, Tag, Layers, User, Hash, Loader2 } from 'lucide-react';
import type { ActividadComercialTarea } from '../../services/historial.service';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import {
  COLUMNAS_AC, COLUMNA_LABEL, COLUMNA_COLOR, type ColumnaAC,
  columnaDeEstatus, esCancelada, parseContenidoAC, tituloCorto, estaVencida,
} from './actividadComercial';

// Detalle de una Actividad Comercial (click en la tarjeta del tablero).
// Ver todo + cambiar de columna + abrir el modal de edicion (si tiene permiso).
interface Props {
  tarea: ActividadComercialTarea;
  isDark: boolean;
  puedeEditar: boolean;
  moviendo: boolean;
  onClose: () => void;
  onMover: (columna: ColumnaAC) => void;
  onEditar: () => void;
}

// Par etiqueta/valor del detalle; no se pinta si el valor viene vacio.
function Campo({ icon: Icon, label, value, isDark }: {
  icon: typeof Tag; label: string; value: string | number | null | undefined; isDark: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;
  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${subText}`} />
      <div className="min-w-0">
        <div className={`text-[10px] uppercase tracking-wide ${subText}`}>{label}</div>
        <div className={`text-sm break-words ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</div>
      </div>
    </div>
  );
}

export function DetalleActividadModal({ tarea, isDark, puedeEditar, moviendo, onClose, onMover, onEditar }: Props) {
  const c = parseContenidoAC(tarea.contenido);
  const columna = columnaDeEstatus(tarea.estatus);
  const cancelada = esCancelada(tarea);
  const vencida = estaVencida(tarea);

  const headerText = isDark ? 'text-white' : 'text-gray-900';
  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  const panel = isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200';

  const cliente = c.cliente || tarea.cliente_nombre || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 px-6 py-4 border-b ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30">
                <Briefcase className="h-3 w-3" /> Actividad Comercial
              </span>
              <span className={`text-xs font-mono ${subText}`}>#{tarea.id}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${COLUMNA_COLOR[columna].bg} ${COLUMNA_COLOR[columna].text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${COLUMNA_COLOR[columna].dot}`} />
                {COLUMNA_LABEL[columna]}
              </span>
              {cancelada && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-600'}`}>Cancelada</span>
              )}
              {vencida && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">
                  <AlertTriangle className="h-3 w-3" /> Vencida
                </span>
              )}
            </div>
            <h3 className={`text-lg font-semibold leading-snug ${headerText}`}>{tituloCorto(tarea.titulo)}</h3>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Descripcion */}
          <div>
            <div className={`text-xs font-medium mb-1 ${subText}`}>Descripción</div>
            <p className={`text-sm whitespace-pre-wrap ${headerText}`}>{tarea.descripcion || <span className={subText}>Sin descripción</span>}</p>
          </div>

          {/* Informacion de la actividad */}
          <div className={`rounded-xl border p-4 ${panel}`}>
            <div className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" /> Información de la actividad
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <Campo isDark={isDark} icon={Building2} label="Cliente" value={cliente} />
              <Campo isDark={isDark} icon={Tag} label="Marca" value={c.marca} />
              <Campo isDark={isDark} icon={Tag} label="Tipo" value={c.subtipo ? (c.ref_id != null ? `${c.subtipo} #${c.ref_id}` : c.subtipo) : null} />
              <Campo isDark={isDark} icon={Hash} label="CUIC" value={tarea.cuic} />
              <Campo isDark={isDark} icon={User} label="Asesor de la cuenta" value={tarea.asesor} />
              <Campo isDark={isDark} icon={Layers} label="Catorcena / Año" value={[c.catorcena ? `Cat ${c.catorcena}` : null, c.anio].filter(Boolean).join(' / ') || null} />
              <Campo isDark={isDark} icon={Tag} label="Estatus de la actividad" value={c.estatus_actividad} />
              <Campo isDark={isDark} icon={Tag} label="Base" value={c.base} />
              <Campo isDark={isDark} icon={Hash} label="Campaña" value={tarea.campania_id ? `#${tarea.campania_id}` : null} />
              <Campo isDark={isDark} icon={Hash} label="Propuesta" value={tarea.id_propuesta ? `#${tarea.id_propuesta}` : null} />
            </div>
          </div>

          {/* Seguimiento */}
          <div className={`rounded-xl border p-4 ${panel}`}>
            <div className={`text-xs font-medium uppercase tracking-wider mb-3 ${subText}`}>Seguimiento</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                {tarea.responsable && <UserAvatar nombre={tarea.responsable} size="sm" />}
                <div>
                  <div className={`text-[10px] uppercase tracking-wide ${subText}`}>Responsable</div>
                  <div className={`text-sm ${headerText}`}>{tarea.responsable || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${vencida ? 'text-red-400' : subText}`} />
                <div>
                  <div className={`text-[10px] uppercase tracking-wide ${subText}`}>Inicio → Entrega</div>
                  <div className={`text-sm ${vencida ? 'text-red-400' : headerText}`}>{formatDate(tarea.fecha_inicio)} → {formatDate(tarea.fecha_fin)}</div>
                </div>
              </div>
              {tarea.created_at && <Campo isDark={isDark} icon={Calendar} label="Registrada" value={formatDate(tarea.created_at)} />}
              <Campo isDark={isDark} icon={Tag} label="Estatus en tareas" value={tarea.estatus} />
            </div>
          </div>

          {/* Mover de columna */}
          <div>
            <div className={`text-xs font-medium mb-2 ${subText}`}>Mover a</div>
            <div className="flex flex-wrap gap-2">
              {COLUMNAS_AC.map(col => {
                const actual = col === columna;
                const cc = COLUMNA_COLOR[col];
                return (
                  <button
                    key={col}
                    disabled={actual || moviendo}
                    onClick={() => onMover(col)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:cursor-default ${
                      actual
                        ? `${cc.bg} ${cc.border} ${cc.text} font-medium`
                        : `${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} disabled:opacity-50`
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${cc.dot}`} />
                    {COLUMNA_LABEL[col]}
                    {actual && <span className="text-[10px] opacity-70">(actual)</span>}
                  </button>
                );
              })}
              {moviendo && <Loader2 className={`h-4 w-4 animate-spin self-center ${subText}`} />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 flex items-center justify-end gap-2 px-6 py-3 border-t ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
          {puedeEditar && (
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar actividad
            </button>
          )}
          <button
            onClick={onClose}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
