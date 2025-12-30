import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioConArte, TareaCampana, ArteExistente } from '../../services/campanas.service';
import { proveedoresService } from '../../services/proveedores.service';
import { Proveedor } from '../../types';
import { Badge } from '../../components/ui/badge';

// ============================================================================
// TYPES
// ============================================================================

type MainTab = 'versionario' | 'atender' | 'testigo';
type FormatTab = 'tradicional' | 'digital';
type TasksTab = 'tradicionales' | 'completadas' | 'calendario';
type CalendarView = 'month' | 'week' | 'day' | 'list';

// Opciones de agrupación
type GroupByField = 'none' | 'catorcena' | 'ciudad' | 'plaza' | 'mueble' | 'tipo_medio' | 'aps';
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
  // Para Atender arte
  estado_arte?: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado';
  estado_tarea?: 'sin_atender' | 'en_progreso' | 'atendido';
  archivo_arte?: string;
  // Para Testigo
  testigo_status?: 'pendiente' | 'validado' | 'rechazado';
}

interface TaskRow {
  id: string;
  tipo: string;
  estatus: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
  identificador: string;
  fecha_inicio: string;
  fecha_fin: string;
  creador: string;
  asignado: string;
  descripcion: string;
  titulo: string;
  contenido?: string;
  inventario_ids: string[];
  campana_id: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'tarea' | 'entrega';
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const estadoArteLabels: Record<string, string> = {
  sin_revisar: 'Sin revisar',
  en_revision: 'En revision',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

const estadoTareaLabels: Record<string, string> = {
  sin_atender: 'Sin atender',
  en_progreso: 'En progreso',
  atendido: 'Atendido',
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
  { value: 'Produccion', label: 'Produccion', description: 'Impresion y fabricacion de materiales' },
  { value: 'Instalacion', label: 'Instalacion', description: 'Instalacion fisica del arte en sitio' },
  { value: 'Arte', label: 'Arte/Diseño', description: 'Creacion o modificacion de artes' },
  { value: 'Revision', label: 'Revision', description: 'Revision y aprobacion de materiales' },
  { value: 'Testigo', label: 'Testigo', description: 'Captura de fotos testigo' },
  { value: 'Otro', label: 'Otro', description: 'Otras tareas' },
];

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
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('Produccion');
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [fechaFin, setFechaFin] = useState('');
  const [estatus, setEstatus] = useState<TaskRow['estatus']>('pendiente');

  const selectedProveedor = proveedores.find(p => p.id === proveedorId);

  const handleSubmit = () => {
    const payload: Partial<TaskRow> & { proveedores_id?: number; nombre_proveedores?: string } = {
      titulo,
      descripcion,
      tipo,
      fecha_fin: fechaFin,
      estatus,
      inventario_ids: selectedIds,
      campana_id: campanaId,
      creador: 'Usuario Actual',
      identificador: `TASK-${Date.now()}`,
    };

    if (proveedorId && selectedProveedor) {
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
    setTipo('Produccion');
    setProveedorId(null);
    setFechaFin('');
    setEstatus('pendiente');
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

        <div className="space-y-4">
          {/* Titulo */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Titulo *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
              placeholder="Titulo de la tarea"
            />
          </div>

          {/* Tipo de Tarea */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Tipo de tarea *</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            >
              {TIPOS_TAREA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {TIPOS_TAREA.find(t => t.value === tipo)?.description}
            </p>
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descripcion</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
              placeholder="Descripcion de la tarea"
            />
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Asignar a proveedor</label>
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
                <option value="">-- Sin asignar --</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.ciudad ? `(${p.ciudad})` : ''}
                  </option>
                ))}
              </select>
            )}
            {proveedores.length === 0 && !isLoadingProveedores && (
              <p className="mt-1 text-xs text-zinc-500">
                No hay proveedores registrados. Puedes crear la tarea sin asignar.
              </p>
            )}
          </div>

          {/* Fecha fin y Estatus */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha limite</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Estatus inicial</label>
              <select
                value={estatus}
                onChange={(e) => setEstatus(e.target.value as TaskRow['estatus'])}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
              </select>
            </div>
          </div>
        </div>

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
            disabled={!titulo.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creando...' : 'Crear tarea'}
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
        { label: 'Total Inventario', value: stats.totalInventario, icon: ClipboardList, color: 'purple' },
        { label: 'Sin Arte', value: stats.sinArte, icon: Image, color: 'amber' },
        { label: 'Con Arte', value: stats.totalInventario - stats.sinArte, icon: Palette, color: 'green' },
      ];
    }
    if (activeTab === 'atender') {
      return [
        { label: 'Por Revisar', value: stats.sinArte + stats.enRevision, icon: Eye, color: 'amber' },
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

  // Dropdown visibility state
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Helper: check if grouped
  const isGrouped = groupByField !== 'none';

  // Tasks state
  const [tasksSearch, setTasksSearch] = useState('');
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>('');

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadArtModalOpen, setIsUploadArtModalOpen] = useState(false);

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
  const { data: inventarioSinArteAPI = [], isLoading: isLoadingInventarioSinArte } = useQuery({
    queryKey: ['campana-inventario-sin-arte', campanaId, activeFormat],
    queryFn: () => campanasService.getInventarioSinArte(campanaId, activeFormat === 'tradicional' ? 'Tradicional' : 'Digital'),
    enabled: campanaId > 0 && (activeMainTab === 'versionario' || !initialTabDetermined),
  });

  // Inventario CON arte (para tab "Revisar y Aprobar")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioArteAPI = [], isLoading: isLoadingInventarioArte } = useQuery({
    queryKey: ['campana-inventario-arte', campanaId],
    queryFn: () => campanasService.getInventarioConArte(campanaId),
    enabled: campanaId > 0 && (activeMainTab === 'atender' || !initialTabDetermined),
  });

  // Inventario para TESTIGOS (para tab "Validar Instalación")
  // Se carga si es el tab activo o si aún no se ha determinado el tab inicial
  const { data: inventarioTestigosAPI = [], isLoading: isLoadingInventarioTestigos } = useQuery({
    queryKey: ['campana-inventario-testigos', campanaId, activeFormat],
    queryFn: () => campanasService.getInventarioTestigos(campanaId, activeFormat === 'tradicional' ? 'Tradicional' : 'Digital'),
    enabled: campanaId > 0 && (activeMainTab === 'testigo' || !initialTabDetermined),
  });

  // Tareas de la campaña
  const { data: tareasAPI = [], isLoading: isLoadingTareas } = useQuery({
    queryKey: ['campana-tareas', campanaId],
    queryFn: () => campanasService.getTareas(campanaId),
    enabled: campanaId > 0,
  });

  // Artes existentes de la campaña
  const { data: artesExistentes = [], isLoading: isLoadingArtes } = useQuery({
    queryKey: ['campana-artes-existentes', campanaId],
    queryFn: () => campanasService.getArtesExistentes(campanaId),
    enabled: campanaId > 0 && isUploadArtModalOpen,
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

    // Esperar a que las queries terminen de cargar
    const allQueriesLoaded = !isLoadingInventarioSinArte && !isLoadingInventarioArte && !isLoadingInventarioTestigos;
    if (!allQueriesLoaded) return;

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
    isLoadingInventarioSinArte,
    isLoadingInventarioArte,
    isLoadingInventarioTestigos,
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
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes', campanaId] });
      setIsUploadArtModalOpen(false);
      setSelectedInventoryIds(new Set());
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
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', campanaId] });
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
    mutationFn: (data: { titulo: string; descripcion?: string; tipo?: string; ids_reservas?: string; proveedores_id?: number; nombre_proveedores?: string }) =>
      campanasService.createTarea(campanaId, data),
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

  // Helper function to transform InventarioConArte to InventoryRow
  const transformInventarioToRow = useCallback((item: InventarioConArte, defaultArteStatus: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = 'sin_revisar'): InventoryRow => {
    // Mapear arte_aprobado a estado_arte
    let estadoArte: 'sin_revisar' | 'en_revision' | 'aprobado' | 'rechazado' = defaultArteStatus;
    if (item.arte_aprobado === 'Aprobado') estadoArte = 'aprobado';
    else if (item.arte_aprobado === 'Rechazado') estadoArte = 'rechazado';
    else if (item.arte_aprobado === 'Pendiente' || item.archivo) estadoArte = 'en_revision';

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
      aps: item.APS || item.rsvAPS || null,
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
    };
  }, []);

  // Transform inventario SIN arte para tab "Subir Artes"
  const inventorySinArteData = useMemo((): InventoryRow[] => {
    return inventarioSinArteAPI.map((item) => transformInventarioToRow(item, 'sin_revisar'));
  }, [inventarioSinArteAPI, transformInventarioToRow]);

  // Transform inventario con arte para tab "Atender arte"
  const inventoryArteData = useMemo((): InventoryRow[] => {
    return inventarioArteAPI.map((item) => transformInventarioToRow(item, 'en_revision'));
  }, [inventarioArteAPI, transformInventarioToRow]);

  // Transform inventario para testigos (tab "Validar Instalación")
  const inventoryTestigosData = useMemo((): InventoryRow[] => {
    return inventarioTestigosAPI.map((item) => transformInventarioToRow(item, 'aprobado'));
  }, [inventarioTestigosAPI, transformInventarioToRow]);

  // Transform tareas from API to TaskRow format
  const tasks = useMemo((): TaskRow[] => {
    return tareasAPI
      .filter((t) => t.estatus !== 'Atendido' && t.estatus !== 'Completado')
      .map((t) => ({
        id: t.id.toString(),
        tipo: t.tipo || 'Tarea',
        estatus: (t.estatus === 'Pendiente' ? 'pendiente' : t.estatus === 'En Progreso' ? 'en_progreso' : 'pendiente') as 'pendiente' | 'en_progreso' | 'completada' | 'cancelada',
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
        estatus: 'completada' as 'pendiente' | 'en_progreso' | 'completada' | 'cancelada',
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

    // Seleccionar fuente de datos según tab activo
    if (activeMainTab === 'versionario') {
      // Tab "Subir Artes": inventario SIN arte
      data = inventorySinArteData;
    } else if (activeMainTab === 'atender') {
      // Tab "Revisar y Aprobar": inventario CON arte
      data = inventoryArteData;
    } else {
      // Tab "Validar Instalación": inventario para testigos
      data = inventoryTestigosData;
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

    // Apply dropdown filters
    if (filters.ciudad) {
      data = data.filter(item => item.ciudad === filters.ciudad);
    }
    if (filters.plaza) {
      data = data.filter(item => item.plaza === filters.plaza);
    }
    if (filters.mueble) {
      data = data.filter(item => item.mueble === filters.mueble);
    }
    if (filters.tipo_medio) {
      data = data.filter(item => item.tipo_medio === filters.tipo_medio);
    }
    if (filters.catorcena !== null) {
      data = data.filter(item => item.catorcena === filters.catorcena);
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
  }, [inventorySinArteData, inventoryArteData, inventoryTestigosData, inventorySearch, activeFormat, activeMainTab, filters, sortField, sortDirection]);

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

  // Group inventory by selected field (simple single-level grouping)
  const simpleGroupedInventory = useMemo(() => {
    if (groupByField === 'none') return {};

    const groups: Record<string, InventoryRow[]> = {};

    filteredInventory.forEach((item) => {
      let key = '';
      switch (groupByField) {
        case 'catorcena':
          key = `Catorcena ${item.catorcena} - ${item.anio}`;
          break;
        case 'ciudad':
          key = item.ciudad || 'Sin ciudad';
          break;
        case 'plaza':
          key = item.plaza || 'Sin plaza';
          break;
        case 'mueble':
          key = item.mueble || 'Sin mueble';
          break;
        case 'tipo_medio':
          key = item.tipo_medio || 'Sin tipo';
          break;
        case 'aps':
          key = item.aps ? `APS ${item.aps}` : 'Sin APS';
          break;
        default:
          key = 'Otros';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [filteredInventory, groupByField]);

  // Agrupación jerárquica de 3 niveles para tab "Subir Artes": Catorcena -> APS -> Grupo
  const versionarioGroupedInventory = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, InventoryRow[]>>> = {};

    filteredInventory.forEach((item) => {
      const catorcenaKey = `Catorcena ${item.catorcena} - ${item.anio}`;
      const apsKey = `APS ${item.aps}`;
      const grupoKey = item.grupo_id ? `Grupo ${item.grupo_id}` : `Item ${item.id}`;

      if (!groups[catorcenaKey]) groups[catorcenaKey] = {};
      if (!groups[catorcenaKey][apsKey]) groups[catorcenaKey][apsKey] = {};
      if (!groups[catorcenaKey][apsKey][grupoKey]) groups[catorcenaKey][apsKey][grupoKey] = [];

      groups[catorcenaKey][apsKey][grupoKey].push(item);
    });

    return groups;
  }, [filteredInventory]);

  // Legacy grouped inventory for "atender" tab complex grouping
  const groupedInventory = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, Record<string, InventoryRow[]>>>> = {};

    filteredInventory.forEach((item) => {
      const catorcenaKey = `Catorcena: ${item.catorcena}, Año: ${item.anio}`;
      const apsKey = `APS: ${item.aps ?? 'Sin asignar'}`;
      const arteKey = `Arte: ${estadoArteLabels[item.estado_arte || 'sin_revisar']}`;
      const tareaKey = `Tarea: ${estadoTareaLabels[item.estado_tarea || 'sin_atender']}`;

      if (!groups[catorcenaKey]) groups[catorcenaKey] = {};
      if (!groups[catorcenaKey][apsKey]) groups[catorcenaKey][apsKey] = {};
      if (!groups[catorcenaKey][apsKey][arteKey]) groups[catorcenaKey][apsKey][arteKey] = {};
      if (!groups[catorcenaKey][apsKey][arteKey][tareaKey]) groups[catorcenaKey][apsKey][arteKey][tareaKey] = [];

      groups[catorcenaKey][apsKey][arteKey][tareaKey].push(item);
    });

    return groups;
  }, [filteredInventory]);

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
      sinArte: allItems.filter(i => i.estado_arte === 'sin_revisar' || !i.archivo_arte).length,
      enRevision: allItems.filter(i => i.estado_arte === 'en_revision').length,
      aprobados: allItems.filter(i => i.estado_arte === 'aprobado').length,
      rechazados: allItems.filter(i => i.estado_arte === 'rechazado').length,
      tareasActivas: tasks.filter(t => t.estatus === 'pendiente' || t.estatus === 'en_progreso').length,
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
      <td className="p-2 text-xs font-medium text-white">{item.codigo_unico}</td>
      <td className="p-2 text-xs text-zinc-300 max-w-[150px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2 text-xs text-purple-300">{item.aps}</td>
      <td className="p-2">
        <StatusBadge status={item.estado_arte || 'sin_revisar'} labels={estadoArteLabels} />
      </td>
      <td className="p-2">
        <StatusBadge status={item.estado_tarea || 'sin_atender'} labels={estadoTareaLabels} />
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

          {/* Inventory Toolbar */}
          <div className="p-4 border-b border-border">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por codigo, ciudad, plaza..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowFilterDropdown(!showFilterDropdown);
                      setShowGroupDropdown(false);
                      setShowSortDropdown(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      hasActiveFilters
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtrar</span>
                    {hasActiveFilters && (
                      <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                        {Object.values(filters).filter(v => v !== '' && v !== null).length}
                      </span>
                    )}
                  </button>
                  {showFilterDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-50 p-3 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-300">Filtros</span>
                        {hasActiveFilters && (
                          <button
                            onClick={() => setFilters({ ciudad: '', plaza: '', mueble: '', tipo_medio: '', catorcena: null })}
                            className="text-[10px] text-purple-400 hover:text-purple-300"
                          >
                            Limpiar todo
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Ciudad</label>
                        <select
                          value={filters.ciudad}
                          onChange={(e) => setFilters(f => ({ ...f, ciudad: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Todas</option>
                          {filterOptions.ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Plaza</label>
                        <select
                          value={filters.plaza}
                          onChange={(e) => setFilters(f => ({ ...f, plaza: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Todas</option>
                          {filterOptions.plazas.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Mueble</label>
                        <select
                          value={filters.mueble}
                          onChange={(e) => setFilters(f => ({ ...f, mueble: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Todos</option>
                          {filterOptions.muebles.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Tipo de Medio</label>
                        <select
                          value={filters.tipo_medio}
                          onChange={(e) => setFilters(f => ({ ...f, tipo_medio: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Todos</option>
                          {filterOptions.tiposMedio.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Catorcena</label>
                        <select
                          value={filters.catorcena ?? ''}
                          onChange={(e) => setFilters(f => ({ ...f, catorcena: e.target.value ? parseInt(e.target.value) : null }))}
                          className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Todas</option>
                          {filterOptions.catorcenas.map(c => <option key={c} value={c}>Catorcena {c}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => setShowFilterDropdown(false)}
                        className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                      >
                        Aplicar
                      </button>
                    </div>
                  )}
                </div>

                {/* Group Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowGroupDropdown(!showGroupDropdown);
                      setShowFilterDropdown(false);
                      setShowSortDropdown(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isGrouped
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Agrupar</span>
                  </button>
                  {showGroupDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                      {GROUP_BY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setGroupByField(opt.value);
                            setShowGroupDropdown(false);
                            if (opt.value !== 'none') {
                              setExpandedNodes(new Set(['all']));
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                            groupByField === opt.value
                              ? 'bg-purple-600/30 text-purple-300'
                              : 'hover:bg-purple-900/30 text-zinc-300'
                          }`}
                        >
                          {opt.label}
                          {groupByField === opt.value && (
                            <Check className="h-3 w-3 inline ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSortDropdown(!showSortDropdown);
                      setShowFilterDropdown(false);
                      setShowGroupDropdown(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>Ordenar</span>
                  </button>
                  {showSortDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                      <div className="px-3 py-1.5 border-b border-border">
                        <span className="text-[10px] text-zinc-500 uppercase">Ordenar por</span>
                      </div>
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            if (sortField === opt.value) {
                              setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField(opt.value);
                              setSortDirection('asc');
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                            sortField === opt.value
                              ? 'bg-purple-600/30 text-purple-300'
                              : 'hover:bg-purple-900/30 text-zinc-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sortField === opt.value && (
                            <span className="text-[10px] text-purple-400">
                              {sortDirection === 'asc' ? 'A-Z' : 'Z-A'}
                            </span>
                          )}
                        </button>
                      ))}
                      <div className="px-3 py-2 border-t border-border">
                        <button
                          onClick={() => setShowSortDropdown(false)}
                          className="w-full px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Download */}
                <button
                  onClick={() => console.log('Download inventory')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Active filters display */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[10px] text-zinc-500">Filtros activos:</span>
                {filters.ciudad && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[10px]">
                    Ciudad: {filters.ciudad}
                    <button onClick={() => setFilters(f => ({ ...f, ciudad: '' }))} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.plaza && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[10px]">
                    Plaza: {filters.plaza}
                    <button onClick={() => setFilters(f => ({ ...f, plaza: '' }))} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.mueble && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[10px]">
                    Mueble: {filters.mueble}
                    <button onClick={() => setFilters(f => ({ ...f, mueble: '' }))} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.tipo_medio && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[10px]">
                    Tipo: {filters.tipo_medio}
                    <button onClick={() => setFilters(f => ({ ...f, tipo_medio: '' }))} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.catorcena !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[10px]">
                    Catorcena: {filters.catorcena}
                    <button onClick={() => setFilters(f => ({ ...f, catorcena: null }))} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

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
                    <span className="text-xs">Selecciona artes para aprobar, rechazar o crear tareas</span>
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
                      updateArteStatusMutation.mutate({ reservaIds, status: 'Aprobado' });
                    }
                  }}
                  disabled={selectedInventoryIds.size === 0 || updateArteStatusMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {updateArteStatusMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Aprobar
                </button>
                <button
                  onClick={() => {
                    const comentario = prompt('Ingresa el motivo del rechazo:');
                    if (comentario) {
                      const reservaIds = selectedInventoryItems.flatMap(item =>
                        item.rsv_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                      );
                      if (reservaIds.length > 0) {
                        updateArteStatusMutation.mutate({ reservaIds, status: 'Rechazado', comentario });
                      }
                    }
                  }}
                  disabled={selectedInventoryIds.size === 0 || updateArteStatusMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </button>
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
            ) : activeMainTab === 'versionario' ? (
              // Vista jerárquica de 3 niveles para Subir Artes: Catorcena -> APS -> Grupo
              <div className="divide-y divide-border">
                {Object.entries(versionarioGroupedInventory).map(([catorcenaKey, apsGroups]) => {
                  const catorcenaExpanded = expandedNodes.has(catorcenaKey);
                  const catorcenaItemCount = Object.values(apsGroups).reduce(
                    (sum, grupoItems) => sum + Object.values(grupoItems).reduce((s, items) => s + items.length, 0), 0
                  );
                  return (
                    <div key={catorcenaKey}>
                      {/* Nivel 1: Catorcena */}
                      <button
                        onClick={() => toggleNode(catorcenaKey)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {catorcenaExpanded ? (
                            <ChevronDown className="h-4 w-4 text-purple-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-sm font-bold text-white">{catorcenaKey}</span>
                        </div>
                        <Badge className="bg-purple-600/40 text-purple-200 border-purple-500/30">
                          {catorcenaItemCount} elemento{catorcenaItemCount !== 1 ? 's' : ''}
                        </Badge>
                      </button>
                      {catorcenaExpanded && (
                        <div className="pl-4">
                          {Object.entries(apsGroups).map(([apsKey, grupoItems]) => {
                            const apsNodeKey = `${catorcenaKey}|${apsKey}`;
                            const apsExpanded = expandedNodes.has(apsNodeKey);
                            const apsItemCount = Object.values(grupoItems).reduce((s, items) => s + items.length, 0);
                            return (
                              <div key={apsNodeKey} className="border-l-2 border-purple-600/30">
                                {/* Nivel 2: APS */}
                                <button
                                  onClick={() => toggleNode(apsNodeKey)}
                                  className="w-full px-4 py-2 flex items-center justify-between bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {apsExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                                    )}
                                    <span className="text-xs font-semibold text-purple-300">{apsKey}</span>
                                  </div>
                                  <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/20 text-[10px]">
                                    {apsItemCount}
                                  </Badge>
                                </button>
                                {apsExpanded && (
                                  <div className="pl-4">
                                    {Object.entries(grupoItems).map(([grupoKey, items]) => {
                                      const grupoNodeKey = `${catorcenaKey}|${apsKey}|${grupoKey}`;
                                      const grupoExpanded = expandedNodes.has(grupoNodeKey);
                                      return (
                                        <div key={grupoNodeKey} className="border-l-2 border-purple-500/20">
                                          {/* Nivel 3: Grupo */}
                                          <button
                                            onClick={() => toggleNode(grupoNodeKey)}
                                            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-purple-900/10 transition-colors"
                                          >
                                            <div className="flex items-center gap-2">
                                              {grupoExpanded ? (
                                                <ChevronDown className="h-3 w-3 text-zinc-400" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-zinc-400" />
                                              )}
                                              <span className="text-[11px] font-medium text-zinc-400">{grupoKey}</span>
                                              {/* Checkbox para seleccionar todo el grupo */}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
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
                                          {grupoExpanded && (
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
                                {activeMainTab === 'atender' && (
                                  <>
                                    <th className="p-2 font-medium text-purple-300">Código</th>
                                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                    <th className="p-2 font-medium text-purple-300">Mueble</th>
                                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                                    <th className="p-2 font-medium text-purple-300">Estado Arte</th>
                                  </>
                                )}
                                {activeMainTab === 'testigo' && (
                                  <>
                                    <th className="p-2 font-medium text-purple-300">Código</th>
                                    <th className="p-2 font-medium text-purple-300">Ubicación</th>
                                    <th className="p-2 font-medium text-purple-300">Mueble</th>
                                    <th className="p-2 font-medium text-purple-300">Plaza</th>
                                    <th className="p-2 font-medium text-purple-300">Testigo</th>
                                  </>
                                )}
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
                    {/* Atender Headers */}
                    {activeMainTab === 'atender' && (
                      <>
                        <th className="p-2 font-medium text-purple-300">Código</th>
                        <th className="p-2 font-medium text-purple-300">Ubicación</th>
                        <th className="p-2 font-medium text-purple-300">Mueble</th>
                        <th className="p-2 font-medium text-purple-300">Plaza</th>
                        <th className="p-2 font-medium text-purple-300">APS</th>
                        <th className="p-2 font-medium text-purple-300">Estado Arte</th>
                        <th className="p-2 font-medium text-purple-300">Estado Tarea</th>
                      </>
                    )}
                    {/* Testigo Headers */}
                    {activeMainTab === 'testigo' && (
                      <>
                        <th className="p-2 font-medium text-purple-300">Código</th>
                        <th className="p-2 font-medium text-purple-300">Ubicación</th>
                        <th className="p-2 font-medium text-purple-300">Mueble</th>
                        <th className="p-2 font-medium text-purple-300">Plaza</th>
                        <th className="p-2 font-medium text-purple-300">APS</th>
                        <th className="p-2 font-medium text-purple-300">Testigo</th>
                      </>
                    )}
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
                              <button className="px-2 py-1 text-[10px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
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
    </div>
  );
}
