import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Download, Trash2,
  Filter, ChevronDown, ChevronRight, X, Layers, SlidersHorizontal,
  ArrowUpDown, Calendar
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { solicitudesService } from '../../services/solicitudes.service';
import { Solicitud } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
          value
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
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                      value === option
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
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#84cc16', // lime
];

export function SolicitudesPage() {
  const queryClient = useQueryClient();
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
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
  const MiniDonutChart = ({ data }: { data: typeof chartData }) => {
    if (!data || data.length === 0) {
      return (
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-xs text-zinc-500">--</span>
        </div>
      );
    }

    const size = 64;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const total = data.reduce((acc, d) => acc + d.value, 0);

    return (
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {data.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference;
            const dash = `${segmentLength} ${circumference - segmentLength}`;
            const currentOffset = offset;
            offset += segmentLength;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                strokeDashoffset={-currentOffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-white">{total.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  // Handle export CSV
  const handleExportCSV = async () => {
    try {
      const allData = await solicitudesService.exportAll({
        status: status || undefined,
        search: debouncedSearch || undefined,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
      });

      const headers = ['ID', 'Fecha', 'Cliente', 'CUIC', 'Descripcion', 'Marca', 'Presupuesto', 'Asignado', 'Status'];
      const rows = allData.map(s => [
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

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `solicitudes_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  // Get catorcenas for selected years
  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    return catorcenasData.data.filter(c => c.a_o === yearInicio);
  }, [catorcenasData, yearInicio]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    return catorcenasData.data.filter(c => c.a_o === yearFin);
  }, [catorcenasData, yearFin]);

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

  const hasActiveFilters = !!(status || yearInicio || yearFin || groupBy || sortBy !== 'fecha');

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
    setPage(1);
  };

  const renderSolicitudRow = (item: Solicitud, index: number) => {
    const statusColor = STATUS_COLORS[item.status] || DEFAULT_STATUS_COLOR;

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
            <span className="font-semibold text-white">{item.razon_social || '-'}</span>
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
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
            {item.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-all duration-200 border border-red-500/20"
          >
            <Trash2 className="h-3 w-3" />
          </button>
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
        {/* Compact Stats Bar with Chart */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            {/* Left: Mini Donut Chart */}
            <div className="flex items-center gap-4">
              <MiniDonutChart data={chartData} />
            </div>

            {/* Right: Status Pills */}
            <div className="flex flex-wrap items-center gap-3">
              {chartData?.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-zinc-400">{item.label}</span>
                  <span className="text-sm font-semibold text-white">{item.value.toLocaleString()}</span>
                </div>
              ))}
              {!chartData && (
                <span className="text-xs text-zinc-500">Cargando estadisticas...</span>
              )}
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-4 relative z-30">
          <div className="flex flex-col gap-4">
            {/* Top Row: Search + Filter Toggle + Export */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  placeholder="Buscar cliente, descripcion, marca..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  showFilters || hasActiveFilters
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
                  options={allStatuses}
                  value={status}
                  onChange={(val) => { setStatus(val); setPage(1); }}
                  onClear={() => { setStatus(''); setPage(1); }}
                />

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                {/* Year Range */}
                <span className="text-xs text-zinc-500 mr-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Años:
                </span>
                <FilterChip
                  label="Año Inicio"
                  options={catorcenasData?.years?.map(String) || []}
                  value={yearInicio?.toString() || ''}
                  onChange={(val) => {
                    setYearInicio(parseInt(val));
                    setCatorcenaInicio(undefined);
                    setPage(1);
                  }}
                  onClear={() => {
                    setYearInicio(undefined);
                    setCatorcenaInicio(undefined);
                    setPage(1);
                  }}
                />
                <FilterChip
                  label="Año Fin"
                  options={catorcenasData?.years?.map(String) || []}
                  value={yearFin?.toString() || ''}
                  onChange={(val) => {
                    setYearFin(parseInt(val));
                    setCatorcenaFin(undefined);
                    setPage(1);
                  }}
                  onClear={() => {
                    setYearFin(undefined);
                    setCatorcenaFin(undefined);
                    setPage(1);
                  }}
                />

                {/* Catorcenas */}
                {yearInicio && (
                  <FilterChip
                    label="Cat. Inicio"
                    options={catorcenasInicioOptions.map(c => `Cat. ${c.numero_catorcena}`)}
                    value={catorcenaInicio ? `Cat. ${catorcenaInicio}` : ''}
                    onChange={(val) => {
                      const num = parseInt(val.replace('Cat. ', ''));
                      setCatorcenaInicio(num);
                      setPage(1);
                    }}
                    onClear={() => {
                      setCatorcenaInicio(undefined);
                      setPage(1);
                    }}
                  />
                )}
                {yearFin && (
                  <FilterChip
                    label="Cat. Fin"
                    options={catorcenasFinOptions.map(c => `Cat. ${c.numero_catorcena}`)}
                    value={catorcenaFin ? `Cat. ${catorcenaFin}` : ''}
                    onChange={(val) => {
                      const num = parseInt(val.replace('Cat. ', ''));
                      setCatorcenaFin(num);
                      setPage(1);
                    }}
                    onClear={() => {
                      setCatorcenaFin(undefined);
                      setPage(1);
                    }}
                  />
                )}

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
        <div className="relative z-10 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-900/20 to-fuchsia-900/20 border-b border-purple-500/20">
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
                      data?.data?.map((item, idx) => renderSolicitudRow(item, idx))
                    )}
                    {(!data?.data || data.data.length === 0) && !groupedData && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                          No se encontraron solicitudes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!groupBy && data?.pagination && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/50">
                  <span className="text-xs text-zinc-500">
                    Pagina {page} de {totalPages} ({data.pagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* Grouped data info */}
              {groupBy && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/50">
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
    </div>
  );
}
