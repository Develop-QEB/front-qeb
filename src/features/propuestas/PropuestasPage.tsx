import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Download, Filter, ChevronDown, ChevronRight, X, SlidersHorizontal,
  ArrowUpDown, Calendar, DollarSign, FileText, Building2, MessageSquare,
  CheckCircle, Users, Send, Loader2, User, Share2, MapPinned, Wrench, Clock,
  Pencil, Trash2, Package, MapPin, Eye, Plus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Header } from '../../components/layout/Header';
import { propuestasService, PropuestaComentario } from '../../services/propuestas.service';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { Propuesta, Catorcena } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { AssignInventarioModal } from './AssignInventarioModal';
import { UserAvatar } from '../../components/ui/user-avatar';

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Por aprobar': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Pendiente': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Compartir': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'Abierto': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  'Ajuste Cto-Cliente': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  'Pase a ventas': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Activa': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  'Aprobada': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  'Rechazada': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
};

const DEFAULT_STATUS_COLOR = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };

const STATUS_OPTIONS = ['Por aprobar', 'Compartir', 'Abierto', 'Ajuste Cto-Cliente', 'Pase a ventas'];

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
const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-700/50 p-3 rounded-xl shadow-xl backdrop-blur-xl">
        <p className="text-white font-medium mb-1">{payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
          <span className="text-zinc-300 text-sm">
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
              <p className="text-[10px] text-zinc-500 mt-1">Todos los campos son obligatorios</p>
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
                  <label className="text-[10px] text-zinc-500 mb-1 block">Catorcena Inicio *</label>
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
                    <option value="">Seleccionar</option>
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
                  <label className="text-[10px] text-zinc-500 mb-1 block">Catorcena Fin *</label>
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
                    <option value="">Seleccionar</option>
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
      <td colSpan={11} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-400" />
          )}
          <span className="font-semibold text-white">{groupName || 'Sin asignar'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
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
}

function StatusModal({ isOpen, onClose, propuesta, onStatusChange }: StatusModalProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['propuesta-comments', propuesta?.id],
    queryFn: () => propuestasService.getComments(propuesta!.id),
    enabled: isOpen && !!propuesta,
    staleTime: 0,
    gcTime: 0,
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

  const statusColor = STATUS_COLORS[propuesta.status] || DEFAULT_STATUS_COLOR;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Estado y Comentarios</h2>
            <span className={`px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
              {propuesta.status}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Status Selector */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-800/30">
          <label className="block text-sm text-zinc-400 mb-2">Cambiar estado a:</label>
          <div className="flex items-center gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleChangeStatus}
              disabled={selectedStatus === propuesta.status || updateStatusMutation.isPending}
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
                    <span className="font-medium text-white text-sm">{comment.autor_nombre}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(comment.creado_en).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-sm text-zinc-300">
                    {comment.comentario}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-zinc-500 py-8">
              No hay comentarios aún
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* New Comment Input */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-800/30">
          <div className="flex items-end gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
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

function ApproveModal({ isOpen, onClose, propuesta, onSuccess }: ApproveModalProps) {
  const queryClient = useQueryClient();
  const [precio, setPrecio] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<{ id: number; nombre: string }[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => solicitudesService.getUsers(),
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

  // Initialize with current assigned users
  useEffect(() => {
    if (propuesta && isOpen) {
      setPrecio(propuesta.precio_simulado?.toString() || propuesta.precio?.toString() || '');
      // Parse current assigned users
      if (propuesta.asignado && propuesta.id_asignado) {
        const nombres = propuesta.asignado.split(',').map(n => n.trim());
        const ids = propuesta.id_asignado.split(',').map(id => parseInt(id.trim()));
        const current = nombres.map((nombre, idx) => ({ id: ids[idx] || 0, nombre }));
        setSelectedUsers(current);
      } else {
        setSelectedUsers([]);
      }
    }
  }, [propuesta, isOpen]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u: UserOption) =>
      u.nombre.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.area.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [users, userSearch]);

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
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-emerald-600/20 to-green-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Aprobar Propuesta</h2>
              <p className="text-xs text-zinc-400">#{propuesta.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Asignados */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              <Users className="h-4 w-4 inline mr-1" />
              Asignados ({selectedUsers.length})
            </label>

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedUsers.map(u => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30"
                  >
                    {u.nombre}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-white"
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
              className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />

            {/* Users list */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
              {filteredUsers.map((user: UserOption) => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-700/50 transition-colors ${isSelected ? 'bg-emerald-500/10' : ''}`}
                  >
                    <div>
                      <p className="text-sm text-white">{user.nombre}</p>
                      <p className="text-xs text-zinc-500">{user.area} - {user.puesto}</p>
                    </div>
                    {isSelected && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-300 text-sm font-medium mb-1">Al aprobar esta propuesta:</p>
            <ul className="text-amber-200/80 text-xs space-y-1">
              <li>• Se actualizarán las reservas de inventario</li>
              <li>• La cotización y campaña se activarán</li>
              <li>• Se crearán tareas de seguimiento</li>
              <li>• Se notificará al creador de la solicitud</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700"
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const { data, isLoading } = useQuery({
    queryKey: ['propuestas', page, status, debouncedSearch, yearInicio, yearFin, catorcenaInicio, catorcenaFin, sortBy, sortOrder, groupBy],
    queryFn: () =>
      propuestasService.getAll({
        page,
        limit,
        status: status || undefined,
        search: debouncedSearch || undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        soloAtendidas: true,
      }),
  });

  const allStatuses = STATUS_OPTIONS;

  const hasPeriodFilter = yearInicio !== undefined && yearFin !== undefined;
  const hasActiveFilters = !!(status || hasPeriodFilter || groupBy || sortBy !== 'fecha' || advancedFilters.length > 0);

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
    const statusColor = STATUS_COLORS[item.status] || DEFAULT_STATUS_COLOR;

    return (
      <tr key={`prop-${item.id}-${index}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
        <td className="px-4 py-3">
          <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">#{item.id}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-zinc-400 text-sm">{formatDate(item.fecha)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-white text-sm font-medium">{item.marca_nombre || item.articulo || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 align-middle">
            <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300">
              <User className="h-3 w-3" />
            </div>
            <span className="text-zinc-300 text-sm">{item.creador_nombre || item.usuario_nombre || '-'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-white text-sm truncate max-w-[250px] block" title={item.nombre_campania || item.descripcion || '-'}>{item.nombre_campania || item.descripcion || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-zinc-300 text-xs">{item.asignado || 'Sin asignar'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-amber-400">{formatCurrency(item.inversion)}</span>
        </td>
        <td className="px-4 py-3">
          {item.catorcena_inicio ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-xs border border-cyan-500/20">
              <Calendar className="h-3 w-3" />
              {item.catorcena_inicio}/{item.anio_inicio}
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          {item.catorcena_fin ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-xs border border-amber-500/20">
              <Calendar className="h-3 w-3" />
              {item.catorcena_fin}/{item.anio_fin}
            </span>
          ) : (
            <span className="text-zinc-500 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => setStatusPropuesta(item)}
            className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap ${statusColor.bg} ${statusColor.text} border ${statusColor.border} hover:opacity-80 transition-opacity cursor-pointer`}
          >
            {item.status}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setApprovePropuesta(item)}
              disabled={item.status !== 'Por aprobar'}
              className={`p-2 rounded-lg border transition-all ${item.status !== 'Por aprobar'
                ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40'
                }`}
              title={item.status !== 'Por aprobar' ? 'Solo disponible con estatus Por aprobar' : 'Aprobar propuesta'}
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setSelectedPropuestaForAssign(item); setShowAssignModal(true); }}
              disabled={item.status === 'Activa'}
              className={`p-2 rounded-lg border transition-all ${item.status === 'Activa'
                ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50'
                : 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 border-fuchsia-500/20 hover:border-fuchsia-500/40'
                }`}
              title={item.status === 'Activa' ? 'No disponible para propuestas activas' : 'Asignar a Inventario'}
            >
              <MapPinned className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={item.status !== 'Compartir'}
              onClick={() => item.status === 'Compartir' && navigate(`/propuestas/compartir/${item.id}`)}
              className={`p-2 rounded-lg border transition-all ${item.status === 'Compartir'
                ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40'
                : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed opacity-50'
                }`}
              title={item.status === 'Compartir' ? 'Compartir propuesta' : 'Solo disponible en status Compartir'}
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
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
          <div className="col-span-1 md:col-span-2 lg:col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Total Propuestas</p>
              <h3 className="text-4xl font-bold text-white tracking-tight">
                {stats?.total.toLocaleString() ?? '0'}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                Todas las catorcenas
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
                      <RechartsTooltip content={<CustomChartTooltip />} />
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

          {/* KPI: Por Aprobar Priority */}
          <div className="col-span-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-5 -mb-5 pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Sin Aprobar</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-amber-400">
                  {((stats?.total || 0) - (stats?.byStatus['Por aprobar'] || 0)).toLocaleString()}
                </h3>
                <span className="text-xs text-amber-500/80 font-medium">Atención requerida</span>
              </div>
            </div>

            {/* Progress bar visual */}
            <div className="mt-4 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                style={{ width: `${Math.min(100, (((stats?.total || 0) - (stats?.byStatus['Por aprobar'] || 0)) / (stats?.total || 1)) * 100)}%` }}
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
                  placeholder="Buscar artículo, descripción, asignado..."
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
                              {PROPUESTA_FILTER_FIELDS.map((f) => (
                                <option key={f.field} value={f.field}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={filter.operator}
                              onChange={(e) => updateAdvancedFilter(filter.id, { operator: e.target.value as FilterOperator })}
                              className="w-[100px] text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                            >
                              {FILTER_OPERATORS.filter(op => {
                                const fieldConfig = PROPUESTA_FILTER_FIELDS.find(f => f.field === filter.field);
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

                {/* Divider */}
                <div className="h-4 w-px bg-zinc-700/50 mx-1" />

                {/* Sort Options */}
                <span className="text-xs text-zinc-500 mr-1">
                  <ArrowUpDown className="h-3 w-3 inline mr-1" />
                  Ordenar:
                </span>
                <FilterChip
                  label="Campo"
                  options={['fecha', 'precio', 'inversion', 'status']}
                  value={sortBy}
                  onChange={(val) => { setSortBy(val); setPage(1); }}
                  onClear={() => { setSortBy('fecha'); setPage(1); }}
                />
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 transition-all"
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>

                {/* Divider */}
                <div className="h-4 w-px bg-zinc-700/50 mx-1" />

                {/* Group By */}
                <FilterChip
                  label="Agrupar"
                  options={['status', 'asignado']}
                  value={groupBy}
                  onChange={(val) => { setGroupBy(val); setExpandedGroups(new Set()); }}
                  onClear={() => { setGroupBy(''); setExpandedGroups(new Set()); }}
                />

                {/* Clear All */}
                {hasActiveFilters && (
                  <>
                    <div className="h-4 w-px bg-zinc-700/50 mx-1" />
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
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
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Fecha Creación</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Creador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Asignados</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Inversión</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Inicio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Fin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <span className="text-zinc-500 text-sm">Cargando propuestas...</span>
                      </div>
                    </td>
                  </tr>
                ) : !data?.data || data.data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10">
                          <FileText className="w-6 h-6 text-purple-400" />
                        </div>
                        <span className="text-zinc-500 text-sm">No se encontraron propuestas</span>
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
          {data?.pagination && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
              <span className="text-sm text-purple-300/70">
                Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{totalPages}</span>
                <span className="text-purple-300/50 ml-2">({total} total)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
        />
      )}
    </div>
  );
}
