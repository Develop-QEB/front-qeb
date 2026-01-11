import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Filter, ChevronDown, ChevronRight, X, Layers,
  Calendar, Clock, Eye, Megaphone, Edit2, Check, Minus, ArrowUpDown, User,
  List, LayoutGrid, Building2, MapPin, Loader2, Package, ClipboardList, Plus, Trash2,
  ArrowUp, ArrowDown, Lock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioConAPS, InventarioReservado } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Campana, Catorcena } from '../../types';

// Tipos para las vistas
type ViewType = 'tabla' | 'catorcena';
import { formatDate } from '../../lib/utils';
import { AssignInventarioCampanaModal } from './AssignInventarioCampanaModal';
import { OrdenesMontajeModal } from './OrdenesMontajeModal';

// Colors for dynamic tags
const TAG_COLORS = [
  { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
  { bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' },
  { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30' },
  { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30' },
];

function getTagColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// Status Colors - colores únicos por cada tipo de status
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'activa': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'inactiva': { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30' },
  'finalizada': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  'por iniciar': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'en curso': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'pendiente': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  'cancelada': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'pausada': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
};

const DEFAULT_STATUS_COLOR = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };

function getStatusColor(status: string | null | undefined) {
  if (!status) return DEFAULT_STATUS_COLOR;
  const normalized = status.toLowerCase().trim();
  // Si existe en nuestro mapa, usar ese color
  if (STATUS_COLORS[normalized]) {
    return STATUS_COLORS[normalized];
  }
  // Si no, generar un color dinámico basado en el nombre
  return getTagColor(status);
}

// Period badge colors
const PERIOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Pasada': { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30' },
  'En curso': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Futura': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
};

// Colores para gráficas
const CHART_COLORS = {
  status: {
    'activa': '#10b981',        // emerald
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
  { field: 'creador_nombre', label: 'Creador', type: 'string' },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// Campos disponibles para agrupar
type GroupByField = 'status' | 'cliente_nombre' | 'catorcena_inicio';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'status', label: 'Estatus' },
  { field: 'cliente_nombre', label: 'Cliente' },
  { field: 'catorcena_inicio', label: 'Catorcena Inicio' },
];

// Campos disponibles para ordenar
const SORT_FIELDS = [
  { field: 'fecha_inicio', label: 'Fecha Inicio' },
  { field: 'nombre', label: 'Nombre' },
  { field: 'cliente_nombre', label: 'Cliente' },
  { field: 'status', label: 'Estatus' },
];

// Function to apply advanced filters to data
function applyAdvancedFilters<T>(data: T[], filters: AdvancedFilterCondition[]): T[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = (item as Record<string, unknown>)[filter.field];
      const filterValue = filter.value;

      if (!filterValue) return true;

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
        case '>':
          return Number(fieldValue) > Number(filterValue);
        case '<':
          return Number(fieldValue) < Number(filterValue);
        case '>=':
          return Number(fieldValue) >= Number(filterValue);
        case '<=':
          return Number(fieldValue) <= Number(filterValue);
        default:
          return true;
      }
    });
  });
}

// Period Filter Popover Component
function PeriodFilterPopover({
  catorcenasData,
  yearInicio,
  yearFin,
  catorcenaInicio,
  catorcenaFin,
  onApply,
  onClear
}: {
  catorcenasData: { years: number[]; data: Catorcena[] } | undefined;
  yearInicio: number | undefined;
  yearFin: number | undefined;
  catorcenaInicio: number | undefined;
  catorcenaFin: number | undefined;
  onApply: (yearInicio: number, yearFin: number, catorcenaInicio?: number, catorcenaFin?: number) => void;
  onClear: () => void;
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
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
          }`}
      >
        <Calendar className="h-3 w-3" />
        <span>{getDisplayText()}</span>
        {isActive ? (
          <X className="h-3 w-3 hover:text-white" onClick={(e) => { e.stopPropagation(); handleClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                Filtro de Periodo
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">Selecciona año inicio y fin (obligatorios)</p>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Año Inicio *</label>
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
                    className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="">Seleccionar</option>
                    {yearInicioOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Catorcena Inicio</label>
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
                    className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
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
                  <label className="text-[10px] text-zinc-500 mb-1 block">Año Fin *</label>
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
                    className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="">Seleccionar</option>
                    {yearFinOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Catorcena Fin</label>
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
                    className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  >
                    <option value="">Todas</option>
                    {catorcenasFinOptions.map(c => (
                      <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
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
  colSpan
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <tr
      onClick={onToggle}
      className="bg-purple-500/10 border-b border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors"
    >
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-400" />
          )}
          <span className="font-semibold text-white">{groupName || 'Sin asignar'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
            {count} campañas
          </span>
        </div>
      </td>
    </tr>
  );
}

// Status options
const STATUS_OPTIONS = ['activa', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

export function CampanasPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pre-fill search if search param is present in URL
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearch(searchParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);
  // Estados para filtros/ordenamiento/agrupación con popups
  const [sortField, setSortField] = useState<string | null>('fecha_inicio');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterCondition[]>([]);
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estados para popups
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [selectedCatorcenaInicio, setSelectedCatorcenaInicio] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCampana, setSelectedCampana] = useState<Campana | null>(null);
  const [ordenesMontajeModalOpen, setOrdenesMontajeModalOpen] = useState(false);
  const limit = 20;

  // Estado para la vista activa (tabs)
  const [activeView, setActiveView] = useState<ViewType>('tabla');

  // Estado para la vista de catorcena
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [expandedCampanas, setExpandedCampanas] = useState<Set<number>>(new Set());
  const [expandedAPS, setExpandedAPS] = useState<Set<string>>(new Set()); // key: campanaId-aps
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set()); // key: campanaId-aps-grupoKey
  const [campanaInventarios, setCampanaInventarios] = useState<Record<number, InventarioConAPS[]>>({});
  const [loadingInventarios, setLoadingInventarios] = useState<Set<number>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', page, status, yearInicio, yearFin, catorcenaInicio, catorcenaFin, debouncedSearch],
    queryFn: () =>
      campanasService.getAll({
        page,
        limit,
        status: status || undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
      }),
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

  // Generate catorcena options for filter (sorted by year desc, then catorcena desc)
  const catorcenaInicioOptions = useMemo(() => {
    if (!catorcenasData?.data) return [];
    return catorcenasData.data
      .slice()
      .sort((a, b) => {
        if (b.a_o !== a.a_o) return b.a_o - a.a_o;
        return b.numero_catorcena - a.numero_catorcena;
      })
      .map(c => `Catorcena ${c.numero_catorcena}, ${c.a_o}`);
  }, [catorcenasData]);

  // Filter data locally for search and catorcena inicio
  const filteredData = useMemo(() => {
    let items = data?.data || [];

    // Filter by search
    if (debouncedSearch && items.length > 0) {
      const searchLower = debouncedSearch.toLowerCase();
      items = items.filter(c =>
        c.nombre?.toLowerCase().includes(searchLower) ||
        c.articulo?.toLowerCase().includes(searchLower) ||
        c.cliente_nombre?.toLowerCase().includes(searchLower) ||
        c.cliente_razon_social?.toLowerCase().includes(searchLower) ||
        String(c.id).includes(searchLower)
      );
    }

    // Filter by catorcena inicio
    if (selectedCatorcenaInicio && items.length > 0) {
      // Parse "Catorcena X, YYYY" format
      const match = selectedCatorcenaInicio.match(/Catorcena (\d+), (\d+)/);
      if (match) {
        const catNum = parseInt(match[1]);
        const catYear = parseInt(match[2]);
        items = items.filter(c =>
          c.catorcena_inicio_num === catNum && c.catorcena_inicio_anio === catYear
        );
      }
    }

    // Apply advanced filters
    if (advancedFilters.length > 0) {
      items = applyAdvancedFilters(items, advancedFilters);
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
  }, [data?.data, debouncedSearch, selectedCatorcenaInicio, advancedFilters, sortField, sortDirection]);

  // Group data - supports up to 2 levels
  interface GroupedLevel1 {
    name: string;
    items: Campana[];
    subgroups?: { name: string; items: Campana[] }[];
  }

  const getGroupValue = (item: Campana, field: GroupByField): string => {
    if (field === 'catorcena_inicio') {
      return item.catorcena_inicio_num && item.catorcena_inicio_anio
        ? `Catorcena ${item.catorcena_inicio_num}, ${item.catorcena_inicio_anio}`
        : 'Sin catorcena';
    } else if (field === 'status') {
      return item.status || 'Sin status';
    } else if (field === 'cliente_nombre') {
      return item.cliente_nombre || item.cliente_razon_social || 'Sin cliente';
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
    if (isExpanding && !campanaInventarios[campanaId]) {
      setLoadingInventarios(prev => new Set(prev).add(campanaId));
      try {
        // Llamar a ambos endpoints en paralelo: con APS y sin APS
        const [conAPS, sinAPS] = await Promise.all([
          campanasService.getInventarioConAPS(campanaId),
          campanasService.getInventarioReservado(campanaId)
        ]);

        // Combinar ambos resultados, agregando aps: 0 a los sin APS
        const sinAPSConFormato: InventarioConAPS[] = sinAPS.map(item => ({
          ...item,
          aps: 0 // Marcar explícitamente como sin APS
        }));

        const todosLosInventarios = [...conAPS, ...sinAPSConFormato];
        setCampanaInventarios(prev => ({ ...prev, [campanaId]: todosLosInventarios }));
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

  // Agrupar campañas por catorcena para la vista alternativa (con soporte para subagrupaciones)
  const campanasPorCatorcena = useMemo(() => {
    const groups: Record<string, {
      catorcena: { num: number; anio: number };
      campanas: Campana[];
      subgroups?: { name: string; campanas: Campana[] }[];
    }> = {};

    filteredData.forEach(item => {
      if (item.catorcena_inicio_num && item.catorcena_inicio_anio) {
        const key = `${item.catorcena_inicio_anio}-${String(item.catorcena_inicio_num).padStart(2, '0')}`;
        if (!groups[key]) {
          groups[key] = {
            catorcena: { num: item.catorcena_inicio_num, anio: item.catorcena_inicio_anio },
            campanas: []
          };
        }
        groups[key].campanas.push(item);
      }
    });

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
  }, [filteredData, activeGroupings]);

  // Estadísticas para gráfica de Status
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredData.forEach(item => {
      const status = item.status?.toLowerCase() || 'sin status';
      counts[status] = (counts[status] || 0) + 1;
    });

    let fallbackIndex = 0;
    return Object.entries(counts)
      .map(([name, value]) => {
        let color = CHART_COLORS.status[name as keyof typeof CHART_COLORS.status];
        if (!color) {
          // Usar color del array fallback para estatus no definidos
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
  }, [filteredData]);

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
  const hasActiveFilters = !!(status || hasPeriodFilter || activeGroupings.length > 0 || debouncedSearch || selectedCatorcenaInicio || advancedFilters.length > 0 || sortField !== 'fecha_inicio');

  // Get unique values for each field (for advanced filter dropdowns)
  const getUniqueFieldValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!data?.data) return valuesMap;

    CAMPANA_FILTER_FIELDS.forEach(fieldConfig => {
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
  }, [data?.data]);

  const clearAllFilters = () => {
    setSearch('');
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setSelectedCatorcenaInicio('');
    setSortField('fecha_inicio');
    setSortDirection('desc');
    setActiveGroupings([]);
    setExpandedGroups(new Set());
    setAdvancedFilters([]);
    setPage(1);
  };

  // Handle export CSV with all columns
  const handleExportCSV = () => {
    if (!filteredData.length) return;

    const headers = [
      'Periodo', 'Creador', 'Campaña', 'Cliente', 'Estatus', 'Catorcena Inicio', 'Catorcena Fin', 'APS'
    ];
    const rows = filteredData.map(c => {
      const periodStatus = getPeriodStatus(c.fecha_inicio, c.fecha_fin);
      const catIni = c.catorcena_inicio_num && c.catorcena_inicio_anio
        ? `Cat ${c.catorcena_inicio_num} ${c.catorcena_inicio_anio}`
        : '-';
      const catFin = c.catorcena_fin_num && c.catorcena_fin_anio
        ? `Cat ${c.catorcena_fin_num} ${c.catorcena_fin_anio}`
        : '-';
      return [
        periodStatus,
        c.creador_nombre || '',
        c.nombre || '',
        c.cliente_nombre || c.cliente_razon_social || '',
        c.status,
        catIni,
        catFin,
        c.has_aps ? 'Si' : 'No'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `campanas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
    const disabledStatuses = ['finalizado', 'sin cotizacion activa', 'cancelada'];
    return disabledStatuses.includes(statusLower) || campana.has_aps === true;
  };

  const renderCampanaRow = (item: Campana, index: number) => {
    const statusColor = getStatusColor(item.status);
    const periodStatus = getPeriodStatus(item.fecha_inicio, item.fecha_fin);
    const periodColor = PERIOD_COLORS[periodStatus] || DEFAULT_STATUS_COLOR;

    const catIni = item.catorcena_inicio_num && item.catorcena_inicio_anio
      ? `Cat ${item.catorcena_inicio_num}, ${item.catorcena_inicio_anio}`
      : '-';
    const catFin = item.catorcena_fin_num && item.catorcena_fin_anio
      ? `Cat ${item.catorcena_fin_num}, ${item.catorcena_fin_anio}`
      : '-';

    return (
      <tr key={`campana-${item.id}-${index}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
        {/* ID */}
        <td className="px-4 py-3">
          <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">#{item.id}</span>
        </td>
        {/* Periodo */}
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodColor.bg} ${periodColor.text} border ${periodColor.border}`}>
            {periodStatus}
          </span>
        </td>
        {/* Creador - Avatar style */}
        <td className="px-4 py-3">
          {item.creador_nombre ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                <User className="h-3 w-3 text-purple-400" />
              </div>
              <span className="text-zinc-300 text-sm">{item.creador_nombre}</span>
            </div>
          ) : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        {/* Campaña */}
        <td className="px-4 py-3">
          <span className="font-medium text-white text-sm">{item.nombre}</span>
        </td>
        {/* Cliente - Simple text */}
        <td className="px-4 py-3">
          <span className="text-zinc-300 text-sm max-w-[180px] truncate block" title={item.cliente_nombre || item.cliente_razon_social || '-'}>
            {item.cliente_nombre || item.cliente_razon_social || '-'}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
            {item.status}
          </span>
        </td>
        {/* Cat. Inicio - Badge style */}
        <td className="px-4 py-3">
          {item.catorcena_inicio_num && item.catorcena_inicio_anio ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-xs border border-cyan-500/20">
              <Calendar className="h-3 w-3" />
              {item.catorcena_inicio_num}/{item.catorcena_inicio_anio}
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        {/* Cat. Fin - Badge style */}
        <td className="px-4 py-3">
          {item.catorcena_fin_num && item.catorcena_fin_anio ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-xs border border-amber-500/20">
              <Calendar className="h-3 w-3" />
              {item.catorcena_fin_num}/{item.catorcena_fin_anio}
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        {/* APS */}
        <td className="px-4 py-3 text-center">
          {item.has_aps ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800">
              <Minus className="h-3.5 w-3.5 text-zinc-600" />
            </span>
          )}
        </td>
        {/* Acciones */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenCampana(item.id)}
              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-all"
              title="Abrir campaña"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleEditCampana(item)}
              disabled={isEditDisabled(item)}
              className={`p-2 rounded-lg border transition-all ${
                isEditDisabled(item)
                  ? 'bg-zinc-800/30 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                  : 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border-zinc-500/20 hover:border-zinc-500/40'
              }`}
              title={isEditDisabled(item) ? 'No editable (tiene APS o status no permite edición)' : 'Editar campaña'}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Calcular paginación basada en si hay filtros locales activos
  const hasLocalFilters = !!(debouncedSearch || selectedCatorcenaInicio);
  const totalPages = hasLocalFilters ? 1 : (data?.pagination?.totalPages || 1);
  const total = hasLocalFilters ? filteredData.length : (data?.pagination?.total ?? 0);
  const startItem = hasLocalFilters ? (filteredData.length > 0 ? 1 : 0) : ((page - 1) * limit + 1);
  const endItem = hasLocalFilters ? filteredData.length : Math.min(page * limit, data?.pagination?.total ?? 0);

  return (
    <div className="min-h-screen">
      <Header title="Campañas" />

      <div className="p-6 space-y-5">
        {/* Dashboard KPIs Grid - Same style as Solicitudes/Propuestas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Main KPI: Total Campañas */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Total Campañas</p>
              <h3 className="text-4xl font-bold text-white tracking-tight">
                {isLoading ? '...' : filteredData.length.toLocaleString()}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {hasActiveFilters ? 'Filtrado' : 'Todas'}
              </span>
            </div>
          </div>

          {/* Chart Card: Status Distribution */}
          <div className="col-span-1 md:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-4 flex items-center relative overflow-hidden">
            {!isLoading && statusChartData.length > 0 ? (
              <div className="w-full h-[140px] flex items-center">
                <div className="h-full min-w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
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
                          backgroundColor: '#18181b',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#fff',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
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
                <div className="flex-1 flex flex-wrap gap-2 content-center pl-4 h-full overflow-y-auto scrollbar-thin">
                  {statusChartData.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/50 min-w-[100px]">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <div className="text-sm font-bold text-white">{item.value}</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wide truncate max-w-[70px]" title={item.name}>{item.name}</div>
                      </div>
                    </div>
                  ))}
                  {statusChartData.length > 6 && (
                    <div className="flex items-center justify-center p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/50 text-xs text-zinc-500">
                      +{statusChartData.length - 6} más
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-[140px] flex items-center justify-center text-zinc-500 text-sm">
                {isLoading ? 'Cargando...' : 'Sin datos'}
              </div>
            )}
          </div>

          {/* KPI: APS Status */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Con APS</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-emerald-400">
                  {isLoading ? '...' : filteredData.filter(c => c.has_aps).length.toLocaleString()}
                </h3>
                <span className="text-xs text-emerald-500/80 font-medium">asignados</span>
              </div>
            </div>
            {/* Progress bar visual */}
            <div className="mt-4 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${filteredData.length ? (filteredData.filter(c => c.has_aps).length / filteredData.length) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>Sin APS: {filteredData.filter(c => !c.has_aps).length}</span>
              <span>{filteredData.length ? Math.round((filteredData.filter(c => c.has_aps).length / filteredData.length) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4 relative z-30">
          <div className="flex flex-col gap-4">
            {/* Top Row: Search + Filter Toggle + Export */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
                <input
                  type="search"
                  placeholder="Buscar campaña, articulo, cliente..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Botones de Acción: Filtrar, Agrupar, Ordenar */}
              <div className="flex items-center gap-2">
                {/* Botón de Filtros */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterPopup(!showFilterPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      advancedFilters.length > 0
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                    }`}
                    title="Filtrar"
                  >
                    <Filter className="h-4 w-4" />
                    {advancedFilters.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                        {advancedFilters.length}
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
                        {advancedFilters.map((filter, index) => (
                          <div key={filter.id} className="flex items-center gap-2">
                            {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                            {index === 0 && <span className="w-8"></span>}
                            <select
                              value={filter.field}
                              onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                              className="w-[130px] text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              {CAMPANA_FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className="w-[110px] text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              {FILTER_OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              list={`datalist-campana-${filter.id}`}
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              placeholder="Escribe o selecciona..."
                              className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                            />
                            <datalist id={`datalist-campana-${filter.id}`}>
                              {getUniqueFieldValues[filter.field]?.map((val) => (
                                <option key={val} value={val} />
                              ))}
                            </datalist>
                            <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {advancedFilters.length === 0 && (
                          <p className="text-[11px] text-zinc-500 text-center py-3">Sin filtros. Haz clic en "Añadir".</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-900/30">
                        <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                          <Plus className="h-3 w-3" /> Añadir
                        </button>
                        <button onClick={clearFilters} disabled={advancedFilters.length === 0} className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          Limpiar
                        </button>
                      </div>
                      {advancedFilters.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-purple-900/30">
                          <span className="text-[10px] text-zinc-500">{filteredData.length} de {data?.data?.length || 0} registros</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de Agrupar */}
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
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide px-2 py-1">
                        {activeView === 'catorcena' ? 'Agrupación adicional' : 'Agrupar por (max 2)'}
                      </p>
                      {AVAILABLE_GROUPINGS.map(({ field, label }) => {
                        const isLocked = activeView === 'catorcena' && field === 'catorcena_inicio';
                        const isActive = activeGroupings.includes(field);
                        return (
                          <button
                            key={field}
                            onClick={() => !isLocked && toggleGrouping(field)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                              isLocked
                                ? 'text-purple-400 cursor-not-allowed opacity-70'
                                : isActive
                                  ? 'text-purple-300 hover:bg-purple-900/30'
                                  : 'text-zinc-400 hover:bg-purple-900/30'
                            }`}
                            disabled={isLocked}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isLocked
                                ? 'bg-purple-800 border-purple-700'
                                : isActive
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-purple-500/50'
                            }`}>
                              {isLocked ? (
                                <Lock className="h-2.5 w-2.5 text-purple-300" />
                              ) : isActive ? (
                                <Check className="h-3 w-3 text-white" />
                              ) : null}
                            </div>
                            {label}
                            {isLocked && <span className="ml-auto text-[10px] text-purple-500">Fija</span>}
                            {!isLocked && activeGroupings.indexOf(field) === 0 && <span className="ml-auto text-[10px] text-purple-400">1°</span>}
                            {!isLocked && activeGroupings.indexOf(field) === 1 && <span className="ml-auto text-[10px] text-pink-400">2°</span>}
                          </button>
                        );
                      })}
                      <div className="border-t border-purple-900/30 mt-2 pt-2">
                        <button
                          onClick={() => {
                            if (activeView === 'catorcena') {
                              // Solo quitar la segunda agrupación, mantener catorcena_inicio
                              setActiveGroupings(['catorcena_inicio']);
                            } else {
                              setActiveGroupings([]);
                            }
                          }}
                          className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                        >
                          {activeView === 'catorcena' ? 'Quitar agrupación adicional' : 'Quitar agrupación'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón de Ordenar */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortPopup(!showSortPopup)}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                      sortField && sortField !== 'fecha_inicio'
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
                        {SORT_FIELDS.map((field) => (
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
                      {sortField && sortField !== 'fecha_inicio' && (
                        <div className="mt-3 pt-3 border-t border-purple-900/30">
                          <button
                            onClick={() => { setSortField('fecha_inicio'); setSortDirection('desc'); }}
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

              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>

              {/* Órdenes de Montaje */}
              <button
                onClick={() => setOrdenesMontajeModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                Órdenes de Montaje
              </button>
            </div>
          </div>
        </div>

        {/* Tabs de vista */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveView('tabla');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'tabla'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
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
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Vista por Catorcena
          </button>
        </div>

        {/* Info Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
              <Filter className="h-3.5 w-3.5" />
              {filteredData.length} resultados
              {activeGroupings.length > 0 && (
                <span className="text-zinc-500">
                  | Agrupado por {activeGroupings.map(g => AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' → ')}
                </span>
              )}
              {sortField && sortField !== 'fecha_inicio' && (
                <span className="text-zinc-500">| Ordenado por {SORT_FIELDS.find(f => f.field === sortField)?.label} ({sortDirection === 'asc' ? '↑' : '↓'})</span>
              )}
            </div>
          </div>
        )}

        {/* Vista de Tabla */}
        {activeView === 'tabla' && (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Periodo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Creador</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Estatus</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cat. Inicio</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cat. Fin</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">APS</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Acciones</th>
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
                            colSpan={10}
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
                                    className="bg-fuchsia-500/5 border-b border-fuchsia-500/10 cursor-pointer hover:bg-fuchsia-500/10 transition-colors"
                                  >
                                    <td colSpan={10} className="px-4 py-2.5 pl-10">
                                      <div className="flex items-center gap-2">
                                        {expandedGroups.has(`${group.name}|${subgroup.name}`) ? (
                                          <ChevronDown className="h-4 w-4 text-fuchsia-400" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-fuchsia-400" />
                                        )}
                                        <span className="font-semibold text-zinc-200 text-sm">{subgroup.name || 'Sin asignar'}</span>
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-fuchsia-500/20 text-fuchsia-300">
                                          {subgroup.items.length} campañas
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Level 2 Content */}
                                  {expandedGroups.has(`${group.name}|${subgroup.name}`) &&
                                    subgroup.items.map((item, idx) => renderCampanaRow(item, idx))
                                  }
                                </React.Fragment>
                              ))
                            ) : (
                              // No subgroups (1 level grouping)
                              group.items.map((item, idx) => renderCampanaRow(item, idx))
                            )
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderCampanaRow(item, idx))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10">
                              <Megaphone className="w-6 h-6 text-purple-400" />
                            </div>
                            <span className="text-zinc-500 text-sm">No se encontraron campañas</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {activeGroupings.length === 0 && data?.pagination && totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
                  <span className="text-sm text-purple-300/70">
                    Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{totalPages}</span>
                    <span className="text-purple-300/50 ml-2">({total} total)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* Grouped data info */}
              {activeGroupings.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20">
                  <span className="text-xs text-zinc-500">
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
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
            {/* Header de la vista */}
            <div className="px-5 py-4 border-b border-zinc-800/50 bg-gradient-to-r from-purple-900/20 via-fuchsia-900/10 to-purple-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Vista por Catorcena</h3>
                    <p className="text-xs text-zinc-500">Campañas agrupadas por periodo de inicio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{campanasPorCatorcena.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Catorcenas</p>
                  </div>
                  <div className="w-px h-10 bg-zinc-800" />
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-400">{filteredData.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Campañas</p>
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
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                  <Calendar className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-zinc-500">No hay campañas agrupadas por catorcena</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {campanasPorCatorcena.map(({ key, catorcena, campanas, subgroups }) => {
                  const isCurrentCatorcena = currentCatorcena &&
                    currentCatorcena.numero_catorcena === catorcena.num &&
                    currentCatorcena.a_o === catorcena.anio;
                  const secondGroupingLabel = activeGroupings[0] === 'catorcena_inicio' && activeGroupings.length > 1
                    ? AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label
                    : null;

                  // Función para renderizar una campaña
                  const renderCampana = (campana: Campana, indent: number = 0) => {
                    const statusColor = getStatusColor(campana.status);
                    const periodStatus = getPeriodStatus(campana.fecha_inicio, campana.fecha_fin);
                    const periodColor = PERIOD_COLORS[periodStatus] || DEFAULT_STATUS_COLOR;
                    const isExpanded = expandedCampanas.has(campana.id);
                    const inventarios = campanaInventarios[campana.id] || [];
                    const isLoadingInv = loadingInventarios.has(campana.id);
                    const apsAgrupados = getInventarioAgrupadoPorAPS(inventarios);

                    return (
                      <div key={campana.id} className="border-t border-zinc-800/30">
                        <button
                          onClick={() => toggleCampana(campana.id)}
                          className="w-full flex items-center gap-3 px-6 py-3 hover:bg-zinc-800/30 transition-all"
                          style={{ paddingLeft: `${24 + indent * 16}px` }}
                        >
                          {isLoadingInv ? (
                            <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                          ) : isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                          )}
                          <Megaphone className="h-4 w-4 text-zinc-500" />
                          <span className="font-medium text-white text-sm flex-1 text-left truncate">
                            {campana.nombre}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodColor.bg} ${periodColor.text} border ${periodColor.border}`}>
                            {periodStatus}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                            {campana.status}
                          </span>
                          {campana.has_aps ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <Check className="h-3 w-3" /> APS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 flex items-center gap-1">
                              <Minus className="h-3 w-3" /> Sin APS
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenCampana(campana.id)}
                              className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
                              title="Ver campaña"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleEditCampana(campana)}
                              disabled={isEditDisabled(campana)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isEditDisabled(campana)
                                  ? 'bg-zinc-800/30 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                                  : 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border-zinc-500/20'
                              }`}
                              title={isEditDisabled(campana) ? 'No editable' : 'Editar campaña'}
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </button>
                        {/* Contenido expandible - inventario */}
                        {isExpanded && (
                          <div className="bg-zinc-950/50 px-8 py-3" style={{ marginLeft: `${indent * 16}px` }}>
                            {isLoadingInv ? (
                              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando inventario...
                              </div>
                            ) : inventarios.length === 0 ? (
                              <p className="text-sm text-zinc-500">No hay inventario con APS</p>
                            ) : (
                              <div className="space-y-2">
                                {apsAgrupados.map(apsGroup => {
                                  const apsKey = `${campana.id}-${apsGroup.aps}`;
                                  const isAPSExpanded = expandedAPS.has(apsKey);
                                  return (
                                    <div key={apsGroup.aps} className="border border-zinc-800/50 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => toggleAPS(campana.id, apsGroup.aps)}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/30 hover:bg-zinc-800/50 transition-all"
                                      >
                                        {isAPSExpanded ? <ChevronDown className="h-3 w-3 text-zinc-400" /> : <ChevronRight className="h-3 w-3 text-zinc-400" />}
                                        <Package className="h-3 w-3 text-emerald-400" />
                                        <span className="text-xs text-white font-medium">APS {apsGroup.aps}</span>
                                        <span className="text-[10px] text-zinc-500">{apsGroup.totalItems} ubicaciones</span>
                                      </button>
                                      {isAPSExpanded && (
                                        <div className="px-3 py-2 space-y-1 bg-zinc-900/50">
                                          {apsGroup.grupos.map(grupo => {
                                            const grupoKey = `${apsKey}-${grupo.key}`;
                                            const isGrupoExpanded = expandedGrupos.has(grupoKey);
                                            return (
                                              <div key={grupo.key} className="border-l-2 border-zinc-700 pl-2">
                                                <button
                                                  onClick={() => toggleGrupo(campana.id, apsGroup.aps, grupo.key)}
                                                  className="w-full flex items-center gap-2 py-1 text-left hover:bg-zinc-800/30 rounded px-1"
                                                >
                                                  {isGrupoExpanded ? <ChevronDown className="h-3 w-3 text-zinc-500" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                                                  <ClipboardList className="h-3 w-3 text-purple-400" />
                                                  <span className="text-[11px] text-zinc-300">{grupo.key}</span>
                                                  <span className="text-[10px] text-zinc-600">({grupo.items.length})</span>
                                                </button>
                                                {isGrupoExpanded && (
                                                  <div className="pl-5 py-1 space-y-0.5">
                                                    {grupo.items.map(inv => (
                                                      <div key={inv.id} className="flex items-center gap-2 text-[10px] text-zinc-500 py-0.5">
                                                        <MapPin className="h-2.5 w-2.5 text-zinc-600" />
                                                        <span className="text-zinc-400 font-mono">{inv.codigo_unico}</span>
                                                        <span className="text-zinc-600">•</span>
                                                        <span>{inv.plaza || 'Sin plaza'}</span>
                                                      </div>
                                                    ))}
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
                          ? 'bg-gradient-to-r from-emerald-900/30 via-teal-900/20 to-emerald-900/30 hover:from-emerald-900/40 hover:via-teal-900/30 hover:to-emerald-900/40'
                          : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                      }`}
                    >
                      {expandedCatorcenas.has(key) ? (
                        <ChevronDown className="h-5 w-5 text-purple-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-purple-400" />
                      )}
                      <Calendar className="h-5 w-5 text-purple-400" />
                      <span className="font-semibold text-white text-sm">
                        Catorcena {catorcena.num}, {catorcena.anio}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {campanas.length} campañas
                      </span>
                      {secondGroupingLabel && subgroups && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                          {subgroups.length} {secondGroupingLabel}
                        </span>
                      )}
                      {/* Badge de catorcena actual */}
                      {currentCatorcena &&
                       currentCatorcena.numero_catorcena === catorcena.num &&
                       currentCatorcena.a_o === catorcena.anio && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          En curso
                        </span>
                      )}
                    </button>

                    {/* Contenido expandible de catorcena */}
                    {expandedCatorcenas.has(key) && (
                      <div className="bg-zinc-900/50">
                        {/* Si hay subgrupos, mostrar agrupado por la segunda columna */}
                        {subgroups && subgroups.length > 0 ? (
                          subgroups.map(subgroup => {
                            const subgroupKey = `${key}-${subgroup.name}`;
                            const isSubgroupExpanded = expandedGroups.has(subgroupKey);
                            const subgroupColor = getTagColor(subgroup.name);
                            return (
                              <div key={subgroupKey} className="border-t border-zinc-800/30">
                                <button
                                  onClick={() => toggleGroup(subgroupKey)}
                                  className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-zinc-800/30 transition-all bg-zinc-800/20"
                                >
                                  {isSubgroupExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-fuchsia-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-fuchsia-400" />
                                  )}
                                  <Layers className="h-4 w-4 text-fuchsia-400" />
                                  <span className={`px-2 py-0.5 rounded text-xs ${subgroupColor.bg} ${subgroupColor.text} border ${subgroupColor.border}`}>
                                    {subgroup.name}
                                  </span>
                                  <span className="text-xs text-zinc-500">
                                    {subgroup.campanas.length} campañas
                                  </span>
                                </button>
                                {isSubgroupExpanded && (
                                  <div className="bg-zinc-900/30">
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800/50 bg-zinc-900/30 text-xs text-zinc-500">
            <span>
              {campanasPorCatorcena.length} catorcenas · {filteredData.length} campañas
              {activeGroupings.length > 1 && (
                <span className="text-fuchsia-400 ml-2">
                  · Subagrupado por {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label}
                </span>
              )}
            </span>
            {currentCatorcena && (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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

      {/* Órdenes de Montaje Modal */}
      <OrdenesMontajeModal
        isOpen={ordenesMontajeModalOpen}
        onClose={() => setOrdenesMontajeModalOpen(false)}
      />
    </div>
  );
}
