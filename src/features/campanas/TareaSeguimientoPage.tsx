import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { campanasService, InventarioReservado } from '../../services/campanas.service';
import { Badge } from '../../components/ui/badge';

// ============================================================================
// TYPES
// ============================================================================

type MainTab = 'versionario' | 'atender' | 'testigo';
type FormatTab = 'tradicional' | 'digital';
type TasksTab = 'tradicionales' | 'completadas' | 'calendario';
type CalendarView = 'month' | 'week' | 'day' | 'list';

interface InventoryRow {
  id: string;
  rsv_id: string; // IDs de reserva concatenados
  codigo_unico: string;
  tipo_de_cara: string;
  catorcena: number;
  anio: number;
  aps: number | null;
  estatus: string; // Estado de reserva (Vendido, etc.)
  espacio: string; // Números de espacio
  inicio_periodo: string;
  fin_periodo: string;
  caras_totales: number;
  // Campos de inventario
  tipo_medio: string; // Flujo, Estático, etc.
  mueble: string; // Parabus, Mupie, etc.
  ciudad: string;
  plaza: string;
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
// MOCK DATA
// ============================================================================

const MOCK_INVENTORY: InventoryRow[] = [
  {
    id: '1',
    rsv_id: '16431',
    codigo_unico: 'ZP1099_Flujo_Zapopan',
    tipo_de_cara: 'A',
    catorcena: 10,
    anio: 2024,
    aps: 13,
    estatus: 'Vendido',
    espacio: '1',
    inicio_periodo: '2024-05-06',
    fin_periodo: '2024-05-19',
    caras_totales: 1,
    tipo_medio: 'Flujo',
    mueble: 'Parabus',
    ciudad: 'Guadalajara',
    plaza: 'Zapopan',
    ubicacion: 'GUADALUPE - PINTORES',
    tradicional_digital: 'Digital',
    estado_arte: 'sin_revisar',
    estado_tarea: 'sin_atender',
    testigo_status: 'pendiente',
  },
  {
    id: '2',
    rsv_id: '16429',
    codigo_unico: '61802_Flujo_Zapopan',
    tipo_de_cara: 'A',
    catorcena: 10,
    anio: 2024,
    aps: 13,
    estatus: 'Vendido',
    espacio: '1',
    inicio_periodo: '2024-05-06',
    fin_periodo: '2024-05-19',
    caras_totales: 1,
    tipo_medio: 'Flujo',
    mueble: 'Parabus',
    ciudad: 'Guadalajara',
    plaza: 'Zapopan',
    ubicacion: 'AV. LÁZARO CÁRDENAS - AV. SAN FRANCISCO',
    tradicional_digital: 'Digital',
    estado_arte: 'en_revision',
    estado_tarea: 'en_progreso',
    testigo_status: 'pendiente',
  },
  {
    id: '3',
    rsv_id: '16500,16501',
    codigo_unico: 'MTY2045_Estatico_Monterrey',
    tipo_de_cara: 'Completo',
    catorcena: 10,
    anio: 2024,
    aps: 14,
    estatus: 'Vendido',
    espacio: '1,2',
    inicio_periodo: '2024-05-06',
    fin_periodo: '2024-05-19',
    caras_totales: 2,
    tipo_medio: 'Estático',
    mueble: 'Mupie',
    ciudad: 'Monterrey',
    plaza: 'San Pedro',
    ubicacion: 'AV. VASCONCELOS - RICARDO MARGAIN',
    tradicional_digital: 'Tradicional',
    estado_arte: 'aprobado',
    estado_tarea: 'atendido',
    testigo_status: 'validado',
  },
  {
    id: '4',
    rsv_id: '16510',
    codigo_unico: 'CDMX3021_Flujo_Polanco',
    tipo_de_cara: 'B',
    catorcena: 11,
    anio: 2024,
    aps: 15,
    estatus: 'Vendido',
    espacio: '1',
    inicio_periodo: '2024-05-20',
    fin_periodo: '2024-06-02',
    caras_totales: 1,
    tipo_medio: 'Flujo',
    mueble: 'Parabus',
    ciudad: 'CDMX',
    plaza: 'Polanco',
    ubicacion: 'PRESIDENTE MASARYK - EDGAR ALLAN POE',
    tradicional_digital: 'Digital',
    estado_arte: 'sin_revisar',
    estado_tarea: 'sin_atender',
    testigo_status: 'pendiente',
  },
  {
    id: '5',
    rsv_id: '16520',
    codigo_unico: 'GDL5055_Estatico_Providencia',
    tipo_de_cara: 'A',
    catorcena: 11,
    anio: 2024,
    aps: 15,
    estatus: 'Vendido',
    espacio: '1',
    inicio_periodo: '2024-05-20',
    fin_periodo: '2024-06-02',
    caras_totales: 1,
    tipo_medio: 'Estático',
    mueble: 'Totem',
    ciudad: 'Guadalajara',
    plaza: 'Providencia',
    ubicacion: 'AV. PROVIDENCIA - PABLO NERUDA',
    tradicional_digital: 'Tradicional',
    estado_arte: 'rechazado',
    estado_tarea: 'en_progreso',
    testigo_status: 'rechazado',
  },
];

const MOCK_TASKS: TaskRow[] = [
  { id: 't1', tipo: 'Arte', estatus: 'pendiente', identificador: 'TASK-001', fecha_inicio: '2025-01-15', fecha_fin: '2025-01-20', creador: 'Juan Perez', asignado: 'Maria Garcia', descripcion: 'Revisar arte de banner', titulo: 'Revision Banner Principal', inventario_ids: ['1', '2'], campana_id: 1 },
  { id: 't2', tipo: 'Produccion', estatus: 'en_progreso', identificador: 'TASK-002', fecha_inicio: '2025-01-10', fecha_fin: '2025-01-25', creador: 'Ana Lopez', asignado: 'Carlos Ruiz', descripcion: 'Producir material POP', titulo: 'Produccion POP', inventario_ids: ['3'], campana_id: 1 },
];

const MOCK_COMPLETED_TASKS: TaskRow[] = [
  { id: 't3', tipo: 'Arte', estatus: 'completada', identificador: 'TASK-000', fecha_inicio: '2025-01-01', fecha_fin: '2025-01-05', creador: 'Pedro Sanchez', asignado: 'Laura Martinez', descripcion: 'Arte inicial aprobado', titulo: 'Arte Inicial', contenido: 'Arte aprobado sin cambios', inventario_ids: ['3'], campana_id: 1 },
];

const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'Revision Banner Principal', date: new Date(2025, 0, 20), type: 'tarea' },
  { id: 'e2', title: 'Produccion POP', date: new Date(2025, 0, 25), type: 'tarea' },
  { id: 'e3', title: 'Entrega Final', date: new Date(2025, 0, 30), type: 'entrega' },
];

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
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
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
type UploadOption = 'existing' | 'file' | 'link';

interface ExistingArt {
  id: string;
  nombre: string;
  url: string;
}

// Mock existing arts
const MOCK_EXISTING_ARTS: ExistingArt[] = [
  { id: 'art1', nombre: 'Banner Principal 2025', url: 'https://example.com/art1.jpg' },
  { id: 'art2', nombre: 'Arte Campaña Verano', url: 'https://example.com/art2.jpg' },
  { id: 'art3', nombre: 'Diseño Promocional Q1', url: 'https://example.com/art3.jpg' },
];

// Upload Art Modal Component
function UploadArtModal({
  isOpen,
  onClose,
  selectedInventory,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedInventory: InventoryRow[];
  onSubmit: (data: { option: UploadOption; value: string | File; inventoryIds: string[] }) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<UploadOption>('existing');
  const [existingArtId, setExistingArtId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  const filteredInventory = useMemo(() => {
    if (!tableSearch) return selectedInventory;
    const search = tableSearch.toLowerCase();
    return selectedInventory.filter(
      (item) =>
        item.codigo_unico.toLowerCase().includes(search) ||
        item.plaza.toLowerCase().includes(search) ||
        item.mueble.toLowerCase().includes(search)
    );
  }, [selectedInventory, tableSearch]);

  const handleSubmit = () => {
    let value: string | File = '';
    if (selectedOption === 'existing') {
      value = existingArtId;
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
    console.log('Uploading art:', payload);
    onSubmit(payload);

    // Reset form
    setSelectedOption('existing');
    setExistingArtId('');
    setFile(null);
    setLink('');
    onClose();
  };

  const isSubmitDisabled = () => {
    if (selectedOption === 'existing' && !existingArtId) return true;
    if (selectedOption === 'file' && !file) return true;
    if (selectedOption === 'link' && !link.trim()) return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-4xl mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-400" />
            Agregar Arte
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Options */}
          <div className="space-y-4">
            {/* Option Selector */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Escoge una opción
              </label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value as UploadOption)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="existing">Escoger existente</option>
                <option value="file">Seleccionar un archivo</option>
                <option value="link">Subir link</option>
              </select>
            </div>

            {/* Dynamic Content based on option */}
            {selectedOption === 'existing' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Seleccionar arte existente
                </label>
                <select
                  value={existingArtId}
                  onChange={(e) => setExistingArtId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">-- Selecciona un arte --</option>
                  {MOCK_EXISTING_ARTS.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedOption === 'file' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Seleccionar archivo
                </label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept="image/*,.pdf,.ai,.psd"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                </div>
                {file && (
                  <p className="mt-2 text-xs text-purple-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {file.name}
                  </p>
                )}
              </div>
            )}

            {selectedOption === 'link' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Link
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://ejemplo.com/arte.jpg"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {/* Right Column - Context Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Contexto ({selectedInventory.length} {selectedInventory.length === 1 ? 'resultado' : 'resultados'})
              </span>
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-purple-900/30 rounded transition-colors" title="Filtrar">
                  <Filter className="h-3.5 w-3.5 text-zinc-400" />
                </button>
                <button className="p-1.5 hover:bg-purple-900/30 rounded transition-colors" title="Ordenar">
                  <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[200px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-purple-900/20 border-b border-border">
                    <tr className="text-left">
                      <th className="p-2 font-medium text-purple-300">Reserva</th>
                      <th className="p-2 font-medium text-purple-300">Ubicación</th>
                      <th className="p-2 font-medium text-purple-300">Mueble</th>
                      <th className="p-2 font-medium text-purple-300">Espacios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-zinc-500">
                          Sin resultados
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-purple-900/10">
                          <td className="p-2 font-medium text-white">{item.rsv_id}</td>
                          <td className="p-2 text-zinc-400 max-w-[120px] truncate" title={item.ubicacion}>
                            {item.ubicacion}
                          </td>
                          <td className="p-2 text-zinc-400 max-w-[80px] truncate" title={item.mueble}>
                            {item.mueble}
                          </td>
                          <td className="p-2 text-zinc-400">{item.espacio}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled()}
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agregar
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
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: string[];
  campanaId: number;
  onSubmit: (task: Partial<TaskRow>) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignado, setAsignado] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estatus, setEstatus] = useState<TaskRow['estatus']>('pendiente');

  const handleSubmit = () => {
    const payload: Partial<TaskRow> = {
      titulo,
      descripcion,
      asignado,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estatus,
      inventario_ids: selectedIds,
      campana_id: campanaId,
      tipo: 'Arte',
      creador: 'Usuario Actual',
      identificador: `TASK-${Date.now()}`,
    };
    console.log('Creating task:', payload);
    onSubmit(payload);
    // Reset form
    setTitulo('');
    setDescripcion('');
    setAsignado('');
    setFechaInicio('');
    setFechaFin('');
    setEstatus('pendiente');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5 text-purple-400" />
            Crear Tarea
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-purple-900/30 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <p className="text-xs text-purple-300">
            <span className="font-medium">{selectedCount}</span> inventario(s) seleccionado(s)
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Titulo *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Titulo de la tarea"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descripcion</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              placeholder="Descripcion de la tarea"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Asignado</label>
            <input
              type="text"
              value={asignado}
              onChange={(e) => setAsignado(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Nombre del asignado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Estatus inicial</label>
            <select
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as TaskRow['estatus'])}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!titulo.trim()}
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Crear tarea
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
            <EmptyState message="Sin eventos" />
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
// MAIN PAGE COMPONENT
// ============================================================================

export function TareaSeguimientoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campanaId = id ? parseInt(id, 10) : 0;

  // ---- State ----
  // Main tabs
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('atender');
  const [activeFormat, setActiveFormat] = useState<FormatTab>('tradicional');
  const [activeTasksTab, setActiveTasksTab] = useState<TasksTab>('tradicionales');

  // Inventory state
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [inventorySearch, setInventorySearch] = useState('');
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['all']));

  // Tasks state
  const [tasksSearch, setTasksSearch] = useState('');
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>('');
  const [tasks, setTasks] = useState<TaskRow[]>(MOCK_TASKS);
  const [completedTasks] = useState<TaskRow[]>(MOCK_COMPLETED_TASKS);

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadArtModalOpen, setIsUploadArtModalOpen] = useState(false);

  // ---- Query ----
  const { data: campana, isLoading, error } = useQuery({
    queryKey: ['campana', campanaId],
    queryFn: () => campanasService.getById(campanaId),
    enabled: campanaId > 0,
  });

  const { data: inventarioAPI = [], isLoading: isLoadingInventario } = useQuery({
    queryKey: ['campana-inventario', campanaId],
    queryFn: () => campanasService.getInventarioReservado(campanaId),
    enabled: campanaId > 0,
  });

  // Transform API data to InventoryRow format
  const inventoryData = useMemo((): InventoryRow[] => {
    return inventarioAPI.map((item: InventarioReservado) => ({
      id: item.id.toString(),
      rsv_id: item.rsv_ids,
      codigo_unico: item.codigo_unico || '',
      tipo_de_cara: item.tipo_de_cara || '',
      catorcena: item.numero_catorcena || 0,
      anio: item.anio_catorcena || 0,
      aps: null, // APS se obtiene de otro endpoint si es necesario
      estatus: item.estatus_reserva || '',
      espacio: '',
      inicio_periodo: item.inicio_periodo?.split('T')[0] || '',
      fin_periodo: item.fin_periodo?.split('T')[0] || '',
      caras_totales: item.caras_totales || 0,
      tipo_medio: item.tipo_medio || '',
      mueble: item.mueble || '',
      ciudad: item.estado || '',
      plaza: item.plaza || '',
      ubicacion: item.articulo || '',
      tradicional_digital: (item.tradicional_digital === 'Tradicional' ? 'Tradicional' : 'Digital') as 'Tradicional' | 'Digital',
      estado_arte: 'sin_revisar',
      estado_tarea: 'sin_atender',
      testigo_status: 'pendiente',
    }));
  }, [inventarioAPI]);

  // ---- Computed ----
  const filteredInventory = useMemo(() => {
    let data = inventoryData;

    // Filter by format (tradicional/digital)
    const formatFilter = activeFormat === 'tradicional' ? 'Tradicional' : 'Digital';
    data = data.filter((item) => item.tradicional_digital === formatFilter);

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
    return data;
  }, [inventoryData, inventorySearch, activeFormat]);

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

  // Group inventory by Catorcena -> APS -> Estado Arte -> Estado Tarea
  const groupedInventory = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, Record<string, InventoryRow[]>>>> = {};

    filteredInventory.forEach((item) => {
      const catorcenaKey = `Catorcena: ${item.catorcena}, Año: ${item.anio}`;
      const apsKey = `APS: ${item.aps ?? 'Sin asignar'}`;
      const arteKey = `Arte: ${estadoArteLabels[item.estado_arte]}`;
      const tareaKey = `Tarea: ${estadoTareaLabels[item.estado_tarea]}`;

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
    return inventoryData.filter((item) => selectedInventoryIds.has(item.id));
  }, [inventoryData, selectedInventoryIds]);

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

  const handleCreateTask = useCallback((task: Partial<TaskRow>) => {
    const newTask: TaskRow = {
      id: `t${Date.now()}`,
      tipo: task.tipo || 'Arte',
      estatus: task.estatus || 'pendiente',
      identificador: task.identificador || `TASK-${Date.now()}`,
      fecha_inicio: task.fecha_inicio || '',
      fecha_fin: task.fecha_fin || '',
      creador: task.creador || 'Usuario',
      asignado: task.asignado || '',
      descripcion: task.descripcion || '',
      titulo: task.titulo || '',
      inventario_ids: task.inventario_ids || [],
      campana_id: campanaId,
    };
    setTasks((prev) => [...prev, newTask]);
    setSelectedInventoryIds(new Set());
  }, [campanaId]);

  const handleUploadArt = useCallback((data: { option: UploadOption; value: string | File; inventoryIds: string[] }) => {
    console.log('Art uploaded:', data);
    // Here you would call the API to upload/associate the art
    // For now, just clear selection
    setSelectedInventoryIds(new Set());
  }, []);

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
      <td className="p-2 text-xs text-purple-300">{item.aps}</td>
      <td className="p-2">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
          item.tradicional_digital === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {item.tradicional_digital}
        </span>
      </td>
      <td className="p-2 text-xs font-medium text-white">{item.codigo_unico}</td>
      <td className="p-2 text-xs text-zinc-300 max-w-[180px] truncate" title={item.ubicacion}>{item.ubicacion}</td>
      <td className="p-2 text-xs text-zinc-300">{item.tipo_medio}</td>
      <td className="p-2 text-xs text-zinc-300">{item.mueble}</td>
      <td className="p-2 text-xs text-zinc-300">{item.ciudad}</td>
      <td className="p-2 text-xs text-zinc-300">{item.plaza}</td>
      <td className="p-2">
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-300">
          {item.estatus}
        </span>
      </td>
      <td className="p-2 text-xs text-zinc-300 text-center">{item.caras_totales}</td>
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
        <Header title="Revision de Artes" />
        <div className="p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      </div>
    );
  }

  if (error || !campana) {
    return (
      <div className="min-h-screen">
        <Header title="Revision de Artes" />
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
      <Header title="Revision de Artes / Seguimiento" />

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
            <span className="text-xs text-muted-foreground">#{campana.id}</span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* BLOQUE A: INVENTARIO (PRINCIPAL) */}
        {/* ================================================================ */}
        <div className="bg-card rounded-xl border border-border">
          {/* Main Tabs: Versionario / Atender / Testigo */}
          <div className="border-b border-border">
            <div className="flex">
              {([
                { key: 'versionario', label: 'Versionario de artes' },
                { key: 'atender', label: 'Atender arte' },
                { key: 'testigo', label: 'Testigo' },
              ] as { key: MainTab; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveMainTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeMainTab === tab.key
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-muted-foreground hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tabs: Formato */}
          <div className="px-4 py-2 border-b border-border bg-purple-900/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Formato:</span>
              <div className="flex gap-1">
                {(['tradicional', 'digital'] as FormatTab[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => setActiveFormat(format)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${
                      activeFormat === format
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-900/30 text-zinc-400 hover:bg-purple-900/50'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Inventory Toolbar */}
          <div className="p-4 border-b border-border">
            <Toolbar
              searchValue={inventorySearch}
              onSearchChange={setInventorySearch}
              onFilter={() => console.log('Filter inventory')}
              onDownload={() => console.log('Download inventory')}
              onGroup={() => setIsGrouped(!isGrouped)}
              onSort={() => console.log('Sort inventory')}
              showGrouping={true}
              isGrouped={isGrouped}
              groupCount={isGrouped ? 2 : 0}
            />
          </div>

          {/* Action Buttons (Versionario tab) */}
          {activeMainTab === 'versionario' && (
            <div className="px-4 py-2 border-b border-border bg-purple-900/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedInventoryIds.size > 0 && (
                  <span className="text-xs text-purple-300">
                    {selectedInventoryIds.size} seleccionado(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadArtModalOpen(true)}
                  disabled={selectedInventoryIds.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-lg ${
                    selectedInventoryIds.size > 0
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-purple-500/25'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Cargar artes
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons (Atender tab) */}
          {activeMainTab === 'atender' && (
            <div className="px-4 py-2 border-b border-border bg-purple-900/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedInventoryIds.size > 0 && (
                  <span className="text-xs text-purple-300">
                    {selectedInventoryIds.size} seleccionado(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={selectedInventoryIds.size === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-purple-900/30 text-purple-400/50 cursor-not-allowed'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear tarea
                </button>
                <button
                  disabled={selectedInventoryIds.size === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                    selectedInventoryIds.size > 0
                      ? 'bg-purple-900/30 hover:bg-purple-900/50 border-purple-500/30'
                      : 'bg-purple-900/20 text-purple-400/50 border-purple-500/20 cursor-not-allowed'
                  }`}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Editar/Atender
                </button>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="max-h-[400px] overflow-auto">
            {isLoadingInventario ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando inventario...</span>
              </div>
            ) : filteredInventory.length === 0 ? (
              <EmptyState message="Sin inventario para este formato" />
            ) : activeMainTab === 'atender' && isGrouped ? (
              // Grouped Tree View
              <div className="divide-y divide-border">
                {Object.entries(groupedInventory).map(([catorcenaKey, apsGroups]) => {
                  const catorcenaCount = Object.values(apsGroups).reduce(
                    (sum, aps) =>
                      sum +
                      Object.values(aps).reduce(
                        (s, arte) => s + Object.values(arte).reduce((a, items) => a + items.length, 0),
                        0
                      ),
                    0
                  );
                  return (
                    <TreeNode
                      key={catorcenaKey}
                      label={catorcenaKey}
                      count={catorcenaCount}
                      level={0}
                      isExpanded={expandedNodes.has(catorcenaKey)}
                      onToggle={() => toggleNode(catorcenaKey)}
                    >
                      {Object.entries(apsGroups).map(([apsKey, arteGroups]) => {
                        const apsCount = Object.values(arteGroups).reduce(
                          (sum, arte) => sum + Object.values(arte).reduce((a, items) => a + items.length, 0),
                          0
                        );
                        return (
                          <TreeNode
                            key={`${catorcenaKey}-${apsKey}`}
                            label={apsKey}
                            count={apsCount}
                            level={1}
                            isExpanded={expandedNodes.has(`${catorcenaKey}-${apsKey}`)}
                            onToggle={() => toggleNode(`${catorcenaKey}-${apsKey}`)}
                          >
                            {Object.entries(arteGroups).map(([arteKey, tareaGroups]) => {
                              const arteCount = Object.values(tareaGroups).reduce((a, items) => a + items.length, 0);
                              return (
                                <TreeNode
                                  key={`${catorcenaKey}-${apsKey}-${arteKey}`}
                                  label={arteKey}
                                  count={arteCount}
                                  level={2}
                                  isExpanded={expandedNodes.has(`${catorcenaKey}-${apsKey}-${arteKey}`)}
                                  onToggle={() => toggleNode(`${catorcenaKey}-${apsKey}-${arteKey}`)}
                                >
                                  {Object.entries(tareaGroups).map(([tareaKey, items]) => (
                                    <TreeNode
                                      key={`${catorcenaKey}-${apsKey}-${arteKey}-${tareaKey}`}
                                      label={tareaKey}
                                      count={items.length}
                                      level={3}
                                      isExpanded={expandedNodes.has(`${catorcenaKey}-${apsKey}-${arteKey}-${tareaKey}`)}
                                      onToggle={() => toggleNode(`${catorcenaKey}-${apsKey}-${arteKey}-${tareaKey}`)}
                                    >
                                      <table className="w-full text-xs">
                                        <tbody>
                                          {items.map((item) => renderInventoryRow(item))}
                                        </tbody>
                                      </table>
                                    </TreeNode>
                                  ))}
                                </TreeNode>
                              );
                            })}
                          </TreeNode>
                        );
                      })}
                    </TreeNode>
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
                    {/* Versionario Headers */}
                    {activeMainTab === 'versionario' && (
                      <>
                        <th className="p-2 font-medium text-purple-300">APS</th>
                        <th className="p-2 font-medium text-purple-300">Tipo</th>
                        <th className="p-2 font-medium text-purple-300">Código</th>
                        <th className="p-2 font-medium text-purple-300">Ubicación</th>
                        <th className="p-2 font-medium text-purple-300">Medio</th>
                        <th className="p-2 font-medium text-purple-300">Mueble</th>
                        <th className="p-2 font-medium text-purple-300">Ciudad</th>
                        <th className="p-2 font-medium text-purple-300">Plaza</th>
                        <th className="p-2 font-medium text-purple-300">Estatus</th>
                        <th className="p-2 font-medium text-purple-300 text-center">Caras</th>
                      </>
                    )}
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
          {/* Tasks Tabs */}
          <div className="border-b border-border">
            <div className="flex">
              {([
                { key: 'tradicionales', label: 'Tareas Tradicionales' },
                { key: 'completadas', label: 'Tareas Completadas' },
                { key: 'calendario', label: 'Calendario' },
              ] as { key: TasksTab; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTasksTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTasksTab === tab.key
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-muted-foreground hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
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
                    <EmptyState message="Sin tareas" />
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
                    <EmptyState message="Sin tareas completadas" />
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
                events={MOCK_CALENDAR_EVENTS}
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
        onClose={() => setIsCreateModalOpen(false)}
        selectedCount={selectedInventoryIds.size}
        selectedIds={Array.from(selectedInventoryIds)}
        campanaId={campanaId}
        onSubmit={handleCreateTask}
      />

      {/* Upload Art Modal */}
      <UploadArtModal
        isOpen={isUploadArtModalOpen}
        onClose={() => setIsUploadArtModalOpen(false)}
        selectedInventory={selectedInventoryItems}
        onSubmit={handleUploadArt}
      />
    </div>
  );
}
