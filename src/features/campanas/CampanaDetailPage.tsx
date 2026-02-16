import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Send, X, FileSpreadsheet, ListTodo, Layers, ChevronDown, ChevronRight, Check, Minus, Filter, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Loader2, CheckCircle, AlertCircle, AlertTriangle, Package, MapPinOff, RefreshCw, MessageSquareOff, ServerCrash, WifiOff, History } from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioReservado, InventarioConAPS, buildDeliveryNote, postDeliveryNoteToSAP, HistorialItem } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import { Badge } from '../../components/ui/badge';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketCampana } from '../../hooks/useSocket';

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'info'> = {
  Aprobada: 'success',
  Abierto: 'success',
  inactiva: 'secondary',
  Cerrado: 'secondary',
};

type InfoItemType = 'date' | 'catorcena' | 'user' | 'id' | 'amount' | 'percent' | 'status' | 'category' | 'default';

interface InfoItemProps {
  label: string;
  value: string | number | null | undefined;
  type?: InfoItemType;
}

// Estilos para chips según tipo de dato
const chipStyles: Record<InfoItemType, string> = {
  date: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  catorcena: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  user: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  id: 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono',
  amount: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold',
  percent: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  status: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  category: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  default: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30',
};

// Formatear fecha como "Catorcena X, YYYY"
function formatAsCatorcena(dateStr: string): string {
  try {
    const fecha = new Date(dateStr);
    if (isNaN(fecha.getTime())) return dateStr;
    const catorcena = calcularCatorcena(fecha);
    const anio = fecha.getFullYear();
    return `Catorcena ${catorcena}, ${anio}`;
  } catch {
    return dateStr;
  }
}


// Helper to find catorcena from date using API data
function dateToCatorcena(dateStr: string, catorcenas: Catorcena[]): { catorcena: string; year: number } | null {
  if (!dateStr || !catorcenas.length) return null;
  const date = new Date(dateStr);
  const found = catorcenas.find(c => {
    const inicio = new Date(c.fecha_inicio);
    const fin = new Date(c.fecha_fin);
    return date >= inicio && date <= fin;
  });
  if (found) {
    return { catorcena: `Catorcena ${found.numero_catorcena}`, year: found.a_o };
  }
  return null;
}

function getCatorcenaDisplay(dateStr: string, catorcenas: Catorcena[]): string {
  const result = dateToCatorcena(dateStr, catorcenas);
  if (result) {
    return `${result.catorcena}, ${result.year}`;
  }
  return dateStr;
}

function InfoItem({ label, value, type = 'default' }: InfoItemProps) {
  if (value === null || value === undefined || value === '') return null;

  // Formatear valor según tipo
  let displayValue: string | number = value;

  if (type === 'date') {
    displayValue = formatDate(String(value));
  } else if (type === 'catorcena') {
    displayValue = formatAsCatorcena(String(value));
  } else if (type === 'amount' && typeof value === 'number') {
    displayValue = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-md ${chipStyles[type]}`}>
        {displayValue}
      </span>
    </div>
  );
}

// Skeleton Components
function InfoCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
      <div className="h-4 bg-purple-500/20 rounded w-24 mb-4"></div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex justify-between items-center py-1.5">
            <div className="h-3 bg-zinc-700/50 rounded w-20"></div>
            <div className="h-5 bg-zinc-700/30 rounded-md w-28"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="space-y-2">
        {/* Header skeleton */}
        <div className="flex items-center gap-2 pb-2">
          <div className="h-7 bg-purple-900/30 rounded-lg w-32"></div>
          <div className="h-7 bg-purple-900/30 rounded-lg w-24"></div>
          <div className="h-7 bg-purple-900/30 rounded-lg w-20"></div>
        </div>
        {/* Table rows skeleton */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-purple-900/20 px-3 py-2 flex gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-3 bg-purple-500/30 rounded w-16"></div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-3 py-2.5 border-t border-border flex gap-4">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-3 bg-zinc-700/40 rounded w-16"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-purple-900/20 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-purple-500/30 mb-3 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
      </div>
      <div className="h-3 bg-purple-500/20 rounded w-32 mb-2"></div>
      <div className="h-2 bg-zinc-700/30 rounded w-24"></div>
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-2 py-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/30 flex-shrink-0"></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-3 bg-zinc-700/50 rounded w-20"></div>
              <div className="h-2 bg-zinc-700/30 rounded w-16"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-zinc-700/40 rounded w-full"></div>
              <div className="h-2 bg-zinc-700/40 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
        {icon || <Package className="h-6 w-6 text-purple-400" />}
      </div>
      <p className="text-sm font-medium text-zinc-300 text-center">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground text-center mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Error State Component
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

function ErrorState({
  title = 'Error al cargar datos',
  message = 'No se pudieron obtener los datos. Por favor, intenta de nuevo.',
  onRetry,
  className = '',
  variant = 'default'
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
        <span className="text-xs text-red-300 flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex flex-col items-center justify-center py-4 px-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </div>
        <p className="text-xs text-red-300 text-center">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/20 rounded transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <ServerCrash className="h-6 w-6 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-300 text-center">{title}</p>
      <p className="text-xs text-red-400/70 text-center mt-1 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </button>
      )}
    </div>
  );
}

// Map Empty State Component
function MapEmptyState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-purple-900/10">
      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
        <MapPinOff className="h-6 w-6 text-purple-400" />
      </div>
      <p className="text-sm font-medium text-zinc-300">Sin ubicaciones</p>
      <p className="text-xs text-muted-foreground text-center mt-1">
        No hay coordenadas disponibles para mostrar en el mapa
      </p>
    </div>
  );
}

// Map Error State Component
function MapErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/10">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <WifiOff className="h-6 w-6 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-300">Error al cargar el mapa</p>
      <p className="text-xs text-red-400/70 text-center mt-1">
        No se pudo conectar con Google Maps
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </button>
      )}
    </div>
  );
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

type GroupByField = 'inicio_periodo' | 'articulo' | 'plaza' | 'tipo_de_cara' | 'estatus_reserva' | 'aps';

interface GroupConfig {
  field: GroupByField;
  label: string;
}

const AVAILABLE_GROUPINGS: GroupConfig[] = [
  { field: 'inicio_periodo', label: 'Inicio Periodo' },
  { field: 'articulo', label: 'Artículo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo_de_cara', label: 'Tipo de Cara' },
  { field: 'estatus_reserva', label: 'Estatus' },
];

const AVAILABLE_GROUPINGS_APS: GroupConfig[] = [
  { field: 'inicio_periodo', label: 'Inicio Periodo' },
  { field: 'articulo', label: 'Artículo' },
  { field: 'aps', label: 'APS' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo_de_cara', label: 'Tipo de Cara' },
  { field: 'estatus_reserva', label: 'Estatus' },
];

// Tipos para filtros
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains' | '>' | '<' | '>=' | '<=';

interface FilterCondition {
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

// Campos visibles en la tabla de Inventario Reservado
const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Código', type: 'string' },
  { field: 'solicitud_caras_id', label: 'Grupo ID', type: 'number' },
  { field: 'mueble', label: 'Mueble', type: 'string' },
  { field: 'estado', label: 'Estado', type: 'string' },
  { field: 'tipo_de_cara', label: 'Tipo', type: 'string' },
  { field: 'caras_totales', label: 'Caras', type: 'number' },
];

// Campos visibles en la tabla de Inventario con APS (mismos que inventario reservado)
const FILTER_FIELDS_APS: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Código', type: 'string' },
  { field: 'solicitud_caras_id', label: 'Grupo ID', type: 'number' },
  { field: 'mueble', label: 'Mueble', type: 'string' },
  { field: 'estado', label: 'Estado', type: 'string' },
  { field: 'tipo_de_cara', label: 'Tipo', type: 'string' },
  { field: 'caras_totales', label: 'Caras', type: 'number' },
];

// Campos para ordenamiento (inventario reservado) - mismos que filtros
const SORT_FIELDS = FILTER_FIELDS;

// Campos para ordenamiento (inventario con APS) - mismos que filtros
const SORT_FIELDS_APS = FILTER_FIELDS_APS;

// Configuración de columnas para las tablas
interface TableColumn {
  field: string;
  label: string;
  render?: (value: unknown) => React.ReactNode;
}

const TABLE_COLUMNS: TableColumn[] = [
  { field: 'codigo_unico', label: 'Código' },
  { field: 'solicitud_caras_id', label: 'Grupo ID' },
  { field: 'mueble', label: 'Mueble' },
  { field: 'estado', label: 'Estado' },
  { field: 'tipo_de_cara', label: 'Tipo' },
  { field: 'caras_totales', label: 'Caras' },
];

const OPERATORS: { value: FilterOperator; label: string; forTypes: ('string' | 'number')[] }[] = [
  { value: '=', label: 'Igual a', forTypes: ['string', 'number'] },
  { value: '!=', label: 'Diferente de', forTypes: ['string', 'number'] },
  { value: 'contains', label: 'Contiene', forTypes: ['string'] },
  { value: 'not_contains', label: 'No contiene', forTypes: ['string'] },
  { value: '>', label: 'Mayor que', forTypes: ['number'] },
  { value: '<', label: 'Menor que', forTypes: ['number'] },
  { value: '>=', label: 'Mayor o igual', forTypes: ['number'] },
  { value: '<=', label: 'Menor o igual', forTypes: ['number'] },
];

// Función para aplicar filtros a los datos
function applyFilters<T>(data: T[], filters: FilterCondition[]): T[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = (item as Record<string, unknown>)[filter.field];
      const filterValue = filter.value;

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

// Helper para calcular el número de catorcena a partir de una fecha
function calcularCatorcena(fecha: Date): number {
  const inicioAnio = new Date(fecha.getFullYear(), 0, 1);
  const diffMs = fecha.getTime() - inicioAnio.getTime();
  const diaDelAnio = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(diaDelAnio / 14);
}

// Helper para formatear inicio_periodo como "Catorcena X, Año YYYY"
function formatInicioPeriodo(item: InventarioReservado | InventarioConAPS): string {
  if (item.numero_catorcena && item.anio_catorcena) {
    return `Catorcena ${item.numero_catorcena}, ${item.anio_catorcena}`;
  }

  // Si tenemos la fecha de inicio_periodo, calcular la catorcena
  if (item.inicio_periodo) {
    const fecha = new Date(item.inicio_periodo);
    const catorcena = calcularCatorcena(fecha);
    const anio = fecha.getFullYear();
    return `Catorcena ${catorcena}, ${anio}`;
  }

  return 'Sin asignar';
}

// Helper para formatear articulo con info adicional
function formatArticulo(item: InventarioReservado | InventarioConAPS): string {
  console.log('formatArticulo item:', {
    articulo: item.articulo,
    solicitud_caras_id: item.solicitud_caras_id,
    tradicional_digital: item.tradicional_digital,
    caras_totales: item.caras_totales
  });
  const parts: string[] = [];

  if (item.articulo) {
    parts.push(item.articulo.toUpperCase());
  }

  if (item.solicitud_caras_id) {
    parts.push(`Grupo ${item.solicitud_caras_id}`);
  }

  if (item.tradicional_digital) {
    const tipo = item.tradicional_digital.charAt(0).toUpperCase() + item.tradicional_digital.slice(1).toLowerCase();
    parts.push(`${tipo} (${item.caras_totales})`);
  } else if (item.tipo_medio) {
    parts.push(item.tipo_medio);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Sin asignar';
}

// Helper para obtener el valor de agrupación formateado
function getGroupValue(item: InventarioReservado | InventarioConAPS, field: GroupByField): string {
  if (field === 'inicio_periodo') {
    return formatInicioPeriodo(item);
  }
  if (field === 'articulo') {
    return formatArticulo(item);
  }
  if (field === 'aps') {
    const apsItem = item as InventarioConAPS;
    return apsItem.aps ? `APS ${apsItem.aps}` : 'Sin APS';
  }
  return String(item[field] || 'Sin asignar');
}

export function CampanaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);
  const campanaId = id ? parseInt(id, 10) : 1;

  // WebSocket para actualizar comentarios en tiempo real
  useSocketCampana(campanaId);

  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Estado para selección de items (sin APS)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Estado para selección de items (con APS)
  const [selectedItemsAPS, setSelectedItemsAPS] = useState<Set<string>>(new Set());

  // Estado para agrupación (sin APS)
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>(['inicio_periodo', 'articulo']);
  const [showGroupingConfig, setShowGroupingConfig] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para agrupación (con APS)
  const [activeGroupingsAPS, setActiveGroupingsAPS] = useState<GroupByField[]>(['inicio_periodo', 'aps', 'articulo']);
  const [showGroupingConfigAPS, setShowGroupingConfigAPS] = useState(false);
  const [expandedGroupsAPS, setExpandedGroupsAPS] = useState<Set<string>>(new Set());

  // Estado para modal de quitar APS
  const [showRemoveAPSModal, setShowRemoveAPSModal] = useState(false);
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [nipInput, setNipInput] = useState('');
  const [codigoGenerado, setCodigoGenerado] = useState('');
  const [timestampPIN, setTimestampPIN] = useState(0);
  const [botonDeshabilitado, setBotonDeshabilitado] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [pinVerificado, setPinVerificado] = useState(false);
  const [errorPIN, setErrorPIN] = useState('');

  // Estado para filtros (inventario reservado)
  const [filtersReservado, setFiltersReservado] = useState<FilterCondition[]>([]);
  const [showFiltersReservado, setShowFiltersReservado] = useState(false);

  // Estado para filtros (inventario con APS)
  const [filtersAPS, setFiltersAPS] = useState<FilterCondition[]>([]);
  const [showFiltersAPS, setShowFiltersAPS] = useState(false);

  // Estado para ordenamiento (inventario reservado)
  const [sortFieldReservado, setSortFieldReservado] = useState<string | null>(null);
  const [sortDirectionReservado, setSortDirectionReservado] = useState<'asc' | 'desc'>('asc');
  const [showSortReservado, setShowSortReservado] = useState(false);

  // Estado para ordenamiento (inventario con APS)
  const [sortFieldAPS, setSortFieldAPS] = useState<string | null>(null);
  const [sortDirectionAPS, setSortDirectionAPS] = useState<'asc' | 'desc'>('asc');
  const [showSortAPS, setShowSortAPS] = useState(false);

  // Estado para POST a SAP
  const [showPostSAPModal, setShowPostSAPModal] = useState(false);
  const [postingToSAP, setPostingToSAP] = useState(false);
  const [postSAPResult, setPostSAPResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const { data: campana, isLoading, error } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
  });

  const { data: inventarioReservado = [], isLoading: isLoadingInventario, error: errorInventario, refetch: refetchInventario } = useQuery({
    queryKey: ['campana-inventario', campanaId],
    queryFn: () => campanasService.getInventarioReservado(campanaId),
    enabled: !!campana,
  });

  const { data: inventarioConAPS = [], isLoading: isLoadingAPS, error: errorAPS, refetch: refetchAPS } = useQuery({
    queryKey: ['campana-inventario-aps', campanaId],
    queryFn: () => campanasService.getInventarioConAPS(campanaId),
    enabled: !!campana,
  });

  const { data: historial = [], isLoading: isLoadingHistorial } = useQuery({
    queryKey: ['campana-historial', campanaId],
    queryFn: () => campanasService.getHistorial(campanaId),
    enabled: !!campana,
  });

  // Fetch catorcenas for proper date display
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });
  const catorcenas = catorcenasData?.data || [];


  // Calcular centro del mapa basado en inventario
  const mapCenter = useMemo(() => {
    if (inventarioReservado.length > 0) {
      const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
      if (validItems.length > 0) {
        const avgLat = validItems.reduce((sum, i) => sum + i.latitud, 0) / validItems.length;
        const avgLng = validItems.reduce((sum, i) => sum + i.longitud, 0) / validItems.length;
        return { lat: avgLat, lng: avgLng };
      }
    }
    return { lat: 19.4326, lng: -99.1332 }; // CDMX por defecto
  }, [inventarioReservado]);

  // Callback para ajustar zoom del mapa a todos los puntos
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
    if (validItems.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validItems.forEach(item => {
        bounds.extend({ lat: item.latitud, lng: item.longitud });
      });
      map.fitBounds(bounds, 50); // 50px padding
    }
  }, [inventarioReservado]);

  // Efecto para ajustar bounds cuando cambia el inventario
  useEffect(() => {
    if (mapRef.current && inventarioReservado.length > 1) {
      const validItems = inventarioReservado.filter(i => i.latitud && i.longitud);
      if (validItems.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        validItems.forEach(item => {
          bounds.extend({ lat: item.latitud, lng: item.longitud });
        });
        mapRef.current.fitBounds(bounds, 50);
      }
    }
  }, [inventarioReservado]);

  // Datos filtrados y ordenados (inventario reservado)
  const filteredInventarioReservado = useMemo(() => {
    let data = applyFilters(inventarioReservado, filtersReservado);

    // Aplicar ordenamiento
    if (sortFieldReservado) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldReservado as keyof InventarioReservado];
        const bVal = b[sortFieldReservado as keyof InventarioReservado];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirectionReservado === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [inventarioReservado, filtersReservado, sortFieldReservado, sortDirectionReservado]);

  // Datos filtrados y ordenados (inventario con APS)
  const filteredInventarioAPS = useMemo(() => {
    let data = applyFilters(inventarioConAPS, filtersAPS);

    // Aplicar ordenamiento
    if (sortFieldAPS) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldAPS as keyof InventarioConAPS];
        const bVal = b[sortFieldAPS as keyof InventarioConAPS];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirectionAPS === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [inventarioConAPS, filtersAPS, sortFieldAPS, sortDirectionAPS]);

  // Obtener valores únicos para cada campo (inventario reservado)
  const getUniqueValuesReservado = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      inventarioReservado.forEach(item => {
        const val = item[fieldConfig.field as keyof InventarioReservado];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [inventarioReservado]);

  // Obtener valores únicos para cada campo (inventario con APS)
  const getUniqueValuesAPS = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS_APS.forEach(fieldConfig => {
      const values = new Set<string>();
      inventarioConAPS.forEach(item => {
        const val = item[fieldConfig.field as keyof InventarioConAPS];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [inventarioConAPS]);

  // Funciones para manejar filtros (inventario reservado)
  const addFilterReservado = () => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS[0].field,
      operator: '=',
      value: '',
    };
    setFiltersReservado(prev => [...prev, newFilter]);
  };

  const updateFilterReservado = (id: string, updates: Partial<FilterCondition>) => {
    setFiltersReservado(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilterReservado = (id: string) => {
    setFiltersReservado(prev => prev.filter(f => f.id !== id));
  };

  const clearFiltersReservado = () => {
    setFiltersReservado([]);
  };

  // Funciones para manejar filtros (inventario con APS)
  const addFilterAPS = () => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_APS[0].field,
      operator: '=',
      value: '',
    };
    setFiltersAPS(prev => [...prev, newFilter]);
  };

  const updateFilterAPS = (id: string, updates: Partial<FilterCondition>) => {
    setFiltersAPS(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilterAPS = (id: string) => {
    setFiltersAPS(prev => prev.filter(f => f.id !== id));
  };

  const clearFiltersAPS = () => {
    setFiltersAPS([]);
  };

  // Función para descargar CSV (inventario reservado)
  const downloadCSVReservado = useCallback(() => {
    const headers = ['Código', 'Grupo ID', 'Mueble', 'Estado', 'Tipo', 'Caras'];
    const fields: (keyof InventarioReservado)[] = ['codigo_unico', 'solicitud_caras_id', 'mueble', 'estado', 'tipo_de_cara', 'caras_totales'];

    const csvContent = [
      headers.join(','),
      ...filteredInventarioReservado.map(item =>
        fields.map(field => {
          const value = item[field];
          // Escapar comas y comillas en valores
          const strValue = value === null || value === undefined ? '' : String(value);
          return strValue.includes(',') || strValue.includes('"')
            ? `"${strValue.replace(/"/g, '""')}"`
            : strValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_reservado_${campana?.nombre || 'campana'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredInventarioReservado, campana?.nombre]);

  // Función para descargar CSV (inventario con APS)
  const downloadCSVAPS = useCallback(() => {
    const headers = ['Código', 'Grupo ID', 'Mueble', 'Estado', 'Tipo', 'Caras'];
    const fields: (keyof InventarioConAPS)[] = ['codigo_unico', 'solicitud_caras_id', 'mueble', 'estado', 'tipo_de_cara', 'caras_totales'];

    const csvContent = [
      headers.join(','),
      ...filteredInventarioAPS.map(item =>
        fields.map(field => {
          const value = item[field];
          // Escapar comas y comillas en valores
          const strValue = value === null || value === undefined ? '' : String(value);
          return strValue.includes(',') || strValue.includes('"')
            ? `"${strValue.replace(/"/g, '""')}"`
            : strValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_aps_${campana?.nombre || 'campana'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredInventarioAPS, campana?.nombre]);

  // Handler para POST a SAP
  const handlePostToSAP = useCallback(async () => {
    if (!campana || inventarioConAPS.length === 0) {
      setPostSAPResult({
        success: false,
        message: 'No hay datos para enviar a SAP',
      });
      return;
    }

    setPostingToSAP(true);
    setPostSAPResult(null);

    try {
      // Construir el payload
      const deliveryNote = buildDeliveryNote(campana, inventarioConAPS, campana.sap_database);
      console.log('========== DELIVERY NOTE JSON ==========');
      console.log('SAP Database:', campana.sap_database);
      console.log(JSON.stringify(deliveryNote, null, 2));
      console.log('==========================================');

      // Hacer POST a SAP (endpoint dinamico segun sap_database)
      const result = await postDeliveryNoteToSAP(deliveryNote, campana.sap_database);

      if (result.success) {
        setPostSAPResult({
          success: true,
          message: 'Delivery Note creado exitosamente en SAP',
          data: result.data,
        });
      } else {
        setPostSAPResult({
          success: false,
          message: result.error || 'Error al crear Delivery Note en SAP',
        });
      }
    } catch (error) {
      console.error('Error en handlePostToSAP:', error);
      setPostSAPResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error inesperado al conectar con SAP',
      });
    } finally {
      setPostingToSAP(false);
    }
  }, [campana, inventarioConAPS]);

  // Agrupar datos del inventario
  const groupedInventario = useMemo(() => {
    if (activeGroupings.length === 0) {
      return { ungrouped: filteredInventarioReservado };
    }

    const grouped: Record<string, InventarioReservado[] | Record<string, InventarioReservado[]>> = {};

    filteredInventarioReservado.forEach(item => {
      const firstKey = getGroupValue(item, activeGroupings[0]);

      if (activeGroupings.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioReservado[]).push(item);
      } else {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupings[1]);
        if (!(grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey]) {
          (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey] = [];
        }
        (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey].push(item);
      }
    });

    return grouped;
  }, [filteredInventarioReservado, activeGroupings]);

  // Toggle grupo expandido
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Toggle selección de item
  const toggleItemSelection = (rsvId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  };

  // Seleccionar/deseleccionar todos
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredInventarioReservado.length) {
      setSelectedItems(new Set<string>());
    } else {
      setSelectedItems(new Set<string>(filteredInventarioReservado.map(i => i.rsv_ids)));
    }
  };

  // Seleccionar/deseleccionar un grupo completo
  const toggleGroupSelection = (groupItems: InventarioReservado[]) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      const groupIds = groupItems.map(i => i.rsv_ids);
      const allSelected = groupIds.every(id => next.has(id));
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle agrupación (sin APS)
  const toggleGrouping = (field: GroupByField) => {
    setActiveGroupings(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length < 2) {
        return [...prev, field];
      }
      return [prev[1], field];
    });
  };

  // Columnas visibles (excluye las que están agrupadas) - Inventario Reservado
  const visibleColumnsReservado = useMemo(() => {
    return TABLE_COLUMNS.filter(col => !activeGroupings.includes(col.field as GroupByField));
  }, [activeGroupings]);

  // Columnas visibles (excluye las que están agrupadas) - Inventario APS
  const visibleColumnsAPS = useMemo(() => {
    return TABLE_COLUMNS.filter(col => !activeGroupingsAPS.includes(col.field as GroupByField));
  }, [activeGroupingsAPS]);

  // Toggle agrupación (con APS) - soporta hasta 3 niveles
  const toggleGroupingAPS = (field: GroupByField) => {
    setActiveGroupingsAPS(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      }
      if (prev.length < 3) {
        return [...prev, field];
      }
      return [prev[1], prev[2], field];
    });
  };

  // Toggle selección de item (con APS)
  const toggleItemSelectionAPS = (rsvId: string) => {
    setSelectedItemsAPS(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  };

  // Seleccionar/deseleccionar todos (con APS)
  const toggleSelectAllAPS = () => {
    if (selectedItemsAPS.size === filteredInventarioAPS.length) {
      setSelectedItemsAPS(new Set());
    } else {
      setSelectedItemsAPS(new Set(filteredInventarioAPS.map(i => String(i.rsv_ids))));
    }
  };

  // Seleccionar/deseleccionar un grupo completo (APS)
  const toggleGroupSelectionAPS = (groupItems: InventarioConAPS[]) => {
    setSelectedItemsAPS(prev => {
      const next = new Set(prev);
      const groupIds = groupItems.map(i => String(i.rsv_ids));
      const allSelected = groupIds.every(id => next.has(id));
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle grupo expandido (APS)
  const toggleGroupAPS = (groupKey: string) => {
    setExpandedGroupsAPS(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Tipo para agrupación de 3 niveles
  type GroupedLevel3 = Record<string, InventarioConAPS[]>;
  type GroupedLevel2 = Record<string, InventarioConAPS[] | GroupedLevel3>;
  type GroupedLevel1 = Record<string, InventarioConAPS[] | GroupedLevel2>;

  // Agrupar datos del inventario con APS (soporta hasta 3 niveles)
  const groupedInventarioAPS = useMemo(() => {
    if (activeGroupingsAPS.length === 0) {
      return { ungrouped: filteredInventarioAPS };
    }

    const grouped: GroupedLevel1 = {};

    filteredInventarioAPS.forEach(item => {
      const firstKey = getGroupValue(item, activeGroupingsAPS[0]);

      if (activeGroupingsAPS.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioConAPS[]).push(item);
      } else if (activeGroupingsAPS.length === 2) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupingsAPS[1]);
        if (!(grouped[firstKey] as GroupedLevel2)[secondKey]) {
          (grouped[firstKey] as GroupedLevel2)[secondKey] = [];
        }
        ((grouped[firstKey] as GroupedLevel2)[secondKey] as InventarioConAPS[]).push(item);
      } else {
        // 3 niveles de agrupación
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupingsAPS[1]);
        if (!(grouped[firstKey] as GroupedLevel2)[secondKey]) {
          (grouped[firstKey] as GroupedLevel2)[secondKey] = {};
        }
        const thirdKey = getGroupValue(item, activeGroupingsAPS[2]);
        if (!((grouped[firstKey] as GroupedLevel2)[secondKey] as GroupedLevel3)[thirdKey]) {
          ((grouped[firstKey] as GroupedLevel2)[secondKey] as GroupedLevel3)[thirdKey] = [];
        }
        (((grouped[firstKey] as GroupedLevel2)[secondKey] as GroupedLevel3)[thirdKey] as InventarioConAPS[]).push(item);
      }
    });

    return grouped;
  }, [filteredInventarioAPS, activeGroupingsAPS]);

  // Bloquear scroll del body cuando el modal de comentarios está abierto
  useEffect(() => {
    if (showComments) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showComments]);

  // Scroll al final cuando se abren comentarios o se agregan nuevos
  useEffect(() => {
    if (showComments && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showComments, campana?.comentarios?.length]);

  const addCommentMutation = useMutation({
    mutationFn: (contenido: string) => campanasService.addComment(campanaId, contenido),
    onMutate: async (contenido) => {
      // Cancelar queries en curso
      await queryClient.cancelQueries({ queryKey: ['campana', campanaId] });

      // Snapshot del estado anterior
      const previousCampana = queryClient.getQueryData(['campana', campanaId]);

      // Optimistic update - agregar comentario inmediatamente
      queryClient.setQueryData(['campana', campanaId], (old: any) => {
        if (!old) return old;
        const newComment = {
          id: Date.now(), // ID temporal
          autor_id: user?.id || 0,
          autor_nombre: user?.nombre || 'Usuario',
          autor_foto: user?.foto_perfil || null,
          contenido,
          fecha: new Date().toISOString(),
        };
        return {
          ...old,
          comentarios: [...(old.comentarios || []), newComment],
        };
      });

      setComment('');
      return { previousCampana };
    },
    onError: (_err, _contenido, context) => {
      // Revertir en caso de error
      if (context?.previousCampana) {
        queryClient.setQueryData(['campana', campanaId], context.previousCampana);
      }
    },
    // No invalidamos - el socket se encarga de sincronizar
  });

  const assignAPSMutation = useMutation({
    mutationFn: (inventarioIds: number[]) => campanasService.assignAPS(campanaId, inventarioIds),
    onSuccess: (data) => {
      // Limpiar selección y refrescar datos
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
      alert(`${data.message}`);
    },
    onError: (error: Error) => {
      alert(`Error al asignar APS: ${error.message}`);
    },
  });

  const handleAssignAPS = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un elemento para asignar APS');
      return;
    }
    // Obtener los IDs de inventario de los items seleccionados
    const inventarioIds = inventarioReservado
      .filter(item => selectedItems.has(item.rsv_ids))
      .map(item => item.id);

    if (inventarioIds.length > 0) {
      assignAPSMutation.mutate(inventarioIds);
    }
  };

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  // Solicitar código de autorización
  const handleSolicitarCodigo = async () => {
    try {
      setEnviandoCodigo(true);
      setErrorPIN('');

      // Generar código de 6 dígitos
      const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();

      // Guardar código y timestamp
      setCodigoGenerado(nuevoCodigo);
      setTimestampPIN(Date.now());

      // Enviar email
      await campanasService.sendAuthorizationPIN(
        nuevoCodigo,
        user?.nombre || 'Usuario',
        campana?.nombre_campania || campana?.nombre || 'Sin nombre'
      );

      // Mostrar input de NIP
      setCodigoSolicitado(true);

      // Deshabilitar botón 15 segundos
      setBotonDeshabilitado(true);
      setTimeout(() => {
        setBotonDeshabilitado(false);
      }, 15000);

    } catch (error) {
      console.error('Error al solicitar código:', error);
      setErrorPIN('Error al enviar el código. Intenta de nuevo.');
    } finally {
      setEnviandoCodigo(false);
    }
  };

  // Verificar PIN
  const handleVerificarPIN = () => {
    setErrorPIN('');

    // Verificar que no haya expirado (2 minutos)
    const tiempoTranscurrido = Date.now() - timestampPIN;
    const dosMinutos = 2 * 60 * 1000;

    if (tiempoTranscurrido > dosMinutos) {
      setErrorPIN('El código ha expirado. Solicita uno nuevo.');
      return;
    }

    // Verificar que el PIN coincida
    if (nipInput === codigoGenerado) {
      setPinVerificado(true);
      setErrorPIN('');
    } else {
      setErrorPIN('Código incorrecto. Intenta de nuevo.');
    }
  };

  // Quitar APS de los items seleccionados
  const [quitandoAPS, setQuitandoAPS] = useState(false);
  const handleQuitarAPS = async () => {
    if (selectedItemsAPS.size === 0) return;

    setQuitandoAPS(true);
    try {
      // Convertir los rsv_ids a números
      const reservaIds = Array.from(selectedItemsAPS).map(id => parseInt(id, 10));

      await campanasService.removeAPS(campanaId, reservaIds);

      // Refrescar las tablas
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });

      // Limpiar selección y cerrar modal
      setSelectedItemsAPS(new Set());
      handleCloseRemoveAPSModal();

      alert(`APS eliminado de ${reservaIds.length} inventario(s)`);
    } catch (error) {
      console.error('Error al quitar APS:', error);
      setErrorPIN('Error al quitar APS. Intenta de nuevo.');
    } finally {
      setQuitandoAPS(false);
    }
  };

  // Resetear estado del modal al cerrar
  const handleCloseRemoveAPSModal = () => {
    setShowRemoveAPSModal(false);
    setCodigoSolicitado(false);
    setNipInput('');
    setCodigoGenerado('');
    setTimestampPIN(0);
    setPinVerificado(false);
    setErrorPIN('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Detalle de Campana" />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !campana) {
    return (
      <div className="min-h-screen">
        <Header title="Detalle de Campaña" />
        <div className="p-6">
          <button
            onClick={() => navigate('/campanas')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a campañas</span>
          </button>
          <div className="max-w-md mx-auto mt-12">
            <ErrorState
              title="No se pudo cargar la campaña"
              message={error instanceof Error ? error.message : 'La campaña solicitada no existe o hubo un error de conexión con el servidor.'}
              onRetry={() => window.location.reload()}
            />
          </div>
        </div>
      </div>
    );
  }

  const comentarios = campana.comentarios || [];

  return (
    <div className="min-h-screen">
      <Header title="Detalle de Campana" />

      <div className="p-3 sm:p-4 md:p-6 space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => navigate('/campanas')}
            className="flex items-center gap-1.5 sm:gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Volver</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 transition-colors"
              title="Comentarios"
            >
              <MessageSquare className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-purple-400" />
              <span className="text-xs text-purple-300">{comentarios.length}</span>
            </button>
            <Badge variant={statusVariants[campana.status] || 'secondary'} className="text-xs sm:text-sm">
              {campana.status}
            </Badge>
          </div>
        </div>

        {/* Titulo */}
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-semibold">{campana.nombre}</h2>
          <span className="text-muted-foreground text-sm sm:text-base">#{campana.id}</span>
        </div>

        {/* Grid de 3 columnas - responsive para tablets */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {/* Columna 1: Info Campana */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4">
            <h3 className="text-xs md:text-sm font-semibold mb-2 md:mb-3 text-purple-300 uppercase tracking-wide">Campaña</h3>
            <div className="space-y-0">
              <InfoItem label="Articulo" value={campana.articulo} type="category" />
              {campana.fecha_inicio && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {getCatorcenaDisplay(campana.fecha_inicio, catorcenas)}
                  </span>
                </div>
              )}
              {campana.fecha_fin && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Fin</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {getCatorcenaDisplay(campana.fecha_fin, catorcenas)}
                  </span>
                </div>
              )}
              <InfoItem label="Total Caras" value={campana.total_caras} type="default" />
              <InfoItem label="Frontal" value={campana.frontal} type="default" />
              <InfoItem label="Cruzada" value={campana.cruzada} type="default" />
              <InfoItem label="NSE" value={campana.nivel_socioeconomico ? [...new Set(campana.nivel_socioeconomico.split(",").map(s => s.trim()))].join(", ") : null} type="category" />
              <InfoItem label="Bonificacion" value={campana.bonificacion} type="default" />
              <InfoItem label="Descuento" value={campana.descuento ? `${campana.descuento}%` : null} type="percent" />
              <InfoItem label="Inversion" value={typeof campana.inversion === "string" ? parseFloat(campana.inversion) : campana.inversion} type="amount" />
              <InfoItem label="Precio" value={typeof campana.precio === "string" ? parseFloat(campana.precio) : campana.precio} type="amount" />
            </div>
          </div>

          {/* Columna 2: Cliente */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4">
            <h3 className="text-xs md:text-sm font-semibold mb-2 md:mb-3 text-purple-300 uppercase tracking-wide">Cliente</h3>
            <div className="space-y-0">
              <InfoItem label="Cliente" value={campana.T0_U_Cliente} type="user" />
              {campana.sap_database && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-zinc-500 text-xs">SAP BD:</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    campana.sap_database === 'CIMU' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    campana.sap_database === 'TEST' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    campana.sap_database === 'TRADE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
                  }`}>{campana.sap_database}</span>
                </div>
              )}
              <InfoItem label="Razon Social" value={campana.T0_U_RazonSocial} type="default" />
              <InfoItem label="CUIC" value={campana.cuic} type="id" />
              <InfoItem label="Agencia" value={campana.T0_U_Agencia} type="category" />
              <InfoItem label="Asesor" value={campana.T0_U_Asesor} type="user" />
              <InfoItem label="Unidad Negocio" value={campana.T1_U_UnidadNegocio} type="category" />
              <InfoItem label="Marca" value={campana.T2_U_Marca} type="category" />
              <InfoItem label="Producto" value={campana.T2_U_Producto} type="category" />
              <InfoItem label="Categoria" value={campana.T2_U_Categoria} type="category" />
            </div>
          </div>

          {/* Columna 3: Asignacion y Notas - span full width on md */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4 md:col-span-2 xl:col-span-1">
            <h3 className="text-xs md:text-sm font-semibold mb-2 md:mb-3 text-purple-300 uppercase tracking-wide">Asignacion</h3>
            <div className="space-y-0">
              <InfoItem label="Asignado" value={campana.asignado} type="user" />
              <InfoItem label="Contacto" value={campana.contacto} type="user" />
              <InfoItem label="APS Global" value={campana.solicitud_id ? `#${campana.solicitud_id}` : null} type="id" />
              <InfoItem label="Actualizado" value={campana.updated_at} type="date" />
            </div>

            {(campana.observaciones || campana.descripcion || campana.notas) && (
              <>
                <h3 className="text-sm font-semibold mb-2 mt-4 text-purple-300 uppercase tracking-wide">Notas</h3>
                {campana.descripcion && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.descripcion}</p>
                )}
                {campana.observaciones && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.observaciones}</p>
                )}
                {campana.notas && (
                  <p className="text-sm text-muted-foreground">{campana.notas}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Historial de Acciones */}
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <h3 className="text-xs md:text-sm font-semibold mb-3 text-purple-300 uppercase tracking-wide flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de Acciones
          </h3>
          {isLoadingHistorial ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">
              No hay acciones registradas
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-purple">
              {historial.map((item) => {
                const fechaObj = item.fecha_hora ? new Date(item.fecha_hora) : null;
                const fecha = fechaObj ? fechaObj.toLocaleDateString('es-MX') : '';
                const hora = fechaObj ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                // Capitalizar tipo para mejor presentación
                const tipoCapitalizado = item.tipo ? item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1) : '';
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-900/20 border border-purple-900/30"
                  >
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-400" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-200">
                        {item.accion} {tipoCapitalizado}
                      </span>
                      {item.detalles && (
                        <p className="text-xs text-zinc-500 truncate" title={item.detalles}>
                          {item.detalles}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs text-zinc-500 block">{fecha}</span>
                      <span className="text-xs text-zinc-600">{hora}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista de inventario reservado */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 border-b border-border">
            <h3 className="text-xs md:text-sm font-semibold text-purple-300 uppercase tracking-wide">
              Lista Inventarios Sin APS
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {permissions.canEditDetalleCampana && (
                <button
                  onClick={handleAssignAPS}
                  disabled={selectedItems.size === 0 || assignAPSMutation.isPending}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    selectedItems.size === 0
                      ? 'bg-purple-900/30 text-purple-400/50 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  <FileSpreadsheet className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden sm:inline">{assignAPSMutation.isPending ? 'Asignando...' : `APS${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                  <span className="sm:hidden">{assignAPSMutation.isPending ? '...' : `APS${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                </button>
              )}
              {permissions.canSeeGestionArtes && (
                <button
                  onClick={() => navigate(`/campanas/${campanaId}/tareas`)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                >
                  <ListTodo className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden md:inline">Gestor de Tareas</span>
                  <span className="md:hidden">Tareas</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4">
            {/* Columna izquierda: Mapa */}
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-lg overflow-hidden border border-border relative map-dark-controls">
              {!isLoaded || isLoadingInventario ? (
                <MapSkeleton />
              ) : errorInventario ? (
                <MapErrorState onRetry={() => refetchInventario()} />
              ) : inventarioReservado.filter(i => i.latitud && i.longitud).length === 0 ? (
                <MapEmptyState />
              ) : (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={mapCenter}
                  zoom={12}
                  onLoad={onMapLoad}
                  options={{
                    styles: [
                      { elementType: 'geometry', stylers: [{ color: '#212121' }] },
                      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                      { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
                      { elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
                      { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
                      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#e879f9' }] },
                      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
                      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4a4a' }] },
                      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
                      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#181818' }] },
                      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#22d3ee' }] },
                      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
                      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
                      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e1e1e' }] },
                      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
                      { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#f472b6' }] },
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {inventarioReservado.map((item) => {
                    const isSelected = selectedItems.has(item.rsv_ids);
                    return item.latitud && item.longitud && (
                      <Marker
                        key={item.rsv_ids}
                        position={{ lat: item.latitud, lng: item.longitud }}
                        title={item.codigo_unico}
                        onClick={() => {
                          toggleItemSelection(item.rsv_ids);
                          // Scroll a la fila en la tabla
                          const row = document.getElementById(`row-${item.rsv_ids}`);
                          if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: isSelected ? 12 : 8,
                          fillColor: isSelected ? '#facc15' : '#ec4899',
                          fillOpacity: 1,
                          strokeColor: isSelected ? '#fef08a' : '#ffffff',
                          strokeWeight: isSelected ? 3 : 2,
                        }}
                        zIndex={isSelected ? 1000 : 1}
                      />
                    );
                  })}
                </GoogleMap>
              )}
            </div>
            {/* Columna derecha: Tabla */}
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] flex flex-col">
              {/* Header con botón de agrupación */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {selectedItems.size > 0 && (
                    <span className="text-[10px] sm:text-xs text-purple-300">
                      {selectedItems.size} sel.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Botón de Filtros */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFiltersReservado(!showFiltersReservado)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                        filtersReservado.length > 0
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                      }`}
                      title="Filtrar"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {filtersReservado.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">
                          {filtersReservado.length}
                        </span>
                      )}
                    </button>
                    {showFiltersReservado && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-[520px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
                          <button
                            onClick={() => setShowFiltersReservado(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-purple pr-1">
                          {filtersReservado.map((filter, index) => (
                            <div key={filter.id} className="flex items-center gap-2">
                              {index > 0 && (
                                <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>
                              )}
                              {index === 0 && <span className="w-8"></span>}
                              <select
                                value={filter.field}
                                onChange={(e) => updateFilterReservado(filter.id, { field: e.target.value })}
                                className="w-[130px] text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                {FILTER_FIELDS.map((f) => (
                                  <option key={f.field} value={f.field}>{f.label}</option>
                                ))}
                              </select>
                              <select
                                value={filter.operator}
                                onChange={(e) => updateFilterReservado(filter.id, { operator: e.target.value as FilterOperator })}
                                className="w-[90px] text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                {OPERATORS.filter(op => {
                                  const fieldConfig = FILTER_FIELDS.find(f => f.field === filter.field);
                                  return fieldConfig && op.forTypes.includes(fieldConfig.type);
                                }).map((op) => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>
                              <select
                                value={filter.value}
                                onChange={(e) => updateFilterReservado(filter.id, { value: e.target.value })}
                                className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                <option value="">Seleccionar...</option>
                                {getUniqueValuesReservado[filter.field]?.map((val) => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeFilterReservado(filter.id)}
                                className="text-red-400 hover:text-red-300 p-0.5"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {filtersReservado.length === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center py-3">
                              Sin filtros. Haz clic en "Añadir".
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-900/30">
                          <button
                            onClick={addFilterReservado}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            <Plus className="h-3 w-3" />
                            Añadir
                          </button>
                          <button
                            onClick={clearFiltersReservado}
                            disabled={filtersReservado.length === 0}
                            className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            Limpiar
                          </button>
                        </div>
                        {filtersReservado.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-purple-900/30">
                            <span className="text-[10px] text-muted-foreground">
                              {filteredInventarioReservado.length} de {inventarioReservado.length} registros
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Botón de Agrupar */}
                  <div className="relative">
                    <button
                      onClick={() => setShowGroupingConfig(!showGroupingConfig)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                      title="Agrupar"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {activeGroupings.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                          {activeGroupings.length}
                        </span>
                      )}
                    </button>
                    {/* Dropdown de configuración */}
                    {showGroupingConfig && (
                      <div className="absolute right-0 top-full mt-1 z-10 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                          Agrupar por (max 2)
                        </p>
                        {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => toggleGrouping(field)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                              activeGroupings.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              activeGroupings.includes(field)
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50'
                            }`}>
                              {activeGroupings.includes(field) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            {label}
                            {activeGroupings.indexOf(field) === 0 && (
                              <span className="ml-auto text-[10px] text-purple-400">1°</span>
                            )}
                            {activeGroupings.indexOf(field) === 1 && (
                              <span className="ml-auto text-[10px] text-pink-400">2°</span>
                            )}
                          </button>
                        ))}
                        <div className="border-t border-purple-900/30 mt-2 pt-2">
                          <button
                            onClick={() => setActiveGroupings([])}
                            className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                          >
                            Quitar agrupación
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Botón de Ordenar */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortReservado(!showSortReservado)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                        sortFieldReservado
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                      }`}
                      title="Ordenar"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                    {showSortReservado && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-[280px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-300">Ordenar por</span>
                          <button
                            onClick={() => setShowSortReservado(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {SORT_FIELDS.map((field) => (
                            <button
                              key={field.field}
                              onClick={() => {
                                if (sortFieldReservado === field.field) {
                                  // Si ya está seleccionado, cambiar dirección
                                  setSortDirectionReservado(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  // Seleccionar nuevo campo
                                  setSortFieldReservado(field.field);
                                  setSortDirectionReservado('asc');
                                }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                                sortFieldReservado === field.field
                                  ? 'bg-purple-600 text-white'
                                  : 'text-zinc-300 hover:bg-purple-900/30'
                              }`}
                            >
                              <span>{field.label}</span>
                              {sortFieldReservado === field.field && (
                                sortDirectionReservado === 'asc'
                                  ? <ArrowUp className="h-4 w-4" />
                                  : <ArrowDown className="h-4 w-4" />
                              )}
                            </button>
                          ))}
                        </div>
                        {sortFieldReservado && (
                          <div className="mt-3 pt-3 border-t border-purple-900/30">
                            <button
                              onClick={() => {
                                setSortFieldReservado(null);
                                setSortDirectionReservado('asc');
                              }}
                              className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors"
                            >
                              Quitar ordenamiento
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Botón de Descargar */}
                  <button
                    onClick={downloadCSVReservado}
                    disabled={filteredInventarioReservado.length === 0}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-900/50 hover:bg-green-900/70 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Descargar CSV"
                  >
                    <Download className="h-3.5 w-3.5 text-green-400" />
                  </button>
                </div>
              </div>

              {/* Tabla con scroll */}
              <div className="flex-1 overflow-auto scrollbar-purple">
                {isLoadingInventario ? (
                  <TableSkeleton />
                ) : errorInventario ? (
                  <ErrorState
                    variant="compact"
                    message="Error al cargar el inventario reservado"
                    onRetry={() => refetchInventario()}
                  />
                ) : inventarioReservado.length === 0 ? (
                  <EmptyState
                    icon={<Package className="h-6 w-6 text-purple-400" />}
                    title="Todos los Inventarios tienen APS "
                    description="Esta campaña no tiene inventarios sin APS"
                  />
                ) : activeGroupings.length === 0 ? (
                  // Sin agrupación
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border text-left">
                        <th className="p-2 w-8">
                          <button
                            onClick={toggleSelectAll}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedItems.size === filteredInventarioReservado.length && filteredInventarioReservado.length > 0
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {selectedItems.size === filteredInventarioReservado.length && filteredInventarioReservado.length > 0 && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                        </th>
                        {visibleColumnsReservado.map(col => (
                          <th key={col.field} className="p-2 font-medium text-purple-300">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventarioReservado.map((item) => (
                        <tr
                          key={item.rsv_ids}
                          id={`row-${item.rsv_ids}`}
                          className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
                            selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                          }`}
                        >
                          <td className="p-2">
                            <button
                              onClick={() => toggleItemSelection(item.rsv_ids)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                selectedItems.has(item.rsv_ids)
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-purple-500/50 hover:border-purple-400'
                              }`}
                            >
                              {selectedItems.has(item.rsv_ids) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </button>
                          </td>
                          {visibleColumnsReservado.map(col => {
                            const value = item[col.field as keyof InventarioReservado];
                            if (col.field === 'codigo_unico') {
                              return <td key={col.field} className="p-2 text-white font-medium">{value || '-'}</td>;
                            }
                            if (col.field === 'caras_totales') {
                              return (
                                <td key={col.field} className="p-2 text-center">
                                  <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">
                                    {value}
                                  </span>
                                </td>
                              );
                            }
                            return <td key={col.field} className="p-2 text-zinc-300">{value || '-'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // Con agrupación
                  <div className="space-y-2">
                    {Object.entries(groupedInventario).map(([groupKey, groupData]) => {
                      const isExpanded = expandedGroups.has(groupKey);
                      const isNested = activeGroupings.length > 1 && typeof groupData === 'object' && !Array.isArray(groupData);
                      const items = isNested ? null : (groupData as InventarioReservado[]);
                      const nestedGroups = isNested ? (groupData as Record<string, InventarioReservado[]>) : null;
                      const totalItems = isNested
                        ? Object.values(nestedGroups!).reduce((sum, arr) => sum + arr.length, 0)
                        : items!.length;

                      // Collect all items for this group (flat list for selection)
                      const allGroupItems: InventarioReservado[] = isNested
                        ? Object.values(nestedGroups!).flat()
                        : items!;
                      const allGroupIds = allGroupItems.map(i => i.rsv_ids);
                      const allGroupSelected = allGroupIds.length > 0 && allGroupIds.every(id => selectedItems.has(id));
                      const someGroupSelected = !allGroupSelected && allGroupIds.some(id => selectedItems.has(id));

                      return (
                        <div key={groupKey} className="border border-purple-900/30 rounded-lg overflow-hidden">
                          {/* Cabecera del grupo */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleGroupSelection(allGroupItems); }}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                allGroupSelected
                                  ? 'bg-purple-600 border-purple-600'
                                  : someGroupSelected
                                    ? 'bg-purple-600/50 border-purple-600'
                                    : 'border-purple-500/50 hover:border-purple-400'
                              }`}
                            >
                              {allGroupSelected && <Check className="h-3 w-3 text-white" />}
                              {someGroupSelected && <Minus className="h-3 w-3 text-white" />}
                            </button>
                            <button
                              onClick={() => toggleGroup(groupKey)}
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400" />
                              )}
                              <span className="text-xs font-medium text-purple-300">
                                {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[0])?.label}:
                              </span>
                              <span className="text-xs text-white">{groupKey}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {totalItems} items
                              </span>
                            </button>
                          </div>

                          {/* Contenido expandido */}
                          {isExpanded && (
                            <div className="px-2 py-1">
                              {isNested && nestedGroups ? (
                                // Segundo nivel de agrupación
                                <div className="space-y-1">
                                  {Object.entries(nestedGroups).map(([subGroupKey, subItems]) => {
                                    const subGroupFullKey = `${groupKey}-${subGroupKey}`;
                                    const isSubExpanded = expandedGroups.has(subGroupFullKey);
                                    const subGroupIds = subItems.map(i => i.rsv_ids);
                                    const allSubSelected = subGroupIds.length > 0 && subGroupIds.every(id => selectedItems.has(id));
                                    const someSubSelected = !allSubSelected && subGroupIds.some(id => selectedItems.has(id));

                                    return (
                                      <div key={subGroupKey} className="border border-purple-900/20 rounded-lg overflow-hidden ml-2">
                                        <div className="flex items-center gap-2 px-2 py-1.5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleGroupSelection(subItems); }}
                                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                              allSubSelected
                                                ? 'bg-pink-600 border-pink-600'
                                                : someSubSelected
                                                  ? 'bg-pink-600/50 border-pink-600'
                                                  : 'border-pink-500/50 hover:border-pink-400'
                                            }`}
                                          >
                                            {allSubSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                            {someSubSelected && <Minus className="h-2.5 w-2.5 text-white" />}
                                          </button>
                                          <button
                                            onClick={() => toggleGroup(subGroupFullKey)}
                                            className="flex items-center gap-2 flex-1 min-w-0"
                                          >
                                            {isSubExpanded ? (
                                              <ChevronDown className="h-3 w-3 text-pink-400" />
                                            ) : (
                                              <ChevronRight className="h-3 w-3 text-pink-400" />
                                            )}
                                            <span className="text-[10px] font-medium text-pink-300">
                                              {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[1])?.label}:
                                            </span>
                                            <span className="text-[10px] text-white">{subGroupKey}</span>
                                            <span className="ml-auto text-[10px] text-muted-foreground">
                                              {subItems.length}
                                          </span>
                                          </button>
                                        </div>
                                        {isSubExpanded && (
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b border-border/30 text-left">
                                                <th className="p-1.5 w-8"></th>
                                                {visibleColumnsReservado.map(col => (
                                                  <th key={col.field} className="p-1.5 text-[10px] font-medium text-purple-300">{col.label}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {subItems.map((item) => (
                                                <tr
                                                  key={item.rsv_ids}
                                                  id={`row-${item.rsv_ids}`}
                                                  className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                                    selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                                                  }`}
                                                >
                                                  <td className="p-1.5 w-8">
                                                    <button
                                                      onClick={() => toggleItemSelection(item.rsv_ids)}
                                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                        selectedItems.has(item.rsv_ids)
                                                          ? 'bg-purple-600 border-purple-600'
                                                          : 'border-purple-500/50 hover:border-purple-400'
                                                      }`}
                                                    >
                                                      {selectedItems.has(item.rsv_ids) && (
                                                        <Check className="h-2.5 w-2.5 text-white" />
                                                      )}
                                                    </button>
                                                  </td>
                                                  {visibleColumnsReservado.map(col => {
                                                    const value = item[col.field as keyof InventarioReservado];
                                                    if (col.field === 'codigo_unico') {
                                                      return <td key={col.field} className="p-1.5 text-white font-medium">{value || '-'}</td>;
                                                    }
                                                    if (col.field === 'caras_totales') {
                                                      return (
                                                        <td key={col.field} className="p-1.5 text-center">
                                                          <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                                                            {value}
                                                          </span>
                                                        </td>
                                                      );
                                                    }
                                                    return <td key={col.field} className="p-1.5 text-zinc-400">{value !== null && value !== undefined ? String(value) : '-'}</td>;
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : items ? (
                                // Un solo nivel de agrupación
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border/30 text-left">
                                      <th className="p-1.5 w-8"></th>
                                      {visibleColumnsReservado.map(col => (
                                        <th key={col.field} className="p-1.5 text-[10px] font-medium text-purple-300">{col.label}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item) => (
                                      <tr
                                        key={item.rsv_ids}
                                        id={`row-${item.rsv_ids}`}
                                        className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                          selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : ''
                                        }`}
                                      >
                                        <td className="p-1.5 w-8">
                                          <button
                                            onClick={() => toggleItemSelection(item.rsv_ids)}
                                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                              selectedItems.has(item.rsv_ids)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-purple-500/50 hover:border-purple-400'
                                            }`}
                                          >
                                            {selectedItems.has(item.rsv_ids) && (
                                              <Check className="h-2.5 w-2.5 text-white" />
                                            )}
                                          </button>
                                        </td>
                                        {visibleColumnsReservado.map(col => {
                                          const value = item[col.field as keyof InventarioReservado];
                                          if (col.field === 'codigo_unico') {
                                            return <td key={col.field} className="p-1.5 text-white font-medium">{value || '-'}</td>;
                                          }
                                          if (col.field === 'caras_totales') {
                                            return (
                                              <td key={col.field} className="p-1.5 text-center">
                                                <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                                                  {value}
                                                </span>
                                              </td>
                                            );
                                          }
                                          return <td key={col.field} className="p-1.5 text-zinc-400">{value !== null && value !== undefined ? String(value) : '-'}</td>;
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de inventario por APS */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 border-b border-border">
            <h3 className="text-xs md:text-sm font-semibold text-purple-300 uppercase tracking-wide">
              Lista de Inventario por APS
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {filteredInventarioAPS.length} registros
              </span>
              {permissions.canEditDetalleCampana && (
                <button
                  onClick={() => setShowRemoveAPSModal(true)}
                  disabled={selectedItemsAPS.size === 0}
                  className={`flex items-center justify-center w-6 sm:w-7 h-6 sm:h-7 rounded-lg border transition-colors ${
                    selectedItemsAPS.size === 0
                      ? 'bg-red-900/20 border-red-500/20 cursor-not-allowed'
                      : 'bg-red-900/50 hover:bg-red-900/70 border-red-500/30'
                  }`}
                  title="Quitar APS"
                >
                  <Minus className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${selectedItemsAPS.size === 0 ? 'text-red-400/40' : 'text-red-400'}`} />
                </button>
              )}
              {permissions.canEditDetalleCampana && inventarioConAPS.length > 0 && (
                <button
                  disabled
                  className="flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border bg-cyan-900/30 border-cyan-500/20 opacity-50 cursor-not-allowed transition-colors"
                  title="Proximamente"
                >
                  <Upload className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-cyan-400/50 mr-1" />
                  <span className="text-[10px] sm:text-xs font-medium text-cyan-300/50">POST</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 p-3 md:p-4">
            {/* Columna izquierda: Mapa */}
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-lg overflow-hidden border border-border relative map-dark-controls">
              {!isLoaded || isLoadingAPS ? (
                <MapSkeleton />
              ) : errorAPS ? (
                <MapErrorState onRetry={() => refetchAPS()} />
              ) : inventarioConAPS.filter(i => i.latitud && i.longitud).length === 0 ? (
                <MapEmptyState />
              ) : (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={
                    inventarioConAPS.length > 0
                      ? {
                          lat: inventarioConAPS.filter(i => i.latitud && i.longitud)[0]?.latitud || 19.4326,
                          lng: inventarioConAPS.filter(i => i.latitud && i.longitud)[0]?.longitud || -99.1332
                        }
                      : { lat: 19.4326, lng: -99.1332 }
                  }
                  zoom={12}
                  onLoad={(map) => {
                    const validItems = inventarioConAPS.filter(i => i.latitud && i.longitud);
                    if (validItems.length > 1) {
                      const bounds = new google.maps.LatLngBounds();
                      validItems.forEach(item => {
                        bounds.extend({ lat: item.latitud, lng: item.longitud });
                      });
                      map.fitBounds(bounds, 50);
                    }
                  }}
                  options={{
                    styles: [
                      { elementType: 'geometry', stylers: [{ color: '#212121' }] },
                      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                      { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
                      { elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
                      { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
                      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#e879f9' }] },
                      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
                      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4a4a' }] },
                      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
                      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#181818' }] },
                      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#22d3ee' }] },
                      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
                      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
                      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e1e1e' }] },
                      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
                      { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#f472b6' }] },
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {inventarioConAPS.map((item) => {
                    const isSelected = selectedItemsAPS.has(String(item.rsv_ids));
                    return item.latitud && item.longitud && (
                      <Marker
                        key={`aps-${item.rsv_ids}`}
                        position={{ lat: item.latitud, lng: item.longitud }}
                        title={`${item.codigo_unico} - APS: ${item.aps}`}
                        onClick={() => {
                          toggleItemSelectionAPS(String(item.rsv_ids));
                          // Scroll a la fila en la tabla
                          const row = document.getElementById(`row-aps-${item.rsv_ids}`);
                          if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: isSelected ? 12 : 8,
                          fillColor: isSelected ? '#facc15' : '#22d3ee',
                          fillOpacity: 1,
                          strokeColor: isSelected ? '#fef08a' : '#ffffff',
                          strokeWeight: isSelected ? 3 : 2,
                        }}
                        zIndex={isSelected ? 1000 : 1}
                      />
                    );
                  })}
                </GoogleMap>
              )}
            </div>
            {/* Columna derecha: Tabla */}
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] flex flex-col">
              {/* Header con botón de agrupación */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {selectedItemsAPS.size > 0 && (
                    <span className="text-[10px] sm:text-xs text-cyan-300">
                      {selectedItemsAPS.size} sel.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Botón de Filtros APS */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFiltersAPS(!showFiltersAPS)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                        filtersAPS.length > 0
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                      }`}
                      title="Filtrar"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {filtersAPS.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">
                          {filtersAPS.length}
                        </span>
                      )}
                    </button>
                    {showFiltersAPS && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-[520px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
                          <button
                            onClick={() => setShowFiltersAPS(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-purple pr-1">
                          {filtersAPS.map((filter, index) => (
                            <div key={filter.id} className="flex items-center gap-2">
                              {index > 0 && (
                                <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>
                              )}
                              {index === 0 && <span className="w-8"></span>}
                              <select
                                value={filter.field}
                                onChange={(e) => updateFilterAPS(filter.id, { field: e.target.value })}
                                className="w-[130px] text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                {FILTER_FIELDS_APS.map((f) => (
                                  <option key={f.field} value={f.field}>{f.label}</option>
                                ))}
                              </select>
                              <select
                                value={filter.operator}
                                onChange={(e) => updateFilterAPS(filter.id, { operator: e.target.value as FilterOperator })}
                                className="w-[90px] text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                {OPERATORS.filter(op => {
                                  const fieldConfig = FILTER_FIELDS_APS.find(f => f.field === filter.field);
                                  return fieldConfig && op.forTypes.includes(fieldConfig.type);
                                }).map((op) => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>
                              <select
                                value={filter.value}
                                onChange={(e) => updateFilterAPS(filter.id, { value: e.target.value })}
                                className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5"
                              >
                                <option value="">Seleccionar...</option>
                                {getUniqueValuesAPS[filter.field]?.map((val) => (
                                  <option key={val} value={val}>{val}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeFilterAPS(filter.id)}
                                className="text-red-400 hover:text-red-300 p-0.5"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {filtersAPS.length === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center py-3">
                              Sin filtros. Haz clic en "Añadir".
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-900/30">
                          <button
                            onClick={addFilterAPS}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            <Plus className="h-3 w-3" />
                            Añadir
                          </button>
                          <button
                            onClick={clearFiltersAPS}
                            disabled={filtersAPS.length === 0}
                            className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            Limpiar
                          </button>
                        </div>
                        {filtersAPS.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-purple-900/30">
                            <span className="text-[10px] text-muted-foreground">
                              {filteredInventarioAPS.length} de {inventarioConAPS.length} registros
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Botón de Agrupar */}
                  <div className="relative">
                    <button
                      onClick={() => setShowGroupingConfigAPS(!showGroupingConfigAPS)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                      title="Agrupar"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {activeGroupingsAPS.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                          {activeGroupingsAPS.length}
                        </span>
                      )}
                    </button>
                    {/* Dropdown de configuración */}
                    {showGroupingConfigAPS && (
                      <div className="absolute right-0 top-full mt-1 z-10 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                          Agrupar por (max 3)
                        </p>
                        {AVAILABLE_GROUPINGS_APS.map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => toggleGroupingAPS(field)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                              activeGroupingsAPS.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              activeGroupingsAPS.includes(field)
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50'
                            }`}>
                              {activeGroupingsAPS.includes(field) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            {label}
                            {activeGroupingsAPS.indexOf(field) === 0 && (
                              <span className="ml-auto text-[10px] text-purple-400">1°</span>
                            )}
                            {activeGroupingsAPS.indexOf(field) === 1 && (
                              <span className="ml-auto text-[10px] text-pink-400">2°</span>
                            )}
                            {activeGroupingsAPS.indexOf(field) === 2 && (
                              <span className="ml-auto text-[10px] text-cyan-400">3°</span>
                            )}
                          </button>
                        ))}
                        <div className="border-t border-purple-900/30 mt-2 pt-2">
                          <button
                            onClick={() => setActiveGroupingsAPS([])}
                            className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                          >
                            Quitar agrupación
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Botón de Ordenar APS */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortAPS(!showSortAPS)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                        sortFieldAPS
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                      }`}
                      title="Ordenar"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                    {showSortAPS && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-[280px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-300">Ordenar por</span>
                          <button
                            onClick={() => setShowSortAPS(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {SORT_FIELDS_APS.map((field) => (
                            <button
                              key={field.field}
                              onClick={() => {
                                if (sortFieldAPS === field.field) {
                                  // Si ya está seleccionado, cambiar dirección
                                  setSortDirectionAPS(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  // Seleccionar nuevo campo
                                  setSortFieldAPS(field.field);
                                  setSortDirectionAPS('asc');
                                }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                                sortFieldAPS === field.field
                                  ? 'bg-purple-600 text-white'
                                  : 'text-zinc-300 hover:bg-purple-900/30'
                              }`}
                            >
                              <span>{field.label}</span>
                              {sortFieldAPS === field.field && (
                                sortDirectionAPS === 'asc'
                                  ? <ArrowUp className="h-4 w-4" />
                                  : <ArrowDown className="h-4 w-4" />
                              )}
                            </button>
                          ))}
                        </div>
                        {sortFieldAPS && (
                          <div className="mt-3 pt-3 border-t border-purple-900/30">
                            <button
                              onClick={() => {
                                setSortFieldAPS(null);
                                setSortDirectionAPS('asc');
                              }}
                              className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors"
                            >
                              Quitar ordenamiento
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Botón de Descargar APS */}
                  <button
                    onClick={downloadCSVAPS}
                    disabled={filteredInventarioAPS.length === 0}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-900/50 hover:bg-green-900/70 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Descargar CSV"
                  >
                    <Download className="h-3.5 w-3.5 text-green-400" />
                  </button>
                </div>
              </div>

              {/* Tabla de inventario con APS */}
              <div className="flex-1 overflow-auto scrollbar-purple">
              {isLoadingAPS ? (
                <TableSkeleton />
              ) : errorAPS ? (
                <ErrorState
                  variant="compact"
                  message="Error al cargar el inventario con APS"
                  onRetry={() => refetchAPS()}
                />
              ) : inventarioConAPS.length === 0 ? (
                <EmptyState
                  icon={<FileSpreadsheet className="h-6 w-6 text-cyan-400" />}
                  title="Sin inventario con APS"
                  description="Aún no se han asignado APS a ningún espacio"
                />
              ) : activeGroupingsAPS.length === 0 ? (
                // Sin agrupación
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 w-8">
                        <button
                          onClick={toggleSelectAllAPS}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            selectedItemsAPS.size === filteredInventarioAPS.length && filteredInventarioAPS.length > 0
                              ? 'bg-cyan-600 border-cyan-600'
                              : 'border-cyan-500/50 hover:border-cyan-400'
                          }`}
                        >
                          {selectedItemsAPS.size === filteredInventarioAPS.length && filteredInventarioAPS.length > 0 && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 font-medium text-purple-300">Código</th>
                      <th className="p-2 font-medium text-purple-300">Tipo</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Caras</th>
                      <th className="p-2 font-medium text-purple-300">APS</th>
                      <th className="p-2 font-medium text-purple-300">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventarioConAPS.map((item) => (
                      <tr
                        key={item.rsv_ids}
                        id={`row-aps-${item.rsv_ids}`}
                        className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
                          selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                        }`}
                      >
                        <td className="p-2">
                          <button
                            onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedItemsAPS.has(String(item.rsv_ids))
                                ? 'bg-cyan-600 border-cyan-600'
                                : 'border-cyan-500/50 hover:border-cyan-400'
                            }`}
                          >
                            {selectedItemsAPS.has(String(item.rsv_ids)) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 text-white font-medium">{item.codigo_unico}</td>
                        <td className="p-2 text-zinc-300">{item.tipo_de_cara || '-'}</td>
                        <td className="p-2 text-zinc-300">{item.plaza || '-'}</td>
                        <td className="p-2 text-zinc-400 max-w-[150px] truncate" title={item.mueble || ''}>
                          {item.mueble || '-'}
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">
                            {item.caras_totales}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
                            {item.aps}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            item.estatus_reserva === 'confirmado'
                              ? 'bg-green-500/20 text-green-400'
                              : item.estatus_reserva === 'pendiente'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                          }`}>
                            {item.estatus_reserva || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                // Con agrupación (soporta hasta 3 niveles)
                <div className="space-y-2">
                  {Object.entries(groupedInventarioAPS).map(([groupKey, groupData]) => {
                    const isExpanded = expandedGroupsAPS.has(groupKey);
                    const isLevel1Array = Array.isArray(groupData);

                    // Calcular total de items recursivamente
                    const countItems = (data: unknown): number => {
                      if (Array.isArray(data)) return data.length;
                      if (typeof data === 'object' && data !== null) {
                        return Object.values(data).reduce((sum, val) => sum + countItems(val), 0);
                      }
                      return 0;
                    };
                    const totalItems = countItems(groupData);

                    // Collect all items flat for group selection
                    const collectAllItems = (data: unknown): InventarioConAPS[] => {
                      if (Array.isArray(data)) return data;
                      if (typeof data === 'object' && data !== null) {
                        return Object.values(data).flatMap(val => collectAllItems(val));
                      }
                      return [];
                    };
                    const allGroupItemsAPS = collectAllItems(groupData);
                    const allGroupIdsAPS = allGroupItemsAPS.map(i => String(i.rsv_ids));
                    const allGroupSelectedAPS = allGroupIdsAPS.length > 0 && allGroupIdsAPS.every(id => selectedItemsAPS.has(id));
                    const someGroupSelectedAPS = !allGroupSelectedAPS && allGroupIdsAPS.some(id => selectedItemsAPS.has(id));

                    return (
                      <div key={groupKey} className="border border-purple-900/30 rounded-lg overflow-hidden">
                        {/* Cabecera del grupo nivel 1 */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGroupSelectionAPS(allGroupItemsAPS); }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              allGroupSelectedAPS
                                ? 'bg-cyan-600 border-cyan-600'
                                : someGroupSelectedAPS
                                  ? 'bg-cyan-600/50 border-cyan-600'
                                  : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {allGroupSelectedAPS && <Check className="h-3 w-3 text-white" />}
                            {someGroupSelectedAPS && <Minus className="h-3 w-3 text-white" />}
                          </button>
                          <button
                            onClick={() => toggleGroupAPS(groupKey)}
                            className="flex items-center gap-2 flex-1 min-w-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-purple-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-purple-400" />
                            )}
                            <span className="text-xs font-medium text-purple-300">
                              {AVAILABLE_GROUPINGS_APS.find(g => g.field === activeGroupingsAPS[0])?.label}:
                            </span>
                            <span className="text-xs text-white">{groupKey}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {totalItems} items
                            </span>
                          </button>
                        </div>

                        {/* Contenido expandido */}
                        {isExpanded && (
                          <div className="px-2 py-1">
                            {isLevel1Array ? (
                              // Solo 1 nivel - mostrar items directamente
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border/30 text-left">
                                    <th className="p-1.5 w-8"></th>
                                    {visibleColumnsAPS.map(col => (
                                      <th key={col.field} className="p-1.5 text-[10px] font-medium text-purple-300">{col.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(groupData as InventarioConAPS[]).map((item) => (
                                    <tr
                                      key={item.rsv_ids}
                                      id={`row-aps-${item.rsv_ids}`}
                                      className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                        selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                                      }`}
                                    >
                                      <td className="p-1.5 w-8">
                                        <button
                                          onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                            selectedItemsAPS.has(String(item.rsv_ids))
                                              ? 'bg-cyan-600 border-cyan-600'
                                              : 'border-cyan-500/50 hover:border-cyan-400'
                                          }`}
                                        >
                                          {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                            <Check className="h-2.5 w-2.5 text-white" />
                                          )}
                                        </button>
                                      </td>
                                      {visibleColumnsAPS.map(col => {
                                        const value = item[col.field as keyof InventarioConAPS];
                                        if (col.field === 'codigo_unico') {
                                          return <td key={col.field} className="p-1.5 text-white font-medium">{value || '-'}</td>;
                                        }
                                        if (col.field === 'caras_totales') {
                                          return (
                                            <td key={col.field} className="p-1.5 text-center">
                                              <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                                                {value}
                                              </span>
                                            </td>
                                          );
                                        }
                                        return <td key={col.field} className="p-1.5 text-zinc-400">{value !== null && value !== undefined ? String(value) : '-'}</td>;
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              // Nivel 2 de agrupación
                              <div className="space-y-1">
                                {Object.entries(groupData as Record<string, unknown>).map(([subGroupKey, subGroupData]) => {
                                  const subGroupFullKey = `${groupKey}-${subGroupKey}`;
                                  const isSubExpanded = expandedGroupsAPS.has(subGroupFullKey);
                                  const isLevel2Array = Array.isArray(subGroupData);
                                  const subTotalItems = countItems(subGroupData);

                                  const allSubItemsAPS = collectAllItems(subGroupData);
                                  const allSubIdsAPS = allSubItemsAPS.map(i => String(i.rsv_ids));
                                  const allSubSelectedAPS = allSubIdsAPS.length > 0 && allSubIdsAPS.every(id => selectedItemsAPS.has(id));
                                  const someSubSelectedAPS = !allSubSelectedAPS && allSubIdsAPS.some(id => selectedItemsAPS.has(id));

                                  return (
                                    <div key={subGroupKey} className="border border-purple-900/20 rounded-lg overflow-hidden ml-2">
                                      <div className="flex items-center gap-2 px-2 py-1.5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleGroupSelectionAPS(allSubItemsAPS); }}
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                            allSubSelectedAPS
                                              ? 'bg-pink-600 border-pink-600'
                                              : someSubSelectedAPS
                                                ? 'bg-pink-600/50 border-pink-600'
                                                : 'border-pink-500/50 hover:border-pink-400'
                                          }`}
                                        >
                                          {allSubSelectedAPS && <Check className="h-2.5 w-2.5 text-white" />}
                                          {someSubSelectedAPS && <Minus className="h-2.5 w-2.5 text-white" />}
                                        </button>
                                        <button
                                          onClick={() => toggleGroupAPS(subGroupFullKey)}
                                          className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                          {isSubExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-pink-400" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-pink-400" />
                                          )}
                                          <span className="text-[10px] font-medium text-pink-300">
                                            {AVAILABLE_GROUPINGS_APS.find(g => g.field === activeGroupingsAPS[1])?.label}:
                                          </span>
                                          <span className="text-[10px] text-white">{subGroupKey}</span>
                                          <span className="ml-auto text-[10px] text-muted-foreground">
                                            {subTotalItems}
                                          </span>
                                        </button>
                                      </div>
                                      {isSubExpanded && (
                                        <div className="px-2 py-1">
                                          {isLevel2Array ? (
                                            // Solo 2 niveles - mostrar items
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="border-b border-border/30 text-left">
                                                  <th className="p-1.5 w-8"></th>
                                                  {visibleColumnsAPS.map(col => (
                                                    <th key={col.field} className="p-1.5 text-[10px] font-medium text-purple-300">{col.label}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(subGroupData as InventarioConAPS[]).map((item) => (
                                                  <tr
                                                    key={item.rsv_ids}
                                                    id={`row-aps-${item.rsv_ids}`}
                                                    className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                                      selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                                                    }`}
                                                  >
                                                    <td className="p-1.5 w-8">
                                                      <button
                                                        onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                          selectedItemsAPS.has(String(item.rsv_ids))
                                                            ? 'bg-cyan-600 border-cyan-600'
                                                            : 'border-cyan-500/50 hover:border-cyan-400'
                                                        }`}
                                                      >
                                                        {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                          <Check className="h-2.5 w-2.5 text-white" />
                                                        )}
                                                      </button>
                                                    </td>
                                                    {visibleColumnsAPS.map(col => {
                                                      const value = item[col.field as keyof InventarioConAPS];
                                                      if (col.field === 'codigo_unico') {
                                                        return <td key={col.field} className="p-1.5 text-white font-medium">{value || '-'}</td>;
                                                      }
                                                      if (col.field === 'caras_totales') {
                                                        return (
                                                          <td key={col.field} className="p-1.5 text-center">
                                                            <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                                                              {value}
                                                            </span>
                                                          </td>
                                                        );
                                                      }
                                                      return <td key={col.field} className="p-1.5 text-zinc-400">{value !== null && value !== undefined ? String(value) : '-'}</td>;
                                                    })}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          ) : (
                                            // Nivel 3 de agrupación
                                            <div className="space-y-1">
                                              {Object.entries(subGroupData as Record<string, InventarioConAPS[]>).map(([thirdGroupKey, thirdItems]) => {
                                                const thirdGroupFullKey = `${subGroupFullKey}-${thirdGroupKey}`;
                                                const isThirdExpanded = expandedGroupsAPS.has(thirdGroupFullKey);

                                                const thirdIdsAPS = thirdItems.map(i => String(i.rsv_ids));
                                                const allThirdSelectedAPS = thirdIdsAPS.length > 0 && thirdIdsAPS.every(id => selectedItemsAPS.has(id));
                                                const someThirdSelectedAPS = !allThirdSelectedAPS && thirdIdsAPS.some(id => selectedItemsAPS.has(id));

                                                return (
                                                  <div key={thirdGroupKey} className="border border-cyan-900/20 rounded-lg overflow-hidden ml-2">
                                                    <div className="flex items-center gap-2 px-2 py-1.5 bg-cyan-900/10 hover:bg-cyan-900/20 transition-colors">
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); toggleGroupSelectionAPS(thirdItems); }}
                                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                          allThirdSelectedAPS
                                                            ? 'bg-cyan-600 border-cyan-600'
                                                            : someThirdSelectedAPS
                                                              ? 'bg-cyan-600/50 border-cyan-600'
                                                              : 'border-cyan-500/50 hover:border-cyan-400'
                                                        }`}
                                                      >
                                                        {allThirdSelectedAPS && <Check className="h-2.5 w-2.5 text-white" />}
                                                        {someThirdSelectedAPS && <Minus className="h-2.5 w-2.5 text-white" />}
                                                      </button>
                                                      <button
                                                        onClick={() => toggleGroupAPS(thirdGroupFullKey)}
                                                        className="flex items-center gap-2 flex-1 min-w-0"
                                                      >
                                                        {isThirdExpanded ? (
                                                          <ChevronDown className="h-3 w-3 text-cyan-400" />
                                                        ) : (
                                                          <ChevronRight className="h-3 w-3 text-cyan-400" />
                                                        )}
                                                        <span className="text-[10px] font-medium text-cyan-300">
                                                          {AVAILABLE_GROUPINGS_APS.find(g => g.field === activeGroupingsAPS[2])?.label}:
                                                        </span>
                                                        <span className="text-[10px] text-white">{thirdGroupKey}</span>
                                                        <span className="ml-auto text-[10px] text-muted-foreground">
                                                          {thirdItems.length}
                                                        </span>
                                                      </button>
                                                    </div>
                                                    {isThirdExpanded && (
                                                      <table className="w-full text-xs">
                                                        <thead>
                                                          <tr className="border-b border-border/30 text-left">
                                                            <th className="p-1.5 w-8"></th>
                                                            {visibleColumnsAPS.map(col => (
                                                              <th key={col.field} className="p-1.5 text-[10px] font-medium text-purple-300">{col.label}</th>
                                                            ))}
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {thirdItems.map((item) => (
                                                            <tr
                                                              key={item.rsv_ids}
                                                              id={`row-aps-${item.rsv_ids}`}
                                                              className={`border-t border-border/30 hover:bg-purple-900/10 transition-colors ${
                                                                selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-yellow-500/20' : ''
                                                              }`}
                                                            >
                                                              <td className="p-1.5 w-8">
                                                                <button
                                                                  onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                                    selectedItemsAPS.has(String(item.rsv_ids))
                                                                      ? 'bg-cyan-600 border-cyan-600'
                                                                      : 'border-cyan-500/50 hover:border-cyan-400'
                                                                  }`}
                                                                >
                                                                  {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                                    <Check className="h-2.5 w-2.5 text-white" />
                                                                  )}
                                                                </button>
                                                              </td>
                                                              {visibleColumnsAPS.map(col => {
                                                                const value = item[col.field as keyof InventarioConAPS];
                                                                if (col.field === 'codigo_unico') {
                                                                  return <td key={col.field} className="p-1.5 text-white font-medium">{value || '-'}</td>;
                                                                }
                                                                if (col.field === 'caras_totales') {
                                                                  return (
                                                                    <td key={col.field} className="p-1.5 text-center">
                                                                      <span className="px-1 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                                                                        {value}
                                                                      </span>
                                                                    </td>
                                                                  );
                                                                }
                                                                return <td key={col.field} className="p-1.5 text-zinc-400">{value !== null && value !== undefined ? String(value) : '-'}</td>;
                                                              })}
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Comentarios */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowComments(false)}
          />
          <div className="relative bg-[#1a1025] border border-purple-900/30 rounded-xl w-full max-w-xl mx-4 h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-purple-900/30">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-400" />
                Comentarios
                {comentarios.length > 0 && (
                  <span className="text-sm text-muted-foreground">({comentarios.length})</span>
                )}
              </h3>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-purple-900/20 flex flex-col scrollbar-purple">
              {comentarios.length === 0 ? (
                <EmptyState
                  icon={<MessageSquareOff className="h-6 w-6 text-purple-400" />}
                  title="Sin comentarios"
                  description="Sé el primero en dejar un comentario en esta campaña"
                  className="h-full"
                />
              ) : (
                comentarios.map((c) => (
                  <div key={c.id} className="flex gap-2 py-2">
                    <UserAvatar nombre={c.autor_nombre} foto_perfil={c.autor_foto} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{c.autor_nombre || 'Usuario'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(c.fecha)}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">{c.contenido}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>
            <div className="p-3 border-t border-purple-900/30">
              <div className="flex items-center gap-2">
                <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="md" />
                <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-purple-900/20 border border-purple-900/30 focus-within:border-purple-500">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                    placeholder="Escribe un comentario..."
                    className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!comment.trim() || addCommentMutation.isPending}
                    className="p-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addCommentMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Quitar APS */}
      {showRemoveAPSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseRemoveAPSModal}
          />
          <div className="relative bg-[#1a1025] border border-red-900/30 rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Minus className="h-5 w-5 text-red-400" />
                Requiere autorización
              </h3>
              <button
                onClick={handleCloseRemoveAPSModal}
                className="p-1 hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pinVerificado ? (
              // PIN verificado - mostrar opciones de quitar APS
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Autorización verificada</span>
                </div>

                {selectedItemsAPS.size > 0 ? (
                  <p className="text-sm text-cyan-300 text-center">
                    {selectedItemsAPS.size} elemento(s) seleccionado(s)
                  </p>
                ) : (
                  <p className="text-sm text-yellow-400 text-center">
                    No hay elementos seleccionados.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={handleCloseRemoveAPSModal}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleQuitarAPS}
                    disabled={selectedItemsAPS.size === 0 || quitandoAPS}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {quitandoAPS ? 'Quitando...' : 'Quitar APS'}
                  </button>
                </div>
              </div>
            ) : (
              // Solicitar autorización
              <>
                <p className="text-sm text-zinc-300 mb-6">
                  Solicita el código al administrador
                </p>

                {errorPIN && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{errorPIN}</p>
                  </div>
                )}

                {!codigoSolicitado ? (
                  <div className="flex justify-center">
                    <button
                      onClick={handleSolicitarCodigo}
                      disabled={enviandoCodigo || botonDeshabilitado}
                      className="px-6 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {enviandoCodigo ? 'Enviando...' : botonDeshabilitado ? 'Espera 15s...' : 'Solicitar Código'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400 text-center">
                      Se envió el código al administrador. Expira en 2 minutos.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nipInput}
                        onChange={(e) => setNipInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerificarPIN()}
                        placeholder="Ingresa el NIP"
                        maxLength={6}
                        className="flex-1 px-3 py-2 text-sm text-center tracking-widest font-mono rounded-lg bg-purple-900/20 border border-purple-900/30 focus:border-purple-500 focus:outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={handleVerificarPIN}
                        disabled={!nipInput.trim()}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Verificar
                      </button>
                    </div>
                    <button
                      onClick={handleSolicitarCodigo}
                      disabled={enviandoCodigo || botonDeshabilitado}
                      className="w-full text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {botonDeshabilitado ? 'Espera para reenviar...' : 'Reenviar código'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal POST a SAP */}
      {showPostSAPModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1025] border border-purple-900/50 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-300">Enviar a SAP</h3>
              <button
                onClick={() => {
                  setShowPostSAPModal(false);
                  setPostSAPResult(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!postSAPResult ? (
              <>
                <div className="mb-6">
                  <p className="text-sm text-zinc-400 mb-4">
                    Se enviará un Delivery Note a SAP con los siguientes datos:
                  </p>
                  <div className="bg-purple-900/20 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Campaña:</span>
                      <span className="text-zinc-300">{campana?.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Items con APS:</span>
                      <span className="text-zinc-300">{inventarioConAPS.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">APS únicos:</span>
                      <span className="text-zinc-300">{new Set(inventarioConAPS.map(i => i.aps)).size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Cliente:</span>
                      <span className="text-zinc-300">{campana?.T0_U_Cliente || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowPostSAPModal(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePostToSAP}
                    disabled={postingToSAP}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {postingToSAP ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Enviar a SAP
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                {postSAPResult.success ? (
                  <>
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-green-400 mb-2">¡Éxito!</p>
                    <p className="text-sm text-zinc-400 mb-4">{postSAPResult.message}</p>
                    {postSAPResult.data && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-left text-xs mb-4">
                        <pre className="text-green-300 whitespace-pre-wrap overflow-auto max-h-40">
                          {JSON.stringify(postSAPResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-red-400 mb-2">Error</p>
                    <p className="text-sm text-zinc-400 mb-4">{postSAPResult.message}</p>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowPostSAPModal(false);
                    setPostSAPResult(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
