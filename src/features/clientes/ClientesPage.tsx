import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Users, Building2, Tag, Database, Cloud, Plus, Trash2,
  Filter, ChevronDown, ChevronRight, X, Layers, SlidersHorizontal, Package, RefreshCw,
  Eye, User, Calendar, Briefcase, Hash, FileText
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { clientesService } from '../../services/clientes.service';
import { Cliente } from '../../types';

// Helper para formatear fechas
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ============ VIEW CLIENTE MODAL ============
interface ViewClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

function ViewClienteModal({ isOpen, onClose, cliente }: ViewClienteModalProps) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 isolate">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/50 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-50">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-600/20 via-fuchsia-600/15 to-pink-600/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Cliente</h2>
                  <span className="font-mono text-sm px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    CUIC: {cliente.CUIC || '-'}
                  </span>
                </div>
                <p className="text-zinc-400 text-sm">{cliente.T0_U_Cliente || 'Sin nombre'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-5">
            {/* Stats Row */}
            <div className="bg-gradient-to-r from-purple-600/10 via-fuchsia-600/10 to-pink-600/10 rounded-2xl p-5 border border-purple-500/20">
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-mono">{cliente.CUIC || '-'}</p>
                  <p className="text-xs text-zinc-400 mt-1">CUIC</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-400 truncate">{cliente.T2_U_Marca || '-'}</p>
                  <p className="text-xs text-zinc-400 mt-1">Marca</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-cyan-400 truncate">{cliente.T0_U_Agencia || '-'}</p>
                  <p className="text-xs text-zinc-400 mt-1">Agencia</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-400 truncate">{cliente.T2_U_Categoria || '-'}</p>
                  <p className="text-xs text-zinc-400 mt-1">Categoría</p>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Información General */}
              <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Información General
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">ID</span>
                    <span className="text-white text-sm font-mono">{cliente.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">CUIC</span>
                    <span className="text-purple-300 text-sm font-mono font-medium">{cliente.CUIC || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Cliente</span>
                    <span className="text-white text-sm font-medium truncate ml-4 max-w-[200px]">{cliente.T0_U_Cliente || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Razón Social</span>
                    <span className="text-white text-sm truncate ml-4 max-w-[200px]">{cliente.T0_U_RazonSocial || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Unidad de Negocio</span>
                    <span className="text-cyan-300 text-sm">{cliente.T1_U_UnidadNegocio || cliente.ASESOR_U_UnidadNegocio || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Asesor Comercial */}
              <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Asesor Comercial
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Asesor</span>
                    <span className="text-emerald-400 text-sm font-medium">{cliente.ASESOR_U_Asesor || cliente.T0_U_Asesor || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">ID Asesor</span>
                    <span className="text-white text-sm font-mono">{cliente.ASESOR_U_IDAsesor || cliente.T0_U_IDAsesor || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Código SAP</span>
                    <span className="text-white text-sm font-mono">{cliente.ASESOR_U_SAPCode || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Unidad Asesor</span>
                    <span className="text-white text-sm">{cliente.ASESOR_U_UnidadNegocio || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Three Column Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Agencia */}
              <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Agencia
                </h3>
                <p className="text-white font-medium text-lg">{cliente.T0_U_Agencia || '-'}</p>
                <p className="text-zinc-500 text-xs mt-1">ID: {cliente.T0_U_IDAgencia || '-'}</p>
              </div>

              {/* Marca y Producto */}
              <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Marca & Producto
                </h3>
                <p className="text-fuchsia-300 font-medium">{cliente.T2_U_Marca || '-'}</p>
                <p className="text-zinc-500 text-xs mt-0.5">ID Marca: {cliente.T1_U_IDMarca || '-'}</p>
                <div className="mt-2 pt-2 border-t border-zinc-700/50">
                  <p className="text-amber-300 font-medium">{cliente.T2_U_Producto || '-'}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">ID Producto: {cliente.T2_U_IDProducto || '-'}</p>
                </div>
              </div>

              {/* Categoría */}
              <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Categoría
                </h3>
                <p className="text-white font-medium text-lg">{cliente.T2_U_Categoria || '-'}</p>
                <p className="text-zinc-500 text-xs mt-1">ID: {cliente.T2_U_IDCategoria || '-'}</p>
              </div>
            </div>

            {/* Vigencias */}
            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
              <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Vigencias
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Válido Desde (T1)</span>
                  <span className="text-white text-sm">{formatDate(cliente.T1_U_ValidFrom)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Válido Hasta (T1)</span>
                  <span className="text-white text-sm">{formatDate(cliente.T1_U_ValidTo)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Válido Desde (T2)</span>
                  <span className="text-white text-sm">{formatDate(cliente.T2_U_ValidFrom)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">Válido Hasta (T2)</span>
                  <span className="text-white text-sm">{formatDate(cliente.T2_U_ValidTo)}</span>
                </div>
              </div>
            </div>

            {/* IDs Técnicos */}
            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
              <h3 className="text-sm font-semibold text-purple-400 mb-4 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                IDs Técnicos
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">T0 IDACA</span>
                  <span className="text-white text-sm font-mono">{cliente.T0_U_IDACA || '-'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">T1 IDACA</span>
                  <span className="text-white text-sm font-mono">{cliente.T1_U_IDACA || '-'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">T1 IDCM</span>
                  <span className="text-white text-sm font-mono">{cliente.T1_U_IDCM || '-'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs block mb-1">T2 IDCM</span>
                  <span className="text-white text-sm font-mono">{cliente.T2_U_IDCM || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple Stat Card - Solo número grande
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  const [animate, setAnimate] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!animate || value === 0) {
      setDisplayValue(value);
      return;
    }
    const duration = 800;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [animate, value]);

  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
    pink: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    violet: 'from-violet-500/20 to-indigo-500/20 border-violet-500/30',
  };

  const iconColors: Record<string, string> = {
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    pink: 'text-pink-400',
    violet: 'text-violet-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm p-5 transition-all duration-500 hover:scale-[1.02] ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${iconColors[color]}`} />
        <span className="text-sm font-medium text-zinc-400 uppercase tracking-wide">{title}</span>
      </div>
      <p className="text-4xl font-bold text-white">
        {displayValue.toLocaleString()}
      </p>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  loading
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20'
          : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-700/50'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-xs ${
        active ? 'bg-white/20' : 'bg-zinc-700'
      }`}>
        {loading ? '...' : (count ?? 0).toLocaleString()}
      </span>
    </button>
  );
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
            {/* Search input */}
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
            {/* Options list */}
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
            {/* Count indicator */}
            <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
              {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Grouped Table Row
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
      <td colSpan={8} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-400" />
          )}
          <span className="font-semibold text-white">{groupName || 'Sin asignar'}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
            {count} clientes
          </span>
        </div>
      </td>
    </tr>
  );
}

export function ClientesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'db' | 'sap'>('db');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterAgencia, setFilterAgencia] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [groupBy, setGroupBy] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 20;

  // Estado para el modal de ver cliente
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['clientes-stats'],
    queryFn: () => clientesService.getStats(),
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['clientes-filter-options'],
    queryFn: () => clientesService.getFilterOptions(),
  });

  // Fetch paginated DB clients
  const { data: dbData, isLoading: dbLoading } = useQuery({
    queryKey: ['clientes', page, debouncedSearch],
    queryFn: () => clientesService.getAll({ page, limit, search: debouncedSearch }),
  });

  // Fetch ALL DB clients for filtering/grouping
  const needsFullData = !!(filterAgencia || filterMarca || filterCategoria || groupBy);
  const { data: fullDbData, isLoading: fullDbLoading } = useQuery({
    queryKey: ['clientes-full', debouncedSearch],
    queryFn: () => clientesService.getAllFull(debouncedSearch || undefined),
    enabled: needsFullData,
  });

  // Fetch SAP clients
  const { data: sapData, isLoading: sapLoading, refetch: refetchSap, isFetching: sapFetching } = useQuery({
    queryKey: ['clientes-sap', debouncedSearch],
    queryFn: () => clientesService.getSAPClientes(debouncedSearch || undefined),
  });

  // Refresh SAP data (clear cache on backend)
  const handleRefreshSap = async () => {
    await refetchSap();
  };

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: clientesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-full'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'] });
    },
  });

  // Delete client mutation
  const deleteMutation = useMutation({
    mutationFn: clientesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-full'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-sap'] });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'] });
    },
  });

  // Get current data based on tab and filters
  const currentData = useMemo(() => {
    if (activeTab === 'sap') {
      return sapData?.data || [];
    }
    if (needsFullData && fullDbData?.data) {
      return fullDbData.data;
    }
    return dbData?.data || [];
  }, [activeTab, sapData, fullDbData, dbData, needsFullData]);

  const isLoading = activeTab === 'sap'
    ? sapLoading
    : (needsFullData ? fullDbLoading : dbLoading);

  // Filter data
  const filteredData = useMemo(() => {
    let data = [...currentData];

    if (filterAgencia) {
      data = data.filter(c => c.T0_U_Agencia === filterAgencia);
    }
    if (filterMarca) {
      data = data.filter(c => c.T2_U_Marca === filterMarca);
    }
    if (filterCategoria) {
      data = data.filter(c => c.T2_U_Categoria === filterCategoria);
    }

    return data;
  }, [currentData, filterAgencia, filterMarca, filterCategoria]);

  // Group data
  const groupedData = useMemo(() => {
    if (!groupBy) return null;

    const groupKey = groupBy === 'Agencia' ? 'T0_U_Agencia' : groupBy === 'Marca' ? 'T2_U_Marca' : 'T2_U_Categoria';
    const groups: Record<string, Cliente[]> = {};

    filteredData.forEach(item => {
      const key = (item[groupKey as keyof Cliente] as string) || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredData, groupBy]);

  const hasActiveFilters = !!(filterAgencia || filterMarca || filterCategoria || groupBy);

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

  const handleAddToDatabase = async (cliente: Cliente) => {
    try {
      await createMutation.mutateAsync(cliente);
    } catch (error) {
      console.error('Error adding cliente:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting cliente:', error);
      }
    }
  };

  const clearAllFilters = () => {
    setFilterAgencia('');
    setFilterMarca('');
    setFilterCategoria('');
    setGroupBy('');
    setExpandedGroups(new Set());
  };

  const renderClientRow = (item: Cliente, isDb: boolean, index: number) => (
    <tr key={isDb ? `db-${item.id}` : `sap-${index}-${item.CUIC}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">{item.CUIC || '-'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-white">{item.T0_U_Cliente || '-'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="max-w-[200px] truncate block text-zinc-400 text-xs">{item.T0_U_RazonSocial || '-'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3 w-3 text-cyan-400" />
          <span className="text-cyan-300 text-xs">{item.T0_U_Agencia || '-'}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3 text-fuchsia-400" />
          <span className="text-fuchsia-300 text-xs">{item.T2_U_Marca || '-'}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {item.T2_U_Categoria || '-'}
        </span>
      </td>
      {isDb && (
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3 text-amber-400" />
            <span className="text-amber-300 text-xs">{item.T2_U_Producto || '-'}</span>
          </span>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Botón Ver */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedCliente(item); setShowViewModal(true); }}
            className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-all"
            title="Ver detalles"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {isDb ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              disabled={deleteMutation.isPending}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToDatabase(item); }}
              disabled={createMutation.isPending}
              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50"
              title="Agregar a BD"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const dbTotalPages = dbData?.pagination?.totalPages || 1;
  const sapTotal = sapData?.total ?? 0;
  const dbTotal = dbData?.pagination?.total ?? 0;

  return (
    <div className="min-h-screen">
      <Header title="Clientes" />

      <div className="p-6 space-y-5">
        {/* Stats Row - Solo números grandes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total Clientes"
            value={stats?.total || 0}
            icon={Users}
            color="purple"
            delay={0}
          />
          <StatCard
            title="Agencias"
            value={stats?.agencias || 0}
            icon={Building2}
            color="cyan"
            delay={50}
          />
          <StatCard
            title="Marcas"
            value={stats?.marcas || 0}
            icon={Tag}
            color="pink"
            delay={100}
          />
          <StatCard
            title="Categorias"
            value={stats?.categorias || 0}
            icon={Layers}
            color="violet"
            delay={150}
          />
        </div>

        {/* Control Bar */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90 backdrop-blur-xl p-4 relative z-30">
          <div className="flex flex-col gap-4">
            {/* Top Row: Tabs + Search */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                <TabButton
                  active={activeTab === 'db'}
                  onClick={() => { setActiveTab('db'); setPage(1); clearAllFilters(); }}
                  icon={Database}
                  label="Base de Datos"
                  count={dbTotal}
                  loading={dbLoading}
                />
                <TabButton
                  active={activeTab === 'sap'}
                  onClick={() => { setActiveTab('sap'); clearAllFilters(); }}
                  icon={Cloud}
                  label="SAP"
                  count={sapTotal}
                  loading={sapLoading}
                />
                {activeTab === 'sap' && (
                  <button
                    onClick={handleRefreshSap}
                    disabled={sapFetching}
                    className="p-2 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200 transition-all disabled:opacity-50"
                    title="Refrescar SAP"
                  >
                    <RefreshCw className={`h-4 w-4 ${sapFetching ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
                <input
                  type="search"
                  placeholder="Buscar..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-purple-500/20 bg-zinc-900/80 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40 transition-all hover:border-purple-500/40"
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
            </div>

            {/* Filters Row (Expandable) */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/50 relative z-50">
                <span className="text-xs text-zinc-500 mr-1">
                  <Filter className="h-3 w-3 inline mr-1" />
                  Filtrar:
                </span>
                <FilterChip
                  label="Agencia"
                  options={filterOptions?.agencias || []}
                  value={filterAgencia}
                  onChange={setFilterAgencia}
                  onClear={() => setFilterAgencia('')}
                />
                <FilterChip
                  label="Marca"
                  options={filterOptions?.marcas || []}
                  value={filterMarca}
                  onChange={setFilterMarca}
                  onClear={() => setFilterMarca('')}
                />
                <FilterChip
                  label="Categoria"
                  options={filterOptions?.categorias || []}
                  value={filterCategoria}
                  onChange={setFilterCategoria}
                  onClear={() => setFilterCategoria('')}
                />

                <div className="h-4 w-px bg-zinc-700 mx-1" />

                <span className="text-xs text-zinc-500 mr-1">
                  <Layers className="h-3 w-3 inline mr-1" />
                  Agrupar:
                </span>
                <FilterChip
                  label="Sin agrupar"
                  options={['Agencia', 'Marca', 'Categoria']}
                  value={groupBy}
                  onChange={(val) => { setGroupBy(val); setExpandedGroups(new Set()); }}
                  onClear={() => { setGroupBy(''); setExpandedGroups(new Set()); }}
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
              {filteredData.length} resultados
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">CUIC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Razon Social</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Agencia</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Categoria</th>
                      {activeTab === 'db' && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Producto</th>
                      )}
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
                          {expandedGroups.has(groupName) && items.map((item, idx) => renderClientRow(item, activeTab === 'db', idx))}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderClientRow(item, activeTab === 'db', idx))
                    )}
                    {filteredData.length === 0 && !groupedData && (
                      <tr>
                        <td colSpan={activeTab === 'db' ? 8 : 7} className="px-4 py-12 text-center text-zinc-500">
                          {activeTab === 'sap' ? "No hay clientes nuevos en SAP" : "No se encontraron clientes"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination for DB only (when not filtering/grouping) */}
              {activeTab === 'db' && !needsFullData && dbData?.pagination && dbTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-transparent to-fuchsia-900/20 px-4 py-3">
                  <span className="text-sm text-purple-300/70">
                    Página <span className="font-semibold text-purple-300">{page}</span> de <span className="font-semibold text-purple-300">{dbTotalPages}</span>
                    <span className="text-purple-300/50 ml-2">({dbData.pagination.total} total)</span>
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
                      onClick={() => setPage(p => Math.min(dbTotalPages, p + 1))}
                      disabled={page === dbTotalPages}
                      className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* Full data info when filtering/grouping */}
              {activeTab === 'db' && needsFullData && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20">
                  <span className="text-xs text-zinc-500">
                    Mostrando {filteredData.length} clientes filtrados
                  </span>
                </div>
              )}

              {/* SAP info */}
              {activeTab === 'sap' && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/20">
                  <span className="text-xs text-zinc-500">
                    {sapTotal} clientes de SAP disponibles
                    {sapData?.cached && <span className="ml-2 text-emerald-400">(desde cache)</span>}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Ver Cliente */}
      <ViewClienteModal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setSelectedCliente(null); }}
        cliente={selectedCliente}
      />
    </div>
  );
}
