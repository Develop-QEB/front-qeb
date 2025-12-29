import { useMemo } from 'react';
import { Calendar, Circle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Notificacion } from '../../types';
import { formatDate } from '../../lib/utils';
import { getStatusConfig, getTipoConfig } from '../../lib/taskConfig';
import { UserAvatar } from '../../components/ui/user-avatar';



const KANBAN_COLUMNS = [
  { key: 'Pendiente', label: 'Pendiente', color: 'blue' },
  { key: 'Activo', label: 'En Progreso', color: 'amber' },
  { key: 'Urgente', label: 'Urgente', color: 'red' },
  { key: 'Atendido', label: 'Completado', color: 'emerald' },
];

function KanbanCard({
  tarea,
  onSelect,
}: {
  tarea: Notificacion;
  onSelect: () => void;
}) {
  const statusConfig = getStatusConfig(tarea.estatus);
  const tipoConfig = getTipoConfig(tarea.tipo);

  return (
    <div
      onClick={onSelect}
      className="bg-zinc-800/50 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600 rounded-xl p-3 cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${tipoConfig.bg} ${tipoConfig.color}`}>
          {tarea.tipo}
        </span>
        {tarea.referencia_id && (
          <span className="text-[10px] text-zinc-600">#{tarea.referencia_id}</span>
        )}
      </div>
      <h4 className="text-sm font-medium text-white mb-1 line-clamp-2 group-hover:text-purple-300 transition-colors">
        {tarea.titulo}
      </h4>
      {tarea.mensaje && (
        <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{tarea.mensaje}</p>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
        {tarea.fecha_fin ? (
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(tarea.fecha_fin)}</span>
          </div>
        ) : <span />}
        {tarea.asignado && (
          <div className="flex items-center gap-1" title={tarea.asignado}>
            <UserAvatar nombre={tarea.asignado} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tareas,
  onSelectTarea,
}: {
  column: typeof KANBAN_COLUMNS[0];
  tareas: Notificacion[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  const colorClasses: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  };
  const colors = colorClasses[column.color] || colorClasses.blue;

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${colors.bg} border ${colors.border} border-b-0`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className={`text-sm font-medium ${colors.text}`}>{column.label}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">{tareas.length}</span>
      </div>
      <div className={`p-2 rounded-b-xl border ${colors.border} border-t-0 bg-zinc-900/30 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-2`}>
        {tareas.map((tarea) => (
          <KanbanCard key={tarea.id} tarea={tarea} onSelect={() => onSelectTarea(tarea)} />
        ))}
        {tareas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
            <Circle className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-xs">Sin tareas</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TableroView({
  tareas,
  onSelectTarea,
}: {
  tareas: Notificacion[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  const tareasPorEstatus = useMemo(() => {
    const grouped: Record<string, Notificacion[]> = {};
    KANBAN_COLUMNS.forEach(col => { grouped[col.key] = []; });
    tareas.forEach(tarea => {
      const estatus = tarea.estatus || 'Pendiente';
      if (grouped[estatus]) { grouped[estatus].push(tarea); }
      else { grouped['Pendiente'].push(tarea); }
    });
    return grouped;
  }, [tareas]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((column) => (
        <KanbanColumn key={column.key} column={column} tareas={tareasPorEstatus[column.key] || []} onSelectTarea={onSelectTarea} />
      ))}
    </div>
  );
}
