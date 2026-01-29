import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Users,
  FileText, MapPin, Layers, Pencil, Map as MapIcon, Package, Calendar,
  Gift, Target, Save, ArrowLeft, Filter, Grid, LayoutGrid, Ruler, ArrowUpDown, ArrowUp, ArrowDown, Download, Eye, Funnel, Check, Upload, Monitor
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { AdvancedMapComponent } from './AdvancedMapComponent';
import { Propuesta } from '../../types';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService, InventarioDisponible } from '../../services/inventarios.service';
import { propuestasService, ReservaModalItem } from '../../services/propuestas.service';
import { formatCurrency } from '../../lib/utils';
import { useEnvironmentStore, getEndpoints } from '../../store/environmentStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useSocketPropuesta, useSocketEquipos } from '../../hooks/useSocket';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

// Static URL for files
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

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
  readOnly?: boolean;
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
  autorizacion_dg?: string;
  autorizacion_dcm?: string;
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

  // Ciudades que no existen como tal y solo deben poner el estado (Ciudad de México)
  const CIUDADES_SIN_CIUDAD = ['CDMX', 'CIUDAD DE MEXICO', 'MEXICO', 'DF'];

  for (const [ciudad, estado] of sortedCities) {
    // Use word boundary check - city must be preceded and followed by non-letter chars
    const regex = new RegExp(`(^|[^A-Z])${ciudad.replace(/\s+/g, '\\s+')}([^A-Z]|$)`, 'i');
    if (regex.test(name)) {
      // Si es una ciudad que no existe (CDMX, etc.), solo devolver estado sin ciudad
      if (CIUDADES_SIN_CIUDAD.includes(ciudad)) {
        return { estado, ciudad: '' };
      }
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
  grupo_completo_id?: number | null; // For grouping complete groups
  articulo?: string; // Artículo SAP de la cara
}

// ============ ADVANCED FILTERS SYSTEM (copied from CampanaDetailPage) ============
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

// Campos para filtrar reservas
const FILTER_FIELDS_RESERVAS: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Código', type: 'string' },
  { field: 'tipo', label: 'Tipo', type: 'string' },
  { field: 'plaza', label: 'Plaza', type: 'string' },
  { field: 'formato', label: 'Formato', type: 'string' },
  { field: 'catorcena', label: 'Catorcena', type: 'number' },
  { field: 'anio', label: 'Año', type: 'number' },
];

// Operadores disponibles
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

// Opciones de agrupación (soporta múltiples niveles)
type GroupByFieldReservas = 'catorcena' | 'tipo' | 'plaza' | 'formato' | 'grupo' | 'articulo';
interface GroupConfigReservas {
  field: GroupByFieldReservas;
  label: string;
}

const AVAILABLE_GROUPINGS_RESERVAS: GroupConfigReservas[] = [
  { field: 'catorcena', label: 'Catorcena' },
  { field: 'grupo', label: 'Grupo Completo' },
  { field: 'articulo', label: 'Artículo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'formato', label: 'Formato' },
  { field: 'tipo', label: 'Tipo' },
];

// Función para aplicar filtros a los datos
function applyFiltersReservas<T>(data: T[], filters: FilterCondition[]): T[] {
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
// ============ END ADVANCED FILTERS SYSTEM ============

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

export function AssignInventarioModal({ isOpen, onClose, propuesta, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);

  // WebSocket para escuchar cambios en reservas en tiempo real
  useSocketPropuesta(propuesta?.id || null);

  // Socket para actualizar usuarios en tiempo real
  useSocketEquipos();

  // Si readOnly es true, sobrescribir permisos para modo visualización
  const effectiveCanEdit = !readOnly && permissions.canAsignarInventario;
  const canEditResumen = !readOnly && permissions.canEditResumenPropuesta;
  const mapRef = useRef<google.maps.Map | null>(null);
  const reservadosMapRef = useRef<google.maps.Map | null>(null);

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
  const [tipoArchivoPropuesta, setTipoArchivoPropuesta] = useState<string | null>(null);

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

  // Check if the cara being edited has reservas (to block certain fields)
  const editingCaraHasReservas = useMemo(() => {
    if (!editingCaraId) return false;
    const editingCara = caras.find(c => c.localId === editingCaraId);
    if (!editingCara) return false;
    // Check if there are any reservas for this cara
    return reservas.some(r =>
      r.id.startsWith(editingCaraId) || r.solicitudCaraId === editingCara.id
    );
  }, [editingCaraId, caras, reservas]);

  // Inventory search state
  const [searchFilters, setSearchFilters] = useState({
    plaza: '',
    tipo: '',
    formato: '',
  });
  const [selectedInventory, setSelectedInventory] = useState<Set<string>>(new Set());

  // Helper function to get unique key for inventory item (handles digital spaces)
  const getInventoryKey = useCallback((inv: InventarioDisponible | ProcessedInventoryItem): string => {
    const isDigital = inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0);
    return isDigital && inv.espacio_id ? `${inv.id}_${inv.espacio_id}` : `${inv.id}`;
  }, []);
  const [selectedReservados, setSelectedReservados] = useState<Set<string>>(new Set());
  const [selectedMapReservas, setSelectedMapReservas] = useState<Set<string>>(new Set()); // For map highlighting
  const [reservadosSearchTerm, setReservadosSearchTerm] = useState('');
  const [editingReserva, setEditingReserva] = useState<ReservaItem | null>(null);
  const [editingFormato, setEditingFormato] = useState('');
  const [reservadosTipoFilter, setReservadosTipoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo' | 'Bonificacion'>('Todos');
  const [reservadosSortColumn, setReservadosSortColumn] = useState<'codigo' | 'tipo' | 'formato' | 'ciudad'>('ciudad');
  // Reservas summary states - Advanced Filter System
  const [filtersReservas, setFiltersReservas] = useState<FilterCondition[]>([]);
  const [showFiltersReservas, setShowFiltersReservas] = useState(false);
  const [activeGroupingsReservas, setActiveGroupingsReservas] = useState<GroupByFieldReservas[]>(['catorcena', 'articulo']);
  const [showGroupingConfigReservas, setShowGroupingConfigReservas] = useState(false);
  const [sortFieldReservas, setSortFieldReservas] = useState<string | null>(null);
  const [sortDirectionReservas, setSortDirectionReservas] = useState<'asc' | 'desc'>('asc');
  const [showSortReservas, setShowSortReservas] = useState(false);
  const [expandedReservasGroups, setExpandedReservasGroups] = useState<Set<string>>(new Set());
  const [reservadosSortDirection, setReservadosSortDirection] = useState<'asc' | 'desc'>('asc');
  const [disponiblesSearchTerm, setDisponiblesSearchTerm] = useState('');

  // Advanced inventory filters
  const [showOnlyUnicos, setShowOnlyUnicos] = useState(false);
  const [showOnlyCompletos, setShowOnlyCompletos] = useState(false);
  const [showOnlyUnicosDigitales, setShowOnlyUnicosDigitales] = useState(false);
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

  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'info'
  });

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Helper to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
  };

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
    queryKey: ['solicitudes-users', 'team-filtered'],
    queryFn: () => solicitudesService.getUsers(undefined, true),
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
        const response = await fetch(getEndpoints(useEnvironmentStore.getState().environment).articulos);
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
          catorcena: matchingCara?.catorcena_inicio || catorcenaInicio || 1,
          anio: matchingCara?.anio_inicio || yearInicio || new Date().getFullYear(),
          latitud: Number(r.latitud) || 0,
          longitud: Number(r.longitud) || 0,
          plaza: r.plaza || '',
          formato: r.formato || '',
          ubicacion: r.ubicacion,
          solicitudCaraId: r.solicitud_cara_id,
          reservaId: r.reserva_id,
          grupo_completo_id: r.grupo_completo_id,
          articulo: matchingCara?.articulo || r.articulo || '',
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
      setArchivoPropuesta(solicitudDetails.solicitud?.archivo || null);
      setTipoArchivoPropuesta(solicitudDetails.solicitud?.tipo_archivo || null);

      // Set period from cotizacion dates
      const cot = solicitudDetails.cotizacion;
      let yInicio: number | undefined;
      let cInicio: number | undefined;
      let yFin: number | undefined;
      let cFin: number | undefined;

      // Load catorcenas from cotizacion dates using proper date comparison
      if (cot?.fecha_inicio && catorcenasData?.data) {
        const fechaInicioDate = new Date(cot.fecha_inicio);
        const inicioCat = catorcenasData.data.find(c => {
          const cInicioDate = new Date(c.fecha_inicio);
          const cFinDate = new Date(c.fecha_fin);
          return fechaInicioDate >= cInicioDate && fechaInicioDate <= cFinDate;
        });
        if (inicioCat) {
          yInicio = inicioCat.a_o;
          setYearInicio(yInicio);
          cInicio = inicioCat.numero_catorcena;
          setCatorcenaInicio(cInicio);
        }
      }
      if (cot?.fecha_fin && catorcenasData?.data) {
        const fechaFinDate = new Date(cot.fecha_fin);
        const finCat = catorcenasData.data.find(c => {
          const cInicioDate = new Date(c.fecha_inicio);
          const cFinDate = new Date(c.fecha_fin);
          return fechaFinDate >= cInicioDate && fechaFinDate <= cFinDate;
        });
        if (finCat) {
          yFin = finCat.a_o;
          setYearFin(yFin);
          cFin = finCat.numero_catorcena;
          setCatorcenaFin(cFin);
        }
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
        const carasWithIds: CaraItem[] = solicitudDetails.caras.map((cara, idx) => {
          // Calculate catorcena from inicio_periodo
          let catorcenaInicioCara: number | undefined;
          let anioInicioCara: number | undefined;
          if (cara.inicio_periodo && catorcenasData?.data) {
            const inicioPeriodoDate = new Date(cara.inicio_periodo);
            const catInicio = catorcenasData.data.find(c => {
              const cInicioDate = new Date(c.fecha_inicio);
              const cFinDate = new Date(c.fecha_fin);
              return inicioPeriodoDate >= cInicioDate && inicioPeriodoDate <= cFinDate;
            });
            if (catInicio) {
              catorcenaInicioCara = catInicio.numero_catorcena;
              anioInicioCara = catInicio.a_o;
            }
          }

          return {
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
            catorcena_inicio: catorcenaInicioCara,
            anio_inicio: anioInicioCara,
            autorizacion_dg: cara.autorizacion_dg || 'aprobado',
            autorizacion_dcm: cara.autorizacion_dcm || 'aprobado',
          };
        });
        setCaras(carasWithIds);
      }
    }
  }, [solicitudDetails, propuesta, isOpen, users, catorcenasData]);

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

  // Merge all reservas by grupo_completo_id (for display)
  const reservasMerged = useMemo(() => {
    const result: ReservaItem[] = [];
    const processedGrupos = new Set<number>();

    reservas.forEach(r => {
      if (r.grupo_completo_id && !processedGrupos.has(r.grupo_completo_id)) {
        const groupReservas = reservas.filter(res => res.grupo_completo_id === r.grupo_completo_id);
        if (groupReservas.length >= 2) {
          const baseCode = r.codigo_unico?.replace(/_Flujo|_Contraflujo/gi, '') || '';
          result.push({
            ...r,
            id: `completo-${r.grupo_completo_id}`,
            codigo_unico: `${baseCode}_Completo`,
            tipo: 'Flujo' as const,
          });
          processedGrupos.add(r.grupo_completo_id);
        } else {
          result.push(r);
          processedGrupos.add(r.grupo_completo_id);
        }
      } else if (!r.grupo_completo_id) {
        result.push(r);
      }
    });

    return result;
  }, [reservas]);

  // Calculate KPIs for reservas (including completo count)
  const reservasKPIs = useMemo(() => {
    const flujo = reservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujo = reservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificadas = reservas.filter(r => r.tipo === 'Bonificacion').length;
    const renta = flujo + contraflujo; // Non-bonificadas
    const total = reservas.length;

    // Count completo items (merged pairs)
    const processedGrupos = new Set<number>();
    let completos = 0;
    reservas.forEach(r => {
      if (r.grupo_completo_id && !processedGrupos.has(r.grupo_completo_id)) {
        const groupReservas = reservas.filter(res => res.grupo_completo_id === r.grupo_completo_id);
        if (groupReservas.length >= 2) {
          completos++;
        }
        processedGrupos.add(r.grupo_completo_id);
      }
    });

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

    return { flujo, contraflujo, bonificadas, renta, total, dineroTotal, digitales, completos };
  }, [reservas, caras]);

  // ============ ADVANCED FILTER FUNCTIONS FOR RESERVAS ============
  // Obtener valores únicos para cada campo
  const getUniqueValuesReservas = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    FILTER_FIELDS_RESERVAS.forEach(fieldConfig => {
      const values = new Set<string>();
      reservas.forEach(item => {
        const val = item[fieldConfig.field as keyof ReservaItem];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [reservas]);

  // Funciones para manejar filtros
  const addFilterReservas = () => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      field: FILTER_FIELDS_RESERVAS[0].field,
      operator: '=',
      value: '',
    };
    setFiltersReservas(prev => [...prev, newFilter]);
  };

  const updateFilterReservas = (id: string, updates: Partial<FilterCondition>) => {
    setFiltersReservas(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilterReservas = (id: string) => {
    setFiltersReservas(prev => prev.filter(f => f.id !== id));
  };

  const clearFiltersReservas = () => {
    setFiltersReservas([]);
  };

  // Toggle agrupación (soporta múltiples niveles)
  const toggleGroupingReservas = (field: GroupByFieldReservas) => {
    setActiveGroupingsReservas(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else if (prev.length < 3) {
        return [...prev, field];
      }
      return prev;
    });
  };

  // Filtrar y ordenar reservas (uses merged version for display)
  const filteredReservasData = useMemo(() => {
    let data = applyFiltersReservas(reservasMerged, filtersReservas);

    // Aplicar ordenamiento
    if (sortFieldReservas) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortFieldReservas as keyof ReservaItem];
        const bVal = b[sortFieldReservas as keyof ReservaItem];
        const aStr = aVal === null || aVal === undefined ? '' : String(aVal);
        const bStr = bVal === null || bVal === undefined ? '' : String(bVal);
        const compare = aStr.localeCompare(bStr, undefined, { numeric: true });
        return sortDirectionReservas === 'asc' ? compare : -compare;
      });
    }

    return data;
  }, [reservasMerged, filtersReservas, sortFieldReservas, sortDirectionReservas]);
  // ============ END ADVANCED FILTER FUNCTIONS ============

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

  // Check if all caras are complete (for "Aprobar propuesta" button)
  const allCarasComplete = useMemo(() => {
    if (caras.length === 0) return false;
    return caras.every(cara => {
      const status = getCaraCompletionStatus(cara);
      return status.isComplete;
    });
  }, [caras, reservas]);

  // Check if any cara has pending authorization
  const hasPendingAuthorization = useMemo(() => {
    return caras.some(cara =>
      cara.autorizacion_dg === 'pendiente' || cara.autorizacion_dcm === 'pendiente'
    );
  }, [caras]);

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

    const caraToDelete = caras.find(c => c.localId === localId);

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Formato',
      message: '¿Estás seguro de que deseas eliminar este formato de la propuesta?',
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        // If cara has DB id, delete from database
        if (caraToDelete?.id) {
          try {
            await propuestasService.deleteCara(propuesta.id, caraToDelete.id);
          } catch (error) {
            console.error('Error deleting cara:', error);
            alert('Error al eliminar el formato de la base de datos');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return;
          }
        }
        // Update local state
        setCaras(prev => prev.filter(c => c.localId !== localId));
        setReservas(prev => prev.filter(r => !r.id.startsWith(localId)));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle edit cara - permite edición parcial cuando hay reservas
  const handleEditCara = (cara: CaraItem) => {
    // Ya no bloqueamos completamente - permitimos edición de ciudad, formatos y NSE
    setEditingCaraId(cara.localId);

    // Find and set the selectedArticulo if we have the articulo code
    if (cara.articulo && articulosData) {
      const foundArticulo = articulosData.find(a => a.ItemCode === cara.articulo);
      if (foundArticulo) {
        setSelectedArticulo(foundArticulo);
      }
    }

    // Calculate caras en renta (flujo + contraflujo)
    const carasEnRenta = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0);

    // Try to find the matching catorcena from inicio_periodo
    let catorcenaInicioVal = cara.catorcena_inicio;
    let anioInicioVal = cara.anio_inicio;
    let catorcenaFinVal = cara.catorcena_fin;
    let anioFinVal = cara.anio_fin;

    // If catorcena fields are not set but we have dates, try to find matching catorcena
    if ((!catorcenaInicioVal || !anioInicioVal) && cara.inicio_periodo && catorcenasData?.data) {
      const inicioDate = new Date(cara.inicio_periodo);
      const matchingCatorcena = catorcenasData.data.find(c => {
        const catStart = new Date(c.fecha_inicio);
        const catEnd = new Date(c.fecha_fin);
        return inicioDate >= catStart && inicioDate <= catEnd;
      });
      if (matchingCatorcena) {
        catorcenaInicioVal = matchingCatorcena.numero_catorcena;
        anioInicioVal = matchingCatorcena.a_o;
        catorcenaFinVal = matchingCatorcena.numero_catorcena;
        anioFinVal = matchingCatorcena.a_o;
      }
    }

    setNewCara({
      ciudad: cara.ciudad,
      estados: cara.estados,
      tipo: cara.tipo,
      flujo: cara.flujo,
      bonificacion: cara.bonificacion,
      caras: carasEnRenta,
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
      catorcena_inicio: catorcenaInicioVal,
      anio_inicio: anioInicioVal,
      catorcena_fin: catorcenaFinVal,
      anio_fin: anioFinVal,
    });
    setShowAddCaraForm(true);
  };

  // Handle save cara (add or update) - persists to database
  const handleSaveCara = async () => {
    if (!newCara.formato || !newCara.estados) {
      alert('Por favor completa al menos el formato y estado');
      return;
    }

    // If no ciudad selected but estado is, get all cities from that estado
    let ciudadToSave = newCara.ciudad;
    if (!ciudadToSave && newCara.estados && solicitudFilters?.ciudades) {
      const selectedEstados = newCara.estados.split(',').map(s => s.trim());
      const allCitiesForEstado = solicitudFilters.ciudades
        .filter(c => selectedEstados.includes(c.estado))
        .map(c => c.ciudad);
      ciudadToSave = allCitiesForEstado.join(', ');
    }

    // Calcular costo como caras * tarifa_publica (inversión)
    const costoCalculado = (newCara.caras || 0) * (newCara.tarifa_publica || 0);

    const caraData = {
      ciudad: ciudadToSave,
      estados: newCara.estados,
      tipo: newCara.tipo,
      flujo: newCara.flujo,
      bonificacion: newCara.bonificacion,
      caras: newCara.caras,
      nivel_socioeconomico: newCara.nivel_socioeconomico,
      formato: newCara.formato,
      costo: costoCalculado,
      tarifa_publica: newCara.tarifa_publica,
      inicio_periodo: newCara.inicio_periodo,
      fin_periodo: newCara.fin_periodo,
      caras_flujo: newCara.caras_flujo,
      caras_contraflujo: newCara.caras_contraflujo,
      articulo: newCara.articulo,
      descuento: newCara.descuento,
    };

    try {
      if (editingCaraId) {
        // Find the cara being edited to get its database ID
        const caraToEdit = caras.find(c => c.localId === editingCaraId);
        if (caraToEdit?.id) {
          // Evaluar autorización antes de actualizar
          let autorizacion_dg = 'aprobado';
          let autorizacion_dcm = 'aprobado';
          try {
            const resultado = await solicitudesService.evaluarAutorizacion({
              ciudad: ciudadToSave,
              estado: newCara.estados,
              formato: newCara.formato,
              tipo: newCara.tipo,
              caras: newCara.caras,
              bonificacion: newCara.bonificacion,
              costo: costoCalculado,
              tarifa_publica: newCara.tarifa_publica
            });
            autorizacion_dg = resultado.autorizacion_dg || 'aprobado';
            autorizacion_dcm = resultado.autorizacion_dcm || 'aprobado';
          } catch (error) {
            console.error('Error evaluando autorización:', error);
          }

          // Update in database with authorization status
          const updatedCara = await propuestasService.updateCara(propuesta.id, caraToEdit.id, caraData);

          // Update local state with new authorization status
          setCaras(prev => prev.map(c =>
            c.localId === editingCaraId
              ? {
                  ...c,
                  ...newCara,
                  costo: costoCalculado,
                  autorizacion_dg: updatedCara?.autorizacion_dg || autorizacion_dg,
                  autorizacion_dcm: updatedCara?.autorizacion_dcm || autorizacion_dcm
                }
              : c
          ));
        }
        setEditingCaraId(null);
      } else {
        // Create new cara in database
        const createdCara = await propuestasService.createCara(propuesta.id, caraData);
        // Add to local state with the database ID and authorization status from response
        const newCaraItem: CaraItem = {
          ...newCara,
          id: createdCara.id,
          localId: `cara-${createdCara.id}`,
          costo: costoCalculado,
          autorizacion_dg: createdCara.autorizacion_dg || 'aprobado',
          autorizacion_dcm: createdCara.autorizacion_dcm || 'aprobado',
        };
        setCaras(prev => [...prev, newCaraItem]);
      }

      setNewCara(EMPTY_CARA);
      setSelectedArticulo(null);
      setShowAddCaraForm(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', propuesta.id] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', propuesta.id] });
    } catch (error) {
      console.error('Error saving cara:', error);
      alert('Error al guardar la cara');
    }
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
  // Filter for unique inventories - hide items whose counterpart is already reserved
  const filterUnicos = useCallback((inventarios: InventarioDisponible[]): InventarioDisponible[] => {
    // Get base codes from already reserved items
    const reservedBaseCodes = new Set<string>();
    reservas.forEach(reserva => {
      // Extract base code from the reserved item's codigo_unico
      const baseCode = reserva.codigo_unico?.split('_')[0] || '';
      if (baseCode) {
        reservedBaseCodes.add(baseCode);
      }
    });

    // Filter out items whose base code is already in reservas (counterpart is reserved)
    return inventarios.filter(inv => {
      const baseCode = inv.codigo_unico?.split('_')[0] || '';
      // If any item with this base code is reserved, hide this one
      return !reservedBaseCodes.has(baseCode);
    });
  }, [reservas]);

  // Filter for unique digital inventories - hide digital items whose codigo_unico is already reserved
  const filterUnicosDigitales = useCallback((inventarios: InventarioDisponible[]): InventarioDisponible[] => {
    // Get codigo_unicos that are already reserved (from digital items)
    const reservedCodigosDigitales = new Set<string>();
    reservas.forEach(reserva => {
      if (reserva.codigo_unico) {
        reservedCodigosDigitales.add(reserva.codigo_unico);
      }
    });

    // Filter out digital items whose codigo_unico is already in reservas
    return inventarios.filter(inv => {
      // Only filter digital items
      const isDigital = inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0);
      if (!isDigital) return true; // Keep non-digital items as-is

      // For digital items, exclude if this codigo_unico is already reserved
      return !reservedCodigosDigitales.has(inv.codigo_unico || '');
    });
  }, [reservas]);

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
        inv.nivel_socioeconomico?.toLowerCase().includes(term) ||
        inv.tipo_de_mueble?.toLowerCase().includes(term)
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

    // Apply complete filter (merges pairs into single rows)
    if (showOnlyCompletos) {
      data = filterCompletos(data);
    }

    // Apply unique filter for traditional items (hide items whose counterpart is reserved)
    if (showOnlyUnicos) {
      data = filterUnicos(data);
    }

    // Apply unique digital filter (hide digital items with same codigo_unico in reservas)
    if (showOnlyUnicosDigitales) {
      data = filterUnicosDigitales(data);
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
  }, [inventarioDisponible, disponiblesSearchTerm, poiFilterIds, flujoFilter, showOnlyUnicos, showOnlyCompletos, showOnlyUnicosDigitales, groupByDistance, filterUnicos, filterCompletos, filterUnicosDigitales, groupByDistanceFunc, sortColumn, sortDirection, reservas]);

  // Handle POI filter from map
  const handlePOIFilter = useCallback((idsToKeep: number[]) => {
    setPoiFilterIds(new Set(idsToKeep));
  }, []);

  // Clear POI filter
  const clearPOIFilter = useCallback(() => {
    setPoiFilterIds(null);
  }, []);

  // Check if there are digital items in inventory
  const hasDigitalInventory = useMemo(() => {
    return inventarioDisponible.some(inv =>
      inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0)
    );
  }, [inventarioDisponible]);

  // Check if there are traditional items in inventory
  const hasTradicionalInventory = useMemo(() => {
    return inventarioDisponible.some(inv =>
      inv.tradicional_digital === 'Tradicional' || (!inv.total_espacios || inv.total_espacios === 0)
    );
  }, [inventarioDisponible]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFlujoFilter('Todos');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setShowOnlyUnicosDigitales(false);
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

    setSelectedInventory(new Set(matchingInventory.map(inv => getInventoryKey(inv))));
    setShowCsvSection(false);
  }, [csvData, inventarioDisponible, getInventoryKey]);

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

  // Download disponibles as CSV
  const downloadDisponiblesCSV = () => {
    if (processedInventory.length === 0) return;

    // Determine columns based on active filters
    const baseColumns = ['codigo_unico', 'tipo_de_cara', 'plaza', 'nivel_socioeconomico', 'ubicacion'];
    const headers = ['Código', 'Tipo', 'Plaza', 'NSE', 'Ubicación'];

    // Add group column if groupByDistance is active
    if (groupByDistance && groupedInventory) {
      headers.unshift('Grupo');
      baseColumns.unshift('_group');
    }

    // Build rows with group info if applicable
    const rows: string[][] = [];
    if (groupByDistance && groupedInventory) {
      groupedInventory.forEach(([groupName, items]) => {
        items.forEach(item => {
          const row = baseColumns.map(col => {
            if (col === '_group') return groupName;
            const val = item[col as keyof typeof item];
            return val === null || val === undefined ? '' : String(val);
          });
          rows.push(row);
        });
      });
    } else {
      processedInventory.forEach(item => {
        const row = baseColumns.map(col => {
          const val = item[col as keyof typeof item];
          return val === null || val === undefined ? '' : String(val);
        });
        rows.push(row);
      });
    }

    // Create CSV content
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterInfo = [
      showOnlyUnicosDigitales ? 'unicos_digitales' : '',
      showOnlyCompletos ? 'completos' : '',
      groupByDistance ? 'agrupados' : '',
      flujoFilter !== 'Todos' ? flujoFilter.toLowerCase() : ''
    ].filter(Boolean).join('_') || 'todos';
    link.download = `inventario_disponible_${filterInfo}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
  // Toggle all items in a group - if all selected, deselect all; otherwise select all
  const toggleAllInGroup = (items: ProcessedInventoryItem[]) => {
    const allSelected = items.every(inv => selectedInventory.has(getInventoryKey(inv)));
    setSelectedInventory(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all
        items.forEach(inv => next.delete(getInventoryKey(inv)));
      } else {
        // Select all
        items.forEach(inv => next.add(getInventoryKey(inv)));
      }
      return next;
    });
  };

  // Handle inventory selection (uses unique key for digital items)
  const toggleInventorySelection = (key: string) => {
    setSelectedInventory(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Handle reserve (smart - detects flujo/contraflujo/completo automatically) - IMMEDIATE SAVE
  const handleReservar = () => {
    if (!selectedCaraForSearch || selectedInventory.size === 0) return;

    // Check for pairs that could be grouped
    const selectedItems = processedInventory.filter(i => selectedInventory.has(getInventoryKey(i)));
    const potentialPairs = new Set<string>();

    selectedItems.forEach(item => {
      // If item is already "Completo" (from filtered view), count it as a pair
      if (item.isCompleto && item.flujoId && item.contraflujoId) {
        const baseCode = item.codigo_unico?.split('_')[0];
        if (baseCode) {
          potentialPairs.add(baseCode);
        }
        return;
      }

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
      const newReservas: { inventario_id: number; espacio_id?: number; tipo: string; latitud: number; longitud: number }[] = [];
      let flujoCount = 0;
      let contraflujoCount = 0;

      selectedInventory.forEach(invKey => {
        const inv = processedInventory.find(i => getInventoryKey(i) === invKey);
        if (!inv) return;

        // If it's a "completo" item, reserve both flujo and contraflujo
        if (inv.isCompleto && inv.flujoId && inv.contraflujoId) {
          // Find original items for coordinates
          const flujoOrig = inventarioDisponible.find(i => i.id === inv.flujoId);
          const contraflujoOrig = inventarioDisponible.find(i => i.id === inv.contraflujoId);

          // For "completo" items, BOTH must have space to reserve either
          const canReserveFlujo = flujoOrig && flujoCount < remainingToAssign.flujo;
          const canReserveContraflujo = contraflujoOrig && contraflujoCount < remainingToAssign.contraflujo;

          // Only reserve both if BOTH have space (to keep them paired)
          if (canReserveFlujo && canReserveContraflujo) {
            const isDigitalFlujo = flujoOrig!.tradicional_digital === 'Digital' || (flujoOrig!.total_espacios && flujoOrig!.total_espacios > 0);
            newReservas.push({
              inventario_id: inv.flujoId!,
              espacio_id: isDigitalFlujo && flujoOrig!.espacio_id ? flujoOrig!.espacio_id : undefined,
              tipo: 'Flujo',
              latitud: flujoOrig!.latitud || 0,
              longitud: flujoOrig!.longitud || 0,
            });
            flujoCount++;

            const isDigitalContra = contraflujoOrig!.tradicional_digital === 'Digital' || (contraflujoOrig!.total_espacios && contraflujoOrig!.total_espacios > 0);
            newReservas.push({
              inventario_id: inv.contraflujoId!,
              espacio_id: isDigitalContra && contraflujoOrig!.espacio_id ? contraflujoOrig!.espacio_id : undefined,
              tipo: 'Contraflujo',
              latitud: contraflujoOrig!.latitud || 0,
              longitud: contraflujoOrig!.longitud || 0,
            });
            contraflujoCount++;
          }
          // If only one has space, skip this completo item entirely to maintain pairing
        } else {
          // Regular item - reserve based on tipo_de_cara
          const tipo = inv.tipo_de_cara === 'Flujo' ? 'Flujo' : 'Contraflujo';
          const canReserve = tipo === 'Flujo'
            ? flujoCount < remainingToAssign.flujo
            : contraflujoCount < remainingToAssign.contraflujo;

          if (canReserve) {
            // For digital items, use espacio_id directly; otherwise use inventario_id
            const isDigital = inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0);
            newReservas.push({
              inventario_id: inv.id,
              espacio_id: isDigital && inv.espacio_id ? inv.espacio_id : undefined,
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
        showToast('No hay caras disponibles para reservar', 'error');
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

        showToast(`Se guardaron ${result.reservasCreadas} reservas exitosamente`, 'success');
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving reservas:', error);
        showToast(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
      } finally {
        setIsSaving(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    };

    // Prompt logic - solo mostrar modal de agrupar cuando el filtro COMPLETOS está activo
    if (potentialPairs.size > 0 && showOnlyCompletos) {
      // Count how many "completo" items are selected (each reserves 2 caras)
      const completoCount = selectedItems.filter(i => i.isCompleto).length;
      const regularCount = selectedItems.filter(i => !i.isCompleto).length;
      const totalCaras = (completoCount * 2) + regularCount;

      const message = completoCount > 0
        ? `Se reservarán ${totalCaras} caras (${completoCount} completo${completoCount > 1 ? 's' : ''} = ${completoCount * 2} caras). ¿Agrupar Flujo + Contraflujo como "Completo"?`
        : `Se detectaron ${potentialPairs.size} pares Flujo + Contraflujo del mismo parabús. ¿Deseas agruparlos como "Completo"?`;

      setConfirmModal({
        isOpen: true,
        title: 'Agrupar como Completo',
        message,
        confirmText: 'Sí, Agrupar',
        cancelText: 'No, Mantener Separados',
        onConfirm: () => runReservation(true),
        onCancel: () => runReservation(false)
      });
    } else if (potentialPairs.size > 0 && !showOnlyCompletos) {
      // Hay pares pero NO está activo el filtro completos - reservar sin agrupar directamente
      runReservation(false);
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
      showToast(`Solo puedes reservar ${remainingToAssign.bonificacion} caras de bonificación`, 'error');
      return;
    }

    const runBonificacion = async () => {
      const newReservas: { inventario_id: number; espacio_id?: number; tipo: string; latitud: number; longitud: number }[] = [];
      selectedInventory.forEach(invKey => {
        const inv = processedInventory.find(i => getInventoryKey(i) === invKey);
        if (inv) {
          const isDigital = inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0);
          newReservas.push({
            inventario_id: inv.id,
            espacio_id: isDigital && inv.espacio_id ? inv.espacio_id : undefined,
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

        showToast(`Se guardaron ${result.reservasCreadas} bonificaciones exitosamente`, 'success');
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving bonificaciones:', error);
        showToast(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
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

  // Group reservas by grupo_completo_id - shows pairs as single "Completo" item
  const currentCaraReservasMerged = useMemo(() => {
    const result: ReservaItem[] = [];
    const processedGrupos = new Set<number>();

    currentCaraReservas.forEach(r => {
      // If has grupo_completo_id and not yet processed
      if (r.grupo_completo_id && !processedGrupos.has(r.grupo_completo_id)) {
        // Find all reservas in this group
        const groupReservas = currentCaraReservas.filter(
          res => res.grupo_completo_id === r.grupo_completo_id
        );

        if (groupReservas.length >= 2) {
          // Create merged "Completo" item
          const baseCode = r.codigo_unico?.replace(/_Flujo|_Contraflujo/gi, '') || '';
          result.push({
            ...r,
            id: `completo-${r.grupo_completo_id}`,
            codigo_unico: `${baseCode}_Completo`,
            tipo: 'Flujo' as const, // Use Flujo for color (will show as purple in legend)
            // Store original items count for reference
          });
          processedGrupos.add(r.grupo_completo_id);
        } else {
          // Single item in group, show as-is
          result.push(r);
          processedGrupos.add(r.grupo_completo_id);
        }
      } else if (!r.grupo_completo_id) {
        // No group, show as-is
        result.push(r);
      }
      // If grupo_completo_id already processed, skip (it's the pair)
    });

    return result;
  }, [currentCaraReservas]);

  // Filter reservados by search term and type (uses merged version for display)
  const filteredReservados = useMemo(() => {
    let data = [...currentCaraReservasMerged];

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
  }, [currentCaraReservasMerged, reservadosSearchTerm, reservadosTipoFilter, reservadosSortColumn, reservadosSortDirection]);

  // Group reservados by Catorcena > Artículo > Plaza > Formato (hierarchical)
  const groupedReservadosHierarchy = useMemo(() => {
    type Level4 = ReservaItem[];
    type Level3 = Record<string, Level4>; // Formato -> items
    type Level2 = Record<string, Level3>; // Plaza -> Formato
    type Level1 = Record<string, Level2>; // Artículo -> Plaza
    type Level0 = Record<string, Level1>; // Catorcena -> Artículo

    const hierarchy: Level0 = {};

    filteredReservados.forEach(r => {
      const catorcenaKey = `Cat ${r.catorcena}/${r.anio}`;
      const articuloKey = r.articulo || 'Sin Artículo';
      const plazaKey = r.plaza || 'Sin Plaza';
      const formatoKey = r.formato || 'Sin Formato';

      if (!hierarchy[catorcenaKey]) hierarchy[catorcenaKey] = {};
      if (!hierarchy[catorcenaKey][articuloKey]) hierarchy[catorcenaKey][articuloKey] = {};
      if (!hierarchy[catorcenaKey][articuloKey][plazaKey]) hierarchy[catorcenaKey][articuloKey][plazaKey] = {};
      if (!hierarchy[catorcenaKey][articuloKey][plazaKey][formatoKey]) hierarchy[catorcenaKey][articuloKey][plazaKey][formatoKey] = [];

      hierarchy[catorcenaKey][articuloKey][plazaKey][formatoKey].push(r);
    });

    return hierarchy;
  }, [filteredReservados]);

  // Helper to get type breakdown for reservados tab
  const getReservadosBreakdown = (items: ReservaItem[]) => {
    const flujo = items.filter(r => r.tipo === 'Flujo').length;
    const contraflujo = items.filter(r => r.tipo === 'Contraflujo').length;
    const bonificacion = items.filter(r => r.tipo === 'Bonificacion').length;
    return { flujo, contraflujo, bonificacion, total: items.length };
  };

  // Flatten hierarchy to get all items for a level
  const flattenHierarchy = (data: unknown): ReservaItem[] => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      return Object.values(data).flatMap(v => flattenHierarchy(v));
    }
    return [];
  };

  // Get catorcena keys for iteration
  const catorcenaKeys = useMemo(() => Object.keys(groupedReservadosHierarchy).sort(), [groupedReservadosHierarchy]);

  // Legacy groupedReservados for compatibility (used by toggleAllCiudadGroups)
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
  // Hierarchical expansion state for reservados (uses compound keys: "catorcena|articulo|plaza|formato")
  const [expandedReservadosHierarchy, setExpandedReservadosHierarchy] = useState<Set<string>>(new Set());

  // Toggle ciudad group expansion
  const toggleCiudadGroupExpansion = (ciudad: string) => {
    setExpandedCiudadGroups(prev => {
      const next = new Set(prev);
      if (next.has(ciudad)) next.delete(ciudad);
      else next.add(ciudad);
      return next;
    });
  };

  // Toggle hierarchical expansion for reservados
  const toggleReservadosHierarchy = (key: string) => {
    setExpandedReservadosHierarchy(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle all hierarchical groups
  const toggleAllReservadosHierarchy = () => {
    // Collect all possible keys
    const allKeys: string[] = [];
    Object.entries(groupedReservadosHierarchy).forEach(([catKey, articulos]) => {
      allKeys.push(catKey);
      Object.entries(articulos).forEach(([artKey, plazas]) => {
        allKeys.push(`${catKey}|${artKey}`);
        Object.entries(plazas).forEach(([plzKey, formatos]) => {
          allKeys.push(`${catKey}|${artKey}|${plzKey}`);
          Object.keys(formatos).forEach(fmtKey => {
            allKeys.push(`${catKey}|${artKey}|${plzKey}|${fmtKey}`);
          });
        });
      });
    });

    if (expandedReservadosHierarchy.size >= allKeys.length) {
      setExpandedReservadosHierarchy(new Set());
    } else {
      setExpandedReservadosHierarchy(new Set(allKeys));
    }
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
          showToast('Reserva eliminada correctamente', 'success');
        } catch (error) {
          console.error('Error deleting reserva:', error);
          showToast('Error al eliminar reserva', 'error');
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

  // Bulk delete selected reservas
  const handleBulkDeleteReservas = () => {
    // Get selected reservas
    const selectedReservasList = reservas.filter(r => selectedReservados.has(r.id));
    if (selectedReservasList.length === 0) return;

    // Separate reservas with backend IDs from those without
    const reservasWithBackendId = selectedReservasList.filter(r => r.reservaId);
    const reservasLocalOnly = selectedReservasList.filter(r => !r.reservaId);
    const backendIds = reservasWithBackendId.map(r => r.reservaId!);

    // If all are local-only (not saved to DB yet), just remove from state
    if (backendIds.length === 0) {
      setReservas(prev => prev.filter(r => !selectedReservados.has(r.id)));
      setSelectedReservados(new Set());
      showToast(`${selectedReservasList.length} reservas eliminadas`, 'success');
      return;
    }

    // Show confirmation for backend deletion
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Reservas',
      message: `¿Seguro que quieres eliminar ${selectedReservasList.length} reserva(s)?${reservasLocalOnly.length > 0 ? ` (${reservasLocalOnly.length} pendientes + ${backendIds.length} guardadas)` : ''}`,
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          // Delete from backend if there are any with reservaId
          if (backendIds.length > 0) {
            await propuestasService.deleteReservas(propuesta.id, backendIds);
            queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
            queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] });
            handleRefetchDisponibles();
          }

          // Remove all selected from local state
          setReservas(prev => prev.filter(r => !selectedReservados.has(r.id)));
          setSelectedReservados(new Set());
          showToast(`${selectedReservasList.length} reserva(s) eliminada(s) correctamente`, 'success');
        } catch (error) {
          console.error('Error deleting reservas:', error);
          showToast('Error al eliminar reservas', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
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

  // Toast notification JSX
  const toastJSX = toast.show && (
    <div className={`fixed top-4 right-4 z-[70] animate-in slide-in-from-top fade-in duration-300 max-w-md`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
        toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
        toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
        'bg-purple-500/20 border-purple-500/50 text-purple-300'
      }`}>
        {toast.type === 'success' && <Check className="h-5 w-5 flex-shrink-0" />}
        {toast.type === 'error' && <X className="h-5 w-5 flex-shrink-0" />}
        {toast.type === 'info' && <FileText className="h-5 w-5 flex-shrink-0" />}
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={() => setToast(prev => ({ ...prev, show: false }))}
          className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Render inventory search view
  if (viewState === 'search-inventory') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {confirmModalJSX}
        {toastJSX}
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

                  {/* Unique filter for traditional items - only show when there are traditional items */}
                  {hasTradicionalInventory && (
                    <button
                      onClick={() => { setShowOnlyUnicos(!showOnlyUnicos); if (!showOnlyUnicos) setShowOnlyCompletos(false); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyUnicos
                        ? 'bg-cyan-500 text-white shadow'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                        }`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Únicos
                      {showOnlyUnicos && (
                        <X className="h-3 w-3 ml-0.5 hover:text-cyan-200" onClick={(e) => { e.stopPropagation(); setShowOnlyUnicos(false); }} />
                      )}
                    </button>
                  )}

                  {/* Unique digital filter - only show when there are digital items */}
                  {hasDigitalInventory && (
                    <button
                      onClick={() => setShowOnlyUnicosDigitales(!showOnlyUnicosDigitales)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyUnicosDigitales
                        ? 'bg-orange-500 text-white shadow'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                        }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Únicos Digitales
                      {showOnlyUnicosDigitales && (
                        <X className="h-3 w-3 ml-0.5 hover:text-orange-200" onClick={(e) => { e.stopPropagation(); setShowOnlyUnicosDigitales(false); }} />
                      )}
                    </button>
                  )}

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
                    {(flujoFilter !== 'Todos' || showOnlyCompletos || showOnlyUnicos || showOnlyUnicosDigitales || groupByDistance || poiFilterIds !== null || disponiblesSearchTerm) && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Limpiar
                      </button>
                    )}

                    {/* Download CSV */}
                    <button
                      onClick={downloadDisponiblesCSV}
                      disabled={processedInventory.length === 0}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                      title="Descargar CSV"
                    >
                      <Download className="h-4 w-4" />
                    </button>

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
                                    setSelectedInventory(new Set(processedInventory.map(i => getInventoryKey(i))));
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
                            {hasDigitalInventory && (
                              <th className="px-3 py-2 text-left text-xs text-zinc-400 font-medium">
                                Espacio
                              </th>
                            )}
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
                                  <td colSpan={hasDigitalInventory ? 7 : 6} className="px-3 py-2">
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
                                          toggleAllInGroup(items);
                                        }}
                                        className="ml-auto text-xs text-purple-400 hover:text-purple-300"
                                      >
                                        {items.every(inv => selectedInventory.has(getInventoryKey(inv))) ? 'Deseleccionar' : 'Seleccionar todos'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {/* Group Items */}
                                {expandedGroups.has(groupName) && items.map((inv) => (
                                  <tr
                                    key={getInventoryKey(inv)}
                                    onClick={() => toggleInventorySelection(getInventoryKey(inv))}
                                    className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedInventory.has(getInventoryKey(inv))
                                      ? 'bg-purple-500/10'
                                      : inv.ya_reservado_para_cara
                                        ? 'bg-green-500/5'
                                        : 'hover:bg-zinc-800/30'
                                      }`}
                                  >
                                    <td className="px-3 py-2 pl-8">
                                      <input
                                        type="checkbox"
                                        checked={selectedInventory.has(getInventoryKey(inv))}
                                        onChange={() => toggleInventorySelection(getInventoryKey(inv))}
                                        onClick={(e) => e.stopPropagation()}
                                        className="checkbox-purple"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{inv.codigo_unico}</td>
                                    {hasDigitalInventory && (
                                      <td className="px-3 py-2 text-zinc-400 text-xs">
                                        {inv.numero_espacio && inv.total_espacios ? (
                                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs">
                                            {inv.numero_espacio} de {inv.total_espacios}
                                          </span>
                                        ) : '-'}
                                      </td>
                                    )}
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
                                key={getInventoryKey(inv)}
                                onClick={() => toggleInventorySelection(getInventoryKey(inv))}
                                className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedInventory.has(getInventoryKey(inv))
                                  ? 'bg-purple-500/10'
                                  : inv.ya_reservado_para_cara
                                    ? 'bg-green-500/5'
                                    : 'hover:bg-zinc-800/30'
                                  }`}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedInventory.has(getInventoryKey(inv))}
                                    onChange={() => toggleInventorySelection(getInventoryKey(inv))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="checkbox-purple"
                                  />
                                </td>
                                <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{inv.codigo_unico}</td>
                                {hasDigitalInventory && (
                                  <td className="px-3 py-2 text-zinc-400 text-xs">
                                    {inv.numero_espacio && inv.total_espacios ? (
                                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs">
                                        {inv.numero_espacio} de {inv.total_espacios}
                                      </span>
                                    ) : '-'}
                                  </td>
                                )}
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
                      selectedInventory={new Set(Array.from(selectedInventory).map(key => parseInt(key.split('_')[0])))}
                      onToggleSelection={(id: number) => {
                        const inv = processedInventory.find(i => i.id === id);
                        if (inv) toggleInventorySelection(getInventoryKey(inv));
                      }}
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
                    {effectiveCanEdit && selectedReservados.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded-full">
                          {selectedReservados.size} seleccionados
                        </span>
                        <button
                          onClick={handleBulkDeleteReservas}
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
                      onClick={toggleAllReservadosHierarchy}
                      className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {expandedReservadosHierarchy.size > 0 ? (
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
                          {effectiveCanEdit && <th className="px-4 py-3 text-center text-xs text-zinc-400 font-medium">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Hierarchical: Catorcena > Artículo > Plaza > Formato */}
                        {catorcenaKeys.map((catKey) => {
                          const catItems = flattenHierarchy(groupedReservadosHierarchy[catKey]);
                          const catBreakdown = getReservadosBreakdown(catItems);
                          const catExpanded = expandedReservadosHierarchy.has(catKey);

                          return (
                            <React.Fragment key={catKey}>
                              {/* Level 0: Catorcena Header */}
                              <tr
                                className="bg-zinc-800/90 cursor-pointer hover:bg-zinc-800"
                                onClick={() => toggleReservadosHierarchy(catKey)}
                              >
                                <td colSpan={6} className="px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    {catExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-purple-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-purple-400" />
                                    )}
                                    <Calendar className="h-4 w-4 text-purple-400" />
                                    <span className="text-sm font-semibold text-white">{catKey}</span>
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                      {catBreakdown.total} caras
                                    </span>
                                    <div className="flex gap-1 ml-2">
                                      {catBreakdown.flujo > 0 && (
                                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                          F:{catBreakdown.flujo}
                                        </span>
                                      )}
                                      {catBreakdown.contraflujo > 0 && (
                                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                                          C:{catBreakdown.contraflujo}
                                        </span>
                                      )}
                                      {catBreakdown.bonificacion > 0 && (
                                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">
                                          B:{catBreakdown.bonificacion}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {/* Level 1: Artículos */}
                              {catExpanded && Object.entries(groupedReservadosHierarchy[catKey]).map(([artKey, plazas]) => {
                                const artKeyFull = `${catKey}|${artKey}`;
                                const artItems = flattenHierarchy(plazas);
                                const artBreakdown = getReservadosBreakdown(artItems);
                                const artExpanded = expandedReservadosHierarchy.has(artKeyFull);

                                return (
                                  <React.Fragment key={artKeyFull}>
                                    <tr
                                      className="bg-zinc-800/60 cursor-pointer hover:bg-zinc-800/80"
                                      onClick={() => toggleReservadosHierarchy(artKeyFull)}
                                    >
                                      <td colSpan={6} className="px-3 py-2 pl-8">
                                        <div className="flex items-center gap-3">
                                          {artExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-indigo-400" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-indigo-400" />
                                          )}
                                          <Package className="h-4 w-4 text-indigo-400" />
                                          <span className="text-sm font-medium text-zinc-200">{artKey}</span>
                                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-xs">
                                            {artBreakdown.total}
                                          </span>
                                          <div className="flex gap-1 ml-1">
                                            {artBreakdown.flujo > 0 && (
                                              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                                F:{artBreakdown.flujo}
                                              </span>
                                            )}
                                            {artBreakdown.contraflujo > 0 && (
                                              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                                                C:{artBreakdown.contraflujo}
                                              </span>
                                            )}
                                            {artBreakdown.bonificacion > 0 && (
                                              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">
                                                B:{artBreakdown.bonificacion}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Level 2: Plazas */}
                                    {artExpanded && Object.entries(plazas).map(([plzKey, formatos]) => {
                                      const plzKeyFull = `${artKeyFull}|${plzKey}`;
                                      const plzItems = flattenHierarchy(formatos);
                                      const plzBreakdown = getReservadosBreakdown(plzItems);
                                      const plzExpanded = expandedReservadosHierarchy.has(plzKeyFull);

                                      return (
                                        <React.Fragment key={plzKeyFull}>
                                          <tr
                                            className="bg-zinc-800/40 cursor-pointer hover:bg-zinc-800/60"
                                            onClick={() => toggleReservadosHierarchy(plzKeyFull)}
                                          >
                                            <td colSpan={6} className="px-3 py-2 pl-14">
                                              <div className="flex items-center gap-3">
                                                {plzExpanded ? (
                                                  <ChevronDown className="h-4 w-4 text-cyan-400" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4 text-cyan-400" />
                                                )}
                                                <MapPin className="h-4 w-4 text-cyan-400" />
                                                <span className="text-sm text-zinc-300">{plzKey}</span>
                                                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">
                                                  {plzBreakdown.total}
                                                </span>
                                                <div className="flex gap-1 ml-1">
                                                  {plzBreakdown.flujo > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                                      F:{plzBreakdown.flujo}
                                                    </span>
                                                  )}
                                                  {plzBreakdown.contraflujo > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                                                      C:{plzBreakdown.contraflujo}
                                                    </span>
                                                  )}
                                                  {plzBreakdown.bonificacion > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">
                                                      B:{plzBreakdown.bonificacion}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>

                                          {/* Level 3: Formatos */}
                                          {plzExpanded && Object.entries(formatos).map(([fmtKey, items]) => {
                                            const fmtKeyFull = `${plzKeyFull}|${fmtKey}`;
                                            const fmtBreakdown = getReservadosBreakdown(items);
                                            const fmtExpanded = expandedReservadosHierarchy.has(fmtKeyFull);

                                            return (
                                              <React.Fragment key={fmtKeyFull}>
                                                <tr
                                                  className="bg-zinc-800/20 cursor-pointer hover:bg-zinc-800/40"
                                                  onClick={() => toggleReservadosHierarchy(fmtKeyFull)}
                                                >
                                                  <td colSpan={6} className="px-3 py-2 pl-20">
                                                    <div className="flex items-center gap-3">
                                                      {fmtExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                                                      ) : (
                                                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                                                      )}
                                                      <LayoutGrid className="h-4 w-4 text-zinc-500" />
                                                      <span className="text-sm text-zinc-400">{fmtKey}</span>
                                                      <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded-full text-xs">
                                                        {fmtBreakdown.total}
                                                      </span>
                                                      <div className="flex gap-1 ml-1">
                                                        {fmtBreakdown.flujo > 0 && (
                                                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">
                                                            F:{fmtBreakdown.flujo}
                                                          </span>
                                                        )}
                                                        {fmtBreakdown.contraflujo > 0 && (
                                                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                                                            C:{fmtBreakdown.contraflujo}
                                                          </span>
                                                        )}
                                                        {fmtBreakdown.bonificacion > 0 && (
                                                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">
                                                            B:{fmtBreakdown.bonificacion}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </td>
                                                </tr>

                                                {/* Individual items */}
                                                {fmtExpanded && items.map((reserva) => (
                                                  <tr
                                                    key={reserva.id}
                                                    onClick={() => handleToggleReservadoSelection(reserva.id)}
                                                    className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${selectedReservados.has(reserva.id) ? 'bg-purple-500/10' : 'hover:bg-zinc-800/30'}`}
                                                  >
                                                    <td className="px-3 py-3 pl-24 text-center" onClick={(e) => e.stopPropagation()}>
                                                      <input
                                                        type="checkbox"
                                                        checked={selectedReservados.has(reserva.id)}
                                                        onChange={() => handleToggleReservadoSelection(reserva.id)}
                                                        className="checkbox-purple"
                                                      />
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-300 font-mono text-sm">{reserva.codigo_unico}</td>
                                                    <td className="px-4 py-3">
                                                      {reserva.codigo_unico?.includes('_Completo') ? (
                                                        <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300">
                                                          Completo
                                                        </span>
                                                      ) : (
                                                        <span className={`px-2 py-1 rounded-full text-xs ${reserva.tipo === 'Flujo'
                                                          ? 'bg-blue-500/20 text-blue-300'
                                                          : reserva.tipo === 'Bonificacion'
                                                            ? 'bg-emerald-500/20 text-emerald-300'
                                                            : 'bg-amber-500/20 text-amber-300'
                                                          }`}>
                                                          {reserva.tipo}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-300">{reserva.formato || '-'}</td>
                                                    <td className="px-4 py-3 text-zinc-400 text-sm" title={reserva.ubicacion || ''}>
                                                      {reserva.ubicacion || '-'}
                                                    </td>
                                                    {effectiveCanEdit && (
                                                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                          onClick={() => handleRemoveReserva(reserva.id)}
                                                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                          title="Quitar reserva"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </button>
                                                      </td>
                                                    )}
                                                  </tr>
                                                ))}
                                              </React.Fragment>
                                            );
                                          })}
                                        </React.Fragment>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
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
                        Total: <span className="text-white font-medium">{currentCaraReservasMerged.length}</span> reservados
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Map of Reservados */}
              <div className="w-1/2 relative">
                {mapsLoaded ? (
                  <>
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={reservadosMapCenter}
                      zoom={13}
                      options={{
                        styles: DARK_MAP_STYLES,
                        disableDefaultUI: true,
                        zoomControl: true,
                      }}
                      onLoad={(map) => {
                        reservadosMapRef.current = map;
                        // Fit bounds to all reservations
                        if (currentCaraReservas.length > 0) {
                          const bounds = new google.maps.LatLngBounds();
                          currentCaraReservas.forEach(r => {
                            if (r.latitud && r.longitud) {
                              bounds.extend({ lat: r.latitud, lng: r.longitud });
                            }
                          });
                          if (!bounds.isEmpty()) {
                            map.fitBounds(bounds, 50);
                          }
                        }
                      }}
                    >
                      {currentCaraReservasMerged.map(reserva => (
                        reserva.latitud && reserva.longitud && (
                          <Marker
                            key={reserva.id}
                            position={{ lat: reserva.latitud, lng: reserva.longitud }}
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
                              scale: 10,
                              fillColor: reserva.codigo_unico?.includes('_Completo')
                                ? '#a855f7' // Purple for Completo
                                : reserva.tipo === 'Flujo' ? '#3b82f6' : reserva.tipo === 'Bonificacion' ? '#10b981' : '#f59e0b',
                              fillOpacity: 0.9,
                              strokeColor: '#fff',
                              strokeWeight: 2,
                            }}
                            title={`${reserva.codigo_unico} - ${reserva.codigo_unico?.includes('_Completo') ? 'Completo' : reserva.tipo}`}
                          />
                        )
                      ))}
                    </GoogleMap>

                    {/* Map Legend */}
                    <div className="absolute bottom-4 right-3 z-10 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 text-xs max-w-[200px]">
                      <div className="text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-purple-400" />
                        Leyenda del Mapa
                      </div>

                      {/* Dirección del tráfico */}
                      <div className="space-y-1.5 mb-2">
                        <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Dirección del tráfico</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 ring-1 ring-blue-400/30" />
                          <div>
                            <span className="text-zinc-300">Flujo</span>
                            <span className="text-zinc-500 text-[10px] ml-1">(a favor)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500 ring-1 ring-amber-400/30" />
                          <div>
                            <span className="text-zinc-300">Contraflujo</span>
                            <span className="text-zinc-500 text-[10px] ml-1">(en contra)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500 ring-1 ring-purple-400/30" />
                          <div>
                            <span className="text-zinc-300">Completo</span>
                            <span className="text-zinc-500 text-[10px] ml-1">(F+C)</span>
                          </div>
                        </div>
                      </div>

                      {/* Estado */}
                      <div className="border-t border-zinc-700/70 pt-2 space-y-1.5">
                        <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Estado</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 ring-1 ring-emerald-400/30" />
                          <div>
                            <span className="text-zinc-300">Bonificación</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
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
                        onChange={(e) => canEditResumen && setNombreCampania(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Nombre de la campaña"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500">Asignados</label>
                      {/* Add user button */}
                      {canEditResumen ? (
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
                      ) : null}
                      {/* Selected users tags */}
                      {asignados.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {asignados.map(user => (
                            <span
                              key={user.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs"
                            >
                              {user.nombre}
                              {canEditResumen && (
                                <button
                                  onClick={() => setAsignados(prev => prev.filter(u => u.id !== user.id))}
                                  className="hover:text-white"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {!canEditResumen && asignados.length === 0 && (
                        <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-400 border border-zinc-700/30">
                          Sin asignados
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
                        onChange={(e) => canEditResumen && (setYearInicio(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaInicio(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                        onChange={(e) => canEditResumen && setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearInicio}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
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
                        onChange={(e) => canEditResumen && (setYearFin(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaFin(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                        onChange={(e) => canEditResumen && setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearFin}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
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
                        onChange={(e) => canEditResumen && setNotas(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Descripción</label>
                      <textarea
                        value={descripcion}
                        onChange={(e) => canEditResumen && setDescripcion(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                      <div className="flex items-center gap-3 p-3 bg-zinc-800 border border-emerald-500/30 rounded-xl">
                        {/* Preview - image or file icon */}
                        {tipoArchivoPropuesta?.startsWith('image/') ? (
                          <a
                            href={archivoPropuesta}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={archivoPropuesta}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ) : (
                          <a
                            href={archivoPropuesta}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 flex items-center justify-center bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
                          >
                            <FileText className="h-6 w-6 text-zinc-400" />
                          </a>
                        )}
                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-emerald-400 font-medium">Archivo adjunto</div>
                          <div className="text-xs text-zinc-500 truncate">{tipoArchivoPropuesta || 'Archivo'}</div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <a
                            href={archivoPropuesta}
                            download
                            className="p-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          {canEditResumen && (
                            <>
                              <button
                                type="button"
                                onClick={() => archivoInputRef.current?.click()}
                                className="px-3 py-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                              >
                                Cambiar
                              </button>
                              <button
                                type="button"
                                onClick={() => { setArchivoPropuesta(null); setTipoArchivoPropuesta(null); }}
                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : canEditResumen ? (
                      <button
                        type="button"
                        onClick={() => archivoInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-xl text-zinc-400 hover:text-violet-300 transition-colors"
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-sm">Seleccionar archivo</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-700/50 rounded-xl text-zinc-500">
                        <span className="text-sm">Sin archivo adjunto</span>
                      </div>
                    )}
                  </div>

                  {/* Update button */}
                  {canEditResumen && (
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
                  )}
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
                    {effectiveCanEdit && canEditResumen && (
                      <button
                        onClick={() => { setShowAddCaraForm(true); setEditingCaraId(null); setNewCara(EMPTY_CARA); setSelectedArticulo(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar Cara
                      </button>
                    )}
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
                      <label className={`text-xs mb-1 block ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : 'text-zinc-500'}`}>Artículo SAP</label>
                      {canEditResumen && !editingCaraHasReservas && !editingCaraId ? (
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
                              // Si ciudadEstado existe, usar su ciudad (incluso si es vacía para CDMX)
                              ciudad: ciudadEstado ? ciudadEstado.ciudad : newCara.ciudad,
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
                      ) : (
                        <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300">
                          {selectedArticulo ? `${selectedArticulo.ItemCode} - ${selectedArticulo.ItemName}` : newCara.articulo || 'Sin artículo'}
                        </div>
                      )}
                    </div>

                    {/* Catorcena - solo una, filtrada por rango de propuesta */}
                    <div className="mb-4">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">
                          Catorcena {editingCaraHasReservas && <span className="text-amber-400 text-[10px]">(bloqueado)</span>}
                          {propuesta.catorcena_inicio && propuesta.anio_inicio && propuesta.catorcena_fin && propuesta.anio_fin && (
                            <span className="text-zinc-600 ml-1">
                              (Rango: {propuesta.catorcena_inicio}/{propuesta.anio_inicio} - {propuesta.catorcena_fin}/{propuesta.anio_fin})
                            </span>
                          )}
                        </label>
                        <select
                          value={newCara.catorcena_inicio && newCara.anio_inicio ? `${newCara.anio_inicio}-${newCara.catorcena_inicio}` : ''}
                          onChange={(e) => {
                            if (!canEditResumen || editingCaraHasReservas) return;
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
                          disabled={!canEditResumen || editingCaraHasReservas}
                          className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                        <label className={`text-xs ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : 'text-zinc-500'}`}>Estados {newCara.estados && !editingCaraId && <span className="text-purple-400">({newCara.estados.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && !editingCaraHasReservas && !editingCaraId ? (
                          <MultiSelectDropdown
                            options={solicitudFilters?.estados || []}
                            selected={newCara.estados ? newCara.estados.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setNewCara({ ...newCara, estados: selected.join(', '), ciudad: '' })}
                            placeholder="Seleccionar estados..."
                          />
                        ) : (
                          <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300 truncate">
                            {newCara.estados || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : 'text-zinc-500'}`}>Ciudades {newCara.ciudad && !editingCaraId && <span className="text-purple-400">({newCara.ciudad.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && !editingCaraHasReservas && !editingCaraId ? (
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
                        ) : (
                          <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300 truncate">
                            {newCara.ciudad || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : 'text-zinc-500'}`}>Formatos {newCara.formato && !editingCaraId && <span className="text-purple-400">({newCara.formato.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && !editingCaraHasReservas && !editingCaraId ? (
                          <MultiSelectDropdown
                            options={solicitudFilters?.formatos || []}
                            selected={newCara.formato ? newCara.formato.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setNewCara({ ...newCara, formato: selected.join(', ') })}
                            placeholder="Seleccionar formatos..."
                          />
                        ) : (
                          <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300 truncate">
                            {newCara.formato || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : 'text-zinc-500'}`}>Tipo</label>
                        <select
                          value={newCara.tipo}
                          onChange={(e) => canEditResumen && !editingCaraHasReservas && !editingCaraId && setNewCara({ ...newCara, tipo: e.target.value })}
                          disabled={!canEditResumen || editingCaraHasReservas || !!editingCaraId}
                          className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas || editingCaraId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">Seleccionar</option>
                          <option value="Tradicional">Tradicional</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${editingCaraHasReservas ? 'text-zinc-800' : 'text-zinc-500'}`}>Caras en Renta</label>
                        <input
                          type="number"
                          value={newCara.caras || ''}
                          onChange={(e) => {
                            if (!canEditResumen || editingCaraHasReservas) return;
                            const val = parseInt(e.target.value) || 0;
                            // Auto-calculate flujo and contraflujo (half and half)
                            const flujo = Math.ceil(val / 2);
                            const contraflujo = Math.floor(val / 2);
                            setNewCara({ ...newCara, caras: val, caras_flujo: flujo, caras_contraflujo: contraflujo });
                          }}
                          disabled={!canEditResumen || editingCaraHasReservas}
                          className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                        <span className="text-[10px] text-zinc-600">Flujo: {newCara.caras_flujo || 0} | Contraflujo: {newCara.caras_contraflujo || 0}</span>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${editingCaraHasReservas ? 'text-zinc-800' : 'text-zinc-500'}`}>Caras Bonificadas</label>
                        <input
                          type="number"
                          value={newCara.bonificacion || ''}
                          onChange={(e) => canEditResumen && !editingCaraHasReservas && setNewCara({ ...newCara, bonificacion: parseInt(e.target.value) || 0 })}
                          disabled={!canEditResumen || editingCaraHasReservas}
                          className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${editingCaraHasReservas ? 'text-zinc-800' : 'text-zinc-500'}`}>Tarifa Pública</label>
                        <input
                          type="number"
                          value={newCara.tarifa_publica || ''}
                          onChange={(e) => canEditResumen && !editingCaraHasReservas && setNewCara({ ...newCara, tarifa_publica: parseFloat(e.target.value) || 0 })}
                          disabled={!canEditResumen || editingCaraHasReservas}
                          className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
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

                    {/* Preview calculation - Resumen y cálculos */}
                    {(newCara.caras || 0) > 0 && (newCara.tarifa_publica || 0) > 0 && (
                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Inversión (Tarifa Cliente):</span>
                          <span className="text-zinc-300">
                            {newCara.caras} caras × {formatCurrency(newCara.tarifa_publica)} = <span className="text-emerald-400 font-medium">{formatCurrency((newCara.caras || 0) * (newCara.tarifa_publica || 0))}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Caras Totales:</span>
                          <span className="text-zinc-300">
                            {newCara.caras || 0} caras + {newCara.bonificacion || 0} bonif. = <span className="text-blue-400 font-medium">{(newCara.caras || 0) + (newCara.bonificacion || 0)} caras totales</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Tarifa Efectiva:</span>
                          <span className="text-zinc-300">
                            {formatCurrency((newCara.caras || 0) * (newCara.tarifa_publica || 0))} ÷ {(newCara.caras || 0) + (newCara.bonificacion || 0)} = <span className="text-purple-400 font-medium">{formatCurrency(((newCara.caras || 0) + (newCara.bonificacion || 0)) > 0 ? ((newCara.caras || 0) * (newCara.tarifa_publica || 0)) / ((newCara.caras || 0) + (newCara.bonificacion || 0)) : 0)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
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
                      {effectiveCanEdit && canEditResumen && (
                        <button
                          onClick={() => setShowAddCaraForm(true)}
                          className="mt-3 text-purple-400 hover:text-purple-300 text-sm"
                        >
                          Agregar primera cara
                        </button>
                      )}
                    </div>
                  ) : (
                    carasGroupedByCatorcena.map(([periodo, groupData]) => {
                      const isCatorcenaExpanded = expandedCatorcenas.has(periodo);
                      const catorcenaLabel = groupData.catorcenaNum
                        ? `Catorcena #${groupData.catorcenaNum}${groupData.year ? ` - ${groupData.year}` : ''}`
                        : `Periodo: ${new Date(periodo).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;

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
                            // Green = complete (reservado >= requerido), Amber = incomplete (reservado < requerido)
                            const statusColor = status.isComplete ? 'emerald' : 'amber';

                            // Display text for diff:
                            // - Missing (totalDiff < 0): show "faltan X"
                            // - Excess (totalDiff > 0): show "quitar X"
                            const diffDisplay = status.totalDiff === 0
                              ? null
                              : status.totalDiff > 0
                                ? `quitar ${status.totalDiff}`
                                : `faltan ${Math.abs(status.totalDiff)}`;

                            return (
                              <div key={cara.localId} className={`${statusColor === 'emerald' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                                {/* Cara row */}
                                <div className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                                  {/* Completion indicator */}
                                  <div className={`w-2 h-2 rounded-full ${
                                    statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                  }`} />

                                  <div className="flex-1 grid grid-cols-6 gap-3 text-sm">
                                    <div>
                                      <span className="text-zinc-500 text-xs">Formato</span>
                                      <p className="text-white font-medium">{cara.formato || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Tipo</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                        {cara.tipo || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Ciudad</span>
                                      <p className="text-zinc-300 text-xs truncate" title={cara.ciudad || cara.estados}>{cara.ciudad || cara.estados || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Artículo</span>
                                      <p className="text-zinc-300 text-xs">{cara.articulo || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Caras</span>
                                      <div className="flex items-center gap-1">
                                        <p className="text-white font-medium">{status.totalReservado}/{totalCaras}</p>
                                        {diffDisplay && (
                                          <span className={`text-xs font-medium ${status.totalDiff > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                            ({diffDisplay})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-zinc-500 text-xs">Autorización</span>
                                      <div className="flex flex-col gap-0.5">
                                        {cara.autorizacion_dg === 'aprobado' && cara.autorizacion_dcm === 'aprobado' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Aprobado</span>
                                        )}
                                        {(cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado') && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-400">Rechazado</span>
                                        )}
                                        {cara.autorizacion_dg === 'pendiente' && cara.autorizacion_dg !== 'rechazado' && cara.autorizacion_dcm !== 'rechazado' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Pend. DG</span>
                                        )}
                                        {cara.autorizacion_dcm === 'pendiente' && cara.autorizacion_dg !== 'rechazado' && cara.autorizacion_dcm !== 'rechazado' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Pend. DCM</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Botón Buscar Inventario - deshabilitado si hay autorizaciones pendientes */}
                                    {effectiveCanEdit && permissions.canBuscarInventarioEnModal && (() => {
                                      const tienePendientes = cara.autorizacion_dg === 'pendiente' || cara.autorizacion_dcm === 'pendiente';
                                      const tieneRechazado = cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado';
                                      const bloqueado = tienePendientes || tieneRechazado;

                                      return (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (!bloqueado) handleSearchInventory(cara); }}
                                          disabled={bloqueado}
                                          className={`p-2 rounded-lg border transition-colors ${
                                            bloqueado
                                              ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed'
                                              : status.isComplete
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                          }`}
                                          title={
                                            tieneRechazado ? 'Cara rechazada - no se puede asignar inventario' :
                                            tienePendientes ? 'Esta cara necesita autorización antes de asignar inventario' :
                                            status.isComplete ? 'Completo - clic para modificar' : 'Buscar inventario'
                                          }
                                        >
                                          <Search className="h-4 w-4" />
                                        </button>
                                      );
                                    })()}
                                    {effectiveCanEdit && (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleEditCara(cara); }}
                                          className="p-2 rounded-lg border transition-colors bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                          title="Editar"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                        {canEditResumen && (
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
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 3: Reservas Summary with Map and Selection - ADVANCED FILTERS */}
              {reservas.length > 0 && (() => {
                // Use filtered data from useMemo
                const filteredReservas = filteredReservasData;

                // Helper to get group key based on field
                const getFieldValue = (r: ReservaItem, field: GroupByFieldReservas): string => {
                  switch (field) {
                    case 'catorcena': return `Cat ${r.catorcena}/${r.anio}`;
                    case 'tipo': return r.tipo;
                    case 'plaza': return r.plaza || 'Sin Plaza';
                    case 'formato': return r.formato || 'Sin Formato';
                    case 'grupo': return r.grupo_completo_id ? `Grupo ${r.grupo_completo_id}` : 'Sin Grupo';
                    case 'articulo': return r.articulo || 'Sin Artículo';
                    default: return 'Otros';
                  }
                };

                // Multi-level grouping
                type GroupedData = Record<string, ReservaItem[] | Record<string, ReservaItem[] | Record<string, ReservaItem[]>>>;
                const groupData = (items: ReservaItem[], fields: GroupByFieldReservas[]): GroupedData => {
                  if (fields.length === 0) return {};
                  const [firstField, ...restFields] = fields;
                  const grouped: GroupedData = {};
                  items.forEach(item => {
                    const key = getFieldValue(item, firstField);
                    if (!grouped[key]) grouped[key] = restFields.length > 0 ? {} : [];
                    if (restFields.length > 0) {
                      const subGrouped = groupData([item], restFields);
                      Object.entries(subGrouped).forEach(([subKey, subItems]) => {
                        const target = grouped[key] as Record<string, ReservaItem[] | Record<string, ReservaItem[]>>;
                        if (!target[subKey]) target[subKey] = Array.isArray(subItems) ? [] : {};
                        if (Array.isArray(subItems)) {
                          (target[subKey] as ReservaItem[]).push(...subItems);
                        } else {
                          Object.entries(subItems).forEach(([thirdKey, thirdItems]) => {
                            const thirdTarget = target[subKey] as Record<string, ReservaItem[]>;
                            if (!thirdTarget[thirdKey]) thirdTarget[thirdKey] = [];
                            thirdTarget[thirdKey].push(...(thirdItems as ReservaItem[]));
                          });
                        }
                      });
                    } else {
                      (grouped[key] as ReservaItem[]).push(item);
                    }
                  });
                  return grouped;
                };

                const groupedReservas = groupData(filteredReservas, activeGroupingsReservas);
                const groupKeys = Object.keys(groupedReservas).sort();

                // Count items recursively
                const countItems = (data: unknown): number => {
                  if (Array.isArray(data)) return data.length;
                  if (typeof data === 'object' && data !== null) {
                    return Object.values(data).reduce((sum, v) => sum + countItems(v), 0);
                  }
                  return 0;
                };

                // Toggle functions
                const toggleAllMapReservas = () => {
                  if (selectedMapReservas.size === filteredReservas.length) {
                    setSelectedMapReservas(new Set());
                  } else {
                    setSelectedMapReservas(new Set(filteredReservas.map(r => r.id)));
                  }
                };
                const toggleGroupItems = (items: ReservaItem[]) => {
                  const ids = items.map(r => r.id);
                  const allSelected = ids.every(id => selectedMapReservas.has(id));
                  setSelectedMapReservas(prev => {
                    const next = new Set(prev);
                    if (allSelected) ids.forEach(id => next.delete(id));
                    else ids.forEach(id => next.add(id));
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
                const toggleReservasGroup = (groupKey: string) => {
                  setExpandedReservasGroups(prev => {
                    const next = new Set(prev);
                    if (next.has(groupKey)) next.delete(groupKey);
                    else next.add(groupKey);
                    return next;
                  });
                };

                // Flatten all items for a group
                const flattenItems = (data: unknown): ReservaItem[] => {
                  if (Array.isArray(data)) return data;
                  if (typeof data === 'object' && data !== null) {
                    return Object.values(data).flatMap(v => flattenItems(v));
                  }
                  return [];
                };

                // Get type breakdown for a group of items
                const getTypeBreakdown = (items: ReservaItem[]) => {
                  const flujo = items.filter(r => r.tipo === 'Flujo').length;
                  const contraflujo = items.filter(r => r.tipo === 'Contraflujo').length;
                  const bonificacion = items.filter(r => r.tipo === 'Bonificacion').length;
                  return { flujo, contraflujo, bonificacion, total: items.length };
                };

                // Render type breakdown badges
                const TypeBreakdownBadges = ({ items }: { items: ReservaItem[] }) => {
                  const breakdown = getTypeBreakdown(items);
                  return (
                    <div className="flex items-center gap-1">
                      {breakdown.flujo > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          F:{breakdown.flujo}
                        </span>
                      )}
                      {breakdown.contraflujo > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          C:{breakdown.contraflujo}
                        </span>
                      )}
                      {breakdown.bonificacion > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          B:{breakdown.bonificacion}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-700/50 text-zinc-300">
                        {breakdown.total}
                      </span>
                    </div>
                  );
                };

                return (
                  <div className="bg-zinc-800/30 rounded-2xl border border-zinc-700/50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-700/50 bg-zinc-800/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-purple-400" />
                        Resumen de Reservas
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                          {filteredReservas.length} de {reservasMerged.length}
                        </span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* ADVANCED FILTER BUTTON */}
                        <div className="relative">
                          <button
                            onClick={() => { setShowFiltersReservas(!showFiltersReservas); setShowGroupingConfigReservas(false); setShowSortReservas(false); }}
                            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                              filtersReservas.length > 0
                                ? 'bg-purple-600 text-white border border-purple-500'
                                : 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30'
                            }`}
                            title="Filtrar"
                          >
                            <Filter className="h-3.5 w-3.5" />
                            {filtersReservas.length > 0 && (
                              <span className="px-1 py-0.5 rounded bg-purple-800 text-[10px]">{filtersReservas.length}</span>
                            )}
                          </button>
                          {showFiltersReservas && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-[520px] bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-purple-300">Filtros de búsqueda</span>
                                <button onClick={() => setShowFiltersReservas(false)} className="text-zinc-400 hover:text-white">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-purple pr-1">
                                {filtersReservas.map((filter, index) => (
                                  <div key={filter.id} className="flex items-center gap-2">
                                    {index > 0 && <span className="text-[10px] text-purple-400 font-medium w-8">AND</span>}
                                    {index === 0 && <span className="w-8"></span>}
                                    <select
                                      value={filter.field}
                                      onChange={(e) => updateFilterReservas(filter.id, { field: e.target.value })}
                                      className="w-[130px] text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                                    >
                                      {FILTER_FIELDS_RESERVAS.map((f) => (
                                        <option key={f.field} value={f.field}>{f.label}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={filter.operator}
                                      onChange={(e) => updateFilterReservas(filter.id, { operator: e.target.value as FilterOperator })}
                                      className="w-[110px] text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                                    >
                                      {FILTER_OPERATORS.filter(op => {
                                        const fieldConfig = FILTER_FIELDS_RESERVAS.find(f => f.field === filter.field);
                                        return fieldConfig && op.forTypes.includes(fieldConfig.type);
                                      }).map((op) => (
                                        <option key={op.value} value={op.value}>{op.label}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={filter.value}
                                      onChange={(e) => updateFilterReservas(filter.id, { value: e.target.value })}
                                      className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white"
                                    >
                                      <option value="">Seleccionar...</option>
                                      {getUniqueValuesReservas[filter.field]?.map((val) => (
                                        <option key={val} value={val}>{val}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => removeFilterReservas(filter.id)} className="text-red-400 hover:text-red-300 p-0.5">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                {filtersReservas.length === 0 && (
                                  <p className="text-[11px] text-zinc-500 text-center py-3">Sin filtros. Haz clic en "Añadir".</p>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-900/30">
                                <button onClick={addFilterReservas} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                                  <Plus className="h-3 w-3" /> Añadir
                                </button>
                                <button
                                  onClick={clearFiltersReservas}
                                  disabled={filtersReservas.length === 0}
                                  className="px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-500/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  Limpiar
                                </button>
                              </div>
                              {filtersReservas.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-purple-900/30">
                                  <span className="text-[10px] text-zinc-500">{filteredReservas.length} de {reservasMerged.length} registros</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* GROUP BUTTON - Multi-level */}
                        <div className="relative">
                          <button
                            onClick={() => { setShowGroupingConfigReservas(!showGroupingConfigReservas); setShowFiltersReservas(false); setShowSortReservas(false); }}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                            title="Agrupar"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            {activeGroupingsReservas.length > 0 && (
                              <span className="px-1 py-0.5 rounded bg-purple-600 text-[10px]">{activeGroupingsReservas.length}</span>
                            )}
                          </button>
                          {showGroupingConfigReservas && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[200px]">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wide px-2 py-1">Agrupar por (max 3)</p>
                              {AVAILABLE_GROUPINGS_RESERVAS.map(({ field, label }) => (
                                <button
                                  key={field}
                                  onClick={() => toggleGroupingReservas(field)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                                    activeGroupingsReservas.includes(field) ? 'text-purple-300' : 'text-zinc-400'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    activeGroupingsReservas.includes(field) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'
                                  }`}>
                                    {activeGroupingsReservas.includes(field) && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  {label}
                                  {activeGroupingsReservas.indexOf(field) === 0 && <span className="ml-auto text-[10px] text-purple-400">1°</span>}
                                  {activeGroupingsReservas.indexOf(field) === 1 && <span className="ml-auto text-[10px] text-pink-400">2°</span>}
                                  {activeGroupingsReservas.indexOf(field) === 2 && <span className="ml-auto text-[10px] text-cyan-400">3°</span>}
                                </button>
                              ))}
                              <div className="border-t border-purple-900/30 mt-2 pt-2">
                                <button onClick={() => setActiveGroupingsReservas([])} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
                                  Quitar agrupación
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SORT BUTTON */}
                        <div className="relative">
                          <button
                            onClick={() => { setShowSortReservas(!showSortReservas); setShowFiltersReservas(false); setShowGroupingConfigReservas(false); }}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30 rounded-lg transition-colors"
                            title="Ordenar"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                          {showSortReservas && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1025] border border-purple-900/50 rounded-lg shadow-xl p-2 min-w-[180px]">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wide px-2 py-1">Ordenar por</p>
                              {FILTER_FIELDS_RESERVAS.map(({ field, label }) => (
                                <button
                                  key={field}
                                  onClick={() => {
                                    if (sortFieldReservas === field) {
                                      setSortDirectionReservas(prev => prev === 'asc' ? 'desc' : 'asc');
                                    } else {
                                      setSortFieldReservas(field);
                                      setSortDirectionReservas('asc');
                                    }
                                  }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 ${
                                    sortFieldReservas === field ? 'text-purple-300' : 'text-zinc-400'
                                  }`}
                                >
                                  {label}
                                  {sortFieldReservas === field && (
                                    <span className="ml-auto">
                                      {sortDirectionReservas === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                    </span>
                                  )}
                                </button>
                              ))}
                              <div className="border-t border-purple-900/30 mt-2 pt-2">
                                <button onClick={() => setSortFieldReservas(null)} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
                                  Quitar orden
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedMapReservas.size > 0 && (
                          <>
                            <span className="text-zinc-400 text-xs">{selectedMapReservas.size} sel.</span>
                            <button onClick={() => setSelectedMapReservas(new Set())} className="text-purple-400 hover:text-purple-300 text-xs">
                              Limpiar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex h-[520px]">
                      {/* Selection Panel */}
                      <div className="w-96 border-r border-zinc-700/50 bg-zinc-900/30 flex flex-col flex-shrink-0">
                        {/* Select All Header */}
                        <div className="px-4 py-2.5 border-b border-zinc-700/50 bg-zinc-800/50">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMapReservas.size === filteredReservas.length && filteredReservas.length > 0}
                                onChange={toggleAllMapReservas}
                                className="checkbox-purple"
                              />
                              <span className="text-sm font-medium text-white">Seleccionar</span>
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                {filteredReservas.length}
                              </span>
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setExpandedReservasGroups(new Set(groupKeys))}
                                className="p-1.5 text-zinc-400 hover:text-purple-400 hover:bg-purple-900/30 rounded transition-colors"
                                title="Expandir todo"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setExpandedReservasGroups(new Set())}
                                className="p-1.5 text-zinc-400 hover:text-purple-400 hover:bg-purple-900/30 rounded transition-colors"
                                title="Colapsar todo"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Grouped Reservas - Multi-level */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                          {groupKeys.map(groupKey => {
                            const groupData = groupedReservas[groupKey];
                            const isLevel1Array = Array.isArray(groupData);
                            const level1Items = flattenItems(groupData);
                            const totalItems = countItems(groupData);
                            const allSelected = level1Items.every(r => selectedMapReservas.has(r.id));
                            const someSelected = level1Items.some(r => selectedMapReservas.has(r.id));
                            const isExpanded = expandedReservasGroups.has(groupKey);

                            return (
                              <div key={groupKey} className="border-b border-zinc-700/30">
                                <button
                                  onClick={() => toggleReservasGroup(groupKey)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-900/20 to-zinc-800/30 hover:from-purple-900/30 hover:to-zinc-800/50 transition-all"
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-400" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={(e) => { e.stopPropagation(); toggleGroupItems(level1Items); }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="checkbox-purple"
                                  />
                                  <span className="text-[10px] text-purple-400 font-medium">
                                    {AVAILABLE_GROUPINGS_RESERVAS.find(g => g.field === activeGroupingsReservas[0])?.label}:
                                  </span>
                                  <span className="text-sm font-medium text-white flex-1 text-left truncate">{groupKey}</span>
                                  <TypeBreakdownBadges items={level1Items} />
                                </button>
                                {isExpanded && (
                                  <div className="bg-zinc-900/40 border-l-2 border-purple-500/30 ml-3">
                                    {isLevel1Array ? (
                                      // Direct items
                                      (groupData as ReservaItem[]).map(reserva => (
                                        <label
                                          key={reserva.id}
                                          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                                            selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : 'hover:bg-zinc-800/40'
                                          }`}
                                        >
                                          <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                          <span className="text-zinc-400 font-mono text-[11px]">{reserva.codigo_unico}</span>
                                          <span className="text-zinc-500 text-[11px] truncate max-w-[80px]">{reserva.plaza}</span>
                                          <span className="text-zinc-500 text-[11px]">{reserva.formato}</span>
                                          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                                            reserva.codigo_unico?.includes('_Completo') ? 'bg-purple-500/20 text-purple-300' :
                                            reserva.tipo === 'Flujo' ? 'bg-blue-500/20 text-blue-300' :
                                            reserva.tipo === 'Contraflujo' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                                          }`}>{reserva.codigo_unico?.includes('_Completo') ? 'Completo' : reserva.tipo === 'Bonificacion' ? 'Bonif' : reserva.tipo}</span>
                                        </label>
                                      ))
                                    ) : (
                                      // Level 2 groups
                                      Object.entries(groupData as Record<string, ReservaItem[] | Record<string, ReservaItem[]>>).map(([subKey, subData]) => {
                                        const subFullKey = `${groupKey}-${subKey}`;
                                        const subItems = flattenItems(subData);
                                        const isSubExpanded = expandedReservasGroups.has(subFullKey);
                                        const allSubSelected = subItems.every(r => selectedMapReservas.has(r.id));
                                        const someSubSelected = subItems.some(r => selectedMapReservas.has(r.id));
                                        const isLevel2Array = Array.isArray(subData);

                                        return (
                                          <div key={subKey} className="border-l border-pink-500/20 ml-2">
                                            <button
                                              onClick={() => toggleReservasGroup(subFullKey)}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 bg-zinc-800/20 hover:bg-zinc-800/40"
                                            >
                                              {isSubExpanded ? <ChevronDown className="h-3 w-3 text-pink-400" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                                              <input
                                                type="checkbox"
                                                checked={allSubSelected}
                                                ref={(el) => { if (el) el.indeterminate = someSubSelected && !allSubSelected; }}
                                                onChange={(e) => { e.stopPropagation(); toggleGroupItems(subItems); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="checkbox-purple"
                                              />
                                              <span className="text-[10px] text-pink-400">
                                                {AVAILABLE_GROUPINGS_RESERVAS.find(g => g.field === activeGroupingsReservas[1])?.label}:
                                              </span>
                                              <span className="text-[11px] text-white flex-1 text-left truncate">{subKey}</span>
                                              <TypeBreakdownBadges items={subItems} />
                                            </button>
                                            {isSubExpanded && (
                                              <div className="ml-2 border-l border-cyan-500/20">
                                                {isLevel2Array ? (
                                                  (subData as ReservaItem[]).map(reserva => (
                                                    <label
                                                      key={reserva.id}
                                                      className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-[11px] ${
                                                        selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : 'hover:bg-zinc-800/40'
                                                      }`}
                                                    >
                                                      <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                                      <span className="text-zinc-400 font-mono">{reserva.codigo_unico}</span>
                                                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                                                        reserva.codigo_unico?.includes('_Completo') ? 'bg-purple-500/20 text-purple-300' :
                                                        reserva.tipo === 'Flujo' ? 'bg-blue-500/20 text-blue-300' :
                                                        reserva.tipo === 'Contraflujo' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                                                      }`}>{reserva.codigo_unico?.includes('_Completo') ? 'Completo' : reserva.tipo === 'Bonificacion' ? 'Bonif' : reserva.tipo}</span>
                                                    </label>
                                                  ))
                                                ) : (
                                                  // Level 3 groups
                                                  Object.entries(subData as Record<string, ReservaItem[]>).map(([thirdKey, thirdItems]) => {
                                                    const thirdFullKey = `${subFullKey}-${thirdKey}`;
                                                    const isThirdExpanded = expandedReservasGroups.has(thirdFullKey);
                                                    return (
                                                      <div key={thirdKey}>
                                                        <button
                                                          onClick={() => toggleReservasGroup(thirdFullKey)}
                                                          className="w-full flex items-center gap-2 px-2 py-1 bg-zinc-800/10 hover:bg-zinc-800/30"
                                                        >
                                                          {isThirdExpanded ? <ChevronDown className="h-3 w-3 text-cyan-400" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                                                          <span className="text-[10px] text-cyan-400">
                                                            {AVAILABLE_GROUPINGS_RESERVAS.find(g => g.field === activeGroupingsReservas[2])?.label}:
                                                          </span>
                                                          <span className="text-[11px] text-white flex-1 text-left truncate">{thirdKey}</span>
                                                          <TypeBreakdownBadges items={thirdItems} />
                                                        </button>
                                                        {isThirdExpanded && thirdItems.map(reserva => (
                                                          <label
                                                            key={reserva.id}
                                                            className={`flex items-center gap-2 px-4 py-1 cursor-pointer text-[11px] ${
                                                              selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : 'hover:bg-zinc-800/40'
                                                            }`}
                                                          >
                                                            <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                                            <span className="text-zinc-400 font-mono">{reserva.codigo_unico}</span>
                                                          </label>
                                                        ))}
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* KPIs Mini Summary */}
                        <div className="p-3 border-t border-zinc-700/50 bg-zinc-800/50">
                          <div className={`grid gap-2 text-center text-xs ${reservasKPIs.completos > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            <div>
                              <p className="text-zinc-500">Flujo</p>
                              <p className="text-blue-400 font-bold">{reservasKPIs.flujo}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Contra</p>
                              <p className="text-amber-400 font-bold">{reservasKPIs.contraflujo}</p>
                            </div>
                            {reservasKPIs.completos > 0 && (
                              <div>
                                <p className="text-zinc-500">Completo</p>
                                <p className="text-purple-400 font-bold">{reservasKPIs.completos}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-zinc-500">Bonif</p>
                              <p className="text-emerald-400 font-bold">{reservasKPIs.bonificadas}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Map */}
                      <div className="flex-1 relative">
                        {mapsLoaded ? (
                          <>
                            <GoogleMap
                              mapContainerStyle={{ width: '100%', height: '100%' }}
                              center={{ lat: 20.6597, lng: -103.3496 }}
                              zoom={11}
                              options={{
                                styles: DARK_MAP_STYLES,
                                disableDefaultUI: true,
                                zoomControl: true,
                              }}
                              onLoad={(map) => {
                                // Center map on reservas bounds
                                if (filteredReservas.length > 0) {
                                  const bounds = new google.maps.LatLngBounds();
                                  let hasValidCoords = false;
                                  filteredReservas.forEach(r => {
                                    if (r.latitud && r.longitud) {
                                      bounds.extend({ lat: r.latitud, lng: r.longitud });
                                      hasValidCoords = true;
                                    }
                                  });
                                  if (hasValidCoords && !bounds.isEmpty()) {
                                    map.fitBounds(bounds, 50);
                                  }
                                }
                              }}
                            >
                              {filteredReservas.map(reserva => {
                                if (!reserva.latitud || !reserva.longitud) return null;
                                const isSelected = selectedMapReservas.has(reserva.id);
                                const hasSelection = selectedMapReservas.size > 0;
                                const isCompleto = reserva.codigo_unico?.includes('_Completo');

                                return (
                                  <Marker
                                    key={reserva.id}
                                    position={{ lat: reserva.latitud, lng: reserva.longitud }}
                                    onClick={() => toggleSingleMapReserva(reserva.id)}
                                    icon={{
                                      path: google.maps.SymbolPath.CIRCLE,
                                      scale: isSelected ? 12 : (hasSelection ? 6 : 8),
                                      fillColor: isCompleto ? '#a855f7' :
                                        reserva.tipo === 'Flujo' ? '#3b82f6' :
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

                            {/* Map Legend */}
                            <div className="absolute bottom-3 right-3 z-10 bg-zinc-900/95 border border-zinc-700 rounded-lg p-2.5 text-xs max-w-[180px]">
                              <div className="text-zinc-300 font-semibold mb-1.5 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-purple-400" />
                                Leyenda
                              </div>

                              {/* Dirección del tráfico */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                  <span className="text-zinc-300">Flujo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                  <span className="text-zinc-300">Contraflujo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                  <span className="text-zinc-300">Completo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                  <span className="text-zinc-300">Bonificación</span>
                                </div>
                              </div>

                              {/* Estado de selección */}
                              <div className="border-t border-zinc-700/70 pt-1.5 mt-1.5 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-white/50" />
                                  <span className="text-zinc-300">Seleccionado</span>
                                  <span className="text-zinc-500 text-[10px]">({selectedMapReservas.size})</span>
                                </div>
                              </div>
                            </div>
                          </>
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

        {/* Footer with Aprobar button */}
        {caras.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Status summary */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${allCarasComplete ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-zinc-400">
                    {allCarasComplete ? (
                      <span className="text-emerald-400">Todas las caras completas</span>
                    ) : (
                      <span className="text-amber-400">
                        {caras.filter(c => !getCaraCompletionStatus(c).isComplete).length} cara(s) incompleta(s)
                      </span>
                    )}
                  </span>
                </div>
                {hasPendingAuthorization && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Autorizaciones pendientes
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cerrar
              </button>
              {effectiveCanEdit && (
                <button
                  disabled={!allCarasComplete || hasPendingAuthorization}
                  onClick={() => {
                    // TODO: Implement aprobar propuesta logic
                    alert('Propuesta lista para aprobar');
                  }}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                    allCarasComplete && !hasPendingAuthorization
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                      : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="h-4 w-4 inline-block mr-2" />
                  Aprobar Propuesta
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Confirmation Modal */}
      {confirmModalJSX}
      {/* Toast Notification */}
      {toastJSX}

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
