import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  RefreshCw,
  Layers,
  ArrowUpDown,
  Plus,
  Edit,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  ChevronLeft,
  X,
  Clock,
  User,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Upload,
  Check,
  Image,
  Eye,
  Camera,
  ClipboardList,
  Info,
  Palette,
  Edit3,
  Trash2,
  MessageSquare,
  MapPin,
  Send,
  History,
  Printer,
  ExternalLink,
  GripVertical,
  Play,
  Film,
  Video,
  Monitor,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioConArte, TareaCampana, ArteExistente, DigitalFileSummary } from '../../services/campanas.service';
import { proveedoresService } from '../../services/proveedores.service';
import { Proveedor, Catorcena } from '../../types';
import { solicitudesService } from '../../services/solicitudes.service';
import { Badge } from '../../components/ui/badge';
import { ConfirmModal } from '../../components/ui/confirm-modal';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketCampana } from '../../hooks/useSocket';
import * as XLSX from 'xlsx';

// URL base para archivos estáticos
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

// Helper para normalizar URLs de imágenes
// Siempre extrae el path y usa STATIC_URL para evitar problemas de CORS y URLs hardcodeadas
const getImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;

  // Ignorar placeholder "sin_arte"
  if (url === 'sin_arte') return null;

  // Si es un data URL (base64), usarlo directamente
  if (url.startsWith('data:')) {
    return url;
  }

  // Si ya es una ruta relativa que empieza con /uploads, usar directamente con STATIC_URL
  if (url.startsWith('/uploads')) {
    return `${STATIC_URL}${url}`;
  }

  // Si es una URL completa (http:// o https://), extraer solo el path
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      // Asegurarse de que el path empiece con /uploads
      if (path.includes('/uploads')) {
        return `${STATIC_URL}${path}`;
      }
      // Si no tiene /uploads, podría ser una URL externa válida
      return url;
    } catch {
      // Si falla el parseo, intentar extraer el path manualmente
      const match = url.match(/https?:\/\/[^/]+(\/uploads\/.+)/);
      if (match) {
        return `${STATIC_URL}${match[1]}`;
      }
      return url;
    }
  }

  // Si es una ruta relativa sin /uploads, agregar el path base
  if (url.startsWith('/')) {
    return `${STATIC_URL}${url}`;
  }

  // Si parece ser solo el nombre del archivo, construir la ruta completa
  if (url.includes('.') && !url.includes('/')) {
    return `${STATIC_URL}/uploads/artes/${url}`;
  }

  // Fallback: agregar slash al inicio
  return `${STATIC_URL}/${url}`;
};

// ============================================================================
// TYPES
// ============================================================================

type MainTab = 'versionario' | 'atender' | 'programacion' | 'impresiones' | 'testigo';
type FormatTab = 'tradicional' | 'digital';
type TasksTab = 'tradicionales' | 'completadas' | 'calendario';
type CalendarView = 'month' | 'week' | 'day' | 'list';

// Opciones de agrupación
type GroupByField = 'none' | 'catorcena' | 'ciudad' | 'plaza' | 'mueble' | 'tipo_medio' | 'aps' | 'grupo' | 'estado_arte' | 'estado_tarea';
type SortField = 'codigo_unico' | 'catorcena' | 'ciudad' | 'plaza' | 'mueble' | 'tipo_medio' | 'aps';
type SortDirection = 'asc' | 'desc';

interface InventoryFilters {
  ciudad: string;
  plaza: string;
  mueble: string;
  tipo_medio: string;
  catorcena: number | null;
}

// Opciones para los selectores
const GROUP_BY_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: 'none', label: 'Sin agrupar' },
  { value: 'catorcena', label: 'Por Catorcena' },
  { value: 'ciudad', label: 'Por Ciudad' },
  { value: 'plaza', label: 'Por Plaza' },
  { value: 'mueble', label: 'Por Mueble' },
  { value: 'tipo_medio', label: 'Por Tipo de Medio' },
  { value: 'aps', label: 'Por APS' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'codigo_unico', label: 'Código' },
  { value: 'catorcena', label: 'Catorcena' },
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'plaza', label: 'Plaza' },
  { value: 'mueble', label: 'Mueble' },
  { value: 'tipo_medio', label: 'Tipo de Medio' },
  { value: 'aps', label: 'APS' },
];

interface InventoryRow {
  id: string;
  rsv_id: string; // IDs de reserva concatenados
  codigo_unico: string;
  tipo_de_cara: string;
  catorcena: number;
  anio: number;
  aps: number | null;
  grupo_id: string | null; // grupo_completo_id para agrupar
  estatus: string; // Estado de reserva (Vendido, etc.)
  espacio: string; // Números de espacio
  inicio_periodo: string;
  fin_periodo: string;
  caras_totales: number;
  // Campos de inventario
  tipo_medio: string; // Flujo, Estático, etc.
  mueble: string; // Parabus, Mupie, etc. (Formato)
  ciudad: string;
  plaza: string;
  municipio: string;
  nse: string; // Nivel socioeconómico
  ubicacion: string; // Dirección completa
  tradicional_digital: 'Tradicional' | 'Digital';
  ancho?: number | string; // Ancho del inventario
  alto?: number | string; // Alto del inventario
  latitud?: number; // Para mapa
  longitud?: number; // Para mapa
  // Para Atender arte
  estado_arte?: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado';
  estado_tarea?: 'sin_atender' | 'en_progreso' | 'atendido';
  archivo_arte?: string;
  arte_aprobado?: string; // Texto original de arte_aprobado
  imu?: number | string;
  // Para Testigo
  testigo_status?: 'pendiente' | 'validado' | 'rechazado';
}

interface TaskRow {
  id: string;
  tipo: string;
  estatus: string; // Valores de BD: 'Activo', 'Pendiente', 'Atendido', etc.
  identificador: string;
  fecha_inicio: string;
  fecha_fin: string;
  creador: string;
  asignado: string;
  descripcion: string;
  titulo: string;
  contenido?: string;
  responsable?: string;
  ids_reservas?: string; // IDs de reservas como string separado por comas
  inventario_ids: string[];
  campana_id: number;
  // Campos para tareas de Impresión
  evidencia?: string; // JSON con datos de impresiones
  nombre_proveedores?: string;
  proveedores_id?: number;
  num_impresiones?: number;
  // Campos para tareas de Testigo
  archivo_testigo?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'tarea' | 'entrega';
}

// Tipos para el sistema de decisiones de revisión de artes
type DecisionArte = 'aprobar' | 'rechazar' | null;

interface ArteDecision {
  decision: DecisionArte;
  motivoRechazo?: string; // Usado para rechazo (obligatorio)
  comentarioAprobacion?: string; // Usado para aprobación (opcional)
}

type DecisionesState = Record<string, ArteDecision>;

// Tipos para filtros avanzados (como en CampanaDetailPage)
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

// Operadores disponibles para filtros
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

// Campos disponibles para filtros en cada tabla
const FILTER_FIELDS_INVENTARIO: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Código Único', type: 'string' },
  { field: 'mueble', label: 'Formato', type: 'string' },
  { field: 'ciudad', label: 'Ciudad', type: 'string' },
  { field: 'plaza', label: 'Plaza', type: 'string' },
  { field: 'municipio', label: 'Municipio', type: 'string' },
  { field: 'ubicacion', label: 'Ubicación', type: 'string' },
  { field: 'nse', label: 'NSE', type: 'string' },
  { field: 'tipo_de_cara', label: 'Tipo Cara', type: 'string' },
  { field: 'catorcena', label: 'Catorcena', type: 'number' },
  { field: 'aps', label: 'APS', type: 'number' },
];

// Campos de filtro extendidos para el modal de Programación (incluye nombre de archivo)
const FILTER_FIELDS_PROGRAMACION_MODAL: FilterFieldConfig[] = [
  ...FILTER_FIELDS_INVENTARIO,
  { field: 'nombre_archivo', label: 'Nombre Archivo', type: 'string' },
];

// Campos disponibles para filtros en tareas de producción
const FILTER_FIELDS_TAREAS: FilterFieldConfig[] = [
  { field: 'tipo', label: 'Tipo', type: 'string' },
  { field: 'estatus', label: 'Estatus', type: 'string' },
  { field: 'titulo', label: 'Título', type: 'string' },
  { field: 'identificador', label: 'Identificador', type: 'string' },
  { field: 'creador', label: 'Creador', type: 'string' },
  { field: 'asignado', label: 'Asignado', type: 'string' },
  { field: 'descripcion', label: 'Descripción', type: 'string' },
];

// Opciones de agrupación para las tablas
const GROUPING_OPTIONS_INVENTARIO: { field: GroupByField; label: string }[] = [
  { field: 'catorcena', label: 'Catorcena' },
  { field: 'aps', label: 'APS' },
  { field: 'grupo', label: 'Grupo' },
  { field: 'estado_arte', label: 'Estado Arte' },
  { field: 'estado_tarea', label: 'Estado Tarea' },
  { field: 'ciudad', label: 'Ciudad' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'mueble', label: 'Formato' },
  { field: 'tipo_medio', label: 'Tipo Medio' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

const estadoArteLabels: Record<string, string> = {
  sin_revisar: 'Arte Sin revisar',
  en_revision: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

// Función para obtener la clave de agrupación basada en el campo
function getGroupKeyForField(item: InventoryRow, field: GroupByField): string {
  switch (field) {
    case 'catorcena':
      return `Catorcena ${item.catorcena} - ${item.anio}`;
    case 'aps':
      return `APS ${item.aps ?? 'Sin asignar'}`;
    case 'grupo':
      return item.grupo_id ? `Grupo ${item.grupo_id}` : `Item ${item.id}`;
    case 'estado_arte':
      return estadoArteLabels[item.estado_arte || 'sin_revisar'] || 'Sin estado';
    case 'estado_tarea':
      return estadoTareaLabels[item.estado_tarea || 'sin_atender'] || 'Sin estado';
    case 'ciudad':
      return item.ciudad || 'Sin ciudad';
    case 'plaza':
      return item.plaza || 'Sin plaza';
    case 'mueble':
      return item.mueble || 'Sin formato';
    case 'tipo_medio':
      return item.tipo_medio || 'Sin tipo';
    default:
      return 'Sin agrupar';
  }
}

const estadoTareaLabels: Record<string, string> = {
  sin_atender: 'Sin Atender',
  en_progreso: 'En progreso',
  atendido: 'Instalado',
};

const statusColors: Record<string, string> = {
  sin_revisar: 'bg-zinc-500/20 text-zinc-400',
  en_revision: 'bg-amber-500/20 text-amber-400',
  aprobado: 'bg-green-500/20 text-green-400',
  rechazado: 'bg-red-500/20 text-red-400',
  sin_atender: 'bg-zinc-500/20 text-zinc-400',
  en_progreso: 'bg-blue-500/20 text-blue-400',
  atendido: 'bg-green-500/20 text-green-400',
  pendiente: 'bg-amber-500/20 text-amber-400',
  completada: 'bg-green-500/20 text-green-400',
  cancelada: 'bg-red-500/20 text-red-400',
  // Valores de la BD (con mayúscula)
  'Activo': 'bg-green-500/20 text-green-400',
  'Pendiente': 'bg-amber-500/20 text-amber-400',
  'Atendido': 'bg-blue-500/20 text-blue-400',
  'En Progreso': 'bg-blue-500/20 text-blue-400',
  'Completado': 'bg-green-500/20 text-green-400',
  'Cancelado': 'bg-red-500/20 text-red-400',
  'Notificación': 'bg-purple-500/20 text-purple-400',
  validado: 'bg-green-500/20 text-green-400',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Toolbar Component
function Toolbar({
  searchValue,
  onSearchChange,
  onFilter,
  onDownload,
  onGroup,
  onSort,
  showGrouping = false,
  isGrouped = false,
  hasActiveFilters = false,
  hasActiveSort = false,
  groupCount = 0,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilter: () => void;
  onDownload: () => void;
  onGroup?: () => void;
  onSort: () => void;
  showGrouping?: boolean;
  isGrouped?: boolean;
  hasActiveFilters?: boolean;
  hasActiveSort?: boolean;
  groupCount?: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Filtrar */}
        <button
          onClick={onFilter}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            hasActiveFilters
              ? 'bg-purple-600 text-white'
              : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
          }`}
          title="Filtrar"
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
        {/* Agrupar */}
        {showGrouping && onGroup && (
          <button
            onClick={onGroup}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
              isGrouped
                ? 'bg-purple-600 text-white'
                : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
            }`}
            title="Agrupar"
          >
            <Layers className="h-3.5 w-3.5" />
            {groupCount > 0 && (
              <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">
                {groupCount}
              </span>
            )}
          </button>
        )}
        {/* Ordenar */}
        <button
          onClick={onSort}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            hasActiveSort
              ? 'bg-purple-600 text-white'
              : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
          }`}
          title="Ordenar"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
        {/* Descargar */}
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-900/50 hover:bg-green-900/70 border border-green-500/30 rounded-lg transition-colors"
          title="Descargar CSV"
        >
          <Download className="h-3.5 w-3.5 text-green-400" />
        </button>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({
  message,
  description,
  icon: Icon = FileText,
  action,
  onAction,
}: {
  message: string;
  description?: string;
  icon?: typeof FileText;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mb-4 opacity-60" />
      <p className="text-base font-semibold text-zinc-300">{message}</p>
      {description && <p className="text-sm mt-2 text-center max-w-md text-zinc-400">{description}</p>}
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const label = labels ? labels[status] || status : status;
  const colorClass = statusColors[status] || 'bg-zinc-500/20 text-zinc-400';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

// Tree Node Component (for grouped view)
function TreeNode({
  label,
  count,
  level,
  isExpanded,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-900/20 transition-colors ${
          level === 0 ? 'bg-purple-900/10' : ''
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-purple-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-purple-400 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </button>
      {isExpanded && children}
    </div>
  );
}

// Upload Art Modal Types
type UploadOption = 'file' | 'existing' | 'link';
type TaskDetailTab = 'resumen' | 'editar' | 'atender';
type GroupByArte = 'inventario' | 'ciudad' | 'grupo';

// Tipo para archivos digitales con posición de spot
interface DigitalFile {
  id: string;
  file: File;
  preview: string;
  spot: number;
  type: 'image' | 'video';
}

// Tipo para imágenes digitales del backend
interface ImagenDigitalView {
  id: number;
  archivo: string;
  archivoData?: string; // Base64 data URL
  spot: number;
  tipo: 'image' | 'video';
  estado: string;
}

// Digital Gallery Modal Component
function DigitalGalleryModal({
  isOpen,
  onClose,
  imagenes,
  isLoading,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  imagenes: ImagenDigitalView[];
  isLoading: boolean;
  title?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagenes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < imagenes.length - 1 ? prev + 1 : 0));
  };

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentImage = imagenes[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-400" />
            {title || 'Galería Digital'}
            <Badge className="bg-cyan-600/30 text-cyan-300 border-cyan-500/30 text-[10px]">
              {imagenes.length} archivo{imagenes.length !== 1 ? 's' : ''}
            </Badge>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-cyan-900/30 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : imagenes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No hay archivos digitales</p>
              </div>
            </div>
          ) : (
            <>
              {/* Main viewer */}
              <div className="flex-1 relative bg-black rounded-lg flex items-center justify-center min-h-[300px]">
                {currentImage?.tipo === 'video' ? (
                  <video
                    key={currentImage.id}
                    src={getImageUrl(currentImage.archivoData || currentImage.archivo) || ''}
                    controls
                    controlsList="nodownload"
                    className="max-w-full max-h-[450px] rounded"
                    style={{ minHeight: '200px' }}
                  />
                ) : (
                  <img
                    key={currentImage?.id}
                    src={getImageUrl(currentImage?.archivoData || currentImage?.archivo) || ''}
                    alt={`Imagen ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

                {/* Navigation arrows */}
                {imagenes.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Spot indicator */}
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs">
                  Spot {currentImage?.spot} de {imagenes.length}
                </div>
              </div>

              {/* Thumbnails */}
              {imagenes.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto py-2 px-1">
                  {imagenes.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                        index === currentIndex
                          ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                          : 'border-transparent hover:border-cyan-400/50'
                      }`}
                    >
                      {img.tipo === 'video' ? (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <Play className="h-6 w-6 text-cyan-400" />
                        </div>
                      ) : (
                        <img
                          src={getImageUrl(img.archivoData || img.archivo) || ''}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-center py-0.5">
                        {img.spot}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Upload Art Modal Component
function UploadArtModal({
  isOpen,
  onClose,
  selectedInventory,
  onSubmit,
  onSubmitDigital,
  artesExistentes,
  isLoadingArtes,
  isSubmitting,
  error,
  campanaId,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedInventory: InventoryRow[];
  onSubmit: (data: { option: UploadOption; value: string | File; inventoryIds: string[] }) => void;
  onSubmitDigital?: (data: { files: { file: File; spot: number }[]; inventoryIds: string[] }) => void;
  artesExistentes: ArteExistente[];
  isLoadingArtes: boolean;
  isSubmitting: boolean;
  error: string | null;
  campanaId: number;
}) {
  const [selectedOption, setSelectedOption] = useState<UploadOption>('file');
  const [existingArtUrl, setExistingArtUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ nombre: string; usos: number; url: string } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Estado para archivos digitales (múltiples)
  const [digitalFiles, setDigitalFiles] = useState<DigitalFile[]>([]);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);

  // Detectar si todos los items seleccionados son digitales
  const isDigitalInventory = useMemo(() => {
    if (selectedInventory.length === 0) return false;
    return selectedInventory.every(item => item.tradicional_digital === 'Digital');
  }, [selectedInventory]);

  // Filtros y ordenamiento para la lista de items
  const [modalSearch, setModalSearch] = useState('');
  const [modalGroupBy, setModalGroupBy] = useState<'none' | 'aps' | 'catorcena' | 'grupo'>('none');
  const [modalSortBy, setModalSortBy] = useState<'codigo' | 'aps' | 'catorcena'>('codigo');

  // Preview URL basado en la opción seleccionada
  const previewUrl = useMemo(() => {
    if (selectedOption === 'existing' && existingArtUrl) {
      return existingArtUrl;
    }
    if (selectedOption === 'file' && filePreview) {
      return filePreview;
    }
    if (selectedOption === 'link' && link) {
      // Validar que sea una URL válida de imagen
      try {
        new URL(link);
        return link;
      } catch {
        return null;
      }
    }
    return null;
  }, [selectedOption, existingArtUrl, filePreview, link]);

  // Filtrar y ordenar inventario
  const filteredModalInventory = useMemo(() => {
    let data = [...selectedInventory];

    // Buscar
    if (modalSearch) {
      const search = modalSearch.toLowerCase();
      data = data.filter(item =>
        item.codigo_unico.toLowerCase().includes(search) ||
        item.ubicacion.toLowerCase().includes(search) ||
        item.mueble.toLowerCase().includes(search)
      );
    }

    // Ordenar
    data.sort((a, b) => {
      switch (modalSortBy) {
        case 'aps':
          return (a.aps || 0) - (b.aps || 0);
        case 'catorcena':
          return a.catorcena - b.catorcena;
        default:
          return a.codigo_unico.localeCompare(b.codigo_unico);
      }
    });

    return data;
  }, [selectedInventory, modalSearch, modalSortBy]);

  // Agrupar inventario
  const groupedModalInventory = useMemo(() => {
    if (modalGroupBy === 'none') return null;

    const groups: Record<string, InventoryRow[]> = {};
    filteredModalInventory.forEach(item => {
      let key = '';
      switch (modalGroupBy) {
        case 'aps':
          key = `APS ${item.aps}`;
          break;
        case 'catorcena':
          key = `Catorcena ${item.catorcena}`;
          break;
        case 'grupo':
          key = `Grupo ${item.grupo_id || item.id}`;
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredModalInventory, modalGroupBy]);

  // Manejar cambio de archivo (tradicional)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setDuplicateWarning(null);

    // Crear preview si es imagen
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);

      // Verificar si existe un archivo con el mismo nombre
      try {
        setIsCheckingDuplicate(true);
        const verificacion = await campanasService.verificarArteExistente(campanaId, { nombre: selectedFile.name });
        if (verificacion.existe && verificacion.url) {
          setDuplicateWarning({
            nombre: verificacion.nombre,
            usos: verificacion.usos,
            url: verificacion.url,
          });
        }
      } catch (err) {
        console.error('Error verificando duplicado:', err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    } else {
      setFilePreview(null);
    }
  };

  // Manejar cambio de archivos digitales (múltiples)
  const handleDigitalFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: DigitalFile[] = [];
    const currentMaxSpot = digitalFiles.length > 0 ? Math.max(...digitalFiles.map(f => f.spot)) : 0;

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) return; // Solo aceptar videos e imágenes

      const reader = new FileReader();
      reader.onload = (event) => {
        const newFile: DigitalFile = {
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: event.target?.result as string,
          spot: currentMaxSpot + index + 1,
          type: isVideo ? 'video' : 'image',
        };
        setDigitalFiles(prev => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });

    // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
    e.target.value = '';
  };

  // Eliminar un archivo digital
  const handleRemoveDigitalFile = (id: string) => {
    setDigitalFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // Reordenar spots después de eliminar
      return filtered.map((f, index) => ({ ...f, spot: index + 1 }));
    });
  };

  // Manejar drag start para reordenar
  const handleDragStart = (id: string) => {
    setDraggedFile(id);
  };

  // Manejar drag over
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedFile || draggedFile === targetId) return;

    setDigitalFiles(prev => {
      const draggedIndex = prev.findIndex(f => f.id === draggedFile);
      const targetIndex = prev.findIndex(f => f.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newFiles = [...prev];
      const [removed] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, removed);

      // Actualizar spots después de reordenar
      return newFiles.map((f, index) => ({ ...f, spot: index + 1 }));
    });
  };

  // Manejar drag end
  const handleDragEnd = () => {
    setDraggedFile(null);
  };

  const handleSubmit = () => {
    // Si es digital y hay archivos digitales, usar el handler de digital
    if (isDigitalInventory && digitalFiles.length > 0 && onSubmitDigital) {
      onSubmitDigital({
        files: digitalFiles.map(f => ({ file: f.file, spot: f.spot })),
        inventoryIds: selectedInventory.map((i) => i.id),
      });
      return;
    }

    // Flujo tradicional
    let value: string | File = '';
    if (selectedOption === 'existing') {
      value = existingArtUrl;
    } else if (selectedOption === 'file' && file) {
      value = file;
    } else if (selectedOption === 'link') {
      value = link;
    }

    const payload = {
      option: selectedOption,
      value,
      inventoryIds: selectedInventory.map((i) => i.id),
    };
    onSubmit(payload);
  };

  const handleClose = () => {
    setSelectedOption('file');
    setExistingArtUrl('');
    setFile(null);
    setFilePreview(null);
    setLink('');
    setModalSearch('');
    setModalGroupBy('none');
    setModalSortBy('codigo');
    setDuplicateWarning(null);
    setDigitalFiles([]);
    setDraggedFile(null);
    onClose();
  };

  // Usar el arte existente que coincide
  const handleUseExisting = () => {
    if (duplicateWarning) {
      setSelectedOption('existing');
      setExistingArtUrl(duplicateWarning.url);
      setFile(null);
      setFilePreview(null);
      setDuplicateWarning(null);
    }
  };

  const isSubmitDisabled = () => {
    if (isSubmitting) return true;

    // Para inventario digital
    if (isDigitalInventory) {
      return digitalFiles.length === 0;
    }

    // Para inventario tradicional
    if (isCheckingDuplicate) return true;
    if (duplicateWarning) return true; // No permitir subir si hay duplicado
    if (selectedOption === 'existing' && !existingArtUrl) return true;
    if (selectedOption === 'file' && !file) return true;
    if (selectedOption === 'link' && !link.trim()) return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-400" />
            Asignar Arte
            {isDigitalInventory && (
              <Badge className="bg-cyan-600/30 text-cyan-300 border-cyan-500/30 text-[10px]">
                <Film className="h-3 w-3 mr-1" />
                Digital
              </Badge>
            )}
          </h3>
          <button onClick={handleClose} className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Content - Two columns */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column - Upload Options & Preview */}
            <div className="flex flex-col space-y-4">
              {isDigitalInventory ? (
                /* ===== INTERFAZ DIGITAL - MÚLTIPLES ARCHIVOS ===== */
                <>
                  {/* Header info */}
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Film className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-cyan-300 font-medium">
                          Inventario Digital - Rotación de contenido
                        </p>
                        <p className="text-[10px] text-cyan-400/70 mt-1">
                          Puedes subir múltiples imágenes y/o videos que se mostrarán en rotación.
                          Arrastra para reordenar la secuencia.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* File Input */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Agregar archivos
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleDigitalFilesChange}
                        accept="image/*,video/*"
                        multiple
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 disabled:opacity-50"
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500">
                      Formatos: JPG, PNG, GIF, WEBP, MP4, MOV, WEBM (max 50MB por archivo)
                    </p>
                  </div>

                  {/* Lista de archivos con drag & drop */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-400">
                        Archivos para rotación
                      </label>
                      <Badge className="bg-cyan-600/30 text-cyan-300 border-cyan-500/30 text-[10px]">
                        {digitalFiles.length} archivo{digitalFiles.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="h-64 border border-border rounded-lg bg-zinc-900/50 overflow-auto">
                      {digitalFiles.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-zinc-500">
                          <div>
                            <Upload className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-xs">
                              Selecciona archivos para agregarlos a la rotación
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 space-y-2">
                          {digitalFiles.map((digitalFile, index) => (
                            <div
                              key={digitalFile.id}
                              draggable
                              onDragStart={() => handleDragStart(digitalFile.id)}
                              onDragOver={(e) => handleDragOver(e, digitalFile.id)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-move ${
                                draggedFile === digitalFile.id
                                  ? 'border-cyan-500 bg-cyan-500/20 opacity-50'
                                  : 'border-border bg-background hover:border-cyan-500/50'
                              }`}
                            >
                              {/* Drag Handle */}
                              <div className="flex-shrink-0 text-zinc-500 hover:text-cyan-400 cursor-grab">
                                <GripVertical className="h-4 w-4" />
                              </div>

                              {/* Spot Number */}
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600/30 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-cyan-300">{digitalFile.spot}</span>
                              </div>

                              {/* Preview */}
                              <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-zinc-800">
                                {digitalFile.type === 'video' ? (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-700">
                                    <Play className="h-5 w-5 text-cyan-400" />
                                  </div>
                                ) : (
                                  <img
                                    src={digitalFile.preview}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>

                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate" title={digitalFile.file.name}>
                                  {digitalFile.file.name}
                                </p>
                                <p className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                                  {digitalFile.type === 'video' ? (
                                    <Film className="h-3 w-3 text-cyan-400" />
                                  ) : (
                                    <Image className="h-3 w-3 text-purple-400" />
                                  )}
                                  {digitalFile.type === 'video' ? 'Video' : 'Imagen'} •{' '}
                                  {(digitalFile.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveDigitalFile(digitalFile.id)}
                                className="flex-shrink-0 p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                title="Eliminar archivo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* ===== INTERFAZ TRADICIONAL - UN ARCHIVO ===== */
                <>
                  {/* Option Selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Tipo de subida
                    </label>
                    <select
                      value={selectedOption}
                      onChange={(e) => setSelectedOption(e.target.value as UploadOption)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                      disabled={isSubmitting}
                    >
                      <option value="file">Subir archivo</option>
                      <option value="existing">Escoger existente</option>
                      <option value="link">Subir link</option>
                    </select>
                  </div>

                  {/* Dynamic Input based on option */}
                  <div className="space-y-3">
                    {selectedOption === 'file' && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Seleccionar archivo
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*,.pdf"
                            disabled={isSubmitting}
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 disabled:opacity-50"
                          />
                        </div>
                        {file && (
                          <p className="mt-2 text-xs text-purple-300 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                        {isCheckingDuplicate && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Verificando si el archivo ya existe...
                          </div>
                        )}
                        {duplicateWarning && (
                          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs text-amber-300 font-medium">
                                  Ya existe un archivo con el nombre "{duplicateWarning.nombre}"
                                </p>
                                <p className="text-[10px] text-amber-400/70 mt-1">
                                  Usado {duplicateWarning.usos} {duplicateWarning.usos === 1 ? 'vez' : 'veces'} en esta campaña
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={handleUseExisting}
                                    className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                  >
                                    Usar el existente
                                  </button>
                                  <span className="text-[10px] text-amber-400/50 self-center">
                                    o cambia el nombre del archivo
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="mt-2 text-[10px] text-zinc-500">
                          Formatos permitidos: JPG, PNG, GIF, WEBP, PDF (max 10MB)
                        </p>
                      </div>
                    )}

                    {selectedOption === 'existing' && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Seleccionar arte existente
                        </label>
                        {isLoadingArtes ? (
                          <div className="flex items-center gap-2 py-2 text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Cargando artes...</span>
                          </div>
                        ) : artesExistentes.length === 0 ? (
                          <div className="p-3 bg-zinc-800/50 rounded-lg text-center">
                            <p className="text-xs text-zinc-500">No hay artes existentes en esta campaña</p>
                          </div>
                        ) : (
                          <select
                            value={existingArtUrl}
                            onChange={(e) => setExistingArtUrl(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                            disabled={isSubmitting}
                          >
                            <option value="">-- Selecciona un arte --</option>
                            {artesExistentes.map((art) => (
                              <option key={art.id} value={art.url}>
                                {art.nombre} ({art.usos} uso{art.usos !== 1 ? 's' : ''})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {selectedOption === 'link' && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          URL del arte
                        </label>
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          placeholder="https://ejemplo.com/arte.jpg"
                          disabled={isSubmitting}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>

                  {/* Preview Section */}
                  <div className="flex-1 min-h-0">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Previsualizacion
                    </label>
                    <div className="h-48 border border-border rounded-lg bg-zinc-900/50 flex items-center justify-center overflow-hidden">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : (
                        <div className="text-center text-zinc-500">
                          <Image className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">
                            {selectedOption === 'file' && 'Selecciona un archivo para ver la previsualizacion'}
                            {selectedOption === 'existing' && 'Selecciona un arte existente'}
                            {selectedOption === 'link' && 'Ingresa una URL para ver la previsualizacion'}
                          </p>
                        </div>
                      )}
                      {previewUrl && (
                        <div className="hidden text-center text-zinc-500">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                          <p className="text-xs">No se pudo cargar la imagen</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Column - Selected Items Table */}
            <div className="flex flex-col h-full">
              {/* Header with count and toolbar */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  Espacios a asignar
                </span>
                <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/30">
                  {selectedInventory.length} elemento{selectedInventory.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="relative flex-1 min-w-[100px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 text-[10px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <select
                  value={modalGroupBy}
                  onChange={(e) => setModalGroupBy(e.target.value as typeof modalGroupBy)}
                  className="px-2 py-1 text-[10px] bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                >
                  <option value="none">Sin agrupar</option>
                  <option value="aps">Por APS</option>
                  <option value="catorcena">Por Catorcena</option>
                  <option value="grupo">Por Grupo</option>
                </select>
                <select
                  value={modalSortBy}
                  onChange={(e) => setModalSortBy(e.target.value as typeof modalSortBy)}
                  className="px-2 py-1 text-[10px] bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                >
                  <option value="codigo">Codigo</option>
                  <option value="aps">APS</option>
                  <option value="catorcena">Catorcena</option>
                </select>
              </div>

              {/* Table */}
              <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
                <div className="h-full overflow-auto">
                  {groupedModalInventory ? (
                    // Grouped Table View
                    <div>
                      {Object.entries(groupedModalInventory).map(([groupKey, items]) => (
                        <div key={groupKey}>
                          <div className="px-3 py-1.5 bg-purple-900/30 sticky top-0 z-10 flex items-center justify-between border-b border-border">
                            <span className="text-[11px] font-semibold text-purple-300">{groupKey}</span>
                            <span className="text-[10px] text-zinc-500">{items.length} items</span>
                          </div>
                          <table className="w-full text-[10px]">
                            <thead className="bg-purple-900/10 sticky top-7 z-[5]">
                              <tr className="text-left border-b border-border/50">
                                <th className="px-2 py-1 font-medium text-purple-300">APS</th>
                                <th className="px-2 py-1 font-medium text-purple-300">Código</th>
                                <th className="px-2 py-1 font-medium text-purple-300">Ubicación</th>
                                <th className="px-2 py-1 font-medium text-purple-300">Mueble</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} className="border-b border-border/30 hover:bg-purple-900/10">
                                  <td className="px-2 py-1.5 text-purple-400 font-medium">{item.aps}</td>
                                  <td className="px-2 py-1.5 text-white font-medium">{item.codigo_unico}</td>
                                  <td className="px-2 py-1.5 text-zinc-400 max-w-[100px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
                                  <td className="px-2 py-1.5 text-zinc-400">{item.mueble}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Flat Table View
                    <table className="w-full text-[10px]">
                      <thead className="bg-purple-900/20 sticky top-0 z-10">
                        <tr className="text-left border-b border-border">
                          <th className="px-2 py-1.5 font-medium text-purple-300">APS</th>
                          <th className="px-2 py-1.5 font-medium text-purple-300">Código</th>
                          <th className="px-2 py-1.5 font-medium text-purple-300">Ubicación</th>
                          <th className="px-2 py-1.5 font-medium text-purple-300">Mueble</th>
                          <th className="px-2 py-1.5 font-medium text-purple-300">Ciudad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalInventory.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                              Sin resultados
                            </td>
                          </tr>
                        ) : (
                          filteredModalInventory.map((item) => (
                            <tr key={item.id} className="border-b border-border/30 hover:bg-purple-900/10">
                              <td className="px-2 py-1.5 text-purple-400 font-medium">{item.aps}</td>
                              <td className="px-2 py-1.5 text-white font-medium">{item.codigo_unico}</td>
                              <td className="px-2 py-1.5 text-zinc-400 max-w-[100px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
                              <td className="px-2 py-1.5 text-zinc-400">{item.mueble}</td>
                              <td className="px-2 py-1.5 text-zinc-400">{item.ciudad}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Guardando...' : 'Asignar Arte'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tipos de tarea disponibles
const TIPOS_TAREA = [
  { value: 'Instalación', label: 'Instalación', description: 'Instalación física del arte en sitio' },
  { value: 'Revisión de artes', label: 'Revisión de artes', description: 'Revisión y aprobación de artes' },
  { value: 'Impresión', label: 'Impresión', description: 'Impresión de materiales publicitarios' },
  { value: 'Testigo', label: 'Testigo', description: 'Validación de instalación con evidencia fotográfica' },
  { value: 'Programación', label: 'Programación', description: 'Programación de artes digitales con indicaciones' },
];

// ============================================================================
// FILTER TOOLBAR COMPONENT (Reutilizable para las 3 tablas)
// ============================================================================
interface FilterToolbarProps {
  filters: FilterCondition[];
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  addFilter: () => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  uniqueValues: Record<string, string[]>;
  activeGroupings: GroupByField[];
  showGrouping: boolean;
  setShowGrouping: (show: boolean) => void;
  toggleGrouping: (field: GroupByField) => void;
  clearGroupings: () => void;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  showSort: boolean;
  setShowSort: (show: boolean) => void;
  setSortField: (field: string | null) => void;
  setSortDirection: (dir: 'asc' | 'desc') => void;
  filteredCount: number;
  totalCount: number;
  useFixedDropdowns?: boolean; // Para modales - usar position fixed
  filterFields?: FilterFieldConfig[]; // Campos personalizados para filtros
  groupingOptions?: { field: GroupByField; label: string }[]; // Opciones de agrupación personalizadas
  hideGrouping?: boolean; // Ocultar botón de agrupación
  hideSort?: boolean; // Ocultar botón de ordenamiento
}

function FilterToolbar({
  filters, showFilters, setShowFilters, addFilter, updateFilter, removeFilter, clearFilters, uniqueValues,
  activeGroupings, showGrouping, setShowGrouping, toggleGrouping, clearGroupings,
  sortField, sortDirection, showSort, setShowSort, setSortField, setSortDirection,
  filteredCount, totalCount, useFixedDropdowns = false,
  filterFields = FILTER_FIELDS_INVENTARIO, groupingOptions = GROUPING_OPTIONS_INVENTARIO,
  hideGrouping = false, hideSort = false,
}: FilterToolbarProps) {
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Función para cerrar un dropdown específico al hacer clic fuera
  const closeOtherDropdowns = (keep: 'filters' | 'grouping' | 'sort') => {
    if (keep !== 'filters') setShowFilters(false);
    if (keep !== 'grouping') setShowGrouping(false);
    if (keep !== 'sort') setShowSort(false);
  };

  // Calcular posición para dropdowns fixed - siempre debajo del botón
  const getDropdownPosition = (btnRef: React.RefObject<HTMLButtonElement | null>, dropdownWidth: number = 240) => {
    if (!useFixedDropdowns || !btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Calcular left alineando a la derecha del botón
    let left = rect.right - dropdownWidth;

    // Si se sale por la izquierda, alinear a la izquierda del botón
    if (left < 8) {
      left = rect.left;
    }

    // Si aún así se sale por la derecha, ajustar
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    return {
      position: 'fixed' as const,
      top: rect.bottom + 4,
      left,
      maxHeight: 'calc(100vh - ' + (rect.bottom + 20) + 'px)',
      overflowY: 'auto' as const,
    };
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón Filtrar */}
      <div className="relative">
        <button
          ref={filterBtnRef}
          onClick={() => { closeOtherDropdowns('filters'); setShowFilters(!showFilters); }}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            filters.length > 0 ? 'bg-purple-600 text-white' : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
          }`}
          title="Filtrar"
        >
          <Filter className="h-3.5 w-3.5" />
          {filters.length > 0 && <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">{filters.length}</span>}
        </button>
        {showFilters && (
          <div
            className={`${useFixedDropdowns ? 'fixed' : 'absolute right-0 top-full mt-1'} z-[100] w-[520px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4`}
            style={useFixedDropdowns ? getDropdownPosition(filterBtnRef, 520) : undefined}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
              <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-purple pr-1">
              {filters.map((filter, index) => (
                <div key={filter.id} className="flex items-center gap-2">
                  {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                  {index === 0 && <span className="w-8"></span>}
                  <select value={filter.field} onChange={(e) => updateFilter(filter.id, { field: e.target.value })} className="w-[130px] text-xs bg-background border border-border rounded px-2 py-1.5">
                    {filterFields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                  </select>
                  <select value={filter.operator} onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })} className="w-[90px] text-xs bg-background border border-border rounded px-2 py-1.5">
                    {FILTER_OPERATORS.filter(op => { const fc = filterFields.find(f => f.field === filter.field); return fc && op.forTypes.includes(fc.type); }).map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  <select value={filter.value} onChange={(e) => updateFilter(filter.id, { value: e.target.value })} className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5">
                    <option value="">Seleccionar...</option>
                    {uniqueValues[filter.field]?.map((val) => <option key={val} value={val}>{val}</option>)}
                  </select>
                  <button onClick={() => removeFilter(filter.id)} className="text-red-400 hover:text-red-300 p-0.5"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {filters.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Sin filtros. Haz clic en "Añadir".</p>}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-900/30">
              <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded"><Plus className="h-3 w-3" /> Añadir</button>
              <button onClick={clearFilters} disabled={filters.length === 0} className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Limpiar</button>
            </div>
            {filters.length > 0 && <div className="mt-2 pt-2 border-t border-purple-900/30"><span className="text-[10px] text-muted-foreground">{filteredCount} de {totalCount} registros</span></div>}
          </div>
        )}
      </div>

      {/* Botón Agrupar */}
      {!hideGrouping && (
        <div className="relative">
          <button
            ref={groupBtnRef}
            onClick={() => { closeOtherDropdowns('grouping'); setShowGrouping(!showGrouping); }}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
              activeGroupings.length > 0 ? 'bg-purple-600 text-white' : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
            }`}
            title="Agrupar"
          >
            <Layers className="h-3.5 w-3.5" />
            {activeGroupings.length > 0 && <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">{activeGroupings.length}</span>}
          </button>
          {showGrouping && (
            <div
              className={`${useFixedDropdowns ? 'fixed' : 'absolute right-0 top-full mt-1'} z-[100] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[200px]`}
              style={useFixedDropdowns ? getDropdownPosition(groupBtnRef, 200) : undefined}
            >
              <div className="flex items-center justify-between mb-2 px-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Agrupar por (max 3)</p>
                <button onClick={() => setShowGrouping(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              {groupingOptions.map(({ field, label }) => {
                const idx = activeGroupings.indexOf(field);
                const colors = ['text-purple-400', 'text-pink-400', 'text-blue-400', 'text-green-400', 'text-orange-400'];
                return (
                  <button key={field} onClick={() => toggleGrouping(field)} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${activeGroupings.includes(field) ? 'text-purple-300' : 'text-zinc-400'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${activeGroupings.includes(field) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'}`}>
                      {activeGroupings.includes(field) && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {label}
                    {idx >= 0 && <span className={`ml-auto text-[10px] ${colors[idx]}`}>{idx + 1}°</span>}
                  </button>
                );
              })}
              <div className="border-t border-purple-900/30 mt-2 pt-2">
                <button onClick={clearGroupings} disabled={activeGroupings.length === 0} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  Quitar agrupación
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón Ordenar */}
      {!hideSort && (
        <div className="relative">
          <button
            ref={sortBtnRef}
            onClick={() => { closeOtherDropdowns('sort'); setShowSort(!showSort); }}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${sortField ? 'bg-purple-600 text-white' : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'}`}
            title="Ordenar"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
          {showSort && (
            <div
              className={`${useFixedDropdowns ? 'fixed' : 'absolute right-0 top-full mt-1'} z-[100] w-[240px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-3`}
              style={useFixedDropdowns ? getDropdownPosition(sortBtnRef, 240) : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-purple-300">Ordenar por</span>
                <button onClick={() => setShowSort(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-1">
                {filterFields.map((field) => (
                  <button key={field.field} onClick={() => { if (sortField === field.field) { setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); } else { setSortField(field.field); setSortDirection('asc'); } }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${sortField === field.field ? 'bg-purple-600 text-white' : 'text-zinc-300 hover:bg-purple-900/30'}`}>
                    <span>{field.label}</span>
                    {sortField === field.field && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                ))}
              </div>
              {sortField && (
                <div className="mt-3 pt-3 border-t border-purple-900/30">
                  <button onClick={() => { setSortField(null); setSortDirection('asc'); }} className="w-full px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded transition-colors">Quitar ordenamiento</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Comments Section Component - Comentarios específicos de revisión de artes por tarea
function CommentsSection({ campanaId, tareaId }: { campanaId: number; tareaId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);

  // Obtener comentarios de revisión de artes para esta tarea específica
  const { data: comentarios = [] } = useQuery({
    queryKey: ['comentarios-revision-arte', campanaId, tareaId],
    queryFn: () => campanasService.getComentariosRevisionArte(campanaId, tareaId),
    enabled: !!campanaId && !!tareaId,
  });

  // Mutación para agregar comentario
  const addCommentMutation = useMutation({
    mutationFn: (contenido: string) => campanasService.addComentarioRevisionArte(campanaId, tareaId, contenido),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['comentarios-revision-arte', campanaId, tareaId] });
    },
  });

  // Mutación para eliminar comentario
  const deleteCommentMutation = useMutation({
    mutationFn: (comentarioId: number) => campanasService.deleteComentarioRevisionArte(campanaId, comentarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comentarios-revision-arte', campanaId, tareaId] });
      setDeleteModalOpen(false);
      setCommentToDelete(null);
    },
  });

  // Scroll al final cuando se agregan nuevos comentarios
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comentarios.length]);

  const handleSubmit = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  const handleDeleteClick = (comentarioId: number) => {
    setCommentToDelete(comentarioId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (commentToDelete) {
      deleteCommentMutation.mutate(commentToDelete);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[250px]">
      {/* Lista de comentarios */}
      <div className="flex-1 overflow-y-auto divide-y divide-purple-900/20 min-h-[180px] max-h-[350px] mb-3 scrollbar-purple">
        {comentarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-400">
            <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No hay comentarios aún</p>
            <p className="text-xs text-zinc-500 mt-1">Sé el primero en comentar</p>
          </div>
        ) : (
          comentarios.map((c: { id: number; autor_id: number; autor_nombre?: string; fecha: string; contenido: string }) => (
            <div key={c.id} className="flex gap-3 py-3 px-1 group">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-medium text-white">
                {(c.autor_nombre || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-white">{c.autor_nombre || 'Usuario'}</span>
                  <span className="text-[10px] text-zinc-500">{formatDate(c.fecha)}</span>
                  {/* Botón eliminar - solo para comentarios propios */}
                  {user?.id === c.autor_id && (
                    <button
                      onClick={() => handleDeleteClick(c.id)}
                      disabled={deleteCommentMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                      title="Eliminar comentario"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-zinc-300 mt-1 break-words">{c.contenido}</p>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input para nuevo comentario */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-medium text-white">
          {(user?.nombre || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 focus-within:border-purple-500">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-transparent text-[11px] focus:outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!comment.trim() || addCommentMutation.isPending}
            className="p-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addCommentMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCommentToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar comentario"
        message="¿Estás seguro de que deseas eliminar este comentario? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteCommentMutation.isPending}
      />
    </div>
  );
}

// Componente para la vista de tareas de Testigo
function TestigoTaskView({
  task,
  taskInventory,
  isUpdating,
  onClose,
  campanaId,
  getCatorcenaFromFechaFin,
  canResolveProduccionTasks = true,
}: {
  task: TaskRow;
  taskInventory: InventoryRow[];
  isUpdating: boolean;
  onClose: () => void;
  campanaId: number;
  getCatorcenaFromFechaFin: string | null;
  canResolveProduccionTasks?: boolean;
}) {
  const queryClient = useQueryClient();
  const [testigoFile, setTestigoFile] = useState<File | null>(null);
  const [testigoFilePreview, setTestigoFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Estados para filtros y agrupaciones de la tabla de inventario
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>([]);
  const [showGrouping, setShowGrouping] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSort, setShowSort] = useState(false);

  // Funciones helper para filtros
  const addFilter = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  const toggleGrouping = useCallback((field: GroupByField) => {
    setActiveGroupings(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length >= 3) return prev;
      return [...prev, field];
    });
  }, []);

  const clearGroupings = useCallback(() => setActiveGroupings([]), []);

  // Valores únicos para filtros
  const uniqueValues = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const uniqueSet = new Set<string>();
      taskInventory.forEach(item => {
        const value = (item as unknown as Record<string, unknown>)[field.field];
        if (value !== null && value !== undefined && value !== '') {
          uniqueSet.add(String(value));
        }
      });
      values[field.field] = Array.from(uniqueSet).sort();
    });
    return values;
  }, [taskInventory]);

  // Datos filtrados y ordenados
  const filteredData = useMemo(() => {
    let data = [...taskInventory];

    // Aplicar filtros
    if (filters.length > 0) {
      data = applyFilters(data, filters);
    }

    // Aplicar ordenamiento
    if (sortField) {
      data.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortField];
        const bVal = (b as unknown as Record<string, unknown>)[sortField];
        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [taskInventory, filters, sortField, sortDirection]);

  // Datos agrupados
  const groupedData = useMemo(() => {
    if (activeGroupings.length === 0) return {} as Record<string, InventoryRow[]>;

    const groups: Record<string, InventoryRow[]> = {};
    filteredData.forEach(item => {
      const keyParts = activeGroupings.map(field => getGroupKeyForField(item, field));
      const key = keyParts.join(' > ');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredData, activeGroupings]);

  // Obtener archivo existente desde la tarea
  const existingFile = task.archivo_testigo;

  // Manejar selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Solo se permiten archivos JPG, PNG o PDF');
        return;
      }
      // Validar tamaño (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('El archivo no puede superar los 10MB');
        return;
      }
      setUploadError(null);
      setTestigoFile(file);
      // Preview para imágenes
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setTestigoFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setTestigoFilePreview(null);
      }
    }
  };

  // Manejar guardar y completar tarea
  const handleSaveTestigo = async () => {
    if (!testigoFile) {
      setUploadError('Debes seleccionar un archivo');
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      // 1. Subir archivo
      const uploadResult = await campanasService.uploadTestigoFile(testigoFile);

      // 2. Actualizar tarea con archivo y marcar como completada
      await campanasService.updateTarea(campanaId, Number(task.id), {
        archivo_testigo: uploadResult.url,
        estatus: 'Completado',
        tipo: 'Testigo',
      } as any);

      // 3. Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', campanaId] });

      onClose();
    } catch (error) {
      console.error('Error al guardar testigo:', error);
      setUploadError(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info de la tarea */}
      <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
        <h4 className="text-sm font-medium text-purple-300 mb-3">Información de la Tarea de Testigo</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Tipo:</span>
            <p className="text-white font-medium">{task.tipo}</p>
          </div>
          <div>
            <span className="text-zinc-500">ID:</span>
            <p className="text-white font-medium">{task.id}</p>
          </div>
          <div>
            <span className="text-zinc-500">Titulo:</span>
            <p className="text-white font-medium">{task.titulo || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-500">Estatus:</span>
            <p className={`font-medium ${task.estatus === 'Completado' ? 'text-green-400' : 'text-orange-400'}`}>
              {task.estatus}
            </p>
          </div>
          <div>
            <span className="text-zinc-500">Catorcena:</span>
            <p className="text-white font-medium">{getCatorcenaFromFechaFin || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-500">Fecha Inicio:</span>
            <p className="text-white font-medium">{task.fecha_inicio || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-500">Asignado:</span>
            <p className="text-white font-medium">{task.asignado || '-'}</p>
          </div>
          <div>
            <span className="text-zinc-500">Creador:</span>
            <p className="text-white font-medium">{task.creador || '-'}</p>
          </div>
        </div>
        {task.descripcion && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-zinc-500 text-sm">Descripción:</span>
            <p className="text-white text-sm mt-1">{task.descripcion}</p>
          </div>
        )}
      </div>

      {/* Lista de inventario asociado con filtros (mismo estilo que Instalación) */}
      <div className="bg-zinc-900/50 rounded-lg border border-border">
        {/* Header con filtros */}
        <div className="px-4 py-3 border-b border-border bg-zinc-800/50 rounded-t-lg flex items-center justify-between gap-4 relative z-20">
          <h4 className="text-sm font-medium text-purple-300">
            Inventario Asociado ({filteredData.length} de {taskInventory.length})
          </h4>
          <FilterToolbar
            filters={filters}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            addFilter={addFilter}
            updateFilter={updateFilter}
            removeFilter={removeFilter}
            clearFilters={clearFilters}
            uniqueValues={uniqueValues}
            activeGroupings={activeGroupings}
            showGrouping={showGrouping}
            setShowGrouping={setShowGrouping}
            toggleGrouping={toggleGrouping}
            clearGroupings={clearGroupings}
            sortField={sortField}
            sortDirection={sortDirection}
            showSort={showSort}
            setShowSort={setShowSort}
            setSortField={setSortField}
            setSortDirection={setSortDirection}
            filteredCount={filteredData.length}
            totalCount={taskInventory.length}
            useFixedDropdowns={true}
          />
        </div>
        {/* Contenido de la tabla con scroll */}
        <div className="min-h-[200px] max-h-[400px] overflow-auto">
          {taskInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 h-[200px]">
              <Image className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Sin inventario asociado</p>
            </div>
          ) : activeGroupings.length > 0 ? (
            /* Vista agrupada */
            <div className="divide-y divide-border">
              {Object.entries(groupedData).map(([groupKey, items]) => (
                <div key={groupKey} className="bg-zinc-900/30">
                  <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-300">{groupKey}</span>
                    <Badge className="bg-purple-500/20 text-purple-300">{(items as InventoryRow[]).length}</Badge>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-800/50">
                      <tr className="text-left">
                        <th className="p-2 font-medium text-purple-300">Arte</th>
                        <th className="p-2 font-medium text-purple-300">Código</th>
                        <th className="p-2 font-medium text-purple-300">Ciudad</th>
                        <th className="p-2 font-medium text-purple-300">Mueble</th>
                        <th className="p-2 font-medium text-purple-300">Medidas</th>
                        <th className="p-2 font-medium text-purple-300">Catorcena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items as InventoryRow[]).map((item) => (
                        <tr key={item.id} className="border-t border-border/30 hover:bg-purple-900/10">
                          <td className="p-2">
                            {item.archivo_arte ? (
                              <div className="w-14 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                <Image className="h-4 w-4 text-zinc-600" />
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                          <td className="p-2 text-zinc-300">{item.ciudad}</td>
                          <td className="p-2 text-zinc-300">{item.mueble}</td>
                          <td className="p-2 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                          <td className="p-2 text-zinc-400">C{item.catorcena}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            /* Vista tabla normal */
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-800 z-10">
                <tr className="text-left">
                  <th className="p-3 font-medium text-purple-300">Arte</th>
                  <th className="p-3 font-medium text-purple-300">Código</th>
                  <th className="p-3 font-medium text-purple-300">Ciudad</th>
                  <th className="p-3 font-medium text-purple-300">Plaza</th>
                  <th className="p-3 font-medium text-purple-300">Mueble</th>
                  <th className="p-3 font-medium text-purple-300">Medidas</th>
                  <th className="p-3 font-medium text-purple-300">Catorcena</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.id} className="border-t border-border/50 hover:bg-purple-900/10">
                    <td className="p-3">
                      {item.archivo_arte ? (
                        <div className="w-16 h-12 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                          <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-12 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                          <Image className="h-4 w-4 text-zinc-600" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                    <td className="p-3 text-zinc-300">{item.ciudad}</td>
                    <td className="p-3 text-zinc-400">{item.plaza}</td>
                    <td className="p-3 text-zinc-300">{item.mueble}</td>
                    <td className="p-3 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                    <td className="p-3 text-zinc-400">C{item.catorcena}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Vista según estado de la tarea */}
      {task.estatus === 'Completado' ? (
        // Vista informativa para tareas completadas
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <h4 className="text-sm font-medium text-green-300">Testigo Validado</h4>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Esta instalación ha sido validada con evidencia fotográfica.
          </p>
          {existingFile && (
            <div className="bg-zinc-900/50 rounded-lg p-3 border border-border">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Archivo de evidencia:</span>
              <div className="mt-2">
                {existingFile.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <a href={getImageUrl(existingFile) || '#'} target="_blank" rel="noopener noreferrer">
                    <img
                      src={getImageUrl(existingFile) || ''}
                      alt="Evidencia testigo"
                      className="max-w-full max-h-[200px] rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <a
                    href={getImageUrl(existingFile) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 rounded-lg border border-purple-500/30 hover:bg-purple-900/50 transition-colors"
                  >
                    <FileText className="h-5 w-5 text-purple-400" />
                    <span className="text-sm text-purple-300">Ver archivo PDF</span>
                    <ExternalLink className="h-4 w-4 text-purple-400 ml-auto" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ) : canResolveProduccionTasks ? (
        // Vista de carga de archivo para tareas pendientes
        <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
          <h4 className="text-sm font-medium text-purple-300 mb-3">Subir Evidencia Fotográfica</h4>
          <p className="text-xs text-zinc-400 mb-4">
            Sube una imagen (JPG, PNG) o PDF como evidencia de la instalación validada.
          </p>

          {/* Área de carga */}
          <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-4 text-center hover:border-purple-500/50 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="testigo-file-input"
              disabled={isUploading}
            />
            <label htmlFor="testigo-file-input" className="cursor-pointer">
              {testigoFile ? (
                <div className="space-y-2">
                  {testigoFilePreview ? (
                    <img src={testigoFilePreview} alt="Preview" className="max-h-[150px] mx-auto rounded" />
                  ) : (
                    <FileText className="h-12 w-12 text-purple-400 mx-auto" />
                  )}
                  <p className="text-sm text-purple-300">{testigoFile.name}</p>
                  <p className="text-xs text-zinc-500">({(testigoFile.size / 1024).toFixed(1)} KB)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 text-zinc-500 mx-auto" />
                  <p className="text-sm text-zinc-400">Haz clic para seleccionar un archivo</p>
                  <p className="text-xs text-zinc-500">JPG, PNG o PDF (máx. 10MB)</p>
                </div>
              )}
            </label>
          </div>

          {/* Error de carga */}
          {uploadError && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Botón Guardar */}
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveTestigo}
              disabled={!testigoFile || isUploading || isUpdating}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // Vista de solo lectura para usuarios sin permiso de resolver tareas
        <div className="bg-zinc-800/50 border border-border rounded-lg p-4 text-center">
          <p className="text-sm text-zinc-400">Tarea de testigo pendiente - Solo visualización</p>
        </div>
      )}
    </div>
  );
}

// Task Detail Modal Component - Modal con 3 tabs: Resumen, Editar, Atender

function TaskDetailModal({
  isOpen,
  onClose,
  task,
  inventoryData,
  artesExistentes,
  isLoadingArtes,
  onApprove,
  onReject,
  onCorrect,
  onUpdateArte,
  onUpdateArteDigital,
  onTaskComplete,
  onSendToReview,
  onCreateRecepcion,
  onCreateRecepcionFaltante,
  onUpdateTask,
  isUpdating,
  campanaId,
  canResolveProduccionTasks = true,
  canResolveRevisionArtesTasks = true,
  digitalSummaryMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: TaskRow | null;
  inventoryData: InventoryRow[];
  artesExistentes: ArteExistente[];
  isLoadingArtes: boolean;
  onApprove: (reservaIds: number[], comentario?: string) => Promise<void>;
  onReject: (reservaIds: number[], comentario: string) => Promise<void>;
  onCorrect: (reservaIds: number[], instrucciones: string) => void;
  onUpdateArte: (reservaIds: number[], archivo: string) => void;
  onUpdateArteDigital: (reservaIds: number[], files: { file: File; spot: number }[], deleteArchivos?: string[]) => Promise<void>;
  onTaskComplete: (taskId: string, observaciones?: string) => Promise<void>;
  onSendToReview: (reservaIds: number[], responsableOriginal: string) => Promise<void>;
  onCreateRecepcion: (tareaImpresionId: string, asignadoNombre?: string) => Promise<void>;
  onCreateRecepcionFaltante: (faltantes: { arte: string; solicitadas: number; recibidas: number; faltantes: number }[], observaciones: string) => Promise<void>;
  onUpdateTask: (taskId: string, data: { evidencia?: string; estatus?: string }) => Promise<void>;
  isUpdating: boolean;
  campanaId: number;
  canResolveProduccionTasks?: boolean;
  canResolveRevisionArtesTasks?: boolean;
  digitalSummaryMap: Map<number, DigitalFileSummary>;
}) {
  const [activeTab, setActiveTab] = useState<TaskDetailTab>('resumen');
  const [selectedArteIds, setSelectedArteIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupByArte>('inventario');

  // Determinar si puede resolver la tarea actual basado en su tipo
  const canResolveCurrentTask = useMemo(() => {
    if (!task) return false;
    // Para tareas de "Revisión de artes", usar canResolveRevisionArtesTasks
    if (task.tipo === 'Revisión de artes') {
      return canResolveRevisionArtesTasks;
    }
    // Para otras tareas (producción), usar canResolveProduccionTasks
    return canResolveProduccionTasks;
  }, [task, canResolveRevisionArtesTasks, canResolveProduccionTasks]);

  // Estados para la tabla agrupada del modal de Programación (Ver Tabla tab)
  const [filtersProgramacionModal, setFiltersProgramacionModal] = useState<FilterCondition[]>([]);
  const [showFiltersProgramacionModal, setShowFiltersProgramacionModal] = useState(false);
  const [activeGroupingsProgramacionModal, setActiveGroupingsProgramacionModal] = useState<GroupByField[]>(['catorcena', 'aps', 'grupo']);
  const [showGroupingProgramacionModal, setShowGroupingProgramacionModal] = useState(false);
  const [sortFieldProgramacionModal, setSortFieldProgramacionModal] = useState<string | null>(null);
  const [sortDirectionProgramacionModal, setSortDirectionProgramacionModal] = useState<'asc' | 'desc'>('asc');
  const [showSortProgramacionModal, setShowSortProgramacionModal] = useState(false);
  const [expandedNodesProgramacionModal, setExpandedNodesProgramacionModal] = useState<Set<string>>(new Set());
  const [programacionModalSearch, setProgramacionModalSearch] = useState('');
  // Mapa de nombres de archivos digitales por item ID (para búsqueda)
  const [digitalFileNamesMap, setDigitalFileNamesMap] = useState<Map<string, string[]>>(new Map());

  // Funciones para filtros/agrupaciones del modal de Programación
  const addFilterProgramacionModal = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersProgramacionModal(prev => [...prev, newFilter]);
  }, []);

  const updateFilterProgramacionModal = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersProgramacionModal(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFilterProgramacionModal = useCallback((id: string) => {
    setFiltersProgramacionModal(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAllFiltersProgramacionModal = useCallback(() => {
    setFiltersProgramacionModal([]);
  }, []);

  const toggleGroupingProgramacionModal = useCallback((field: GroupByField) => {
    setActiveGroupingsProgramacionModal(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length < 3) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsProgramacionModal = useCallback(() => {
    setActiveGroupingsProgramacionModal([]);
  }, []);

  const toggleNodeProgramacionModal = useCallback((nodeKey: string) => {
    setExpandedNodesProgramacionModal(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  }, []);

  // Estado para galería digital dentro del modal
  const [isDigitalGalleryOpen, setIsDigitalGalleryOpen] = useState(false);
  const [digitalGalleryImages, setDigitalGalleryImages] = useState<ImagenDigitalView[]>([]);
  const [digitalGalleryTitle, setDigitalGalleryTitle] = useState('');
  const [isLoadingDigitalGallery, setIsLoadingDigitalGallery] = useState(false);

  // Handler para abrir galería digital
  const openDigitalGalleryModal = useCallback(async (reservaId: number, codigoUnico: string) => {
    setIsLoadingDigitalGallery(true);
    setDigitalGalleryTitle(`Galería Digital - ${codigoUnico}`);
    setIsDigitalGalleryOpen(true);
    try {
      const imagenes = await campanasService.getImagenesDigitales(campanaId, reservaId);
      setDigitalGalleryImages(imagenes.map(img => ({
        id: img.id,
        archivo: img.archivo,
        archivoData: img.archivoData, // Base64 data URL
        spot: img.spot,
        tipo: img.archivo.match(/\.(mp4|mov|avi|webm|mkv|wmv)$/i) ? 'video' as const : 'image' as const,
        estado: img.estado,
      })));
    } catch (error) {
      console.error('Error fetching digital images:', error);
      setDigitalGalleryImages([]);
    } finally {
      setIsLoadingDigitalGallery(false);
    }
  }, [campanaId]);

  // Helper para obtener resumen digital de un item
  const getDigitalSummaryForItem = useCallback((item: InventoryRow) => {
    if (item.tradicional_digital !== 'Digital' || !item.rsv_id) return null;
    const rsvIds = item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    let totalArchivos = 0;
    let totalImagenes = 0;
    let totalVideos = 0;
    rsvIds.forEach(rsvId => {
      const summary = digitalSummaryMap.get(rsvId);
      if (summary) {
        totalArchivos += summary.totalArchivos;
        totalImagenes += summary.countImagenes;
        totalVideos += summary.countVideos;
      }
    });
    if (totalArchivos === 0) return null;
    return { total: totalArchivos, imagenes: totalImagenes, videos: totalVideos };
  }, [digitalSummaryMap]);

  // Helper para generar texto de resumen digital
  const getDigitalSummaryText = useCallback((summary: { total: number; imagenes: number; videos: number } | null) => {
    if (!summary) return '-';
    const parts: string[] = [];
    if (summary.imagenes > 0) {
      parts.push(`${summary.imagenes} ${summary.imagenes === 1 ? 'imagen' : 'imágenes'}`);
    }
    if (summary.videos > 0) {
      parts.push(`${summary.videos} ${summary.videos === 1 ? 'video' : 'videos'}`);
    }
    return parts.join(', ') || '-';
  }, []);

  // Query para catorcenas (para convertir fecha_fin a catorcena)
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas-detail'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen && (task?.tipo === 'Impresión' || task?.tipo === 'Recepción' || task?.tipo === 'Instalación'),
  });

  // Query para usuarios (para asignar tarea de recepción)
  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios-detail-modal'],
    queryFn: () => campanasService.getUsuarios(),
    enabled: isOpen && task?.tipo === 'Impresión',
  });
  const usuarios = usuariosData || [];

  // Función para obtener texto de catorcena desde fecha_fin
  const getCatorcenaFromFechaFin = useMemo(() => {
    if (!task?.fecha_fin || !catorcenasData?.data) return null;
    const fechaFin = new Date(task.fecha_fin);
    const catorcena = catorcenasData.data.find((c: { fecha_inicio: string; fecha_fin: string; numero_catorcena: number; a_o: number }) => {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      return fechaFin >= inicio && fechaFin <= fin;
    });
    if (catorcena) {
      return `Catorcena ${catorcena.numero_catorcena}, ${catorcena.a_o}`;
    }
    return null;
  }, [task?.fecha_fin, catorcenasData?.data]);

  // Estados para el sistema de decisiones de revisión
  const [decisiones, setDecisiones] = useState<DecisionesState>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isFinalizando, setIsFinalizando] = useState(false);

  // Estado para crear tarea de recepción (Impresión)
  const [isCreatingRecepcion, setIsCreatingRecepcion] = useState(false);
  const [recepcionAsignadoNombre, setRecepcionAsignadoNombre] = useState('');
  const [recepcionAsignadoSearch, setRecepcionAsignadoSearch] = useState('');
  const [showRecepcionAsignadoDropdown, setShowRecepcionAsignadoDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const recepcionInputRef = useRef<HTMLInputElement>(null);
  const [impresionTab, setImpresionTab] = useState<'resumen' | 'tabla'>('resumen');
  const [recepcionTab, setRecepcionTab] = useState<'resumen' | 'tabla'>('resumen');
  const [programacionTab, setProgramacionTab] = useState<'resumen' | 'tabla'>('resumen');
  // Estado para tracking de artes programados en tarea de Programación
  const [programadosState, setProgramadosState] = useState<Record<string, boolean>>({});
  // Estado para archivos digitales cargados desde API (fallback si evidencia no tiene archivos)
  const [loadedArchivosDigitales, setLoadedArchivosDigitales] = useState<{ archivo: string; archivoData?: string; spot: number; tipo: string }[]>([]);
  const [isLoadingArchivosDigitales, setIsLoadingArchivosDigitales] = useState(false);

  // Estado para nodos expandidos en las tablas de Impresión y Recepción
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const toggleNode = useCallback((nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  }, []);

  // Filtrar usuarios por búsqueda (para asignar recepción)
  const filteredUsuariosRecepcion = useMemo(() => {
    if (!recepcionAsignadoSearch.trim()) return usuarios;
    const search = recepcionAsignadoSearch.toLowerCase();
    return usuarios.filter(u =>
      u.nombre.toLowerCase().includes(search) ||
      String(u.id).includes(search)
    );
  }, [usuarios, recepcionAsignadoSearch]);

  // Estados para tareas de Recepción
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState<Record<string, number>>({});
  const [observacionesRecepcion, setObservacionesRecepcion] = useState('');
  const [isFinalizandoRecepcion, setIsFinalizandoRecepcion] = useState(false);

  // Parsear datos de impresiones desde evidencia (para tareas de Impresión y Recepción)
  const impresionesData = useMemo(() => {
    if (task?.tipo !== 'Impresión' && task?.tipo !== 'Recepción') return null;
    try {
      const evidencia = (task as any).evidencia;
      if (evidencia) {
        return JSON.parse(evidencia);
      }
    } catch {
      return null;
    }
    return null;
  }, [task]);


  // Estados para editar arte
  const [uploadOption, setUploadOption] = useState<UploadOption>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [existingArtUrl, setExistingArtUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Estados para archivos digitales en Editar tab (múltiples)
  const [digitalFilesEditar, setDigitalFilesEditar] = useState<DigitalFile[]>([]);
  const [draggedFileEditar, setDraggedFileEditar] = useState<string | null>(null);

  // Estados para archivos digitales existentes (del servidor)
  const [existingDigitalFilesEditar, setExistingDigitalFilesEditar] = useState<ImagenDigitalView[]>([]);
  const [isLoadingExistingFiles, setIsLoadingExistingFiles] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState<number[]>([]); // IDs de archivos a eliminar

  // Estados para filtros y agrupaciones - Paso 1 (Resumen)
  const [filtersResumen, setFiltersResumen] = useState<FilterCondition[]>([]);
  const [showFiltersResumen, setShowFiltersResumen] = useState(false);
  const [activeGroupingsResumen, setActiveGroupingsResumen] = useState<GroupByField[]>([]);
  const [showGroupingResumen, setShowGroupingResumen] = useState(false);
  const [sortFieldResumen, setSortFieldResumen] = useState<string | null>(null);
  const [sortDirectionResumen, setSortDirectionResumen] = useState<'asc' | 'desc'>('asc');
  const [showSortResumen, setShowSortResumen] = useState(false);

  // Estados para filtros y agrupaciones - Paso 2 (Editar)
  const [filtersEditar, setFiltersEditar] = useState<FilterCondition[]>([]);
  const [showFiltersEditar, setShowFiltersEditar] = useState(false);
  const [activeGroupingsEditar, setActiveGroupingsEditar] = useState<GroupByField[]>([]);
  const [showGroupingEditar, setShowGroupingEditar] = useState(false);
  const [sortFieldEditar, setSortFieldEditar] = useState<string | null>(null);
  const [sortDirectionEditar, setSortDirectionEditar] = useState<'asc' | 'desc'>('asc');
  const [showSortEditar, setShowSortEditar] = useState(false);

  // Filtrar inventario que pertenece a esta tarea
  const taskInventory = useMemo(() => {
    if (!task) return [];

    // Los inventario_ids de la tarea son rsv_ids (IDs de reserva)
    const taskReservaIds = new Set(
      task.inventario_ids?.map(id => id.trim()) || []
    );

    if (taskReservaIds.size === 0) return [];

    return inventoryData.filter(item => {
      // Comparar por rsv_id (el inventario_ids de la tarea contiene rsv_ids)
      const itemRsvIds = item.rsv_id.split(',').map(id => id.trim());
      return itemRsvIds.some(id => taskReservaIds.has(id));
    });
  }, [task, inventoryData]);

  // Efecto para cargar nombres de archivos digitales cuando se abre el tab "Ver tabla" en Programación
  useEffect(() => {
    const loadDigitalFileNames = async () => {
      if (task?.tipo !== 'Programación' || programacionTab !== 'tabla' || taskInventory.length === 0) return;

      // Recopilar todas las reservas únicas
      const allReservaIds = new Set<number>();
      taskInventory.forEach(item => {
        if (item.rsv_id) {
          item.rsv_id.split(',').forEach(id => {
            const numId = parseInt(id.trim());
            if (!isNaN(numId)) allReservaIds.add(numId);
          });
        }
      });

      if (allReservaIds.size === 0) return;

      try {
        // Cargar archivos digitales para todas las reservas
        const idsParam = Array.from(allReservaIds).join(',');
        const imagenes = await campanasService.getImagenesDigitales(campanaId, idsParam);

        // Crear mapa de nombres de archivos por item ID (string key)
        const newMap = new Map<string, string[]>();
        taskInventory.forEach(item => {
          const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
          const fileNames: string[] = [];
          rsvIds.forEach(rsvId => {
            const files = imagenes.filter(img => img.idReserva === rsvId);
            files.forEach(file => {
              // Extraer el nombre del archivo de la ruta
              const fileName = file.archivo.split('/').pop() || file.archivo;
              fileNames.push(fileName.toLowerCase());
            });
          });
          if (fileNames.length > 0) {
            newMap.set(item.id, fileNames);
          }
        });
        setDigitalFileNamesMap(newMap);
      } catch (error) {
        console.error('Error loading digital file names:', error);
      }
    };

    loadDigitalFileNames();
  }, [task?.tipo, programacionTab, taskInventory, campanaId]);

  // Efecto para cargar archivos digitales para el tab "Resumen" en Programación si no están en evidencia
  useEffect(() => {
    const loadArchivosForResumen = async () => {
      if (!isOpen || task?.tipo !== 'Programación') {
        setLoadedArchivosDigitales([]);
        return;
      }

      // Verificar si evidencia ya tiene archivos CON archivoData (URL de Cloudinary)
      let archivosFromEvidencia: { archivo: string; archivoData?: string; spot: number; tipo: string }[] = [];
      try {
        if (task.evidencia) {
          const parsed = JSON.parse(task.evidencia);
          archivosFromEvidencia = parsed.archivos || [];
        }
      } catch (e) {
        console.error('Error parsing evidencia for archivos check:', e);
      }

      // Solo usar archivos de evidencia si TODOS tienen archivoData (URL de Cloudinary)
      // Si no tienen archivoData, cargar desde API para obtener las URLs actualizadas
      const evidenciaHasArchivoData = archivosFromEvidencia.length > 0 &&
        archivosFromEvidencia.every(a => a.archivoData && a.archivoData.trim() !== '');

      if (evidenciaHasArchivoData) {
        setLoadedArchivosDigitales([]);
        return;
      }

      // Cargar archivos desde API usando ids_reservas de la tarea
      const reservaIds = task.ids_reservas?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
      if (reservaIds.length === 0) {
        setLoadedArchivosDigitales([]);
        return;
      }

      setIsLoadingArchivosDigitales(true);
      try {
        const idsParam = reservaIds.join(',');
        const imagenes = await campanasService.getImagenesDigitales(campanaId, idsParam);
        const archivos = imagenes.map(img => ({
          archivo: img.archivo,
          archivoData: img.archivoData,
          spot: img.spot,
          tipo: img.tipo,
        }));
        setLoadedArchivosDigitales(archivos);
      } catch (error) {
        console.error('Error loading archivos digitales for resumen:', error);
        setLoadedArchivosDigitales([]);
      } finally {
        setIsLoadingArchivosDigitales(false);
      }
    };

    loadArchivosForResumen();
  }, [isOpen, task?.tipo, task?.evidencia, task?.ids_reservas, campanaId]);

  // Agrupar taskInventory por Catorcena > APS > Grupo (para tablas de Impresión y Recepción)
  // Estructura jerárquica de 3 niveles para poder colapsar cada nivel
  const groupedTaskInventory = useMemo(() => {
    if (taskInventory.length === 0) return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    taskInventory.forEach(item => {
      const catorcenaKey = `Catorcena ${item.catorcena} - ${item.anio}`;
      const apsKey = `APS ${item.aps ?? 'Sin asignar'}`;
      const grupoKey = item.grupo_id ? `Grupo ${item.grupo_id}` : `Item ${item.id}`;

      if (!groups[catorcenaKey]) groups[catorcenaKey] = {};
      if (!groups[catorcenaKey][apsKey]) groups[catorcenaKey][apsKey] = {};
      if (!groups[catorcenaKey][apsKey][grupoKey]) groups[catorcenaKey][apsKey][grupoKey] = [];
      groups[catorcenaKey][apsKey][grupoKey].push(item);
    });
    return groups;
  }, [taskInventory]);

  // Datos filtrados para la tabla del modal de Programación
  const filteredProgramacionModalData = useMemo(() => {
    let result = [...taskInventory];

    // Aplicar búsqueda (incluye nombres de archivos digitales)
    if (programacionModalSearch.trim()) {
      const search = programacionModalSearch.toLowerCase();
      result = result.filter(item => {
        // Búsqueda en campos estándar
        const matchesStandard =
          String(item.id).includes(search) ||
          item.codigo_unico?.toLowerCase().includes(search) ||
          item.ubicacion?.toLowerCase().includes(search) ||
          item.plaza?.toLowerCase().includes(search) ||
          item.mueble?.toLowerCase().includes(search) ||
          item.ciudad?.toLowerCase().includes(search);

        // Búsqueda en nombres de archivos digitales
        const fileNames = digitalFileNamesMap.get(item.id) || [];
        const matchesFileName = fileNames.some(fileName => fileName.includes(search));

        return matchesStandard || matchesFileName;
      });
    }

    // Aplicar filtros
    if (filtersProgramacionModal.length > 0) {
      result = result.filter(item =>
        filtersProgramacionModal.every(filter => {
          if (!filter.value) return true;
          const filterVal = filter.value.toLowerCase();

          // Manejo especial para nombre_archivo (busca en los archivos digitales)
          if (filter.field === 'nombre_archivo') {
            const fileNames = digitalFileNamesMap.get(item.id) || [];
            switch (filter.operator) {
              case '=': return fileNames.some(fn => fn === filterVal);
              case '!=': return fileNames.every(fn => fn !== filterVal);
              case 'contains': return fileNames.some(fn => fn.includes(filterVal));
              case 'not_contains': return fileNames.every(fn => !fn.includes(filterVal));
              default: return true;
            }
          }

          // Filtrado normal para otros campos
          const val = String((item as unknown as Record<string, unknown>)[filter.field] ?? '').toLowerCase();
          switch (filter.operator) {
            case '=': return val === filterVal;
            case '!=': return val !== filterVal;
            case 'contains': return val.includes(filterVal);
            case 'not_contains': return !val.includes(filterVal);
            default: return true;
          }
        })
      );
    }

    // Aplicar ordenamiento
    if (sortFieldProgramacionModal) {
      result.sort((a, b) => {
        const aVal = String((a as unknown as Record<string, unknown>)[sortFieldProgramacionModal] ?? '');
        const bVal = String((b as unknown as Record<string, unknown>)[sortFieldProgramacionModal] ?? '');
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
        return sortDirectionProgramacionModal === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [taskInventory, programacionModalSearch, filtersProgramacionModal, sortFieldProgramacionModal, sortDirectionProgramacionModal, digitalFileNamesMap]);

  // Inventario agrupado para la tabla del modal de Programación (3 niveles dinámicos)
  const programacionModalGroupedInventory = useMemo(() => {
    if (filteredProgramacionModalData.length === 0 || activeGroupingsProgramacionModal.length === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const getGroupKey = (item: InventoryRow, field: GroupByField): string => {
      switch (field) {
        case 'catorcena': return `Catorcena ${item.catorcena} - ${item.anio}`;
        case 'aps': return `APS ${item.aps ?? 'Sin asignar'}`;
        case 'grupo': return item.grupo_id ? `Grupo ${item.grupo_id}` : `Item ${item.id}`;
        case 'plaza': return item.plaza || 'Sin plaza';
        case 'mueble': return item.mueble || 'Sin mueble';
        case 'ciudad': return item.ciudad || 'Sin ciudad';
        case 'tipo_medio': return item.tradicional_digital || 'Sin tipo';
        default: return 'Otros';
      }
    };

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    const [g1, g2, g3] = activeGroupingsProgramacionModal;

    filteredProgramacionModalData.forEach(item => {
      const key1 = getGroupKey(item, g1);
      const key2 = g2 ? getGroupKey(item, g2) : 'default';
      const key3 = g3 ? getGroupKey(item, g3) : 'default';

      if (!groups[key1]) groups[key1] = {};
      if (!groups[key1][key2]) groups[key1][key2] = {};
      if (!groups[key1][key2][key3]) groups[key1][key2][key3] = [];
      groups[key1][key2][key3].push(item);
    });

    return groups;
  }, [filteredProgramacionModalData, activeGroupingsProgramacionModal]);

  // Valores únicos para filtros del modal de Programación (incluye nombres de archivos)
  const getUniqueValuesProgramacionModal = useMemo(() => {
    const uniqueVals: Record<string, Set<string>> = {};
    FILTER_FIELDS_INVENTARIO.forEach(f => { uniqueVals[f.field] = new Set(); });
    // Agregar campo para nombre de archivo
    uniqueVals['nombre_archivo'] = new Set();

    taskInventory.forEach(item => {
      FILTER_FIELDS_INVENTARIO.forEach(f => {
        const val = (item as unknown as Record<string, unknown>)[f.field];
        if (val !== null && val !== undefined && val !== '') {
          uniqueVals[f.field].add(String(val));
        }
      });
      // Agregar nombres de archivos digitales
      const fileNames = digitalFileNamesMap.get(item.id) || [];
      fileNames.forEach(fileName => {
        uniqueVals['nombre_archivo'].add(fileName);
      });
    });
    const result: Record<string, string[]> = {};
    Object.entries(uniqueVals).forEach(([field, set]) => {
      result[field] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    });
    return result;
  }, [taskInventory, digitalFileNamesMap]);

  // Extraer total de impresiones pedidas (para Recepción)
  // Usa num_impresiones directamente, con fallbacks para tareas antiguas
  const impresionesOrdenadas = useMemo(() => {
    if (task?.tipo !== 'Recepción') return 0;

    // Usar num_impresiones directamente si existe
    if (task.num_impresiones) return task.num_impresiones;

    // Fallback: Si es tarea de faltantes, leer de la evidencia
    if (task.evidencia) {
      try {
        const evidenciaObj = JSON.parse(task.evidencia);
        if (evidenciaObj.tipo === 'recepcion_faltantes' && evidenciaObj.totalFaltantes) {
          return evidenciaObj.totalFaltantes;
        }
      } catch (e) {}
    }

    // Fallback: Intentar desde la descripción (ambos formatos)
    const match = task.descripcion?.match(/(?:Total de )?[Ii]mpresiones solicitadas:\s*(\d+)/);
    if (match) return parseInt(match[1]);

    // Fallback final: usar el número de items en la tarea
    return taskInventory.length;
  }, [task, taskInventory]);

  // Items seleccionados
  const selectedArteItems = useMemo(() => {
    return taskInventory.filter(item => selectedArteIds.has(item.id));
  }, [taskInventory, selectedArteIds]);

  // Detectar si todos los items seleccionados en Editar son digitales
  // Solo considera digital si tradicional_digital === 'Digital'
  const isDigitalEditarSelection = useMemo(() => {
    if (selectedArteItems.length === 0) return false;

    // Verificar si todos los items son digitales basándose únicamente en tradicional_digital
    return selectedArteItems.every(item => item.tradicional_digital === 'Digital');
  }, [selectedArteItems]);

  // Cargar archivos digitales existentes cuando se seleccionen items digitales
  useEffect(() => {
    const loadExistingDigitalFiles = async () => {
      if (!isDigitalEditarSelection || selectedArteItems.length === 0) {
        setExistingDigitalFilesEditar([]);
        setDigitalFilesEditar([]);
        setFilesToDelete([]);
        return;
      }

      // Obtener el primer reserva ID de los items seleccionados
      const firstItem = selectedArteItems[0];
      const rsvIds = firstItem.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];

      if (rsvIds.length === 0) {
        setExistingDigitalFilesEditar([]);
        return;
      }

      setIsLoadingExistingFiles(true);
      try {
        const imagenes = await campanasService.getImagenesDigitales(campanaId, rsvIds[0]);
        setExistingDigitalFilesEditar(imagenes.map(img => ({
          id: img.id,
          archivo: img.archivo,
          archivoData: img.archivoData,
          spot: img.spot,
          tipo: img.archivo.match(/\.(mp4|mov|avi|webm|mkv|wmv)$/i) ? 'video' as const : 'image' as const,
          estado: img.estado,
        })));
        setFilesToDelete([]);
        setDigitalFilesEditar([]);
      } catch (error) {
        console.error('Error loading existing digital files:', error);
        setExistingDigitalFilesEditar([]);
      } finally {
        setIsLoadingExistingFiles(false);
      }
    };

    loadExistingDigitalFiles();
  }, [isDigitalEditarSelection, selectedArteItems, campanaId]);

  // Agrupar inventario para tab Atender
  // Cuando se agrupa por ciudad/grupo, también se sub-agrupa por archivo para separar artes diferentes
  const groupedInventory = useMemo(() => {
    const groups: Record<string, InventoryRow[]> = {};
    taskInventory.forEach(item => {
      let key = '';
      switch (groupBy) {
        case 'ciudad':
          // Agrupar por ciudad + archivo (para separar artes diferentes)
          const ciudadKey = item.ciudad || 'Sin ciudad';
          const archivoKeyCiudad = item.archivo_arte || 'sin_arte';
          key = `${ciudadKey}|||${archivoKeyCiudad}`;
          break;
        case 'grupo':
          // Agrupar por grupo + archivo (para separar artes diferentes)
          const grupoKey = item.grupo_id || item.id;
          const archivoKeyGrupo = item.archivo_arte || 'sin_arte';
          key = `${grupoKey}|||${archivoKeyGrupo}`;
          break;
        default:
          key = item.id;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [taskInventory, groupBy]);

  // === Funciones helper para filtros - Paso 1 (Resumen) ===
  const addFilterResumen = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersResumen(prev => [...prev, newFilter]);
  }, []);

  const updateFilterResumen = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersResumen(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterResumen = useCallback((id: string) => {
    setFiltersResumen(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersResumen = useCallback(() => setFiltersResumen([]), []);

  const toggleGroupingResumen = useCallback((field: GroupByField) => {
    setActiveGroupingsResumen(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length >= 3) return prev;
      return [...prev, field];
    });
  }, []);

  const clearGroupingsResumen = useCallback(() => setActiveGroupingsResumen([]), []);

  // === Funciones helper para filtros - Paso 2 (Editar) ===
  const addFilterEditar = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersEditar(prev => [...prev, newFilter]);
  }, []);

  const updateFilterEditar = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersEditar(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterEditar = useCallback((id: string) => {
    setFiltersEditar(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersEditar = useCallback(() => setFiltersEditar([]), []);

  const toggleGroupingEditar = useCallback((field: GroupByField) => {
    setActiveGroupingsEditar(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length >= 3) return prev;
      return [...prev, field];
    });
  }, []);

  const clearGroupingsEditar = useCallback(() => setActiveGroupingsEditar([]), []);

  // === Valores únicos para filtros ===
  const uniqueValuesModal = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const uniqueSet = new Set<string>();
      taskInventory.forEach(item => {
        const value = (item as unknown as Record<string, unknown>)[field.field];
        if (value !== null && value !== undefined && value !== '') {
          uniqueSet.add(String(value));
        }
      });
      values[field.field] = Array.from(uniqueSet).sort();
    });
    return values;
  }, [taskInventory]);

  // === Datos filtrados y ordenados - Paso 1 (Resumen) ===
  const filteredDataResumen = useMemo(() => {
    let data = [...taskInventory];

    // Aplicar filtros
    if (filtersResumen.length > 0) {
      data = applyFilters(data, filtersResumen);
    }

    // Aplicar ordenamiento
    if (sortFieldResumen) {
      data.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortFieldResumen];
        const bVal = (b as unknown as Record<string, unknown>)[sortFieldResumen];
        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return sortDirectionResumen === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [taskInventory, filtersResumen, sortFieldResumen, sortDirectionResumen]);

  // === Datos filtrados y ordenados - Paso 2 (Editar) ===
  const filteredDataEditar = useMemo(() => {
    let data = [...taskInventory];

    // Aplicar filtros
    if (filtersEditar.length > 0) {
      data = applyFilters(data, filtersEditar);
    }

    // Aplicar ordenamiento
    if (sortFieldEditar) {
      data.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortFieldEditar];
        const bVal = (b as unknown as Record<string, unknown>)[sortFieldEditar];
        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return sortDirectionEditar === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [taskInventory, filtersEditar, sortFieldEditar, sortDirectionEditar]);

  // === Datos agrupados - Paso 1 (Resumen) ===
  const groupedDataResumen = useMemo(() => {
    if (activeGroupingsResumen.length === 0) return {} as Record<string, InventoryRow[]>;

    const groups: Record<string, InventoryRow[]> = {};
    filteredDataResumen.forEach(item => {
      const keyParts = activeGroupingsResumen.map(field => getGroupKeyForField(item, field));
      const key = keyParts.join(' > ');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredDataResumen, activeGroupingsResumen]);

  // === Datos agrupados - Paso 2 (Editar) ===
  const groupedDataEditar = useMemo(() => {
    if (activeGroupingsEditar.length === 0) return {} as Record<string, InventoryRow[]>;

    const groups: Record<string, InventoryRow[]> = {};
    filteredDataEditar.forEach(item => {
      const keyParts = activeGroupingsEditar.map(field => getGroupKeyForField(item, field));
      const key = keyParts.join(' > ');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredDataEditar, activeGroupingsEditar]);

  const toggleArteSelection = (id: string) => {
    setSelectedArteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllArtes = () => {
    if (selectedArteIds.size === taskInventory.length) {
      setSelectedArteIds(new Set());
    } else {
      setSelectedArteIds(new Set(taskInventory.map(item => item.id)));
    }
  };

  const handleApprove = (items?: InventoryRow[]) => {
    const itemsToApprove = items || selectedArteItems;
    const reservaIds = itemsToApprove.flatMap(item =>
      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );
    if (reservaIds.length > 0) {
      onApprove(reservaIds);
      setSelectedArteIds(new Set());
    }
  };

  const handleReject = (items?: InventoryRow[]) => {
    const comentario = prompt('Ingresa el motivo del rechazo:');
    if (comentario) {
      const itemsToReject = items || selectedArteItems;
      const reservaIds = itemsToReject.flatMap(item =>
        item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      );
      if (reservaIds.length > 0) {
        onReject(reservaIds, comentario);
        setSelectedArteIds(new Set());
      }
    }
  };

  // === Funciones para el sistema de decisiones ===
  const handleDecisionChange = (key: string, decision: string) => {
    setDecisiones(prev => ({
      ...prev,
      [key]: {
        decision: (decision || null) as DecisionArte,
        motivoRechazo: decision !== 'rechazar' ? undefined : prev[key]?.motivoRechazo,
        comentarioAprobacion: decision !== 'aprobar' ? undefined : prev[key]?.comentarioAprobacion
      }
    }));
    setValidationErrors([]);
  };

  const handleMotivoChange = (key: string, motivo: string) => {
    setDecisiones(prev => ({
      ...prev,
      [key]: { ...prev[key], motivoRechazo: motivo }
    }));
  };

  const handleComentarioAprobacionChange = (key: string, comentario: string) => {
    setDecisiones(prev => ({
      ...prev,
      [key]: { ...prev[key], comentarioAprobacion: comentario }
    }));
  };

  const validarDecisiones = (): boolean => {
    const errors: string[] = [];
    Object.keys(groupedInventory).forEach(key => {
      const decision = decisiones[key];
      if (!decision?.decision) {
        errors.push(`Falta seleccionar acción para: ${key}`);
      } else if (decision.decision === 'rechazar' && !decision.motivoRechazo?.trim()) {
        errors.push(`Falta motivo de rechazo para: ${key}`);
      }
    });
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleFinalizar = async () => {
    if (!validarDecisiones()) return;
    setIsFinalizando(true);

    try {
      const aprobados: { ids: number[]; comentario: string; items: InventoryRow[] }[] = [];
      const rechazados: { ids: number[]; motivo: string; items: InventoryRow[] }[] = [];

      Object.entries(groupedInventory).forEach(([key, items]) => {
        const d = decisiones[key];
        const ids = items.flatMap(item =>
          item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        );

        if (d?.decision === 'aprobar') {
          aprobados.push({ ids, comentario: d.comentarioAprobacion || '', items });
        }
        if (d?.decision === 'rechazar') {
          rechazados.push({ ids, motivo: d.motivoRechazo || '', items });
        }
      });

      // Aprobar todos los marcados como aprobados
      if (aprobados.length > 0) {
        const todosIds = aprobados.flatMap(a => a.ids);
        // Construir comentario combinado si hay comentarios
        const comentariosAprobacion = aprobados
          .filter(a => a.comentario.trim())
          .map(a => `**${a.items.map(i => i.codigo_unico).join(', ')}:**\n${a.comentario}`)
          .join('\n\n---\n\n');
        await onApprove(todosIds, comentariosAprobacion || undefined);
      }

      // Rechazar y crear tarea de corrección con todos los rechazados
      if (rechazados.length > 0) {
        const todosIds = rechazados.flatMap(r => r.ids);
        const descripcion = rechazados.map(r =>
          `**${r.items.map(i => i.codigo_unico).join(', ')}:**\n${r.motivo}`
        ).join('\n\n---\n\n');

        await onReject(todosIds, descripcion);
      }

      // Marcar la tarea como completada (Atendido)
      if (task?.id) {
        await onTaskComplete(task.id);
      }

      // Limpiar estado y cerrar modal
      setDecisiones({});
      setValidationErrors([]);
      onClose();
    } catch (error) {
      console.error('Error al finalizar:', error);
    } finally {
      setIsFinalizando(false);
    }
  };

  // Función para enviar artes corregidos a revisión (para tareas de Corrección)
  const handleEnviarARevision = async () => {
    if (!task) return;
    setIsFinalizando(true);

    try {
      // Obtener todos los IDs de reservas de la tarea
      const reservaIds = taskInventory.flatMap(item =>
        item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      );

      if (reservaIds.length === 0) {
        console.error('No hay reservas para enviar a revisión');
        return;
      }

      // El responsable de la tarea de corrección es quien rechazó,
      // debemos crear la nueva tarea de revisión asignada a él
      const responsableRevision = task.responsable || task.creador || '';

      // Enviar a revisión (cambia estado a Pendiente y crea nueva tarea)
      await onSendToReview(reservaIds, responsableRevision);

      // Marcar la tarea de corrección como completada
      if (task.id) {
        await onTaskComplete(task.id);
      }

      // Cerrar modal
      onClose();
    } catch (error) {
      console.error('Error al enviar a revisión:', error);
    } finally {
      setIsFinalizando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Manejar cambio de archivos digitales (múltiples) en Editar tab
  const handleDigitalFilesChangeEditar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Contar archivos existentes que no están marcados para eliminar
    const existingNotDeleted = existingDigitalFilesEditar.filter(f => !filesToDelete.includes(f.id));
    const existingMaxSpot = existingNotDeleted.length > 0 ? Math.max(...existingNotDeleted.map(f => f.spot)) : 0;
    const newMaxSpot = digitalFilesEditar.length > 0 ? Math.max(...digitalFilesEditar.map(f => f.spot)) : 0;
    const currentMaxSpot = Math.max(existingMaxSpot, newMaxSpot);

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) return; // Solo aceptar videos e imágenes

      const reader = new FileReader();
      reader.onload = (event) => {
        const newFile: DigitalFile = {
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: event.target?.result as string,
          spot: currentMaxSpot + index + 1,
          type: isVideo ? 'video' : 'image',
        };
        setDigitalFilesEditar(prev => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });

    // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
    e.target.value = '';
  };

  // Eliminar un archivo digital nuevo de Editar tab
  const handleRemoveDigitalFileEditar = (id: string) => {
    setDigitalFilesEditar(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // Reordenar spots después de eliminar
      const existingCount = existingDigitalFilesEditar.filter(f => !filesToDelete.includes(f.id)).length;
      return filtered.map((f, index) => ({ ...f, spot: existingCount + index + 1 }));
    });
  };

  // Marcar un archivo existente para eliminación
  const handleRemoveExistingFileEditar = (id: number) => {
    setFilesToDelete(prev => [...prev, id]);
    // Reordenar los spots de los archivos nuevos
    const remainingExisting = existingDigitalFilesEditar.filter(f => !filesToDelete.includes(f.id) && f.id !== id).length;
    setDigitalFilesEditar(prev => prev.map((f, index) => ({ ...f, spot: remainingExisting + index + 1 })));
  };

  // Restaurar un archivo existente que estaba marcado para eliminación
  const handleRestoreExistingFileEditar = (id: number) => {
    setFilesToDelete(prev => prev.filter(fid => fid !== id));
  };

  // Manejar drag start para reordenar en Editar tab
  const handleDragStartEditar = (id: string) => {
    setDraggedFileEditar(id);
  };

  // Manejar drag over en Editar tab
  const handleDragOverEditar = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedFileEditar || draggedFileEditar === targetId) return;

    setDigitalFilesEditar(prev => {
      const draggedIndex = prev.findIndex(f => f.id === draggedFileEditar);
      const targetIndex = prev.findIndex(f => f.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newFiles = [...prev];
      const [removed] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, removed);

      // Actualizar spots después de reordenar
      return newFiles.map((f, index) => ({ ...f, spot: index + 1 }));
    });
  };

  // Manejar drag end en Editar tab
  const handleDragEndEditar = () => {
    setDraggedFileEditar(null);
  };

  // Handler para actualizar artes digitales (múltiples archivos)
  const handleUpdateImageDigital = async () => {
    // Verificar que hay cambios (archivos a eliminar o nuevos archivos)
    if (filesToDelete.length === 0 && digitalFilesEditar.length === 0) return;

    const reservaIds = selectedArteItems.flatMap(item =>
      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );

    if (reservaIds.length > 0) {
      // Convertir IDs de archivos a eliminar a sus paths de archivo
      // Esto permite eliminar el mismo archivo de todas las reservas seleccionadas
      const archivosToDelete = filesToDelete
        .map(id => existingDigitalFilesEditar.find(f => f.id === id)?.archivo)
        .filter((archivo): archivo is string => !!archivo);

      await onUpdateArteDigital(
        reservaIds,
        digitalFilesEditar.map(f => ({ file: f.file, spot: f.spot })),
        archivosToDelete
      );
      setSelectedArteIds(new Set());
      setDigitalFilesEditar([]);
      setExistingDigitalFilesEditar([]);
      setFilesToDelete([]);
    }
  };

  const handleClearImage = () => {
    const reservaIds = selectedArteItems.flatMap(item =>
      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );
    if (reservaIds.length > 0) {
      onUpdateArte(reservaIds, '');
      setSelectedArteIds(new Set());
    }
  };

  const handleUpdateImage = async () => {
    try {
      let archivo = '';
      if (uploadOption === 'file' && selectedFile) {
        // Convertir archivo a base64 (como en solicitudes)
        archivo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo'));
          reader.readAsDataURL(selectedFile);
        });
      } else if (uploadOption === 'existing') {
        archivo = existingArtUrl;
      } else if (uploadOption === 'link') {
        archivo = linkUrl;
      }

      if (archivo) {
        const reservaIds = selectedArteItems.flatMap(item =>
          item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        );
        if (reservaIds.length > 0) {
          onUpdateArte(reservaIds, archivo);
          setSelectedArteIds(new Set());
          setSelectedFile(null);
          setFilePreview(null);
          setExistingArtUrl('');
          setLinkUrl('');
        }
      }
    } catch (error) {
      console.error('Error al actualizar imagen:', error);
    }
  };

  const handleUpdateMasivo = async () => {
    try {
      let archivo = '';
      if (uploadOption === 'file' && selectedFile) {
        // Convertir archivo a base64 (como en solicitudes)
        archivo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo'));
          reader.readAsDataURL(selectedFile);
        });
      } else if (uploadOption === 'existing') {
        archivo = existingArtUrl;
      } else if (uploadOption === 'link') {
        archivo = linkUrl;
      }

      if (archivo) {
        const reservaIds = taskInventory.flatMap(item =>
          item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        );
        if (reservaIds.length > 0) {
          onUpdateArte(reservaIds, archivo);
          setSelectedFile(null);
          setFilePreview(null);
          setExistingArtUrl('');
          setLinkUrl('');
        }
      }
    } catch (error) {
      console.error('Error al actualizar masivamente:', error);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para generar PDF del proveedor (tareas de Impresión)
  const generatePDFProveedor = async () => {
    if (!task || task.tipo !== 'Impresión') return;

    try {
      const { jsPDF } = await import('jspdf');

      // Colores corporativos
      const colorMorado: [number, number, number] = [128, 0, 128];
      const colorGris: [number, number, number] = [100, 100, 100];

      // Crear documento
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let posY = 20;

      // Datos de la tarea
      const proveedor = task.nombre_proveedores || 'Proveedor';
      const impresiones = impresionesData?.impresiones || {};

      // Agrupar items por archivo_arte para el PDF
      const artesAgrupados: Record<string, { items: typeof taskInventory; archivo: string | undefined; cantidadTotal: number }> = {};
      taskInventory.forEach(item => {
        const key = item.archivo_arte || 'sin_arte';
        if (!artesAgrupados[key]) {
          artesAgrupados[key] = { items: [], archivo: item.archivo_arte, cantidadTotal: 0 };
        }
        artesAgrupados[key].items.push(item);
        artesAgrupados[key].cantidadTotal += impresiones[key] ? Math.ceil(impresiones[key] / artesAgrupados[key].items.length) : 1;
      });

      // Recalcular cantidades correctamente
      Object.keys(artesAgrupados).forEach(key => {
        artesAgrupados[key].cantidadTotal = impresiones[key] || artesAgrupados[key].items.length;
      });

      const groupedArray = Object.values(artesAgrupados);

      // Encabezado con logo y datos de la empresa
      doc.setFillColor(colorMorado[0], colorMorado[1], colorMorado[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');

      // Título IMU
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.text('IMU', 15, 15);

      // Subtítulo
      doc.setFontSize(10);
      doc.text('Impresiones y Mobiliario Urbano', 15, 22);

      // Fecha actual
      const fecha = new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      doc.setFontSize(9);
      doc.text(fecha, pageWidth - 50, 15);

      // Mensaje de presentación
      posY = 40;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Estimado ${proveedor}:`, 15, posY);
      posY += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const mensaje = 'Por este medio le hacemos llegar la solicitud de impresión de los materiales detallados a continuación. Agradecemos de antemano su atención y servicio para cumplir con los tiempos de entrega establecidos.';
      const mensajeLines = doc.splitTextToSize(mensaje, pageWidth - 30);
      doc.text(mensajeLines, 15, posY);
      posY += mensajeLines.length * 7;

      // Información del pedido
      posY += 10;
      doc.setFillColor(240, 240, 240);
      doc.rect(15, posY, pageWidth - 30, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(colorMorado[0], colorMorado[1], colorMorado[2]);
      doc.text('DETALLES DEL PEDIDO', pageWidth/2, posY + 7, { align: 'center' });
      posY += 18;

      // Tabla de items
      const headers = ['Cant.', 'Ancho', 'Alto', 'Catorcena', 'Formato', 'Plaza', 'URL Imagen'];
      const colWidths = [15, 18, 18, 38, 28, 30, 33];
      const availableWidth = pageWidth - 30;
      const rowHeight = 12;
      const startX = 15;

      // Encabezados de tabla
      doc.setFillColor(colorMorado[0], colorMorado[1], colorMorado[2]);
      doc.rect(startX, posY, availableWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');

      let currentX = startX;
      headers.forEach((header, i) => {
        const cellCenterX = currentX + (colWidths[i] / 2);
        doc.text(header, cellCenterX, posY + 8, { align: 'center' });
        currentX += colWidths[i];
      });
      posY += rowHeight;

      // Filas de datos
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);

      let rowIndex = 0;
      for (const grupo of groupedArray) {
        const item = grupo.items[0]; // Usar el primer item para datos comunes

        // Color alternado
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 248, 255);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(startX, posY, availableWidth, rowHeight, 'F');

        // Formatear catorcena
        const catorcenaText = item.catorcena && item.anio
          ? `Cat: ${item.catorcena}, ${item.anio}`
          : '-';

        const imageUrl = grupo.archivo ? (getImageUrl(grupo.archivo) || grupo.archivo) : '';

        const valores = [
          grupo.cantidadTotal.toString(),
          item.ancho ? String(item.ancho) : '-',
          item.alto ? String(item.alto) : '-',
          catorcenaText,
          item.mueble || '-',
          (item.plaza || '-').substring(0, 12),
          imageUrl ? 'Ver imagen' : '-'
        ];

        currentX = startX;
        valores.forEach((val, i) => {
          // URL en color morado
          if (i === 6 && imageUrl) {
            doc.setTextColor(colorMorado[0], colorMorado[1], colorMorado[2]);
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
          }

          const cellCenterX = currentX + (colWidths[i] / 2);
          doc.text(val, cellCenterX, posY + 8, { align: 'center' });

          // Agregar borde a cada celda
          doc.setDrawColor(220, 220, 220);
          doc.rect(currentX, posY, colWidths[i], rowHeight);

          // Enlace clickeable para URL
          if (i === 6 && imageUrl) {
            doc.link(currentX, posY, colWidths[i], rowHeight, { url: imageUrl });
          }

          currentX += colWidths[i];
        });

        posY += rowHeight;
        rowIndex++;

        // Salto de página si es necesario
        if (posY > pageHeight - 40) {
          doc.addPage();

          // Encabezado en nueva página
          doc.setFillColor(colorMorado[0], colorMorado[1], colorMorado[2]);
          doc.rect(0, 0, pageWidth, 15, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.text('IMU - Continuación', 15, 10);

          posY = 25;

          // Recrear encabezados de tabla
          doc.setFillColor(colorMorado[0], colorMorado[1], colorMorado[2]);
          doc.rect(startX, posY, availableWidth, rowHeight, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');

          currentX = startX;
          headers.forEach((header, i) => {
            const cellCenterX = currentX + (colWidths[i] / 2);
            doc.text(header, cellCenterX, posY + 8, { align: 'center' });
            currentX += colWidths[i];
          });
          posY += rowHeight;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(7);
        }
      }

      // Pie de página
      posY += 15;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(colorGris[0], colorGris[1], colorGris[2]);
      doc.setFontSize(9);
      doc.text('Para cualquier duda o aclaración, favor de contactarnos a contacto@imu.com', pageWidth/2, posY, { align: 'center' });

      posY += 7;
      doc.setFontSize(8);
      doc.text(`IMU - Impresiones y Mobiliario Urbano © ${new Date().getFullYear()}`, pageWidth/2, posY, { align: 'center' });

      // Línea decorativa
      posY += 5;
      doc.setDrawColor(colorMorado[0], colorMorado[1], colorMorado[2]);
      doc.setLineWidth(0.5);
      doc.line(50, posY, pageWidth - 50, posY);

      // Guardar PDF
      doc.save(`orden_impresion_${task.titulo || 'pedido'}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
    }
  };

  // Handler para crear tarea de recepción
  const handleCrearRecepcion = async () => {
    if (!task || !task.id) return;

    setIsCreatingRecepcion(true);
    try {
      await onCreateRecepcion(task.id, recepcionAsignadoNombre || undefined);
      setRecepcionAsignadoNombre('');
      setRecepcionAsignadoSearch('');
      onClose();
    } catch (error) {
      console.error('Error al crear tarea de recepción:', error);
    } finally {
      setIsCreatingRecepcion(false);
    }
  };

  // Handler para finalizar tarea de recepción
  const handleFinalizarRecepcion = async () => {
    if (!task || !task.id) return;

    setIsFinalizandoRecepcion(true);
    try {
      // Calcular faltantes por arte
      const faltantesPorArte: { arte: string; solicitadas: number; recibidas: number; faltantes: number }[] = [];

      // Verificar tipo de tarea desde evidencia
      let tipoEvidencia = '';
      let faltantesData: { arte: string; cantidad: number }[] = [];
      let impresionesData: Record<string, number> = {};

      if (task.evidencia) {
        try {
          const evidenciaObj = JSON.parse(task.evidencia);
          tipoEvidencia = evidenciaObj.tipo || '';
          if (evidenciaObj.faltantesPorArte) {
            faltantesData = evidenciaObj.faltantesPorArte;
          }
          if (evidenciaObj.impresiones && typeof evidenciaObj.impresiones === 'object') {
            impresionesData = evidenciaObj.impresiones;
          }
        } catch (e) {}
      }

      if (tipoEvidencia === 'recepcion_faltantes' && faltantesData.length > 0) {
        // Para tareas de faltantes, usar los datos de la evidencia
        faltantesData.forEach((faltante) => {
          const key = faltante.arte || 'sin_arte';
          const solicitadas = faltante.cantidad;
          const recibidas = cantidadesRecibidas[key] || 0;
          const diferencia = solicitadas - recibidas;

          if (diferencia > 0) {
            faltantesPorArte.push({
              arte: faltante.arte || 'Sin arte',
              solicitadas,
              recibidas,
              faltantes: diferencia
            });
          }
        });
      } else if (Object.keys(impresionesData).length > 0) {
        // Para tareas con evidencia de impresiones (recepcion_normal o impresión), usar las URLs directamente
        Object.entries(impresionesData).forEach(([arteUrl, solicitadas]) => {
          const recibidas = cantidadesRecibidas[arteUrl] || 0;
          const faltantes = solicitadas - recibidas;

          if (faltantes > 0) {
            faltantesPorArte.push({
              arte: arteUrl,
              solicitadas,
              recibidas,
              faltantes
            });
          }
        });
      } else {
        // Fallback: usar taskInventory
        const artesAgrupados = taskInventory.reduce((acc, item) => {
          const key = item.archivo_arte || 'sin_arte';
          if (!acc[key]) {
            acc[key] = { items: [], archivo: item.archivo_arte };
          }
          acc[key].items.push(item);
          return acc;
        }, {} as Record<string, { items: typeof taskInventory; archivo: string | undefined }>);

        const numGrupos = Object.keys(artesAgrupados).length;

        Object.entries(artesAgrupados).forEach(([key, grupo]) => {
          const solicitadas = numGrupos === 1 ? impresionesOrdenadas : grupo.items.length;
          const recibidas = cantidadesRecibidas[key] || 0;
          const faltantes = solicitadas - recibidas;

          if (faltantes > 0) {
            faltantesPorArte.push({
              arte: grupo.archivo || 'Sin arte',
              solicitadas,
              recibidas,
              faltantes
            });
          }
        });
      }

      // Si hay faltantes, crear nueva tarea de recepción
      if (faltantesPorArte.length > 0) {
        await onCreateRecepcionFaltante(faltantesPorArte, observacionesRecepcion);
      }

      // Actualizar la tarea actual como completada (con observaciones si las hay)
      await onTaskComplete(task.id, observacionesRecepcion || undefined);

      // Cerrar modal
      onClose();
    } catch (error) {
      console.error('Error al finalizar recepción:', error);
    } finally {
      setIsFinalizandoRecepcion(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('resumen');
      setSelectedArteIds(new Set());
      setSelectedFile(null);
      setFilePreview(null);
      setExistingArtUrl('');
      setLinkUrl('');
      // Reset estados de Recepción
      setCantidadesRecibidas({});
      setObservacionesRecepcion('');
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  // Para tareas de Corrección, el orden es: Resumen -> Editar -> Atender
  // Para otras tareas: Resumen -> Atender -> Editar
  const tabs = task.tipo === 'Correccion' ? [
    { key: 'resumen' as const, label: 'Paso 1: Resumen', icon: FileText },
    { key: 'editar' as const, label: 'Paso 2: Editar Arte', icon: Edit3 },
    { key: 'atender' as const, label: 'Paso 3: Atender Arte', icon: CheckCircle2 },
  ] : [
    { key: 'resumen' as const, label: 'Paso 1: Resumen', icon: FileText },
    { key: 'atender' as const, label: 'Paso 2: Atender Arte', icon: CheckCircle2 },
    { key: 'editar' as const, label: 'Paso 3: Editar Arte', icon: Edit3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-card border border-border rounded-xl w-full max-w-[95vw] max-h-[95vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-purple-900/30 to-transparent flex-shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-400" />
                {task.titulo || task.identificador}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {task.tipo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs - Solo mostrar si NO es tarea de Impresión, Recepción, Instalación ni Testigo */}
          {task.tipo !== 'Impresión' && task.tipo !== 'Recepción' && task.tipo !== 'Instalación' && task.tipo !== 'Testigo' && task.tipo !== 'Programación' && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tabs
                .filter(tab => canResolveCurrentTask || tab.key === 'resumen')
                .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(': ')[1]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {/* === VISTA ESPECIAL PARA TAREAS DE IMPRESIÓN === */}
          {task.tipo === 'Impresión' && (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setImpresionTab('resumen')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    impresionTab === 'resumen'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Resumen
                </button>
                <button
                  onClick={() => setImpresionTab('tabla')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    impresionTab === 'tabla'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Ver tabla ({taskInventory.length})
                </button>
              </div>

              {/* Tab Resumen */}
              {impresionTab === 'resumen' && (
                <>
              {/* Info de la tarea de Impresión */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-purple-300 mb-3">Información del Pedido de Impresión</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Título:</span>
                    <p className="text-white font-medium">{task.titulo || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Estatus:</span>
                    <p className={`font-medium ${task.estatus === 'Activo' ? 'text-green-400' : task.estatus === 'Atendido' ? 'text-blue-400' : 'text-yellow-400'}`}>
                      {task.estatus}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Proveedor:</span>
                    <p className="text-white font-medium">{(task as any).nombre_proveedores || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Asignado:</span>
                    <p className="text-white font-medium">{task.asignado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Catorcena de entrega:</span>
                    <p className="text-white font-medium">{impresionesData?.catorcena_entrega || getCatorcenaFromFechaFin || '-'}</p>
                  </div>
                  <div className="md:col-span-3">
                    <span className="text-zinc-500">Descripción:</span>
                    <p className="text-white">{task.descripcion || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Fecha de creación:</span>
                    <p className="text-white font-medium">{task.fecha_inicio || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Creador:</span>
                    <p className="text-white font-medium">{task.creador || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Lista de artes agrupadas con cantidades */}
              <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                  <h4 className="text-sm font-medium text-purple-300">
                    Artes a imprimir ({taskInventory.length} ubicaciones)
                  </h4>
                </div>
                {
                  <div className="max-h-[300px] overflow-y-auto">
                    {(() => {
                      // Intentar obtener artes desde evidencia
                      let impresionesMap: Record<string, number> = {};
                      if (task.evidencia) {
                        try {
                          const evidenciaObj = JSON.parse(task.evidencia);
                          if (evidenciaObj.impresiones && typeof evidenciaObj.impresiones === 'object') {
                            impresionesMap = evidenciaObj.impresiones;
                          }
                        } catch (e) {}
                      }

                      const artesEntries = Object.entries(impresionesMap);

                      // Si hay artes en evidencia, mapearlas
                      if (artesEntries.length > 0) {
                        return artesEntries.map(([arteUrl, cantidad]) => {
                          const nombreArchivo = arteUrl.split('/').pop() || 'arte.jpg';
                          const imageUrl = getImageUrl(arteUrl);
                          return (
                            <div key={arteUrl} className="flex items-center gap-4 p-3 border-b border-border/50 last:border-0 hover:bg-zinc-800/30">
                              {/* Preview de imagen */}
                              <div className="w-24 h-20 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt="Arte"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Image className="h-6 w-6 text-zinc-600" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {nombreArchivo}
                                </p>
                                <p className="text-xs text-zinc-400">
                                  Arte para impresión
                                </p>
                              </div>

                              {/* Cantidad de impresiones */}
                              <div className="flex-shrink-0 text-center px-4">
                                <p className="text-3xl font-bold text-purple-400">{cantidad}</p>
                                <p className="text-[10px] text-zinc-500">impresiones</p>
                              </div>

                              {/* Botón descargar */}
                              <button
                                onClick={() => imageUrl && downloadImage(imageUrl, nombreArchivo)}
                                className="p-2 text-zinc-400 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                                title="Descargar imagen"
                              >
                                <Download className="h-5 w-5" />
                              </button>
                            </div>
                          );
                        });
                      }

                      // Fallback: usar taskInventory si no hay evidencia
                      const numImpresiones = task.num_impresiones || taskInventory.length;
                      const primerItem = taskInventory[0];

                      if (taskInventory.length === 0) {
                        return (
                          <div className="p-8 text-center text-zinc-500">
                            No hay items asociados a esta tarea
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-4 p-3 border-b border-border/50 last:border-0 hover:bg-zinc-800/30">
                          {/* Preview de imagen */}
                          <div className="w-24 h-20 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                            {primerItem?.archivo_arte ? (
                              <img
                                src={getImageUrl(primerItem.archivo_arte) || ''}
                                alt="Arte"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="h-6 w-6 text-zinc-600" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">
                              {taskInventory.length} {taskInventory.length === 1 ? 'ubicación' : 'ubicaciones'}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {primerItem?.mueble || 'Mueble'} - {primerItem?.ciudad || 'Ciudad'}
                            </p>
                          </div>

                          {/* Cantidad de impresiones - desde num_impresiones */}
                          <div className="flex-shrink-0 text-center px-4">
                            <p className="text-3xl font-bold text-purple-400">{numImpresiones}</p>
                            <p className="text-[10px] text-zinc-500">impresiones</p>
                          </div>

                          {/* Botón descargar */}
                          {primerItem?.archivo_arte && (
                            <button
                              onClick={() => downloadImage(getImageUrl(primerItem.archivo_arte)!, `arte.jpg`)}
                              className="p-2 text-zinc-400 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                              title="Descargar imagen"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  }
              </div>

              {/* Asignar tarea de recepción */}
              {task.estatus === 'Activo' && canResolveProduccionTasks && (
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-purple-300 mb-3">Crear tarea de recepción</h4>
                  <div className="relative">
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Asignar a *</label>
                    <input
                      ref={recepcionInputRef}
                      type="text"
                      value={recepcionAsignadoSearch}
                      onChange={(e) => {
                        setRecepcionAsignadoSearch(e.target.value);
                        setShowRecepcionAsignadoDropdown(true);
                        if (!e.target.value) {
                          setRecepcionAsignadoNombre('');
                        }
                      }}
                      onFocus={() => {
                        if (recepcionInputRef.current) {
                          const rect = recepcionInputRef.current.getBoundingClientRect();
                          setDropdownPosition({
                            top: rect.bottom + 4,
                            left: rect.left,
                            width: rect.width,
                          });
                        }
                        setShowRecepcionAsignadoDropdown(true);
                      }}
                      onBlur={() => setTimeout(() => setShowRecepcionAsignadoDropdown(false), 200)}
                      placeholder="Buscar usuario..."
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {showRecepcionAsignadoDropdown && filteredUsuariosRecepcion.length > 0 && (
                      <div
                        className="fixed z-[9999] bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        style={{
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          width: dropdownPosition.width,
                        }}
                      >
                        {filteredUsuariosRecepcion.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setRecepcionAsignadoNombre(u.nombre);
                              setRecepcionAsignadoSearch(`${u.id}, ${u.nombre}`);
                              setShowRecepcionAsignadoDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                          >
                            {u.id}, {u.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
                </>
              )}

              {/* Tab Tabla */}
              {impresionTab === 'tabla' && (
                <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-purple-300">
                      Desglose completo ({taskInventory.length} ubicaciones) - Agrupado por Catorcena &gt; APS &gt; Grupo
                    </h4>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                    {Object.entries(groupedTaskInventory).map(([catorcenaKey, apsGroups]) => {
                      const level1NodeKey = `impresion-${catorcenaKey}`;
                      const level1Expanded = expandedNodes.has(level1NodeKey);
                      const level1ItemCount = Object.values(apsGroups).reduce(
                        (sum, grupoGroups) => sum + Object.values(grupoGroups).reduce((s, items) => s + items.length, 0), 0
                      );
                      return (
                        <div key={catorcenaKey}>
                          {/* Nivel 1 - Catorcena */}
                          <button
                            onClick={() => toggleNode(level1NodeKey)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {level1Expanded ? (
                                <ChevronDown className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400" />
                              )}
                              <span className="text-sm font-bold text-white">{catorcenaKey}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-600/40 text-purple-200">{level1ItemCount}</span>
                          </button>
                          {level1Expanded && (
                            <div className="pl-4">
                              {Object.entries(apsGroups).map(([apsKey, grupoGroups]) => {
                                const level2NodeKey = `${level1NodeKey}|${apsKey}`;
                                const level2Expanded = expandedNodes.has(level2NodeKey);
                                const level2ItemCount = Object.values(grupoGroups).reduce((s, items) => s + items.length, 0);
                                return (
                                  <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                    {/* Nivel 2 - APS */}
                                    <button
                                      onClick={() => toggleNode(level2NodeKey)}
                                      className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        {level2Expanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                        )}
                                        <span className="text-xs font-semibold text-purple-300">{apsKey}</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-600/30 text-purple-300">{level2ItemCount}</span>
                                    </button>
                                    {level2Expanded && (
                                      <div className="pl-4">
                                        {Object.entries(grupoGroups).map(([grupoKey, items]) => {
                                          const level3NodeKey = `${level2NodeKey}|${grupoKey}`;
                                          const level3Expanded = expandedNodes.has(level3NodeKey);
                                          return (
                                            <div key={level3NodeKey} className="border-l-2 border-amber-500/20">
                                              {/* Nivel 3 - Grupo */}
                                              <button
                                                onClick={() => toggleNode(level3NodeKey)}
                                                className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
                                              >
                                                <div className="flex items-center gap-2">
                                                  {level3Expanded ? (
                                                    <ChevronDown className="h-3 w-3 text-amber-400" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3 text-amber-400" />
                                                  )}
                                                  <span className="text-[11px] font-medium text-amber-300">{grupoKey}</span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-600/20 text-amber-300">{items.length}</span>
                                              </button>
                                              {level3Expanded && (
                                                <div className="bg-card/50 ml-4">
                                                  <table className="w-full text-xs">
                                                    <thead className="bg-purple-900/20">
                                                      <tr className="text-left">
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Archivo</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">ID</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Tipo Formato</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Código Único</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Ubicación</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Tipo Cara</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Formato</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Plaza</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Municipio</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">NSE</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Rsv ID</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {items.map((item) => (
                                                        <tr key={item.id} className="border-t border-border/30 hover:bg-purple-900/10">
                                                          <td className="px-3 py-2">
                                                            {item.archivo_arte && item.archivo_arte !== 'sin_arte' ? (
                                                              <div className="w-12 h-9 bg-zinc-800 rounded overflow-hidden border border-zinc-700">
                                                                <img
                                                                  src={getImageUrl(item.archivo_arte) || ''}
                                                                  alt="Arte"
                                                                  className="w-full h-full object-cover"
                                                                  onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                  }}
                                                                />
                                                              </div>
                                                            ) : (
                                                              <div className="w-12 h-9 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center">
                                                                <Image className="w-4 h-4 text-zinc-600" />
                                                              </div>
                                                            )}
                                                          </td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.id || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.tipo_medio || '-'}</td>
                                                          <td className="px-3 py-2 text-white font-mono whitespace-nowrap">{item.codigo_unico || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 max-w-[200px] truncate" title={item.ubicacion || '-'}>{item.ubicacion || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.tipo_de_cara || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.mueble || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.plaza || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.municipio || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.nse || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.rsv_id || '-'}</td>
                                                        </tr>
                                                      ))}
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
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-wrap items-center gap-3 justify-end">
                <button
                  onClick={generatePDFProveedor}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF Proveedor
                </button>
                {task.estatus === 'Activo' && canResolveProduccionTasks && (
                  <button
                    onClick={handleCrearRecepcion}
                    disabled={isCreatingRecepcion || !recepcionAsignadoNombre}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingRecepcion ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Crear tarea de recepción
                      </>
                    )}
                  </button>
                )}
              </div>
              {task.estatus === 'Activo' && !canResolveProduccionTasks && (
                <div className="bg-zinc-800/50 border border-border rounded-lg p-4 text-center mt-4">
                  <p className="text-sm text-zinc-400">Tarea de impresión activa - Solo visualización</p>
                </div>
              )}
            </div>
          )}

          {/* === VISTA ESPECIAL PARA TAREAS DE RECEPCIÓN === */}
          {task.tipo === 'Recepción' && (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setRecepcionTab('resumen')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    recepcionTab === 'resumen'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Resumen
                </button>
                <button
                  onClick={() => setRecepcionTab('tabla')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    recepcionTab === 'tabla'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Ver tabla ({taskInventory.length})
                </button>
              </div>

              {/* Tab Tabla */}
              {recepcionTab === 'tabla' && (
                <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-purple-300">
                      Desglose completo ({taskInventory.length} ubicaciones) - Agrupado por Catorcena &gt; APS &gt; Grupo
                    </h4>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
                    {Object.entries(groupedTaskInventory).map(([catorcenaKey, apsGroups]) => {
                      const level1NodeKey = `recepcion-${catorcenaKey}`;
                      const level1Expanded = expandedNodes.has(level1NodeKey);
                      const level1ItemCount = Object.values(apsGroups).reduce(
                        (sum, grupoGroups) => sum + Object.values(grupoGroups).reduce((s, items) => s + items.length, 0), 0
                      );
                      return (
                        <div key={catorcenaKey}>
                          {/* Nivel 1 - Catorcena */}
                          <button
                            onClick={() => toggleNode(level1NodeKey)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {level1Expanded ? (
                                <ChevronDown className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400" />
                              )}
                              <span className="text-sm font-bold text-white">{catorcenaKey}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-600/40 text-purple-200">{level1ItemCount}</span>
                          </button>
                          {level1Expanded && (
                            <div className="pl-4">
                              {Object.entries(apsGroups).map(([apsKey, grupoGroups]) => {
                                const level2NodeKey = `${level1NodeKey}|${apsKey}`;
                                const level2Expanded = expandedNodes.has(level2NodeKey);
                                const level2ItemCount = Object.values(grupoGroups).reduce((s, items) => s + items.length, 0);
                                return (
                                  <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                    {/* Nivel 2 - APS */}
                                    <button
                                      onClick={() => toggleNode(level2NodeKey)}
                                      className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        {level2Expanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                        )}
                                        <span className="text-xs font-semibold text-purple-300">{apsKey}</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-600/30 text-purple-300">{level2ItemCount}</span>
                                    </button>
                                    {level2Expanded && (
                                      <div className="pl-4">
                                        {Object.entries(grupoGroups).map(([grupoKey, items]) => {
                                          const level3NodeKey = `${level2NodeKey}|${grupoKey}`;
                                          const level3Expanded = expandedNodes.has(level3NodeKey);
                                          return (
                                            <div key={level3NodeKey} className="border-l-2 border-amber-500/20">
                                              {/* Nivel 3 - Grupo */}
                                              <button
                                                onClick={() => toggleNode(level3NodeKey)}
                                                className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
                                              >
                                                <div className="flex items-center gap-2">
                                                  {level3Expanded ? (
                                                    <ChevronDown className="h-3 w-3 text-amber-400" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3 text-amber-400" />
                                                  )}
                                                  <span className="text-[11px] font-medium text-amber-300">{grupoKey}</span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-600/20 text-amber-300">{items.length}</span>
                                              </button>
                                              {level3Expanded && (
                                                <div className="bg-card/50 ml-4">
                                                  <table className="w-full text-xs">
                                                    <thead className="bg-purple-900/20">
                                                      <tr className="text-left">
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Archivo</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">ID</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Tipo Formato</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Código Único</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Ubicación</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Tipo Cara</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Formato</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Plaza</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Municipio</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">NSE</th>
                                                        <th className="px-3 py-2 font-medium text-purple-300 whitespace-nowrap">Rsv ID</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {items.map((item) => (
                                                        <tr key={item.id} className="border-t border-border/30 hover:bg-purple-900/10">
                                                          <td className="px-3 py-2">
                                                            {item.archivo_arte && item.archivo_arte !== 'sin_arte' ? (
                                                              <div className="w-12 h-9 bg-zinc-800 rounded overflow-hidden border border-zinc-700">
                                                                <img
                                                                  src={getImageUrl(item.archivo_arte) || ''}
                                                                  alt="Arte"
                                                                  className="w-full h-full object-cover"
                                                                  onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                  }}
                                                                />
                                                              </div>
                                                            ) : (
                                                              <div className="w-12 h-9 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center">
                                                                <Image className="w-4 h-4 text-zinc-600" />
                                                              </div>
                                                            )}
                                                          </td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.id || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.tipo_medio || '-'}</td>
                                                          <td className="px-3 py-2 text-white font-mono whitespace-nowrap">{item.codigo_unico || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 max-w-[200px] truncate" title={item.ubicacion || '-'}>{item.ubicacion || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.tipo_de_cara || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.mueble || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.plaza || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.municipio || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.nse || '-'}</td>
                                                          <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{item.rsv_id || '-'}</td>
                                                        </tr>
                                                      ))}
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
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab Resumen */}
              {recepcionTab === 'resumen' && (
                <>
              {/* Info de la tarea de Recepción */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-purple-300 mb-3">Recepción de Impresiones</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Título:</span>
                    <p className="text-white font-medium">{task.titulo || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Estatus:</span>
                    <p className={`font-medium ${task.estatus === 'Activo' ? 'text-green-400' : task.estatus === 'Atendido' ? 'text-blue-400' : 'text-yellow-400'}`}>
                      {task.estatus}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Asignado:</span>
                    <p className="text-white font-medium">{task.asignado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Impresiones solicitadas:</span>
                    <p className="text-2xl font-bold text-purple-400">{impresionesOrdenadas}</p>
                  </div>
                </div>
              </div>

              {/* Formulario de recepción */}
              {(task.estatus === 'Activo' || task.estatus === 'Pendiente') ? (
                <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-purple-300">
                      Registrar cantidades recibidas
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Lista de artes agrupados con inputs para cantidad recibida */}
                    <div className="max-h-[250px] overflow-y-auto space-y-3">
                      {(() => {
                        // Verificar si es una tarea de recepción faltantes (tiene evidencia especial)
                        let esFaltantes = false;
                        let faltantesData: { arte: string; cantidad: number }[] = [];

                        if (task.evidencia) {
                          try {
                            const evidenciaObj = JSON.parse(task.evidencia);
                            if (evidenciaObj.tipo === 'recepcion_faltantes' && evidenciaObj.faltantesPorArte) {
                              esFaltantes = true;
                              faltantesData = evidenciaObj.faltantesPorArte;
                            }
                          } catch (e) {
                            // No es JSON válido o no tiene el formato esperado
                          }
                        }

                        if (esFaltantes && faltantesData.length > 0) {
                          // Mostrar solo los artes faltantes con sus cantidades
                          return faltantesData.map((faltante, idx) => {
                            const key = faltante.arte || 'sin_arte';
                            return (
                              <div key={idx} className="flex items-center gap-4 p-3 bg-zinc-800/30 rounded-lg border border-border/50">
                                {/* Preview de imagen */}
                                <div className="w-20 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                                  {faltante.arte ? (
                                    <img
                                      src={faltante.arte}
                                      alt="Arte"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Image className="h-5 w-5 text-zinc-600" />
                                    </div>
                                  )}
                                </div>

                                {/* Info del grupo - mostrar cantidad faltante */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">
                                    {faltante.cantidad} faltante{faltante.cantidad !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-zinc-500 truncate">
                                    {faltante.arte ? faltante.arte.split('/').pop() : 'Sin arte asignado'}
                                  </p>
                                </div>

                                {/* Input cantidad recibida */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-500">Recibidas:</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={cantidadesRecibidas[key] ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d+$/.test(val)) {
                                        setCantidadesRecibidas(prev => ({
                                          ...prev,
                                          [key]: val === '' ? 0 : parseInt(val)
                                        }));
                                      }
                                    }}
                                    onFocus={(e) => {
                                      if (cantidadesRecibidas[key] === 0) {
                                        setCantidadesRecibidas(prev => ({ ...prev, [key]: '' as any }));
                                      }
                                      e.target.select();
                                    }}
                                    onBlur={(e) => {
                                      if (e.target.value === '') {
                                        setCantidadesRecibidas(prev => ({ ...prev, [key]: 0 }));
                                      }
                                    }}
                                    className="w-20 px-2 py-1 text-center text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                </div>
                              </div>
                            );
                          });
                        }

                        // Intentar obtener el desglose de impresiones desde evidencia
                        let impresionesDesglose: Record<string, number> = {};
                        if (task.evidencia) {
                          try {
                            const evidenciaObj = JSON.parse(task.evidencia);
                            if (evidenciaObj.impresiones && typeof evidenciaObj.impresiones === 'object') {
                              impresionesDesglose = evidenciaObj.impresiones;
                            }
                          } catch (e) {}
                        }

                        // Si hay impresiones en evidencia, usarlas directamente (URLs completas)
                        const impresionesEntries = Object.entries(impresionesDesglose);
                        if (impresionesEntries.length > 0) {
                          return impresionesEntries.map(([arteUrl, cantidad]) => {
                            const nombreArchivo = arteUrl.split('/').pop() || 'arte';
                            const imageUrl = getImageUrl(arteUrl);
                            return (
                              <div key={arteUrl} className="flex items-center gap-4 p-3 bg-zinc-800/30 rounded-lg border border-border/50">
                                {/* Preview de imagen */}
                                <div className="w-20 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt="Arte"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Image className="h-6 w-6 text-zinc-600" />
                                    </div>
                                  )}
                                </div>

                                {/* Info del grupo */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">
                                    {cantidad} solicitada{cantidad !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-zinc-500 truncate">
                                    {nombreArchivo}
                                  </p>
                                </div>

                                {/* Input cantidad recibida por arte */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-500">Recibidas:</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={cantidadesRecibidas[arteUrl] ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d+$/.test(val)) {
                                        setCantidadesRecibidas(prev => ({
                                          ...prev,
                                          [arteUrl]: val === '' ? 0 : parseInt(val)
                                        }));
                                      }
                                    }}
                                    onFocus={(e) => {
                                      if (cantidadesRecibidas[arteUrl] === 0) {
                                        setCantidadesRecibidas(prev => ({ ...prev, [arteUrl]: '' as any }));
                                      }
                                      e.target.select();
                                    }}
                                    onBlur={(e) => {
                                      if (e.target.value === '') {
                                        setCantidadesRecibidas(prev => ({ ...prev, [arteUrl]: 0 }));
                                      }
                                    }}
                                    className="w-20 px-2 py-1 text-center text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                </div>
                              </div>
                            );
                          });
                        }

                        // Fallback: agrupar items por arte desde taskInventory
                        const artesAgrupados = taskInventory.reduce((acc, item) => {
                          const key = item.archivo_arte || 'sin_arte';
                          if (!acc[key]) {
                            acc[key] = { items: [], archivo: item.archivo_arte };
                          }
                          acc[key].items.push(item);
                          return acc;
                        }, {} as Record<string, { items: typeof taskInventory; archivo: string | undefined }>);

                        const artesArray = Object.entries(artesAgrupados);

                        if (artesArray.length === 0) {
                          return (
                            <div className="p-4 text-center text-zinc-500">
                              No hay items asociados a esta tarea
                            </div>
                          );
                        }

                        return artesArray.map(([key, grupo]) => {
                          const cantidad = grupo.items.length;

                          return (
                          <div key={key} className="flex items-center gap-4 p-3 bg-zinc-800/30 rounded-lg border border-border/50">
                            {/* Preview de imagen */}
                            <div className="w-20 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                              {grupo.archivo ? (
                                <img
                                  src={getImageUrl(grupo.archivo) || ''}
                                  alt="Arte"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-5 w-5 text-zinc-600" />
                                </div>
                              )}
                            </div>

                            {/* Info del grupo */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">
                                {cantidad} {cantidad !== 1 ? 'ubicaciones' : 'ubicación'}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">
                                {grupo.archivo ? grupo.archivo.split('/').pop() : 'Sin arte asignado'}
                              </p>
                            </div>

                            {/* Input cantidad recibida por arte */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">Recibidas:</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={cantidadesRecibidas[key] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d+$/.test(val)) {
                                    setCantidadesRecibidas(prev => ({
                                      ...prev,
                                      [key]: val === '' ? 0 : parseInt(val)
                                    }));
                                  }
                                }}
                                onFocus={(e) => {
                                  if (cantidadesRecibidas[key] === 0) {
                                    setCantidadesRecibidas(prev => ({ ...prev, [key]: '' as any }));
                                  }
                                  e.target.select();
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '') {
                                    setCantidadesRecibidas(prev => ({ ...prev, [key]: 0 }));
                                  }
                                }}
                                className="w-20 px-2 py-1 text-center text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                          )
                        })
                      })()}
                    </div>

                    {/* Resumen de totales */}
                    {(() => {
                      // Usar impresionesOrdenadas que ya calcula el número correcto
                      // (lee de evidencia, descripción, o taskInventory.length)
                      const totalSolicitadas = impresionesOrdenadas;

                      // Obtener las keys de artes para sumar cantidades recibidas
                      let artesKeys: string[] = [];

                      if (task.evidencia) {
                        try {
                          const evidenciaObj = JSON.parse(task.evidencia);
                          if (evidenciaObj.tipo === 'recepcion_faltantes' && evidenciaObj.faltantesPorArte) {
                            artesKeys = evidenciaObj.faltantesPorArte.map((f: { arte: string }) => f.arte || 'sin_arte');
                          }
                        } catch (e) {}
                      }

                      if (artesKeys.length === 0) {
                        artesKeys = [...new Set(taskInventory.map(item => item.archivo_arte || 'sin_arte'))];
                      }

                      const totalRecibidas = artesKeys.reduce((sum, key) => sum + (cantidadesRecibidas[key] || 0), 0);
                      const diferencia = totalRecibidas - totalSolicitadas;

                      return (
                        <div className="bg-zinc-800/50 rounded-lg p-4 border border-border">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-zinc-500 mb-1">Solicitadas</p>
                              <p className="text-xl font-bold text-purple-400">{totalSolicitadas}</p>
                            </div>
                            <div>
                              <p className="text-xs text-zinc-500 mb-1">Recibidas</p>
                              <p className="text-xl font-bold text-green-400">{totalRecibidas}</p>
                            </div>
                            <div>
                              <p className="text-xs text-zinc-500 mb-1">Diferencia</p>
                              <p className={`text-xl font-bold ${diferencia === 0 ? 'text-green-400' : diferencia > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                {diferencia >= 0 ? '+' : ''}{diferencia}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Observaciones */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Observaciones (opcional)</label>
                      <textarea
                        value={observacionesRecepcion}
                        onChange={(e) => setObservacionesRecepcion(e.target.value)}
                        rows={2}
                        placeholder="Notas sobre la recepción, diferencias, etc."
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-300 font-medium">Recepción completada</p>
                    <p className="text-sm text-zinc-400 mt-1">Esta tarea de recepción ya ha sido finalizada.</p>
                  </div>
                  {task.contenido && (
                    <div className="mt-3 pt-3 border-t border-green-500/20">
                      <p className="text-xs font-medium text-zinc-400 mb-1">Observaciones:</p>
                      <p className="text-sm text-zinc-300 bg-zinc-800/50 rounded p-2">{task.contenido}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de acción */}
              {(task.estatus === 'Activo' || task.estatus === 'Pendiente') && canResolveProduccionTasks && (
                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={handleFinalizarRecepcion}
                    disabled={isFinalizandoRecepcion}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFinalizandoRecepcion ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Finalizar Recepción
                      </>
                    )}
                  </button>
                </div>
              )}
                </>
              )}

              {(task.estatus === 'Activo' || task.estatus === 'Pendiente') && !canResolveProduccionTasks && (
                <div className="bg-zinc-800/50 border border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-zinc-400">Tarea de recepción activa - Solo visualización</p>
                </div>
              )}
            </div>
          )}

          {/* === VISTA ESPECIAL PARA TAREAS DE INSTALACIÓN === */}
          {task.tipo === 'Instalación' && (
            <div className="space-y-4">
              {/* Info de la tarea - Compacta (mismo estilo que Revisión) */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-purple-300 mb-3">Información de la Tarea</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Tipo:</span>
                    <p className="text-white font-medium">{task.tipo}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">ID:</span>
                    <p className="text-white font-medium">{task.id}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Titulo:</span>
                    <p className="text-white font-medium">{task.titulo || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Estatus:</span>
                    <p className={`font-medium ${task.estatus === 'Activo' || task.estatus === 'Pendiente' ? 'text-orange-400' : task.estatus === 'Atendido' ? 'text-yellow-400' : 'text-green-400'}`}>
                      {task.estatus === 'Atendido' ? 'Pendiente de validación' : task.estatus}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Catorcena:</span>
                    <p className="text-white font-medium">{getCatorcenaFromFechaFin || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Fecha Inicio:</span>
                    <p className="text-white font-medium">{task.fecha_inicio || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Asignado:</span>
                    <p className="text-white font-medium">{task.asignado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Creador:</span>
                    <p className="text-white font-medium">{task.creador || '-'}</p>
                  </div>
                </div>
                {(task.descripcion || task.contenido) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
                    {task.descripcion && (
                      <div>
                        <span className="text-zinc-500 text-sm">Descripción:</span>
                        <p className="text-white text-sm mt-1">{task.descripcion}</p>
                      </div>
                    )}
                    {task.contenido && (
                      <div>
                        <span className="text-zinc-500 text-sm">Contenido:</span>
                        <p className="text-white text-sm mt-1">{task.contenido}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lista de artes con filtros (mismo estilo que Revisión) */}
              <div className="bg-zinc-900/50 rounded-lg border border-border">
                {/* Header con filtros - fuera del overflow para que los dropdowns se vean */}
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50 rounded-t-lg flex items-center justify-between gap-4 relative z-20">
                  <h4 className="text-sm font-medium text-purple-300">
                    Inventario Asociado ({filteredDataResumen.length} de {taskInventory.length})
                  </h4>
                  <FilterToolbar
                    filters={filtersResumen}
                    showFilters={showFiltersResumen}
                    setShowFilters={setShowFiltersResumen}
                    addFilter={addFilterResumen}
                    updateFilter={updateFilterResumen}
                    removeFilter={removeFilterResumen}
                    clearFilters={clearFiltersResumen}
                    uniqueValues={uniqueValuesModal}
                    activeGroupings={activeGroupingsResumen}
                    showGrouping={showGroupingResumen}
                    setShowGrouping={setShowGroupingResumen}
                    toggleGrouping={toggleGroupingResumen}
                    clearGroupings={clearGroupingsResumen}
                    sortField={sortFieldResumen}
                    sortDirection={sortDirectionResumen}
                    showSort={showSortResumen}
                    setShowSort={setShowSortResumen}
                    setSortField={setSortFieldResumen}
                    setSortDirection={setSortDirectionResumen}
                    filteredCount={filteredDataResumen.length}
                    totalCount={taskInventory.length}
                    useFixedDropdowns={true}
                  />
                </div>
                {/* Contenido de la tabla con scroll */}
                <div className="min-h-[200px] max-h-[400px] overflow-auto">
                  {taskInventory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400 h-[200px]">
                      <Image className="h-12 w-12 mb-3 opacity-50" />
                      <p className="text-sm">Sin inventario asociado</p>
                    </div>
                  ) : activeGroupingsResumen.length > 0 ? (
                    /* Vista agrupada */
                    <div className="divide-y divide-border">
                      {Object.entries(groupedDataResumen).map(([groupKey, items]) => (
                        <div key={groupKey} className="bg-zinc-900/30">
                          <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-300">{groupKey}</span>
                            <Badge className="bg-purple-500/20 text-purple-300">{items.length}</Badge>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-zinc-800/50">
                              <tr className="text-left">
                                <th className="p-2 font-medium text-purple-300">Arte</th>
                                <th className="p-2 font-medium text-purple-300">Código</th>
                                <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                <th className="p-2 font-medium text-purple-300">Mueble</th>
                                <th className="p-2 font-medium text-purple-300">Medidas</th>
                                <th className="p-2 font-medium text-purple-300">Catorcena</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} className="border-t border-border/30 hover:bg-purple-900/10">
                                  <td className="p-2">
                                    {item.archivo_arte ? (
                                      <div className="w-14 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                        <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                        <Image className="h-4 w-4 text-zinc-600" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                                  <td className="p-2 text-zinc-300">{item.ciudad}</td>
                                  <td className="p-2 text-zinc-300">{item.mueble}</td>
                                  <td className="p-2 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                                  <td className="p-2 text-zinc-400">C{item.catorcena}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Vista tabla normal */
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-800 z-10">
                        <tr className="text-left">
                          <th className="p-3 font-medium text-purple-300">Arte</th>
                          <th className="p-3 font-medium text-purple-300">Código</th>
                          <th className="p-3 font-medium text-purple-300">Ciudad</th>
                          <th className="p-3 font-medium text-purple-300">Plaza</th>
                          <th className="p-3 font-medium text-purple-300">Mueble</th>
                          <th className="p-3 font-medium text-purple-300">Medidas</th>
                          <th className="p-3 font-medium text-purple-300">Catorcena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDataResumen.map((item) => (
                          <tr key={item.id} className="border-t border-border/50 hover:bg-purple-900/10">
                            <td className="p-3">
                              {item.archivo_arte ? (
                                <div className="w-16 h-12 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                  <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-16 h-12 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-zinc-600" />
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                            <td className="p-3 text-zinc-300">{item.ciudad}</td>
                            <td className="p-3 text-zinc-400">{item.plaza}</td>
                            <td className="p-3 text-zinc-300">{item.mueble}</td>
                            <td className="p-3 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                            <td className="p-3 text-zinc-400">C{item.catorcena}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Estado y acciones */}
              {task.estatus === 'Completado' ? (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-300 font-medium">Instalación validada</p>
                    <p className="text-sm text-zinc-400 mt-1">Esta instalación ha sido completada y validada.</p>
                  </div>
                </div>
              ) : task.estatus === 'Atendido' ? (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="text-center">
                    <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-yellow-300 font-medium">Pendiente de validación</p>
                    <p className="text-sm text-zinc-400 mt-1">El instalador ha marcado como instalado. Pendiente de validar en la pestaña "Validar Instalación".</p>
                  </div>
                </div>
              ) : canResolveProduccionTasks ? (
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      if (task.id) {
                        await onTaskComplete(String(task.id));
                        onClose();
                      }
                    }}
                    disabled={isUpdating}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Marcar como Instalado
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-800/50 border border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-zinc-400">Tarea de instalación activa - Solo visualización</p>
                </div>
              )}
            </div>
          )}

          {/* === VISTA ESPECIAL PARA TAREAS DE PROGRAMACIÓN === */}
          {task.tipo === 'Programación' && (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  onClick={() => setProgramacionTab('resumen')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    programacionTab === 'resumen'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Resumen
                </button>
                <button
                  onClick={() => setProgramacionTab('tabla')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    programacionTab === 'tabla'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  Ver tabla ({taskInventory.length})
                </button>
              </div>

              {/* Tab Resumen */}
              {programacionTab === 'resumen' && (
                <>
                  {/* Info de la Tarea */}
                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-purple-300 mb-3">Información de la Tarea</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-zinc-500 text-xs">Título:</span>
                        <p className="text-white font-medium">{task.titulo || '-'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs">Estatus:</span>
                        <p className={`font-medium ${task.estatus === 'Completado' ? 'text-green-400' : task.estatus === 'Activo' || task.estatus === 'Pendiente' ? 'text-yellow-400' : 'text-blue-400'}`}>
                          {task.estatus}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs">Asignado:</span>
                        <p className="text-white font-medium">{task.asignado || '-'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs">Catorcena:</span>
                        <p className="text-white font-medium">{getCatorcenaFromFechaFin || '-'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs">Creador:</span>
                        <p className="text-white">{task.creador || '-'}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs">Fecha creación:</span>
                        <p className="text-white">{task.fecha_inicio || '-'}</p>
                      </div>
                      {task.descripcion && (
                        <div className="col-span-2">
                          <span className="text-zinc-500 text-xs">Descripción:</span>
                          <p className="text-white">{task.descripcion}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indicaciones por Arte */}
                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                    <h4 className="text-sm font-medium text-purple-300 mb-3">Indicaciones de Programación por Arte</h4>
                    {(() => {
                      let indicaciones: Record<string, string> = {};
                      let archivosFromEvidencia: { archivo: string; archivoData?: string; spot: number; tipo: string }[] = [];
                      let programados: Record<string, boolean> = {};
                      try {
                        if (task.evidencia) {
                          const parsed = JSON.parse(task.evidencia);
                          indicaciones = parsed.indicaciones || {};
                          archivosFromEvidencia = parsed.archivos || [];
                          programados = parsed.programados || {};
                        }
                      } catch (e) {
                        console.error('Error parsing programacion evidencia:', e);
                      }

                      // Usar archivos de evidencia solo si tienen archivoData (URL de Cloudinary)
                      // Si no tienen archivoData, usar los cargados desde API
                      const evidenciaHasArchivoData = archivosFromEvidencia.length > 0 &&
                        archivosFromEvidencia.every(a => a.archivoData && a.archivoData.trim() !== '');
                      const archivos = evidenciaHasArchivoData ? archivosFromEvidencia : loadedArchivosDigitales;

                      // Merge persisted programados with local state
                      const currentProgramados = { ...programados, ...programadosState };
                      const allProgramados = archivos.length > 0 && archivos.every(a => currentProgramados[a.archivo] === true);

                      // Function to toggle programado and save to backend
                      const handleToggleProgramado = async (archivoPath: string) => {
                        const newValue = !currentProgramados[archivoPath];
                        const newProgramados = { ...currentProgramados, [archivoPath]: newValue };
                        setProgramadosState(newProgramados);

                        // Update evidencia in backend (usar archivos actuales para preservar estructura)
                        try {
                          const newEvidencia = JSON.stringify({
                            indicaciones,
                            archivos,
                            programados: newProgramados,
                          });
                          await onUpdateTask(task.id, { evidencia: newEvidencia });
                        } catch (e) {
                          console.error('Error updating programados:', e);
                        }
                      };

                      // Mostrar loading mientras se cargan archivos
                      if (isLoadingArchivosDigitales) {
                        return (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-400 mr-2" />
                            <span className="text-zinc-400 text-sm">Cargando archivos digitales...</span>
                          </div>
                        );
                      }

                      if (archivos.length === 0) {
                        return (
                          <div className="text-center py-8 text-zinc-500 text-sm">
                            <Image className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            No hay archivos digitales asociados a esta tarea
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="space-y-4">
                            {archivos.map((archivo, index) => {
                              const fileName = archivo.archivo.split('/').pop() || archivo.archivo;
                              const isVideo = archivo.tipo === 'video';
                              const indicacion = indicaciones[archivo.archivo] || '';
                              // Usar archivoData (base64) si está disponible, si no fallback a archivo
                              const fileUrl = getImageUrl(archivo.archivoData || archivo.archivo);
                              const isProgramado = currentProgramados[archivo.archivo] === true;

                              return (
                                <div key={index} className={`flex gap-4 p-3 border rounded-lg transition-colors ${isProgramado ? 'bg-green-900/20 border-green-500/30' : 'bg-purple-900/10 border-purple-500/20'}`}>
                                  {/* Thumbnail - mismo estilo que DigitalGalleryModal */}
                                  <div className="flex-shrink-0 w-24 h-16 bg-zinc-800 rounded overflow-hidden">
                                    {isVideo ? (
                                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                        <Play className="h-6 w-6 text-purple-400" />
                                      </div>
                                    ) : fileUrl ? (
                                      <>
                                        <img
                                          src={fileUrl}
                                          alt={fileName}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                        <div className="w-full h-full flex items-center justify-center hidden">
                                          <Image className="h-6 w-6 text-zinc-600" />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Image className="h-6 w-6 text-zinc-600" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Info y indicaciones */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        {isVideo ? (
                                          <Video className="h-4 w-4 text-blue-400" />
                                        ) : (
                                          <Image className="h-4 w-4 text-green-400" />
                                        )}
                                        <span className="text-sm text-white font-medium truncate" title={fileName}>
                                          {fileName}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 bg-zinc-700 px-1.5 py-0.5 rounded">
                                          Spot {archivo.spot}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {/* Switch Programado */}
                                        <button
                                          onClick={() => handleToggleProgramado(archivo.archivo)}
                                          disabled={isUpdating || task.estatus === 'Completado'}
                                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                                            isProgramado
                                              ? 'bg-green-600/30 text-green-400 hover:bg-green-600/40'
                                              : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50'
                                          } ${(isUpdating || task.estatus === 'Completado') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          title={isProgramado ? 'Marcado como programado' : 'Marcar como programado'}
                                        >
                                          {isProgramado ? (
                                            <ToggleRight className="h-4 w-4" />
                                          ) : (
                                            <ToggleLeft className="h-4 w-4" />
                                          )}
                                          {isProgramado ? 'Programado' : 'Pendiente'}
                                        </button>
                                        {/* Download */}
                                        <a
                                          href={fileUrl || '#'}
                                          download={fileName}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30 transition-colors"
                                        >
                                          <Download className="h-3 w-3" />
                                          Descargar
                                        </a>
                                      </div>
                                    </div>
                                    <div className="bg-zinc-800/60 rounded p-2">
                                      <p className="text-xs text-white whitespace-pre-wrap">
                                        {indicacion || <span className="text-zinc-500 italic">Sin indicaciones especificadas</span>}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Progress indicator */}
                          <div className="mt-4 pt-3 border-t border-border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">
                                Progreso: {archivos.filter(a => currentProgramados[a.archivo] === true).length} de {archivos.length} programados
                              </span>
                              {allProgramados && (
                                <span className="flex items-center gap-1 text-green-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Todos programados
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botón para marcar como completada - Solo habilitado si todos están programados */}
                          {(task.estatus === 'Activo' || task.estatus === 'Pendiente') && canResolveProduccionTasks && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => onUpdateTask(task.id, { estatus: 'Completado' })}
                                disabled={isUpdating || !allProgramados}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                  allProgramados && !isUpdating
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                } disabled:opacity-50`}
                                title={!allProgramados ? 'Debes marcar todos los artes como programados para completar la tarea' : ''}
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Completando...
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Marcar como Completada
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Tab Ver Tabla - Con agrupaciones y filtros */}
              {programacionTab === 'tabla' && (
                <div className="space-y-4">
                  {/* Toolbar de búsqueda y filtros */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">{filteredProgramacionModalData.length} de {taskInventory.length} items</span>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Buscar por ID, código, nombre archivo..."
                          value={programacionModalSearch}
                          onChange={(e) => setProgramacionModalSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 w-64"
                        />
                        {programacionModalSearch && (
                          <button
                            onClick={() => setProgramacionModalSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Botón exportar CSV */}
                      <button
                        onClick={() => {
                          const headers = ['ID', 'Código', 'Tipo', 'Ubicación', 'Plaza', 'Mueble', 'Ciudad', 'NSE', 'Catorcena', 'Estado Arte'];
                          const rows = filteredProgramacionModalData.map(item => [
                            item.id,
                            item.codigo_unico,
                            item.tradicional_digital,
                            item.ubicacion,
                            item.plaza,
                            item.mueble,
                            item.ciudad,
                            item.nse,
                            item.catorcena ? `C${item.catorcena}` : '-',
                            item.estado_arte || '-',
                          ]);
                          const csvContent = [
                            headers.join(','),
                            ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
                          ].join('\n');
                          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `programacion_tabla_${task?.titulo || 'tarea'}_${new Date().toISOString().split('T')[0]}.csv`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors border border-emerald-500/30"
                        title="Exportar tabla a CSV"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Exportar CSV
                      </button>
                    </div>
                    <FilterToolbar
                      filters={filtersProgramacionModal}
                      showFilters={showFiltersProgramacionModal}
                      setShowFilters={setShowFiltersProgramacionModal}
                      addFilter={addFilterProgramacionModal}
                      updateFilter={updateFilterProgramacionModal}
                      removeFilter={removeFilterProgramacionModal}
                      clearFilters={clearAllFiltersProgramacionModal}
                      uniqueValues={getUniqueValuesProgramacionModal}
                      activeGroupings={activeGroupingsProgramacionModal}
                      showGrouping={showGroupingProgramacionModal}
                      setShowGrouping={setShowGroupingProgramacionModal}
                      toggleGrouping={toggleGroupingProgramacionModal}
                      clearGroupings={clearGroupingsProgramacionModal}
                      sortField={sortFieldProgramacionModal}
                      sortDirection={sortDirectionProgramacionModal}
                      showSort={showSortProgramacionModal}
                      setShowSort={setShowSortProgramacionModal}
                      setSortField={setSortFieldProgramacionModal}
                      setSortDirection={setSortDirectionProgramacionModal}
                      filteredCount={filteredProgramacionModalData.length}
                      totalCount={taskInventory.length}
                      useFixedDropdowns={true}
                      filterFields={FILTER_FIELDS_PROGRAMACION_MODAL}
                    />
                  </div>

                  {/* Contenedor de la tabla */}
                  <div className="bg-zinc-900/50 rounded-lg border border-border">
                    <div className="min-h-[200px] max-h-[400px] overflow-auto">
                      {taskInventory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 h-[200px]">
                          <Image className="h-12 w-12 mb-3 opacity-50" />
                          <p className="text-sm">Sin inventario asociado</p>
                        </div>
                      ) : activeGroupingsProgramacionModal.length > 0 ? (
                        /* Vista agrupada jerárquica de 3 niveles */
                        <div className="divide-y divide-border">
                          {Object.entries(programacionModalGroupedInventory).map(([level1Key, level2Groups]) => {
                            const level1NodeKey = `prog-modal-${level1Key}`;
                            const level1Expanded = expandedNodesProgramacionModal.has(level1NodeKey);
                            const level1ItemCount = Object.values(level2Groups).reduce(
                              (sum, level3Groups) => sum + Object.values(level3Groups).reduce((s, items) => s + items.length, 0), 0
                            );
                            return (
                              <div key={level1NodeKey}>
                                {/* Nivel 1 */}
                                <button
                                  onClick={() => toggleNodeProgramacionModal(level1NodeKey)}
                                  className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {level1Expanded ? (
                                      <ChevronDown className="h-4 w-4 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-purple-400" />
                                    )}
                                    <span className="text-sm font-bold text-white">{level1Key}</span>
                                  </div>
                                  <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                                    {level1ItemCount}
                                  </Badge>
                                </button>
                                {level1Expanded && (
                                  <div className="pl-4">
                                    {Object.entries(level2Groups).map(([level2Key, level3Groups]) => {
                                      const level2NodeKey = `${level1NodeKey}|${level2Key}`;
                                      const level2Expanded = expandedNodesProgramacionModal.has(level2NodeKey);
                                      const level2ItemCount = Object.values(level3Groups).reduce((s, items) => s + items.length, 0);
                                      return (
                                        <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                          {/* Nivel 2 */}
                                          <button
                                            onClick={() => toggleNodeProgramacionModal(level2NodeKey)}
                                            className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {level2Expanded ? (
                                                <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                              ) : (
                                                <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                              )}
                                              <span className="text-xs font-semibold text-purple-300">{level2Key}</span>
                                            </div>
                                            <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/20 text-[10px]">
                                              {level2ItemCount}
                                            </Badge>
                                          </button>
                                          {level2Expanded && (
                                            <div className="pl-4">
                                              {Object.entries(level3Groups).map(([level3Key, items]) => {
                                                const level3NodeKey = `${level2NodeKey}|${level3Key}`;
                                                const level3Expanded = expandedNodesProgramacionModal.has(level3NodeKey);
                                                return (
                                                  <div key={level3NodeKey} className="border-l-2 border-amber-500/20">
                                                    {/* Nivel 3 */}
                                                    <button
                                                      onClick={() => toggleNodeProgramacionModal(level3NodeKey)}
                                                      className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        {level3Expanded ? (
                                                          <ChevronDown className="h-3 w-3 text-amber-400" />
                                                        ) : (
                                                          <ChevronRight className="h-3 w-3 text-amber-400" />
                                                        )}
                                                        <span className="text-[11px] font-medium text-amber-300">{level3Key}</span>
                                                      </div>
                                                      <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/20 text-[10px]">
                                                        {items.length}
                                                      </Badge>
                                                    </button>
                                                    {level3Expanded && (
                                                      <div className="bg-card/50 ml-4">
                                                        <table className="w-full text-xs">
                                                          <thead className="bg-purple-900/20">
                                                            <tr className="border-b border-border text-left">
                                                              <th className="p-2 font-medium text-purple-300">ID</th>
                                                              <th className="p-2 font-medium text-purple-300">Archivo</th>
                                                              <th className="p-2 font-medium text-purple-300">Código</th>
                                                              <th className="p-2 font-medium text-purple-300">Tipo</th>
                                                              <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                                              <th className="p-2 font-medium text-purple-300">Plaza</th>
                                                              <th className="p-2 font-medium text-purple-300">Mueble</th>
                                                              <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                                              <th className="p-2 font-medium text-purple-300">NSE</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {items.map((item) => {
                                                              const digitalSummary = getDigitalSummaryForItem(item);
                                                              return (
                                                              <tr key={item.id} className="border-b border-border/50 hover:bg-purple-900/20">
                                                                <td className="p-2 text-zinc-300">{item.id}</td>
                                                                <td className="p-2">
                                                                  {digitalSummary ? (
                                                                    <button
                                                                      onClick={() => {
                                                                        const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                                                        if (rsvIds.length > 0) {
                                                                          openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                                                        }
                                                                      }}
                                                                      className="w-10 h-8 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                                                      title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                                                    >
                                                                      <Film className="h-3 w-3 text-cyan-400" />
                                                                      <span className="text-cyan-400 font-bold text-[10px]">{digitalSummary.total}</span>
                                                                    </button>
                                                                  ) : (
                                                                    <div className="w-10 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                                                      <Image className="h-3 w-3 text-zinc-600" />
                                                                    </div>
                                                                  )}
                                                                </td>
                                                                <td className="p-2 font-medium text-white">{item.codigo_unico}</td>
                                                                <td className="p-2">
                                                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-300">
                                                                    {item.tradicional_digital}
                                                                  </span>
                                                                </td>
                                                                <td className="p-2 text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>
                                                                  {item.ubicacion}
                                                                </td>
                                                                <td className="p-2 text-zinc-300">{item.plaza}</td>
                                                                <td className="p-2 text-zinc-300">{item.mueble}</td>
                                                                <td className="p-2 text-zinc-300">{item.ciudad}</td>
                                                                <td className="p-2 text-zinc-300">{item.nse}</td>
                                                              </tr>
                                                            );})}
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
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Vista sin agrupar - tabla plana */
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-800/80 sticky top-0 z-10">
                            <tr>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">ID</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Archivo</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Código</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Tipo</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Ubicación</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Plaza</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Mueble</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">Ciudad</th>
                              <th className="p-2 text-left text-xs font-medium text-zinc-400">NSE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProgramacionModalData.map((item) => {
                              const digitalSummary = getDigitalSummaryForItem(item);
                              return (
                              <tr key={item.id} className="border-b border-border/50 hover:bg-purple-900/20">
                                <td className="p-2 text-xs text-zinc-300">{item.id}</td>
                                <td className="p-2">
                                  {digitalSummary ? (
                                    <button
                                      onClick={() => {
                                        const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                        if (rsvIds.length > 0) {
                                          openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                        }
                                      }}
                                      className="w-10 h-8 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                      title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                    >
                                      <Film className="h-3 w-3 text-cyan-400" />
                                      <span className="text-cyan-400 font-bold text-[10px]">{digitalSummary.total}</span>
                                    </button>
                                  ) : (
                                    <div className="w-10 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                      <Image className="h-3 w-3 text-zinc-600" />
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-xs font-medium text-white">{item.codigo_unico}</td>
                                <td className="p-2">
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-300">
                                    {item.tradicional_digital}
                                  </span>
                                </td>
                                <td className="p-2 text-xs text-zinc-300 max-w-[180px] truncate" title={item.ubicacion}>
                                  {item.ubicacion}
                                </td>
                                <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
                                <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
                                <td className="p-2 text-xs text-zinc-300">{item.ciudad}</td>
                                <td className="p-2 text-xs text-zinc-300">{item.nse}</td>
                              </tr>
                            );})}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === VISTA ESPECIAL PARA TAREAS DE TESTIGO === */}
          {task.tipo === 'Testigo' && (
            <TestigoTaskView
              task={task}
              taskInventory={taskInventory}
              isUpdating={isUpdating}
              onClose={onClose}
              campanaId={campanaId}
              getCatorcenaFromFechaFin={getCatorcenaFromFechaFin}
              canResolveProduccionTasks={canResolveProduccionTasks}
            />
          )}

          {/* Tab Resumen - Solo para tareas que NO son Impresión, Recepción, Instalación, Testigo ni Programación */}
          {task.tipo !== 'Impresión' && task.tipo !== 'Recepción' && task.tipo !== 'Instalación' && task.tipo !== 'Testigo' && task.tipo !== 'Programación' && activeTab === 'resumen' && (
            <div className="space-y-4">
              {/* Info de la tarea - Compacta */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium text-purple-300 mb-3">Información de la Tarea</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Tipo:</span>
                    <p className="text-white font-medium">{task.tipo}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">ID:</span>
                    <p className="text-white font-medium">{task.id}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Titulo:</span>
                    <p className="text-white font-medium">{task.titulo || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Estatus:</span>
                    <p className="text-white font-medium">{task.estatus}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Fecha Inicio:</span>
                    <p className="text-white font-medium">{task.fecha_inicio || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Fecha Fin:</span>
                    <p className="text-white font-medium">{task.fecha_fin || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Asignado:</span>
                    <p className="text-white font-medium">{task.asignado || '-'}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Responsable:</span>
                    <p className="text-white font-medium">{task.responsable || task.creador || '-'}</p>
                  </div>
                </div>
                {/* Sección especial para tareas de Corrección (rechazo) */}
                {task.tipo === 'Correccion' && task.descripcion && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <h5 className="text-sm font-medium text-red-300">Motivo del Rechazo</h5>
                      </div>
                      {(() => {
                        // Parsear la descripción para extraer códigos y motivo
                        const desc = task.descripcion || '';

                        // Extraer códigos: todo lo que está entre ** y :** (los : están dentro del **)
                        const codigosMatch = desc.match(/\*\*(.+?):\*\*/);
                        const codigosAfectados = codigosMatch ? codigosMatch[1].trim() : null;

                        // Extraer motivo: todo lo que está después de **códigos:** hasta "Por favor" o fin
                        let motivoRechazo = '';
                        if (codigosAfectados) {
                          // Buscar el texto después de **códigos:**
                          const afterCodigos = desc.split(/\*\*[^*]+:\*\*\s*/)[1];
                          if (afterCodigos) {
                            // Quitar "Por favor corrige..." si existe
                            motivoRechazo = afterCodigos.split(/Por favor/i)[0].trim();
                          }
                        }

                        // Si no se pudo extraer, limpiar la descripción completa
                        if (!motivoRechazo) {
                          motivoRechazo = desc
                            .replace(/Artes rechazados con el siguiente motivo:\s*/i, '')
                            .replace(/\*\*[^*]+:\*\*\s*/g, '')
                            .replace(/Por favor corrige los artes y vuelve a enviar a revisión\./i, '')
                            .trim();
                        }

                        return (
                          <div className="space-y-3">
                            {codigosAfectados && (
                              <div>
                                <span className="text-zinc-400 text-xs uppercase tracking-wide">Artes afectados:</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {codigosAfectados.split(',').map((codigo, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300 font-mono">
                                      {codigo.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <span className="text-zinc-400 text-xs uppercase tracking-wide">Motivo:</span>
                              <p className="mt-1 text-white text-sm bg-zinc-800/50 rounded p-2 border-l-2 border-red-500">
                                {motivoRechazo || 'Sin motivo especificado'}
                              </p>
                            </div>
                            <p className="text-amber-400/80 text-xs mt-2">
                              ⚠️ Por favor corrige los artes y vuelve a enviar a revisión.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {/* Descripción normal para otros tipos de tarea */}
                {task.tipo !== 'Correccion' && (task.descripcion || task.contenido) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
                    {task.descripcion && (
                      <div>
                        <span className="text-zinc-500 text-sm">Descripción:</span>
                        <p className="text-white text-sm mt-1">{task.descripcion}</p>
                      </div>
                    )}
                    {task.contenido && (
                      <div>
                        <span className="text-zinc-500 text-sm">Contenido:</span>
                        <p className="text-white text-sm mt-1">{task.contenido}</p>
                      </div>
                    )}
                  </div>
                )}
                {/* Contenido para tareas de Corrección */}
                {task.tipo === 'Correccion' && task.contenido && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-zinc-500 text-sm">Contenido:</span>
                    <p className="text-white text-sm mt-1">{task.contenido}</p>
                  </div>
                )}
              </div>

              {/* Lista de artes con filtros */}
              <div className="bg-zinc-900/50 rounded-lg border border-border">
                {/* Header con filtros - fuera del overflow para que los dropdowns se vean */}
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50 rounded-t-lg flex items-center justify-between gap-4 relative z-20">
                  <h4 className="text-sm font-medium text-purple-300">
                    Inventario Asociado ({filteredDataResumen.length} de {taskInventory.length})
                  </h4>
                  <FilterToolbar
                    filters={filtersResumen}
                    showFilters={showFiltersResumen}
                    setShowFilters={setShowFiltersResumen}
                    addFilter={addFilterResumen}
                    updateFilter={updateFilterResumen}
                    removeFilter={removeFilterResumen}
                    clearFilters={clearFiltersResumen}
                    uniqueValues={uniqueValuesModal}
                    activeGroupings={activeGroupingsResumen}
                    showGrouping={showGroupingResumen}
                    setShowGrouping={setShowGroupingResumen}
                    toggleGrouping={toggleGroupingResumen}
                    clearGroupings={clearGroupingsResumen}
                    sortField={sortFieldResumen}
                    sortDirection={sortDirectionResumen}
                    showSort={showSortResumen}
                    setShowSort={setShowSortResumen}
                    setSortField={setSortFieldResumen}
                    setSortDirection={setSortDirectionResumen}
                    filteredCount={filteredDataResumen.length}
                    totalCount={taskInventory.length}
                    useFixedDropdowns={true}
                  />
                </div>
                {/* Contenido de la tabla con scroll */}
                <div className="min-h-[200px] max-h-[400px] overflow-auto">
                  {taskInventory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400 h-[200px]">
                      <Image className="h-12 w-12 mb-3 opacity-50" />
                      <p className="text-sm">Sin inventario asociado</p>
                    </div>
                  ) : activeGroupingsResumen.length > 0 ? (
                    /* Vista agrupada */
                    <div className="divide-y divide-border">
                      {Object.entries(groupedDataResumen).map(([groupKey, items]) => (
                        <div key={groupKey} className="bg-zinc-900/30">
                          <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-300">{groupKey}</span>
                            <Badge className="bg-purple-500/20 text-purple-300">{items.length}</Badge>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-zinc-800/50">
                              <tr className="text-left">
                                <th className="p-2 font-medium text-purple-300">Arte</th>
                                <th className="p-2 font-medium text-purple-300">Código</th>
                                <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                <th className="p-2 font-medium text-purple-300">Mueble</th>
                                <th className="p-2 font-medium text-purple-300">Medidas</th>
                                <th className="p-2 font-medium text-purple-300">Catorcena</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} className="border-t border-border/30 hover:bg-purple-900/10">
                                  <td className="p-2">
                                    {item.archivo_arte ? (
                                      <div className="w-14 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                        <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                        <Image className="h-4 w-4 text-zinc-600" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                                  <td className="p-2 text-zinc-300">{item.ciudad}</td>
                                  <td className="p-2 text-zinc-300">{item.mueble}</td>
                                  <td className="p-2 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                                  <td className="p-2 text-zinc-400">C{item.catorcena}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Vista tabla normal */
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-800 z-10">
                        <tr className="text-left">
                          <th className="p-3 font-medium text-purple-300">Arte</th>
                          <th className="p-3 font-medium text-purple-300">Código</th>
                          <th className="p-3 font-medium text-purple-300">Ciudad</th>
                          <th className="p-3 font-medium text-purple-300">Plaza</th>
                          <th className="p-3 font-medium text-purple-300">Mueble</th>
                          <th className="p-3 font-medium text-purple-300">Medidas</th>
                          <th className="p-3 font-medium text-purple-300">Catorcena</th>
                          <th className="p-3 font-medium text-purple-300">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDataResumen.map((item) => {
                          const digitalSummary = getDigitalSummaryForItem(item);
                          const isDigital = item.tradicional_digital === 'Digital';
                          return (
                          <tr key={item.id} className="border-t border-border/50 hover:bg-purple-900/10">
                            <td className="p-3">
                              {isDigital && digitalSummary ? (
                                <button
                                  onClick={() => {
                                    const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                    if (rsvIds.length > 0) {
                                      openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                    }
                                  }}
                                  className="w-16 h-12 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                  title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                >
                                  <Film className="h-4 w-4 text-cyan-400" />
                                  <span className="text-cyan-400 font-bold text-xs">{digitalSummary.total}</span>
                                </button>
                              ) : item.archivo_arte ? (
                                <div className="w-16 h-12 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                  <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-16 h-12 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-zinc-600" />
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                            <td className="p-3 text-zinc-300">{item.ciudad}</td>
                            <td className="p-3 text-zinc-400">{item.plaza}</td>
                            <td className="p-3 text-zinc-300">{item.mueble}</td>
                            <td className="p-3 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                            <td className="p-3 text-zinc-400">C{item.catorcena}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                item.estado_arte === 'aprobado' ? 'bg-green-500/20 text-green-400' :
                                item.estado_arte === 'rechazado' ? 'bg-red-500/20 text-red-400' :
                                item.estado_arte === 'en_revision' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-zinc-500/20 text-zinc-400'
                              }`}>
                                {item.estado_arte || 'Sin revisar'}
                              </span>
                            </td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Editar - Solo para tareas que NO son Impresión y con permisos */}
          {task?.tipo !== 'Impresión' && activeTab === 'editar' && canResolveCurrentTask && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda - Lista de artes con checkbox */}
              <div className="bg-zinc-900/50 rounded-lg border border-border">
                {/* Header con filtros - fuera del overflow para que los dropdowns se vean */}
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50 rounded-t-lg flex flex-col gap-2 relative z-20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-purple-300">
                      Seleccionar Arte ({filteredDataEditar.length} de {taskInventory.length})
                    </h4>
                    <button
                      onClick={selectAllArtes}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      {selectedArteIds.size === filteredDataEditar.length ? 'Deseleccionar' : 'Seleccionar todo'}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <FilterToolbar
                      filters={filtersEditar}
                      showFilters={showFiltersEditar}
                      setShowFilters={setShowFiltersEditar}
                      addFilter={addFilterEditar}
                      updateFilter={updateFilterEditar}
                      removeFilter={removeFilterEditar}
                      clearFilters={clearFiltersEditar}
                      uniqueValues={uniqueValuesModal}
                      activeGroupings={activeGroupingsEditar}
                      showGrouping={showGroupingEditar}
                      setShowGrouping={setShowGroupingEditar}
                      toggleGrouping={toggleGroupingEditar}
                      clearGroupings={clearGroupingsEditar}
                      sortField={sortFieldEditar}
                      sortDirection={sortDirectionEditar}
                      showSort={showSortEditar}
                      setShowSort={setShowSortEditar}
                      setSortField={setSortFieldEditar}
                      setSortDirection={setSortDirectionEditar}
                      filteredCount={filteredDataEditar.length}
                      totalCount={taskInventory.length}
                      useFixedDropdowns={true}
                    />
                  </div>
                </div>
                {/* Contenido de la tabla con scroll */}
                <div className="min-h-[200px] max-h-[450px] overflow-auto">
                  {activeGroupingsEditar.length > 0 ? (
                    /* Vista agrupada */
                    <div className="divide-y divide-border">
                      {Object.entries(groupedDataEditar).map(([groupKey, items]) => (
                        <div key={groupKey} className="bg-zinc-900/30">
                          <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-300">{groupKey}</span>
                            <Badge className="bg-purple-500/20 text-purple-300">{items.length}</Badge>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-zinc-800/50">
                              <tr className="text-left">
                                <th className="p-2 w-8">
                                  <input
                                    type="checkbox"
                                    checked={items.every(item => selectedArteIds.has(item.id))}
                                    onChange={() => {
                                      const allSelected = items.every(item => selectedArteIds.has(item.id));
                                      setSelectedArteIds(prev => {
                                        const next = new Set(prev);
                                        items.forEach(item => {
                                          if (allSelected) next.delete(item.id);
                                          else next.add(item.id);
                                        });
                                        return next;
                                      });
                                    }}
                                    className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                                  />
                                </th>
                                <th className="p-2 font-medium text-purple-300">Arte</th>
                                <th className="p-2 font-medium text-purple-300">Código</th>
                                <th className="p-2 font-medium text-purple-300">Mueble</th>
                                <th className="p-2 font-medium text-purple-300">Medidas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => {
                                const digitalSummary = getDigitalSummaryForItem(item);
                                const isDigital = item.tradicional_digital === 'Digital';
                                return (
                                <tr key={item.id} className={`border-t border-border/30 transition-colors ${selectedArteIds.has(item.id) ? 'bg-purple-900/30' : 'hover:bg-purple-900/10'}`}>
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedArteIds.has(item.id)}
                                      onChange={() => toggleArteSelection(item.id)}
                                      className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    {isDigital && digitalSummary ? (
                                      <button
                                        onClick={() => {
                                          const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                          if (rsvIds.length > 0) {
                                            openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                          }
                                        }}
                                        className="w-12 h-9 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                        title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                      >
                                        <Film className="h-3 w-3 text-cyan-400" />
                                        <span className="text-cyan-400 font-bold text-[10px]">{digitalSummary.total}</span>
                                      </button>
                                    ) : item.archivo_arte ? (
                                      <div className="w-12 h-9 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                        <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-9 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                        <Image className="h-3 w-3 text-zinc-600" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                                  <td className="p-2 text-zinc-300">{item.mueble}</td>
                                  <td className="p-2 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Vista tabla normal */
                    <table className="w-full text-xs min-w-[500px]">
                      <thead className="sticky top-0 bg-zinc-800 z-10">
                        <tr className="text-left">
                          <th className="p-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedArteIds.size === filteredDataEditar.length && filteredDataEditar.length > 0}
                              onChange={() => {
                                if (selectedArteIds.size === filteredDataEditar.length) {
                                  setSelectedArteIds(new Set());
                                } else {
                                  setSelectedArteIds(new Set(filteredDataEditar.map(item => item.id)));
                                }
                              }}
                              className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                            />
                          </th>
                          <th className="p-3 font-medium text-purple-300">Arte</th>
                          <th className="p-3 font-medium text-purple-300">Código</th>
                          <th className="p-3 font-medium text-purple-300">Ciudad</th>
                          <th className="p-3 font-medium text-purple-300">Mueble</th>
                          <th className="p-3 font-medium text-purple-300">Medidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDataEditar.map((item) => {
                          const digitalSummary = getDigitalSummaryForItem(item);
                          const isDigital = item.tradicional_digital === 'Digital';
                          return (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 transition-colors ${
                              selectedArteIds.has(item.id) ? 'bg-purple-900/30' : 'hover:bg-purple-900/10'
                            }`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedArteIds.has(item.id)}
                                onChange={() => toggleArteSelection(item.id)}
                                className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                              />
                            </td>
                            <td className="p-3">
                              {isDigital && digitalSummary ? (
                                <button
                                  onClick={() => {
                                    const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                    if (rsvIds.length > 0) {
                                      openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                    }
                                  }}
                                  className="w-14 h-10 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                  title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                >
                                  <Film className="h-4 w-4 text-cyan-400" />
                                  <span className="text-cyan-400 font-bold text-[10px]">{digitalSummary.total}</span>
                                </button>
                              ) : item.archivo_arte ? (
                                <div className="w-14 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                  <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-zinc-600" />
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                            <td className="p-3 text-zinc-300">{item.ciudad}</td>
                            <td className="p-3 text-zinc-300">{item.mueble}</td>
                            <td className="p-3 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Columna Derecha - Opciones de edicion */}
              <div className="space-y-4">
                {isDigitalEditarSelection ? (
                  /* ===== INTERFAZ DIGITAL - MÚLTIPLES ARCHIVOS ===== */
                  <>
                    {/* Header info */}
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Film className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-cyan-300 font-medium">
                            Inventario Digital - Rotación de contenido
                          </p>
                          <p className="text-[10px] text-cyan-400/70 mt-1">
                            Puedes subir múltiples imágenes y/o videos que se mostrarán en rotación.
                            Arrastra para reordenar la secuencia.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Boton de actualizar */}
                    <div className="flex justify-center">
                      <button
                        onClick={handleUpdateImageDigital}
                        disabled={selectedArteIds.size === 0 || (digitalFilesEditar.length === 0 && filesToDelete.length === 0) || isUpdating}
                        className={`flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                          selectedArteIds.size > 0 && (digitalFilesEditar.length > 0 || filesToDelete.length > 0) && !isUpdating
                            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                            <span className="truncate">Actualizando...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {filesToDelete.length > 0 && digitalFilesEditar.length === 0
                                ? 'Eliminar Archivos'
                                : filesToDelete.length > 0
                                ? 'Actualizar y Eliminar'
                                : 'Actualizar Arte Digital'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* File Input */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        Agregar archivos
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          onChange={handleDigitalFilesChangeEditar}
                          accept="image/*,video/*"
                          multiple
                          disabled={isUpdating}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 disabled:opacity-50"
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-zinc-500">
                        Formatos: JPG, PNG, GIF, WEBP, MP4, MOV, WEBM (max 50MB por archivo)
                      </p>
                    </div>

                    {/* Lista de archivos con drag & drop */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-zinc-400">
                          Archivos para rotación
                        </label>
                        <div className="flex items-center gap-2">
                          {filesToDelete.length > 0 && (
                            <Badge className="bg-red-600/30 text-red-300 border-red-500/30 text-[10px]">
                              {filesToDelete.length} a eliminar
                            </Badge>
                          )}
                          {digitalFilesEditar.length > 0 && (
                            <Badge className="bg-green-600/30 text-green-300 border-green-500/30 text-[10px]">
                              {digitalFilesEditar.length} nuevo{digitalFilesEditar.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Badge className="bg-cyan-600/30 text-cyan-300 border-cyan-500/30 text-[10px]">
                            {existingDigitalFilesEditar.filter(f => !filesToDelete.includes(f.id)).length + digitalFilesEditar.length} total
                          </Badge>
                        </div>
                      </div>
                      <div className="h-64 border border-border rounded-lg bg-zinc-900/50 overflow-auto">
                        {isLoadingExistingFiles ? (
                          <div className="h-full flex items-center justify-center text-center text-zinc-500">
                            <div>
                              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-cyan-400" />
                              <p className="text-xs">Cargando archivos existentes...</p>
                            </div>
                          </div>
                        ) : existingDigitalFilesEditar.length === 0 && digitalFilesEditar.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-zinc-500">
                            <div>
                              <Upload className="h-10 w-10 mx-auto mb-2 opacity-30" />
                              <p className="text-xs">
                                No hay archivos. Selecciona archivos para agregarlos a la rotación.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 space-y-2">
                            {/* Archivos existentes del servidor */}
                            {existingDigitalFilesEditar.map((existingFile) => {
                              const isMarkedForDeletion = filesToDelete.includes(existingFile.id);
                              // Usar archivoData (base64) si está disponible
                              const imageUrl = getImageUrl(existingFile.archivoData || existingFile.archivo);
                              return (
                                <div
                                  key={`existing-${existingFile.id}`}
                                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                    isMarkedForDeletion
                                      ? 'border-red-500/50 bg-red-500/10 opacity-60'
                                      : 'border-zinc-600 bg-zinc-800/50 hover:border-cyan-500/50'
                                  }`}
                                >
                                  {/* Existing Badge */}
                                  <div className="flex-shrink-0 px-1.5 py-0.5 rounded bg-zinc-600/50 text-[8px] text-zinc-400 font-medium">
                                    EXISTE
                                  </div>

                                  {/* Spot Number */}
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-600/50 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-zinc-300">{existingFile.spot}</span>
                                  </div>

                                  {/* Preview */}
                                  <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-zinc-800">
                                    {existingFile.tipo === 'video' ? (
                                      <div className="w-full h-full flex items-center justify-center bg-zinc-700">
                                        <Play className="h-4 w-4 text-cyan-400" />
                                      </div>
                                    ) : (
                                      <img
                                        src={imageUrl || ''}
                                        alt={`Archivo ${existingFile.spot}`}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </div>

                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-white truncate" title={existingFile.archivo}>
                                      {existingFile.archivo.split('/').pop() || 'archivo'}
                                    </p>
                                    <p className="text-[9px] text-zinc-500 flex items-center gap-1">
                                      {existingFile.tipo === 'video' ? (
                                        <Film className="h-2.5 w-2.5 text-cyan-400" />
                                      ) : (
                                        <Image className="h-2.5 w-2.5 text-purple-400" />
                                      )}
                                      {existingFile.tipo === 'video' ? 'Video' : 'Imagen'} • Guardado en servidor
                                    </p>
                                  </div>

                                  {/* Delete/Restore Button */}
                                  {isMarkedForDeletion ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreExistingFileEditar(existingFile.id)}
                                      className="flex-shrink-0 p-1 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                                      title="Restaurar archivo"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExistingFileEditar(existingFile.id)}
                                      className="flex-shrink-0 p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                      title="Eliminar archivo"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {/* Separador si hay ambos tipos */}
                            {existingDigitalFilesEditar.length > 0 && digitalFilesEditar.length > 0 && (
                              <div className="flex items-center gap-2 py-1">
                                <div className="flex-1 h-px bg-green-500/30"></div>
                                <span className="text-[10px] text-green-400 font-medium">Nuevos archivos</span>
                                <div className="flex-1 h-px bg-green-500/30"></div>
                              </div>
                            )}

                            {/* Archivos nuevos (por subir) */}
                            {digitalFilesEditar.map((digitalFile, index) => (
                              <div
                                key={digitalFile.id}
                                draggable
                                onDragStart={() => handleDragStartEditar(digitalFile.id)}
                                onDragOver={(e) => handleDragOverEditar(e, digitalFile.id)}
                                onDragEnd={handleDragEndEditar}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-move ${
                                  draggedFileEditar === digitalFile.id
                                    ? 'border-cyan-500 bg-cyan-500/20 opacity-50'
                                    : 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                                }`}
                              >
                                {/* Drag Handle */}
                                <div className="flex-shrink-0 text-zinc-500 hover:text-cyan-400 cursor-grab">
                                  <GripVertical className="h-4 w-4" />
                                </div>

                                {/* Spot Number */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600/30 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-green-300">{digitalFile.spot}</span>
                                </div>

                                {/* Preview */}
                                <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-zinc-800">
                                  {digitalFile.type === 'video' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-700">
                                      <Play className="h-4 w-4 text-cyan-400" />
                                    </div>
                                  ) : (
                                    <img
                                      src={digitalFile.preview}
                                      alt={`Preview ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-white truncate" title={digitalFile.file.name}>
                                    {digitalFile.file.name}
                                  </p>
                                  <p className="text-[9px] text-zinc-500 flex items-center gap-1">
                                    {digitalFile.type === 'video' ? (
                                      <Film className="h-2.5 w-2.5 text-cyan-400" />
                                    ) : (
                                      <Image className="h-2.5 w-2.5 text-purple-400" />
                                    )}
                                    {digitalFile.type === 'video' ? 'Video' : 'Imagen'} •{' '}
                                    {(digitalFile.file.size / 1024 / 1024).toFixed(2)} MB
                                    <span className="text-green-400 ml-1">(Nuevo)</span>
                                  </p>
                                </div>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDigitalFileEditar(digitalFile.id)}
                                  className="flex-shrink-0 p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="Eliminar archivo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* ===== INTERFAZ TRADICIONAL - UN ARCHIVO ===== */
                  <>
                    {/* Botones de accion */}
                    <div className="flex justify-center">
                      <button
                        onClick={handleUpdateImage}
                        disabled={selectedArteIds.size === 0 || isUpdating}
                        className={`flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                          selectedArteIds.size > 0 && !isUpdating
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                            <span className="truncate">Actualizando...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">Actualizar Arte</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Selector de opcion */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Escoja una opcion
                      </label>
                      <select
                        value={uploadOption}
                        onChange={(e) => setUploadOption(e.target.value as UploadOption)}
                        className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="file">Subir archivo</option>
                        <option value="existing">Escoger existente</option>
                        <option value="link">Subir link</option>
                      </select>
                    </div>

                    {/* Contenido segun opcion */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                      {uploadOption === 'file' && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Subir archivo
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                          />
                          {filePreview && (
                            <div className="mt-3">
                              <img src={filePreview} alt="Preview" className="max-h-40 rounded-lg" />
                            </div>
                          )}
                        </div>
                      )}

                      {uploadOption === 'existing' && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Seleccionar archivo existente
                          </label>
                          {isLoadingArtes ? (
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando artes...
                            </div>
                          ) : (
                            <select
                              value={existingArtUrl}
                              onChange={(e) => setExistingArtUrl(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-1 focus:ring-purple-500"
                            >
                              <option value="">Seleccionar...</option>
                              {artesExistentes.map((arte) => (
                                <option key={arte.id} value={arte.url}>
                                  {arte.nombre} ({arte.usos} usos)
                                </option>
                              ))}
                            </select>
                          )}
                          {existingArtUrl && (
                            <div className="mt-3">
                              <img src={getImageUrl(existingArtUrl) || existingArtUrl} alt="Preview" className="max-h-40 rounded-lg" />
                            </div>
                          )}
                        </div>
                      )}

                      {uploadOption === 'link' && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            URL de la imagen
                          </label>
                          <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-1 focus:ring-purple-500"
                          />
                          {linkUrl && (
                            <div className="mt-3">
                              <img src={linkUrl} alt="Preview" className="max-h-40 rounded-lg" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab Atender */}
          {activeTab === 'atender' && task?.tipo === 'Correccion' && canResolveCurrentTask && (
            // Vista especial para tareas de Corrección - Solo enviar a revisión
            <div className="space-y-4">
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-5 w-5 text-amber-400" />
                  <h4 className="text-sm font-medium text-amber-300">Enviar artes corregidos a revisión</h4>
                </div>
                <p className="text-sm text-zinc-400">
                  Una vez que hayas corregido los artes en el paso anterior, haz clic en el botón para enviarlos de vuelta a revisión.
                  Se creará una nueva tarea de revisión asignada a <span className="text-white font-medium">{task.responsable || task.creador || 'el revisor'}</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Principal - Lista de artes */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Lista de artes que se enviarán */}
                  <div className="bg-zinc-900/50 rounded-lg border border-border">
                    <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                      <h4 className="text-sm font-medium text-purple-300">
                        Artes a enviar ({taskInventory.length})
                      </h4>
                    </div>
                    <div className="p-3 max-h-[300px] overflow-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {taskInventory.map((item) => {
                          const digitalSummary = getDigitalSummaryForItem(item);
                          const isDigital = item.tradicional_digital === 'Digital';
                          return (
                          <div key={item.id} className="bg-zinc-800/50 rounded-lg p-2 border border-border">
                            <div className="aspect-video bg-zinc-900 rounded overflow-hidden mb-2">
                              {isDigital && digitalSummary ? (
                                <button
                                  onClick={() => {
                                    const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                    if (rsvIds.length > 0) {
                                      openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                    }
                                  }}
                                  className="w-full h-full bg-cyan-500/20 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                  title={`Ver ${getDigitalSummaryText(digitalSummary)}`}
                                >
                                  <Film className="h-8 w-8 text-cyan-400 mb-1" />
                                  <span className="text-cyan-400 font-bold text-lg">{digitalSummary.total}</span>
                                  <span className="text-cyan-300 text-[10px]">{getDigitalSummaryText(digitalSummary)}</span>
                                </button>
                              ) : item.archivo_arte ? (
                                <img src={getImageUrl(item.archivo_arte) || ''} alt={item.codigo_unico} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-8 w-8 text-zinc-600" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-mono text-zinc-300 truncate">{item.codigo_unico}</p>
                          </div>
                        );})}
                      </div>
                    </div>
                  </div>

                  {/* Botón de enviar a revisión */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleEnviarARevision}
                      disabled={isFinalizando || isUpdating || taskInventory.length === 0}
                      className="px-6 py-2.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isFinalizando ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Enviar a Revisión
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Columna Derecha - Comentarios */}
                <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden h-fit">
                  <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comentarios
                    </h4>
                  </div>
                  <div className="p-4">
                    <CommentsSection campanaId={campanaId} tareaId={task?.id || ''} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Atender - Vista normal para revisión de artes (no Corrección ni Impresión) */}
          {activeTab === 'atender' && task?.tipo !== 'Correccion' && task?.tipo !== 'Impresión' && canResolveCurrentTask && (
            <div className="space-y-4">
              {/* Toolbar de agrupación */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {(['inventario', 'ciudad', 'grupo'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        groupBy === g
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      Por {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-400">
                  {Object.values(decisiones).filter(d => d?.decision).length} de {Object.keys(groupedInventory).length} decisiones tomadas
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Principal - Cards de artes */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Cards */}
                  <div className="space-y-4 max-h-[400px] overflow-auto">
                    {Object.entries(groupedInventory).map(([groupKey, items]) => (
                      <div key={groupKey} className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                        {/* Header del grupo */}
                        <div className={`px-4 py-3 border-b border-border ${groupBy !== 'inventario' ? 'bg-purple-900/20' : 'bg-zinc-800/50'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <span className="text-sm font-medium text-purple-300">
                                {groupBy === 'inventario' ? items[0]?.codigo_unico : groupKey.split('|||')[0]}
                              </span>
                              {groupBy !== 'inventario' && (
                                <span className="text-xs text-zinc-500 ml-2">({items.length} items)</span>
                              )}
                            </div>
                            {/* Select de decisión a nivel de grupo */}
                            <select
                              value={decisiones[groupKey]?.decision || ''}
                              onChange={(e) => handleDecisionChange(groupKey, e.target.value)}
                              className={`px-3 py-1.5 text-sm rounded-lg bg-zinc-800 border transition-colors ${
                                !decisiones[groupKey]?.decision
                                  ? 'border-amber-500/50 text-amber-400'
                                  : decisiones[groupKey]?.decision === 'aprobar'
                                  ? 'border-green-500/50 text-green-400'
                                  : 'border-red-500/50 text-red-400'
                              }`}
                            >
                              <option value="">-- Seleccionar acción --</option>
                              <option value="aprobar">✓ Aprobar</option>
                              <option value="rechazar">✗ Rechazar</option>
                            </select>
                          </div>
                          {/* Textarea para comentario de aprobación (opcional) */}
                          {decisiones[groupKey]?.decision === 'aprobar' && (
                            <div className="mt-2">
                              <textarea
                                placeholder="Comentario de aprobación (opcional)"
                                value={decisiones[groupKey]?.comentarioAprobacion || ''}
                                onChange={(e) => handleComentarioAprobacionChange(groupKey, e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-800 border border-zinc-700 resize-none"
                                rows={2}
                              />
                            </div>
                          )}
                          {/* Textarea para motivo de rechazo (obligatorio) */}
                          {decisiones[groupKey]?.decision === 'rechazar' && (
                            <div className="mt-2">
                              <textarea
                                placeholder="Escribe el motivo del rechazo (obligatorio)"
                                value={decisiones[groupKey]?.motivoRechazo || ''}
                                onChange={(e) => handleMotivoChange(groupKey, e.target.value)}
                                className={`w-full px-3 py-2 text-sm rounded-lg bg-zinc-800 border resize-none ${
                                  !decisiones[groupKey]?.motivoRechazo?.trim()
                                    ? 'border-red-500/50'
                                    : 'border-zinc-700'
                                }`}
                                rows={2}
                              />
                            </div>
                          )}
                        </div>

                        {/* Lista de items dentro del grupo */}
                        <div className="p-3">
                          {groupBy === 'inventario' ? (
                            // Vista individual: mostrar todas las cards
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {items.map((item) => {
                                const digitalSummary = getDigitalSummaryForItem(item);
                                const isDigital = item.tradicional_digital === 'Digital';
                                return (
                                <div key={item.id} className="bg-zinc-800/50 rounded-lg p-3 border border-border">
                                  <div className="flex gap-3">
                                    {/* Preview */}
                                    <div className="flex-shrink-0">
                                      {isDigital && digitalSummary ? (
                                        // Para digitales: mostrar botón con contador que abre galería
                                        <button
                                          onClick={() => {
                                            const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                            if (rsvIds.length > 0) {
                                              openDigitalGalleryModal(rsvIds[0], item.codigo_unico);
                                            }
                                          }}
                                          className="w-20 h-16 rounded bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                          title="Ver galería digital"
                                        >
                                          <Film className="h-5 w-5 text-cyan-400 mb-1" />
                                          <span className="text-cyan-400 font-bold text-sm">{digitalSummary.total}</span>
                                        </button>
                                      ) : item.archivo_arte ? (
                                        <div className="w-20 h-16 rounded overflow-hidden bg-zinc-700 border border-zinc-600">
                                          <img
                                            src={getImageUrl(item.archivo_arte) || ''}
                                            alt="Arte"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-20 h-16 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center">
                                          <Image className="h-5 w-5 text-zinc-500" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{item.codigo_unico}</p>
                                      <p className="text-xs text-zinc-400 truncate">{item.mueble}</p>
                                      <p className="text-xs text-zinc-500 truncate">
                                        {isDigital && digitalSummary ? getDigitalSummaryText(digitalSummary) : item.ubicacion}
                                      </p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                          item.estado_arte === 'aprobado'
                                            ? 'bg-green-500/20 text-green-400'
                                            : item.estado_arte === 'rechazado'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-zinc-500/20 text-zinc-400'
                                        }`}>
                                          {item.estado_arte === 'aprobado' ? 'Aprobado' : item.estado_arte === 'rechazado' ? 'Rechazado' : 'Sin revisar'}
                                        </span>
                                        {!isDigital && item.archivo_arte && (
                                          <button
                                            onClick={() => downloadImage(getImageUrl(item.archivo_arte)!, `${item.codigo_unico}.jpg`)}
                                            className="text-[10px] text-zinc-400 hover:text-white"
                                            title="Descargar"
                                          >
                                            <Download className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );})}
                            </div>
                          ) : (
                            // Vista agrupada (ciudad/grupo): mostrar solo UNA card representativa con conteo
                            (() => {
                              const representativeItem = items[0];
                              const digitalSummary = representativeItem ? getDigitalSummaryForItem(representativeItem) : null;
                              const isDigital = representativeItem?.tradicional_digital === 'Digital';
                              return (
                            <div className="bg-zinc-800/50 rounded-lg p-4 border border-border">
                              <div className="flex gap-4">
                                {/* Preview de la imagen representativa */}
                                <div className="flex-shrink-0 relative">
                                  {isDigital && digitalSummary ? (
                                    // Para digitales: mostrar botón con contador que abre galería
                                    <button
                                      onClick={() => {
                                        const rsvIds = representativeItem.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                                        if (rsvIds.length > 0) {
                                          openDigitalGalleryModal(rsvIds[0], representativeItem.codigo_unico);
                                        }
                                      }}
                                      className="w-32 h-24 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex flex-col items-center justify-center hover:bg-cyan-500/30 transition-colors"
                                      title="Ver galería digital"
                                    >
                                      <Film className="h-8 w-8 text-cyan-400 mb-1" />
                                      <span className="text-cyan-400 font-bold text-lg">{digitalSummary.total}</span>
                                      <span className="text-cyan-300 text-[10px]">{getDigitalSummaryText(digitalSummary)}</span>
                                    </button>
                                  ) : representativeItem?.archivo_arte ? (
                                    <div className="w-32 h-24 rounded-lg overflow-hidden bg-zinc-700 border border-zinc-600">
                                      <img
                                        src={getImageUrl(representativeItem.archivo_arte) || ''}
                                        alt="Arte"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-32 h-24 rounded-lg bg-zinc-700 border border-zinc-600 flex items-center justify-center">
                                      <Image className="h-8 w-8 text-zinc-500" />
                                    </div>
                                  )}
                                  {/* Badge con cantidad */}
                                  <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                                    {items.length}
                                  </div>
                                </div>

                                {/* Info del grupo */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-semibold text-white mb-1">
                                    {items.length} ubicacion{items.length !== 1 ? 'es' : ''} {isDigital ? 'con estos archivos' : 'con esta imagen'}
                                  </p>
                                  <p className="text-xs text-zinc-400 mb-2">
                                    {groupBy === 'ciudad' ? 'Ciudad' : 'Grupo'}: <span className="text-purple-300 font-medium">{groupKey.split('|||')[0]}</span>
                                  </p>
                                  {/* Estados resumidos */}
                                  <div className="flex flex-wrap gap-2">
                                    {items.filter(i => i.estado_arte === 'aprobado').length > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400">
                                        {items.filter(i => i.estado_arte === 'aprobado').length} aprobado{items.filter(i => i.estado_arte === 'aprobado').length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {items.filter(i => i.estado_arte === 'rechazado').length > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                                        {items.filter(i => i.estado_arte === 'rechazado').length} rechazado{items.filter(i => i.estado_arte === 'rechazado').length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {items.filter(i => i.estado_arte !== 'aprobado' && i.estado_arte !== 'rechazado').length > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/20 text-zinc-400">
                                        {items.filter(i => i.estado_arte !== 'aprobado' && i.estado_arte !== 'rechazado').length} sin revisar
                                      </span>
                                    )}
                                  </div>
                                  {/* Botón de descarga - solo para tradicionales */}
                                  {!isDigital && representativeItem?.archivo_arte && (
                                    <button
                                      onClick={() => downloadImage(getImageUrl(representativeItem.archivo_arte)!, `${groupKey}.jpg`)}
                                      className="mt-2 text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                                      title="Descargar"
                                    >
                                      <Download className="h-3 w-3" />
                                      Descargar imagen
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer con validación y botón Finalizar */}
                  <div className="border border-border rounded-lg bg-zinc-900/50 p-4">
                    {validationErrors.length > 0 && (
                      <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                        <p className="text-red-400 font-medium text-sm mb-1">Por favor completa:</p>
                        <ul className="text-xs text-red-300 list-disc list-inside space-y-0.5">
                          {validationErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                          {validationErrors.length > 5 && (
                            <li>...y {validationErrors.length - 5} más</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="text-sm text-zinc-400">
                        <span className="font-medium text-white">{Object.values(decisiones).filter(d => d?.decision).length}</span>
                        {' / '}
                        <span>{Object.keys(groupedInventory).length}</span>
                        {' decisiones tomadas'}
                      </div>
                      <button
                        onClick={handleFinalizar}
                        disabled={isFinalizando || isUpdating}
                        className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isFinalizando ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Finalizando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Finalizar Revisión
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha - Comentarios */}
                <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden h-fit">
                  <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comentarios
                    </h4>
                  </div>
                  <div className="p-4">
                    <CommentsSection campanaId={campanaId} tareaId={task?.id || ''} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Digital Gallery Modal dentro de TaskDetailModal */}
      <DigitalGalleryModal
        isOpen={isDigitalGalleryOpen}
        onClose={() => {
          setIsDigitalGalleryOpen(false);
          setDigitalGalleryImages([]);
        }}
        imagenes={digitalGalleryImages}
        isLoading={isLoadingDigitalGallery}
        title={digitalGalleryTitle}
      />
    </div>
  );
}

// Create Task Modal Component
function CreateTaskModal({
  isOpen,
  onClose,
  selectedCount,
  selectedIds,
  selectedInventory,
  campanaId,
  onSubmit,
  proveedores,
  isLoadingProveedores,
  isSubmitting,
  error,
  initialTipo,
  availableTipos,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: string[];
  selectedInventory: InventoryRow[];
  campanaId: number;
  onSubmit: (task: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string; impresiones?: Record<number, number> }) => void;
  proveedores: Proveedor[];
  isLoadingProveedores: boolean;
  isSubmitting: boolean;
  error: string | null;
  initialTipo?: string;
  availableTipos?: string[];
}) {
  // Obtener usuario actual y catorcenas
  const { user } = useAuthStore();
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas-modal'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });
  const catorcenas = catorcenasData?.data || [];
  const years = catorcenasData?.years || [];

  // Query para usuarios (asignados)
  const { data: usuariosData, isLoading: isLoadingUsuarios } = useQuery({
    queryKey: ['usuarios-modal'],
    queryFn: () => campanasService.getUsuarios(),
  });
  const usuarios = usuariosData || [];

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState(initialTipo || '');

  // Actualizar tipo cuando cambie initialTipo (al abrir el modal)
  useEffect(() => {
    if (isOpen && initialTipo) {
      setTipo(initialTipo);
    }
  }, [isOpen, initialTipo]);
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [fechaFin, setFechaFin] = useState('');
  const [estatus, setEstatus] = useState<string>('Pendiente');
  // Campos específicos para Instalación
  const [fechaInstalacion, setFechaInstalacion] = useState('');
  const [horaInstalacion, setHoraInstalacion] = useState('');
  const [contactoSitio, setContactoSitio] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  // Campos específicos para Revisión de artes
  const [identificador, setIdentificador] = useState('');
  const [catorcenaEntrega, setCatorcenaEntrega] = useState<string | null>(null);
  const [asignadoId, setAsignadoId] = useState<number | null>(null);
  const [asignadoNombre, setAsignadoNombre] = useState(''); // Nombre del usuario seleccionado
  const [asignadoSearch, setAsignadoSearch] = useState('');
  const [showAsignadoDropdown, setShowAsignadoDropdown] = useState(false);
  const [yearEntrega, setYearEntrega] = useState<number>(new Date().getFullYear());
  const [fechaCreacion, setFechaCreacion] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  // Campos específicos para Impresión - impresiones por cada arte (agrupado por archivo)
  const [impresiones, setImpresiones] = useState<Record<string, number>>({});

  // Campos específicos para Programación - indicaciones por cada archivo digital
  const [programacionIndicaciones, setProgramacionIndicaciones] = useState<Record<string, string>>({});
  const [archivosDigitalesProgramacion, setArchivosDigitalesProgramacion] = useState<{
    id: number;
    archivo: string;
    archivoData?: string; // Base64 data URL
    spot: number;
    tipo: string;
  }[]>([]);
  const [isLoadingArchivosDigitales, setIsLoadingArchivosDigitales] = useState(false);

  // Inicializar impresiones cuando cambia el inventario seleccionado (cantidad de ubicaciones por defecto)
  useEffect(() => {
    if (isOpen && selectedInventory.length > 0 && tipo === 'Impresión') {
      // Agrupar por archivo_arte
      const grupos: Record<string, number> = {};
      selectedInventory.forEach(item => {
        const key = item.archivo_arte || 'sin_arte';
        grupos[key] = (grupos[key] || 0) + 1;
      });
      // Inicializar con la cantidad de ubicaciones de cada arte
      const initial: Record<string, number> = {};
      Object.entries(grupos).forEach(([key, count]) => {
        initial[key] = impresiones[key] || count;
      });
      setImpresiones(initial);
    }
  }, [isOpen, selectedInventory, tipo]);

  // Cargar archivos digitales cuando se selecciona tipo Programación
  useEffect(() => {
    if (isOpen && selectedInventory.length > 0 && tipo === 'Programación') {
      const loadDigitalFiles = async () => {
        setIsLoadingArchivosDigitales(true);
        try {
          // Obtener los rsv_ids de los items seleccionados
          const reservaIds = selectedInventory.flatMap(item =>
            item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
          );
          if (reservaIds.length > 0) {
            const idsParam = reservaIds.join(',');
            const imagenes = await campanasService.getImagenesDigitales(campanaId, idsParam);
            setArchivosDigitalesProgramacion(imagenes.map(img => ({
              id: img.id,
              archivo: img.archivo,
              archivoData: img.archivoData,
              spot: img.spot,
              tipo: img.tipo,
            })));
          }
        } catch (error) {
          console.error('Error al cargar archivos digitales:', error);
          setArchivosDigitalesProgramacion([]);
        } finally {
          setIsLoadingArchivosDigitales(false);
        }
      };
      loadDigitalFiles();
    }
  }, [isOpen, selectedInventory, tipo, campanaId]);

  const selectedProveedor = proveedores.find(p => p.id === proveedorId);

  // Filtrar catorcenas por año seleccionado
  const catorcenasOptions = useMemo(() => {
    return catorcenas.filter(c => c.a_o === yearEntrega);
  }, [catorcenas, yearEntrega]);

  // Filtrar usuarios por búsqueda
  const filteredUsuarios = useMemo(() => {
    if (!asignadoSearch.trim()) return usuarios;
    const search = asignadoSearch.toLowerCase();
    return usuarios.filter(u =>
      u.nombre.toLowerCase().includes(search) ||
      String(u.id).includes(search)
    );
  }, [usuarios, asignadoSearch]);

  const handleSubmit = () => {
    const payload: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string; impresiones?: Record<number, number> } = {
      titulo,
      descripcion,
      tipo,
      fecha_fin: fechaFin,
      estatus,
      inventario_ids: selectedIds,
      campana_id: campanaId,
      creador: user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado',
      identificador: tipo === 'Revisión de artes' ? identificador : `TASK-${Date.now()}`,
    };

    // Campos adicionales para Revisión de artes
    if (tipo === 'Revisión de artes') {
      (payload as any).catorcena_entrega = catorcenaEntrega;
      (payload as any).fecha_creacion = new Date().toISOString();
      (payload as any).contenido = identificador; // El identificador es el contenido
      (payload as any).listado_inventario = selectedIds.join(','); // Lista de IDs de inventario
      // Asignado para Revisión usa usuarios
      if (asignadoId && asignadoNombre) {
        payload.asignado = asignadoNombre; // Usar solo el nombre del usuario
        (payload as any).id_asignado = String(asignadoId); // ID del usuario asignado
      }
    } else if (tipo === 'Instalación') {
      // Campos adicionales para Instalación
      (payload as any).catorcena_entrega = catorcenaEntrega;
      (payload as any).fecha_creacion = new Date().toISOString();
      (payload as any).listado_inventario = selectedIds.join(',');
      // Asignado para Instalación usa usuarios
      if (asignadoId && asignadoNombre) {
        payload.asignado = asignadoNombre;
        (payload as any).id_asignado = String(asignadoId);
      }
    } else if (tipo === 'Impresión') {
      // Campos adicionales para Impresión
      (payload as any).catorcena_entrega = catorcenaEntrega;
      (payload as any).fecha_creacion = new Date().toISOString();
      (payload as any).contenido = identificador;
      (payload as any).listado_inventario = selectedIds.join(',');
      payload.impresiones = impresiones; // Número de impresiones por inventario
      // Calcular y enviar el total de impresiones
      (payload as any).num_impresiones = Object.values(impresiones).reduce((sum, val) => sum + (val || 0), 0);
      // Proveedor
      if (proveedorId && selectedProveedor) {
        payload.proveedores_id = proveedorId;
        payload.nombre_proveedores = selectedProveedor.nombre;
      }
      // Asignado
      if (asignadoId && asignadoNombre) {
        payload.asignado = asignadoNombre;
        (payload as any).id_asignado = String(asignadoId);
      }
    } else if (tipo === 'Testigo') {
      // Campos adicionales para Testigo
      (payload as any).catorcena_entrega = catorcenaEntrega;
      (payload as any).fecha_creacion = new Date().toISOString();
      (payload as any).listado_inventario = selectedIds.join(',');
      // Asignado para Testigo usa usuarios
      if (asignadoId && asignadoNombre) {
        payload.asignado = asignadoNombre;
        (payload as any).id_asignado = String(asignadoId);
      }
    } else if (tipo === 'Programación') {
      // Campos adicionales para Programación
      (payload as any).catorcena_entrega = catorcenaEntrega;
      (payload as any).fecha_creacion = new Date().toISOString();
      (payload as any).listado_inventario = selectedIds.join(',');
      // Guardar indicaciones de programación como JSON en evidencia
      // NOTA: NO incluir archivoData aquí porque puede ser muy grande (base64) y truncar el JSON
      // Los archivos se cargan desde la API usando el nombre del archivo cuando se necesitan
      (payload as any).evidencia = JSON.stringify({
        indicaciones: programacionIndicaciones,
        archivos: archivosDigitalesProgramacion.map(a => ({
          archivo: a.archivo,
          spot: a.spot,
          tipo: a.tipo,
        })),
      });
      // Asignado para Programación usa usuarios
      if (asignadoId && asignadoNombre) {
        payload.asignado = asignadoNombre;
        (payload as any).id_asignado = String(asignadoId);
      }
    } else if (proveedorId && selectedProveedor) {
      // Para otros tipos usa proveedores
      payload.proveedores_id = proveedorId;
      payload.nombre_proveedores = selectedProveedor.nombre;
      payload.asignado = selectedProveedor.nombre;
    }

    onSubmit(payload);
  };

  const handleClose = () => {
    // Reset form
    setTitulo('');
    setDescripcion('');
    setTipo('');
    setProveedorId(null);
    setFechaFin('');
    setEstatus('Pendiente');
    // Reset campos de Instalación
    setFechaInstalacion('');
    setHoraInstalacion('');
    setContactoSitio('');
    setTelefonoContacto('');
    // Reset campos de Revisión
    setIdentificador('');
    setCatorcenaEntrega(null);
    setAsignadoId(null);
    setAsignadoNombre('');
    setAsignadoSearch('');
    setShowAsignadoDropdown(false);
    setFechaCreacion(new Date().toISOString().slice(0, 16));
    // Reset campos de Impresión
    setImpresiones({});
    // Reset campos de Programación
    setProgramacionIndicaciones({});
    setArchivosDigitalesProgramacion([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5 text-purple-400" />
            Crear Tarea
          </h3>
          <button onClick={handleClose} className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <p className="text-xs text-purple-300">
            <span className="font-medium">{selectedCount}</span> espacio(s) seleccionado(s)
          </p>
        </div>

        {/* Selector de tipo de tarea */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">Selecciona el tipo de tarea *</label>
          <div className={`grid gap-2 ${
            availableTipos?.length === 1
              ? 'grid-cols-1'
              : availableTipos?.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}>
            {TIPOS_TAREA
              .filter(t => !availableTipos || availableTipos.length === 0 || availableTipos.includes(t.value))
              .map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border text-center transition-all ${
                  tipo === t.value
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-border bg-background text-zinc-400 hover:border-purple-500/50 hover:bg-purple-900/10'
                } disabled:opacity-50`}
              >
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
          {tipo && (
            <p className="mt-2 text-xs text-zinc-500">
              {TIPOS_TAREA.find(t => t.value === tipo)?.description}
            </p>
          )}
        </div>

        {/* Formulario condicional según tipo */}
        {tipo && (
          <div className="space-y-4 border-t border-border pt-4">
            {/* Campos comunes - Título para tipos que no tienen formulario propio */}
            {tipo !== 'Revisión de artes' && tipo !== 'Impresión' && tipo !== 'Instalación' && tipo !== 'Testigo' && tipo !== 'Programación' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  placeholder="Ej: Instalación en Reforma"
                />
              </div>
            )}

            {/* === FORMULARIO INSTALACIÓN === */}
            {tipo === 'Instalación' && (
              <>
                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Título de la instalación"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Descripción de la instalación..."
                  />
                </div>

                {/* Catorcena de entrega */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Catorcena de entrega</label>
                  <select
                    value={catorcenaEntrega || ''}
                    onChange={(e) => setCatorcenaEntrega(e.target.value || null)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Seleccionar</option>
                    {[2024, 2025, 2026].flatMap(year =>
                      Array.from({ length: 26 }, (_, i) => i + 1).map(num => (
                        <option key={`${num}-${year}`} value={`Catorcena ${num}, ${year}`}>
                          Catorcena {num}, {year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Asignado */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado *</label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={asignadoSearch}
                        onChange={(e) => {
                          setAsignadoSearch(e.target.value);
                          setShowAsignadoDropdown(true);
                          if (!e.target.value) {
                            setAsignadoId(null);
                            setAsignadoNombre('');
                          }
                        }}
                        onFocus={() => setShowAsignadoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAsignadoDropdown(false), 200)}
                        placeholder="Buscar usuario..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      />
                      {showAsignadoDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsuarios.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAsignadoId(u.id);
                                setAsignadoNombre(u.nombre);
                                setAsignadoSearch(`${u.id}, ${u.nombre}`);
                                setShowAsignadoDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                            >
                              {u.id}, {u.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha creación (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha creación *</label>
                  <input
                    type="text"
                    value={new Date().toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Creador (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Creador *</label>
                  <input
                    type="text"
                    value={user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado'}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {/* === FORMULARIO REVISIÓN DE ARTES === */}
            {tipo === 'Revisión de artes' && (
              <>
                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Título"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción *</label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Descripción"
                  />
                </div>

                {/* Catorcena de entrega */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Catorcena de entrega</label>
                  <select
                    value={catorcenaEntrega || ''}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      setCatorcenaEntrega(value);
                      // Buscar la catorcena y establecer fecha_fin
                      if (value) {
                        const match = value.match(/Catorcena (\d+), (\d+)/);
                        if (match) {
                          const numCatorcena = parseInt(match[1]);
                          const year = parseInt(match[2]);
                          const catorcenaFound = catorcenas.find(c => c.numero_catorcena === numCatorcena && c.a_o === year);
                          if (catorcenaFound) {
                            setFechaFin(catorcenaFound.fecha_fin.split('T')[0]);
                          }
                        }
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Seleccionar</option>
                    {/* Catorcenas desde 1, 2024 hasta 26, 2026 */}
                    {[2024, 2025, 2026].flatMap(year =>
                      Array.from({ length: 26 }, (_, i) => i + 1).map(num => (
                        <option key={`${num}-${year}`} value={`Catorcena ${num}, ${year}`}>
                          Catorcena {num}, {year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Asignado */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado *</label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={asignadoSearch}
                        onChange={(e) => {
                          setAsignadoSearch(e.target.value);
                          setShowAsignadoDropdown(true);
                          if (!e.target.value) {
                            setAsignadoId(null);
                            setAsignadoNombre('');
                          }
                        }}
                        onFocus={() => setShowAsignadoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAsignadoDropdown(false), 200)}
                        placeholder="Buscar usuario..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      />
                      {showAsignadoDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsuarios.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAsignadoId(u.id);
                                setAsignadoNombre(u.nombre);
                                setAsignadoSearch(`${u.id}, ${u.nombre}`);
                                setShowAsignadoDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                            >
                              {u.id}, {u.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha creación (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha creación *</label>
                  <input
                    type="text"
                    value={new Date().toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Creador (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Creador *</label>
                  <input
                    type="text"
                    value={user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado'}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {/* === FORMULARIO PROGRAMACIÓN === */}
            {tipo === 'Programación' && (
              <>
                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Título de la programación"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción *</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Descripción general de la programación..."
                  />
                </div>

                {/* Catorcena de entrega */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Catorcena de entrega *</label>
                  <select
                    value={catorcenaEntrega || ''}
                    onChange={(e) => setCatorcenaEntrega(e.target.value || null)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Seleccionar</option>
                    {[2024, 2025, 2026].flatMap(year =>
                      Array.from({ length: 26 }, (_, i) => i + 1).map(num => (
                        <option key={`${num}-${year}`} value={`Catorcena ${num}, ${year}`}>
                          Catorcena {num}, {year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Asignado */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado *</label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={asignadoSearch}
                        onChange={(e) => {
                          setAsignadoSearch(e.target.value);
                          setShowAsignadoDropdown(true);
                          if (!e.target.value) {
                            setAsignadoId(null);
                            setAsignadoNombre('');
                          }
                        }}
                        onFocus={() => setShowAsignadoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAsignadoDropdown(false), 200)}
                        placeholder="Buscar usuario..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      />
                      {showAsignadoDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsuarios.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAsignadoId(u.id);
                                setAsignadoNombre(u.nombre);
                                setAsignadoSearch(`${u.id}, ${u.nombre}`);
                                setShowAsignadoDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                            >
                              {u.id}, {u.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha de creación (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha de creación</label>
                  <input
                    type="datetime-local"
                    value={fechaCreacion}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Creador (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Creador *</label>
                  <input
                    type="text"
                    value={user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado'}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Archivos digitales con indicaciones */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Indicaciones por archivo * ({archivosDigitalesProgramacion.length} archivo(s))
                  </label>
                  {isLoadingArchivosDigitales ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                      <span className="ml-2 text-sm text-zinc-400">Cargando archivos...</span>
                    </div>
                  ) : archivosDigitalesProgramacion.length === 0 ? (
                    <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-sm text-zinc-500">No se encontraron archivos digitales</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {archivosDigitalesProgramacion.map((archivo) => {
                        const fileName = archivo.archivo.split('/').pop() || archivo.archivo;
                        const isVideo = archivo.tipo === 'video';
                        // Usar archivoData (base64) si está disponible
                        const fileUrl = getImageUrl(archivo.archivoData || archivo.archivo);
                        return (
                          <div key={archivo.id} className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <div className="flex gap-3 mb-2">
                              {/* Thumbnail/Preview - mismo estilo que DigitalGalleryModal */}
                              <div className="flex-shrink-0 w-20 h-14 bg-zinc-800 rounded overflow-hidden">
                                {isVideo ? (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                    <Play className="h-6 w-6 text-purple-400" />
                                  </div>
                                ) : fileUrl ? (
                                  <img
                                    src={fileUrl}
                                    alt={fileName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center ${fileUrl && !isVideo ? 'hidden' : ''}`}>
                                  <Image className="h-6 w-6 text-zinc-600" />
                                </div>
                              </div>
                              {/* File info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {isVideo ? (
                                    <Video className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                  ) : (
                                    <Image className="h-3 w-3 text-green-400 flex-shrink-0" />
                                  )}
                                  <span className="text-xs text-white truncate" title={fileName}>
                                    {fileName}
                                  </span>
                                </div>
                                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded inline-block mt-1">
                                  Spot {archivo.spot}
                                </span>
                              </div>
                            </div>
                            <textarea
                              value={programacionIndicaciones[archivo.archivo] || ''}
                              onChange={(e) => setProgramacionIndicaciones(prev => ({
                                ...prev,
                                [archivo.archivo]: e.target.value
                              }))}
                              placeholder="Indicaciones de programación para este archivo..."
                              disabled={isSubmitting}
                              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                              rows={2}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* === FORMULARIO IMPRESIÓN === */}
            {tipo === 'Impresión' && (
              <>
                {/* Lista de artes agrupados por archivo */}
                <div>
                  {(() => {
                    // Agrupar items por archivo_arte
                    const artesAgrupados = selectedInventory.reduce((acc, item) => {
                      const key = item.archivo_arte || 'sin_arte';
                      if (!acc[key]) {
                        acc[key] = { items: [], archivo: item.archivo_arte };
                      }
                      acc[key].items.push(item);
                      return acc;
                    }, {} as Record<string, { items: typeof selectedInventory; archivo: string | undefined }>);

                    const grupos = Object.entries(artesAgrupados);

                    return (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <label onClick={() => console.log(grupos)} className="block text-xs font-medium text-zinc-400">
                            Artes a imprimir ({grupos.length} {grupos.length === 1 ? 'arte' : 'artes diferentes'} - {selectedInventory.length} ubicaciones)
                          </label>
                          <span className="text-xs text-purple-400">
                            Total: {Object.values(impresiones).reduce((sum, val) => sum + (val || 0), 0)} impresiones
                          </span>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg border border-border max-h-[250px] overflow-y-auto">
                          {grupos.map(([arteKey, grupo]) => (
                            <div key={arteKey} className="flex items-center gap-3 p-3 border-b border-border/50 last:border-0 hover:bg-zinc-800/30">
                              {/* Preview de imagen */}
                              <div className="w-14 h-14 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                                {grupo.archivo ? (
                                  <img
                                    src={getImageUrl(grupo.archivo) || ''}
                                    alt="Arte"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Image className="h-5 w-5 text-zinc-600" />
                                  </div>
                                )}
                                {/* Badge con cantidad de ubicaciones */}
                                {grupo.items.length > 1 && (
                                  <div className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {grupo.items.length}
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-zinc-300">
                                  {grupo.items.length} {grupo.items.length === 1 ? 'ubicación' : 'ubicaciones'}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {grupo.items.map(i => i.codigo_unico).slice(0, 3).join(', ')}
                                  {grupo.items.length > 3 && ` +${grupo.items.length - 3} más`}
                                </p>
                              </div>
                              {/* Campo de impresiones */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input
                                  type="number"
                                  min={grupo.items.length}
                                  value={impresiones[arteKey] || grupo.items.length}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || grupo.items.length;
                                    setImpresiones(prev => ({
                                      ...prev,
                                      [arteKey]: Math.max(val, grupo.items.length)
                                    }));
                                  }}
                                  disabled={isSubmitting}
                                  className="w-16 px-2 py-1.5 text-sm text-center bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                                />
                                <span className="text-[10px] text-zinc-500 w-8">uds</span>
                              </div>
                              {/* Botón descargar */}
                              {grupo.archivo && (
                                <a
                                  href={getImageUrl(grupo.archivo) || '#'}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-zinc-400 hover:text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors flex-shrink-0"
                                  title="Descargar arte"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Proveedor de impresión */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Proveedor de impresión *</label>
                  {isLoadingProveedores ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando proveedores...</span>
                    </div>
                  ) : (
                    <select
                      value={proveedorId || ''}
                      onChange={(e) => setProveedorId(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar proveedor --</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.ciudad ? `(${p.ciudad})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Título de la tarea"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción *</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Descripción de la tarea de impresión"
                  />
                </div>

                {/* Catorcena de entrega */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Catorcena de entrega *</label>
                  <select
                    value={catorcenaEntrega || ''}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      setCatorcenaEntrega(value);
                      // Buscar la catorcena y establecer fecha_fin
                      if (value) {
                        const match = value.match(/Catorcena (\d+), (\d+)/);
                        if (match) {
                          const numCatorcena = parseInt(match[1]);
                          const year = parseInt(match[2]);
                          const catorcenaFound = catorcenas.find(c => c.numero_catorcena === numCatorcena && c.a_o === year);
                          if (catorcenaFound) {
                            setFechaFin(catorcenaFound.fecha_fin.split('T')[0]);
                          }
                        }
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Seleccionar</option>
                    {[2024, 2025, 2026].flatMap(year =>
                      Array.from({ length: 26 }, (_, i) => i + 1).map(num => (
                        <option key={`${num}-${year}`} value={`Catorcena ${num}, ${year}`}>
                          Catorcena {num}, {year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Asignado */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado *</label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={asignadoSearch}
                        onChange={(e) => {
                          setAsignadoSearch(e.target.value);
                          setShowAsignadoDropdown(true);
                          if (!e.target.value) {
                            setAsignadoId(null);
                            setAsignadoNombre('');
                          }
                        }}
                        onFocus={() => setShowAsignadoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAsignadoDropdown(false), 200)}
                        placeholder="Buscar usuario..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      />
                      {showAsignadoDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsuarios.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAsignadoId(u.id);
                                setAsignadoNombre(u.nombre);
                                setAsignadoSearch(`${u.id}, ${u.nombre}`);
                                setShowAsignadoDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                            >
                              {u.id}, {u.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha creación (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha creación</label>
                  <input
                    type="text"
                    value={new Date().toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Creador (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Creador</label>
                  <input
                    type="text"
                    value={user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado'}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {/* === FORMULARIO TESTIGO === */}
            {tipo === 'Testigo' && (
              <>
                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Título de la tarea de testigo"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Descripción</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Descripción de la tarea..."
                  />
                </div>

                {/* Catorcena de entrega */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Catorcena de entrega *</label>
                  <select
                    value={catorcenaEntrega || ''}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      setCatorcenaEntrega(value);
                      // Buscar la catorcena y establecer fecha_fin
                      if (value) {
                        const match = value.match(/Catorcena (\d+), (\d+)/);
                        if (match) {
                          const numCatorcena = parseInt(match[1]);
                          const year = parseInt(match[2]);
                          const catorcenaFound = catorcenas.find(c => c.numero_catorcena === numCatorcena && c.a_o === year);
                          if (catorcenaFound) {
                            setFechaFin(catorcenaFound.fecha_fin.split('T')[0]);
                          }
                        }
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Seleccionar</option>
                    {[2024, 2025, 2026].flatMap(year =>
                      Array.from({ length: 26 }, (_, i) => i + 1).map(num => (
                        <option key={`${num}-${year}`} value={`Catorcena ${num}, ${year}`}>
                          Catorcena {num}, {year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Asignado */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado *</label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 py-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={asignadoSearch}
                        onChange={(e) => {
                          setAsignadoSearch(e.target.value);
                          setShowAsignadoDropdown(true);
                          if (!e.target.value) {
                            setAsignadoId(null);
                            setAsignadoNombre('');
                          }
                        }}
                        onFocus={() => setShowAsignadoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAsignadoDropdown(false), 200)}
                        placeholder="Buscar usuario..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      />
                      {showAsignadoDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsuarios.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setAsignadoId(u.id);
                                setAsignadoNombre(u.nombre);
                                setAsignadoSearch(`${u.id}, ${u.nombre}`);
                                setShowAsignadoDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-sm text-left hover:bg-purple-900/30 transition-colors"
                            >
                              {u.id}, {u.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fecha inicio (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha inicio</label>
                  <input
                    type="text"
                    value={new Date().toLocaleString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Creador (solo lectura) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Creador</label>
                  <input
                    type="text"
                    value={user ? `${user.id}, ${user.nombre}` : 'Usuario no identificado'}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-border rounded-lg text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tipo || (tipo === 'Revisión de artes' ? !descripcion.trim() : tipo === 'Testigo' ? (!titulo.trim() || !catorcenaEntrega || !asignadoId) : tipo === 'Programación' ? (!titulo.trim() || !descripcion.trim() || !catorcenaEntrega || !asignadoId || isLoadingArchivosDigitales || archivosDigitalesProgramacion.length === 0 || archivosDigitalesProgramacion.some(a => !programacionIndicaciones[a.archivo]?.trim())) : !titulo.trim()) || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isSubmitting || (tipo === 'Programación' && isLoadingArchivosDigitales)) && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Generando...' : tipo === 'Programación' && isLoadingArchivosDigitales ? 'Cargando archivos...' : tipo === 'Revisión de artes' ? 'Generar Revisión de artes' : tipo === 'Testigo' ? 'Crear Testigo' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple Calendar Component
function SimpleCalendar({
  view,
  events,
  currentDate,
  onViewChange,
  onDateChange,
}: {
  view: CalendarView;
  events: CalendarEvent[];
  currentDate: Date;
  onViewChange: (view: CalendarView) => void;
  onDateChange: (date: Date) => void;
}) {
  const goToToday = () => onDateChange(new Date());
  const goPrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };
  const goNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const monthName = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  // Generate days for month view
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(
      (e) =>
        e.date.getFullYear() === date.getFullYear() &&
        e.date.getMonth() === date.getMonth() &&
        e.date.getDate() === date.getDate()
    );
  };

  const days = getDaysInMonth();
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-1.5 hover:bg-purple-900/30 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={goNext}
            className="p-1.5 hover:bg-purple-900/30 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium capitalize ml-2">{monthName}</span>
        </div>
        <div className="flex items-center gap-1 bg-purple-900/20 rounded-lg p-0.5">
          {(['month', 'week', 'day', 'list'] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                view === v ? 'bg-purple-600 text-white' : 'hover:bg-purple-900/30'
              }`}
            >
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Dia' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid (Month View) */}
      {view === 'month' && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-purple-900/20">
            {weekDays.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[10px] font-medium text-purple-300 border-b border-border">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const dayEvents = day ? getEventsForDate(day) : [];
              const isToday = day && day.toDateString() === new Date().toDateString();
              return (
                <div
                  key={idx}
                  className={`min-h-[80px] p-1 border-b border-r border-border last:border-r-0 ${
                    day ? 'hover:bg-purple-900/10' : 'bg-zinc-900/30'
                  }`}
                >
                  {day && (
                    <>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 text-[11px] rounded-full ${
                          isToday ? 'bg-purple-600 text-white' : 'text-zinc-400'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <div className="space-y-0.5 mt-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`px-1 py-0.5 text-[9px] rounded truncate ${
                              event.type === 'tarea' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                            }`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 2} mas</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <EmptyState message="Sin eventos" icon={CalendarIcon} />
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-purple-900/10 transition-colors"
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    event.type === 'tarea' ? 'bg-blue-500' : 'bg-green-500'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Week/Day placeholder */}
      {(view === 'week' || view === 'day') && (
        <div className="flex items-center justify-center py-12 text-muted-foreground border border-border rounded-lg">
          <p className="text-sm">Vista {view === 'week' ? 'semanal' : 'diaria'} - Proximamente</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUMMARY STATS COMPONENT
// ============================================================================

interface SummaryStats {
  totalInventario: number;
  sinArte: number;
  enRevision: number;
  aprobados: number;
  rechazados: number;
  tareasActivas: number;
  tareasCompletadas: number;
}

function SummaryCards({ stats, activeTab }: { stats: SummaryStats; activeTab: MainTab }) {
  const cards = useMemo(() => {
    if (activeTab === 'versionario') {
      return [
        { label: 'Inventario sin Artes', value: stats.sinArte, icon: Image, color: 'amber' },
      ];
    }
    if (activeTab === 'atender') {
      return [
        { label: 'Por Revisar', value: stats.sinArte, icon: Eye, color: 'amber' },
        { label: 'Aprobados', value: stats.aprobados, icon: CheckCircle2, color: 'green' },
        { label: 'Rechazados', value: stats.rechazados, icon: AlertCircle, color: 'red' },
        { label: 'Tareas Activas', value: stats.tareasActivas, icon: ClipboardList, color: 'blue' },
      ];
    }
    if (activeTab === 'programacion') {
      return [
        { label: 'Artes Digitales', value: stats.totalInventario, icon: Monitor, color: 'purple' },
        { label: 'Tareas Activas', value: stats.tareasActivas, icon: ClipboardList, color: 'blue' },
      ];
    }
    // testigo
    return [
      { label: 'Pendientes', value: stats.totalInventario - stats.aprobados, icon: Camera, color: 'amber' },
      { label: 'Validados', value: stats.aprobados, icon: CheckCircle2, color: 'green' },
    ];
  }, [stats, activeTab]);

  const colorMap: Record<string, string> = {
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const visibleCards = cards.filter((card) => card.value > 0);

  if (visibleCards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {visibleCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`flex items-center gap-3 p-3 rounded-lg border ${colorMap[card.color]}`}
          >
            <div className={`p-2 rounded-lg ${colorMap[card.color]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{card.value}</p>
              <p className="text-[10px] opacity-80">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tab descriptions for better UX
const TAB_DESCRIPTIONS: Record<MainTab, { title: string; description: string; icon: typeof Image }> = {
  versionario: {
    title: 'Subir Artes',
    description: 'Selecciona espacios y asigna los artes/creativos que se mostraran en cada ubicacion',
    icon: Upload,
  },
  atender: {
    title: 'Revisar y Aprobar',
    description: 'Revisa los artes subidos, aprueba o rechaza, y gestiona tareas de produccion',
    icon: Eye,
  },
  programacion: {
    title: 'Programación',
    description: 'Gestiona las tareas de programación de artes digitales con indicaciones',
    icon: Monitor,
  },
  impresiones: {
    title: 'Impresiones',
    description: 'Visualiza el estado de las impresiones solicitadas y su progreso',
    icon: Printer,
  },
  testigo: {
    title: 'Validar Instalacion',
    description: 'Revisa las fotos de instalacion (testigos) para confirmar que el arte se instalo correctamente',
    icon: Camera,
  },
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export function TareaSeguimientoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campanaId = id ? parseInt(id, 10) : 0;
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // WebSocket para sincronización en tiempo real
  useSocketCampana(campanaId);

  // ---- State ----
  // Main tabs
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('versionario');
  const [activeFormat, setActiveFormat] = useState<FormatTab>('tradicional');
  const [initialTabDetermined, setInitialTabDetermined] = useState(false);
  const [activeTasksTab, setActiveTasksTab] = useState<TasksTab>('tradicionales');

  // Inventory state
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [inventorySearch, setInventorySearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['all']));

  // Grouping, Filtering, Sorting state
  const [groupByField, setGroupByField] = useState<GroupByField>('none');
  const [sortField, setSortField] = useState<SortField>('codigo_unico');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<InventoryFilters>({
    ciudad: '',
    plaza: '',
    mueble: '',
    tipo_medio: '',
    catorcena: null,
  });

  // Dropdown visibility state (legacy - kept for compatibility)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // ========== FILTROS AVANZADOS PARA CADA TABLA ==========
  
  // --- Subir Artes (versionario) ---
  const [filtersVersionario, setFiltersVersionario] = useState<FilterCondition[]>([]);
  const [showFiltersVersionario, setShowFiltersVersionario] = useState(false);
  const [activeGroupingsVersionario, setActiveGroupingsVersionario] = useState<GroupByField[]>(['catorcena', 'aps', 'grupo']);
  const [showGroupingVersionario, setShowGroupingVersionario] = useState(false);
  const [sortFieldVersionario, setSortFieldVersionario] = useState<string | null>(null);
  const [sortDirectionVersionario, setSortDirectionVersionario] = useState<'asc' | 'desc'>('asc');
  const [showSortVersionario, setShowSortVersionario] = useState(false);
  const [expandedGroupsVersionario, setExpandedGroupsVersionario] = useState<Set<string>>(new Set());

  // --- Revisar y Aprobar (atender) ---
  const [filtersAtender, setFiltersAtender] = useState<FilterCondition[]>([]);
  const [showFiltersAtender, setShowFiltersAtender] = useState(false);
  const [activeGroupingsAtender, setActiveGroupingsAtender] = useState<GroupByField[]>(['catorcena', 'aps', 'grupo']);
  const [showGroupingAtender, setShowGroupingAtender] = useState(false);
  const [sortFieldAtender, setSortFieldAtender] = useState<string | null>(null);
  const [sortDirectionAtender, setSortDirectionAtender] = useState<'asc' | 'desc'>('asc');
  const [showSortAtender, setShowSortAtender] = useState(false);
  const [expandedGroupsAtender, setExpandedGroupsAtender] = useState<Set<string>>(new Set());
  const [activeEstadoArteTab, setActiveEstadoArteTab] = useState<'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado'>('sin_revisar');
  const [hasAutoSelectedEstadoArteTab, setHasAutoSelectedEstadoArteTab] = useState(false);

  // --- Programación (digital) ---
  const [filtersProgramacion, setFiltersProgramacion] = useState<FilterCondition[]>([]);
  const [showFiltersProgramacion, setShowFiltersProgramacion] = useState(false);
  const [activeGroupingsProgramacion, setActiveGroupingsProgramacion] = useState<GroupByField[]>(['catorcena', 'aps', 'grupo']);
  const [showGroupingProgramacion, setShowGroupingProgramacion] = useState(false);
  const [sortFieldProgramacion, setSortFieldProgramacion] = useState<string | null>(null);
  const [sortDirectionProgramacion, setSortDirectionProgramacion] = useState<'asc' | 'desc'>('asc');
  const [showSortProgramacion, setShowSortProgramacion] = useState(false);
  const [expandedGroupsProgramacion, setExpandedGroupsProgramacion] = useState<Set<string>>(new Set());
  const [activeEstadoProgramacionTab, setActiveEstadoProgramacionTab] = useState<'en_programacion' | 'programado'>('en_programacion');

  // --- Impresiones ---
  const [activeEstadoImpresionTab, setActiveEstadoImpresionTab] = useState<'en_impresion' | 'pendiente_recepcion' | 'recibido'>('en_impresion');

  // --- Validar Instalación (testigo) ---
  const [filtersTestigo, setFiltersTestigo] = useState<FilterCondition[]>([]);
  const [showFiltersTestigo, setShowFiltersTestigo] = useState(false);
  const [activeGroupingsTestigo, setActiveGroupingsTestigo] = useState<GroupByField[]>(['catorcena', 'aps', 'grupo']);
  const [showGroupingTestigo, setShowGroupingTestigo] = useState(false);
  const [sortFieldTestigo, setSortFieldTestigo] = useState<string | null>(null);
  const [sortDirectionTestigo, setSortDirectionTestigo] = useState<'asc' | 'desc'>('asc');
  const [showSortTestigo, setShowSortTestigo] = useState(false);
  const [expandedGroupsTestigo, setExpandedGroupsTestigo] = useState<Set<string>>(new Set());
  const [activeEstadoInstalacionTab, setActiveEstadoInstalacionTab] = useState<'por_instalar' | 'instaladas' | 'testigo'>('por_instalar');

  // Helper: check if grouped (basado en el tab activo)
  const isGrouped = useMemo(() => {
    if (activeMainTab === 'versionario') return activeGroupingsVersionario.length > 0;
    if (activeMainTab === 'atender') return activeGroupingsAtender.length > 0;
    if (activeMainTab === 'programacion') return activeGroupingsProgramacion.length > 0;
    return activeGroupingsTestigo.length > 0;
  }, [activeMainTab, activeGroupingsVersionario, activeGroupingsAtender, activeGroupingsProgramacion, activeGroupingsTestigo]);

  // Tasks state
  const [tasksSearch, setTasksSearch] = useState('');
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>('');
  const [filtersTareas, setFiltersTareas] = useState<FilterCondition[]>([]);
  const [showFiltersTareas, setShowFiltersTareas] = useState(false);
  const [activeGroupingsTareas, setActiveGroupingsTareas] = useState<GroupByField[]>([]);
  const [showGroupingTareas, setShowGroupingTareas] = useState(false);
  const [sortFieldTareas, setSortFieldTareas] = useState<string | null>(null);
  const [sortDirectionTareas, setSortDirectionTareas] = useState<'asc' | 'desc'>('asc');
  const [showSortTareas, setShowSortTareas] = useState(false);

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadArtModalOpen, setIsUploadArtModalOpen] = useState(false);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  // Digital Gallery Modal state
  const [isDigitalGalleryOpen, setIsDigitalGalleryOpen] = useState(false);
  const [digitalGalleryImages, setDigitalGalleryImages] = useState<ImagenDigitalView[]>([]);
  const [isLoadingDigitalGallery, setIsLoadingDigitalGallery] = useState(false);
  const [digitalGalleryTitle, setDigitalGalleryTitle] = useState('');

  // Modal confirmación limpiar arte
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const [tareasAfectadas, setTareasAfectadas] = useState<Array<{ id: number; titulo: string | null; tipo: string | null; estatus: string | null; responsable: string | null }>>([]);
  const [isCheckingTareas, setIsCheckingTareas] = useState(false);

  // Modal advertencia de tareas existentes al crear tarea
  const [isTaskWarningModalOpen, setIsTaskWarningModalOpen] = useState(false);
  const [existingTasksForCreate, setExistingTasksForCreate] = useState<Array<{ id: number; titulo: string | null; tipo: string | null; estatus: string | null; responsable: string | null }>>([]);
  const [isCheckingExistingTasks, setIsCheckingExistingTasks] = useState(false);

  // Tipo inicial para el modal de crear tarea (basado en estado de inventarios)
  const [initialTaskTipo, setInitialTaskTipo] = useState<string>('');
  const [availableTaskTipos, setAvailableTaskTipos] = useState<string[]>([]);

  // ---- Query Client for mutations ----
  const queryClient = useQueryClient();

  // ---- Queries ----
  const { data: campana, isLoading, error } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
    enabled: campanaId > 0,
  });

  // Inventario SIN arte (para tab "Subir Artes")
  // Se carga siempre inicialmente para determinar el tab por defecto
  const { data: inventarioSinArteAPI = [], isLoading: isLoadingInventarioSinArte, isFetched: isFetchedSinArte } = useQuery({
    queryKey: ['campana-inventario-sin-arte', campanaId],
    queryFn: () => campanasService.getInventarioSinArte(campanaId),
    enabled: campanaId > 0 && (activeMainTab === 'versionario' || !initialTabDetermined),
  });

  // Inventario CON arte (para tab "Revisar y Aprobar", "Programación" e "Impresiones")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioArteAPI = [], isLoading: isLoadingInventarioArte, isFetched: isFetchedConArte } = useQuery({
    queryKey: ['campana-inventario-arte', campanaId],
    queryFn: () => campanasService.getInventarioConArte(campanaId),
    enabled: campanaId > 0 && (activeMainTab === 'atender' || activeMainTab === 'programacion' || activeMainTab === 'impresiones' || !initialTabDetermined || isTaskDetailModalOpen),
  });

  // Inventario para TESTIGOS (para tab "Validar Instalación")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioTestigosAPI = [], isLoading: isLoadingInventarioTestigos, isFetched: isFetchedTestigos } = useQuery({
    queryKey: ['campana-inventario-testigos', campanaId],
    queryFn: () => campanasService.getInventarioTestigos(campanaId),
    enabled: campanaId > 0 && (activeMainTab === 'testigo' || !initialTabDetermined),
  });

  // Tareas de la campaña (todas para poder filtrar en activas/completadas)
  // Sincronización en tiempo real via WebSockets (sin polling)
  const { data: tareasAPI = [], isLoading: isLoadingTareas } = useQuery({
    queryKey: ['campana-tareas', campanaId],
    queryFn: () => campanasService.getTareas(campanaId, {}),
    enabled: campanaId > 0,
    staleTime: 30000, // Considerar frescos por 30s para evitar refetch innecesario
  });

  // Artes existentes de la campaña
  const { data: artesExistentes = [], isLoading: isLoadingArtes } = useQuery({
    queryKey: ['campana-artes-existentes', campanaId],
    queryFn: () => campanasService.getArtesExistentes(campanaId),
    enabled: campanaId > 0 && (isUploadArtModalOpen || isTaskDetailModalOpen),
  });

  // Proveedores para asignar tareas
  const { data: proveedoresData, isLoading: isLoadingProveedores } = useQuery({
    queryKey: ['proveedores-lista'],
    queryFn: () => proveedoresService.getAll({ limit: 100, estado: 'activo' }),
    enabled: isCreateModalOpen,
  });
  const proveedores = proveedoresData?.data || [];

  // Resumen de archivos digitales por reserva
  const { data: digitalFileSummaries = [] } = useQuery({
    queryKey: ['digital-file-summaries', campanaId],
    queryFn: () => campanasService.getDigitalFileSummaries(campanaId),
    enabled: campanaId > 0,
  });

  // Crear mapa para búsqueda rápida por reserva ID
  const digitalSummaryMap = useMemo(() => {
    const map = new Map<number, DigitalFileSummary>();
    digitalFileSummaries.forEach(summary => {
      map.set(summary.idReserva, summary);
    });
    return map;
  }, [digitalFileSummaries]);

  // ---- Determinar tab inicial basado en contenido y permisos ----
  useEffect(() => {
    // Solo ejecutar una vez cuando los datos estén disponibles
    if (initialTabDetermined) return;

    // Esperar a que las queries hayan terminado de hacer fetch (no solo que no estén cargando)
    const allQueriesFetched = isFetchedSinArte && isFetchedConArte && isFetchedTestigos;
    if (!allQueriesFetched) return;

    // Determinar el tab con contenido (prioridad: versionario > atender > testigo)
    // Pero respetando permisos
    if (inventarioSinArteAPI.length > 0 && permissions.canSeeTabSubirArtes) {
      setActiveMainTab('versionario');
    } else if (inventarioArteAPI.length > 0) {
      setActiveMainTab('atender');
    } else if (inventarioTestigosAPI.length > 0 && permissions.canSeeTabValidacionInstalacion) {
      setActiveMainTab('testigo');
    } else if (!permissions.canSeeTabSubirArtes) {
      // Si no puede ver versionario, default a atender
      setActiveMainTab('atender');
    }
    // Si ninguno tiene contenido y puede ver versionario, se queda en versionario por defecto

    setInitialTabDetermined(true);
  }, [
    initialTabDetermined,
    isFetchedSinArte,
    isFetchedConArte,
    isFetchedTestigos,
    inventarioSinArteAPI.length,
    inventarioArteAPI.length,
    inventarioTestigosAPI.length,
    permissions.canSeeTabSubirArtes,
    permissions.canSeeTabValidacionInstalacion,
  ]);

  // ---- Determinar tab de estado_arte inicial basado en contenido ----
  useEffect(() => {
    // Solo auto-seleccionar una vez cuando los datos estén disponibles
    if (hasAutoSelectedEstadoArteTab) return;
    if (!isFetchedConArte || inventarioArteAPI.length === 0) return;

    // Contar items por estado
    const counts = {
      sin_revisar: 0,
      en_revision: 0,
      aprobado: 0,
      rechazado: 0,
    };

    inventarioArteAPI.forEach(item => {
      const arteAprobadoLower = (item.arte_aprobado || '').toLowerCase();
      if (arteAprobadoLower === 'aprobado') counts.aprobado++;
      else if (arteAprobadoLower === 'rechazado') counts.rechazado++;
      else if (arteAprobadoLower === 'en revision' || arteAprobadoLower === 'en revisión') counts.en_revision++;
      // 'Pendiente' o vacío = sin_revisar
      else counts.sin_revisar++;
    });

    // Seleccionar el primer tab con contenido (de izquierda a derecha)
    const tabOrder: Array<'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado'> = ['sin_revisar', 'en_revision', 'aprobado', 'rechazado'];
    for (const tab of tabOrder) {
      if (counts[tab] > 0) {
        setActiveEstadoArteTab(tab);
        break;
      }
    }

    setHasAutoSelectedEstadoArteTab(true);
  }, [hasAutoSelectedEstadoArteTab, isFetchedConArte, inventarioArteAPI]);

  // ---- Error State ----
  const [uploadArtError, setUploadArtError] = useState<string | null>(null);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  // ---- Mutations ----
  const assignArteMutation = useMutation({
    mutationFn: ({ reservaIds, archivo }: { reservaIds: number[]; archivo: string }) =>
      campanasService.assignArte(campanaId, reservaIds, archivo),
    onSuccess: () => {
      // Invalidar todos los queries de inventario para forzar recarga cuando se activen
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes'], exact: false });
      // Invalidar tareas porque limpiar arte puede eliminar/actualizar tareas
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      if (isUploadArtModalOpen) {
        setIsUploadArtModalOpen(false);
        setSelectedInventoryIds(new Set());
      }
      setUploadArtError(null);
      setSelectedInventoryIds(new Set());
    },
    onError: (error) => {
      setUploadArtError(error instanceof Error ? error.message : 'Error al asignar arte');
    },
  });

  const updateArteStatusMutation = useMutation({
    mutationFn: ({ reservaIds, status, comentario }: { reservaIds: number[]; status: 'Aprobado' | 'Rechazado' | 'Pendiente'; comentario?: string }) =>
      campanasService.updateArteStatus(campanaId, reservaIds, status, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      setSelectedInventoryIds(new Set());
    },
  });

  const updateInstaladoMutation = useMutation({
    mutationFn: ({ reservaIds, instalado }: { reservaIds: number[]; instalado: boolean }) =>
      campanasService.updateInstalado(campanaId, reservaIds, instalado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', campanaId] });
      setSelectedInventoryIds(new Set());
    },
  });

  const createTareaMutation = useMutation({
    mutationFn: (data: {
      titulo: string;
      descripcion?: string;
      tipo?: string;
      ids_reservas?: string;
      proveedores_id?: number;
      nombre_proveedores?: string;
      asignado?: string;
      id_asignado?: string;
      contenido?: string;
      catorcena_entrega?: string;
      listado_inventario?: string;
      impresiones?: Record<string, number>;
      evidencia?: string;
      num_impresiones?: number;
    }) => campanasService.createTarea(campanaId, data),
    // El manejo de éxito/error ahora está en handleCreateTask con mutateAsync
  });

  // Mutación para actualizar tarea (marcar como completada)
  const updateTareaMutation = useMutation({
    mutationFn: ({ tareaId, data }: { tareaId: number; data: Partial<TareaCampana> }) =>
      campanasService.updateTarea(campanaId, tareaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', campanaId] });
    },
  });

  // Mutación para eliminar tarea
  const deleteTareaMutation = useMutation({
    mutationFn: (tareaId: number) => campanasService.deleteTarea(campanaId, tareaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId] });
      alert('Tarea eliminada correctamente');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Error al eliminar tarea');
    },
  });

  // ========== FUNCIONES HELPER PARA FILTROS AVANZADOS ==========

  // --- Funciones para Subir Artes (versionario) ---
  const addFilterVersionario = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersVersionario(prev => [...prev, newFilter]);
  }, []);

  const updateFilterVersionario = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersVersionario(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterVersionario = useCallback((id: string) => {
    setFiltersVersionario(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersVersionario = useCallback(() => {
    setFiltersVersionario([]);
  }, []);

  const toggleGroupingVersionario = useCallback((field: GroupByField) => {
    setActiveGroupingsVersionario(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length < 3) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsVersionario = useCallback(() => {
    setActiveGroupingsVersionario([]);
  }, []);

  // --- Funciones para Revisar y Aprobar (atender) ---
  const addFilterAtender = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersAtender(prev => [...prev, newFilter]);
  }, []);

  const updateFilterAtender = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersAtender(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterAtender = useCallback((id: string) => {
    setFiltersAtender(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersAtender = useCallback(() => {
    setFiltersAtender([]);
  }, []);

  const toggleGroupingAtender = useCallback((field: GroupByField) => {
    setActiveGroupingsAtender(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length < 3) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsAtender = useCallback(() => {
    setActiveGroupingsAtender([]);
  }, []);

  // --- Funciones para Programación (programacion) ---
  const addFilterProgramacion = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersProgramacion(prev => [...prev, newFilter]);
  }, []);

  const updateFilterProgramacion = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersProgramacion(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFilterProgramacion = useCallback((id: string) => {
    setFiltersProgramacion(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAllFiltersProgramacion = useCallback(() => {
    setFiltersProgramacion([]);
  }, []);

  const toggleGroupingProgramacion = useCallback((field: GroupByField) => {
    setActiveGroupingsProgramacion(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length < 3) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsProgramacion = useCallback(() => {
    setActiveGroupingsProgramacion([]);
  }, []);

  // --- Funciones para Validar Instalación (testigo) ---
  const addFilterTestigo = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_INVENTARIO[0].field,
      operator: '=',
      value: '',
    };
    setFiltersTestigo(prev => [...prev, newFilter]);
  }, []);

  const updateFilterTestigo = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersTestigo(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterTestigo = useCallback((id: string) => {
    setFiltersTestigo(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersTestigo = useCallback(() => {
    setFiltersTestigo([]);
  }, []);

  const toggleGroupingTestigo = useCallback((field: GroupByField) => {
    setActiveGroupingsTestigo(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length < 3) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsTestigo = useCallback(() => {
    setActiveGroupingsTestigo([]);
  }, []);

  // --- Funciones para Tareas de Producción ---
  const addFilterTareas = useCallback(() => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_TAREAS[0].field,
      operator: '=',
      value: '',
    };
    setFiltersTareas(prev => [...prev, newFilter]);
  }, []);

  const updateFilterTareas = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFiltersTareas(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const removeFilterTareas = useCallback((id: string) => {
    setFiltersTareas(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiltersTareas = useCallback(() => {
    setFiltersTareas([]);
  }, []);

  const toggleGroupingTareas = useCallback((field: GroupByField) => {
    setActiveGroupingsTareas(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  }, []);

  const clearGroupingsTareas = useCallback(() => {
    setActiveGroupingsTareas([]);
  }, []);

  // Helper function to transform InventarioConArte to InventoryRow
  const transformInventarioToRow = useCallback((item: InventarioConArte, defaultArteStatus: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = 'sin_revisar', tareasActivas: number[] = []): InventoryRow => {
    // Mapear arte_aprobado a estado_arte
    let estadoArte: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = defaultArteStatus;
    const arteAprobadoLower = (item.arte_aprobado || '').toLowerCase();

    // Verificar si este item está en alguna tarea activa
    const itemRsvIds = (item.rsv_id || item.rsv_ids || item.rsvId || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    const tieneTaskActiva = tareasActivas.some(tareaRsvId => itemRsvIds.includes(tareaRsvId));

    if (arteAprobadoLower === 'aprobado') estadoArte = 'aprobado';
    else if (arteAprobadoLower === 'rechazado') estadoArte = 'rechazado';
    else if (arteAprobadoLower === 'en revision' || arteAprobadoLower === 'en revisión') estadoArte = 'en_revision';
    // Si tiene tarea activa asignada, es "en_revision"
    else if (tieneTaskActiva) estadoArte = 'en_revision';
    // 'Pendiente' o sin estado = sin_revisar (esperando que se cree una tarea)
    else if (arteAprobadoLower === 'pendiente' || arteAprobadoLower === '') estadoArte = 'sin_revisar';
    // Si no tiene ninguno de los estados anteriores, se queda con defaultArteStatus (sin_revisar)

    // Mapear tarea/estatus a estado_tarea
    let estadoTarea: 'sin_atender' | 'en_progreso' | 'atendido' = 'sin_atender';
    const statusMostrar = item.status_mostrar?.toLowerCase() || '';
    if (statusMostrar.includes('atendido') || statusMostrar.includes('completado') || item.instalado) {
      estadoTarea = 'atendido';
    } else if (statusMostrar.includes('progreso') || item.tarea) {
      estadoTarea = 'en_progreso';
    }

    return {
      id: item.id.toString(),
      rsv_id: item.rsv_id || item.rsv_ids || item.rsvId || '',
      codigo_unico: item.codigo_unico_display || item.codigo_unico || '',
      tipo_de_cara: item.tipo_de_cara_display || item.tipo_de_cara || '',
      catorcena: item.numero_catorcena || 0,
      anio: item.anio_catorcena || 0,
      aps: item.APS || null,
      grupo_id: item.grupo?.toString() || item.grupo_completo_id?.toString() || null,
      estatus: item.estatus || '',
      espacio: item.epInId || '',
      inicio_periodo: item.inicio_periodo?.split('T')[0] || '',
      fin_periodo: item.fin_periodo?.split('T')[0] || '',
      caras_totales: item.caras_totales || 0,
      tipo_medio: item.tipo_medio || '',
      mueble: item.mueble || '',
      ciudad: item.estado || '',
      plaza: item.plaza || '',
      municipio: item.municipio || '',
      nse: item.nivel_socioeconomico || '',
      ubicacion: item.ubicacion || '',
      tradicional_digital: (item.tradicional_digital === 'Tradicional' ? 'Tradicional' : 'Digital') as 'Tradicional' | 'Digital',
      ancho: item.ancho || undefined,
      alto: item.alto || undefined,
      estado_arte: estadoArte,
      estado_tarea: estadoTarea,
      testigo_status: item.instalado ? 'validado' : 'pendiente',
      archivo_arte: item.archivo || undefined,
      arte_aprobado: item.arte_aprobado || '',
      imu: item.IMU || '',
    };
  }, []);

  // Extraer IDs de reservas de tareas activas (no completadas)
  const tareasActivasRsvIds = useMemo((): number[] => {
    return tareasAPI
      .filter(t => t.estatus !== 'Atendido' && t.estatus !== 'Completado')
      .flatMap(t => (t.ids_reservas || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)));
  }, [tareasAPI]);

  // Transform inventario SIN arte para tab "Subir Artes"
  // Incluye de-duplicación por ID de inventario para evitar claves duplicadas en React
  const inventorySinArteData = useMemo((): InventoryRow[] => {
    const rows = inventarioSinArteAPI.map((item) => transformInventarioToRow(item, 'sin_revisar'));
    const seen = new Set<string>();
    return rows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [inventarioSinArteAPI, transformInventarioToRow]);

  // Transform inventario con arte para tab "Atender arte"
  // Incluye de-duplicación por ID de inventario para evitar claves duplicadas en React
  // Los items también pueden aparecer en tab Impresiones si tienen tarea de Impresión
  const inventoryArteData = useMemo((): InventoryRow[] => {
    const rows = inventarioArteAPI.map((item) => transformInventarioToRow(item, 'sin_revisar', tareasActivasRsvIds));
    const seen = new Set<string>();
    return rows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [inventarioArteAPI, transformInventarioToRow, tareasActivasRsvIds]);

  // Transform inventario para items en tareas de Programación (tab "Programación")
  // Muestra items digitales que están en tareas de tipo Programación
  type EstadoProgramacion = 'en_programacion' | 'programado';

  const inventoryProgramacionData = useMemo((): (InventoryRow & {
    tarea_id?: number;
    tarea_estatus?: string;
    tarea_titulo?: string;
    estado_programacion?: EstadoProgramacion;
    indicaciones?: string;
  })[] => {
    // Filtrar tareas de tipo Programación
    const tareasProgramacion = tareasAPI.filter(t => t.tipo === 'Programación');

    if (tareasProgramacion.length === 0) return [];

    // Crear mapa de rsv_id a info de tarea de Programación
    const rsvTareaProgramacionMap = new Map<string, {
      tareaId: number;
      estatus: string;
      titulo: string;
      evidencia: string | null;
    }>();

    tareasProgramacion.forEach(tarea => {
      const rsvIds = tarea.ids_reservas?.split(',').map(id => id.trim()) || [];
      rsvIds.forEach(rsvId => {
        if (rsvId) {
          rsvTareaProgramacionMap.set(rsvId, {
            tareaId: tarea.id,
            estatus: tarea.estatus || 'Pendiente',
            titulo: tarea.titulo || '',
            evidencia: tarea.evidencia || null,
          });
        }
      });
    });

    // Filtrar items de inventario que son digitales y están en tareas de Programación
    const resultRows: (InventoryRow & {
      tarea_id?: number;
      tarea_estatus?: string;
      tarea_titulo?: string;
      estado_programacion?: EstadoProgramacion;
      indicaciones?: string;
    })[] = [];

    inventoryArteData.forEach(item => {
      // Solo mostrar items digitales
      if (item.tradicional_digital !== 'Digital') return;

      const rsvIds = item.rsv_id?.split(',').map(id => id.trim()) || [];

      for (const rsvId of rsvIds) {
        const tareaInfo = rsvTareaProgramacionMap.get(rsvId);
        if (tareaInfo) {
          // Determinar estado de programación:
          // - 'programado' si la tarea está Completada
          // - 'en_programacion' para cualquier otro estado (Activo, Pendiente, En Progreso)
          const estadoProgramacion: EstadoProgramacion = tareaInfo.estatus === 'Completado'
            ? 'programado'
            : 'en_programacion';

          // Extraer indicaciones de evidencia
          let indicaciones = '';
          if (tareaInfo.evidencia) {
            try {
              const evidenciaParsed = JSON.parse(tareaInfo.evidencia);
              if (evidenciaParsed.indicaciones && item.archivo_arte) {
                indicaciones = evidenciaParsed.indicaciones[item.archivo_arte] || '';
              }
            } catch (e) {
              // Ignorar errores de parseo
            }
          }

          resultRows.push({
            ...item,
            tarea_id: tareaInfo.tareaId,
            tarea_estatus: tareaInfo.estatus,
            tarea_titulo: tareaInfo.titulo,
            estado_programacion: estadoProgramacion,
            indicaciones,
          });
          break; // Solo agregar una vez por item
        }
      }
    });

    // De-duplicar por ID
    const seen = new Set<string>();
    return resultRows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [inventoryArteData, tareasAPI]);

  // Transform inventario para testigos (tab "Validar Instalación")
  // Incluye de-duplicación por ID de inventario para evitar claves duplicadas en React
  // NOTA: Usamos grupo_id de inventoryArteData para mantener consistencia con "Revisar y aprobar"
  const inventoryTestigosData = useMemo((): (InventoryRow & {
    tarea_instalacion_id?: number;
    tarea_instalacion_titulo?: string;
    tarea_instalacion_estatus?: string;
  })[] => {
    // Crear mapa de grupo_id desde inventoryArteData
    const arteGrupoMap = new Map<string, string>();
    inventoryArteData.forEach(item => {
      if (item.grupo_id) {
        arteGrupoMap.set(item.id, item.grupo_id);
      }
    });

    const rows = inventarioTestigosAPI.map((item) => {
      const row = transformInventarioToRow(item, 'aprobado');
      // Buscar grupo_id desde inventoryArteData para mantener consistencia
      const grupoFromArte = arteGrupoMap.get(row.id);
      if (grupoFromArte) {
        row.grupo_id = grupoFromArte;
      }
      // Preservar campos de la tarea de instalación del backend
      return {
        ...row,
        tarea_instalacion_id: (item as any).tarea_instalacion_id,
        tarea_instalacion_titulo: (item as any).tarea_instalacion_titulo,
        tarea_instalacion_estatus: (item as any).tarea_instalacion_estatus,
      };
    });
    const seen = new Set<string>();
    return rows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [inventarioTestigosAPI, transformInventarioToRow, inventoryArteData]);

  // Transform inventario para items en tareas de Impresión (tab "Impresiones")
  // Agrupa items por tarea de impresión con info de estado del flujo
  type EstadoImpresion = 'en_impresion' | 'pendiente_recepcion' | 'recibido';

  const inventoryImpresionesData = useMemo((): (InventoryRow & {
    tarea_id?: number;
    tarea_estatus?: string;
    tarea_titulo?: string;
    proveedor?: string;
    estado_impresion?: EstadoImpresion;
    tarea_recepcion_id?: number;
  })[] => {
    // Filtrar tareas de tipo Impresión y Recepción
    const tareasImpresion = tareasAPI.filter(t => t.tipo === 'Impresión');
    const tareasRecepcion = tareasAPI.filter(t => t.tipo === 'Recepción');

    if (tareasImpresion.length === 0) return [];

    // Crear mapas de conversión entre inventory_id y rsv_id
    const inventoryIdToRsvId = new Map<string, string>();
    const rsvIdToInventoryId = new Map<string, string>();
    inventarioArteAPI.forEach(item => {
      const invId = String(item.id);
      const rsvId = item.rsvId || item.rsv_id || item.rsv_ids || '';
      if (invId && rsvId) {
        inventoryIdToRsvId.set(invId, rsvId);
        rsvIdToInventoryId.set(rsvId, invId);
      }
    });

    // Función para normalizar IDs a un Set de inventory_ids
    const normalizeToInventoryIds = (listado: string): Set<string> => {
      const ids = listado.replace(/\*/g, ',').split(',').map(id => id.trim()).filter(Boolean);
      const normalizedIds = new Set<string>();
      ids.forEach(id => {
        // Si es un rsv_id, convertir a inventory_id
        const inventoryId = rsvIdToInventoryId.get(id);
        if (inventoryId) {
          normalizedIds.add(inventoryId);
        } else {
          // Asumir que ya es un inventory_id
          normalizedIds.add(id);
        }
      });
      return normalizedIds;
    };

    // Crear mapa de tarea de impresión -> tareas de recepción relacionadas (puede haber varias: normal + faltantes)
    const impresionToRecepcionesMap = new Map<number, typeof tareasRecepcion>();
    tareasRecepcion.forEach(recepcion => {
      const listadoRecepcion = recepcion.listado_inventario || recepcion.ids_reservas || '';
      const recepcionIds = normalizeToInventoryIds(listadoRecepcion);

      tareasImpresion.forEach(impresion => {
        const listadoImpresion = impresion.listado_inventario || impresion.ids_reservas || '';
        const impresionIds = normalizeToInventoryIds(listadoImpresion);

        // Comparar sets: deben tener al menos un elemento en común
        const hasCommon = [...impresionIds].some(id => recepcionIds.has(id));
        if (hasCommon && recepcionIds.size > 0 && impresionIds.size > 0) {
          const existing = impresionToRecepcionesMap.get(impresion.id) || [];
          existing.push(recepcion);
          impresionToRecepcionesMap.set(impresion.id, existing);
        }
      });
    });

    // Crear mapa de ID de reserva -> info de tarea
    const reservaToTareaMap = new Map<string, {
      tarea_id: number;
      tarea_estatus: string;
      tarea_titulo: string;
      proveedor: string;
      estado_impresion: EstadoImpresion;
      tarea_recepcion_id?: number;
    }>();

    tareasImpresion.forEach(tarea => {
      const listado = tarea.listado_inventario || tarea.ids_reservas || '';
      // Reemplazar asteriscos con comas y luego dividir (ids_reservas puede usar * como separador)
      const ids = listado.replace(/\*/g, ',').split(',').map(id => id.trim()).filter(Boolean);

      // Determinar estado del flujo de impresión
      const tareasRecepcionRelacionadas = impresionToRecepcionesMap.get(tarea.id) || [];
      let estadoImpresion: EstadoImpresion = 'en_impresion';
      let tareaRecepcionId: number | undefined;

      if (tareasRecepcionRelacionadas.length > 0) {
        // Buscar si hay alguna recepción completada (no faltantes)
        const recepcionCompletada = tareasRecepcionRelacionadas.find(recepcion => {
          const esCompletada = recepcion.estatus === 'Atendido' || recepcion.estatus === 'Completado';
          // Verificar si es tarea de faltantes
          let esFaltantes = false;
          if (recepcion.evidencia) {
            try {
              const evidenciaObj = JSON.parse(recepcion.evidencia);
              esFaltantes = evidenciaObj.tipo === 'recepcion_faltantes';
            } catch (e) {}
          }
          return esCompletada && !esFaltantes;
        });

        if (recepcionCompletada) {
          estadoImpresion = 'recibido';
          tareaRecepcionId = recepcionCompletada.id;
        } else {
          // Hay recepciones pero ninguna completada normal
          estadoImpresion = 'pendiente_recepcion';
          tareaRecepcionId = tareasRecepcionRelacionadas[0]?.id;
        }
      }

      ids.forEach(id => {
        reservaToTareaMap.set(id, {
          tarea_id: tarea.id,
          tarea_estatus: tarea.estatus || 'Pendiente',
          tarea_titulo: tarea.titulo || `Impresión #${tarea.id}`,
          proveedor: tarea.nombre_proveedores || '-',
          estado_impresion: estadoImpresion,
          tarea_recepcion_id: tareaRecepcionId,
        });
      });
    });

    // Filtrar items del inventario que están en tareas de impresión
    const rows: (InventoryRow & {
      tarea_id?: number;
      tarea_estatus?: string;
      tarea_titulo?: string;
      proveedor?: string;
      estado_impresion?: EstadoImpresion;
      tarea_recepcion_id?: number;
    })[] = [];

    inventarioArteAPI.forEach(item => {
      // Buscar por ID del inventario (la tarea guarda el ID del inventario, no el rsv_id)
      const itemId = String(item.id);
      const tareaInfo = reservaToTareaMap.get(itemId);

      if (tareaInfo) {
        const row = transformInventarioToRow(item, 'aprobado');
        rows.push({
          ...row,
          tarea_id: tareaInfo.tarea_id,
          tarea_estatus: tareaInfo.tarea_estatus,
          tarea_titulo: tareaInfo.tarea_titulo,
          proveedor: tareaInfo.proveedor,
          estado_impresion: tareaInfo.estado_impresion,
          tarea_recepcion_id: tareaInfo.tarea_recepcion_id,
        });
      }
    });

    // De-duplicar por ID
    const seen = new Set<string>();
    return rows.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [tareasAPI, inventarioArteAPI, transformInventarioToRow]);

  // Mapa de rsv_id -> estado de impresión (para mostrar en tab Aprobado)
  const impresionStatusMap = useMemo(() => {
    const map = new Map<string, { estado: 'en_impresion' | 'pendiente_recepcion' | 'recibido'; titulo: string }>();

    const tareasImpresion = tareasAPI.filter(t => t.tipo === 'Impresión');
    const tareasRecepcion = tareasAPI.filter(t => t.tipo === 'Recepción');

    if (tareasImpresion.length === 0) return map;

    // Crear mapa de tarea impresión -> tareas de recepción (puede haber varias: normal + faltantes)
    const impresionToRecepciones = new Map<number, typeof tareasRecepcion>();
    tareasRecepcion.forEach(recepcion => {
      const recepcionIds = new Set((recepcion.ids_reservas || '').split(',').map(id => id.trim()).filter(Boolean));
      tareasImpresion.forEach(impresion => {
        const impresionIds = new Set((impresion.ids_reservas || '').split(',').map(id => id.trim()).filter(Boolean));
        const hasCommon = [...impresionIds].some(id => recepcionIds.has(id));
        if (hasCommon) {
          const existing = impresionToRecepciones.get(impresion.id) || [];
          existing.push(recepcion);
          impresionToRecepciones.set(impresion.id, existing);
        }
      });
    });

    // Procesar cada tarea de impresión
    tareasImpresion.forEach(tarea => {
      const ids = (tarea.ids_reservas || '').split(',').map(id => id.trim()).filter(Boolean);
      const tareasRecepcionRelacionadas = impresionToRecepciones.get(tarea.id) || [];

      let estado: 'en_impresion' | 'pendiente_recepcion' | 'recibido' = 'en_impresion';

      if (tareasRecepcionRelacionadas.length > 0) {
        // Si hay ALGUNA recepción completada (no faltantes), el estado es 'recibido'
        const hayRecepcionCompletada = tareasRecepcionRelacionadas.some(recepcion => {
          const esCompletada = recepcion.estatus === 'Atendido' || recepcion.estatus === 'Completado';
          // Verificar si es tarea de faltantes
          let esFaltantes = false;
          if (recepcion.evidencia) {
            try {
              const evidenciaObj = JSON.parse(recepcion.evidencia);
              esFaltantes = evidenciaObj.tipo === 'recepcion_faltantes';
            } catch (e) {}
          }
          return esCompletada && !esFaltantes;
        });

        if (hayRecepcionCompletada) {
          estado = 'recibido';
        } else {
          // Hay recepciones pero ninguna completada (o solo faltantes)
          estado = 'pendiente_recepcion';
        }
      }

      ids.forEach(id => {
        map.set(id, { estado, titulo: tarea.titulo || `Impresión #${tarea.id}` });
      });
    });

    return map;
  }, [tareasAPI]);

  // Mapa de rsv_id -> estado de instalación (para mostrar en tab Aprobado)
  const instalacionStatusMap = useMemo(() => {
    const map = new Map<string, { estado: 'en_proceso' | 'validar_instalacion' | 'instalado'; titulo: string; tareaId: number }>();

    const tareasInstalacion = tareasAPI.filter(t => t.tipo === 'Instalación');

    if (tareasInstalacion.length === 0) return map;

    tareasInstalacion.forEach(tarea => {
      const ids = (tarea.ids_reservas || '').split(',').map(id => id.trim()).filter(Boolean);

      // Determinar estado basado en el estatus de la tarea
      // Pendiente/Activo = en_proceso
      // Atendido = validar_instalacion (marcó como instalado, pendiente de validación)
      // Completado = instalado (validado)
      let estado: 'en_proceso' | 'validar_instalacion' | 'instalado' = 'en_proceso';
      if (tarea.estatus === 'Atendido') {
        estado = 'validar_instalacion';
      } else if (tarea.estatus === 'Completado') {
        estado = 'instalado';
      }

      ids.forEach(id => {
        map.set(id, { estado, titulo: tarea.titulo || `Instalación #${tarea.id}`, tareaId: tarea.id });
      });
    });

    return map;
  }, [tareasAPI]);

  // Conteo de elementos por formato (Tradicional/Digital) para la tab activa
  const formatCounts = useMemo(() => {
    let data: InventoryRow[];
    if (activeMainTab === 'versionario') {
      data = inventorySinArteData;
    } else if (activeMainTab === 'atender') {
      data = inventoryArteData;
    } else if (activeMainTab === 'impresiones') {
      data = inventoryImpresionesData;
    } else if (activeMainTab === 'programacion') {
      // Programación solo tiene items digitales
      data = inventoryProgramacionData;
    } else {
      data = inventoryTestigosData;
    }

    const tradicional = data.filter(item => item.tradicional_digital === 'Tradicional').length;
    const digital = data.filter(item => item.tradicional_digital === 'Digital').length;

    return { tradicional, digital };
  }, [activeMainTab, inventorySinArteData, inventoryArteData, inventoryImpresionesData, inventoryProgramacionData, inventoryTestigosData]);

  // Auto-switch format tab when current is empty
  useEffect(() => {
    const currentCount = activeFormat === 'tradicional' ? formatCounts.tradicional : formatCounts.digital;
    if (currentCount === 0) {
      if (activeFormat === 'tradicional' && formatCounts.digital > 0) {
        setActiveFormat('digital');
      } else if (activeFormat === 'digital' && formatCounts.tradicional > 0) {
        setActiveFormat('tradicional');
      }
    }
  }, [formatCounts, activeFormat]);

  // ========== DATOS FILTRADOS Y ORDENADOS ==========

  // Datos filtrados y ordenados para Subir Artes (versionario)
  const filteredVersionarioData = useMemo(() => {
    let data = applyFilters(inventorySinArteData, filtersVersionario);
    
    // Aplicar ordenamiento
    if (sortFieldVersionario) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldVersionario as keyof InventoryRow];
        const bVal = b[sortFieldVersionario as keyof InventoryRow];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        return sortDirectionVersionario === 'asc' ? comparison : -comparison;
      });
    }
    return data;
  }, [inventorySinArteData, filtersVersionario, sortFieldVersionario, sortDirectionVersionario]);

  // Datos filtrados y ordenados para Revisar y Aprobar (atender)
  const filteredAtenderData = useMemo(() => {
    let data = applyFilters(inventoryArteData, filtersAtender);

    // Filtrar por estado_arte según el tab activo (solo si no hay búsqueda)
    if (!inventorySearch) {
      data = data.filter(item => item.estado_arte === activeEstadoArteTab);
    }

    if (sortFieldAtender) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldAtender as keyof InventoryRow];
        const bVal = b[sortFieldAtender as keyof InventoryRow];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        return sortDirectionAtender === 'asc' ? comparison : -comparison;
      });
    }
    return data;
  }, [inventoryArteData, filtersAtender, sortFieldAtender, sortDirectionAtender, activeEstadoArteTab, inventorySearch]);

  // Datos filtrados y ordenados para Programación (programacion)
  const filteredProgramacionData = useMemo(() => {
    // Filtrar por estado según el sub-tab activo
    let data = inventoryProgramacionData.filter(item => {
      return item.estado_programacion === activeEstadoProgramacionTab;
    });

    // Aplicar filtros adicionales
    data = applyFilters(data, filtersProgramacion);

    // Aplicar ordenamiento
    if (sortFieldProgramacion) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldProgramacion as keyof InventoryRow];
        const bVal = b[sortFieldProgramacion as keyof InventoryRow];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        return sortDirectionProgramacion === 'asc' ? comparison : -comparison;
      });
    }
    return data;
  }, [inventoryProgramacionData, filtersProgramacion, sortFieldProgramacion, sortDirectionProgramacion, activeEstadoProgramacionTab]);

  // Datos filtrados y ordenados para Validar Instalación (testigo)
  // Filtra según el sub-tab activo de estado de instalación
  const filteredTestigoData = useMemo(() => {
    // Filtrar según el tab activo de estado de instalación
    let data = inventoryTestigosData.filter(item => {
      // Usar el estado de la tarea de instalación del backend
      const tareaEstatus = item.tarea_instalacion_estatus;

      if (activeEstadoInstalacionTab === 'por_instalar') {
        // Tareas pendientes o activas (aún no instaladas)
        return tareaEstatus === 'Pendiente' || tareaEstatus === 'Activo' || tareaEstatus === 'En proceso';
      } else if (activeEstadoInstalacionTab === 'instaladas') {
        // Tareas atendidas o completadas (ya instaladas)
        return tareaEstatus === 'Atendido' || tareaEstatus === 'Completado';
      } else if (activeEstadoInstalacionTab === 'testigo') {
        // Items instalados que necesitan o tienen testigo
        // Mostrar items con tarea completada para subir/ver testigos
        return tareaEstatus === 'Atendido' || tareaEstatus === 'Completado';
      }
      return true;
    });

    // Aplicar filtros adicionales
    data = applyFilters(data, filtersTestigo);

    if (sortFieldTestigo) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldTestigo as keyof InventoryRow];
        const bVal = b[sortFieldTestigo as keyof InventoryRow];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        return sortDirectionTestigo === 'asc' ? comparison : -comparison;
      });
    }
    return data;
  }, [inventoryTestigosData, filtersTestigo, sortFieldTestigo, sortDirectionTestigo, activeEstadoInstalacionTab]);

  // Datos para sub-tab Testigo: agrupados por asignado de tareas tipo Testigo
  type TestigoGroupedData = {
    asignado: string;
    tareaId: number;
    tareaTitulo: string;
    tareaEstatus: string;
    tareaFechaFin: string;
    items: (typeof inventoryTestigosData)[number][];
  };

  const testigoGroupedByAsignado = useMemo((): TestigoGroupedData[] => {
    // Filtrar tareas de tipo Testigo
    const tareasTestigo = tareasAPI.filter(t => t.tipo === 'Testigo');

    if (tareasTestigo.length === 0) return [];

    // Crear mapa de rsv_id a inventory item para búsqueda rápida
    const rsvIdToInventory = new Map<string, (typeof inventoryTestigosData)[number]>();
    inventoryTestigosData.forEach(item => {
      const rsvIds = item.rsv_id.split(',').map(id => id.trim());
      rsvIds.forEach(rsvId => {
        rsvIdToInventory.set(rsvId, item);
      });
    });

    // Para cada tarea Testigo, obtener los items asociados
    const grouped: TestigoGroupedData[] = tareasTestigo.map(tarea => {
      const idsReservas = (tarea.ids_reservas || '').split(',').map(id => id.trim()).filter(Boolean);
      const items: (typeof inventoryTestigosData)[number][] = [];

      idsReservas.forEach(rsvId => {
        const item = rsvIdToInventory.get(rsvId);
        if (item && !items.find(i => i.id === item.id)) {
          items.push(item);
        }
      });

      return {
        asignado: tarea.asignado || 'Sin asignar',
        tareaId: tarea.id,
        tareaTitulo: tarea.titulo || 'Sin título',
        tareaEstatus: tarea.estatus || 'Pendiente',
        tareaFechaFin: tarea.fecha_fin?.split('T')[0] || '',
        items,
      };
    });

    return grouped;
  }, [tareasAPI, inventoryTestigosData]);

  // Conteo de items únicos en tareas Testigo (para el badge del sub-tab)
  const testigoItemsCount = useMemo(() => {
    const uniqueIds = new Set<string>();
    testigoGroupedByAsignado.forEach(group => {
      group.items.forEach(item => uniqueIds.add(item.id));
    });
    return uniqueIds.size;
  }, [testigoGroupedByAsignado]);

  // Datos filtrados para Impresiones (por estado y formato)
  const filteredImpresionesData = useMemo(() => {
    let data = inventoryImpresionesData;
    // Filtrar por estado de impresión
    data = data.filter(item => item.estado_impresion === activeEstadoImpresionTab);
    // Filtrar por formato
    data = data.filter(item =>
      activeFormat === 'tradicional'
        ? item.tradicional_digital === 'Tradicional'
        : item.tradicional_digital === 'Digital'
    );
    return data;
  }, [inventoryImpresionesData, activeFormat, activeEstadoImpresionTab]);

  // Tab de Impresiones siempre visible
  const shouldShowImpresionesTab = true;

  // Obtener valores únicos para los selectores de filtros
  const getUniqueValuesVersionario = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const unique = [...new Set(inventorySinArteData.map(item => String(item[field.field as keyof InventoryRow] || '')))].filter(v => v).sort();
      values[field.field] = unique;
    });
    return values;
  }, [inventorySinArteData]);

  const getUniqueValuesAtender = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const unique = [...new Set(inventoryArteData.map(item => String(item[field.field as keyof InventoryRow] || '')))].filter(v => v).sort();
      values[field.field] = unique;
    });
    return values;
  }, [inventoryArteData]);

  const getUniqueValuesProgramacion = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const unique = [...new Set(inventoryProgramacionData.map(item => String(item[field.field as keyof InventoryRow] || '')))].filter(v => v).sort();
      values[field.field] = unique;
    });
    return values;
  }, [inventoryProgramacionData]);

  const getUniqueValuesTestigo = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const unique = [...new Set(inventoryTestigosData.map(item => String(item[field.field as keyof InventoryRow] || '')))].filter(v => v).sort();
      values[field.field] = unique;
    });
    return values;
  }, [inventoryTestigosData]);

  // Transform tareas from API to TaskRow format (excluye "Seguimiento Campaña" que pertenece a otra pantalla)
  const tasks = useMemo((): TaskRow[] => {
    return tareasAPI
      .filter((t) => t.estatus !== 'Atendido' && t.estatus !== 'Completado' && t.tipo !== 'Seguimiento Campaña')
      .sort((a, b) => b.id - a.id) // Más recientes primero
      .map((t) => ({
        id: t.id.toString(),
        tipo: t.tipo || 'Tarea',
        estatus: t.estatus || 'Pendiente', // Mostrar el estatus real de la BD
        identificador: `TASK-${t.id.toString().padStart(3, '0')}`,
        fecha_inicio: t.fecha_inicio?.split('T')[0] || '',
        fecha_fin: t.fecha_fin?.split('T')[0] || '',
        creador: t.responsable_nombre || t.responsable || '',
        asignado: t.asignado || '',
        descripcion: t.descripcion || '',
        titulo: t.titulo || '',
        inventario_ids: t.ids_reservas ? t.ids_reservas.split(',') : [],
        campana_id: campanaId,
        nombre_proveedores: t.nombre_proveedores || undefined,
        proveedores_id: t.proveedores_id || undefined,
        num_impresiones: t.num_impresiones || undefined,
        evidencia: t.evidencia || undefined,
      }));
  }, [tareasAPI, campanaId]);

  const completedTasks = useMemo((): TaskRow[] => {
    return tareasAPI
      .filter((t) => (t.estatus === 'Atendido' || t.estatus === 'Completado') && t.tipo !== 'Seguimiento Campaña')
      .sort((a, b) => b.id - a.id) // Más recientes primero
      .map((t) => ({
        id: t.id.toString(),
        tipo: t.tipo || 'Tarea',
        estatus: t.estatus || 'Atendido',
        identificador: `TASK-${t.id.toString().padStart(3, '0')}`,
        fecha_inicio: t.fecha_inicio?.split('T')[0] || '',
        fecha_fin: t.fecha_fin?.split('T')[0] || '',
        creador: t.responsable_nombre || t.responsable || '',
        asignado: t.asignado || '',
        descripcion: t.descripcion || '',
        titulo: t.titulo || '',
        inventario_ids: t.ids_reservas ? t.ids_reservas.split(',') : [],
        campana_id: campanaId,
        nombre_proveedores: t.nombre_proveedores || undefined,
        proveedores_id: t.proveedores_id || undefined,
        num_impresiones: t.num_impresiones || undefined,
        evidencia: t.evidencia || undefined,
      }));
  }, [tareasAPI, campanaId]);

  // Obtener valores únicos para filtros de tareas
  const getUniqueValuesTareas = useMemo(() => {
    const allTasks = [...tasks, ...completedTasks];
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_TAREAS.forEach(f => {
      const uniqueSet = new Set<string>();
      allTasks.forEach(t => {
        const val = (t as unknown as Record<string, unknown>)[f.field];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          uniqueSet.add(String(val));
        }
      });
      values[f.field] = Array.from(uniqueSet).sort();
    });
    return values;
  }, [tasks, completedTasks]);

  // ---- Computed ----
  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    let data: InventoryRow[];
    if (activeMainTab === 'versionario') {
      data = inventorySinArteData;
    } else if (activeMainTab === 'atender') {
      data = inventoryArteData;
    } else if (activeMainTab === 'programacion') {
      data = inventoryProgramacionData;
    } else {
      data = inventoryTestigosData;
    }

    return {
      ciudades: [...new Set(data.map(i => i.ciudad).filter(Boolean))].sort(),
      plazas: [...new Set(data.map(i => i.plaza).filter(Boolean))].sort(),
      muebles: [...new Set(data.map(i => i.mueble).filter(Boolean))].sort(),
      tiposMedio: [...new Set(data.map(i => i.tipo_medio).filter(Boolean))].sort(),
      catorcenas: [...new Set(data.map(i => i.catorcena).filter(c => c > 0))].sort((a, b) => a - b),
    };
  }, [inventorySinArteData, inventoryArteData, inventoryProgramacionData, inventoryTestigosData, activeMainTab]);

  // Check if any filter is active
  const hasActiveFilters = filters.ciudad || filters.plaza || filters.mueble || filters.tipo_medio || filters.catorcena !== null;

  const filteredInventory = useMemo(() => {
    let data: InventoryRow[];

    // Seleccionar fuente de datos filtrados según tab activo
    if (activeMainTab === 'versionario') {
      // Tab "Subir Artes": usar datos ya filtrados
      data = filteredVersionarioData;
    } else if (activeMainTab === 'atender') {
      // Tab "Revisar y Aprobar": usar datos ya filtrados
      data = filteredAtenderData;
    } else if (activeMainTab === 'programacion') {
      // Tab "Programación": usar datos ya filtrados
      data = filteredProgramacionData;
    } else {
      // Tab "Validar Instalación": usar datos ya filtrados
      data = filteredTestigoData;
    }

    // Filter by format for all tabs except Programación (which is Digital only)
    if (activeMainTab !== 'programacion') {
      const formatFilter = activeFormat === 'tradicional' ? 'Tradicional' : 'Digital';
      data = data.filter((item) => item.tradicional_digital === formatFilter);
    }

    // Filter by search
    if (inventorySearch) {
      const search = inventorySearch.toLowerCase();
      data = data.filter(
        (item) =>
          item.id.toLowerCase().includes(search) ||
          item.rsv_id.toLowerCase().includes(search) ||
          item.codigo_unico.toLowerCase().includes(search) ||
          item.plaza.toLowerCase().includes(search) ||
          item.mueble.toLowerCase().includes(search) ||
          item.ubicacion.toLowerCase().includes(search) ||
          item.ciudad.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    data = [...data].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'codigo_unico':
          aVal = a.codigo_unico || '';
          bVal = b.codigo_unico || '';
          break;
        case 'catorcena':
          aVal = a.catorcena || 0;
          bVal = b.catorcena || 0;
          break;
        case 'ciudad':
          aVal = a.ciudad || '';
          bVal = b.ciudad || '';
          break;
        case 'plaza':
          aVal = a.plaza || '';
          bVal = b.plaza || '';
          break;
        case 'mueble':
          aVal = a.mueble || '';
          bVal = b.mueble || '';
          break;
        case 'tipo_medio':
          aVal = a.tipo_medio || '';
          bVal = b.tipo_medio || '';
          break;
        case 'aps':
          aVal = a.aps || 0;
          bVal = b.aps || 0;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return data;
  }, [filteredVersionarioData, filteredAtenderData, filteredProgramacionData, filteredTestigoData, inventorySearch, activeFormat, activeMainTab, sortField, sortDirection]);

  const filteredTasks = useMemo(() => {
    // Primero aplicar filtros avanzados
    let data = applyFilters(tasks, filtersTareas);
    // Luego búsqueda por texto
    if (tasksSearch) {
      const search = tasksSearch.toLowerCase();
      data = data.filter(
        (t) =>
          t.titulo.toLowerCase().includes(search) ||
          t.identificador.toLowerCase().includes(search) ||
          t.asignado.toLowerCase().includes(search) ||
          t.tipo.toLowerCase().includes(search) ||
          t.creador.toLowerCase().includes(search)
      );
    }
    if (tasksStatusFilter) {
      data = data.filter((t) => t.estatus === tasksStatusFilter);
    }
    return data;
  }, [tasks, tasksSearch, tasksStatusFilter, filtersTareas]);

  const filteredCompletedTasks = useMemo(() => {
    // Primero aplicar filtros avanzados
    let data = applyFilters(completedTasks, filtersTareas);
    // Luego búsqueda por texto
    if (tasksSearch) {
      const search = tasksSearch.toLowerCase();
      data = data.filter(
        (t) =>
          t.titulo.toLowerCase().includes(search) ||
          t.identificador.toLowerCase().includes(search) ||
          t.tipo.toLowerCase().includes(search)
      );
    }
    return data;
  }, [completedTasks, tasksSearch, filtersTareas]);

  // Función para descargar tareas como Excel con dos hojas
  const downloadTareasExcel = useCallback(() => {
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      try {
        return new Date(dateStr).toLocaleDateString('es-MX');
      } catch {
        return dateStr;
      }
    };

    const mapTaskToRow = (task: TaskRow) => ({
      'Tipo': task.tipo || '-',
      'Estatus': task.estatus || '-',
      'Identificador': task.identificador || '-',
      'Título': task.titulo || '-',
      'Fecha Inicio': formatDate(task.fecha_inicio),
      'Fecha Fin': formatDate(task.fecha_fin),
      'Creador': task.creador || '-',
      'Asignado': task.asignado || '-',
      'Descripción': task.descripcion || '-',
    });

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Tareas Activas
    const activasData = filteredTasks.map(mapTaskToRow);
    const wsActivas = XLSX.utils.json_to_sheet(activasData.length > 0 ? activasData : [{ 'Sin datos': 'No hay tareas activas' }]);
    XLSX.utils.book_append_sheet(wb, wsActivas, 'Activas');

    // Hoja 2: Tareas Completadas
    const completadasData = filteredCompletedTasks.map(mapTaskToRow);
    const wsCompletadas = XLSX.utils.json_to_sheet(completadasData.length > 0 ? completadasData : [{ 'Sin datos': 'No hay tareas completadas' }]);
    XLSX.utils.book_append_sheet(wb, wsCompletadas, 'Completadas');

    // Descargar
    const filename = `tareas_produccion_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [filteredTasks, filteredCompletedTasks]);

  // Agrupación simple para tab "Validar Instalación" basada en activeGroupingsTestigo
  // Solo usa el primer campo de agrupación para mantener compatibilidad con el renderizado existente
  const simpleGroupedInventory = useMemo(() => {
    if (activeGroupingsTestigo.length === 0) return {} as Record<string, InventoryRow[]>;

    const groups: Record<string, InventoryRow[]> = {};
    const groupField = activeGroupingsTestigo[0];

    // Usar filteredTestigoData para la tab de testigo
    filteredTestigoData.forEach((item) => {
      const key = getGroupKeyForField(item, groupField);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [filteredTestigoData, activeGroupingsTestigo]);

  // Agrupación para tab "Subir Artes" basada en activeGroupingsVersionario
  // Estructura: Nivel1 -> Nivel2 -> Nivel3 -> Items (máximo 3 niveles de agrupación + items)
  const versionarioGroupedInventory = useMemo(() => {
    const numLevels = Math.min(activeGroupingsVersionario.length, 3);

    // Si no hay agrupaciones, devolver estructura vacía
    if (numLevels === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    // Ordenar items por ID descendente (más recientes primero) antes de agrupar
    const sortedInventory = [...filteredInventory].sort((a, b) => parseInt(b.id) - parseInt(a.id));

    sortedInventory.forEach((item) => {
      const level1Key = activeGroupingsVersionario[0] ? getGroupKeyForField(item, activeGroupingsVersionario[0]) : 'Todo';
      const level2Key = activeGroupingsVersionario[1] ? getGroupKeyForField(item, activeGroupingsVersionario[1]) : 'Items';
      const level3Key = activeGroupingsVersionario[2] ? getGroupKeyForField(item, activeGroupingsVersionario[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    // Ordenar las keys de los grupos de forma descendente
    const sortedGroups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    Object.keys(groups).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level1Key => {
      sortedGroups[level1Key] = {};
      Object.keys(groups[level1Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level2Key => {
        sortedGroups[level1Key][level2Key] = {};
        Object.keys(groups[level1Key][level2Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level3Key => {
          sortedGroups[level1Key][level2Key][level3Key] = groups[level1Key][level2Key][level3Key];
        });
      });
    });

    return sortedGroups;
  }, [filteredInventory, activeGroupingsVersionario]);

  // Agrupación para tab "Atender Arte" basada en activeGroupingsAtender
  // Estructura: Nivel1 -> Nivel2 -> Nivel3 -> Items (máximo 3 niveles de agrupación + items)
  const atenderGroupedInventory = useMemo(() => {
    const numLevels = Math.min(activeGroupingsAtender.length, 3);

    // Si no hay agrupaciones, devolver estructura vacía
    if (numLevels === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    // Ordenar items por ID descendente (más recientes primero) antes de agrupar
    const sortedInventory = [...filteredInventory].sort((a, b) => parseInt(b.id) - parseInt(a.id));

    sortedInventory.forEach((item) => {
      const level1Key = activeGroupingsAtender[0] ? getGroupKeyForField(item, activeGroupingsAtender[0]) : 'Todo';
      const level2Key = activeGroupingsAtender[1] ? getGroupKeyForField(item, activeGroupingsAtender[1]) : 'Items';
      const level3Key = activeGroupingsAtender[2] ? getGroupKeyForField(item, activeGroupingsAtender[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    // Ordenar las keys de los grupos de forma descendente
    const sortedGroups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    Object.keys(groups).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level1Key => {
      sortedGroups[level1Key] = {};
      Object.keys(groups[level1Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level2Key => {
        sortedGroups[level1Key][level2Key] = {};
        Object.keys(groups[level1Key][level2Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level3Key => {
          sortedGroups[level1Key][level2Key][level3Key] = groups[level1Key][level2Key][level3Key];
        });
      });
    });

    return sortedGroups;
  }, [filteredInventory, activeGroupingsAtender]);

  // Agrupación para tab "Programación" basada en activeGroupingsProgramacion
  const programacionGroupedInventory = useMemo(() => {
    const numLevels = Math.min(activeGroupingsProgramacion.length, 3);

    // Si no hay agrupaciones, devolver estructura vacía
    if (numLevels === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    // Ordenar items por ID descendente (más recientes primero) antes de agrupar
    const sortedInventory = [...filteredProgramacionData].sort((a, b) => parseInt(b.id) - parseInt(a.id));

    sortedInventory.forEach((item) => {
      const level1Key = activeGroupingsProgramacion[0] ? getGroupKeyForField(item, activeGroupingsProgramacion[0]) : 'Todo';
      const level2Key = activeGroupingsProgramacion[1] ? getGroupKeyForField(item, activeGroupingsProgramacion[1]) : 'Items';
      const level3Key = activeGroupingsProgramacion[2] ? getGroupKeyForField(item, activeGroupingsProgramacion[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    // Ordenar las keys de los grupos de forma descendente
    const sortedGroups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    Object.keys(groups).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level1Key => {
      sortedGroups[level1Key] = {};
      Object.keys(groups[level1Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level2Key => {
        sortedGroups[level1Key][level2Key] = {};
        Object.keys(groups[level1Key][level2Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level3Key => {
          sortedGroups[level1Key][level2Key][level3Key] = groups[level1Key][level2Key][level3Key];
        });
      });
    });

    return sortedGroups;
  }, [filteredProgramacionData, activeGroupingsProgramacion]);

  // Agrupación para tab "Validar Instalación" basada en activeGroupingsTestigo
  const testigoGroupedInventory = useMemo(() => {
    const numLevels = Math.min(activeGroupingsTestigo.length, 3);

    // Si no hay agrupaciones, devolver estructura vacía
    if (numLevels === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    // Ordenar items por ID descendente antes de agrupar
    const sortedInventory = [...filteredTestigoData].sort((a, b) => parseInt(b.id) - parseInt(a.id));

    sortedInventory.forEach((item) => {
      const level1Key = activeGroupingsTestigo[0] ? getGroupKeyForField(item, activeGroupingsTestigo[0]) : 'Todo';
      const level2Key = activeGroupingsTestigo[1] ? getGroupKeyForField(item, activeGroupingsTestigo[1]) : 'Items';
      const level3Key = activeGroupingsTestigo[2] ? getGroupKeyForField(item, activeGroupingsTestigo[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    // Ordenar las keys de los grupos
    const sortedGroups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};
    Object.keys(groups).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level1Key => {
      sortedGroups[level1Key] = {};
      Object.keys(groups[level1Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level2Key => {
        sortedGroups[level1Key][level2Key] = {};
        Object.keys(groups[level1Key][level2Key]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).forEach(level3Key => {
          sortedGroups[level1Key][level2Key][level3Key] = groups[level1Key][level2Key][level3Key];
        });
      });
    });

    return sortedGroups;
  }, [filteredTestigoData, activeGroupingsTestigo]);

  // Get selected inventory items for modals
  const selectedInventoryItems = useMemo(() => {
    return filteredInventory.filter((item) => selectedInventoryIds.has(item.id));
  }, [filteredInventory, selectedInventoryIds]);

  // Compute summary stats
  const summaryStats = useMemo((): SummaryStats => {
    // Seleccionar fuente de datos según tab activo
    let allItems: InventoryRow[];
    if (activeMainTab === 'versionario') {
      allItems = inventorySinArteData;
    } else if (activeMainTab === 'atender') {
      allItems = inventoryArteData;
    } else if (activeMainTab === 'programacion') {
      allItems = inventoryProgramacionData;
    } else {
      allItems = inventoryTestigosData;
    }

    return {
      totalInventario: allItems.length,
      sinArte: activeMainTab === 'versionario' ? allItems.filter(i => !i.archivo_arte).length : allItems.filter(i => i.estado_arte === 'sin_revisar' || i.estado_arte === 'en_revision').length,
      enRevision: allItems.filter(i => i.estado_arte === 'en_revision').length,
      aprobados: allItems.filter(i => i.estado_arte === 'aprobado').length,
      rechazados: allItems.filter(i => i.estado_arte === 'rechazado').length,
      tareasActivas: tasks.filter(t => t.estatus?.toLowerCase() === 'pendiente' || t.estatus?.toLowerCase() === 'en_progreso' || t.estatus?.toLowerCase() === 'en progreso').length,
      tareasCompletadas: completedTasks.length,
    };
  }, [inventorySinArteData, inventoryArteData, inventoryProgramacionData, inventoryTestigosData, activeMainTab, tasks, completedTasks]);

  // ---- Handlers ----
  const toggleInventorySelection = useCallback((id: string) => {
    setSelectedInventoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllInventory = useCallback(() => {
    if (selectedInventoryIds.size === filteredInventory.length) {
      setSelectedInventoryIds(new Set());
    } else {
      setSelectedInventoryIds(new Set(filteredInventory.map((i) => i.id)));
    }
  }, [filteredInventory, selectedInventoryIds.size]);

  const toggleNode = useCallback((nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  }, []);

  // Calcular el tipo de tarea inicial y los tipos disponibles basado en el estado de los inventarios
  const calculateTaskTiposConfig = useCallback(() => {
    // Si estamos en la tab de testigo, solo mostrar tipo Testigo
    if (activeMainTab === 'testigo') {
      return { initialTipo: 'Testigo', availableTipos: ['Testigo'] };
    }

    if (selectedInventoryItems.length === 0) {
      return { initialTipo: '', availableTipos: ['Instalación', 'Revisión de artes', 'Impresión'] };
    }

    // Verificar si algún item tiene IMU habilitado (checkbox marcado en solicitud)
    const hasIMU = selectedInventoryItems.some(item => item.imu === 1 || item.imu === '1');

    // Verificar si algún item ya pasó por impresión (estado recibido)
    const hasRecibido = selectedInventoryItems.some(item => (item as any).estado_impresion === 'recibido');

    // Contar estados
    const counts = {
      sinRevisar: 0,
      enRevision: 0,
      aprobado: 0,
      rechazado: 0,
    };

    selectedInventoryItems.forEach(item => {
      switch (item.estado_arte) {
        case 'sin_revisar':
          counts.sinRevisar++;
          break;
        case 'en_revision':
          counts.enRevision++;
          break;
        case 'aprobado':
          counts.aprobado++;
          break;
        case 'rechazado':
          counts.rechazado++;
          break;
      }
    });

    const total = selectedInventoryItems.length;
    const allAprobado = counts.aprobado === total;
    const allPendiente = (counts.sinRevisar + counts.enRevision + counts.rechazado) === total;

    // Verificar si todos los items seleccionados son digitales
    const allDigital = selectedInventoryItems.every(item => item.tradicional_digital === 'Digital');

    // Determinar tipos disponibles según el estado de los inventarios
    let availableTipos: string[] = [];
    let initialTipo = '';

    if (allAprobado) {
      if (allDigital) {
        // Para digitales aprobados: solo mostrar Programación
        availableTipos = ['Programación'];
        initialTipo = 'Programación';
      } else if (hasIMU && !hasRecibido) {
        // Tradicionales con IMU: mostrar Impresión e Instalación
        availableTipos = ['Impresión', 'Instalación'];
        initialTipo = 'Impresión';
      } else {
        // Tradicionales sin IMU: solo Instalación
        availableTipos = ['Instalación'];
        initialTipo = 'Instalación';
      }
    } else if (allPendiente) {
      // Todos pendientes de revisión: solo mostrar Revisión de artes
      availableTipos = ['Revisión de artes'];
      initialTipo = 'Revisión de artes';
    } else {
      // Mezcla: mostrar tipos según IMU y tipo de inventario (pero excluir Impresión si ya fue recibido)
      if (allDigital) {
        availableTipos = ['Programación', 'Revisión de artes'];
        initialTipo = counts.aprobado > counts.sinRevisar + counts.enRevision ? 'Programación' : 'Revisión de artes';
      } else if (hasIMU && !hasRecibido) {
        availableTipos = ['Instalación', 'Revisión de artes', 'Impresión'];
        initialTipo = counts.aprobado > counts.sinRevisar + counts.enRevision ? 'Impresión' : 'Revisión de artes';
      } else {
        availableTipos = ['Instalación', 'Revisión de artes'];
        initialTipo = counts.aprobado > counts.sinRevisar + counts.enRevision ? 'Instalación' : 'Revisión de artes';
      }
    }

    return { initialTipo, availableTipos };
  }, [selectedInventoryItems, activeMainTab]);

  // Verificar si alguno de los items seleccionados tiene relación con instalación
  const hasSelectedItemsWithInstalacion = useMemo(() => {
    if (selectedInventoryItems.length === 0) return false;

    return selectedInventoryItems.some(item => {
      const rsvIds = item.rsv_id?.split(',').map(id => id.trim()) || [];
      return rsvIds.some(id => instalacionStatusMap.has(id));
    });
  }, [selectedInventoryItems, instalacionStatusMap]);

  // Verificar si las reservas seleccionadas ya tienen tareas activas antes de crear una nueva
  const handleCreateTaskClick = useCallback(async () => {
    if (selectedInventoryIds.size === 0) return;

    // Calcular el tipo inicial y tipos disponibles basado en estados de inventarios
    const { initialTipo, availableTipos } = calculateTaskTiposConfig();
    setInitialTaskTipo(initialTipo);
    setAvailableTaskTipos(availableTipos);

    setIsCheckingExistingTasks(true);
    try {
      // Obtener los rsv_ids de los items seleccionados (no los IDs de inventario)
      const reservaIds = selectedInventoryItems.flatMap(item =>
        item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      );
      const result = await campanasService.checkReservasTareas(campanaId, reservaIds);

      if (result.hasTareas && result.tareas.length > 0) {
        // Hay tareas existentes, mostrar modal de advertencia
        setExistingTasksForCreate(result.tareas);
        setIsTaskWarningModalOpen(true);
      } else {
        // No hay tareas existentes, abrir modal de creación directamente
        setIsCreateModalOpen(true);
      }
    } catch (error) {
      console.error('Error al verificar tareas:', error);
      // Si hay error, abrir el modal de creación de todas formas
      setIsCreateModalOpen(true);
    } finally {
      setIsCheckingExistingTasks(false);
    }
  }, [selectedInventoryIds, selectedInventoryItems, campanaId, calculateTaskTiposConfig]);

  const handleCreateTask = useCallback(async (task: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string; impresiones?: Record<string, number> }) => {
    // Get reserva IDs from selected inventory items
    const reservaIds = selectedInventoryItems.flatMap(item =>
      item.rsv_id.split(',').map(id => id.trim()).filter(id => id)
    );

    try {
      await createTareaMutation.mutateAsync({
        titulo: task.titulo || 'Nueva tarea',
        descripcion: task.descripcion,
        tipo: task.tipo || 'Produccion',
        ids_reservas: reservaIds.join(','),
        proveedores_id: task.proveedores_id,
        nombre_proveedores: task.nombre_proveedores,
        // Campos para Revisión de artes e Impresión
        asignado: (task as any).asignado,
        id_asignado: (task as any).id_asignado,
        contenido: (task as any).contenido,
        catorcena_entrega: (task as any).catorcena_entrega,
        listado_inventario: (task as any).listado_inventario,
        // Campos para Impresión
        impresiones: task.impresiones,
        num_impresiones: (task as any).num_impresiones,
        // Campos para Programación (indicaciones guardadas como JSON)
        evidencia: (task as any).evidencia,
      });
      // Éxito - cerrar modal y actualizar
      setIsCreateModalOpen(false);
      setSelectedInventoryIds(new Set());
      setCreateTaskError(null);
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId] });
    } catch (error) {
      console.error('Error al crear tarea:', error);
      setCreateTaskError(error instanceof Error ? error.message : 'Error al crear tarea');
    }
  }, [selectedInventoryItems, createTareaMutation, campanaId, queryClient]);

  const handleUploadArt = useCallback(async (data: { option: UploadOption; value: string | File; inventoryIds: string[] }) => {
    // Get reserva IDs from selected inventory items
    const reservaIds = selectedInventoryItems.flatMap(item =>
      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );

    if (reservaIds.length === 0) {
      setUploadArtError('No se encontraron reservas para actualizar');
      return;
    }

    // Determine the file URL
    let archivo = '';

    try {
      if (data.option === 'link' && typeof data.value === 'string') {
        // Extraer nombre del link y verificar si existe
        const nombreArchivo = data.value.split('/').pop()?.split('?')[0] || '';
        if (nombreArchivo) {
          const verificacion = await campanasService.verificarArteExistente(campanaId, { nombre: nombreArchivo });
          if (verificacion.existe) {
            setUploadArtError(`Ya existe un archivo con el nombre "${verificacion.nombre}" (usado ${verificacion.usos} veces). Cambia el nombre del archivo o usa "Escoger existente" para reutilizarlo.`);
            return;
          }
        }
        archivo = data.value;
      } else if (data.option === 'existing' && typeof data.value === 'string') {
        // For existing art, the value is already the URL - no need to verify
        archivo = data.value;
      } else if (data.option === 'file' && data.value instanceof File) {
        // Verificar si ya existe un archivo con el mismo nombre ANTES de subir
        const verificacion = await campanasService.verificarArteExistente(campanaId, { nombre: data.value.name });
        if (verificacion.existe) {
          setUploadArtError(`Ya existe un archivo con el nombre "${verificacion.nombre}" (usado ${verificacion.usos} veces). Cambia el nombre del archivo o usa "Escoger existente" para reutilizarlo.`);
          return;
        }

        // Convertir archivo a base64 (como en solicitudes)
        setUploadArtError(null);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo'));
          reader.readAsDataURL(data.value as File);
        });
        archivo = base64;
      }

      if (archivo) {
        assignArteMutation.mutate({ reservaIds, archivo });
      } else {
        setUploadArtError('No se especifico un archivo de arte');
      }
    } catch (error) {
      setUploadArtError(error instanceof Error ? error.message : 'Error al subir el archivo');
    }
  }, [selectedInventoryItems, assignArteMutation, campanaId]);

  // Handler para subir archivos digitales (múltiples)
  const handleUploadDigitalArt = useCallback(async (data: { files: { file: File; spot: number }[]; inventoryIds: string[] }) => {
    // Get reserva IDs from selected inventory items
    const reservaIds = selectedInventoryItems.flatMap(item =>
      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );

    if (reservaIds.length === 0) {
      setUploadArtError('No se encontraron reservas para actualizar');
      return;
    }

    if (data.files.length === 0) {
      setUploadArtError('No se seleccionaron archivos');
      return;
    }

    try {
      setUploadArtError(null);

      // Convertir todos los archivos a base64 con su spot
      const filesWithBase64 = await Promise.all(
        data.files.map(async ({ file, spot }) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error(`Error al leer el archivo ${file.name}`));
            reader.readAsDataURL(file);
          });
          return {
            archivo: base64,
            spot,
            nombre: file.name,
            tipo: file.type.startsWith('video/') ? 'video' : 'image',
          };
        })
      );

      // Llamar al servicio para asignar arte digital
      await campanasService.assignArteDigital(campanaId, reservaIds, filesWithBase64);

      // Invalidar queries y cerrar modal
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['digital-file-summaries', campanaId] });

      setIsUploadArtModalOpen(false);
      setSelectedInventoryIds(new Set());
      setUploadArtError(null);
    } catch (error) {
      console.error('Error al subir archivos digitales:', error);
      setUploadArtError(error instanceof Error ? error.message : 'Error al subir los archivos digitales');
    }
  }, [selectedInventoryItems, campanaId, queryClient]);

  // Handler para abrir la galería de imágenes digitales
  const openDigitalGallery = useCallback(async (reservaIds: number | number[], codigoUnico: string) => {
    setIsLoadingDigitalGallery(true);
    setDigitalGalleryTitle(`Galería Digital - ${codigoUnico}`);
    setIsDigitalGalleryOpen(true);

    try {
      // Soportar tanto un solo ID como un array de IDs
      const idsParam = Array.isArray(reservaIds) ? reservaIds.join(',') : reservaIds;
      const imagenes = await campanasService.getImagenesDigitales(campanaId, idsParam);
      setDigitalGalleryImages(imagenes.map(img => ({
        id: img.id,
        archivo: img.archivo,
        archivoData: img.archivoData, // Base64 data URL
        spot: img.spot,
        tipo: img.tipo,
        estado: img.estado,
      })));
    } catch (error) {
      console.error('Error al cargar imágenes digitales:', error);
      setDigitalGalleryImages([]);
    } finally {
      setIsLoadingDigitalGallery(false);
    }
  }, [campanaId]);

  // ---- Render helpers ----
  // Render row for Versionario tab (shows inventory pending art upload)
  const renderVersionarioRow = (item: InventoryRow, showCheckbox = true) => (
    <tr
      key={item.id}
      className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
        selectedInventoryIds.has(item.id) ? 'bg-yellow-500/20' : ''
      }`}
    >
      {showCheckbox && (
        <td className="p-2 w-8">
          <button
            onClick={() => toggleInventorySelection(item.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectedInventoryIds.has(item.id)
                ? 'bg-purple-600 border-purple-600'
                : 'border-purple-500/50 hover:border-purple-400'
            }`}
          >
            {selectedInventoryIds.has(item.id) && (
              <Check className="h-3 w-3 text-white" />
            )}
          </button>
        </td>
      )}
      <td className="p-2 text-xs text-zinc-300">{item.id}</td>
      <td className="p-2">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
          item.tradicional_digital === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {item.tradicional_digital}
        </span>
      </td>
      <td className="p-2 text-xs font-medium text-white">{item.codigo_unico}</td>
      <td className="p-2 text-xs text-zinc-300 max-w-[180px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.tipo_de_cara}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2 text-xs text-zinc-300">{item.municipio}</td>
      <td className="p-2 text-xs text-zinc-300">{item.nse}</td>
      <td className="p-2 text-xs text-purple-300">{item.rsv_id}</td>
    </tr>
  );

  // Render row for Atender tab (shows art review status)
  const renderAtenderRow = (item: InventoryRow, showCheckbox = true, hideInstalado = false) => {
    // Para items digitales, obtener el resumen de archivos
    const isDigital = item.tradicional_digital === 'Digital';
    let digitalSummary: { total: number; imagenes: number; videos: number } | null = null;

    if (isDigital && item.rsv_id) {
      const rsvIds = item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      let totalArchivos = 0;
      let totalImagenes = 0;
      let totalVideos = 0;
      rsvIds.forEach(rsvId => {
        const summary = digitalSummaryMap.get(rsvId);
        if (summary) {
          totalArchivos += summary.totalArchivos;
          totalImagenes += summary.countImagenes;
          totalVideos += summary.countVideos;
        }
      });
      if (totalArchivos > 0) {
        digitalSummary = { total: totalArchivos, imagenes: totalImagenes, videos: totalVideos };
      }
    }

    // Generar texto descriptivo para archivos digitales
    const getDigitalSummaryText = () => {
      if (!digitalSummary) return '-';
      const parts: string[] = [];
      if (digitalSummary.imagenes > 0) {
        parts.push(`${digitalSummary.imagenes} ${digitalSummary.imagenes === 1 ? 'imagen' : 'imágenes'}`);
      }
      if (digitalSummary.videos > 0) {
        parts.push(`${digitalSummary.videos} ${digitalSummary.videos === 1 ? 'video' : 'videos'}`);
      }
      return parts.join(', ') || '-';
    };

    return (
    <tr
      key={item.id}
      className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
        selectedInventoryIds.has(item.id) ? 'bg-yellow-500/20' : ''
      }`}
    >
      {showCheckbox && (
        <td className="p-2 w-8">
          <button
            onClick={() => toggleInventorySelection(item.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectedInventoryIds.has(item.id)
                ? 'bg-purple-600 border-purple-600'
                : 'border-purple-500/50 hover:border-purple-400'
            }`}
          >
            {selectedInventoryIds.has(item.id) && (
              <Check className="h-3 w-3 text-white" />
            )}
          </button>
        </td>
      )}
      <td className="p-2 text-xs font-medium text-white">{item.id}</td>
      <td className="p-2 text-xs text-zinc-300">{item.arte_aprobado || 'Sin revisar'}</td>
      <td className="p-2">
        {isDigital && digitalSummary ? (
          // Para digitales: mostrar contador de archivos con icono clickeable para abrir galería
          <button
            onClick={() => {
              const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
              if (rsvIds.length > 0) {
                openDigitalGallery(rsvIds, item.codigo_unico);
              }
            }}
            className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded hover:bg-blue-500/30 transition-colors"
            title="Ver galería digital"
          >
            <span className="text-blue-400 font-bold text-lg">{digitalSummary.total}</span>
          </button>
        ) : item.archivo_arte ? (
          <img
            src={getImageUrl(item.archivo_arte) || ''}
            alt="Arte"
            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80"
            onClick={() => window.open(getImageUrl(item.archivo_arte) || '', '_blank')}
          />
        ) : (
          <span className="text-zinc-500 text-xs">Sin archivo</span>
        )}
      </td>
      <td className="p-2 text-xs text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.tipo_de_cara}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2 text-xs text-zinc-300">{item.ciudad}</td>
      <td className="p-2 text-xs text-blue-400 max-w-[150px] truncate" title={isDigital && digitalSummary ? getDigitalSummaryText() : item.archivo_arte}>
        {isDigital && digitalSummary ? (
          <span className="text-blue-300">{getDigitalSummaryText()}</span>
        ) : item.archivo_arte ? (
          <a href={getImageUrl(item.archivo_arte) || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.archivo_arte.split('/').pop()}
          </a>
        ) : '-'}
      </td>
      {!hideInstalado && (
        <td className="p-2 text-center">
          {item.estado_tarea === 'atendido' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
          ) : (
            <span className="text-zinc-500">-</span>
          )}
        </td>
      )}
      <td className="p-2">
        {(() => {
          const rsvIds = item.rsv_id?.split(',').map(id => id.trim()) || [];
          const instalacionInfo = rsvIds.map(id => instalacionStatusMap.get(id)).find(info => info);
          if (!instalacionInfo) return <span className="text-zinc-500 text-xs">-</span>;
          const estadoLabels: Record<string, { label: string; color: string }> = {
            'en_proceso': { label: 'En proceso de instalación', color: 'bg-orange-500/20 text-orange-400' },
            'validar_instalacion': { label: 'Validar instalación', color: 'bg-yellow-500/20 text-yellow-400' },
            'instalado': { label: 'Instalado', color: 'bg-green-500/20 text-green-400' },
          };
          const { label, color } = estadoLabels[instalacionInfo.estado] || { label: '-', color: '' };
          return (
            <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap ${color}`} title={instalacionInfo.titulo}>
              {label}
            </span>
          );
        })()}
      </td>
    </tr>
    );
  };

  // Render row for Testigo tab (estilo original)
  const renderTestigoRow = (item: InventoryRow, showCheckbox = true) => (
    <tr
      key={item.id}
      className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
        selectedInventoryIds.has(item.id) ? 'bg-yellow-500/20' : ''
      }`}
    >
      {showCheckbox && (
        <td className="p-2 w-8">
          <button
            onClick={() => toggleInventorySelection(item.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectedInventoryIds.has(item.id)
                ? 'bg-purple-600 border-purple-600'
                : 'border-purple-500/50 hover:border-purple-400'
            }`}
          >
            {selectedInventoryIds.has(item.id) && (
              <Check className="h-3 w-3 text-white" />
            )}
          </button>
        </td>
      )}
      <td className="p-2 text-xs font-medium text-white">{item.codigo_unico}</td>
      <td className="p-2 text-xs text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2 text-xs text-purple-300">{item.aps}</td>
      <td className="p-2">
        <StatusBadge status={item.testigo_status || 'pendiente'} />
      </td>
    </tr>
  );

  // Render row for Programación tab (muestra estado de programación y tarea asociada)
  const renderProgramacionRow = (item: InventoryRow & { tarea_id?: number; tarea_titulo?: string; estado_programacion?: string }) => {
    // Para items digitales, obtener el resumen de archivos
    let digitalSummary: { total: number; imagenes: number; videos: number } | null = null;
    if (item.rsv_id) {
      const rsvIds = item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      let totalArchivos = 0;
      let totalImagenes = 0;
      let totalVideos = 0;
      rsvIds.forEach(rsvId => {
        const summary = digitalSummaryMap.get(rsvId);
        if (summary) {
          totalArchivos += summary.totalArchivos;
          totalImagenes += summary.countImagenes;
          totalVideos += summary.countVideos;
        }
      });
      if (totalArchivos > 0) {
        digitalSummary = { total: totalArchivos, imagenes: totalImagenes, videos: totalVideos };
      }
    }

    // Estado de programación con colores
    const estadoConfig: Record<string, { label: string; color: string }> = {
      'en_programacion': { label: 'En Programación', color: 'bg-blue-500/20 text-blue-400' },
      'programado': { label: 'Programado', color: 'bg-green-500/20 text-green-400' },
    };
    const estado = estadoConfig[item.estado_programacion || 'en_programacion'] || estadoConfig.en_programacion;

    return (
      <tr
        key={item.id}
        className="border-b border-border/50 hover:bg-purple-900/20 transition-colors"
      >
        <td className="p-2 text-xs font-medium text-white">{item.id}</td>
        <td className="p-2">
          {digitalSummary ? (
            <button
              onClick={() => {
                const rsvIds = item.rsv_id?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
                if (rsvIds.length > 0) {
                  openDigitalGallery(rsvIds, item.codigo_unico);
                }
              }}
              className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded hover:bg-blue-500/30 transition-colors"
              title="Ver galería digital"
            >
              <span className="text-blue-400 font-bold text-lg">{digitalSummary.total}</span>
            </button>
          ) : (
            <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
              <Image className="h-5 w-5 text-zinc-600" />
            </div>
          )}
        </td>
        <td className="p-2 text-xs text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
        <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
        <td className="p-2 text-xs text-zinc-300">{item.ciudad}</td>
        <td className="p-2 text-xs text-purple-300 max-w-[120px] truncate" title={item.tarea_titulo || '-'}>
          {item.tarea_titulo || '-'}
        </td>
        <td className="p-2">
          <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap ${estado.color}`}>
            {estado.label}
          </span>
        </td>
      </tr>
    );
  };

  // Render row for Testigo tab (estilo idéntico a Revisar y aprobar)
  const renderTestigoRowStyled = (item: InventoryRow) => (
    <tr
      key={item.id}
      className={`border-b border-border/50 hover:bg-purple-900/20 transition-colors ${
        selectedInventoryIds.has(item.id) ? 'bg-yellow-500/20' : ''
      }`}
    >
      <td className="p-2 w-8">
        <button
          onClick={() => toggleInventorySelection(item.id)}
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            selectedInventoryIds.has(item.id)
              ? 'bg-purple-600 border-purple-600'
              : 'border-purple-500/50 hover:border-purple-400'
          }`}
        >
          {selectedInventoryIds.has(item.id) && (
            <Check className="h-3 w-3 text-white" />
          )}
        </button>
      </td>
      <td className="p-2 text-xs font-medium text-white">{item.id}</td>
      <td className="p-2 text-xs text-zinc-300">{item.arte_aprobado || 'Sin revisar'}</td>
      <td className="p-2">
        {item.archivo_arte ? (
          <img
            src={getImageUrl(item.archivo_arte) || ''}
            alt="Arte"
            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80"
            onClick={() => window.open(getImageUrl(item.archivo_arte) || '', '_blank')}
          />
        ) : (
          <span className="text-zinc-500 text-xs">Sin archivo</span>
        )}
      </td>
      <td className="p-2 text-xs text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.tipo_de_cara}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2 text-xs text-zinc-300">{item.ciudad}</td>
      <td className="p-2 text-xs text-blue-400 max-w-[150px] truncate" title={item.archivo_arte}>
        {item.archivo_arte ? (
          <a href={getImageUrl(item.archivo_arte) || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.archivo_arte.split('/').pop()}
          </a>
        ) : '-'}
      </td>
      <td className="p-2 text-center">
        {item.estado_tarea === 'atendido' ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
        ) : (
          <span className="text-zinc-500">-</span>
        )}
      </td>
      <td className="p-2">
        {(() => {
          const rsvIds = item.rsv_id?.split(',').map(id => id.trim()) || [];
          const instalacionInfo = rsvIds.map(id => instalacionStatusMap.get(id)).find(info => info);
          if (!instalacionInfo) return <span className="text-zinc-500 text-xs">-</span>;
          const estadoLabels: Record<string, { label: string; color: string }> = {
            'en_proceso': { label: 'En proceso de instalación', color: 'bg-orange-500/20 text-orange-400' },
            'validar_instalacion': { label: 'Validar instalación', color: 'bg-yellow-500/20 text-yellow-400' },
            'instalado': { label: 'Instalado', color: 'bg-green-500/20 text-green-400' },
          };
          const { label, color } = estadoLabels[instalacionInfo.estado] || { label: '-', color: '' };
          return (
            <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap ${color}`} title={instalacionInfo.titulo}>
              {label}
            </span>
          );
        })()}
      </td>
    </tr>
  );

  // Generic render based on active tab
  const renderInventoryRow = (item: InventoryRow, showCheckbox = true, hideInstalado = false) => {
    if (activeMainTab === 'versionario') return renderVersionarioRow(item, showCheckbox);
    if (activeMainTab === 'testigo') return renderTestigoRow(item, showCheckbox);
    return renderAtenderRow(item, showCheckbox, hideInstalado);
  };

  // ---- Loading / Error states ----
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Gestion de Artes" />
        <div className="p-4 md:p-6 flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400 mb-3" />
          <p className="text-sm text-muted-foreground">Cargando campaña...</p>
        </div>
      </div>
    );
  }

  if (error || !campana) {
    return (
      <div className="min-h-screen">
        <Header title="Gestion de Artes" />
        <div className="p-4 md:p-6">
          <button
            onClick={() => navigate('/campanas')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-red-300">Error al cargar la campaña</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Gestion de Artes" />

      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/campanas/detail/${campanaId}`)}
              className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Volver a campaña</span>
            </button>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm font-medium">{campana.nombre}</span>
            <Badge variant="outline" className="text-[10px]">#{campana.id}</Badge>
          </div>
        </div>

        {/* Workflow Step Indicator */}
        <div className="bg-gradient-to-r from-purple-900/30 to-purple-900/10 rounded-xl border border-purple-500/20 p-4">
          <div className="flex items-start gap-4">
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-2">
              {(['versionario', 'atender', 'impresiones', 'testigo'] as MainTab[])
                .filter(step => step !== 'impresiones' || shouldShowImpresionesTab)
                .filter(step => step !== 'versionario' || permissions.canSeeTabSubirArtes)
                .filter(step => step !== 'impresiones' || permissions.canSeeTabImpresiones)
                .filter(step => step !== 'testigo' || permissions.canSeeTabValidacionInstalacion)
                .map((step, idx, arr) => {
                const isActive = activeMainTab === step;
                const isPast = arr.indexOf(activeMainTab) > idx;
                return (
                  <div key={step} className="flex items-center">
                    <button
                      onClick={() => setActiveMainTab(step)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400/50'
                          : isPast
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                      }`}
                    >
                      {isPast && !isActive ? <Check className="h-4 w-4" /> : idx + 1}
                    </button>
                    {idx < arr.length - 1 && (
                      <div className={`w-8 h-0.5 ${isPast ? 'bg-green-600' : 'bg-zinc-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Current step info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {(() => {
                  const Icon = TAB_DESCRIPTIONS[activeMainTab].icon;
                  return <Icon className="h-5 w-5 text-purple-400" />;
                })()}
                <h2 className="text-lg font-semibold text-white">
                  {TAB_DESCRIPTIONS[activeMainTab].title}
                </h2>
              </div>
              <p className="text-sm text-zinc-400">
                {TAB_DESCRIPTIONS[activeMainTab].description}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <SummaryCards stats={summaryStats} activeTab={activeMainTab} />

        {/* ================================================================ */}
        {/* BLOQUE A: INVENTARIO (PRINCIPAL) */}
        {/* ================================================================ */}
        <div className="bg-card rounded-xl border border-border">
          {/* Main Tabs: Subir / Revisar / Testigo - con iconos */}
          <div className="border-b border-border">
            <div className="flex">
              {([
                { key: 'versionario', label: 'Subir Artes', icon: Upload },
                { key: 'atender', label: 'Revisar y Aprobar', icon: Eye },
                { key: 'programacion', label: 'Programación', icon: Monitor },
                { key: 'impresiones', label: 'Impresiones', icon: Printer },
                { key: 'testigo', label: 'Validar Instalacion', icon: Camera },
              ] as { key: MainTab; label: string; icon: typeof Upload }[])
                .filter(tab => tab.key !== 'impresiones' || shouldShowImpresionesTab)
                .filter(tab => tab.key !== 'versionario' || permissions.canSeeTabSubirArtes)
                .filter(tab => tab.key !== 'programacion' || permissions.canSeeTabProgramacion)
                .filter(tab => tab.key !== 'impresiones' || permissions.canSeeTabImpresiones)
                .filter(tab => tab.key !== 'testigo' || permissions.canSeeTabValidacionInstalacion)
                .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMainTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeMainTab === tab.key
                        ? 'border-purple-500 text-purple-300'
                        : 'border-transparent text-muted-foreground hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-tabs: Formato - Solo mostrar si hay elementos y no estamos en Programación (que es solo digital) */}
          {activeMainTab !== 'programacion' && (formatCounts.tradicional > 0 || formatCounts.digital > 0) && (
            <div className="px-4 py-2 border-b border-border bg-purple-900/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tipo de medio:</span>
                  <div className="flex gap-1">
                    {([
                      { key: 'tradicional', label: 'Tradicional', desc: 'Impresion fisica', count: formatCounts.tradicional },
                      { key: 'digital', label: 'Digital', desc: 'Pantallas LED', count: formatCounts.digital },
                    ] as { key: FormatTab; label: string; desc: string; count: number }[])
                      .filter((format) => format.count > 0)
                      .map((format) => (
                      <button
                        key={format.key}
                        onClick={() => setActiveFormat(format.key)}
                        title={format.desc}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          activeFormat === format.key
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-900/30 text-zinc-400 hover:bg-purple-900/50'
                        }`}
                      >
                        {format.label} ({format.count})
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredInventory.length} elementos
                </span>
              </div>
            </div>
          )}

          {/* Filter Toolbar (Versionario tab) */}
          {activeMainTab === 'versionario' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs text-zinc-400">{filteredVersionarioData.length} de {inventorySinArteData.length} espacios</span>
              <FilterToolbar
                filters={filtersVersionario}
                showFilters={showFiltersVersionario}
                setShowFilters={setShowFiltersVersionario}
                addFilter={addFilterVersionario}
                updateFilter={updateFilterVersionario}
                removeFilter={removeFilterVersionario}
                clearFilters={clearFiltersVersionario}
                uniqueValues={getUniqueValuesVersionario}
                activeGroupings={activeGroupingsVersionario}
                showGrouping={showGroupingVersionario}
                setShowGrouping={setShowGroupingVersionario}
                toggleGrouping={toggleGroupingVersionario}
                clearGroupings={clearGroupingsVersionario}
                sortField={sortFieldVersionario}
                sortDirection={sortDirectionVersionario}
                showSort={showSortVersionario}
                setShowSort={setShowSortVersionario}
                setSortField={setSortFieldVersionario}
                setSortDirection={setSortDirectionVersionario}
                filteredCount={filteredVersionarioData.length}
                totalCount={inventorySinArteData.length}
              />
            </div>
          )}

          {/* Action Buttons (Versionario tab) */}
          {activeMainTab === 'versionario' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedInventoryIds.size > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {selectedInventoryIds.size} espacio(s) seleccionado(s)
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedInventoryIds(new Set())}
                      className="text-xs text-zinc-400 hover:text-zinc-300"
                    >
                      Limpiar seleccion
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info className="h-4 w-4" />
                    <span className="text-xs">Selecciona los espacios donde quieres subir arte</span>
                  </div>
                )}
              </div>
              {permissions.canEditGestionArtes && (
                <button
                  onClick={() => setIsUploadArtModalOpen(true)}
                  disabled={selectedInventoryIds.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    selectedInventoryIds.size > 0
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Asignar Arte
                </button>
              )}
            </div>
          )}

          {/* Estado Arte Tabs (Atender tab) */}
          {activeMainTab === 'atender' && (
            <div className="px-4 py-2 border-b border-border bg-zinc-900/50">
              <div className="flex items-center gap-1">
                {(() => {
                  // Filtrar por formato seleccionado (Tradicional/Digital)
                  const formatFilter = activeFormat === 'tradicional' ? 'Tradicional' : 'Digital';
                  const filteredByFormat = inventoryArteData.filter(i => i.tradicional_digital === formatFilter);
                  return [
                    { key: 'sin_revisar' as const, label: 'Sin Revisar', count: filteredByFormat.filter(i => i.estado_arte === 'sin_revisar').length },
                    { key: 'en_revision' as const, label: 'En Revisión', count: filteredByFormat.filter(i => i.estado_arte === 'en_revision').length },
                    { key: 'aprobado' as const, label: 'Aprobado', count: filteredByFormat.filter(i => i.estado_arte === 'aprobado').length },
                    { key: 'rechazado' as const, label: 'Rechazado', count: filteredByFormat.filter(i => i.estado_arte === 'rechazado').length },
                  ];
                })().map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveEstadoArteTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeEstadoArteTab === tab.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeEstadoArteTab === tab.key
                        ? 'bg-purple-500/50 text-purple-100'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Toolbar (Atender tab) */}
          {activeMainTab === 'atender' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">
                  {filteredAtenderData.filter(i => i.tradicional_digital === (activeFormat === 'tradicional' ? 'Tradicional' : 'Digital')).length} de {inventoryArteData.filter(i => i.tradicional_digital === (activeFormat === 'tradicional' ? 'Tradicional' : 'Digital')).length} artes
                </span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por ID, código, plaza..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 w-64"
                  />
                  {inventorySearch && (
                    <button
                      onClick={() => setInventorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <FilterToolbar
                filters={filtersAtender}
                showFilters={showFiltersAtender}
                setShowFilters={setShowFiltersAtender}
                addFilter={addFilterAtender}
                updateFilter={updateFilterAtender}
                removeFilter={removeFilterAtender}
                clearFilters={clearFiltersAtender}
                uniqueValues={getUniqueValuesAtender}
                activeGroupings={activeGroupingsAtender}
                showGrouping={showGroupingAtender}
                setShowGrouping={setShowGroupingAtender}
                toggleGrouping={toggleGroupingAtender}
                clearGroupings={clearGroupingsAtender}
                sortField={sortFieldAtender}
                sortDirection={sortDirectionAtender}
                showSort={showSortAtender}
                setShowSort={setShowSortAtender}
                setSortField={setSortFieldAtender}
                setSortDirection={setSortDirectionAtender}
                filteredCount={filteredAtenderData.length}
                totalCount={inventoryArteData.length}
              />
            </div>
          )}

          {/* Action Buttons (Atender tab) */}
          {activeMainTab === 'atender' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedInventoryIds.size > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {selectedInventoryIds.size} arte(s) seleccionado(s)
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedInventoryIds(new Set())}
                      className="text-xs text-zinc-400 hover:text-zinc-300"
                    >
                      Limpiar seleccion
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info className="h-4 w-4" />
                    <span className="text-xs">Selecciona artes para crear tareas de revision</span>
                  </div>
                )}
              </div>
              {permissions.canEditGestionArtes && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const reservaIds = selectedInventoryItems.flatMap(item =>
                        item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                      );
                      if (reservaIds.length > 0) {
                        // Verificar si hay tareas asociadas
                        setIsCheckingTareas(true);
                        try {
                          const result = await campanasService.checkReservasTareas(campanaId, reservaIds);
                          if (result.hasTareas) {
                            setTareasAfectadas(result.tareas);
                            setIsConfirmClearModalOpen(true);
                          } else {
                            // No hay tareas, limpiar directamente
                            assignArteMutation.mutate({ reservaIds, archivo: '' });
                            setSelectedInventoryIds(new Set());
                          }
                        } catch (error) {
                          console.error('Error verificando tareas:', error);
                          // En caso de error, limpiar directamente
                          assignArteMutation.mutate({ reservaIds, archivo: '' });
                          setSelectedInventoryIds(new Set());
                        } finally {
                          setIsCheckingTareas(false);
                        }
                      }
                    }}
                    disabled={selectedInventoryIds.size === 0 || assignArteMutation.isPending || isCheckingTareas || hasSelectedItemsWithInstalacion}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedInventoryIds.size > 0 && !isCheckingTareas && !hasSelectedItemsWithInstalacion && !assignArteMutation.isPending
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                    title={hasSelectedItemsWithInstalacion ? 'No se puede limpiar arte de items con instalación activa' : undefined}
                  >
                    {isCheckingTareas || assignArteMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {assignArteMutation.isPending ? 'Limpiando...' : 'Verificando...'}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        Limpiar Arte
                      </>
                    )}
                  </button>
                  {permissions.canCreateTareasGestionArtes && (
                    <button
                      onClick={handleCreateTaskClick}
                      disabled={selectedInventoryIds.size === 0 || isCheckingExistingTasks}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        selectedInventoryIds.size > 0 && !isCheckingExistingTasks
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {isCheckingExistingTasks ? (
                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {isCheckingExistingTasks ? 'Verificando...' : 'Crear Tarea'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Estado Programación Tabs (Programación tab) */}
          {activeMainTab === 'programacion' && (
            <div className="px-4 py-2 border-b border-border bg-zinc-900/50">
              <div className="flex items-center gap-1">
                {[
                  { key: 'en_programacion' as const, label: 'En Programación', count: inventoryProgramacionData.filter(i => i.estado_programacion === 'en_programacion').length },
                  { key: 'programado' as const, label: 'Programado', count: inventoryProgramacionData.filter(i => i.estado_programacion === 'programado').length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveEstadoProgramacionTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeEstadoProgramacionTab === tab.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeEstadoProgramacionTab === tab.key
                        ? 'bg-purple-500/50 text-purple-100'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Toolbar (Programación tab) */}
          {activeMainTab === 'programacion' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">
                  {filteredProgramacionData.length} de {inventoryProgramacionData.length} artes digitales
                </span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por ID, código, plaza..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 w-64"
                  />
                  {inventorySearch && (
                    <button
                      onClick={() => setInventorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <FilterToolbar
                filters={filtersProgramacion}
                showFilters={showFiltersProgramacion}
                setShowFilters={setShowFiltersProgramacion}
                addFilter={addFilterProgramacion}
                updateFilter={updateFilterProgramacion}
                removeFilter={removeFilterProgramacion}
                clearFilters={clearAllFiltersProgramacion}
                uniqueValues={getUniqueValuesProgramacion}
                activeGroupings={activeGroupingsProgramacion}
                showGrouping={showGroupingProgramacion}
                setShowGrouping={setShowGroupingProgramacion}
                toggleGrouping={toggleGroupingProgramacion}
                clearGroupings={clearGroupingsProgramacion}
                sortField={sortFieldProgramacion}
                sortDirection={sortDirectionProgramacion}
                showSort={showSortProgramacion}
                setShowSort={setShowSortProgramacion}
                setSortField={setSortFieldProgramacion}
                setSortDirection={setSortDirectionProgramacion}
                filteredCount={filteredProgramacionData.length}
                totalCount={inventoryProgramacionData.length}
              />
            </div>
          )}

          {/* Action Buttons (Programación tab) */}
          {activeMainTab === 'programacion' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Info className="h-4 w-4" />
                  <span className="text-xs">Items digitales en tareas de programación</span>
                </div>
              </div>
            </div>
          )}

          {/* Estado Instalacion Tabs (Testigo tab) */}
          {activeMainTab === 'testigo' && (
            <div className="px-4 py-2 border-b border-border bg-zinc-900/50">
              <div className="flex items-center gap-1">
                {[
                  { key: 'por_instalar' as const, label: 'Por Instalar', count: inventoryTestigosData.filter(i => {
                    const estatus = i.tarea_instalacion_estatus;
                    return estatus === 'Pendiente' || estatus === 'Activo' || estatus === 'En proceso';
                  }).length },
                  { key: 'instaladas' as const, label: 'Instaladas', count: inventoryTestigosData.filter(i => {
                    const estatus = i.tarea_instalacion_estatus;
                    return estatus === 'Atendido' || estatus === 'Completado';
                  }).length },
                  { key: 'testigo' as const, label: 'Testigo', count: testigoGroupedByAsignado.length },
                ].filter(tab => tab.key !== 'testigo' || permissions.canSeeTabTestigos)
                .map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveEstadoInstalacionTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeEstadoInstalacionTab === tab.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeEstadoInstalacionTab === tab.key
                        ? 'bg-purple-500/50 text-purple-100'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Toolbar (Testigo tab) */}
          {activeMainTab === 'testigo' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">{filteredTestigoData.length} de {inventoryTestigosData.length} instalaciones</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por ID, código, plaza..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 w-64"
                  />
                  {inventorySearch && (
                    <button
                      onClick={() => setInventorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <FilterToolbar
                filters={filtersTestigo}
                showFilters={showFiltersTestigo}
                setShowFilters={setShowFiltersTestigo}
                addFilter={addFilterTestigo}
                updateFilter={updateFilterTestigo}
                removeFilter={removeFilterTestigo}
                clearFilters={clearFiltersTestigo}
                uniqueValues={getUniqueValuesTestigo}
                activeGroupings={activeGroupingsTestigo}
                showGrouping={showGroupingTestigo}
                setShowGrouping={setShowGroupingTestigo}
                toggleGrouping={toggleGroupingTestigo}
                clearGroupings={clearGroupingsTestigo}
                sortField={sortFieldTestigo}
                sortDirection={sortDirectionTestigo}
                showSort={showSortTestigo}
                setShowSort={setShowSortTestigo}
                setSortField={setSortFieldTestigo}
                setSortDirection={setSortDirectionTestigo}
                filteredCount={filteredTestigoData.length}
                totalCount={inventoryTestigosData.length}
              />
            </div>
          )}

          {/* Estado Impresion Tabs (Impresiones tab) */}
          {activeMainTab === 'impresiones' && (
            <div className="px-4 py-2 border-b border-border bg-zinc-900/50">
              <div className="flex items-center gap-1">
                {[
                  { key: 'en_impresion' as const, label: 'En Impresion', count: inventoryImpresionesData.filter(i => i.estado_impresion === 'en_impresion').length },
                  { key: 'pendiente_recepcion' as const, label: 'Pend. Recepcion', count: inventoryImpresionesData.filter(i => i.estado_impresion === 'pendiente_recepcion').length },
                  { key: 'recibido' as const, label: 'Recibido', count: inventoryImpresionesData.filter(i => i.estado_impresion === 'recibido').length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveEstadoImpresionTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeEstadoImpresionTab === tab.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeEstadoImpresionTab === tab.key
                        ? 'bg-purple-500/50 text-purple-100'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info Bar (Impresiones tab) - Solo para sub-tabs que no son 'recibido' */}
          {activeMainTab === 'impresiones' && activeEstadoImpresionTab !== 'recibido' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {filteredImpresionesData.length} items en este estado
              </span>
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-purple-300 font-medium">
                  {tareasAPI.filter(t => t.tipo === 'Impresión' && t.estatus !== 'Atendido').length} tarea(s) activa(s)
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons (Impresiones tab - Recibido) */}
          {activeMainTab === 'impresiones' && activeEstadoImpresionTab === 'recibido' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedInventoryIds.size > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {selectedInventoryIds.size} item(s) seleccionado(s)
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedInventoryIds(new Set())}
                      className="text-xs text-zinc-400 hover:text-zinc-300"
                    >
                      Limpiar seleccion
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info className="h-4 w-4" />
                    <span className="text-xs">Selecciona items recibidos para crear tareas</span>
                  </div>
                )}
              </div>
              {permissions.canEditGestionArtes && permissions.canCreateTareasGestionArtes && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTaskClick}
                    disabled={selectedInventoryIds.size === 0 || isCheckingExistingTasks}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedInventoryIds.size > 0 && !isCheckingExistingTasks
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isCheckingExistingTasks ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {isCheckingExistingTasks ? 'Verificando...' : 'Crear Tarea'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons (Testigo tab) */}
          {activeMainTab === 'testigo' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedInventoryIds.size > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {selectedInventoryIds.size} item(s) seleccionado(s)
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedInventoryIds(new Set())}
                      className="text-xs text-zinc-400 hover:text-zinc-300"
                    >
                      Limpiar seleccion
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Info className="h-4 w-4" />
                    <span className="text-xs">Selecciona items para crear tareas</span>
                  </div>
                )}
              </div>
              {permissions.canEditGestionArtes && permissions.canCreateTareasGestionArtes && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTaskClick}
                    disabled={selectedInventoryIds.size === 0 || isCheckingExistingTasks}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedInventoryIds.size > 0 && !isCheckingExistingTasks
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isCheckingExistingTasks ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {isCheckingExistingTasks ? 'Verificando...' : 'Crear Tarea'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Inventory Table */}
          <div className="max-h-[400px] overflow-auto">
            {(isLoadingInventarioSinArte || isLoadingInventarioArte || isLoadingInventarioTestigos) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando inventario...</span>
              </div>
            ) : (activeMainTab !== 'impresiones' && filteredInventory.length === 0) || (activeMainTab === 'impresiones' && filteredImpresionesData.length === 0) ? (
              <EmptyState
                message={
                  activeMainTab === 'versionario'
                    ? inventoryArteData.length > 0
                      ? 'Todas las imagenes fueron cargadas'
                      : 'Sin espacios disponibles'
                    : activeMainTab === 'atender'
                    ? 'Sin artes para revisar'
                    : activeMainTab === 'impresiones'
                    ? 'Sin impresiones pendientes'
                    : inventoryArteData.length > 0
                      ? 'Aun no hay artes aprobados'
                      : 'Sin testigos pendientes'
                }
                description={
                  activeMainTab === 'versionario'
                    ? inventoryArteData.length > 0
                      ? 'Ve a "Revisar y Aprobar" para continuar con el proceso de los artes que subiste'
                      : 'Asigna APS a los inventarios en "Detalle de Campaña" para que aparezcan aqui'
                    : activeMainTab === 'atender'
                    ? (formatCounts.tradicional === 0 && formatCounts.digital === 0)
                      ? inventorySinArteData.length > 0
                        ? 'Regresa a "Subir Artes" para asignar imagenes a los inventarios y luego vuelve aqui para revisarlos'
                        : inventoryTestigosData.length > 0
                          ? 'Todos los artes fueron aprobados, ve a "Validar Instalacion" para continuar'
                          : 'No hay artes pendientes de revision en esta campaña'
                      : 'No hay artes de tipo ' + activeFormat + ' para revisar'
                    : activeMainTab === 'impresiones'
                    ? 'Crea una tarea de Impresion desde "Revisar y Aprobar" para ver items aqui'
                    : inventoryArteData.length > 0
                      ? 'Primero aprueba los artes en "Revisar y Aprobar" para que aparezcan aqui'
                      : 'Los testigos se generan despues de aprobar e instalar los artes'
                }
                icon={activeMainTab === 'versionario' ? Image : activeMainTab === 'atender' ? Eye : activeMainTab === 'impresiones' ? Printer : Camera}
              />
            ) : activeMainTab === 'impresiones' && activeEstadoImpresionTab === 'recibido' ? (
              // Vista de items recibidos con checkboxes para crear tareas
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-purple-900/20 sticky top-0 z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 w-8">
                        <button
                          onClick={() => {
                            const allSelected = filteredImpresionesData.every(item => selectedInventoryIds.has(item.id));
                            setSelectedInventoryIds(prev => {
                              const next = new Set(prev);
                              filteredImpresionesData.forEach(item => {
                                if (allSelected) next.delete(item.id);
                                else next.add(item.id);
                              });
                              return next;
                            });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            filteredImpresionesData.every(item => selectedInventoryIds.has(item.id)) && filteredImpresionesData.length > 0
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-purple-500/50 hover:border-purple-400'
                          }`}
                        >
                          {filteredImpresionesData.every(item => selectedInventoryIds.has(item.id)) && filteredImpresionesData.length > 0 && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 font-medium text-purple-300">Arte</th>
                      <th className="p-2 font-medium text-purple-300">Código</th>
                      <th className="p-2 font-medium text-purple-300">Ciudad</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Mueble</th>
                      <th className="p-2 font-medium text-purple-300">Medidas</th>
                      <th className="p-2 font-medium text-purple-300">Catorcena</th>
                      <th className="p-2 font-medium text-purple-300">Tarea Impresión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImpresionesData.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedInventoryIds(prev => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        }}
                        className={`border-b border-border/50 hover:bg-purple-900/10 cursor-pointer transition-colors ${
                          selectedInventoryIds.has(item.id) ? 'bg-purple-900/20' : ''
                        }`}
                      >
                        <td className="p-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedInventoryIds.has(item.id)
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50'
                            }`}
                          >
                            {selectedInventoryIds.has(item.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          {item.archivo_arte ? (
                            <div className="w-12 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                              <img src={getImageUrl(item.archivo_arte) || ''} alt="Arte" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-10 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                              <Image className="h-4 w-4 text-zinc-600" />
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-zinc-300 font-mono text-[10px]">{item.codigo_unico}</td>
                        <td className="p-2 text-zinc-300">{item.ciudad}</td>
                        <td className="p-2 text-zinc-400">{item.plaza}</td>
                        <td className="p-2 text-zinc-300">{item.mueble}</td>
                        <td className="p-2 text-zinc-400">{item.ancho || '-'} x {item.alto || '-'}</td>
                        <td className="p-2 text-zinc-400">C{item.catorcena}</td>
                        <td className="p-2 text-zinc-400 text-[10px]">{(item as any).tarea_titulo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeMainTab === 'impresiones' ? (
              // Vista de items en proceso de impresión (no recibido)
              <div className="divide-y divide-border">
                {(() => {
                  // Agrupar por tarea de impresión
                  const tareasAgrupadas = filteredImpresionesData.reduce((acc, item) => {
                    const tareaId = (item as any).tarea_id || 0;
                    if (!acc[tareaId]) {
                      acc[tareaId] = {
                        tarea_id: tareaId,
                        tarea_titulo: (item as any).tarea_titulo || `Impresión #${tareaId}`,
                        tarea_estatus: (item as any).tarea_estatus || 'Pendiente',
                        proveedor: (item as any).proveedor || '-',
                        items: [],
                      };
                    }
                    acc[tareaId].items.push(item);
                    return acc;
                  }, {} as Record<number, { tarea_id: number; tarea_titulo: string; tarea_estatus: string; proveedor: string; items: typeof filteredImpresionesData }>);

                  return Object.values(tareasAgrupadas).map(grupo => (
                    <div key={grupo.tarea_id} className="p-4">
                      {/* Header de tarea */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            grupo.tarea_estatus === 'Activo' ? 'bg-green-500/20' :
                            grupo.tarea_estatus === 'Atendido' ? 'bg-blue-500/20' :
                            'bg-yellow-500/20'
                          }`}>
                            <Printer className={`h-5 w-5 ${
                              grupo.tarea_estatus === 'Activo' ? 'text-green-400' :
                              grupo.tarea_estatus === 'Atendido' ? 'text-blue-400' :
                              'text-yellow-400'
                            }`} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{grupo.tarea_titulo}</h4>
                            <p className="text-xs text-zinc-400">
                              Proveedor: <span className="text-purple-300">{grupo.proveedor}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`text-xs ${
                            grupo.tarea_estatus === 'Activo' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            grupo.tarea_estatus === 'Atendido' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                            'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                          }`}>
                            {grupo.tarea_estatus}
                          </Badge>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                            {grupo.items.length} items
                          </Badge>
                          <button
                            onClick={() => {
                              const tarea = tareasAPI.find(t => t.id === grupo.tarea_id);
                              if (tarea) {
                                const taskRow: TaskRow = {
                                  id: tarea.id.toString(),
                                  tipo: tarea.tipo || 'Impresión',
                                  estatus: tarea.estatus || 'Pendiente',
                                  identificador: `TASK-${tarea.id.toString().padStart(3, '0')}`,
                                  fecha_inicio: tarea.fecha_inicio?.split('T')[0] || '',
                                  fecha_fin: tarea.fecha_fin?.split('T')[0] || '',
                                  creador: tarea.responsable_nombre || tarea.responsable || '',
                                  asignado: tarea.asignado || '',
                                  descripcion: tarea.descripcion || '',
                                  titulo: tarea.titulo || '',
                                  inventario_ids: tarea.ids_reservas ? tarea.ids_reservas.split(',') : [],
                                  campana_id: campanaId,
                                  nombre_proveedores: tarea.nombre_proveedores || undefined,
                                  proveedores_id: tarea.proveedores_id || undefined,
                                  num_impresiones: tarea.num_impresiones || undefined,
                                  evidencia: tarea.evidencia || undefined,
                                };
                                setSelectedTask(taskRow);
                                setIsTaskDetailModalOpen(true);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                          >
                            Ver detalle
                          </button>
                        </div>
                      </div>
                      {/* Lista de items agrupados por arte */}
                      <div className="bg-zinc-900/30 rounded-lg overflow-hidden">
                        {(() => {
                          const artesAgrupados = grupo.items.reduce((acc, item) => {
                            const key = item.archivo_arte || 'sin_arte';
                            if (!acc[key]) {
                              acc[key] = { items: [], archivo: item.archivo_arte };
                            }
                            acc[key].items.push(item);
                            return acc;
                          }, {} as Record<string, { items: typeof grupo.items; archivo: string | undefined }>);

                          return Object.entries(artesAgrupados).map(([arteKey, arteGrupo]) => (
                            <div key={arteKey} className="flex items-center gap-3 p-2 border-b border-border/30 last:border-0">
                              <div className="w-12 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                                {arteGrupo.archivo ? (
                                  <img
                                    src={getImageUrl(arteGrupo.archivo) || ''}
                                    alt="Arte"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Image className="h-4 w-4 text-zinc-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white">
                                  {arteGrupo.items.length} {arteGrupo.items.length === 1 ? 'ubicacion' : 'ubicaciones'}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {arteGrupo.items[0].mueble} - {arteGrupo.items[0].ciudad}
                                </p>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : activeMainTab === 'atender' && activeGroupingsAtender.length > 0 ? (
              // Vista jerárquica de 3 niveles para Revisar y Aprobar (con agrupaciones)
              <div className="divide-y divide-border">
                {Object.entries(atenderGroupedInventory).map(([level1Key, level2Groups]) => {
                  const level1Expanded = expandedNodes.has(`atender-${level1Key}`);
                  const level1ItemCount = Object.values(level2Groups).reduce(
                    (sum, level3Groups) => sum + Object.values(level3Groups).reduce((s, items) => s + items.length, 0), 0
                  );
                  const getAllLevel1Items = () => Object.values(level2Groups).flatMap(l3 => Object.values(l3).flat());
                  return (
                    <div key={level1Key}>
                      {/* Nivel 1 */}
                      <button
                        onClick={() => toggleNode(`atender-${level1Key}`)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {level1Expanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-bold text-white">{level1Key}</span>
                          <div
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              const allItems = getAllLevel1Items();
                              const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                              setSelectedInventoryIds(prev => {
                                const next = new Set(prev);
                                allItems.forEach(item => {
                                  if (allSelected) next.delete(item.id);
                                  else next.add(item.id);
                                });
                                return next;
                              });
                            }}
                            className={`ml-2 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                              getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0 && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                        <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                          {level1ItemCount}
                        </Badge>
                      </button>
                      {level1Expanded && (
                        <div className="pl-4">
                          {Object.entries(level2Groups).map(([level2Key, level3Groups]) => {
                            const level2NodeKey = `atender-${level1Key}|${level2Key}`;
                            const level2Expanded = expandedNodes.has(level2NodeKey);
                            const level2ItemCount = Object.values(level3Groups).reduce((s, items) => s + items.length, 0);
                            const getAllLevel2Items = () => Object.values(level3Groups).flat();
                            return (
                              <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                {/* Nivel 2 */}
                                <button
                                  onClick={() => toggleNode(level2NodeKey)}
                                  className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {level2Expanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                    )}
                                    <span className="text-xs font-semibold text-purple-300">{level2Key}</span>
                                    <div
                                      role="checkbox"
                                      tabIndex={0}
                                      aria-checked={getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const allItems = getAllLevel2Items();
                                        const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                                        setSelectedInventoryIds(prev => {
                                          const next = new Set(prev);
                                          allItems.forEach(item => {
                                            if (allSelected) next.delete(item.id);
                                            else next.add(item.id);
                                          });
                                          return next;
                                        });
                                      }}
                                      className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                        getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0
                                          ? 'bg-purple-600 border-purple-600'
                                          : 'border-purple-500/50 hover:border-purple-400'
                                      }`}
                                    >
                                      {getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0 && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </div>
                                  </div>
                                  <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/20 text-[10px]">
                                    {level2ItemCount}
                                  </Badge>
                                </button>
                                {level2Expanded && (
                                  <div className="pl-4">
                                    {Object.entries(level3Groups).map(([level3Key, items]) => {
                                      const level3NodeKey = `${level2NodeKey}|${level3Key}`;
                                      const level3Expanded = expandedNodes.has(level3NodeKey);
                                      return (
                                        <div key={level3NodeKey} className="border-l-2 border-amber-500/20">
                                          {/* Nivel 3 */}
                                          <button
                                            onClick={() => toggleNode(level3NodeKey)}
                                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {level3Expanded ? (
                                                <ChevronDown className="h-3 w-3 text-amber-400" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-amber-400" />
                                              )}
                                              <span className="text-[11px] font-medium text-amber-300">{level3Key}</span>
                                              <div
                                                role="checkbox"
                                                tabIndex={0}
                                                aria-checked={items.every(item => selectedInventoryIds.has(item.id))}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const allSelected = items.every(item => selectedInventoryIds.has(item.id));
                                                  setSelectedInventoryIds(prev => {
                                                    const next = new Set(prev);
                                                    items.forEach(item => {
                                                      if (allSelected) next.delete(item.id);
                                                      else next.add(item.id);
                                                    });
                                                    return next;
                                                  });
                                                }}
                                                className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                                  items.every(item => selectedInventoryIds.has(item.id))
                                                    ? 'bg-amber-600 border-amber-600'
                                                    : 'border-amber-500/50 hover:border-amber-400'
                                                }`}
                                              >
                                                {items.every(item => selectedInventoryIds.has(item.id)) && (
                                                  <Check className="h-2.5 w-2.5 text-white" />
                                                )}
                                              </div>
                                            </div>
                                            <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/20 text-[10px]">
                                              {items.length}
                                            </Badge>
                                          </button>
                                          {level3Expanded && (
                                            <div className="bg-card/50 ml-4">
                                              <table className="w-full text-xs">
                                                <thead className="bg-purple-900/20">
                                                  <tr className="border-b border-border text-left">
                                                    <th className="p-2 w-8">
                                                      <button
                                                        onClick={() => {
                                                          const allSelected = items.every(item => selectedInventoryIds.has(item.id));
                                                          setSelectedInventoryIds(prev => {
                                                            const next = new Set(prev);
                                                            items.forEach(item => {
                                                              if (allSelected) next.delete(item.id);
                                                              else next.add(item.id);
                                                            });
                                                            return next;
                                                          });
                                                        }}
                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                          items.every(item => selectedInventoryIds.has(item.id))
                                                            ? 'bg-purple-600 border-purple-600'
                                                            : 'border-purple-500/50 hover:border-purple-400'
                                                        }`}
                                                      >
                                                        {items.every(item => selectedInventoryIds.has(item.id)) && (
                                                          <Check className="h-3 w-3 text-white" />
                                                        )}
                                                      </button>
                                                    </th>
                                                    <th className="p-2 font-medium text-purple-300">ID</th>
                                                    <th className="p-2 font-medium text-purple-300">Arte Aprobado</th>
                                                    <th className="p-2 font-medium text-purple-300">Archivo</th>
                                                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                                    <th className="p-2 font-medium text-purple-300">Tipo Cara</th>
                                                    <th className="p-2 font-medium text-purple-300">Formato</th>
                                                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                                                    <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                                    <th className="p-2 font-medium text-purple-300">Nombre Archivo</th>
                                                    <th className="p-2 font-medium text-purple-300">Estado Instalación</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {items.map((item) => renderInventoryRow(item, true, true))}
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
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeMainTab === 'versionario' ? (
              // Vista jerárquica de 3 niveles para Subir Artes
              <div className="divide-y divide-border">
                {Object.entries(versionarioGroupedInventory).map(([level1Key, level2Groups]) => {
                  const level1Expanded = expandedNodes.has(level1Key);
                  // Contar items recursivamente
                  const level1ItemCount = Object.values(level2Groups).reduce(
                    (sum, level3Groups) => sum + Object.values(level3Groups).reduce((s, items) => s + items.length, 0), 0
                  );
                  // Obtener todos los items recursivamente
                  const getAllLevel1Items = () => Object.values(level2Groups).flatMap(l3 => Object.values(l3).flat());
                  return (
                    <div key={level1Key}>
                      {/* Nivel 1 */}
                      <button
                        onClick={() => toggleNode(level1Key)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {level1Expanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-bold text-white">{level1Key}</span>
                          {/* Checkbox para seleccionar todo el nivel 1 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allItems = getAllLevel1Items();
                              const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                              setSelectedInventoryIds(prev => {
                                const next = new Set(prev);
                                allItems.forEach(item => {
                                  if (allSelected) next.delete(item.id);
                                  else next.add(item.id);
                                });
                                return next;
                              });
                            }}
                            className={`ml-2 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0 && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                        </div>
                        <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                          {level1ItemCount} elemento{level1ItemCount !== 1 ? 's' : ''}
                        </Badge>
                      </button>
                      {level1Expanded && (
                        <div className="pl-4">
                          {Object.entries(level2Groups).map(([level2Key, level3Groups]) => {
                            const level2NodeKey = `${level1Key}|${level2Key}`;
                            const level2Expanded = expandedNodes.has(level2NodeKey);
                            const level2ItemCount = Object.values(level3Groups).reduce((s, items) => s + items.length, 0);
                            const getAllLevel2Items = () => Object.values(level3Groups).flat();
                            return (
                              <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                {/* Nivel 2 */}
                                <button
                                  onClick={() => toggleNode(level2NodeKey)}
                                  className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {level2Expanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                    )}
                                    <span className="text-xs font-semibold text-purple-300">{level2Key}</span>
                                    {/* Checkbox para seleccionar todo el nivel 2 */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const allItems = getAllLevel2Items();
                                        const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                                        setSelectedInventoryIds(prev => {
                                          const next = new Set(prev);
                                          allItems.forEach(item => {
                                            if (allSelected) next.delete(item.id);
                                            else next.add(item.id);
                                          });
                                          return next;
                                        });
                                      }}
                                      className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                        getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0
                                          ? 'bg-purple-600 border-purple-600'
                                          : 'border-purple-500/50 hover:border-purple-400'
                                      }`}
                                    >
                                      {getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0 && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </button>
                                  </div>
                                  <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/20 text-[10px]">
                                    {level2ItemCount}
                                  </Badge>
                                </button>
                                {level2Expanded && (
                                  <div className="pl-4">
                                    {Object.entries(level3Groups).map(([level3Key, items]) => {
                                      const level3NodeKey = `${level2NodeKey}|${level3Key}`;
                                      const level3Expanded = expandedNodes.has(level3NodeKey);
                                      return (
                                        <div key={level3NodeKey} className="border-l-2 border-purple-500/20">
                                          {/* Nivel 3 */}
                                          <button
                                            onClick={() => toggleNode(level3NodeKey)}
                                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-purple-900/10 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {level3Expanded ? (
                                                <ChevronDown className="h-3 w-3 text-zinc-400" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-zinc-400" />
                                              )}
                                              <span className="text-[11px] font-medium text-zinc-400">{level3Key}</span>
                                              {/* Checkbox para seleccionar todo el nivel 3 */}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const allSelected = items.every(item => selectedInventoryIds.has(item.id));
                                                  setSelectedInventoryIds(prev => {
                                                    const next = new Set(prev);
                                                    items.forEach(item => {
                                                      if (allSelected) next.delete(item.id);
                                                      else next.add(item.id);
                                                    });
                                                    return next;
                                                  });
                                                }}
                                                className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                                  items.every(item => selectedInventoryIds.has(item.id))
                                                    ? 'bg-purple-600 border-purple-600'
                                                    : 'border-purple-500/50 hover:border-purple-400'
                                                }`}
                                              >
                                                {items.every(item => selectedInventoryIds.has(item.id)) && (
                                                  <Check className="h-2.5 w-2.5 text-white" />
                                                )}
                                              </button>
                                            </div>
                                            <span className="text-[10px] text-zinc-500">
                                              {items.length} cara{items.length !== 1 ? 's' : ''}
                                            </span>
                                          </button>
                                          {level3Expanded && (
                                            <div className="bg-card/50 ml-4">
                                              <table className="w-full text-xs">
                                                <thead className="bg-purple-900/20">
                                                  <tr className="border-b border-border text-left">
                                                    <th className="p-1.5 w-6"></th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">ID</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Tipo Formato</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Código Único</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Ubicación</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Tipo Cara</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Formato</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Plaza</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Municipio</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">NSE</th>
                                                    <th className="p-1.5 font-medium text-purple-300 text-[10px]">Rsv ID</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {items.map((item) => renderInventoryRow(item))}
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
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeMainTab === 'atender' && activeGroupingsAtender.length === 0 ? (
              // Tabla plana de Revisar y Aprobar (sin agrupaciones)
              <div className="bg-card/50">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-purple-900/20 z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 w-8">
                        <button
                          onClick={() => {
                            const allSelected = filteredInventory.every(item => selectedInventoryIds.has(item.id));
                            setSelectedInventoryIds(prev => {
                              const next = new Set(prev);
                              filteredInventory.forEach(item => {
                                if (allSelected) next.delete(item.id);
                                else next.add(item.id);
                              });
                              return next;
                            });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            filteredInventory.every(item => selectedInventoryIds.has(item.id)) && filteredInventory.length > 0
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-purple-500/50 hover:border-purple-400'
                          }`}
                        >
                          {filteredInventory.every(item => selectedInventoryIds.has(item.id)) && filteredInventory.length > 0 && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 font-medium text-purple-300">ID</th>
                      <th className="p-2 font-medium text-purple-300">Arte Aprobado</th>
                      <th className="p-2 font-medium text-purple-300">Archivo</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Tipo Cara</th>
                      <th className="p-2 font-medium text-purple-300">Formato</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Ciudad</th>
                      <th className="p-2 font-medium text-purple-300">Nombre Archivo</th>
                      <th className="p-2 font-medium text-purple-300">Estado Instalación</th>
                    </tr>
                  </thead>
                  <tbody>{filteredInventory.map((item) => renderAtenderRow(item, true, true))}</tbody>
                </table>
              </div>
            ) : activeMainTab === 'programacion' && activeGroupingsProgramacion.length > 0 ? (
              // Vista jerárquica de 3 niveles para Programación (con agrupaciones)
              <div className="divide-y divide-border">
                {Object.entries(programacionGroupedInventory).map(([level1Key, level2Groups]) => {
                  const level1Expanded = expandedNodes.has(`programacion-${level1Key}`);
                  const level1ItemCount = Object.values(level2Groups).reduce(
                    (sum, level3Groups) => sum + Object.values(level3Groups).reduce((s, items) => s + items.length, 0), 0
                  );
                  const getAllLevel1Items = () => Object.values(level2Groups).flatMap(l3 => Object.values(l3).flat());
                  return (
                    <div key={level1Key}>
                      {/* Nivel 1 */}
                      <button
                        onClick={() => toggleNode(`programacion-${level1Key}`)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {level1Expanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-bold text-white">{level1Key}</span>
                        </div>
                        <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                          {level1ItemCount}
                        </Badge>
                      </button>
                      {level1Expanded && (
                        <div className="pl-4">
                          {Object.entries(level2Groups).map(([level2Key, level3Groups]) => {
                            const level2Expanded = expandedNodes.has(`programacion-${level1Key}-${level2Key}`);
                            const level2ItemCount = Object.values(level3Groups).reduce((s, items) => s + items.length, 0);
                            const getAllLevel2Items = () => Object.values(level3Groups).flat();
                            return (
                              <div key={level2Key} className="border-l border-purple-500/20">
                                <button
                                  onClick={() => toggleNode(`programacion-${level1Key}-${level2Key}`)}
                                  className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {level2Expanded ? (
                                      <ChevronDown className="h-3 w-3 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-purple-400" />
                                    )}
                                    <span className="text-xs font-medium text-white">{level2Key}</span>
                                  </div>
                                  <Badge className="bg-purple-500/30 text-purple-200 border-purple-500/20 text-[10px]">
                                    {level2ItemCount}
                                  </Badge>
                                </button>
                                {level2Expanded && (
                                  <div className="pl-4">
                                    {Object.entries(level3Groups).map(([level3Key, items]) => {
                                      const level3Expanded = expandedNodes.has(`programacion-${level1Key}-${level2Key}-${level3Key}`);
                                      return (
                                        <div key={level3Key} className="border-l border-purple-500/10">
                                          <button
                                            onClick={() => toggleNode(`programacion-${level1Key}-${level2Key}-${level3Key}`)}
                                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-purple-900/10 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {level3Expanded ? (
                                                <ChevronDown className="h-3 w-3 text-purple-400/70" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-purple-400/70" />
                                              )}
                                              <span className="text-[11px] text-zinc-300">{level3Key}</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-500">{items.length}</span>
                                          </button>
                                          {level3Expanded && (
                                            <div className="bg-zinc-900/20">
                                              <table className="w-full text-xs">
                                                <thead className="bg-purple-900/20">
                                                  <tr className="border-b border-border text-left">
                                                    <th className="p-2 font-medium text-purple-300">ID</th>
                                                    <th className="p-2 font-medium text-purple-300">Arte</th>
                                                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                                                    <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                                    <th className="p-2 font-medium text-purple-300">Tarea</th>
                                                    <th className="p-2 font-medium text-purple-300">Estado</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {items.map((item) => renderProgramacionRow(item as InventoryRow & { tarea_id?: number; tarea_titulo?: string; estado_programacion?: string }))}
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
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeMainTab === 'programacion' && activeGroupingsProgramacion.length === 0 ? (
              // Tabla plana de Programación (sin agrupaciones)
              <div className="bg-card/50">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-purple-900/20 z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 font-medium text-purple-300">ID</th>
                      <th className="p-2 font-medium text-purple-300">Arte</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Ciudad</th>
                      <th className="p-2 font-medium text-purple-300">Tarea</th>
                      <th className="p-2 font-medium text-purple-300">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProgramacionData.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/50 hover:bg-purple-900/10 transition-colors"
                      >
                        <td className="p-2 text-zinc-300 font-mono">{item.id}</td>
                        <td className="p-2">
                          {item.archivo_arte ? (
                            <div className="w-12 h-10 bg-zinc-800 rounded overflow-hidden">
                              <img
                                src={getImageUrl(item.archivo_arte) || ''}
                                alt="Arte"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-10 bg-zinc-800 rounded flex items-center justify-center">
                              <Image className="h-4 w-4 text-zinc-600" />
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-zinc-300 max-w-[200px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
                        <td className="p-2 text-zinc-400">{item.plaza}</td>
                        <td className="p-2 text-zinc-400">{item.ciudad}</td>
                        <td className="p-2">
                          <span className="text-xs text-purple-300">{item.tarea_titulo || '-'}</span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            item.estado_programacion === 'programado'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {item.estado_programacion === 'programado' ? 'Programado' : 'En Programación'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeMainTab === 'testigo' && activeEstadoInstalacionTab === 'testigo' ? (
              // Vista especial para sub-tab Testigo: agrupada por asignado de tareas Testigo
              <div className="divide-y divide-border">
                {testigoGroupedByAsignado.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 mb-3">
                      <Camera className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-sm text-zinc-400">No hay tareas de testigo creadas</p>
                    <p className="text-xs text-zinc-500 mt-1">Selecciona items en "Instaladas" y crea una tarea tipo Testigo</p>
                  </div>
                ) : (
                  testigoGroupedByAsignado.map((group) => {
                    const groupKey = `testigo-task-${group.tareaId}`;
                    const isExpanded = expandedNodes.has(groupKey);
                    const estatusColors: Record<string, string> = {
                      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                      'Activo': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      'En proceso': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      'Atendido': 'bg-green-500/20 text-green-400 border-green-500/30',
                      'Completado': 'bg-green-500/20 text-green-400 border-green-500/30',
                    };
                    return (
                      <div key={groupKey}>
                        <button
                          onClick={() => toggleNode(groupKey)}
                          className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-purple-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-purple-400" />
                            )}
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-purple-400" />
                              <span className="text-sm font-bold text-white">{group.asignado}</span>
                            </div>
                            <span className="text-xs text-zinc-400">|</span>
                            <span className="text-xs text-zinc-300">{group.tareaTitulo}</span>
                            {group.tareaFechaFin && (
                              <>
                                <span className="text-xs text-zinc-400">|</span>
                                <span className="text-xs text-zinc-400">{group.tareaFechaFin}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${estatusColors[group.tareaEstatus] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                              {group.tareaEstatus}
                            </span>
                            <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                              {group.items.length} items
                            </Badge>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="bg-zinc-900/30 border-l-2 border-purple-500/30">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border text-left">
                                  <th className="p-2 pl-6 font-medium text-purple-300">Código</th>
                                  <th className="p-2 font-medium text-purple-300">Tipo Cara</th>
                                  <th className="p-2 font-medium text-purple-300">Catorcena</th>
                                  <th className="p-2 font-medium text-purple-300">APS</th>
                                  <th className="p-2 font-medium text-purple-300">Plaza</th>
                                  <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                  <th className="p-2 font-medium text-purple-300">Testigo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((item) => (
                                  <tr key={item.id} className="border-b border-border/50 hover:bg-zinc-800/30">
                                    <td className="p-2 pl-6 text-white font-mono">{item.codigo_unico}</td>
                                    <td className="p-2 text-zinc-300">{item.tipo_de_cara}</td>
                                    <td className="p-2 text-zinc-300">{item.catorcena}</td>
                                    <td className="p-2 text-zinc-300">{item.aps || '-'}</td>
                                    <td className="p-2 text-zinc-300">{item.plaza}</td>
                                    <td className="p-2 text-zinc-300">{item.ciudad}</td>
                                    <td className="p-2">
                                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                        item.testigo_status === 'validado'
                                          ? 'bg-green-500/20 text-green-400'
                                          : 'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {item.testigo_status === 'validado' ? 'Validado' : 'Pendiente'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : activeMainTab === 'testigo' && activeGroupingsTestigo.length > 0 ? (
              // Vista jerárquica de 3 niveles para Validar Instalación (con agrupaciones)
              <div className="divide-y divide-border">
                {Object.entries(testigoGroupedInventory).map(([level1Key, level2Groups]) => {
                  const level1Expanded = expandedNodes.has(`testigo-${level1Key}`);
                  const level1ItemCount = Object.values(level2Groups).reduce(
                    (sum, level3Groups) => sum + Object.values(level3Groups).reduce((s, items) => s + items.length, 0), 0
                  );
                  const getAllLevel1Items = () => Object.values(level2Groups).flatMap(l3 => Object.values(l3).flat());
                  // Calcular conteo de validados y pendientes
                  const allItems = getAllLevel1Items();
                  const validadosCount = allItems.filter(item => (item as any).testigo_status === 'validado').length;
                  const pendientesCount = allItems.filter(item => (item as any).testigo_status !== 'validado').length;
                  return (
                    <div key={level1Key}>
                      {/* Nivel 1 */}
                      <button
                        onClick={() => toggleNode(`testigo-${level1Key}`)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {level1Expanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-bold text-white">{level1Key}</span>
                          <div
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              const allItems = getAllLevel1Items();
                              const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                              setSelectedInventoryIds(prev => {
                                const next = new Set(prev);
                                allItems.forEach(item => {
                                  if (allSelected) next.delete(item.id);
                                  else next.add(item.id);
                                });
                                return next;
                              });
                            }}
                            className={`ml-2 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                              getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-purple-500/50 hover:border-purple-400'
                            }`}
                          >
                            {getAllLevel1Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel1Items().length > 0 && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Etiquetas de estado de validación */}
                          {pendientesCount > 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              {pendientesCount} sin validar
                            </span>
                          )}
                          {validadosCount > 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                              {validadosCount} validado{validadosCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                            {level1ItemCount}
                          </Badge>
                        </div>
                      </button>
                      {level1Expanded && (
                        <div className="pl-4">
                          {Object.entries(level2Groups).map(([level2Key, level3Groups]) => {
                            const level2NodeKey = `testigo-${level1Key}|${level2Key}`;
                            const level2Expanded = expandedNodes.has(level2NodeKey);
                            const level2ItemCount = Object.values(level3Groups).reduce((s, items) => s + items.length, 0);
                            const getAllLevel2Items = () => Object.values(level3Groups).flat();
                            return (
                              <div key={level2NodeKey} className="border-l-2 border-purple-600/30">
                                {/* Nivel 2 */}
                                <button
                                  onClick={() => toggleNode(level2NodeKey)}
                                  className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {level2Expanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                    )}
                                    <span className="text-xs font-semibold text-purple-300">{level2Key}</span>
                                    <div
                                      role="checkbox"
                                      tabIndex={0}
                                      aria-checked={getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const allItems = getAllLevel2Items();
                                        const allSelected = allItems.every(item => selectedInventoryIds.has(item.id));
                                        setSelectedInventoryIds(prev => {
                                          const next = new Set(prev);
                                          allItems.forEach(item => {
                                            if (allSelected) next.delete(item.id);
                                            else next.add(item.id);
                                          });
                                          return next;
                                        });
                                      }}
                                      className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                        getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0
                                          ? 'bg-purple-600 border-purple-600'
                                          : 'border-purple-500/50 hover:border-purple-400'
                                      }`}
                                    >
                                      {getAllLevel2Items().every(item => selectedInventoryIds.has(item.id)) && getAllLevel2Items().length > 0 && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </div>
                                  </div>
                                  <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/20 text-[10px]">
                                    {level2ItemCount}
                                  </Badge>
                                </button>
                                {level2Expanded && (
                                  <div className="pl-4">
                                    {Object.entries(level3Groups).map(([level3Key, items]) => {
                                      const level3NodeKey = `${level2NodeKey}|${level3Key}`;
                                      const level3Expanded = expandedNodes.has(level3NodeKey);
                                      return (
                                        <div key={level3NodeKey} className="border-l-2 border-amber-500/20">
                                          {/* Nivel 3 */}
                                          <button
                                            onClick={() => toggleNode(level3NodeKey)}
                                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {level3Expanded ? (
                                                <ChevronDown className="h-3 w-3 text-amber-400" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-amber-400" />
                                              )}
                                              <span className="text-[11px] font-medium text-amber-300">{level3Key}</span>
                                              <div
                                                role="checkbox"
                                                tabIndex={0}
                                                aria-checked={items.every(item => selectedInventoryIds.has(item.id))}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const allSelected = items.every(item => selectedInventoryIds.has(item.id));
                                                  setSelectedInventoryIds(prev => {
                                                    const next = new Set(prev);
                                                    items.forEach(item => {
                                                      if (allSelected) next.delete(item.id);
                                                      else next.add(item.id);
                                                    });
                                                    return next;
                                                  });
                                                }}
                                                className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                                  items.every(item => selectedInventoryIds.has(item.id))
                                                    ? 'bg-amber-600 border-amber-600'
                                                    : 'border-amber-500/50 hover:border-amber-400'
                                                }`}
                                              >
                                                {items.every(item => selectedInventoryIds.has(item.id)) && (
                                                  <Check className="h-2.5 w-2.5 text-white" />
                                                )}
                                              </div>
                                            </div>
                                            <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/20 text-[10px]">
                                              {items.length}
                                            </Badge>
                                          </button>
                                          {level3Expanded && (
                                            <div className="bg-card/50 ml-4">
                                              <table className="w-full text-xs">
                                                <thead className="bg-purple-900/20">
                                                  <tr className="border-b border-border text-left">
                                                    <th className="p-2 w-8"></th>
                                                    <th className="p-2 font-medium text-purple-300">ID</th>
                                                    <th className="p-2 font-medium text-purple-300">Arte Aprobado</th>
                                                    <th className="p-2 font-medium text-purple-300">Archivo</th>
                                                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                                    <th className="p-2 font-medium text-purple-300">Tipo Cara</th>
                                                    <th className="p-2 font-medium text-purple-300">Formato</th>
                                                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                                                    <th className="p-2 font-medium text-purple-300">Ciudad</th>
                                                    <th className="p-2 font-medium text-purple-300">Nombre Archivo</th>
                                                    <th className="p-2 font-medium text-purple-300">Estado Instalación</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {items.map((item) => renderAtenderRow(item, true, true))}
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
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeMainTab === 'testigo' && activeGroupingsTestigo.length === 0 ? (
              // Tabla plana de Validar Instalación (sin agrupaciones)
              <div className="bg-card/50">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-purple-900/20 z-10">
                    <tr className="border-b border-border text-left">
                      <th className="p-2 w-8">
                        <button
                          onClick={() => {
                            const allSelected = filteredTestigoData.every(item => selectedInventoryIds.has(item.id));
                            setSelectedInventoryIds(prev => {
                              const next = new Set(prev);
                              filteredTestigoData.forEach(item => {
                                if (allSelected) next.delete(item.id);
                                else next.add(item.id);
                              });
                              return next;
                            });
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            filteredTestigoData.every(item => selectedInventoryIds.has(item.id)) && filteredTestigoData.length > 0
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-purple-500/50 hover:border-purple-400'
                          }`}
                        >
                          {filteredTestigoData.every(item => selectedInventoryIds.has(item.id)) && filteredTestigoData.length > 0 && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 font-medium text-purple-300">ID</th>
                      <th className="p-2 font-medium text-purple-300">Arte Aprobado</th>
                      <th className="p-2 font-medium text-purple-300">Archivo</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Tipo Cara</th>
                      <th className="p-2 font-medium text-purple-300">Formato</th>
                      <th className="p-2 font-medium text-purple-300">Plaza</th>
                      <th className="p-2 font-medium text-purple-300">Ciudad</th>
                      <th className="p-2 font-medium text-purple-300">Nombre Archivo</th>
                      <th className="p-2 font-medium text-purple-300">Estado Instalación</th>
                    </tr>
                  </thead>
                  <tbody>{filteredTestigoData.map((item) => renderAtenderRow(item, true, true))}</tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        {/* ================================================================ */}
        {/* BLOQUE B: GESTION DE TAREAS (SECUNDARIO) */}
        {/* ================================================================ */}
        <div className="bg-card rounded-xl border border-border">
          {/* Tasks Header */}
          <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-blue-900/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <ClipboardList className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Tareas de Produccion</h3>
                <p className="text-xs text-zinc-400">Gestiona las tareas de instalacion y produccion de esta campaña</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {tasks.length} activas
                </Badge>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  {completedTasks.length} completadas
                </Badge>
              </div>
            </div>
          </div>

          {/* Tasks Tabs */}
          <div className="border-b border-border">
            <div className="flex">
              {([
                { key: 'tradicionales', label: 'Activas', icon: Clock },
                { key: 'completadas', label: 'Completadas', icon: CheckCircle2 },
                { key: 'calendario', label: 'Calendario', icon: CalendarIcon },
              ] as { key: TasksTab; label: string; icon: typeof Clock }[]).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTasksTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTasksTab === tab.key
                        ? 'border-blue-500 text-blue-300'
                        : 'border-transparent text-muted-foreground hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tasks Content */}
          <div className="p-4">
            {activeTasksTab === 'tradicionales' && (
              <div className="space-y-4">
                {/* Tasks Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">{filteredTasks.length} de {tasks.length} tareas activas</span>
                    <div className="relative min-w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Buscar por título, ID, asignado..."
                        value={tasksSearch}
                        onChange={(e) => setTasksSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 w-64"
                      />
                      {tasksSearch && (
                        <button
                          onClick={() => setTasksSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FilterToolbar
                      filters={filtersTareas}
                      showFilters={showFiltersTareas}
                      setShowFilters={setShowFiltersTareas}
                      addFilter={addFilterTareas}
                      updateFilter={updateFilterTareas}
                      removeFilter={removeFilterTareas}
                      clearFilters={clearFiltersTareas}
                      uniqueValues={getUniqueValuesTareas}
                      activeGroupings={activeGroupingsTareas}
                      showGrouping={showGroupingTareas}
                      setShowGrouping={setShowGroupingTareas}
                      toggleGrouping={toggleGroupingTareas}
                      clearGroupings={clearGroupingsTareas}
                      sortField={sortFieldTareas}
                      sortDirection={sortDirectionTareas}
                      showSort={showSortTareas}
                      setShowSort={setShowSortTareas}
                      setSortField={setSortFieldTareas}
                      setSortDirection={setSortDirectionTareas}
                      filteredCount={filteredTasks.length}
                      totalCount={tasks.length}
                      filterFields={FILTER_FIELDS_TAREAS}
                      hideGrouping
                      hideSort
                    />
                    <button
                      onClick={downloadTareasExcel}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-900/50 hover:bg-green-900/70 border border-green-500/30 rounded-lg transition-colors"
                      title="Descargar Excel (Activas + Completadas)"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] })}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                      title="Refrescar tareas"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tasks Table */}
                <div className="max-h-[300px] overflow-auto border border-border rounded-lg">
                  {filteredTasks.length === 0 ? (
                    <EmptyState
                      message="Sin tareas activas"
                      description="Las tareas se crean desde la seccion 'Revisar y Aprobar' cuando seleccionas artes"
                      icon={ClipboardList}
                    />
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border text-left">
                          <th className="p-2 font-medium text-purple-300">Tipo</th>
                          <th className="p-2 font-medium text-purple-300">Estatus</th>
                          <th className="p-2 font-medium text-purple-300">Identificador</th>
                          <th className="p-2 font-medium text-purple-300">Fecha inicio</th>
                          <th className="p-2 font-medium text-purple-300">Fecha fin</th>
                          <th className="p-2 font-medium text-purple-300">Creador</th>
                          <th className="p-2 font-medium text-purple-300">Asignado</th>
                          <th className="p-2 font-medium text-purple-300">Descripcion</th>
                          <th className="p-2 font-medium text-purple-300">Titulo</th>
                          <th className="p-2 font-medium text-purple-300">Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((task) => (
                          <tr key={task.id} className="border-b border-border/50 hover:bg-purple-900/20 transition-colors">
                            <td className="p-2 text-zinc-300">{task.tipo}</td>
                            <td className="p-2"><StatusBadge status={task.estatus} /></td>
                            <td className="p-2 font-medium text-white">{task.titulo || task.identificador}</td>
                            <td className="p-2 text-zinc-300">{task.fecha_inicio}</td>
                            <td className="p-2 text-zinc-300">{task.fecha_fin}</td>
                            <td className="p-2 text-zinc-300">{task.creador}</td>
                            <td className="p-2 text-zinc-300">{task.asignado}</td>
                            <td className="p-2 text-zinc-300 max-w-[150px] truncate">{task.descripcion}</td>
                            <td className="p-2 text-zinc-300">{task.titulo}</td>
                            <td className="p-2">
                              <button
                                onClick={() => {
                                  setSelectedTask(task);
                                  setIsTaskDetailModalOpen(true);
                                }}
                                className="px-2 py-1 text-[10px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                              >
                                Abrir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTasksTab === 'completadas' && (
              <div className="space-y-4">
                <div className="relative max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={tasksSearch}
                    onChange={(e) => setTasksSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="max-h-[300px] overflow-auto border border-border rounded-lg">
                  {filteredCompletedTasks.length === 0 ? (
                    <EmptyState
                      message="Sin tareas completadas"
                      description="Las tareas completadas apareceran aqui cuando se finalicen"
                      icon={CheckCircle2}
                    />
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border text-left">
                          <th className="p-2 font-medium text-purple-300">ID</th>
                          <th className="p-2 font-medium text-purple-300">Tipo</th>
                          <th className="p-2 font-medium text-purple-300">Estatus</th>
                          <th className="p-2 font-medium text-purple-300">Titulo</th>
                          <th className="p-2 font-medium text-purple-300">Fecha inicio</th>
                          <th className="p-2 font-medium text-purple-300">Fecha fin</th>
                          <th className="p-2 font-medium text-purple-300">Creador</th>
                          <th className="p-2 font-medium text-purple-300">Asignado</th>
                          <th className="p-2 font-medium text-purple-300">Descripcion</th>
                          <th className="p-2 font-medium text-purple-300">Contenido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompletedTasks.map((task) => (
                          <tr key={task.id} className="border-b border-border/50 hover:bg-purple-900/20 transition-colors">
                            <td className="p-2 font-medium text-white">{task.titulo || task.identificador}</td>
                            <td className="p-2 text-zinc-300">{task.tipo}</td>
                            <td className="p-2"><StatusBadge status={task.estatus} /></td>
                            <td className="p-2 text-zinc-300">{task.titulo}</td>
                            <td className="p-2 text-zinc-300">{task.fecha_inicio}</td>
                            <td className="p-2 text-zinc-300">{task.fecha_fin}</td>
                            <td className="p-2 text-zinc-300">{task.creador}</td>
                            <td className="p-2 text-zinc-300">{task.asignado}</td>
                            <td className="p-2 text-zinc-300 max-w-[150px] truncate">{task.descripcion}</td>
                            <td className="p-2 text-zinc-300 max-w-[150px] truncate">{task.contenido}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTasksTab === 'calendario' && (
              <SimpleCalendar
                view={calendarView}
                events={[...tasks, ...completedTasks].map(t => ({
                  id: t.id,
                  title: t.titulo,
                  date: new Date(t.fecha_fin),
                  type: 'tarea' as const,
                }))}
                currentDate={calendarDate}
                onViewChange={setCalendarView}
                onDateChange={setCalendarDate}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateTaskError(null);
        }}
        selectedCount={selectedInventoryIds.size}
        selectedIds={Array.from(selectedInventoryIds).map(String)}
        selectedInventory={selectedInventoryItems}
        campanaId={campanaId}
        onSubmit={handleCreateTask}
        proveedores={proveedores}
        isLoadingProveedores={isLoadingProveedores}
        isSubmitting={createTareaMutation.isPending}
        error={createTaskError}
        initialTipo={initialTaskTipo}
        availableTipos={availableTaskTipos}
      />

      {/* Confirm Clear Art Modal */}
      {isConfirmClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsConfirmClearModalOpen(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Confirmar limpieza de arte</h3>
            </div>

            <p className="text-sm text-zinc-300 mb-4">
              Los inventarios seleccionados pertenecen a las siguientes tareas activas:
            </p>

            <div className="bg-zinc-800 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              {tareasAfectadas.map((tarea) => (
                <div key={tarea.id} className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{tarea.titulo || 'Sin título'}</p>
                    <p className="text-xs text-zinc-400">{tarea.tipo} • {tarea.estatus}</p>
                  </div>
                  <span className="text-xs text-zinc-500">#{tarea.id}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-amber-400 mb-4">
              Al limpiar el arte, estos inventarios se eliminarán de las tareas. Si una tarea queda sin inventarios, será eliminada.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmClearModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const reservaIds = selectedInventoryItems.flatMap(item =>
                    item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                  );
                  assignArteMutation.mutate({ reservaIds, archivo: '' });
                  setSelectedInventoryIds(new Set());
                  setIsConfirmClearModalOpen(false);
                  setTareasAfectadas([]);
                }}
                disabled={assignArteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {assignArteMutation.isPending ? 'Limpiando...' : 'Sí, limpiar arte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal - Tareas existentes al crear tarea */}
      {isTaskWarningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsTaskWarningModalOpen(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Inventarios ya asignados</h3>
            </div>

            <p className="text-sm text-zinc-300 mb-4">
              Algunos de los inventarios seleccionados ya pertenecen a tareas activas:
            </p>

            <div className="bg-zinc-800 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
              {existingTasksForCreate.map((tarea) => (
                <div key={tarea.id} className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tarea.titulo || 'Sin título'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-purple-400">{tarea.tipo}</span>
                      <span className="text-xs text-zinc-500">•</span>
                      <span className="text-xs text-zinc-400">{tarea.estatus}</span>
                      {tarea.responsable && (
                        <>
                          <span className="text-xs text-zinc-500">•</span>
                          <span className="text-xs text-zinc-400">{tarea.responsable}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 ml-2">#{tarea.id}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-amber-400 mb-4">
              ¿Deseas continuar y crear una nueva tarea con estos inventarios?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsTaskWarningModalOpen(false);
                  setExistingTasksForCreate([]);
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsTaskWarningModalOpen(false);
                  setExistingTasksForCreate([]);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Continuar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Art Modal */}
      <UploadArtModal
        isOpen={isUploadArtModalOpen}
        onClose={() => {
          setIsUploadArtModalOpen(false);
          setUploadArtError(null);
        }}
        selectedInventory={selectedInventoryItems}
        onSubmit={handleUploadArt}
        onSubmitDigital={handleUploadDigitalArt}
        artesExistentes={artesExistentes}
        isLoadingArtes={isLoadingArtes}
        isSubmitting={assignArteMutation.isPending}
        error={uploadArtError}
        campanaId={campanaId}
      />

      {/* Digital Gallery Modal */}
      <DigitalGalleryModal
        isOpen={isDigitalGalleryOpen}
        onClose={() => {
          setIsDigitalGalleryOpen(false);
          setDigitalGalleryImages([]);
        }}
        imagenes={digitalGalleryImages}
        isLoading={isLoadingDigitalGallery}
        title={digitalGalleryTitle}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isTaskDetailModalOpen}
        onClose={() => {
          setIsTaskDetailModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        inventoryData={inventoryArteData}
        artesExistentes={artesExistentes}
        isLoadingArtes={isLoadingArtes}
        onApprove={async (reservaIds, comentario) => {
          await updateArteStatusMutation.mutateAsync({ reservaIds, status: 'Aprobado', comentario });
        }}
        onReject={async (reservaIds, comentario) => {
          // Primero actualizar el estado a Rechazado
          await updateArteStatusMutation.mutateAsync({ reservaIds, status: 'Rechazado', comentario });
          // Después de rechazar exitosamente, crear tarea de corrección para el creador original
          if (selectedTask && selectedTask.creador) {
            await createTareaMutation.mutateAsync({
              titulo: `Corrección de artes - Rechazo`,
              descripcion: `Artes rechazados con el siguiente motivo:

${comentario || 'Sin motivo especificado'}

Por favor corrige los artes y vuelve a enviar a revisión.`,
              tipo: 'Correccion',
              asignado: selectedTask.creador,
              ids_reservas: reservaIds.join(','),
            });
          }
        }}
        onCorrect={(reservaIds, instrucciones) => {
          // Establecer estado a Pendiente (no Rechazado) y crear tarea de corrección
          updateArteStatusMutation.mutateAsync({ reservaIds, status: 'Pendiente', comentario: instrucciones })
            .then(() => {
              // Crear tarea de corrección para el creador original
              if (selectedTask && selectedTask.creador) {
                createTareaMutation.mutate({
                  titulo: `Corrección de artes - Ajustes necesarios`,
                  descripcion: `Se requieren ajustes en los artes:

${instrucciones || 'Sin instrucciones especificadas'}

Por favor realiza los ajustes indicados y vuelve a enviar a revisión.`,
                  tipo: 'Correccion',
                  asignado: selectedTask.creador,
                  ids_reservas: reservaIds.join(','),
                });
              }
            });
        }}
        onUpdateArte={(reservaIds, archivo) => {
          assignArteMutation.mutate({ reservaIds, archivo });
        }}
        onUpdateArteDigital={async (reservaIds, files, deleteArchivos) => {
          // 1. Primero eliminar los archivos marcados para eliminación (usando modo por archivos + reservaIds)
          if (deleteArchivos && deleteArchivos.length > 0) {
            // Usar el nuevo modo que elimina por archivo path en todas las reservas seleccionadas
            await campanasService.deleteImagenesDigitales(campanaId, undefined, deleteArchivos, reservaIds);
          }

          // 2. Luego agregar los nuevos archivos (si hay)
          if (files.length > 0) {
            // Convertir todos los archivos a base64 con su spot
            const filesWithBase64 = await Promise.all(
              files.map(async ({ file, spot }) => {
                const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = () => reject(new Error(`Error al leer el archivo ${file.name}`));
                  reader.readAsDataURL(file);
                });
                return {
                  archivo: base64,
                  spot,
                  nombre: file.name,
                  tipo: file.type.startsWith('video/') ? 'video' : 'image',
                };
              })
            );
            // Llamar al servicio para agregar nuevos archivos digitales (sin eliminar los existentes)
            await campanasService.addArteDigital(campanaId, reservaIds, filesWithBase64);
          }

          // Invalidar queries
          queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
          queryClient.invalidateQueries({ queryKey: ['digital-file-summaries', campanaId] });
        }}
        onTaskComplete={async (taskId, observaciones) => {
          await updateTareaMutation.mutateAsync({
            tareaId: parseInt(taskId),
            data: {
              estatus: 'Atendido',
              ...(observaciones && { contenido: observaciones })
            }
          });
        }}
        onSendToReview={async (reservaIds, responsableOriginal) => {
          // Cambiar estado de artes a Pendiente (para que vuelvan a revisión)
          await updateArteStatusMutation.mutateAsync({ reservaIds, status: 'Pendiente', comentario: 'Arte corregido y enviado a revisión' });
          // Crear nueva tarea de Revisión de artes asignada al revisor original
          await createTareaMutation.mutateAsync({
            titulo: `Revisión de artes - Corrección enviada`,
            descripcion: `Los artes han sido corregidos y están listos para revisión.`,
            tipo: 'Revision de artes',
            asignado: responsableOriginal,
            ids_reservas: reservaIds.join(','),
          });
        }}
        onCreateRecepcion={async (tareaImpresionId, asignadoNombre) => {
          if (!selectedTask) return;

          // 1. Marcar la tarea de Impresión como "Atendido"
          await updateTareaMutation.mutateAsync({
            tareaId: parseInt(tareaImpresionId),
            data: { estatus: 'Atendido' }
          });

          // 2. Crear nueva tarea de Recepción con el num_impresiones y evidencia de la tarea original
          const numImpresiones = selectedTask.num_impresiones || selectedTask.inventario_ids?.length || 0;

          // Crear evidencia para la recepción con el desglose por arte de la tarea de impresión
          let evidenciaRecepcion = selectedTask.evidencia;
          try {
            const evidenciaObj = evidenciaRecepcion ? JSON.parse(evidenciaRecepcion) : {};
            // Agregar tipo para identificar que es recepción normal (no faltantes)
            evidenciaObj.tipo = 'recepcion_normal';
            evidenciaRecepcion = JSON.stringify(evidenciaObj);
          } catch (e) {
            // Si no es JSON válido, crear objeto nuevo
            evidenciaRecepcion = JSON.stringify({ tipo: 'recepcion_normal' });
          }

          // Usar el usuario seleccionado o fallback al asignado/creador original
          const asignadoFinal = asignadoNombre || selectedTask.asignado || selectedTask.creador || '';

          await createTareaMutation.mutateAsync({
            titulo: `Recepción - ${selectedTask.titulo || selectedTask.identificador}`,
            descripcion: `Tarea de recepción de impresiones.
Total de impresiones solicitadas: ${numImpresiones}

Por favor registra la cantidad de impresiones recibidas.`,
            tipo: 'Recepción',
            asignado: asignadoFinal,
            ids_reservas: selectedTask.inventario_ids?.join(',') || '',
            num_impresiones: numImpresiones,
            evidencia: evidenciaRecepcion,
          });

          // Refrescar lista de tareas
          queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
        }}
        onCreateRecepcionFaltante={async (faltantes, observaciones) => {
          if (!selectedTask) return;

          // Construir descripción con detalle de faltantes
          const detallesFaltantes = faltantes.map(f =>
            `- ${f.arte.split('/').pop() || 'Sin arte'}: Faltantes ${f.faltantes}`
          ).join('\n');

          const totalFaltantes = faltantes.reduce((sum, f) => sum + f.faltantes, 0);

          // Extraer identificador base (evitar concatenación de títulos)
          const identificadorBase = selectedTask.identificador ||
            (selectedTask.titulo?.match(/TASK-\d+/) || [''])[0] ||
            `TASK-${selectedTask.id}`;

          // Guardar info de faltantes en evidencia para que el modal lo lea correctamente
          const evidenciaFaltantes = JSON.stringify({
            tipo: 'recepcion_faltantes',
            faltantesPorArte: faltantes.map(f => ({
              arte: f.arte,
              cantidad: f.faltantes
            })),
            totalFaltantes
          });

          await createTareaMutation.mutateAsync({
            titulo: `Recepción Faltantes - ${identificadorBase}`,
            descripcion: `Tarea de recepción de impresiones faltantes.

Impresiones solicitadas: ${totalFaltantes}

Detalle por arte:
${detallesFaltantes}

${observaciones ? `Observaciones de recepción anterior:\n${observaciones}` : ''}

Por favor registra la cantidad de impresiones recibidas.`,
            tipo: 'Recepción',
            asignado: selectedTask.asignado || selectedTask.creador || '',
            ids_reservas: selectedTask.inventario_ids?.join(',') || '',
            evidencia: evidenciaFaltantes,
            num_impresiones: totalFaltantes,
          });

          // Refrescar lista de tareas
          queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
        }}
        onUpdateTask={async (taskId, data) => {
          await updateTareaMutation.mutateAsync({
            tareaId: parseInt(taskId),
            data
          });
          // Si se está marcando como completada, cerrar el modal
          if (data.estatus === 'Completado') {
            setIsTaskDetailModalOpen(false);
            setSelectedTask(null);
          }
        }}
        isUpdating={updateArteStatusMutation.isPending || assignArteMutation.isPending}
        campanaId={campanaId}
        canResolveProduccionTasks={permissions.canResolveProduccionTasks}
        canResolveRevisionArtesTasks={permissions.canResolveRevisionArtesTasks}
        digitalSummaryMap={digitalSummaryMap}
      />
    </div>
  );
}
