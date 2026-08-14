import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { ArrowLeft, MessageSquare, Send, X, FileSpreadsheet, ListTodo, Layers, ChevronDown, ChevronRight, Check, Minus, Filter, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Loader2, CheckCircle, AlertCircle, AlertTriangle, Package, MapPinOff, RefreshCw, MessageSquareOff, ServerCrash, WifiOff, History, Edit2, XCircle } from 'lucide-react';
import { AssignInventarioCampanaModal } from './AssignInventarioCampanaModal';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../../config/googleMaps';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioReservado, InventarioConAPS, SolicitudCara, buildDeliveryNote, postDeliveryNoteToSAP, patchDeliveryNoteToSAP, findExistingDeliveryNote, resolveBaseEntry, isMigratedCampaign, HistorialItem, SAPDeliveryNoteMigrated, PostLogItem } from '../../services/campanas.service';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import { Badge } from '../../components/ui/badge';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import { formatHistorialDetalles } from '../../lib/historial';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
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
  isDark?: boolean;
}

// Estilos para chips según tipo de dato
const getChipStyles = (isDark: boolean): Record<InfoItemType, string> => ({
  date: isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200',
  catorcena: isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-violet-50 text-violet-700 border border-violet-200',
  user: isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200',
  id: isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono' : 'bg-amber-50 text-amber-700 border border-amber-200 font-mono',
  amount: isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
  percent: isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  status: isDark ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-pink-50 text-pink-700 border border-pink-200',
  category: isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  default: isDark ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30' : 'bg-gray-100 text-gray-700 border border-gray-200',
});

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
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
];

// Formatear fecha como "Cat X / YYYY"
function formatAsCatorcena(dateStr: string): string {
  try {
    const fecha = new Date(dateStr);
    if (isNaN(fecha.getTime())) return dateStr;
    const catorcena = calcularCatorcena(fecha);
    const anio = fecha.getFullYear();
    return `Cat ${catorcena} / ${anio}`;
  } catch {
    return dateStr;
  }
}


const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
    return { catorcena: `Cat ${found.numero_catorcena}`, year: found.a_o };
  }
  return null;
}

function getCatorcenaDisplay(dateStr: string, catorcenas: Catorcena[], tipoPeriodo?: string): string {
  if (tipoPeriodo === 'mensual') {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    return dateStr;
  }
  const result = dateToCatorcena(dateStr, catorcenas);
  if (result) {
    return `${result.catorcena} / ${result.year}`;
  }
  // Fallback: show month name for monthly periods
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return dateStr;
}

function InfoItem({ label, value, type = 'default', isDark: isDarkProp }: InfoItemProps) {
  const isDarkStore = useThemeStore((s) => s.theme) === 'dark';
  const isDark = isDarkProp ?? isDarkStore;
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  const chipStyles = getChipStyles(isDark);

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
function InfoCardSkeleton({ isDark: isDarkProp }: { isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
      <div className="h-4 bg-purple-500/20 rounded w-24 mb-4"></div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex justify-between items-center py-1.5">
            <div className={`h-3 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'} rounded w-20`}></div>
            <div className={`h-5 ${isDark ? 'bg-zinc-700/30' : 'bg-gray-100'} rounded-md w-28`}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ isDark: isDarkProp }: { isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className="animate-pulse">
      <div className="space-y-2">
        {/* Header skeleton */}
        <div className="flex items-center gap-2 pb-2">
          <div className={`h-7 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'} rounded-lg w-32`}></div>
          <div className={`h-7 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'} rounded-lg w-24`}></div>
          <div className={`h-7 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'} rounded-lg w-20`}></div>
        </div>
        {/* Table rows skeleton */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className={`${isDark ? 'bg-purple-900/20' : 'bg-purple-50'} px-3 py-2 flex gap-4`}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-3 bg-purple-500/30 rounded w-16"></div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-3 py-2.5 border-t border-border flex gap-4">
              {[...Array(6)].map((_, j) => (
                <div key={j} className={`h-3 ${isDark ? 'bg-zinc-700/40' : 'bg-gray-200'} rounded w-16`}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapSkeleton({ isDark: isDarkProp }: { isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'} animate-pulse`}>
      <div className="w-12 h-12 rounded-full bg-purple-500/30 mb-3 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
      </div>
      <div className="h-3 bg-purple-500/20 rounded w-32 mb-2"></div>
      <div className={`h-2 ${isDark ? 'bg-zinc-700/30' : 'bg-gray-200'} rounded w-24`}></div>
    </div>
  );
}

function CommentsSkeleton({ isDark: isDarkProp }: { isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className="flex-1 overflow-hidden p-3 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-2 py-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/30 flex-shrink-0"></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-3 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'} rounded w-20`}></div>
              <div className={`h-2 ${isDark ? 'bg-zinc-700/30' : 'bg-gray-100'} rounded w-16`}></div>
            </div>
            <div className="space-y-1">
              <div className={`h-2 ${isDark ? 'bg-zinc-700/40' : 'bg-gray-200'} rounded w-full`}></div>
              <div className={`h-2 ${isDark ? 'bg-zinc-700/40' : 'bg-gray-200'} rounded w-3/4`}></div>
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
  isDark?: boolean;
}

function EmptyState({ icon, title, description, action, className = '', isDark: isDarkProp }: EmptyStateProps) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
        {icon || <Package className="h-6 w-6 text-purple-400" />}
      </div>
      <p className={`text-sm font-medium text-center ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{title}</p>
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
function MapEmptyState({ isDark: isDarkProp }: { isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${isDark ? 'bg-purple-900/10' : 'bg-purple-50/50'}`}>
      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
        <MapPinOff className="h-6 w-6 text-purple-400" />
      </div>
      <p className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Sin ubicaciones</p>
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

// GOOGLE_MAPS_API_KEY centralizado en src/config/googleMaps.ts.
// Este componente DEBE usar la misma config que AssignInventarioCampanaModal
// (mismo id/key/libraries); si no, Google Maps se carga dos veces y la
// pantalla se traba/pone morada al reservar.

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
  { field: 'articulo', label: 'Artículo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo_de_cara', label: 'Formato' },
  { field: 'caras_totales', label: 'Caras' },
  { field: 'tarifa_publica', label: 'Tarifa' },
  { field: 'total_inversion', label: 'Inversión' },
  { field: 'latitud', label: 'Lat' },
  { field: 'longitud', label: 'Lon' },
  { field: 'medidas', label: 'Medidas' },
];

// Columnas específicas para artículos de impresión (sin inventario)
const TABLE_COLUMNS_IM: TableColumn[] = [
  { field: 'articulo', label: 'Artículo' },
  { field: 'formato', label: 'Formato' },
  { field: 'caras_totales', label: 'Impresiones' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tarifa_publica', label: 'Tarifa' },
  { field: 'total_inversion', label: 'Inversión' },
  { field: 'tipo_medio', label: 'Tipo' },
  { field: 'inicio_periodo', label: 'Inicio' },
  { field: 'fin_periodo', label: 'Fin' },
  { field: 'estatus_reserva', label: 'Estatus' },
];

// Helper para detectar artículos de impresión
const isIMArticle = (item: InventarioReservado | InventarioConAPS): boolean => {
  return String(item.rsv_ids).startsWith('sc_');
};

const TABLE_COLUMNS_IM_APS: TableColumn[] = [
  { field: 'articulo', label: 'Artículo' },
  { field: 'formato', label: 'Formato' },
  { field: 'caras_totales', label: 'Impresiones' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'tarifa_publica', label: 'Tarifa' },
  { field: 'total_inversion', label: 'Inversión' },
  { field: 'tipo_medio', label: 'Tipo' },
  { field: 'inicio_periodo', label: 'Inicio' },
  { field: 'fin_periodo', label: 'Fin' },
  { field: 'aps', label: 'APS' },
  { field: 'estatus_reserva', label: 'Estatus' },
];

const TABLE_COLUMNS_APS: TableColumn[] = [
  { field: 'codigo_unico', label: 'Código' },
  { field: 'articulo', label: 'Artículo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'formato', label: 'Formato' },
  //{ field: 'caras_totales', label: 'Caras' },
  { field: 'tarifa_publica', label: 'Tarifa' },
  //{ field: 'total_inversion', label: 'Inversión' },
  { field: 'latitud', label: 'Lat' },
  { field: 'longitud', label: 'Lon' },
  { field: 'medidas', label: 'Medidas' },
  { field: 'aps', label: 'APS' },
  { field: 'estatus_reserva', label: 'Estatus' },
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

function fmtMoney(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function GroupSummaryInline({ items, groupField, isDark: isDarkProp }: { items: InventarioReservado[]; groupField: string; isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  if (groupField === 'aps') return null;
  const carasTotal = items.reduce((s, i) => s + (Number(i.caras_totales) || 0), 0);
  const getTarifa = (i: InventarioReservado) => Number(i.tarifa_bruta_sc) || Number(i.tarifa_publica_sc) || Number(i.tarifa_publica) || 0;
  const totalInversion = items.reduce((s, i) => s + getTarifa(i) * (Number(i.caras_totales) || 0), 0);
  const tarifas = [...new Set(items.map(i => getTarifa(i)).filter(t => t > 0))];
  const uniformTarifa = tarifas.length === 1 ? tarifas[0] : 0;
  const showTarifa = groupField !== 'inicio_periodo';
  return (
    <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
      <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{carasTotal}</span></span>
      {showTarifa && <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa: <span className="text-amber-400 font-medium">{uniformTarifa > 0 ? fmtMoney(uniformTarifa) : '$0'}</span></span>}
      <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(totalInversion)}</span></span>
    </div>
  );
}

function GroupMetaBadges({ items, skipFields, isDark: isDarkProp }: { items: InventarioReservado[]; skipFields: string[]; isDark?: boolean }) {
  const isDark = isDarkProp ?? (useThemeStore((s) => s.theme) === 'dark');
  const plazas = [...new Set(items.map(i => i.plaza).filter(Boolean))] as string[];
  const formatos = [...new Set(items.map(i => i.formato ?? i.tipo_de_cara).filter(Boolean))] as string[];
  const articulos = [...new Set(items.map(i => i.articulo).filter(Boolean))] as string[];
  const showPlazas = !skipFields.includes('plaza') && plazas.length > 0;
  const showArticulos = !skipFields.includes('articulo') && articulos.length > 0;
  const showFormatos = !skipFields.includes('formato') && formatos.length > 0;
  if (!showPlazas && !showArticulos && !showFormatos) return null;
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 mb-1 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
      {showPlazas && (
        <div className="flex items-center gap-1">
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
          {plazas.slice(0, 3).map(p => <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{p}</span>)}
          {plazas.length > 3 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{plazas.length - 3}</span>}
        </div>
      )}
      {showArticulos && (
        <div className="flex items-center gap-1">
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Art:</span>
          {articulos.slice(0, 2).map(a => <span key={a} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-50 text-violet-700'}`}>{a}</span>)}
          {articulos.length > 2 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{articulos.length - 2}</span>}
        </div>
      )}
      {showFormatos && (
        <div className="flex items-center gap-1">
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
          {formatos.slice(0, 2).map(f => <span key={f} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>{f}</span>)}
          {formatos.length > 2 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{formatos.length - 2}</span>}
        </div>
      )}
    </div>
  );
}

function renderReservadoCell(item: InventarioReservado, col: TableColumn, p = 'p-1.5', isDark = true, groupInfo?: { esperadas: number; reservadas: number; completo: boolean; exceso: boolean } | null, hideGroupBadge = false) {
  if (col.field === 'codigo_unico') return (
    <td key={col.field} className={`${p} ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>
      <div className="flex items-center gap-1.5">
        {item.codigo_unico || '-'}
        {item.estatus_inventario === 'Bloqueado' && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Bloqueado</span>
        )}
        {!hideGroupBadge && groupInfo && !groupInfo.completo && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" title={`Grupo incompleto: ${groupInfo.reservadas}/${groupInfo.esperadas} caras`}>
            {groupInfo.reservadas}/{groupInfo.esperadas}
          </span>
        )}
        {!hideGroupBadge && groupInfo && groupInfo.exceso && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30" title={`Exceso de inventario: ${groupInfo.reservadas}/${groupInfo.esperadas} caras`}>
            +{groupInfo.reservadas - groupInfo.esperadas}
          </span>
        )}
      </div>
    </td>
  );
  if (col.field === 'caras_totales') return <td key={col.field} className={`${p} text-center`}><span className={`px-1 py-0.5 rounded text-[10px] ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-50 text-pink-700'}`}>{item.caras_totales}</span></td>;
  if (col.field === 'renta') return <td key={col.field} className={`${p} text-center ${isDark ? 'text-violet-300' : 'text-violet-700'} text-[10px]`}>{item.renta != null ? item.renta : '-'}</td>;
  if (col.field === 'bonificacion_sc') return <td key={col.field} className={`${p} text-center ${isDark ? 'text-pink-300' : 'text-pink-700'} text-[10px]`}>{item.bonificacion_sc != null ? item.bonificacion_sc : '-'}</td>;
  if (col.field === 'tarifa_publica') {
    const t = Number(item.tarifa_bruta_sc) || Number(item.tarifa_publica_sc) || Number(item.tarifa_publica) || 0;
    return <td key={col.field} className={`${p} text-amber-400 text-right font-mono text-[10px]`}>{fmtMoney(t)}</td>;
  }
  if (col.field === 'total_inversion') {
    const t = Number(item.tarifa_bruta_sc) || Number(item.tarifa_publica_sc) || Number(item.tarifa_publica) || 0;
    const inv = t * (Number(item.caras_totales) || 0);
    return <td key={col.field} className={`${p} text-emerald-400 text-right font-mono font-medium text-[10px]`}>{fmtMoney(inv)}</td>;
  }
  if (col.field === 'latitud') return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-500' : 'text-gray-400'} font-mono text-[10px]`}>{item.latitud != null ? item.latitud.toFixed(5) : '-'}</td>;
  if (col.field === 'longitud') return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-500' : 'text-gray-400'} font-mono text-[10px]`}>{item.longitud != null ? item.longitud.toFixed(5) : '-'}</td>;
  if (col.field === 'medidas') return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[10px]`}>{item.ancho && item.alto ? `${item.ancho}×${item.alto}` : '-'}</td>;
  const value = item[col.field as keyof InventarioReservado];
  return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{value !== null && value !== undefined ? String(value) : '-'}</td>;
}

function renderIMCell(item: InventarioReservado, col: TableColumn, p = 'p-1.5', isDark = true) {
  if (col.field === 'articulo') return <td key={col.field} className={`${p}`}><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{item.articulo || '-'}</span></td>;
  if (col.field === 'formato') return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-300' : 'text-gray-700'} text-[10px]`}>{(item as any).formato || '-'}</td>;
  if (col.field === 'caras_totales') return <td key={col.field} className={`${p} text-center`}><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>{item.caras_totales}</span></td>;
  if (col.field === 'plaza') return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-300' : 'text-gray-700'} text-[10px]`}>{item.plaza || '-'}</td>;
  if (col.field === 'tarifa_publica') {
    const t = Number((item as any).tarifa_bruta_sc) || Number((item as any).tarifa_publica_sc) || Number(item.tarifa_publica) || 0;
    return <td key={col.field} className={`${p} text-amber-400 text-right font-mono text-[10px]`}>{fmtMoney(t)}</td>;
  }
  if (col.field === 'total_inversion') {
    const t = Number((item as any).tarifa_bruta_sc) || Number((item as any).tarifa_publica_sc) || Number(item.tarifa_publica) || 0;
    const inv = t * (Number(item.caras_totales) || 0);
    return <td key={col.field} className={`${p} text-emerald-400 text-right font-mono font-medium text-[10px]`}>{fmtMoney(inv)}</td>;
  }
  if (col.field === 'tipo_medio') return <td key={col.field} className={`${p}`}><span className={`text-[10px] px-1.5 py-0.5 rounded ${(item as any).tipo_medio === 'Digital' ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') : (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700')}`}>{(item as any).tipo_medio || '-'}</span></td>;
  if (col.field === 'inicio_periodo') {
    const d = item.inicio_periodo ? new Date(item.inicio_periodo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[10px]`}>{d}</td>;
  }
  if (col.field === 'fin_periodo') {
    const d = (item as any).fin_periodo ? new Date((item as any).fin_periodo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-[10px]`}>{d}</td>;
  }
  if (col.field === 'estatus_reserva') return <td key={col.field} className={p}><span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{(item as any).estatus_reserva || 'Impresión'}</span></td>;
  const value = (item as any)[col.field];
  return <td key={col.field} className={`${p} ${isDark ? 'text-zinc-300' : 'text-gray-700'} text-[10px]`}>{value !== null && value !== undefined ? String(value) : '-'}</td>;
}

function renderAPSCell(item: InventarioConAPS, col: TableColumn, p = 'p-1.5', isDark = true, groupInfo?: { esperadas: number; reservadas: number; completo: boolean; exceso: boolean } | null) {
  if (col.field === 'aps') return <td key={col.field} className={`${p} text-center`}><span className={`px-1.5 py-0.5 rounded font-medium ${item.aps ? (isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700') : (isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-gray-100 text-gray-500')}`}>{item.aps || '—'}</span></td>;
  if (col.field === 'estatus_reserva') return <td key={col.field} className={p}><span className={`px-1.5 py-0.5 rounded text-[10px] ${item.estatus_reserva === 'confirmado' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700') : item.estatus_reserva === 'pendiente' ? (isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700') : (isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-gray-100 text-gray-500')}`}>{item.estatus_reserva || 'N/A'}</span></td>;
  return renderReservadoCell(item, col, p, isDark, groupInfo);
}

function renderIMAPSCell(item: InventarioConAPS, col: TableColumn, p = 'p-1.5', isDark = true) {
  if (col.field === 'aps') return <td key={col.field} className={`${p} text-center`}><span className={`px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>{item.aps}</span></td>;
  return renderIMCell(item as unknown as InventarioReservado, col, p, isDark);
}

// Función para aplicar filtros a los datos
function applyFilters<T>(data: T[], filters: FilterCondition[]): T[] {
  if (filters.length === 0) return data;

  const activeFilters = filters.filter(f => f.value !== '');
  if (activeFilters.length === 0) return data;

  const groupedByField = new Map<string, FilterCondition[]>();
  activeFilters.forEach(filter => {
    const arr = groupedByField.get(filter.field) ?? [];
    arr.push(filter);
    groupedByField.set(filter.field, arr);
  });

  const matchFilter = (item: T, filter: FilterCondition): boolean => {
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
  };

  return data.filter(item => {
    return Array.from(groupedByField.values()).every(groupFilters =>
      groupFilters.some(filter => matchFilter(item, filter))
    );
  });
}

// Helper para calcular el número de catorcena a partir de una fecha
function calcularCatorcena(fecha: Date): number {
  const inicioAnio = new Date(fecha.getFullYear(), 0, 1);
  const diffMs = fecha.getTime() - inicioAnio.getTime();
  const diaDelAnio = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(diaDelAnio / 14);
}

// Helper para formatear inicio_periodo como "Cat X / YYYY" o "Mes YYYY".
// Prioridad: tipo_periodo explícito de la campaña > numero_catorcena asignada
// por el backend > heurística por duración (>14 días). La heurística SOLO
// aplica cuando la campaña no declara tipo_periodo: en una campaña catorcenal,
// un fin_periodo largo (p.ej. una fila que abarca dos catorcenas) no debe
// re-etiquetar el grupo como "Julio 2026".
function formatInicioPeriodo(
  item: InventarioReservado | InventarioConAPS & { fin_periodo?: string | null },
  tipoPeriodo?: string,
): string {
  const itemAny = item as InventarioReservado & { fin_periodo?: string | null };
  let isMensual = tipoPeriodo === 'mensual';

  if (!isMensual && item.numero_catorcena && item.anio_catorcena) {
    return `Cat ${item.numero_catorcena} / ${item.anio_catorcena}`;
  }

  if (!isMensual && !tipoPeriodo && itemAny.inicio_periodo && itemAny.fin_periodo) {
    const ini = new Date(itemAny.inicio_periodo).getTime();
    const fin = new Date(itemAny.fin_periodo).getTime();
    if (!isNaN(ini) && !isNaN(fin)) {
      const diffDays = (fin - ini) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) isMensual = true; // catorcena = 14 días, mensual ~30
    }
  }

  if (isMensual && itemAny.inicio_periodo) {
    const parts = String(itemAny.inicio_periodo).split('-');
    if (parts.length >= 2) {
      return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
  }

  if (item.numero_catorcena && item.anio_catorcena) {
    return `Cat ${item.numero_catorcena} / ${item.anio_catorcena}`;
  }

  // Si tenemos la fecha de inicio_periodo, calcular la catorcena
  if (item.inicio_periodo) {
    const fecha = new Date(item.inicio_periodo);
    const catorcena = calcularCatorcena(fecha);
    const anio = fecha.getFullYear();
    return `Cat ${catorcena} / ${anio}`;
  }

  return 'Sin asignar';
}

// Helper para formatear articulo con info adicional
function formatArticulo(item: InventarioReservado | InventarioConAPS): string {
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

// formatHistorialDetalles ahora se importa desde lib/historial — mismo criterio
// que el resto de las pantallas (solicitudes, historial global).

// Helper para obtener el valor de agrupación formateado
function getGroupValue(item: InventarioReservado | InventarioConAPS, field: GroupByField, tipoPeriodo?: string): string {
  if (field === 'inicio_periodo') {
    return formatInicioPeriodo(item, tipoPeriodo);
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

// Mismo formato que getGroupValue pero para SolicitudCara (gruposSinInventario),
// asi sus claves coinciden con las de groupedInventario al hacer match/render.
function getSCGroupValue(sc: SolicitudCara, field: GroupByField, tipoPeriodo?: string): string {
  if (field === 'inicio_periodo') {
    // Heurística por duración SOLO cuando la campaña no declara tipo_periodo
    // (mismo criterio que formatInicioPeriodo para que las claves coincidan).
    let isMensual = tipoPeriodo === 'mensual';
    if (!isMensual && !tipoPeriodo && sc.inicio_periodo && sc.fin_periodo) {
      const ini = new Date(sc.inicio_periodo).getTime();
      const fin = new Date(sc.fin_periodo).getTime();
      if (!isNaN(ini) && !isNaN(fin) && (fin - ini) / 86400000 > 14) isMensual = true;
    }
    if (isMensual && sc.inicio_periodo) {
      const parts = String(sc.inicio_periodo).split('-');
      if (parts.length >= 2) {
        return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
      }
    }
    if (sc.inicio_periodo) {
      const fecha = new Date(sc.inicio_periodo);
      return `Cat ${calcularCatorcena(fecha)} / ${fecha.getFullYear()}`;
    }
    return 'Sin asignar';
  }
  if (field === 'articulo') {
    return sc.articulo ? sc.articulo.toUpperCase() : 'Sin asignar';
  }
  const val = (sc as unknown as Record<string, unknown>)[field];
  return val ? String(val) : 'Sin asignar';
}

// Marker memoizado: evita que cada Marker se vuelva a pintar cuando el componente
// padre se re-renderiza por estados no relacionados (selección, agrupación, filtros).
// Solo se re-pinta si cambia su posición, su estado de selección o sus iconos.
interface MapMarkerProps {
  rsvId: string;
  lat: number;
  lng: number;
  title: string;
  isSelected: boolean;
  iconSelected: google.maps.Symbol;
  iconUnselected: google.maps.Symbol;
  onClick: (rsvId: string) => void;
}
const MapMarker = memo(function MapMarker({
  rsvId, lat, lng, title, isSelected, iconSelected, iconUnselected, onClick,
}: MapMarkerProps) {
  const position = useMemo(() => ({ lat, lng }), [lat, lng]);
  const handleClick = useCallback(() => onClick(rsvId), [onClick, rsvId]);
  return (
    <Marker
      position={position}
      title={title}
      onClick={handleClick}
      icon={isSelected ? iconSelected : iconUnselected}
      zIndex={isSelected ? 1000 : 1}
    />
  );
});

export function CampanaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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

  // Toast para mensajes de bloqueo APS
  const [apsBlockToast, setApsBlockToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

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
  const [showIncompleteDetail, setShowIncompleteDetail] = useState(false);

  // Estado para modal de editar campaña
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Overlay de transición (clicks en Volver, Editar, Comentarios, Gestión de Artes)
  const [transitionOverlay, setTransitionOverlay] = useState<string | null>(null);

  const withTransitionOverlay = (mensaje: string, action: () => void) => {
    setTransitionOverlay(mensaje);
    // Permite que el overlay se pinte antes de disparar la acción
    setTimeout(() => {
      action();
      // Auto-limpia tras el tiempo típico de montaje de un modal pesado
      setTimeout(() => setTransitionOverlay(null), 1200);
    }, 30);
  };

  // Estado para filtros (inventario reservado)
  const [filtersReservado, setFiltersReservado] = useState<FilterCondition[]>([]);
  const [showFiltersReservado, setShowFiltersReservado] = useState(false);
  const [openFilterInputReservado, setOpenFilterInputReservado] = useState<string | null>(null);
  const [filterDropdownRect, setFilterDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [filterDraftReservado, setFilterDraftReservado] = useState<Record<string, string>>({});

  // Estado para filtros (inventario con APS)
  const [filtersAPS, setFiltersAPS] = useState<FilterCondition[]>([]);
  const [showFiltersAPS, setShowFiltersAPS] = useState(false);
  const [openFilterInputAPS, setOpenFilterInputAPS] = useState<string | null>(null);
  const [filterDropdownRectAPS, setFilterDropdownRectAPS] = useState<{ top: number; left: number; width: number } | null>(null);
  const [filterDraftAPS, setFilterDraftAPS] = useState<Record<string, string>>({});

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
  const [postSAPResult, setPostSAPResult] = useState<{
    success: boolean;
    message: string;
    data?: unknown;
    detail?: {
      endpoint?: string;
      status?: number;
      errorType?: 'network' | 'cors' | 'parse' | 'sap-rejected' | 'http-error' | 'timeout';
      rawResponse?: string;
      partialSuccess?: boolean;
      successCount?: number;
      failedCount?: number;
    };
  } | null>(null);
  const [showCancelPostSAPModal, setShowCancelPostSAPModal] = useState(false);
  const [cancellingPostSAP, setCancellingPostSAP] = useState(false);
  const [cancelPostSAPResult, setCancelPostSAPResult] = useState<{ success: boolean; message: string } | null>(null);
  const [alreadyPosted, setAlreadyPosted] = useState(false);
  const [previewDeliveryNote, setPreviewDeliveryNote] = useState<any>(null);
  const [postedAPSGroups, setPostedAPSGroups] = useState<Set<number>>(new Set());
  // Modal "Historial de posteos" — bitácora de a quién se mandó cada APS.
  const [showPostLogModal, setShowPostLogModal] = useState(false);
  // APS etiquetados Pre Factura — bloquea POST a SAP y muestra badge dorado.
  const [prefacturaAPSGroups, setPrefacturaAPSGroups] = useState<Set<number>>(new Set());

  const { isLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);

  const mapRefAPS = useRef<google.maps.Map | null>(null);

  // Opciones de GoogleMap estables: solo cambian con el tema.
  // Antes el objeto literal se recreaba en cada render y forzaba al mapa a
  // reaplicar opciones (causa de parte del parpadeo al hacer click).
  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    styles: isDark ? DARK_MAP_STYLES : [],
    disableDefaultUI: true,
    zoomControl: true,
  }), [isDark]);

  // Iconos de Marker estables. Si el objeto cambia de referencia,
  // @react-google-maps llama a setIcon en cada Marker y eso re-pinta.
  // Se necesitan `google.maps` cargado para usar SymbolPath.
  const iconReservadoSelected = useMemo<google.maps.Symbol | null>(() => isLoaded ? {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: '#facc15',
    fillOpacity: 1,
    strokeColor: '#fef08a',
    strokeWeight: 3,
  } : null, [isLoaded]);
  const iconReservadoUnselected = useMemo<google.maps.Symbol | null>(() => isLoaded ? {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#ec4899',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  } : null, [isLoaded]);
  const iconAPSSelected = useMemo<google.maps.Symbol | null>(() => isLoaded ? {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: '#facc15',
    fillOpacity: 1,
    strokeColor: '#fef08a',
    strokeWeight: 3,
  } : null, [isLoaded]);
  const iconAPSUnselected = useMemo<google.maps.Symbol | null>(() => isLoaded ? {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#22d3ee',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  } : null, [isLoaded]);

  // Todas las queries usan `campanaId` directo. Antes 4 de ellas tenían
  // `enabled: !!campana` y se quedaban esperando a la query principal,
  // serializando una cascada de ~1.5s. Ahora corren en paralelo desde el
  // inicio: getById + inventario + inventario-aps + caras + historial.
  // Si la campaña no existe (404), las dependientes también fallan rápido.
  const { data: campana, isLoading, error } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
    staleTime: 1000 * 30, // 30 s — WS invalida en cambios reales
    placeholderData: (prev) => prev, // evita parpadeo al refrescar
  });

  // Inicializar alreadyPosted, postedAPSGroups y prefacturaAPSGroups desde la DB
  useEffect(() => {
    if (campana?.posted_to_sap) setAlreadyPosted(true);
    if (campana?.posted_aps) setPostedAPSGroups(new Set(campana.posted_aps));
    if (campana?.prefactura_aps) setPrefacturaAPSGroups(new Set(campana.prefactura_aps));
  }, [campana?.posted_to_sap, campana?.posted_aps, campana?.prefactura_aps]);

  const { data: inventarioReservado = [], isLoading: isLoadingInventario, error: errorInventario, refetch: refetchInventario } = useQuery({
    queryKey: ['campana-inventario', campanaId],
    queryFn: () => campanasService.getInventarioReservado(campanaId),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  // Bitácora de POSTs a SAP: a quién se mandó cada APS (snapshot histórico).
  const { data: postLog = [], refetch: refetchPostLog } = useQuery({
    queryKey: ['campana-post-log', campanaId],
    queryFn: () => campanasService.getPostLog(campanaId),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  // Último POST exitoso por APS — para el badge/tooltip de la lista.
  const postLogByAPS = useMemo(() => {
    const map = new Map<number, PostLogItem>();
    // postLog viene ordenado por posted_at DESC, así que el primero de cada APS
    // es el más reciente. Se prefiere el último EXITOSO para el badge.
    for (const p of postLog) {
      if (!p.success) continue;
      if (!map.has(p.aps)) map.set(p.aps, p);
    }
    return map;
  }, [postLog]);

  const { data: inventarioConAPS = [], isLoading: isLoadingAPS, error: errorAPS, refetch: refetchAPS } = useQuery({
    queryKey: ['campana-inventario-aps', campanaId],
    queryFn: () => campanasService.getInventarioConAPS(campanaId),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  const { data: solicitudCaras = [] } = useQuery({
    queryKey: ['campana-caras', campanaId],
    queryFn: () => campanasService.getCaras(campanaId),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  const { data: historial = [], isLoading: isLoadingHistorial } = useQuery({
    queryKey: ['campana-historial', campanaId],
    queryFn: () => campanasService.getHistorial(campanaId),
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  // Catorcenas casi nunca cambian — staleTime alto evita refetches al
  // navegar entre páginas que comparten esta queryKey.
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    staleTime: 1000 * 60 * 30, // 30 min
    gcTime: 1000 * 60 * 60,    // 1 h
  });
  const catorcenas = catorcenasData?.data || [];
  // Sin default 'catorcena': formatInicioPeriodo/getSCGroupValue necesitan
  // distinguir "la campaña declara catorcena" de "no llegó el dato" para
  // decidir si aplican la heurística de duración. Todos los demás consumidores
  // solo comparan === 'mensual', así que undefined se comporta igual.
  const tipoPeriodo = (campana as any)?.tipo_periodo || undefined;

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

  // Ajusta el zoom del mapa para que entren los puntos SELECCIONADOS del inventario.
  // El mapa sólo dibuja los seleccionados (ver render de Markers), por lo que el
  // fitBounds también se calcula sobre la selección — si no hay nada seleccionado
  // se deja la vista actual (no se centra en CDMX por defecto al re-seleccionar).
  const fitMapToInventario = useCallback((map: google.maps.Map | null) => {
    if (!map) return;
    const validItems = inventarioReservado.filter(i => i.latitud && i.longitud && selectedItems.has(i.rsv_ids));
    if (validItems.length === 0) return;
    if (validItems.length === 1) {
      map.setCenter({ lat: validItems[0].latitud, lng: validItems[0].longitud });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    validItems.forEach(item => {
      bounds.extend({ lat: item.latitud, lng: item.longitud });
    });
    map.fitBounds(bounds, 50); // 50px padding
  }, [inventarioReservado, selectedItems]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    fitMapToInventario(map);
  }, [fitMapToInventario]);

  // Re-ajustar cuando cambia el inventario (después del primer load).
  useEffect(() => {
    fitMapToInventario(mapRef.current);
  }, [fitMapToInventario]);

  // Equivalentes para el mapa de Inventario con APS.
  // Antes el `center` y `onLoad` se creaban en JSX como objeto/función literal en
  // cada render, lo que forzaba a GoogleMap a re-evaluar y a re-pintar todos
  // los markers (origen del parpadeo en la pestaña con APS).
  const mapCenterAPS = useMemo(() => {
    const valid = inventarioConAPS.find(i => i.latitud && i.longitud);
    if (valid) return { lat: valid.latitud, lng: valid.longitud };
    return { lat: 19.4326, lng: -99.1332 };
  }, [inventarioConAPS]);

  const fitMapToInventarioAPS = useCallback((map: google.maps.Map | null) => {
    if (!map) return;
    const validItems = inventarioConAPS.filter(i => i.latitud && i.longitud && selectedItemsAPS.has(String(i.rsv_ids)));
    if (validItems.length === 0) return;
    if (validItems.length === 1) {
      map.setCenter({ lat: validItems[0].latitud, lng: validItems[0].longitud });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    validItems.forEach(item => {
      bounds.extend({ lat: item.latitud, lng: item.longitud });
    });
    map.fitBounds(bounds, 50);
  }, [inventarioConAPS, selectedItemsAPS]);

  const onMapLoadAPS = useCallback((map: google.maps.Map) => {
    mapRefAPS.current = map;
    fitMapToInventarioAPS(map);
  }, [fitMapToInventarioAPS]);

  useEffect(() => {
    fitMapToInventarioAPS(mapRefAPS.current);
  }, [fitMapToInventarioAPS]);

  // Mapa de completitud por grupo (solicitudCaras).
  // Las cortesías (articulo CT*, sc.cortesia = 1) SÍ entran al mapa: antes se
  // excluían y el resultado era que un circuito CT incompleto no se marcaba, y
  // uno sin ninguna reserva no aparecía en la tabla Sin APS. Se marcan con el
  // flag `cortesia` para que sigan siendo seleccionables (ver
  // isItemFromIncompleteGroup) — el bloqueo es sólo visual para ellas.
  // En CT las caras esperadas viven en `bonificacion` (caras = 0).
  const groupCompletenessMap = useMemo(() => {
    const map = new Map<number, { esperadas: number; reservadas: number; completo: boolean; exceso: boolean; cortesia: boolean }>();
    solicitudCaras.forEach((sc: SolicitudCara) => {
      const esperadas = (sc.caras || 0) + (Number(sc.bonificacion) || 0);
      const reservasSinAPS = inventarioReservado.filter(i => i.solicitud_caras_id === sc.id)
        .reduce((sum, i) => sum + (i.caras_totales || 1), 0);
      const reservasConAPS = inventarioConAPS.filter(i => i.solicitud_caras_id === sc.id)
        .reduce((sum, i) => sum + (i.caras_totales || 1), 0);
      const reservadas = reservasSinAPS + reservasConAPS;
      // esperadas = 0 es "sin dato de caras", no un grupo incompleto ni con
      // exceso: marcarlo bloquearía circuitos mal capturados para siempre.
      const sinDato = esperadas === 0;
      map.set(sc.id, {
        esperadas,
        reservadas,
        completo: sinDato || reservadas >= esperadas,
        exceso: !sinDato && reservadas > esperadas,
        cortesia: sc.cortesia === 1,
      });
    });
    return map;
  }, [solicitudCaras, inventarioReservado, inventarioConAPS]);

  // Grupos sin inventario (solicitudCaras sin ninguna reserva). Incluye
  // cortesías: un CT sin reservas no tiene fila en el inventario, así que si no
  // se lista aquí no se ve en ningún lado de la tabla Sin APS.
  const gruposSinInventario = useMemo(() => {
    return solicitudCaras.filter((sc: SolicitudCara) => {
      const info = groupCompletenessMap.get(sc.id);
      return info && info.reservadas === 0 && info.esperadas > 0;
    });
  }, [solicitudCaras, groupCompletenessMap]);

  // Helper: verificar si un item pertenece a un grupo incompleto.
  // Las cortesías se marcan visualmente pero NO se bloquean: siguen pudiendo
  // seleccionarse para mandarlas al gestor de artes sin APS.
  const isItemFromIncompleteGroup = (item: InventarioReservado): boolean => {
    if (!item.solicitud_caras_id) return false;
    const info = groupCompletenessMap.get(item.solicitud_caras_id);
    return !!info && !info.completo && !info.cortesia;
  };

  // Helper: verificar si un item pertenece a un grupo con exceso de caras
  const isItemFromExcessGroup = (item: InventarioReservado): boolean => {
    if (!item.solicitud_caras_id) return false;
    const info = groupCompletenessMap.get(item.solicitud_caras_id);
    return !!info && info.exceso && !info.cortesia;
  };

  // Hay algún item seleccionado en grupo incompleto o con exceso → deshabilita botón APS
  const selectedHasIncompleteOrExcess = useMemo(() => {
    if (selectedItems.size === 0) return false;
    return inventarioReservado
      .filter(i => selectedItems.has(i.rsv_ids))
      .some(item => {
        if (!item.solicitud_caras_id) return false;
        const info = groupCompletenessMap.get(item.solicitud_caras_id);
        // Cortesías: se marcan incompletas en la tabla pero no bloquean el botón.
        return !!info && !info.cortesia && (!info.completo || info.exceso);
      });
  }, [selectedItems, inventarioReservado, groupCompletenessMap]);

  // Items de inventarioReservado cuyos grupos están incompletos → aparecen en tabla APS como pendientes
  const incompleteReservadoForAPS = useMemo(() => {
    return inventarioReservado.filter(item => {
      if (!item.solicitud_caras_id) return false;
      const info = groupCompletenessMap.get(item.solicitud_caras_id);
      return !!info && !info.completo;
    });
  }, [inventarioReservado, groupCompletenessMap]);

  // Auto-dismiss toast de bloqueo APS
  useEffect(() => {
    if (apsBlockToast.show) {
      const timer = setTimeout(() => setApsBlockToast({ show: false, message: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [apsBlockToast.show]);

  const showApsBlockMessage = (item: InventarioReservado) => {
    const info = item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null;
    const esperadas = info?.esperadas || 0;
    const reservadas = info?.reservadas || 0;
    const faltan = esperadas - reservadas;
    setApsBlockToast({
      show: true,
      message: `No se puede asignar APS: el grupo tiene ${reservadas}/${esperadas} caras asignadas (faltan ${faltan}). Asigna el inventario completo desde el modal de "Asignar Inventario" para poder generar APS.`,
    });
  };

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

  // Valores únicos por campo: cálculo perezoso con cache por campo.
  // Antes se iteraban TODOS los campos × inventario en cada render (~30 × N).
  // Ahora solo se computa el campo solicitado y se memoiza hasta que cambie el
  // dataset.
  const uniqueValuesReservadoCache = useRef<{ data: InventarioReservado[]; map: Map<string, string[]> }>({ data: inventarioReservado, map: new Map() });
  if (uniqueValuesReservadoCache.current.data !== inventarioReservado) {
    uniqueValuesReservadoCache.current = { data: inventarioReservado, map: new Map() };
  }
  const getUniqueValuesReservado = useCallback((field: string): string[] => {
    const cache = uniqueValuesReservadoCache.current.map;
    const cached = cache.get(field);
    if (cached) return cached;
    const values = new Set<string>();
    inventarioReservado.forEach(item => {
      const val = item[field as keyof InventarioReservado];
      if (val !== null && val !== undefined && val !== '') {
        values.add(String(val));
      }
    });
    const sorted = Array.from(values).sort();
    cache.set(field, sorted);
    return sorted;
  }, [inventarioReservado]);

  const uniqueValuesAPSCache = useRef<{ data: InventarioConAPS[]; map: Map<string, string[]> }>({ data: inventarioConAPS, map: new Map() });
  if (uniqueValuesAPSCache.current.data !== inventarioConAPS) {
    uniqueValuesAPSCache.current = { data: inventarioConAPS, map: new Map() };
  }
  const getUniqueValuesAPS = useCallback((field: string): string[] => {
    const cache = uniqueValuesAPSCache.current.map;
    const cached = cache.get(field);
    if (cached) return cached;
    const values = new Set<string>();
    inventarioConAPS.forEach(item => {
      const val = item[field as keyof InventarioConAPS];
      if (val !== null && val !== undefined && val !== '') {
        values.add(String(val));
      }
    });
    const sorted = Array.from(values).sort();
    cache.set(field, sorted);
    return sorted;
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
    const headers = ['Código', 'Grupo ID', 'Mueble', 'Tipo de Mueble', 'Estado', 'Tipo', 'Caras'];
    const fields: (keyof InventarioReservado)[] = ['codigo_unico', 'solicitud_caras_id', 'mueble', 'tipo_de_mueble', 'estado', 'tipo_de_cara', 'caras_totales'];

    // Si hay filas seleccionadas en los checkboxes, exportar SOLO esas; si no,
    // exportar todo lo visible según los filtros activos.
    const rowsToExport = selectedItems.size > 0
      ? filteredInventarioReservado.filter(i => selectedItems.has(i.rsv_ids))
      : filteredInventarioReservado;

    const csvContent = [
      headers.join(','),
      ...rowsToExport.map(item =>
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
    const sufijo = selectedItems.size > 0 ? '_seleccion' : '';
    link.download = `inventario_reservado_${campana?.nombre || 'campana'}${sufijo}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredInventarioReservado, selectedItems, campana?.nombre]);

  // Función para descargar CSV (inventario con APS)
  const downloadCSVAPS = useCallback(() => {
    const headers = ['Código', 'Grupo ID', 'Mueble', 'Estado', 'Tipo', 'Caras'];
    const fields: (keyof InventarioConAPS)[] = ['codigo_unico', 'solicitud_caras_id', 'mueble', 'estado', 'tipo_de_cara', 'caras_totales'];

    // Si hay filas seleccionadas en los checkboxes, exportar SOLO esas (mismo
    // patrón que POST a SAP / Quitar APS). Si no hay selección, exportar todo lo
    // visible según los filtros activos (periodo/APS/etc.).
    const rowsToExport = selectedItemsAPS.size > 0
      ? filteredInventarioAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids)))
      : filteredInventarioAPS;

    const csvContent = [
      headers.join(','),
      ...rowsToExport.map(item =>
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
    const sufijo = selectedItemsAPS.size > 0 ? '_seleccion' : '';
    link.download = `inventario_aps_${campana?.nombre || 'campana'}${sufijo}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredInventarioAPS, selectedItemsAPS, campana?.nombre]);

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
      // Usar solo items seleccionados, o todos si no hay selección
      const itemsToPost = selectedItemsAPS.size > 0
        ? inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids)))
        : inventarioConAPS;

      // Fetch artículos SAP para obtener U_IMU_OcrCode (CostingCode) - usar BD de la campaña
      let articulosMap: Record<string, { U_IMU_OcrCode?: string; U_IMU_cod_sitio?: number; U_IMU_dscSitio?: string }> = {};
      const { getEndpoints } = await import('../../store/environmentStore');
      const sapDb = (campana.sap_database || 'CIMU') as import('../../store/environmentStore').SapDatabase;
      try {
        const artResponse = await fetch(getEndpoints(sapDb).articulos);
        const artData = await artResponse.json();
        const items = artData.value || artData || [];
        items.forEach((a: { ItemCode: string; U_IMU_OcrCode?: string; U_IMU_cod_sitio?: number; U_IMU_dscSitio?: string }) => {
          if (a.ItemCode) articulosMap[a.ItemCode] = { U_IMU_OcrCode: a.U_IMU_OcrCode, U_IMU_cod_sitio: a.U_IMU_cod_sitio, U_IMU_dscSitio: a.U_IMU_dscSitio };
        });
      } catch (err) {
        console.warn('Could not fetch articulos for CostingCode:', err);
      }

      // Resolver card_code desde SAP si la campaña no lo tiene
      let resolvedCampana = campana;
      if (!campana.card_code && campana.cuic) {
        try {
          const cuicResponse = await fetch(getEndpoints(sapDb).cuic);
          const cuicData = await cuicResponse.json();
          const cuicList: { CUIC?: number; ACA_U_SAPCode?: string }[] = cuicData.value || cuicData || [];
          const match = cuicList.find(c => String(c.CUIC) === String(campana.cuic));
          if (match?.ACA_U_SAPCode) {
            resolvedCampana = { ...campana, card_code: match.ACA_U_SAPCode };
            console.log(`Resolved card_code from SAP CUIC ${campana.cuic}: ${match.ACA_U_SAPCode}`);
          }
        } catch (err) {
          console.warn('Could not resolve card_code from SAP CUIC:', err);
        }
      }

      // Construir los payloads (uno por APS)
      let deliveryNotes = buildDeliveryNote(resolvedCampana, itemsToPost, campana.sap_database, articulosMap);

      // Si es migrada, resolver BaseEntry desde SAP para cada delivery note
      if (isMigratedCampaign(campana)) {
        const db = campana.sap_database || 'TRADE';
        console.log('Resolving BaseEntry from SAP... DB:', db, 'DocNum:', campana.id);
        const resolved = [];
        for (const dn of deliveryNotes) {
          const r = await resolveBaseEntry(dn as SAPDeliveryNoteMigrated, campana.id?.toString() || '', db);
          resolved.push(r);
        }
        deliveryNotes = resolved;
      }

      // POST cada delivery note a SAP (sin lookup previo — el GET por NumAtCard
      // a SAP tardaba ~90s porque NumAtCard no está indexado, y el lookup
      // saturaba SAP con 502s a otras requests). La idempotencia se manejará
      // a futuro guardando DocEntry en la BD QEB tras el POST exitoso.
      const results: import('../../services/campanas.service').SAPPostResponse[] = [];
      for (let i = 0; i < deliveryNotes.length; i++) {
        const dn = deliveryNotes[i];
        console.log(`========== DELIVERY NOTE ${i + 1}/${deliveryNotes.length} (APS: ${dn.U_IMU_CotNum}) ==========`);
        console.log('SAP Database:', campana.sap_database);
        console.log(JSON.stringify(dn, null, 2));
        console.log('==========================================');

        const result = await postDeliveryNoteToSAP(dn, campana.sap_database);
        results.push(result);
      }

      // Bitácora: guardar a QUIÉN se mandó cada APS con el snapshot del cliente
      // que tenía la campaña en este momento. Si luego le cambian el cliente
      // (ej. SABA -> Chevrolet para las siguientes catorcenas), este registro
      // conserva el destino real de lo ya posteado. Se guardan también los
      // intentos fallidos, para poder rastrear qué pasó.
      try {
        const logEntries = deliveryNotes.map((dn, idx) => {
          const r = results[idx];
          const apsNum = Number(dn.U_IMU_CotNum);
          // Circuitos (solicitudCaras) que abarcó este APS
          const carasIds = Array.from(new Set(
            itemsToPost
              .filter(i => String(i.aps) === String(dn.U_IMU_CotNum))
              .map(i => i.solicitud_caras_id)
              .filter((v): v is number => v != null)
          ));
          return {
            aps: apsNum,
            card_code: resolvedCampana.card_code ?? null,
            cuic: resolvedCampana.cuic ?? null,
            razon_social: resolvedCampana.T0_U_RazonSocial ?? resolvedCampana.cliente_razon_social ?? null,
            marca: resolvedCampana.T2_U_Marca ?? null,
            cliente_nombre: resolvedCampana.T0_U_Cliente ?? resolvedCampana.cliente_nombre ?? null,
            sap_database: campana.sap_database ?? null,
            salesperson_code: (dn as { SalesPersonCode?: number | string }).SalesPersonCode ?? null,
            solicitud_caras_ids: carasIds,
            success: !!r?.success,
            doc_entry: (r?.data?.DocEntry as number | undefined) ?? (r?.data?.BaseEntry as number | undefined) ?? null,
            doc_num: (r?.data?.DocNum as number | undefined) ?? null,
            error_msg: r?.success ? null : (r?.error ?? null),
            payload_json: JSON.stringify(dn),
          };
        }).filter(e => Number.isFinite(e.aps));

        if (logEntries.length > 0) {
          await campanasService.registrarPostLog(campana.id, logEntries);
          refetchPostLog();
        }
      } catch (e) {
        // No romper el flujo del POST por un fallo de bitácora.
        console.error('Error registrando bitácora de POST:', e);
      }

      const allSuccess = results.every(r => r.success);
      const failedCount = results.filter(r => !r.success).length;
      const successCount = deliveryNotes.length - failedCount;
      const firstError = results.find(r => !r.success);

      if (allSuccess) {
        setPostSAPResult({
          success: true,
          message: `${deliveryNotes.length} Delivery Note${deliveryNotes.length > 1 ? 's' : ''} creado${deliveryNotes.length > 1 ? 's' : ''} exitosamente en SAP`,
          data: results[results.length - 1].data,
        });
        // Guardar en DB los APS posteados y actualizar estado
        const apsPosteados = Array.from(new Set(itemsToPost.map(i => i.aps)));
        try {
          const updatedAPS = await campanasService.markPostedAPS(campana.id, apsPosteados);
          setPostedAPSGroups(new Set(updatedAPS));
        } catch (e) { console.error('Error marcando posted_aps:', e); }
      } else {
        // Si hubo al menos un éxito, marcar esos APS como posted (los que el
        // result devolvió DocNum o success=true) — evita perder estado y
        // reduce duplicados al reintentar.
        const partialSuccess = successCount > 0;
        if (partialSuccess) {
          const successfulAPS = results
            .map((r, idx) => r.success ? deliveryNotes[idx]?.U_IMU_CotNum : null)
            .filter(Boolean);
          const apsNums = Array.from(new Set(itemsToPost.map(i => i.aps).filter(a => successfulAPS.includes(String(a)))));
          if (apsNums.length > 0) {
            try {
              const updatedAPS = await campanasService.markPostedAPS(campana.id, apsNums);
              setPostedAPSGroups(new Set(updatedAPS));
            } catch (e) { console.error('Error marcando posted_aps parciales:', e); }
          }
        }
        setPostSAPResult({
          success: false,
          message: failedCount === deliveryNotes.length
            ? (firstError?.error || 'Error al crear Delivery Notes en SAP')
            : `${successCount} exitosos, ${failedCount} fallidos`,
          detail: {
            endpoint: firstError?.endpoint,
            status: firstError?.status,
            errorType: firstError?.errorType,
            rawResponse: firstError?.rawResponse,
            partialSuccess,
            successCount,
            failedCount,
          },
        });
      }
    } catch (error) {
      console.error('Error en handlePostToSAP:', error);
      setPostSAPResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error inesperado al conectar con SAP',
        detail: { errorType: 'network' },
      });
    } finally {
      setPostingToSAP(false);
    }
  }, [campana, inventarioConAPS, selectedItemsAPS]);

  // Handler para cancelar POST a SAP / Pre Factura. Si entre los APS
  // seleccionados hay alguno etiquetado Pre Factura, se llama también a
  // cancelPrefactura — que además regresa las reservas a Sin APS (decisión
  // del producto: para liberar Pre Factura, reasignar APS desde cero).
  const handleCancelPostSAP = useCallback(async () => {
    if (!campana) return;
    setCancellingPostSAP(true);
    setCancelPostSAPResult(null);
    try {
      const selectedAPS = selectedItemsAPS.size > 0
        ? inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids))).map(i => i.aps)
        : null;

      // Particionar selección entre POSTed (cancelar etiqueta SAP, deja APS) y
      // Pre Factura (cancelar etiqueta + regresar reservas a Sin APS).
      const apsPostedSel = selectedAPS
        ? Array.from(new Set(selectedAPS.filter(a => postedAPSGroups.has(a))))
        : null;
      const apsPrefacturaSel = selectedAPS
        ? Array.from(new Set(selectedAPS.filter(a => prefacturaAPSGroups.has(a))))
        : null;

      // Si no hay selección, mantener el comportamiento anterior: limpiar
      // todo posted_aps. No tocamos Pre Factura globalmente para no
      // sorprender — eso requiere selección explícita.
      const ranPosted = apsPostedSel ? apsPostedSel.length > 0 : true;
      const ranPrefactura = apsPrefacturaSel && apsPrefacturaSel.length > 0;

      if (ranPosted) {
        const updatedAPS = await campanasService.unmarkPostedAPS(campana.id, apsPostedSel || undefined);
        setPostedAPSGroups(new Set(updatedAPS));
        if (updatedAPS.length === 0) setAlreadyPosted(false);
      }
      if (ranPrefactura) {
        const updatedPF = await campanasService.cancelPrefactura(campana.id, apsPrefacturaSel!);
        setPrefacturaAPSGroups(new Set(updatedPF));
        // Las reservas quedan en Sin APS — refrescamos ambas vistas.
        queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
        queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
        queryClient.invalidateQueries({ queryKey: ['campana', campanaId] });
      }

      const msg = ranPosted && ranPrefactura
        ? 'POST y Pre Factura cancelados correctamente'
        : ranPrefactura
          ? 'Pre Factura cancelada — las reservas regresaron a Sin APS'
          : 'POST cancelado correctamente';
      setCancelPostSAPResult({ success: true, message: msg });
    } catch (error) {
      setCancelPostSAPResult({ success: false, message: error instanceof Error ? error.message : 'Error al cancelar POST' });
    } finally {
      setCancellingPostSAP(false);
    }
  }, [campana, campanaId, inventarioConAPS, selectedItemsAPS, postedAPSGroups, prefacturaAPSGroups, queryClient]);

  // Agrupar datos del inventario
  const groupedInventario = useMemo(() => {
    if (activeGroupings.length === 0) {
      return { ungrouped: filteredInventarioReservado };
    }

    const grouped: Record<string, InventarioReservado[] | Record<string, InventarioReservado[]>> = {};

    filteredInventarioReservado.forEach(item => {
      const firstKey = getGroupValue(item, activeGroupings[0], tipoPeriodo);

      if (activeGroupings.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioReservado[]).push(item);
      } else {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupings[1], tipoPeriodo);
        if (!(grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey]) {
          (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey] = [];
        }
        (grouped[firstKey] as Record<string, InventarioReservado[]>)[secondKey].push(item);
      }
    });

    return grouped;
  }, [filteredInventarioReservado, activeGroupings]);

  // Detectar si un item de inventario es cortesía (solicitudCaras.cortesia = 1)
  const isCortesiaItem = (item: { cortesia?: number | null }) => item.cortesia === 1;

  // Todos los items seleccionados en Sin APS son cortesías
  const selectedAreCortesias = useMemo(() => {
    if (selectedItems.size === 0) return false;
    const selected = inventarioReservado.filter(i => selectedItems.has(i.rsv_ids));
    return selected.length > 0 && selected.every(i => isCortesiaItem(i));
  }, [selectedItems, inventarioReservado]);

  // Algún item seleccionado es cortesía (mezcla)
  const selectedHasCortesias = useMemo(() => {
    if (selectedItems.size === 0) return false;
    return inventarioReservado
      .filter(i => selectedItems.has(i.rsv_ids))
      .some(i => isCortesiaItem(i));
  }, [selectedItems, inventarioReservado]);

  // Toda la campaña es de cortesía: todos los items (con o sin APS) tienen cortesia=1
  const isCampanaCortesia = useMemo(() => {
    const allItems = [...inventarioReservado, ...inventarioConAPS];
    return allItems.length > 0 && allItems.every(i => isCortesiaItem(i));
  }, [inventarioReservado, inventarioConAPS]);

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

  // Toggle selección de item — useCallback con set-form para mantener referencia
  // estable y permitir que MapMarker (React.memo) haga bail-out.
  const toggleItemSelection = useCallback((rsvId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  }, []);

  // Click handler para markers del mapa de inventario reservado.
  // Toggle + scroll a la fila correspondiente en la tabla.
  const handleMarkerClickReservado = useCallback((rsvId: string) => {
    toggleItemSelection(rsvId);
    const row = document.getElementById(`row-${rsvId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [toggleItemSelection]);

  // Seleccionar/deseleccionar todos (excluye items de grupos incompletos o con exceso)
  const selectableItems = useMemo(() => {
    return filteredInventarioReservado.filter(i => !isItemFromIncompleteGroup(i) && !isItemFromExcessGroup(i));
  }, [filteredInventarioReservado, groupCompletenessMap]);

  const toggleSelectAll = () => {
    if (selectedItems.size === selectableItems.length && selectableItems.length > 0) {
      setSelectedItems(new Set<string>());
    } else {
      setSelectedItems(new Set<string>(selectableItems.map(i => i.rsv_ids)));
    }
  };

  // Seleccionar/deseleccionar un grupo completo (excluye items de grupos incompletos o con exceso)
  const toggleGroupSelection = (groupItems: InventarioReservado[]) => {
    const selectable = groupItems.filter(i => !isItemFromIncompleteGroup(i) && !isItemFromExcessGroup(i));
    setSelectedItems(prev => {
      const next = new Set(prev);
      const groupIds = selectable.map(i => i.rsv_ids);
      const allSelected = groupIds.length > 0 && groupIds.every(id => next.has(id));
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
    return TABLE_COLUMNS_APS.filter(col => !activeGroupingsAPS.includes(col.field as GroupByField));
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

  // Toggle selección de item (con APS) — referencia estable para MapMarker memo.
  const toggleItemSelectionAPS = useCallback((rsvId: string) => {
    setSelectedItemsAPS(prev => {
      const next = new Set(prev);
      if (next.has(rsvId)) {
        next.delete(rsvId);
      } else {
        next.add(rsvId);
      }
      return next;
    });
  }, []);

  // Click handler para markers del mapa con APS.
  const handleMarkerClickAPS = useCallback((rsvId: string) => {
    toggleItemSelectionAPS(rsvId);
    const row = document.getElementById(`row-aps-${rsvId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [toggleItemSelectionAPS]);

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
      const firstKey = getGroupValue(item, activeGroupingsAPS[0], tipoPeriodo);

      if (activeGroupingsAPS.length === 1) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = [];
        }
        (grouped[firstKey] as InventarioConAPS[]).push(item);
      } else if (activeGroupingsAPS.length === 2) {
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupingsAPS[1], tipoPeriodo);
        if (!(grouped[firstKey] as GroupedLevel2)[secondKey]) {
          (grouped[firstKey] as GroupedLevel2)[secondKey] = [];
        }
        ((grouped[firstKey] as GroupedLevel2)[secondKey] as InventarioConAPS[]).push(item);
      } else {
        // 3 niveles de agrupación
        if (!grouped[firstKey]) {
          grouped[firstKey] = {};
        }
        const secondKey = getGroupValue(item, activeGroupingsAPS[1], tipoPeriodo);
        if (!(grouped[firstKey] as GroupedLevel2)[secondKey]) {
          (grouped[firstKey] as GroupedLevel2)[secondKey] = {};
        }
        const thirdKey = getGroupValue(item, activeGroupingsAPS[2], tipoPeriodo);
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
    mutationFn: (params: { inventarioIds: number[]; solicitudCarasIds: number[]; rsvIds: number[] }) =>
      campanasService.assignAPS(campanaId, params.inventarioIds, params.solicitudCarasIds, params.rsvIds),
    onSuccess: (data) => {
      // Limpiar selección y refrescar datos
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      alert(`${data.message}`);
    },
    onError: (error: Error) => {
      alert(`Error al asignar APS: ${error.message}`);
    },
  });

  // Mismo flujo que assignAPSMutation pero el back lo marca como Pre Factura
  // (queda en campania.prefactura_aps → bloquea POST a SAP en la vista Con APS).
  const assignAPSPrefacturaMutation = useMutation({
    mutationFn: (params: { inventarioIds: number[]; solicitudCarasIds: number[]; rsvIds: number[] }) =>
      campanasService.assignAPSPrefactura(campanaId, params.inventarioIds, params.solicitudCarasIds, params.rsvIds),
    onSuccess: (data) => {
      setSelectedItems(new Set());
      setPrefacturaAPSGroups(prev => new Set([...prev, data.aps]));
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      alert(`APS Pre Factura #${data.aps} asignado correctamente`);
    },
    onError: (error: Error) => {
      alert(`Error al asignar APS Pre Factura: ${error.message}`);
    },
  });

  // Reúne los IDs (inventarioIds + solicitudCarasIds + rsvIds) desde la
  // selección actual y valida que ningún grupo esté incompleto/excedido.
  // Devuelve null si hay error (ya alertó al usuario).
  const buildAPSPayloadFromSelection = (): { inventarioIds: number[]; solicitudCarasIds: number[]; rsvIds: number[] } | null => {
    const selectedReservado = inventarioReservado.filter(item => selectedItems.has(item.rsv_ids));

    // La completitud se lee de groupCompletenessMap, que cuenta las caras de
    // AMBAS tablas (sin APS + con APS). Antes se recontaba aquí sobre
    // inventarioReservado (sólo sin APS), así que un circuito repartido en
    // varios APS se veía completo en la tabla pero al asignar el resto saltaba
    // "incompleto (2/5)" y las caras quedaban atrapadas en Sin APS.
    const selectedCaraIds = new Set(selectedReservado.map(item => item.solicitud_caras_id).filter(Boolean));
    for (const caraId of selectedCaraIds) {
      const info = groupCompletenessMap.get(caraId as number);
      if (!info) continue;
      const cara = solicitudCaras.find((c: any) => c.id === caraId);
      const label = `${cara?.articulo || ''} - ${cara?.ciudad || ''}`;
      if (!info.completo) {
        alert(`No se puede asignar APS: el grupo "${label}" está incompleto (${info.reservadas}/${info.esperadas} caras asignadas)`);
        return null;
      }
      if (info.exceso) {
        alert(`No se puede asignar APS: el grupo "${label}" tiene exceso de caras (${info.reservadas}/${info.esperadas})`);
        return null;
      }
    }
    const normalItems = selectedReservado.filter(item => !String(item.rsv_ids).startsWith('sc_'));
    const imItems = selectedReservado.filter(item => String(item.rsv_ids).startsWith('sc_'));

    const inventarioIds = normalItems.map(item => item.id);
    const solicitudCarasIds = imItems.map(item => item.solicitud_caras_id).filter((id): id is number => id !== null);
    const rsvIds = normalItems.flatMap(item =>
      String(item.rsv_ids).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    );

    if (inventarioIds.length === 0 && solicitudCarasIds.length === 0) return null;
    return { inventarioIds, solicitudCarasIds, rsvIds };
  };

  const handleAssignAPS = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un elemento para asignar APS');
      return;
    }
    const payload = buildAPSPayloadFromSelection();
    if (payload) assignAPSMutation.mutate(payload);
  };

  const handleAssignAPSPrefactura = () => {
    if (selectedItems.size === 0) {
      alert('Selecciona al menos un elemento para asignar APS Pre Factura');
      return;
    }
    if (!confirm('Se asignará un APS etiquetado como Pre Factura.\n\nEste APS NO se podrá enviar a SAP (POST deshabilitado). Para liberarlo después se usa el botón Cancelar POST, que devolverá las reservas a Sin APS para reasignarles un APS real.\n\n¿Continuar?')) return;
    const payload = buildAPSPayloadFromSelection();
    if (payload) assignAPSPrefacturaMutation.mutate(payload);
  };

  // Cortesías (CT): ir directo al gestor de artes sin APS
  const handleEnviarCortesiaAGestor = () => {
    withTransitionOverlay('Abriendo gestor de artes...', () => navigate(`/campanas/${campanaId}/tareas`));
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
      // rsv_ids puede ser una lista "a,b,c" (grupos) o "sc_<caraId>" (IM). Hay que
      // separarlos igual que al ASIGNAR (buildAPSPayloadFromSelection): normales por
      // rsv id (todas las del grupo, no solo la 1ª), IM por solicitud_caras_id.
      // Antes se hacía parseInt(id) → grupos perdían todas menos la 1ª y los IM daban
      // NaN → el back no limpiaba nada y quedaban en "Con APS" (ticket 80531/APS 80969).
      const selected = inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids)));
      const reservaIds = selected
        .filter(i => !String(i.rsv_ids).startsWith('sc_'))
        .flatMap(i => String(i.rsv_ids).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
      const solicitudCarasIds = selected
        .filter(i => String(i.rsv_ids).startsWith('sc_'))
        .map(i => i.solicitud_caras_id)
        .filter((id): id is number => id != null);
      const totalSel = selected.length;

      await campanasService.removeAPS(campanaId, reservaIds, solicitudCarasIds);

      // Refrescar las tablas
      queryClient.invalidateQueries({ queryKey: ['campana-inventario', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-aps', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });

      // Limpiar selección
      setSelectedItemsAPS(new Set());

      alert(`APS eliminado de ${totalSel} inventario(s)`);
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
            className={`flex items-center gap-2 text-purple-400 hover:${isDark ? 'text-purple-300' : 'text-purple-700'} transition-colors mb-6`}
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

  const heavyOperation =
    quitandoAPS
      ? 'Quitando APS...'
      : assignAPSMutation.isPending
      ? 'Asignando APS...'
      : postingToSAP
      ? 'Enviando a SAP...'
      : addCommentMutation.isPending
      ? 'Guardando comentario...'
      : enviandoCodigo
      ? 'Enviando código...'
      : transitionOverlay
      ? transitionOverlay
      : null;

  return (
    <div className="min-h-screen">
      <Header title="Detalle de Campana" />
      {apsBlockToast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl border max-w-lg ${isDark ? 'bg-zinc-900 border-yellow-500/30 text-white' : 'bg-white border-yellow-300 text-gray-900'}`}>
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>No se puede asignar APS</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{apsBlockToast.message}</p>
            </div>
            <button onClick={() => setApsBlockToast({ show: false, message: '' })} className="text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {heavyOperation && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[60] flex items-center justify-center" role="status" aria-live="polite">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900'}`}>
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            <span className="text-sm font-medium">{heavyOperation}</span>
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Por favor no cierres ni navegues</span>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4 md:p-6 space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => withTransitionOverlay('Cargando campañas...', () => navigate('/campanas'))}
            className={`flex items-center gap-1.5 sm:gap-2 text-purple-400 hover:${isDark ? 'text-purple-300' : 'text-purple-700'} transition-colors`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Volver</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            {permissions.canEditCampanas && (() => {
              const statusLower = campana.status?.toLowerCase() || '';
              const disabledStatuses = ['finalizado', 'sin cotizacion activa', 'cancelada', 'rechazada'];
              const editDisabled = disabledStatuses.includes(statusLower) || campana.has_aps === true;
              return (
                <button
                  onClick={() => withTransitionOverlay('Abriendo editor de campaña...', () => setEditModalOpen(true))}
                  disabled={editDisabled}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all ${
                    editDisabled
                      ? isDark ? 'bg-zinc-800/30 text-zinc-600 border-zinc-700/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : isDark ? 'bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 border-zinc-500/20' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'
                  }`}
                  title={editDisabled ? 'No editable' : 'Editar campaña'}
                >
                  <Edit2 className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  <span className="text-xs sm:text-sm">Editar campaña</span>
                </button>
              );
            })()}
            <button
              onClick={() => withTransitionOverlay('Abriendo comentarios...', () => setShowComments(true))}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg ${isDark ? 'bg-purple-900/30 hover:bg-purple-900/50' : 'bg-purple-100 hover:bg-purple-200'} transition-colors`}
              title="Comentarios"
            >
              <MessageSquare className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-purple-400" />
              <span className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{comentarios.length}</span>
            </button>
            <Badge variant={statusVariants[campana.status] || 'secondary'} className="text-xs sm:text-sm">
              {campana.status}
            </Badge>
            {campana.incompleteness_detail && campana.incompleteness_detail.length > 0 && (() => {
              const totalEsperadas = campana.incompleteness_detail.reduce((sum: number, d: any) => sum + d.caras_esperadas, 0);
              const totalReservas = campana.incompleteness_detail.reduce((sum: number, d: any) => sum + d.reservas_count, 0);
              const isIncomplete = totalReservas < totalEsperadas;
              if (!isIncomplete) return null;
              return (
              <div className="relative">
                <button
                  onClick={() => setShowIncompleteDetail(!showIncompleteDetail)}
                  className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs border cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
                >
                  Incompleta ({totalReservas}/{totalEsperadas} caras) {showIncompleteDetail ? '▲' : '▼'}
                </button>
                {showIncompleteDetail && campana.incompleteness_detail && campana.incompleteness_detail.length > 0 && (
                  <div className={`absolute top-full right-0 mt-2 z-50 rounded-lg border shadow-xl p-3 min-w-[220px] ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Desglose por catorcena:</p>
                    <div className="space-y-1.5">
                      {campana.incompleteness_detail.map((d: any) => (
                        <div key={`${d.anio}-${d.catorcena}`} className="flex items-center justify-between gap-4">
                          <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                            Cat {String(d.catorcena).padStart(2, '0')}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            d.completa
                              ? (isDark ? 'text-green-300 bg-green-500/20 border border-green-500/30' : 'text-green-700 bg-green-50 border border-green-200')
                              : (isDark ? 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30' : 'text-yellow-700 bg-yellow-50 border border-yellow-200')
                          }`}>
                            {d.reservas_count}/{d.caras_esperadas} {d.completa ? '✓' : `— faltan ${d.caras_esperadas - d.reservas_count}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
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
            <h3 className={`text-xs md:text-sm font-semibold mb-2 md:mb-3 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>Campaña</h3>
            <div className="space-y-0">
              <InfoItem label="Plaza" value={[...new Set([...inventarioReservado, ...inventarioConAPS].map(i => i.plaza).filter(Boolean))].join(', ') || (campana as any).plazas || null} type="category" isDark={isDark} />
              {campana.fecha_inicio && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Inicio</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                    {getCatorcenaDisplay(campana.fecha_inicio, catorcenas, tipoPeriodo)}
                  </span>
                </div>
              )}
              {campana.fecha_fin && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Fin</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                    {getCatorcenaDisplay(campana.fecha_fin, catorcenas, tipoPeriodo)}
                  </span>
                </div>
              )}
              <InfoItem label="Total Caras" value={campana.total_caras} type="default" isDark={isDark} />
              <InfoItem label="Caras Renta" value={solicitudCaras.reduce((s, c) => s + (c.caras ?? 0), 0) || null} type="default" isDark={isDark} />
              {/*<InfoItem label="Frontal" value={campana.frontal} type="default" isDark={isDark} />*/}
              {/*<InfoItem label="Cruzada" value={campana.cruzada} type="default" isDark={isDark} />*/}
              {/*<InfoItem label="NSE" value={campana.nivel_socioeconomico ? [...new Set(campana.nivel_socioeconomico.split(",").map(s => s.trim()))].join(", ") : null} type="category" isDark={isDark} />*/}
              <InfoItem label="Bonificacion" value={campana.bonificacion} type="default" isDark={isDark} />
              <InfoItem label="Descuento" value={campana.descuento ? `${campana.descuento}%` : null} type="percent" isDark={isDark} />
              <InfoItem label="Inversion" value={(() => {
                const getTarifa = (i: InventarioReservado) => Number(i.tarifa_bruta_sc) || Number(i.tarifa_publica_sc) || Number(i.tarifa_publica) || 0;
                const total = [...inventarioReservado, ...inventarioConAPS].reduce((s, i) => s + getTarifa(i) * (Number(i.caras_totales) || 0), 0);
                return total || (typeof campana.inversion === "string" ? parseFloat(campana.inversion) : campana.inversion);
              })()} type="amount" isDark={isDark} />
              {/*<InfoItem label="Precio" value={typeof campana.precio === "string" ? parseFloat(campana.precio) : campana.precio} type="amount" /> */}
            </div>
          </div>

          {/* Columna 2: Cliente */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4">
            <h3 className={`text-xs md:text-sm font-semibold mb-2 md:mb-3 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>Cliente</h3>
            <div className="space-y-0">
              <InfoItem label="Cliente" value={campana.T0_U_Cliente} type="user" />
              {campana.sap_database && (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>SAP BD:</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    campana.sap_database === 'CIMU' ? (isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200') :
                    campana.sap_database === 'TEST' ? (isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200') :
                    campana.sap_database === 'TRADE' ? (isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200') :
                    (isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-100 text-gray-700 border-gray-200')
                  }`}>{campana.sap_database}</span>
                </div>
              )}
              <InfoItem label="Razon Social" value={campana.T0_U_RazonSocial} type="default" />
              <InfoItem label="CUIC" value={campana.cuic} type="id" />
              <InfoItem label="Agencia" value={campana.T0_U_Agencia} type="category" />
              <InfoItem label="Asesor" value={campana.T0_U_Asesor} type="user" />
              <InfoItem label="Marca" value={campana.T2_U_Marca} type="category" />
              <InfoItem label="Producto" value={campana.T2_U_Producto} type="category" />
              <InfoItem label="Categoria" value={campana.T2_U_Categoria} type="category" />
            </div>
          </div>

          {/* Columna 3: Asignacion y Notas - span full width on md */}
          <div className="bg-card rounded-xl border border-border p-3 md:p-4 md:col-span-2 xl:col-span-1">
            <h3 className={`text-xs md:text-sm font-semibold mb-2 md:mb-3 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>Asignacion</h3>
            <div className="space-y-0">
              <InfoItem label="Asignado" value={campana.asignado} type="user" />
              <InfoItem label="Contacto" value={(campana as any).creador_nombre || campana.contacto} type="user" />
              <InfoItem label="APS Global" value={campana.id ? `#${campana.id}` : null} type="id" />
              <InfoItem label="Actualizado" value={campana.updated_at} type="date" />
            </div>

            {(campana.descripcion || campana.observaciones) && (
              <>
                <h3 className={`text-sm font-semibold mb-2 mt-4 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>Descripción Tráfico</h3>
                {campana.descripcion && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.descripcion}</p>
                )}
                {campana.observaciones && (
                  <p className="text-sm text-muted-foreground mb-2">{campana.observaciones}</p>
                )}
              </>
            )}
            {campana.notas && (
              <>
                <h3 className={`text-sm font-semibold mb-2 mt-4 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>Notas Dirección</h3>
                <p className="text-sm text-muted-foreground">{campana.notas}</p>
              </>
            )}
          </div>
        </div>

        {/* Historial de Acciones */}
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <h3 className={`text-xs md:text-sm font-semibold mb-3 ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide flex items-center gap-2`}>
            <History className="h-4 w-4" />
            Historial de Acciones
          </h3>
          {isLoadingHistorial ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            </div>
          ) : historial.length === 0 ? (
            <div className={`text-center py-6 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              No hay acciones registradas
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-purple">
              {historial.map((item) => {
                const fechaObj = item.fecha_hora ? new Date(item.fecha_hora) : null;
                const fecha = fechaObj ? fechaObj.toLocaleDateString('es-MX') : '';
                const hora = fechaObj ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                const isAuthEntry = item.tipo?.startsWith('autorizacion_') || item.tipo?.startsWith('Autorizacion_');
                let parsedDetalles: any = null;
                if (isAuthEntry && item.detalles) {
                  try { parsedDetalles = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles; } catch { /* ignore */ }
                }
                const isRechazo = item.tipo?.includes('rechazo');
                const isAprobacion = item.tipo?.includes('aprobacion');
                const isCambio = item.tipo?.includes('cambio');
                const isNuevaCara = item.tipo?.includes('nueva_cara');
                const dotColor = isAprobacion ? 'bg-emerald-400' : isRechazo ? 'bg-red-400' : isCambio ? 'bg-blue-400' : isNuevaCara ? 'bg-cyan-400' : 'bg-purple-400';
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'} border ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}
                  >
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                        {item.accion}
                      </span>
                      {isAuthEntry && parsedDetalles ? (
                        <div className="mt-0.5">
                          {isRechazo && parsedDetalles.motivo && (
                            <p className={`text-xs ${isDark ? 'text-red-400/70' : 'text-red-600/70'}`}>Motivo: {parsedDetalles.motivo}</p>
                          )}
                          {isCambio && parsedDetalles.cambios && (
                            <div className="space-y-0.5">
                              {(parsedDetalles.cambios as { articulo: string; label: string; antes: string; despues: string }[]).map((c: { articulo: string; label: string; antes: string; despues: string }, i: number) => (
                                <p key={i} className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{c.articulo}</span>
                                  {' · '}{c.label}: <span className="line-through text-red-400/60">{c.antes}</span> → <span className="text-emerald-400">{c.despues}</span>
                                </p>
                              ))}
                            </div>
                          )}
                          {isNuevaCara && parsedDetalles.cara && (
                            <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                              {parsedDetalles.cara.articulo} — {parsedDetalles.cara.caras} caras, ${Number(parsedDetalles.cara.costo).toLocaleString()}
                            </p>
                          )}
                          {!isCambio && !isRechazo && !isNuevaCara && !isAprobacion && parsedDetalles.caras && (
                            <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                              {parsedDetalles.caras.length} circuito(s){parsedDetalles.pendientesDg ? ` — Pend. DG: ${parsedDetalles.pendientesDg}` : ''}
                            </p>
                          )}
                        </div>
                      ) : item.detalles && !isAuthEntry ? (() => {
                        const txt = formatHistorialDetalles(item.detalles);
                        return txt ? (
                          <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} title={txt}>
                            {txt}
                          </p>
                        ) : null;
                      })() : null}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs block ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{fecha}</span>
                      <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-500'}`}>{hora}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista de inventario reservado */}
        {campana?.status === 'Rechazada' ? (
          <div className="bg-card rounded-xl border border-border p-4 md:p-6 text-center">
            <span className={`text-xs md:text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Campaña rechazada — el inventario fue liberado y los grupos/circuitos eliminados.
            </span>
          </div>
        ) : (
        <div className="bg-card rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 border-b border-border">
            <h3 className={`text-xs md:text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>
              Lista Inventarios Sin APS
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {isCampanaCortesia && (
                <span className="px-2 py-1 text-[10px] sm:text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg">
                  Cortesía
                </span>
              )}
              {permissions.canEditDetalleCampana && (
                <button
                  onClick={handleAssignAPS}
                  disabled={selectedItems.size === 0 || assignAPSMutation.isPending || selectedHasIncompleteOrExcess}
                  title={selectedHasIncompleteOrExcess ? 'Hay grupos incompletos o con exceso de caras — ajusta el inventario antes de asignar APS' : selectedAreCortesias ? 'Las cortesías pueden tener APS opcional' : undefined}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    selectedItems.size === 0 || selectedHasIncompleteOrExcess
                      ? isDark ? 'bg-purple-900/30 text-purple-400/50 cursor-not-allowed' : 'bg-purple-100 text-purple-300 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {assignAPSMutation.isPending ? <Loader2 className="h-3 sm:h-3.5 w-3 sm:w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
                  <span className="hidden sm:inline">{assignAPSMutation.isPending ? 'Asignando...' : `APS${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                  <span className="sm:hidden">{assignAPSMutation.isPending ? '...' : `APS${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                </button>
              )}
              {/* APS Pre Factura — mismo permiso que Asignar APS. Crea el APS
                  pero lo etiqueta de modo que NO se puede mandar a SAP. */}
              {permissions.canEditDetalleCampana && (
                <button
                  onClick={handleAssignAPSPrefactura}
                  disabled={selectedItems.size === 0 || assignAPSPrefacturaMutation.isPending || selectedHasIncompleteOrExcess}
                  title={selectedHasIncompleteOrExcess ? 'Hay grupos incompletos o con exceso de caras — ajusta el inventario antes de asignar Pre Factura' : 'Asigna APS y lo etiqueta como Pre Factura (no se puede mandar a SAP hasta cancelar la etiqueta)'}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    selectedItems.size === 0 || selectedHasIncompleteOrExcess
                      ? isDark ? 'bg-amber-900/30 text-amber-400/50 cursor-not-allowed' : 'bg-amber-100 text-amber-300 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {assignAPSPrefacturaMutation.isPending ? <Loader2 className="h-3 sm:h-3.5 w-3 sm:w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
                  <span className="hidden sm:inline">{assignAPSPrefacturaMutation.isPending ? 'Asignando...' : `Pre Factura${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                  <span className="sm:hidden">{assignAPSPrefacturaMutation.isPending ? '...' : `PF${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}</span>
                </button>
              )}
              {/* Cortesías (CT): bypass APS → gestor de artes (visible si algún item seleccionado es cortesía) */}
              {permissions.canEditDetalleCampana && selectedHasCortesias && (
                <button
                  onClick={handleEnviarCortesiaAGestor}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                  title="Las cortesías no requieren APS, se envían directo al gestor de artes"
                >
                  <ListTodo className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden sm:inline">Enviar a Gestor de Artes</span>
                  <span className="sm:hidden">Gestor</span>
                </button>
              )}
              {permissions.canSeeGestionArtes && (
                <button
                  onClick={() => withTransitionOverlay('Abriendo gestor de tareas...', () => navigate(`/campanas/${campanaId}/tareas`))}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium ${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border-purple-300'} border rounded-lg transition-colors`}
                >
                  <ListTodo className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden md:inline">Gestor de Tareas</span>
                  <span className="md:hidden">Tareas</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 md:gap-4 p-3 md:p-4">
            {/* Columna izquierda: Mapa */}
            <div className={`h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-lg overflow-hidden border border-border relative ${isDark ? 'map-dark-controls' : ''}`}>
              {!isLoaded || isLoadingInventario ? (
                <MapSkeleton />
              ) : errorInventario ? (
                <MapErrorState onRetry={() => refetchInventario()} />
              ) : inventarioReservado.filter(i => i.latitud && i.longitud).length === 0 ? (
                <MapEmptyState />
              ) : (
                <>
                  <GoogleMap
                    mapContainerClassName="w-full h-full"
                    center={mapCenter}
                    zoom={12}
                    onLoad={onMapLoad}
                    options={mapOptions}
                  >
                    {iconReservadoSelected && iconReservadoUnselected && inventarioReservado
                      .filter(item => selectedItems.has(item.rsv_ids))
                      .map((item) => {
                        if (!item.latitud || !item.longitud) return null;
                        return (
                          <MapMarker
                            key={item.rsv_ids}
                            rsvId={item.rsv_ids}
                            lat={item.latitud}
                            lng={item.longitud}
                            title={item.codigo_unico}
                            isSelected={true}
                            iconSelected={iconReservadoSelected}
                            iconUnselected={iconReservadoUnselected}
                            onClick={handleMarkerClickReservado}
                          />
                        );
                      })}
                  </GoogleMap>
                  {selectedItems.size === 0 && (
                    <div className={`absolute top-3 left-3 z-10 ${isDark ? 'bg-zinc-900/95 border-purple-500/40 text-purple-300' : 'bg-white/95 border-purple-300 text-purple-700'} border rounded-lg px-3 py-2 text-[11px] max-w-[240px] shadow-lg pointer-events-none`}>
                      Selecciona items desde la lista para verlos en el mapa.
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Columna derecha: Tabla */}
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] flex flex-col">
              {/* Header con botón de agrupación */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {selectedItems.size > 0 && (
                    <span className={`text-[10px] sm:text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
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
                          : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
                      }`}
                      title="Filtrar"
                    >
                      <Filter className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                      {filtersReservado.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">
                          {filtersReservado.length}
                        </span>
                      )}
                    </button>
                    {showFiltersReservado && (
                      <div className={`absolute right-0 top-full mt-1 z-50 w-[520px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Filtros de búsqueda</span>
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
                                <span className="text-[10px] text-purple-400 font-medium w-8">{filtersReservado[index - 1].field === filter.field ? 'OR' : 'AND'}</span>
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
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  placeholder="Valor..."
                                  value={filterDraftReservado[filter.id] ?? filter.value}
                                  onChange={(e) => setFilterDraftReservado(prev => ({ ...prev, [filter.id]: e.target.value }))}
                                  onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    setFilterDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
                                    setOpenFilterInputReservado(filter.id);
                                    setFilterDraftReservado(prev => ({ ...prev, [filter.id]: filter.value }));
                                  }}
                                  onBlur={() => setTimeout(() => {
                                    setFilterDraftReservado(prev => {
                                      const draftValue = prev[filter.id];
                                      if (draftValue !== undefined && draftValue !== filter.value) {
                                        updateFilterReservado(filter.id, { value: draftValue });
                                      }
                                      const next = { ...prev };
                                      delete next[filter.id];
                                      return next;
                                    });
                                    setOpenFilterInputReservado(null);
                                    setFilterDropdownRect(null);
                                  }, 200)}
                                  className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
                                />
                                {openFilterInputReservado === filter.id && filterDropdownRect && (
                                  <div
                                    className={`fixed z-[9999] border rounded ${isDark ? 'bg-[#2a1540] border-purple-900/50' : 'bg-white border-purple-200'} shadow-xl max-h-[200px] overflow-y-auto`}
                                    style={{ top: filterDropdownRect.top + 4, left: filterDropdownRect.left, width: filterDropdownRect.width }}
                                  >
                                    {(() => {
                                      const draft = filterDraftReservado[filter.id] ?? filter.value;
                                      const opts = getUniqueValuesReservado(filter.field).filter(val => val.toLowerCase().includes(draft.toLowerCase()));
                                      return (
                                        <>
                                          {opts.map((val) => (
                                            <div
                                              key={val}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                updateFilterReservado(filter.id, { value: val });
                                                setFilterDraftReservado(prev => {
                                                  const next = { ...prev };
                                                  delete next[filter.id];
                                                  return next;
                                                });
                                                setOpenFilterInputReservado(null);
                                                setFilterDropdownRect(null);
                                              }}
                                              className={`px-2 py-1.5 text-xs cursor-pointer ${isDark ? 'hover:bg-purple-900/50' : 'hover:bg-purple-50'}`}
                                            >
                                              {val}
                                            </div>
                                          ))}
                                          {opts.length === 0 && (
                                            <div className={`px-2 py-1.5 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                              Sin coincidencias
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
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
                        <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border-purple-300'} border rounded-lg transition-colors`}
                      title="Agrupar"
                    >
                      <Layers className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                      {activeGroupings.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                          {activeGroupings.length}
                        </span>
                      )}
                    </button>
                    {/* Dropdown de configuración */}
                    {showGroupingConfig && (
                      <div className={`absolute right-0 top-full mt-1 z-10 ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-2 min-w-[180px]`}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                          Agrupar por (max 2)
                        </p>
                        {AVAILABLE_GROUPINGS.map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => toggleGrouping(field)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-100'} transition-colors ${
                              activeGroupings.includes(field) ? 'text-purple-300' : isDark ? 'text-zinc-400' : 'text-gray-500'
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
                        <div className={`border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'} mt-2 pt-2`}>
                          <button
                            onClick={() => setActiveGroupings([])}
                            className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-700'} py-1`}
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
                          : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
                      }`}
                      title="Ordenar"
                    >
                      <ArrowUpDown className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                    </button>
                    {showSortReservado && (
                      <div className={`absolute right-0 top-full mt-1 z-50 w-[280px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-3`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Ordenar por</span>
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
                                  : isDark ? 'text-zinc-300 hover:bg-purple-900/30' : 'text-gray-700 hover:bg-purple-100'
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
                          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                ) : inventarioReservado.length === 0 && gruposSinInventario.length === 0 ? (
                  <EmptyState
                    icon={<Package className="h-6 w-6 text-purple-400" />}
                    title="Todos los Inventarios tienen APS "
                    description="Esta campaña no tiene inventarios sin APS"
                  />
                ) : inventarioReservado.length === 0 && gruposSinInventario.length > 0 ? (
                  <div className="space-y-2 p-2">
                    {(() => {
                      const fmtScPeriodo = (ip: string | null): string => {
                        if (!ip) return 'Sin Período';
                        if (tipoPeriodo === 'mensual') {
                          const parts = ip.split('T')[0].split('-');
                          if (parts.length >= 2) return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
                        }
                        const fecha = new Date(ip);
                        return `Cat ${calcularCatorcena(fecha)} / ${fecha.getFullYear()}`;
                      };
                      const byPeriodo = gruposSinInventario.reduce((acc, sc) => {
                        const key = fmtScPeriodo(sc.inicio_periodo);
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(sc);
                        return acc;
                      }, {} as Record<string, SolicitudCara[]>);
                      return Object.entries(byPeriodo).map(([periodo, scItems]) => {
                        const periodKey = `noinv_period_${periodo}`;
                        const isPeriodExpanded = expandedGroups.has(periodKey);
                        const totalEsperadas = scItems.reduce((s, sc) => s + (groupCompletenessMap.get(sc.id)?.esperadas || 0), 0);
                        const totalInversion = scItems.reduce((s, sc) => {
                          const esp = groupCompletenessMap.get(sc.id)?.esperadas || 0;
                          return s + (Number(sc.tarifa_publica) || 0) * esp;
                        }, 0);
                        return (
                          <div key={periodKey} className={`border ${isDark ? 'border-purple-900/30' : 'border-purple-200'} rounded-lg overflow-hidden`}>
                            <div
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}
                              onClick={() => toggleGroup(periodKey)}
                            >
                              <div className="w-4 h-4 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                              {isPeriodExpanded ? <ChevronDown className="h-4 w-4 text-purple-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-purple-400 shrink-0" />}
                              <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Inicio Periodo:</span>
                              <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{periodo}</span>
                              <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalEsperadas}</span></span>
                                <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(totalInversion)}</span></span>
                              </div>
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{scItems.length} items</span>
                            </div>
                            {isPeriodExpanded && (
                              <div className="px-2 py-1 space-y-1">
                                {(() => {
                                  const plazas = [...new Set(scItems.map(sc => sc.ciudad).filter(Boolean))] as string[];
                                  const formatos = [...new Set(scItems.map(sc => sc.formato).filter(Boolean))] as string[];
                                  if (!plazas.length && !formatos.length) return null;
                                  return (
                                    <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 mb-1 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                      {plazas.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                          {plazas.slice(0, 3).map(p => <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{p}</span>)}
                                          {plazas.length > 3 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{plazas.length - 3}</span>}
                                        </div>
                                      )}
                                      {formatos.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                          {formatos.slice(0, 3).map(f => <span key={f} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{f}</span>)}
                                          {formatos.length > 3 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{formatos.length - 3}</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                                {scItems.map(sc => {
                                  const noInvInfo = groupCompletenessMap.get(sc.id);
                                  const sinInvKey = `noinv_${sc.id}`;
                                  const isSinInvExpanded = expandedGroups.has(sinInvKey);
                                  const tarifaNum = Number(sc.tarifa_publica) || 0;
                                  const esperadas = noInvInfo?.esperadas || 0;
                                  return (
                                    <div key={sinInvKey} className={`border ${isDark ? 'border-purple-900/20' : 'border-purple-100'} rounded-lg overflow-hidden ml-2`}>
                                      <div
                                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${isDark ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} transition-colors`}
                                        onClick={() => toggleGroup(sinInvKey)}
                                      >
                                        <div className="w-3.5 h-3.5 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                                        {isSinInvExpanded ? <ChevronDown className="h-3 w-3 text-pink-400 shrink-0" /> : <ChevronRight className="h-3 w-3 text-pink-400 shrink-0" />}
                                        <span className="text-[10px] font-medium text-pink-300">Artículo:</span>
                                        <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{sc.articulo || '-'}</span>
                                        <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{esperadas}</span></span>
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa: <span className="text-amber-400 font-medium">{tarifaNum > 0 ? fmtMoney(tarifaNum) : '$0'}</span></span>
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(tarifaNum * esperadas)}</span></span>
                                        </div>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 ml-1">
                                          0/{esperadas}
                                        </span>
                                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">0</span>
                                      </div>
                                      {(sc.ciudad || sc.formato) && (
                                        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                          {sc.ciudad && (
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.ciudad}</span>
                                            </div>
                                          )}
                                          {sc.formato && (
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.formato}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {isSinInvExpanded && (
                                        <div>
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b border-border/30 text-left">
                                                <th className="p-1.5 w-8"></th>
                                                {visibleColumnsReservado.map(col => (
                                                  <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td colSpan={visibleColumnsReservado.length + 1} className={`p-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                                  Sin inventario asignado
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : activeGroupings.length === 0 ? (
                  // Sin agrupación - separar inventario normal de artículos IM
                  <div>
                    {/* Tabla de inventario normal */}
                    {filteredInventarioReservado.filter(i => !isIMArticle(i)).length > 0 && (
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
                              <th key={col.field} className={`p-2 font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInventarioReservado.filter(i => !isIMArticle(i)).map((item) => {
                            const incomplete = isItemFromIncompleteGroup(item);
                            const excess = isItemFromExcessGroup(item);
                            const blocked = incomplete || excess;
                            return (
                            <tr
                              key={item.rsv_ids}
                              id={`row-${item.rsv_ids}`}
                              className={`border-b border-border/50 transition-colors ${
                                excess ? (isDark ? 'bg-orange-500/5' : 'bg-orange-50/50') : incomplete ? (isDark ? 'bg-yellow-500/5' : 'bg-yellow-50/50') : ''
                              } ${
                                selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : 'hover:bg-purple-900/20'
                              }`}
                            >
                              <td className="p-2">
                                {blocked ? (
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center opacity-40 cursor-not-allowed ${excess ? 'border-orange-500/30' : 'border-yellow-500/30'}`} title={excess ? 'Grupo con exceso de caras — ajusta el inventario' : 'Grupo incompleto — ajusta las caras para poder seleccionar'} />
                                ) : (
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
                                )}
                              </td>
                              {visibleColumnsReservado.map(col => renderReservadoCell(item, col, 'p-2', isDark, item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null))}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Grupos sin inventario - integrados en el mismo formato.
                        Header con caras/tarifa/inversión + meta bar Plaza/Formato. */}
                    {gruposSinInventario.length > 0 && (
                      <div className="space-y-2 p-2">
                        {gruposSinInventario.map((sc: SolicitudCara) => {
                          const info = groupCompletenessMap.get(sc.id);
                          const groupKey = `noinv_${sc.id}`;
                          const isExpanded = expandedGroups.has(groupKey);
                          const tarifaNum = Number(sc.tarifa_publica) || 0;
                          const esperadas = info?.esperadas || 0;
                          return (
                            <div key={groupKey} className={`border ${isDark ? 'border-purple-900/30' : 'border-purple-200'} rounded-lg overflow-hidden`}>
                              <div
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}
                                onClick={() => toggleGroup(groupKey)}
                              >
                                <div className="w-4 h-4 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-purple-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-purple-400 shrink-0" />
                                )}
                                <span className="text-xs font-medium text-pink-300">Artículo:</span>
                                <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{sc.articulo || '-'}</span>
                                <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{esperadas}</span></span>
                                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa: <span className="text-amber-400 font-medium">{tarifaNum > 0 ? fmtMoney(tarifaNum) : '$0'}</span></span>
                                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(tarifaNum * esperadas)}</span></span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 ml-1">
                                  0/{esperadas}
                                </span>
                                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">0 items</span>
                              </div>
                              {(sc.ciudad || sc.formato) && (
                                <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                  {sc.ciudad && (
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.ciudad}</span>
                                    </div>
                                  )}
                                  {sc.formato && (
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.formato}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {isExpanded && (
                                <div className="px-2 py-1">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/30 text-left">
                                        <th className="p-1.5 w-8"></th>
                                        {visibleColumnsReservado.map(col => (
                                          <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td colSpan={visibleColumnsReservado.length + 1} className={`p-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                          Sin inventario asignado
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tabla de artículos de impresión */}
                    {filteredInventarioReservado.filter(i => isIMArticle(i)).length > 0 && (
                      <>
                        <div className={`px-3 py-2 mt-2 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            Artículos de Impresión
                          </span>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card z-10">
                            <tr className="border-b border-border text-left">
                              <th className="p-2 w-8">
                                <button
                                  onClick={() => {
                                    const imItems = filteredInventarioReservado.filter(i => isIMArticle(i));
                                    const allSelected = imItems.every(i => selectedItems.has(i.rsv_ids));
                                    const next = new Set(selectedItems);
                                    imItems.forEach(i => allSelected ? next.delete(i.rsv_ids) : next.add(i.rsv_ids));
                                    setSelectedItems(next);
                                  }}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors border-blue-500/50 hover:border-blue-400`}
                                >
                                  {filteredInventarioReservado.filter(i => isIMArticle(i)).every(i => selectedItems.has(i.rsv_ids)) && filteredInventarioReservado.filter(i => isIMArticle(i)).length > 0 && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </button>
                              </th>
                              {TABLE_COLUMNS_IM.map(col => (
                                <th key={col.field} className={`p-2 font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInventarioReservado.filter(i => isIMArticle(i)).map((item) => (
                              <tr
                                key={item.rsv_ids}
                                id={`row-${item.rsv_ids}`}
                                className={`border-b border-border/50 hover:bg-blue-900/20 transition-colors ${
                                  selectedItems.has(item.rsv_ids) ? 'bg-blue-500/20' : ''
                                }`}
                              >
                                <td className="p-2">
                                  <button
                                    onClick={() => toggleItemSelection(item.rsv_ids)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                      selectedItems.has(item.rsv_ids)
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-blue-500/50 hover:border-blue-400'
                                    }`}
                                  >
                                    {selectedItems.has(item.rsv_ids) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </button>
                                </td>
                                {TABLE_COLUMNS_IM.map(col => renderIMCell(item, col, 'p-2', isDark))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
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
                        <div key={groupKey} className={`border ${isDark ? 'border-purple-900/30' : 'border-purple-200'} rounded-lg overflow-hidden`}>
                          {/* Cabecera del grupo */}
                          <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}>
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
                              <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                {AVAILABLE_GROUPINGS.find(g => g.field === activeGroupings[0])?.label}:
                              </span>
                              <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupKey}</span>
                              <GroupSummaryInline items={allGroupItems} groupField={activeGroupings[0]} />
                              {(() => {
                                const ids = [...new Set(allGroupItems.map(i => i.solicitud_caras_id).filter((id): id is number => id !== null))];
                                if (ids.length !== 1) return null;
                                const info = groupCompletenessMap.get(ids[0]);
                                if (!info) return null;
                                if (info.exceso) return <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" /><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30" title={`Exceso: ${info.reservadas}/${info.esperadas} caras`}>+{info.reservadas - info.esperadas}</span></span>;
                                if (!info.completo) return <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" /><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" title={`Incompleto: ${info.reservadas}/${info.esperadas} caras`}>{info.reservadas}/{info.esperadas}</span></span>;
                                return null;
                              })()}
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                {totalItems} items
                              </span>
                            </button>
                          </div>

                          {/* Contenido expandido */}
                          {isExpanded && (
                            <div className="px-2 py-1">
                              <GroupMetaBadges items={allGroupItems} skipFields={activeGroupings} />
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
                                      <div key={subGroupKey} className={`border ${isDark ? 'border-purple-900/20' : 'border-purple-100'} rounded-lg overflow-hidden ml-2`}>
                                        <div className={`flex items-center gap-2 px-2 py-1.5 ${isDark ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} transition-colors`}>
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
                                            <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{subGroupKey}</span>
                                            <GroupSummaryInline items={subItems} groupField={activeGroupings[1]} />
                                            {(() => {
                                              const ids = [...new Set(subItems.map(i => i.solicitud_caras_id).filter((id): id is number => id !== null))];
                                              if (ids.length !== 1) return null;
                                              const info = groupCompletenessMap.get(ids[0]);
                                              if (!info) return null;
                                              if (info.exceso) return <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" /><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30" title={`Exceso: ${info.reservadas}/${info.esperadas} caras`}>+{info.reservadas - info.esperadas}</span></span>;
                                              if (!info.completo) return <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" /><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" title={`Incompleto: ${info.reservadas}/${info.esperadas} caras`}>{info.reservadas}/{info.esperadas}</span></span>;
                                              return null;
                                            })()}
                                            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                              {subItems.length}
                                            </span>
                                          </button>
                                        </div>
                                        {isSubExpanded && (
                                          <div>
                                            <GroupMetaBadges items={subItems} skipFields={activeGroupings} />
                                            {subItems.filter(i => !isIMArticle(i)).length > 0 && (
                                              <table className="w-full text-xs">
                                                <thead>
                                                  <tr className="border-b border-border/30 text-left">
                                                    <th className="p-1.5 w-8"></th>
                                                    {visibleColumnsReservado.map(col => (
                                                      <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {subItems.filter(i => !isIMArticle(i)).map((item) => {
                                                    const incomplete = isItemFromIncompleteGroup(item);
                                                    const excess = isItemFromExcessGroup(item);
                                                    const blocked = incomplete || excess;
                                                    return (
                                                    <tr
                                                      key={item.rsv_ids}
                                                      id={`row-${item.rsv_ids}`}
                                                      className={`border-t border-border/30 transition-colors ${
                                                        excess ? (isDark ? 'bg-orange-500/5' : 'bg-orange-50/50') : incomplete ? (isDark ? 'bg-yellow-500/5' : 'bg-yellow-50/50') : ''
                                                      } ${
                                                        selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : 'hover:bg-purple-900/10'
                                                      }`}
                                                    >
                                                      <td className="p-1.5 w-8">
                                                        {blocked ? (
                                                          <div className={`w-3.5 h-3.5 rounded border opacity-40 cursor-not-allowed ${excess ? 'border-orange-500/30' : 'border-yellow-500/30'}`} title={excess ? 'Grupo con exceso de caras — ajusta el inventario' : 'Grupo incompleto — ajusta las caras para poder seleccionar'} />
                                                        ) : (
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
                                                        )}
                                                      </td>
                                                      {visibleColumnsReservado.map(col => renderReservadoCell(item, col, 'p-1.5', isDark, item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null, true))}
                                                    </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            )}
                                            {subItems.filter(i => isIMArticle(i)).length > 0 && (
                                              <>
                                                <div className={`px-2 py-1 mt-1 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                                                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                                    Artículos de Impresión
                                                  </span>
                                                </div>
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="border-b border-border/30 text-left">
                                                      <th className="p-1.5 w-8"></th>
                                                      {TABLE_COLUMNS_IM.map(col => (
                                                        <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {subItems.filter(i => isIMArticle(i)).map((item) => (
                                                      <tr
                                                        key={item.rsv_ids}
                                                        id={`row-${item.rsv_ids}`}
                                                        className={`border-t border-border/30 hover:bg-blue-900/10 transition-colors ${
                                                          selectedItems.has(item.rsv_ids) ? 'bg-blue-500/20' : ''
                                                        }`}
                                                      >
                                                        <td className="p-1.5 w-8">
                                                          <button
                                                            onClick={() => toggleItemSelection(item.rsv_ids)}
                                                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                              selectedItems.has(item.rsv_ids)
                                                                ? 'bg-blue-600 border-blue-600'
                                                                : 'border-blue-500/50 hover:border-blue-400'
                                                            }`}
                                                          >
                                                            {selectedItems.has(item.rsv_ids) && (
                                                              <Check className="h-2.5 w-2.5 text-white" />
                                                            )}
                                                          </button>
                                                        </td>
                                                        {TABLE_COLUMNS_IM.map(col => renderIMCell(item, col, 'p-1.5', isDark))}
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : items ? (
                                // Un solo nivel de agrupación
                                <>
                                  {items.filter(i => !isIMArticle(i)).length > 0 && (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border/30 text-left">
                                          <th className="p-1.5 w-8"></th>
                                          {visibleColumnsReservado.map(col => (
                                            <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.filter(i => !isIMArticle(i)).map((item) => {
                                          const incomplete = isItemFromIncompleteGroup(item);
                                          const excess = isItemFromExcessGroup(item);
                                          const blocked = incomplete || excess;
                                          return (
                                          <tr
                                            key={item.rsv_ids}
                                            id={`row-${item.rsv_ids}`}
                                            className={`border-t border-border/30 transition-colors ${
                                              excess ? (isDark ? 'bg-orange-500/5' : 'bg-orange-50/50') : incomplete ? (isDark ? 'bg-yellow-500/5' : 'bg-yellow-50/50') : ''
                                            } ${
                                              selectedItems.has(item.rsv_ids) ? 'bg-yellow-500/20' : 'hover:bg-purple-900/10'
                                            }`}
                                          >
                                            <td className="p-1.5 w-8">
                                              {blocked ? (
                                                <div className={`w-3.5 h-3.5 rounded border opacity-40 cursor-not-allowed ${excess ? 'border-orange-500/30' : 'border-yellow-500/30'}`} title={excess ? 'Grupo con exceso de caras — ajusta el inventario' : 'Grupo incompleto — ajusta las caras para poder seleccionar'} />
                                              ) : (
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
                                              )}
                                            </td>
                                            {visibleColumnsReservado.map(col => renderReservadoCell(item, col, 'p-1.5', isDark, item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null, true))}
                                          </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                  {items.filter(i => isIMArticle(i)).length > 0 && (
                                    <>
                                      <div className={`px-2 py-1 mt-1 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                          Artículos de Impresión
                                        </span>
                                      </div>
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-border/30 text-left">
                                            <th className="p-1.5 w-8"></th>
                                            {TABLE_COLUMNS_IM.map(col => (
                                              <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.filter(i => isIMArticle(i)).map((item) => (
                                            <tr
                                              key={item.rsv_ids}
                                              id={`row-${item.rsv_ids}`}
                                              className={`border-t border-border/30 hover:bg-blue-900/10 transition-colors ${
                                                selectedItems.has(item.rsv_ids) ? 'bg-blue-500/20' : ''
                                              }`}
                                            >
                                              <td className="p-1.5 w-8">
                                                <button
                                                  onClick={() => toggleItemSelection(item.rsv_ids)}
                                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                    selectedItems.has(item.rsv_ids)
                                                      ? 'bg-blue-600 border-blue-600'
                                                      : 'border-blue-500/50 hover:border-blue-400'
                                                  }`}
                                                >
                                                  {selectedItems.has(item.rsv_ids) && (
                                                    <Check className="h-2.5 w-2.5 text-white" />
                                                  )}
                                                </button>
                                              </td>
                                              {TABLE_COLUMNS_IM.map(col => renderIMCell(item, col, 'p-1.5', isDark))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </>
                                  )}
                                </>
                              ) : null}
                            {/* Sin inventario que pertenecen a este grupo */}
                            {(() => {
                              const firstField = activeGroupings[0];
                              const matchingNoInv = gruposSinInventario.filter(sc => getSCGroupValue(sc, firstField, tipoPeriodo) === groupKey);
                              if (matchingNoInv.length === 0) return null;
                              return (
                                <div className="space-y-1 mt-1">
                                  {matchingNoInv.map(sc => {
                                    const noInvInfo = groupCompletenessMap.get(sc.id);
                                    const sinInvKey = `noinv_${sc.id}`;
                                    const isSinInvExpanded = expandedGroups.has(sinInvKey);
                                    const tarifaNum = Number(sc.tarifa_publica) || 0;
                                    const esperadas = noInvInfo?.esperadas || 0;
                                    return (
                                      <div key={sinInvKey} className={`border ${isDark ? 'border-purple-900/20' : 'border-purple-100'} rounded-lg overflow-hidden ml-2`}>
                                        <div
                                          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${isDark ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} transition-colors`}
                                          onClick={() => toggleGroup(sinInvKey)}
                                        >
                                          <div className="w-3.5 h-3.5 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                                          {isSinInvExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-pink-400 shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-pink-400 shrink-0" />
                                          )}
                                          <span className="text-[10px] font-medium text-pink-300">Artículo:</span>
                                          <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{sc.articulo || '-'}</span>
                                          <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                            <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{esperadas}</span></span>
                                            <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa: <span className="text-amber-400 font-medium">{tarifaNum > 0 ? fmtMoney(tarifaNum) : '$0'}</span></span>
                                            <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(tarifaNum * esperadas)}</span></span>
                                          </div>
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 ml-1">
                                            0/{esperadas}
                                          </span>
                                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">0</span>
                                        </div>
                                        {(sc.ciudad || sc.formato) && (
                                          <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                            {sc.ciudad && (
                                              <div className="flex items-center gap-1">
                                                <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.ciudad}</span>
                                              </div>
                                            )}
                                            {sc.formato && (
                                              <div className="flex items-center gap-1">
                                                <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.formato}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {isSinInvExpanded && (
                                          <div>
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="border-b border-border/30 text-left">
                                                  <th className="p-1.5 w-8"></th>
                                                  {visibleColumnsReservado.map(col => (
                                                    <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                <tr>
                                                  <td colSpan={visibleColumnsReservado.length + 1} className={`p-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                                    Sin inventario asignado
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Sin inventario sin grupo coincidente: agrupar por período
                        para que NO aparezcan filas top-level separadas (una por
                        cada circuito incompleto). Antes Cat 17 / 2026 podía salir
                        4 veces; ahora sale UNA vez con todos los circuitos dentro. */}
                    {(() => {
                      const firstField = activeGroupings[0];
                      const groupKeys = Object.keys(groupedInventario);
                      const unmatchedNoInv = gruposSinInventario.filter(sc => !groupKeys.includes(getSCGroupValue(sc, firstField, tipoPeriodo)));
                      if (unmatchedNoInv.length === 0) return null;
                      const firstFieldLabel = AVAILABLE_GROUPINGS.find(g => g.field === firstField)?.label || firstField;
                      // Agrupar SCs por el primer campo de agrupación activo.
                      const byField = unmatchedNoInv.reduce((acc, sc) => {
                        const key = getSCGroupValue(sc, firstField, tipoPeriodo);
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(sc);
                        return acc;
                      }, {} as Record<string, SolicitudCara[]>);
                      return Object.entries(byField).map(([groupValue, scItems]) => {
                        const periodGroupKey = `noinv_unmatched_${firstField}_${groupValue}`;
                        const isPeriodExpanded = expandedGroups.has(periodGroupKey);
                        const totalEsperadas = scItems.reduce((s, sc) => s + (groupCompletenessMap.get(sc.id)?.esperadas || 0), 0);
                        const totalInversion = scItems.reduce((s, sc) => {
                          const esp = groupCompletenessMap.get(sc.id)?.esperadas || 0;
                          return s + (Number(sc.tarifa_publica) || 0) * esp;
                        }, 0);
                        return (
                          <div key={periodGroupKey} className={`border ${isDark ? 'border-purple-900/30' : 'border-purple-200'} rounded-lg overflow-hidden`}>
                            <div
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}
                              onClick={() => toggleGroup(periodGroupKey)}
                            >
                              <div className="w-4 h-4 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                              {isPeriodExpanded ? (
                                <ChevronDown className="h-4 w-4 text-purple-400 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400 shrink-0" />
                              )}
                              <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{firstFieldLabel}:</span>
                              <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupValue}</span>
                              <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalEsperadas}</span></span>
                                <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(totalInversion)}</span></span>
                              </div>
                              <span className="flex items-center gap-1 ml-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Incompleto</span>
                              </span>
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{scItems.length} items</span>
                            </div>
                            {isPeriodExpanded && (
                              <div className="px-2 py-1 space-y-1">
                                {/* Meta: Plaza / Formato agregadas */}
                                {(() => {
                                  const plazas = [...new Set(scItems.map(sc => sc.ciudad).filter(Boolean))] as string[];
                                  const formatos = [...new Set(scItems.map(sc => sc.formato).filter(Boolean))] as string[];
                                  if (!plazas.length && !formatos.length) return null;
                                  return (
                                    <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 mb-1 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                      {plazas.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                          {plazas.slice(0, 3).map(p => <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{p}</span>)}
                                          {plazas.length > 3 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{plazas.length - 3}</span>}
                                        </div>
                                      )}
                                      {formatos.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                          {formatos.slice(0, 3).map(f => <span key={f} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{f}</span>)}
                                          {formatos.length > 3 && <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>+{formatos.length - 3}</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                                {scItems.map(sc => {
                                  const noInvInfo = groupCompletenessMap.get(sc.id);
                                  const sinInvKey = `noinv_${sc.id}`;
                                  const isSinInvExpanded = expandedGroups.has(sinInvKey);
                                  const tarifaNum = Number(sc.tarifa_publica) || 0;
                                  const esperadas = noInvInfo?.esperadas || 0;
                                  return (
                                    <div key={sinInvKey} className={`border ${isDark ? 'border-purple-900/20' : 'border-purple-100'} rounded-lg overflow-hidden ml-2`}>
                                      <div
                                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${isDark ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} transition-colors`}
                                        onClick={() => toggleGroup(sinInvKey)}
                                      >
                                        <div className="w-3.5 h-3.5 rounded border opacity-40 cursor-not-allowed border-yellow-500/30 shrink-0" title="Grupo incompleto — sin inventario para seleccionar" />
                                        {isSinInvExpanded ? <ChevronDown className="h-3 w-3 text-pink-400 shrink-0" /> : <ChevronRight className="h-3 w-3 text-pink-400 shrink-0" />}
                                        <span className="text-[10px] font-medium text-pink-300">Artículo:</span>
                                        <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{sc.articulo || '-'}</span>
                                        <div className="flex items-center gap-2 text-[10px] ml-2 shrink-0">
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Caras: <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{esperadas}</span></span>
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa: <span className="text-amber-400 font-medium">{tarifaNum > 0 ? fmtMoney(tarifaNum) : '$0'}</span></span>
                                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inv: <span className="text-emerald-400 font-medium">{fmtMoney(tarifaNum * esperadas)}</span></span>
                                        </div>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 ml-1">
                                          0/{esperadas}
                                        </span>
                                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">0</span>
                                      </div>
                                      {(sc.ciudad || sc.formato) && (
                                        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border-b ${isDark ? 'border-purple-900/10' : 'border-purple-100'}`}>
                                          {sc.ciudad && (
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Plaza:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.ciudad}</span>
                                            </div>
                                          )}
                                          {sc.formato && (
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Formato:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}>{sc.formato}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {isSinInvExpanded && (
                                        <div>
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b border-border/30 text-left">
                                                <th className="p-1.5 w-8"></th>
                                                {visibleColumnsReservado.map(col => (
                                                  <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td colSpan={visibleColumnsReservado.length + 1} className={`p-4 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                                  Sin inventario asignado
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Lista de inventario por APS */}
        <div className="bg-card rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 border-b border-border">
            <h3 className={`text-xs md:text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase tracking-wide`}>
              Lista de Inventario por APS
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {filteredInventarioAPS.length} registros
              </span>
              {/* Historial de posteos: a quién se mandó cada APS (bitácora) */}
              {postLog.length > 0 && (
                <button
                  onClick={() => setShowPostLogModal(true)}
                  className={`flex items-center justify-center w-6 sm:w-7 h-6 sm:h-7 rounded-lg border transition-colors ${
                    isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border-purple-300'
                  }`}
                  title="Historial de posteos a SAP (a quién se mandó cada APS)"
                >
                  <History className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} />
                </button>
              )}
              {permissions.canEditDetalleCampana && (() => {
                const selectedHavePosted = selectedItemsAPS.size > 0 &&
                  inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids))).some(i => postedAPSGroups.has(i.aps));
                const selectedHavePrefactura = selectedItemsAPS.size > 0 &&
                  inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids))).some(i => prefacturaAPSGroups.has(i.aps));
                // Para Pre Factura usamos el botón "Cancelar POST" (que llama
                // a cancelPrefactura y regresa las reservas a Sin APS). Aquí
                // bloqueamos el quitar-APS individual para evitar dejar el JSON
                // prefactura_aps con números huérfanos.
                const disabled = selectedItemsAPS.size === 0 || selectedHavePosted || selectedHavePrefactura;
                return (
                <button
                  onClick={handleQuitarAPS}
                  disabled={disabled || quitandoAPS}
                  className={`flex items-center justify-center w-6 sm:w-7 h-6 sm:h-7 rounded-lg border transition-colors ${
                    disabled
                      ? isDark ? 'bg-red-900/20 border-red-500/20 cursor-not-allowed' : 'bg-red-50 border-red-200 cursor-not-allowed'
                      : isDark ? 'bg-red-900/50 hover:bg-red-900/70 border-red-500/30' : 'bg-red-100 hover:bg-red-200 border-red-300'
                  }`}
                  title={selectedHavePosted ? 'No se puede eliminar APS con POST a SAP' : selectedHavePrefactura ? 'Para liberar un APS Pre Factura usa Cancelar POST' : quitandoAPS ? 'Quitando...' : 'Quitar APS'}
                >
                  {quitandoAPS ? (
                    <Loader2 className={`h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  ) : (
                    <Minus className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${disabled ? (isDark ? 'text-red-400/40' : 'text-red-300') : (isDark ? 'text-red-400' : 'text-red-600')}`} />
                  )}
                </button>
                );
              })()}
              {(permissions.canEditDetalleCampana || permissions.canPostToSAP) && inventarioConAPS.length > 0 && (() => {
                const selectedHavePostedAPS = selectedItemsAPS.size > 0 &&
                  inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids))).some(i => postedAPSGroups.has(i.aps));
                const selectedHavePrefacturaAPS = selectedItemsAPS.size > 0 &&
                  inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids))).some(i => prefacturaAPSGroups.has(i.aps));
                const isPostDisabled = alreadyPosted || selectedHavePostedAPS || selectedHavePrefacturaAPS;
                return (
                  <button
                    onClick={() => {
                      if (campana) {
                        const itemsToPreview = selectedItemsAPS.size > 0
                          ? inventarioConAPS.filter(i => selectedItemsAPS.has(String(i.rsv_ids)))
                          : inventarioConAPS;
                        const dns = buildDeliveryNote(campana, itemsToPreview, campana.sap_database);
                        const allLines = dns.flatMap((d: any) => d.DocumentLines);
                        setPreviewDeliveryNote({ ...dns[0], DocumentLines: allLines });
                      }
                      setShowPostSAPModal(true);
                    }}
                    disabled={isPostDisabled}
                    className={`flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-colors ${isPostDisabled ? (isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-100 border-gray-200') + ' cursor-not-allowed opacity-50' : (isDark ? 'bg-cyan-900/30' : 'bg-cyan-50') + ' border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40'}`}
                    title={alreadyPosted ? 'Ya se envió a SAP' : selectedHavePostedAPS ? 'Este APS ya fue enviado a SAP' : selectedHavePrefacturaAPS ? 'Este APS está etiquetado como Pre Factura — no se puede mandar a SAP. Cancela la etiqueta primero.' : 'Enviar a SAP'}
                  >
                    <Upload className={`h-3 sm:h-3.5 w-3 sm:w-3.5 mr-1 ${isPostDisabled ? (isDark ? 'text-zinc-500' : 'text-gray-400') : (isDark ? 'text-cyan-400' : 'text-cyan-600')}`} />
                    <span className={`text-[10px] sm:text-xs font-medium ${isPostDisabled ? (isDark ? 'text-zinc-500' : 'text-gray-400') : (isDark ? 'text-cyan-300' : 'text-cyan-700')}`}>{alreadyPosted ? 'ENVIADO' : 'POST'}</span>
                  </button>
                );
              })()}
              {(permissions.canCancelPostSAP || user?.area === 'TI') && inventarioConAPS.length > 0 && (
                <button
                  onClick={() => { setCancelPostSAPResult(null); setShowCancelPostSAPModal(true); }}
                  className={`flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-colors ${isDark ? 'bg-red-900/30 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40' : 'bg-red-50 border-red-200 hover:bg-red-100'}`}
                  title="Cancelar POST a SAP (solo TI)"
                >
                  <XCircle className={`h-3 sm:h-3.5 w-3 sm:w-3.5 mr-1 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  <span className={`text-[10px] sm:text-xs font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>Cancelar POST</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 md:gap-4 p-3 md:p-4">
            {/* Columna izquierda: Mapa */}
            <div className={`h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-lg overflow-hidden border border-border relative ${isDark ? 'map-dark-controls' : ''}`}>
              {!isLoaded || isLoadingAPS ? (
                <MapSkeleton />
              ) : errorAPS ? (
                <MapErrorState onRetry={() => refetchAPS()} />
              ) : inventarioConAPS.filter(i => i.latitud && i.longitud).length === 0 ? (
                <MapEmptyState />
              ) : (
                <>
                  <GoogleMap
                    mapContainerClassName="w-full h-full"
                    center={mapCenterAPS}
                    zoom={12}
                    onLoad={onMapLoadAPS}
                    options={mapOptions}
                  >
                    {iconAPSSelected && iconAPSUnselected && inventarioConAPS
                      .filter(item => selectedItemsAPS.has(String(item.rsv_ids)))
                      .map((item) => {
                        if (!item.latitud || !item.longitud) return null;
                        const rsvId = String(item.rsv_ids);
                        return (
                          <MapMarker
                            key={`aps-${rsvId}`}
                            rsvId={rsvId}
                            lat={item.latitud}
                            lng={item.longitud}
                            title={`${item.codigo_unico} - APS: ${item.aps}`}
                            isSelected={true}
                            iconSelected={iconAPSSelected}
                            iconUnselected={iconAPSUnselected}
                            onClick={handleMarkerClickAPS}
                          />
                        );
                      })}
                  </GoogleMap>
                  {selectedItemsAPS.size === 0 && (
                    <div className={`absolute top-3 left-3 z-10 ${isDark ? 'bg-zinc-900/95 border-cyan-500/40 text-cyan-300' : 'bg-white/95 border-cyan-300 text-cyan-700'} border rounded-lg px-3 py-2 text-[11px] max-w-[240px] shadow-lg pointer-events-none`}>
                      Selecciona items desde la lista para verlos en el mapa.
                    </div>
                  )}
                </>
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
                          : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
                      }`}
                      title="Filtrar"
                    >
                      <Filter className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                      {filtersAPS.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">
                          {filtersAPS.length}
                        </span>
                      )}
                    </button>
                    {showFiltersAPS && (
                      <div className={`absolute right-0 top-full mt-1 z-50 w-[520px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Filtros de búsqueda</span>
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
                                <span className="text-[10px] text-purple-400 font-medium w-8">{filtersAPS[index - 1].field === filter.field ? 'OR' : 'AND'}</span>
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
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  placeholder="Valor..."
                                  value={filterDraftAPS[filter.id] ?? filter.value}
                                  onChange={(e) => setFilterDraftAPS(prev => ({ ...prev, [filter.id]: e.target.value }))}
                                  onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    setFilterDropdownRectAPS({ top: rect.bottom, left: rect.left, width: rect.width });
                                    setOpenFilterInputAPS(filter.id);
                                    setFilterDraftAPS(prev => ({ ...prev, [filter.id]: filter.value }));
                                  }}
                                  onBlur={() => setTimeout(() => {
                                    setFilterDraftAPS(prev => {
                                      const draftValue = prev[filter.id];
                                      if (draftValue !== undefined && draftValue !== filter.value) {
                                        updateFilterAPS(filter.id, { value: draftValue });
                                      }
                                      const next = { ...prev };
                                      delete next[filter.id];
                                      return next;
                                    });
                                    setOpenFilterInputAPS(null);
                                    setFilterDropdownRectAPS(null);
                                  }, 200)}
                                  className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
                                />
                                {openFilterInputAPS === filter.id && filterDropdownRectAPS && (
                                  <div
                                    className={`fixed z-[9999] border rounded ${isDark ? 'bg-[#2a1540] border-purple-900/50' : 'bg-white border-purple-200'} shadow-xl max-h-[200px] overflow-y-auto`}
                                    style={{ top: filterDropdownRectAPS.top + 4, left: filterDropdownRectAPS.left, width: filterDropdownRectAPS.width }}
                                  >
                                    {(() => {
                                      const draft = filterDraftAPS[filter.id] ?? filter.value;
                                      const opts = getUniqueValuesAPS(filter.field).filter(val => val.toLowerCase().includes(draft.toLowerCase()));
                                      return (
                                        <>
                                          {opts.map((val) => (
                                            <div
                                              key={val}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                updateFilterAPS(filter.id, { value: val });
                                                setFilterDraftAPS(prev => {
                                                  const next = { ...prev };
                                                  delete next[filter.id];
                                                  return next;
                                                });
                                                setOpenFilterInputAPS(null);
                                                setFilterDropdownRectAPS(null);
                                              }}
                                              className={`px-2 py-1.5 text-xs cursor-pointer ${isDark ? 'hover:bg-purple-900/50' : 'hover:bg-purple-50'}`}
                                            >
                                              {val}
                                            </div>
                                          ))}
                                          {opts.length === 0 && (
                                            <div className={`px-2 py-1.5 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                              Sin coincidencias
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
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
                        <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border-purple-300'} border rounded-lg transition-colors`}
                      title="Agrupar"
                    >
                      <Layers className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                      {activeGroupingsAPS.length > 0 && (
                        <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">
                          {activeGroupingsAPS.length}
                        </span>
                      )}
                    </button>
                    {/* Dropdown de configuración */}
                    {showGroupingConfigAPS && (
                      <div className={`absolute right-0 top-full mt-1 z-10 ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-2 min-w-[180px]`}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1">
                          Agrupar por (max 3)
                        </p>
                        {AVAILABLE_GROUPINGS_APS.map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => toggleGroupingAPS(field)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-100'} transition-colors ${
                              activeGroupingsAPS.includes(field) ? 'text-purple-300' : isDark ? 'text-zinc-400' : 'text-gray-500'
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
                        <div className={`border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'} mt-2 pt-2`}>
                          <button
                            onClick={() => setActiveGroupingsAPS([])}
                            className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-700'} py-1`}
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
                          : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
                      }`}
                      title="Ordenar"
                    >
                      <ArrowUpDown className={`h-3.5 w-3.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                    </button>
                    {showSortAPS && (
                      <div className={`absolute right-0 top-full mt-1 z-50 w-[280px] ${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-3`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Ordenar por</span>
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
                                  : isDark ? 'text-zinc-300 hover:bg-purple-900/30' : 'text-gray-700 hover:bg-purple-100'
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
                          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
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
                // Sin agrupación - separar inventario normal de artículos IM
                <div>
                  {/* Tabla de inventario normal con APS */}
                  {filteredInventarioAPS.filter(i => !isIMArticle(i)).length > 0 && (
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
                          {visibleColumnsAPS.map(col => (
                            <th key={col.field} className={`p-2 font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventarioAPS.filter(i => !isIMArticle(i)).map((item) => (
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
                            {visibleColumnsAPS.map(col => renderAPSCell(item, col, 'p-2', isDark, item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Grupos incompletos — pendiente de APS */}
                  {incompleteReservadoForAPS.filter(i => !isIMArticle(i)).length > 0 && (
                    <>
                      <div className={`px-3 py-2 mt-2 border-b border-yellow-500/30 ${isDark ? 'bg-yellow-500/5' : 'bg-yellow-50'}`}>
                        <span className="text-xs font-semibold uppercase tracking-wide text-yellow-400">
                          Grupos incompletos — sin APS
                        </span>
                      </div>
                      <table className="w-full text-xs opacity-60">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="p-2 w-8"></th>
                            {visibleColumnsAPS.map(col => (
                              <th key={col.field} className="p-2 font-medium text-yellow-400/80">{col.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {incompleteReservadoForAPS.filter(i => !isIMArticle(i)).map(item => {
                            const groupInfo = item.solicitud_caras_id ? groupCompletenessMap.get(item.solicitud_caras_id) : null;
                            const apsItem = { ...item, aps: 0 } as InventarioConAPS;
                            return (
                              <tr key={`pending-${item.rsv_ids}`} className="border-b border-border/50 cursor-not-allowed">
                                <td className="p-2">
                                  <div className="w-4 h-4 rounded border border-yellow-500/30 flex items-center justify-center" title="Completa el grupo para poder asignar APS">
                                    <span className="text-yellow-400 text-[8px] font-bold">!</span>
                                  </div>
                                </td>
                                {visibleColumnsAPS.map(col => renderAPSCell(apsItem, col, 'p-2', isDark, groupInfo))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Tabla de artículos de impresión con APS */}
                  {filteredInventarioAPS.filter(i => isIMArticle(i)).length > 0 && (
                    <>
                      <div className={`px-3 py-2 mt-2 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                          Artículos de Impresión
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border text-left">
                            <th className="p-2 w-8">
                              <button
                                onClick={() => {
                                  const imItems = filteredInventarioAPS.filter(i => isIMArticle(i));
                                  const allSelected = imItems.every(i => selectedItemsAPS.has(String(i.rsv_ids)));
                                  const next = new Set(selectedItemsAPS);
                                  imItems.forEach(i => allSelected ? next.delete(String(i.rsv_ids)) : next.add(String(i.rsv_ids)));
                                  setSelectedItemsAPS(next);
                                }}
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors border-blue-500/50 hover:border-blue-400`}
                              >
                                {filteredInventarioAPS.filter(i => isIMArticle(i)).every(i => selectedItemsAPS.has(String(i.rsv_ids))) && filteredInventarioAPS.filter(i => isIMArticle(i)).length > 0 && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </button>
                            </th>
                            {TABLE_COLUMNS_IM_APS.map(col => (
                              <th key={col.field} className={`p-2 font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInventarioAPS.filter(i => isIMArticle(i)).map((item) => (
                            <tr
                              key={item.rsv_ids}
                              id={`row-aps-${item.rsv_ids}`}
                              className={`border-b border-border/50 hover:bg-blue-900/20 transition-colors ${
                                selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-blue-500/20' : ''
                              }`}
                            >
                              <td className="p-2">
                                <button
                                  onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    selectedItemsAPS.has(String(item.rsv_ids))
                                      ? 'bg-blue-600 border-blue-600'
                                      : 'border-blue-500/50 hover:border-blue-400'
                                  }`}
                                >
                                  {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </button>
                              </td>
                              {TABLE_COLUMNS_IM_APS.map(col => renderIMAPSCell(item, col, 'p-2', isDark))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
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
                      <div key={groupKey} className={`border ${isDark ? 'border-purple-900/30' : 'border-purple-200'} rounded-lg overflow-hidden`}>
                        {/* Cabecera del grupo nivel 1 */}
                        <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}>
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
                            <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                              {AVAILABLE_GROUPINGS_APS.find(g => g.field === activeGroupingsAPS[0])?.label}:
                            </span>
                            <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupKey}</span>
                            {activeGroupingsAPS[0] === 'aps' && allGroupItemsAPS[0] && (postedAPSGroups.has(allGroupItemsAPS[0].aps) || alreadyPosted) && (
                              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">POST</span>
                            )}
                            {/* Destino real del POST (snapshot). Sobrevive a que le
                                cambien el cliente a la campaña después de postear. */}
                            {activeGroupingsAPS[0] === 'aps' && allGroupItemsAPS[0] && (() => {
                              const log = postLogByAPS.get(allGroupItemsAPS[0].aps);
                              if (!log) return null;
                              const destino = log.marca || log.razon_social || log.cliente_nombre || log.card_code || '—';
                              const fecha = log.posted_at ? new Date(log.posted_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';
                              const tip = [
                                `Posteado a: ${destino}`,
                                log.razon_social ? `Razón social: ${log.razon_social}` : '',
                                log.cuic != null ? `CUIC: ${log.cuic}` : '',
                                log.card_code ? `CardCode: ${log.card_code}` : '',
                                log.sap_database ? `BD SAP: ${log.sap_database}` : '',
                                log.doc_num != null ? `DocNum: ${log.doc_num}` : '',
                                fecha ? `Fecha: ${fecha}` : '',
                                log.usuario_nombre ? `Por: ${log.usuario_nombre}` : '',
                              ].filter(Boolean).join('\n');
                              // BD SAP: mismo código de color que se usa en el resto del sistema
                              // (CIMU azul, TEST ámbar, TRADE esmeralda).
                              const sapCls = log.sap_database === 'CIMU' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : log.sap_database === 'TEST' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : log.sap_database === 'TRADE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
                              return (
                                <>
                                  <span
                                    title={tip}
                                    className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 max-w-[140px] truncate cursor-help"
                                  >
                                    → {destino}
                                  </span>
                                  {/* Etiqueta BD SAP del post (congelada del snapshot) */}
                                  {log.sap_database && (
                                    <span
                                      title={tip}
                                      className={`text-[9px] font-semibold px-1 py-0.5 rounded border shrink-0 cursor-help ${sapCls}`}
                                    >
                                      {log.sap_database}
                                    </span>
                                  )}
                                  {/* Etiqueta CUIC del post (congelada del snapshot) */}
                                  {log.cuic != null && (
                                    <span
                                      title={tip}
                                      className="text-[9px] font-semibold px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 cursor-help"
                                    >
                                      CUIC {log.cuic}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            {activeGroupingsAPS[0] === 'aps' && allGroupItemsAPS[0] && prefacturaAPSGroups.has(allGroupItemsAPS[0].aps) && (
                              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">PRE FACTURA</span>
                            )}
                            <GroupSummaryInline items={allGroupItemsAPS} groupField={activeGroupingsAPS[0]} />
                            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                              {totalItems} items
                            </span>
                          </button>
                        </div>

                        {/* Contenido expandido */}
                        {isExpanded && (
                          <div className="px-2 py-1">
                            <GroupMetaBadges items={allGroupItemsAPS} skipFields={activeGroupingsAPS[0] === 'aps' ? [...activeGroupingsAPS, 'plaza', 'formato'] : activeGroupingsAPS} />
                            {isLevel1Array ? (
                              // Solo 1 nivel - separar normal de IM
                              <>
                                {(groupData as InventarioConAPS[]).filter(i => !isIMArticle(i)).length > 0 && (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/30 text-left">
                                        <th className="p-1.5 w-8"></th>
                                        {visibleColumnsAPS.map(col => (
                                          <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(groupData as InventarioConAPS[]).filter(i => !isIMArticle(i)).map((item) => (
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
                                          {visibleColumnsAPS.map(col => renderAPSCell(item, col, 'p-1.5', isDark))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                {(groupData as InventarioConAPS[]).filter(i => isIMArticle(i)).length > 0 && (
                                  <>
                                    <div className={`px-2 py-1 mt-1 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                        Artículos de Impresión
                                      </span>
                                    </div>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border/30 text-left">
                                          <th className="p-1.5 w-8"></th>
                                          {TABLE_COLUMNS_IM_APS.map(col => (
                                            <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(groupData as InventarioConAPS[]).filter(i => isIMArticle(i)).map((item) => (
                                          <tr
                                            key={item.rsv_ids}
                                            id={`row-aps-${item.rsv_ids}`}
                                            className={`border-t border-border/30 hover:bg-blue-900/10 transition-colors ${
                                              selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-blue-500/20' : ''
                                            }`}
                                          >
                                            <td className="p-1.5 w-8">
                                              <button
                                                onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                  selectedItemsAPS.has(String(item.rsv_ids))
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-blue-500/50 hover:border-blue-400'
                                                }`}
                                              >
                                                {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                  <Check className="h-2.5 w-2.5 text-white" />
                                                )}
                                              </button>
                                            </td>
                                            {TABLE_COLUMNS_IM_APS.map(col => renderIMAPSCell(item, col, 'p-1.5', isDark))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                              </>
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
                                    <div key={subGroupKey} className={`border ${isDark ? 'border-purple-900/20' : 'border-purple-100'} rounded-lg overflow-hidden ml-2`}>
                                      <div className={`flex items-center gap-2 px-2 py-1.5 ${isDark ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'bg-purple-50/50 hover:bg-purple-50'} transition-colors`}>
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
                                          <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{subGroupKey}</span>
                                          {activeGroupingsAPS[1] === 'aps' && allSubItemsAPS[0] && postedAPSGroups.has(allSubItemsAPS[0].aps) && (
                                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">POST</span>
                                          )}
                                          {activeGroupingsAPS[1] === 'aps' && allSubItemsAPS[0] && prefacturaAPSGroups.has(allSubItemsAPS[0].aps) && (
                                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">PRE FACTURA</span>
                                          )}
                                          <GroupSummaryInline items={allSubItemsAPS} groupField={activeGroupingsAPS[1]} />
                                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                            {subTotalItems}
                                          </span>
                                        </button>
                                      </div>
                                      {isSubExpanded && (
                                        <div className="px-2 py-1">
                                          <GroupMetaBadges items={allSubItemsAPS} skipFields={activeGroupingsAPS[1] === 'aps' ? [...activeGroupingsAPS, 'plaza', 'formato'] : activeGroupingsAPS} />
                                          {isLevel2Array ? (
                                            // Solo 2 niveles - separar normal de IM
                                            <>
                                              {(subGroupData as InventarioConAPS[]).filter(i => !isIMArticle(i)).length > 0 && (
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="border-b border-border/30 text-left">
                                                      <th className="p-1.5 w-8"></th>
                                                      {visibleColumnsAPS.map(col => (
                                                        <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {(subGroupData as InventarioConAPS[]).filter(i => !isIMArticle(i)).map((item) => (
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
                                                        {visibleColumnsAPS.map(col => renderAPSCell(item, col, 'p-1.5', isDark))}
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              )}
                                              {(subGroupData as InventarioConAPS[]).filter(i => isIMArticle(i)).length > 0 && (
                                                <>
                                                  <div className={`px-2 py-1 mt-1 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                                      Artículos de Impresión
                                                    </span>
                                                  </div>
                                                  <table className="w-full text-xs">
                                                    <thead>
                                                      <tr className="border-b border-border/30 text-left">
                                                        <th className="p-1.5 w-8"></th>
                                                        {TABLE_COLUMNS_IM_APS.map(col => (
                                                          <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                                                        ))}
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {(subGroupData as InventarioConAPS[]).filter(i => isIMArticle(i)).map((item) => (
                                                        <tr
                                                          key={item.rsv_ids}
                                                          id={`row-aps-${item.rsv_ids}`}
                                                          className={`border-t border-border/30 hover:bg-blue-900/10 transition-colors ${
                                                            selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-blue-500/20' : ''
                                                          }`}
                                                        >
                                                          <td className="p-1.5 w-8">
                                                            <button
                                                              onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                                selectedItemsAPS.has(String(item.rsv_ids))
                                                                  ? 'bg-blue-600 border-blue-600'
                                                                  : 'border-blue-500/50 hover:border-blue-400'
                                                              }`}
                                                            >
                                                              {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                                <Check className="h-2.5 w-2.5 text-white" />
                                                              )}
                                                            </button>
                                                          </td>
                                                          {TABLE_COLUMNS_IM_APS.map(col => renderIMAPSCell(item, col, 'p-1.5', isDark))}
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </>
                                              )}
                                            </>
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
                                                  <div key={thirdGroupKey} className={`border ${isDark ? 'border-cyan-900/20' : 'border-cyan-100'} rounded-lg overflow-hidden ml-2`}>
                                                    <div className={`flex items-center gap-2 px-2 py-1.5 ${isDark ? 'bg-cyan-900/10 hover:bg-cyan-900/20' : 'bg-cyan-50/50 hover:bg-cyan-50'} transition-colors`}>
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
                                                        <span className={`text-[10px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{thirdGroupKey}</span>
                                                        {activeGroupingsAPS[2] === 'aps' && thirdItems[0] && postedAPSGroups.has(thirdItems[0].aps) && (
                                                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">POST</span>
                                                        )}
                                                        {activeGroupingsAPS[2] === 'aps' && thirdItems[0] && prefacturaAPSGroups.has(thirdItems[0].aps) && (
                                                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">PRE FACTURA</span>
                                                        )}
                                                        <GroupSummaryInline items={thirdItems} groupField={activeGroupingsAPS[2]} />
                                                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                                          {thirdItems.length}
                                                        </span>
                                                      </button>
                                                    </div>
                                                    {isThirdExpanded && (
                                                      <div>
                                                        <GroupMetaBadges items={thirdItems} skipFields={activeGroupingsAPS[2] === 'aps' ? [...activeGroupingsAPS, 'plaza', 'formato'] : activeGroupingsAPS} />
                                                        {thirdItems.filter(i => !isIMArticle(i)).length > 0 && (
                                                          <table className="w-full text-xs">
                                                            <thead>
                                                              <tr className="border-b border-border/30 text-left">
                                                                <th className="p-1.5 w-8"></th>
                                                                {visibleColumnsAPS.map(col => (
                                                                  <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{col.label}</th>
                                                                ))}
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {thirdItems.filter(i => !isIMArticle(i)).map((item) => (
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
                                                                  {visibleColumnsAPS.map(col => renderAPSCell(item, col, 'p-1.5', isDark))}
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        )}
                                                        {thirdItems.filter(i => isIMArticle(i)).length > 0 && (
                                                          <>
                                                            <div className={`px-2 py-1 mt-1 border-b ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                                                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                                                Artículos de Impresión
                                                              </span>
                                                            </div>
                                                            <table className="w-full text-xs">
                                                              <thead>
                                                                <tr className="border-b border-border/30 text-left">
                                                                  <th className="p-1.5 w-8"></th>
                                                                  {TABLE_COLUMNS_IM_APS.map(col => (
                                                                    <th key={col.field} className={`p-1.5 text-[10px] font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{col.label}</th>
                                                                  ))}
                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {thirdItems.filter(i => isIMArticle(i)).map((item) => (
                                                                  <tr
                                                                    key={item.rsv_ids}
                                                                    id={`row-aps-${item.rsv_ids}`}
                                                                    className={`border-t border-border/30 hover:bg-blue-900/10 transition-colors ${
                                                                      selectedItemsAPS.has(String(item.rsv_ids)) ? 'bg-blue-500/20' : ''
                                                                    }`}
                                                                  >
                                                                    <td className="p-1.5 w-8">
                                                                      <button
                                                                        onClick={() => toggleItemSelectionAPS(String(item.rsv_ids))}
                                                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                                          selectedItemsAPS.has(String(item.rsv_ids))
                                                                            ? 'bg-blue-600 border-blue-600'
                                                                            : 'border-blue-500/50 hover:border-blue-400'
                                                                        }`}
                                                                      >
                                                                        {selectedItemsAPS.has(String(item.rsv_ids)) && (
                                                                          <Check className="h-2.5 w-2.5 text-white" />
                                                                        )}
                                                                      </button>
                                                                    </td>
                                                                    {TABLE_COLUMNS_IM_APS.map(col => renderIMAPSCell(item, col, 'p-1.5', isDark))}
                                                                  </tr>
                                                                ))}
                                                              </tbody>
                                                            </table>
                                                          </>
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
          <div className={`relative ${isDark ? 'bg-[#1a1025] border-purple-900/30' : 'bg-white border-purple-200'} border rounded-xl w-full max-w-xl mx-4 h-[600px] flex flex-col`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
              <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <MessageSquare className="h-5 w-5 text-purple-400" />
                Comentarios
                {comentarios.length > 0 && (
                  <span className="text-sm text-muted-foreground">({comentarios.length})</span>
                )}
              </h3>
              <button
                onClick={() => setShowComments(false)}
                className={`p-1 ${isDark ? 'hover:bg-purple-900/30' : 'hover:bg-purple-100'} rounded-lg transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto p-3 divide-y ${isDark ? 'divide-purple-900/20' : 'divide-purple-100'} flex flex-col scrollbar-purple`}>
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
                        <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.autor_nombre || 'Usuario'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(c.fecha)}</span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-600'} mt-0.5`}>{c.contenido}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>
            <div className={`p-3 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200'}`}>
              <div className="flex items-center gap-2">
                <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="md" />
                <div className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'bg-purple-900/20 border-purple-900/30' : 'bg-purple-50 border-purple-200'} border focus-within:border-purple-500`}>
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
          <div className={`relative ${isDark ? 'bg-[#1a1025] border-red-900/30' : 'bg-white border-red-200'} border rounded-xl w-full max-w-md mx-4 p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Minus className="h-5 w-5 text-red-400" />
                Requiere autorización
              </h3>
              <button
                onClick={handleCloseRemoveAPSModal}
                className={`p-1 ${isDark ? 'hover:bg-red-900/30' : 'hover:bg-red-100'} rounded-lg transition-colors`}
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
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} transition-colors`}
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
                <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-600'} mb-6`}>
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
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-center`}>
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
                        className={`flex-1 px-3 py-2 text-sm text-center tracking-widest font-mono rounded-lg ${isDark ? 'bg-purple-900/20 border-purple-900/30' : 'bg-purple-50 border-purple-200'} border focus:border-purple-500 focus:outline-none placeholder:text-muted-foreground`}
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
                      className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !postingToSAP && !postSAPResult && setShowPostSAPModal(false)}>
          <div className={`${isDark ? 'bg-[#1a1025] border-purple-900/50' : 'bg-white border-purple-200'} border rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Enviar a SAP</h3>
              <button
                onClick={() => {
                  setShowPostSAPModal(false);
                  setPostSAPResult(null);
                }}
                disabled={postingToSAP}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!postSAPResult ? (
              <>
                <div className="mb-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'} font-medium`}>⚠️ Esta acción no se puede deshacer</p>
                    <p className={`text-xs ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'} mt-1`}>Se creará un Delivery Note en SAP. Verifica que los datos sean correctos antes de enviar.</p>
                  </div>
                  {previewDeliveryNote && (
                    <div className={`${isDark ? 'bg-purple-900/20' : 'bg-purple-50'} rounded-lg p-3 space-y-2 text-xs`}>
                      {campana && isMigratedCampaign(campana) ? (
                        <>
                          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1 mb-1">
                            <span className="text-cyan-300 text-[10px] font-medium">POST IMU (Migración INVIAN)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Campaña:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_CRM_Camp || campana.nombre}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CardCode:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.CardCode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Razón Social:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-right max-w-[200px]`}>{previewDeliveryNote.U_CRM_R_S || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>BaseType (en líneas):</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.DocumentLines?.[0]?.BaseType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>BaseEntry (en líneas):</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>(se resuelve al enviar)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Base SAP:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{campana.sap_database || 'TEST'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Campaña:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_CRM_Camp}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CardCode:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.CardCode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Razón Social:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-right max-w-[200px]`}>{previewDeliveryNote.U_CRM_R_S || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Marca:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_CRM_Marca || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Series:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.Series}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>APS:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_IMU_ART_APS}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Asesor:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_CRM_Asesor || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Agencia:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{previewDeliveryNote.U_CRM_Agencia || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Base SAP:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{campana?.sap_database || 'TEST'}</span>
                          </div>
                        </>
                      )}
                      <hr className={`${isDark ? 'border-purple-800/40' : 'border-purple-200'}`} />
                      <p className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} font-medium`}>Líneas ({previewDeliveryNote.DocumentLines.length}):</p>
                      {previewDeliveryNote.DocumentLines.map((line: any, i: number) => (
                        <div key={i} className={`${isDark ? 'bg-purple-950/30' : 'bg-purple-50'} rounded p-2 space-y-1`}>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Artículo:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{line.ItemCode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cantidad:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{line.Quantity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Tarifa:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>${Number(line.UnitPrice).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Periodo:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{line.U_dscPeriod}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Estatus:</span>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{line.U_dscTAsig}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowPostSAPModal(false)}
                    disabled={postingToSAP}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-200 hover:bg-gray-100'} transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
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
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-4`}>{postSAPResult.message}</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-red-400 mb-2">Error</p>
                    <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} mb-3 font-medium`}>{postSAPResult.message}</p>

                    {postSAPResult.detail?.partialSuccess && (
                      <div className={`mb-4 p-3 rounded-lg text-left text-xs ${isDark ? 'bg-amber-900/30 border border-amber-500/40 text-amber-200' : 'bg-amber-50 border border-amber-300 text-amber-900'}`}>
                        <p className="font-semibold mb-1">⚠ Resultado parcial</p>
                        <p>{postSAPResult.detail.successCount} APS sí se postearon a SAP y ya están marcados como posteados. Los {postSAPResult.detail.failedCount} fallidos puedes reintentarlos sin duplicar los exitosos.</p>
                      </div>
                    )}

                    {postSAPResult.detail?.errorType && (
                      <div className={`mb-3 p-3 rounded-lg text-left text-xs ${isDark ? 'bg-zinc-800/60 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
                        <p className={`font-semibold mb-2 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Qué pasó:</p>
                        {postSAPResult.detail.errorType === 'network' && (
                          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            El navegador <b>no pudo llegar al servidor SAP</b>. Causas comunes:
                            tunnel de Cloudflare caído, internet inestable, o la URL del relay SAP cambió.
                            <br />
                            <b>Qué hacer:</b> refresca la página (Ctrl+Shift+R) y reintenta. Si sigue, avisa a TI.
                          </p>
                        )}
                        {postSAPResult.detail.errorType === 'cors' && (
                          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            El navegador <b>bloqueó la respuesta por CORS</b>. Generalmente significa que el
                            tunnel respondió HTML de error en vez del JSON esperado.
                            <br />
                            <b>Qué hacer:</b> avisa a TI que verifique el tunnel.
                          </p>
                        )}
                        {postSAPResult.detail.errorType === 'parse' && (
                          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            <b>SAP respondió pero el contenido no es JSON válido</b>. Es posible que el delivery
                            note SÍ se haya creado en SAP, pero la respuesta llegó mal.
                            <br />
                            <b>Qué hacer:</b> antes de reintentar, verifica en SAP si ya existe el delivery note
                            de esta campaña — si existe, no le des POST otra vez.
                          </p>
                        )}
                        {postSAPResult.detail.errorType === 'http-error' && (
                          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            <b>Error HTTP {postSAPResult.detail.status}</b> del servidor SAP.
                            {postSAPResult.detail.status === 500 && ' Error interno de SAP — generalmente un problema temporal.'}
                            {postSAPResult.detail.status === 401 && ' Sesión SAP expirada — reintenta y debería renovar sola.'}
                            {postSAPResult.detail.status === 502 && ' Bad Gateway — el tunnel o SAP están caídos.'}
                            {postSAPResult.detail.status === 503 && ' Servicio SAP no disponible.'}
                          </p>
                        )}
                        {postSAPResult.detail.errorType === 'sap-rejected' && (
                          <p className={`${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                            <b>SAP rechazó el delivery note</b> por una validación de negocio (cliente inactivo,
                            precio, código mal, etc). Lee el mensaje de arriba y corrige antes de reintentar.
                          </p>
                        )}
                        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'} text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {postSAPResult.detail.endpoint && <div>endpoint: {postSAPResult.detail.endpoint}</div>}
                          {postSAPResult.detail.status !== undefined && <div>status: {postSAPResult.detail.status}</div>}
                          <div>tipo: {postSAPResult.detail.errorType}</div>
                        </div>
                        {postSAPResult.detail.rawResponse && (
                          <details className="mt-2">
                            <summary className={`cursor-pointer text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Ver respuesta cruda</summary>
                            <pre className={`mt-1 p-2 rounded text-[9px] overflow-auto max-h-32 ${isDark ? 'bg-zinc-950 text-zinc-400' : 'bg-white text-gray-600'}`}>{postSAPResult.detail.rawResponse}</pre>
                          </details>
                        )}
                      </div>
                    )}
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

      {/* Modal Historial de posteos — bitácora de a quién se mandó cada APS.
          Cada fila es un snapshot tomado al momento del POST, así que sigue
          siendo correcto aunque después le cambien el cliente a la campaña. */}
      {showPostLogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPostLogModal(false)}>
          <div
            className={`rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col ${isDark ? 'bg-zinc-900 border border-purple-500/20' : 'bg-white border border-purple-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <History className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`} />
                <div>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Historial de posteos a SAP</h3>
                  <p className="text-xs text-muted-foreground">
                    A quién se mandó cada APS ({postLog.length} registro{postLog.length !== 1 ? 's' : ''})
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPostLogModal(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-auto p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`${isDark ? 'text-purple-300' : 'text-purple-700'} text-left`}>
                    <th className="px-2 py-2 font-semibold">APS</th>
                    <th className="px-2 py-2 font-semibold">Posteado a</th>
                    <th className="px-2 py-2 font-semibold">Razón social</th>
                    <th className="px-2 py-2 font-semibold">CUIC</th>
                    <th className="px-2 py-2 font-semibold">CardCode</th>
                    <th className="px-2 py-2 font-semibold">BD</th>
                    <th className="px-2 py-2 font-semibold">DocNum</th>
                    <th className="px-2 py-2 font-semibold">Resultado</th>
                    <th className="px-2 py-2 font-semibold">Fecha</th>
                    <th className="px-2 py-2 font-semibold">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {postLog.map(p => (
                    <tr key={p.id} className={`border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                      <td className={`px-2 py-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.aps}</td>
                      <td className={`px-2 py-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {p.marca || p.cliente_nombre || p.razon_social || '—'}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{p.razon_social || '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.cuic ?? '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.card_code || '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.sap_database || '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{p.doc_num ?? '—'}</td>
                      <td className="px-2 py-2">
                        {p.success ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">OK</span>
                        ) : (
                          <span
                            title={p.error_msg || 'Error'}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 cursor-help"
                          >
                            ERROR
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                        {p.posted_at ? new Date(p.posted_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{p.usuario_nombre || '—'}</td>
                    </tr>
                  ))}
                  {postLog.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                        Todavía no hay posteos registrados para esta campaña.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar POST SAP */}
      {showCancelPostSAPModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !cancellingPostSAP && setShowCancelPostSAPModal(false)}>
          <div className={`rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 ${isDark ? 'bg-zinc-900 border border-red-500/20' : 'bg-white border border-red-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-500" />
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cancelar POST a SAP</h2>
            </div>
            {!cancelPostSAPResult ? (
              <>
                <p className={`text-sm mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  {selectedItemsAPS.size > 0
                    ? `¿Cancelar el POST de los ${selectedItemsAPS.size} APS seleccionados?`
                    : `¿Cancelar el POST de todos los APS enviados a SAP en esta campaña?`}
                </p>
                <p className={`text-xs mb-6 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Esta acción marcará los APS como no enviados y permitirá volver a hacer POST.
                </p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowCancelPostSAPModal(false)} className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    Cerrar
                  </button>
                  <button
                    onClick={handleCancelPostSAP}
                    disabled={cancellingPostSAP}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {cancellingPostSAP ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {cancellingPostSAP ? 'Cancelando...' : 'Confirmar Cancelar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${cancelPostSAPResult.success ? (isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700')}`}>
                  {cancelPostSAPResult.success ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span className="text-sm">{cancelPostSAPResult.message}</span>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowCancelPostSAPModal(false)} className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Campaña Modal — lazy-mount completo: el componente sólo existe
          en el árbol cuando el modal está realmente abierto. Antes vivía en
          memoria todo el tiempo que `campana` estaba cargada, con sus hooks
          (useState/useEffect/useQuery) ejecutando aunque estuviera cerrado. */}
      {editModalOpen && campana && (
        <AssignInventarioCampanaModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          campana={campana}
        />
      )}
    </div>
  );
}
