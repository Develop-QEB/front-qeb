import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Download, Filter, ChevronDown, ChevronRight, Calendar, Loader2, FileSpreadsheet,
  Building2, ClipboardList, Layers, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Check
} from 'lucide-react';
import { campanasService, OrdenMontajeCAT, OrdenMontajeINVIAN } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import * as XLSX from 'xlsx';

interface OrdenesMontajeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'cat' | 'invian';

// Status options for filter
const STATUS_OPTIONS = ['activa', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

// Advanced Filter Types
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface AdvancedFilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterFieldConfig {
  field: string;
  label: string;
}

// CAT Filter Fields
const CAT_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo', label: 'Tipo' },
  { field: 'asesor', label: 'Asesor' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'numero_articulo', label: 'Artículo' },
  { field: 'negociacion', label: 'Negociación' },
];

// INVIAN Filter Fields
const INVIAN_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'Campania', label: 'Campaña' },
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Operacion', label: 'Operación' },
  { field: 'Vendedor', label: 'Vendedor' },
  { field: 'Ciudad', label: 'Ciudad' },
  { field: 'Unidad', label: 'Unidad' },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// CAT Grouping options
type CATGroupByField = 'plaza' | 'tipo' | 'cliente' | 'campania' | 'numero_articulo';

const CAT_GROUPINGS: { field: CATGroupByField; label: string }[] = [
  { field: 'tipo', label: 'Tipo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'numero_articulo', label: 'Artículo' },
];

// INVIAN Grouping options
type INVIANGroupByField = 'Anunciante' | 'Operacion' | 'Vendedor' | 'Ciudad';

const INVIAN_GROUPINGS: { field: INVIANGroupByField; label: string }[] = [
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Operacion', label: 'Operación' },
  { field: 'Vendedor', label: 'Vendedor' },
  { field: 'Ciudad', label: 'Ciudad' },
];

// CAT Sort Fields
const CAT_SORT_FIELDS = [
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo', label: 'Tipo' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'monto_total', label: 'Monto Total' },
  { field: 'caras', label: 'Caras' },
];

// INVIAN Sort Fields
const INVIAN_SORT_FIELDS = [
  { field: 'Campania', label: 'Campaña' },
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Ciudad', label: 'Ciudad' },
  { field: 'PrecioPorCara', label: 'Precio/Cara' },
];

// Apply advanced filters function
function applyAdvancedFilters<T extends Record<string, unknown>>(data: T[], filters: AdvancedFilterCondition[]): T[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const value = String(item[filter.field] || '').toLowerCase();
      const filterValue = filter.value.toLowerCase();

      switch (filter.operator) {
        case '=':
          return value === filterValue;
        case '!=':
          return value !== filterValue;
        case 'contains':
          return value.includes(filterValue);
        case 'not_contains':
          return !value.includes(filterValue);
        default:
          return true;
      }
    });
  });
}

// Helper to get initials for avatar
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// Helper to get avatar color based on name
function getAvatarColor(name: string | null): string {
  if (!name) return 'bg-zinc-600';
  const colors = [
    'bg-purple-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Format date helper
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrdenesMontajeModal({ isOpen, onClose }: OrdenesMontajeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cat');
  const contentRef = useRef<HTMLDivElement>(null);

  // Period filters (kept for API query)
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);

  // CAT filters/sort/group
  const [catFilters, setCatFilters] = useState<AdvancedFilterCondition[]>([]);
  const [catGroupings, setCatGroupings] = useState<CATGroupByField[]>([]);
  const [catSortField, setCatSortField] = useState<string | null>(null);
  const [catSortDirection, setCatSortDirection] = useState<'asc' | 'desc'>('desc');
  const [catExpandedGroups, setCatExpandedGroups] = useState<Set<string>>(new Set());

  // INVIAN filters/sort/group
  const [invianFilters, setInvianFilters] = useState<AdvancedFilterCondition[]>([]);
  const [invianGroupings, setInvianGroupings] = useState<INVIANGroupByField[]>([]);
  const [invianSortField, setInvianSortField] = useState<string | null>(null);
  const [invianSortDirection, setInvianSortDirection] = useState<'asc' | 'desc'>('desc');
  const [invianExpandedGroups, setInvianExpandedGroups] = useState<Set<string>>(new Set());

  // Popup visibility
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);

  // Prevent body scroll when modal is open
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

  // Get catorcenas for filter
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });

  // Query for CAT data
  const { data: catData, isLoading: isLoadingCAT } = useQuery({
    queryKey: ['ordenes-montaje-cat', status, yearInicio, yearFin, catorcenaInicio, catorcenaFin],
    queryFn: () => campanasService.getOrdenMontajeCAT({
      status: status || undefined,
      yearInicio,
      yearFin,
      catorcenaInicio,
      catorcenaFin,
    }),
    enabled: isOpen && activeTab === 'cat',
  });

  // Query for INVIAN data
  const { data: invianData, isLoading: isLoadingINVIAN } = useQuery({
    queryKey: ['ordenes-montaje-invian', status, yearInicio, yearFin, catorcenaInicio, catorcenaFin],
    queryFn: () => campanasService.getOrdenMontajeINVIAN({
      status: status || undefined,
      yearInicio,
      yearFin,
      catorcenaInicio,
      catorcenaFin,
    }),
    enabled: isOpen && activeTab === 'invian',
  });

  const years = catorcenasData?.years || [];

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena <= catorcenaFin);
    }
    return catorcenas;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena >= catorcenaInicio);
    }
    return catorcenas;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Filtered and sorted CAT data
  const filteredCATData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Apply advanced filters
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as OrdenMontajeCAT[];
    }

    // Apply sorting
    if (catSortField && items.length > 0) {
      items.sort((a, b) => {
        const aVal = a[catSortField as keyof OrdenMontajeCAT];
        const bVal = b[catSortField as keyof OrdenMontajeCAT];
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return catSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return catSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [catData, catFilters, catSortField, catSortDirection]);

  // Group CAT data
  const getCATGroupValue = (item: OrdenMontajeCAT, field: CATGroupByField): string => {
    const val = item[field as keyof OrdenMontajeCAT];
    return val ? String(val) : `Sin ${CAT_GROUPINGS.find(g => g.field === field)?.label || 'asignar'}`;
  };

  const groupedCATData = useMemo(() => {
    if (catGroupings.length === 0 || !filteredCATData.length) return null;

    const groups: Record<string, OrdenMontajeCAT[]> = {};
    filteredCATData.forEach(item => {
      const key = getCATGroupValue(item, catGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredCATData, catGroupings]);

  // Filtered and sorted INVIAN data
  const filteredINVIANData = useMemo(() => {
    if (!invianData) return [];
    let items = [...invianData];

    // Apply advanced filters
    if (invianFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], invianFilters) as OrdenMontajeINVIAN[];
    }

    // Apply sorting
    if (invianSortField && items.length > 0) {
      items.sort((a, b) => {
        const aVal = a[invianSortField as keyof OrdenMontajeINVIAN];
        const bVal = b[invianSortField as keyof OrdenMontajeINVIAN];
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return invianSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return invianSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [invianData, invianFilters, invianSortField, invianSortDirection]);

  // Group INVIAN data
  const getINVIANGroupValue = (item: OrdenMontajeINVIAN, field: INVIANGroupByField): string => {
    const val = item[field as keyof OrdenMontajeINVIAN];
    return val ? String(val) : `Sin ${INVIAN_GROUPINGS.find(g => g.field === field)?.label || 'asignar'}`;
  };

  const groupedINVIANData = useMemo(() => {
    if (invianGroupings.length === 0 || !filteredINVIANData.length) return null;

    const groups: Record<string, OrdenMontajeINVIAN[]> = {};
    filteredINVIANData.forEach(item => {
      const key = getINVIANGroupValue(item, invianGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredINVIANData, invianGroupings]);

  // Calculate totals - ensure numeric addition (based on filtered data)
  const catTotals = useMemo(() => {
    if (!filteredCATData || filteredCATData.length === 0) return { caras: 0, tarifa: 0, monto: 0 };
    return {
      caras: filteredCATData.reduce((sum, i) => sum + (Number(i.caras) || 0), 0),
      tarifa: filteredCATData.reduce((sum, i) => sum + (Number(i.tarifa) || 0), 0),
      monto: filteredCATData.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0),
    };
  }, [filteredCATData]);

  // Export to XLSX
  const handleExportXLSX = () => {
    if (activeTab === 'cat' && catData) {
      const wsData = catData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor': item.asesor || '',
        'APS': item.aps_especifico || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? formatDate(item.fecha_inicio_periodo) : '',
        'Fecha Fin': item.fecha_fin_periodo ? formatDate(item.fecha_fin_periodo) : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Campaña': item.campania || '',
        'Artículo': item.numero_articulo || '',
        'Negociación': item.negociacion || '',
        'Caras': Number(item.caras) || 0,
        'Tarifa': Number(item.tarifa) || 0,
        'Monto Total': Number(item.monto_total) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje CAT');
      XLSX.writeFile(wb, `orden_montaje_cat_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'invian' && invianData) {
      const wsData = invianData.map(item => ({
        'Campaña': item.Campania || '',
        'Anunciante': item.Anunciante || '',
        'Operación': item.Operacion || '',
        'Código de contrato (Opcional)': item.CodigoContrato || '',
        'Precio por cara (Opcional)': Number(item.PrecioPorCara) || 0,
        'Vendedor': item.Vendedor || '',
        'Descripción (Opcional)': item.Descripcion || '',
        'Inicio o Periodo': item.InicioPeriodo || '',
        'Fin o Segmento': item.FinSegmento || '',
        'Arte': item.Arte || '',
        'Código de arte (Opcional)': item.CodigoArte || '',
        'Arte Url (Opcional)': item.ArteUrl || '',
        'Origen del arte (Opcional)': item.OrigenArte || '',
        'Unidad': item.Unidad || '',
        'Cara': item.Cara || '',
        'Ciudad': item.Ciudad || '',
        'Tipo de Distribución': item.TipoDistribucion || '',
        'Reproducciones': item.Reproducciones || '',
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje INVIAN');
      XLSX.writeFile(wb, `orden_montaje_invian_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Get unique values for filter dropdowns
  const getCATUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!catData) return valuesMap;
    CAT_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      catData.forEach(item => {
        const val = item[fieldConfig.field as keyof OrdenMontajeCAT];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [catData]);

  const getINVIANUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!invianData) return valuesMap;
    INVIAN_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      invianData.forEach(item => {
        const val = item[fieldConfig.field as keyof OrdenMontajeINVIAN];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [invianData]);

  // Filter management callbacks
  const addFilter = useCallback(() => {
    const fields = activeTab === 'cat' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
    const newFilter: AdvancedFilterCondition = {
      id: `filter-${Date.now()}`,
      field: fields[0].field,
      operator: '=',
      value: '',
    };
    if (activeTab === 'cat') {
      setCatFilters(prev => [...prev, newFilter]);
    } else {
      setInvianFilters(prev => [...prev, newFilter]);
    }
  }, [activeTab]);

  const updateFilter = useCallback((id: string, updates: Partial<AdvancedFilterCondition>) => {
    if (activeTab === 'cat') {
      setCatFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    } else {
      setInvianFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    }
  }, [activeTab]);

  const removeFilter = useCallback((id: string) => {
    if (activeTab === 'cat') {
      setCatFilters(prev => prev.filter(f => f.id !== id));
    } else {
      setInvianFilters(prev => prev.filter(f => f.id !== id));
    }
  }, [activeTab]);

  const clearCurrentFilters = useCallback(() => {
    if (activeTab === 'cat') {
      setCatFilters([]);
    } else {
      setInvianFilters([]);
    }
  }, [activeTab]);

  // Grouping toggle
  const toggleGrouping = useCallback((field: string) => {
    if (activeTab === 'cat') {
      setCatGroupings(prev => {
        if (prev.includes(field as CATGroupByField)) {
          return prev.filter(f => f !== field);
        }
        return [field as CATGroupByField];
      });
    } else {
      setInvianGroupings(prev => {
        if (prev.includes(field as INVIANGroupByField)) {
          return prev.filter(f => f !== field);
        }
        return [field as INVIANGroupByField];
      });
    }
  }, [activeTab]);

  // Toggle expanded groups
  const toggleGroup = useCallback((groupName: string) => {
    if (activeTab === 'cat') {
      setCatExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupName)) next.delete(groupName);
        else next.add(groupName);
        return next;
      });
    } else {
      setInvianExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupName)) next.delete(groupName);
        else next.add(groupName);
        return next;
      });
    }
  }, [activeTab]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setCatFilters([]);
    setCatGroupings([]);
    setCatSortField(null);
    setInvianFilters([]);
    setInvianGroupings([]);
    setInvianSortField(null);
  }, []);

  // Current tab data
  const currentFilters = activeTab === 'cat' ? catFilters : invianFilters;
  const currentGroupings = activeTab === 'cat' ? catGroupings : invianGroupings;
  const currentSortField = activeTab === 'cat' ? catSortField : invianSortField;
  const currentSortDirection = activeTab === 'cat' ? catSortDirection : invianSortDirection;
  const currentFilterFields = activeTab === 'cat' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
  const currentGroupOptions = activeTab === 'cat' ? CAT_GROUPINGS : INVIAN_GROUPINGS;
  const currentSortOptions = activeTab === 'cat' ? CAT_SORT_FIELDS : INVIAN_SORT_FIELDS;
  const currentUniqueValues = activeTab === 'cat' ? getCATUniqueValues : getINVIANUniqueValues;

  const hasActiveFilters = currentFilters.length > 0 || currentGroupings.length > 0 || currentSortField !== null;

  if (!isOpen) return null;

  const isLoading = activeTab === 'cat' ? isLoadingCAT : isLoadingINVIAN;
  const dataCount = activeTab === 'cat' ? filteredCATData.length : filteredINVIANData.length;
  const totalCount = activeTab === 'cat' ? (catData?.length || 0) : (invianData?.length || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[95vw] max-w-7xl h-[90vh] bg-zinc-900 rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Órdenes de Montaje</h2>
              <p className="text-xs text-zinc-400">Gestión y exportación de órdenes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs - Redesigned */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/80">
          <div className="flex p-1 bg-zinc-800/80 rounded-xl border border-zinc-700/50">
            <button
              onClick={() => setActiveTab('cat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cat'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Building2 className="h-4 w-4" />
              CAT - Ocupación
            </button>
            <button
              onClick={() => setActiveTab('invian')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invian'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              INVIAN QEB
            </button>
          </div>

          <div className="flex-1" />

          {/* Popup Buttons: Filter, Group, Sort */}
          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => { setShowFilterPopup(!showFilterPopup); setShowGroupPopup(false); setShowSortPopup(false); }}
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  currentFilters.length > 0
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                }`}
                title="Filtrar"
              >
                <Filter className="h-4 w-4" />
                {currentFilters.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                    {currentFilters.length}
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
                    {currentFilters.map((filter, index) => (
                      <div key={filter.id} className="flex items-center gap-2">
                        {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                        {index === 0 && <span className="w-8"></span>}
                        <select
                          value={filter.field}
                          onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                          className="w-[130px] text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white"
                        >
                          {currentFilterFields.map((f) => (
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
                          list={`datalist-orden-${filter.id}`}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          placeholder="Escribe o selecciona..."
                          className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                        />
                        <datalist id={`datalist-orden-${filter.id}`}>
                          {currentUniqueValues[filter.field]?.map((val) => (
                            <option key={val} value={val} />
                          ))}
                        </datalist>
                        <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {currentFilters.length === 0 && (
                      <p className="text-[11px] text-zinc-500 text-center py-3">Sin filtros. Haz clic en "Añadir".</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-900/30">
                    <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                      <Plus className="h-3 w-3" /> Añadir
                    </button>
                    <button onClick={clearCurrentFilters} disabled={currentFilters.length === 0} className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      Limpiar
                    </button>
                  </div>
                  {currentFilters.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-purple-900/30">
                      <span className="text-[10px] text-zinc-500">{dataCount} de {totalCount} registros</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Group Button */}
            <div className="relative">
              <button
                onClick={() => { setShowGroupPopup(!showGroupPopup); setShowFilterPopup(false); setShowSortPopup(false); }}
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  currentGroupings.length > 0
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300'
                }`}
                title="Agrupar"
              >
                <Layers className="h-4 w-4" />
                {currentGroupings.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white px-1">
                    {currentGroupings.length}
                  </span>
                )}
              </button>
              {showGroupPopup && (
                <div className="absolute right-0 top-full mt-1 z-[60] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide px-2 py-1">Agrupar por</p>
                  {currentGroupOptions.map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => toggleGrouping(field)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                        currentGroupings.includes(field as CATGroupByField & INVIANGroupByField) ? 'text-purple-300' : 'text-zinc-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        currentGroupings.includes(field as CATGroupByField & INVIANGroupByField) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'
                      }`}>
                        {currentGroupings.includes(field as CATGroupByField & INVIANGroupByField) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-purple-900/30 mt-2 pt-2">
                    <button
                      onClick={() => activeTab === 'cat' ? setCatGroupings([]) : setInvianGroupings([])}
                      className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                    >
                      Quitar agrupación
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => { setShowSortPopup(!showSortPopup); setShowFilterPopup(false); setShowGroupPopup(false); }}
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  currentSortField
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
                    {currentSortOptions.map((field) => (
                      <div
                        key={field.field}
                        className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                          currentSortField === field.field ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-purple-900/20'
                        }`}
                      >
                        <span className={currentSortField === field.field ? 'text-purple-300 font-medium' : 'text-zinc-300'}>
                          {field.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (activeTab === 'cat') { setCatSortField(field.field); setCatSortDirection('asc'); }
                              else { setInvianSortField(field.field); setInvianSortDirection('asc'); }
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              currentSortField === field.field && currentSortDirection === 'asc'
                                ? 'bg-purple-600 text-white'
                                : 'text-zinc-400 hover:text-white hover:bg-purple-900/50'
                            }`}
                            title="Ascendente"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (activeTab === 'cat') { setCatSortField(field.field); setCatSortDirection('desc'); }
                              else { setInvianSortField(field.field); setInvianSortDirection('desc'); }
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              currentSortField === field.field && currentSortDirection === 'desc'
                                ? 'bg-purple-600 text-white'
                                : 'text-zinc-400 hover:text-white hover:bg-purple-900/50'
                            }`}
                            title="Descendente"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {currentSortField && (
                    <div className="mt-3 pt-3 border-t border-purple-900/30">
                      <button
                        onClick={() => activeTab === 'cat' ? setCatSortField(null) : setInvianSortField(null)}
                        className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors"
                      >
                        Quitar ordenamiento
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear All */}
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

          {/* Data count */}
          <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">
            {dataCount}{dataCount !== totalCount && ` / ${totalCount}`} registros
          </span>

          {/* Export button */}
          <button
            onClick={handleExportXLSX}
            disabled={isLoading || dataCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Download className="h-4 w-4" />
            Exportar XLSX
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : activeTab === 'cat' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Asesor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">APS</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Negociación</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Caras</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCATData ? (
                    groupedCATData.map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        <tr
                          onClick={() => toggleGroup(groupName)}
                          className="bg-purple-500/10 border-b border-purple-500/20 cursor-pointer hover:bg-purple-500/15 transition-colors"
                        >
                          <td colSpan={14} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {catExpandedGroups.has(groupName) ? (
                                <ChevronDown className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400" />
                              )}
                              <span className="font-semibold text-white text-sm">{groupName}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
                                {items.length} registros
                              </span>
                              <span className="text-xs text-zinc-400">
                                Caras: {items.reduce((sum, i) => sum + (Number(i.caras) || 0), 0).toLocaleString()}
                              </span>
                              <span className="text-xs text-emerald-400">
                                Total: ${items.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0).toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {catExpandedGroups.has(groupName) && items.map((item, idx) => (
                          <CATRow key={`${groupName}-${idx}`} item={item} />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    filteredCATData.map((item, idx) => (
                      <CATRow key={idx} item={item} />
                    ))
                  )}
                  {filteredCATData.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <ClipboardList className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredCATData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                    <tr className="border-t-2 border-purple-500/40">
                      <td colSpan={11} className="px-3 py-3 text-right text-sm font-semibold text-purple-300">
                        Totales:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        {catTotals.caras.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        ${catTotals.tarifa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-emerald-400">
                        ${catTotals.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Anunciante</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Operación</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cód. Contrato</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Precio/Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Vendedor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Inicio/Periodo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Fin/Segmento</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Arte</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Unidad</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Ciudad</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo Dist.</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedINVIANData ? (
                    groupedINVIANData.map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        <tr
                          onClick={() => toggleGroup(groupName)}
                          className="bg-cyan-500/10 border-b border-cyan-500/20 cursor-pointer hover:bg-cyan-500/15 transition-colors"
                        >
                          <td colSpan={13} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {invianExpandedGroups.has(groupName) ? (
                                <ChevronDown className="h-4 w-4 text-cyan-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-cyan-400" />
                              )}
                              <span className="font-semibold text-white text-sm">{groupName}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300">
                                {items.length} registros
                              </span>
                            </div>
                          </td>
                        </tr>
                        {invianExpandedGroups.has(groupName) && items.map((item, idx) => (
                          <INVIANRow key={`${groupName}-${idx}`} item={item} />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    filteredINVIANData.map((item, idx) => (
                      <INVIANRow key={idx} item={item} />
                    ))
                  )}
                  {filteredINVIANData.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Row components
function CATRow({ item }: { item: OrdenMontajeCAT }) {
  const negociacionColor = item.negociacion === 'BONIFICACION'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-zinc-300">{item.plaza || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.tipo || '-'}</td>
      <td className="px-3 py-2">
        {item.asesor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.asesor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.asesor)}
            </div>
            <span className="text-xs text-zinc-300 truncate max-w-[100px]" title={item.asesor}>{item.asesor}</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-purple-300 font-mono">{item.aps_especifico || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(item.fecha_inicio_periodo)}</td>
      <td className="px-3 py-2 text-xs text-zinc-400">{formatDate(item.fecha_fin_periodo)}</td>
      <td className="px-3 py-2 text-xs text-zinc-300 max-w-[120px] truncate" title={item.cliente || ''}>{item.cliente || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.marca || '-'}</td>
      <td className="px-3 py-2 text-xs text-white font-medium max-w-[150px] truncate" title={item.campania || ''}>{item.campania || '-'}</td>
      <td className="px-3 py-2 text-xs text-violet-300 font-mono">{item.numero_articulo || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${negociacionColor}`}>
          {item.negociacion}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right text-white font-medium">{Number(item.caras) || 0}</td>
      <td className="px-3 py-2 text-xs text-right text-zinc-300">${(Number(item.tarifa) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.monto_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  );
}

function INVIANRow({ item }: { item: OrdenMontajeINVIAN }) {
  const operacionColor = item.Operacion === 'BONIFICACION'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-white font-medium max-w-[140px] truncate" title={item.Campania || ''}>{item.Campania || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300 max-w-[120px] truncate" title={item.Anunciante || ''}>{item.Anunciante || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${operacionColor}`}>
          {item.Operacion || '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400 font-mono">{item.CodigoContrato || '-'}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.PrecioPorCara) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2">
        {item.Vendedor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.Vendedor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.Vendedor)}
            </div>
            <span className="text-xs text-zinc-300 truncate max-w-[80px]" title={item.Vendedor}>{item.Vendedor}</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.InicioPeriodo || '-'}</td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.FinSegmento || '-'}</td>
      <td className="px-3 py-2 text-xs text-cyan-300">{item.Arte || '-'}</td>
      <td className="px-3 py-2 text-xs text-violet-300 font-mono">{item.Unidad || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.Cara || '-'}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{item.Ciudad || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${operacionColor}`}>
          {item.TipoDistribucion || '-'}
        </span>
      </td>
    </tr>
  );
}
