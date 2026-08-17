import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronRight,
  Calendar, User, FileText, X, List, LayoutGrid, CalendarDays,
  PanelRight, FolderOpen, Clock, CheckCircle, AlertCircle, Circle,
  MessageSquare, Send, Plus, Pencil, Trash2, StickyNote,
  Users, Tag, Building2, Download, Table2, ExternalLink, Bell, ClipboardList,
  Filter, Layers, ArrowUpDown, ArrowUp, ArrowDown, Check, Loader2, UserCheck, UserPlus,
  ShieldCheck, DollarSign
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { notificacionesService, CaraAutorizacion, ResumenAutorizacion, HistorialAutorizacion } from '../../services/notificaciones.service';
import { notasService, NotaPersonal } from '../../services/notas.service';
import { usuariosService } from '../../services/usuarios.service';
import { Notificacion, ComentarioTarea } from '../../types';
import { formatDate, formatDateCompact } from '../../lib/utils';
import { STATUS_CONFIG, getTipoConfig, getStatusConfig } from '../../lib/taskConfig';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { TableroView } from './KanbanView';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useSocketNotificaciones } from '../../hooks/useSocket';
import { CreateSolicitudModal } from '../solicitudes/CreateSolicitudModal';
import { AssignInventarioModal } from '../propuestas/AssignInventarioModal';
import { AssignInventarioCampanaModal } from '../campanas/AssignInventarioCampanaModal';
import { propuestasService } from '../../services/propuestas.service';
import { campanasService } from '../../services/campanas.service';
import { NotasDireccionBitacora } from './NotasDireccionBitacora';
import { NuevaActividadComercialModal } from './NuevaActividadComercialModal';

// Roles que pueden crear tarea manual "Actividad Comercial".
// Se muestra el boton solo a estos. El back re-valida.
const ROLES_ACTIVIDAD_COMERCIAL = new Set([
  'Asesor Comercial',
  'Asesor Comercial Aeropuerto',
  'Gerente Comercial',
  'Director Comercial',
  'Administrador',
  'DEV',
]);

// ============ HELPERS ============
// Tipos de tareas creadas desde el Gestor de Artes. Estas tareas se
// atienden en su modal real (con side-effects: aprobar arte, subir foto,
// rotar roles, marcar instalado, etc). NUNCA deben cerrarse via el boton
// "Finalizar tarea" del preview lateral — solo marcaria estatus=Atendido
// sin disparar los side-effects, dejando el flujo roto (bug reportado
// por Jos 2026-07-09).
const TIPOS_GESTOR_ARTES = new Set([
  'Revisión de artes', 'Revision de artes',
  'Correccion', 'Corrección',
  'Impresión', 'Impresion',
  'Orden de Impresión', 'Orden de Impresion',
  'Recepción', 'Recepcion',
  'Gestión de Recepción Parcial', 'Gestion de Recepcion Parcial',
  'Testigo',
  'Instalación', 'Instalacion',
  'Programación', 'Programacion',
  'Programación para Tráfico', 'Programacion para Trafico',
  'Orden de Programación', 'Orden de Programacion',
  'Orden de Instalación', 'Orden de Instalacion',
]);
function isTareaGestorArtes(tipo?: string | null): boolean {
  if (!tipo) return false;
  return TIPOS_GESTOR_ARTES.has(tipo);
}

// Render texto con URLs (http://, https://, www.) convertidas en hyperlinks
// que abren en nueva pestaña. Se mantienen los saltos de linea originales.
function LinkifiedText({ text, className }: { text: string; className?: string }) {
  // Regex: capta http(s)://... o www.... hasta el primer espacio o caracter no-URL
  const URL_REGEX = /(https?:\/\/[^\s)<>"']+|www\.[^\s)<>"']+)/gi;
  const parts: Array<{ kind: 'text' | 'link'; value: string }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push({ kind: 'text', value: text.slice(lastIndex, start) });
    parts.push({ kind: 'link', value: match[0] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ kind: 'text', value: text.slice(lastIndex) });

  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => {
        if (p.kind === 'link') {
          const href = p.value.startsWith('www.') ? `https://${p.value}` : p.value;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {p.value}
            </a>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </p>
  );
}

// ============ TIPOS ============
type ContentType = 'notificaciones' | 'tareas';
type ViewType = 'tablero' | 'lista' | 'calendario' | 'notas';
type GroupByType = 'estatus' | 'tipo' | 'fecha' | 'responsable' | 'asignado' | 'asesor' | 'creador';
type OrderByType = 'fecha_fin' | 'fecha_inicio' | 'created_at' | 'titulo' | 'estatus';
type DateFilterType = 'all' | 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month';
type QuickFilter = 'all' | 'pendientes' | 'finalizadas' | 'leidas' | 'no_leidas' | null;


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
  type: 'string' | 'number' | 'date';
}

type QuickFilterKey =
  | 'all'
  | 'pendientes'
  | 'finalizadas'
  | 'leidas'      
  | 'no_leidas';  

// Estatus "resueltos": no cuentan en la campanita ni en "Sin finalizar" / "No
// leídas". Debe coincidir con ESTATUS_RESUELTOS del backend
// (notificaciones.controller.ts) o el conteo de la lista se descuadra del badge.
const ESTATUS_RESUELTOS = ['Atendido', 'Rechazado', 'Cancelado'];
const esResuelta = (estatus?: string | null) => !!estatus && ESTATUS_RESUELTOS.includes(estatus);

const QUICK_FILTERS_NOTIFICACIONES: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'leidas', label: 'Leídas' },
  { key: 'no_leidas', label: 'No leídas' },
];

const QUICK_FILTERS_TAREAS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pendientes', label: 'Sin finalizar' },
  { key: 'finalizadas', label: 'Finalizadas' },
];

// Campos disponibles para filtrar/ordenar
const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'fecha_creacion', label: 'Fecha creación', type: 'date' },
  { field: 'fecha_inicio', label: 'Fecha de inicio', type: 'date' },
  { field: 'fecha_fin', label: 'Fecha de entrega', type: 'date' },
  { field: 'titulo', label: 'Título', type: 'string' },
  { field: 'tipo', label: 'Tipo', type: 'string' },
  { field: 'estatus', label: 'Estado', type: 'string' },
  { field: 'asignado', label: 'Asignado', type: 'string' },
  { field: 'responsable', label: 'Responsable', type: 'string' },
  { field: 'asesor', label: 'Asesor', type: 'string' },
  { field: 'creador', label: 'Creador', type: 'string' },
  { field: 'formatos', label: 'Formato', type: 'string' },
];

const DATE_PRESET_OPTIONS = [
  { value: 'antes_de_hoy', label: 'Antes de hoy' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'manana', label: 'Mañana' },
  { value: 'esta_semana', label: 'Esta semana' },
  { value: 'proxima_semana', label: 'Próxima semana' },
  { value: 'proximos_14_dias', label: 'Los próximos 14 días' },
];

// Campos disponibles para agrupar
// test
type GroupByField = 'estatus' | 'tipo' | 'asignado' | 'responsable' | 'fecha' | 'asesor' | 'creador';

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
  { field: 'asesor', label: 'Asesor' },
  { field: 'creador', label: 'Creador' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Resolver preset de fecha a un rango [inicio, fin)
function resolveDatePreset(preset: string): [Date, Date] | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayOfWeek = today.getDay(); // 0=dom
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today); monday.setDate(today.getDate() + mondayOffset);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  const nextNextMonday = new Date(monday); nextNextMonday.setDate(monday.getDate() + 14);
  const in14Days = new Date(today); in14Days.setDate(today.getDate() + 14);

  switch (preset) {
    case 'antes_de_hoy': return [new Date(0), today];
    case 'hoy': return [today, tomorrow];
    case 'manana': { const d = new Date(tomorrow); d.setDate(d.getDate() + 1); return [tomorrow, d]; }
    case 'esta_semana': return [monday, nextMonday];
    case 'proxima_semana': return [nextMonday, nextNextMonday];
    case 'proximos_14_dias': return [today, in14Days];
    default: return null;
  }
}

const DATE_FIELDS = ['fecha_creacion', 'fecha_inicio', 'fecha_fin'];

// Función para aplicar filtros a los datos
function applyFilters(data: Notificacion[], filters: FilterCondition[]): Notificacion[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = item[filter.field as keyof Notificacion];
      const filterValue = filter.value;

      // Filtro de fecha con presets
      if (DATE_FIELDS.includes(filter.field)) {
        const range = resolveDatePreset(filterValue);
        if (!range) return true;
        if (fieldValue === null || fieldValue === undefined) return filter.operator === '!=';
        const raw = new Date(String(fieldValue));
        if (isNaN(raw.getTime())) return false;
        const date = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
        const inRange = date >= range[0] && date < range[1];
        return filter.operator === '=' ? inRange : !inRange;
      }

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
  { value: 'asesor', label: 'Asesor', icon: UserCheck },
  { value: 'creador', label: 'Creador', icon: UserPlus },
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
    case 'asesor':
      return tarea.asesor || 'Sin asesor';
    case 'creador':
      return tarea.creador || 'Sin creador';
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
  selected,
  onToggleSelection,
}: {
  tarea: Notificacion;
  onSelect: () => void;
  showBorder?: boolean;
  selected?: boolean;
  onToggleSelection?: (id: number) => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const statusConfig = getStatusConfig(tarea.estatus);
  const tipoConfig = getTipoConfig(tarea.tipo);
  const StatusIcon = statusConfig.icon;
  const TipoIcon = tipoConfig.icon;
  const isNotificacion = tarea.tipo === 'Notificación';
  const isCompleted = tarea.estatus === 'Atendido';
  const isAuthTask = tarea.tipo?.includes('Autorización');
  const isAprobacion = tarea.tipo?.includes('Aprobación');
  const isRechazo = tarea.tipo?.includes('Rechazo');
  const isRechazado = tarea.estatus === 'Rechazado';
  const isCancelado = tarea.estatus === 'Cancelado';

  const getAuthStatusBadge = () => {
    if (isCancelado) return { bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', color: 'text-zinc-400', label: 'Cancelado' };
    // Filtro DG/DCM devuelto a corrección: se marca 'Rechazado' en BD, pero NO es un rechazo
    // total — el Gerente lo devolvió al asesor para corregir. Badge ámbar, no rojo/verde.
    if ((tarea.tipo === 'Filtro Autorización DG' || tarea.tipo === 'Filtro Autorización DCM') && isRechazado) return { bg: 'bg-amber-500/20', border: 'border-amber-500/30', color: 'text-amber-400', label: 'Devuelta a corrección' };
    if (isRechazo) return { bg: 'bg-red-500/20', border: 'border-red-500/30', color: 'text-red-400', label: 'Rechazo' };
    if (isAprobacion) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', color: 'text-emerald-400', label: 'Aprobada' };
    if (isRechazado) return { bg: 'bg-red-500/20', border: 'border-red-500/30', color: 'text-red-400', label: 'Rechazo' };
    if (isCompleted && isAuthTask) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', color: 'text-emerald-400', label: 'Aprobada' };
    if (isAuthTask) return { bg: 'bg-amber-500/20', border: 'border-amber-500/30', color: 'text-amber-400', label: 'Pendiente' };
    return null;
  };
  const authBadge = getAuthStatusBadge();

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-all ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-100'} ${showBorder ? `border-b ${isDark ? 'border-zinc-800/60' : 'border-gray-200'}` : ''} ${isCompleted || isCancelado || isRechazado ? 'opacity-60' : ''}`}
    >
      {/* Checkbox de selección masiva */}
      {onToggleSelection && (
        <input
          type="checkbox"
          checked={!!selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onToggleSelection(tarea.id); }}
          className="w-4 h-4 accent-purple-500 cursor-pointer flex-shrink-0"
        />
      )}

      {/* Indicador de estado visual */}
      {!isAuthTask && (
        <div className={`w-1 h-8 rounded-full ${authBadge ? authBadge.bg : statusConfig.bg} ${isCompleted ? 'bg-emerald-500/40' : ''}`} />
      )}

      {/* Icono de estado (oculto para tareas de autorización) */}
      {!isAuthTask && (
        <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${statusConfig.bg} border ${statusConfig.border}`}>
          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
        </div>
      )}

      {/* Badge de tipo con color diferenciado */}
      {isAuthTask ? (
        <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/25 to-amber-500/20 border-2 border-orange-400/50 shadow-sm shadow-orange-500/10`}>
          <TipoIcon className="h-4 w-4 text-orange-300" />
          <span className="text-xs font-bold text-orange-300 tracking-wide">{tarea.tipo}</span>
          {authBadge && !isRechazo && !isAprobacion && (
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${authBadge.bg} ${authBadge.color} border ${authBadge.border}`}>{authBadge.label}</span>
          )}
        </div>
      ) : (
        <>
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg ${tipoConfig.bg} border ${tipoConfig.border}`}>
            <TipoIcon className={`h-3 w-3 ${tipoConfig.color}`} />
            <span className={`text-[11px] font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
          </div>
          {authBadge && !isRechazo && !isAprobacion && (
            <div className={`flex-shrink-0 px-2 py-0.5 rounded-full ${authBadge.bg} border ${authBadge.border}`}>
              <span className={`text-[10px] font-semibold ${authBadge.color}`}>{authBadge.label}</span>
            </div>
          )}
        </>
      )}

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium group-hover:text-purple-300 transition-colors ${isCompleted || isRechazado ? 'line-through text-zinc-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
            {tarea.titulo}
          </span>
          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} font-mono`}>#{tarea.id}</span>
        </div>
        {tarea.mensaje && (
          <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate mt-0.5 max-w-md`}>{tarea.mensaje}</p>
        )}
      </div>

      {/* Metadatos agrupados */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {tarea.asignado && !isAuthTask && (
          <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`} title={`Asignado: ${tarea.asignado}`}>
            <UserAvatar nombre={tarea.asignado} size="sm" />
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} truncate max-w-16`}>{tarea.asignado}</span>
          </div>
        )}

        {!isNotificacion && !isAuthTask && (tarea.fecha_inicio || tarea.fecha_fin) && (
          <div className={`hidden lg:flex items-center gap-2 px-2 py-1 rounded-lg ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'}`}>
            {tarea.fecha_inicio && (
              <div className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} title="Fecha inicio">
                <Calendar className="h-3 w-3 text-blue-400" />
                <span>{formatDate(tarea.fecha_inicio)}</span>
              </div>
            )}
            {tarea.fecha_inicio && tarea.fecha_fin && <span className={isDark ? 'text-zinc-700' : 'text-gray-300'}>→</span>}
            {tarea.fecha_fin && (
              <div className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} title="Fecha fin">
                <Clock className="h-3 w-3 text-amber-400" />
                <span>{formatDate(tarea.fecha_fin)}</span>
              </div>
            )}
          </div>
        )}

        {tarea.responsable && (
          <span className={`hidden xl:block text-[11px] font-medium px-2 py-1 rounded ${isAuthTask ? 'text-orange-300 bg-orange-500/10 border border-orange-500/20' : `${isDark ? 'text-zinc-600' : 'text-gray-500'} ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'}`}`} title="Creador">
            {tarea.responsable}
          </span>
        )}

        {isAuthTask && tarea.cliente && (
          <span className="text-[11px] px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <span className="text-purple-400/70">Cliente: </span>
            <span className="text-purple-300 font-medium">{tarea.cliente}</span>
          </span>
        )}

        {tarea.referencia_id && !isAuthTask && (
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  return (
    <div className={`rounded-xl border ${isDark ? 'border-zinc-800/80' : 'border-gray-200'} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`${isDark ? 'bg-zinc-800/50 border-b border-zinc-700/50' : 'bg-gray-50 border-b border-gray-200'}`}>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>ID</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Tipo</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Título</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Asignado</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Fecha</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Creador</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}>Status</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider`}># Propuesta</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-200'}`}>
            {tareas.map((tarea) => {
              const statusConfig = getStatusConfig(tarea.estatus);
              return (
                <tr
                  key={tarea.id}
                  onClick={() => onSelectTarea(tarea)}
                  className={`${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-100'} cursor-pointer transition-colors`}
                >
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{tarea.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                      {tarea.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{tarea.titulo}</div>
                    {tarea.mensaje && (
                      <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate max-w-xs`}>{tarea.mensaje}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tarea.asignado ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar nombre={tarea.asignado} size="md" />
                        <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{tarea.asignado}</span>
                      </div>
                    ) : (
                      <span className={`text-sm ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    {tarea.fecha_creacion ? formatDate(tarea.fecha_creacion) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {tarea.responsable ? (
                      <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{tarea.responsable}</span>
                    ) : (
                      <span className={`text-sm ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                      <statusConfig.icon className="h-3 w-3" />
                      {tarea.estatus}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
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
          <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>No hay notificaciones que mostrar</p>
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
  selectedIds,
  onToggleSelection,
}: {
  group: NestedGroup;
  level?: number;
  groupByList: GroupByType[];
  onSelectTarea: (tarea: Notificacion) => void;
  selectedIds?: Set<number>;
  onToggleSelection?: (id: number) => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
                selected={selectedIds?.has(tarea.id)}
                onToggleSelection={onToggleSelection}
              />
            ))}
      </div>
    );
  }

  return (
    <div className={`mb-3 ${level > 0 ? 'ml-4' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full px-4 py-2.5 ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-100'} rounded-lg transition-all ${
          level === 0 ? (isDark ? 'bg-zinc-800/20' : 'bg-gray-50') : ''
        }`}
      >
        {open ? (
          <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
        )}
        {statusConfig ? (
          <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
        ) : groupOption ? (
          <groupOption.icon className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
        ) : null}
        <span className={`font-medium ${level === 0 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-300' : 'text-gray-700')}`}>
          {group.key}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
          {group.tareas.length}
        </span>
        {level === 0 && groupOption && (
          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} ml-auto`}>
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
                  selectedIds={selectedIds}
                  onToggleSelection={onToggleSelection}
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
                selected={selectedIds?.has(tarea.id)}
                onToggleSelection={onToggleSelection}
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} min-w-[280px] text-center`}>
            {getPeriodTitle()}
          </h3>
          <button
            onClick={() => navigate('next')}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'} transition-colors`}
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'week'
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDark ? 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-300' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'month'
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDark ? 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-300' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className={`rounded-xl border ${isDark ? 'border-zinc-800/80' : 'border-gray-200'} overflow-hidden ${isDark ? 'bg-zinc-900/30' : 'bg-white'}`}>
        {/* Header de días */}
        <div className={`grid grid-cols-7 border-b ${isDark ? 'border-zinc-800/80' : 'border-gray-200'}`}>
          {dayNames.map((day, i) => (
            <div
              key={day}
              className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                i === 0 || i === 6 ? (isDark ? 'text-zinc-600' : 'text-gray-400') : (isDark ? 'text-zinc-400' : 'text-gray-500')
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div className={`grid grid-cols-7 ${viewMode === 'week' ? '' : `divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-200'}`}`}>
          {days.map((day, index) => {
            const tareasDelDia = getTareasForDay(day);
            const isToday = day.getTime() === today.getTime();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={index}
                className={`${viewMode === 'week' ? 'min-h-[400px]' : 'min-h-[120px]'} border-r ${isDark ? 'border-zinc-800/50' : 'border-gray-200'} last:border-r-0 ${
                  !isCurrentMonth && viewMode === 'month' ? (isDark ? 'bg-zinc-900/50' : 'bg-gray-50') : ''
                } ${isWeekend ? (isDark ? 'bg-zinc-900/30' : 'bg-gray-50/50') : ''}`}
              >
                {/* Número del día */}
                <div className={`px-2 py-2 text-right ${!isCurrentMonth && viewMode === 'month' ? 'opacity-40' : ''}`}>
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                      isToday
                        ? 'bg-purple-500 text-white'
                        : isWeekend
                        ? (isDark ? 'text-zinc-600' : 'text-gray-400')
                        : isDark ? 'text-zinc-400' : 'text-gray-500'
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
                          <span className={`text-xs font-medium truncate ${isCompleted ? 'line-through text-zinc-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
                            {tarea.titulo}
                          </span>
                        </div>
                        {viewMode === 'week' && tarea.asignado && (
                          <div className="flex items-center gap-1 mt-1 ml-4">
                            <UserAvatar nombre={tarea.asignado} size="xs" />
                            <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate`}>{tarea.asignado}</span>
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
      <div className={`flex items-center justify-between text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
          <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            {notas.length} nota{notas.length !== 1 ? 's' : ''} personal{notas.length !== 1 ? 'es' : ''}
          </span>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/40' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200'} transition-colors border`}
          >
            <Plus className="h-4 w-4" />
            Nueva nota
          </button>
        )}
      </div>

      {/* Formulario de creación/edición */}
      {isCreating && (
        <div className={`rounded-xl border border-purple-500/40 ${isDark ? 'bg-zinc-900/50' : 'bg-white'} p-4 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingNota ? 'Editar nota' : 'Nueva nota'}
            </h3>
            <button
              onClick={cancelEdit}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Título (opcional)"
            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border text-sm focus:outline-none focus:border-purple-500/50`}
          />

          <textarea
            value={formData.contenido}
            onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
            placeholder="Escribe tu nota aquí..."
            rows={4}
            className={`w-full px-4 py-3 rounded-lg ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border text-sm focus:outline-none focus:border-purple-500/50 resize-none`}
          />

          {/* Selector de color */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Color:</span>
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
              className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} transition-colors`}
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
        <div className={`rounded-xl border ${isDark ? 'border-zinc-800' : 'border-gray-200'} p-12 text-center ${isDark ? 'bg-zinc-900/30' : 'bg-white'}`}>
          <StickyNote className={`h-10 w-10 ${isDark ? 'text-zinc-700' : 'text-gray-300'} mx-auto mb-3`} />
          <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>No tienes notas personales</p>
          <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'} mt-1`}>Crea tu primera nota para comenzar</p>
          <button
            onClick={() => setIsCreating(true)}
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/40' : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200'} transition-colors border`}
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
                    <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
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
                      className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
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
                      className={`p-1.5 rounded-lg hover:bg-red-500/20 ${isDark ? 'text-zinc-400' : 'text-gray-400'} hover:text-red-400 transition-colors`}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contenido */}
                <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} whitespace-pre-wrap break-words line-clamp-6`}>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
        className={`flex items-center gap-3 w-full px-4 py-3 ${levelColor.header} ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-100'} transition-all`}
      >
        {open ? (
          <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
        )}
        {statusConfig ? (
          <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
        ) : groupOption ? (
          <groupOption.icon className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
        ) : null}
        <span className={`font-medium ${level === 0 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-300' : 'text-gray-700')}`}>
          {group.key}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
          {group.tareas.length}
        </span>
        {groupOption && (
          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} ml-auto`}>
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

// Tipos de tarea del flujo de Gestión de Artes
const GESTION_ARTES_TIPOS = ['Revisión de artes', 'Correccion', 'Corrección', 'Instalación', 'Impresión', 'Testigo', 'Programación', 'Recepción', 'Producción'];

function isGestionArtesTarea(tipo?: string | null): boolean {
  return !!tipo && GESTION_ARTES_TIPOS.includes(tipo);
}

// Tarea informativa "Gestión de Recepción Parcial" (ASC): navega al gestor
// de artes → tab Impresiones → sub-tab Pend. Recepción para ver el detalle.
function isRecepcionParcialTarea(tipo?: string | null): boolean {
  return tipo === 'Gestión de Recepción Parcial';
}

// Notificaciones tipo='Notificación' que en realidad pertenecen al flujo de
// Gestión de Artes (las que crea el backend al aprobar/rechazar arte).
// Las identificamos por el título porque su `tipo` es genérico.
function isArtesNotification(titulo?: string | null): boolean {
  if (!titulo) return false;
  const lower = titulo.toLowerCase();
  return lower.startsWith('artes aprobados') || lower.startsWith('artes rechazados');
}

// Función para verificar si hay navegación disponible
function hasNavigationRoute(tarea: Notificacion): boolean {
  // Tareas de Ajuste Inventario Bloqueado no tienen navegación
  if (tarea.tipo === 'Ajuste Inventario Bloqueado') {
    return false;
  }
  // Menciones en ticket siempre tienen navegación
  if (tarea.tipo === 'Mención en Ticket') {
    return true;
  }
  // Si tiene referencia_tipo y referencia_id válidos
  if (tarea.referencia_tipo && tarea.referencia_id && tarea.referencia_tipo !== 'sistema') {
    return true;
  }
  // Tareas de Gestión de Artes con campania_id
  if (isGestionArtesTarea(tarea.tipo) && tarea.campania_id) {
    return true;
  }
  // Gestión de Recepción Parcial (informativa ASC): siempre a Gestor de Artes.
  if (isRecepcionParcialTarea(tarea.tipo) && tarea.campania_id) {
    return true;
  }
  // Si es tarea de autorización o rechazo con id_solicitud, también puede navegar
  if (tarea.id_solicitud && (tarea.tipo?.includes('Autorización') || tarea.tipo?.includes('Rechazo'))) {
    return true;
  }
  return false;
}

// Función para obtener la etiqueta del botón
function getNavigationLabel(tipo: string, tipoTarea?: string, campaniaId?: number | null, propuestaId?: string | null, idSolicitud?: string | null, titulo?: string): string {
  if (tipoTarea === 'Mención en Ticket') {
    return 'Ver Ticket';
  }
  // Notificaciones de artes aprobados/rechazados → Ver Gestión de Artes
  // (tienen tipo='Notificación' pero pertenecen al flujo de Gestión de Artes)
  if (isArtesNotification(titulo)) {
    return 'Ver Gestión de Artes';
  }
  // Tareas de Gestión de Artes → Ver Gestión de Artes
  if (isGestionArtesTarea(tipoTarea)) {
    return 'Ver Gestión de Artes';
  }
  // Gestión de Recepción Parcial (informativa ASC) → sub-tab Pend. Recepción
  if (isRecepcionParcialTarea(tipoTarea)) {
    return 'Ver Recepción Parcial';
  }
  // Tareas de Rechazo: usar referencia_tipo para el label correcto
  if (tipoTarea?.includes('Rechazo')) {
    if (tipo === 'propuesta') return 'Editar Propuesta';
    if (tipo === 'campana') return 'Editar Campaña';
    return 'Editar Solicitud';
  }
  // Tareas de Aprobación: usar referencia_tipo
  if (tipoTarea?.includes('Aprobación')) {
    if (tipo === 'propuesta') return 'Ver Propuesta';
    if (tipo === 'campana') return 'Ver Campaña';
    return 'Ver Solicitud';
  }
  // Tareas de Autorización: usar referencia_tipo (tipo) del backend
  if (tipoTarea?.includes('Autorización')) {
    if (tipo === 'campana') return 'Ver Campaña';
    if (tipo === 'propuesta') return 'Ver Propuesta';
    if (tipo === 'solicitud') return 'Ver Solicitud';
    if (campaniaId) return 'Ver Campaña';
    if (propuestaId) return 'Ver Propuesta';
    return 'Ver Solicitud';
  }
  // Notif de comentario: el titulo dice donde fue dejado el comentario
  // (en solicitud / en propuesta / en campaña). Esto va antes del fallback
  // de propuestaId, que se cumple para los 3 casos y mandaba todo a propuesta.
  const commentEntity = getCommentEntity(titulo || '');
  if (commentEntity === 'campana') return 'Ver Campaña';
  if (commentEntity === 'propuesta') return 'Ver Propuesta';
  if (commentEntity === 'solicitud') return 'Ver Solicitud';

  if (tipoTarea?.toLowerCase().includes('solicitud')) {
    return 'Ver Solicitud';
  }
  if (tipoTarea?.toLowerCase().includes('campaña')) {
    return 'Ver Campaña';
  }
  if (tipoTarea?.toLowerCase().includes('propuesta') || tipoTarea?.toLowerCase().includes('ajuste cto') || propuestaId) {
    return 'Ver Propuesta';
  }
  // Si tiene campania_id, ir a campaña
  if (campaniaId) {
    return 'Ver Campaña';
  }
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

// Para una notif de comentario, distinguir si el comentario fue dejado en
// solicitud, propuesta o campaña usando el titulo "Nuevo comentario en X #..."
// Sin esto, el front cae al fallback que ve id_propuesta poblado y siempre
// dice "Ver Propuesta" aunque el comentario haya sido en una campaña.
function getCommentEntity(titulo: string): 'campana' | 'propuesta' | 'solicitud' | null {
  if (!isCommentNotification(titulo)) return null;
  const lower = titulo.toLowerCase();
  if (lower.includes('en campaña') || lower.includes('en campana')) return 'campana';
  if (lower.includes('en propuesta')) return 'propuesta';
  if (lower.includes('en solicitud')) return 'solicitud';
  return null;
}

// Función para verificar si es una tarea de rechazo que requiere edición
function isRejectionTask(titulo: string): boolean {
  const lower = titulo.toLowerCase();
  return lower.includes('rechazad') || lower.includes('rechazo') || lower.includes('requiere edición');
}

function getRejectionSolicitudId(tarea: Notificacion): number | null {
  if (!tarea.tipo?.includes('Rechazo')) return null;
  const solId = tarea.id_solicitud ? parseInt(tarea.id_solicitud) : null;
  return solId && !isNaN(solId) ? solId : null;
}

// Función para obtener la ruta de navegación directa al detalle
function getDirectNavigationPath(tipo: string, id: number, titulo: string, tipoTarea?: string, campaniaId?: number | null, propuestaId?: number | null, tareaId?: number): string {
  const isComment = isCommentNotification(titulo);
  const isRejection = isRejectionTask(titulo);

  // Tareas de Gestión de Artes → Gestión de Artes con auto-open del modal (prioridad sobre propuesta)
  if (isGestionArtesTarea(tipoTarea) && campaniaId) {
    return `/campanas/${campaniaId}/tareas?taskId=${tareaId || id}`;
  }
  // Gestión de Recepción Parcial (informativa ASC) → tab Impresiones →
  // sub-tab Pend. Recepción para que el ASC vea el detalle de la parcial.
  if (isRecepcionParcialTarea(tipoTarea) && campaniaId) {
    return `/campanas/${campaniaId}/tareas?tab=impresiones&subtab=pendiente_recepcion`;
  }

  // Notificaciones de "Artes aprobados/rechazados" (tipo='Notificación') →
  // ir directo a Gestión de Artes de la campaña.
  if (isArtesNotification(titulo) && campaniaId) {
    return `/campanas/${campaniaId}/tareas`;
  }

  // Si es tarea de propuesta (ajuste cto, etc.) o tiene id_propuesta, ir al detalle de propuesta
  // Excluir tareas de Autorización/Rechazo — esas usan referencia_tipo del backend
  const isSeguimientoCampana = tipoTarea?.toLowerCase().includes('seguimiento') && tipoTarea?.toLowerCase().includes('campaña');
  const isAutorizacionOrRechazo = tipoTarea?.includes('Autorización') || tipoTarea?.includes('Rechazo') || tipoTarea?.includes('Aprobación');

  // Seguimiento Campaña: siempre al detalle de campaña (el backend devuelve referencia_tipo='solicitud' por la prioridad de id_solicitud)
  if (isSeguimientoCampana && campaniaId) {
    return `/campanas/detail/${campaniaId}`;
  }

  if (!isSeguimientoCampana && !isAutorizacionOrRechazo && (tipoTarea?.toLowerCase().includes('propuesta') || tipoTarea?.toLowerCase().includes('ajuste cto') || propuestaId)) {
    return `/propuestas?viewId=${propuestaId || id}`;
  }

  // Si tiene campania_id, ir al detalle de campaña (excepto si referencia_tipo o tipoTarea indican solicitud/propuesta)
  if (campaniaId && tipo !== 'solicitud' && tipo !== 'propuesta' && !tipoTarea?.toLowerCase().includes('solicitud') && !tipoTarea?.toLowerCase().includes('propuesta')) {
    return `/campanas/detail/${campaniaId}`;
  }

  switch (tipo) {
    case 'propuesta':
      return `/propuestas?viewId=${id}`;
    case 'campana':
      return `/campanas/detail/${id}`;
    case 'solicitud':
      // Si es tarea de rechazo, abrir modal de edición directamente
      if (isRejection) {
        return `/solicitudes?editId=${id}`;
      }
      // Si es notificación de comentario, abrir modal de comentarios
      return isComment
        ? `/solicitudes?commentsId=${id}`
        : (tipoTarea?.includes('AprobaciÃ³n') || tipoTarea?.includes('Rechazo')) && titulo.toLowerCase().includes('solicitud')
          ? `/solicitudes?editId=${id}`
          : `/solicitudes?viewId=${id}`;
    default:
      return '/';
  }
}

// ============ MODAL DE APROBACIÓN ============
function ApprovalModal({
  tarea,
  onClose,
  onAction,
}: {
  tarea: Notificacion;
  onClose: () => void;
  onAction: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [showRechazoInput, setShowRechazoInput] = useState(false);
  const queryClient = useQueryClient();

  const isAutorizacionTask = tarea.tipo?.includes('Autorización');
  const tipoAutorizacion = tarea.tipo?.includes('DG') ? 'dg' : tarea.tipo?.includes('DCM') ? 'dcm' : null;

  const [idPropuestaState, setIdPropuestaState] = useState<string | null>(tarea.id_propuesta || null);
  const [solicitudFallbackTried, setSolicitudFallbackTried] = useState(false);
  const [collapsedCatorcenas, setCollapsedCatorcenas] = useState<Set<string>>(new Set());
  const toggleCatorcena = (key: string) => {
    setCollapsedCatorcenas(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const fetchPropuestaBySolicitud = async (solicitudId: string) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/propuestas?solicitudId=${solicitudId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      return data.data[0].id.toString();
    }
    return null;
  };

  useEffect(() => {
    if (!tarea.id_propuesta && tarea.id_solicitud && isAutorizacionTask) {
      fetchPropuestaBySolicitud(tarea.id_solicitud)
        .then(id => { if (id) setIdPropuestaState(id); })
        .catch(err => console.error('Error buscando propuesta:', err));
    } else if (tarea.id_propuesta) {
      setIdPropuestaState(tarea.id_propuesta);
    }
  }, [tarea.id_propuesta, tarea.id_solicitud, isAutorizacionTask]);

  const idPropuesta = idPropuestaState;

  const { data: carasData, refetch: refetchCaras } = useQuery({
    queryKey: ['approval-modal-caras', idPropuesta],
    queryFn: () => notificacionesService.getCarasAutorizacion(idPropuesta || ''),
    enabled: !!idPropuesta,
  });

  useEffect(() => {
    if (
      isAutorizacionTask &&
      !solicitudFallbackTried &&
      carasData !== undefined &&
      carasData.length === 0 &&
      tarea.id_solicitud &&
      idPropuestaState === tarea.id_propuesta
    ) {
      setSolicitudFallbackTried(true);
      fetchPropuestaBySolicitud(tarea.id_solicitud)
        .then(realId => {
          if (realId && realId !== idPropuestaState) {
            setIdPropuestaState(realId);
          }
        })
        .catch(err => console.error('Error buscando propuesta (fallback):', err));
    }
  }, [carasData, isAutorizacionTask, solicitudFallbackTried, tarea.id_solicitud, tarea.id_propuesta, idPropuestaState]);

  const { data: resumenData, refetch: refetchResumen } = useQuery({
    queryKey: ['approval-modal-resumen', idPropuesta],
    queryFn: () => notificacionesService.getResumenAutorizacion(idPropuesta || ''),
    enabled: !!idPropuesta,
  });

  const { data: historialData } = useQuery({
    queryKey: ['approval-modal-historial', idPropuesta],
    queryFn: () => notificacionesService.getHistorialAutorizacion(idPropuesta || ''),
    enabled: !!idPropuesta,
  });

  const aprobarMutation = useMutation({
    mutationFn: () => notificacionesService.aprobarAutorizacion(idPropuesta || '', tipoAutorizacion as 'dg' | 'dcm'),
    onSuccess: () => {
      refetchCaras();
      refetchResumen();
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      queryClient.invalidateQueries({ queryKey: ['approval-modal-historial', idPropuesta] });
      onAction();
    },
  });

  const rechazarMutation = useMutation({
    mutationFn: (motivo: string) => notificacionesService.rechazarAutorizacion(idPropuesta || '', motivo),
    onSuccess: () => {
      setShowRechazoInput(false);
      setRechazoMotivo('');
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      onAction();
      onClose();
    },
  });

  // Filtro DG / DCM (paso previo con Gerente Comercial) — no aprueba/rechaza
  // caras, solo decide "Enviar a Dirección" o "Rechazar como Corrección" a
  // nivel tarea. Feedback 2026-08-15: espejo del flujo DG para DCM +
  // comentario opcional al aprobar.
  const isFiltroDgTask = tarea.tipo === 'Filtro Autorización DG';
  const isFiltroDcmTask = tarea.tipo === 'Filtro Autorización DCM';
  const isFiltroTask = isFiltroDgTask || isFiltroDcmTask;
  const filtroDireccion: 'DG' | 'DCM' = isFiltroDcmTask ? 'DCM' : 'DG';
  const filtroDireccionLabel = filtroDireccion === 'DG' ? 'Dirección General' : 'Dirección Comercial';
  const [comentarioAprobacionFiltro, setComentarioAprobacionFiltro] = useState('');

  const aprobarFiltroMutation = useMutation({
    mutationFn: (comentario?: string) => filtroDireccion === 'DG'
      ? notificacionesService.aprobarFiltroDg(tarea.id, comentario)
      : notificacionesService.aprobarFiltroDcm(tarea.id, comentario),
    onSuccess: () => {
      setComentarioAprobacionFiltro('');
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      onAction();
      onClose();
    },
  });
  const rechazarFiltroMutation = useMutation({
    mutationFn: (motivo: string) => filtroDireccion === 'DG'
      ? notificacionesService.rechazarFiltroDg(tarea.id, motivo)
      : notificacionesService.rechazarFiltroDcm(tarea.id, motivo),
    onSuccess: () => {
      setShowRechazoInput(false);
      setRechazoMotivo('');
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      onAction();
      onClose();
    },
  });

  const allCaras = carasData || [];
  const carasPendientes = useMemo(() => {
    if (!carasData || !tipoAutorizacion) return [];
    if (tipoAutorizacion === 'dg') return carasData.filter(c => c.autorizacion_dg === 'pendiente');
    return carasData.filter(c => c.autorizacion_dcm === 'pendiente');
  }, [carasData, tipoAutorizacion]);

  const [autoFinalized, setAutoFinalized] = useState(false);
  useEffect(() => {
    // No auto-finalizar para Filtro DG/DCM — el GC debe decidir explicitamente.
    if (isFiltroTask) return;
    if (
      carasData &&
      carasData.length > 0 &&
      carasPendientes.length === 0 &&
      tarea.estatus !== 'Atendido' &&
      tarea.estatus !== 'Cancelado' &&
      !autoFinalized
    ) {
      setAutoFinalized(true);
      notificacionesService.marcarLeida(tarea.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
        queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
        onAction();
      }).catch(err => console.error('Error auto-finalizando tarea:', err));
    }
  }, [carasData, carasPendientes, tarea.estatus, tarea.id, autoFinalized]);

  const cliente = allCaras[0]?.cliente || tarea.cliente || '—';
  const creador = tarea.creador || tarea.asesor || '—';
  const origen = tarea.contenido === 'campana' ? 'Campaña' : tarea.contenido === 'propuesta' ? 'Propuesta' : tarea.contenido === 'solicitud' ? 'Solicitud' : '—';

  const catorcenaGroups = useMemo(() => {
    const unsorted = new Map<string, CaraAutorizacion[]>();
    allCaras.forEach(c => {
      const key = c.catorcena || 'Sin periodo';
      if (!unsorted.has(key)) unsorted.set(key, []);
      unsorted.get(key)!.push(c);
    });
    const sorted = new Map([...unsorted.entries()].sort((a, b) => {
      const parse = (k: string) => { const m = k.match(/Cat\s+(\d+)\s*-\s*(\d+)/); return m ? Number(m[2]) * 100 + Number(m[1]) : 9999; };
      return parse(a[0]) - parse(b[0]);
    }));
    return sorted;
  }, [allCaras]);

  const totals = useMemo(() => {
    let totalCaras = 0, totalBonif = 0, totalInversion = 0;
    allCaras.forEach(c => {
      totalCaras += c.caras || 0;
      totalBonif += Number(c.bonificacion) || 0;
      totalInversion += Number(c.costo) || 0;
    });
    return { totalCaras, totalBonif, totalInversion, totalGeneral: totalCaras + totalBonif };
  }, [allCaras]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] mx-2 sm:mx-4 rounded-2xl ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 sm:p-6 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-orange-400" />
              </div>
              <div className="min-w-0">
                <h2 className={`text-base sm:text-lg font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{tarea.tipo}</h2>
                <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{tarea.titulo}</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 flex-shrink-0 rounded-xl ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Info cards — compactas en móvil para dejar espacio a la tabla.
              Feedback Jos 2026-07-15. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3">
            <div className={`px-2 py-1.5 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cliente</div>
              <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{cliente}</div>
            </div>
            <div className={`px-2 py-1.5 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Creador</div>
              <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{creador}</div>
            </div>
            <div className={`px-2 py-1.5 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Origen</div>
              <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{origen}</div>
            </div>
            <div className={`px-2 py-1.5 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Creación</div>
              <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{tarea.fecha_creacion ? formatDate(tarea.fecha_creacion) : '—'}</div>
            </div>
          </div>
        </div>

        {/* Resumen + Inversión — compactas en móvil */}
        <div className={`px-3 sm:px-6 py-2 sm:py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-3">
            {resumenData && (
              <>
                <div className="px-1.5 py-1 sm:p-2 rounded-md sm:rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-sm sm:text-lg font-bold text-emerald-400 leading-tight">{resumenData.aprobadas}</div>
                  <div className={`text-[9px] sm:text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Aprobadas</div>
                </div>
                <div className="px-1.5 py-1 sm:p-2 rounded-md sm:rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                  <div className="text-sm sm:text-lg font-bold text-red-400 leading-tight">{tipoAutorizacion === 'dcm' ? resumenData.pendientesDcm : resumenData.pendientesDg}</div>
                  <div className={`text-[9px] sm:text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Pend. {tipoAutorizacion === 'dcm' ? 'DCM' : 'DG'}</div>
                </div>
              </>
            )}
            <div className="px-1.5 py-1 sm:p-2 rounded-md sm:rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
              <div className="text-sm sm:text-lg font-bold text-cyan-400 leading-tight">{totals.totalGeneral}</div>
              <div className={`text-[9px] sm:text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Total caras</div>
            </div>
            <div className="px-1.5 py-1 sm:p-2 rounded-md sm:rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-sm sm:text-lg font-bold text-emerald-400 leading-tight">{totals.totalBonif}</div>
              <div className={`text-[9px] sm:text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Bonificación</div>
            </div>
            <div className="px-1.5 py-1 sm:p-2 rounded-md sm:rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
              <div className="text-xs sm:text-lg font-bold text-purple-400 leading-tight truncate">${totals.totalInversion.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`text-[9px] sm:text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Inversión</div>
            </div>
          </div>
        </div>

        {/* Tabla de caras organizada por catorcenas */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
          {Array.from(catorcenaGroups.entries()).map(([catorcena, caras]) => {
            const periodoInfo = caras[0]?.inicio_periodo && caras[0]?.fin_periodo
              ? `${formatDate(caras[0].inicio_periodo)} → ${formatDate(caras[0].fin_periodo)}`
              : '';
            const isCollapsed = collapsedCatorcenas.has(catorcena);
            const subtotalInversion = caras.reduce((sum, c) => sum + (Number(c.costo) || 0), 0);
            const subtotalCaras = caras.reduce((sum, c) => sum + (c.caras || 0) + (Number(c.bonificacion) || 0), 0);
            return (
              <div key={catorcena} className="mb-4">
                <button
                  type="button"
                  onClick={() => toggleCatorcena(catorcena)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800/60 bg-zinc-800/30' : 'hover:bg-gray-100 bg-gray-50'}`}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-cyan-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-cyan-400 flex-shrink-0" />}
                  <Calendar className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{catorcena}</span>
                  {periodoInfo && (
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{periodoInfo}</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
                    {caras.length} circuito{caras.length !== 1 ? 's' : ''}
                  </span>
                  <span className={`ml-auto text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    {subtotalCaras} caras · ${subtotalInversion.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>

                {!isCollapsed && (
                <div className={`mt-2 rounded-xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200'} overflow-x-auto scrollbar-purple`}>
                  {/* min-w para forzar scroll horizontal en móvil (10 columnas
                      no caben en <640px). Feedback Jos 2026-07-15. */}
                  <table className="w-full min-w-[820px]">
                    <thead className={isDark ? 'bg-zinc-800/70' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-3 py-2.5 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Artículo</th>
                        <th className={`px-3 py-2.5 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Plaza</th>
                        <th className={`px-3 py-2.5 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Tipo</th>
                        <th className={`px-3 py-2.5 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Caras</th>
                        <th className={`px-3 py-2.5 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Bonif.</th>
                        <th className={`px-3 py-2.5 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Total</th>
                        <th className={`px-3 py-2.5 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>T. Efectiva</th>
                        <th className={`px-3 py-2.5 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Tarifa Pub.</th>
                        <th className={`px-3 py-2.5 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Precio Total</th>
                        <th className={`px-3 py-2.5 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase`}>Estado</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-100'}`}>
                      {caras.map((cara) => (
                        <tr key={cara.id} className={isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2.5">
                            <div className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{cara.articulo || '—'}</div>
                            <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{cara.formato}</div>
                          </td>
                          <td className={`px-3 py-2.5 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{cara.estados || cara.ciudad}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              {cara.tipo}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-xs text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{cara.caras}</td>
                          <td className="px-3 py-2.5 text-xs text-center text-emerald-400">{cara.bonificacion}</td>
                          <td className="px-3 py-2.5 text-xs text-center text-cyan-300 font-semibold">{cara.total_caras}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-purple-300 font-mono">
                            ${cara.tarifa_efectiva?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right text-amber-300 font-mono">
                            ${cara.tarifa_publica?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right text-emerald-400 font-mono font-medium">
                            ${(Number(cara.costo) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col gap-0.5 items-center">
                              {cara.autorizacion_dg === 'aprobado' && cara.autorizacion_dcm === 'aprobado' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">OK</span>
                              )}
                              {(cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado') && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-400">Rech.</span>
                              )}
                              {cara.autorizacion_dg === 'pendiente' && cara.autorizacion_dcm !== 'rechazado' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">DG</span>
                              )}
                              {cara.autorizacion_dcm === 'pendiente' && cara.autorizacion_dg !== 'rechazado' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">DCM</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            );
          })}

          {allCaras.length === 0 && (
            <div className={`text-center py-12 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando circuitos...</p>
            </div>
          )}

          {/* Historial de autorización */}
          {historialData && historialData.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
                <Clock className="h-3.5 w-3.5" />
                Historial de cambios
              </h3>
              <div className={`rounded-xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200'} overflow-hidden max-h-60 overflow-y-auto`}>
                {historialData.map((entry, idx) => {
                  const isAprobacion = entry.tipo.includes('aprobacion');
                  const isRechazo = entry.tipo.includes('rechazo');
                  const isCambio = entry.tipo.includes('cambio');
                  const isNuevaCara = entry.tipo.includes('nueva_cara');
                  const isSolicitud = !isCambio && !isNuevaCara && (entry.tipo.includes('solicitud') || entry.tipo.includes('propuesta') || entry.tipo.includes('campana'));
                  const dotColor = isAprobacion ? 'bg-emerald-400' : isRechazo ? 'bg-red-400' : isCambio ? 'bg-blue-400' : isNuevaCara ? 'bg-cyan-400' : 'bg-amber-400';
                  return (
                    <div key={entry.id} className={`flex items-start gap-3 px-4 py-3 ${idx > 0 ? `border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-100'}` : ''}`}>
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{entry.accion}</p>
                        {isRechazo && entry.detalles?.motivo && (
                          <p className={`text-[11px] ${isDark ? 'text-red-400/70' : 'text-red-600/70'} mt-0.5`}>Motivo: {entry.detalles.motivo}</p>
                        )}
                        {isSolicitud && entry.detalles?.caras && (
                          <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-0.5`}>
                            {entry.detalles.caras.length} circuito(s){entry.detalles.pendientesDg ? ` — Pend. DG: ${entry.detalles.pendientesDg}` : ''}{entry.detalles.pendientesDcm ? ` — Pend. DCM: ${entry.detalles.pendientesDcm}` : ''}
                          </p>
                        )}
                        {isCambio && entry.detalles?.cambios && (
                          <div className="mt-2 space-y-1.5">
                            {(entry.detalles.cambios as { articulo: string; label: string; antes: string; despues: string }[]).map((c: { articulo: string; label: string; antes: string; despues: string }, i: number) => (
                              <div key={i} className={`rounded-lg border ${isDark ? 'border-zinc-700/50' : 'border-gray-200'} overflow-hidden`}>
                                <div className={`px-2.5 py-1 text-[10px] font-medium ${isDark ? 'bg-zinc-800/50 text-zinc-400' : 'bg-gray-50 text-gray-500'}`}>
                                  {c.articulo} · {c.label}
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-zinc-700/30">
                                  <div className="px-2.5 py-1.5 bg-red-500/5">
                                    <div className="text-[9px] uppercase text-red-400/70 mb-0.5">Antes</div>
                                    <div className={`text-[11px] font-mono ${isDark ? 'text-red-300' : 'text-red-600'}`}>{c.antes}</div>
                                  </div>
                                  <div className="px-2.5 py-1.5 bg-emerald-500/5">
                                    <div className="text-[9px] uppercase text-emerald-400/70 mb-0.5">Actual</div>
                                    <div className={`text-[11px] font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>{c.despues}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} flex-shrink-0`}>
                        {formatDateCompact(entry.fecha)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notas Dirección — bitácora acumulable */}
          {tarea.id_solicitud && (
            <NotasDireccionBitacora
              idSolicitud={parseInt(tarea.id_solicitud)}
              isDark={isDark}
              bitacoraCount={tarea.notas_direccion_bitacora_count}
            />
          )}
        </div>

        {/* Footer con acciones */}
        {isAutorizacionTask && tarea.estatus !== 'Atendido' && tarea.estatus !== 'Cancelado' && (
          <div className={`p-4 sm:p-6 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            {!showRechazoInput ? (
              <>
                {/* Feedback 2026-08-15: comentario opcional para filtros DG/DCM.
                    Si el gerente pone algo, el back crea una tarea 'Notificación'
                    al asesor con el mensaje. Si lo deja vacío, comportamiento
                    igual que antes (no rompe nada). */}
                {isFiltroTask && (
                  <div className="mb-3">
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} block mb-1`}>Comentario (opcional)</label>
                    <textarea
                      value={comentarioAprobacionFiltro}
                      onChange={(e) => setComentarioAprobacionFiltro(e.target.value)}
                      placeholder={`Notas para el asesor al enviar a ${filtroDireccionLabel}...`}
                      rows={2}
                      className={`w-full px-3 py-2 rounded-xl ${isDark ? 'bg-zinc-800/50 text-white placeholder:text-zinc-600 border-zinc-700' : 'bg-gray-50 text-gray-900 placeholder:text-gray-400 border-gray-300'} border text-sm focus:outline-none focus:border-emerald-500/50 resize-none`}
                    />
                  </div>
                )}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => isFiltroTask
                      ? aprobarFiltroMutation.mutate(comentarioAprobacionFiltro.trim() || undefined)
                      : aprobarMutation.mutate()}
                    disabled={isFiltroTask
                      ? aprobarFiltroMutation.isPending
                      : (aprobarMutation.isPending || carasPendientes.length === 0)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {(isFiltroTask ? aprobarFiltroMutation.isPending : aprobarMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span className="truncate">
                      {isFiltroTask
                        ? (aprobarFiltroMutation.isPending ? 'Enviando...' : `Enviar a ${filtroDireccionLabel}`)
                        : (aprobarMutation.isPending ? 'Aprobando...' : `Aprobar ${carasPendientes.length} circuito${carasPendientes.length !== 1 ? 's' : ''}`)}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowRechazoInput(true)}
                    disabled={!isFiltroTask && carasPendientes.length === 0}
                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/30 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <X className="h-4 w-4" />
                    {isFiltroTask ? 'Rechazar como Corrección' : 'Rechazar'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rechazoMotivo}
                  onChange={(e) => setRechazoMotivo(e.target.value)}
                  placeholder={isFiltroTask
                    ? `Describe qué necesita corregir el creador antes de enviar a ${filtroDireccionLabel}...`
                    : 'Escribe el motivo del rechazo...'}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-800/50 text-white placeholder:text-zinc-600' : 'bg-gray-50 text-gray-900 placeholder:text-gray-400'} border border-red-500/30 text-sm focus:outline-none focus:border-red-500/50 resize-none`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => isFiltroTask ? rechazarFiltroMutation.mutate(rechazoMotivo) : rechazarMutation.mutate(rechazoMotivo)}
                    disabled={(isFiltroTask ? rechazarFiltroMutation.isPending : rechazarMutation.isPending) || !rechazoMotivo.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {(isFiltroTask ? rechazarFiltroMutation.isPending : rechazarMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isFiltroTask
                      ? (rechazarFiltroMutation.isPending ? 'Enviando corrección...' : 'Confirmar Corrección')
                      : (rechazarMutation.isPending ? 'Rechazando...' : 'Confirmar Rechazo')}
                  </button>
                  <button
                    onClick={() => { setShowRechazoInput(false); setRechazoMotivo(''); }}
                    className={`px-4 py-2.5 rounded-xl text-sm ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} transition-all`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Panel lateral (Drawer) - Solo lectura, solo permite agregar comentarios
function TaskDrawer({
  tarea,
  onClose,
  onAddComment,
  onUpdateFechaFin,
  onNavigate,
  isClosing = false,
  onAutorizacionAction,
  contentType,
  onOpenApprovalModal,
}: {
  tarea: Notificacion & { comentarios?: ComentarioTarea[] };
  onClose: () => void;
  onAddComment: (contenido: string) => void;
  onUpdateFechaFin?: (fecha_fin: string) => void;
  onNavigate?: (path: string) => void;
  isClosing?: boolean;
  onAutorizacionAction?: () => void;
  contentType: ContentType;
  onOpenApprovalModal?: () => void;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [comment, setComment] = useState('');
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [showRechazoInput, setShowRechazoInput] = useState(false);
  const [isEditingFecha, setIsEditingFecha] = useState(false);
  const [fechaFinEdit, setFechaFinEdit] = useState(
    tarea.fecha_fin ? new Date(tarea.fecha_fin).toISOString().split('T')[0] : ''
  );
  const user = useAuthStore((state) => state.user);
  const canNavigate = hasNavigationRoute(tarea);
  const isAdmin = ['Administrador', 'DEV'].includes(user?.rol || '');
  // CSV: Coordinador de Diseño puede "Asignación de revisión de artes a otro
  // diseñador". Le habilitamos el editor de asignados, pero SOLO en tareas
  // del tipo 'Revisión de artes' (no en otros tipos).
  const isCoordDisenoEditingRevision = user?.rol === 'Coordinador de Diseño'
    && tarea.tipo === 'Revisión de artes';
  const canEditAsignados = isAdmin || isCoordDisenoEditingRevision;

  const queryClient = useQueryClient();

  const { data: usuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosService.getAll(),
    enabled: canEditAsignados && contentType === 'tareas',
    staleTime: 5 * 60 * 1000,
  });

  const updateAsignadoMutation = useMutation({
    mutationFn: ({ asignado, id_asignado }: { asignado: string; id_asignado: string }) =>
      notificacionesService.update(tarea.id, { asignado, id_asignado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      // Si la tarea pertenece a una campaña, invalidar tambien las queries de
      // tareas por campaña para que el TaskDetailModal del gestor de artes
      // refleje el nuevo asignado al abrir.
      queryClient.invalidateQueries({ queryKey: ['campana-tareas'], exact: false });
    },
  });

  const [asignadoOpen, setAsignadoOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    tarea.id_asignado != null ? String(tarea.id_asignado).split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const asignadoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asignadoOpen) return;
    const handler = (e: MouseEvent) => {
      if (asignadoRef.current && !asignadoRef.current.contains(e.target as Node)) setAsignadoOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [asignadoOpen]);

  const toggleAsignado = (uid: string) => {
    const newIds = selectedIds.includes(uid) ? selectedIds.filter(id => id !== uid) : [...selectedIds, uid];
    setSelectedIds(newIds);
    const newNames = newIds.map(id => usuarios?.find(u => String(u.id) === id)?.nombre ?? '').filter(Boolean);
    updateAsignadoMutation.mutate({ asignado: newNames.join(', '), id_asignado: newIds.join(',') });
  };

  const marcarLeidaMutation = useMutation({
    mutationFn: (estatus: string) => notificacionesService.update(tarea.id, { estatus }),
    onSuccess: async () => {
      const updated = await notificacionesService.getById(tarea.id);
      // Llamar al callback onClose para refrescar
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
    },
  });

  // Detectar si es tarea de autorización
  const isAutorizacionTask = tarea.tipo?.includes('Autorización');
  const tipoAutorizacion = tarea.tipo?.includes('DG') ? 'dg' : tarea.tipo?.includes('DCM') ? 'dcm' : null;

  const [idPropuestaState, setIdPropuestaState] = useState<string | null>(tarea.id_propuesta || null);
  const [solicitudFallbackTried, setSolicitudFallbackTried] = useState(false);
  const [collapsedCatorcenas, setCollapsedCatorcenas] = useState<Set<string>>(new Set());
  const toggleCatorcena = (key: string) => {
    setCollapsedCatorcenas(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const fetchPropuestaBySolicitud = async (solicitudId: string) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/propuestas?solicitudId=${solicitudId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      return data.data[0].id.toString();
    }
    return null;
  };

  // Si no hay id_propuesta pero hay id_solicitud, buscar la propuesta
  useEffect(() => {
    if (!tarea.id_propuesta && tarea.id_solicitud && isAutorizacionTask) {
      fetchPropuestaBySolicitud(tarea.id_solicitud)
        .then(id => { if (id) setIdPropuestaState(id); })
        .catch(err => console.error('Error buscando propuesta:', err));
    } else if (tarea.id_propuesta) {
      setIdPropuestaState(tarea.id_propuesta);
    }
  }, [tarea.id_propuesta, tarea.id_solicitud, isAutorizacionTask]);

  const idPropuesta = idPropuestaState;

  // Query para obtener caras pendientes si es tarea de autorización
  const { data: carasData, refetch: refetchCaras } = useQuery({
    queryKey: ['autorizacion-caras', idPropuesta],
    queryFn: () => notificacionesService.getCarasAutorizacion(idPropuesta || ''),
    enabled: isAutorizacionTask && !!idPropuesta,
  });

  // Fallback: si el id_propuesta de la tarea apunta a una propuesta huérfana (0 caras),
  // intentar resolver la propuesta real por id_solicitud.
  useEffect(() => {
    if (
      isAutorizacionTask &&
      !solicitudFallbackTried &&
      carasData !== undefined &&
      carasData.length === 0 &&
      tarea.id_solicitud &&
      idPropuestaState === tarea.id_propuesta
    ) {
      setSolicitudFallbackTried(true);
      fetchPropuestaBySolicitud(tarea.id_solicitud)
        .then(realId => {
          if (realId && realId !== idPropuestaState) {
            setIdPropuestaState(realId);
          }
        })
        .catch(err => console.error('Error buscando propuesta (fallback):', err));
    }
  }, [carasData, isAutorizacionTask, solicitudFallbackTried, tarea.id_solicitud, tarea.id_propuesta, idPropuestaState]);

  // Query para resumen de autorización
  const { data: resumenData, refetch: refetchResumen } = useQuery({
    queryKey: ['autorizacion-resumen', idPropuesta],
    queryFn: () => notificacionesService.getResumenAutorizacion(idPropuesta || ''),
    enabled: isAutorizacionTask && !!idPropuesta,
  });

  // Mutation para aprobar
  const aprobarMutation = useMutation({
    mutationFn: () => notificacionesService.aprobarAutorizacion(idPropuesta || '', tipoAutorizacion as 'dg' | 'dcm'),
    onSuccess: () => {
      refetchCaras();
      refetchResumen();
      onAutorizacionAction?.();
    },
  });

  // Mutation para rechazar
  const rechazarMutation = useMutation({
    mutationFn: (motivo: string) => notificacionesService.rechazarAutorizacion(idPropuesta || '', motivo),
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

  // Filtrar caras según tipo de autorización (usando columnas separadas)
  const carasPendientes = useMemo(() => {
    if (!carasData || !tipoAutorizacion) return [];
    // Filtrar por la columna correspondiente: autorizacion_dg o autorizacion_dcm
    if (tipoAutorizacion === 'dg') {
      return carasData.filter(c => c.autorizacion_dg === 'pendiente');
    } else {
      return carasData.filter(c => c.autorizacion_dcm === 'pendiente');
    }
  }, [carasData, tipoAutorizacion]);

  const handleNavigate = () => {
    if (!onNavigate) return;
    // Mención en Ticket → abrir historial con el ticket
    if (tarea.tipo === 'Mención en Ticket' && tarea.id_solicitud) {
      onNavigate(`/admin/tickets-historial?ticketId=${tarea.id_solicitud}`);
      return;
    }
    // Notif de comentario: el titulo dice donde fue dejado (solicitud / propuesta / campaña).
    // Sin esto el handler caia al ultimo branch (que solo entra si tipo es
    // Autorización/Rechazo) o al de referencia_tipo+referencia_id (que no existen),
    // por eso el boton no llevaba a ningun lado o llevaba a propuesta por id_propuesta.
    const commentEntity = getCommentEntity(tarea.titulo || '');
    if (commentEntity === 'campana' && tarea.campania_id) {
      onNavigate(`/campanas/${tarea.campania_id}`);
      return;
    }
    if (commentEntity === 'propuesta' && tarea.id_propuesta) {
      const propId = parseInt(tarea.id_propuesta);
      if (!isNaN(propId)) {
        onNavigate(getDirectNavigationPath('propuesta', propId, tarea.titulo || '', tarea.tipo || undefined, null, propId));
        return;
      }
    }
    if (commentEntity === 'solicitud' && tarea.id_solicitud) {
      const solicitudId = parseInt(tarea.id_solicitud);
      if (!isNaN(solicitudId)) {
        onNavigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
        return;
      }
    }
    // Si tiene referencia_tipo y referencia_id, usar esos
    if (tarea.referencia_tipo && tarea.referencia_id) {
      const propId = tarea.id_propuesta ? parseInt(tarea.id_propuesta) : null;
      const path = getDirectNavigationPath(tarea.referencia_tipo, tarea.referencia_id, tarea.titulo || '', tarea.tipo || undefined, tarea.campania_id, propId, tarea.id);
      onNavigate(path);
      return;
    }
    // Tareas de Gestión de Artes con campania_id → Gestión de Artes
    if (isGestionArtesTarea(tarea.tipo) && tarea.campania_id) {
      onNavigate(`/campanas/${tarea.campania_id}/tareas?taskId=${tarea.id}`);
      return;
    }
    // Si es tarea de autorización/rechazo, navegar según título
    if (tarea.id_solicitud && (tarea.tipo?.includes('Autorización') || tarea.tipo?.includes('Rechazo'))) {
      const tituloLower = (tarea.titulo || '').toLowerCase();
      // Si el título dice "Solicitud", navegar a solicitud
      if (tituloLower.includes('solicitud') && tarea.id_solicitud) {
        const solicitudId = parseInt(tarea.id_solicitud);
        if (!isNaN(solicitudId)) {
          onNavigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
          return;
        }
      }
      // Si tiene campania_id, navegar a campaña
      if (tarea.campania_id) {
        onNavigate(`/campanas/${tarea.campania_id}`);
        return;
      }
      // Si tiene id_propuesta, navegar a propuesta
      if (tarea.id_propuesta) {
        const propId = parseInt(tarea.id_propuesta);
        if (!isNaN(propId)) {
          onNavigate(getDirectNavigationPath('propuesta', propId, tarea.titulo || '', tarea.tipo || undefined, null, propId));
          return;
        }
      }
      // Fallback: solicitud
      const solicitudId = parseInt(tarea.id_solicitud);
      if (!isNaN(solicitudId)) {
        onNavigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
      }
    }
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
    <div className={`fixed inset-y-0 right-0 w-full max-w-md ${isDark ? 'bg-zinc-900/95' : 'bg-white/95'} backdrop-blur-xl border-l ${isDark ? 'border-zinc-800' : 'border-gray-200'} shadow-2xl z-50 flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      {/* Header con gradiente */}
      <div className="relative">
        <div className={`absolute inset-0 ${statusConfig.bg} opacity-30`} />
        <div className={`relative p-5 border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          {/* Top row: tipo badge y close */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${tipoConfig.bg} border ${tipoConfig.border}`}>
              <TipoIcon className={`h-3.5 w-3.5 ${tipoConfig.color}`} />
              <span className={`text-xs font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${isDark ? 'hover:bg-zinc-800/80 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'} transition-all`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Título */}
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} leading-tight mb-3`}>
            {tarea.titulo}
          </h2>

          {/* Status y ID */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig.bg} border ${statusConfig.border}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
              <span className={`text-xs font-medium ${statusConfig.color}`}>{tarea.estatus}</span>
            </div>
            <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'} font-mono`}>ID: {tarea.id}</span>
            {tarea.referencia_id && (
              <span className="text-xs text-purple-400 font-mono">
                {tarea.referencia_tipo === 'propuesta' ? 'Propuesta' :
                 tarea.referencia_tipo === 'campana' ? 'Campaña' :
                 tarea.referencia_tipo === 'solicitud' ? 'Solicitud' : 'Ref'} #{tarea.referencia_id}
              </span>
            )}
          </div>

          {/* Botón marcar como leído */}
          {contentType === 'notificaciones' && (
            <div className="mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nuevoEstatus = tarea.estatus === 'Atendido' ? 'Pendiente' : 'Atendido';
                  marcarLeidaMutation.mutate(nuevoEstatus);
                }}
                disabled={marcarLeidaMutation.isPending}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tarea.estatus === 'Atendido'
                    ? isDark ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                    : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40'
                } disabled:opacity-50`}
              >
                {marcarLeidaMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Actualizando...</>
                ) : tarea.estatus === 'Atendido' ? (
                  <>
                    <Circle className="h-4 w-4" />
                    Marcar como no leída
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Marcar como leída
                  </>
                )}
              </button>
            </div>
          )}

          {/* Botón Ir a ver (oculto para directores en tareas de autorización) */}
          {canNavigate && onNavigate && !(isAutorizacionTask && ['Director General', 'Director Comercial', 'Gerente Comercial Vía Pública', 'Gerente Comercial Plazas', 'Gerente Comercial'].includes(user?.rol || '')) && (
            <button
              onClick={handleNavigate}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              {getNavigationLabel(tarea.referencia_tipo || '', tarea.tipo || undefined, tarea.campania_id, tarea.id_propuesta, tarea.id_solicitud, tarea.titulo || '')}
            </button>
          )}

          {/* Botón Revisar y Autorizar para directores (visible incluso en finalizadas) */}
          {isAutorizacionTask && ['Director General', 'Director Comercial', 'Gerente Comercial Vía Pública', 'Gerente Comercial Plazas', 'Gerente Comercial'].includes(user?.rol || '') && tarea.estatus !== 'Cancelado' && onOpenApprovalModal && (
            <button
              onClick={() => onOpenApprovalModal()}
              className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                tarea.estatus === 'Atendido'
                  ? 'bg-gradient-to-r from-zinc-600 to-zinc-500 text-white hover:from-zinc-500 hover:to-zinc-400 shadow-lg shadow-zinc-500/20'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-500/20'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              {tarea.estatus === 'Atendido' ? 'Ver Autorización' : 'Revisar y Autorizar'}
            </button>
          )}

          {/* Botón finalizar tarea.
              Oculto para todas las tareas generadas en Gestor de Artes: se
              atienden en la tarea real del modal de Gestor, no en el preview
              lateral. Finalizar aquí solo marcaria estatus=Atendido sin
              disparar los side-effects reales (aprobar arte, subir foto,
              rotar roles, marcar reserva como instalada, etc). Feedback de
              Jos 2026-07-09 — antes solo se excluia 'Revisión de artes'. */}
          {contentType === 'tareas'
            && !['Director General', 'Gerente Comercial Vía Pública', 'Gerente Comercial Plazas', 'Gerente Comercial'].includes(user?.rol || '')
            && !isTareaGestorArtes(tarea.tipo) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nuevoEstatus = tarea.estatus === 'Atendido' ? 'Pendiente' : 'Atendido';
                marcarLeidaMutation.mutate(nuevoEstatus);
              }}
              disabled={marcarLeidaMutation.isPending}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tarea.estatus === 'Atendido'
                  ? isDark ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                  : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40'
              } disabled:opacity-50`}
            >
              {marcarLeidaMutation.isPending ? (
                'Actualizando...'
              ) : tarea.estatus === 'Atendido' ? (
                <>
                  <Circle className="h-4 w-4" />
                  Reabrir tarea
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Finalizar tarea
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Descripción */}
        {tarea.mensaje && (
          <div className={`p-5 border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} leading-relaxed whitespace-pre-wrap`}>
              {tarea.mensaje}
            </p>
          </div>
        )}

        {/*Contenido de Seguimiento Campaña */}
        {tarea.tipo === 'Seguimiento Campaña' && tarea.contenido && (
          <div className={`p-5 border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
            <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Información de la Campaña
            </h3>
            <div className="space-y-2 bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
              {tarea.contenido.split('\n').map((linea, idx) => {
                const lineaTrim = linea.trim();
                if (!lineaTrim) return null;
                
                // Si es el título "CATORCENAS INCLUIDAS"
                if (lineaTrim.includes('CATORCENAS INCLUIDAS')) {
                  return (
                    <h4 key={idx} className="font-semibold text-purple-300 mt-4 mb-2 text-sm">
                      📅 {lineaTrim}
                    </h4>
                  );
                }
                
                // línea de catorcena - formatos: "Cat 5 - 2026: ..." o "Cat 1, 5/1/2026, ..."
                if (lineaTrim.match(/^Cat\s+\d+/)) {
                  // Intentar parsear "Cat N, fecha_inicio, fecha_fin"
                  const catMatch = lineaTrim.match(/^Cat\s+(\d+)[,\s]+(\S+)[,\s]+(\S+)/);
                  if (catMatch) {
                    return (
                      <div key={idx} className={`flex items-center gap-3 py-2.5 px-3 ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-lg border`}>
                        <Calendar className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                        <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Cat {catMatch[1]}</span>
                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>|</span>
                        <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{catMatch[2]}</span>
                        <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>→</span>
                        <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{catMatch[3]}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className={`flex items-center gap-2 py-2.5 px-3 ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-lg border`}>
                      <Calendar className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                      <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{lineaTrim}</span>
                    </div>
                  );
                }
                
                // Ocultar el link a la campaña del contenido (ya hay botón "Ver Campaña" arriba)
                if (lineaTrim.includes('https://') || lineaTrim.includes('Ver campaña:')) {
                  return null;
                }
                
                // Líneas normales (Cliente, Campaña)
                const parts = lineaTrim.split(':');
                if (parts.length >= 2) {
                  const label = parts[0];
                  const value = parts.slice(1).join(':').trim(); // Por si hay : en la fecha

                  // Saltar: líneas vacías, sección de catorcenas, y "Fecha límite" (se muestra en la sección editable abajo)
                  if (label === 'CATORCENAS INCLUIDAS' || label === 'Fecha límite' || !value) return null;

                  return (
                    <div key={idx} className="flex items-center justify-between py-1.5">
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} font-medium`}>{label}:</span>
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
                    </div>
                  );
                }
                
                return null;
              })}
            </div>
          </div>
        )}

        {/* Campañas afectadas — Ajuste Inventario Bloqueado */}
        {tarea.tipo === 'Ajuste Inventario Bloqueado' && tarea.contenido && (() => {
          try {
            const campanas = JSON.parse(tarea.contenido) as Array<{ campana_id: number; campana_nombre: string; cliente_nombre: string }>;
            if (!Array.isArray(campanas) || campanas.length === 0) return null;
            return (
              <div className={`p-5 border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
                <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Campañas afectadas
                </h3>
                <div className="space-y-1.5">
                  {campanas.map(c => (
                    <a
                      key={c.campana_id}
                      href={`/campanas/detail/${c.campana_id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (onNavigate) onNavigate(`/campanas/detail/${c.campana_id}`);
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors group ${
                        isDark
                          ? 'bg-zinc-800/60 border-zinc-700 hover:border-orange-500/40'
                          : 'bg-gray-50 border-gray-200 hover:border-orange-400'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.campana_nombre}</p>
                        <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{c.cliente_nombre}</p>
                      </div>
                      <ExternalLink className={`h-3 w-3 flex-shrink-0 ${isDark ? 'text-zinc-600 group-hover:text-orange-400' : 'text-gray-400 group-hover:text-orange-500'}`} />
                    </a>
                  ))}
                </div>
              </div>
            );
          } catch { return null; }
        })()}

        {/* Detalles en cards */}
        <div className="p-5 space-y-3">
          <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider mb-3`}>Detalles</h3>

          {/* Cliente (si es tarea de autorización) */}
          {(() => {
            const clienteName = (carasData && carasData.length > 0 ? carasData[0].cliente : null) || tarea.cliente;
            if (!clienteName) return null;
            return (
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 text-purple-400">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs">Cliente</span>
                </div>
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{clienteName}</span>
              </div>
            );
          })()}

          {/* Asesor */}
          {(tarea.asesor || (carasData && carasData.length > 0 && carasData[0].asesor)) && (
            <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                <UserCheck className="h-4 w-4" />
                <span className="text-xs">Asesor</span>
              </div>
              <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{tarea.asesor || carasData?.[0]?.asesor}</span>
            </div>
          )}

          {/* Catorcenas + fechas (solo auth tasks con caras) */}
          {isAutorizacionTask && carasData && carasData.length > 0 && (() => {
            const catMap = new Map<string, { inicio?: string; fin?: string }>();
            carasData.forEach(c => {
              const key = c.catorcena || 'Sin periodo';
              if (!catMap.has(key)) catMap.set(key, { inicio: c.inicio_periodo, fin: c.fin_periodo });
            });
            if (catMap.size === 0) return null;
            return (
              <div className={`p-3 rounded-xl ${isDark ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'} border`}>
                <div className={`flex items-center gap-2 mb-2 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-medium">Catorcenas</span>
                </div>
                <div className="space-y-1">
                  {Array.from(catMap.entries()).map(([cat, dates]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{cat}</span>
                      {dates.inicio && dates.fin && (
                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {formatDate(dates.inicio)} → {formatDate(dates.fin)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Inversión total + desglose caras (solo auth tasks con caras) */}
          {isAutorizacionTask && carasData && carasData.length > 0 && (() => {
            let totalInversion = 0, totalRenta = 0, totalBonif = 0, totalCortesia = 0, totalIntercambio = 0;
            carasData.forEach(c => {
              totalInversion += Number(c.costo) || 0;
              const art = (c.articulo || '').toUpperCase();
              if (art.startsWith('CT')) totalCortesia += c.caras + (Number(c.bonificacion) || 0);
              else if (art.startsWith('IN')) totalIntercambio += c.caras + (Number(c.bonificacion) || 0);
              else {
                totalRenta += c.caras;
                totalBonif += Number(c.bonificacion) || 0;
              }
            });
            return (
              <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} border`}>
                <div className={`flex items-center gap-2 mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium">Inversión y Caras</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Inversión</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>${totalInversion.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Renta</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalRenta}</div>
                  </div>
                  <div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Bonificadas</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{totalBonif}</div>
                  </div>
                  <div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cortesías</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{totalCortesia}</div>
                  </div>
                  {totalIntercambio > 0 && <div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Intercambios</div>
                    <div className={`text-sm font-bold ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>{totalIntercambio}</div>
                  </div>}
                </div>
              </div>
            );
          })()}

          {/* Asignado */}
          <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
            <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <User className="h-4 w-4" />
              <span className="text-xs">Asignado a</span>
            </div>
            {canEditAsignados && contentType === 'tareas' && usuarios ? (
              <div className="relative" ref={asignadoRef}>
                <button
                  onClick={() => setAsignadoOpen(v => !v)}
                  className={`flex items-center gap-1.5 text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} border rounded px-2 py-1 max-w-[200px]`}
                >
                  <span className="truncate">
                    {selectedIds.length === 0
                      ? 'Sin asignar'
                      : selectedIds.map(id => usuarios.find(u => String(u.id) === id)?.nombre).filter(Boolean).join(', ')}
                  </span>
                  <ChevronDown className={`h-3 w-3 flex-shrink-0 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                </button>
                {asignadoOpen && (
                  <div className={`absolute right-0 top-full mt-1 z-50 ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border rounded-lg shadow-xl p-1.5 min-w-[180px] max-h-[220px] overflow-y-auto`}>
                    {usuarios.map(u => (
                      <label key={u.id} className={`flex items-center gap-2 px-2 py-1.5 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded cursor-pointer`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(u.id))}
                          onChange={() => toggleAsignado(String(u.id))}
                          className="accent-purple-500"
                        />
                        <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{u.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserAvatar nombre={tarea.asignado} size="md" />
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{tarea.asignado || 'Sin asignar'}</span>
              </div>
            )}
          </div>

          {/* Responsable/Creador */}
          {tarea.responsable && (
            <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
              <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                <Users className="h-4 w-4" />
                <span className="text-xs">Creado por</span>
              </div>
              <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{tarea.responsable}</span>
            </div>
          )}

          {/* Fecha inicio / Fecha creación para auth tasks */}
          {isAutorizacionTask ? (
            tarea.fecha_creacion && (
              <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
                <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Fecha creación</span>
                </div>
                <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{formatDate(tarea.fecha_creacion)}</span>
              </div>
            )
          ) : (
            tarea.fecha_inicio && (
              <div className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
                <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Fecha inicio</span>
                </div>
                <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{formatDate(tarea.fecha_inicio)}</span>
              </div>
            )
          )}

          {/* Fecha límite - Editable (oculta para tareas de Autorización DG/DCM) */}
          {!tarea.tipo?.includes('Autorización') && <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Fecha límite</span>
              </div>
              {!isEditingFecha && (
                <span className="text-[10px] text-purple-400/60">click para editar</span>
              )}
            </div>
            {isEditingFecha ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fechaFinEdit}
                  onChange={(e) => setFechaFinEdit(e.target.value)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900'} border border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                />
                <button
                  onClick={() => {
                    if (fechaFinEdit && onUpdateFechaFin) {
                      onUpdateFechaFin(fechaFinEdit);
                    }
                    setIsEditingFecha(false);
                  }}
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setFechaFinEdit(tarea.fecha_fin ? new Date(tarea.fecha_fin).toISOString().split('T')[0] : '');
                    setIsEditingFecha(false);
                  }}
                  className={`p-2 rounded-lg ${isDark ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} transition-colors`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingFecha(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all group"
              >
                <span className={`text-sm font-medium ${tarea.fecha_fin ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}>
                  {tarea.fecha_fin ? formatDate(tarea.fecha_fin) : 'Sin fecha asignada'}
                </span>
                <Pencil className="h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
              </button>
            )}
          </div>}
        </div>


        {/* Notas Dirección — bitácora acumulable, visible para directores y admins en tareas de autorización */}
        {isAutorizacionTask
          && ['Director General', 'Director Comercial', 'Administrador', 'DEV'].includes(user?.rol || '')
          && tarea.id_solicitud && (
          <NotasDireccionBitacora
            idSolicitud={parseInt(tarea.id_solicitud)}
            isDark={isDark}
            bitacoraCount={tarea.notas_direccion_bitacora_count}
          />
        )}

        {/* Comentarios (oculto para directores en tareas de autorización) */}
        {!(isAutorizacionTask && ['Director General', 'Director Comercial', 'Gerente Comercial Vía Pública', 'Gerente Comercial Plazas', 'Gerente Comercial'].includes(user?.rol || '')) && <div className={`p-5 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider flex items-center gap-2`}>
              <MessageSquare className="h-3.5 w-3.5" />
              Comentarios
              {tarea.comentarios && tarea.comentarios.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'} text-[10px]`}>
                  {tarea.comentarios.length}
                </span>
              )}
            </h3>
          </div>

          {/* Lista de comentarios */}
          <div className="space-y-3 max-h-64 overflow-y-auto mb-4 scrollbar-purple">
            {(!tarea.comentarios || tarea.comentarios.length === 0) ? (
              <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'} text-center py-4`}>No hay comentarios aún</p>
            ) : (
              tarea.comentarios.map((c) => {
                const autorNombre = c.autor_nombre || c.usuario_nombre || 'Usuario';
                return (
                  <div key={c.id} className="group">
                    <div className="flex gap-3">
                      <UserAvatar nombre={autorNombre} foto_perfil={c.autor_foto} size="lg" className="w-7 h-7" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{autorNombre}</span>
                          <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{formatDate(c.fecha)}</span>
                        </div>
                        <LinkifiedText
                          text={c.contenido}
                          className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'} leading-relaxed`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input de comentario */}
          <div className={`flex items-start gap-3 pt-3 border-t ${isDark ? 'border-zinc-800/30' : 'border-gray-200'}`}>
            <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="lg" />
            <div className="flex-1">
              <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border focus-within:border-purple-500/50 transition-colors`}>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Escribe un comentario..."
                  className={`flex-1 bg-transparent text-sm ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'} focus:outline-none`}
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
        </div>}
      </div>
    </div>
  );
}

// ============ COMPONENTE PRINCIPAL ============
export function NotificacionesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserRol = useAuthStore((s) => s.user?.rol);
  const puedeCrearActividadComercial = !!currentUserRol && ROLES_ACTIVIDAD_COMERCIAL.has(currentUserRol);
  const [showActividadModal, setShowActividadModal] = useState(false);

  // Suscribirse a WebSocket para actualizaciones en tiempo real.
  // popups: false — los popups los dispara solo la instancia del Header.
  useSocketNotificaciones(currentUserId);

  // Estado de contenido (notificaciones vs tareas)
  const [contentType, setContentType] = useState<ContentType>('tareas');

  // Estado de vista y filtros
  const [view, setView] = useState<ViewType>('lista');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderBy, setOrderBy] = useState<OrderByType>('created_at');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [filterEstatus, setFilterEstatus] = useState<string>('');
  const [filterFecha, setFilterFecha] = useState<DateFilterType>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('pendientes');
  const [filtersOpen, setFiltersOpen] = useState(false);


  // Estados para filtros avanzados (estilo Proveedores)
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isDirector = ['Director General', 'Director Comercial'].includes(user?.rol || '');
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>(isDirector ? [] : ['tipo']);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortPopup, setShowSortPopup] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowFilterPopup(false);
        setShowGroupPopup(false);
        setShowSortPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Estado de selección y drawer
  const [selectedTarea, setSelectedTarea] = useState<(Notificacion & { comentarios?: ComentarioTarea[] }) | null>(null);
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);
  const [approvalModalTarea, setApprovalModalTarea] = useState<Notificacion | null>(null);
  const [editSolicitudId, setEditSolicitudId] = useState<number | null>(null);
  const [editPropuesta, setEditPropuesta] = useState<any>(null);
  const [editCampana, setEditCampana] = useState<any>(null);

  // Handler para cerrar el drawer con animación
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerClosing(true);
    setTimeout(() => {
      setSelectedTarea(null);
      setIsDrawerClosing(false);
    }, 250); // Duración de la animación
  }, []);

  // Abrir directamente una notificación/tarea cuando llega ?tareaId=X
  // (p.ej. al hacer clic en un toast de notificación).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const tid = searchParams.get('tareaId');
    if (!tid) return;
    const id = parseInt(tid, 10);
    if (!isNaN(id)) {
      notificacionesService.getById(id)
        .then((full) => {
          // Tareas de Autorización DG/DCM: abrir directo el modal de revisar y
          // autorizar (no el panel lateral) para directores.
          const isDirectorUser = ['Director General', 'Director Comercial'].includes(useAuthStore.getState().user?.rol || '');
          if (isDirectorUser && full.tipo?.includes('Autorización')) {
            setApprovalModalTarea(full);
          } else {
            setSelectedTarea(full);
          }
        })
        .catch((e) => console.error('No se pudo abrir la notificación', e));
    }
    // Limpiar el parámetro para no reabrirla en cada render/navegación.
    searchParams.delete('tareaId');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats - sin polling, actualizaciones via WebSocket
  const { data: stats } = useQuery({
    queryKey: ['notificaciones-stats'],
    queryFn: () => notificacionesService.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Fetch notificaciones o tareas según contentType.
  // El filtro por destinatario y por estatus vive en el SERVIDOR (`vista` +
  // `quick`). Antes se bajaban 200 filas "de todo" y se filtraba en cliente:
  // lo que caía fuera de esas 200 desaparecía de la vista aunque la campanita
  // sí lo contara (ej. Autorización DG #97479, posición 276 de 912 filas del
  // Director General). Ahora `data.total` es el conteo real del servidor.
  const { data, isLoading } = useQuery({
    queryKey: ['notificaciones', contentType, filterEstatus, orderBy, orderDir, quickFilter],
    queryFn: () =>
      notificacionesService.getAll({
        limit: 200,
        estatus: filterEstatus || undefined,
        vista: contentType === 'notificaciones' ? 'notificaciones' : 'tareas',
        quick: quickFilter && quickFilter !== 'all' ? quickFilter : undefined,
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

  // ====== Selección múltiple (checkboxes para acciones masivas) ======
  // Se mantiene por tab (notificaciones / tareas). Al cambiar de tab se limpia.
  const [selectedTareaIds, setSelectedTareaIds] = useState<Set<number>>(new Set());
  useEffect(() => { setSelectedTareaIds(new Set()); }, [contentType]);
  const toggleTareaSelection = useCallback((id: number) => {
    setSelectedTareaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Mutación masiva: 1 sola request al back que hace UPDATE con WHERE id IN (...).
  // 'Atendido' = leído, 'Pendiente' = no leído. El back emite NOTIFICACION_LEIDA
  // por WebSocket para que el badge de la campana y la lista refresquen en vivo
  // sin esperar al fetch local.
  const bulkUpdateEstatusMutation = useMutation({
    mutationFn: async ({ ids, estatus }: { ids: number[]; estatus: 'Atendido' | 'Pendiente' }) => {
      await notificacionesService.bulkUpdateEstatus(ids, estatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      setSelectedTareaIds(new Set());
    },
  });

  // Mutation para actualizar tarea (fecha_fin)
  const updateTareaMutation = useMutation({
    mutationFn: ({ id, fecha_fin }: { id: number; fecha_fin: string }) =>
      notificacionesService.update(id, { fecha_fin }),
    onSuccess: async () => {
      if (selectedTarea) {
        const updated = await notificacionesService.getById(selectedTarea.id);
        setSelectedTarea(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    },
  });

  // Filtrar por fecha y usuario según el tipo de contenido
  const baseTareas = useMemo(() => {
    if (!data?.data || !user) return [];
    let items = data.data;

    // El filtro por destinatario (y la exclusión de 'Notificación' en la pestaña
    // de tareas) ya lo aplicó el backend vía `vista`, con el MISMO criterio del
    // badge y sobre la tabla completa — no sobre las 200 filas que alcanzó a
    // bajar el cliente. Filtrar otra vez aquí es lo que ocultaba pendientes y
    // descuadraba el conteo contra la campanita.

    // Filtrar por fecha (solo si no es 'all')
    if (filterFecha !== 'all') {
      items = items.filter(item => {
        if (!item.fecha_creacion && !item.fecha_inicio) return false;
        const fechaToCheck = item.fecha_inicio || item.fecha_creacion;
        return isDateInRange(fechaToCheck, filterFecha);
      });
    }

    // Búsqueda local
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(item => {
        const a = item as any;
        const fields = [item.titulo, item.mensaje, item.contenido, item.responsable, item.asignado, item.tipo, item.estatus, a.cliente, a.asesor, a.formatos, a.descripcion];
        return fields.some(f => f && String(f).toLowerCase().includes(q));
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

        // Comparar fechas cronológicamente
        if (DATE_FIELDS.includes(sortField)) {
          const comparison = new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime();
          return sortDirection === 'asc' ? comparison : -comparison;
        }

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return items;
  }, [data?.data, filterFecha, user?.id, contentType, filters, sortField, sortDirection, debouncedSearch]);
    const tareasConQuickFilter = useMemo(() => {
      const isDirectorUser = ['Director General', 'Director Comercial'].includes(user?.rol || '');
      const cutoff14d = new Date();
      cutoff14d.setDate(cutoff14d.getDate() - 14);

      if (quickFilter === 'all') {
        if (!isDirectorUser) return baseTareas;
        return baseTareas.filter(item => {
          if (item.estatus === 'Atendido' && item.tipo?.includes('Autorización') && item.fecha_creacion) {
            return new Date(item.fecha_creacion) > cutoff14d;
          }
          return true;
        });
      }

      // El servidor ya aplicó este mismo filtro (param `quick`); esto queda como
      // red de seguridad y usa EXACTAMENTE el mismo criterio de "resuelta" para
      // no volver a introducir diferencias con el badge.
      return baseTareas.filter(item => {
        if (quickFilter === 'pendientes' || quickFilter === 'no_leidas') {
          return !esResuelta(item.estatus);
        }

        if (quickFilter === 'finalizadas' || quickFilter === 'leidas') {
          return esResuelta(item.estatus);
        }

        return true;
      });
    }, [baseTareas, quickFilter, user?.rol]);

  const filteredTareas = tareasConQuickFilter;

  // Selección masiva: master checkbox que marca/desmarca todas las visibles.
  const allFilteredIds = useMemo(() => filteredTareas.map(t => t.id), [filteredTareas]);
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedTareaIds.has(id));
  const someFilteredSelected = !allFilteredSelected && allFilteredIds.some(id => selectedTareaIds.has(id));
  const toggleAllFilteredSelection = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedTareaIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedTareaIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [allFilteredIds, allFilteredSelected]);

  // Contadores EXACTOS, derivados de /notificaciones/stats (COUNT en BD sobre el
  // conjunto completo), no de las filas que alcanzó a bajar el cliente. Es la
  // misma fuente que alimenta la campanita, así que por construcción cuadran:
  //   badge_count = badge_notificaciones + badge_tareas
  // El total por pestaña se deriva sin queries extra: por_tipo['Notificación'] es
  // el total de la pestaña Notificaciones, y el resto es el de Mis Tareas.
  const badgeNotificaciones = stats?.badge_notificaciones ?? 0;
  const badgeTareas = stats?.badge_tareas ?? 0;
  const totalTabNotificaciones = stats?.por_tipo?.['Notificación'] ?? 0;
  const totalTabTareas = Math.max(0, (stats?.total ?? 0) - totalTabNotificaciones);

  const countActivas = contentType === 'notificaciones' ? badgeNotificaciones : badgeTareas;
  const countAtendidas = Math.max(
    0,
    (contentType === 'notificaciones' ? totalTabNotificaciones : totalTabTareas) - countActivas
  );

  // Cuántas filas coinciden en el servidor con el filtro actual vs cuántas se
  // están renderizando. Si el `limit` recorta, se avisa en pantalla en lugar de
  // mostrar un número corto como si fuera el total.
  const totalServidor = data?.pagination?.total ?? 0;
  const hayRecorte = totalServidor > filteredTareas.length;

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
  const hasActiveFilters = filters.length > 0 || activeGroupings.length > 0 || sortField !== null || filterFecha !== 'all' || search || (quickFilter !== null && quickFilter !== 'all');

  // Limpiar todos los filtros
  const clearAllFilters = useCallback(() => {
    setQuickFilter(null);
    setFilters([]);
    setActiveGroupings([]);
    setSortField(null);
    setSortDirection('desc');
    setFilterFecha('all');
    setSearch('');
    setFilterEstatus('');
  }, []);

  // Handlers
  const handleSelectTarea = useCallback(async (tarea: Notificacion) => {
    const isDirectorUser = ['Director General', 'Director Comercial'].includes(user?.rol || '');
    const isAuthTask = tarea.tipo?.includes('Autorización');
    if (isDirectorUser && isAuthTask) {
      setApprovalModalTarea(tarea);
      return;
    }
    const full = await notificacionesService.getById(tarea.id);
    setSelectedTarea(full);
  }, [user?.rol]);

  // Vista de tabs
  const viewTabs = [
    { key: 'lista', label: 'Lista', icon: List },
    //{ key: 'tablero', label: 'Tablero', icon: LayoutGrid },
    { key: 'calendario', label: 'Calendario', icon: CalendarDays },
    { key: 'notas', label: 'Notas', icon: StickyNote },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <Header title={contentType === 'notificaciones' ? 'Notificaciones' : 'Mis Tareas'} />

      {/* Barra superior fija */}
      <div className={`sticky top-16 z-20 ${isDark ? 'bg-[#1a1025]/95' : 'bg-white/95'} backdrop-blur-sm border-b ${isDark ? 'border-zinc-800/80' : 'border-gray-200'}`}>
        {/* Tabs: Notificaciones / Tareas */}
        <div className={`flex items-center gap-1 px-3 md:px-6 py-2 border-b overflow-x-auto ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <button
            onClick={() => setContentType('notificaciones')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              contentType === 'notificaciones'
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
                : isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Bell className="h-4 w-4" />
            Notificaciones
            {/* Mismo número que aporta esta pestaña a la campanita del header. */}
            {badgeNotificaciones > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/30 text-[10px] font-bold"
                title="Notificaciones sin leer (parte del contador de la campana)"
              >
                {badgeNotificaciones}
              </span>
            )}
          </button>
          <button
            onClick={() => setContentType('tareas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              contentType === 'tareas'
                ? isDark ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-pink-50 text-pink-700 border border-pink-200'
                : isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Mis Tareas
            {badgeTareas > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full bg-pink-500/30 text-[10px] font-bold"
                title="Tareas sin finalizar (parte del contador de la campana)"
              >
                {badgeTareas}
              </span>
            )}
          </button>

          {/* Trazabilidad del badge: la campanita es la suma de las dos pestañas.
              Con esto el usuario ve de dónde sale el número y deja de leerse como
              un descuadre cuando abre una sola pestaña. */}
          {(badgeNotificaciones > 0 || badgeTareas > 0) && (
            <span className={`hidden md:inline ml-auto text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              Campana: {badgeNotificaciones + badgeTareas} ({badgeNotificaciones} sin leer + {badgeTareas} sin finalizar)
            </span>
          )}
        </div>

        {/* Navegación de vistas */}
        <div className={`flex items-center justify-between gap-2 px-3 md:px-6 py-3 border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <div className="flex items-center gap-1 overflow-x-auto min-w-0">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === tab.key
                    ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                    : isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2">
            {contentType === 'tareas' && puedeCrearActividadComercial && (
              <button
                onClick={() => setShowActividadModal(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDark
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
                title="Nueva actividad comercial"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Actividad comercial</span>
              </button>
            )}
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} transition-all`}
              title="Descargar"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Descargar</span>
            </button>
          </div>
        </div>

        {/* Barra de controles - Solo para vistas de tareas */}
        {view !== 'notas' && (
          <div className="flex flex-wrap items-center gap-2 md:gap-4 px-3 md:px-6 py-3">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                className={`w-full pl-10 pr-4 py-2 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border text-sm focus:outline-none focus:border-purple-500/50`}
              />
            </div>

            {/* Filter/Group/Sort Buttons - Estilo Proveedores */}
            <div ref={toolbarRef} className="flex items-center gap-2">
              {/* Botón de Filtros */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterPopup(v => !v); setShowGroupPopup(false); setShowSortPopup(false); }}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    filters.length > 0 || (quickFilter && quickFilter !== 'all')
                      ? 'bg-purple-600 text-white'
                      : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
                  }`}
                  title="Filtrar"
                >
                  <Filter className="h-4 w-4" />
                  {(filters.length > 0 || (quickFilter && quickFilter !== 'all')) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-400 border-2 border-[#1a1025] animate-pulse" />
                  )}
                </button>
                {showFilterPopup && (
                  <div className={`absolute right-0 top-full mt-1 z-[60] w-[520px] max-w-[calc(100vw-2rem)] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-gray-200'} border rounded-lg shadow-xl p-4`}>
                    {/* Filtros rápidos */}
                    <div className="mb-3">
                      <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wide">
                        Filtros rápidos
                      </span>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(contentType === 'notificaciones' ? QUICK_FILTERS_NOTIFICACIONES : QUICK_FILTERS_TAREAS).map(f => (
                          <button
                            key={f.key}
                            onClick={() => {
                              setQuickFilter(f.key);
                              setShowFilterPopup(false);
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                              quickFilter === f.key
                                ? 'bg-purple-600 text-white border-purple-500'
                                : isDark ? 'bg-purple-900/40 text-purple-300 border-purple-700/40 hover:bg-purple-800/60' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-purple-900/30 my-3" />

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
                      <button onClick={() => setShowFilterPopup(false)} className={isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
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
                            className={`w-[130px] text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                          >
                            {FILTER_FIELDS.map((f) => (
                              <option key={f.field} value={f.field}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                            className={`w-[110px] text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                          >
                            {DATE_FIELDS.includes(filter.field) ? (
                              <>
                                <option value="=">es</option>
                                <option value="!=">no es</option>
                              </>
                            ) : (
                              OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))
                            )}
                          </select>
                          {(filter.field === 'fecha_creacion' || filter.field === 'fecha_inicio' || filter.field === 'fecha_fin') ? (
                          <select
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            className={`flex-1 text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-1.5 focus:outline-none focus:border-purple-500`}
                          >
                            <option value="">Selecciona...</option>
                            {DATE_PRESET_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              type="text"
                              list={`datalist-${filter.id}`}
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              placeholder="Escribe o selecciona..."
                              className={`flex-1 text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded px-2 py-1.5 focus:outline-none focus:border-purple-500`}
                            />
                            <datalist id={`datalist-${filter.id}`}>
                              {getUniqueValues[filter.field]?.map((val) => (
                                <option key={val} value={val} />
                              ))}
                            </datalist>
                          </>
                        )}
                          <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {filters.length === 0 && (
                        <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-3`}>Sin filtros. Haz clic en "Añadir".</p>
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
                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{filteredTareas.length} de {data?.data?.length || 0} registros</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón de Agrupar - solo en vista Lista */}
              {view === 'lista' && (
                <div className="relative">
                  <button
                    onClick={() => { setShowGroupPopup(v => !v); setShowFilterPopup(false); setShowSortPopup(false); }}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      activeGroupings.length > 0
                        ? 'bg-purple-600 text-white'
                        : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
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
                    <div className={`absolute right-0 top-full mt-1 z-[60] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-gray-200'} border rounded-lg shadow-xl p-2 min-w-[180px]`}>
                      <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide px-2 py-1`}>Agrupar por (max 2)</p>
                      {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleGrouping(field)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50'} transition-colors ${
                            activeGroupings.includes(field) ? 'text-purple-300' : isDark ? 'text-zinc-400' : 'text-gray-500'
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
                        <button onClick={() => setActiveGroupings([])} className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'} py-1`}>
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
                  onClick={() => { setShowSortPopup(v => !v); setShowFilterPopup(false); setShowGroupPopup(false); }}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    sortField
                      ? 'bg-purple-600 text-white'
                      : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-600'
                  }`}
                  title="Ordenar"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
                {showSortPopup && (
                  <div className={`absolute right-0 top-full mt-1 z-[60] w-[300px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-gray-200'} border rounded-lg shadow-xl p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-purple-300">Ordenar por</span>
                      <button onClick={() => setShowSortPopup(false)} className={isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {FILTER_FIELDS.map((field) => (
                        <div
                          key={field.field}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                            sortField === field.field ? 'bg-purple-600/20 border border-purple-500/30' : isDark ? 'hover:bg-purple-900/20' : 'hover:bg-purple-50'
                          }`}
                        >
                          <span className={sortField === field.field ? 'text-purple-300 font-medium' : isDark ? 'text-zinc-300' : 'text-gray-700'}>
                            {field.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSortField(field.field); setSortDirection('asc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                sortField === field.field && sortDirection === 'asc'
                                  ? 'bg-purple-600 text-white'
                                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-900 hover:bg-purple-50'
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
                                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-purple-900/50' : 'text-gray-400 hover:text-gray-900 hover:bg-purple-50'
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
                  className={`flex items-center justify-center w-9 h-9 ${isDark ? 'text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50' : 'text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border-gray-200'} rounded-lg border transition-colors`}
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Estadísticas rápidas — conteos exactos del servidor (misma fuente
                que la campanita), no el largo de la página descargada. */}
            <div className="flex items-center gap-3 ml-auto">
              {hayRecorte && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/20 border border-sky-500/30"
                  title="La lista muestra solo las más recientes. Usa la búsqueda o los filtros para llegar a las demás."
                >
                  <AlertCircle className="h-3 w-3 text-sky-400" />
                  <span className="text-xs text-sky-300">
                    mostrando {filteredTareas.length} de {totalServidor}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Clock className="h-3 w-3 text-amber-400" />
                <span className="text-xs text-amber-300">{countActivas} activas</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                <span className="text-xs text-emerald-300">{countAtendidas} atendidas</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 p-3 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : view === 'tablero' ? (
          <TableroView tareas={filteredTareas} onSelectTarea={handleSelectTarea} />
        ) : view === 'lista' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {filteredTareas.length > 0 && contentType === 'notificaciones' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={el => { if (el) el.indeterminate = someFilteredSelected; }}
                      onChange={toggleAllFilteredSelection}
                      className="w-4 h-4 accent-purple-500 cursor-pointer"
                      title={allFilteredSelected ? 'Quitar selección' : 'Seleccionar todas'}
                    />
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      {selectedTareaIds.size > 0 ? `${selectedTareaIds.size} seleccionada${selectedTareaIds.size === 1 ? '' : 's'}` : 'Seleccionar'}
                    </span>
                  </label>
                )}
                <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  {filteredTareas.length} {contentType === 'notificaciones' ? 'notificación' : 'tarea'}{filteredTareas.length !== 1 ? (contentType === 'notificaciones' ? 'es' : 's') : ''}
                  {activeGroupings.length > 0 && <span className={isDark ? 'text-zinc-600' : 'text-gray-400'}> · {activeGroupings.length} agrupación{activeGroupings.length > 1 ? 'es' : ''}</span>}
                </span>
              </div>
              {contentType === 'notificaciones' && selectedTareaIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bulkUpdateEstatusMutation.mutate({ ids: Array.from(selectedTareaIds), estatus: 'Atendido' })}
                    disabled={bulkUpdateEstatusMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Marcar como leídas
                  </button>
                  <button
                    onClick={() => bulkUpdateEstatusMutation.mutate({ ids: Array.from(selectedTareaIds), estatus: 'Pendiente' })}
                    disabled={bulkUpdateEstatusMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Marcar como no leídas
                  </button>
                  <button
                    onClick={() => setSelectedTareaIds(new Set())}
                    disabled={bulkUpdateEstatusMutation.isPending}
                    className={`px-2 py-1.5 text-xs ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-50`}
                  >
                    Cancelar
                  </button>
                </div>
              )}
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
                    selectedIds={contentType === 'notificaciones' ? selectedTareaIds : undefined}
                    onToggleSelection={contentType === 'notificaciones' ? toggleTareaSelection : undefined}
                  />
                ))}
              </div>
            ) : filteredTareas.length > 0 ? (
              <div className={`rounded-xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-gray-200 bg-white'} overflow-hidden`}>
                {filteredTareas.map((tarea, index) => {
                  const statusConfig = getStatusConfig(tarea.estatus);
                  const tipoConfig = getTipoConfig(tarea.tipo);
                  const StatusIcon = statusConfig.icon;
                  const TipoIcon = tipoConfig.icon;
                  const isNotificacion = tarea.tipo === 'Notificación';
                  const isCompleted = tarea.estatus === 'Atendido';
                  const isAuthTaskInline = tarea.tipo?.includes('Autorización');
                  const isAprobacionInline = tarea.tipo?.includes('Aprobación');
                  const isRechazoInline = tarea.tipo?.includes('Rechazo');
                  const isRechazadoInline = tarea.estatus === 'Rechazado';
                  const isCanceladoInline = tarea.estatus === 'Cancelado';
                  const getInlineAuthBadge = () => {
                    if (isCanceladoInline) return { bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', color: 'text-zinc-400', label: 'Cancelado' };
                    // Filtro DG/DCM devuelto a corrección: 'Rechazado' en BD pero NO es rechazo total
                    // (el Gerente lo devolvió al asesor para corregir). Badge ámbar, no rojo/verde.
                    if ((tarea.tipo === 'Filtro Autorización DG' || tarea.tipo === 'Filtro Autorización DCM') && isRechazadoInline) return { bg: 'bg-amber-500/20', border: 'border-amber-500/30', color: 'text-amber-400', label: 'Devuelta a corrección' };
                    if (isRechazoInline) return { bg: 'bg-red-500/20', border: 'border-red-500/30', color: 'text-red-400', label: 'Rechazo' };
                    if (isAprobacionInline) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', color: 'text-emerald-400', label: 'Aprobada' };
                    if (isRechazadoInline) return { bg: 'bg-red-500/20', border: 'border-red-500/30', color: 'text-red-400', label: 'Rechazo' };
                    if (isCompleted && isAuthTaskInline) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', color: 'text-emerald-400', label: 'Aprobada' };
                    if (isAuthTaskInline) return { bg: 'bg-amber-500/20', border: 'border-amber-500/30', color: 'text-amber-400', label: 'Pendiente' };
                    return null;
                  };
                  const inlineAuthBadge = getInlineAuthBadge();
                  return (
                    <div
                      key={tarea.id}
                      onClick={() => handleSelectTarea(tarea)}
                      className={`group cursor-pointer transition-all ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50'} ${index !== filteredTareas.length - 1 ? `border-b ${isDark ? 'border-zinc-800/60' : 'border-gray-200'}` : ''} ${isCompleted || isRechazadoInline ? 'opacity-60' : ''}`}
                    >
                      {/* Layout móvil y desktop */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Checkbox de selección masiva — solo en tab Notificaciones,
                            porque en Mis Tareas 'estatus=Atendido' significa tarea
                            completada, no solo "leída". */}
                        {contentType === 'notificaciones' && (
                          <div className="pt-1.5">
                            <input
                              type="checkbox"
                              checked={selectedTareaIds.has(tarea.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); toggleTareaSelection(tarea.id); }}
                              className="w-4 h-4 accent-purple-500 cursor-pointer"
                            />
                          </div>
                        )}
                        {/* Indicador de estado + icono (oculto para auth) */}
                        {!isAuthTaskInline && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <div className={`w-1 h-10 rounded-full ${statusConfig.bg} ${isCompleted ? 'bg-emerald-500/40' : ''}`} />
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bg} border ${statusConfig.border}`}>
                              <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                            </div>
                          </div>
                        )}

                        {/* Contenido principal */}
                        <div className="flex-1 min-w-0">
                          {/* Fila 1: Tipo + Título + ID */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isAuthTaskInline ? (
                              <div className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/25 to-amber-500/20 border-2 border-orange-400/50 shadow-sm shadow-orange-500/10">
                                <TipoIcon className="h-4 w-4 text-orange-300" />
                                <span className="text-xs font-bold text-orange-300 tracking-wide">{tarea.tipo}</span>
                                {inlineAuthBadge && !isRechazoInline && !isAprobacionInline && (
                                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${inlineAuthBadge.bg} ${inlineAuthBadge.color} border ${inlineAuthBadge.border}`}>{inlineAuthBadge.label}</span>
                                )}
                              </div>
                            ) : (
                              <div className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${tipoConfig.bg} border ${tipoConfig.border}`}>
                                <TipoIcon className={`h-3 w-3 ${tipoConfig.color}`} />
                                <span className={`text-[10px] font-medium ${tipoConfig.color}`}>{tarea.tipo}</span>
                              </div>
                            )}
                            <span className={`text-sm font-medium group-hover:text-purple-300 transition-colors ${isCompleted || isRechazadoInline ? 'line-through text-zinc-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
                              {tarea.titulo}
                            </span>
                            <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} font-mono`}>#{tarea.id}</span>
                          </div>

                          {/* Fila 2: Descripción (si existe) */}
                          {tarea.mensaje && (
                            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate mt-1 max-w-lg`}>{tarea.mensaje}</p>
                          )}

                          {/* Fila 3: Metadatos - responsive */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Asignado - oculto para auth tasks */}
                            {tarea.asignado && !isAuthTaskInline && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <UserAvatar nombre={tarea.asignado} size="xs" />
                                <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} hidden sm:inline`}>Asignado:</span>
                                <span className={isDark ? 'text-zinc-300' : 'text-gray-700'}>{tarea.asignado}</span>
                              </div>
                            )}

                            {/* Separador visual */}
                            {tarea.asignado && !isAuthTaskInline && (tarea.responsable || tarea.fecha_fin) && (
                              <span className={`${isDark ? 'text-zinc-700' : 'text-gray-300'} hidden sm:inline`}>•</span>
                            )}

                            {/* Creador - resaltado para auth tasks */}
                            {tarea.responsable && (
                              <div className={`${isAuthTaskInline ? 'flex' : 'hidden md:flex'} items-center gap-1.5 text-[11px] ${isAuthTaskInline ? 'px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20' : ''}`}>
                                <span className={isAuthTaskInline ? 'text-orange-400/70' : isDark ? 'text-zinc-500' : 'text-gray-400'}>Creador:</span>
                                <span className={isAuthTaskInline ? 'text-orange-300 font-medium' : isDark ? 'text-zinc-400' : 'text-gray-500'}>{tarea.responsable}</span>
                              </div>
                            )}

                            {/* Separador */}
                            {tarea.responsable && tarea.fecha_fin && !isNotificacion && (
                              <span className={`${isDark ? 'text-zinc-700' : 'text-gray-300'} hidden md:inline`}>•</span>
                            )}

                            {/* Fecha límite - visible en sm+ (oculta para tareas de Autorización DG/DCM) */}
                            {!isNotificacion && tarea.fecha_fin && !tarea.tipo?.includes('Autorización') && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Clock className="h-3 w-3 text-amber-400" />
                                <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} hidden sm:inline`}>Límite:</span>
                                <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{formatDate(tarea.fecha_fin)}</span>
                              </div>
                            )}

                            {/* Cliente - solo para auth tasks */}
                            {isAuthTaskInline && tarea.cliente && (
                              <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                                <span className="text-purple-400/70">Cliente:</span>
                                <span className="text-purple-300 font-medium">{tarea.cliente}</span>
                              </div>
                            )}

                            {/* Propuesta - oculto para auth tasks */}
                            {tarea.referencia_id && !isAuthTaskInline && (
                              <div className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                                <span className="text-purple-400/70 hidden sm:inline">Prop:</span>
                                <span className="font-mono text-purple-400">#{tarea.referencia_id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                          {/* Botón Ir a ver - solo si tiene referencia o id_solicitud para tareas de autorización/rechazo */}
                          {hasNavigationRoute(tarea) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tarea.tipo === 'Mención en Ticket' && tarea.id_solicitud) {
                                  navigate(`/admin/tickets-historial?ticketId=${tarea.id_solicitud}`);
                                  return;
                                }
                                // Notif de comentario: navegar segun el titulo (solicitud / propuesta / campana).
                                const commentEntity = getCommentEntity(tarea.titulo || '');
                                if (commentEntity === 'campana' && tarea.campania_id) {
                                  navigate(`/campanas/${tarea.campania_id}`);
                                  return;
                                }
                                if (commentEntity === 'propuesta' && tarea.id_propuesta) {
                                  const propId = parseInt(tarea.id_propuesta);
                                  if (!isNaN(propId)) {
                                    navigate(getDirectNavigationPath('propuesta', propId, tarea.titulo || '', tarea.tipo || undefined, null, propId));
                                    return;
                                  }
                                }
                                if (commentEntity === 'solicitud' && tarea.id_solicitud) {
                                  const solicitudId = parseInt(tarea.id_solicitud);
                                  if (!isNaN(solicitudId)) {
                                    navigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
                                    return;
                                  }
                                }
                                if (tarea.tipo?.includes('Rechazo')) {
                                  if (tarea.referencia_tipo === 'propuesta' && tarea.id_propuesta) {
                                    propuestasService.getById(parseInt(tarea.id_propuesta)).then(p => setEditPropuesta(p)).catch(console.error);
                                  } else if (tarea.referencia_tipo === 'campana' && tarea.campania_id) {
                                    campanasService.getById(tarea.campania_id).then(c => setEditCampana(c)).catch(console.error);
                                  } else {
                                    const rejSolId = getRejectionSolicitudId(tarea);
                                    if (rejSolId) setEditSolicitudId(rejSolId);
                                  }
                                  return;
                                }
                                // Si tiene referencia_tipo y referencia_id, usar esos
                                if (tarea.referencia_tipo && tarea.referencia_id) {
                                  const propId = tarea.id_propuesta ? parseInt(tarea.id_propuesta) : null;
                                  const path = getDirectNavigationPath(tarea.referencia_tipo, tarea.referencia_id, tarea.titulo || '', tarea.tipo || undefined, tarea.campania_id, propId, tarea.id);
                                  navigate(path);
                                  return;
                                }
                                // Tareas de Gestión de Artes con campania_id → Gestión de Artes
                                if (isGestionArtesTarea(tarea.tipo) && tarea.campania_id) {
                                  navigate(`/campanas/${tarea.campania_id}/tareas?taskId=${tarea.id}`);
                                  return;
                                }
                                // Si es tarea de autorización/rechazo, navegar según título
                                if (tarea.id_solicitud && (tarea.tipo?.includes('Autorización') || tarea.tipo?.includes('Rechazo'))) {
                                  const tituloLower = (tarea.titulo || '').toLowerCase();
                                  if (tituloLower.includes('solicitud') && tarea.id_solicitud) {
                                    const solicitudId = parseInt(tarea.id_solicitud);
                                    if (!isNaN(solicitudId)) {
                                      navigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
                                      return;
                                    }
                                  }
                                  if (tarea.campania_id) {
                                    navigate(`/campanas/${tarea.campania_id}`);
                                    return;
                                  }
                                  if (tarea.id_propuesta) {
                                    const propId = parseInt(tarea.id_propuesta);
                                    if (!isNaN(propId)) {
                                      navigate(getDirectNavigationPath('propuesta', propId, tarea.titulo || '', tarea.tipo || undefined, null, propId));
                                      return;
                                    }
                                  }
                                  const solicitudId = parseInt(tarea.id_solicitud);
                                  if (!isNaN(solicitudId)) {
                                    navigate(getDirectNavigationPath('solicitud', solicitudId, tarea.titulo || '', tarea.tipo || undefined));
                                  }
                                }
                              }}
                              className={`p-1.5 rounded-lg ${isDark ? 'text-zinc-500' : 'text-gray-400'} hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100`}
                              title={`Ir a ${tarea.referencia_tipo === 'campana' && tarea.tipo === 'Correccion' ? 'Tarea' : tarea.referencia_tipo === 'propuesta' ? 'Propuesta' : tarea.referencia_tipo === 'campana' ? 'Campaña' : 'Solicitud'}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                          {/* Chevron para indicar que es clickeable - solo desktop */}
                          <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-600' : 'text-gray-300'} group-hover:text-purple-400 transition-colors hidden lg:block`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`rounded-xl border ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-200 bg-white'} p-12 text-center`}>
                {contentType === 'notificaciones' ? (
                  <Bell className={`h-10 w-10 ${isDark ? 'text-zinc-700' : 'text-gray-300'} mx-auto mb-3`} />
                ) : (
                  <ClipboardList className={`h-10 w-10 ${isDark ? 'text-zinc-700' : 'text-gray-300'} mx-auto mb-3`} />
                )}
                <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                  {contentType === 'notificaciones' ? 'No tienes notificaciones' : 'No tienes tareas asignadas'}
                </p>
                <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'} mt-1`}>
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
            onUpdateFechaFin={(fecha_fin) => updateTareaMutation.mutate({ id: selectedTarea.id, fecha_fin })}
            onNavigate={(path) => {
              if (selectedTarea.tipo?.includes('Rechazo')) {
                handleCloseDrawer();
                if (selectedTarea.referencia_tipo === 'propuesta' && selectedTarea.id_propuesta) {
                  propuestasService.getById(parseInt(selectedTarea.id_propuesta)).then(p => setTimeout(() => setEditPropuesta(p), 250)).catch(console.error);
                } else if (selectedTarea.referencia_tipo === 'campana' && selectedTarea.campania_id) {
                  campanasService.getById(selectedTarea.campania_id).then(c => setTimeout(() => setEditCampana(c), 250)).catch(console.error);
                } else {
                  const rejSolId = getRejectionSolicitudId(selectedTarea);
                  if (rejSolId) setTimeout(() => setEditSolicitudId(rejSolId), 250);
                }
                return;
              }
              handleCloseDrawer();
              setTimeout(() => navigate(path), 250);
            }}
            isClosing={isDrawerClosing}
            onAutorizacionAction={() => {
              queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
              queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
            }}
            contentType={contentType}
            onOpenApprovalModal={selectedTarea.tipo?.includes('Autorización') ? () => setApprovalModalTarea(selectedTarea) : undefined}
          />
        </>
      )}

      {/* Modal de Aprobación */}
      {approvalModalTarea && (
        <ApprovalModal
          tarea={approvalModalTarea}
          onClose={() => setApprovalModalTarea(null)}
          onAction={() => {
            queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
            queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
            if (selectedTarea) {
              notificacionesService.getById(selectedTarea.id).then(updated => setSelectedTarea(updated));
            }
          }}
        />
      )}

      {/* Modal de Editar Solicitud (para tareas de rechazo de solicitud) */}
      <CreateSolicitudModal
        isOpen={!!editSolicitudId}
        onClose={() => setEditSolicitudId(null)}
        editSolicitudId={editSolicitudId ?? undefined}
      />

      {/* Modal de Asignar Inventario (para tareas de rechazo de propuesta) */}
      {editPropuesta && (
        <AssignInventarioModal
          isOpen={!!editPropuesta}
          onClose={() => setEditPropuesta(null)}
          propuesta={editPropuesta}
          readOnly={false}
        />
      )}

      {/* Modal de Asignar Inventario Campaña (para tareas de rechazo de campaña) */}
      {editCampana && (
        <AssignInventarioCampanaModal
          isOpen={!!editCampana}
          onClose={() => setEditCampana(null)}
          campana={editCampana}
        />
      )}

      {/* Nueva Actividad Comercial (tarea manual asesor) */}
      {puedeCrearActividadComercial && (
        <NuevaActividadComercialModal
          isOpen={showActividadModal}
          onClose={() => setShowActividadModal(false)}
        />
      )}

    </div>
  );
}
