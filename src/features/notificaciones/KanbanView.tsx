import { useMemo } from 'react';
import { Calendar, Circle } from 'lucide-react';
import { Notificacion } from '../../types';
import { formatDate } from '../../lib/utils';
import { getStatusConfig, getTipoConfig } from '../../lib/taskConfig';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useThemeStore } from '../../store/themeStore';

// Tablero de "Mis Tareas": una columna por TIPO de tarea (Seguimiento Propuesta,
// Instalación, Recepción, Actividad Comercial, Testigo, ...). Las columnas se
// derivan de las tareas recibidas (ya filtradas por la página: filtro rápido,
// chips de tipo, búsqueda), ordenadas por cantidad y luego por nombre.

interface Columna {
  tipo: string;
  tareas: Notificacion[];
}

function esAutorizacion(tipo?: string | null): boolean {
  return !!tipo && (tipo.includes('Autorización') || tipo.includes('Autorizacion'));
}

function KanbanCard({
  tarea,
  onSelect,
  isDark,
}: {
  tarea: Notificacion;
  onSelect: () => void;
  isDark: boolean;
}) {
  const statusConfig = getStatusConfig(tarea.estatus);
  const StatusIcon = statusConfig.icon;
  const resuelta = ['Atendido', 'Rechazado', 'Cancelado'].includes(tarea.estatus || '');
  const t = tarea as Notificacion & { cliente?: string | null; formatos?: string | null };

  const referencia = tarea.referencia_id
    ? `${tarea.referencia_tipo === 'propuesta' ? 'Propuesta' : tarea.referencia_tipo === 'campana' ? 'Campaña' : tarea.referencia_tipo === 'solicitud' ? 'Solicitud' : 'Ref'} #${tarea.referencia_id}`
    : null;

  return (
    <div
      onClick={onSelect}
      className={`${isDark ? 'bg-zinc-800/50 hover:bg-zinc-800/80 border-zinc-700/50 hover:border-zinc-600' : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'} border rounded-xl p-3 cursor-pointer transition-all group ${resuelta ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
          <StatusIcon className="h-3 w-3" />
          {tarea.estatus || 'Activo'}
        </span>
        <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>#{tarea.id}</span>
      </div>
      <h4 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-1 line-clamp-2 group-hover:text-purple-300 transition-colors`}>
        {tarea.titulo}
      </h4>
      {tarea.mensaje && (
        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} line-clamp-2 mb-2`}>{tarea.mensaje}</p>
      )}
      {(t.cliente || referencia) && (
        <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'} truncate mb-2`}>
          {t.cliente}{t.cliente && referencia ? ' · ' : ''}{referencia && <span className="text-purple-400">{referencia}</span>}
        </p>
      )}
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-zinc-700/50' : 'border-gray-200'}`}>
        {tarea.fecha_fin ? (
          <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            <Calendar className="h-3 w-3" />
            <span>{formatDate(tarea.fecha_fin)}</span>
          </div>
        ) : <span />}
        {tarea.asignado && (
          <div className="flex items-center gap-1" title={tarea.asignado}>
            <UserAvatar nombre={tarea.asignado.split(',')[0]?.trim()} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  columna,
  onSelectTarea,
  isDark,
}: {
  columna: Columna;
  onSelectTarea: (tarea: Notificacion) => void;
  isDark: boolean;
}) {
  const cfg = getTipoConfig(columna.tipo);
  const TipoIcon = cfg.icon;
  const auth = esAutorizacion(columna.tipo);
  const headerBg = auth ? 'bg-gradient-to-r from-orange-500/25 to-amber-500/20' : cfg.bg;
  const headerBorder = auth ? 'border-orange-400/50' : cfg.border;
  const headerText = auth ? 'text-orange-300' : cfg.color;
  const pendientes = columna.tareas.filter(t => !['Atendido', 'Rechazado', 'Cancelado'].includes(t.estatus || '')).length;

  return (
    <div className="flex-shrink-0 w-[300px] max-w-[85vw]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${headerBg} border ${headerBorder} border-b-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <TipoIcon className={`h-4 w-4 flex-shrink-0 ${headerText}`} />
          <span className={`text-sm font-medium truncate ${headerText}`} title={columna.tipo}>{columna.tipo}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {pendientes > 0 && pendientes !== columna.tareas.length && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300" title="Sin finalizar">{pendientes}</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>{columna.tareas.length}</span>
        </div>
      </div>
      <div className={`p-2 rounded-b-xl border ${headerBorder} border-t-0 ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50/50'} min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto space-y-2`}>
        {columna.tareas.map((tarea) => (
          <KanbanCard key={tarea.id} tarea={tarea} onSelect={() => onSelectTarea(tarea)} isDark={isDark} />
        ))}
        {columna.tareas.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-8 ${isDark ? 'text-zinc-600' : 'text-gray-300'}`}>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const columnas = useMemo<Columna[]>(() => {
    const porTipo = new Map<string, Notificacion[]>();
    for (const t of tareas) {
      const tipo = t.tipo || 'Sin tipo';
      const arr = porTipo.get(tipo);
      if (arr) arr.push(t); else porTipo.set(tipo, [t]);
    }
    return Array.from(porTipo.entries())
      .map(([tipo, lista]) => ({ tipo, tareas: lista }))
      .sort((a, b) => b.tareas.length - a.tareas.length || a.tipo.localeCompare(b.tipo));
  }, [tareas]);

  if (columnas.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
        <Circle className="h-10 w-10 mb-3 opacity-40" />
        <span className="text-sm">No hay tareas para mostrar en el tablero</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnas.map((col) => (
        <KanbanColumn key={col.tipo} columna={col} onSelectTarea={onSelectTarea} isDark={isDark} />
      ))}
    </div>
  );
}
