import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Filter, ChevronDown, ChevronRight, X, Layers, SlidersHorizontal,
  Calendar, Clock, Eye, Megaphone, Edit2, Check, Minus, ArrowUpDown,
  List, LayoutGrid, Building2, MapPin, Loader2, Package
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

// Filter Chip Component with Search
function FilterChip({
  label,
  options,
  value,
  onChange,
  onClear
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
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
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
          }`}
      >
        <span>{value || label}</span>
        {value ? (
          <X className="h-3 w-3 hover:text-white" onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className="absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-zinc-800">
              <input
                type="text"
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-52 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${value === option
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);
  const [groupBy, setGroupBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedCatorcenaInicio, setSelectedCatorcenaInicio] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCampana, setSelectedCampana] = useState<Campana | null>(null);
  const limit = 20;

  // Estado para la vista activa (tabs)
  const [activeView, setActiveView] = useState<ViewType>('tabla');

  // Estado para la vista de catorcena
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [expandedCampanas, setExpandedCampanas] = useState<Set<number>>(new Set());
  const [expandedAPS, setExpandedAPS] = useState<Set<string>>(new Set()); // key: campanaId-aps
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

    return items;
  }, [data?.data, debouncedSearch, selectedCatorcenaInicio]);

  // Group data
  const groupedData = useMemo(() => {
    if (!groupBy || !filteredData.length) return null;

    const groups: Record<string, Campana[]> = {};

    filteredData.forEach(item => {
      let key = 'Sin asignar';
      if (groupBy === 'catorcena_inicio') {
        key = item.catorcena_inicio_num && item.catorcena_inicio_anio
          ? `Catorcena ${item.catorcena_inicio_num}, ${item.catorcena_inicio_anio}`
          : 'Sin catorcena';
      } else if (groupBy === 'status') {
        key = item.status || 'Sin status';
      } else if (groupBy === 'cliente') {
        key = item.cliente_nombre || item.cliente_razon_social || 'Sin cliente';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredData, groupBy]);

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

  // Agrupar campañas por catorcena para la vista alternativa
  const campanasPorCatorcena = useMemo(() => {
    const groups: Record<string, { catorcena: { num: number; anio: number }; campanas: Campana[] }> = {};

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

    // Ordenar por año desc, luego por catorcena desc
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredData]);

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

  // Agrupar inventarios primero por APS, luego por grupo_completo_id
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

    // Función para agrupar por grupo_completo_id
    const agruparPorGrupo = (items: InventarioConAPS[]) => {
      const grupos: Record<string, InventarioConAPS[]> = {};
      items.forEach(item => {
        const grupoKey = item.grupo_completo_id ? `grupo-${item.grupo_completo_id}` : `individual-${item.id}`;
        if (!grupos[grupoKey]) {
          grupos[grupoKey] = [];
        }
        grupos[grupoKey].push(item);
      });
      return Object.entries(grupos).map(([key, groupItems]) => ({
        key,
        grupoId: groupItems[0]?.grupo_completo_id,
        items: groupItems
      }));
    };

    // Construir resultado: primero los con APS (ordenados desc), luego los sin APS
    const resultado: { aps: number | null; totalItems: number; grupos: { key: string; grupoId: number | null; items: InventarioConAPS[] }[] }[] = [];

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
  const hasActiveFilters = !!(status || hasPeriodFilter || groupBy || debouncedSearch || selectedCatorcenaInicio);

  const clearAllFilters = () => {
    setSearch('');
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setSelectedCatorcenaInicio('');
    setGroupBy('');
    setExpandedGroups(new Set());
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
        {/* Periodo */}
        <td className="px-3 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodColor.bg} ${periodColor.text} border ${periodColor.border}`}>
            {periodStatus}
          </span>
        </td>
        {/* Creador */}
        <td className="px-3 py-3">
          {item.creador_nombre ? (() => {
            const color = getTagColor(item.creador_nombre);
            return (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text} border ${color.border}`}>
                {item.creador_nombre}
              </span>
            );
          })() : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        {/* Campaña */}
        <td className="px-3 py-3">
          <span className="font-semibold text-white text-sm">{item.nombre}</span>
        </td>
        {/* Cliente */}
        <td className="px-3 py-3">
          {(item.cliente_nombre || item.cliente_razon_social) ? (() => {
            const clienteName = item.cliente_nombre || item.cliente_razon_social || '';
            const color = getTagColor(clienteName);
            return (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text} border ${color.border} max-w-[180px]`} title={clienteName}>
                <span className="truncate">{clienteName}</span>
              </span>
            );
          })() : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        {/* Status */}
        <td className="px-3 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
            {item.status}
          </span>
        </td>
        {/* Cat. Inicio */}
        <td className="px-3 py-3">
          <span className="text-zinc-300 text-xs">{catIni}</span>
        </td>
        {/* Cat. Fin */}
        <td className="px-3 py-3">
          <span className="text-zinc-300 text-xs">{catFin}</span>
        </td>
        {/* APS */}
        <td className="px-3 py-3 text-center">
          {item.has_aps ? (
            <Check className="h-4 w-4 text-emerald-400 mx-auto" />
          ) : (
            <Minus className="h-4 w-4 text-zinc-600 mx-auto" />
          )}
        </td>
        {/* Acciones */}
        <td className="px-3 py-3">
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
              className="p-2 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border border-zinc-500/20 hover:border-zinc-500/40 transition-all"
              title="Editar campaña"
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
        {/* Gráficas */}
        {!isLoading && filteredData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Gráfica de Estatus */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                Estatus de Campaña
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-status-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 500 }}
                      formatter={(value: number, _name: string, props: { payload?: { name?: string } }) => [
                        `${value} campañas`,
                        props.payload?.name || ''
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                {statusChartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-400 truncate" title={item.name}>{item.name}</span>
                    <span className="text-zinc-500 flex-shrink-0">({item.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfica de Categoría de Mercado */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                Categoría de Mercado
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-cat-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fff' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 500 }}
                      formatter={(value: number, _name: string, props: { payload?: { percentage?: string; name?: string } }) => [
                        `${value} (${props.payload?.percentage || 0}%)`,
                        props.payload?.name || ''
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 max-h-20 overflow-y-auto">
                {categoryChartData.slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-400 truncate" title={item.name}>{item.name}</span>
                    <span className="text-zinc-500 flex-shrink-0">{item.percentage}%</span>
                  </div>
                ))}
                {categoryChartData.length > 8 && (
                  <div className="col-span-2 text-xs text-zinc-500 text-center">+{categoryChartData.length - 8} más</div>
                )}
              </div>
            </div>

            {/* Tercera gráfica - Placeholder */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                Resumen
              </h3>
              <div className="h-48 flex flex-col justify-center space-y-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                  <span className="text-zinc-400 text-sm">Total Campañas</span>
                  <span className="text-white font-bold text-lg">{filteredData.length}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                  <span className="text-zinc-400 text-sm">Con APS</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    {filteredData.filter(c => c.has_aps).length}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                  <span className="text-zinc-400 text-sm">Sin APS</span>
                  <span className="text-amber-400 font-bold text-lg">
                    {filteredData.filter(c => !c.has_aps).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

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

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || hasActiveFilters
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
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
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>

            {/* Filters Row (Expandable) */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/50 relative z-50">
                {/* Status Filter */}
                <span className="text-xs text-zinc-500 mr-1">
                  <Filter className="h-3 w-3 inline mr-1" />
                  Filtrar:
                </span>
                <FilterChip
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(val) => { setStatus(val); setPage(1); }}
                  onClear={() => { setStatus(''); setPage(1); }}
                />

                {/* Catorcena Inicio Filter */}
                <FilterChip
                  label="Catorcena Inicio"
                  options={catorcenaInicioOptions}
                  value={selectedCatorcenaInicio}
                  onChange={(val) => { setSelectedCatorcenaInicio(val); setPage(1); }}
                  onClear={() => { setSelectedCatorcenaInicio(''); setPage(1); }}
                />

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                {/* Current Catorcena Indicator */}
                {currentCatorcena && (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>Actual: Cat. {currentCatorcena.numero_catorcena} / {currentCatorcena.a_o}</span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700 mx-1" />
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
                />

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                {/* Group By */}
                <span className="text-xs text-zinc-500 mr-1">
                  <Layers className="h-3 w-3 inline mr-1" />
                  Agrupar:
                </span>
                <FilterChip
                  label="Sin agrupar"
                  options={['status', 'cliente', 'catorcena_inicio']}
                  value={groupBy}
                  onChange={(val) => { setGroupBy(val); setExpandedGroups(new Set()); setPage(1); }}
                  onClear={() => { setGroupBy(''); setExpandedGroups(new Set()); setPage(1); }}
                />

                {/* Clear All Filters Button */}
                {hasActiveFilters && (
                  <>
                    <div className="h-4 w-px bg-zinc-700 mx-1" />
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
                    >
                      <X className="h-3 w-3" />
                      Limpiar filtros
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
            onClick={() => setActiveView('tabla')}
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
            onClick={() => setActiveView('catorcena')}
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
              {groupBy && <span className="text-zinc-500">| Agrupado por {groupBy}</span>}
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
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Periodo</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Creador</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Estatus</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cat. Inicio</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cat. Fin</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">APS</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData ? (
                      groupedData.map(([groupName, items]) => (
                        <React.Fragment key={`group-${groupName}`}>
                          <GroupHeader
                            groupName={groupName}
                            count={items.length}
                            expanded={expandedGroups.has(groupName)}
                            onToggle={() => toggleGroup(groupName)}
                            colSpan={9}
                          />
                          {expandedGroups.has(groupName) && items.map((item, idx) => renderCampanaRow(item, idx))}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderCampanaRow(item, idx))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                            <Megaphone className="w-8 h-8 text-purple-400" />
                          </div>
                          <p className="text-zinc-500">No se encontraron campañas</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!groupBy && data?.pagination && (
                <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
                  <span className="text-sm text-purple-300/70">
                    Mostrando <span className="font-semibold text-purple-300">{startItem}–{endItem}</span> de <span className="font-semibold text-purple-300">{total}</span> campañas
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-300/50 mr-2">
                      Página {page} de {totalPages}
                    </span>
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
              {groupBy && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20">
                  <span className="text-xs text-zinc-500">
                    Mostrando {filteredData.length} campañas agrupadas por {groupBy}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        )}

        {/* Vista por Catorcena */}
        {activeView === 'catorcena' && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
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
              <div className="divide-y divide-zinc-800/50">
                {campanasPorCatorcena.map(({ key, catorcena, campanas }) => (
                  <div key={key} className="group">
                    {/* Header de Catorcena */}
                    <button
                      onClick={() => toggleCatorcena(key)}
                      className="w-full flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30 hover:from-purple-900/40 hover:via-fuchsia-900/30 hover:to-purple-900/40 transition-all"
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
                        {campanas.map((campana) => {
                          const statusColor = getStatusColor(campana.status);
                          const periodStatus = getPeriodStatus(campana.fecha_inicio, campana.fecha_fin);
                          const periodColor = PERIOD_COLORS[periodStatus] || DEFAULT_STATUS_COLOR;
                          const isExpanded = expandedCampanas.has(campana.id);
                          const inventarios = campanaInventarios[campana.id] || [];
                          const isLoadingInv = loadingInventarios.has(campana.id);
                          const apsAgrupados = getInventarioAgrupadoPorAPS(inventarios);

                          return (
                            <div key={campana.id} className="border-t border-zinc-800/30">
                              {/* Header de Campaña */}
                              <button
                                onClick={() => toggleCampana(campana.id)}
                                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-zinc-800/30 transition-all"
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

                                {/* Badges de info */}
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

                                {/* Acciones */}
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
                                    className="p-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border border-zinc-500/20 transition-all"
                                    title="Editar campaña"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </button>

                              {/* Contenido expandible de Campaña - APS → Grupos → Inventarios */}
                              {isExpanded && (
                                <div className="bg-zinc-900/30 px-8 py-3">
                                  {isLoadingInv ? (
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Cargando grupos e inventarios...
                                    </div>
                                  ) : inventarios.length === 0 ? (
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
                                      <Package className="h-4 w-4" />
                                      No hay inventarios reservados con APS
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="text-xs text-zinc-400">
                                        {inventarios.length} inventarios · {apsAgrupados.length} APS asignados
                                      </div>
                                      {apsAgrupados.map((apsGroup) => {
                                        const apsKey = `${campana.id}-${apsGroup.aps ?? 'sin-aps'}`;
                                        const isAPSExpanded = expandedAPS.has(apsKey);
                                        const tieneAPS = apsGroup.aps !== null;

                                        return (
                                          <div
                                            key={`aps-${apsGroup.aps ?? 'sin-aps'}`}
                                            className={`rounded-xl border overflow-hidden ${
                                              tieneAPS
                                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                                : 'border-amber-500/30 bg-amber-500/5'
                                            }`}
                                          >
                                            {/* Header de APS - Clickeable */}
                                            <button
                                              onClick={() => toggleAPS(campana.id, apsGroup.aps)}
                                              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all ${
                                                tieneAPS
                                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                                                  : 'bg-amber-500/10 hover:bg-amber-500/15'
                                              }`}
                                            >
                                              {isAPSExpanded ? (
                                                <ChevronDown className={`h-4 w-4 ${tieneAPS ? 'text-emerald-400' : 'text-amber-400'}`} />
                                              ) : (
                                                <ChevronRight className={`h-4 w-4 ${tieneAPS ? 'text-emerald-400' : 'text-amber-400'}`} />
                                              )}
                                              {tieneAPS ? (
                                                <>
                                                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                    <span className="text-emerald-300 font-bold text-xs">{apsGroup.aps}</span>
                                                  </div>
                                                  <span className="text-sm font-semibold text-emerald-200">
                                                    APS {apsGroup.aps}
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                                    <Minus className="h-4 w-4 text-amber-300" />
                                                  </div>
                                                  <span className="text-sm font-semibold text-amber-200">
                                                    Sin APS asignado
                                                  </span>
                                                </>
                                              )}
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                                                tieneAPS
                                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                              }`}>
                                                {apsGroup.totalItems} sitios
                                              </span>
                                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">
                                                {apsGroup.grupos.length} grupos
                                              </span>
                                            </button>

                                            {/* Grupos dentro de este APS - Colapsable */}
                                            {isAPSExpanded && (
                                              <div className={`p-3 space-y-2 border-t ${tieneAPS ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                                                {apsGroup.grupos.map((grupo) => (
                                                  <div
                                                    key={grupo.key}
                                                    className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 overflow-hidden"
                                                  >
                                                    <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/60">
                                                      <Building2 className="h-4 w-4 text-cyan-400" />
                                                      <span className="text-sm font-medium text-zinc-200">
                                                        {grupo.grupoId ? `Grupo #${grupo.grupoId}` : 'Individual'}
                                                      </span>
                                                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                        {grupo.items.length} sitios
                                                      </span>
                                                    </div>
                                                    <div className="divide-y divide-zinc-700/30">
                                                      {grupo.items.map((inv) => (
                                                        <div
                                                          key={inv.id}
                                                          className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-zinc-800/30 transition-colors"
                                                        >
                                                          <MapPin className="h-3 w-3 text-zinc-500" />
                                                          <span className="text-zinc-300 font-mono">{inv.codigo_unico}</span>
                                                          <span className="text-zinc-500">{inv.mueble || '-'}</span>
                                                          <span className="text-zinc-500">{inv.plaza || '-'}</span>
                                                          {inv.estado && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-700/50 text-zinc-400">
                                                              {inv.estado}
                                                            </span>
                                                          )}
                                                          {inv.tipo_medio && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-violet-500/20 text-violet-300">
                                                              {inv.tipo_medio}
                                                            </span>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
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
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer info */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20">
              <span className="text-xs text-zinc-500">
                {campanasPorCatorcena.length} catorcenas · {filteredData.length} campañas
              </span>
            </div>
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
    </div>
  );
}
