import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronRight,
  Calendar, User, FileText, X, List, LayoutGrid, CalendarDays,
  PanelRight, FolderOpen, Clock, CheckCircle, AlertCircle, Circle,
  MessageSquare, Send, Plus, Pencil, Trash2, StickyNote,
  Users, Tag, Building2, Download, Table2, ExternalLink, Bell, ClipboardList,
  Filter, Layers, ArrowUpDown, ArrowUp, ArrowDown, Check
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { notificacionesService, CaraAutorizacion, ResumenAutorizacion } from '../../services/notificaciones.service';
import { notasService, NotaPersonal } from '../../services/notas.service';
import { Notificacion, ComentarioTarea } from '../../types';
import { formatDate } from '../../lib/utils';
import { STATUS_CONFIG, getTipoConfig, getStatusConfig } from '../../lib/taskConfig';
import { useAuthStore } from '../../store/authStore';
import { TableroView } from './KanbanView';
import { UserAvatar } from '../../components/ui/user-avatar';

// ============ TIPOS ============
type ContentType = 'notificaciones' | 'tareas';
type ViewType = 'tablero' | 'lista' | 'calendario' | 'notas';
type GroupByType = 'estatus' | 'tipo' | 'fecha' | 'responsable' | 'asignado';
type OrderByType = 'fecha_fin' | 'fecha_inicio' | 'titulo' | 'estatus';
type DateFilterType = 'all' | 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

// Tipos para filtros avanzados (estilo Proveedores)
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterFieldConfig {
  field: keyof Notificacion;
  label: string;
  type: 'string' | 'number';
}

// Campos disponibles para filtrar/ordenar
const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'titulo', label: 'Título', type: 'string' },
  { field: 'tipo', label: 'Tipo', type: 'string' },
  { field: 'estatus', label: 'Estado', type: 'string' },
  { field: 'asignado', label: 'Asignado', type: 'string' },
  { field: 'responsable', label: 'Responsable', type: 'string' },
];

// Campos disponibles para agrupar
type GroupByField = 'estatus' | 'tipo' | 'asignado' | 'responsable' | 'fecha';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'estatus', label: 'Estado' },
  { field: 'tipo', label: 'Tipo' },
  { field: 'asignado', label: 'Asignado' },
  { field: 'responsable', label: 'Responsable' },
  { field: 'fecha', label: 'Fecha' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Función para aplicar filtros a los datos
function applyFilters(data: Notificacion[], filters: FilterCondition[]): Notificacion[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = item[filter.field as keyof Notificacion];
      const filterValue = filter.value;

      if (fieldValue === null || fieldValue === undefined) {
        return filter.operator === '!=' || filter.operator === 'not_contains';
      }

      const strValue = String(fieldValue).toLowerCase();
      const strFilterValue = filterValue.toLowerCase();

      switch (filter.operator) {
        case '=':
          return strValue === strFilterValue;
        case '!=':
          return strValue !== strFilterValue;
        case 'contains':
          return strValue.includes(strFilterValue);
        case 'not_contains':
          return !strValue.includes(strFilterValue);
        default:
          return true;
      }
    });
  });
}

interface NestedGroup {
  key: string;
  tareas: Notificacion[];
  subgroups?: NestedGroup[];
}

// ============ CONSTANTES ============

const DATE_FILTER_OPTIONS: { value: DateFilterType; label: string }[] = [
  { value: 'all', label: 'Todas las fechas' },
  { value: 'today', label: 'Hoy' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana pasada' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
];

const GROUP_BY_OPTIONS: { value: GroupByType; label: string; icon: typeof Circle }[] = [
  { value: 'estatus', label: 'Estado', icon: Circle },
  { value: 'tipo', label: 'Tipo', icon: Tag },
  { value: 'asignado', label: 'Asignado', icon: User },
  { value: 'responsable', label: 'Responsable', icon: Users },
  { value: 'fecha', label: 'Fecha', icon: Calendar },
];

// Función para verificar si una fecha está en el rango
function isDateInRange(dateStr: string | null | undefined, filter: DateFilterType): boolean {
  if (filter === 'all') return true;
  if (!dateStr) return false;

  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);

  const endOfLastWeek = new Date(startOfWeek);
  endOfLastWeek.setDate(startOfWeek.getDate() - 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  switch (filter) {
    case 'today':
      return date.toDateString() === today.toDateString();
    case 'this_week':
      return date >= startOfWeek && date <= endOfWeek;
    case 'last_week':
      return date >= startOfLastWeek && date <= endOfLastWeek;
    case 'this_month':
      return date >= startOfMonth && date <= endOfMonth;
    case 'last_month':
      return date >= startOfLastMonth && date <= endOfLastMonth;
    default:
      return true;
  }
}

// Función para obtener la clave de agrupación de una tarea
function getGroupKey(tarea: Notificacion, groupBy: GroupByType): string {
  switch (groupBy) {
    case 'estatus':
      return tarea.estatus || 'Sin estado';
    case 'tipo':
      return tarea.tipo || 'Sin tipo';
    case 'asignado':
      return tarea.asignado || 'Sin asignar';
    case 'responsable':
      return tarea.responsable || 'Sin responsable';
    case 'fecha':
      if (!tarea.fecha_creacion) return 'Sin fecha';
      const date = new Date(tarea.fecha_creacion);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Hoy';
      if (diffDays === -1) return 'Ayer';
      if (diffDays > -7 && diffDays < 0) return 'Esta semana';
      if (diffDays > -14 && diffDays <= -7) return 'Semana pasada';
      if (diffDays > -30 && diffDays <= -14) return 'Este mes';
      if (diffDays <= -30) return 'Anteriores';
      return 'Futuras';
    default:
      return 'Otros';
  }
}

// Función recursiva para agrupar tareas por múltiples criterios
function groupTareasRecursive(
  tareas: Notificacion[],
  groupByList: GroupByType[],
  level: number = 0
): NestedGroup[] {
  if (groupByList.length === 0 || level >= groupByList.length) {
    return [{ key: 'all', tareas }];
  }

  const currentGroupBy = groupByList[level];
  const groups: Record<string, Notificacion[]> = {};

  tareas.forEach(tarea => {
    const key = getGroupKey(tarea, currentGroupBy);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tarea);
  });

  return Object.entries(groups).map(([key, groupTareas]) => ({
    key,
    tareas: groupTareas,
    subgroups: level < groupByList.length - 1
      ? groupTareasRecursive(groupTareas, groupByList, level + 1)
      : undefined,
  }));
}

// ============ COMPONENTES AUXILIARES ============

// Fila de tarea mejorada (solo lectura)
function TareaRow({
  tarea,
  onSelect,
  showBorder = true,
}: {
  tarea: Notificacion;
  onSelect: () => void;
  showBorder?: boolean;
}) {
  const statusConfig = getStatusConfig(tarea.estatus);
  const tipoConfig = getTipoConfig(tarea.tipo);
  const StatusIcon = statusConfig.icon;
  const TipoIcon = tipoConfig.icon;
  const isNotificacion = tarea.tipo === 'Notificación';
  const isCompleted = tarea.estatus === 'Atendido';

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-all hover:bg-zinc-800/50 ${showBorder ? 'border-b border-zinc-800/60' : ''} ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Indicador de estado visual */}
      <div className={`w-1 h-8 rounded-full ${statusConfig.bg} ${isCompleted ? 'bg-emerald-500/40' : ''}`} />

      {/* Icono de estado */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${statusConfig.bg} border ${statusConfig.border}`}>
        <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
      </div>

      {/* Badge de tipo con color diferenciado */}
      <div className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg ${tipoConfig.bg} border ${tipoConfig.border}`}>
        <TipoIcon className={`h-3 w-3 ${tipoConfig.color}`} />
        <span className={`text-[11px] font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium group-hover:text-purple-300 transition-colors ${isCompleted ? 'line-through text-zinc-500' : 'text-white'}`}>
            {tarea.titulo}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">#{tarea.id}</span>
        </div>
        {tarea.mensaje && (
          <p className="text-xs text-zinc-500 truncate mt-0.5 max-w-md">{tarea.mensaje}</p>
        )}
      </div>

      {/* Metadatos agrupados */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {tarea.asignado && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/50" title={`Asignado: ${tarea.asignado}`}>
            <UserAvatar nombre={tarea.asignado} size="sm" />
            <span className="text-xs text-zinc-400 truncate max-w-16">{tarea.asignado}</span>
          </div>
        )}

        {!isNotificacion && (tarea.fecha_inicio || tarea.fecha_fin) && (
          <div className="hidden lg:flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-800/30">
            {tarea.fecha_inicio && (
              <div className="flex items-center gap-1 text-[11px] text-zinc-500" title="Fecha inicio">
                <Calendar className="h-3 w-3 text-blue-400" />
                <span>{formatDate(tarea.fecha_inicio)}</span>
              </div>
            )}
            {tarea.fecha_inicio && tarea.fecha_fin && <span className="text-zinc-700">→</span>}
            {tarea.fecha_fin && (
              <div className="flex items-center gap-1 text-[11px] text-zinc-500" title="Fecha fin">
                <Clock className="h-3 w-3 text-amber-400" />
                <span>{formatDate(tarea.fecha_fin)}</span>
              </div>
            )}
          </div>
        )}

        {tarea.responsable && (
          <span className="hidden xl:block text-[11px] text-zinc-600 px-2 py-1 rounded bg-zinc-800/30" title="Creador">
            {tarea.responsable}
          </span>
        )}

        {tarea.referencia_id && (
          <span className="text-[11px] font-mono px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            #{tarea.referencia_id}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente de tabla
function TareasTable({
  tareas,
  onSelectTarea,
}: {
  tareas: Notificacion[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-800/50 border-b border-zinc-700/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Título</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Asignado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Creador</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"># Propuesta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {tareas.map((tarea) => {
              const statusConfig = getStatusConfig(tarea.estatus);
              return (
                <tr
                  key={tarea.id}
                  onClick={() => onSelectTarea(tarea)}
                  className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-zinc-400">{tarea.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                      {tarea.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium">{tarea.titulo}</div>
                    {tarea.mensaje && (
                      <div className="text-xs text-zinc-500 truncate max-w-xs">{tarea.mensaje}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tarea.asignado ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar nombre={tarea.asignado} size="md" />
                        <span className="text-sm text-zinc-300">{tarea.asignado}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {tarea.fecha_creacion ? formatDate(tarea.fecha_creacion) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {tarea.responsable ? (
                      <span className="text-sm text-zinc-300">{tarea.responsable}</span>
                    ) : (
                      <span className="text-sm text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                      <statusConfig.icon className="h-3 w-3" />
                      {tarea.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-purple-400">
                    {tarea.referencia_id || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tareas.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-zinc-500">No hay notificaciones que mostrar</p>
        </div>
      )}
    </div>
  );
}

// Sección anidada recursiva
function NestedSection({
  group,
  level = 0,
  groupByList,
  onSelectTarea,
}: {
  group: NestedGroup;
  level?: number;
  groupByList: GroupByType[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  const [open, setOpen] = useState(true);
  const statusConfig = getStatusConfig(group.key);
  const currentGroupType = groupByList[level];
  const groupOption = GROUP_BY_OPTIONS.find(o => o.value === currentGroupType);

  // Colores por nivel de anidación
  const levelColors = [
    'border-purple-500/30 bg-purple-500/5',
    'border-blue-500/30 bg-blue-500/5',
    'border-emerald-500/30 bg-emerald-500/5',
    'border-amber-500/30 bg-amber-500/5',
    'border-pink-500/30 bg-pink-500/5',
  ];
  const levelColor = levelColors[level % levelColors.length];

  // Si es el grupo "all" (sin agrupaciones), mostrar solo las tareas
  if (group.key === 'all') {
    return (
      <div className="space-y-0">
        {group.tareas.map((tarea, idx) => (
              <TareaRow
                key={tarea.id}
                tarea={tarea}
                onSelect={() => onSelectTarea(tarea)}
                showBorder={idx !== group.tareas.length - 1}
              />
            ))}
      </div>
    );
  }

  return (
    <div className={`mb-3 ${level > 0 ? 'ml-4' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full px-4 py-2.5 hover:bg-zinc-800/30 rounded-lg transition-all ${
          level === 0 ? 'bg-zinc-800/20' : ''
        }`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
        {statusConfig ? (
          <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
        ) : groupOption ? (
          <groupOption.icon className="h-4 w-4 text-zinc-500" />
        ) : null}
        <span className={`font-medium ${level === 0 ? 'text-white' : 'text-zinc-300'}`}>
          {group.key}
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-500">
          {group.tareas.length}
        </span>
        {level === 0 && groupOption && (
          <span className="text-[10px] text-zinc-600 ml-auto">
            por {groupOption.label.toLowerCase()}
          </span>
        )}
      </button>
      {open && (
        <div className={`mt-1 rounded-xl border ${levelColor} overflow-hidden`}>
          {group.subgroups ? (
            // Renderizar subgrupos recursivamente
            <div className="p-2">
              {group.subgroups.map((subgroup) => (
                <NestedSection
                  key={subgroup.key}
                  group={subgroup}
                  level={level + 1}
                  groupByList={groupByList}
                  onSelectTarea={onSelectTarea}
                />
              ))}
            </div>
          ) : (
            // Renderizar tareas directamente
            group.tareas.map((tarea, idx) => (
              <TareaRow
                key={tarea.id}
                tarea={tarea}
                onSelect={() => onSelectTarea(tarea)}
                showBorder={idx !== group.tareas.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============ VISTA CALENDARIO ============
function CalendarView({
  tareas,
  onSelectTarea,
}: {
  tareas: Notificacion[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Obtener inicio y fin de la semana
  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Obtener días del mes
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajustar para empezar en domingo
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    // Generar 6 semanas (42 días) para mantener consistencia
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const days = viewMode === 'week' ? getWeekDays(currentDate) : getMonthDays(currentDate);

  // Obtener tareas para un día específico
  const getTareasForDay = (day: Date) => {
    return tareas.filter(tarea => {
      const fechaTarea = tarea.fecha_fin || tarea.fecha_inicio || tarea.fecha_creacion;
      if (!fechaTarea) return false;
      const tareaDate = new Date(fechaTarea);
      return (
        tareaDate.getFullYear() === day.getFullYear() &&
        tareaDate.getMonth() === day.getMonth() &&
        tareaDate.getDate() === day.getDate()
      );
    });
  };

  // Navegación
  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Formatear título del período
  const getPeriodTitle = () => {
    if (viewMode === 'week') {
      const start = days[0];
      const end = days[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} de ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      } else {
        return `${start.getDate()} ${monthNames[start.getMonth()].substring(0, 3)} - ${end.getDate()} ${monthNames[end.getMonth()].substring(0, 3)} ${end.getFullYear()}`;
      }
    } else {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header del calendario */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('prev')}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <h3 className="text-lg font-semibold text-white min-w-[280px] text-center">
            {getPeriodTitle()}
          </h3>
          <button
            onClick={() => navigate('next')}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className="rounded-xl border border-zinc-800/80 overflow-hidden bg-zinc-900/30">
        {/* Header de días */}
        <div className="grid grid-cols-7 border-b border-zinc-800/80">
          {dayNames.map((day, i) => (
            <div
              key={day}
              className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                i === 0 || i === 6 ? 'text-zinc-600' : 'text-zinc-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div className={`grid grid-cols-7 ${viewMode === 'week' ? '' : 'divide-y divide-zinc-800/50'}`}>
          {days.map((day, index) => {
            const tareasDelDia = getTareasForDay(day);
            const isToday = day.getTime() === today.getTime();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={index}
                className={`${viewMode === 'week' ? 'min-h-[400px]' : 'min-h-[120px]'} border-r border-zinc-800/50 last:border-r-0 ${
                  !isCurrentMonth && viewMode === 'month' ? 'bg-zinc-900/50' : ''
                } ${isWeekend ? 'bg-zinc-900/30' : ''}`}
              >
                {/* Número del día */}
                <div className={`px-2 py-2 text-right ${!isCurrentMonth && viewMode === 'month' ? 'opacity-40' : ''}`}>
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                      isToday
                        ? 'bg-purple-500 text-white'
                        : isWeekend
                        ? 'text-zinc-600'
                        : 'text-zinc-400'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Tareas del día */}
                <div className={`px-1 pb-1 space-y-1 ${viewMode === 'week' ? 'max-h-[350px] overflow-y-auto scrollbar-purple' : 'max-h-[80px] overflow-y-auto'}`}>
                  {tareasDelDia.map((tarea) => {
                    const statusConfig = getStatusConfig(tarea.estatus);
                    const isCompleted = tarea.estatus === 'Atendido';

                    return (
                      <div
                        key={tarea.id}
                        onClick={() => onSelectTarea(tarea)}
                        className={`px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] ${statusConfig.bg} border ${statusConfig.border} ${
                          isCompleted ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <statusConfig.icon className={`h-3 w-3 flex-shrink-0 ${statusConfig.color}`} />
                          <span className={`text-xs font-medium truncate ${isCompleted ? 'line-through text-zinc-500' : 'text-white'}`}>
                            {tarea.titulo}
                          </span>
                        </div>
                        {viewMode === 'week' && tarea.asignado && (
                          <div className="flex items-center gap-1 mt-1 ml-4">
                            <UserAvatar nombre={tarea.asignado} size="xs" />
                            <span className="text-[10px] text-zinc-500 truncate">{tarea.asignado}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen */}
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {tareas.length} notificación{tareas.length !== 1 ? 'es' : ''} en total
        </span>
        <span>
          {tareas.filter(t => {
            const fecha = t.fecha_fin || t.fecha_inicio || t.fecha_creacion;
            if (!fecha) return false;
            const d = new Date(fecha);
            return days.some(day =>
              d.getFullYear() === day.getFullYear() &&
              d.getMonth() === day.getMonth() &&
              d.getDate() === day.getDate()
            );
          }).length} visibles en este período
        </span>
      </div>
    </div>
  );
}

// ============ VISTA NOTAS PERSONALES ============
const NOTE_COLORS = [
  { value: 'purple', bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300' },
  { value: 'blue', bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300' },
  { value: 'emerald', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300' },
  { value: 'amber', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300' },
  { value: 'pink', bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-300' },
  { value: 'red', bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300' },
];

function getColorConfig(color: string | null) {
  return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
}

function NotasView() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaPersonal | null>(null);
  const [formData, setFormData] = useState({ titulo: '', contenido: '', color: 'purple' });

  // Fetch notas
  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-personales'],
    queryFn: () => notasService.getAll(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: notasService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-personales'] });
      setIsCreating(false);
      setFormData({ titulo: '', contenido: '', color: 'purple' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...params }: { id: number; titulo?: string; contenido?: string; color?: string }) =>
      notasService.update(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-personales'] });
      setEditingNota(null);
      setFormData({ titulo: '', contenido: '', color: 'purple' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notasService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-personales'] });
    },
  });

  const handleSubmit = () => {
    if (!formData.contenido.trim()) return;

    if (editingNota) {
      updateMutation.mutate({
        id: editingNota.id,
        titulo: formData.titulo || undefined,
        contenido: formData.contenido,
        color: formData.color,
      });
    } else {
      createMutation.mutate({
        titulo: formData.titulo || undefined,
        contenido: formData.contenido,
        color: formData.color,
      });
    }
  };

  const startEdit = (nota: NotaPersonal) => {
    setEditingNota(nota);
    setFormData({
      titulo: nota.titulo || '',
      contenido: nota.contenido,
      color: nota.color || 'purple',
    });
    setIsCreating(true);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingNota(null);
    setFormData({ titulo: '', contenido: '', color: 'purple' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header simple */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-purple-400" />
          <span className="text-sm text-zinc-400">
            {notas.length} nota{notas.length !== 1 ? 's' : ''} personal{notas.length !== 1 ? 'es' : ''}
          </span>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors border border-purple-500/40"
          >
            <Plus className="h-4 w-4" />
            Nueva nota
          </button>
        )}
      </div>

      {/* Formulario de creación/edición */}
      {isCreating && (
        <div className="rounded-xl border border-purple-500/40 bg-zinc-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              {editingNota ? 'Editar nota' : 'Nueva nota'}
            </h3>
            <button
              onClick={cancelEdit}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Título (opcional)"
            className="w-full px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
          />

          <textarea
            value={formData.contenido}
            onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
            placeholder="Escribe tu nota aquí..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none"
          />

          {/* Selector de color */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Color:</span>
            <div className="flex gap-1.5">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-6 h-6 rounded-full ${color.bg} border-2 transition-all ${
                    formData.color === color.value
                      ? `${color.border} scale-110`
                      : 'border-transparent hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.contenido.trim() || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingNota ? 'Guardar cambios' : 'Crear nota'}
            </button>
          </div>
        </div>
      )}

      {/* Grid de notas */}
      {notas.length === 0 && !isCreating ? (
        <div className="rounded-xl border border-zinc-800 p-12 text-center bg-zinc-900/30">
          <StickyNote className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">No tienes notas personales</p>
          <p className="text-xs text-zinc-600 mt-1">Crea tu primera nota para comenzar</p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors border border-purple-500/40"
          >
            <Plus className="h-4 w-4" />
            Crear nota
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notas.map((nota) => {
            const colorConfig = getColorConfig(nota.color);
            return (
              <div
                key={nota.id}
                className={`group rounded-xl border ${colorConfig.border} ${colorConfig.bg} p-4 transition-all hover:scale-[1.02] hover:shadow-lg`}
              >
                {/* Header de la nota */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    {nota.titulo && (
                      <h4 className={`font-medium ${colorConfig.text} truncate`}>
                        {nota.titulo}
                      </h4>
                    )}
                    <span className="text-[10px] text-zinc-600">
                      {formatDate(nota.fecha_creacion)}
                      {nota.fecha_actualizacion && (
                        <span className="ml-1">(editado)</span>
                      )}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(nota)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar esta nota?')) {
                          deleteMutation.mutate(nota.id);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contenido */}
                <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words line-clamp-6">
                  {nota.contenido}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sección anidada con tabla (para vista de tabla con agrupaciones)
function NestedTableSection({
  group,
  level = 0,
  groupByList,
  onSelectTarea,
}: {
  group: NestedGroup;
  level?: number;
  groupByList: GroupByType[];
  onSelectTarea: (tarea: Notificacion) => void;
}) {
  const [open, setOpen] = useState(true);
  const statusConfig = getStatusConfig(group.key);
  const currentGroupType = groupByList[level];
  const groupOption = GROUP_BY_OPTIONS.find(o => o.value === currentGroupType);

  // Colores por nivel de anidación
  const levelColors = [
    { border: 'border-purple-500/30', bg: 'bg-purple-500/5', header: 'bg-purple-500/10' },
    { border: 'border-blue-500/30', bg: 'bg-blue-500/5', header: 'bg-blue-500/10' },
    { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', header: 'bg-emerald-500/10' },
    { border: 'border-amber-500/30', bg: 'bg-amber-500/5', header: 'bg-amber-500/10' },
    { border: 'border-pink-500/30', bg: 'bg-pink-500/5', header: 'bg-pink-500/10' },
  ];
  const levelColor = levelColors[level % levelColors.length];

  // Si es el grupo "all" (sin agrupaciones), mostrar solo la tabla
  if (group.key === 'all') {
    return (
      <TareasTable
        tareas={group.tareas}
        onSelectTarea={onSelectTarea}
      />
    );
  }

  return (
    <div className={`rounded-xl border ${levelColor.border} overflow-hidden ${level > 0 ? 'ml-4' : ''}`}>
      {/* Header de la sección */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 w-full px-4 py-3 ${levelColor.header} hover:bg-zinc-800/30 transition-all`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        )}
        {statusConfig ? (
          <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
        ) : groupOption ? (
          <groupOption.icon className="h-4 w-4 text-zinc-400" />
        ) : null}
        <span className={`font-medium ${level === 0 ? 'text-white' : 'text-zinc-300'}`}>
          {group.key}
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">
          {group.tareas.length}
        </span>
        {groupOption && (
          <span className="text-[10px] text-zinc-600 ml-auto">
            {groupOption.label}
          </span>
        )}
      </button>

      {/* Contenido */}
      {open && (
        <div className={levelColor.bg}>
          {group.subgroups ? (
            // Renderizar subgrupos recursivamente
            <div className="p-3 space-y-3">
              {group.subgroups.map((subgroup) => (
                <NestedTableSection
                  key={subgroup.key}
                  group={subgroup}
                  level={level + 1}
                  groupByList={groupByList}
                  onSelectTarea={onSelectTarea}
                />
              ))}
            </div>
          ) : (
            // Renderizar tabla con las tareas del grupo
            <div className="p-2">
              <TareasTable
                tareas={group.tareas}
                onSelectTarea={onSelectTarea}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Función para verificar si hay navegación disponible
function hasNavigationRoute(tarea: Notificacion): boolean {
  return !!(tarea.referencia_tipo && tarea.referencia_id && tarea.referencia_tipo !== 'sistema');
}

// Función para obtener la etiqueta del botón
function getNavigationLabel(tipo: string): string {
  switch (tipo) {
    case 'propuesta':
      return 'Ver Propuesta';
    case 'campana':
      return 'Ver Campaña';
    case 'solicitud':
      return 'Ver Solicitud';
    default:
      return 'Ir a ver';
  }
}

// Función para verificar si es una notificación de comentario
function isCommentNotification(titulo: string): boolean {
  const lower = titulo.toLowerCase();
  return lower.includes('comentario') || lower.includes('comment');
}

// Función para obtener la ruta de navegación directa al detalle
function getDirectNavigationPath(tipo: string, id: number, titulo: string): string {
  const isComment = isCommentNotification(titulo);

  switch (tipo) {
    case 'propuesta':
      return `/propuestas?viewId=${id}`;
    case 'campana':
      return `/campanas/detail/${id}`;
    case 'solicitud':
      // Si es notificación de comentario, abrir modal de comentarios
      return isComment ? `/solicitudes?commentsId=${id}` : `/solicitudes?viewId=${id}`;
    default:
      return '/';
  }
}

// Panel lateral (Drawer) - Solo lectura, solo permite agregar comentarios
function TaskDrawer({
  tarea,
  onClose,
  onAddComment,
  onNavigate,
  isClosing = false,
  onAutorizacionAction,
}: {
  tarea: Notificacion & { comentarios?: ComentarioTarea[] };
  onClose: () => void;
  onAddComment: (contenido: string) => void;
  onNavigate?: (path: string) => void;
  isClosing?: boolean;
  onAutorizacionAction?: () => void;
}) {
  const [comment, setComment] = useState('');
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [showRechazoInput, setShowRechazoInput] = useState(false);
  const user = useAuthStore((state) => state.user);
  const canNavigate = hasNavigationRoute(tarea);

  // Detectar si es tarea de autorización
  const isAutorizacionTask = tarea.tipo?.includes('Autorización');
  const tipoAutorizacion = tarea.tipo?.includes('DG') ? 'dg' : tarea.tipo?.includes('DCM') ? 'dcm' : null;

  // Obtener idquote de la solicitud
  const idSolicitud = tarea.id_solicitud;

  // Query para obtener caras pendientes si es tarea de autorización
  const { data: carasData, refetch: refetchCaras } = useQuery({
    queryKey: ['autorizacion-caras', idSolicitud],
    queryFn: () => notificacionesService.getCarasAutorizacion(idSolicitud || ''),
    enabled: isAutorizacionTask && !!idSolicitud,
  });

  // Query para resumen de autorización
  const { data: resumenData, refetch: refetchResumen } = useQuery({
    queryKey: ['autorizacion-resumen', idSolicitud],
    queryFn: () => notificacionesService.getResumenAutorizacion(idSolicitud || ''),
    enabled: isAutorizacionTask && !!idSolicitud,
  });

  // Mutation para aprobar
  const aprobarMutation = useMutation({
    mutationFn: () => notificacionesService.aprobarAutorizacion(idSolicitud || '', tipoAutorizacion as 'dg' | 'dcm'),
    onSuccess: () => {
      refetchCaras();
      refetchResumen();
      onAutorizacionAction?.();
    },
  });

  // Mutation para rechazar
  const rechazarMutation = useMutation({
    mutationFn: (motivo: string) => notificacionesService.rechazarAutorizacion(idSolicitud || '', motivo),
    onSuccess: () => {
      refetchCaras();
      refetchResumen();
      setShowRechazoInput(false);
      setRechazoMotivo('');
      onAutorizacionAction?.();
    },
  });

  const handleAprobar = () => {
    if (!tipoAutorizacion) return;
    aprobarMutation.mutate();
  };

  const handleRechazar = () => {
    if (!rechazoMotivo.trim()) return;
    rechazarMutation.mutate(rechazoMotivo);
  };

  // Filtrar caras según tipo de autorización
  const carasPendientes = useMemo(() => {
    if (!carasData || !tipoAutorizacion) return [];
    const estadoFiltro = tipoAutorizacion === 'dg' ? 'pendiente_dg' : 'pendiente_dcm';
    return carasData.filter(c => c.estado_autorizacion === estadoFiltro);
  }, [carasData, tipoAutorizacion]);

  const handleNavigate = () => {
    if (!tarea.referencia_tipo || !tarea.referencia_id || !onNavigate) return;
    const path = getDirectNavigationPath(tarea.referencia_tipo, tarea.referencia_id, tarea.titulo || '');
    onNavigate(path);
  };

  const statusConfig = getStatusConfig(tarea.estatus);
  const tipoConfig = getTipoConfig(tarea.tipo);
  const StatusIcon = statusConfig.icon;
  const TipoIcon = tipoConfig.icon;

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      onAddComment(comment.trim());
      setComment('');
    }
  };

  return (
    <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl z-50 flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      {/* Header con gradiente */}
      <div className="relative">
        <div className={`absolute inset-0 ${statusConfig.bg} opacity-30`} />
        <div className="relative p-5 border-b border-zinc-800/50">
          {/* Top row: tipo badge y close */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${tipoConfig.bg} border ${tipoConfig.border}`}>
              <TipoIcon className={`h-3.5 w-3.5 ${tipoConfig.color}`} />
              <span className={`text-xs font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Título */}
          <h2 className="text-xl font-semibold text-white leading-tight mb-3">
            {tarea.titulo}
          </h2>

          {/* Status y ID */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig.bg} border ${statusConfig.border}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
              <span className={`text-xs font-medium ${statusConfig.color}`}>{tarea.estatus}</span>
            </div>
            <span className="text-xs text-zinc-600 font-mono">ID: {tarea.id}</span>
            {tarea.referencia_id && (
              <span className="text-xs text-purple-400 font-mono">
                {tarea.referencia_tipo === 'propuesta' ? 'Propuesta' :
                 tarea.referencia_tipo === 'campana' ? 'Campaña' :
                 tarea.referencia_tipo === 'solicitud' ? 'Solicitud' : 'Ref'} #{tarea.referencia_id}
              </span>
            )}
          </div>

          {/* Botón Ir a ver */}
          {canNavigate && onNavigate && (
            <button
              onClick={handleNavigate}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              {getNavigationLabel(tarea.referencia_tipo || '')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Descripción */}
        {tarea.mensaje && (
          <div className="p-5 border-b border-zinc-800/50">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {tarea.mensaje}
            </p>
          </div>
        )}

        {/* Detalles en cards */}
        <div className="p-5 space-y-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Detalles</h3>

          {/* Asignado */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500">
              <User className="h-4 w-4" />
              <span className="text-xs">Asignado a</span>
            </div>
            <div className="flex items-center gap-2">
              <UserAvatar nombre={tarea.asignado} size="md" />
              <span className="text-sm text-white font-medium">{tarea.asignado || 'Sin asignar'}</span>
            </div>
          </div>

          {/* Responsable/Creador */}
          {tarea.responsable && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
              <div className="flex items-center gap-2 text-zinc-500">
                <Users className="h-4 w-4" />
                <span className="text-xs">Creado por</span>
              </div>
              <span className="text-sm text-zinc-300">{tarea.responsable}</span>
            </div>
          )}

          {/* Fechas */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Fecha límite</span>
            </div>
            <span className={`text-sm font-medium ${tarea.fecha_fin ? 'text-white' : 'text-zinc-600'}`}>
              {tarea.fecha_fin ? formatDate(tarea.fecha_fin) : 'Sin fecha'}
            </span>
          </div>

          {tarea.fecha_inicio && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50">
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Fecha inicio</span>
              </div>
              <span className="text-sm text-zinc-300">{formatDate(tarea.fecha_inicio)}</span>
            </div>
          )}
        </div>

        {/* Panel de Autorización (solo si es tarea de autorización) */}
        {isAutorizacionTask && carasPendientes.length > 0 && (
          <div className="p-5 border-t border-zinc-800/50">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Caras Pendientes de Autorización ({carasPendientes.length})
            </h3>

            {/* Resumen */}
            {resumenData && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-lg font-bold text-emerald-400">{resumenData.aprobadas}</div>
                  <div className="text-[10px] text-zinc-500">Aprobadas</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-lg font-bold text-amber-400">{resumenData.pendientesDcm}</div>
                  <div className="text-[10px] text-zinc-500">Pend. DCM</div>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                  <div className="text-lg font-bold text-red-400">{resumenData.pendientesDg}</div>
                  <div className="text-[10px] text-zinc-500">Pend. DG</div>
                </div>
              </div>
            )}

            {/* Lista de caras */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 scrollbar-purple">
              {carasPendientes.map((cara) => (
                <div key={cara.id} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{cara.ciudad || 'Sin ciudad'}</span>
                    <span className="text-xs text-zinc-500">{cara.formato}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">
                      {cara.total_caras} cara{cara.total_caras !== 1 ? 's' : ''} (Renta: {cara.caras}, Bonif: {cara.bonificacion})
                    </span>
                    <span className="text-amber-400 font-medium">
                      Tarifa: ${cara.tarifa_efectiva?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de acción */}
            {!showRechazoInput ? (
              <div className="flex gap-2">
                <button
                  onClick={handleAprobar}
                  disabled={aprobarMutation.isPending || carasPendientes.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {aprobarMutation.isPending ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Aprobar {carasPendientes.length} cara{carasPendientes.length !== 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => setShowRechazoInput(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/30 border border-red-500/30 transition-all"
                >
                  <X className="h-4 w-4" />
                  Rechazar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rechazoMotivo}
                  onChange={(e) => setRechazoMotivo(e.target.value)}
                  placeholder="Escribe el motivo del rechazo..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-red-500/30 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleRechazar}
                    disabled={rechazarMutation.isPending || !rechazoMotivo.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {rechazarMutation.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
                  </button>
                  <button
                    onClick={() => {
                      setShowRechazoInput(false);
                      setRechazoMotivo('');
                    }}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comentarios */}
        <div className="p-5 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Comentarios
              {tarea.comentarios && tarea.comentarios.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px]">
                  {tarea.comentarios.length}
                </span>
              )}
            </h3>
          </div>

          {/* Lista de comentarios */}
          <div className="space-y-3 max-h-64 overflow-y-auto mb-4 scrollbar-purple">
            {(!tarea.comentarios || tarea.comentarios.length === 0) ? (
              <p className="text-xs text-zinc-600 text-center py-4">No hay comentarios aún</p>
            ) : (
              tarea.comentarios.map((c) => {
                const autorNombre = c.autor_nombre || c.usuario_nombre || 'Usuario';
                return (
                  <div key={c.id} className="group">
                    <div className="flex gap-3">
                      <UserAvatar nombre={autorNombre} foto_perfil={c.autor_foto} size="lg" className="w-7 h-7" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-300">{autorNombre}</span>
                          <span className="text-[10px] text-zinc-600">{formatDate(c.fecha)}</span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed">{c.contenido}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input de comentario */}
          <div className="flex items-start gap-3 pt-3 border-t border-zinc-800/30">
            <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 focus-within:border-purple-500/50 transition-colors">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Escribe un comentario..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!comment.trim()}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTE PRINCIPAL ============
export function NotificacionesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Estado de contenido (notificaciones vs tareas)
  const [contentType, setContentType] = useState<ContentType>('notificaciones');

  // Estado de vista y filtros
  const [view, setView] = useState<ViewType>('lista');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderBy, setOrderBy] = useState<OrderByType>('fecha_inicio');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [filterEstatus, setFilterEstatus] = useState<string>('');
  const [filterFecha, setFilterFecha] = useState<DateFilterType>('all');

  // Estados para filtros avanzados (estilo Proveedores)
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>([]);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSortPopup, setShowSortPopup] = useState(false);

  // Obtener usuario actual
  const user = useAuthStore((state) => state.user);

  // Estado de selección y drawer
  const [selectedTarea, setSelectedTarea] = useState<(Notificacion & { comentarios?: ComentarioTarea[] }) | null>(null);
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);

  // Handler para cerrar el drawer con animación
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerClosing(true);
    setTimeout(() => {
      setSelectedTarea(null);
      setIsDrawerClosing(false);
    }, 250); // Duración de la animación
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats - refetch cada 2 minutos para evitar exceder límite de conexiones BD
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats'],
    queryFn: () => notificacionesService.getStats(),
    refetchInterval: 120000, // 2 minutos
    staleTime: 30000,
  });

  // Fetch notificaciones o tareas según contentType
  const { data, isLoading } = useQuery({
    queryKey: ['notificaciones', contentType, filterEstatus, debouncedSearch, orderBy, orderDir],
    queryFn: () =>
      notificacionesService.getAll({
        limit: 200,
        estatus: filterEstatus || undefined,
        tipo: contentType === 'notificaciones' ? 'Notificación' : undefined, // Solo notificaciones o todas
        search: debouncedSearch || undefined,
        orderBy,
        orderDir,
      }),
  });

  // Mutation para agregar comentarios (única acción permitida)
  const addCommentMutation = useMutation({
    mutationFn: ({ id, contenido }: { id: number; contenido: string }) =>
      notificacionesService.addComment(id, contenido),
    onSuccess: async () => {
      if (selectedTarea) {
        const updated = await notificacionesService.getById(selectedTarea.id);
        setSelectedTarea(updated);
      }
    },
  });

  // Filtrar por fecha y usuario según el tipo de contenido
  const filteredTareas = useMemo(() => {
    if (!data?.data || !user) return [];
    let items = data.data;
    const userId = String(user.id);

    if (contentType === 'notificaciones') {
      // Para notificaciones: filtrar donde soy el destinatario (id_responsable)
      items = items.filter(item => {
        if (item.id_responsable !== undefined && item.id_responsable !== null) {
          return String(item.id_responsable) === userId;
        }
        return false;
      });
    } else {
      // Para tareas: excluir notificaciones y filtrar donde estoy asignado
      items = items.filter(item => {
        // Excluir notificaciones
        if (item.tipo === 'Notificación') return false;
        // Filtrar donde estoy asignado
        if (item.id_asignado !== undefined && item.id_asignado !== null) {
          const idAsignadoStr = String(item.id_asignado);
          const idsAsignados = idAsignadoStr.split(',').map(id => id.trim());
          return idsAsignados.includes(userId);
        }
        // También incluir donde soy responsable
        if (item.id_responsable !== undefined && item.id_responsable !== null) {
          return String(item.id_responsable) === userId;
        }
        return false;
      });
    }

    // Filtrar por fecha (solo si no es 'all')
    if (filterFecha !== 'all') {
      items = items.filter(item => {
        if (!item.fecha_creacion && !item.fecha_inicio) return false;
        const fechaToCheck = item.fecha_inicio || item.fecha_creacion;
        return isDateInRange(fechaToCheck, filterFecha);
      });
    }

    // Aplicar filtros avanzados
    items = applyFilters(items, filters);

    // Aplicar ordenamiento
    if (sortField) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortField as keyof Notificacion];
        const bVal = b[sortField as keyof Notificacion];

        if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [data?.data, filterFecha, user?.id, contentType, filters, sortField, sortDirection]);

  // Agrupar tareas (soporta múltiples agrupaciones anidadas)
  const nestedGroups = useMemo<NestedGroup[]>(() => {
    if (!filteredTareas.length) return [];
    return groupTareasRecursive(filteredTareas, activeGroupings);
  }, [filteredTareas, activeGroupings]);

  // Obtener opciones de filtro desde stats
  const estatusOptions = useMemo(() => {
    if (!stats?.por_estatus) return [];
    return Object.keys(stats.por_estatus).map(e => ({ value: e, label: e }));
  }, [stats]);

  // Obtener valores únicos para autocompletado de filtros
  const getUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      (data?.data || []).forEach(item => {
        const val = item[fieldConfig.field];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [data?.data]);

  // Funciones para manejar filtros avanzados
  const addFilter = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS[0].field,
      operator: '=',
      value: '',
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAdvancedFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Toggle de agrupación (max 2)
  const toggleGrouping = useCallback((field: GroupByField) => {
    setActiveGroupings(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length >= 2) {
        return [prev[1], field];
      }
      return [...prev, field];
    });
  }, []);

  // Verificar si hay filtros activos
  const hasActiveFilters = filters.length > 0 || activeGroupings.length > 0 || sortField !== null || filterFecha !== 'all' || search;

  // Limpiar todos los filtros
  const clearAllFilters = useCallback(() => {
    setFilters([]);
    setActiveGroupings([]);
    setSortField(null);
    setSortDirection('asc');
    setFilterFecha('all');
    setSearch('');
    setFilterEstatus('');
  }, []);

  // Handlers
  const handleSelectTarea = useCallback(async (tarea: Notificacion) => {
    const full = await notificacionesService.getById(tarea.id);
    setSelectedTarea(full);
  }, []);

  // Vista de tabs
  const viewTabs = [
    { key: 'lista', label: 'Lista', icon: List },
    { key: 'tablero', label: 'Tablero', icon: LayoutGrid },
    { key: 'calendario', label: 'Calendario', icon: CalendarDays },
    { key: 'notas', label: 'Notas', icon: StickyNote },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <Header title={contentType === 'notificaciones' ? 'Notificaciones' : 'Mis Tareas'} />

      {/* Barra superior fija */}
      <div className="sticky top-16 z-20 bg-[#1a1025]/95 backdrop-blur-sm border-b border-zinc-800/80">
        {/* Tabs: Notificaciones / Tareas */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-800/50">
          <button
            onClick={() => setContentType('notificaciones')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              contentType === 'notificaciones'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <Bell className="h-4 w-4" />
            Notificaciones
            {stats?.total && contentType !== 'notificaciones' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-[10px]">
                {stats.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setContentType('tareas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              contentType === 'tareas'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Mis Tareas
          </button>
        </div>

        {/* Navegación de vistas */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-1">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === tab.key
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Exportar a CSV
                const headers = ['ID', 'Tipo', 'Título', 'Asignado', 'Fecha', 'Creador', 'Status', '# Propuesta'];
                const rows = filteredTareas.map(t => [
                  t.id,
                  t.tipo || '',
                  t.titulo || '',
                  t.asignado || '',
                  t.fecha_creacion || '',
                  t.responsable || '',
                  t.estatus || '',
                  t.referencia_id || ''
                ]);
                const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tareas_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
              title="Descargar"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Descargar</span>
            </button>
          </div>
        </div>

        {/* Barra de controles - Solo para vistas de tareas */}
        {view !== 'notas' && (
          <div className="flex items-center gap-4 px-6 py-3">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Filter/Group/Sort Buttons - Estilo Proveedores */}
            <div className="flex items-center gap-2">
              {/* Botón de Filtros */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterPopup(!showFilterPopup)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    filters.length > 0
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                  }`}
                  title="Filtrar"
                >
                  <Filter className="h-4 w-4" />
                  {filters.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                      {filters.length}
                    </span>
                  )}
                </button>
                {showFilterPopup && (
                  <div className="absolute right-0 top-full mt-1 z-[60] w-[520px] max-w-[calc(100vw-2rem)] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
                      <button onClick={() => setShowFilterPopup(false)} className="text-zinc-400 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {filters.map((filter, index) => (
                        <div key={filter.id} className="flex items-center gap-2">
                          {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                          {index === 0 && <span className="w-8"></span>}
                          <select
                            value={filter.field}
                            onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                            className="w-[130px] text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white"
                          >
                            {FILTER_FIELDS.map((f) => (
                              <option key={f.field} value={f.field}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                            className="w-[110px] text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white"
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            list={`datalist-${filter.id}`}
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Escribe o selecciona..."
                            className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                          />
                          <datalist id={`datalist-${filter.id}`}>
                            {getUniqueValues[filter.field]?.map((val) => (
                              <option key={val} value={val} />
                            ))}
                          </datalist>
                          <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {filters.length === 0 && (
                        <p className="text-[11px] text-zinc-500 text-center py-3">Sin filtros. Haz clic en "Añadir".</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-900/30">
                      <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                        <Plus className="h-3 w-3" /> Añadir
                      </button>
                      <button onClick={clearAdvancedFilters} disabled={filters.length === 0} className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        Limpiar
                      </button>
                    </div>
                    {filters.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-900/30">
                        <span className="text-[10px] text-zinc-500">{filteredTareas.length} de {data?.data?.length || 0} registros</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón de Agrupar - solo en vista Lista */}
              {view === 'lista' && (
                <div className="relative">
                  <button
                    onClick={() => setShowGroupPopup(!showGroupPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      activeGroupings.length > 0
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                    }`}
                    title="Agrupar"
                  >
                    <Layers className="h-4 w-4" />
                    {activeGroupings.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                        {activeGroupings.length}
                      </span>
                    )}
                  </button>
                  {showGroupPopup && (
                    <div className="absolute right-0 top-full mt-1 z-[60] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide px-2 py-1">Agrupar por (max 2)</p>
                      {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleGrouping(field)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                            activeGroupings.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            activeGroupings.includes(field) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'
                          }`}>
                            {activeGroupings.includes(field) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {label}
                          {activeGroupings.indexOf(field) === 0 && <span className="ml-auto text-[10px] text-purple-400">1°</span>}
                          {activeGroupings.indexOf(field) === 1 && <span className="ml-auto text-[10px] text-pink-400">2°</span>}
                        </button>
                      ))}
                      <div className="border-t border-purple-900/30 mt-2 pt-2">
                        <button onClick={() => setActiveGroupings([])} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
                          Quitar agrupación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botón de Ordenar */}
              <div className="relative">
                <button
                  onClick={() => setShowSortPopup(!showSortPopup)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    sortField
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                  }`}
                  title="Ordenar"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                {showSortPopup && (
                  <div className="absolute right-0 top-full mt-1 z-[60] w-[300px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-purple-300">Ordenar por</span>
                      <button onClick={() => setShowSortPopup(false)} className="text-zinc-400 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {FILTER_FIELDS.map((field) => (
                        <div
                          key={field.field}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                            sortField === field.field ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-purple-900/20'
                          }`}
                        >
                          <span className={sortField === field.field ? 'text-purple-300 font-medium' : 'text-zinc-300'}>
                            {field.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSortField(field.field); setSortDirection('asc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                sortField === field.field && sortDirection === 'asc'
                                  ? 'bg-purple-600 text-white'
                                  : 'text-zinc-400 hover:text-white hover:bg-purple-900/50'
                              }`}
                              title="Ascendente (A-Z)"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { setSortField(field.field); setSortDirection('desc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                sortField === field.field && sortDirection === 'desc'
                                  ? 'bg-purple-600 text-white'
                                  : 'text-zinc-400 hover:text-white hover:bg-purple-900/50'
                              }`}
                              title="Descendente (Z-A)"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {sortField && (
                      <div className="mt-3 pt-3 border-t border-purple-900/30">
                        <button
                          onClick={() => { setSortField(null); setSortDirection('asc'); }}
                          className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors"
                        >
                          Quitar ordenamiento
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón Limpiar Todo */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center justify-center w-9 h-9 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors"
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Estadísticas rápidas */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Clock className="h-3 w-3 text-amber-400" />
                <span className="text-xs text-amber-300">{stats?.por_estatus?.['Activo'] || 0} activas</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                <span className="text-xs text-emerald-300">{stats?.por_estatus?.['Atendido'] || 0} atendidas</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : view === 'tablero' ? (
          <TableroView tareas={filteredTareas} onSelectTarea={handleSelectTarea} />
        ) : view === 'lista' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                {filteredTareas.length} {contentType === 'notificaciones' ? 'notificación' : 'tarea'}{filteredTareas.length !== 1 ? (contentType === 'notificaciones' ? 'es' : 's') : ''}
                {activeGroupings.length > 0 && <span className="text-zinc-600"> · {activeGroupings.length} agrupación{activeGroupings.length > 1 ? 'es' : ''}</span>}
              </span>
            </div>

            {activeGroupings.length > 0 ? (
              /* Vista con agrupaciones */
              <div className="space-y-3">
                {nestedGroups.map((group) => (
                  <NestedSection
                    key={group.key}
                    group={group}
                    groupByList={activeGroupings}
                    onSelectTarea={handleSelectTarea}
                  />
                ))}
              </div>
            ) : filteredTareas.length > 0 ? (
              <div className="rounded-xl border border-zinc-800/80 overflow-hidden bg-zinc-900/30">
                {filteredTareas.map((tarea, index) => {
                  const statusConfig = getStatusConfig(tarea.estatus);
                  const tipoConfig = getTipoConfig(tarea.tipo);
                  const StatusIcon = statusConfig.icon;
                  const TipoIcon = tipoConfig.icon;
                  const isNotificacion = tarea.tipo === 'Notificación';
                  const isCompleted = tarea.estatus === 'Atendido';
                  return (
                    <div
                      key={tarea.id}
                      onClick={() => handleSelectTarea(tarea)}
                      className={`group cursor-pointer transition-all hover:bg-zinc-800/50 ${index !== filteredTareas.length - 1 ? 'border-b border-zinc-800/60' : ''} ${isCompleted ? 'opacity-60' : ''}`}
                    >
                      {/* Layout móvil y desktop */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Indicador de estado + icono */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <div className={`w-1 h-10 rounded-full ${statusConfig.bg} ${isCompleted ? 'bg-emerald-500/40' : ''}`} />
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bg} border ${statusConfig.border}`}>
                            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                          </div>
                        </div>

                        {/* Contenido principal */}
                        <div className="flex-1 min-w-0">
                          {/* Fila 1: Tipo + Título + ID */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${tipoConfig.bg} border ${tipoConfig.border}`}>
                              <TipoIcon className={`h-3 w-3 ${tipoConfig.color}`} />
                              <span className={`text-[10px] font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
                            </div>
                            <span className={`text-sm font-medium group-hover:text-purple-300 transition-colors ${isCompleted ? 'line-through text-zinc-500' : 'text-white'}`}>
                              {tarea.titulo}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono">#{tarea.id}</span>
                          </div>

                          {/* Fila 2: Descripción (si existe) */}
                          {tarea.mensaje && (
                            <p className="text-xs text-zinc-500 truncate mt-1 max-w-lg">{tarea.mensaje}</p>
                          )}

                          {/* Fila 3: Metadatos - responsive */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Asignado - siempre visible pero compacto en móvil */}
                            {tarea.asignado && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <UserAvatar nombre={tarea.asignado} size="xs" />
                                <span className="text-zinc-500 hidden sm:inline">Asignado:</span>
                                <span className="text-zinc-300">{tarea.asignado}</span>
                              </div>
                            )}

                            {/* Separador visual */}
                            {tarea.asignado && (tarea.responsable || tarea.fecha_fin) && (
                              <span className="text-zinc-700 hidden sm:inline">•</span>
                            )}

                            {/* Creador - visible en md+ */}
                            {tarea.responsable && (
                              <div className="hidden md:flex items-center gap-1.5 text-[11px]">
                                <span className="text-zinc-500">Creador:</span>
                                <span className="text-zinc-400">{tarea.responsable}</span>
                              </div>
                            )}

                            {/* Separador */}
                            {tarea.responsable && tarea.fecha_fin && !isNotificacion && (
                              <span className="text-zinc-700 hidden md:inline">•</span>
                            )}

                            {/* Fecha límite - visible en sm+ */}
                            {!isNotificacion && tarea.fecha_fin && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Clock className="h-3 w-3 text-amber-400" />
                                <span className="text-zinc-500 hidden sm:inline">Límite:</span>
                                <span className="text-zinc-400">{formatDate(tarea.fecha_fin)}</span>
                              </div>
                            )}

                            {/* Propuesta - siempre visible */}
                            {tarea.referencia_id && (
                              <div className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                                <span className="text-purple-400/70 hidden sm:inline">Prop:</span>
                                <span className="font-mono text-purple-400">#{tarea.referencia_id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                          {/* Botón Ir a ver - solo si tiene referencia */}
                          {hasNavigationRoute(tarea) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!tarea.referencia_tipo || !tarea.referencia_id) return;
                                const path = getDirectNavigationPath(tarea.referencia_tipo, tarea.referencia_id, tarea.titulo || '');
                                navigate(path);
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title={`Ir a ${tarea.referencia_tipo === 'propuesta' ? 'Propuesta' : tarea.referencia_tipo === 'campana' ? 'Campaña' : 'Solicitud'}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                          {/* Chevron para indicar que es clickeable - solo desktop */}
                          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-purple-400 transition-colors hidden lg:block" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 p-12 text-center bg-zinc-900/30">
                {contentType === 'notificaciones' ? (
                  <Bell className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                ) : (
                  <ClipboardList className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                )}
                <p className="text-zinc-500">
                  {contentType === 'notificaciones' ? 'No tienes notificaciones' : 'No tienes tareas asignadas'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {contentType === 'notificaciones'
                    ? 'Las notificaciones aparecerán aquí cuando haya actividad'
                    : 'Las tareas aparecerán aquí cuando te asignen alguna'}
                </p>
              </div>
            )}
          </div>
        ) : view === 'calendario' ? (
          <CalendarView tareas={filteredTareas} onSelectTarea={handleSelectTarea} />
        ) : view === 'notas' ? (
          <NotasView />
        ) : null}
      </div>

      {/* Panel lateral (Drawer) - Overlay sin empujar contenido */}
      {selectedTarea && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 z-40 ${isDrawerClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={handleCloseDrawer}
          />
          <TaskDrawer
            tarea={selectedTarea}
            onClose={handleCloseDrawer}
            onAddComment={(contenido) => addCommentMutation.mutate({ id: selectedTarea.id, contenido })}
            onNavigate={(path) => {
              handleCloseDrawer();
              setTimeout(() => navigate(path), 250);
            }}
            isClosing={isDrawerClosing}
            onAutorizacionAction={() => {
              queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
              queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
            }}
          />
        </>
      )}

    </div>
  );
}
