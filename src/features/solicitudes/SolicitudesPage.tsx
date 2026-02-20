import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Download, Trash2, FileText,
  Filter, ChevronDown, ChevronRight, X, Layers, SlidersHorizontal,
  ArrowUpDown, Calendar, Clock, Plus, Eye, Edit2, PlayCircle, MessageSquare
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { Header } from '../../components/layout/Header';
import { solicitudesService } from '../../services/solicitudes.service';
import { Solicitud, Catorcena } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { CreateSolicitudModal } from './CreateSolicitudModal';
import { ViewSolicitudModal, StatusModal, AtenderModal } from './SolicitudModals';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketSolicitudes } from '../../hooks/useSocket';

// Filter Chip Component with Search - same as ClientesPage
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

const SOLICITUD_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'id', label: 'ID', type: 'number' },
  { field: 'razon_social', label: 'Cliente', type: 'string' },
  { field: 'cuic', label: 'CUIC', type: 'string' },
  { field: 'descripcion', label: 'Descripción', type: 'string' },
  { field: 'marca_nombre', label: 'Marca', type: 'string' },
  { field: 'presupuesto', label: 'Presupuesto', type: 'number' },
  { field: 'asignado', label: 'Asignado', type: 'string' },
  { field: 'status', label: 'Status', type: 'string' },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string; forTypes: ('string' | 'number')[] }[] = [
  { value: '=', label: 'Igual a', forTypes: ['string', 'number'] },
  { value: '!=', label: 'Diferente de', forTypes: ['string', 'number'] },
  { value: 'contains', label: 'Contiene', forTypes: ['string'] },
  { value: 'not_contains', label: 'No contiene', forTypes: ['string'] },
  { value: '>', label: 'Mayor que', forTypes: ['number'] },
  { value: '<', label: 'Menor que', forTypes: ['number'] },
  { value: '>=', label: 'Mayor o igual', forTypes: ['number'] },
  { value: '<=', label: 'Menor o igual', forTypes: ['number'] },
];

// Function to apply advanced filters to data
function applyAdvancedFilters<T>(data: T[], filters: AdvancedFilterCondition[]): T[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = (item as Record<string, unknown>)[filter.field];
      const filterValue = filter.value;

      if (!filterValue) return true; // Empty filter value matches all

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

  // Sync temp state when props change
  useEffect(() => {
    setTempYearInicio(yearInicio);
    setTempYearFin(yearFin);
    setTempCatorcenaInicio(catorcenaInicio);
    setTempCatorcenaFin(catorcenaFin);
  }, [yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  const years = catorcenasData?.years || [];

  const yearInicioOptions = useMemo(() => {
    if (tempYearFin) {
      return years.filter(y => y <= tempYearFin);
    }
    return years;
  }, [years, tempYearFin]);

  const yearFinOptions = useMemo(() => {
    if (tempYearInicio) {
      return years.filter(y => y >= tempYearInicio);
    }
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

  const isActive = yearInicio !== undefined && yearFin !== undefined && catorcenaInicio !== undefined && catorcenaFin !== undefined;
  const canApply = tempYearInicio !== undefined && tempYearFin !== undefined && tempCatorcenaInicio !== undefined && tempCatorcenaFin !== undefined;

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
              {/* Año Inicio y Catorcena Inicio */}
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
                  <label className="text-[10px] text-zinc-500 mb-1 block">Cat. Inicio</label>
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

              {/* Año Fin y Catorcena Fin */}
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
                  <label className="text-[10px] text-zinc-500 mb-1 block">Cat. Fin</label>
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
  onToggle
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      onClick={onToggle}
      className="bg-purple-500/10 border-b border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors"
    >
      <td colSpan={9} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-400" />
          )}
          <span className="font-semibold text-white">{groupName || 'Sin asignar'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
            {count} solicitudes
          </span>
        </div>
      </td>
    </tr>
  );
}

// Status badge colors (dynamic)
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Pendiente': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Aprobada': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Rechazada': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'Atendida': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'En Proceso': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  'Cancelada': { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30' },
};

// Default colors for unknown status
const DEFAULT_STATUS_COLOR = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };

// Chart colors for dynamic status
const CHART_COLORS = [
  '#8b5cf6', // violet-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
];

export function SolicitudesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // WebSocket para actualizaciones en tiempo real
  useSocketSolicitudes();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterCondition[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewSolicitudId, setViewSolicitudId] = useState<number | null>(null);
  const [editSolicitud, setEditSolicitud] = useState<Solicitud | null>(null);

  const [statusSolicitud, setStatusSolicitud] = useState<Solicitud | null>(null);

  // Handle URL params: viewId opens view modal, commentsId opens comments modal, editId opens edit modal
  useEffect(() => {
    const viewIdParam = searchParams.get('viewId');
    const commentsIdParam = searchParams.get('commentsId');
    const editIdParam = searchParams.get('editId');
    const searchParam = searchParams.get('search');

    if (editIdParam) {
      const id = parseInt(editIdParam, 10);
      if (!isNaN(id)) {
        // Fetch solicitud and open edit modal
        solicitudesService.getById(id).then((solicitud) => {
          setEditSolicitud(solicitud);
        }).catch(console.error);
      }
      setSearchParams({}, { replace: true });
    } else if (viewIdParam) {
      const id = parseInt(viewIdParam, 10);
      if (!isNaN(id)) {
        setViewSolicitudId(id);
      }
      setSearchParams({}, { replace: true });
    } else if (commentsIdParam) {
      const id = parseInt(commentsIdParam, 10);
      if (!isNaN(id)) {
        // Fetch solicitud and open comments modal
        solicitudesService.getById(id).then((solicitud) => {
          setStatusSolicitud(solicitud);
        }).catch(console.error);
      }
      setSearchParams({}, { replace: true });
    } else if (searchParam) {
      setSearch(searchParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [atenderSolicitud, setAtenderSolicitud] = useState<Solicitud | null>(null);
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch catorcenas for filter (get all years)
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });

  // Fetch stats with year range
  const { data: stats } = useQuery({
    queryKey: ['solicitudes-stats', yearInicio, yearFin, catorcenaInicio, catorcenaFin],
    queryFn: () => solicitudesService.getStats({ yearInicio, yearFin, catorcenaInicio, catorcenaFin }),
  });

  // Fetch solicitudes
  const { data, isLoading } = useQuery({
    queryKey: ['solicitudes', page, status, debouncedSearch, yearInicio, yearFin, catorcenaInicio, catorcenaFin, sortBy, sortOrder, groupBy],
    queryFn: () =>
      solicitudesService.getAll({
        page,
        limit,
        status: status || undefined,
        search: debouncedSearch || undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        sortBy,
        sortOrder,
        groupBy: groupBy || undefined,
      }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => solicitudesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      setDeleteId(null);
    },
  });

  // Get all unique status from stats
  const allStatuses = useMemo(() => {
    if (!stats?.byStatus) return [];
    return Object.keys(stats.byStatus).sort();
  }, [stats]);

  // Chart data from dynamic stats
  const chartData = useMemo(() => {
    if (!stats?.byStatus) return null;
    const entries = Object.entries(stats.byStatus);
    if (entries.length === 0) return null;

    return entries.map(([statusName, count], index) => ({
      label: statusName,
      value: count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      percent: stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : '0',
    }));
  }, [stats]);

  // Mini Donut Chart Component - compact version
  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/90 border border-zinc-700/50 p-3 rounded-xl shadow-xl backdrop-blur-xl">
          <p className="text-white font-medium mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
            <span className="text-zinc-300 text-sm">
              {payload[0].value} solicitudes ({payload[0].payload.percent}%)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle export CSV - exports only visible/filtered data
  const handleExportCSV = () => {
    // Use filtered data if advanced filters are applied, otherwise use current page data
    const dataToExport = advancedFilters.length > 0 ? filteredData : (data?.data || []);

    if (dataToExport.length === 0) {
      return;
    }

    const headers = ['ID', 'Fecha', 'Cliente', 'CUIC', 'Descripcion', 'Marca', 'Presupuesto', 'Asignado', 'Status'];
    const rows = dataToExport.map(s => [
      s.id,
      formatDate(s.fecha),
      s.razon_social || '',
      s.cuic || '',
      s.descripcion || '',
      s.marca_nombre || '',
      s.presupuesto,
      s.asignado || '',
      s.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `solicitudes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

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

  // Group data
  const groupedData = useMemo(() => {
    if (!groupBy || !data?.data) return null;

    const groupKey = groupBy as keyof Solicitud;
    const groups: Record<string, Solicitud[]> = {};

    data.data.forEach(item => {
      const key = String(item[groupKey] || 'Sin asignar');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [data, groupBy]);

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

  const hasPeriodFilter = yearInicio !== undefined && yearFin !== undefined;
  const hasActiveFilters = !!(status || hasPeriodFilter || groupBy || sortBy !== 'fecha' || advancedFilters.length > 0);

  // Get unique values for each field (for advanced filter dropdowns)
  const getUniqueFieldValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!data?.data) return valuesMap;

    SOLICITUD_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      data.data.forEach(item => {
        const val = item[fieldConfig.field as keyof Solicitud];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [data?.data]);

  // Apply advanced filters to data
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    return applyAdvancedFilters(data.data, advancedFilters);
  }, [data?.data, advancedFilters]);

  // Advanced filter functions
  const addAdvancedFilter = () => {
    const newFilter: AdvancedFilterCondition = {
      id: `filter-${Date.now()}`,
      field: SOLICITUD_FILTER_FIELDS[0].field,
      operator: '=',
      value: '',
    };
    setAdvancedFilters(prev => [...prev, newFilter]);
  };

  const updateAdvancedFilter = (id: string, updates: Partial<AdvancedFilterCondition>) => {
    setAdvancedFilters(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeAdvancedFilter = (id: string) => {
    setAdvancedFilters(prev => prev.filter(f => f.id !== id));
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters([]);
  };

  const clearAllFilters = () => {
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setSortBy('fecha');
    setSortOrder('desc');
    setGroupBy('');
    setExpandedGroups(new Set());
    setAdvancedFilters([]);
    setPage(1);
  };

  const renderSolicitudRow = (item: Solicitud, index: number) => {
    const statusColor = STATUS_COLORS[item.status] || DEFAULT_STATUS_COLOR;

    // Button enable/disable logic based on status
    const isDesactivada = item.status === 'Desactivada';
    const isAprobada = item.status === 'Aprobada' || item.status === 'Aprobada';
    const isAjustar = item.status === 'Ajustar';
    const isAtendida = item.status === 'Atendida';

    // Ver: siempre activo
    const canView = true;
    // Editar: activo si no está Desactivada, no está Aprobada, no está Atendida
    const canEdit = !isDesactivada && !isAprobada && !isAtendida;
    // Atender: solo activo si está Aprobada
    const canAtender = isAprobada;
    // Estatus: bloqueado si está Atendida
    const canChangeStatus = !isAtendida;
    // Eliminar: solo si no está Desactivada, Aprobada o Atendida
    const canDelete = !isDesactivada && !isAprobada && !isAtendida;

    return (
      <tr key={`sol-${item.id}-${index}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
        <td className="px-4 py-3">
          <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">#{item.id}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-zinc-400 text-sm">{formatDate(item.fecha)}</span>
        </td>
        <td className="px-4 py-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">{item.razon_social || '-'}</span>
              {item.sap_database && (
                <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                  item.sap_database === 'CIMU' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  item.sap_database === 'TEST' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>{item.sap_database}</span>
              )}
            </div>
            {item.cuic && (
              <div className="text-xs text-zinc-500">CUIC: {item.cuic}</div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="max-w-[200px] truncate block text-zinc-400 text-xs">{item.descripcion || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-fuchsia-300 text-xs">{item.marca_nombre || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-emerald-400">{formatCurrency(item.presupuesto)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-zinc-300 text-xs">{item.asignado || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => { e.stopPropagation(); if (canChangeStatus) setStatusSolicitud(item); }}
            disabled={!canChangeStatus}
            className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border} ${canChangeStatus ? 'hover:opacity-80 cursor-pointer' : 'opacity-60 cursor-not-allowed'} transition-opacity`}
          >
            {item.status}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {/* Ver */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewSolicitudId(item.id); }}
              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-all"
              title="Ver detalles"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* Editar */}
            {permissions.canEditSolicitudes && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditSolicitud(item); }}
                disabled={!canEdit}
                className={`p-2 rounded-lg transition-all border ${canEdit
                  ? 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300 border-zinc-500/20 hover:border-zinc-500/40'
                  : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                  }`}
                title={canEdit ? 'Editar solicitud' : 'No disponible'}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Atender */}
            {permissions.canAtenderSolicitudes && (
              <button
                onClick={(e) => { e.stopPropagation(); setAtenderSolicitud(item); }}
                disabled={!canAtender}
                className={`p-2 rounded-lg transition-all border ${canAtender
                  ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40'
                  : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                  }`}
                title={canAtender ? 'Atender solicitud' : 'Solo disponible para solicitudes aprobadas'}
              >
                <PlayCircle className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Estatus/Comentarios */}
            <button
              onClick={(e) => { e.stopPropagation(); if (canChangeStatus) setStatusSolicitud(item); }}
              disabled={!canChangeStatus}
              className={`p-2 rounded-lg transition-all border ${canChangeStatus
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border-amber-500/20 hover:border-amber-500/40'
                : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                }`}
              title={!canChangeStatus ? 'No disponible' : permissions.canChangeEstadoSolicitud ? 'Ver/Cambiar estatus' : 'Ver estatus y comentarios'}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>

            {/* Eliminar */}
            {permissions.canDeleteSolicitudes && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                disabled={!canDelete}
                className={`p-2 rounded-lg transition-all border ${canDelete
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20 hover:border-red-500/40'
                  : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30 cursor-not-allowed'
                  }`}
                title={canDelete ? 'Eliminar solicitud' : 'No disponible'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const totalPages = data?.pagination?.totalPages || 1;
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="min-h-screen">
      <Header title="Solicitudes" />

      <div className="p-6 space-y-5">
        {/* New Pro Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Main KPI: Total */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Total Solicitudes</p>
              <h3 className="text-4xl font-bold text-white tracking-tight">
                {(data?.pagination?.total ?? stats?.total ?? 0).toLocaleString()}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {(status || debouncedSearch) ? 'Filtrado' : 'Todas las catorcenas'}
              </span>
            </div>
          </div>

          {/* Chart Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-4 flex items-center relative overflow-hidden">

            {chartData ? (
              <div className="w-full h-[140px] flex items-center">
                <div className="h-full min-w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend / List */}
                <div className="flex-1 flex flex-wrap gap-2 content-center pl-4 h-full overflow-y-auto custom-scrollbar">
                  {chartData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/50 min-w-[120px]">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <div className="text-sm font-bold text-white">{item.value}</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wide truncate max-w-[80px]" title={item.label}>{item.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full h-[140px] flex items-center justify-center text-zinc-500 text-sm">
                Cargando datos...
              </div>
            )}
          </div>

          {/* KPI: Pendientes Priority */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Pendientes / En Proceso</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-amber-400">
                  {((stats?.byStatus['Pendiente'] || 0) + (stats?.byStatus['En Proceso'] || 0)).toLocaleString()}
                </h3>
                <span className="text-xs text-amber-500/80 font-medium">Atención requerida</span>
              </div>
            </div>

            {/* Progress bar visual */}
            <div className="mt-4 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${Math.min(100, (((stats?.byStatus['Pendiente'] || 0) + (stats?.byStatus['En Proceso'] || 0)) / (stats?.total || 1)) * 100)}%` }}
              />
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
                  placeholder="Buscar cliente, descripcion, marca..."
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

              {/* Nueva Solicitud */}
              {permissions.canCreateSolicitudes && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Solicitud
                </button>
              )}
            </div>

            {/* Filters Row (Expandable) */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/50 relative z-50">
                {/* Advanced Filter Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      advancedFilters.length > 0
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                    }`}
                    title="Filtros avanzados"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtrar</span>
                    {advancedFilters.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-800 text-[10px]">
                        {advancedFilters.length}
                      </span>
                    )}
                  </button>
                  {showAdvancedFilters && (
                    <div className="absolute left-0 top-full mt-1 z-[100] w-[520px] bg-zinc-900 border border-purple-500/30 rounded-xl shadow-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-purple-300">Filtros avanzados</span>
                        <button
                          onClick={() => setShowAdvancedFilters(false)}
                          className="text-zinc-500 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {advancedFilters.map((filter, index) => (
                          <div key={filter.id} className="flex items-center gap-2">
                            {index > 0 && (
                              <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>
                            )}
                            {index === 0 && <span className="w-8"></span>}
                            <select
                              value={filter.field}
                              onChange={(e) => updateAdvancedFilter(filter.id, { field: e.target.value })}
                              className="w-[120px] text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              {SOLICITUD_FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateAdvancedFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className="w-[100px] text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              {FILTER_OPERATORS.filter(op => {
                                const fieldConfig = SOLICITUD_FILTER_FIELDS.find(f => f.field === filter.field);
                                return fieldConfig && op.forTypes.includes(fieldConfig.type);
                              }).map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.value}
                              onChange={(e) => updateAdvancedFilter(filter.id, { value: e.target.value })}
                              className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              <option value="">Seleccionar...</option>
                              {getUniqueFieldValues[filter.field]?.map((val) => (
                                <option key={val} value={val}>{val}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeAdvancedFilter(filter.id)}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {advancedFilters.length === 0 && (
                          <p className="text-xs text-zinc-500 text-center py-4">
                            Sin filtros avanzados. Haz clic en "Añadir" para crear uno.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                        <button
                          onClick={addAdvancedFilter}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                        >
                          <Plus className="h-3 w-3" />
                          Añadir
                        </button>
                        <button
                          onClick={clearAdvancedFilters}
                          disabled={advancedFilters.length === 0}
                          className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Limpiar
                        </button>
                      </div>
                      {advancedFilters.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <span className="text-[10px] text-zinc-500">
                            {filteredData.length} de {data?.data?.length || 0} registros
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                {/* Status Filter */}
                <span className="text-xs text-zinc-500 mr-1">Status:</span>
                <FilterChip
                  label="Status"
                  options={allStatuses}
                  value={status}
                  onChange={(val) => { setStatus(val); setPage(1); }}
                  onClear={() => { setStatus(''); setPage(1); }}
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

                {/* Sort */}
                <span className="text-xs text-zinc-500 mr-1">
                  <ArrowUpDown className="h-3 w-3 inline mr-1" />
                  Ordenar:
                </span>
                <FilterChip
                  label="Campo"
                  options={['fecha', 'presupuesto', 'razon_social', 'status']}
                  value={sortBy}
                  onChange={(val) => { setSortBy(val); setPage(1); }}
                  onClear={() => { setSortBy('fecha'); setPage(1); }}
                />
                <FilterChip
                  label="Orden"
                  options={['desc', 'asc']}
                  value={sortOrder}
                  onChange={(val) => { setSortOrder(val as 'asc' | 'desc'); setPage(1); }}
                  onClear={() => { setSortOrder('desc'); setPage(1); }}
                />

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                {/* Group By */}
                <span className="text-xs text-zinc-500 mr-1">
                  <Layers className="h-3 w-3 inline mr-1" />
                  Agrupar:
                </span>
                <FilterChip
                  label="Sin agrupar"
                  options={['status', 'marca_nombre', 'asignado', 'razon_social']}
                  value={groupBy}
                  onChange={(val) => { setGroupBy(val); setExpandedGroups(new Set()); setPage(1); }}
                  onClear={() => { setGroupBy(''); setExpandedGroups(new Set()); setPage(1); }}
                />

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Badge */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
              <Filter className="h-3.5 w-3.5" />
              {total} resultados
              {groupBy && <span className="text-zinc-500">| Agrupado por {groupBy}</span>}
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5 relative z-10">
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Descripcion</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Presupuesto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Asignado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider"></th>
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
                          />
                          {expandedGroups.has(groupName) && items.map((item, idx) => renderSolicitudRow(item, idx))}
                        </React.Fragment>
                      ))
                    ) : (
                      (advancedFilters.length > 0 ? filteredData : data?.data)?.map((item, idx) => renderSolicitudRow(item, idx))
                    )}
                    {(advancedFilters.length > 0 ? filteredData.length === 0 : (!data?.data || data.data.length === 0)) && !groupedData && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10">
                              <FileText className="w-6 h-6 text-purple-400" />
                            </div>
                            <span className="text-zinc-500 text-sm">No se encontraron solicitudes</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!groupBy && data?.pagination && totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
                  <span className="text-sm text-purple-300/70">
                    Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{totalPages}</span>
                    <span className="text-purple-300/50 ml-2">({data.pagination.total} total)</span>
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
              {groupBy && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20">
                  <span className="text-xs text-zinc-500">
                    Mostrando {data?.data?.length || 0} solicitudes agrupadas
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Confirmar eliminacion</h3>
            <p className="text-zinc-400 mb-6">
              Estas seguro de que deseas eliminar esta solicitud? Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Solicitud Modal */}
      <CreateSolicitudModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Edit Solicitud Modal - using CreateSolicitudModal in edit mode */}
      <CreateSolicitudModal
        isOpen={!!editSolicitud}
        onClose={() => setEditSolicitud(null)}
        editSolicitudId={editSolicitud?.id}
      />

      {/* View Solicitud Modal */}
      <ViewSolicitudModal
        isOpen={!!viewSolicitudId}
        onClose={() => setViewSolicitudId(null)}
        solicitudId={viewSolicitudId}
        onEdit={permissions.canEditSolicitudes ? () => {
          const sol = data?.data?.find((s: Solicitud) => s.id === viewSolicitudId);
          if (sol) { setViewSolicitudId(null); setEditSolicitud(sol); }
        } : undefined}
        onAtender={permissions.canAtenderSolicitudes ? () => {
          const sol = data?.data?.find((s: Solicitud) => s.id === viewSolicitudId);
          if (sol) { setViewSolicitudId(null); setAtenderSolicitud(sol); }
        } : undefined}
        onStatus={() => {
          const sol = data?.data?.find((s: Solicitud) => s.id === viewSolicitudId);
          if (sol) { setViewSolicitudId(null); setStatusSolicitud(sol); }
        }}
        canEdit={(() => {
          const sol = data?.data?.find((s: Solicitud) => s.id === viewSolicitudId);
          if (!sol) return false;
          return sol.status !== 'Desactivada' && sol.status !== 'Aprobada' && sol.status !== 'Atendida';
        })()}
        canAtender={(() => {
          const sol = data?.data?.find((s: Solicitud) => s.id === viewSolicitudId);
          return sol?.status === 'Aprobada';
        })()}
      />

      {/* Status Modal */}
      <StatusModal
        isOpen={!!statusSolicitud}
        onClose={() => setStatusSolicitud(null)}
        solicitud={statusSolicitud}
        onStatusChange={() => {
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
          queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
          setStatusSolicitud(null);
        }}
        statusReadOnly={!permissions.canChangeEstadoSolicitud}
      />

      {/* Atender Modal */}
      <AtenderModal
        isOpen={!!atenderSolicitud}
        onClose={() => setAtenderSolicitud(null)}
        solicitud={atenderSolicitud}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
          queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
        }}
      />
    </div>
  );
}
