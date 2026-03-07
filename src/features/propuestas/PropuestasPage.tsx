import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Download, Filter, ChevronDown, ChevronRight, X, SlidersHorizontal,
  ArrowUpDown, Calendar, DollarSign, FileText, Building2, MessageSquare,
  CheckCircle, Users, Send, Loader2, User, Share2, MapPinned, Wrench, Clock,
  Pencil, Trash2, Package, MapPin, Eye, Plus, AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Header } from '../../components/layout/Header';
import { propuestasService, PropuestaComentario } from '../../services/propuestas.service';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { Propuesta, Catorcena } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { AssignInventarioModal } from './AssignInventarioModal';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketEquipos, useSocketPropuestas } from '../../hooks/useSocket';

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function getMonthShort(dateStr: string): string {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? `${MESES_LABEL[d.getMonth()]} ${d.getFullYear()}` : '-';
}

// Status badge colors
const getStatusColors = (isDark: boolean): Record<string, { bg: string; text: string; border: string }> => ({
  'Abierto': { bg: isDark ? 'bg-blue-500/20' : 'bg-blue-50', text: isDark ? 'text-blue-300' : 'text-blue-700', border: 'border-blue-500/30' },
  'Ajuste Cto-Cliente': { bg: isDark ? 'bg-orange-500/20' : 'bg-orange-50', text: isDark ? 'text-orange-300' : 'text-orange-700', border: 'border-orange-500/30' },
  'Pase a ventas': { bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-50', text: isDark ? 'text-emerald-300' : 'text-emerald-700', border: 'border-emerald-500/30' },
  'Atendido': { bg: isDark ? 'bg-cyan-500/20' : 'bg-cyan-50', text: isDark ? 'text-cyan-300' : 'text-cyan-700', border: 'border-cyan-500/30' },
  // Legacy (datos históricos)
  'Pendiente': { bg: isDark ? 'bg-amber-500/20' : 'bg-amber-50', text: isDark ? 'text-amber-300' : 'text-amber-700', border: 'border-amber-500/30' },
  'Por aprobar': { bg: isDark ? 'bg-amber-500/20' : 'bg-amber-50', text: isDark ? 'text-amber-300' : 'text-amber-700', border: 'border-amber-500/30' },
  'Activa': { bg: isDark ? 'bg-green-500/20' : 'bg-green-50', text: isDark ? 'text-green-300' : 'text-green-700', border: 'border-green-500/30' },
  'Aprobada': { bg: isDark ? 'bg-green-500/20' : 'bg-green-50', text: isDark ? 'text-green-300' : 'text-green-700', border: 'border-green-500/30' },
  'Rechazada': { bg: isDark ? 'bg-red-500/20' : 'bg-red-50', text: isDark ? 'text-red-300' : 'text-red-700', border: 'border-red-500/30' },
});

const getDefaultStatusColor = (isDark: boolean) => ({ bg: isDark ? 'bg-violet-500/20' : 'bg-violet-50', text: isDark ? 'text-violet-300' : 'text-violet-700', border: 'border-violet-500/30' });

const STATUS_OPTIONS = ['Atendido', 'Abierto', 'Ajuste Cto-Cliente', 'Pase a ventas'];

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

// Custom Tooltip for Chart
const CustomChartTooltip = ({ active, payload, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`${isDark ? 'bg-zinc-900/90 border-zinc-700/50' : 'bg-white border-gray-200'} border p-3 rounded-xl shadow-xl backdrop-blur-xl`}>
        <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium mb-1`}>{payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm`}>
            {payload[0].value} propuestas ({payload[0].payload.percent}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Filter Chip Component with Search
function FilterChip({
  label,
  options,
  value,
  onChange,
  onClear,
  isDark
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isDark: boolean;
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
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
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
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-gray-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <input
                type="text"
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50`}
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

const PROPUESTA_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'id', label: 'ID', type: 'number' },
  { field: 'cliente_nombre', label: 'Cliente', type: 'string' },
  { field: 'descripcion', label: 'Descripción', type: 'string' },
  { field: 'inversion', label: 'Inversión', type: 'number' },
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
  onClear,
  isDark
}: {
  catorcenasData: { years: number[]; data: Catorcena[] } | undefined;
  yearInicio: number | undefined;
  yearFin: number | undefined;
  catorcenaInicio: number | undefined;
  catorcenaFin: number | undefined;
  onApply: (yearInicio: number, yearFin: number, catorcenaInicio?: number, catorcenaFin?: number) => void;
  onClear: () => void;
  isDark: boolean;
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
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
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
          <div className={`absolute top-full left-0 mt-1.5 z-50 w-80 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-gray-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <Calendar className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Filtro de Periodo
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>Todos los campos son obligatorios</p>
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
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearInicioOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Inicio *</label>
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
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Seleccionar</option>
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
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearFinOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Fin *</label>
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
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Seleccionar</option>
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
  isDark
}: {
  groupName: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  return (
    <tr
      onClick={onToggle}
      className={`${isDark ? 'bg-purple-500/10 border-b border-purple-500/20 hover:bg-purple-500/20' : 'bg-purple-50 border-b border-purple-200 hover:bg-purple-100'} cursor-pointer transition-colors`}
    >
      <td colSpan={11} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          )}
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupName || 'Sin asignar'}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
            {count} propuestas
          </span>
        </div>
      </td>
    </tr>
  );
}

// ============ STATUS MODAL WITH COMMENTS ============
interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  propuesta: Propuesta | null;
  onStatusChange: () => void;
  allowedStatuses?: string[] | null; // null = todos, array = solo esos
}

function StatusModal({ isOpen, onClose, propuesta, onStatusChange, allowedStatuses }: StatusModalProps) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  // Filtrar opciones de estatus según permisos
  const availableStatuses = allowedStatuses ? STATUS_OPTIONS.filter(s => allowedStatuses.includes(s)) : STATUS_OPTIONS;
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Query para obtener las caras de la propuesta y verificar autorizaciones pendientes
  const { data: caras } = useQuery({
    queryKey: ['propuesta-caras', propuesta?.id],
    queryFn: () => propuestasService.getCaras(propuesta!.id),
    enabled: isOpen && !!propuesta,
  });

  // Verificar si hay caras pendientes de autorización
  const pendientesDg = caras?.filter(c => c.autorizacion_dg === 'pendiente').length || 0;
  const pendientesDcm = caras?.filter(c => c.autorizacion_dcm === 'pendiente').length || 0;
  const tienePendientes = pendientesDg > 0 || pendientesDcm > 0;

  // Query para obtener las reservas y verificar si están completas
  const { data: reservas } = useQuery({
    queryKey: ['propuesta-reservas-modal', propuesta?.id],
    queryFn: () => propuestasService.getReservasForModal(propuesta!.id),
    enabled: isOpen && !!propuesta,
  });

  // Verificar si todas las caras tienen sus reservas completas
  const reservasIncompletas = useMemo(() => {
    if (!caras || !reservas) return false;
    return caras.some(cara => {
      const caraReservas = reservas.filter(r => r.solicitud_cara_id === cara.id);
      const flujoReservado = caraReservas.filter(r => r.tipo_de_cara === 'A' || r.tipo_de_cara === 'Flujo').length;
      const contraflujoReservado = caraReservas.filter(r => r.tipo_de_cara === 'B' || r.tipo_de_cara === 'Contraflujo').length;
      const bonificacionReservado = caraReservas.filter(r => r.tipo_de_cara === 'Bonificacion').length;
      const flujoRequerido = cara.caras_flujo || 0;
      const contraflujoRequerido = cara.caras_contraflujo || 0;
      const bonificacionRequerido = cara.bonificacion || 0;
      return flujoReservado !== flujoRequerido || contraflujoReservado !== contraflujoRequerido || bonificacionReservado !== bonificacionRequerido;
    });
  }, [caras, reservas]);

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['propuesta-comments', propuesta?.id],
    queryFn: () => propuestasService.getComments(propuesta!.id),
    enabled: isOpen && !!propuesta,
    staleTime: 60000, // 1 minuto - evita refetches innecesarios
  });

  // Reset comments when propuesta changes
  useEffect(() => {
    if (isOpen && propuesta?.id) {
      queryClient.invalidateQueries({ queryKey: ['propuesta-comments', propuesta.id] });
    }
  }, [propuesta?.id, isOpen, queryClient]);

  const addCommentMutation = useMutation({
    mutationFn: ({ id, comentario }: { id: number; comentario: string }) =>
      propuestasService.addComment(id, comentario),
    onSuccess: () => {
      setNewComment('');
      refetchComments();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      propuestasService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'] });
      onStatusChange();
    },
  });

  useEffect(() => {
    if (propuesta) {
      setSelectedStatus(propuesta.status);
    }
  }, [propuesta]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleAddComment = () => {
    if (!newComment.trim() || !propuesta) return;
    addCommentMutation.mutate({ id: propuesta.id, comentario: newComment });
  };

  const handleChangeStatus = () => {
    if (!propuesta || selectedStatus === propuesta.status) return;
    updateStatusMutation.mutate({ id: propuesta.id, status: selectedStatus });
  };

  if (!isOpen || !propuesta) return null;

  const STATUS_COLORS = getStatusColors(isDark);
  const DEFAULT_STATUS_COLOR = getDefaultStatusColor(isDark);
  const statusColor = STATUS_COLORS[propuesta.status] || DEFAULT_STATUS_COLOR;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <MessageSquare className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Estado y Comentarios</h2>
            <span className={`px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
              {propuesta.status}
            </span>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors`}>
            <X className={`h-5 w-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Status Selector */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-zinc-800 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'}`}>
          {/* Alerta de autorizaciones pendientes */}
          {tienePendientes && (
            <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border flex items-start gap-3`}>
              <AlertTriangle className={`h-5 w-5 ${isDark ? 'text-amber-400' : 'text-amber-600'} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Autorización pendiente</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-amber-300/70' : 'text-amber-700'}`}>
                  Esta propuesta tiene {pendientesDg + pendientesDcm} cara(s) pendientes de autorización.
                  {pendientesDg > 0 && ` DG: ${pendientesDg}.`}
                  {pendientesDcm > 0 && ` DCM: ${pendientesDcm}.`}
                  {' '}No se puede cambiar a "Pase a ventas" o "Aprobada" hasta que todas las caras sean autorizadas.
                </p>
              </div>
            </div>
          )}
          {reservasIncompletas && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm ${isDark ? 'text-red-200' : 'text-red-700'} font-medium`}>Reservas incompletas</p>
                <p className={`text-xs ${isDark ? 'text-red-300/70' : 'text-red-600/70'} mt-1`}>
                  No todos los grupos tienen sus reservas completas. No se puede cambiar a "Pase a ventas" o "Aprobada" hasta completar el inventario.
                </p>
              </div>
            </div>
          )}
          <label className={`block text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-2`}>Cambiar estado a:</label>
          <div className="flex items-center gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
            >
              {/* Mostrar estado actual si no está en las opciones permitidas */}
              {propuesta.status && !availableStatuses.includes(propuesta.status) && (
                <option value={propuesta.status} disabled>{propuesta.status} (actual)</option>
              )}
              {availableStatuses.map(s => {
                const isBlockedByAuth = (tienePendientes || reservasIncompletas) && (s === 'Aprobada' || s === 'Pase a ventas');
                return (
                  <option
                    key={s}
                    value={s}
                    disabled={isBlockedByAuth}
                  >
                    {s}{isBlockedByAuth ? (reservasIncompletas ? ' (Reservas incompletas)' : ' (Requiere autorización)') : ''}
                  </option>
                );
              })}
            </select>
            <button
              onClick={handleChangeStatus}
              disabled={selectedStatus === propuesta.status || updateStatusMutation.isPending || ((tienePendientes || reservasIncompletas) && (selectedStatus === 'Aprobada' || selectedStatus === 'Pase a ventas'))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] justify-center"
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar'
              )}
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {comments && comments.length > 0 ? (
            comments.slice().reverse().map((comment: PropuestaComentario) => (
              <div key={comment.id} className="flex gap-3">
                <UserAvatar nombre={comment.autor_nombre} foto_perfil={comment.autor_foto} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{comment.autor_nombre}</span>
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                      {new Date(comment.creado_en).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className={`${isDark ? 'bg-zinc-800/50 text-zinc-300' : 'bg-gray-50 text-gray-700'} rounded-xl px-4 py-3 text-sm`}>
                    {comment.comentario}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={`text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} py-8`}>
              No hay comentarios aún
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* New Comment Input */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-end gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              className={`flex-1 px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'} border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none`}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ APPROVE MODAL ============
interface ApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  propuesta: Propuesta | null;
  onSuccess: () => void;
}

// Puestos permitidos en el modal de aprobar propuesta
const ALLOWED_PUESTOS_APROBAR = [
  'Analista de Servicio al Cliente',
  'Coordinador de Diseño',
  'Diseñadores',
  'Diseñador',
];

function ApproveModal({ isOpen, onClose, propuesta, onSuccess }: ApproveModalProps) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const [precio, setPrecio] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<{ id: number; nombre: string }[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // WebSocket para actualizar usuarios en tiempo real
  useSocketEquipos();

  // Fetch all users to identify Tráfico users for exclusion from pre-selection
  const { data: allUsers } = useQuery({
    queryKey: ['solicitudes-users', 'all-users-approve'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: isOpen,
  });

  // Fetch team-filtered users for the selectable list
  const { data: teamUsers } = useQuery({
    queryKey: ['solicitudes-users', 'team-filtered-approve'],
    queryFn: () => solicitudesService.getUsers(undefined, true),
    enabled: isOpen,
  });

  const approveMutation = useMutation({
    mutationFn: () => propuestasService.approve(propuesta!.id, {
      precio_simulado: precio ? parseFloat(precio) : undefined,
      asignados: selectedUsers.map(u => u.nombre).join(', '),
      id_asignados: selectedUsers.map(u => u.id).join(','),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      onSuccess();
      onClose();
    },
  });

  // Initialize with: 1) Original assignees (except Tráfico) + 2) All team users with allowed positions
  useEffect(() => {
    if (propuesta && isOpen && allUsers && teamUsers) {
      setPrecio(propuesta.precio_simulado?.toString() || propuesta.precio?.toString() || '');

      const combinedUsers: { id: number; nombre: string }[] = [];
      const addedIds = new Set<number>();

      // Get IDs of Tráfico area/puesto users to exclude them
      const traficoUserIds = new Set(
        allUsers
          .filter(u => {
            const area = u.area?.toLowerCase() || '';
            const puesto = u.puesto?.toLowerCase() || '';
            return area.includes('tráfico') || area.includes('trafico') ||
                   puesto.includes('tráfico') || puesto.includes('trafico');
          })
          .map(u => u.id)
      );

      // 1. Add original assigned users, excluding Tráfico
      if (propuesta.asignado && propuesta.id_asignado) {
        const nombres = propuesta.asignado.split(',').map(n => n.trim());
        const ids = propuesta.id_asignado.split(',').map(id => parseInt(id.trim()));
        ids.forEach((id, idx) => {
          if (!traficoUserIds.has(id) && !addedIds.has(id) && nombres[idx]) {
            combinedUsers.push({ id, nombre: nombres[idx] });
            addedIds.add(id);
          }
        });
      }

      // 2. Add all team users with allowed positions (if not already added)
      teamUsers.forEach(u => {
        const hasAllowedPuesto = ALLOWED_PUESTOS_APROBAR.some(
          puesto => u.puesto?.toLowerCase() === puesto.toLowerCase()
        );
        if (hasAllowedPuesto && !addedIds.has(u.id)) {
          combinedUsers.push({ id: u.id, nombre: u.nombre });
          addedIds.add(u.id);
        }
      });

      setSelectedUsers(combinedUsers);
    }
  }, [propuesta, isOpen, allUsers, teamUsers]);

  const filteredUsers = useMemo(() => {
    if (!teamUsers) return [];
    // Filter by allowed positions (from MY TEAM) and apply search filter
    return teamUsers.filter((u: UserOption) => {
      // Check if user has an allowed position
      const hasAllowedPuesto = ALLOWED_PUESTOS_APROBAR.some(
        puesto => u.puesto?.toLowerCase() === puesto.toLowerCase()
      );
      if (!hasAllowedPuesto) return false; // Only show users with allowed positions

      // Apply search filter
      return u.nombre.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.area?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.puesto?.toLowerCase().includes(userSearch.toLowerCase());
    });
  }, [teamUsers, userSearch]);

  const toggleUser = (user: UserOption) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, { id: user.id, nombre: user.nombre }];
      }
    });
  };

  if (!isOpen || !propuesta) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} bg-gradient-to-r from-emerald-600/20 to-green-600/10`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Aprobar Propuesta</h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>#{propuesta.id}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors`}>
            <X className={`h-5 w-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Asignados */}
          <div>
            <label className={`block text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-2`}>
              <Users className="h-4 w-4 inline mr-1" />
              Asignados ({selectedUsers.length})
            </label>

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedUsers.map(u => (
                  <span
                    key={u.id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                  >
                    {u.nombre}
                    <X
                      className={`h-3 w-3 cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
                      onClick={() => setSelectedUsers(prev => prev.filter(x => x.id !== u.id))}
                    />
                  </span>
                ))}
              </div>
            )}

            {/* Search users */}
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar usuarios..."
              className={`w-full px-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
            />

            {/* Users list */}
            <div className={`max-h-48 overflow-y-auto rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'}`}>
              {filteredUsers.map((user: UserOption) => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left ${isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-gray-200'} transition-colors ${isSelected ? 'bg-emerald-500/10' : ''}`}
                  >
                    <div>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.nombre}</p>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{user.area} - {user.puesto}</p>
                    </div>
                    {isSelected && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className={`${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Al aprobar esta propuesta:</p>
            <ul className={`text-xs space-y-1 ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
              <li>• Se actualizarán las reservas de inventario</li>
              <li>• La cotización y campaña se activarán</li>
              <li>• Se crearán tareas de seguimiento</li>
              <li>• Se notificará al creador de la solicitud</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex justify-end gap-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'} text-sm border`}
          >
            Cancelar
          </button>
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 flex items-center gap-2"
          >
            {approveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Aprobar Propuesta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


export function PropuestasPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // Socket para actualizar usuarios en tiempo real
  useSocketEquipos();
  // Socket para actualizar propuestas cuando cambian autorizaciones
  useSocketPropuestas();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState('');
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
  const [comboboxOpen, setComboboxOpen] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals
  const [statusPropuesta, setStatusPropuesta] = useState<Propuesta | null>(null);
  const [approvePropuesta, setApprovePropuesta] = useState<Propuesta | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPropuestaForAssign, setSelectedPropuestaForAssign] = useState<Propuesta | null>(null);

  // Handle URL params: viewId opens modal, search fills search bar
  useEffect(() => {
    const viewIdParam = searchParams.get('viewId');
    const searchParam = searchParams.get('search');

    if (viewIdParam) {
      const id = parseInt(viewIdParam, 10);
      if (!isNaN(id)) {
        // Fetch propuesta and open modal
        propuestasService.getById(id).then((propuesta) => {
          setSelectedPropuestaForAssign(propuesta);
          setShowAssignModal(true);
        }).catch(console.error);
      }
      setSearchParams({}, { replace: true });
    } else if (searchParam) {
      setSearch(searchParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const { data: stats } = useQuery({
    queryKey: ['propuestas-stats'],
    queryFn: () => propuestasService.getStats(),
  });

  // When grouping or advanced filters are active, fetch ALL data
  const needsAllData = !!groupBy || advancedFilters.length > 0;
  const effectiveLimit = needsAllData ? 9999 : limit;

  const { data, isLoading } = useQuery({
    queryKey: ['propuestas', page, status, debouncedSearch, yearInicio, yearFin, catorcenaInicio, catorcenaFin, sortBy, sortOrder, groupBy, tipoPeriodo, needsAllData],
    queryFn: () =>
      propuestasService.getAll({
        page: needsAllData ? 1 : page,
        limit: effectiveLimit,
        status: status || undefined,
        search: debouncedSearch || undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        soloAtendidas: true,
        tipoPeriodo: tipoPeriodo || undefined,
      }),
  });

  const allStatuses = STATUS_OPTIONS;

  const hasPeriodFilter = yearInicio !== undefined && yearFin !== undefined;
  const hasActiveFilters = !!(status || tipoPeriodo || hasPeriodFilter || groupBy || sortBy !== 'fecha' || advancedFilters.length > 0);

  // Get unique values for each field (for advanced filter dropdowns)
  const getUniqueFieldValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!data?.data) return valuesMap;

    PROPUESTA_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      data.data.forEach(item => {
        const val = item[fieldConfig.field as keyof Propuesta];
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
      field: PROPUESTA_FILTER_FIELDS[0].field,
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
    setTipoPeriodo('');
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

    const groupKey = groupBy as keyof Propuesta;
    const groups: Record<string, Propuesta[]> = {};

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

  // Handle export CSV - exports only visible/filtered data
  const handleExportCSV = () => {
    const dataToExport = advancedFilters.length > 0 ? filteredData : (data?.data || []);

    if (dataToExport.length === 0) return;

    const headers = ['ID', 'Solicitud', 'Cliente', 'Artículo', 'Precio', 'Inversión', 'Asignado', 'Descripción', 'Status', 'Fecha'];
    const rows = dataToExport.map(p => [
      p.id,
      p.solicitud_id,
      p.cliente_nombre || '',
      p.articulo || '',
      p.precio || 0,
      p.inversion || 0,
      p.asignado || '',
      p.descripcion || '',
      p.status,
      formatDate(p.fecha)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `propuestas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const renderPropuestaRow = (item: Propuesta & any, index: number) => {
    const STATUS_COLORS = getStatusColors(isDark);
    const DEFAULT_STATUS_COLOR = getDefaultStatusColor(isDark);
    const statusColor = STATUS_COLORS[item.status] || DEFAULT_STATUS_COLOR;
    // Bloquear todas las acciones cuando el status es "Activa" o "Aprobada" (para todos los usuarios)
    const isActiva = item.status === 'Activa';
    const isAprobada = item.status === 'Aprobada';
    // Roles comerciales: bloquear acciones cuando el status es "Abierto"
    const rolesLockedByAbierto = ['Asesor Comercial', 'Director Comercial Aeropuerto', 'Asesor Comercial Aeropuerto'];
    const isLockedByAbierto = rolesLockedByAbierto.includes(user?.rol || '') && item.status === 'Abierto';
    const isLocked = isActiva || isLockedByAbierto || isAprobada;

    return (
      <tr key={`prop-${item.id}-${index}`} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
        <td className="px-4 py-3">
          <span className={`font-mono text-xs px-2 py-1 rounded-md ${isDark ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>#{item.id}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{formatDate(item.fecha)}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-medium`}>{item.marca_nombre || item.articulo || '-'}</span>
            {item.sap_database && (
              <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                item.sap_database === 'CIMU'
                  ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
                  : item.sap_database === 'TEST'
                    ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                    : isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>{item.sap_database}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 align-middle">
            <div className={`w-5 h-5 rounded-full ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-700'} flex items-center justify-center text-[10px]`}>
              <User className="h-3 w-3" />
            </div>
            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm`}>{item.creador_nombre || item.usuario_nombre || '-'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm truncate max-w-[250px] block`} title={item.campana_nombre || item.nombre_campania || '-'}>{item.campana_nombre || item.nombre_campania || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{item.asignado || 'Sin asignar'}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{formatCurrency(item.inversion)}</span>
        </td>
        <td className="px-4 py-3">
          {item.tipo_periodo === 'mensual' && item.fecha_inicio ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${isDark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
              <Calendar className="h-3 w-3" />
              {getMonthShort(item.fecha_inicio)}
            </span>
          ) : item.catorcena_inicio ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${isDark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
              <Calendar className="h-3 w-3" />
              Cat {item.catorcena_inicio} / {item.anio_inicio}
            </span>
          ) : (
            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>-</span>
          )}
        </td>
        <td className="px-4 py-3">
          {item.tipo_periodo === 'mensual' && item.fecha_fin ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              <Calendar className="h-3 w-3" />
              {getMonthShort(item.fecha_fin)}
            </span>
          ) : item.catorcena_fin ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              <Calendar className="h-3 w-3" />
              Cat {item.catorcena_fin} / {item.anio_fin}
            </span>
          ) : (
            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>-</span>
          )}
        </td>
        <td className="px-4 py-3">
          {permissions.canEditPropuestaStatus && !isLocked ? (
            <button
              onClick={() => setStatusPropuesta(item)}
              className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap ${statusColor.bg} ${statusColor.text} border ${statusColor.border} hover:opacity-80 transition-opacity cursor-pointer`}
            >
              {item.status}
            </button>
          ) : (
            <span className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
              {item.status}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {permissions.canAprobarPropuesta && (
              <button
                onClick={() => setApprovePropuesta(item)}
                disabled={item.status !== 'Pase a ventas' || isLocked}
                className={`p-2 rounded-lg border transition-all ${item.status !== 'Pase a ventas' || isLocked
                  ? isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                  : isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300'
                  }`}
                title={isLocked ? 'No disponible en este estatus' : (item.status !== 'Pase a ventas' ? 'Solo disponible con estatus Pase a ventas' : 'Aprobar propuesta')}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => { setSelectedPropuestaForAssign(item); setShowAssignModal(true); }}
              disabled={permissions.canAsignarInventario && (item.status === 'Aprobada' || isLocked)}
              className={`p-2 rounded-lg border transition-all ${permissions.canAsignarInventario && (item.status === 'Aprobada' || isLocked)
                ? isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                : isDark ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40' : 'bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 border-fuchsia-200 hover:border-fuchsia-300'
                }`}
              title={permissions.canAsignarInventario ? (isLocked ? 'No disponible en este estatus' : (item.status === 'Aprobada' ? 'No disponible para propuestas aprobadas' : (item.status === 'Pase a ventas' ? 'Ver Inventario (solo lectura)' : 'Asignar a Inventario'))) : 'Ver Propuesta'}
            >
              {permissions.canAsignarInventario && item.status !== 'Pase a ventas' ? <MapPinned className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            {permissions.canCompartirPropuesta && (
              <button
                disabled={(item.status !== 'Aprobada' && item.status !== 'Atendido' && item.status !== 'Pase a ventas') || isLocked}
                onClick={() => !isLocked && (item.status === 'Aprobada' || item.status === 'Atendido' || item.status === 'Pase a ventas') && navigate(`/propuestas/compartir/${item.id}`)}
                className={`p-2 rounded-lg border transition-all ${(item.status === 'Aprobada' || item.status === 'Atendido' || item.status === 'Pase a ventas') && !isLocked
                  ? isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700 border-cyan-200 hover:border-cyan-300'
                  : isDark ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                  }`}
                title={isLocked ? 'No disponible en este estatus' : (item.status === 'Aprobada' || item.status === 'Atendido' || item.status === 'Pase a ventas' ? 'Compartir propuesta' : 'Solo disponible en status Aprobada o Pase a ventas')}
              >
                <Share2 className="h-3.5 w-3.5" />
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
      <Header title="Propuestas" />

      <div className="p-6 space-y-5">
        {/* Dashboard Grid - Same style as Solicitudes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Main KPI: Total */}
          <div className={`col-span-1 md:col-span-2 lg:col-span-1 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
            <div>
              <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm font-medium mb-1`}>Total Propuestas</p>
              <h3 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                {stats?.total.toLocaleString() ?? '0'}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50' : 'bg-gray-100 text-gray-700 border-gray-200'} border`}>
                Todas las catorcenas
              </span>
            </div>
          </div>

          {/* Chart Card */}
          <div className={`col-span-1 md:col-span-2 lg:col-span-2 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-4 flex items-center relative overflow-hidden`}>

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
                      <RechartsTooltip content={<CustomChartTooltip isDark={isDark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend / List */}
                <div className="flex-1 flex flex-wrap gap-2 content-center pl-4 h-full overflow-y-auto custom-scrollbar">
                  {chartData.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border min-w-[120px]`}>
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wide truncate max-w-[80px]`} title={item.label}>{item.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`w-full h-[140px] flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                Cargando datos...
              </div>
            )}
          </div>

          {/* KPI: Por Aprobar Priority */}
          <div className={`col-span-1 rounded-2xl border ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-gray-200 bg-white'} backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group`}>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />
            <div>
              <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm font-medium mb-1`}>Sin Aprobar</p>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-3xl font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  {((stats?.total || 0) - (stats?.byStatus['Pase a ventas'] || 0)).toLocaleString()}
                </h3>
                <span className={`text-xs font-medium ${isDark ? 'text-amber-500/80' : 'text-amber-600'}`}>Atención requerida</span>
              </div>
            </div>

            {/* Progress bar visual */}
            <div className={`mt-4 w-full h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} rounded-full overflow-hidden`}>
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${Math.min(100, (((stats?.total || 0) - (stats?.byStatus['Pase a ventas'] || 0)) / (stats?.total || 1)) * 100)}%` }}
              />
            </div>
          </div>

        </div>

        {/* Control Bar */}
        <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'border-gray-200 bg-white'} backdrop-blur-xl p-4 relative z-30`}>
          <div className="flex flex-col gap-4">
            {/* Top Row: Search + Filter Toggle + Export */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                <input
                  type="search"
                  placeholder="Buscar artículo, descripción, asignado..."
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/80 text-white placeholder:text-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400'} text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters || hasActiveFilters
                  ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-50 text-purple-700 border border-purple-200'
                  : isDark
                    ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
                    : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                  }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                )}
              </button>

              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-900'} border transition-all`}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
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
                        : isDark
                          ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                          : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700'
                    }`}
                    title="Filtros avanzados"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtrar</span>
                    {advancedFilters.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-purple-800' : 'bg-purple-700'}`}>
                        {advancedFilters.length}
                      </span>
                    )}
                  </button>
                  {showAdvancedFilters && (
                    <div className={`absolute left-0 top-full mt-1 z-[100] w-[520px] ${isDark ? 'bg-zinc-900 border-purple-500/30' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-4`}>
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
                              <span className={`text-[10px] font-medium w-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>AND</span>
                            )}
                            {index === 0 && <span className="w-8"></span>}
                            <select
                              value={filter.field}
                              onChange={(e) => updateAdvancedFilter(filter.id, { field: e.target.value })}
                              className={`w-[120px] text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                            >
                              {PROPUESTA_FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateAdvancedFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className={`w-[100px] text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-1.5`}
                            >
                              {FILTER_OPERATORS.filter(op => {
                                const fieldConfig = PROPUESTA_FILTER_FIELDS.find(f => f.field === filter.field);
                                return fieldConfig && op.forTypes.includes(fieldConfig.type);
                              }).map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={filter.value}
                                placeholder="Escribir o seleccionar..."
                                onChange={(e) => {
                                  updateAdvancedFilter(filter.id, { value: e.target.value });
                                  setComboboxOpen(filter.id);
                                }}
                                onClick={() => setComboboxOpen(filter.id)}
                                onFocus={() => setComboboxOpen(filter.id)}
                                onBlur={() => setTimeout(() => setComboboxOpen(null), 200)}
                                className={`w-full text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded px-2 py-1.5`}
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
                                          updateAdvancedFilter(filter.id, { value: val });
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
                              onClick={() => removeAdvancedFilter(filter.id)}
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
                          onClick={addAdvancedFilter}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                        >
                          <Plus className="h-3 w-3" />
                          Añadir
                        </button>
                        <button
                          onClick={clearAdvancedFilters}
                          disabled={advancedFilters.length === 0}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border ${isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30 border-red-500/30' : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'}`}
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

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} mx-1`} />

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

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} mx-1`} />

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

                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} mx-1`} />

                {/* Current Catorcena Indicator */}
                {currentCatorcena && (
                  <>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      <Clock className="h-3 w-3" />
                      <span>Actual: Cat. {currentCatorcena.numero_catorcena} / {currentCatorcena.a_o}</span>
                    </div>
                    <div className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} mx-1`} />
                  </>
                )}

                {/* Period Filter */}
                <PeriodFilterPopover
                  catorcenasData={catorcenasData}
                  yearInicio={yearInicio}
                  yearFin={yearFin}
                  catorcenaInicio={catorcenaInicio}
                  catorcenaFin={catorcenaFin}
                  isDark={isDark}
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

                {/* Divider */}
                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'} mx-1`} />

                {/* Sort Options */}
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mr-1`}>
                  <ArrowUpDown className="h-3 w-3 inline mr-1" />
                  Ordenar:
                </span>
                <FilterChip
                  label="Campo"
                  options={['fecha', 'precio', 'inversion', 'status']}
                  value={sortBy}
                  onChange={(val) => { setSortBy(val); setPage(1); }}
                  onClear={() => { setSortBy('fecha'); setPage(1); }}
                  isDark={isDark}
                />
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'}`}
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>

                {/* Divider */}
                <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'} mx-1`} />

                {/* Group By */}
                <FilterChip
                  label="Agrupar"
                  options={['status', 'asignado']}
                  value={groupBy}
                  onChange={(val) => { setGroupBy(val); setExpandedGroups(new Set()); }}
                  onClear={() => { setGroupBy(''); setExpandedGroups(new Set()); }}
                  isDark={isDark}
                />

                {/* Clear All */}
                {hasActiveFilters && (
                  <>
                    <div className={`h-4 w-px ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'} mx-1`} />
                    <button
                      onClick={clearAllFilters}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border ${isDark ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
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

        {/* Table */}
        <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden shadow-xl ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 shadow-purple-500/5' : 'border-gray-200 bg-white shadow-gray-200/50'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30' : 'border-gray-200 bg-gray-50'}`}>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>ID</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Fecha Creación</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Marca</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Creador</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Campaña</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Asignados</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Inversión</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Inicio</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Fin</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Estatus</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-gray-600'}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${isDark ? 'border-purple-500/30 border-t-purple-500' : 'border-purple-200 border-t-purple-600'}`} />
                        <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cargando propuestas...</span>
                      </div>
                    </td>
                  </tr>
                ) : !data?.data || data.data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                          <FileText className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                        </div>
                        <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>No se encontraron propuestas</span>
                      </div>
                    </td>
                  </tr>
                ) : groupedData ? (
                  // Grouped view
                  groupedData.map(([groupName, items]) => (
                    <React.Fragment key={groupName}>
                      <GroupHeader
                        groupName={groupName}
                        count={items.length}
                        expanded={expandedGroups.has(groupName)}
                        onToggle={() => toggleGroup(groupName)}
                        isDark={isDark}
                      />
                      {expandedGroups.has(groupName) && items.map((item, idx) => renderPropuestaRow(item, idx))}
                    </React.Fragment>
                  ))
                ) : (
                  // Flat view - use filtered data if advanced filters applied
                  (advancedFilters.length > 0 ? filteredData : data.data).map((item, idx) => renderPropuestaRow(item, idx))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!groupBy && data?.pagination && totalPages > 1 && (
            <div className={`flex items-center justify-between border-t px-4 py-3 ${isDark ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20' : 'border-gray-200 bg-gray-50'}`}>
              <span className={`text-sm ${isDark ? 'text-purple-300/70' : 'text-gray-500'}`}>
                Página <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-gray-700'}`}>{page}</span> de <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-gray-700'}`}>{totalPages}</span>
                <span className={`ml-2 ${isDark ? 'text-purple-300/50' : 'text-gray-400'}`}>({total} total)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'}`}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all ${isDark ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'}`}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <StatusModal
        isOpen={!!statusPropuesta}
        onClose={() => setStatusPropuesta(null)}
        propuesta={statusPropuesta}
        onStatusChange={() => {
          queryClient.invalidateQueries({ queryKey: ['propuestas'] });
          queryClient.invalidateQueries({ queryKey: ['propuestas-stats'] });
        }}
        allowedStatuses={permissions.allowedPropuestaStatuses}
      />

      <ApproveModal
        isOpen={!!approvePropuesta}
        onClose={() => setApprovePropuesta(null)}
        propuesta={approvePropuesta}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['propuestas'] });
          queryClient.invalidateQueries({ queryKey: ['propuestas-stats'] });
        }}
      />

      {selectedPropuestaForAssign && (
        <AssignInventarioModal
          isOpen={showAssignModal}
          onClose={() => { setShowAssignModal(false); setSelectedPropuestaForAssign(null); }}
          propuesta={selectedPropuestaForAssign}
          readOnly={!permissions.canAsignarInventario || selectedPropuestaForAssign.status === 'Pase a ventas'}
        />
      )}
    </div>
  );
}
