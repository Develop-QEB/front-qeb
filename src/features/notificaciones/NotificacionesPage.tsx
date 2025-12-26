import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronRight,
  Calendar, User, FileText, X, List, LayoutGrid, CalendarDays,
  PanelRight, FolderOpen, Clock, CheckCircle, AlertCircle, Circle,
  MessageSquare, Send, Plus, Pencil, Trash2, StickyNote,
  Users, Tag, Building2, Download, Table2, ExternalLink
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { notificacionesService } from '../../services/notificaciones.service';
import { notasService, NotaPersonal } from '../../services/notas.service';
import { Notificacion, ComentarioTarea } from '../../types';
import { formatDate } from '../../lib/utils';
import { STATUS_CONFIG, getTipoConfig, getStatusConfig } from '../../lib/taskConfig';
import { useAuthStore } from '../../store/authStore';
import { TableroView } from './KanbanView';

// ============ TIPOS ============
type ViewType = 'tablero' | 'lista' | 'calendario' | 'notas';
type GroupByType = 'estatus' | 'tipo' | 'fecha' | 'responsable' | 'asignado';
type OrderByType = 'fecha_fin' | 'fecha_inicio' | 'titulo' | 'estatus';
type DateFilterType = 'all' | 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

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

// Botón de agrupación múltiple
function MultiGroupButton({
  selected,
  onChange,
}: {
  selected: GroupByType[];
  onChange: (groups: GroupByType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const availableOptions = GROUP_BY_OPTIONS.filter(opt => !selected.includes(opt.value));

  const addGroup = (value: GroupByType) => {
    onChange([...selected, value]);
  };

  const removeGroup = (value: GroupByType) => {
    onChange(selected.filter(g => g !== value));
  };

  const clearAll = () => {
    onChange([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          selected.length > 0
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
        }`}
      >
        <Users className="h-3 w-3" />
        <span>Agrupar</span>
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[220px] rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Agrupaciones activas */}
            {selected.length > 0 && (
              <div className="p-2 border-b border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  Agrupaciones activas
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.map((value, index) => {
                    const opt = GROUP_BY_OPTIONS.find(o => o.value === value);
                    if (!opt) return null;
                    return (
                      <div
                        key={value}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs"
                      >
                        <span className="text-[10px] text-purple-400">{index + 1}.</span>
                        <opt.icon className="h-3 w-3" />
                        <span>{opt.label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeGroup(value); }}
                          className="ml-0.5 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={clearAll}
                  className="mt-2 text-[10px] text-red-400 hover:text-red-300 px-1"
                >
                  Quitar todas
                </button>
              </div>
            )}

            {/* Opciones disponibles */}
            {availableOptions.length > 0 ? (
              <div className="p-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 px-2 pt-1">
                  {selected.length > 0 ? 'Agregar agrupación' : 'Agrupar por'}
                </div>
                {availableOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => addGroup(option.value)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-xs text-zinc-500 text-center">
                Todas las agrupaciones aplicadas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Dropdown selector
function Dropdown({
  label,
  options,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  icon?: typeof Circle;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300 transition-all"
      >
        {Icon && <Icon className="h-3 w-3" />}
        <span>{selected?.label || label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[160px] rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                  value === option.value
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[9px] text-white font-medium">
              {tarea.asignado.charAt(0)}
            </div>
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
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-medium">
                          {tarea.asignado.charAt(0)}
                        </div>
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
          <p className="text-zinc-500">No hay tareas que mostrar</p>
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
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-medium">
                              {tarea.asignado.charAt(0)}
                            </div>
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
          {tareas.length} tarea{tareas.length !== 1 ? 's' : ''} en total
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
}: {
  tarea: Notificacion & { comentarios?: ComentarioTarea[] };
  onClose: () => void;
  onAddComment: (contenido: string) => void;
  onNavigate?: (path: string) => void;
}) {
  const [comment, setComment] = useState('');
  const user = useAuthStore((state) => state.user);
  const canNavigate = hasNavigationRoute(tarea);

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
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
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
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-medium">
                {tarea.asignado?.charAt(0) || '?'}
              </div>
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
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">
                        {autorNombre.charAt(0).toUpperCase()}
                      </div>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs text-white font-medium flex-shrink-0">
              {user?.nombre?.charAt(0) || 'U'}
            </div>
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

  // Estado de vista y filtros
  const [view, setView] = useState<ViewType>('lista');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByType[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByType>('fecha_inicio');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [filterEstatus, setFilterEstatus] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterFecha, setFilterFecha] = useState<DateFilterType>('all');
  const [filterParaMi, setFilterParaMi] = useState(false);

  // Obtener usuario actual
  const user = useAuthStore((state) => state.user);

  // Estado de selección y drawer
  const [selectedTarea, setSelectedTarea] = useState<(Notificacion & { comentarios?: ComentarioTarea[] }) | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats'],
    queryFn: () => notificacionesService.getStats(),
    refetchInterval: 30000,
  });

  // Fetch tareas
  const { data, isLoading } = useQuery({
    queryKey: ['notificaciones', filterEstatus, filterTipo, debouncedSearch, orderBy, orderDir],
    queryFn: () =>
      notificacionesService.getAll({
        limit: 200,
        estatus: filterEstatus || undefined,
        tipo: filterTipo || undefined,
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

  // Filtrar tareas por fecha y usuario
  const filteredTareas = useMemo(() => {
    if (!data?.data) return [];
    let tareas = data.data;

    // Filtrar por fecha (solo si no es 'all')
    if (filterFecha !== 'all') {
      tareas = tareas.filter(tarea => {
        // Si no tiene fecha, incluir solo en 'all'
        if (!tarea.fecha_creacion && !tarea.fecha_inicio) return false;
        // Usar fecha_inicio o fecha_creacion
        const fechaToCheck = tarea.fecha_inicio || tarea.fecha_creacion;
        return isDateInRange(fechaToCheck, filterFecha);
      });
    }

    // Filtrar por usuario actual (Para mí) - Solo donde soy ASIGNADO
    if (filterParaMi && user) {
      const userId = String(user.id);

      tareas = tareas.filter(tarea => {
        // Solo verificar por id_asignado (lista separada por comas)
        if (tarea.id_asignado !== undefined && tarea.id_asignado !== null) {
          const idAsignadoStr = String(tarea.id_asignado);
          const idsAsignados = idAsignadoStr.split(',').map(id => id.trim());
          return idsAsignados.includes(userId);
        }
        // Si no hay id_asignado, no mostrar
        return false;
      });
    }

    return tareas;
  }, [data?.data, filterFecha, filterParaMi, user?.nombre, user?.id]);

  // Agrupar tareas (soporta múltiples agrupaciones anidadas)
  const nestedGroups = useMemo<NestedGroup[]>(() => {
    if (!filteredTareas.length) return [];
    return groupTareasRecursive(filteredTareas, groupBy);
  }, [filteredTareas, groupBy]);

  // Obtener opciones de filtro desde stats
  const tipoOptions = useMemo(() => {
    if (!stats?.por_tipo) return [];
    return Object.keys(stats.por_tipo).map(t => ({ value: t, label: t }));
  }, [stats]);

  const estatusOptions = useMemo(() => {
    if (!stats?.por_estatus) return [];
    return Object.keys(stats.por_estatus).map(e => ({ value: e, label: e }));
  }, [stats]);

  // Handlers
  const handleSelectTarea = useCallback(async (tarea: Notificacion) => {
    const full = await notificacionesService.getById(tarea.id);
    setSelectedTarea(full);
  }, []);

  const clearFilters = () => {
    setFilterEstatus('');
    setFilterTipo('');
    setFilterFecha('all');
    setFilterParaMi(false);
    setSearch('');
    setGroupBy([]);
  };

  const hasActiveFilters = !!(filterEstatus || filterTipo || filterFecha !== 'all' || filterParaMi || search || groupBy.length > 0);

  // Vista de tabs
  const viewTabs = [
    { key: 'lista', label: 'Lista', icon: List },
    { key: 'tablero', label: 'Tablero', icon: LayoutGrid },
    { key: 'calendario', label: 'Calendario', icon: CalendarDays },
    { key: 'notas', label: 'Notas', icon: StickyNote },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Mis Tareas" />

      {/* Barra superior fija */}
      <div className="sticky top-16 z-20 bg-[#1a1025]/95 backdrop-blur-sm border-b border-zinc-800/80">
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

            {/* Filtros como chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Agrupar - solo en vista Lista */}
              {view === 'lista' && (
                <MultiGroupButton
                  selected={groupBy}
                  onChange={setGroupBy}
                />
              )}

              {/* Botón Para mí */}
              <button
                onClick={() => setFilterParaMi(!filterParaMi)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterParaMi
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                <User className="h-3 w-3" />
                <span>Para mí</span>
              </button>

              <Dropdown
                label="Fecha"
                icon={Calendar}
                options={DATE_FILTER_OPTIONS}
                value={filterFecha}
                onChange={(v) => setFilterFecha(v as DateFilterType)}
              />

              {tipoOptions.length > 0 && (
                <Dropdown
                  label="Tipo"
                  icon={Tag}
                  options={[{ value: '', label: 'Todos' }, ...tipoOptions]}
                  value={filterTipo}
                  onChange={setFilterTipo}
                />
              )}

              {(groupBy.length > 0 || filterTipo || filterFecha !== 'all' || filterParaMi || search) && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <X className="h-3 w-3" />
                  Limpiar
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
                {filteredTareas.length} tarea{filteredTareas.length !== 1 ? 's' : ''}
                {groupBy.length > 0 && <span className="text-zinc-600"> · {groupBy.length} agrupación{groupBy.length > 1 ? 'es' : ''}</span>}
              </span>
            </div>

            {groupBy.length > 0 ? (
              /* Vista con agrupaciones */
              <div className="space-y-3">
                {nestedGroups.map((group) => (
                  <NestedSection
                    key={group.key}
                    group={group}
                    groupByList={groupBy}
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
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-medium">
                                  {tarea.asignado.charAt(0)}
                                </div>
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
                <Circle className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">No hay tareas que mostrar</p>
                <p className="text-xs text-zinc-600 mt-1">Ajusta los filtros o crea una nueva tarea</p>
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
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedTarea(null)}
          />
          <TaskDrawer
            tarea={selectedTarea}
            onClose={() => setSelectedTarea(null)}
            onAddComment={(contenido) => addCommentMutation.mutate({ id: selectedTarea.id, contenido })}
            onNavigate={(path) => {
              setSelectedTarea(null); // Cerrar drawer antes de navegar
              navigate(path);
            }}
          />
        </>
      )}

    </div>
  );
}
