import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Users,
  FileText, MapPin, Layers, Pencil, Map as MapIcon, Package,
  Gift, Target, Save, ArrowLeft, Filter, Grid, LayoutGrid, Ruler, ArrowUpDown, Download, Eye
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { AdvancedMapComponent } from './AdvancedMapComponent';
import { Propuesta } from '../../types';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService, InventarioDisponible } from '../../services/inventarios.service';
import { propuestasService, ReservaModalItem } from '../../services/propuestas.service';
import { formatCurrency } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

// Dark map styles
const DARK_MAP_STYLES = [
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  propuesta: Propuesta;
}

interface CaraItem {
  localId: string;
  id?: number;
  ciudad: string;
  estados: string;
  tipo: string;
  flujo: string;
  bonificacion: number;
  caras: number;
  nivel_socioeconomico: string;
  formato: string;
  costo: number;
  tarifa_publica: number;
  inicio_periodo: string;
  fin_periodo: string;
  caras_flujo: number;
  caras_contraflujo: number;
  articulo: string;
  descuento: number;
  isEditing?: boolean;
  catorcena_inicio?: number;
  anio_inicio?: number;
  catorcena_fin?: number;
  anio_fin?: number;
}

// SAP Articulo interface
interface SAPArticulo {
  ItemCode: string;
  ItemName: string;
}

// Tarifa publica lookup map based on ItemCode
const TARIFA_PUBLICA_MAP: Record<string, number> = {
  'RT-BL-COB-MX': 2500, 'RT-BP1-SEC1-01-NAUC': 110000, 'RT-BP1-SEC1-02-NAUC': 110000,
  'RT-BP2-SEC1-01-NAUC': 50000, 'RT-BP2-SEC1-02-NAUC': 50000, 'RT-BP3-SEC1-01-NAUC': 60000,
  'RT-BP3-SEC1-02-NAUC': 60000, 'RT-BP4-SEC1-01-NAUC': 55000, 'RT-BP5-SEC1-01-NAUC': 36667,
  'RT-CL-COB-MX': 6127, 'RT-CL-PRA-MX': 9190, 'RT-DIG-01-MR': 9842, 'RT-DIG-01-MX': 9482,
  'RT-DIG-01-PB': 8500, 'RT-ES-DIG-EM': 40000, 'RT-KCD-GDL-FL': 35000, 'RT-KCD-GDL-PER': 26900,
  'RT-KCS-AGS': 27500, 'RT-KCS-GDL': 30000, 'RT-KCS-LEN': 27500, 'RT-KCS-MEX-PER': 60000,
  'RT-KCS-SLP': 27500, 'RT-KCS-ZAP': 30000, 'RT-P1-COB-GD': 6127, 'RT-P1-COB-MX': 6127,
  'RT-P1-COB-ZP': 6127, 'RT-P2-COB-GD': 5000, 'RT-P2-COB-MR': 4000, 'RT-P2-COB-MX': 5000,
};

// Ciudad -> Estado mapping for auto-selection
const CIUDAD_ESTADO_MAP: Record<string, string> = {
  'GUADALAJARA': 'Jalisco', 'ZAPOPAN': 'Jalisco', 'TLAQUEPAQUE': 'Jalisco', 'TONALA': 'Jalisco',
  'TLAJOMULCO': 'Jalisco', 'PUERTO VALLARTA': 'Jalisco', 'MONTERREY': 'Nuevo León',
  'SAN PEDRO': 'Nuevo León', 'SAN NICOLAS': 'Nuevo León', 'APODACA': 'Nuevo León',
  'ESCOBEDO': 'Nuevo León', 'SANTA CATARINA': 'Nuevo León', 'CIUDAD DE MEXICO': 'Ciudad de México',
  'CDMX': 'Ciudad de México', 'MEXICO': 'Ciudad de México', 'DF': 'Ciudad de México',
  'TIJUANA': 'Baja California', 'MEXICALI': 'Baja California', 'LEON': 'Guanajuato',
  'IRAPUATO': 'Guanajuato', 'CELAYA': 'Guanajuato', 'QUERETARO': 'Querétaro', 'PUEBLA': 'Puebla',
  'MERIDA': 'Yucatán', 'CANCUN': 'Quintana Roo', 'PLAYA DEL CARMEN': 'Quintana Roo',
  'CHIHUAHUA': 'Chihuahua', 'JUAREZ': 'Chihuahua', 'HERMOSILLO': 'Sonora', 'CULIACAN': 'Sinaloa',
  'MAZATLAN': 'Sinaloa', 'TORREON': 'Coahuila', 'SALTILLO': 'Coahuila', 'AGUASCALIENTES': 'Aguascalientes',
  'MORELIA': 'Michoacán', 'SAN LUIS POTOSI': 'San Luis Potosí', 'TAMPICO': 'Tamaulipas',
  'VERACRUZ': 'Veracruz', 'OAXACA': 'Oaxaca', 'ACAPULCO': 'Guerrero', 'CUERNAVACA': 'Morelos',
  'TOLUCA': 'Estado de México', 'PACHUCA': 'Hidalgo', 'ZACATECAS': 'Zacatecas', 'DURANGO': 'Durango',
};

// Formato auto-detection from article name
const getFormatoFromArticulo = (itemName: string): string => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('PARABUS')) return 'PARABUS';
  if (name.includes('CASETA DE TAXIS')) return 'CASETA DE TAXIS';
  if (name.includes('METROPOLITANO PARALELO')) return 'METROPOLITANO PARALELO';
  if (name.includes('METROPOLITANO PERPENDICULAR')) return 'METROPOLITANO PERPENDICULAR';
  if (name.includes('COLUMNA RECARGA')) return 'COLUMNA RECARGA';
  if (name.includes('MUPI DE PIEDRA')) return 'MUPI DE PIEDRA';
  if (name.includes('MUPI')) return 'MUPI';
  if (name.includes('COLUMNA')) return 'COLUMNA';
  if (name.includes('BOLERO')) return 'BOLERO';
  return '';
};

// Tipo auto-detection from article name
const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' | '' => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  if (name.includes('TRADICIONAL') || name.includes('RENTA')) return 'Tradicional';
  return '';
};

// Get tarifa from ItemCode
const getTarifaFromItemCode = (itemCode: string): number => {
  if (!itemCode) return 0;
  const code = itemCode.toUpperCase().trim();
  return TARIFA_PUBLICA_MAP[code] || 850;
};

// Extract city/state from article name (sorted by length to avoid false positives)
const getCiudadEstadoFromArticulo = (itemName: string): { estado: string; ciudad: string } | null => {
  if (!itemName) return null;
  const name = itemName.toUpperCase();

  // Sort cities by length (longest first) to match more specific names before generic ones
  // This prevents "MEXICO" from matching before "CIUDAD DE MEXICO"
  const sortedCities = Object.entries(CIUDAD_ESTADO_MAP).sort((a, b) => b[0].length - a[0].length);

  for (const [ciudad, estado] of sortedCities) {
    // Use word boundary check - city must be preceded and followed by non-letter chars
    const regex = new RegExp(`(^|[^A-Z])${ciudad.replace(/\s+/g, '\\s+')}([^A-Z]|$)`, 'i');
    if (regex.test(name)) {
      return { estado, ciudad: ciudad.charAt(0) + ciudad.slice(1).toLowerCase() };
    }
  }
  return null;
};

interface ReservaItem {
  id: string;
  inventario_id: number;
  codigo_unico: string;
  tipo: 'Flujo' | 'Contraflujo' | 'Bonificacion';
  catorcena: number;
  anio: number;
  latitud: number;
  longitud: number;
  plaza: string;
  formato: string;
  ubicacion?: string | null;
  solicitudCaraId?: number; // For linking to cara
  reservaId?: number; // For existing reservas from DB
}

// View states for the modal
type ViewState = 'main' | 'search-inventory';

// MultiSelect component for checkbox-based multi-selection
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function MultiSelectDropdown({ options, selected, onChange, placeholder = 'Seleccionar...' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white text-left focus:outline-none focus:ring-1 focus:ring-purple-500/50 flex items-center justify-between"
      >
        <span className={selected.length === 0 ? 'text-zinc-500' : ''}>
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {options.map(option => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 cursor-pointer text-sm text-white"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
                className="checkbox-purple"
              />
              {option}
            </label>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-2 text-zinc-500 text-sm">Sin opciones</div>
          )}
        </div>
      )}
    </div>
  );
}

// Extended inventory item for processed data
type ProcessedInventoryItem = InventarioDisponible & {
  isCompleto?: boolean;
  flujoId?: number;
  contraflujoId?: number;
  grupo?: string;
};

// Empty cara template
const EMPTY_CARA: Omit<CaraItem, 'localId'> = {
  ciudad: '',
  estados: '',
  tipo: '',
  flujo: '',
  bonificacion: 0,
  caras: 0,
  nivel_socioeconomico: '',
  formato: '',
  costo: 0,
  tarifa_publica: 0,
  inicio_periodo: '',
  fin_periodo: '',
  caras_flujo: 0,
  caras_contraflujo: 0,
  articulo: '',
  descuento: 0,
  catorcena_inicio: undefined,
  anio_inicio: undefined,
  catorcena_fin: undefined,
  anio_fin: undefined,
};

// Searchable Select Component for articulos
function SearchableSelect({
  label,
  options,
  value,
  onChange,
  onClear,
  displayKey,
  valueKey,
  searchKeys,
  renderOption,
  renderSelected,
  loading,
}: {
  label: string;
  options: any[];
  value: any;
  onChange: (item: any) => void;
  onClear: () => void;
  displayKey: string;
  valueKey: string;
  searchKeys: string[];
  renderOption?: (item: any) => React.ReactNode;
  renderSelected?: (item: any) => React.ReactNode;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      searchKeys.some(key => String(opt[key] || '').toLowerCase().includes(term))
    );
  }, [options, searchTerm, searchKeys]);

  const handleClose = () => {
    setOpen(false);
    setSearchTerm('');
  };

  const displayValue = value ? (renderSelected ? null : String(value[displayKey])) : '';

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all ${value
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
          }`}
      >
        <span className="truncate text-left flex-1">
          {value && renderSelected ? renderSelected(value) : (displayValue || label)}
        </span>
        {value ? (
          <X className="h-4 w-4 hover:text-white flex-shrink-0" onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 w-full min-w-[350px] rounded-xl border border-purple-500/20 bg-zinc-900 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {loading ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">Cargando...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option, idx) => (
                  <button
                    key={`${option[valueKey]}-${idx}`}
                    type="button"
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-zinc-800/50 last:border-0 ${value && value[valueKey] === option[valueKey]
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                  >
                    {renderOption ? renderOption(option) : (
                      <span>{option[displayKey]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
              Mostrando {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

export function AssignInventarioModal({ isOpen, onClose, propuesta }: Props) {
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps with required libraries
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // View state
  const [viewState, setViewState] = useState<ViewState>('main');
  const [selectedCaraForSearch, setSelectedCaraForSearch] = useState<CaraItem | null>(null);

  // Editable propuesta fields
  const [asignados, setAsignados] = useState<UserOption[]>([]);
  const [nombreCampania, setNombreCampania] = useState('');
  const [notas, setNotas] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();
  const [archivoPropuesta, setArchivoPropuesta] = useState<string | null>(null);

  // Initial values for change detection
  const [initialValues, setInitialValues] = useState({
    nombreCampania: '',
    notas: '',
    descripcion: '',
    yearInicio: undefined as number | undefined,
    yearFin: undefined as number | undefined,
    catorcenaInicio: undefined as number | undefined,
    catorcenaFin: undefined as number | undefined,
    asignadosIds: '' as string,
  });
  const [isUpdatingPropuesta, setIsUpdatingPropuesta] = useState(false);

  // Caras state
  const [caras, setCaras] = useState<CaraItem[]>([]);
  const [expandedCaras, setExpandedCaras] = useState<Set<string>>(new Set());
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [editingCaraId, setEditingCaraId] = useState<string | null>(null);

  // New cara form
  const [newCara, setNewCara] = useState<Omit<CaraItem, 'localId'>>(EMPTY_CARA);
  const [selectedArticulo, setSelectedArticulo] = useState<SAPArticulo | null>(null);
  const [showAddCaraForm, setShowAddCaraForm] = useState(false);

  // Reservas state
  const [reservas, setReservas] = useState<ReservaItem[]>([]);

  // Inventory search state
  const [searchFilters, setSearchFilters] = useState({
    plaza: '',
    tipo: '',
    formato: '',
  });
  const [selectedInventory, setSelectedInventory] = useState<Set<number>>(new Set());
  const [selectedReservados, setSelectedReservados] = useState<Set<string>>(new Set());
  const [selectedMapReservas, setSelectedMapReservas] = useState<Set<string>>(new Set()); // For map highlighting
  const [reservadosSearchTerm, setReservadosSearchTerm] = useState('');
  const [editingReserva, setEditingReserva] = useState<ReservaItem | null>(null);
  const [editingFormato, setEditingFormato] = useState('');
  const [reservadosTipoFilter, setReservadosTipoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo' | 'Bonificacion'>('Todos');
  const [reservadosSortColumn, setReservadosSortColumn] = useState<'codigo' | 'tipo' | 'formato' | 'ciudad'>('ciudad');
  const [reservadosSortDirection, setReservadosSortDirection] = useState<'asc' | 'desc'>('asc');
  const [disponiblesSearchTerm, setDisponiblesSearchTerm] = useState('');

  // Advanced inventory filters
  const [showOnlyUnicos, setShowOnlyUnicos] = useState(false);
  const [showOnlyCompletos, setShowOnlyCompletos] = useState(false);
  const [groupByDistance, setGroupByDistance] = useState(false);
  const [distanciaGrupos, setDistanciaGrupos] = useState(500); // metros
  const [tamanoGrupo, setTamanoGrupo] = useState(10);
  const [flujoFilter, setFlujoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo'>('Todos');
  const [sortColumn, setSortColumn] = useState<string>('codigo_unico');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [agruparComoCompleto, setAgruparComoCompleto] = useState(true); // Group flujo+contraflujo at same location

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // Expanded groups state for collapsible groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Grupo 1']));

  // Tab state for search view (buscar / reservados)
  const [searchViewTab, setSearchViewTab] = useState<'buscar' | 'reservados'>('buscar');

  // Disponibles data
  const [inventarioDisponible, setInventarioDisponible] = useState<InventarioDisponible[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // POI filter state
  const [poiFilterIds, setPoiFilterIds] = useState<Set<number> | null>(null);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ codigo_unico: string; disponibilidad: 'Disponible' | 'No Disponible' }[]>([]);
  const [showCsvSection, setShowCsvSection] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  // Fetch solicitud full details
  const { data: solicitudDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['solicitud-full-details', propuesta.solicitud_id],
    queryFn: () => solicitudesService.getFullDetails(propuesta.solicitud_id),
    enabled: isOpen && !!propuesta.solicitud_id,
  });

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users'],
    queryFn: () => solicitudesService.getUsers(),
    enabled: isOpen,
  });

  // Fetch catorcenas
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  // Fetch articulos from SAP
  const { data: articulosData, isLoading: articulosLoading } = useQuery({
    queryKey: ['sap-articulos'],
    queryFn: async () => {
      try {
        const response = await fetch('https://binding-convinced-ride-foto.trycloudflare.com/articulos');
        if (!response.ok) throw new Error('Error fetching articulos');
        const data = await response.json();
        return (data.value || data) as SAPArticulo[];
      } catch {
        return [] as SAPArticulo[];
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing reservas for this propuesta
  const { data: existingReservas, isLoading: reservasLoading } = useQuery({
    queryKey: ['propuesta-reservas-modal', propuesta.id],
    queryFn: () => propuestasService.getReservasForModal(propuesta.id),
    enabled: isOpen && !!propuesta.id,
  });

  // Load existing reservas into state when data arrives
  useEffect(() => {
    if (existingReservas && existingReservas.length > 0 && caras.length > 0) {
      const loadedReservas: ReservaItem[] = existingReservas.map((r: ReservaModalItem) => {
        // Find the cara that matches this reserva
        const matchingCara = caras.find(c => c.id === r.solicitud_cara_id);
        const tipo = r.estatus === 'Bonificado' ? 'Bonificacion' : (r.tipo_de_cara === 'Flujo' ? 'Flujo' : 'Contraflujo');

        return {
          id: matchingCara
            ? `${matchingCara.localId}-${r.inventario_id}-${tipo.toLowerCase()}-${r.reserva_id}`
            : `existing-${r.reserva_id}-${r.inventario_id}-${tipo.toLowerCase()}-${Date.now()}`,
          inventario_id: r.inventario_id,
          codigo_unico: r.codigo_unico || `INV-${r.inventario_id}`,
          tipo: tipo as 'Flujo' | 'Contraflujo' | 'Bonificacion',
          catorcena: catorcenaInicio || 1,
          anio: yearInicio || new Date().getFullYear(),
          latitud: Number(r.latitud) || 0,
          longitud: Number(r.longitud) || 0,
          plaza: r.plaza || '',
          formato: r.formato || '',
          ubicacion: r.ubicacion,
          solicitudCaraId: r.solicitud_cara_id,
          reservaId: r.reserva_id,
        };
      });

      setReservas(loadedReservas);
    }
  }, [existingReservas, caras, catorcenaInicio, yearInicio]);

  // Fetch inventory filters (always)
  const { data: inventoryFilters } = useQuery({
    queryKey: ['inventory-filters'],
    queryFn: async () => {
      const [tipos, plazas, estatus] = await Promise.all([
        inventariosService.getTipos(),
        inventariosService.getPlazas(),
        inventariosService.getEstatus(),
      ]);
      return { tipos, plazas, estatus };
    },
    enabled: isOpen,
  });

  // Fetch inventory for map - without empty filters
  const { data: inventoryData, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ['inventarios-map', searchFilters.plaza, searchFilters.tipo],
    queryFn: () => {
      const params: { tipo?: string; plaza?: string } = {};
      if (searchFilters.plaza) params.plaza = searchFilters.plaza;
      if (searchFilters.tipo) params.tipo = searchFilters.tipo;
      return inventariosService.getForMap(params);
    },
    enabled: isOpen && viewState === 'search-inventory',
  });

  // Fetch inventory filters from solicitudes service
  const { data: solicitudFilters } = useQuery({
    queryKey: ['inventario-filters'],
    queryFn: () => solicitudesService.getInventarioFilters(),
    enabled: isOpen,
  });

  // Initialize form from propuesta and solicitud details
  useEffect(() => {
    if (solicitudDetails && isOpen) {
      // Set asignados - match with users to get area
      if (propuesta.asignado && propuesta.id_asignado) {
        const asignadosNames = propuesta.asignado.split(',').map(s => s.trim());
        const asignadosIds = propuesta.id_asignado.split(',').map(s => s.trim());
        const asignadosList: UserOption[] = asignadosNames.map((name, idx) => {
          const userId = parseInt(asignadosIds[idx]) || 0;
          // Try to find the user in the users list to get their area
          const foundUser = users?.find((u: UserOption) => u.id === userId);
          return {
            id: userId,
            nombre: name,
            area: foundUser?.area || '',
            puesto: foundUser?.puesto || '',
          };
        });
        setAsignados(asignadosList);
      }

      // Set campaign name
      const campaniaNombre = solicitudDetails.cotizacion?.nombre_campania || '';
      setNombreCampania(campaniaNombre);

      // Set notes and description
      const notasVal = solicitudDetails.propuesta?.notas || '';
      const descripcionVal = solicitudDetails.propuesta?.descripcion || '';
      setNotas(notasVal);
      setDescripcion(descripcionVal);

      // Set archivo if exists
      setArchivoPropuesta((solicitudDetails.propuesta as any)?.archivo || null);

      // Set period from cotizacion dates
      const cot = solicitudDetails.cotizacion;
      let yInicio: number | undefined;
      let cInicio: number | undefined;
      let yFin: number | undefined;
      let cFin: number | undefined;

      if (cot?.fecha_inicio) {
        const fechaInicio = new Date(cot.fecha_inicio);
        yInicio = fechaInicio.getFullYear();
        setYearInicio(yInicio);
        const dayOfYear = Math.floor((fechaInicio.getTime() - new Date(fechaInicio.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        cInicio = Math.ceil(dayOfYear / 14);
        setCatorcenaInicio(cInicio);
      }
      if (cot?.fecha_fin) {
        const fechaFin = new Date(cot.fecha_fin);
        yFin = fechaFin.getFullYear();
        setYearFin(yFin);
        const dayOfYear = Math.floor((fechaFin.getTime() - new Date(fechaFin.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        cFin = Math.ceil(dayOfYear / 14);
        setCatorcenaFin(cFin);
      }

      // Store initial values for change detection
      setInitialValues({
        nombreCampania: campaniaNombre,
        notas: notasVal,
        descripcion: descripcionVal,
        yearInicio: yInicio,
        yearFin: yFin,
        catorcenaInicio: cInicio,
        catorcenaFin: cFin,
        asignadosIds: propuesta.id_asignado || '',
      });

      // Set caras from solicitud
      if (solicitudDetails.caras) {
        const carasWithIds: CaraItem[] = solicitudDetails.caras.map((cara, idx) => ({
          localId: `cara-${cara.id || idx}-${Date.now()}`,
          id: cara.id,
          ciudad: cara.ciudad || '',
          estados: cara.estados || '',
          tipo: cara.tipo || '',
          flujo: cara.flujo || '',
          bonificacion: Number(cara.bonificacion) || 0,
          caras: Number(cara.caras) || 0,
          nivel_socioeconomico: cara.nivel_socioeconomico || '',
          formato: cara.formato || '',
          costo: Number(cara.costo) || 0,
          tarifa_publica: Number(cara.tarifa_publica) || 0,
          inicio_periodo: cara.inicio_periodo || '',
          fin_periodo: cara.fin_periodo || '',
          caras_flujo: Number(cara.caras_flujo) || 0,
          caras_contraflujo: Number(cara.caras_contraflujo) || 0,
          articulo: cara.articulo || '',
          descuento: Number(cara.descuento) || 0,
        }));
        setCaras(carasWithIds);
      }
    }
  }, [solicitudDetails, propuesta, isOpen, users]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewState('main');
      setSelectedCaraForSearch(null);
      setSelectedInventory(new Set());
      setShowAddCaraForm(false);
      setEditingCaraId(null);
      setNewCara(EMPTY_CARA);
      setSelectedArticulo(null);
    }
  }, [isOpen]);

  // Expand all catorcenas by default when caras change
  useEffect(() => {
    if (caras.length > 0) {
      const periodos = new Set(caras.map(c => c.inicio_periodo || 'Sin periodo'));
      setExpandedCatorcenas(periodos);
    }
  }, [caras]);

  // Detect if there are unsaved changes
  const currentAsignadosIds = asignados.map(u => u.id).join(',');
  const hasChanges = useMemo(() => {
    return (
      nombreCampania !== initialValues.nombreCampania ||
      notas !== initialValues.notas ||
      descripcion !== initialValues.descripcion ||
      yearInicio !== initialValues.yearInicio ||
      yearFin !== initialValues.yearFin ||
      catorcenaInicio !== initialValues.catorcenaInicio ||
      catorcenaFin !== initialValues.catorcenaFin ||
      currentAsignadosIds !== initialValues.asignadosIds
    );
  }, [nombreCampania, notas, descripcion, yearInicio, yearFin, catorcenaInicio, catorcenaFin, currentAsignadosIds, initialValues]);

  // Handle update propuesta
  const handleUpdatePropuesta = async () => {
    setIsUpdatingPropuesta(true);
    try {
      // Update propuesta data
      await propuestasService.updatePropuesta(propuesta.id, {
        nombre_campania: nombreCampania,
        notas,
        descripcion,
        year_inicio: yearInicio,
        catorcena_inicio: catorcenaInicio,
        year_fin: yearFin,
        catorcena_fin: catorcenaFin,
      });

      // Update asignados if changed
      const newAsignadosIds = asignados.map(u => u.id).join(',');
      if (newAsignadosIds !== initialValues.asignadosIds) {
        const asignadosStr = asignados.map(u => u.nombre).join(', ');
        await propuestasService.updateAsignados(propuesta.id, asignadosStr, newAsignadosIds);
      }

      // Update initial values to current values
      setInitialValues({
        nombreCampania,
        notas,
        descripcion,
        yearInicio,
        yearFin,
        catorcenaInicio,
        catorcenaFin,
        asignadosIds: newAsignadosIds,
      });

      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details', propuesta.solicitud_id] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      alert('Propuesta actualizada correctamente');
    } catch (error) {
      console.error('Error updating propuesta:', error);
      alert('Error al actualizar propuesta');
    } finally {
      setIsUpdatingPropuesta(false);
    }
  };

  // Handle archivo upload
  const archivoInputRef = useRef<HTMLInputElement>(null);
  const handleArchivoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await propuestasService.uploadArchivo(propuesta.id, file);
      setArchivoPropuesta(result.url);
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details', propuesta.solicitud_id] });
      alert('Archivo subido correctamente');
    } catch (error) {
      console.error('Error uploading archivo:', error);
      alert('Error al subir archivo');
    }
  };

  // Calculate KPIs for caras
  const carasKPIs = useMemo(() => {
    const totalRenta = caras.reduce((acc, c) => acc + (c.caras || 0), 0);
    const totalBonificacion = caras.reduce((acc, c) => acc + (c.bonificacion || 0), 0);
    const totalInversion = caras.reduce((acc, c) => acc + ((c.caras || 0) * (c.tarifa_publica || 0)), 0);
    return { totalRenta, totalBonificacion, totalInversion };
  }, [caras]);

  // Calculate KPIs for reservas
  const reservasKPIs = useMemo(() => {
    const flujo = reservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujo = reservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificadas = reservas.filter(r => r.tipo === 'Bonificacion').length;
    const renta = flujo + contraflujo; // Non-bonificadas
    const total = reservas.length;

    // Calculate money: sum tarifa_publica for each non-bonificada reserva
    let dineroTotal = 0;
    let digitales = 0;
    reservas.forEach(reserva => {
      // Find the cara this reserva belongs to
      const cara = caras.find(c => reserva.id.startsWith(c.localId));
      if (cara) {
        // Only count money for non-bonificadas
        if (reserva.tipo !== 'Bonificacion') {
          dineroTotal += (cara.tarifa_publica || 0);
        }
        // Count digital types
        if (cara.tipo?.toLowerCase().includes('digital')) {
          digitales++;
        }
      }
    });

    return { flujo, contraflujo, bonificadas, renta, total, dineroTotal, digitales };
  }, [reservas, caras]);

  // Calculate remaining to assign for selected cara
  const remainingToAssign = useMemo(() => {
    if (!selectedCaraForSearch) return { flujo: 0, contraflujo: 0, bonificacion: 0 };

    const caraReservas = reservas.filter(r =>
      r.id.startsWith(selectedCaraForSearch.localId) || r.solicitudCaraId === selectedCaraForSearch.id
    );
    const flujoReservado = caraReservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujoReservado = caraReservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificacionReservado = caraReservas.filter(r => r.tipo === 'Bonificacion').length;

    return {
      flujo: (selectedCaraForSearch.caras_flujo || 0) - flujoReservado,
      contraflujo: (selectedCaraForSearch.caras_contraflujo || 0) - contraflujoReservado,
      bonificacion: (selectedCaraForSearch.bonificacion || 0) - bonificacionReservado,
    };
  }, [selectedCaraForSearch, reservas]);

  // Check if cara has reservas
  const caraHasReservas = (localId: string, caraId?: number) => {
    return reservas.some(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
  };

  // Get cara completion status
  const getCaraCompletionStatus = (cara: CaraItem) => {
    const caraReservas = reservas.filter(r =>
      r.id.startsWith(cara.localId) || r.solicitudCaraId === cara.id
    );
    const flujoReservado = caraReservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujoReservado = caraReservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificacionReservado = caraReservas.filter(r => r.tipo === 'Bonificacion').length;

    const flujoRequerido = cara.caras_flujo || 0;
    const contraflujoRequerido = cara.caras_contraflujo || 0;
    const bonificacionRequerido = cara.bonificacion || 0;

    const flujoCompleto = flujoReservado >= flujoRequerido;
    const contraflujoCompleto = contraflujoReservado >= contraflujoRequerido;
    const bonificacionCompleto = bonificacionReservado >= bonificacionRequerido;

    const totalRequerido = flujoRequerido + contraflujoRequerido + bonificacionRequerido;
    const totalReservado = flujoReservado + contraflujoReservado + bonificacionReservado;

    // Calculate differences (positive = over, negative = under)
    const flujoDiff = flujoReservado - flujoRequerido;
    const contraflujoDiff = contraflujoReservado - contraflujoRequerido;
    const bonificacionDiff = bonificacionReservado - bonificacionRequerido;
    const totalDiff = totalReservado - totalRequerido;

    // Check if needs attention (has differences)
    const needsAttention = flujoDiff !== 0 || contraflujoDiff !== 0 || bonificacionDiff !== 0;

    return {
      flujoReservado,
      contraflujoReservado,
      bonificacionReservado,
      flujoRequerido,
      contraflujoRequerido,
      bonificacionRequerido,
      flujoCompleto,
      contraflujoCompleto,
      bonificacionCompleto,
      isComplete: flujoCompleto && contraflujoCompleto && bonificacionCompleto,
      totalReservado,
      totalRequerido,
      flujoDiff,
      contraflujoDiff,
      bonificacionDiff,
      totalDiff,
      needsAttention,
    };
  };

  // Group caras by catorcena period with catorcena info
  const carasGroupedByCatorcena = useMemo(() => {
    const groups: Record<string, { caras: CaraItem[]; catorcenaNum?: number; year?: number }> = {};
    caras.forEach(cara => {
      const periodo = cara.inicio_periodo || 'Sin periodo';
      if (!groups[periodo]) {
        // Try to find catorcena number from catorcenasData
        const catorcenaInfo = catorcenasData?.data?.find(c => c.fecha_inicio === periodo);
        groups[periodo] = {
          caras: [],
          catorcenaNum: catorcenaInfo?.numero_catorcena,
          year: catorcenaInfo?.a_o
        };
      }
      groups[periodo].caras.push(cara);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [caras, catorcenasData]);

  // Years options (filtered like EditSolicitudModal)
  const yearInicioOptions = useMemo(() => {
    if (!catorcenasData?.years) return [];
    if (yearFin) return catorcenasData.years.filter(y => y <= yearFin);
    return catorcenasData.years;
  }, [catorcenasData, yearFin]);

  const yearFinOptions = useMemo(() => {
    if (!catorcenasData?.years) return [];
    if (yearInicio) return catorcenasData.years.filter(y => y >= yearInicio);
    return catorcenasData.years;
  }, [catorcenasData, yearInicio]);

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) return cats.filter(c => c.numero_catorcena <= catorcenaFin);
    return cats;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) return cats.filter(c => c.numero_catorcena >= catorcenaInicio);
    return cats;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Available periods based on year range
  const availablePeriods = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];
    return catorcenasData.data.filter(c => {
      if (c.a_o < yearInicio || c.a_o > yearFin) return false;
      if (c.a_o === yearInicio && c.numero_catorcena < catorcenaInicio) return false;
      if (c.a_o === yearFin && c.numero_catorcena > catorcenaFin) return false;
      return true;
    });
  }, [catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  // Toggle catorcena expansion
  const toggleCatorcena = (periodo: string) => {
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      if (next.has(periodo)) {
        next.delete(periodo);
      } else {
        next.add(periodo);
      }
      return next;
    });
  };

  // Toggle cara expansion
  const toggleCara = (localId: string) => {
    setExpandedCaras(prev => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  };

  // Handle cara deletion
  const handleDeleteCara = (localId: string) => {
    if (caraHasReservas(localId)) {
      alert('No puedes eliminar una cara que tiene reservas. Primero elimina las reservas.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Formato',
      message: '¿Estás seguro de que deseas eliminar este formato de la propuesta?',
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: () => {
        setCaras(prev => prev.filter(c => c.localId !== localId));
        setReservas(prev => prev.filter(r => !r.id.startsWith(localId)));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle edit cara
  const handleEditCara = (cara: CaraItem) => {
    if (caraHasReservas(cara.localId)) {
      alert('No puedes editar una cara que tiene reservas. Primero elimina las reservas.');
      return;
    }
    setEditingCaraId(cara.localId);
    setNewCara({
      ciudad: cara.ciudad,
      estados: cara.estados,
      tipo: cara.tipo,
      flujo: cara.flujo,
      bonificacion: cara.bonificacion,
      caras: cara.caras,
      nivel_socioeconomico: cara.nivel_socioeconomico,
      formato: cara.formato,
      costo: cara.costo,
      tarifa_publica: cara.tarifa_publica,
      inicio_periodo: cara.inicio_periodo,
      fin_periodo: cara.fin_periodo,
      caras_flujo: cara.caras_flujo,
      caras_contraflujo: cara.caras_contraflujo,
      articulo: cara.articulo,
      descuento: cara.descuento,
    });
    setShowAddCaraForm(true);
  };

  // Handle save cara (add or update)
  const handleSaveCara = () => {
    if (!newCara.formato || !newCara.estados) {
      alert('Por favor completa al menos el formato y estado');
      return;
    }

    if (editingCaraId) {
      // Update existing cara
      setCaras(prev => prev.map(c =>
        c.localId === editingCaraId
          ? { ...c, ...newCara }
          : c
      ));
      setEditingCaraId(null);
    } else {
      // Add new cara
      const newCaraItem: CaraItem = {
        ...newCara,
        localId: `cara-new-${Date.now()}`,
      };
      setCaras(prev => [...prev, newCaraItem]);
    }

    setNewCara(EMPTY_CARA);
    setSelectedArticulo(null);
    setShowAddCaraForm(false);
  };

  // Handle cancel cara form
  const handleCancelCaraForm = () => {
    setNewCara(EMPTY_CARA);
    setSelectedArticulo(null);
    setShowAddCaraForm(false);
    setEditingCaraId(null);
  };

  // Haversine distance calculation (in meters)
  const haversineDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const R = 6371e3; // Earth radius in meters
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Filter for unique inventories (no flujo/contraflujo duplicates)
  const filterUnicos = useCallback((inventarios: InventarioDisponible[]): InventarioDisponible[] => {
    const seen = new Set<string>();
    return inventarios.filter(inv => {
      // Extract base code (without _Flujo or _Contraflujo)
      const baseCode = inv.codigo_unico?.split('_')[0] || '';
      const key = `${baseCode}|${inv.ubicacion}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // Filter for complete inventories - MERGE flujo/contraflujo pairs into single "completo" rows
  const filterCompletos = useCallback((inventarios: InventarioDisponible[]): (InventarioDisponible & { isCompleto?: boolean; flujoId?: number; contraflujoId?: number })[] => {
    // Group by base code and location
    const groups: Record<string, InventarioDisponible[]> = {};
    inventarios.forEach(inv => {
      const baseCode = inv.codigo_unico?.split('_')[0] || '';
      const key = `${baseCode}|${inv.plaza}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    });

    // Merge pairs into single "completo" rows
    const result: (InventarioDisponible & { isCompleto?: boolean; flujoId?: number; contraflujoId?: number })[] = [];
    Object.entries(groups).forEach(([key, group]) => {
      if (group.length >= 2) {
        const baseCode = key.split('|')[0];
        const flujoItem = group.find(g => g.tipo_de_cara === 'Flujo');
        const contraflujoItem = group.find(g => g.tipo_de_cara === 'Contraflujo');

        if (flujoItem && contraflujoItem) {
          // Create merged "completo" item - use a virtual ID
          const virtualId = flujoItem.id * 100000 + contraflujoItem.id;
          result.push({
            ...flujoItem,
            id: virtualId,
            codigo_unico: `${baseCode}_completo`,
            tipo_de_cara: 'Completo' as any,
            isCompleto: true,
            flujoId: flujoItem.id,
            contraflujoId: contraflujoItem.id,
            ya_reservado_para_cara: flujoItem.ya_reservado_para_cara || contraflujoItem.ya_reservado_para_cara,
          });
        }
      }
    });
    return result;
  }, []);

  // Group inventories by distance (anti-cannibalization)
  const groupByDistanceFunc = useCallback((inventarios: ProcessedInventoryItem[]): ProcessedInventoryItem[] => {
    if (inventarios.length === 0) return [];

    // Separate items with valid coordinates from those without
    const withCoords = inventarios.filter(inv =>
      inv.latitud && inv.longitud &&
      typeof inv.latitud === 'number' && typeof inv.longitud === 'number' &&
      !isNaN(inv.latitud) && !isNaN(inv.longitud)
    );
    const withoutCoords = inventarios.filter(inv =>
      !inv.latitud || !inv.longitud ||
      typeof inv.latitud !== 'number' || typeof inv.longitud !== 'number' ||
      isNaN(inv.latitud) || isNaN(inv.longitud)
    );

    if (withCoords.length === 0) {
      // No valid coordinates, just return all in one group
      return inventarios.map(inv => ({ ...inv, grupo: 'Grupo 1' }));
    }

    const grupos: ProcessedInventoryItem[][] = [];
    const remaining = [...withCoords];

    while (remaining.length > 0) {
      const grupo: ProcessedInventoryItem[] = [remaining.shift()!];

      // Fill group up to tamanoGrupo
      while (grupo.length < tamanoGrupo && remaining.length > 0) {
        // Find candidate that maintains minimum distance
        let bestIdx = -1;
        let bestScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const candidate = remaining[i];
          let minDist = Infinity;

          // Check distance to all members of the group
          for (const member of grupo) {
            const dist = haversineDistance(
              candidate.latitud, candidate.longitud,
              member.latitud, member.longitud
            );
            if (dist < minDist) minDist = dist;
          }

          // Must be at least distanciaGrupos away
          if (minDist >= distanciaGrupos) {
            const score = Math.abs(minDist - distanciaGrupos * 1.2);
            if (score < bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }
        }

        if (bestIdx >= 0) {
          grupo.push(remaining.splice(bestIdx, 1)[0]);
        } else {
          break; // No more candidates that meet distance requirement
        }
      }

      grupos.push(grupo);
    }

    // Add items without coords to "Sin ubicación" group
    if (withoutCoords.length > 0) {
      grupos.push(withoutCoords);
    }

    // Add group number to each item
    return grupos.flatMap((grupo, idx) => {
      const isLastGroup = idx === grupos.length - 1 && withoutCoords.length > 0;
      const groupName = isLastGroup ? 'Sin ubicación' : `Grupo ${idx + 1}`;
      return grupo.map(inv => ({ ...inv, grupo: groupName }));
    });
  }, [tamanoGrupo, distanciaGrupos, haversineDistance]);

  // Handle search inventory - open search view and fetch disponibles
  const handleSearchInventory = async (cara: CaraItem) => {
    setSelectedCaraForSearch(cara);
    setViewState('search-inventory');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setGroupByDistance(false);
    setSelectedInventory(new Set());
    setFlujoFilter('Todos'); // Always start with all
    setSortColumn('codigo_unico');
    setSortDirection('asc');

    // Fetch disponibles based on cara characteristics (gets all, filter in frontend)
    setIsSearching(true);
    try {
      // If ciudad has many cities (more than 3), just filter by state only
      // This handles the case where all cities from a state are auto-selected
      let ciudadFilter = cara.ciudad || undefined;
      if (ciudadFilter) {
        const ciudadCount = ciudadFilter.split(',').length;
        if (ciudadCount > 3) {
          // Too many cities - just use state filter for broader search
          ciudadFilter = undefined;
        }
      }

      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: cara.estados || undefined,
        formato: cara.formato || undefined,
        // Don't filter by flujo in backend - get all and filter in frontend
        nse: cara.nivel_socioeconomico || undefined,
        tipo: cara.tipo || undefined,
        fecha_inicio: cara.inicio_periodo || undefined,
        fecha_fin: cara.fin_periodo || undefined,
        solicitudCaraId: cara.id,
      });
      setInventarioDisponible(response.data || []);
    } catch (error) {
      console.error('Error fetching disponibles:', error);
      setInventarioDisponible([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Refetch disponibles with current filters
  const handleRefetchDisponibles = async () => {
    if (!selectedCaraForSearch) return;

    setIsSearching(true);
    try {
      // If ciudad has many cities (more than 3), just filter by state only
      let ciudadFilter = selectedCaraForSearch.ciudad || undefined;
      if (ciudadFilter) {
        const ciudadCount = ciudadFilter.split(',').length;
        if (ciudadCount > 3) {
          ciudadFilter = undefined;
        }
      }

      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: selectedCaraForSearch.estados || undefined,
        formato: selectedCaraForSearch.formato || undefined,
        // Don't filter by flujo in backend - get all and filter in frontend
        nse: selectedCaraForSearch.nivel_socioeconomico || undefined,
        tipo: selectedCaraForSearch.tipo || undefined,
        fecha_inicio: selectedCaraForSearch.inicio_periodo || undefined,
        fecha_fin: selectedCaraForSearch.fin_periodo || undefined,
        solicitudCaraId: selectedCaraForSearch.id,
      });
      setInventarioDisponible(response.data || []);
    } catch (error) {
      console.error('Error fetching disponibles:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered and processed inventory data
  const processedInventory = useMemo((): ProcessedInventoryItem[] => {
    let data: ProcessedInventoryItem[] = [...inventarioDisponible];

    // Filter out items that are already reserved (in ANY group/context)
    const reservedIds = new Set(reservas.map(r => r.inventario_id));
    data = data.filter(inv => !reservedIds.has(inv.id));

    // Apply text search filter
    if (disponiblesSearchTerm.trim()) {
      const term = disponiblesSearchTerm.toLowerCase();
      data = data.filter(inv =>
        inv.codigo_unico?.toLowerCase().includes(term) ||
        inv.plaza?.toLowerCase().includes(term) ||
        inv.ubicacion?.toLowerCase().includes(term) ||
        inv.tipo_de_cara?.toLowerCase().includes(term) ||
        inv.nivel_socioeconomico?.toLowerCase().includes(term)
      );
    }

    // Apply POI filter (conservar con/sin POIs)
    if (poiFilterIds !== null) {
      data = data.filter(inv => poiFilterIds.has(inv.id));
    }

    // Filter by flujo (only if not "Todos") - skip if completos is active
    if (flujoFilter && flujoFilter !== 'Todos' && !showOnlyCompletos) {
      data = data.filter(inv => inv.tipo_de_cara === flujoFilter);
    }

    // Apply unique filter
    if (showOnlyUnicos) {
      data = filterUnicos(data);
    }

    // Apply complete filter (merges pairs into single rows)
    if (showOnlyCompletos) {
      data = filterCompletos(data);
    }

    // Apply distance grouping
    if (groupByDistance) {
      data = groupByDistanceFunc(data);
    }

    // Apply sorting
    data.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortColumn) {
        case 'codigo_unico':
          aVal = a.codigo_unico || '';
          bVal = b.codigo_unico || '';
          break;
        case 'tipo_de_cara':
          aVal = a.tipo_de_cara || '';
          bVal = b.tipo_de_cara || '';
          break;
        case 'plaza':
          aVal = a.plaza || '';
          bVal = b.plaza || '';
          break;
        case 'nivel_socioeconomico':
          aVal = a.nivel_socioeconomico || '';
          bVal = b.nivel_socioeconomico || '';
          break;
        case 'ubicacion':
          aVal = a.ubicacion || '';
          bVal = b.ubicacion || '';
          break;
        default:
          aVal = a.codigo_unico || '';
          bVal = b.codigo_unico || '';
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return data;
  }, [inventarioDisponible, disponiblesSearchTerm, poiFilterIds, flujoFilter, showOnlyUnicos, showOnlyCompletos, groupByDistance, filterUnicos, filterCompletos, groupByDistanceFunc, sortColumn, sortDirection, reservas]);

  // Handle POI filter from map
  const handlePOIFilter = useCallback((idsToKeep: number[]) => {
    setPoiFilterIds(new Set(idsToKeep));
  }, []);

  // Clear POI filter
  const clearPOIFilter = useCallback(() => {
    setPoiFilterIds(null);
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFlujoFilter('Todos');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setGroupByDistance(false);
    setPoiFilterIds(null);
    setDisponiblesSearchTerm('');
  }, []);

  // CSV handling functions
  const normalizeColumnName = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[\s_-]/g, ''); // Remove spaces, underscores, hyphens
  };

  const getValueByColumnName = (row: Record<string, string>, columnName: string): string | null => {
    const normalizedName = normalizeColumnName(columnName);
    for (const key in row) {
      if (normalizeColumnName(key) === normalizedName) {
        return row[key];
      }
    }
    return null;
  };

  const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) return;

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      // Parse data rows
      const parsedData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      // Match with inventory
      const matched = parsedData.map(row => {
        const codigoUnico = getValueByColumnName(row, 'codigo_unico');
        const exists = inventarioDisponible.some(inv => inv.codigo_unico === codigoUnico);
        return {
          codigo_unico: codigoUnico || 'N/A',
          disponibilidad: exists ? 'Disponible' as const : 'No Disponible' as const,
        };
      });

      setCsvData(matched);
      setShowCsvSection(true);
    };

    reader.readAsText(file);
  }, [inventarioDisponible]);

  const handleSelectFromCsv = useCallback(() => {
    const availableCodes = csvData
      .filter(row => row.disponibilidad === 'Disponible')
      .map(row => row.codigo_unico);

    const matchingInventory = inventarioDisponible
      .filter(inv => inv.codigo_unico && availableCodes.includes(inv.codigo_unico));

    setSelectedInventory(new Set(matchingInventory.map(inv => inv.id)));
    setShowCsvSection(false);
  }, [csvData, inventarioDisponible]);

  const handleClearCsv = useCallback(() => {
    setCsvFile(null);
    setCsvData([]);
    setShowCsvSection(false);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  }, []);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Organize inventory by groups for collapsible display
  const groupedInventory = useMemo(() => {
    if (!groupByDistance) return null;

    const groups: Record<string, ProcessedInventoryItem[]> = {};
    processedInventory.forEach(inv => {
      const groupName = inv.grupo || 'Sin grupo';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(inv);
    });

    return Object.entries(groups).sort((a, b) => {
      // Sort by group number
      const numA = parseInt(a[0].replace('Grupo ', '')) || 999;
      const numB = parseInt(b[0].replace('Grupo ', '')) || 999;
      return numA - numB;
    });
  }, [processedInventory, groupByDistance]);

  // Toggle group expansion
  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  // Select all in group
  const selectAllInGroup = (items: ProcessedInventoryItem[]) => {
    setSelectedInventory(prev => {
      const next = new Set(prev);
      items.forEach(inv => next.add(inv.id));
      return next;
    });
  };

  // Handle inventory selection
  const toggleInventorySelection = (id: number) => {
    setSelectedInventory(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Handle reserve (smart - detects flujo/contraflujo/completo automatically) - IMMEDIATE SAVE
  const handleReservar = () => {
    if (!selectedCaraForSearch || selectedInventory.size === 0) return;

    // Check for pairs that could be grouped
    const selectedItems = processedInventory.filter(i => selectedInventory.has(i.id));
    const potentialPairs = new Set<string>();

    selectedItems.forEach(item => {
      const baseCode = item.codigo_unico?.split('_')[0]; // Assuming prefix_suffix format
      if (baseCode) {
        // Check if we have both Flujo and Contraflujo for this base code in selection
        const hasFlujo = selectedItems.some(i => i.codigo_unico?.startsWith(baseCode) && i.tipo_de_cara === 'Flujo');
        const hasContra = selectedItems.some(i => i.codigo_unico?.startsWith(baseCode) && i.tipo_de_cara === 'Contraflujo');
        if (hasFlujo && hasContra) {
          potentialPairs.add(baseCode);
        }
      }
    });

    const runReservation = async (shouldGroup: boolean) => {
      const newReservas: { inventario_id: number; tipo: string; latitud: number; longitud: number }[] = [];
      let flujoCount = 0;
      let contraflujoCount = 0;

      selectedInventory.forEach(invId => {
        const inv = processedInventory.find(i => i.id === invId);
        if (!inv) return;

        // If it's a "completo" item, reserve both flujo and contraflujo
        if (inv.isCompleto && inv.flujoId && inv.contraflujoId) {
          // Find original items for coordinates
          const flujoOrig = inventarioDisponible.find(i => i.id === inv.flujoId);
          const contraflujoOrig = inventarioDisponible.find(i => i.id === inv.contraflujoId);

          if (flujoOrig && flujoCount < remainingToAssign.flujo) {
            newReservas.push({
              inventario_id: inv.flujoId!,
              tipo: 'Flujo',
              latitud: flujoOrig.latitud || 0,
              longitud: flujoOrig.longitud || 0,
            });
            flujoCount++;
          }

          if (contraflujoOrig && contraflujoCount < remainingToAssign.contraflujo) {
            newReservas.push({
              inventario_id: inv.contraflujoId!,
              tipo: 'Contraflujo',
              latitud: contraflujoOrig.latitud || 0,
              longitud: contraflujoOrig.longitud || 0,
            });
            contraflujoCount++;
          }
        } else {
          // Regular item - reserve based on tipo_de_cara
          const tipo = inv.tipo_de_cara === 'Flujo' ? 'Flujo' : 'Contraflujo';
          const canReserve = tipo === 'Flujo'
            ? flujoCount < remainingToAssign.flujo
            : contraflujoCount < remainingToAssign.contraflujo;

          if (canReserve) {
            newReservas.push({
              inventario_id: invId,
              tipo,
              latitud: inv.latitud || 0,
              longitud: inv.longitud || 0,
            });
            if (tipo === 'Flujo') flujoCount++;
            else contraflujoCount++;
          }
        }
      });

      if (newReservas.length === 0) {
        alert('No hay caras disponibles para reservar');
        return;
      }

      // Call API immediately
      setIsSaving(true);
      try {
        const clienteId = solicitudDetails?.propuesta?.cliente_id || propuesta.cliente_id;
        const fechaInicio = selectedCaraForSearch.inicio_periodo || solicitudDetails?.cotizacion?.fecha_inicio || new Date().toISOString();
        const fechaFin = selectedCaraForSearch.fin_periodo || solicitudDetails?.cotizacion?.fecha_fin || new Date().toISOString();

        if (!clienteId) throw new Error("Cliente ID no encontrado");

        const result = await propuestasService.createReservas(propuesta.id, {
          reservas: newReservas,
          solicitudCaraId: selectedCaraForSearch.id!,
          clienteId,
          fechaInicio,
          fechaFin,
          agruparComoCompleto: shouldGroup,
        });

        queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
        queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] }); // Refresh map
        // Also refresh disponibles
        handleRefetchDisponibles();

        alert(`Se guardaron ${result.reservasCreadas} reservas exitosamente`);
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving reservas:', error);
        alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      } finally {
        setIsSaving(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    };

    // Prompt logic - siempre mostrar modal con opción de agrupar si hay pares
    if (potentialPairs.size > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Agrupar como Completo',
        message: `Se detectaron ${potentialPairs.size} pares Flujo + Contraflujo del mismo parabús. ¿Deseas agruparlos como "Completo"?`,
        confirmText: 'Sí, Agrupar',
        cancelText: 'No, Mantener Separados',
        onConfirm: () => runReservation(true),
        onCancel: () => runReservation(false)
      });
    } else {
      // Sin pares, confirmar reservación normal
      setConfirmModal({
        isOpen: true,
        title: 'Confirmar Reservación',
        message: `¿Estás seguro de reservar ${selectedInventory.size} espacios?`,
        confirmText: 'Reservar',
        onConfirm: () => runReservation(false),
      });
    }
  };

  // Handle reserve as bonificacion - IMMEDIATE SAVE
  const handleReserveAsBonificacion = () => {
    if (!selectedCaraForSearch || selectedInventory.size === 0) return;
    if (selectedInventory.size > remainingToAssign.bonificacion) {
      alert(`Solo puedes reservar ${remainingToAssign.bonificacion} caras de bonificación`);
      return;
    }

    const runBonificacion = async () => {
      const newReservas: { inventario_id: number; tipo: string; latitud: number; longitud: number }[] = [];
      selectedInventory.forEach(invId => {
        const inv = processedInventory.find(i => i.id === invId);
        if (inv) {
          newReservas.push({
            inventario_id: invId,
            tipo: 'Bonificacion',
            latitud: inv.latitud || 0,
            longitud: inv.longitud || 0,
          });
        }
      });

      // Call API immediately
      setIsSaving(true);
      try {
        const clienteId = solicitudDetails?.propuesta?.cliente_id || propuesta.cliente_id;
        const fechaInicio = selectedCaraForSearch.inicio_periodo || solicitudDetails?.cotizacion?.fecha_inicio || new Date().toISOString();
        const fechaFin = selectedCaraForSearch.fin_periodo || solicitudDetails?.cotizacion?.fecha_fin || new Date().toISOString();

        if (!clienteId) throw new Error("Cliente ID no encontrado");

        const result = await propuestasService.createReservas(propuesta.id, {
          reservas: newReservas,
          solicitudCaraId: selectedCaraForSearch.id!,
          clienteId,
          fechaInicio,
          fechaFin,
          agruparComoCompleto: false, // Bonificaciones likely single
        });

        queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
        queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] });
        handleRefetchDisponibles();

        // alert(`Se guardaron ${result.reservasCreadas} bonificaciones exitosamente`);
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving bonificaciones:', error);
        alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      } finally {
        setIsSaving(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    };

    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Bonificación',
      message: `¿Estás seguro de bonificar ${selectedInventory.size} espacios?`,
      confirmText: 'Bonificar',
      onConfirm: runBonificacion,
    });
  };

  // Go back to main view
  const handleBackToMain = () => {
    setViewState('main');
    setSelectedCaraForSearch(null);
    setSelectedInventory(new Set());
  };

  // Handle save - REMOVED (Immediate save implemented)
  // const handleSave = async () => { ... }

  // Get map center from processed inventory data
  const mapCenter = useMemo(() => {
    if (processedInventory && processedInventory.length > 0) {
      const firstWithCoords = processedInventory.find(i => i.latitud && i.longitud);
      if (firstWithCoords) {
        return { lat: firstWithCoords.latitud, lng: firstWithCoords.longitud };
      }
    }
    // Fallback to selected cara city or default
    return { lat: 20.6597, lng: -103.3496 }; // Default: Guadalajara
  }, [processedInventory]);

  // Get map center for reservados
  const reservadosMapCenter = useMemo(() => {
    const caraReservas = reservas.filter(r =>
      r.id.startsWith(selectedCaraForSearch?.localId || '') ||
      r.solicitudCaraId === selectedCaraForSearch?.id
    );
    if (caraReservas.length > 0) {
      const firstWithCoords = caraReservas.find(r => r.latitud && r.longitud);
      if (firstWithCoords) {
        return { lat: firstWithCoords.latitud, lng: firstWithCoords.longitud };
      }
    }
    return mapCenter;
  }, [reservas, selectedCaraForSearch, mapCenter]);

  // Get reservas for current cara
  const currentCaraReservas = useMemo(() => {
    return reservas.filter(r =>
      r.id.startsWith(selectedCaraForSearch?.localId || '') ||
      r.solicitudCaraId === selectedCaraForSearch?.id
    );
  }, [reservas, selectedCaraForSearch]);

  // Filter reservados by search term and type
  const filteredReservados = useMemo(() => {
    let data = [...currentCaraReservas];

    // Filter by type
    if (reservadosTipoFilter !== 'Todos') {
      data = data.filter(r => r.tipo === reservadosTipoFilter);
    }

    // Filter by search term
    if (reservadosSearchTerm.trim()) {
      const term = reservadosSearchTerm.toLowerCase();
      data = data.filter(r =>
        r.codigo_unico?.toLowerCase().includes(term) ||
        r.plaza?.toLowerCase().includes(term) ||
        r.ubicacion?.toLowerCase().includes(term) ||
        r.tipo?.toLowerCase().includes(term) ||
        r.formato?.toLowerCase().includes(term)
      );
    }

    // Sort
    data.sort((a, b) => {
      let aVal = '', bVal = '';
      switch (reservadosSortColumn) {
        case 'codigo': aVal = a.codigo_unico || ''; bVal = b.codigo_unico || ''; break;
        case 'tipo': aVal = a.tipo || ''; bVal = b.tipo || ''; break;
        case 'formato': aVal = a.formato || ''; bVal = b.formato || ''; break;
        case 'ciudad': aVal = a.plaza || ''; bVal = b.plaza || ''; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return reservadosSortDirection === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [currentCaraReservas, reservadosSearchTerm, reservadosTipoFilter, reservadosSortColumn, reservadosSortDirection]);

  // Group reservados by ciudad (plaza)
  const groupedReservados = useMemo(() => {
    const groups: Record<string, ReservaItem[]> = {};
    filteredReservados.forEach(r => {
      const ciudad = r.plaza || 'Sin ciudad';
      if (!groups[ciudad]) groups[ciudad] = [];
      groups[ciudad].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredReservados]);

  // Toggle all ciudad groups expansion
  const toggleAllCiudadGroups = () => {
    if (expandedCiudadGroups.size === groupedReservados.length) {
      setExpandedCiudadGroups(new Set());
    } else {
      setExpandedCiudadGroups(new Set(groupedReservados.map(([ciudad]) => ciudad)));
    }
  };

  // Toggle reservados sort
  const toggleReservadosSort = (column: 'codigo' | 'tipo' | 'formato' | 'ciudad') => {
    if (reservadosSortColumn === column) {
      setReservadosSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setReservadosSortColumn(column);
      setReservadosSortDirection('asc');
    }
  };

  // State for expanded ciudad groups in reservados
  const [expandedCiudadGroups, setExpandedCiudadGroups] = useState<Set<string>>(new Set());

  // Toggle ciudad group expansion
  const toggleCiudadGroupExpansion = (ciudad: string) => {
    setExpandedCiudadGroups(prev => {
      const next = new Set(prev);
      if (next.has(ciudad)) next.delete(ciudad);
      else next.add(ciudad);
      return next;
    });
  };

  // Toggle select all reservados
  const handleToggleSelectAllReservados = () => {
    if (selectedReservados.size === filteredReservados.length) {
      setSelectedReservados(new Set());
    } else {
      setSelectedReservados(new Set(filteredReservados.map(r => r.id)));
    }
  };

  // Toggle single reservado selection
  const handleToggleReservadoSelection = (id: string) => {
    const newSet = new Set(selectedReservados);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedReservados(newSet);
  };

  // Remove a reserva - IMMEDIATE DELETE
  const handleRemoveReserva = (reservaId: string) => {
    const reserva = reservas.find(r => r.id === reservaId);
    if (!reserva || !reserva.reservaId) {
      setReservas(prev => prev.filter(r => r.id !== reservaId));
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Reserva',
      message: '¿Seguro que quieres eliminar esta reserva?',
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await propuestasService.deleteReservas(propuesta.id, [reserva.reservaId!]);
          queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
          queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] });
          handleRefetchDisponibles();

          setReservas(prev => prev.filter(r => r.id !== reservaId));
        } catch (error) {
          console.error('Error deleting reserva:', error);
          alert('Error al eliminar reserva');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Open edit panel for reserva
  const handleEditReserva = (reserva: ReservaItem) => {
    setEditingReserva(reserva);
    setEditingFormato(reserva.formato || '');
  };

  // Save edited formato
  const handleSaveFormato = () => {
    if (!editingReserva) return;
    setReservas(prev => prev.map(r =>
      r.id === editingReserva.id
        ? { ...r, formato: editingFormato }
        : r
    ));
    setEditingReserva(null);
    setEditingFormato('');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingReserva(null);
    setEditingFormato('');
  };

  if (!isOpen) return null;

  // Confirmation modal content reused in both views
  const confirmModalJSX = confirmModal.isOpen && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isSaving && setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 w-[400px] animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
        <p className="text-zinc-400 mb-6">{confirmModal.message}</p>
        {isSaving && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-purple-300 text-sm">Procesando reservas, por favor espera...</span>
          </div>
        )}
        <div className="flex justify-end gap-3 flex">
          <button
            onClick={() => {
              if (confirmModal.onCancel) confirmModal.onCancel();
              else setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmModal.cancelText || 'Cancelar'}
          </button>
          <button
            onClick={confirmModal.onConfirm}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${confirmModal.isDestructive
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-purple-500 hover:bg-purple-600'
              }`}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              confirmModal.confirmText || 'Confirmar'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render inventory search view
  if (viewState === 'search-inventory') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {confirmModalJSX}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleBackToMain} />

        <div className="relative w-[95vw] max-w-[1600px] h-[90vh] bg-zinc-900 rounded-2xl border border-purple-500/20 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">Buscar Inventario</h2>
                <p className="text-sm text-zinc-400">
                  {selectedCaraForSearch?.formato} - {selectedCaraForSearch?.ciudad || selectedCaraForSearch?.estados}
                </p>
              </div>
            </div>
            <button onClick={handleBackToMain} className="p-2 rounded-lg text-zinc-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Compact KPIs with progress bars */}
          <div className="px-6 py-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900/90">
            <div className="flex items-center gap-4">
              {/* Flujo KPI */}
              <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Flujo
                  </span>
                  <span className="text-sm font-bold text-blue-400">
                    {(selectedCaraForSearch?.caras_flujo || 0) - remainingToAssign.flujo} / {selectedCaraForSearch?.caras_flujo || 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((selectedCaraForSearch?.caras_flujo || 0) - remainingToAssign.flujo) / (selectedCaraForSearch?.caras_flujo || 1) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="text-blue-400 font-medium">{remainingToAssign.flujo}</span> restantes
                </div>
              </div>

              {/* Contraflujo KPI */}
              <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    Contraflujo
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    {(selectedCaraForSearch?.caras_contraflujo || 0) - remainingToAssign.contraflujo} / {selectedCaraForSearch?.caras_contraflujo || 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((selectedCaraForSearch?.caras_contraflujo || 0) - remainingToAssign.contraflujo) / (selectedCaraForSearch?.caras_contraflujo || 1) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="text-amber-400 font-medium">{remainingToAssign.contraflujo}</span> restantes
                </div>
              </div>

              {/* Bonificacion KPI */}
              <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Bonificación
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {(selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion} / {selectedCaraForSearch?.bonificacion || 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion) / (selectedCaraForSearch?.bonificacion || 1) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="text-emerald-400 font-medium">{remainingToAssign.bonificacion}</span> restantes
                </div>
              </div>

              {/* Selection count */}
              <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 min-w-[100px]">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span className="text-xl font-bold text-purple-300">{searchViewTab === 'buscar' ? selectedInventory.size : currentCaraReservas.length}</span>
                </div>
                <span className="text-xs text-zinc-500">{searchViewTab === 'buscar' ? 'seleccionados' : 'reservados'}</span>
              </div>
            </div>
          </div>

          {/* Tabs: Buscar / Reservados */}
          <div className="px-6 py-2 border-b border-zinc-800 bg-zinc-900/70">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchViewTab('buscar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchViewTab === 'buscar'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <Search className="h-4 w-4" />
                Buscar Disponibles
              </button>
              <button
                onClick={() => setSearchViewTab('reservados')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchViewTab === 'reservados'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <Layers className="h-4 w-4" />
                Mis Reservados
                {currentCaraReservas.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 rounded-full text-xs">
                    {currentCaraReservas.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Conditional Content based on tab */}
          {searchViewTab === 'buscar' ? (
            <>
              {/* Filters */}
              <div className="px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Flujo Toggle */}
                  <div className="flex bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-700/50">
                    {(['Todos', 'Flujo', 'Contraflujo'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setFlujoFilter(opt)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${flujoFilter === opt
                          ? opt === 'Todos' ? 'bg-purple-500 text-white shadow' :
                            opt === 'Flujo' ? 'bg-blue-500 text-white shadow' : 'bg-amber-500 text-white shadow'
                          : 'text-zinc-400 hover:text-white'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="w-px h-6 bg-zinc-700" />

                  {/* Unique filter */}
                  <button
                    onClick={() => { setShowOnlyUnicos(!showOnlyUnicos); if (!showOnlyUnicos) setShowOnlyCompletos(false); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyUnicos
                      ? 'bg-cyan-500 text-white shadow'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                      }`}
                  >
                    <Grid className="h-3.5 w-3.5" />
                    Únicos
                    {showOnlyUnicos && (
                      <X className="h-3 w-3 ml-0.5 hover:text-cyan-200" onClick={(e) => { e.stopPropagation(); setShowOnlyUnicos(false); }} />
                    )}
                  </button>

                  {/* Complete filter */}
                  <button
                    onClick={() => { setShowOnlyCompletos(!showOnlyCompletos); if (!showOnlyCompletos) setShowOnlyUnicos(false); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyCompletos
                      ? 'bg-pink-500 text-white shadow'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                      }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Completos
                    {showOnlyCompletos && (
                      <X className="h-3 w-3 ml-0.5 hover:text-pink-200" onClick={(e) => { e.stopPropagation(); setShowOnlyCompletos(false); }} />
                    )}
                  </button>

                  {/* Distance grouping */}
                  <button
                    onClick={() => setGroupByDistance(!groupByDistance)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${groupByDistance
                      ? 'bg-green-500 text-white shadow'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                      }`}
                  >
                    <Ruler className="h-3.5 w-3.5" />
                    Agrupar
                    {groupByDistance && (
                      <X className="h-3 w-3 ml-0.5 hover:text-green-200" onClick={(e) => { e.stopPropagation(); setGroupByDistance(false); }} />
                    )}
                  </button>
                  {groupByDistance && (
                    <>
                      <select
                        value={distanciaGrupos}
                        onChange={(e) => setDistanciaGrupos(parseInt(e.target.value))}
                        className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                      >
                        <option value={100}>100m</option>
                        <option value={200}>200m</option>
                        <option value={500}>500m</option>
                        <option value={1000}>1km</option>
                      </select>
                      <input
                        type="number"
                        value={tamanoGrupo}
                        onChange={(e) => setTamanoGrupo(parseInt(e.target.value) || 10)}
                        className="w-14 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        min={2}
                        max={50}
                      />
                    </>
                  )}

                  {/* POI filter chip */}
                  {poiFilterIds !== null && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white shadow">
                      <MapPin className="h-3.5 w-3.5" />
                      Filtro POI ({poiFilterIds.size})
                      <X className="h-3 w-3 ml-0.5 cursor-pointer hover:text-emerald-200" onClick={clearPOIFilter} />
                    </div>
                  )}

                  <div className="w-px h-6 bg-zinc-700" />

                  {/* CSV Upload Button */}
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${csvFile
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white hover:bg-zinc-700'
                      }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {csvFile ? csvFile.name.substring(0, 15) + '...' : 'Subir CSV'}
                  </button>
                  {csvFile && (
                    <button
                      onClick={handleClearCsv}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      title="Quitar archivo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div className="w-px h-6 bg-zinc-700" />

                  {/* Text search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={disponiblesSearchTerm}
                      onChange={(e) => setDisponiblesSearchTerm(e.target.value)}
                      placeholder="Buscar código, plaza, ubicación..."
                      className="w-56 pl-8 pr-8 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                    {disponiblesSearchTerm && (
                      <button
                        onClick={() => setDisponiblesSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 px-2">
                      <span className="text-purple-300 font-bold">{processedInventory.length}</span> resultados
                    </span>

                    {/* Clear all filters */}
                    {(flujoFilter !== 'Todos' || showOnlyUnicos || showOnlyCompletos || groupByDistance || poiFilterIds !== null || disponiblesSearchTerm) && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Limpiar
                      </button>
                    )}

                    {/* Refresh */}
                    <button
                      onClick={handleRefetchDisponibles}
                      disabled={isSearching}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                      title="Recargar datos"
                    >
                      <Search className={`h-4 w-4 ${isSearching ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CSV Results Panel */}
              {showCsvSection && csvData.length > 0 && (
                <div className="px-6 py-3 border-b border-zinc-800 bg-orange-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-300">Resultados del CSV</span>
                      <span className="text-xs text-zinc-500">
                        ({csvData.filter(d => d.disponibilidad === 'Disponible').length} disponibles de {csvData.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectFromCsv}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Target className="h-3.5 w-3.5" />
                        Seleccionar Disponibles
                      </button>
                      <button
                        onClick={() => setShowCsvSection(false)}
                        className="p-1.5 text-zinc-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-auto">
                    {csvData.map((item, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs font-mono ${item.disponibilidad === 'Disponible'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                      >
                        {item.codigo_unico}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content - Map and Table */}
              <div className="flex-1 flex overflow-hidden">
                {/* Table */}
                <div className="w-1/2 border-r border-zinc-800 flex flex-col">
                  <div className="flex-1 overflow-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                      </div>
                    ) : processedInventory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <MapPin className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-lg">No hay inventario disponible</p>
                        <p className="text-sm">Intenta cambiar los filtros o la cara seleccionada</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-zinc-400 font-medium w-10">
                              <input
                                type="checkbox"
                                checked={processedInventory.length > 0 && selectedInventory.size === processedInventory.length}
                                onChange={() => {
                                  if (selectedInventory.size === processedInventory.length) {
                                    setSelectedInventory(new Set());
                                  } else {
                                    setSelectedInventory(new Set(processedInventory.map(i => i.id)));
                                  }
                                }}
                                className="checkbox-purple"
                              />
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('codigo_unico')}
                            >
                              <div className="flex items-center gap-1">
                                Código
                                {sortColumn === 'codigo_unico' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'codigo_unico' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('tipo_de_cara')}
                            >
                              <div className="flex items-center gap-1">
                                Cara
                                {sortColumn === 'tipo_de_cara' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'tipo_de_cara' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('plaza')}
                            >
                              <div className="flex items-center gap-1">
                                Plaza
                                {sortColumn === 'plaza' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'plaza' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('nivel_socioeconomico')}
                            >
                              <div className="flex items-center gap-1">
                                NSE
                                {sortColumn === 'nivel_socioeconomico' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'nivel_socioeconomico' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('ubicacion')}
                            >
                              <div className="flex items-center gap-1">
                                Ubicación
                                {sortColumn === 'ubicacion' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'ubicacion' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupByDistance && groupedInventory ? (
                            // Grouped view with collapsible sections
                            groupedInventory.map(([groupName, items]) => (
                              <React.Fragment key={groupName}>
                                {/* Group Header */}
                                <tr
                                  className="bg-zinc-800/70 cursor-pointer hover:bg-zinc-800"
                                  onClick={() => toggleGroupExpansion(groupName)}
                                >
                                  <td colSpan={6} className="px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      {expandedGroups.has(groupName) ? (
                                        <ChevronDown className="h-4 w-4 text-purple-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-purple-400" />
                                      )}
                                      <span className="text-sm font-medium text-white">{groupName}</span>
                                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                        {items.length} sitios
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          selectAllInGroup(items);
                                        }}
                                        className="ml-auto text-xs text-purple-400 hover:text-purple-300"
                                      >
                                        Seleccionar todos
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {/* Group Items */}
                                {expandedGroups.has(groupName) && items.map((inv) => (
                                  <tr
                                    key={inv.id}
                                    onClick={() => toggleInventorySelection(inv.id)}
                                    className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedInventory.has(inv.id)
                                      ? 'bg-purple-500/10'
                                      : inv.ya_reservado_para_cara
                                        ? 'bg-green-500/5'
                                        : 'hover:bg-zinc-800/30'
                                      }`}
                                  >
                                    <td className="px-3 py-2 pl-8">
                                      <input
                                        type="checkbox"
                                        checked={selectedInventory.has(inv.id)}
                                        onChange={() => toggleInventorySelection(inv.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="checkbox-purple"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{inv.codigo_unico}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${inv.tipo_de_cara === 'Flujo'
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : inv.tipo_de_cara === 'Completo'
                                          ? 'bg-purple-500/20 text-purple-300'
                                          : 'bg-amber-500/20 text-amber-300'
                                        }`}>
                                        {inv.tipo_de_cara || '-'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-zinc-300 text-sm">{inv.plaza}</td>
                                    <td className="px-3 py-2 text-zinc-400 text-sm">{inv.nivel_socioeconomico || '-'}</td>
                                    <td className="px-3 py-2 text-zinc-400 text-sm" title={inv.ubicacion || ''}>
                                      {inv.ubicacion}
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))
                          ) : (
                            // Normal flat view
                            processedInventory.map((inv) => (
                              <tr
                                key={inv.id}
                                onClick={() => toggleInventorySelection(inv.id)}
                                className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedInventory.has(inv.id)
                                  ? 'bg-purple-500/10'
                                  : inv.ya_reservado_para_cara
                                    ? 'bg-green-500/5'
                                    : 'hover:bg-zinc-800/30'
                                  }`}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedInventory.has(inv.id)}
                                    onChange={() => toggleInventorySelection(inv.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="checkbox-purple"
                                  />
                                </td>
                                <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{inv.codigo_unico}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${inv.tipo_de_cara === 'Flujo'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : inv.tipo_de_cara === 'Completo'
                                      ? 'bg-purple-500/20 text-purple-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                    }`}>
                                    {inv.tipo_de_cara || '-'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-300 text-sm">{inv.plaza}</td>
                                <td className="px-3 py-2 text-zinc-400 text-sm">{inv.nivel_socioeconomico || '-'}</td>
                                <td className="px-3 py-2 text-zinc-400 text-sm" title={inv.ubicacion || ''}>
                                  {inv.ubicacion}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReservar}
                        disabled={isSaving || selectedInventory.size === 0 || (remainingToAssign.flujo <= 0 && remainingToAssign.contraflujo <= 0)}
                        className="flex-1 px-4 py-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="h-4 w-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Target className="h-4 w-4" />
                            Reservar
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleReserveAsBonificacion}
                        disabled={isSaving || selectedInventory.size === 0 || remainingToAssign.bonificacion <= 0}
                        className="flex-1 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="h-4 w-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Gift className="h-4 w-4" />
                            Bonificación
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced Map */}
                <div className="w-1/2">
                  {mapsLoaded ? (
                    <AdvancedMapComponent
                      inventarios={processedInventory}
                      selectedInventory={selectedInventory}
                      onToggleSelection={toggleInventorySelection}
                      mapCenter={mapCenter}
                      onFilterByPOI={handlePOIFilter}
                      hasPOIFilter={poiFilterIds !== null}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-zinc-800">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* RESERVADOS TAB CONTENT */
            <div className="flex-1 flex overflow-hidden">
              {/* Reservados Table */}
              <div className="w-1/2 flex flex-col border-r border-zinc-800">
                {/* Search Bar and Tools for Reservados */}
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 space-y-2">
                  {/* Row 1: Search and Delete */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        value={reservadosSearchTerm}
                        onChange={(e) => setReservadosSearchTerm(e.target.value)}
                        placeholder="Buscar por código, plaza, ubicación..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                    {selectedReservados.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded-full">
                          {selectedReservados.size} seleccionados
                        </span>
                        <button
                          onClick={() => {
                            setReservas(prev => prev.filter(r => !selectedReservados.has(r.id)));
                            setSelectedReservados(new Set());
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Filters and Tools */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Type Filter */}
                    <select
                      value={reservadosTipoFilter}
                      onChange={(e) => setReservadosTipoFilter(e.target.value as any)}
                      className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    >
                      <option value="Todos">Todos los tipos</option>
                      <option value="Flujo">Flujo</option>
                      <option value="Contraflujo">Contraflujo</option>
                      <option value="Bonificacion">Bonificación</option>
                    </select>

                    {/* Sort */}
                    <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1">
                      <span className="text-xs text-zinc-500">Ordenar:</span>
                      <button
                        onClick={() => toggleReservadosSort('ciudad')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'ciudad' ? 'bg-purple-500/30 text-purple-300' : 'text-zinc-400 hover:text-white'}`}
                      >
                        Ciudad {reservadosSortColumn === 'ciudad' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        onClick={() => toggleReservadosSort('codigo')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'codigo' ? 'bg-purple-500/30 text-purple-300' : 'text-zinc-400 hover:text-white'}`}
                      >
                        Código {reservadosSortColumn === 'codigo' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        onClick={() => toggleReservadosSort('tipo')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'tipo' ? 'bg-purple-500/30 text-purple-300' : 'text-zinc-400 hover:text-white'}`}
                      >
                        Tipo {reservadosSortColumn === 'tipo' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>

                    {/* Expand/Collapse All */}
                    <button
                      onClick={toggleAllCiudadGroups}
                      className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {expandedCiudadGroups.size === groupedReservados.length ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Colapsar
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Expandir
                        </>
                      )}
                    </button>

                    {/* Results count */}
                    <span className="text-xs text-zinc-500 ml-auto">
                      {filteredReservados.length} de {currentCaraReservas.length}
                    </span>
                  </div>
                </div>

                {currentCaraReservas.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                    <Layers className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay reservas</p>
                    <p className="text-sm">Agrega inventarios desde la pestaña "Buscar Disponibles"</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
                        <tr className="border-b border-zinc-800">
                          <th className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={filteredReservados.length > 0 && selectedReservados.size === filteredReservados.length}
                              onChange={handleToggleSelectAllReservados}
                              className="checkbox-purple"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs text-zinc-400 font-medium">Código</th>
                          <th className="px-4 py-3 text-left text-xs text-zinc-400 font-medium">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs text-zinc-400 font-medium">Formato</th>
                          <th className="px-4 py-3 text-left text-xs text-zinc-400 font-medium">Ubicación</th>
                          <th className="px-4 py-3 text-center text-xs text-zinc-400 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Grouped by Ciudad */}
                        {groupedReservados.map(([ciudad, items]) => (
                          <React.Fragment key={ciudad}>
                            {/* Ciudad Group Header */}
                            <tr
                              className="bg-zinc-800/70 cursor-pointer hover:bg-zinc-800"
                              onClick={() => toggleCiudadGroupExpansion(ciudad)}
                            >
                              <td colSpan={6} className="px-3 py-2">
                                <div className="flex items-center gap-3">
                                  {expandedCiudadGroups.has(ciudad) ? (
                                    <ChevronDown className="h-4 w-4 text-purple-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-purple-400" />
                                  )}
                                  <MapPin className="h-4 w-4 text-zinc-500" />
                                  <span className="text-sm font-medium text-white">{ciudad}</span>
                                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                    {items.length} reservas
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {/* Ciudad Items */}
                            {expandedCiudadGroups.has(ciudad) && items.map((reserva) => (
                              <tr
                                key={reserva.id}
                                onClick={() => handleToggleReservadoSelection(reserva.id)}
                                className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedReservados.has(reserva.id) ? 'bg-purple-500/10' : 'hover:bg-zinc-800/30'}`}
                              >
                                <td className="px-3 py-3 pl-8 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedReservados.has(reserva.id)}
                                    onChange={() => handleToggleReservadoSelection(reserva.id)}
                                    className="checkbox-purple"
                                  />
                                </td>
                                <td className="px-4 py-3 text-zinc-300 font-mono text-sm">{reserva.codigo_unico}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs ${reserva.tipo === 'Flujo'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : reserva.tipo === 'Bonificacion'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                    }`}>
                                    {reserva.tipo}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-zinc-300">{reserva.formato || '-'}</td>
                                <td className="px-4 py-3 text-zinc-400 text-sm" title={reserva.ubicacion || ''}>
                                  {reserva.ubicacion || '-'}
                                </td>
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleEditReserva(reserva)}
                                      className="p-1.5 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                                      title="Editar formato"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveReserva(reserva.id)}
                                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Quitar reserva"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Lateral Edit Panel */}
                {editingReserva && (
                  <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-700 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Editar Reserva</h3>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 p-4 space-y-4 overflow-auto">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Código</label>
                        <p className="text-sm text-zinc-300 font-mono">{editingReserva.codigo_unico}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
                        <span className={`px-2 py-1 rounded-full text-xs ${editingReserva.tipo === 'Flujo'
                          ? 'bg-blue-500/20 text-blue-300'
                          : editingReserva.tipo === 'Bonificacion'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {editingReserva.tipo}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Plaza</label>
                        <p className="text-sm text-zinc-300">{editingReserva.plaza || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Ubicación</label>
                        <p className="text-sm text-zinc-300">{editingReserva.ubicacion || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">Formato</label>
                        <select
                          value={editingFormato}
                          onChange={(e) => setEditingFormato(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        >
                          <option value="">-- Seleccionar --</option>
                          <option value="PARABUS">PARABUS</option>
                          <option value="MUPI">MUPI</option>
                          <option value="COLUMNA">COLUMNA</option>
                          <option value="METROPOLITANO PARALELO">METROPOLITANO PARALELO</option>
                          <option value="METROPOLITANO PERPENDICULAR">METROPOLITANO PERPENDICULAR</option>
                          <option value="CASETA DE TAXIS">CASETA DE TAXIS</option>
                          <option value="BOLERO">BOLERO</option>
                          <option value="MUPI DE PIEDRA">MUPI DE PIEDRA</option>
                          <option value="COLUMNA RECARGA">COLUMNA RECARGA</option>
                        </select>
                      </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800 flex gap-3">
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveFormato}
                        className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {currentCaraReservas.length > 0 && (
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">
                          <span className="text-blue-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Flujo').length}</span> Flujo
                        </span>
                        <span className="text-zinc-500">
                          <span className="text-amber-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Contraflujo').length}</span> Contraflujo
                        </span>
                        <span className="text-zinc-500">
                          <span className="text-emerald-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Bonificacion').length}</span> Bonificación
                        </span>
                      </div>
                      <span className="text-zinc-400">
                        Total: <span className="text-white font-medium">{currentCaraReservas.length}</span> reservados
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Map of Reservados */}
              <div className="w-1/2">
                {mapsLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={reservadosMapCenter}
                    zoom={13}
                    options={{
                      styles: DARK_MAP_STYLES,
                      disableDefaultUI: true,
                      zoomControl: true,
                    }}
                  >
                    {currentCaraReservas.map(reserva => (
                      reserva.latitud && reserva.longitud && (
                        <Marker
                          key={reserva.id}
                          position={{ lat: reserva.latitud, lng: reserva.longitud }}
                          icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: reserva.tipo === 'Flujo' ? '#3b82f6' : reserva.tipo === 'Bonificacion' ? '#10b981' : '#f59e0b',
                            fillOpacity: 0.9,
                            strokeColor: '#fff',
                            strokeWeight: 2,
                          }}
                          title={`${reserva.codigo_unico} - ${reserva.tipo}`}
                        />
                      )
                    ))}
                  </GoogleMap>
                ) : (
                  <div className="flex items-center justify-center h-full bg-zinc-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[95vw] max-w-[1400px] h-[90vh] bg-zinc-900 rounded-2xl border border-purple-500/20 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Asignar Inventario</h2>
            <p className="text-sm text-zinc-400">Propuesta #{propuesta.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Archivo de solicitud */}
            {solicitudDetails?.solicitud?.archivo && (
              <div className="flex items-center gap-2">
                <a
                  href={solicitudDetails.solicitud.archivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-lg text-xs font-medium hover:bg-violet-500/30 transition-colors"
                  title="Ver archivo de solicitud"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Archivo
                </a>
                <a
                  href={solicitudDetails.solicitud.archivo}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                  title="Descargar archivo de solicitud"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
                </a>
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {detailsLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              {/* Section 1: Propuesta Summary */}
              <div className="bg-zinc-800/30 rounded-2xl border border-zinc-700/50 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-700/50 bg-zinc-800/50">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-400" />
                    Resumen de Propuesta
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* Client info - read only */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">CUIC</label>
                      <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-300 border border-zinc-700/30">
                        {solicitudDetails?.solicitud.cuic || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Razón Social</label>
                      <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-300 border border-zinc-700/30 truncate">
                        {solicitudDetails?.solicitud.razon_social || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Marca</label>
                      <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-300 border border-zinc-700/30">
                        {solicitudDetails?.solicitud.marca_nombre || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Asesor</label>
                      <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-300 border border-zinc-700/30">
                        {solicitudDetails?.solicitud.asesor || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Nombre de Campaña</label>
                      <input
                        type="text"
                        value={nombreCampania}
                        onChange={(e) => setNombreCampania(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        placeholder="Nombre de la campaña"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500">Asignados</label>
                      {/* Add user button */}
                      <select
                        value=""
                        onChange={(e) => {
                          const userId = parseInt(e.target.value);
                          const selectedUser = users?.find((u: UserOption) => u.id === userId);
                          if (selectedUser && !asignados.find(a => a.id === userId)) {
                            setAsignados(prev => [...prev, selectedUser]);
                          }
                        }}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">+ Agregar asignado...</option>
                        {users?.filter((u: UserOption) => !asignados.find(a => a.id === u.id)).map((u: UserOption) => (
                          <option key={u.id} value={u.id}>{u.nombre} - {u.area}</option>
                        ))}
                      </select>
                      {/* Selected users tags */}
                      {asignados.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {asignados.map(user => (
                            <span
                              key={user.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs"
                            >
                              {user.nombre}
                              <button
                                onClick={() => setAsignados(prev => prev.filter(u => u.id !== user.id))}
                                className="hover:text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Period - Same style as EditSolicitudModal */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Año Inicio</label>
                      <select
                        value={yearInicio || ''}
                        onChange={(e) => { setYearInicio(e.target.value ? parseInt(e.target.value) : undefined); setCatorcenaInicio(undefined); }}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">Seleccionar</option>
                        {yearInicioOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Cat. Inicio</label>
                      <select
                        value={catorcenaInicio || ''}
                        onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearInicio}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Año Fin</label>
                      <select
                        value={yearFin || ''}
                        onChange={(e) => { setYearFin(e.target.value ? parseInt(e.target.value) : undefined); setCatorcenaFin(undefined); }}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">Seleccionar</option>
                        {yearFinOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Cat. Fin</label>
                      <select
                        value={catorcenaFin || ''}
                        onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!yearFin}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasFinOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes and Description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Notas</label>
                      <textarea
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20"
                        placeholder="Notas adicionales..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Descripción</label>
                      <textarea
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20"
                        placeholder="Descripción de la propuesta..."
                      />
                    </div>
                  </div>

                  {/* Archivo section - Same style as EditSolicitudModal */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500">Archivo (opcional)</label>
                    <input
                      ref={archivoInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleArchivoUpload}
                    />
                    {archivoPropuesta ? (
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                        <FileText className="h-5 w-5 text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-emerald-300 truncate">
                            {archivoPropuesta.split('/').pop()}
                          </p>
                          <a
                            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${archivoPropuesta}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                          >
                            Ver archivo
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => archivoInputRef.current?.click()}
                          className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => archivoInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-lg text-zinc-400 hover:text-violet-300 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        <span className="text-sm">Seleccionar archivo</span>
                      </button>
                    )}
                  </div>

                  {/* Update button */}
                  <div className="flex justify-end pt-2 border-t border-zinc-700/30">

                    {/* Update button - shows when there are changes */}
                    {hasChanges && (
                      <button
                        onClick={handleUpdatePropuesta}
                        disabled={isUpdatingPropuesta}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdatingPropuesta ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Actualizar Propuesta
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Caras/Formatos */}
              <div className="bg-zinc-800/30 rounded-2xl border border-zinc-700/50 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-700/50 bg-zinc-800/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-400" />
                    Formatos / Caras
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-400">
                      Renta: <span className="text-purple-300 font-medium">{carasKPIs.totalRenta}</span>
                    </span>
                    <span className="text-zinc-400">
                      Bonificación: <span className="text-emerald-300 font-medium">{carasKPIs.totalBonificacion}</span>
                    </span>
                    <span className="text-zinc-400">
                      Inversión: <span className="text-amber-300 font-medium">{formatCurrency(carasKPIs.totalInversion)}</span>
                    </span>
                    <button
                      onClick={() => { setShowAddCaraForm(true); setEditingCaraId(null); setNewCara(EMPTY_CARA); setSelectedArticulo(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar Cara
                    </button>
                  </div>
                </div>

                {/* Add/Edit Cara Form */}
                {showAddCaraForm && (
                  <div className="px-5 py-4 bg-zinc-800/50 border-b border-zinc-700/50">
                    <h4 className="text-sm font-medium text-white mb-4">
                      {editingCaraId ? 'Editar Cara' : 'Nueva Cara'}
                    </h4>

                    {/* Artículo selector */}
                    <div className="mb-4">
                      <label className="text-xs text-zinc-500 mb-1 block">Artículo SAP</label>
                      <SearchableSelect
                        label="Seleccionar artículo"
                        options={articulosData || []}
                        value={selectedArticulo}
                        onChange={(item: SAPArticulo) => {
                          setSelectedArticulo(item);
                          // Auto-complete all fields from article
                          const tarifa = getTarifaFromItemCode(item.ItemCode);
                          const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName);
                          const formato = getFormatoFromArticulo(item.ItemName);
                          const tipo = getTipoFromName(item.ItemName);
                          setNewCara({
                            ...newCara,
                            articulo: item.ItemCode,
                            tarifa_publica: tarifa,
                            estados: ciudadEstado?.estado || newCara.estados,
                            ciudad: ciudadEstado?.ciudad || newCara.ciudad,
                            formato: formato || newCara.formato,
                            tipo: tipo || newCara.tipo,
                          });
                        }}
                        onClear={() => {
                          setSelectedArticulo(null);
                          setNewCara({ ...newCara, articulo: '', tarifa_publica: 0, estados: '', ciudad: '', formato: '', tipo: '' });
                        }}
                        displayKey="ItemName"
                        valueKey="ItemCode"
                        searchKeys={['ItemCode', 'ItemName']}
                        loading={articulosLoading}
                        renderOption={(item: SAPArticulo) => (
                          <div>
                            <div className="font-medium text-white">{item.ItemCode}</div>
                            <div className="text-xs text-zinc-500">{item.ItemName}</div>
                          </div>
                        )}
                        renderSelected={(item: SAPArticulo) => (
                          <div className="text-left">
                            <div className="font-medium text-sm">{item.ItemCode}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{item.ItemName}</div>
                          </div>
                        )}
                      />
                    </div>

                    {/* Catorcena - solo una, filtrada por rango de propuesta */}
                    <div className="mb-4">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">
                          Catorcena
                          {propuesta.catorcena_inicio && propuesta.anio_inicio && propuesta.catorcena_fin && propuesta.anio_fin && (
                            <span className="text-zinc-600 ml-1">
                              (Rango: {propuesta.catorcena_inicio}/{propuesta.anio_inicio} - {propuesta.catorcena_fin}/{propuesta.anio_fin})
                            </span>
                          )}
                        </label>
                        <select
                          value={newCara.catorcena_inicio && newCara.anio_inicio ? `${newCara.anio_inicio}-${newCara.catorcena_inicio}` : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              const [year, cat] = e.target.value.split('-').map(Number);
                              const period = catorcenasData?.data.find(c => c.a_o === year && c.numero_catorcena === cat);
                              setNewCara({
                                ...newCara,
                                catorcena_inicio: cat,
                                anio_inicio: year,
                                catorcena_fin: cat,
                                anio_fin: year,
                                inicio_periodo: period?.fecha_inicio || '',
                                fin_periodo: period?.fecha_fin || ''
                              });
                            } else {
                              setNewCara({
                                ...newCara,
                                catorcena_inicio: undefined,
                                anio_inicio: undefined,
                                catorcena_fin: undefined,
                                anio_fin: undefined,
                                inicio_periodo: '',
                                fin_periodo: ''
                              });
                            }
                          }}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        >
                          <option value="">Seleccionar catorcena</option>
                          {catorcenasData?.data
                            .filter(c => {
                              // Filtrar solo catorcenas dentro del rango de la propuesta
                              if (!propuesta.catorcena_inicio || !propuesta.anio_inicio || !propuesta.catorcena_fin || !propuesta.anio_fin) {
                                return true; // Si no hay rango, mostrar todas
                              }
                              const catValue = c.a_o * 100 + c.numero_catorcena;
                              const minValue = propuesta.anio_inicio * 100 + propuesta.catorcena_inicio;
                              const maxValue = propuesta.anio_fin * 100 + propuesta.catorcena_fin;
                              return catValue >= minValue && catValue <= maxValue;
                            })
                            .map(c => (
                              <option key={`${c.a_o}-${c.numero_catorcena}`} value={`${c.a_o}-${c.numero_catorcena}`}>
                                Catorcena {c.numero_catorcena} / {c.a_o}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Estados {newCara.estados && <span className="text-purple-400">({newCara.estados.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={solicitudFilters?.estados || []}
                          selected={newCara.estados ? newCara.estados.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, estados: selected.join(', '), ciudad: '' })}
                          placeholder="Seleccionar estados..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Ciudades {newCara.ciudad && <span className="text-purple-400">({newCara.ciudad.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={
                            solicitudFilters?.ciudades
                              .filter(c => {
                                if (!newCara.estados) return true;
                                const selectedEstados = newCara.estados.split(',').map(s => s.trim());
                                return selectedEstados.includes(c.estado);
                              })
                              .map(c => c.ciudad) || []
                          }
                          selected={newCara.ciudad ? newCara.ciudad.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, ciudad: selected.join(', ') })}
                          placeholder="Seleccionar ciudades..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Formatos {newCara.formato && <span className="text-purple-400">({newCara.formato.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={solicitudFilters?.formatos || []}
                          selected={newCara.formato ? newCara.formato.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, formato: selected.join(', ') })}
                          placeholder="Seleccionar formatos..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Tipo</label>
                        <select
                          value={newCara.tipo}
                          onChange={(e) => setNewCara({ ...newCara, tipo: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        >
                          <option value="">Seleccionar</option>
                          <option value="Tradicional">Tradicional</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Caras Flujo</label>
                        <input
                          type="number"
                          value={newCara.caras_flujo || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setNewCara({ ...newCara, caras_flujo: val, caras: val + (newCara.caras_contraflujo || 0) });
                          }}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Caras Contraflujo</label>
                        <input
                          type="number"
                          value={newCara.caras_contraflujo || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setNewCara({ ...newCara, caras_contraflujo: val, caras: (newCara.caras_flujo || 0) + val });
                          }}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Bonificación</label>
                        <input
                          type="number"
                          value={newCara.bonificacion || ''}
                          onChange={(e) => setNewCara({ ...newCara, bonificacion: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Tarifa Pública</label>
                        <input
                          type="number"
                          value={newCara.tarifa_publica || ''}
                          onChange={(e) => setNewCara({ ...newCara, tarifa_publica: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">NSE {newCara.nivel_socioeconomico && <span className="text-purple-400">({newCara.nivel_socioeconomico.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={solicitudFilters?.nse || []}
                          selected={newCara.nivel_socioeconomico ? newCara.nivel_socioeconomico.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, nivel_socioeconomico: selected.join(', ') })}
                          placeholder="Seleccionar NSE..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelCaraForm}
                        className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveCara}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
                      >
                        {editingCaraId ? 'Actualizar' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-zinc-700/30">
                  {caras.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                      <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>No hay formatos/caras en esta propuesta</p>
                      <button
                        onClick={() => setShowAddCaraForm(true)}
                        className="mt-3 text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Agregar primera cara
                      </button>
                    </div>
                  ) : (
                    carasGroupedByCatorcena.map(([periodo, groupData]) => {
                      const isCatorcenaExpanded = expandedCatorcenas.has(periodo);
                      const catorcenaLabel = groupData.catorcenaNum
                        ? `Catorcena #${groupData.catorcenaNum}${groupData.year ? ` - ${groupData.year}` : ''}`
                        : `Periodo: ${periodo}`;

                      return (
                        <div key={periodo}>
                          {/* Period Header - Collapsible */}
                          <div
                            className="px-5 py-3 bg-purple-500/10 border-b border-purple-500/20 flex items-center gap-3 cursor-pointer hover:bg-purple-500/15 transition-colors"
                            onClick={() => toggleCatorcena(periodo)}
                          >
                            <button className="text-purple-400">
                              {isCatorcenaExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <span className="text-sm font-medium text-purple-300">
                              {catorcenaLabel}
                            </span>
                            <span className="text-xs text-zinc-500">
                              ({groupData.caras.length} {groupData.caras.length === 1 ? 'formato' : 'formatos'})
                            </span>
                          </div>

                          {isCatorcenaExpanded && groupData.caras.map((cara) => {
                            const isExpanded = expandedCaras.has(cara.localId);
                            const caraReservas = reservas.filter(r =>
                              r.id.startsWith(cara.localId) || r.solicitudCaraId === cara.id
                            );
                            const hasReservas = caraReservas.length > 0;
                            const status = getCaraCompletionStatus(cara);
                            const totalCaras = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0) + (cara.bonificacion || 0);
                            const carasFaltantes = status.totalRequerido - status.totalReservado;

                            // Determine status color and indicator
                            const statusColor = status.totalDiff === 0
                              ? 'emerald' // Exact match
                              : status.totalDiff > 0
                                ? 'amber' // Over-reserved (needs attention)
                                : 'red'; // Under-reserved (deficit)

                            return (
                              <div key={cara.localId} className={`${statusColor === 'emerald' ? 'bg-emerald-500/5' : statusColor === 'amber' ? 'bg-amber-500/5' : 'bg-red-500/5'}`}>
                                {/* Cara header */}
                                <div
                                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                                  onClick={() => toggleCara(cara.localId)}
                                >
                                  {/* Completion indicator */}
                                  <div className={`w-2 h-2 rounded-full ${
                                    statusColor === 'emerald' ? 'bg-emerald-500' :
                                    statusColor === 'amber' ? 'bg-amber-500 animate-pulse' :
                                    'bg-red-500 animate-pulse'
                                  }`} />

                                  <button className="text-zinc-400 ml-2">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                  <div className="flex-1 grid grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <span className="text-zinc-500 text-xs">Formato</span>
                                      <p className="text-white font-medium">{cara.formato || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Ciudad</span>
                                      <p className="text-zinc-300">{cara.ciudad || cara.estados || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Artículo</span>
                                      <p className="text-zinc-300">{cara.articulo || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Caras</span>
                                      <div className="flex items-center gap-1">
                                        <p className="text-white font-medium">{status.totalReservado}/{totalCaras}</p>
                                        {status.totalDiff !== 0 && (
                                          <span className={`text-xs font-medium ${status.totalDiff > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                            ({status.totalDiff > 0 ? '+' : ''}{status.totalDiff})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSearchInventory(cara); }}
                                      className={`p-2 rounded-lg border transition-colors ${status.isComplete
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                        }`}
                                      title={status.isComplete ? 'Completo - clic para modificar' : 'Buscar inventario'}
                                    >
                                      <Search className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEditCara(cara); }}
                                      className="p-2 rounded-lg border transition-colors bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                      title="Editar"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteCara(cara.localId); }}
                                      disabled={hasReservas}
                                      className={`p-2 rounded-lg border transition-colors ${hasReservas
                                        ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                        }`}
                                      title={hasReservas ? 'No se puede eliminar (tiene reservas)' : 'Eliminar'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded content - reservas */}
                                {isExpanded && (
                                  <div className="px-5 py-3 bg-zinc-900/30 border-t border-zinc-700/30">
                                    {caraReservas.length === 0 ? (
                                      <div className="text-center py-4 text-zinc-500 text-sm">
                                        <MapPin className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                        <p>Sin inventario reservado</p>
                                        <button
                                          onClick={() => handleSearchInventory(cara)}
                                          className="mt-2 text-purple-400 hover:text-purple-300 text-xs"
                                        >
                                          Buscar inventario
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="text-zinc-500 text-xs">
                                              <th className="text-left pb-2">Código</th>
                                              <th className="text-left pb-2">Tipo</th>
                                              <th className="text-left pb-2">Plaza</th>
                                              <th className="text-left pb-2">Formato</th>
                                              <th className="text-left pb-2">Ubicación</th>
                                              <th className="text-right pb-2">Acciones</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {caraReservas.map(reserva => (
                                              <tr key={reserva.id} className="border-t border-zinc-700/30">
                                                <td className="py-2 text-zinc-300 font-mono text-xs">{reserva.codigo_unico}</td>
                                                <td className="py-2">
                                                  <span className={`px-2 py-0.5 rounded-full text-xs ${reserva.tipo === 'Flujo' ? 'bg-blue-500/20 text-blue-300' :
                                                    reserva.tipo === 'Contraflujo' ? 'bg-amber-500/20 text-amber-300' :
                                                      'bg-emerald-500/20 text-emerald-300'
                                                    }`}>
                                                    {reserva.tipo}
                                                  </span>
                                                </td>
                                                <td className="py-2 text-zinc-300">{reserva.plaza}</td>
                                                <td className="py-2 text-zinc-300">{reserva.formato}</td>
                                                <td className="py-2 text-zinc-400 truncate max-w-[200px]">{reserva.ubicacion}</td>
                                                <td className="py-2 text-right">
                                                  {/* Removed as per request to only allow deletion from searcher 
                                                  <button
                                                    onClick={() => setReservas(prev => prev.filter(r => r.id !== reserva.id))}
                                                    className="p-1 text-red-400 hover:text-red-300"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                  */}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 3: Reservas Summary with Map and Selection */}
              {reservas.length > 0 && (() => {
                // Group reservas by plaza for selection
                const reservasByPlaza = reservas.reduce((acc, r) => {
                  const plaza = r.plaza || 'Sin Plaza';
                  if (!acc[plaza]) acc[plaza] = [];
                  acc[plaza].push(r);
                  return acc;
                }, {} as Record<string, typeof reservas>);
                const plazas = Object.keys(reservasByPlaza).sort();

                // Toggle functions
                const toggleAllMapReservas = () => {
                  if (selectedMapReservas.size === reservas.length) {
                    setSelectedMapReservas(new Set());
                  } else {
                    setSelectedMapReservas(new Set(reservas.map(r => r.id)));
                  }
                };
                const togglePlazaMapReservas = (plaza: string) => {
                  const plazaIds = reservasByPlaza[plaza].map(r => r.id);
                  const allSelected = plazaIds.every(id => selectedMapReservas.has(id));
                  setSelectedMapReservas(prev => {
                    const next = new Set(prev);
                    if (allSelected) {
                      plazaIds.forEach(id => next.delete(id));
                    } else {
                      plazaIds.forEach(id => next.add(id));
                    }
                    return next;
                  });
                };
                const toggleSingleMapReserva = (id: string) => {
                  setSelectedMapReservas(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                };

                return (
                  <div className="bg-zinc-800/30 rounded-2xl border border-zinc-700/50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-700/50 bg-zinc-800/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-purple-400" />
                        Resumen de Reservas
                      </h3>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-zinc-400">
                          {selectedMapReservas.size > 0
                            ? `${selectedMapReservas.size} seleccionadas`
                            : 'Selecciona para resaltar en mapa'}
                        </span>
                        {selectedMapReservas.size > 0 && (
                          <button
                            onClick={() => setSelectedMapReservas(new Set())}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex min-h-[420px]">
                      {/* Selection Panel */}
                      <div className="w-72 border-r border-zinc-700/50 bg-zinc-900/30 flex flex-col flex-shrink-0">
                        {/* Select All Header */}
                        <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/50">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedMapReservas.size === reservas.length && reservas.length > 0}
                              onChange={toggleAllMapReservas}
                              className="checkbox-purple"
                            />
                            <span className="text-sm font-medium text-white">Seleccionar Todas</span>
                            <span className="ml-auto px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                              {reservas.length}
                            </span>
                          </label>
                        </div>
                        {/* Plaza Groups */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                          {plazas.map(plaza => {
                            const plazaReservas = reservasByPlaza[plaza];
                            const plazaIds = plazaReservas.map(r => r.id);
                            const allPlazaSelected = plazaIds.every(id => selectedMapReservas.has(id));
                            const somePlazaSelected = plazaIds.some(id => selectedMapReservas.has(id));

                            return (
                              <div key={plaza} className="border-b border-zinc-800/50">
                                {/* Plaza Header */}
                                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/30 hover:bg-zinc-800/50">
                                  <input
                                    type="checkbox"
                                    checked={allPlazaSelected}
                                    ref={(el) => { if (el) el.indeterminate = somePlazaSelected && !allPlazaSelected; }}
                                    onChange={() => togglePlazaMapReservas(plaza)}
                                    className="checkbox-purple"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                                  <span className="text-sm text-white flex-1">{plaza}</span>
                                  <span className="text-xs text-zinc-500">{plazaReservas.length}</span>
                                </div>
                                {/* Individual Reservas */}
                                <div className="bg-zinc-900/50">
                                  {plazaReservas.map(reserva => (
                                    <label
                                      key={reserva.id}
                                      className={`flex items-center gap-2 px-4 py-1.5 pl-8 cursor-pointer text-xs transition-colors ${
                                        selectedMapReservas.has(reserva.id) ? 'bg-purple-500/10' : 'hover:bg-zinc-800/30'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedMapReservas.has(reserva.id)}
                                        onChange={() => toggleSingleMapReserva(reserva.id)}
                                        className="checkbox-purple"
                                      />
                                      <span className="text-zinc-400 font-mono">{reserva.codigo_unico}</span>
                                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                                        reserva.tipo === 'Flujo' ? 'bg-blue-500/20 text-blue-300' :
                                        reserva.tipo === 'Contraflujo' ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-emerald-500/20 text-emerald-300'
                                      }`}>
                                        {reserva.tipo === 'Bonificacion' ? 'Bonif' : reserva.tipo}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* KPIs Mini Summary */}
                        <div className="p-3 border-t border-zinc-700/50 bg-zinc-800/50">
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div>
                              <p className="text-zinc-500">Flujo</p>
                              <p className="text-blue-400 font-bold">{reservasKPIs.flujo}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Contra</p>
                              <p className="text-amber-400 font-bold">{reservasKPIs.contraflujo}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Bonif</p>
                              <p className="text-emerald-400 font-bold">{reservasKPIs.bonificadas}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Map */}
                      <div className="flex-1">
                        {mapsLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={{ lat: 20.6597, lng: -103.3496 }}
                            zoom={11}
                            options={{
                              styles: DARK_MAP_STYLES,
                              disableDefaultUI: true,
                              zoomControl: true,
                            }}
                          >
                            {reservas.map(reserva => {
                              if (!reserva.latitud || !reserva.longitud) return null;
                              const isSelected = selectedMapReservas.has(reserva.id);
                              const hasSelection = selectedMapReservas.size > 0;

                              return (
                                <Marker
                                  key={reserva.id}
                                  position={{ lat: reserva.latitud, lng: reserva.longitud }}
                                  onClick={() => toggleSingleMapReserva(reserva.id)}
                                  icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: isSelected ? 12 : (hasSelection ? 6 : 8),
                                    fillColor: reserva.tipo === 'Flujo' ? '#3b82f6' :
                                      reserva.tipo === 'Contraflujo' ? '#f59e0b' : '#10b981',
                                    fillOpacity: isSelected ? 1 : (hasSelection ? 0.3 : 0.9),
                                    strokeColor: isSelected ? '#fff' : (hasSelection ? 'transparent' : '#fff'),
                                    strokeWeight: isSelected ? 3 : 2,
                                  }}
                                  zIndex={isSelected ? 1000 : 1}
                                />
                              );
                            })}
                          </GoogleMap>
                        ) : (
                          <div className="flex items-center justify-center h-full bg-zinc-800">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
      {/* Confirmation Modal */}
      {confirmModalJSX}

      {/* Loading Overlay */}
      {isSaving && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-zinc-700 border-t-purple-500" />
            <p className="text-zinc-300 font-medium animate-pulse">Procesando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
