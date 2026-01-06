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
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioConArte, TareaCampana, ArteExistente } from '../../services/campanas.service';
import { proveedoresService } from '../../services/proveedores.service';
import { Proveedor, Catorcena } from '../../types';
import { solicitudesService } from '../../services/solicitudes.service';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../../store/authStore';

// URL base para archivos estáticos
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

// Helper para normalizar URLs de imágenes
const getImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  
  // Si es un data URL (base64), usarlo directamente
  if (url.startsWith('data:')) {
    
    return url;
  }
  // Si ya es una URL completa, usarla tal cual
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Si es una ruta relativa, agregar la URL base
  if (url.startsWith('/')) {
    return `${STATIC_URL}${url}`;
  }
  // Si no tiene slash al inicio, agregarlo
  return `${STATIC_URL}/${url}`;
};

// ============================================================================
// TYPES
// ============================================================================

type MainTab = 'versionario' | 'atender' | 'testigo';
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
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'tarea' | 'entrega';
}

// Tipos para el sistema de decisiones de revisión de artes
type DecisionArte = 'aprobar' | 'rechazar' | 'corregir' | null;

interface ArteDecision {
  decision: DecisionArte;
  motivoRechazo?: string;
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
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">{message}</p>
      {description && <p className="text-xs mt-1 text-center max-w-xs">{description}</p>}
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

// Upload Art Modal Component
function UploadArtModal({
  isOpen,
  onClose,
  selectedInventory,
  onSubmit,
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

  // Manejar cambio de archivo
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

  const handleSubmit = () => {
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
}

function FilterToolbar({
  filters, showFilters, setShowFilters, addFilter, updateFilter, removeFilter, clearFilters, uniqueValues,
  activeGroupings, showGrouping, setShowGrouping, toggleGrouping, clearGroupings,
  sortField, sortDirection, showSort, setShowSort, setSortField, setSortDirection,
  filteredCount, totalCount,
}: FilterToolbarProps) {
  // Función para cerrar un dropdown específico al hacer clic fuera
  const closeOtherDropdowns = (keep: 'filters' | 'grouping' | 'sort') => {
    if (keep !== 'filters') setShowFilters(false);
    if (keep !== 'grouping') setShowGrouping(false);
    if (keep !== 'sort') setShowSort(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón Filtrar */}
      <div className="relative">
        <button
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
          <div className="absolute right-0 top-full mt-1 z-50 w-[520px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4">
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
                    {FILTER_FIELDS_INVENTARIO.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                  </select>
                  <select value={filter.operator} onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })} className="w-[90px] text-xs bg-background border border-border rounded px-2 py-1.5">
                    {FILTER_OPERATORS.filter(op => { const fc = FILTER_FIELDS_INVENTARIO.find(f => f.field === filter.field); return fc && op.forTypes.includes(fc.type); }).map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
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
      <div className="relative">
        <button
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
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Agrupar por (max 5)</p>
              <button onClick={() => setShowGrouping(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            {GROUPING_OPTIONS_INVENTARIO.map(({ field, label }) => {
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

      {/* Botón Ordenar */}
      <div className="relative">
        <button
          onClick={() => { closeOtherDropdowns('sort'); setShowSort(!showSort); }}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${sortField ? 'bg-purple-600 text-white' : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'}`}
          title="Ordenar"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
        {showSort && (
          <div className="absolute right-0 top-full mt-1 z-50 w-[240px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-300">Ordenar por</span>
              <button onClick={() => setShowSort(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {FILTER_FIELDS_INVENTARIO.map((field) => (
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
    </div>
  );
}

// Comments Section Component
function CommentsSection({ campanaId }: { campanaId: number }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Obtener comentarios de la campaña
  const { data: campana } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
    enabled: campanaId > 0,
  });

  const comentarios = campana?.comentarios || [];

  // Mutación para agregar comentario
  const addCommentMutation = useMutation({
    mutationFn: (contenido: string) => campanasService.addComment(campanaId, contenido),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['campana', campanaId] });
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
    <div className="flex flex-col h-full">
      {/* Lista de comentarios */}
      <div className="flex-1 overflow-y-auto divide-y divide-purple-900/20 max-h-[300px] mb-3 scrollbar-purple">
        {comentarios.length === 0 ? (
          <div className="text-center py-6 text-zinc-400">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No hay comentarios aún</p>
          </div>
        ) : (
          [...comentarios].reverse().map((c: { id: number; autor_nombre?: string; fecha: string; contenido: string }) => (
            <div key={c.id} className="flex gap-2 py-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-medium text-white">
                {(c.autor_nombre || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-white">{c.autor_nombre || 'Usuario'}</span>
                  <span className="text-[9px] text-zinc-500">{formatDate(c.fecha)}</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5 break-words">{c.contenido}</p>
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
  onUpdateArte,
  isUpdating,
  campanaId,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: TaskRow | null;
  inventoryData: InventoryRow[];
  artesExistentes: ArteExistente[];
  isLoadingArtes: boolean;
  onApprove: (reservaIds: number[]) => void;
  onReject: (reservaIds: number[], comentario: string) => void;
  onUpdateArte: (reservaIds: number[], archivo: string) => void;
  isUpdating: boolean;
  campanaId: number;
}) {
  const [activeTab, setActiveTab] = useState<TaskDetailTab>('resumen');
  const [selectedArteIds, setSelectedArteIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupByArte>('inventario');

  // Estados para el sistema de decisiones de revisión
  const [decisiones, setDecisiones] = useState<DecisionesState>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isFinalizando, setIsFinalizando] = useState(false);

  // Estados para editar arte
  const [uploadOption, setUploadOption] = useState<UploadOption>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [existingArtUrl, setExistingArtUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Filtrar inventario que pertenece a esta tarea
  const taskInventory = useMemo(() => {
    if (!task) return [];

    // Los inventario_ids de la tarea son IDs de reserva
    const taskReservaIds = new Set(
      task.inventario_ids?.map(id => id.trim()) || []
    );

    if (taskReservaIds.size === 0) return [];

    return inventoryData.filter(item => {
      const itemReservaIds = item.rsv_id.split(',').map(id => id.trim());
      return itemReservaIds.some(id => taskReservaIds.has(id));
    });
  }, [task, inventoryData]);

  // Items seleccionados
  const selectedArteItems = useMemo(() => {
    return taskInventory.filter(item => selectedArteIds.has(item.id));
  }, [taskInventory, selectedArteIds]);

  // Agrupar inventario para tab Atender
  const groupedInventory = useMemo(() => {
    const groups: Record<string, InventoryRow[]> = {};
    taskInventory.forEach(item => {
      let key = '';
      switch (groupBy) {
        case 'ciudad':
          key = item.ciudad || 'Sin ciudad';
          break;
        case 'grupo':
          key = item.grupo_id || item.id;
          break;
        default:
          key = item.id;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [taskInventory, groupBy]);

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
        motivoRechazo: decision !== 'rechazar' ? undefined : prev[key]?.motivoRechazo
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
      const aprobados: number[] = [];
      const rechazados: { ids: number[]; motivo: string; items: InventoryRow[] }[] = [];

      Object.entries(groupedInventory).forEach(([key, items]) => {
        const d = decisiones[key];
        const ids = items.flatMap(item =>
          item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        );

        if (d?.decision === 'aprobar') {
          aprobados.push(...ids);
        }
        if (d?.decision === 'rechazar') {
          rechazados.push({ ids, motivo: d.motivoRechazo || '', items });
        }
        // 'corregir' no hace nada por ahora, solo marca para corrección
      });

      // Aprobar todos los marcados como aprobados
      if (aprobados.length > 0) {
        onApprove(aprobados);
      }

      // Rechazar y crear tarea de corrección con todos los rechazados
      if (rechazados.length > 0) {
        const todosIds = rechazados.flatMap(r => r.ids);
        const descripcion = rechazados.map(r =>
          `**${r.items.map(i => i.codigo_unico).join(', ')}:**\n${r.motivo}`
        ).join('\n\n---\n\n');

        onReject(todosIds, descripcion);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
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
        // Subir el archivo al servidor primero
        const uploadResult = await campanasService.uploadArteFile(selectedFile);
        archivo = uploadResult.url;
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
        // Subir el archivo al servidor primero
        const uploadResult = await campanasService.uploadArteFile(selectedFile);
        archivo = uploadResult.url;
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('resumen');
      setSelectedArteIds(new Set());
      setSelectedFile(null);
      setFilePreview(null);
      setExistingArtUrl('');
      setLinkUrl('');
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const tabs = [
    { key: 'resumen' as const, label: 'Paso 1: Resumen', icon: FileText },
    { key: 'editar' as const, label: 'Paso 2: Editar Arte', icon: Edit3 },
    { key: 'atender' as const, label: 'Paso 3: Atender Arte', icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-card border border-border rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-purple-900/30 to-transparent flex-shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-purple-400" />
                Tarea: {task.identificador}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {task.tipo} - {task.titulo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mt-4">
            {tabs.map((tab) => (
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Tab Resumen */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda - Info de la tarea */}
              <div className="space-y-4">
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-purple-300 mb-3">Informacion de la Tarea</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
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
                  {task.descripcion && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-zinc-500 text-sm">Descripcion:</span>
                      <p className="text-white text-sm mt-1">{task.descripcion}</p>
                    </div>
                  )}
                  {task.contenido && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-zinc-500 text-sm">Contenido:</span>
                      <p className="text-white text-sm mt-1">{task.contenido}</p>
                    </div>
                  )}
                </div>

                {/* Mapa placeholder */}
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-border h-64 flex items-center justify-center">
                  <div className="text-center text-zinc-500">
                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Mapa de ubicaciones</p>
                    <p className="text-xs mt-1">{taskInventory.length} ubicaciones</p>
                  </div>
                </div>
              </div>

              {/* Columna Derecha - Lista de artes */}
              <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50">
                  <h4 className="text-sm font-medium text-purple-300">Artes Asociadas ({taskInventory.length})</h4>
                </div>
                <div className="max-h-[500px] overflow-auto">
                  {taskInventory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                      <Image className="h-12 w-12 mb-3 opacity-50" />
                      <p className="text-sm">Sin artes asociadas</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-800 z-10">
                        <tr className="text-left">
                          <th className="p-3 font-medium text-purple-300">Archivo</th>
                          <th className="p-3 font-medium text-purple-300">Tipo Mueble</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskInventory.map((item) => (
                          <tr key={item.id} className="border-t border-border/50 hover:bg-purple-900/10">
                            <td className="p-3">
                              {item.archivo_arte ? (
                                <div className="w-20 h-14 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
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
                                <div className="w-20 h-14 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                  <Image className="h-5 w-5 text-zinc-600" />
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-zinc-300">{item.mueble}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Editar */}
          {activeTab === 'editar' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda - Lista de artes con checkbox */}
              <div className="bg-zinc-900/50 rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-zinc-800/50 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-purple-300">Editar Arte</h4>
                  <button
                    onClick={selectAllArtes}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    {selectedArteIds.size === taskInventory.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>
                </div>
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="sticky top-0 bg-zinc-800 z-10">
                      <tr className="text-left">
                        <th className="p-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedArteIds.size === taskInventory.length && taskInventory.length > 0}
                            onChange={selectAllArtes}
                            className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
                          />
                        </th>
                        <th className="p-3 font-medium text-purple-300">Mueble</th>
                        <th className="p-3 font-medium text-purple-300">RSV ID</th>
                        <th className="p-3 font-medium text-purple-300">Ancho</th>
                        <th className="p-3 font-medium text-purple-300">Alto</th>
                        <th className="p-3 font-medium text-purple-300">Archivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskInventory.map((item) => (
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
                          <td className="p-3 text-zinc-300">{item.mueble}</td>
                          <td className="p-3 text-zinc-300">{item.rsv_id}</td>
                          <td className="p-3 text-zinc-300">{item.ancho || '-'}</td>
                          <td className="p-3 text-zinc-300">{item.alto || '-'}</td>
                          <td className="p-3">
                            {item.archivo_arte ? (
                              <div className="w-16 h-12 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                                <img
                                  src={getImageUrl(item.archivo_arte) || ''}
                                  alt="Arte"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <span className="text-zinc-500">Sin archivo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Columna Derecha - Opciones de edicion */}
              <div className="space-y-4">
                {/* Botones de accion */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={handleUpdateImage}
                    disabled={selectedArteIds.size === 0 || isUpdating}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                      selectedArteIds.size > 0
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Upload className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Actualizar</span>
                  </button>
                  <button
                    onClick={handleClearImage}
                    disabled={selectedArteIds.size === 0 || isUpdating}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                      selectedArteIds.size > 0
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Limpiar</span>
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
                          <img src={existingArtUrl} alt="Preview" className="max-h-40 rounded-lg" />
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
              </div>
            </div>
          )}

          {/* Tab Atender */}
          {activeTab === 'atender' && (
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
                                {groupBy === 'inventario' ? items[0]?.codigo_unico : groupKey}
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
                                  : decisiones[groupKey]?.decision === 'rechazar'
                                  ? 'border-red-500/50 text-red-400'
                                  : 'border-blue-500/50 text-blue-400'
                              }`}
                            >
                              <option value="">-- Seleccionar acción --</option>
                              <option value="aprobar">✓ Aprobar</option>
                              <option value="rechazar">✗ Rechazar</option>
                              <option value="corregir">✎ Corregir</option>
                            </select>
                          </div>
                          {/* Textarea para motivo de rechazo */}
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
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {items.map((item) => (
                            <div key={item.id} className="bg-zinc-800/50 rounded-lg p-3 border border-border">
                              <div className="flex gap-3">
                                {/* Preview */}
                                <div className="flex-shrink-0">
                                  {item.archivo_arte ? (
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
                                  <p className="text-xs text-zinc-500 truncate">{item.ubicacion}</p>
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
                                    {item.archivo_arte && (
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
                          ))}
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
                    <CommentsSection campanaId={campanaId} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-zinc-900/50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Task Modal Component
function CreateTaskModal({
  isOpen,
  onClose,
  selectedCount,
  selectedIds,
  campanaId,
  onSubmit,
  proveedores,
  isLoadingProveedores,
  isSubmitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: string[];
  campanaId: number;
  onSubmit: (task: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string }) => void;
  proveedores: Proveedor[];
  isLoadingProveedores: boolean;
  isSubmitting: boolean;
  error: string | null;
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
  const [tipo, setTipo] = useState('');
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
  // Campos específicos para Impresión
  const [tipoMaterial, setTipoMaterial] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [medidas, setMedidas] = useState('');
  const [acabado, setAcabado] = useState('');

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
    const payload: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string } = {
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
    setTipoMaterial('');
    setCantidad(1);
    setMedidas('');
    setAcabado('');
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
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_TAREA.map((t) => (
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
            {/* Campos comunes - Solo mostrar Título para tipos que no son Revisión de artes */}
            {tipo !== 'Revisión de artes' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Título *</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  placeholder={tipo === 'Instalacion' ? 'Ej: Instalación en Reforma' : 'Ej: Impresión lona 3x2'}
                />
              </div>
            )}

            {/* === FORMULARIO INSTALACIÓN === */}
            {tipo === 'Instalacion' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha de instalación *</label>
                    <input
                      type="date"
                      value={fechaInstalacion}
                      onChange={(e) => setFechaInstalacion(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Hora estimada</label>
                    <input
                      type="time"
                      value={horaInstalacion}
                      onChange={(e) => setHoraInstalacion(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Contacto en sitio</label>
                    <input
                      type="text"
                      value={contactoSitio}
                      onChange={(e) => setContactoSitio(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Teléfono contacto</label>
                    <input
                      type="tel"
                      value={telefonoContacto}
                      onChange={(e) => setTelefonoContacto(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      placeholder="55 1234 5678"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Proveedor/Instalador</label>
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
                      <option value="">-- Seleccionar instalador --</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.ciudad ? `(${p.ciudad})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Instrucciones especiales</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Instrucciones para el instalador..."
                  />
                </div>
              </>
            )}

            {/* === FORMULARIO REVISIÓN DE ARTES === */}
            {tipo === 'Revisión de artes' && (
              <>
                {/* Identificador */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Identificador *</label>
                  <input
                    type="text"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    placeholder="Identificador"
                  />
                </div>

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
                    onChange={(e) => setCatorcenaEntrega(e.target.value || null)}
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

            {/* === FORMULARIO IMPRESIÓN === */}
            {tipo === 'Impresion' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Tipo de material *</label>
                    <select
                      value={tipoMaterial}
                      onChange={(e) => setTipoMaterial(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="lona">Lona</option>
                      <option value="vinil">Vinil</option>
                      <option value="backlight">Backlight</option>
                      <option value="papel">Papel</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Medidas</label>
                    <input
                      type="text"
                      value={medidas}
                      onChange={(e) => setMedidas(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      placeholder="Ej: 3m x 2m"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Acabado</label>
                    <select
                      value={acabado}
                      onChange={(e) => setAcabado(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="mate">Mate</option>
                      <option value="brillante">Brillante</option>
                      <option value="satinado">Satinado</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Proveedor de impresión</label>
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
                      <option value="">-- Seleccionar impresor --</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.ciudad ? `(${p.ciudad})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha de entrega</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Notas adicionales</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
                    placeholder="Especificaciones adicionales..."
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
            disabled={!tipo || (tipo === 'Revisión de artes' ? !descripcion.trim() : !titulo.trim()) || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Generando...' : tipo === 'Revisión de artes' ? 'Generar Revisión de artes' : 'Crear tarea'}
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => {
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
  const [activeEstadoArteTab, setActiveEstadoArteTab] = useState<'todos' | 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado'>('todos');

  // --- Validar Instalación (testigo) ---
  const [filtersTestigo, setFiltersTestigo] = useState<FilterCondition[]>([]);
  const [showFiltersTestigo, setShowFiltersTestigo] = useState(false);
  const [activeGroupingsTestigo, setActiveGroupingsTestigo] = useState<GroupByField[]>(['catorcena']);
  const [showGroupingTestigo, setShowGroupingTestigo] = useState(false);
  const [sortFieldTestigo, setSortFieldTestigo] = useState<string | null>(null);
  const [sortDirectionTestigo, setSortDirectionTestigo] = useState<'asc' | 'desc'>('asc');
  const [showSortTestigo, setShowSortTestigo] = useState(false);
  const [expandedGroupsTestigo, setExpandedGroupsTestigo] = useState<Set<string>>(new Set());

  // Helper: check if grouped (basado en el tab activo)
  const isGrouped = useMemo(() => {
    if (activeMainTab === 'versionario') return activeGroupingsVersionario.length > 0;
    if (activeMainTab === 'atender') return activeGroupingsAtender.length > 0;
    return activeGroupingsTestigo.length > 0;
  }, [activeMainTab, activeGroupingsVersionario, activeGroupingsAtender, activeGroupingsTestigo]);

  // Tasks state
  const [tasksSearch, setTasksSearch] = useState('');
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>('');

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadArtModalOpen, setIsUploadArtModalOpen] = useState(false);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

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
    queryKey: ['campana-inventario-sin-arte', campanaId, activeFormat],
    queryFn: () => campanasService.getInventarioSinArte(campanaId, activeFormat === 'tradicional' ? 'Tradicional' : 'Digital'),
    enabled: campanaId > 0 && (activeMainTab === 'versionario' || !initialTabDetermined),
  });

  // Inventario CON arte (para tab "Revisar y Aprobar")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioArteAPI = [], isLoading: isLoadingInventarioArte, isFetched: isFetchedConArte } = useQuery({
    queryKey: ['campana-inventario-arte', campanaId],
    queryFn: () => campanasService.getInventarioConArte(campanaId),
    enabled: campanaId > 0 && (activeMainTab === 'atender' || !initialTabDetermined || isTaskDetailModalOpen),
  });

  // Inventario para TESTIGOS (para tab "Validar Instalación")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioTestigosAPI = [], isLoading: isLoadingInventarioTestigos, isFetched: isFetchedTestigos } = useQuery({
    queryKey: ['campana-inventario-testigos', campanaId, activeFormat],
    queryFn: () => campanasService.getInventarioTestigos(campanaId, activeFormat === 'tradicional' ? 'Tradicional' : 'Digital'),
    enabled: campanaId > 0 && (activeMainTab === 'testigo' || !initialTabDetermined),
  });

  // Tareas de la campaña (activas = Activo o Pendiente)
  const { data: tareasAPI = [], isLoading: isLoadingTareas } = useQuery({
    queryKey: ['campana-tareas', campanaId],
    queryFn: () => campanasService.getTareas(campanaId, { activas: true }),
    enabled: campanaId > 0,
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

  // ---- Determinar tab inicial basado en contenido ----
  useEffect(() => {
    // Solo ejecutar una vez cuando los datos estén disponibles
    if (initialTabDetermined) return;

    // Esperar a que las queries hayan terminado de hacer fetch (no solo que no estén cargando)
    const allQueriesFetched = isFetchedSinArte && isFetchedConArte && isFetchedTestigos;
    if (!allQueriesFetched) return;

    // Determinar el tab con contenido (prioridad: versionario > atender > testigo)
    if (inventarioSinArteAPI.length > 0) {
      setActiveMainTab('versionario');
    } else if (inventarioArteAPI.length > 0) {
      setActiveMainTab('atender');
    } else if (inventarioTestigosAPI.length > 0) {
      setActiveMainTab('testigo');
    }
    // Si ninguno tiene contenido, se queda en versionario por defecto

    setInitialTabDetermined(true);
  }, [
    initialTabDetermined,
    isFetchedSinArte,
    isFetchedConArte,
    isFetchedTestigos,
    inventarioSinArteAPI.length,
    inventarioArteAPI.length,
    inventarioTestigosAPI.length,
  ]);

  // ---- Error State ----
  const [uploadArtError, setUploadArtError] = useState<string | null>(null);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  // ---- Mutations ----
  const assignArteMutation = useMutation({
    mutationFn: ({ reservaIds, archivo }: { reservaIds: number[]; archivo: string }) =>
      campanasService.assignArte(campanaId, reservaIds, archivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', campanaId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes', campanaId], refetchType: 'all' });
      if (isUploadArtModalOpen) {
        setIsUploadArtModalOpen(false);
        setSelectedInventoryIds(new Set());
      }
      setUploadArtError(null);
    },
    onError: (error) => {
      setUploadArtError(error instanceof Error ? error.message : 'Error al asignar arte');
    },
  });

  const updateArteStatusMutation = useMutation({
    mutationFn: ({ reservaIds, status, comentario }: { reservaIds: number[]; status: 'Aprobado' | 'Rechazado'; comentario?: string }) =>
      campanasService.updateArteStatus(campanaId, reservaIds, status, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', campanaId] });
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
    }) => campanasService.createTarea(campanaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', campanaId] });
      setIsCreateModalOpen(false);
      setSelectedInventoryIds(new Set());
      setCreateTaskError(null);
    },
    onError: (error) => {
      setCreateTaskError(error instanceof Error ? error.message : 'Error al crear tarea');
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
      if (prev.length < 5) return [...prev, field];
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
      if (prev.length < 5) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsAtender = useCallback(() => {
    setActiveGroupingsAtender([]);
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
      if (prev.length < 5) return [...prev, field];
      return [...prev.slice(1), field];
    });
  }, []);

  const clearGroupingsTestigo = useCallback(() => {
    setActiveGroupingsTestigo([]);
  }, []);

  // Helper function to transform InventarioConArte to InventoryRow
  const transformInventarioToRow = useCallback((item: InventarioConArte, defaultArteStatus: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = 'sin_revisar'): InventoryRow => {
    // Mapear arte_aprobado a estado_arte
    let estadoArte: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = defaultArteStatus;
    const arteAprobadoLower = (item.arte_aprobado || '').toLowerCase();
    if (arteAprobadoLower === 'aprobado') estadoArte = 'aprobado';
    else if (arteAprobadoLower === 'rechazado') estadoArte = 'rechazado';
    else if (arteAprobadoLower === 'pendiente' || arteAprobadoLower === 'en revision' || arteAprobadoLower === 'en revisión') estadoArte = 'en_revision';
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
      estado_arte: estadoArte,
      estado_tarea: estadoTarea,
      testigo_status: item.instalado ? 'validado' : 'pendiente',
      archivo_arte: item.archivo || undefined,
      arte_aprobado: item.arte_aprobado || '',
      imu: item.IMU || '',
    };
  }, []);

  // Transform inventario SIN arte para tab "Subir Artes"
  const inventorySinArteData = useMemo((): InventoryRow[] => {
    return inventarioSinArteAPI.map((item) => transformInventarioToRow(item, 'sin_revisar'));
  }, [inventarioSinArteAPI, transformInventarioToRow]);

  // Transform inventario con arte para tab "Atender arte"

  const inventoryArteData = useMemo((): InventoryRow[] => {
    return inventarioArteAPI.map((item) => transformInventarioToRow(item, 'sin_revisar'));
  }, [inventarioArteAPI, transformInventarioToRow]);

  // Transform inventario para testigos (tab "Validar Instalación")
  const inventoryTestigosData = useMemo((): InventoryRow[] => {
    return inventarioTestigosAPI.map((item) => transformInventarioToRow(item, 'aprobado'));
  }, [inventarioTestigosAPI, transformInventarioToRow]);

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

    // Filtrar por estado_arte según el tab activo
    if (activeEstadoArteTab !== 'todos') {
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
  }, [inventoryArteData, filtersAtender, sortFieldAtender, sortDirectionAtender, activeEstadoArteTab]);

  // Datos filtrados y ordenados para Validar Instalación (testigo)
  const filteredTestigoData = useMemo(() => {
    let data = applyFilters(inventoryTestigosData, filtersTestigo);
    
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
  }, [inventoryTestigosData, filtersTestigo, sortFieldTestigo, sortDirectionTestigo]);

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

  const getUniqueValuesTestigo = useMemo(() => {
    const values: Record<string, string[]> = {};
    FILTER_FIELDS_INVENTARIO.forEach(field => {
      const unique = [...new Set(inventoryTestigosData.map(item => String(item[field.field as keyof InventoryRow] || '')))].filter(v => v).sort();
      values[field.field] = unique;
    });
    return values;
  }, [inventoryTestigosData]);

  // Transform tareas from API to TaskRow format
  const tasks = useMemo((): TaskRow[] => {
    return tareasAPI
      .filter((t) => t.estatus !== 'Atendido' && t.estatus !== 'Completado')
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
      }));
  }, [tareasAPI, campanaId]);

  const completedTasks = useMemo((): TaskRow[] => {
    return tareasAPI
      .filter((t) => t.estatus === 'Atendido' || t.estatus === 'Completado')
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
      }));
  }, [tareasAPI, campanaId]);

  // ---- Computed ----
  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    let data: InventoryRow[];
    if (activeMainTab === 'versionario') {
      data = inventorySinArteData;
    } else if (activeMainTab === 'atender') {
      data = inventoryArteData;
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
  }, [inventorySinArteData, inventoryArteData, inventoryTestigosData, activeMainTab]);

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
    } else {
      // Tab "Validar Instalación": usar datos ya filtrados
      data = filteredTestigoData;
    }

    // Filter by format for non-atender tabs (atender already has format in query)
    if (activeMainTab !== 'atender') {
      const formatFilter = activeFormat === 'tradicional' ? 'Tradicional' : 'Digital';
      data = data.filter((item) => item.tradicional_digital === formatFilter);
    }

    // Filter by search
    if (inventorySearch) {
      const search = inventorySearch.toLowerCase();
      data = data.filter(
        (item) =>
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
  }, [filteredVersionarioData, filteredAtenderData, filteredTestigoData, inventorySearch, activeFormat, activeMainTab, sortField, sortDirection]);

  const filteredTasks = useMemo(() => {
    let data = tasks;
    if (tasksSearch) {
      const search = tasksSearch.toLowerCase();
      data = data.filter(
        (t) =>
          t.titulo.toLowerCase().includes(search) ||
          t.identificador.toLowerCase().includes(search) ||
          t.asignado.toLowerCase().includes(search)
      );
    }
    if (tasksStatusFilter) {
      data = data.filter((t) => t.estatus === tasksStatusFilter);
    }
    return data;
  }, [tasks, tasksSearch, tasksStatusFilter]);

  const filteredCompletedTasks = useMemo(() => {
    if (!tasksSearch) return completedTasks;
    const search = tasksSearch.toLowerCase();
    return completedTasks.filter(
      (t) =>
        t.titulo.toLowerCase().includes(search) ||
        t.identificador.toLowerCase().includes(search)
    );
  }, [completedTasks, tasksSearch]);

  // Agrupación simple para tab "Validar Instalación" basada en activeGroupingsTestigo
  // Solo usa el primer campo de agrupación para mantener compatibilidad con el renderizado existente
  const simpleGroupedInventory = useMemo(() => {
    if (activeGroupingsTestigo.length === 0) return {} as Record<string, InventoryRow[]>;

    const groups: Record<string, InventoryRow[]> = {};
    const groupField = activeGroupingsTestigo[0];

    filteredInventory.forEach((item) => {
      const key = getGroupKeyForField(item, groupField);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [filteredInventory, activeGroupingsTestigo]);

  // Agrupación para tab "Subir Artes" basada en activeGroupingsVersionario
  // Estructura: Nivel1 -> Nivel2 -> Nivel3 -> Items (máximo 3 niveles de agrupación + items)
  const versionarioGroupedInventory = useMemo(() => {
    const numLevels = Math.min(activeGroupingsVersionario.length, 3);

    // Si no hay agrupaciones, devolver estructura vacía
    if (numLevels === 0) {
      return {} as Record<string, Record<string, Record<string, InventoryRow[]>>>;
    }

    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    filteredInventory.forEach((item) => {
      const level1Key = activeGroupingsVersionario[0] ? getGroupKeyForField(item, activeGroupingsVersionario[0]) : 'Todo';
      const level2Key = activeGroupingsVersionario[1] ? getGroupKeyForField(item, activeGroupingsVersionario[1]) : 'Items';
      const level3Key = activeGroupingsVersionario[2] ? getGroupKeyForField(item, activeGroupingsVersionario[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    return groups;
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

    filteredInventory.forEach((item) => {
      const level1Key = activeGroupingsAtender[0] ? getGroupKeyForField(item, activeGroupingsAtender[0]) : 'Todo';
      const level2Key = activeGroupingsAtender[1] ? getGroupKeyForField(item, activeGroupingsAtender[1]) : 'Items';
      const level3Key = activeGroupingsAtender[2] ? getGroupKeyForField(item, activeGroupingsAtender[2]) : 'Items';

      if (!groups[level1Key]) groups[level1Key] = {};
      if (!groups[level1Key][level2Key]) groups[level1Key][level2Key] = {};
      if (!groups[level1Key][level2Key][level3Key]) groups[level1Key][level2Key][level3Key] = [];

      groups[level1Key][level2Key][level3Key].push(item);
    });

    return groups;
  }, [filteredInventory, activeGroupingsAtender]);

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
  }, [inventorySinArteData, inventoryArteData, inventoryTestigosData, activeMainTab, tasks, completedTasks]);

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

  const handleCreateTask = useCallback((task: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string }) => {
    // Get reserva IDs from selected inventory items
    const reservaIds = selectedInventoryItems.flatMap(item =>
      item.rsv_id.split(',').map(id => id.trim()).filter(id => id)
    );

    createTareaMutation.mutate({
      titulo: task.titulo || 'Nueva tarea',
      descripcion: task.descripcion,
      tipo: task.tipo || 'Produccion',
      ids_reservas: reservaIds.join(','),
      proveedores_id: task.proveedores_id,
      nombre_proveedores: task.nombre_proveedores,
      // Campos para Revisión de artes
      asignado: (task as any).asignado,
      id_asignado: (task as any).id_asignado,
      contenido: (task as any).contenido,
      catorcena_entrega: (task as any).catorcena_entrega,
      listado_inventario: (task as any).listado_inventario,
    });
  }, [selectedInventoryItems, createTareaMutation]);

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

        // Upload file to server
        setUploadArtError(null);
        const uploadResult = await campanasService.uploadArteFile(data.value);
        archivo = uploadResult.url;
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
  const renderAtenderRow = (item: InventoryRow, showCheckbox = true) => (
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
      <td className="p-2 text-xs text-zinc-300">{item.imu || '-'}</td>
      <td className="p-2 text-center">
        {item.estado_tarea === 'atendido' ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
        ) : (
          <span className="text-zinc-500">-</span>
        )}
      </td>
    </tr>
  );

  // Render row for Testigo tab
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

  // Generic render based on active tab
  const renderInventoryRow = (item: InventoryRow, showCheckbox = true) => {
    if (activeMainTab === 'versionario') return renderVersionarioRow(item, showCheckbox);
    if (activeMainTab === 'testigo') return renderTestigoRow(item, showCheckbox);
    return renderAtenderRow(item, showCheckbox);
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
              {(['versionario', 'atender', 'testigo'] as MainTab[]).map((step, idx) => {
                const isActive = activeMainTab === step;
                const isPast = ['versionario', 'atender', 'testigo'].indexOf(activeMainTab) > idx;
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
                    {idx < 2 && (
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
                { key: 'testigo', label: 'Validar Instalacion', icon: Camera },
              ] as { key: MainTab; label: string; icon: typeof Upload }[]).map((tab) => {
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

          {/* Sub-tabs: Formato */}
          <div className="px-4 py-2 border-b border-border bg-purple-900/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Tipo de medio:</span>
                <div className="flex gap-1">
                  {([
                    { key: 'tradicional', label: 'Tradicional', desc: 'Impresion fisica' },
                    { key: 'digital', label: 'Digital', desc: 'Pantallas LED' },
                  ] as { key: FormatTab; label: string; desc: string }[]).map((format) => (
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
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredInventory.length} elementos
              </span>
            </div>
          </div>

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
            </div>
          )}

          {/* Estado Arte Tabs (Atender tab) */}
          {activeMainTab === 'atender' && (
            <div className="px-4 py-2 border-b border-border bg-zinc-900/50">
              <div className="flex items-center gap-1">
                {[
                  { key: 'todos' as const, label: 'Todos', count: inventoryArteData.length },
                  { key: 'sin_revisar' as const, label: 'Sin Revisar', count: inventoryArteData.filter(i => i.estado_arte === 'sin_revisar').length },
                  { key: 'en_revision' as const, label: 'En Revisión', count: inventoryArteData.filter(i => i.estado_arte === 'en_revision').length },
                  { key: 'aprobado' as const, label: 'Aprobado', count: inventoryArteData.filter(i => i.estado_arte === 'aprobado').length },
                  { key: 'rechazado' as const, label: 'Rechazado', count: inventoryArteData.filter(i => i.estado_arte === 'rechazado').length },
                ].map(tab => (
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
              <span className="text-xs text-zinc-400">{filteredAtenderData.length} de {inventoryArteData.length} artes</span>
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={selectedInventoryIds.size === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear Tarea
                </button>
              </div>
            </div>
          )}

          {/* Filter Toolbar (Testigo tab) */}
          {activeMainTab === 'testigo' && (
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs text-zinc-400">{filteredTestigoData.length} de {inventoryTestigosData.length} testigos</span>
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

          {/* Action Buttons (Testigo tab) */}
          {activeMainTab === 'testigo' && (
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-purple-900/10 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedInventoryIds.size > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {selectedInventoryIds.size} testigo(s) seleccionado(s)
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
                    <span className="text-xs">Selecciona instalaciones para validar sus fotos testigo</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const reservaIds = selectedInventoryItems.flatMap(item =>
                      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                    );
                    if (reservaIds.length > 0) {
                      updateInstaladoMutation.mutate({ reservaIds, instalado: true });
                    }
                  }}
                  disabled={selectedInventoryIds.size === 0 || updateInstaladoMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {updateInstaladoMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Validar Instalacion
                </button>
                <button
                  onClick={() => {
                    const reservaIds = selectedInventoryItems.flatMap(item =>
                      item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                    );
                    if (reservaIds.length > 0) {
                      updateInstaladoMutation.mutate({ reservaIds, instalado: false });
                    }
                  }}
                  disabled={selectedInventoryIds.size === 0 || updateInstaladoMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="max-h-[400px] overflow-auto">
            {(isLoadingInventarioSinArte || isLoadingInventarioArte || isLoadingInventarioTestigos) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando inventario...</span>
              </div>
            ) : filteredInventory.length === 0 ? (
              <EmptyState
                message={
                  activeMainTab === 'versionario'
                    ? 'Sin espacios disponibles'
                    : activeMainTab === 'atender'
                    ? 'Sin artes para revisar'
                    : 'Sin testigos pendientes'
                }
                description={
                  activeMainTab === 'versionario'
                    ? 'No hay espacios de tipo ' + activeFormat + ' en esta campaña'
                    : activeMainTab === 'atender'
                    ? 'Primero debes subir artes en el paso "Subir Artes"'
                    : 'Los testigos se generan despues de aprobar e instalar los artes'
                }
                icon={activeMainTab === 'versionario' ? Image : activeMainTab === 'atender' ? Eye : Camera}
              />
            ) : activeMainTab === 'atender' ? (
              // Vista jerárquica de 3 niveles para Revisar y Aprobar
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
                                                    ? 'bg-amber-600 border-amber-600'
                                                    : 'border-amber-500/50 hover:border-amber-400'
                                                }`}
                                              >
                                                {items.every(item => selectedInventoryIds.has(item.id)) && (
                                                  <Check className="h-2.5 w-2.5 text-white" />
                                                )}
                                              </button>
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
                                                    <th className="p-2 font-medium text-purple-300">IMU</th>
                                                    <th className="p-2 font-medium text-purple-300">Instalado</th>
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
            ) : isGrouped && Object.keys(simpleGroupedInventory).length > 0 ? (
              // Simple Grouped View (for testigo or atender with simple grouping)
              <div className="divide-y divide-border">
                {Object.entries(simpleGroupedInventory).map(([groupKey, items]) => {
                  const isExpanded = expandedNodes.has(groupKey);
                  return (
                    <div key={groupKey}>
                      <button
                        onClick={() => toggleNode(groupKey)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-medium text-white">{groupKey}</span>
                        </div>
                        <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/30">
                          {items.length} elemento{items.length !== 1 ? 's' : ''}
                        </Badge>
                      </button>
                      {isExpanded && (
                        <div className="bg-card/50">
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
                                          if (allSelected) {
                                            next.delete(item.id);
                                          } else {
                                            next.add(item.id);
                                          }
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
                                {/* Simple Grouped View solo se usa para testigo */}
                                <th className="p-2 font-medium text-purple-300">Código</th>
                                <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                <th className="p-2 font-medium text-purple-300">Mueble</th>
                                <th className="p-2 font-medium text-purple-300">Plaza</th>
                                <th className="p-2 font-medium text-purple-300">Testigo</th>
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
            ) : (
              // Flat Table View
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left">
                    <th className="p-2 w-8">
                      <button
                        onClick={toggleAllInventory}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedInventoryIds.size === filteredInventory.length && filteredInventory.length > 0
                            ? 'bg-purple-600 border-purple-600'
                            : 'border-purple-500/50 hover:border-purple-400'
                        }`}
                      >
                        {selectedInventoryIds.size === filteredInventory.length && filteredInventory.length > 0 && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </button>
                    </th>
                    {/* Flat Table View solo se usa para testigo */}
                    <th className="p-2 font-medium text-purple-300">Código</th>
                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                    <th className="p-2 font-medium text-purple-300">Mueble</th>
                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                    <th className="p-2 font-medium text-purple-300">APS</th>
                    <th className="p-2 font-medium text-purple-300">Testigo</th>
                  </tr>
                </thead>
                <tbody>{filteredInventory.map((item) => renderInventoryRow(item))}</tbody>
              </table>
            )}
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
                  {tasks.filter(t => t.estatus === 'pendiente' || t.estatus === 'en_progreso').length} activas
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
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={tasksSearch}
                        onChange={(e) => setTasksSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <select
                      value={tasksStatusFilter}
                      onChange={(e) => setTasksStatusFilter(e.target.value)}
                      className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">Selecciona un estatus</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="completada">Completada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors">
                      <Filter className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors">
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg transition-colors">
                      <ArrowUpDown className="h-3.5 w-3.5" />
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
                            <td className="p-2 font-medium text-white">{task.identificador}</td>
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
                            <td className="p-2 font-medium text-white">{task.identificador}</td>
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
        selectedIds={Array.from(selectedInventoryIds)}
        campanaId={campanaId}
        onSubmit={handleCreateTask}
        proveedores={proveedores}
        isLoadingProveedores={isLoadingProveedores}
        isSubmitting={createTareaMutation.isPending}
        error={createTaskError}
      />

      {/* Upload Art Modal */}
      <UploadArtModal
        isOpen={isUploadArtModalOpen}
        onClose={() => {
          setIsUploadArtModalOpen(false);
          setUploadArtError(null);
        }}
        selectedInventory={selectedInventoryItems}
        onSubmit={handleUploadArt}
        artesExistentes={artesExistentes}
        isLoadingArtes={isLoadingArtes}
        isSubmitting={assignArteMutation.isPending}
        error={uploadArtError}
        campanaId={campanaId}
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
        onApprove={(reservaIds) => {
          updateArteStatusMutation.mutate({ reservaIds, status: 'Aprobado' });
        }}
        onReject={(reservaIds, comentario) => {
          // Primero actualizar el estado a Rechazado
          updateArteStatusMutation.mutateAsync({ reservaIds, status: 'Rechazado', comentario })
            .then(() => {
              // Después de rechazar exitosamente, crear tarea de corrección para el creador original
              if (selectedTask && selectedTask.creador) {
                createTareaMutation.mutate({
                  titulo: `Corrección de artes - Rechazo`,
                  descripcion: `Artes rechazados con el siguiente motivo:

${comentario || 'Sin motivo especificado'}

Por favor corrige los artes y vuelve a enviar a revisión.`,
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
        isUpdating={updateArteStatusMutation.isPending || assignArteMutation.isPending}
        campanaId={campanaId}
      />
    </div>
  );
}
