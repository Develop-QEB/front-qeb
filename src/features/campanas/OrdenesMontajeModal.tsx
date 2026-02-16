import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Download, Filter, ChevronDown, ChevronRight, Calendar, Loader2, FileSpreadsheet,
  Monitor,
  Building2, ClipboardList, Layers, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Check
} from 'lucide-react';
import { campanasService, OrdenMontajeCAT, OrdenMontajeINVIAN } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import * as XLSX from 'xlsx';

// URL base para archivos estáticos
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

// Helper para normalizar URLs de archivos
const getFileUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;

  // Si ya es una URL completa (http/https), usarla tal cual
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Si es localhost, convertirla a la URL del entorno actual
    if (url.includes('localhost')) {
      try {
        const urlObj = new URL(url);
        return `${STATIC_URL}${urlObj.pathname}`;
      } catch {
        const match = url.match(/localhost:\d+(.+)/);
        if (match) return `${STATIC_URL}${match[1]}`;
      }
    }
    return url;
  }

  // Si es una ruta relativa, agregar la URL base
  if (url.startsWith('/')) {
    return `${STATIC_URL}${url}`;
  }

  // Si no tiene slash al inicio, agregarlo
  return `${STATIC_URL}/${url}`;
};

interface OrdenesMontajeModalProps {
  isOpen: boolean;
  onClose: () => void;
  canExport?: boolean;
}

type TabType = 'cat' | 'digital' | 'invian';

// Status options for filter
const STATUS_OPTIONS = ['Aprobada', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

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

export function OrdenesMontajeModal({ isOpen, onClose, canExport = true }: OrdenesMontajeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cat');
  const contentRef = useRef<HTMLDivElement>(null);

  // Period filters (kept for API query)
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);

  // Multiselect catorcena filter
  const [selectedCatorcenas, setSelectedCatorcenas] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [showCatorcenaPopup, setShowCatorcenaPopup] = useState(false);

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

  // Catorcena multiselect options - generated from actual data
  const catorcenaOptions = useMemo(() => {
    const catorcenasSet = new Map<string, { numero: number; year: number }>();

    // Get catorcenas from CAT data
    if (catData) {
      catData.forEach(item => {
        if (item.catorcena_numero && item.catorcena_year) {
          const id = `${item.catorcena_numero}-${item.catorcena_year}`;
          if (!catorcenasSet.has(id)) {
            catorcenasSet.set(id, { numero: item.catorcena_numero, year: item.catorcena_year });
          }
        }
      });
    }

    // Get catorcenas from INVIAN data
    if (invianData) {
      invianData.forEach(item => {
        if (item.catorcena_numero && item.catorcena_year) {
          const id = `${item.catorcena_numero}-${item.catorcena_year}`;
          if (!catorcenasSet.has(id)) {
            catorcenasSet.set(id, { numero: item.catorcena_numero, year: item.catorcena_year });
          }
        }
      });
    }

    return Array.from(catorcenasSet.entries()).map(([id, data]) => ({
      id,
      label: `Catorcena ${data.numero} del ${data.year}`,
      numero: data.numero,
      year: data.year,
    })).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.numero - a.numero;
    });
  }, [catData, invianData]);

    // Filtered and sorted CAT data
  const filteredCATData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio_periodo) return false;
        const itemDate = new Date(item.fecha_inicio_periodo);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as unknown as OrdenMontajeCAT[];
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
  }, [catData, selectedCatorcenas, fechaInicio, fechaFin, catFilters, catSortField, catSortDirection]);

  // Filter Digital data (CAT without VIA PUBLICA)
  const filteredDigitalData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Exclude VIA PUBLICA
    items = items.filter(item => {
      const unidad = (item.unidad_negocio || '').toUpperCase();
      return !unidad.includes('VIA PUBLICA') && !unidad.includes('VÍA PÚBLICA');
    });

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio_periodo) return false;
        const itemDate = new Date(item.fecha_inicio_periodo);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters (reuse cat filters for digital)
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as unknown as OrdenMontajeCAT[];
    }

    // Sort
    if (catSortField) {
      items.sort((a, b) => {
        const aVal = a[catSortField as keyof OrdenMontajeCAT];
        const bVal = b[catSortField as keyof OrdenMontajeCAT];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return catSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        return catSortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return items;
  }, [catData, selectedCatorcenas, fechaInicio, fechaFin, catFilters, catSortField, catSortDirection]);

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

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio) return false;
        const itemDate = new Date(item.fecha_inicio);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (invianFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], invianFilters) as unknown as OrdenMontajeINVIAN[];
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
  }, [invianData, selectedCatorcenas, fechaInicio, fechaFin, invianFilters, invianSortField, invianSortDirection]);

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
    if (activeTab === 'cat' && filteredCATData.length > 0) {
      const wsData = filteredCATData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor': item.asesor || '',
        'APS': item.aps_especifico || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? formatDate(item.fecha_inicio_periodo) : '',
        'Fecha Fin': item.fecha_fin_periodo ? formatDate(item.fecha_fin_periodo) : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Unidad de Negocio': item.unidad_negocio || '',
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
    } else if (activeTab === 'digital' && filteredDigitalData.length > 0) {
      const wsData = filteredDigitalData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor': item.asesor || '',
        'APS': item.aps_especifico || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? new Date(item.fecha_inicio_periodo).toLocaleDateString() : '',
        'Fecha Fin': item.fecha_fin_periodo ? new Date(item.fecha_fin_periodo).toLocaleDateString() : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Unidad de Negocio': item.unidad_negocio || '',
        'Campaña': item.campania || '',
        'No. Artículo': item.numero_articulo || '',
        'Negociación': item.negociacion || '',
        'Caras': item.caras || 0,
        'Tarifa': Number(item.tarifa) || 0,
        'Monto Total': Number(item.monto_total) || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Digital');
      XLSX.writeFile(wb, `orden_montaje_digital_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'invian' && filteredINVIANData.length > 0) {
      const wsData = filteredINVIANData.map(item => ({
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
        'Arte Url (Opcional)': getFileUrl(item.ArteUrl) || '',
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
    const fields = activeTab === 'cat' || activeTab === 'digital' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
    const newFilter: AdvancedFilterCondition = {
      id: `filter-${Date.now()}`,
      field: fields[0].field,
      operator: '=',
      value: '',
    };
    if (activeTab === 'cat' || activeTab === 'digital') {
      setCatFilters(prev => [...prev, newFilter]);
    } else {
      setInvianFilters(prev => [...prev, newFilter]);
    }
  }, [activeTab]);

  const updateFilter = useCallback((id: string, updates: Partial<AdvancedFilterCondition>) => {
    if (activeTab === 'cat' || activeTab === 'digital') {
      setCatFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    } else {
      setInvianFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    }
  }, [activeTab]);

  const removeFilter = useCallback((id: string) => {
    if (activeTab === 'cat' || activeTab === 'digital') {
      setCatFilters(prev => prev.filter(f => f.id !== id));
    } else {
      setInvianFilters(prev => prev.filter(f => f.id !== id));
    }
  }, [activeTab]);

  const clearCurrentFilters = useCallback(() => {
    if (activeTab === 'cat' || activeTab === 'digital') {
      setCatFilters([]);
    } else {
      setInvianFilters([]);
    }
  }, [activeTab]);

  // Grouping toggle
  const toggleGrouping = useCallback((field: string) => {
    if (activeTab === 'cat' || activeTab === 'digital') {
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
    if (activeTab === 'cat' || activeTab === 'digital') {
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
    setSelectedCatorcenas([]);
    setFechaInicio('');
    setFechaFin('');
    setCatFilters([]);
    setCatGroupings([]);
    setCatSortField(null);
    setInvianFilters([]);
    setInvianGroupings([]);
    setInvianSortField(null);
  }, []);

  // Current tab data
  const currentFilters = activeTab === 'cat' || activeTab === 'digital' ? catFilters : invianFilters;
  const currentGroupings = activeTab === 'cat' || activeTab === 'digital' ? catGroupings : invianGroupings;
  const currentSortField = activeTab === 'cat' || activeTab === 'digital' ? catSortField : invianSortField;
  const currentSortDirection = activeTab === 'cat' || activeTab === 'digital' ? catSortDirection : invianSortDirection;
  const currentFilterFields = activeTab === 'cat' || activeTab === 'digital' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
  const currentGroupOptions = activeTab === 'cat' || activeTab === 'digital' ? CAT_GROUPINGS : INVIAN_GROUPINGS;
  const currentSortOptions = activeTab === 'cat' || activeTab === 'digital' ? CAT_SORT_FIELDS : INVIAN_SORT_FIELDS;
  const currentUniqueValues = activeTab === 'cat' || activeTab === 'digital' ? getCATUniqueValues : getINVIANUniqueValues;

  const hasActiveFilters = currentFilters.length > 0 || currentGroupings.length > 0 || currentSortField !== null || selectedCatorcenas.length > 0 || fechaInicio || fechaFin;

  if (!isOpen) return null;

  const isLoading = activeTab === 'cat' || activeTab === 'digital' ? isLoadingCAT : isLoadingINVIAN;
  const dataCount = activeTab === 'cat' ? filteredCATData.length : activeTab === 'digital' ? filteredDigitalData.length : filteredINVIANData.length;
  const totalCount = activeTab === 'cat' ? (catData?.length || 0) : activeTab === 'digital' ? filteredDigitalData.length : (invianData?.length || 0);

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

        {/* Tabs and Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/80">
          {/* Tabs */}
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
              CAT
            </button>
            <button
              onClick={() => setActiveTab('digital')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'digital'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Digital
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
              INVIAN
            </button>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Filters Button */}
            <div className="relative">
              <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  hasActiveFilters
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                    {(selectedCatorcenas.length > 0 ? 1 : 0) + (fechaInicio ? 1 : 0) + currentFilters.length + currentGroupings.length + (currentSortField ? 1 : 0)}
                  </span>
                )}
              </button>

              {showFilterPopup && (
                <div className="absolute right-0 top-full mt-2 z-[60] w-[480px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Filtros y Opciones</span>
                    <button onClick={() => setShowFilterPopup(false)} className="text-zinc-400 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {/* Date Range */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Periodo de Fechas</label>
                        {(fechaInicio || fechaFin) && (
                          <button
                            onClick={() => { setFechaInicio(''); setFechaFin(''); }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 mb-1 block">Desde</label>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => {
                              setFechaInicio(e.target.value);
                              // Clear catorcenas when using date range (mutually exclusive)
                              if (e.target.value) setSelectedCatorcenas([]);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm border text-white focus:outline-none ${
                              fechaInicio
                                ? 'bg-purple-900/30 border-purple-500/50 focus:border-purple-400'
                                : 'bg-zinc-800 border-zinc-700 focus:border-purple-500'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col items-center justify-center pt-4">
                          <div className="w-8 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 mb-1 block">Hasta</label>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => {
                              setFechaFin(e.target.value);
                              // Clear catorcenas when using date range (mutually exclusive)
                              if (e.target.value) setSelectedCatorcenas([]);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm border text-white focus:outline-none ${
                              fechaFin
                                ? 'bg-purple-900/30 border-purple-500/50 focus:border-purple-400'
                                : 'bg-zinc-800 border-zinc-700 focus:border-purple-500'
                            }`}
                          />
                        </div>
                      </div>
                      {(fechaInicio && fechaFin) && (
                        <div className="mt-2 px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-purple-300">Rango seleccionado:</span>
                            <span className="text-white font-medium">
                              {new Date(fechaInicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' → '}
                              {new Date(fechaFin).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Catorcenas */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Catorcenas ({selectedCatorcenas.length} seleccionadas)</label>
                        {selectedCatorcenas.length > 0 && (
                          <button
                            onClick={() => setSelectedCatorcenas([])}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      {(fechaInicio || fechaFin) && (
                        <div className="mb-2 px-2 py-1.5 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                          <span className="text-xs text-amber-400">Limpia el rango de fechas para seleccionar catorcenas</span>
                        </div>
                      )}
                      <div className={`flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50 ${(fechaInicio || fechaFin) ? 'opacity-50 pointer-events-none' : ''}`}>
                        {catorcenaOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              // Clear date range when selecting catorcenas (mutually exclusive)
                              setFechaInicio('');
                              setFechaFin('');
                              setSelectedCatorcenas(prev =>
                                prev.includes(option.id)
                                  ? prev.filter(id => id !== option.id)
                                  : [...prev, option.id]
                              );
                            }}
                            disabled={!!(fechaInicio || fechaFin)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              selectedCatorcenas.includes(option.id)
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                        {catorcenaOptions.length === 0 && (
                          <span className="text-xs text-zinc-500">No hay catorcenas</span>
                        )}
                      </div>
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">Ordenar por</label>
                      <div className="flex gap-2">
                        <select
                          value={currentSortField || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            if (activeTab === 'cat' || activeTab === 'digital') {
                              setCatSortField(val);
                            } else {
                              setInvianSortField(val);
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Sin ordenar</option>
                          {currentSortOptions.map(opt => (
                            <option key={opt.field} value={opt.field}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (activeTab === 'cat' || activeTab === 'digital') {
                              setCatSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setInvianSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 text-sm"
                        >
                          {currentSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>
                    </div>

                    {/* Group */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">Agrupar por</label>
                      <select
                        value={currentGroupings[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeTab === 'cat' || activeTab === 'digital') {
                            setCatGroupings(val ? [val as CATGroupByField] : []);
                          } else {
                            setInvianGroupings(val ? [val as INVIANGroupByField] : []);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="">Sin agrupar</option>
                        {currentGroupOptions.map(opt => (
                          <option key={opt.field} value={opt.field}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-800 flex justify-between">
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Limpiar todo
                    </button>
                    <button
                      onClick={() => setShowFilterPopup(false)}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Count */}
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
              {dataCount}{dataCount !== totalCount && ` / ${totalCount}`}
            </span>

            {/* Export */}
            {canExport && (
              <button
                onClick={handleExportXLSX}
                disabled={isLoading || dataCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Exportar
              </button>
            )}
          </div>
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
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">U. Negocio</th>
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
                          <td colSpan={13} className="px-4 py-2">
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
                      <td colSpan={13} className="px-4 py-12 text-center">
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
          ) : activeTab === 'digital' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-orange-500/20 bg-gradient-to-r from-orange-900/40 via-amber-900/30 to-orange-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Asesor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">APS</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">U. Negocio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Negociación</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Caras</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDigitalData.map((item, idx) => (
                    <CATRow key={idx} item={item} />
                  ))}
                  {filteredDigitalData.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-4">
                          <Monitor className="w-8 h-8 text-orange-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros digitales</p>
                      </td>
                    </tr>
                  )}
                </tbody>
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
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Archivo</th>
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
      <td className="px-3 py-2 text-xs text-orange-300">{item.unidad_negocio || '-'}</td>
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
      <td className="px-3 py-2 text-xs">
        {(() => {
          const arteUrl = getFileUrl(item.ArteUrl);
          return arteUrl ? (
            <a
              href={arteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[150px] block"
              title={arteUrl}
            >
              {arteUrl.split('/').pop() || 'Ver archivo'}
            </a>
          ) : (
            <span className="text-zinc-500">-</span>
          );
        })()}
      </td>
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
