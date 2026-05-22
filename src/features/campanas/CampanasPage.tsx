import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Filter, ChevronDown, ChevronRight, ChevronLeft, X, Layers,
  Calendar, Clock, Eye, Megaphone, Edit2, Check, Minus, ArrowUpDown, User,
  List, LayoutGrid, Building2, MapPin, Loader2, Package, ClipboardList, Plus, Trash2,
  ArrowUp, ArrowDown, Lock, SlidersHorizontal, Upload, Printer, Monitor, Camera, Share2,
  Image, FileText, DollarSign, Hash, Gift, AlertTriangle, Film, Play
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioConAPS, InventarioReservado, SolicitudCara } from '../../services/campanas.service';
import { Badge } from '../../components/ui/badge';
import { solicitudesService } from '../../services/solicitudes.service';
import { Campana, Catorcena } from '../../types';

// Tipos para las vistas
type ViewType = 'tabla' | 'catorcena';
import { formatDate, formatCurrency } from '../../lib/utils';
import { AssignInventarioCampanaModal } from './AssignInventarioCampanaModal';
import { OrdenesMontajeModal } from './OrdenesMontajeModal';
import { VersionarioArtesPreviewModal } from './VersionarioArtesPreviewModal';
import type { VersionarioCacheEntry } from './VersionarioArtesPreviewModal';
import type { VersionarioArtesMultiArgs } from '../../utils/exportVersionarioArtes';
import { StatusCampanaModal } from './StatusCampanaModal';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketCampanas } from '../../hooks/useSocket';
import { HistorialFilterPopover, type HistorialFilterValues } from '../../components/HistorialFilterPopover';
import { IncidenciaModal } from './IncidenciaModal';
import { exportVersionarioArtesMulti } from '../../utils/exportVersionarioArtes';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

const getImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  if (url === 'sin_arte') return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) return `${STATIC_URL}${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('/uploads')) return `${STATIC_URL}${urlObj.pathname}`;
      return url;
    } catch {
      const match = url.match(/https?:\/\/[^/]+(\/uploads\/.+)/);
      if (match) return `${STATIC_URL}${match[1]}`;
      return url;
    }
  }
  if (url.startsWith('/')) return `${STATIC_URL}${url}`;
  if (url.includes('.') && !url.includes('/')) return `${STATIC_URL}/uploads/artes/${url}`;
  return `${STATIC_URL}/${url}`;
};

interface ImagenDigitalView {
  id: number;
  archivo: string;
  archivoData?: string;
  spot: number;
  tipo: 'image' | 'video';
  estado: string;
  codigoUnico?: string;
  nota?: string;
  nombreArchivo?: string;
}

// Colors for dynamic tags
const getTagColors = (isDark: boolean) => [
  { bg: isDark ? 'bg-cyan-500/15' : 'bg-cyan-50', text: isDark ? 'text-cyan-300' : 'text-cyan-700', border: 'border-cyan-500/30' },
  { bg: isDark ? 'bg-fuchsia-500/15' : 'bg-fuchsia-50', text: isDark ? 'text-fuchsia-300' : 'text-fuchsia-700', border: 'border-fuchsia-500/30' },
  { bg: isDark ? 'bg-amber-500/15' : 'bg-amber-50', text: isDark ? 'text-amber-300' : 'text-amber-700', border: 'border-amber-500/30' },
  { bg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50', text: isDark ? 'text-emerald-300' : 'text-emerald-700', border: 'border-emerald-500/30' },
  { bg: isDark ? 'bg-rose-500/15' : 'bg-rose-50', text: isDark ? 'text-rose-300' : 'text-rose-700', border: 'border-rose-500/30' },
  { bg: isDark ? 'bg-sky-500/15' : 'bg-sky-50', text: isDark ? 'text-sky-300' : 'text-sky-700', border: 'border-sky-500/30' },
  { bg: isDark ? 'bg-violet-500/15' : 'bg-violet-50', text: isDark ? 'text-violet-300' : 'text-violet-700', border: 'border-violet-500/30' },
  { bg: isDark ? 'bg-orange-500/15' : 'bg-orange-50', text: isDark ? 'text-orange-300' : 'text-orange-700', border: 'border-orange-500/30' },
  { bg: isDark ? 'bg-teal-500/15' : 'bg-teal-50', text: isDark ? 'text-teal-300' : 'text-teal-700', border: 'border-teal-500/30' },
  { bg: isDark ? 'bg-pink-500/15' : 'bg-pink-50', text: isDark ? 'text-pink-300' : 'text-pink-700', border: 'border-pink-500/30' },
];

function getTagColor(name: string, isDark: boolean = true) {
  const TAG_COLORS = getTagColors(isDark);
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Parsea YYYY-MM directo del string para evitar timezone shift
// (e.g. '2026-03-01T00:00:00.000Z' en MX UTC-6 → Date.getMonth() devuelve 1=Feb por la conversión a hora local)
function getMonthLabel(dateStr: string): string {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  if (!m) return '-';
  const month = parseInt(m[2]) - 1;
  if (month < 0 || month > 11) return '-';
  return `${MESES_FULL[month]} ${m[1]}`;
}

function getMonthShort(dateStr: string): string {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  if (!m) return '-';
  const month = parseInt(m[2]) - 1;
  if (month < 0 || month > 11) return '-';
  return `${MESES_LABEL[month]} ${m[1]}`;
}

// Status / Period / EstatusArte colors — dos mapas estáticos por tema.
// Antes se reconstruía el objeto entero en cada llamada (y en algunos lugares
// una vez por fila renderizada). Ahora son constantes módulo y el helper
// solo elige cuál usar. El dark-mode toggle sigue funcionando igual.
type StatusColor = { bg: string; text: string; border: string };

const STATUS_COLORS_DARK: Record<string, StatusColor> = {
  'Aprobada':    { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'inactiva':    { bg: 'bg-zinc-500/20',    text: 'text-zinc-300',    border: 'border-zinc-500/30' },
  'finalizada':  { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/30' },
  'por iniciar': { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  'en curso':    { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/30' },
  'pendiente':   { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/30' },
  'cancelada':   { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/30' },
  'pausada':     { bg: 'bg-yellow-500/20',  text: 'text-yellow-300',  border: 'border-yellow-500/30' },
};

const STATUS_COLORS_LIGHT: Record<string, StatusColor> = {
  'Aprobada':    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  'inactiva':    { bg: 'bg-zinc-50',    text: 'text-zinc-700',    border: 'border-zinc-300' },
  'finalizada':  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-500/30' },
  'por iniciar': { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-500/30' },
  'en curso':    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-500/30' },
  'pendiente':   { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-500/30' },
  'cancelada':   { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-500/30' },
  'pausada':     { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-500/30' },
};

const DEFAULT_STATUS_COLOR_DARK: StatusColor  = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };
const DEFAULT_STATUS_COLOR_LIGHT: StatusColor = { bg: 'bg-violet-50',     text: 'text-violet-700', border: 'border-violet-500/30' };

const ESTATUS_ARTE_COLORS_DARK: Record<string, StatusColor> = {
  'Carga Artes':     { bg: 'bg-zinc-500/20',    text: 'text-zinc-300',    border: 'border-zinc-500/30' },
  'Revision Artes':  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  'Artes Aprobados': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'En Impresion':    { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/30' },
  'Artes Recibidos': { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/30' },
  'Instalado':       { bg: 'bg-green-500/20',   text: 'text-green-300',   border: 'border-green-500/30' },
};

const ESTATUS_ARTE_COLORS_LIGHT: Record<string, StatusColor> = {
  'Carga Artes':     { bg: 'bg-zinc-50',    text: 'text-zinc-700',    border: 'border-zinc-300' },
  'Revision Artes':  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-500/30' },
  'Artes Aprobados': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  'En Impresion':    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-500/30' },
  'Artes Recibidos': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-500/30' },
  'Instalado':       { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-500/30' },
};

const PERIOD_COLORS_DARK: Record<string, StatusColor> = {
  'Pasada':   { bg: 'bg-zinc-500/20',    text: 'text-zinc-300',    border: 'border-zinc-500/30' },
  'En curso': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Futura':   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30' },
};

const PERIOD_COLORS_LIGHT: Record<string, StatusColor> = {
  'Pasada':   { bg: 'bg-zinc-50',    text: 'text-zinc-700',    border: 'border-zinc-300' },
  'En curso': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  'Futura':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-500/30' },
};

// Helpers retro-compatibles: devuelven el mapa correcto sin construir nada nuevo.
const getStatusColors = (isDark: boolean) => isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
const getEstatusArteColors = (isDark: boolean) => isDark ? ESTATUS_ARTE_COLORS_DARK : ESTATUS_ARTE_COLORS_LIGHT;
const getPeriodColors = (isDark: boolean) => isDark ? PERIOD_COLORS_DARK : PERIOD_COLORS_LIGHT;
const getDefaultStatusColor = (isDark: boolean) => isDark ? DEFAULT_STATUS_COLOR_DARK : DEFAULT_STATUS_COLOR_LIGHT;

function getEstatusArteColor(estatus: string | null | undefined, isDark: boolean = true) {
  if (!estatus) return getDefaultStatusColor(isDark);
  const map = getEstatusArteColors(isDark);
  return map[estatus] || getDefaultStatusColor(isDark);
}

function getStatusColor(status: string | null | undefined, isDark: boolean = true) {
  if (!status) return getDefaultStatusColor(isDark);
  const map = getStatusColors(isDark);
  const trimmed = status.trim();
  if (map[trimmed]) return map[trimmed];
  const normalized = trimmed.toLowerCase();
  if (map[normalized]) return map[normalized];
  // Si no, generar un color dinámico basado en el nombre.
  return getTagColor(status, isDark);
}

// Colores para gráficas
const CHART_COLORS = {
  status: {
    'Aprobada': '#10b981',       // emerald
    'finalizada': '#3b82f6',    // blue
    'por iniciar': '#f59e0b',   // amber
    'inactiva': '#6b7280',      // gray
    'en curso': '#06b6d4',      // cyan
    'cancelada': '#ef4444',     // red
    'atendida': '#8b5cf6',      // violet
    'pendiente': '#f97316',     // orange
    'pausada': '#64748b',       // slate
    'completada': '#22c55e',    // green
    'en revisión': '#a855f7',   // purple
    'en revision': '#a855f7',   // purple (sin acento)
    'aprobada': '#14b8a6',      // teal
    'rechazada': '#dc2626',     // red-600
    'sin status': '#71717a',    // zinc
  },
  // Array de colores para estatus no definidos
  statusFallback: [
    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#84cc16',
    '#f97316', '#0ea5e9', '#d946ef', '#facc15', '#fb7185'
  ],
  category: [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316'
  ]
};

// Calculate period status based on dates
function getPeriodStatus(fechaInicio: string, fechaFin: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);

  if (today > fin) return 'Pasada';
  if (today < inicio) return 'Futura';
  return 'En curso';
}

// Advanced Filter Types and Config
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains' | '>' | '<' | '>=' | '<=';

interface AdvancedFilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  connector: 'Y' | 'O';
}

interface FilterFieldConfig {
  field: string;
  label: string;
  type: 'string' | 'number';
}

const CAMPANA_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'id', label: 'ID', type: 'number' },
  { field: 'nombre', label: 'Nombre', type: 'string' },
  { field: 'cliente_nombre', label: 'Cliente', type: 'string' },
  { field: 'status', label: 'Estatus', type: 'string' },
  { field: 'articulo', label: 'Artículo', type: 'string' },
  { field: 'formatos', label: 'Formato', type: 'string' },
  { field: 'creador_nombre', label: 'Creador', type: 'string' },
  { field: 'T0_U_Asesor', label: 'Asesor', type: 'string' },
  { field: 'codigos_inventario', label: 'Código Inventario', type: 'string' },
  // Etapa del gestor de artes: filtra campañas que tengan AL MENOS UN circuito
  // con ese estatus_arte. Evaluado contra inventarios cargados en el cliente
  // (campanaInventarios). Valores expuestos en getUniqueFieldValues.
  { field: 'etapa', label: 'Etapa', type: 'string' },
];

// Etapas (estatus_arte computado en back) que pueden filtrarse.
// Mapping label visible -> valor real de estatus_arte.
const ETAPA_VALUES: { label: string; value: string }[] = [
  { label: 'Carga de Artes', value: 'Carga Artes' },
  { label: 'En Revisión', value: 'Revision Artes' },
  { label: 'Artes Aprobados', value: 'Artes Aprobados' },
  { label: 'En Impresión', value: 'En Impresion' },
  { label: 'Artes Recibidos', value: 'Artes Recibidos' },
  { label: 'Instalado', value: 'Instalado' },
  { label: 'Impresión (IM)', value: 'Impresión' },
  { label: 'Programado', value: '__programado__' }, // pseudo-valor: items con indicaciones_programacion
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Campos disponibles para agrupar
type GroupByField = 'status' | 'cliente_nombre' | 'catorcena_inicio' | 'creador_nombre' | 'T0_U_Asesor';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'status', label: 'Estatus' },
  { field: 'cliente_nombre', label: 'Cliente' },
  { field: 'catorcena_inicio', label: 'Fecha Inicio' },
  { field: 'creador_nombre', label: 'Creador' },
  { field: 'T0_U_Asesor', label: 'Asesor' },
];

// Campos disponibles para ordenar
const SORT_FIELDS = [
  { field: 'fecha_inicio', label: 'Fecha Inicio' },
  { field: 'nombre', label: 'Nombre' },
  { field: 'cliente_nombre', label: 'Cliente' },
  { field: 'status', label: 'Estatus' },
];

// Function to apply advanced filters to data
function evalCondition<T>(item: T, filter: AdvancedFilterCondition): boolean {
  const fieldValue = (item as Record<string, unknown>)[filter.field];
  const filterValue = filter.value;
  if (!filterValue) return true;
  if (fieldValue === null || fieldValue === undefined) {
    return filter.operator === '!=' || filter.operator === 'not_contains';
  }
  const strValue = String(fieldValue).toLowerCase();
  const strFilterValue = filterValue.toLowerCase();
  switch (filter.operator) {
    case '=': return strValue === strFilterValue;
    case '!=': return strValue !== strFilterValue;
    case 'contains': return strValue.includes(strFilterValue);
    case 'not_contains': return !strValue.includes(strFilterValue);
    case '>': return Number(fieldValue) > Number(filterValue);
    case '<': return Number(fieldValue) < Number(filterValue);
    case '>=': return Number(fieldValue) >= Number(filterValue);
    case '<=': return Number(fieldValue) <= Number(filterValue);
    default: return true;
  }
}

// applyAdvancedFilters se reemplazó por evalFilterWithInventario inline en filteredData
// para soportar búsqueda extendida de codigos_inventario desde inventarios cargados

// Filter Chip Component with Search
function FilterChip({
  label,
  options,
  value,
  onChange,
  onClear,
  isDark = true
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt =>
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleClose = () => {
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${value
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
          : isDark
            ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
          }`}
      >
        <span>{value || label}</span>
        {value ? (
          <X className={`h-3 w-3 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <input
                type="text"
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50`}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-52 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-3 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center`}>
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${value === option
                      ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                      : isDark
                        ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
            <div className={`px-3 py-1.5 border-t ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'} text-[10px]`}>
              {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Period Filter Popover Component
function PeriodFilterPopover({
  catorcenasData,
  yearInicio,
  yearFin,
  catorcenaInicio,
  catorcenaFin,
  onApply,
  onClear,
  isDark = true
}: {
  catorcenasData: { years: number[]; data: Catorcena[] } | undefined;
  yearInicio: number | undefined;
  yearFin: number | undefined;
  catorcenaInicio: number | undefined;
  catorcenaFin: number | undefined;
  onApply: (yearInicio: number, yearFin: number, catorcenaInicio?: number, catorcenaFin?: number) => void;
  onClear: () => void;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tempYearInicio, setTempYearInicio] = useState<number | undefined>(yearInicio);
  const [tempYearFin, setTempYearFin] = useState<number | undefined>(yearFin);
  const [tempCatorcenaInicio, setTempCatorcenaInicio] = useState<number | undefined>(catorcenaInicio);
  const [tempCatorcenaFin, setTempCatorcenaFin] = useState<number | undefined>(catorcenaFin);

  useEffect(() => {
    setTempYearInicio(yearInicio);
    setTempYearFin(yearFin);
    setTempCatorcenaInicio(catorcenaInicio);
    setTempCatorcenaFin(catorcenaFin);
  }, [yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  const years = catorcenasData?.years || [];

  const yearInicioOptions = useMemo(() => {
    if (tempYearFin) return years.filter(y => y <= tempYearFin);
    return years;
  }, [years, tempYearFin]);

  const yearFinOptions = useMemo(() => {
    if (tempYearInicio) return years.filter(y => y >= tempYearInicio);
    return years;
  }, [years, tempYearInicio]);

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !tempYearInicio) return [];
    const catorcenas = catorcenasData.data.filter(c => c.a_o === tempYearInicio);
    if (tempYearInicio === tempYearFin && tempCatorcenaFin) {
      return catorcenas.filter(c => c.numero_catorcena <= tempCatorcenaFin);
    }
    return catorcenas;
  }, [catorcenasData, tempYearInicio, tempYearFin, tempCatorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !tempYearFin) return [];
    const catorcenas = catorcenasData.data.filter(c => c.a_o === tempYearFin);
    if (tempYearInicio === tempYearFin && tempCatorcenaInicio) {
      return catorcenas.filter(c => c.numero_catorcena >= tempCatorcenaInicio);
    }
    return catorcenas;
  }, [catorcenasData, tempYearFin, tempYearInicio, tempCatorcenaInicio]);

  const isActive = yearInicio !== undefined && yearFin !== undefined;
  const canApply = tempYearInicio !== undefined && tempYearFin !== undefined;

  const handleApply = () => {
    if (canApply) {
      onApply(tempYearInicio!, tempYearFin!, tempCatorcenaInicio, tempCatorcenaFin);
      setOpen(false);
    }
  };

  const handleClear = () => {
    setTempYearInicio(undefined);
    setTempYearFin(undefined);
    setTempCatorcenaInicio(undefined);
    setTempCatorcenaFin(undefined);
    onClear();
    setOpen(false);
  };

  const getDisplayText = () => {
    if (!isActive) return 'Periodo';
    let text = `${yearInicio}`;
    if (catorcenaInicio) text += `/C${catorcenaInicio}`;
    text += ` - ${yearFin}`;
    if (catorcenaFin) text += `/C${catorcenaFin}`;
    return text;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${isActive
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
          : isDark
            ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
          }`}
      >
        <Calendar className="h-3 w-3" />
        <span>{getDisplayText()}</span>
        {isActive ? (
          <X className={`h-3 w-3 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); handleClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-80 rounded-xl border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <Calendar className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Filtro de Periodo
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>Selecciona año inicio y fin (obligatorios)</p>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Año Inicio *</label>
                  <select
                    value={tempYearInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempYearInicio(val);
                      setTempCatorcenaInicio(undefined);
                      if (val && tempYearFin && val > tempYearFin) {
                        setTempYearFin(undefined);
                        setTempCatorcenaFin(undefined);
                      }
                    }}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearInicioOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Inicio</label>
                  <select
                    value={tempCatorcenaInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempCatorcenaInicio(val);
                      if (val && tempYearInicio === tempYearFin && tempCatorcenaFin && val > tempCatorcenaFin) {
                        setTempCatorcenaFin(undefined);
                      }
                    }}
                    disabled={!tempYearInicio}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Todas</option>
                    {catorcenasInicioOptions.map(c => (
                      <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Año Fin *</label>
                  <select
                    value={tempYearFin || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempYearFin(val);
                      setTempCatorcenaFin(undefined);
                      if (val && tempYearInicio && val < tempYearInicio) {
                        setTempYearInicio(undefined);
                        setTempCatorcenaInicio(undefined);
                      }
                    }}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearFinOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Fin</label>
                  <select
                    value={tempCatorcenaFin || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempCatorcenaFin(val);
                      if (val && tempYearInicio === tempYearFin && tempCatorcenaInicio && val < tempCatorcenaInicio) {
                        setTempCatorcenaInicio(undefined);
                      }
                    }}
                    disabled={!tempYearFin}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Todas</option>
                    {catorcenasFinOptions.map(c => (
                      <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={`p-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-between gap-2`}>
              <button
                onClick={handleClear}
                className={`px-3 py-1.5 text-xs ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}
              >
                Limpiar
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className={`px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 ${isDark ? 'disabled:bg-zinc-700 disabled:text-zinc-500' : 'disabled:bg-gray-200 disabled:text-gray-400'} text-white rounded-lg font-medium transition-colors`}
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Group Header for table
function GroupHeader({
  groupName,
  count,
  expanded,
  onToggle,
  colSpan,
  isDark = true
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
  isDark?: boolean;
}) {
  return (
    <tr
      onClick={onToggle}
      className={`${isDark ? 'bg-purple-500/10 border-b border-purple-500/20 hover:bg-purple-500/20' : 'bg-purple-50 border-b border-purple-200 hover:bg-purple-100'} cursor-pointer transition-colors`}
    >
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          )}
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupName || 'Sin asignar'}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
            {count} campañas
          </span>
        </div>
      </td>
    </tr>
  );
}

// Status options
const STATUS_OPTIONS = ['Aprobada', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

// Galería de Artes Modal Component
function ArtGalleryModal({
  isOpen,
  onClose,
  imagenes,
  isLoading,
  title,
  isDark = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  imagenes: ImagenDigitalView[];
  isLoading: boolean;
  title?: string;
  isDark?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagenes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < imagenes.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentImage = imagenes[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-700' : 'border-gray-200'} flex-shrink-0`}>
          <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Film className="h-5 w-5 text-indigo-400" />
            {title || 'Galería de Artes'}
            <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/30 text-[10px]">
              {imagenes.length} archivo{imagenes.length !== 1 ? 's' : ''}
            </Badge>
          </h3>
          <button onClick={onClose} className={`p-1 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors`}>
            <X className={`h-5 w-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : imagenes.length === 0 ? (
            <div className={`flex-1 flex items-center justify-center min-h-[300px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <div className="text-center">
                <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No hay archivos de arte cargados</p>
              </div>
            </div>
          ) : (
            <>
              {/* Main viewer */}
              <div className="relative bg-black rounded-lg flex items-center justify-center overflow-hidden" style={{ height: '450px' }}>
                {currentImage?.tipo === 'video' ? (
                  <video
                    key={currentImage.id}
                    src={getImageUrl(currentImage.archivoData || currentImage.archivo) || ''}
                    controls
                    controlsList="nodownload"
                    className="max-w-full max-h-full rounded"
                  />
                ) : (
                  <img
                    key={currentImage?.id}
                    src={getImageUrl(currentImage?.archivoData || currentImage?.archivo) || ''}
                    alt={`Arte ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

                {/* Navigation arrows */}
                {imagenes.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <ChevronLeft className="h-6 w-6 text-white" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <ChevronRight className="h-6 w-6 text-white" />
                    </button>
                  </>
                )}

                {/* Position indicator */}
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                  Spot {currentImage?.spot ?? currentIndex + 1} · {currentIndex + 1} de {imagenes.length}
                </div>
              </div>

              {/* Metadatos del arte actual: nombre de archivo + nota */}
              {currentImage && (currentImage.nombreArchivo || currentImage.nota) && (
                <div className={`mt-3 px-3 py-2 rounded-lg border ${isDark ? 'bg-zinc-800/60 border-zinc-700' : 'bg-gray-50 border-gray-200'} space-y-1`}>
                  {currentImage.nombreArchivo && (
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Archivo:</span>{' '}
                      <span className="break-all">{currentImage.nombreArchivo}</span>
                    </div>
                  )}
                  {currentImage.nota && (
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Nota:</span>{' '}
                      <span className="whitespace-pre-wrap">{currentImage.nota}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Thumbnails */}
              {imagenes.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto py-2 px-1">
                  {imagenes.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                        index === currentIndex
                          ? 'border-indigo-400 ring-2 ring-indigo-400/30'
                          : 'border-transparent hover:border-indigo-400/50'
                      }`}
                    >
                      {img.tipo === 'video' ? (
                        <div className={`w-full h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} flex items-center justify-center`}>
                          <Play className="h-6 w-6 text-indigo-400" />
                        </div>
                      ) : (
                        <img
                          src={getImageUrl(img.archivoData || img.archivo) || ''}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 p-4 border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'} flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Row component — extraído y memoizado. Antes era `renderCampanaRow` dentro
// del componente padre: se recreaba en cada render y construía un mapa de
// colores por fila. Ahora solo se re-renderiza si cambia `item`, `isDark`,
// algún permiso, o la inversión total de esa campaña.
interface CampanaRowProps {
  item: Campana;
  index: number;
  isDark: boolean;
  invTotal: number | null;
  hayFiltroPeriodo: boolean;
  canEditPerm: boolean;
  canSeeGestionArtesPerm: boolean;
  isEditDisabled: boolean;
  onOpen: (id: number) => void;
  onShare: (propuestaId: number) => void;
  onEdit: (item: Campana) => void;
  onIncidencia: (item: Campana) => void;
  onStatus: (item: Campana) => void;
}

const CampanaRow = React.memo(function CampanaRow({
  item,
  index,
  isDark,
  invTotal,
  hayFiltroPeriodo,
  canEditPerm,
  canSeeGestionArtesPerm,
  isEditDisabled,
  onOpen,
  onShare,
  onEdit,
  onIncidencia,
  onStatus,
}: CampanaRowProps) {
  const statusColor = getStatusColor(item.status, isDark);
  const periodStatus = getPeriodStatus(item.fecha_inicio, item.fecha_fin);
  const periodMap = getPeriodColors(isDark);
  const periodColor = periodMap[periodStatus] || getDefaultStatusColor(isDark);
  const isMensual = (item as any).tipo_periodo === 'mensual';

  // Inversión: con filtro usa el valor que ya filtró el backend;
  // sin filtro usa el total dinámico cargado por batch (invTotal).
  const inv = hayFiltroPeriodo
    ? Number(item.inversion || 0)
    : (invTotal !== null ? invTotal : Number(item.inversion || 0));

  return (
    <tr key={`campana-${item.id}-${index}`} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
      {/* ID */}
      <td className="px-4 py-3">
        <span className={`font-mono text-xs px-2 py-1 rounded-md ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>#{item.id}</span>
      </td>
      {/* Periodo */}
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodColor.bg} ${periodColor.text} border ${periodColor.border}`}>
          {periodStatus}
        </span>
      </td>
      {/* Creador */}
      <td className="px-4 py-3">
        {item.creador_nombre ? (
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} flex items-center justify-center`}>
              <User className={`h-3 w-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm`}>{item.creador_nombre}</span>
          </div>
        ) : (
          <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>-</span>
        )}
      </td>
      {/* Campaña */}
      <td className="px-4 py-3">
        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{item.nombre}</span>
      </td>
      {/* Cliente/Marca */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm max-w-[180px] truncate`} title={item.T2_U_Marca || item.cliente_nombre || item.cliente_razon_social || '-'}>
            {item.T2_U_Marca || item.cliente_nombre || item.cliente_razon_social || '-'}
          </span>
          {item.sap_database && (
            <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
              item.sap_database === 'CIMU'
                ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') + ' border-blue-500/30'
                : item.sap_database === 'TEST'
                  ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700') + ' border-amber-500/30'
                  : (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700') + ' border-emerald-500/30'
            }`}>{item.sap_database}</span>
          )}
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <button
            onClick={() => onStatus(item)}
            className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border} hover:opacity-80 transition-opacity cursor-pointer`}
          >
            {item.status}
          </button>
          {item.caras_ultima_cat != null && Number(item.caras_ultima_cat) > 0 && Number(item.reservas_count_ultima_cat) < Number(item.caras_ultima_cat) && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'} border border-yellow-500/30`}>
              Incompleta
            </span>
          )}
        </div>
      </td>
      {/* Actividad */}
      <td className="px-4 py-3">
        {item.has_aps ? (
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} border border-emerald-500/30`}>
            Activa
          </span>
        ) : (
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-zinc-500/20 text-zinc-300' : 'bg-zinc-50 text-zinc-700'} border ${isDark ? 'border-zinc-500/30' : 'border-zinc-300'}`}>
            Inactiva
          </span>
        )}
      </td>
      {/* Cat. Inicio */}
      <td className="px-4 py-3">
        {isMensual && item.fecha_inicio ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} text-xs border border-cyan-500/20`}>
            <Calendar className="h-3 w-3" />
            {getMonthShort(item.fecha_inicio)}
          </span>
        ) : item.catorcena_inicio_num && item.catorcena_inicio_anio ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} text-xs border border-cyan-500/20`}>
            <Calendar className="h-3 w-3" />
            Cat {item.catorcena_inicio_num} / {item.catorcena_inicio_anio}
          </span>
        ) : (
          <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>-</span>
        )}
      </td>
      {/* Cat. Fin */}
      <td className="px-4 py-3">
        {isMensual && item.fecha_fin ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'} text-xs border border-amber-500/20`}>
            <Calendar className="h-3 w-3" />
            {getMonthShort(item.fecha_fin)}
          </span>
        ) : item.catorcena_fin_num && item.catorcena_fin_anio ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'} text-xs border border-amber-500/20`}>
            <Calendar className="h-3 w-3" />
            Cat {item.catorcena_fin_num} / {item.catorcena_fin_anio}
          </span>
        ) : (
          <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>-</span>
        )}
      </td>
      {/* Inversión */}
      <td className="px-4 py-3">
        <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
          {inv > 0 ? formatCurrency(inv) : '-'}
        </span>
      </td>
      {/* APS */}
      <td className="px-4 py-3 text-center">
        {item.has_aps ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </span>
        ) : (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <Minus className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
          </span>
        )}
      </td>
      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpen(item.id)}
            className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border-purple-500/20 hover:border-purple-500/40' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 border-purple-200 hover:border-purple-300'} border transition-all`}
            title="Abrir campaña"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {item.propuesta_id && (
            <button
              onClick={() => onShare(item.propuesta_id!)}
              className={`p-2 rounded-lg ${isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 border-cyan-200 hover:border-cyan-300'} border transition-all`}
              title="Compartir campaña"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canEditPerm && (
            <button
              onClick={() => onEdit(item)}
              disabled={isEditDisabled}
              className={`p-2 rounded-lg border transition-all ${
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
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canSeeGestionArtesPerm && (
            <button
              onClick={() => onIncidencia(item)}
              className="p-2 rounded-lg border bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 border-orange-500/20 hover:border-orange-500/40 transition-all"
              title="Reportar incidencia"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export function CampanasPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const permissions = getPermissions(user?.rol);

  // WebSocket para actualizaciones en tiempo real
  useSocketCampanas();

  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchTags, setDebouncedSearchTags] = useState<string[]>([]);
  const [debouncedSearchInput, setDebouncedSearchInput] = useState('');

  // Pre-fill search if search param is present in URL
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTags([searchParam]);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);
  const [historialFilter, setHistorialFilter] = useState<HistorialFilterValues>({});
  // Estados para filtros/ordenamiento/agrupación con popups
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterCondition[]>([]);
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estados para filtros expandibles
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState<string | null>(null);
  const [selectedCatorcenaInicio, setSelectedCatorcenaInicio] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCampana, setSelectedCampana] = useState<Campana | null>(null);
  const [ordenesMontajeModalOpen, setOrdenesMontajeModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusCampana, setStatusCampana] = useState<Campana | null>(null);
  const [incidenciaModalOpen, setIncidenciaModalOpen] = useState(false);
  const [incidenciaCampana, setIncidenciaCampana] = useState<Campana | null>(null);

  // Estado para galería de artes en versionario
  const [isArtGalleryOpen, setIsArtGalleryOpen] = useState(false);
  const [artGalleryImages, setArtGalleryImages] = useState<ImagenDigitalView[]>([]);
  const [artGalleryTitle, setArtGalleryTitle] = useState('');

  const limit = 20;

  // Estado para la vista activa (tabs)
  const [activeView, setActiveView] = useState<ViewType>('tabla');

  // Estado para la vista de catorcena
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [expandedCampanas, setExpandedCampanas] = useState<Set<number>>(new Set());
  const [expandedAPS, setExpandedAPS] = useState<Set<string>>(new Set()); // key: campanaId-aps
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set()); // key: campanaId-aps-grupoKey
  const [campanaInventarios, setCampanaInventarios] = useState<Record<number, InventarioConAPS[]>>({});
  const [campanaCaras, setCampanaCaras] = useState<Record<number, SolicitudCara[]>>({});
  const [loadingInventarios, setLoadingInventarios] = useState<Set<number>>(new Set());
  const [exportingLayout, setExportingLayout] = useState(false);
  const [exportingVersionarioArtes, setExportingVersionarioArtes] = useState(false);
  const [versionarioArtesProgress, setVersionarioArtesProgress] = useState({ current: 0, total: 0 });
  // Flag para cancelar la carga si el usuario cierra el modal en medio.
  const versionarioCancelledRef = useRef(false);
  // Preview del Versionario Artes — lazy-loading por campaña.
  // El modal abre instantaneo; solo fetcheamos las campañas que el usuario ve
  // en la pagina activa (paginacion = 25 campañas/pagina).
  const [versionarioPreviewOpen, setVersionarioPreviewOpen] = useState(false);
  const [versionarioCampanasList, setVersionarioCampanasList] = useState<Campana[]>([]);
  const [versionarioCache, setVersionarioCache] = useState<Map<number, VersionarioCacheEntry>>(new Map());
  const [versionarioDownloading, setVersionarioDownloading] = useState(false);
  // Ids con fetch en curso (evita disparar el mismo fetch dos veces desde useEffects).
  const versionarioFetchingRef = useRef<Set<number>>(new Set());
  // Inversión (costo) por catorcena para la vista Versionario: { campanaId: { "numCat:anio": inversion } }
  const [inversionPorCatorcena, setInversionPorCatorcena] = useState<Record<number, Record<string, number>>>({});

  // Add search tag on Enter/Tab
  const addSearchTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !searchTags.includes(trimmed)) {
      setSearchTags(prev => [...prev, trimmed]);
    }
    setSearchInput('');
  };

  const removeSearchTag = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
  };

  // Debounce conjunto de tags + input en un solo timer. Antes había dos
  // efectos paralelos que provocaban renders dobles si ambos cambiaban a la
  // vez (típico al presionar Enter para crear un tag — se actualizan ambos).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTags(searchTags);
      setDebouncedSearchInput(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTags, searchInput]);

  // Catorcenas casi nunca cambian — staleTime alto evita refetches al
  // navegar entre páginas que comparten esta queryKey.
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    staleTime: 1000 * 60 * 30, // 30 min
    gcTime: 1000 * 60 * 60,    // 1 h
  });

  // Combine debounced tags + debounced input into all active search terms
  const allSearchTerms = useMemo(() => {
    const terms = [...debouncedSearchTags];
    if (debouncedSearchInput.trim()) terms.push(debouncedSearchInput.trim());
    return terms;
  }, [debouncedSearchTags, debouncedSearchInput]);

  const hasSearch = allSearchTerms.length > 0;
  const needsAllData = activeGroupings.length > 0 || advancedFilters.length > 0;
  // En vista catorcena necesitamos todas las campañas del rango para que la agrupación
  // por catorcena sea correcta (no podemos paginar y agrupar). 200 se queda corto cuando
  // hay muchas campañas activas en catorcenas cercanas — usar tope alto.
  const effectiveLimit = activeView === 'catorcena' ? 50000 : (needsAllData ? 200 : limit);
  // Tags unidos por '|' — el backend separa por ese delimitador (no espacios)
  // y aplica AND entre tags. Soporta búsqueda por nombre de campaña,
  // razon_social, CUIC, marca, código de inventario, etc.
  const serverSearch = allSearchTerms.length > 0 ? allSearchTerms.join('|') : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', needsAllData ? 1 : page, status, yearInicio, yearFin, catorcenaInicio, catorcenaFin, tipoPeriodo, needsAllData, serverSearch, effectiveLimit, historialFilter],
    queryFn: () =>
      campanasService.getAll({
        page: needsAllData ? 1 : page,
        limit: effectiveLimit,
        status: (status && status !== 'Incompleta') ? status : undefined,
        search: serverSearch,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        tipoPeriodo: tipoPeriodo || undefined,
        excludeRechazadas: true,
        ...historialFilter,
      }),
    staleTime: 1000 * 30, // 30 s — WS invalida en cambios reales
    placeholderData: (prev) => prev, // evita parpadeo al paginar/filtrar
  });

  // Stats query — global KPIs with same filters.
  // Incluimos serverSearch para que total/chart reflejen los resultados
  // filtrados aunque estemos en la página 1 de N.
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['campanas-stats', status, yearInicio, yearFin, catorcenaInicio, catorcenaFin, tipoPeriodo, serverSearch],
    queryFn: () =>
      campanasService.getStats({
        status: (status && status !== 'Incompleta') ? status : undefined,
        search: serverSearch,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        tipoPeriodo: tipoPeriodo || undefined,
        excludeRechazadas: true,
      }),
    staleTime: 1000 * 30,
  });

  // Get current catorcena
  const currentCatorcena = useMemo((): Catorcena | null => {
    if (!catorcenasData?.data) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return catorcenasData.data.find(c => {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      return today >= inicio && today <= fin;
    }) || null;
  }, [catorcenasData]);

  // No default catorcena filter — show all campanas on load

  // Generate catorcena options for filter (sorted by year desc, then catorcena desc)
  const catorcenaInicioOptions = useMemo(() => {
    if (!catorcenasData?.data) return [];
    return catorcenasData.data
      .slice()
      .sort((a, b) => {
        if (b.a_o !== a.a_o) return b.a_o - a.a_o;
        return b.numero_catorcena - a.numero_catorcena;
      })
      .map(c => `Cat ${c.numero_catorcena} / ${c.a_o}`);
  }, [catorcenasData]);

  // Filter data locally for catorcena inicio, "Incompleta" status, advanced
  // filters y sort. La búsqueda (search) ya la aplicó el backend sobre todos
  // los campos relevantes (incluye codigo_unico de inventarios via subquery),
  // así que NO se re-filtra cliente-side.
  const filteredData = useMemo(() => {
    let items = data?.data || [];

    // Filter by catorcena inicio
    if (selectedCatorcenaInicio && items.length > 0) {
      // Parse "Cat X / YYYY" format
      const match = selectedCatorcenaInicio.match(/Cat (\d+) \/ (\d+)/);
      if (match) {
        const catNum = parseInt(match[1]);
        const catYear = parseInt(match[2]);
        items = items.filter(c =>
          c.catorcena_inicio_num === catNum && c.catorcena_inicio_anio === catYear
        );
      }
    }

    // Filter by "Incompleta" status (frontend-only)
    if (status === 'Incompleta') {
      items = items.filter(c =>
        c.caras_ultima_cat != null && Number(c.caras_ultima_cat) > 0 && Number(c.reservas_count_ultima_cat) < Number(c.caras_ultima_cat)
      );
    }

    // Apply advanced filters (con soporte extendido para codigos_inventario desde inventarios cargados)
    if (advancedFilters.length > 0) {
      items = items.filter(item => {
        let result = evalFilterWithInventario(item, advancedFilters[0]);
        for (let i = 1; i < advancedFilters.length; i++) {
          const val = evalFilterWithInventario(item, advancedFilters[i]);
          if (advancedFilters[i].connector === 'O') result = result || val;
          else result = result && val;
        }
        return result;
      });
    }

    // Helper inline: evalúa condición extendida para codigos_inventario
    function evalFilterWithInventario(item: Campana, filter: AdvancedFilterCondition): boolean {
      // Filtro por etapa del gestor de artes (estatus_arte de los inventarios).
      // El valor del filtro es el label visible (ej. "En Revisión"); lo mapeamos
      // al estatus_arte real ("Revision Artes"). Operadores soportados: = / !=.
      if (filter.field === 'etapa') {
        if (!filter.value) return true;
        const mapped = ETAPA_VALUES.find(e => e.label === filter.value)?.value;
        if (!mapped) return true; // valor desconocido, no filtra
        const invItems = campanaInventarios[item.id] || [];
        if (invItems.length === 0) {
          // Sin inventarios cargados → asumimos Carga Artes
          const matchesEmpty = mapped === 'Carga Artes';
          return filter.operator === '!=' ? !matchesEmpty : matchesEmpty;
        }
        const matchFn = (inv: any): boolean => {
          if (mapped === '__programado__') {
            const ip = inv.indicaciones_programacion;
            return !!(ip && String(ip).trim());
          }
          return inv.estatus_arte === mapped;
        };
        const someMatch = invItems.some(matchFn);
        if (filter.operator === '!=' || filter.operator === 'not_contains') {
          // Negativo: la campaña debe tener cero items en esa etapa
          return !someMatch;
        }
        return someMatch;
      }
      // Para filtros de codigos_inventario, también buscar en inventarios cargados
      if (filter.field === 'codigos_inventario' && filter.value) {
        const baseResult = evalCondition(item, filter);
        if (baseResult) return true;
        // Buscar en inventarios cargados (codigo_unico individual)
        const invItems = campanaInventarios[item.id] || [];
        if (invItems.length > 0) {
          const filterVal = filter.value.toLowerCase();
          const hasMatch = invItems.some(inv => {
            const code = inv.codigo_unico?.toLowerCase() || '';
            switch (filter.operator) {
              case '=': return code === filterVal;
              case '!=': return code !== filterVal;
              case 'contains': return code.includes(filterVal);
              case 'not_contains': return !code.includes(filterVal);
              default: return false;
            }
          });
          // Para operadores negativos (!=, not_contains), todos los items deben cumplir
          if (filter.operator === '!=' || filter.operator === 'not_contains') {
            return baseResult && invItems.every(inv => {
              const code = inv.codigo_unico?.toLowerCase() || '';
              return filter.operator === '!=' ? code !== filterVal : !code.includes(filterVal);
            });
          }
          return hasMatch;
        }
        return baseResult;
      }
      return evalCondition(item, filter);
    }

    // Apply sorting
    if (sortField && items.length > 0) {
      items = [...items].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortField) {
          case 'fecha_inicio':
            aVal = a.fecha_inicio;
            bVal = b.fecha_inicio;
            break;
          case 'nombre':
            aVal = a.nombre?.toLowerCase() || '';
            bVal = b.nombre?.toLowerCase() || '';
            break;
          case 'cliente_nombre':
            aVal = (a.cliente_nombre || a.cliente_razon_social || '').toLowerCase();
            bVal = (b.cliente_nombre || b.cliente_razon_social || '').toLowerCase();
            break;
          case 'status':
            aVal = a.status?.toLowerCase() || '';
            bVal = b.status?.toLowerCase() || '';
            break;
        }

        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [data?.data, selectedCatorcenaInicio, status, advancedFilters, sortField, sortDirection, campanaInventarios]);

  // Recalculate stats from filteredData when client-side filters are active.
  // El search ya viaja al backend y stats lo recibe via queryKey, así que NO
  // forzamos recálculo cliente cuando solo hay búsqueda activa.
  const needsClientFilter = advancedFilters.length > 0 || selectedCatorcenaInicio || status === 'Incompleta';
  const effectiveStats = useMemo(() => {
    if (needsClientFilter && data?.data) {
      const byStatus: Record<string, number> = {};
      let conAps = 0;
      let sinAps = 0;
      filteredData.forEach(c => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        if (c.has_aps) conAps++; else sinAps++;
      });
      return {
        total: filteredData.length,
        activas: filteredData.filter(c => c.status === 'Activa' || c.status === 'En Proceso').length,
        inactivas: filteredData.filter(c => c.status === 'Inactiva' || c.status === 'Finalizada').length,
        byStatus,
        conAps,
        sinAps,
      };
    }
    return statsData || null;
  }, [needsClientFilter, filteredData, data?.data, statsData]);

  // Group data - supports up to 2 levels
  interface GroupedLevel1 {
    name: string;
    items: Campana[];
    subgroups?: { name: string; items: Campana[] }[];
  }

  const getGroupValue = (item: Campana, field: GroupByField): string => {
    if (field === 'catorcena_inicio') {
      if ((item as any).tipo_periodo === 'mensual' && item.fecha_inicio) {
        return getMonthLabel(item.fecha_inicio);
      }
      return item.catorcena_inicio_num && item.catorcena_inicio_anio
        ? `Cat ${item.catorcena_inicio_num} / ${item.catorcena_inicio_anio}`
        : 'Sin periodo';
    } else if (field === 'status') {
      return item.status || 'Sin status';
    } else if (field === 'cliente_nombre') {
      return item.cliente_nombre || item.cliente_razon_social || 'Sin cliente';
    } else if (field === 'creador_nombre') {
      return item.creador_nombre || 'Sin creador';
    } else if (field === 'T0_U_Asesor') {
      return item.T0_U_Asesor || 'Sin asesor';
    }
    return 'Sin asignar';
  };

  const groupedData = useMemo((): GroupedLevel1[] | null => {
    if (activeGroupings.length === 0 || !filteredData.length) return null;

    const groupKey1 = activeGroupings[0];
    const groupKey2 = activeGroupings.length > 1 ? activeGroupings[1] : null;

    const groups: Record<string, Campana[]> = {};

    // First level grouping
    filteredData.forEach(item => {
      const key = getGroupValue(item, groupKey1);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort by count (descending)
    const sortGroups = (entries: [string, Campana[]][]) => {
      return entries.sort((a, b) => b[1].length - a[1].length);
    };

    // Convert to array and add second level if needed
    const result: GroupedLevel1[] = sortGroups(Object.entries(groups))
      .map(([name, items]) => {
        if (groupKey2) {
          // Second level grouping
          const subgroupsMap: Record<string, Campana[]> = {};
          items.forEach(item => {
            const subKey = getGroupValue(item, groupKey2);
            if (!subgroupsMap[subKey]) subgroupsMap[subKey] = [];
            subgroupsMap[subKey].push(item);
          });
          const subgroups = sortGroups(Object.entries(subgroupsMap))
            .map(([subName, subItems]) => ({ name: subName, items: subItems }));
          return { name, items, subgroups };
        }
        return { name, items };
      });

    return result;
  }, [filteredData, activeGroupings]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Funciones para manejar filtros
  const addFilter = useCallback(() => {
    const newFilter: AdvancedFilterCondition = {
      id: `filter-${Date.now()}`,
      field: CAMPANA_FILTER_FIELDS[0].field,
      operator: '=',
      value: '',
      connector: 'Y',
    };
    setAdvancedFilters(prev => [...prev, newFilter]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<AdvancedFilterCondition>) => {
    setAdvancedFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setAdvancedFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => {
    setAdvancedFilters([]);
  }, []);

  // Función para toggle de agrupación
  const toggleGrouping = useCallback((field: GroupByField) => {
    setActiveGroupings(prev => {
      // En vista catorcena, catorcena_inicio no puede ser removida
      if (activeView === 'catorcena' && field === 'catorcena_inicio') {
        return prev;
      }
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      // En vista catorcena, catorcena_inicio siempre es primera, solo se puede agregar segunda
      if (activeView === 'catorcena') {
        if (prev.length >= 2) {
          return ['catorcena_inicio', field] as GroupByField[];
        }
        return ['catorcena_inicio', field] as GroupByField[];
      }
      if (prev.length >= 2) {
        return [prev[1], field];
      }
      return [...prev, field];
    });
  }, [activeView]);

  // Funciones para la vista de catorcena
  const toggleCatorcena = (catorcenaKey: string) => {
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      if (next.has(catorcenaKey)) {
        next.delete(catorcenaKey);
      } else {
        next.add(catorcenaKey);
      }
      return next;
    });
  };

  const toggleCampana = async (campanaId: number) => {
    const isExpanding = !expandedCampanas.has(campanaId);

    setExpandedCampanas(prev => {
      const next = new Set(prev);
      if (next.has(campanaId)) {
        next.delete(campanaId);
      } else {
        next.add(campanaId);
      }
      return next;
    });

    // Si estamos expandiendo y no tenemos los datos, cargarlos
    if (isExpanding && (!campanaInventarios[campanaId] || !campanaCaras[campanaId])) {
      setLoadingInventarios(prev => new Set(prev).add(campanaId));
      try {
        // Llamar a los tres endpoints en paralelo: con APS, sin APS y solicitud_caras
        const [conAPS, sinAPS, caras] = await Promise.all([
          campanasService.getInventarioConAPS(campanaId),
          campanasService.getInventarioReservado(campanaId),
          campanasService.getCaras(campanaId),
        ]);

        // Combinar ambos resultados, agregando aps: 0 a los sin APS
        const sinAPSConFormato: InventarioConAPS[] = sinAPS.map(item => ({
          ...item,
          aps: 0 // Marcar explícitamente como sin APS
        }));

        const todosLosInventarios = [...conAPS, ...sinAPSConFormato];
        setCampanaInventarios(prev => ({ ...prev, [campanaId]: todosLosInventarios }));
        setCampanaCaras(prev => ({ ...prev, [campanaId]: caras }));
      } catch (error) {
        console.error('Error cargando inventario:', error);
        setCampanaInventarios(prev => ({ ...prev, [campanaId]: [] }));
      } finally {
        setLoadingInventarios(prev => {
          const next = new Set(prev);
          next.delete(campanaId);
          return next;
        });
      }
    }
  };

  const toggleAPS = (campanaId: number, aps: number | null) => {
    const key = `${campanaId}-${aps ?? 'sin-aps'}`;
    setExpandedAPS(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleGrupo = (campanaId: number, aps: number | null, grupoKey: string) => {
    const key = `${campanaId}-${aps ?? 'sin-aps'}-${grupoKey}`;
    setExpandedGrupos(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Auto-cargar inventarios de campañas visibles en vista catorcena (batch endpoint)
  const loadingRef = useRef(new Set<number>());
  const isLoadingBatchRef = useRef(false);
  useEffect(() => {
    if (activeView !== 'catorcena' || !filteredData.length) return;
    if (isLoadingBatchRef.current) return; // Prevent concurrent batches
    const idsToLoad = filteredData
      .filter(c => !campanaInventarios[c.id] && !loadingRef.current.has(c.id))
      .map(c => c.id);
    if (idsToLoad.length === 0) return;

    const BATCH_SIZE = 20;
    const batch = idsToLoad.slice(0, BATCH_SIZE);
    batch.forEach(id => loadingRef.current.add(id));
    isLoadingBatchRef.current = true;
    setLoadingInventarios(new Set(loadingRef.current));

    campanasService.getBatchInventarios(batch)
      .then(batchData => {
        setCampanaInventarios(prev => {
          const next = { ...prev };
          for (const id of batch) {
            next[id] = batchData[id] || [];
          }
          return next;
        });
      })
      .catch(() => {
        // On failure, mark as empty so they can be retried on next render
        setCampanaInventarios(prev => {
          const next = { ...prev };
          for (const id of batch) {
            next[id] = [];
          }
          return next;
        });
      })
      .finally(() => {
        batch.forEach(id => loadingRef.current.delete(id));
        isLoadingBatchRef.current = false;
        setLoadingInventarios(new Set(loadingRef.current));
      });
  }, [activeView, filteredData, campanaInventarios]);

  // Cargar inversión por catorcena (usando sc.costo) — usado por versionario y tabla.
  // Patrón: `loadedIdsRef` evita reintentar IDs ya procesados. `batchTick` es
  // un contador que se incrementa después de cada batch para disparar el
  // siguiente automáticamente hasta que no queden IDs pendientes.
  const loadingInvCatRef = useRef(false);
  const loadedInvCatIdsRef = useRef<Set<number>>(new Set());
  const [batchTick, setBatchTick] = useState(0);
  useEffect(() => {
    if (!filteredData.length) return;
    if (loadingInvCatRef.current) return;

    const idsToLoad = filteredData
      .filter(c => !loadedInvCatIdsRef.current.has(c.id))
      .map(c => c.id);
    if (idsToLoad.length === 0) return;

    const BATCH = 200;
    const batch = idsToLoad.slice(0, BATCH);
    batch.forEach(id => loadedInvCatIdsRef.current.add(id));
    loadingInvCatRef.current = true;

    campanasService.getBatchInversionesCostoPorCatorcena(batch)
      .then(data => {
        setInversionPorCatorcena(prev => {
          const next = { ...prev };
          for (const id of batch) {
            const campData = data[id] || {};
            const flat: Record<string, number> = {};
            Object.entries(campData).forEach(([key, val]) => {
              flat[key] = Number(val?.inversion || 0);
            });
            next[id] = flat;
          }
          return next;
        });
      })
      .catch(() => {
        setInversionPorCatorcena(prev => {
          const next = { ...prev };
          for (const id of batch) next[id] = {};
          return next;
        });
      })
      .finally(() => {
        loadingInvCatRef.current = false;
        setBatchTick(t => t + 1);
      });
  }, [filteredData, batchTick]);

  // Agrupar campañas por catorcena para la vista alternativa (con soporte para subagrupaciones)
  const campanasPorCatorcena = useMemo(() => {
    const groups: Record<string, {
      catorcena: { num: number; anio: number };
      campanas: Campana[];
      subgroups?: { name: string; campanas: Campana[] }[];
    }> = {};

    // Build sorted catorcena list for range expansion
    const catorcenasList = (catorcenasData?.data || [])
      .map(c => ({ num: c.numero_catorcena, anio: c.a_o }))
      .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.num - b.num);

    filteredData.forEach(item => {
      const isMensual = (item as any).tipo_periodo === 'mensual';
      if (isMensual && item.fecha_inicio) {
        // For mensual campaigns, group by month derived from fecha_inicio
        const parts = item.fecha_inicio.split('-');
        const anio = parseInt(parts[0]);
        const mes = parseInt(parts[1]); // 1-12
        const key = `${anio}-${String(mes).padStart(2, '0')}`;
        if (!groups[key]) {
          groups[key] = {
            catorcena: { num: mes, anio, isMensual: true } as any,
            campanas: []
          };
        }
        groups[key].campanas.push(item);
      } else if (item.catorcena_inicio_num && item.catorcena_inicio_anio) {
        // Usar catorcenas reales con contenido si el backend las proporciona
        const catContenido = (item as any).catorcenas_con_contenido as string | null;
        if (catContenido) {
          // Formato: "num:anio,num:anio,..."
          const catorcenasReales = catContenido.split(',').map(entry => {
            const [num, anio] = entry.split(':').map(Number);
            return { num, anio };
          }).filter(c => !isNaN(c.num) && !isNaN(c.anio));

          if (catorcenasReales.length > 0) {
            catorcenasReales.forEach(({ num, anio }) => {
              const key = `${anio}-${String(num).padStart(2, '0')}`;
              if (!groups[key]) {
                groups[key] = { catorcena: { num, anio }, campanas: [] };
              }
              groups[key].campanas.push(item);
            });
          } else {
            // Fallback: solo catorcena de inicio
            const key = `${item.catorcena_inicio_anio}-${String(item.catorcena_inicio_num).padStart(2, '0')}`;
            if (!groups[key]) {
              groups[key] = { catorcena: { num: item.catorcena_inicio_num, anio: item.catorcena_inicio_anio }, campanas: [] };
            }
            groups[key].campanas.push(item);
          }
        } else {
          // Sin caras reservadas: la campaña existe pero está incompleta. La distribuimos
          // por su rango de fechas para que aparezca en cada catorcena que cubre. La
          // inversión por catorcena queda en 0 (sin caras = sin costo), así que no infla.
          const startNum = item.catorcena_inicio_num;
          const startAnio = item.catorcena_inicio_anio;
          const endNum = item.catorcena_fin_num || startNum;
          const endAnio = item.catorcena_fin_anio || startAnio;

          const startIdx = catorcenasList.findIndex(c => c.num === startNum && c.anio === startAnio);
          const endIdx = catorcenasList.findIndex(c => c.num === endNum && c.anio === endAnio);

          if (startIdx >= 0 && endIdx >= 0) {
            for (let i = startIdx; i <= endIdx; i++) {
              const { num, anio } = catorcenasList[i];
              const key = `${anio}-${String(num).padStart(2, '0')}`;
              if (!groups[key]) {
                groups[key] = { catorcena: { num, anio }, campanas: [] };
              }
              groups[key].campanas.push(item);
            }
          } else {
            const key = `${startAnio}-${String(startNum).padStart(2, '0')}`;
            if (!groups[key]) {
              groups[key] = { catorcena: { num: startNum, anio: startAnio }, campanas: [] };
            }
            groups[key].campanas.push(item);
          }
        }
      }
    });

    // Filtrar grupos para que solo queden catorcenas dentro del rango del filtro de periodo activo
    if (yearInicio && yearFin && catorcenaInicio && catorcenaFin) {
      const filterStartKey = `${yearInicio}-${String(catorcenaInicio).padStart(2, '0')}`;
      const filterEndKey = `${yearFin}-${String(catorcenaFin).padStart(2, '0')}`;
      Object.keys(groups).forEach(key => {
        if (key < filterStartKey || key > filterEndKey) {
          delete groups[key];
        }
      });
      // Una campaña solo aparece en las catorcenas donde tiene caras reales
      // (catorcenas_con_contenido). Si su período toca el rango filtrado pero no tiene caras
      // ahí, queda fuera — eso es correcto, su actividad está en otra catorcena.
    } else if (yearInicio && yearFin) {
      Object.keys(groups).forEach(key => {
        const groupAnio = parseInt(key.split('-')[0]);
        if (groupAnio < yearInicio || groupAnio > yearFin) {
          delete groups[key];
        }
      });
    }

    // Obtener segunda agrupación si existe y la primera es catorcena_inicio
    const secondGrouping = activeGroupings[0] === 'catorcena_inicio' && activeGroupings.length > 1
      ? activeGroupings[1]
      : null;

    // Ordenar por año desc, luego por catorcena desc
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => {
        // Si hay segunda agrupación, crear subgrupos
        if (secondGrouping) {
          const subgroupsMap: Record<string, Campana[]> = {};
          value.campanas.forEach(campana => {
            const subKey = getGroupValue(campana, secondGrouping);
            if (!subgroupsMap[subKey]) subgroupsMap[subKey] = [];
            subgroupsMap[subKey].push(campana);
          });
          const subgroups = Object.entries(subgroupsMap)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([name, campanas]) => ({ name, campanas }));
          return { key, ...value, subgroups };
        }
        return { key, ...value };
      });
  }, [filteredData, activeGroupings, catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  // Mapa de fechas de catorcenas para verificar overlap de periodos
  const catorcenaDateMap = useMemo(() => {
    const map: Record<string, { inicio: number; fin: number }> = {};
    catorcenasData?.data?.forEach(c => {
      map[`${c.numero_catorcena}-${c.a_o}`] = {
        inicio: new Date(c.fecha_inicio).getTime(),
        fin: new Date(c.fecha_fin).getTime(),
      };
    });
    return map;
  }, [catorcenasData]);

  // Helper: verifica si un item de inventario pertenece a una catorcena (por match exacto o overlap de fechas)
  const itemMatchesCatorcena = useCallback((inv: any, catNum: number, catAnio: number): boolean => {
    // Match exacto por numero_catorcena (item inicia en esta catorcena)
    const invCat = inv.numero_catorcena;
    const invAnio = inv.anio_catorcena;
    if (invCat != null && invAnio != null && Number(invCat) === catNum && Number(invAnio) === catAnio) return true;
    // Overlap de fechas (item abarca esta catorcena aunque inicie en otra)
    const itemInicio = inv.inicio_periodo ? new Date(inv.inicio_periodo).getTime() : null;
    const itemFin = inv.fin_periodo ? new Date(inv.fin_periodo).getTime() : null;
    if (!itemInicio) return false;
    const target = catorcenaDateMap[`${catNum}-${catAnio}`];
    if (!target) return false;
    const efectiveFin = itemFin || itemInicio;
    return itemInicio <= target.fin && efectiveFin >= target.inicio;
  }, [catorcenaDateMap]);

  // Campañas únicas en los grupos de catorcena visibles
  const uniqueCampsInCatorcenaView = useMemo(() => {
    const ids = new Set<number>();
    campanasPorCatorcena.forEach(g => g.campanas.forEach(c => ids.add(c.id)));
    return ids.size;
  }, [campanasPorCatorcena]);

  // Estadísticas para gráfica de Status — from global stats
  const statusChartData = useMemo(() => {
    if (!effectiveStats?.byStatus) return [];

    let fallbackIndex = 0;
    return Object.entries(effectiveStats.byStatus)
      .filter(([name]) => name.toLowerCase() !== 'pase a ventas')
      .map(([name, value]) => {
        const key = name.toLowerCase();
        let color = CHART_COLORS.status[key as keyof typeof CHART_COLORS.status];
        if (!color) {
          color = CHART_COLORS.statusFallback[fallbackIndex % CHART_COLORS.statusFallback.length];
          fallbackIndex++;
        }
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [effectiveStats]);

  // Estadísticas para gráfica de Categoría de Mercado
  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    const total = filteredData.length;

    filteredData.forEach(item => {
      const category = item.T2_U_Categoria || 'Sin categoría';
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
        color: CHART_COLORS.category[index % CHART_COLORS.category.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Agrupar inventarios primero por APS, luego por período y artículo (como detalle de campaña)
  // Handler para abrir galería de artes en versionario
  const openArtGallery = useCallback((_campanaId: number, items: InventarioConAPS[], title: string) => {
    setArtGalleryTitle(title);

    const getNombreArchivo = (url: string): string => {
      try {
        const last = url.split('/').pop() || url;
        // El backend prefija con timestamp+random (ej. "1779417112969-18ry9vbs-Chanel_Botella.png").
        // Quitar el prefijo "timestamp-randomhash-" si está presente para mostrar nombre legible.
        const cleaned = last.replace(/^\d{10,}-[a-z0-9]+-/i, '');
        return decodeURIComponent(cleaned);
      } catch {
        return url;
      }
    };

    const isVideo = (u: string) => /\.(mp4|mov|avi|webm|mkv|wmv)$/i.test(u);

    // Construir galería: si el item trae artes_detalle (JSON con varios spots),
    // generamos una entrada por arte; si no, hacemos fallback al campo archivo único.
    const images: ImagenDigitalView[] = [];
    items.forEach((item, idx) => {
      let detalle: Array<{ archivo: string; nota?: string; spot?: number }> | null = null;
      const raw = (item as any).artes_detalle as string | null | undefined;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) detalle = parsed;
        } catch { /* JSON inválido, caer al fallback */ }
      }

      if (detalle && detalle.length > 0) {
        // Ordenar por spot ascendente para que aparezcan Spot 1, Spot 2, ...
        detalle.sort((a, b) => (Number(a.spot) || 0) - (Number(b.spot) || 0));
        detalle.forEach((a, i) => {
          if (!a.archivo) return;
          images.push({
            id: (item.id || idx) * 100 + i,
            archivo: a.archivo,
            archivoData: undefined,
            spot: Number(a.spot) || i + 1,
            tipo: isVideo(a.archivo) ? 'video' : 'image',
            estado: (item as any).estatus_arte || '',
            codigoUnico: item.codigo_unico,
            nota: (a.nota || '').trim() || undefined,
            nombreArchivo: getNombreArchivo(a.archivo),
          });
        });
      } else if (item.archivo && item.archivo !== '' && item.archivo !== 'sin_arte') {
        // Fallback al comportamiento anterior si no hay artes_detalle.
        images.push({
          id: item.id || idx,
          archivo: item.archivo,
          archivoData: undefined,
          spot: idx + 1,
          tipo: isVideo(item.archivo) ? 'video' : 'image',
          estado: (item as any).estatus_arte || '',
          codigoUnico: item.codigo_unico,
          nombreArchivo: getNombreArchivo(item.archivo),
        });
      }
    });

    setArtGalleryImages(images);
    setIsArtGalleryOpen(true);
  }, []);

  const getInventarioAgrupadoPorAPS = (inventarios: InventarioConAPS[]) => {
    // Separar los que tienen APS de los que no
    const conAPS: Record<number, InventarioConAPS[]> = {};
    const sinAPS: InventarioConAPS[] = [];

    inventarios.forEach(item => {
      if (item.aps && item.aps > 0) {
        if (!conAPS[item.aps]) {
          conAPS[item.aps] = [];
        }
        conAPS[item.aps].push(item);
      } else {
        sinAPS.push(item);
      }
    });

    // Función para agrupar por solicitud_caras_id (grupo_id)
    const agruparPorGrupo = (items: InventarioConAPS[]) => {
      const grupos: Record<string, InventarioConAPS[]> = {};
      items.forEach(item => {
        // Agrupar por solicitud_caras_id
        const grupoId = item.solicitud_caras_id || 'sin-grupo';
        const grupoKey = `grupo-${grupoId}`;
        if (!grupos[grupoKey]) {
          grupos[grupoKey] = [];
        }
        grupos[grupoKey].push(item);
      });
      return Object.entries(grupos).map(([key, groupItems]) => ({
        key,
        grupoId: groupItems[0]?.solicitud_caras_id || null,
        articulo: groupItems[0]?.articulo || null,
        items: groupItems
      }));
    };

    // Construir resultado: primero los con APS (ordenados desc), luego los sin APS
    const resultado: { aps: number | null; totalItems: number; grupos: { key: string; grupoId: number | null; articulo: string | null; items: InventarioConAPS[] }[] }[] = [];

    // Agregar los que tienen APS (ordenados descendente)
    Object.entries(conAPS)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .forEach(([apsValue, items]) => {
        resultado.push({
          aps: Number(apsValue),
          totalItems: items.length,
          grupos: agruparPorGrupo(items)
        });
      });

    // Agregar los sin APS al final
    if (sinAPS.length > 0) {
      resultado.push({
        aps: null, // null indica "Sin APS"
        totalItems: sinAPS.length,
        grupos: agruparPorGrupo(sinAPS)
      });
    }

    return resultado;
  };

  const hasPeriodFilter = yearInicio !== undefined && yearFin !== undefined;
  const hasActiveFilters = !!(status || hasPeriodFilter || activeGroupings.length > 0 || searchTags.length > 0 || selectedCatorcenaInicio || advancedFilters.length > 0 || sortField !== null);

  // Get unique values for each field (for advanced filter dropdowns).
  // Solo se calcula cuando el panel de filtros avanzados está abierto: evita
  // recorrer 9 campos × N filas en cada render del padre mientras el panel
  // está cerrado.
  const getUniqueFieldValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!showAdvancedFilters || !data?.data) return valuesMap;

    CAMPANA_FILTER_FIELDS.forEach(fieldConfig => {
      // 'etapa' tiene un set fijo de valores (estatus_arte computado).
      if (fieldConfig.field === 'etapa') {
        valuesMap[fieldConfig.field] = ETAPA_VALUES.map(e => e.label);
        return;
      }
      const values = new Set<string>();
      data.data.forEach(item => {
        const val = item[fieldConfig.field as keyof Campana];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [showAdvancedFilters, data?.data]);

  // Lista de estatus únicos para el FilterChip
  const allStatuses = useMemo(() => {
    if (!data?.data) return [];
    const statusSet = new Set<string>();
    data.data.forEach(c => {
      if (c.status) statusSet.add(c.status);
    });
    // Add "Incompleta" if any campaign has incomplete inventory
    const hasIncompletas = data.data.some(c =>
      c.caras_ultima_cat != null && Number(c.caras_ultima_cat) > 0 && Number(c.reservas_count_ultima_cat) < Number(c.caras_ultima_cat)
    );
    if (hasIncompletas) statusSet.add('Incompleta');
    return Array.from(statusSet).sort();
  }, [data?.data]);

  const clearAllFilters = () => {
    setSearchTags([]);
    setSearchInput('');
    setStatus('');
    setTipoPeriodo('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setHistorialFilter({});
    setSelectedCatorcenaInicio('');
    setSortField(null);
    setSortDirection('desc');
    setActiveGroupings([]);
    setExpandedGroups(new Set());
    setAdvancedFilters([]);
    setPage(1);
  };

  // Handle export CSV with all columns
  const handleExportCSV = async () => {
    if (!filteredData.length) return;

    // Garantizar que todas las campañas tengan inversión prorrateada cargada antes de exportar.
    const missingIds = filteredData
      .filter(c => inversionPorCatorcena[c.id] === undefined)
      .map(c => c.id);
    let invMap = inversionPorCatorcena;
    if (missingIds.length > 0) {
      try {
        const fetched = await campanasService.getBatchInversionesCostoPorCatorcena(missingIds);
        const merged: Record<number, Record<string, number>> = { ...invMap };
        for (const id of missingIds) {
          const campData = fetched[id] || {};
          const flat: Record<string, number> = {};
          Object.entries(campData).forEach(([k, v]) => { flat[k] = Number(v?.inversion || 0); });
          merged[id] = flat;
        }
        invMap = merged;
        setInversionPorCatorcena(merged);
      } catch { /* si falla, usamos lo que tengamos */ }
    }

    const headers = [
      'ID', 'Periodo', 'Creador', 'Campaña', 'Marca', 'Estatus', 'Actividad', 'Fecha Inicio', 'Fecha Fin', 'Inversión', 'APS'
    ];
    const hayFiltro = !!(catorcenaInicio && catorcenaFin && yearInicio && yearFin);
    const rows = filteredData.map(c => {
      const periodStatus = getPeriodStatus(c.fecha_inicio, c.fecha_fin);
      const catIni = (c as any).tipo_periodo === 'mensual'
        ? getMonthShort(c.fecha_inicio)
        : (c.catorcena_inicio_num && c.catorcena_inicio_anio ? `Cat ${c.catorcena_inicio_num} ${c.catorcena_inicio_anio}` : '-');
      const catFin = (c as any).tipo_periodo === 'mensual'
        ? getMonthShort(c.fecha_fin)
        : (c.catorcena_fin_num && c.catorcena_fin_anio ? `Cat ${c.catorcena_fin_num} ${c.catorcena_fin_anio}` : '-');
      // Misma lógica que la columna de inversión en la tabla:
      // Con filtro: usar c.inversion (backend ya lo filtró por período).
      // Sin filtro: total dinámico del batch si ya cargó, sino fallback a c.inversion.
      let inv: number;
      if (hayFiltro) {
        inv = Number(c.inversion || 0);
      } else {
        const invData = invMap[c.id];
        inv = invData?.['total'] !== undefined ? invData['total'] : Number(c.inversion || 0);
      }
      return [
        c.id,
        periodStatus,
        c.creador_nombre || '',
        c.nombre || '',
        c.T2_U_Marca || c.cliente_nombre || c.cliente_razon_social || '',
        c.status,
        c.has_aps ? 'Activa' : 'Inactiva',
        catIni,
        catFin,
        inv > 0 ? formatCurrency(inv) : '-',
        c.has_aps ? 'Si' : 'No'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `campanas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExportVersionarioCSV = async () => {
    if (!campanasPorCatorcena.length) return;
    setExportingLayout(true);

    try {
      // Garantizar que todas las campañas visibles tengan inversión prorrateada cargada.
      const allCampanaIds = new Set<number>();
      campanasPorCatorcena.forEach(g => g.campanas.forEach(c => allCampanaIds.add(c.id)));
      const missingIds = [...allCampanaIds].filter(id => inversionPorCatorcena[id] === undefined);
      let invMap = inversionPorCatorcena;
      if (missingIds.length > 0) {
        try {
          const fetched = await campanasService.getBatchInversionesCostoPorCatorcena(missingIds);
          const merged: Record<number, Record<string, number>> = { ...invMap };
          for (const id of missingIds) {
            const campData = fetched[id] || {};
            const flat: Record<string, number> = {};
            Object.entries(campData).forEach(([k, v]) => { flat[k] = Number(v?.inversion || 0); });
            merged[id] = flat;
          }
          invMap = merged;
          setInversionPorCatorcena(merged);
        } catch { /* si falla, usamos lo que tengamos */ }
      }

      // Un solo request al backend con los mismos filtros activos
      const exportData = await campanasService.getExportLayout({
        status: (status && status !== 'Incompleta') ? status : undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        tipoPeriodo: tipoPeriodo || undefined,
        excludeRechazadas: true,
      });

      const { inventarios: allInventarios, campaignInfo, campaignsWithInventory } = exportData;
      const campaignsWithInvSet = new Set(campaignsWithInventory);

      // Index inventarios by campana_id
      const invByCampana: Record<number, any[]> = {};
      for (const inv of allInventarios) {
        const cid = Number(inv.campana_id);
        if (!invByCampana[cid]) invByCampana[cid] = [];
        invByCampana[cid].push(inv);
      }

      // Index campaign info
      const campInfoMap = new Map<number, any>();
      campaignInfo.forEach((c: any) => campInfoMap.set(Number(c.campana_id), c));

      const headers = [
        'Campaña', 'Anunciante', 'Inversión Campaña', 'Operación', 'Código de contrato (Opcional)',
        'Precio por cara (Opcional)', 'APS Global', 'APS Específico', 'CUIC', 'Articulo', 'Vendedor',
        'Descripción (Opcional)', 'Inicio o Periodo', 'Fin o Segmento', 'Arte',
        'Código de arte (Opcional)', 'Arte Url (Opcional)', 'Origen del arte (Opcional)',
        'Unidad', 'Cara', 'Ciudad', 'Tipo de Distribución', 'Reproducciones', 'Notas'
      ];

      const rows: string[][] = [];
      // Mostrar inversión una vez por (campaña, catorcena), usando el monto específico de esa catorcena.
      const invExportedKey = new Set<string>();

      for (const { catorcena, campanas } of campanasPorCatorcena) {
        for (const campana of campanas) {
          const info = campInfoMap.get(campana.id);
          const nombreCampana = info?.campana_nombre || campana.nombre || '';
          const anunciante = info?.anunciante || (campana as any).T2_U_Marca || (campana as any).cliente_nombre || '';
          const aps = info?.aps_global || (campana as any).aps_global || campana.id || '';
          const cuic = info?.cuic || (campana as any).cuic || '';
          const vendedor = info?.vendedor || (campana as any).creador_nombre || '';
          // Inversión prorrateada específica de esta catorcena (sc.costo × días_overlap / días_totales).
          const catKey = `${catorcena.num}:${catorcena.anio}`;
          const invData = invMap[campana.id];
          const invCampana = invData !== undefined
            ? (invData[catKey] || 0)
            : Number(info?.inversion || (campana as any).inversion) || 0;
          const exportKey = `${campana.id}:${catKey}`;
          const showInversion = !invExportedKey.has(exportKey);
          if (showInversion) invExportedKey.add(exportKey);
          const invStr = showInversion && invCampana > 0 ? `$${invCampana.toLocaleString('es-MX')}` : '0';
          const descripcion = info?.descripcion || (campana as any).descripcion || '';

          const allInv = invByCampana[campana.id] || [];
          const inventarios = allInv.filter((inv: any) => {
            const invNum = Number(inv.numero_catorcena);
            const invAnio = Number(inv.anio_catorcena);
            return invNum === catorcena.num && invAnio === catorcena.anio;
          });
          const periodo = (catorcena as any).isMensual
            ? `Mes ${catorcena.num}`
            : `Catorcena #${String(catorcena.num).padStart(2, '0')}`;

          if (inventarios.length === 0) {
            rows.push([
              nombreCampana, anunciante, invStr, '', '0', '0',
              String(aps), '', String(cuic), '', vendedor, descripcion,
              'Catorcenas ' + catorcena.anio, periodo,
              '0', '', '', '', '', '', '', '0', '0', ''
            ]);
          } else {
            let firstRow = true;
            for (const item of inventarios) {
              const operacion = item.cortesia ? 'CORTESIA' : (item.estatus_reserva === 'Bonificado' || item.estatus_reserva === 'Vendido bonificado') ? 'BONIFICACION' : 'RENTA';
              const precio = item.tarifa_publica_sc || item.tarifa_publica || 0;
              const estatusArte = item.estatus_arte || 'Pendiente';

              rows.push([
                nombreCampana,
                anunciante,
                firstRow ? invStr : '0',
                operacion,
                '0',
                precio ? `$${Number(precio).toLocaleString('es-MX')}` : '0',
                String(aps),
                String(item.aps ?? ''),
                String(cuic),
                item.articulo || '',
                vendedor,
                descripcion,
                'Catorcenas ' + catorcena.anio,
                periodo,
                estatusArte,
                '',
                item.archivo || '',
                '',
                item.codigo_unico || '',
                item.tipo_de_cara || '',
                item.plaza || item.estado || '',
                item.tradicional_digital || item.tipo_medio || '',
                '0',
                ''
              ]);
              firstRow = false;
            }
          }
        }
      }

      if (rows.length === 0) return;

      const esc = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
      const csvContent = [
        headers.map(esc).join(','),
        ...rows.map(row => row.map(esc).join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `versionario_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } finally {
      setExportingLayout(false);
    }
  };

  // Fetch de una campaña: inventarios con/sin arte + archivos digitales + notas.
  // Devuelve un CacheEntry listo para guardar en versionarioCache.
  const fetchOneVersionarioCampana = useCallback(async (campana: Campana): Promise<VersionarioCacheEntry> => {
    try {
      const [conArte, sinArte] = await Promise.all([
        campanasService.getInventarioConArte(campana.id).catch(() => []),
        campanasService.getInventarioSinArte(campana.id).catch(() => []),
      ]);
      const items = [...(conArte || []), ...(sinArte || [])];

      const allRsvIds = new Set<number>();
      for (const it of items) {
        String((it as any).rsv_id || (it as any).rsv_ids || '')
          .split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
          .forEach(n => allRsvIds.add(n));
      }

      const tieneDigitales = items.some(it => {
        const t = String((it as any).tipo_medio || (it as any).tradicional_digital || '').toLowerCase();
        return t.includes('digital');
      });

      const digitalFilesByReserva = new Map<number, string[]>();
      const notesByUrl = new Map<string, string>();
      if (tieneDigitales) {
        await Promise.all([...allRsvIds].map(async (rsvId) => {
          try {
            const imgs = await campanasService.getImagenesDigitales(campana.id, rsvId);
            const urls = imgs.map((im: any) => im.archivoData || im.archivo).filter((u: any): u is string => !!u);
            if (urls.length) digitalFilesByReserva.set(rsvId, urls);
            for (const im of imgs) {
              const url = (im as any).archivoData || (im as any).archivo;
              const comentario = ((im as any).comentario || '').trim();
              if (url && comentario) notesByUrl.set(url, comentario);
            }
          } catch { /* ignore */ }
        }));
      }

      await Promise.all([...allRsvIds].map(async (rsvId) => {
        try {
          const artes = await campanasService.getArtesTradicionales(campana.id, rsvId);
          for (const a of artes) {
            const nota = ((a as any).nota || '').trim();
            if ((a as any).archivo && nota) notesByUrl.set((a as any).archivo, nota);
          }
        } catch { /* ignore */ }
      }));

      return { campana, status: 'loaded', items, digitalFilesByReserva, notesByUrl };
    } catch {
      return { campana, status: 'error' };
    }
  }, []);

  // Recibe ids que el modal necesita ver y dispara fetch para los pending.
  // Idempotente: ya en curso o ya cargados se ignoran.
  const handleFetchVersionarioIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    // Identificar las que requieren fetch
    const toFetch: Campana[] = [];
    setVersionarioCache(prev => {
      const next = new Map(prev);
      for (const id of ids) {
        if (versionarioFetchingRef.current.has(id)) continue;
        const e = next.get(id);
        if (e && e.status === 'pending') {
          versionarioFetchingRef.current.add(id);
          next.set(id, { ...e, status: 'loading' });
          toFetch.push(e.campana);
        }
      }
      return next;
    });
    if (toFetch.length === 0) return;

    // Fetch en pool de 10 (paralelismo balanceado)
    const POOL = 10;
    for (let i = 0; i < toFetch.length; i += POOL) {
      if (versionarioCancelledRef.current) break;
      const batch = toFetch.slice(i, i + POOL);
      const results = await Promise.all(batch.map(c => fetchOneVersionarioCampana(c)));
      if (versionarioCancelledRef.current) break;
      setVersionarioCache(prev => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.campana.id, r);
          versionarioFetchingRef.current.delete(r.campana.id);
        }
        return next;
      });
    }
    // Cleanup de ids que pudieron quedar marcados (cancelado mid-flight)
    for (const c of toFetch) versionarioFetchingRef.current.delete(c.id);
  }, [fetchOneVersionarioCampana]);

  const handleExportVersionarioArtes = async () => {
    // Set único de campañas filtradas que están visibles en el Versionario.
    const campanasMap = new Map<number, Campana>();
    campanasPorCatorcena.forEach(g => g.campanas.forEach(c => {
      if (!campanasMap.has(c.id)) campanasMap.set(c.id, c);
    }));
    const campanasUnicas = [...campanasMap.values()];
    if (campanasUnicas.length === 0) return;

    // Modal abre INSTANTANEO con todas las campañas en estado 'pending'.
    // El modal pide fetch solo de las campañas visibles en su pagina actual.
    versionarioCancelledRef.current = false;
    versionarioFetchingRef.current = new Set();
    const initialCache = new Map<number, VersionarioCacheEntry>();
    for (const c of campanasUnicas) initialCache.set(c.id, { campana: c, status: 'pending' });
    setVersionarioCampanasList(campanasUnicas);
    setVersionarioCache(initialCache);
    setVersionarioPreviewOpen(true);
    setVersionarioArtesProgress({ current: 0, total: campanasUnicas.length });
  };

  // Disparado desde el modal preview cuando el usuario confirma descarga.
  // Si quedan campañas pendientes/loading, las fetcheamos primero (con progreso
  // en el boton "Generando Excel..."), luego construimos VersionarioArtesMultiArgs
  // y llamamos al exporter.
  const handleDownloadVersionarioFromPreview = async () => {
    if (versionarioCampanasList.length === 0) return;
    setVersionarioDownloading(true);
    try {
      // Asegurar todas las campañas cargadas
      const pendingIds = versionarioCampanasList
        .filter(c => {
          const e = versionarioCache.get(c.id);
          return !e || e.status !== 'loaded';
        })
        .map(c => c.id);
      if (pendingIds.length > 0) {
        await handleFetchVersionarioIds(pendingIds);
      }
      // Recolectar resultados de cache (solo loaded)
      // Esperamos un microtask para asegurar que el state ya se aplico
      // (handleFetchVersionarioIds hace setVersionarioCache; lo leemos del state actualizado).
      // Truco: usar setVersionarioCache para obtener la copia mas fresca.
      let finalCache: Map<number, VersionarioCacheEntry> = versionarioCache;
      setVersionarioCache(prev => { finalCache = prev; return prev; });
      const resultados: VersionarioArtesMultiArgs['campanas'] = [];
      for (const c of versionarioCampanasList) {
        const e = finalCache.get(c.id);
        if (e && e.status === 'loaded' && e.items) {
          resultados.push({
            campana: e.campana,
            items: e.items,
            digitalFilesByReserva: e.digitalFilesByReserva,
            notesByUrl: e.notesByUrl,
          });
        }
      }
      if (resultados.length === 0) {
        alert('No se pudo recuperar inventario de las campañas.');
        return;
      }
      await exportVersionarioArtesMulti({
        campanas: resultados,
        fileNameSuffix: `${resultados.length}_campanas`,
      });
    } finally {
      setVersionarioDownloading(false);
    }
  };

  const handleOpenCampana = (id: number) => {
    navigate(`/campanas/detail/${id}`);
  };

  const handleEditCampana = (campana: Campana) => {
    setSelectedCampana(campana);
    setEditModalOpen(true);
  };

  // Validar si el botón Editar debe estar deshabilitado
  const isEditDisabled = (campana: Campana): boolean => {
    const statusLower = campana.status?.toLowerCase() || '';
    const disabledStatuses = ['finalizado', 'sin cotizacion activa', 'cancelada', 'rechazada'];
    return disabledStatuses.includes(statusLower) || campana.has_aps === true;
  };

  // Callbacks estables para el `CampanaRow` memoizado. `useCallback` mantiene
  // la misma identidad entre renders del padre para que React.memo no aborte.
  const handleRowOpen = useCallback((id: number) => handleOpenCampana(id), [handleOpenCampana]);
  const handleRowShare = useCallback((propId: number) => navigate(`/propuestas/compartir/${propId}`), [navigate]);
  const handleRowEdit = useCallback((c: Campana) => handleEditCampana(c), [handleEditCampana]);
  const handleRowIncidencia = useCallback((c: Campana) => {
    setIncidenciaCampana(c);
    setIncidenciaModalOpen(true);
  }, []);
  const handleRowStatus = useCallback((c: Campana) => {
    setStatusCampana(c);
    setStatusModalOpen(true);
  }, []);

  const hayFiltroPeriodo = !!(catorcenaInicio && catorcenaFin && yearInicio && yearFin);

  // Wrapper que pasa props del row. La inversión total se extrae aquí (no
  // dentro del row) para que `React.memo` la reciba como prop simple y
  // detecte cuando cambia para esa campaña específica.
  const renderRow = (item: Campana, index: number) => {
    const invMap = inversionPorCatorcena[item.id];
    const invTotal = invMap?.['total'] !== undefined ? invMap['total'] : null;
    return (
      <CampanaRow
        key={`campana-${item.id}-${index}`}
        item={item}
        index={index}
        isDark={isDark}
        invTotal={invTotal}
        hayFiltroPeriodo={hayFiltroPeriodo}
        canEditPerm={permissions.canEditCampanas}
        canSeeGestionArtesPerm={permissions.canSeeGestionArtes}
        isEditDisabled={isEditDisabled(item)}
        onOpen={handleRowOpen}
        onShare={handleRowShare}
        onEdit={handleRowEdit}
        onIncidencia={handleRowIncidencia}
        onStatus={handleRowStatus}
      />
    );
  };

  // Calcular paginación basada en si hay filtros locales activos
  const hasLocalFilters = !!(selectedCatorcenaInicio || advancedFilters.length > 0 || status === 'Incompleta');
  const totalPages = hasLocalFilters || needsAllData ? 1 : (data?.pagination?.totalPages || 1);
  const total = hasLocalFilters || needsAllData ? filteredData.length : (data?.pagination?.total ?? 0);
  const startItem = hasLocalFilters || needsAllData ? (filteredData.length > 0 ? 1 : 0) : ((page - 1) * limit + 1);
  const endItem = hasLocalFilters || needsAllData ? filteredData.length : Math.min(page * limit, data?.pagination?.total ?? 0);

  return (
    <div className="min-h-screen">
      <Header title="Campañas" />

      <div className="p-6 space-y-5">
        {/* Dashboard KPIs Grid - Same style as Solicitudes/Propuestas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Main KPI: Total Campañas */}
          <div className={`col-span-1 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group`}>
            <div className={`absolute top-0 right-0 w-32 h-32 ${isDark ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 'bg-purple-200/20 group-hover:bg-purple-200/30'} rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-all duration-500`} />
            <div>
              <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm font-medium mb-1`}>Total Campañas</p>
              <h3 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                {isLoadingStats ? '...' : (effectiveStats?.total ?? 0).toLocaleString()}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50' : 'bg-gray-100 text-gray-700 border-gray-200'} border`}>
                {hasActiveFilters ? 'Filtrado' : 'Todas'}
              </span>
            </div>
          </div>

          {/* Chart Card: Status Distribution */}
          <div className={`col-span-1 md:col-span-2 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-4 flex items-center relative overflow-hidden`}>
            {!isLoadingStats && statusChartData.length > 0 ? (
              <div className="w-full h-[140px] flex items-center">
                <div className="h-full w-[140px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-status-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#18181b' : '#ffffff',
                          border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(229, 231, 235, 1)'}`,
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: isDark ? '#fff' : '#111827',
                          boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number, _name: string, props: { payload?: { name?: string } }) => [
                          `${value} campañas`,
                          props.payload?.name || ''
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend / List */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4 h-full overflow-y-auto scrollbar-thin auto-rows-min content-start">
                  {statusChartData.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border min-w-0`}>
                      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="min-w-0">
                        <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wide truncate`} title={item.name}>{item.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`w-full h-[140px] flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                {isLoadingStats ? 'Cargando...' : 'Sin datos'}
              </div>
            )}
          </div>

          {/* KPI: APS Status */}
          <div className={`col-span-1 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group`}>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div>
              <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm font-medium mb-1`}>Con APS</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-emerald-400">
                  {isLoadingStats ? '...' : (effectiveStats?.conAps ?? 0).toLocaleString()}
                </h3>
                <span className="text-xs text-emerald-500/80 font-medium">asignados</span>
              </div>
            </div>
            {/* Progress bar visual */}
            <div className={`mt-4 w-full h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} rounded-full overflow-hidden`}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${effectiveStats?.total ? ((effectiveStats.conAps / effectiveStats.total) * 100) : 0}%` }}
              />
            </div>
            <div className={`mt-2 flex justify-between text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <span>Sin APS: {effectiveStats?.sinAps ?? 0}</span>
              <span>{effectiveStats?.total ? Math.round((effectiveStats.conAps / effectiveStats.total) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'border-purple-200 bg-white'} backdrop-blur-xl p-4 relative z-30`}>
          <div className="flex flex-col gap-4">
            {/* Top Row: Search + Filter Toggle + Export */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search with Tags */}
              <div className={`relative flex-1 w-full lg:max-w-xl flex items-center flex-wrap gap-1.5 min-h-[44px] px-3 py-1.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/80 hover:border-purple-500/40' : 'border-purple-200 bg-gray-50 hover:border-gray-300'} focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500/40 transition-all`}>
                <Search className={`h-4 w-4 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                {searchTags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}
                  >
                    {tag}
                    <button
                      onClick={() => removeSearchTag(tag)}
                      className={`rounded-full p-0.5 transition-colors ${isDark ? 'hover:bg-purple-500/30' : 'hover:bg-purple-200'}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={searchTags.length === 0 ? 'Buscar campaña, articulo, cliente, código inventario... (Enter para agregar)' : 'Agregar filtro...'}
                  className={`flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === 'Tab') && searchInput.trim()) {
                      e.preventDefault();
                      addSearchTag(searchInput);
                    }
                    if (e.key === 'Backspace' && !searchInput && searchTags.length > 0) {
                      removeSearchTag(searchTags[searchTags.length - 1]);
                    }
                  }}
                />
                {searchTags.length > 0 && (
                  <button
                    onClick={() => { setSearchTags([]); setSearchInput(''); }}
                    className={`shrink-0 p-1 rounded-full transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                    title="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || hasActiveFilters
                  ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                  : isDark
                    ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
                    : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                  }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                )}
              </button>

              {/* Export CSV */}
              <button
                onClick={activeView === 'catorcena' ? handleExportVersionarioCSV : handleExportCSV}
                disabled={exportingLayout}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700'} border transition-all ${exportingLayout ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {exportingLayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportingLayout ? 'Generando...' : activeView === 'catorcena' ? 'Exportar Layout' : 'Exportar CSV'}
              </button>

              {/* Órdenes de Montaje */}
              {permissions.canSeeOrdenesMontajeButton && (
                <button
                  onClick={() => setOrdenesMontajeModalOpen(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'} border transition-all`}
                >
                  <ClipboardList className="h-4 w-4" />
                  Órdenes de Montaje
                </button>
              )}

              {/* Versionario Artes (sólo en tab Versionario) */}
              {activeView === 'catorcena' && permissions.canSeeOrdenesMontajeButton && (
                <button
                  onClick={handleExportVersionarioArtes}
                  disabled={exportingVersionarioArtes || campanasPorCatorcena.length === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'} border transition-all ${exportingVersionarioArtes ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Descargar Excel con versionario de artes (1 fila por campaña/plaza, columnas Arte 1..N)"
                >
                  {exportingVersionarioArtes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                  {exportingVersionarioArtes
                    ? `Procesando ${versionarioArtesProgress.current}/${versionarioArtesProgress.total}...`
                    : 'Versionario Artes'}
                </button>
              )}
            </div>

            {/* Filters Row (Expandable) */}
            {showFilters && (
              <div className={`flex flex-wrap items-center gap-2 pt-3 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'} relative z-50`}>
                {/* Advanced Filter Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      advancedFilters.length > 0
                        ? 'bg-purple-600 text-white'
                        : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700'
                    }`}
                    title="Filtros avanzados"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtrar</span>
                    {advancedFilters.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-800' : 'bg-purple-200'} text-[10px]`}>
                        {advancedFilters.length}
                      </span>
                    )}
                  </button>
                  {showAdvancedFilters && (
                    <div className={`absolute left-0 top-full mt-1 z-[100] w-[520px] ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-purple-500/30' : 'border-purple-200'} rounded-xl shadow-2xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Filtros avanzados</span>
                        <button
                          onClick={() => setShowAdvancedFilters(false)}
                          className={`${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-visible pr-1">
                        {advancedFilters.map((filter, index) => (
                          <div key={filter.id} className="flex items-center gap-2">
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const updated = [...advancedFilters];
                                  updated[index] = { ...updated[index], connector: updated[index].connector === 'Y' ? 'O' : 'Y' };
                                  setAdvancedFilters(updated);
                                }}
                                className={`text-[10px] font-bold w-8 rounded px-1 py-0.5 transition-colors ${filter.connector === 'O' ? (isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200') : (isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200')}`}
                                title={`Click para cambiar a ${filter.connector === 'Y' ? 'O' : 'Y'}`}
                              >
                                {filter.connector}
                              </button>
                            )}
                            {index === 0 && <span className="w-8"></span>}
                            <select
                              value={filter.field}
                              onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                              className={`w-[120px] text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                            >
                              {CAMPANA_FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className={`w-[100px] text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                            >
                              {FILTER_OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={filter.value}
                                placeholder="Escribir o seleccionar..."
                                onChange={(e) => {
                                  updateFilter(filter.id, { value: e.target.value });
                                  setComboboxOpen(filter.id);
                                }}
                                onClick={() => setComboboxOpen(filter.id)}
                                onFocus={() => setComboboxOpen(filter.id)}
                                onBlur={() => setTimeout(() => setComboboxOpen(null), 200)}
                                className={`w-full text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded px-2 py-1.5`}
                              />
                              {comboboxOpen === filter.id && (() => {
                                const allOptions = getUniqueFieldValues[filter.field] || [];
                                const filtered = filter.value
                                  ? allOptions.filter(val => val.toLowerCase().includes(filter.value.toLowerCase()))
                                  : allOptions;
                                return filtered.length > 0 ? (
                                  <div className={`absolute left-0 top-full mt-1 w-full max-h-[200px] overflow-y-auto z-[300] rounded border shadow-xl ${isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-gray-200'}`}>
                                    {filtered.map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          updateFilter(filter.id, { value: val });
                                          setComboboxOpen(null);
                                        }}
                                        className={`w-full text-left px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${isDark ? 'text-white hover:bg-purple-600/40' : 'text-gray-900 hover:bg-purple-50'} ${filter.value === val ? (isDark ? 'bg-purple-600/30 font-medium' : 'bg-purple-100 font-medium') : ''}`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            <button
                              onClick={() => removeFilter(filter.id)}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {advancedFilters.length === 0 && (
                          <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-4`}>
                            Sin filtros avanzados. Haz clic en "Añadir" para crear uno.
                          </p>
                        )}
                      </div>
                      <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                        <button
                          onClick={addFilter}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                        >
                          <Plus className="h-3 w-3" />
                          Añadir
                        </button>
                        <button
                          onClick={clearFilters}
                          disabled={advancedFilters.length === 0}
                          className={`px-3 py-1.5 text-xs font-medium ${isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30 border-red-500/30' : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'} border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
                        >
                          Limpiar
                        </button>
                      </div>
                      {advancedFilters.length > 0 && (
                        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            {filteredData.length} de {data?.data?.length || 0} registros
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'} mx-1`} />

                {/* Status Filter */}
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mr-1`}>Status:</span>
                <FilterChip
                  label="Status"
                  options={allStatuses}
                  value={status}
                  onChange={(val) => { setStatus(val); setPage(1); }}
                  onClear={() => { setStatus(''); setPage(1); }}
                  isDark={isDark}
                />

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'} mx-1`} />

                {/* Tipo Periodo Filter */}
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mr-1`}>Periodo:</span>
                <FilterChip
                  label="Tipo Periodo"
                  options={['catorcena', 'mensual']}
                  value={tipoPeriodo}
                  onChange={(val) => { setTipoPeriodo(val); setPage(1); }}
                  onClear={() => { setTipoPeriodo(''); setPage(1); }}
                  isDark={isDark}
                />

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'} mx-1`} />

                {/* Current Catorcena Indicator */}
                {currentCatorcena && (
                  <>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} border text-xs`}>
                      <Clock className="h-3 w-3" />
                      <span>Actual: Cat. {currentCatorcena.numero_catorcena} / {currentCatorcena.a_o}</span>
                    </div>
                    <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'} mx-1`} />
                  </>
                )}

                {/* Period Filter */}
                <PeriodFilterPopover
                  catorcenasData={catorcenasData}
                  yearInicio={yearInicio}
                  yearFin={yearFin}
                  catorcenaInicio={catorcenaInicio}
                  catorcenaFin={catorcenaFin}
                  onApply={(yi, yf, ci, cf) => {
                    setYearInicio(yi);
                    setYearFin(yf);
                    setCatorcenaInicio(ci);
                    setCatorcenaFin(cf);
                    setPage(1);
                  }}
                  onClear={() => {
                    setYearInicio(undefined);
                    setYearFin(undefined);
                    setCatorcenaInicio(undefined);
                    setCatorcenaFin(undefined);
                    setPage(1);
                  }}
                  isDark={isDark}
                />

                {/* Historial Filter (cambios de estatus / creacion por fecha) */}
                <HistorialFilterPopover
                  values={historialFilter}
                  isDark={isDark}
                  onApply={(v) => { setHistorialFilter(v); setPage(1); }}
                  onClear={() => { setHistorialFilter({}); setPage(1); }}
                />

                {/* Divider */}
                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-300'} mx-1`} />

                {/* Sort Options */}
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mr-1`}>
                  <ArrowUpDown className="h-3 w-3 inline mr-1" />
                  Ordenar:
                </span>
                <FilterChip
                  label="Campo"
                  options={['fecha_inicio', 'nombre', 'cliente_nombre', 'status']}
                  value={sortField || ''}
                  onChange={(val) => { setSortField(val); setPage(1); }}
                  onClear={() => { setSortField(null); setPage(1); }}
                  isDark={isDark}
                />
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isDark ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300'} border transition-all`}
                >
                  {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>

                {/* Divider */}
                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-300'} mx-1`} />

                {/* Group By */}
                <FilterChip
                  label="Agrupar"
                  options={['status', 'cliente_nombre', 'catorcena_inicio']}
                  value={activeGroupings[0] || ''}
                  onChange={(val) => { setActiveGroupings([val as GroupByField]); setExpandedGroups(new Set()); }}
                  onClear={() => { setActiveGroupings([]); setExpandedGroups(new Set()); }}
                  isDark={isDark}
                />

                {/* Clear All */}
                {hasActiveFilters && (
                  <>
                    <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-300'} mx-1`} />
                    <button
                      onClick={clearAllFilters}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isDark ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'} border transition-all`}
                    >
                      <X className="h-3 w-3" />
                      Limpiar todo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs de vista */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveView('tabla');
              // Limpiar agrupaciones del versionario al volver a tabla
              setActiveGroupings([]);
              setExpandedGroups(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'tabla'
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDark ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            <List className="h-4 w-4" />
            Vista Tabla
          </button>
          <button
            onClick={() => {
              setActiveView('catorcena');
              // Al cambiar a vista catorcena, agregar catorcena_inicio como primera agrupación si no está
              if (!activeGroupings.includes('catorcena_inicio')) {
                setActiveGroupings(prev => ['catorcena_inicio', ...prev.filter(g => g !== 'catorcena_inicio')].slice(0, 2) as GroupByField[]);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'catorcena'
                ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDark ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Versionario
          </button>
        </div>

        {/* Info Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'} text-xs`}>
              <Filter className="h-3.5 w-3.5" />
              {filteredData.length} resultados
              {activeGroupings.length > 0 && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                  | Agrupado por {activeGroupings.map(g => AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' → ')}
                </span>
              )}
              {sortField && (
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>| Ordenado por {SORT_FIELDS.find(f => f.field === sortField)?.label} ({sortDirection === 'asc' ? '↑' : '↓'})</span>
              )}
            </div>
          </div>
        )}

        {/* Vista de Tabla */}
        {activeView === 'tabla' && (
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 shadow-xl shadow-purple-500/5' : 'border-purple-200 bg-white shadow-lg shadow-purple-100/30'} backdrop-blur-xl overflow-hidden`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              {/* Pagination (top) */}
              {activeGroupings.length === 0 && data?.pagination && totalPages > 1 && (
                <div className={`flex items-center justify-between border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20' : 'border-purple-200 bg-purple-50/50'} px-4 py-3`}>
                  <span className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600/70'}`}>
                    Página <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{page}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{totalPages}</span>
                    <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-500/50'} ml-2`}>({total} total)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30' : 'border-purple-200 bg-purple-50'}`}>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>ID</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Periodo</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Creador</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Campaña</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Marca</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Estatus</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Actividad</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Fecha Inicio</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Fecha Fin</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Inversión</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>APS</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wider`}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData ? (
                      groupedData.map((group) => (
                        <React.Fragment key={`group-${group.name}`}>
                          {/* Level 1 Header */}
                          <GroupHeader
                            groupName={group.name}
                            count={group.items.length}
                            expanded={expandedGroups.has(group.name)}
                            onToggle={() => toggleGroup(group.name)}
                            colSpan={11}
                          />
                          {/* Level 1 Content */}
                          {expandedGroups.has(group.name) && (
                            group.subgroups ? (
                              // Has subgroups (2 level grouping)
                              group.subgroups.map((subgroup) => (
                                <React.Fragment key={`subgroup-${group.name}-${subgroup.name}`}>
                                  {/* Level 2 Header */}
                                  <tr
                                    onClick={() => toggleGroup(`${group.name}|${subgroup.name}`)}
                                    className={`${isDark ? 'bg-fuchsia-500/5 border-b border-fuchsia-500/10 hover:bg-fuchsia-500/10' : 'bg-fuchsia-50 border-b border-fuchsia-200 hover:bg-fuchsia-100'} cursor-pointer transition-colors`}
                                  >
                                    <td colSpan={11} className="px-4 py-2.5 pl-10">
                                      <div className="flex items-center gap-2">
                                        {expandedGroups.has(`${group.name}|${subgroup.name}`) ? (
                                          <ChevronDown className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                                        ) : (
                                          <ChevronRight className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                                        )}
                                        <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-700'} text-sm`}>{subgroup.name || 'Sin asignar'}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                                          {subgroup.items.length} campañas
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Level 2 Content */}
                                  {expandedGroups.has(`${group.name}|${subgroup.name}`) &&
                                    subgroup.items.map((item, idx) => renderRow(item, idx))
                                  }
                                </React.Fragment>
                              ))
                            ) : (
                              // No subgroups (1 level grouping)
                              group.items.map((item, idx) => renderRow(item, idx))
                            )
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderRow(item, idx))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                              <Megaphone className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                            </div>
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>No se encontraron campañas</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {activeGroupings.length === 0 && data?.pagination && totalPages > 1 && (
                <div className={`flex items-center justify-between border-t ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20' : 'border-purple-200 bg-purple-50/50'} px-4 py-3`}>
                  <span className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-purple-600/70'}`}>
                    Página <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{page}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{totalPages}</span>
                    <span className={`${isDark ? 'text-purple-300/50' : 'text-purple-500/50'} ml-2`}>({total} total)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-4 py-2 rounded-lg border ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300'} text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* Grouped data info */}
              {activeGroupings.length > 0 && (
                <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    Mostrando {filteredData.length} campañas agrupadas por {activeGroupings.map(g => AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' → ')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        )}

        {/* Vista por Catorcena */}
        {activeView === 'catorcena' && (
          <div className={`rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm overflow-hidden`}>
            {/* Header de la vista */}
            <div className={`px-5 py-4 border-b ${isDark ? 'border-zinc-800/50 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20' : 'border-gray-200 bg-purple-50/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} flex items-center justify-center`}>
                    <Calendar className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Vista por Catorcena</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Campañas agrupadas por periodo de inicio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{campanasPorCatorcena.length}</p>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide`}>Catorcenas</p>
                  </div>
                  <div className={`w-px h-10 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{uniqueCampsInCatorcenaView}</p>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide`}>Campañas</p>
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : campanasPorCatorcena.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} mb-4`}>
                  <Calendar className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
                <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>No hay campañas agrupadas por catorcena</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? 'divide-zinc-800/30' : 'divide-gray-200'}`}>
                {campanasPorCatorcena.map(({ key, catorcena, campanas, subgroups }) => {
                  const isCurrentCatorcena = currentCatorcena &&
                    currentCatorcena.numero_catorcena === catorcena.num &&
                    currentCatorcena.a_o === catorcena.anio;
                  const secondGroupingLabel = activeGroupings[0] === 'catorcena_inicio' && activeGroupings.length > 1
                    ? AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label
                    : null;

                  // Función para renderizar una campaña
                  const renderCampana = (campana: Campana, indent: number = 0) => {
                    const statusColor = getStatusColor(campana.status, isDark);
                    const periodStatus = getPeriodStatus(campana.fecha_inicio, campana.fecha_fin);
                    const PERIOD_COLORS_LOCAL = getPeriodColors(isDark);
                    const periodColor = PERIOD_COLORS_LOCAL[periodStatus] || getDefaultStatusColor(isDark);
                    const isExpanded = expandedCampanas.has(campana.id);
                    const allInventarios = campanaInventarios[campana.id] || [];
                    // Filtrar inventarios por la catorcena del grupo actual (match exacto + overlap de fechas)
                    let inventarios = allInventarios.filter(inv => itemMatchesCatorcena(inv, catorcena.num, catorcena.anio));
                    // Filtrar inventarios por los términos de búsqueda (codigo_unico)
                    const isSearchingInventario = allSearchTerms.length > 0 && allSearchTerms.some(term => {
                      // Detectar si algún término parece código de inventario (busca en inventarios cargados)
                      const lt = term.toLowerCase();
                      return (campanaInventarios[campana.id] || []).some(inv => inv.codigo_unico?.toLowerCase().includes(lt));
                    });
                    if (allSearchTerms.length > 0) {
                      const matchingInv = inventarios.filter(inv =>
                        allSearchTerms.some(term => inv.codigo_unico?.toLowerCase().includes(term.toLowerCase()))
                      );
                      if (matchingInv.length > 0) {
                        inventarios = matchingInv;
                      } else if (isSearchingInventario && allInventarios.length > 0) {
                        // Si estamos buscando por código de inventario y esta campaña tiene inventarios
                        // pero ninguno coincide en esta catorcena, ocultar la campaña en este grupo
                        return null;
                      }
                    }
                    // También filtrar inventarios con filtros configurables de codigos_inventario
                    const invFilters = advancedFilters.filter(f => f.field === 'codigos_inventario' && f.value);
                    if (invFilters.length > 0 && inventarios.length > 0) {
                      const matchingInv = inventarios.filter(inv => {
                        const code = inv.codigo_unico?.toLowerCase() || '';
                        return invFilters.some(f => {
                          const fv = f.value.toLowerCase();
                          switch (f.operator) {
                            case '=': return code === fv;
                            case 'contains': return code.includes(fv);
                            default: return false;
                          }
                        });
                      });
                      if (matchingInv.length > 0) {
                        inventarios = matchingInv;
                      }
                    }
                    const isLoadingInv = loadingInventarios.has(campana.id);
                    const apsAgrupados = getInventarioAgrupadoPorAPS(inventarios);
                    const hasInventarios = allInventarios.length > 0;

                    // Nota: no ocultar campañas sin inventario en esta catorcena — el backend ya filtró por overlap

                    return (
                      <div key={campana.id} className={`border-t ${isDark ? 'border-zinc-800/30' : 'border-gray-200'}`}>
                        <button
                          onClick={() => toggleCampana(campana.id)}
                          className={`w-full flex items-center gap-3 px-6 py-3 ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'} transition-all`}
                          style={{ paddingLeft: `${24 + indent * 16}px` }}
                        >
                          {isLoadingInv ? (
                            <Loader2 className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'} animate-spin`} />
                          ) : isExpanded ? (
                            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                          ) : (
                            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                          )}
                          <Megaphone className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'} text-sm flex-1 text-left truncate`}>
                            {campana.nombre}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodColor.bg} ${periodColor.text} border ${periodColor.border}`}>
                            {periodStatus}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusCampana(campana);
                              setStatusModalOpen(true);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border} hover:opacity-80 transition-opacity cursor-pointer`}
                          >
                            {campana.status}
                          </span>
                          {campana.has_aps ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} border border-emerald-500/30 flex items-center gap-1`}>
                              <Check className="h-3 w-3" /> APS
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' : 'bg-gray-100 text-gray-500 border-gray-300'} border flex items-center gap-1`}>
                              <Minus className="h-3 w-3" /> Sin APS
                            </span>
                          )}
                          {/* Resumen de campaña: circuitos (grupos), bonificación, inversión */}
                          {!hasInventarios && isLoadingInv && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-zinc-500/15 text-zinc-400' : 'bg-gray-100 text-gray-400'} border border-zinc-500/25 flex items-center gap-1`}>
                              <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                            </span>
                          )}
                          {(() => {
                            // Contar circuitos desde inventarios filtrados por catorcena
                            const circuitosDesdeGrupos = apsAgrupados.reduce((sum, apsGroup) => sum + apsGroup.grupos.length, 0);
                            const circuitosCount = hasInventarios ? circuitosDesdeGrupos : null;
                            return circuitosCount !== null ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25 flex items-center gap-1`} title="Circuitos (grupos)">
                                <Layers className="h-3 w-3" /> Circuitos {circuitosCount}
                              </span>
                            ) : null;
                          })()}
                          {hasInventarios && (() => {
                            const bonifCatorcena = inventarios.filter(i => Number((i as any).bonificacion_sc) > 0 || (Number((i as any).tarifa_publica_sc) === 0 && Number((i as any).aps) > 0)).length;
                            return bonifCatorcena > 0 ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'} border border-amber-500/25 flex items-center gap-1`} title="Bonificación">
                                <Gift className="h-3 w-3" /> {bonifCatorcena}
                              </span>
                            ) : null;
                          })()}
                          {hasInventarios && (() => {
                            const carasCatorcena = inventarios.length;
                            const bonifCatorcenaCalc = inventarios.filter(i => Number((i as any).tarifa_publica_sc) === 0 || Number((i as any).bonificacion_sc) > 0).length;
                            const carasNetas = Math.max(carasCatorcena - bonifCatorcenaCalc, 0);
                            return carasNetas > 0 ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25 flex items-center gap-1`} title="Caras rentadas sin bonificación">
                                <MapPin className="h-3 w-3" /> {carasNetas}
                              </span>
                            ) : null;
                          })()}
                          {(() => {
                            // Inversión específica de esta catorcena (sc.costo). Si el batch cargó y no hay
                            // valor para este catKey, la campaña no tiene caras aquí → 0.
                            const catKey = `${catorcena.num}:${catorcena.anio}`;
                            const invData = inversionPorCatorcena[campana.id];
                            const invCampana = invData !== undefined
                              ? (invData[catKey] || 0)
                              : (Number((campana as any).inversion) || 0);
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'} border border-green-500/25 flex items-center gap-1`} title="Inversión de la catorcena">
                                <DollarSign className="h-3 w-3" /> {invCampana > 0 ? invCampana.toLocaleString() : 'Sin inversión'}
                              </span>
                            );
                          })()}
                          <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenCampana(campana.id)}
                              className={`p-1.5 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200'} border transition-all`}
                              title="Ver campaña"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            {campana.propuesta_id && (
                              <button
                                onClick={() => navigate(`/propuestas/compartir/${campana.propuesta_id}`)}
                                className={`p-1.5 rounded-lg ${isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/20' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border-cyan-200'} border transition-all`}
                                title="Compartir campaña"
                              >
                                <Share2 className="h-3 w-3" />
                              </button>
                            )}
                            {permissions.canEditCampanas && (
                              <button
                                onClick={() => handleEditCampana(campana)}
                                disabled={isEditDisabled(campana)}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  isEditDisabled(campana)
                                    ? isDark ? 'bg-zinc-800/30 text-zinc-600 border-zinc-700/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : isDark ? 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border-zinc-500/20' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'
                                }`}
                                title={isEditDisabled(campana) ? 'No editable' : 'Editar campaña'}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </button>
                        {/* Contenido expandible - inventario */}
                        {isExpanded && (
                          <div className={`${isDark ? 'bg-zinc-950/50' : 'bg-gray-50'} px-8 py-3`} style={{ marginLeft: `${indent * 16}px` }}>
                            {isLoadingInv ? (
                              <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando inventario...
                              </div>
                            ) : inventarios.length === 0 ? (
                              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>No hay inventario con APS</p>
                            ) : (
                              <div className="space-y-2">
                                {apsAgrupados.map(apsGroup => {
                                  const apsKey = `${campana.id}-${apsGroup.aps ?? 'sin-aps'}`;
                                  const isAPSExpanded = expandedAPS.has(apsKey);
                                  return (
                                    <div key={apsGroup.aps ?? 'sin-aps'} className={`border ${isDark ? 'border-zinc-800/50' : 'border-gray-200'} rounded-lg overflow-hidden`}>
                                      <button
                                        onClick={() => toggleAPS(campana.id, apsGroup.aps)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-zinc-800/30 hover:bg-zinc-800/50' : 'bg-gray-100 hover:bg-gray-200'} transition-all`}
                                      >
                                        {isAPSExpanded ? <ChevronDown className={`h-3 w-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} /> : <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />}
                                        <Package className={`h-3 w-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                        <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{apsGroup.aps ? `APS ${apsGroup.aps}` : 'Sin APS'}</span>
                                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{apsGroup.totalItems} ubicaciones</span>
                                      </button>
                                      {isAPSExpanded && (
                                        <div className={`px-3 py-2 space-y-1 ${isDark ? 'bg-zinc-900/50' : 'bg-white'}`}>
                                          {apsGroup.grupos.map(grupo => {
                                            const grupoKey = `${apsKey}-${grupo.key}`;
                                            const isGrupoExpanded = expandedGrupos.has(grupoKey);
                                            // Calcular estatus de arte predominante del grupo
                                            const estatusCount: Record<string, number> = {};
                                            grupo.items.forEach(inv => {
                                              const estatus = (inv as any).estatus_arte || 'Sin estatus';
                                              estatusCount[estatus] = (estatusCount[estatus] || 0) + 1;
                                            });
                                            const estatusPredominante = Object.entries(estatusCount).sort((a, b) => b[1] - a[1])[0];
                                            const estatusGrupoColor = estatusPredominante ? getEstatusArteColor(estatusPredominante[0], isDark) : getDefaultStatusColor(isDark);
                                            return (
                                              <div key={grupo.key} className={`border-l-2 ${isDark ? 'border-zinc-700' : 'border-gray-300'} pl-2`}>
                                                <div
                                                  onClick={() => toggleGrupo(campana.id, apsGroup.aps, grupo.key)}
                                                  className={`w-full flex items-center gap-2 py-1 text-left ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'} rounded px-1 flex-wrap cursor-pointer`}
                                                >
                                                  {isGrupoExpanded ? <ChevronDown className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} /> : <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />}
                                                  <ClipboardList className={`h-3 w-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                                  <span className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                                    {[
                                                      (grupo.items[0] as any)?.formato,
                                                      grupo.items[0]?.plaza,
                                                      grupo.items[0]?.articulo
                                                    ].filter(Boolean).join(' · ') || grupo.key}
                                                  </span>
                                                  <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>({grupo.items.length} caras)</span>
                                                  {/* 5 iconos de etapas de Gestión de Artes */}
                                                  {(() => {
                                                    const total = grupo.items.length;
                                                    const flujoOrder = ['Carga Artes', 'Revision Artes', 'Artes Aprobados', 'En Impresion', 'Artes Recibidos', 'Instalado'];
                                                    const getStageIndex = (estatus: string | null | undefined) => {
                                                      const idx = flujoOrder.indexOf(estatus || 'Carga Artes');
                                                      return idx >= 0 ? idx : 0;
                                                    };
                                                    const countAtOrPast = (minStage: number) => grupo.items.filter(i => getStageIndex((i as any).estatus_arte) >= minStage).length;
                                                    // Determinar tipo del grupo (siempre homogéneo)
                                                    const isDigital = grupo.items[0]?.tradicional_digital === 'Digital';
                                                    const getIconColor = (done: number) => {
                                                      if (done === total) return 'text-green-400';
                                                      if (done > 0) return 'text-amber-400';
                                                      return isDark ? 'text-zinc-600' : 'text-gray-300';
                                                    };
                                                    const tabs = [
                                                      { icon: Upload, label: 'Subir Artes', done: countAtOrPast(1) },
                                                      { icon: Eye, label: 'Revisar y Aprobar', done: countAtOrPast(2) },
                                                      ...(isDigital
                                                        ? [{ icon: Monitor, label: 'Programación', done: countAtOrPast(3) }]
                                                        : [{ icon: Printer, label: 'Impresiones', done: countAtOrPast(3) }]
                                                      ),
                                                      { icon: Camera, label: 'Validar Instalación', done: countAtOrPast(5) },
                                                    ];
                                                    return (
                                                      <span className={`inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-800/60 border-zinc-700/40' : 'bg-gray-100 border-gray-200'} border`}>
                                                        {tabs.map(({ icon: Icon, label, done }, idx) => (
                                                          <React.Fragment key={label}>
                                                            {idx > 0 && <span className={`w-px h-3 ${isDark ? 'bg-zinc-700/60' : 'bg-gray-300'}`} />}
                                                            <span title={`${label}: ${done}/${total}`}>
                                                              <Icon className={`h-3.5 w-3.5 ${getIconColor(done)}`} />
                                                            </span>
                                                          </React.Fragment>
                                                        ))}
                                                      </span>
                                                    );
                                                  })()}
                                                  {estatusPredominante && estatusPredominante[0] !== 'Sin estatus' && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${estatusGrupoColor.bg} ${estatusGrupoColor.text} border ${estatusGrupoColor.border}`}>
                                                      {estatusPredominante[0]}
                                                    </span>
                                                  )}
                                                  {(() => {
                                                    const plazas = [...new Set(grupo.items.map(i => i.plaza).filter(Boolean))];
                                                    const formato = (grupo.items[0] as any)?.formato || null;
                                                    const carasTotales = grupo.items.length;
                                                    const tarifasGrupo = grupo.items
                                                      .map(i => Number((i as any).tarifa_publica_sc) || 0)
                                                      .filter(v => v > 0);
                                                    // Tarifa: valor publico por cara (normalmente constante por grupo).
                                                    const tarifaPublica = tarifasGrupo.length > 0 ? tarifasGrupo[0] : 0;
                                                    // bonificacion_sc viene repetida por fila en algunos inventarios.
                                                    // Para evitar inflar (ej. 50 filas x 50 = 2500), usar el valor de campaña;
                                                    // si no existe, tomar el mayor valor reportado en el grupo.
                                                    const bonifCampana = Number(campana.bonificacion) || 0;
                                                    const bonifGrupoFallback = grupo.items.reduce((max, i) => {
                                                      const val = Number((i as any).bonificacion_sc) || 0;
                                                      return val > max ? val : max;
                                                    }, 0);
                                                    const sumBonif = Math.min(carasTotales, (bonifCampana > 0 ? bonifCampana : bonifGrupoFallback));
                                                    const sumNormales = Math.max(carasTotales - sumBonif, 0);
                                                    // Inversion: usar renta (sc.costo) si está disponible, sino tarifa × caras
                                                    const rentaGrupo = Number((grupo.items[0] as any)?.renta) || 0;
                                                    const inversionTotal = rentaGrupo > 0 ? rentaGrupo : (tarifaPublica * sumNormales);
                                                    const artesSubidos = grupo.items.filter(i => i.archivo != null && i.archivo !== '').length;
                                                    return (
                                                      <>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25 flex items-center gap-1`} title="Caras totales">
                                                          <Hash className="h-2.5 w-2.5" /> {carasTotales} caras
                                                        </span>
                                                        {plazas.length > 0 && (
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25 flex items-center gap-1`} title="Plaza(s)">
                                                            <MapPin className="h-2.5 w-2.5" /> {plazas.join(', ')}
                                                          </span>
                                                        )}
                                                        {formato && (
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'} border border-violet-500/25`} title="Formato">
                                                            {formato}
                                                          </span>
                                                        )}
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'} border border-blue-500/25`} title="Tarifa pública">
                                                          {tarifaPublica > 0 ? <>Tarifa: {'$'}{tarifaPublica.toLocaleString()}</> : 'Sin tarifa'}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} border border-emerald-500/25`} title="Inversión total (tarifa)">
                                                          {inversionTotal > 0 ? <>Inversión: {'$'}{inversionTotal.toLocaleString()}</> : 'Sin inversión'}
                                                        </span>
                                                        {sumBonif > 0 && (
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'} border border-amber-500/25`} title="Bonificación">
                                                            Bonif: {sumBonif}
                                                          </span>
                                                        )}
                                                        {sumNormales > 0 && (
                                                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} border border-cyan-500/25 flex items-center gap-1`} title="Caras rentadas sin bonificación">
                                                            <MapPin className="h-2.5 w-2.5" /> {sumNormales}
                                                          </span>
                                                        )}
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'} border border-indigo-500/25 flex items-center gap-1`} title="Artes subidos">
                                                          <Image className="h-2.5 w-2.5" /> {artesSubidos}/{carasTotales}
                                                        </span>
                                                      </>
                                                    );
                                                  })()}
                                                  {/* Badge incompleto / exceso */}
                                                  {(() => {
                                                    const sc = campanaCaras[campana.id]?.find(s => s.id === grupo.grupoId);
                                                    if (!sc) return null;
                                                    const esperadas = (sc.caras || 0) + (Number(sc.bonificacion) || 0);
                                                    if (esperadas <= 0) return null;
                                                    const actuales = grupo.items.reduce((sum, i) => sum + (i.caras_totales || 1), 0);
                                                    if (actuales > esperadas) return (
                                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 flex-shrink-0" title={`Exceso: ${actuales}/${esperadas} caras`}>
                                                        <AlertTriangle className="h-2.5 w-2.5" />+{actuales - esperadas}
                                                      </span>
                                                    );
                                                    if (actuales < esperadas) return (
                                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 flex-shrink-0" title={`Incompleto: ${actuales}/${esperadas} caras`}>
                                                        <AlertTriangle className="h-2.5 w-2.5" />{actuales}/{esperadas}
                                                      </span>
                                                    );
                                                    return null;
                                                  })()}
                                                  <span
                                                    className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/40' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'} border border-purple-500/30 flex items-center gap-1 cursor-pointer transition-all flex-shrink-0`}
                                                    title="Ver galería de artes"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const grupoLabel = [
                                                        (grupo.items[0] as any)?.formato,
                                                        grupo.items[0]?.plaza,
                                                        grupo.items[0]?.articulo
                                                      ].filter(Boolean).join(' · ') || grupo.key;
                                                      openArtGallery(campana.id, grupo.items, `Galería de Artes - ${grupoLabel}`);
                                                    }}
                                                  >
                                                    <Eye className="h-2.5 w-2.5" /> Ver Artes
                                                  </span>
                                                </div>
                                                {isGrupoExpanded && (
                                                  <div className="pl-5 py-1 space-y-0.5">
                                                    {/* Mini galería de artes del grupo (deduplicada por URL del arte).
                                                        Si N ubicaciones comparten el mismo archivo, solo se muestra UNA
                                                        miniatura con un badge "×N" para no inundar la UI con copias
                                                        identicas (ej. campanas con 100 ubicaciones y un mismo arte).
                                                        Si una reserva tiene varios artes (artes_detalle con spot 1, 2, ...),
                                                        cada uno aparece como miniatura independiente. */}
                                                    {(() => {
                                                      const itemsConArte = grupo.items.filter(i => {
                                                        if (i.archivo != null && i.archivo !== '') return true;
                                                        const raw = (i as any).artes_detalle;
                                                        return typeof raw === 'string' && raw.length > 2;
                                                      });
                                                      if (itemsConArte.length === 0) return null;
                                                      const grupoLabel = [
                                                        (grupo.items[0] as any)?.formato,
                                                        grupo.items[0]?.plaza,
                                                        grupo.items[0]?.articulo,
                                                      ].filter(Boolean).join(' · ') || grupo.key;
                                                      // Expandir cada item en sus artes (uno por spot) y agrupar por URL.
                                                      const porArchivo = new Map<string, typeof itemsConArte>();
                                                      for (const inv of itemsConArte) {
                                                        const urls = new Set<string>();
                                                        const raw = (inv as any).artes_detalle as string | null | undefined;
                                                        if (raw) {
                                                          try {
                                                            const parsed = JSON.parse(raw);
                                                            if (Array.isArray(parsed)) {
                                                              parsed.forEach((a: any) => { if (a?.archivo) urls.add(String(a.archivo)); });
                                                            }
                                                          } catch { /* ignore */ }
                                                        }
                                                        if (urls.size === 0 && inv.archivo) urls.add(String(inv.archivo));
                                                        for (const url of urls) {
                                                          const arr = porArchivo.get(url) || [];
                                                          arr.push(inv);
                                                          porArchivo.set(url, arr);
                                                        }
                                                      }
                                                      const artesUnicos = Array.from(porArchivo.entries()).map(([url, items]) => ({ url, items, count: items.length }));
                                                      return (
                                                        <div className={`flex items-center gap-2 overflow-x-auto py-2 px-1 mb-2 ${isDark ? 'bg-zinc-900/40' : 'bg-gray-50'} rounded`}>
                                                          {artesUnicos.map(({ url, items, count }) => {
                                                            const first = items[0];
                                                            const tip = count > 1
                                                              ? `${count} ubicaciones con este arte`
                                                              : `${first.codigo_unico || ''}${first.plaza ? ` · ${first.plaza}` : ''}`;
                                                            return (
                                                              <button
                                                                key={`thumb-${url}`}
                                                                type="button"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  openArtGallery(campana.id, itemsConArte, `Galería de Artes - ${grupoLabel}`);
                                                                }}
                                                                className={`flex-shrink-0 relative rounded overflow-hidden border transition-all hover:scale-105 ${isDark ? 'border-zinc-700 hover:border-purple-500' : 'border-gray-300 hover:border-purple-500'}`}
                                                                title={tip}
                                                              >
                                                                <img
                                                                  src={url}
                                                                  alt={first.codigo_unico || 'arte'}
                                                                  className="h-20 w-28 object-cover"
                                                                  loading="lazy"
                                                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                                {count > 1 && (
                                                                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-600/90 text-white shadow">
                                                                    ×{count}
                                                                  </span>
                                                                )}
                                                              </button>
                                                            );
                                                          })}
                                                        </div>
                                                      );
                                                    })()}
                                                    {/* Resumen del grupo */}
                                                    {(() => {
                                                      // Indicaciones de programación/instalación del grupo
                                                      const conIndicacionesProg = grupo.items.filter(i => (i as any).indicaciones_programacion).length;
                                                      const conIndicacionesInst = grupo.items.filter(i => (i as any).indicaciones_instalacion).length;
                                                      return (
                                                        <div className={`flex flex-wrap items-center gap-2 py-1.5 px-1 mb-1 border-b ${isDark ? 'border-zinc-800/40' : 'border-gray-200'}`}>
                                                          {conIndicacionesProg > 0 && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-700'} border border-orange-500/25 flex items-center gap-1`} title="Con indicaciones de programación">
                                                              <FileText className="h-2.5 w-2.5" /> Prog: {conIndicacionesProg}
                                                            </span>
                                                          )}
                                                          {conIndicacionesInst > 0 && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'} border border-rose-500/25 flex items-center gap-1`} title="Con indicaciones de instalación">
                                                              <FileText className="h-2.5 w-2.5" /> Inst: {conIndicacionesInst}
                                                            </span>
                                                          )}
                                                        </div>
                                                      );
                                                    })()}
                                                    {grupo.items.map(inv => {
                                                      const estatusArteColor = getEstatusArteColor((inv as any).estatus_arte, isDark);
                                                      const hasArte = inv.archivo != null && inv.archivo !== '';
                                                      const rawProg = (inv as any).indicaciones_programacion;
                                                      const indicacionesProg = typeof rawProg === 'string' ? rawProg : (rawProg && typeof rawProg === 'object' ? Object.values(rawProg).filter(Boolean).join(' | ') : null);
                                                      const rawInst = (inv as any).indicaciones_instalacion;
                                                      const indicacionesInst = typeof rawInst === 'string' ? rawInst : (rawInst && typeof rawInst === 'object' ? Object.values(rawInst).filter(Boolean).join(' | ') : null);
                                                      return (
                                                        <div key={inv.id} className={`flex items-center gap-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} py-0.5 flex-wrap`}>
                                                          <MapPin className={`h-2.5 w-2.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                                                          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{inv.codigo_unico}</span>
                                                          <span
                                                            title={hasArte ? 'Ver arte' : 'Sin arte'}
                                                            className={`flex items-center gap-0.5 ${hasArte ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                            onClick={() => {
                                                              if (hasArte) {
                                                                openArtGallery(campana.id, [inv], `Arte - ${inv.codigo_unico}`);
                                                              }
                                                            }}
                                                          >
                                                            <Image className={`h-2.5 w-2.5 ${hasArte ? 'text-green-400' : isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                                                            {hasArte && <span className="text-green-400/70">Arte</span>}
                                                          </span>
                                                          {(inv as any).estatus_arte && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${estatusArteColor.bg} ${estatusArteColor.text} border ${estatusArteColor.border}`}>
                                                              {(inv as any).estatus_arte}
                                                            </span>
                                                          )}
                                                          <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>•</span>
                                                          <span>{inv.plaza || 'Sin plaza'}</span>
                                                          {indicacionesProg && (
                                                            <>
                                                              <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>•</span>
                                                              <span className={`${isDark ? 'text-orange-300/80' : 'text-orange-600'} flex items-center gap-0.5`} title="Indicaciones de programación">
                                                                <FileText className="h-2.5 w-2.5" /> Prog: {indicacionesProg}
                                                              </span>
                                                            </>
                                                          )}
                                                          {indicacionesInst && (
                                                            <>
                                                              <span className={isDark ? 'text-zinc-600' : 'text-gray-300'}>•</span>
                                                              <span className={`${isDark ? 'text-rose-300/80' : 'text-rose-600'} flex items-center gap-0.5`} title="Indicaciones de instalación">
                                                                <FileText className="h-2.5 w-2.5" /> Inst: {indicacionesInst}
                                                              </span>
                                                            </>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                  <div key={key} className="group">
                    {/* Header de Catorcena */}
                    <button
                      onClick={() => toggleCatorcena(key)}
                      className={`w-full flex items-center gap-3 px-5 py-4 transition-all ${
                        isCurrentCatorcena
                          ? isDark ? 'bg-gradient-to-r from-emerald-900/30 via-teal-900/20 to-emerald-900/30 hover:from-emerald-900/40 hover:via-teal-900/30 hover:to-emerald-900/40' : 'bg-emerald-50 hover:bg-emerald-100'
                          : isDark ? 'bg-zinc-800/30 hover:bg-zinc-800/50' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {expandedCatorcenas.has(key) ? (
                        <ChevronDown className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      ) : (
                        <ChevronRight className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      )}
                      <Calendar className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>
                        {(catorcena as any).isMensual
                          ? `${MESES_FULL[catorcena.num - 1]} ${catorcena.anio}`
                          : `Cat ${catorcena.num} / ${catorcena.anio}`}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'} border`}>
                        {campanas.length} campañas
                      </span>
                      {secondGroupingLabel && subgroups && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200'} border`}>
                          {subgroups.length} {secondGroupingLabel}
                        </span>
                      )}
                      {/* Badge de catorcena actual */}
                      {currentCatorcena &&
                       currentCatorcena.numero_catorcena === catorcena.num &&
                       currentCatorcena.a_o === catorcena.anio && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} border border-emerald-500/30`}>
                          En curso
                        </span>
                      )}
                      {/* Inversión de la catorcena: suma de sc.costo por catorcena (específica del período) */}
                      {(() => {
                        const catKey = `${catorcena.num}:${catorcena.anio}`;
                        const totalInversion = campanas.reduce((s, c) => {
                          const invData = inversionPorCatorcena[c.id];
                          // Si cargó el batch, usar valor específico de la catorcena.
                          // Si aún no carga, sumar 0 — NO usar c.inversion (es el total de
                          // la campaña, no la porción de esta catorcena: inflaría el badge).
                          return s + (invData?.[catKey] || 0);
                        }, 0);

                        return totalInversion > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'} border border-green-500/25 flex items-center gap-1`} title="Inversión de la catorcena">
                            <DollarSign className="h-3 w-3" /> {totalInversion.toLocaleString()}
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' : 'bg-gray-100 text-gray-500 border-gray-300'} border flex items-center gap-1`} title="Sin inversión registrada">
                            Sin inversión
                          </span>
                        );
                      })()}
                    </button>

                    {/* Contenido expandible de catorcena */}
                    {expandedCatorcenas.has(key) && (
                      <div className={isDark ? 'bg-zinc-900/50' : 'bg-white'}>
                        {/* Si hay subgrupos, mostrar agrupado por la segunda columna */}
                        {subgroups && subgroups.length > 0 ? (
                          subgroups.map(subgroup => {
                            const subgroupKey = `${key}-${subgroup.name}`;
                            const isSubgroupExpanded = expandedGroups.has(subgroupKey);
                            const subgroupColor = getTagColor(subgroup.name, isDark);
                            return (
                              <div key={subgroupKey} className={`border-t ${isDark ? 'border-zinc-800/30' : 'border-gray-200'}`}>
                                <button
                                  onClick={() => toggleGroup(subgroupKey)}
                                  className={`w-full flex items-center gap-3 px-6 py-2.5 ${isDark ? 'hover:bg-zinc-800/30 bg-zinc-800/20' : 'hover:bg-gray-100 bg-gray-50'} transition-all`}
                                >
                                  {isSubgroupExpanded ? (
                                    <ChevronDown className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                                  ) : (
                                    <ChevronRight className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                                  )}
                                  <Layers className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                                  <span className={`px-2 py-0.5 rounded text-xs ${subgroupColor.bg} ${subgroupColor.text} border ${subgroupColor.border}`}>
                                    {subgroup.name}
                                  </span>
                                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    {subgroup.campanas.length} campañas
                                  </span>
                                </button>
                                {isSubgroupExpanded && (
                                  <div className={isDark ? 'bg-zinc-900/30' : 'bg-white'}>
                                    {subgroup.campanas.map(campana => renderCampana(campana, 1))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          /* Sin subgrupos - mostrar campañas directamente */
                          campanas.map(campana => renderCampana(campana, 0))
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer de vista catorcena - información */}
        {activeView === 'catorcena' && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-zinc-800/50 bg-zinc-900/30 text-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-400'} text-xs`}>
            <span>
              {campanasPorCatorcena.length} catorcenas · {uniqueCampsInCatorcenaView} campañas
              {activeGroupings.length > 1 && (
                <span className={`${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'} ml-2`}>
                  · Subagrupado por {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label}
                </span>
              )}
            </span>
            {currentCatorcena && (
              <span className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'} flex items-center gap-1.5`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'} animate-pulse`} />
                Catorcena actual: {currentCatorcena.numero_catorcena}/{currentCatorcena.a_o}
              </span>
            )}
          </div>
        )}

      </div>

      {/* Edit Modal */}
      {selectedCampana && (
        <AssignInventarioCampanaModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedCampana(null);
          }}
          campana={selectedCampana}
        />
      )}

      {/* Órdenes de Montaje Modal — lazy-mount: igual que los demás modales
          de esta página, sólo se monta cuando está abierto. Antes sus hooks
          internos corrían aunque estuviera cerrado. */}
      {ordenesMontajeModalOpen && (
        <OrdenesMontajeModal
          isOpen={ordenesMontajeModalOpen}
          onClose={() => setOrdenesMontajeModalOpen(false)}
          canExport={permissions.canExportOrdenesMontaje}
        />
      )}

      {/* Versionario Artes Preview Modal (lazy-mount + lazy-load por campaña) */}
      {versionarioPreviewOpen && (
        <VersionarioArtesPreviewModal
          isOpen={versionarioPreviewOpen}
          onClose={() => {
            // Cancela cualquier fetch en curso y limpia estado.
            versionarioCancelledRef.current = true;
            setVersionarioPreviewOpen(false);
            setVersionarioArtesProgress({ current: 0, total: 0 });
          }}
          campanas={versionarioCampanasList}
          cache={versionarioCache}
          onFetchIds={handleFetchVersionarioIds}
          onDownload={handleDownloadVersionarioFromPreview}
          isDownloading={versionarioDownloading}
        />
      )}

      {/* Status Campana Modal */}
      {statusCampana && (
        <StatusCampanaModal
          isOpen={statusModalOpen}
          onClose={() => {
            setStatusModalOpen(false);
            setStatusCampana(null);
          }}
          campana={statusCampana}
          statusReadOnly={!permissions.canEditCampanaStatus}
        />
      )}

      {/* Incidencia Modal */}
      {incidenciaCampana && (
        <IncidenciaModal
          isOpen={incidenciaModalOpen}
          onClose={() => { setIncidenciaModalOpen(false); setIncidenciaCampana(null); }}
          campanaId={incidenciaCampana.id}
          campanaNombre={incidenciaCampana.nombre}
        />
      )}

      {/* Galería de Artes Modal - Versionario */}
      {isArtGalleryOpen && (
        <ArtGalleryModal
          isOpen={isArtGalleryOpen}
          onClose={() => { setIsArtGalleryOpen(false); setArtGalleryImages([]); }}
          imagenes={artGalleryImages}
          isLoading={false}
          title={artGalleryTitle}
          isDark={isDark}
        />
      )}
    </div>
  );
}
