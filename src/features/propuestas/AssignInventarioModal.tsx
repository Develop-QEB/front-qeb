import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useModalTracker } from '../../hooks/useModalTracker';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Users,
  FileText, MapPin, Layers, Pencil, Map as MapIcon, Package, Calendar,
  Gift, Target, Save, ArrowLeft, Filter, Grid, LayoutGrid, Ruler, ArrowUpDown, ArrowUp, ArrowDown, Download, Eye, Funnel, Check, Upload, Monitor, AlertTriangle, Trophy, Loader2
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { AdvancedMapComponent } from './AdvancedMapComponent';
import { Propuesta } from '../../types';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService, InventarioDisponible } from '../../services/inventarios.service';
import { propuestasService, ReservaModalItem } from '../../services/propuestas.service';
import { formatCurrency } from '../../lib/utils';
import { clientesService } from '../../services/clientes.service';
import { useEnvironmentStore, getEndpoints } from '../../store/environmentStore';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { filterAllowedArticulos } from '../../config/allowedDigitalArticles';
import { useSocketPropuesta, useSocketEquipos } from '../../hooks/useSocket';
import { useThemeStore } from '../../store/themeStore';

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
  _originalDg?: string;
  _originalDcm?: string;
  grupo_rt_bf?: number | null;
  esBf?: boolean;
  articuloBf?: SAPArticulo | null;
}

// SAP Articulo interface
interface SAPArticulo {
  ItemCode: string;
  ItemName: string;
  U_IMU_PublicPrice?: number | null;
  ItemPrices?: { PriceList: number; Price: number }[];
}

// Detectar si un artículo es de impresión (no requiere inventario)
const isImpresionArticle = (itemCode: string, itemName?: string): boolean => {
  if (itemCode.startsWith('IM')) return true;
  if (itemName && itemName.toLowerCase().includes('impresion')) return true;
  return false;
};

// Detectar si un artículo es de ejecución especial (no requiere inventario)
const isEspecialArticle = (itemCode: string, itemName?: string): boolean => {
  const code = itemCode.toUpperCase();
  if (code.startsWith('ESP') || code.startsWith('ES-')) return true;
  if (itemName && itemName.toLowerCase().includes('ejecucion especial')) return true;
  return false;
};

// Detectar si un artículo no requiere inventario
const isNoInventoryArticle = (itemCode: string, itemName?: string): boolean => {
  return isImpresionArticle(itemCode, itemName) || isEspecialArticle(itemCode, itemName);
};

// Tarifa publica now comes from SAP (U_IMU_PublicPrice field on each article)

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
  if (name.includes('KIOSCO') || name.includes('KIOSKO')) return 'Kiosco';
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
const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' => {
  if (!itemName) return 'Tradicional';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  return 'Tradicional';
};

// Get tarifa from ItemCode
// Tarifa pública = U_IMU_PublicPrice
const getTarifaPublicaFromArticulo = (articulo: SAPArticulo): number => {
  if (!articulo) return 0;
  return articulo.U_IMU_PublicPrice || 0;
};

// Tarifa piso = PriceList 11
const getTarifaPisoFromArticulo = (articulo: SAPArticulo): number => {
  if (!articulo?.ItemPrices) return 0;
  const pl11 = articulo.ItemPrices.find(p => p.PriceList === 11);
  return pl11?.Price || 0;
};

// Multi-city auto-fill rules for specific article patterns
const MULTI_CITY_RULES: { pattern: RegExp; estado: string; ciudad: string }[] = [
  { pattern: /\bMTY\b|\bMONTERREY\b/, estado: 'Nuevo León', ciudad: 'Monterrey,Guadalupe,San Nicolás de los Garza,Santa Catarina' },
  { pattern: /\bVERACRUZ\b|\bVER\b/, estado: 'Veracruz', ciudad: 'Veracruz,Alvarado,Boca del Río' },
  { pattern: /\bGD\b|\bGUADALAJARA\b/, estado: 'Jalisco', ciudad: 'Guadalajara,Zapopan,Tlaquepaque' },
  { pattern: /\bPUERTO VALLARTA\b|\bPV\b/, estado: 'Jalisco', ciudad: 'Puerto Vallarta' },
];

// Extract city/state from article name (sorted by length to avoid false positives)
const getCiudadEstadoFromArticulo = (itemName: string): { estado: string; ciudad: string } | null => {
  if (!itemName) return null;
  const name = itemName.toUpperCase();

  // Check multi-city rules first
  for (const rule of MULTI_CITY_RULES) {
    if (rule.pattern.test(name)) {
      return { estado: rule.estado, ciudad: rule.ciudad };
    }
  }

  // Sort cities by length (longest first) to match more specific names before generic ones
  const sortedCities = Object.entries(CIUDAD_ESTADO_MAP).sort((a, b) => b[0].length - a[0].length);

  const CIUDADES_SIN_CIUDAD = ['CDMX', 'CIUDAD DE MEXICO', 'MEXICO', 'DF'];

  for (const [ciudad, estado] of sortedCities) {
    const regex = new RegExp(`(^|[^A-Z])${ciudad.replace(/\s+/g, '\\s+')}([^A-Z]|$)`, 'i');
    if (regex.test(name)) {
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
  isla?: string | null; // Isla from inventory
  solicitudCaraId?: number; // For linking to cara
  reservaId?: number; // For existing reservas from DB
  grupo_completo_id?: number | null; // For grouping complete groups
  articulo?: string; // Artículo SAP de la cara
  grupo?: string; // Distance group name
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
  { field: 'catorcena', label: 'Periodo', type: 'number' },
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
  { field: 'catorcena', label: 'Periodo' },
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} text-left focus:outline-none focus:ring-1 focus:ring-purple-500/50 flex items-center justify-between`}
      >
        <span className={selected.length === 0 ? (isDark ? 'text-zinc-500' : 'text-gray-400') : ''}>
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`}
        </span>
        <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className={`absolute z-50 mt-1 w-full ${isDark ? 'bg-zinc-800' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg shadow-xl max-h-48 overflow-y-auto`}>
          {options.map(option => (
            <label
              key={option}
              className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'} cursor-pointer text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}
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
            <div className={`px-3 py-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Sin opciones</div>
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
  // Spot único fields
  spots_disponibles?: number;
  isCollapsedSpot?: boolean;
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
  grupo_rt_bf: null,
  esBf: false,
  articuloBf: null,
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
          : `${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'hover:border-zinc-600' : 'hover:border-gray-300'}`
          }`}
      >
        <span className="truncate text-left flex-1">
          {value && renderSelected ? renderSelected(value) : (displayValue || label)}
        </span>
        {value ? (
          <X className={`h-4 w-4 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} flex-shrink-0`} onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClose} />
          <div className={`absolute top-full left-0 right-0 mt-1 z-50 w-full min-w-[350px] rounded-xl border border-purple-500/20 ${isDark ? 'bg-zinc-900' : 'bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder={`Buscar ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-sm ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg ${isDark ? 'text-white' : 'text-gray-900'} ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {loading ? (
                <div className={`px-3 py-4 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Cargando...</div>
              ) : filteredOptions.length === 0 ? (
                <div className={`px-3 py-4 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option, idx) => (
                  <button
                    key={`${option[valueKey]}-${idx}`}
                    type="button"
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-100'} last:border-0 ${value && value[valueKey] === option[valueKey]
                      ? 'bg-purple-500/20 text-purple-300'
                      : `${isDark ? 'text-zinc-300' : 'text-gray-700'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`
                      }`}
                  >
                    {renderOption ? renderOption(option) : (
                      <span>{option[displayKey]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className={`px-3 py-1.5 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              Mostrando {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function AssignInventarioModal({ isOpen, onClose, propuesta, readOnly = false }: Props) {
  useModalTracker('Asignar Inventario Propuesta', isOpen);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);
  const tipoPeriodo = (propuesta as any)?.tipo_periodo || 'catorcena';

  // WebSocket para escuchar cambios en reservas en tiempo real
  useSocketPropuesta(propuesta?.id || null);

  // Socket para actualizar usuarios en tiempo real
  useSocketEquipos();

  // Si readOnly es true, sobrescribir permisos para modo visualización
  const isDescartada = propuesta.status === 'Descartada' || propuesta.status === 'Rechazada';
  const effectiveCanEdit = !readOnly && permissions.canAsignarInventario && !isDescartada;
  const canEditResumen = !readOnly && permissions.canEditResumenPropuesta && !isDescartada;
  const canEditCliente = !readOnly && permissions.canEditClienteEnFormularios && !isDescartada;
  const mapRef = useRef<google.maps.Map | null>(null);
  const reservadosMapRef = useRef<google.maps.Map | null>(null);
  const resumenReservasMapRef = useRef<google.maps.Map | null>(null);

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
  const [imu, setImu] = useState(false);
  const periodInitializedRef = useRef(false);
  const initialValuesSetRef = useRef(false);

  // Client editing state
  interface CuicItem {
    CUIC: number;
    T0_U_RazonSocial: string;
    T0_U_Cliente: string;
    T1_U_UnidadNegocio: string;
    T0_U_Agencia: string;
    ASESOR_U_IDAsesor: string;
    ASESOR_U_Asesor: string;
    T1_U_IDMarca: number;
    T2_U_Marca: string;
    T2_U_IDProducto: number;
    T2_U_Producto: string;
    T2_U_IDCategoria: number;
    T2_U_Categoria: string;
    sap_database?: string;
  }
  const [selectedClienteCuic, setSelectedClienteCuic] = useState<CuicItem | null>(null);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [clienteChanged, setClienteChanged] = useState(false);

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
    imu: false,
  });
  const [isUpdatingPropuesta, setIsUpdatingPropuesta] = useState(false);

  // Caras state
  const [caras, setCaras] = useState<CaraItem[]>([]);
  const [expandedCaras, setExpandedCaras] = useState<Set<string>>(new Set());
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [editingCaraId, setEditingCaraId] = useState<string | null>(null);
  // Track locally modified caras (caraDbId -> CaraUpdateData) for bulk save
  const [modifiedCaras, setModifiedCaras] = useState<Map<number, Record<string, unknown>>>(new Map());

  // New cara form
  const [newCara, setNewCara] = useState<Omit<CaraItem, 'localId'>>(EMPTY_CARA);
  const [selectedArticulo, setSelectedArticulo] = useState<SAPArticulo | null>(null);
  const [showAddCaraForm, setShowAddCaraForm] = useState(false);
  const caraFormRef = useRef<HTMLDivElement>(null);
  const caraTableRef = useRef<HTMLDivElement>(null);

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
  const [editingPlaza, setEditingPlaza] = useState('');
  const [reservadosTipoFilter, setReservadosTipoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo' | 'Bonificacion'>('Todos');
  const [showOnlyIslaReservados, setShowOnlyIslaReservados] = useState(false);
  const [showReservasFlatList, setShowReservasFlatList] = useState(false); // Toggle for flat list vs grouped
  const [groupByDistanceReservados, setGroupByDistanceReservados] = useState(false);
  const [groupModeReservados, setGroupModeReservados] = useState<'distancia' | 'listado'>('distancia');
  const [distanciaGruposReservados, setDistanciaGruposReservados] = useState(500);
  const [tamanoGrupoReservados, setTamanoGrupoReservados] = useState(10);
  const [expandedGroupsReservados, setExpandedGroupsReservados] = useState<Set<string>>(new Set(['Grupo 1']));
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
  const [showSpotUnico, setShowSpotUnico] = useState(false);
  const [groupByDistance, setGroupByDistance] = useState(false);
  const [groupMode, setGroupMode] = useState<'distancia' | 'listado'>('distancia');
  const [distanciaGrupos, setDistanciaGrupos] = useState(500); // metros
  const [tamanoGrupo, setTamanoGrupo] = useState(10);
  const [flujoPct, setFlujoPct] = useState(50); // % de caras para flujo (resto para contraflujo)
  const [savingPct, setSavingPct] = useState(false); // loading para guardar % en BD
  const [flujoFilter, setFlujoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo'>('Todos');
  const [islaFilter, setIslaFilter] = useState<'off' | 'si' | 'no'>('off');
  const [mundialistaFilter, setMundialistaFilter] = useState<'off' | 'si' | 'no'>('off');
  const [sortColumn, setSortColumn] = useState<string>('codigo_unico');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [agruparComoCompleto, setAgruparComoCompleto] = useState(true); // Group flujo+contraflujo at same location
  const [excluirCategoria, setExcluirCategoria] = useState<string>('');
  const [excluirDistanciaKm, setExcluirDistanciaKm] = useState<number>(1);

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

  // Fetch solicitud full details - refetch always on mount to get fresh authorization status
  const { data: solicitudDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['solicitud-full-details', propuesta.solicitud_id],
    queryFn: () => solicitudesService.getFullDetails(propuesta.solicitud_id),
    enabled: isOpen && !!propuesta.solicitud_id,
    refetchOnMount: 'always',
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
        return filterAllowedArticulos((data.value || data) as SAPArticulo[]);
      } catch {
        return [] as SAPArticulo[];
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing reservas for this propuesta - refetch always on mount for real-time data
  const { data: existingReservas, isLoading: reservasLoading } = useQuery({
    queryKey: ['propuesta-reservas-modal', propuesta.id],
    queryFn: () => propuestasService.getReservasForModal(propuesta.id),
    enabled: isOpen && !!propuesta.id,
    refetchOnMount: 'always',
  });

  const { data: categoriasCliente } = useQuery({
    queryKey: ['categorias-cliente'],
    queryFn: () => inventariosService.getCategoriasCliente(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch CUIC data for client editing
  const { data: cuicData, isLoading: cuicLoading } = useQuery({
    queryKey: ['clientes-full-for-propuesta'],
    queryFn: async () => {
      const result = await clientesService.getAllFull();
      return (result?.data || []).map((c: any) => ({
        CUIC: c.CUIC!,
        T0_U_RazonSocial: c.T0_U_RazonSocial || '',
        T0_U_Cliente: c.T0_U_Cliente || '',
        T1_U_UnidadNegocio: c.T1_U_UnidadNegocio || '',
        T0_U_Agencia: c.T0_U_Agencia || '',
        ASESOR_U_IDAsesor: c.ASESOR_U_IDAsesor || '',
        ASESOR_U_Asesor: c.ASESOR_U_Asesor || '',
        T1_U_IDMarca: c.T1_U_IDMarca || 0,
        T2_U_Marca: c.T2_U_Marca || '',
        T2_U_IDProducto: c.T2_U_IDProducto || 0,
        T2_U_Producto: c.T2_U_Producto || '',
        T2_U_IDCategoria: c.T2_U_IDCategoria || 0,
        T2_U_Categoria: c.T2_U_Categoria || '',
        sap_database: c.sap_database || '',
      })) as CuicItem[];
    },
    enabled: isOpen && canEditCliente,
    staleTime: 5 * 60 * 1000,
  });

  // Filtered CUIC options for client search
  const filteredCuicOptions = useMemo(() => {
    if (!cuicData) return [];
    if (!clienteSearchTerm) return cuicData;
    const term = clienteSearchTerm.toLowerCase();
    return cuicData.filter((c: CuicItem) =>
      String(c.CUIC).includes(term) ||
      c.T2_U_Marca?.toLowerCase().includes(term) ||
      c.T0_U_RazonSocial?.toLowerCase().includes(term) ||
      c.T2_U_Producto?.toLowerCase().includes(term)
    );
  }, [cuicData, clienteSearchTerm]);

  // Load existing reservas into state when data arrives
  useEffect(() => {
    if (existingReservas && existingReservas.length > 0 && caras.length > 0) {
      const loadedReservas: ReservaItem[] = existingReservas.map((r: ReservaModalItem) => {
        // Find the cara that matches this reserva
        const matchingCara = caras.find(c => c.id === r.solicitud_cara_id);
        const tipo = r.estatus === 'Bonificado' ? 'Bonificacion' : (String(r.tipo_de_cara).startsWith('Flujo') ? 'Flujo' : 'Contraflujo');

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
          isla: r.isla,
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

      // Set IMU flag from solicitud
      const imuVal = Boolean(solicitudDetails.solicitud?.IMU);
      setImu(imuVal);

      // Set period from cotizacion dates — only on first load, not after updates
      const cot = solicitudDetails.cotizacion;
      let yInicio: number | undefined;
      let cInicio: number | undefined;
      let yFin: number | undefined;
      let cFin: number | undefined;

      if (!periodInitializedRef.current) {
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
        periodInitializedRef.current = true;
      }

      // Store initial values for change detection — only on first load
      if (!initialValuesSetRef.current) {
        const parsedAsignadosIds = propuesta.id_asignado
          ? propuesta.id_asignado.split(',').map(s => parseInt(s.trim()) || 0).join(',')
          : '';
        setInitialValues({
          nombreCampania: campaniaNombre,
          notas: notasVal,
          descripcion: descripcionVal,
          yearInicio: yInicio ?? yearInicio,
          yearFin: yFin ?? yearFin,
          catorcenaInicio: cInicio ?? catorcenaInicio,
          catorcenaFin: cFin ?? catorcenaFin,
          asignadosIds: parsedAsignadosIds,
          imu: imuVal,
        });
        initialValuesSetRef.current = true;
      }

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

          const grupoRtBfVal = cara.grupo_rt_bf != null ? Number(cara.grupo_rt_bf) : null;
          const articuloUpper = (cara.articulo || '').toUpperCase();
          const esBfRow = !!grupoRtBfVal && (articuloUpper.startsWith('BF') || articuloUpper.startsWith('CF'));
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
            _originalDg: cara.autorizacion_dg || 'aprobado',
            _originalDcm: cara.autorizacion_dcm || 'aprobado',
            grupo_rt_bf: grupoRtBfVal,
            esBf: esBfRow,
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
      periodInitializedRef.current = false;
      initialValuesSetRef.current = false;
      setCsvFile(null);
      setCsvData([]);
      setShowCsvSection(false);
      setSelectedClienteCuic(null);
      setClienteChanged(false);
      setClienteSearchTerm('');
      setShowClienteDropdown(false);
      setModifiedCaras(new Map());
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
      currentAsignadosIds !== initialValues.asignadosIds ||
      imu !== initialValues.imu ||
      clienteChanged
    );
  }, [nombreCampania, notas, descripcion, yearInicio, yearFin, catorcenaInicio, catorcenaFin, currentAsignadosIds, imu, initialValues, clienteChanged]);

  // Handle update propuesta
  const handleUpdatePropuesta = async () => {
    if (invalidCaras.length > 0) {
      alert(`No se puede actualizar: ${invalidCaras.length} cara(s) tienen catorcenas fuera del rango configurado. Elimínalas o ajusta el rango.`);
      return;
    }
    setIsUpdatingPropuesta(true);
    try {
      // Update propuesta data (include client fields if changed)
      await propuestasService.updatePropuesta(propuesta.id, {
        nombre_campania: nombreCampania,
        notas,
        descripcion,
        year_inicio: yearInicio,
        catorcena_inicio: catorcenaInicio,
        year_fin: yearFin,
        catorcena_fin: catorcenaFin,
        IMU: imu,
        ...(clienteChanged && selectedClienteCuic ? {
          cliente_id: selectedClienteCuic.CUIC,
          cuic: selectedClienteCuic.CUIC,
          razon_social: selectedClienteCuic.T0_U_RazonSocial,
          unidad_negocio: selectedClienteCuic.T1_U_UnidadNegocio,
          marca_id: selectedClienteCuic.T1_U_IDMarca,
          marca_nombre: selectedClienteCuic.T2_U_Marca,
          asesor: selectedClienteCuic.ASESOR_U_Asesor,
          producto_id: selectedClienteCuic.T2_U_IDProducto,
          producto_nombre: selectedClienteCuic.T2_U_Producto,
          agencia: selectedClienteCuic.T0_U_Agencia,
          categoria_id: selectedClienteCuic.T2_U_IDCategoria,
          categoria_nombre: selectedClienteCuic.T2_U_Categoria,
          sap_database: selectedClienteCuic.sap_database,
        } : {}),
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
        imu,
      });
      setClienteChanged(false);

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
    const totalRenta = caras.filter(c => !isNoInventoryArticle(c.articulo || '')).reduce((acc, c) => acc + (c.caras || 0), 0);
    const totalImpresiones = caras.filter(c => (c.articulo || '').toUpperCase().startsWith('IM')).reduce((acc, c) => acc + (c.caras || 0), 0);
    const totalEspeciales = caras.filter(c => isEspecialArticle(c.articulo || '')).reduce((acc, c) => acc + (c.caras || 0), 0);
    const totalBonificacion = caras.filter(c => !(c.articulo || '').toUpperCase().startsWith('CT') && !isNoInventoryArticle(c.articulo || '')).reduce((acc, c) => acc + (c.bonificacion || 0), 0);
    const totalCortesia = caras.filter(c => (c.articulo || '').toUpperCase().startsWith('CT')).reduce((acc, c) => acc + (c.bonificacion || 0), 0);
    const totalInversion = caras.reduce((acc, c) => acc + ((c.caras || 0) * (c.tarifa_publica || 0)), 0);
    return { totalRenta, totalImpresiones, totalEspeciales, totalBonificacion, totalCortesia, totalInversion };
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

  // Effect to re-fit map bounds when filtered reservas change (for "Resumen de Reservas" map)
  useEffect(() => {
    if (resumenReservasMapRef.current && filteredReservasData.length > 0 && mapsLoaded && typeof google !== 'undefined') {
      const bounds = new google.maps.LatLngBounds();
      let hasValidCoords = false;
      filteredReservasData.forEach(r => {
        if (r.latitud && r.longitud) {
          bounds.extend({ lat: r.latitud, lng: r.longitud });
          hasValidCoords = true;
        }
      });
      if (hasValidCoords && !bounds.isEmpty()) {
        resumenReservasMapRef.current.fitBounds(bounds, 50);
      }
    }
  }, [filteredReservasData, mapsLoaded]);

  // Show actual flujo/contraflujo from DB (updated via onChange when % changes)
  const adjustedCarasFlujo = useMemo(() => {
    if (!selectedCaraForSearch) return { flujo: 0, contraflujo: 0 };
    return {
      flujo: selectedCaraForSearch.caras_flujo || 0,
      contraflujo: selectedCaraForSearch.caras_contraflujo || 0,
    };
  }, [selectedCaraForSearch]);

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
      flujo: adjustedCarasFlujo.flujo - flujoReservado,
      contraflujo: adjustedCarasFlujo.contraflujo - contraflujoReservado,
      bonificacion: (selectedCaraForSearch.bonificacion || 0) - bonificacionReservado,
    };
  }, [selectedCaraForSearch, reservas, adjustedCarasFlujo]);

  // Check if cara has reservas
  const caraHasReservas = (localId: string, caraId?: number) => {
    return reservas.some(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
  };

  // Get cara completion status
  const getCaraCompletionStatus = (cara: CaraItem) => {
    // Artículos de impresión o ejecución especial siempre están completos (no requieren inventario)
    if (cara.articulo && isNoInventoryArticle(cara.articulo)) {
      return {
        flujoReservado: 0, contraflujoReservado: 0, bonificacionReservado: 0,
        flujoRequerido: 0, contraflujoRequerido: 0, bonificacionRequerido: 0,
        flujoCompleto: true, contraflujoCompleto: true, bonificacionCompleto: true,
        isComplete: true, totalReservado: 0, totalRequerido: 0,
        flujoDiff: 0, contraflujoDiff: 0, bonificacionDiff: 0, totalDiff: 0,
        needsAttention: false, isImpresion: isImpresionArticle(cara.articulo), isEspecial: isEspecialArticle(cara.articulo),
      };
    }

    const caraReservas = reservas.filter(r =>
      r.id.startsWith(cara.localId) || r.solicitudCaraId === cara.id
    );
    const flujoReservado = caraReservas.filter(r => r.tipo === 'Flujo').length;
    const contraflujoReservado = caraReservas.filter(r => r.tipo === 'Contraflujo').length;
    const bonificacionReservado = caraReservas.filter(r => r.tipo === 'Bonificacion').length;

    const flujoRequerido = cara.caras_flujo || 0;
    const contraflujoRequerido = cara.caras_contraflujo || 0;
    const bonificacionRequerido = cara.bonificacion || 0;

    // Complete means EXACT match - not under, not over
    const flujoCompleto = flujoReservado === flujoRequerido;
    const contraflujoCompleto = contraflujoReservado === contraflujoRequerido;
    const bonificacionCompleto = bonificacionReservado === bonificacionRequerido;

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
      let periodo = cara.inicio_periodo || 'Sin periodo';
      let parsedMonth: number | undefined;
      let parsedYear: number | undefined;
      if (tipoPeriodo === 'mensual' && cara.inicio_periodo) {
        // Parse date string directly to avoid timezone shifts
        const parts = cara.inicio_periodo.split('-');
        if (parts.length >= 2) {
          parsedYear = parseInt(parts[0]);
          parsedMonth = parseInt(parts[1]);
          periodo = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
        }
      }
      if (!groups[periodo]) {
        if (tipoPeriodo === 'mensual' && parsedMonth !== undefined && parsedYear !== undefined) {
          groups[periodo] = { caras: [], catorcenaNum: parsedMonth, year: parsedYear };
        } else if (tipoPeriodo === 'mensual') {
          const parts = periodo.split('-');
          groups[periodo] = { caras: [], catorcenaNum: parseInt(parts[1]) || undefined, year: parseInt(parts[0]) || undefined };
        } else {
          const catorcenaInfo = catorcenasData?.data?.find(c => c.fecha_inicio === periodo);
          groups[periodo] = { caras: [], catorcenaNum: catorcenaInfo?.numero_catorcena, year: catorcenaInfo?.a_o };
        }
      }
      groups[periodo].caras.push(cara);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [caras, catorcenasData, tipoPeriodo]);

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

  // Detect caras whose period is outside the current availablePeriods range
  const invalidCaras = useMemo(() => {
    if (caras.length === 0) return [];
    if (!yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];
    const validKeys = new Set(availablePeriods.map(p => `${p.a_o}-${p.numero_catorcena}`));
    return caras.filter(c => {
      if (!c.anio_inicio || !c.catorcena_inicio) return false;
      return !validKeys.has(`${c.anio_inicio}-${c.catorcena_inicio}`);
    });
  }, [caras, availablePeriods, yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

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
    const caraToDelete = caras.find(c => c.localId === localId);
    const tieneReservas = caraHasReservas(localId, caraToDelete?.id);

    if (tieneReservas && !permissions.canDeleteCaraConReservas) {
      alert('No puedes eliminar una cara que tiene reservas. Primero elimina las reservas.');
      return;
    }

    // If cara belongs to RT/BF group, find its pair to delete both
    const pairCara = caraToDelete?.grupo_rt_bf
      ? caras.find(c =>
          c.localId !== localId &&
          c.grupo_rt_bf === caraToDelete.grupo_rt_bf &&
          c.inicio_periodo === caraToDelete.inicio_periodo &&
          c.fin_periodo === caraToDelete.fin_periodo
        )
      : null;

    // Block deletion if the pair has reservas and user can't delete with reservas
    const pairTieneReservas = pairCara ? caraHasReservas(pairCara.localId, pairCara.id) : false;
    if (pairTieneReservas && !permissions.canDeleteCaraConReservas) {
      alert('No puedes eliminar una cara que tiene reservas en su par RT/BF. Primero elimina las reservas.');
      return;
    }

    const anyTieneReservas = tieneReservas || pairTieneReservas;

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Formato',
      message: pairCara
        ? (anyTieneReservas
            ? '⚠️ Este formato (y su par RT/BF) tiene inventario reservado. Al eliminarlo se liberarán todas las reservas. ¿Deseas continuar?'
            : '¿Estás seguro de que deseas eliminar este formato y su par (RT/BF) de la propuesta?')
        : (tieneReservas
            ? '⚠️ Este formato tiene inventario reservado. Al eliminarlo se liberarán todas las reservas. ¿Deseas continuar?'
            : '¿Estás seguro de que deseas eliminar este formato de la propuesta?'),
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
        // Delete pair cara if exists
        if (pairCara?.id) {
          try {
            await propuestasService.deleteCara(propuesta.id, pairCara.id);
          } catch (error) {
            console.error('Error deleting RT/BF pair cara:', error);
            alert('Error al eliminar la cara par (RT/BF) de la base de datos');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return;
          }
        }
        // Update local state (remove both cara and its RT/BF pair, if any)
        const idsToRemove = new Set<string>([localId]);
        if (pairCara) idsToRemove.add(pairCara.localId);
        const dbIdsToRemove = new Set<string>();
        if (caraToDelete?.id) dbIdsToRemove.add(caraToDelete.id);
        if (pairCara?.id) dbIdsToRemove.add(pairCara.id);
        setCaras(prev => prev.filter(c => !idsToRemove.has(c.localId)));
        setReservas(prev => prev.filter(r =>
          ![...idsToRemove].some(id => r.id.startsWith(id)) &&
          !(r.solicitudCaraId && dbIdsToRemove.has(r.solicitudCaraId))
        ));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle edit cara - permite edición parcial cuando hay reservas
  const handleEditCara = (cara: CaraItem) => {
    // Ya no bloqueamos completamente - permitimos edición de ciudad, formatos y NSE

    // If this is a BF row of a RT/BF pair, edit the RT cara instead
    if (cara.esBf && cara.grupo_rt_bf) {
      const rtCara = caras.find(c =>
        c.localId !== cara.localId &&
        !c.esBf &&
        c.grupo_rt_bf === cara.grupo_rt_bf &&
        c.inicio_periodo === cara.inicio_periodo &&
        c.fin_periodo === cara.fin_periodo
      );
      if (rtCara) {
        handleEditCara(rtCara);
        return;
      }
    }

    // Find BF pair if this RT cara has one
    const bfPair = cara.grupo_rt_bf
      ? caras.find(c =>
          c.localId !== cara.localId &&
          c.esBf &&
          c.grupo_rt_bf === cara.grupo_rt_bf &&
          c.inicio_periodo === cara.inicio_periodo &&
          c.fin_periodo === cara.fin_periodo
        )
      : null;

    // Resolve articuloBf (SAPArticulo object) from pair's articulo code
    let articuloBfResolved: SAPArticulo | null = null;
    if (bfPair && bfPair.articulo && articulosData) {
      articuloBfResolved = articulosData.find(a => a.ItemCode === bfPair.articulo) || null;
    }

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

    // If there's a BF pair, the user-facing "bonificacion" value is the BF pair's "caras"
    // (BF caras are stored in `caras`, not `bonificacion`, when linked via grupo_rt_bf)
    const bonificacionDisplay = bfPair ? (bfPair.caras || 0) : cara.bonificacion;

    setNewCara({
      ciudad: cara.ciudad,
      estados: cara.estados,
      tipo: cara.tipo,
      flujo: cara.flujo,
      bonificacion: bonificacionDisplay,
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
      grupo_rt_bf: cara.grupo_rt_bf ?? null,
      esBf: false,
      articuloBf: articuloBfResolved,
    });
    setShowAddCaraForm(true);
    setTimeout(() => caraFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Handle save cara (add or update)
  // EDIT: only updates local state + tracks in modifiedCaras (bulk save later)
  // CREATE: still persists to DB immediately (needs ID for reservas)
  const handleSaveCara = async () => {
    if (!newCara.formato || !newCara.estados) {
      alert('Por favor completa al menos el formato y estado');
      return;
    }

    // Validar tarifa pública: si es 0, solo CT, BF/CF e IM pueden avanzar
    const artCode = (newCara.articulo || '').toUpperCase();
    const esCortesia = artCode.startsWith('CT');
    const esBonificacion = artCode.startsWith('BF') || artCode.startsWith('CF');
    const esImpresion = artCode.startsWith('IM');
    if (newCara.tarifa_publica <= 0 && !esCortesia && !esBonificacion && !esImpresion) {
      alert('La tarifa pública no puede ser 0. Por favor ingresa una tarifa válida.');
      return;
    }

    // If no ciudad selected but estado is, get all cities from that estado
    let ciudadToSave = newCara.ciudad;
    if (!ciudadToSave && newCara.estados && solicitudFilters?.ciudades) {
      const isAM = newCara.estados.includes('Ciudad de México / AM');
      const selectedEstados = newCara.estados.split(',').map(s => s.trim()).flatMap(s => s === 'Ciudad de México / AM' ? ['Ciudad de México', 'Estado de México'] : [s]);
      const AM_EDO_MEX_CITIES = ['ATIZAPÁN', 'CUAUTITLÁN IZCALLI', 'ECATEPEC', 'HUIXQUILUCAN', 'NAUCALPAN', 'TLALNEPANTLA', 'TULTITLÁN'];
      const allCitiesForEstado = solicitudFilters.ciudades
        .filter(c => selectedEstados.includes(c.estado))
        .filter(c => !isAM || c.estado !== 'Estado de México' || AM_EDO_MEX_CITIES.includes(c.ciudad.toUpperCase()))
        .map(c => c.ciudad);
      ciudadToSave = allCitiesForEstado.join(', ');
    }

    // Calcular costo como caras * tarifa_publica (inversión)
    const costoCalculado = (newCara.caras || 0) * (newCara.tarifa_publica || 0);

    // Determine if this save is an RT/BF pair (bonificacion > 0 AND articuloBf selected AND article is neither CT/BF/CF/IM/especial)
    const primaryCodeUpper = (newCara.articulo || '').toUpperCase();
    const isPrimaryCortesia = primaryCodeUpper.startsWith('CT');
    const isPrimaryBonificacion = primaryCodeUpper.startsWith('BF') || primaryCodeUpper.startsWith('CF');
    const isPrimaryImpresion = primaryCodeUpper.startsWith('IM');
    const isPrimaryEspecial = isEspecialArticle(primaryCodeUpper);
    const usePairMode = !!newCara.articuloBf
      && (newCara.bonificacion || 0) > 0
      && !isPrimaryCortesia
      && !isPrimaryBonificacion
      && !isPrimaryImpresion
      && !isPrimaryEspecial;

    // Reuse existing grupo_rt_bf (for edits) or create a new one (for new pairs)
    const grupoRtBfVal: number | null = usePairMode
      ? (newCara.grupo_rt_bf ?? Date.now())
      : null;

    // RT cara data (when pair mode, bonificacion is 0 — the bonificacion count lives on the BF row's `caras`)
    const caraData: Parameters<typeof propuestasService.createCara>[1] = {
      ciudad: ciudadToSave,
      estados: newCara.estados,
      tipo: newCara.tipo,
      flujo: newCara.flujo,
      bonificacion: usePairMode ? 0 : newCara.bonificacion,
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
      grupo_rt_bf: grupoRtBfVal,
    };

    // BF cara data (only built in pair mode)
    const bfCarasCount = usePairMode ? (newCara.bonificacion || 0) : 0;
    const bfCarasFlujo = Math.ceil(bfCarasCount / 2);
    const bfCarasContraflujo = Math.floor(bfCarasCount / 2);
    const bfCaraData: Parameters<typeof propuestasService.createCara>[1] | null = usePairMode && newCara.articuloBf
      ? {
          ciudad: ciudadToSave,
          estados: newCara.estados,
          tipo: newCara.tipo,
          flujo: newCara.flujo,
          bonificacion: 0,
          caras: bfCarasCount,
          nivel_socioeconomico: newCara.nivel_socioeconomico,
          formato: newCara.formato,
          costo: 0,
          tarifa_publica: 0,
          inicio_periodo: newCara.inicio_periodo,
          fin_periodo: newCara.fin_periodo,
          caras_flujo: bfCarasFlujo,
          caras_contraflujo: bfCarasContraflujo,
          articulo: newCara.articuloBf.ItemCode,
          descuento: 0,
          grupo_rt_bf: grupoRtBfVal,
        }
      : null;

    try {
      if (editingCaraId) {
        // ---- LOCAL-ONLY UPDATE (no API call for the RT cara itself) ----
        const caraToEdit = caras.find(c => c.localId === editingCaraId);
        if (caraToEdit?.id) {
          // Find existing BF pair for this RT cara (if any)
          const existingBfPair = caraToEdit.grupo_rt_bf
            ? caras.find(c =>
                c.localId !== caraToEdit.localId &&
                c.esBf &&
                c.grupo_rt_bf === caraToEdit.grupo_rt_bf &&
                c.inicio_periodo === caraToEdit.inicio_periodo &&
                c.fin_periodo === caraToEdit.fin_periodo
              )
            : null;

          // Evaluate authorization locally for UI display
          let autorizacion_dg = caraToEdit.autorizacion_dg || 'aprobado';
          let autorizacion_dcm = caraToEdit.autorizacion_dcm || 'aprobado';
          const authFieldsChanged = newCara.caras !== caraToEdit.caras_flujo + caraToEdit.caras_contraflujo
            || newCara.bonificacion !== (caraToEdit.bonificacion || 0) + (existingBfPair?.caras || 0)
            || newCara.tarifa_publica !== (caraToEdit.tarifa_publica || 0)
            || newCara.formato !== (caraToEdit.formato || '')
            || newCara.tipo !== (caraToEdit.tipo || '')
            || newCara.articulo !== (caraToEdit.articulo || '')
            || usePairMode !== !!existingBfPair
            || (usePairMode && existingBfPair && newCara.articuloBf && newCara.articuloBf.ItemCode !== existingBfPair.articulo);
          if (authFieldsChanged) {
            try {
              const resultado = await solicitudesService.evaluarAutorizacion({
                ciudad: ciudadToSave,
                estado: newCara.estados,
                formato: newCara.formato,
                tipo: newCara.tipo,
                caras: newCara.caras,
                bonificacion: newCara.bonificacion,
                costo: costoCalculado,
                tarifa_publica: newCara.tarifa_publica,
                articulo: newCara.articulo || null,
              });
              autorizacion_dg = resultado.autorizacion_dg || 'aprobado';
              autorizacion_dcm = resultado.autorizacion_dcm || 'aprobado';
            } catch (error) {
              console.error('Error evaluando autorización:', error);
            }
          }

          // --- Handle BF pair DB sync BEFORE updating local state ---
          // Cases:
          //   a) Had BF pair, still pair mode, SAME articuloBf => just update BF cara via modifiedCaras
          //   b) Had BF pair, still pair mode, DIFFERENT articuloBf => delete old BF, create new BF
          //   c) Had BF pair, now NO pair mode => delete BF cara
          //   d) Didn't have BF pair, now pair mode => create new BF cara
          let newBfCaraItem: CaraItem | null = null;
          let bfIdToRemove: number | null = null;
          let bfLocalIdToRemove: string | null = null;

          if (existingBfPair && usePairMode && bfCaraData) {
            const bfArticleChanged = newCara.articuloBf && newCara.articuloBf.ItemCode !== existingBfPair.articulo;
            if (bfArticleChanged) {
              // Delete old BF (DB) and create new BF (DB)
              if (existingBfPair.id) {
                try { await propuestasService.deleteCara(propuesta.id, existingBfPair.id); } catch (e) { console.error('Error deleting old BF pair:', e); }
              }
              bfIdToRemove = existingBfPair.id ?? null;
              bfLocalIdToRemove = existingBfPair.localId;
              const createdBf = await propuestasService.createCara(propuesta.id, bfCaraData);
              newBfCaraItem = {
                localId: `cara-${createdBf.id}`,
                id: createdBf.id,
                ciudad: bfCaraData.ciudad || '',
                estados: bfCaraData.estados || '',
                tipo: bfCaraData.tipo || '',
                flujo: bfCaraData.flujo || '',
                bonificacion: 0,
                caras: bfCarasCount,
                nivel_socioeconomico: bfCaraData.nivel_socioeconomico || '',
                formato: bfCaraData.formato || '',
                costo: 0,
                tarifa_publica: 0,
                inicio_periodo: bfCaraData.inicio_periodo || '',
                fin_periodo: bfCaraData.fin_periodo || '',
                caras_flujo: bfCarasFlujo,
                caras_contraflujo: bfCarasContraflujo,
                articulo: bfCaraData.articulo || '',
                descuento: 0,
                catorcena_inicio: newCara.catorcena_inicio,
                anio_inicio: newCara.anio_inicio,
                catorcena_fin: newCara.catorcena_fin,
                anio_fin: newCara.anio_fin,
                autorizacion_dg: createdBf.autorizacion_dg || 'aprobado',
                autorizacion_dcm: createdBf.autorizacion_dcm || 'aprobado',
                _originalDg: createdBf.autorizacion_dg || 'aprobado',
                _originalDcm: createdBf.autorizacion_dcm || 'aprobado',
                grupo_rt_bf: grupoRtBfVal,
                esBf: true,
              };
            } else {
              // Same BF article — just track BF cara update via modifiedCaras (bulk save)
              if (existingBfPair.id) {
                setModifiedCaras(prev => {
                  const next = new Map(prev);
                  next.set(existingBfPair.id!, bfCaraData);
                  return next;
                });
              }
            }
          } else if (existingBfPair && !usePairMode) {
            // Remove BF pair from DB
            if (existingBfPair.id) {
              try { await propuestasService.deleteCara(propuesta.id, existingBfPair.id); } catch (e) { console.error('Error deleting BF pair:', e); }
            }
            bfIdToRemove = existingBfPair.id ?? null;
            bfLocalIdToRemove = existingBfPair.localId;
          } else if (!existingBfPair && usePairMode && bfCaraData) {
            // Create new BF pair in DB
            const createdBf = await propuestasService.createCara(propuesta.id, bfCaraData);
            newBfCaraItem = {
              localId: `cara-${createdBf.id}`,
              id: createdBf.id,
              ciudad: bfCaraData.ciudad || '',
              estados: bfCaraData.estados || '',
              tipo: bfCaraData.tipo || '',
              flujo: bfCaraData.flujo || '',
              bonificacion: 0,
              caras: bfCarasCount,
              nivel_socioeconomico: bfCaraData.nivel_socioeconomico || '',
              formato: bfCaraData.formato || '',
              costo: 0,
              tarifa_publica: 0,
              inicio_periodo: bfCaraData.inicio_periodo || '',
              fin_periodo: bfCaraData.fin_periodo || '',
              caras_flujo: bfCarasFlujo,
              caras_contraflujo: bfCarasContraflujo,
              articulo: bfCaraData.articulo || '',
              descuento: 0,
              catorcena_inicio: newCara.catorcena_inicio,
              anio_inicio: newCara.anio_inicio,
              catorcena_fin: newCara.catorcena_fin,
              anio_fin: newCara.anio_fin,
              autorizacion_dg: createdBf.autorizacion_dg || 'aprobado',
              autorizacion_dcm: createdBf.autorizacion_dcm || 'aprobado',
              _originalDg: createdBf.autorizacion_dg || 'aprobado',
              _originalDcm: createdBf.autorizacion_dcm || 'aprobado',
              grupo_rt_bf: grupoRtBfVal,
              esBf: true,
            };
          }

          // Update local state only (NO API call for the RT cara itself)
          setCaras(prev => {
            let updated = prev.map(c =>
              c.localId === editingCaraId
                ? {
                    ...c,
                    ...newCara,
                    // Override: RT row's stored `bonificacion` is 0 in pair mode (bonif. moved to BF row)
                    bonificacion: usePairMode ? 0 : newCara.bonificacion,
                    ciudad: ciudadToSave || newCara.ciudad,
                    costo: costoCalculado,
                    grupo_rt_bf: grupoRtBfVal,
                    esBf: false,
                    autorizacion_dg,
                    autorizacion_dcm,
                    _originalDg: autorizacion_dg,
                    _originalDcm: autorizacion_dcm,
                  }
                : c
            );
            // Remove stale BF cara (if any) from local state
            if (bfLocalIdToRemove) {
              updated = updated.filter(c => c.localId !== bfLocalIdToRemove);
            }
            // If we kept the same BF article, update its caras values to match new bonificacion
            if (existingBfPair && usePairMode && newCara.articuloBf && newCara.articuloBf.ItemCode === existingBfPair.articulo) {
              updated = updated.map(c => c.localId === existingBfPair.localId
                ? {
                    ...c,
                    caras: bfCarasCount,
                    caras_flujo: bfCarasFlujo,
                    caras_contraflujo: bfCarasContraflujo,
                  }
                : c);
            }
            // Add newly created BF (if any)
            if (newBfCaraItem) {
              updated = [...updated, newBfCaraItem];
            }
            // Only re-apply impar + contamination if auth-affecting fields changed
            if (authFieldsChanged) {
              updated = updated.map(c => ({ ...c, autorizacion_dg: c._originalDg || c.autorizacion_dg, autorizacion_dcm: c._originalDcm || c.autorizacion_dcm }));
              updated = updated.map(c => {
                if (c.formato === 'Kiosco' || c.esBf) return c;
                // Sum caras across RT/BF group members (renta + bonif OR rt.caras + bf.caras)
                let total = (c.caras_flujo || 0) + (c.caras_contraflujo || 0) + (c.bonificacion || 0);
                if (c.grupo_rt_bf) {
                  const bf = updated.find(o => o.esBf && o.grupo_rt_bf === c.grupo_rt_bf && o.inicio_periodo === c.inicio_periodo && o.fin_periodo === c.fin_periodo);
                  if (bf) total = (c.caras_flujo || 0) + (c.caras_contraflujo || 0) + (bf.caras || 0);
                }
                if (total > 0 && total % 2 !== 0 && c.autorizacion_dg !== 'pendiente') return { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' };
                return c;
              });
              const hayDG = updated.some(c => c.autorizacion_dg === 'pendiente');
              if (hayDG) updated = updated.map(c => c.autorizacion_dcm === 'pendiente' ? { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' } : c);
            }
            return updated;
          });

          // Drop removed BF from modifiedCaras queue, track RT update in bulk save
          if (bfIdToRemove) {
            setModifiedCaras(prev => {
              const next = new Map(prev);
              next.delete(bfIdToRemove!);
              return next;
            });
          }
          setModifiedCaras(prev => {
            const next = new Map(prev);
            next.set(caraToEdit.id!, caraData);
            return next;
          });
        }
        setEditingCaraId(null);
        setTimeout(() => caraTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else {
        // ---- CREATE ----
        // Create the RT cara in database (needs DB ID for reservas)
        const createdCara = await propuestasService.createCara(propuesta.id, caraData);
        const newCaraItem: CaraItem = {
          ...newCara,
          id: createdCara.id,
          localId: `cara-${createdCara.id}`,
          // Override: RT row's stored `bonificacion` is 0 in pair mode
          bonificacion: usePairMode ? 0 : newCara.bonificacion,
          costo: costoCalculado,
          grupo_rt_bf: grupoRtBfVal,
          esBf: false,
          autorizacion_dg: createdCara.autorizacion_dg || 'aprobado',
          autorizacion_dcm: createdCara.autorizacion_dcm || 'aprobado',
          _originalDg: createdCara.autorizacion_dg || 'aprobado',
          _originalDcm: createdCara.autorizacion_dcm || 'aprobado',
        };

        // Create BF cara (pair) if applicable
        let createdBfItem: CaraItem | null = null;
        if (bfCaraData) {
          const createdBf = await propuestasService.createCara(propuesta.id, bfCaraData);
          createdBfItem = {
            localId: `cara-${createdBf.id}`,
            id: createdBf.id,
            ciudad: bfCaraData.ciudad || '',
            estados: bfCaraData.estados || '',
            tipo: bfCaraData.tipo || '',
            flujo: bfCaraData.flujo || '',
            bonificacion: 0,
            caras: bfCarasCount,
            nivel_socioeconomico: bfCaraData.nivel_socioeconomico || '',
            formato: bfCaraData.formato || '',
            costo: 0,
            tarifa_publica: 0,
            inicio_periodo: bfCaraData.inicio_periodo || '',
            fin_periodo: bfCaraData.fin_periodo || '',
            caras_flujo: bfCarasFlujo,
            caras_contraflujo: bfCarasContraflujo,
            articulo: bfCaraData.articulo || '',
            descuento: 0,
            catorcena_inicio: newCara.catorcena_inicio,
            anio_inicio: newCara.anio_inicio,
            catorcena_fin: newCara.catorcena_fin,
            anio_fin: newCara.anio_fin,
            autorizacion_dg: createdBf.autorizacion_dg || 'aprobado',
            autorizacion_dcm: createdBf.autorizacion_dcm || 'aprobado',
            _originalDg: createdBf.autorizacion_dg || 'aprobado',
            _originalDcm: createdBf.autorizacion_dcm || 'aprobado',
            grupo_rt_bf: grupoRtBfVal,
            esBf: true,
          };
        }

        setCaras(prev => {
          let updated = createdBfItem
            ? [...prev, newCaraItem, createdBfItem]
            : [...prev, newCaraItem];
          // Reset + impar + contamination
          updated = updated.map(c => ({ ...c, autorizacion_dg: c._originalDg || c.autorizacion_dg, autorizacion_dcm: c._originalDcm || c.autorizacion_dcm }));
          updated = updated.map(c => {
            if (c.formato === 'Kiosco' || c.esBf) return c;
            // Sum caras across RT/BF group members
            let total = (c.caras_flujo || 0) + (c.caras_contraflujo || 0) + (c.bonificacion || 0);
            if (c.grupo_rt_bf) {
              const bf = updated.find(o => o.esBf && o.grupo_rt_bf === c.grupo_rt_bf && o.inicio_periodo === c.inicio_periodo && o.fin_periodo === c.fin_periodo);
              if (bf) total = (c.caras_flujo || 0) + (c.caras_contraflujo || 0) + (bf.caras || 0);
            }
            if (total > 0 && total % 2 !== 0 && c.autorizacion_dg !== 'pendiente') return { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' };
            return c;
          });
          const hayDG = updated.some(c => c.autorizacion_dg === 'pendiente');
          if (hayDG) updated = updated.map(c => c.autorizacion_dcm === 'pendiente' ? { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' } : c);
          return updated;
        });

        // Track caras as modified so bulk save re-processes auth
        setModifiedCaras(prev => {
          const next = new Map(prev);
          next.set(createdCara.id, caraData);
          if (createdBfItem?.id && bfCaraData) next.set(createdBfItem.id, bfCaraData);
          return next;
        });
      }

      setNewCara(EMPTY_CARA);
      setSelectedArticulo(null);
      setShowAddCaraForm(false);
    } catch (error) {
      console.error('Error saving cara:', error);
      alert('Error al guardar la cara');
    }
  };

  // Bulk save ALL pending changes (propuesta summary + modified caras) in one action
  const handleBulkSaveChanges = async () => {
    const hasPropuestaChanges = hasChanges;
    const hasCaraChanges = modifiedCaras.size > 0;

    if (!hasPropuestaChanges && !hasCaraChanges) {
      showToast('No hay cambios pendientes', 'info');
      return;
    }

    if (invalidCaras.length > 0) {
      showToast(`No se puede guardar: ${invalidCaras.length} cara(s) tienen catorcenas fuera del rango configurado`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const messages: string[] = [];

      // 1. Save propuesta summary changes if any
      if (hasPropuestaChanges) {
        await propuestasService.updatePropuesta(propuesta.id, {
          nombre_campania: nombreCampania,
          notas,
          descripcion,
          year_inicio: yearInicio,
          catorcena_inicio: catorcenaInicio,
          year_fin: yearFin,
          catorcena_fin: catorcenaFin,
          IMU: imu,
          ...(clienteChanged && selectedClienteCuic ? {
            cliente_id: selectedClienteCuic.CUIC,
            cuic: selectedClienteCuic.CUIC,
            razon_social: selectedClienteCuic.T0_U_RazonSocial,
            unidad_negocio: selectedClienteCuic.T1_U_UnidadNegocio,
            marca_id: selectedClienteCuic.T1_U_IDMarca,
            marca_nombre: selectedClienteCuic.T2_U_Marca,
            asesor: selectedClienteCuic.ASESOR_U_Asesor,
            producto_id: selectedClienteCuic.T2_U_IDProducto,
            producto_nombre: selectedClienteCuic.T2_U_Producto,
            agencia: selectedClienteCuic.T0_U_Agencia,
            categoria_id: selectedClienteCuic.T2_U_IDCategoria,
            categoria_nombre: selectedClienteCuic.T2_U_Categoria,
            sap_database: selectedClienteCuic.sap_database,
          } : {}),
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
          asignadosIds: asignados.map(u => u.id).join(','),
          imu,
        });
        setClienteChanged(false);
        messages.push('Propuesta actualizada');
      }

      // 2. Bulk save modified caras if any
      if (hasCaraChanges) {
        const carasArray = Array.from(modifiedCaras.entries()).map(([caraId, data]) => ({
          caraId,
          data,
        }));

        const result = await propuestasService.bulkUpdateCaras(propuesta.id, carasArray);

        // Update local state with server response (authorization statuses)
        if (result.updated && result.updated.length > 0) {
          setCaras(prev => {
            let updated = prev.map(c => {
              const serverCara = result.updated.find(u => u.id === c.id);
              if (serverCara) {
                return {
                  ...c,
                  autorizacion_dg: serverCara.autorizacion_dg || c.autorizacion_dg,
                  autorizacion_dcm: serverCara.autorizacion_dcm || c.autorizacion_dcm,
                  _originalDg: serverCara.autorizacion_dg || c.autorizacion_dg,
                  _originalDcm: serverCara.autorizacion_dcm || c.autorizacion_dcm,
                };
              }
              return c;
            });
            // Server already returned correct authorization - no need to re-apply impar/contamination
            return updated;
          });
        }

        // Clear modified caras tracking
        setModifiedCaras(new Map());
        messages.push(result.message || `${carasArray.length} circuito(s) actualizados`);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', propuesta.id] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', propuesta.id] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details', propuesta.solicitud_id] });

      showToast(messages.join(' | '), 'success');
    } catch (error) {
      console.error('Error in bulk save:', error);
      showToast(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel cara form
  const handleCancelCaraForm = () => {
    const wasEditing = !!editingCaraId;
    setNewCara(EMPTY_CARA);
    setSelectedArticulo(null);
    setShowAddCaraForm(false);
    setEditingCaraId(null);
    if (wasEditing) {
      setTimeout(() => caraTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
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

  // Filter for spot único - collapse digital inventories to 1 row per inventario with spots indicator
  const filterSpotUnico = useCallback((inventarios: ProcessedInventoryItem[]): ProcessedInventoryItem[] => {
    const digitalGroups = new Map<number, ProcessedInventoryItem[]>();
    const result: ProcessedInventoryItem[] = [];

    for (const inv of inventarios) {
      const isDigital = inv.tradicional_digital === 'Digital' || (inv.total_espacios && inv.total_espacios > 0);
      if (isDigital) {
        const group = digitalGroups.get(inv.id) || [];
        group.push(inv);
        digitalGroups.set(inv.id, group);
      } else {
        result.push(inv);
      }
    }

    // Per digital group, collapse to 1 row with first available espacio
    for (const [, group] of digitalGroups) {
      const representative = { ...group[0] } as ProcessedInventoryItem;
      representative.spots_disponibles = group.length;
      representative.isCollapsedSpot = true;
      result.push(representative);
    }

    return result;
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
        const flujoItem = group.find(g => String(g.tipo_de_cara).startsWith('Flujo'));
        const contraflujoItem = group.find(g => String(g.tipo_de_cara).startsWith('Contraflujo'));

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

  // Group reservados by distance (anti-cannibalization for reserved items)
  const groupByDistanceFuncReservados = useCallback((items: ReservaItem[]): (ReservaItem & { grupo?: string })[] => {
    if (items.length === 0) return [];

    const withCoords = items.filter(r =>
      r.latitud && r.longitud && typeof r.latitud === 'number' && typeof r.longitud === 'number' &&
      !isNaN(r.latitud) && !isNaN(r.longitud)
    );
    const withoutCoords = items.filter(r =>
      !r.latitud || !r.longitud || typeof r.latitud !== 'number' || typeof r.longitud !== 'number' ||
      isNaN(r.latitud) || isNaN(r.longitud)
    );

    if (withCoords.length === 0) {
      return items.map(r => ({ ...r, grupo: 'Grupo 1' }));
    }

    const grupos: ReservaItem[][] = [];
    const remaining = [...withCoords];

    while (remaining.length > 0) {
      const grupo: ReservaItem[] = [remaining.shift()!];

      while (grupo.length < tamanoGrupoReservados && remaining.length > 0) {
        let bestIdx = -1;
        let bestScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const candidate = remaining[i];
          let minDist = Infinity;

          for (const member of grupo) {
            const dist = haversineDistance(
              candidate.latitud, candidate.longitud,
              member.latitud, member.longitud
            );
            if (dist < minDist) minDist = dist;
          }

          if (minDist >= distanciaGruposReservados) {
            const score = Math.abs(minDist - distanciaGruposReservados * 1.2);
            if (score < bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }
        }

        if (bestIdx >= 0) {
          grupo.push(remaining.splice(bestIdx, 1)[0]);
        } else {
          break;
        }
      }

      grupos.push(grupo);
    }

    if (withoutCoords.length > 0) {
      grupos.push(withoutCoords);
    }

    return grupos.flatMap((grupo, idx) => {
      const isLastGroup = idx === grupos.length - 1 && withoutCoords.length > 0;
      const groupName = isLastGroup ? 'Sin ubicación' : `Grupo ${idx + 1}`;
      return grupo.map(r => ({ ...r, grupo: groupName }));
    });
  }, [tamanoGrupoReservados, distanciaGruposReservados, haversineDistance]);

  // Group by list order - chunk items sequentially (disponibles)
  const groupByListFunc = useCallback((inventarios: ProcessedInventoryItem[]): ProcessedInventoryItem[] => {
    if (inventarios.length === 0) return [];
    return inventarios.map((inv, idx) => ({
      ...inv,
      grupo: `Grupo ${Math.floor(idx / tamanoGrupo) + 1}`,
    }));
  }, [tamanoGrupo]);

  // Group by list order - chunk items sequentially (reservados)
  const groupByListFuncReservados = useCallback((items: ReservaItem[]): (ReservaItem & { grupo?: string })[] => {
    if (items.length === 0) return [];
    return items.map((r, idx) => ({
      ...r,
      grupo: `Grupo ${Math.floor(idx / tamanoGrupoReservados) + 1}`,
    }));
  }, [tamanoGrupoReservados]);

  // Handle search inventory - open search view and fetch disponibles
  const handleSearchInventory = async (cara: CaraItem) => {
    setSelectedCaraForSearch(cara);
    // Calculate % from actual DB values
    const totalRenta = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0);
    setFlujoPct(totalRenta > 0 ? Math.round((cara.caras_flujo || 0) / totalRenta * 100) : 50);
    setViewState('search-inventory');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setGroupByDistance(false);
    setSelectedInventory(new Set());
    setFlujoFilter('Todos'); // Always start with all
    setSortColumn('codigo_unico');
    setSortDirection('asc');
    setExcluirCategoria('');
    setCsvFile(null);
    setCsvData([]);
    setShowCsvSection(false);

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

      // Translate "Ciudad de México / AM" to real states
      const estadoParam = cara.estados === 'Ciudad de México / AM' ? 'Ciudad de México,Estado de México' : cara.estados;
      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: estadoParam || undefined,
        formato: cara.formato || undefined,
        // Don't filter by flujo in backend - get all and filter in frontend
        nse: cara.nivel_socioeconomico || undefined,
        tipo: cara.tipo || undefined,
        fecha_inicio: cara.inicio_periodo || undefined,
        fecha_fin: cara.fin_periodo || undefined,
        solicitudCaraId: cara.id,
        excluir_categoria: excluirCategoria || undefined,
        excluir_distancia_km: excluirCategoria ? excluirDistanciaKm : undefined,
      });
      setInventarioDisponible(response.data || []);
    } catch (error) {
      console.error('Error fetching disponibles:', error);
      setInventarioDisponible([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Re-search when excluirCategoria changes (if already in search view)
  useEffect(() => {
    if (viewState === 'search-inventory' && selectedCaraForSearch) {
      handleSearchInventory(selectedCaraForSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excluirCategoria, excluirDistanciaKm]);

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

      const estadoParam2 = selectedCaraForSearch.estados === 'Ciudad de México / AM' ? 'Ciudad de México,Estado de México' : selectedCaraForSearch.estados;
      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: estadoParam2 || undefined,
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

    // Filter out items that are already reserved for the CURRENT cara only
    const currentCaraReservedIds = new Set(
      reservas
        .filter(r => selectedCaraForSearch && (r.solicitudCaraId === selectedCaraForSearch.id))
        .map(r => r.inventario_id)
    );
    data = data.filter(inv => !currentCaraReservedIds.has(inv.id));

    // Apply text search filter
    if (disponiblesSearchTerm.trim()) {
      const term = disponiblesSearchTerm.toLowerCase();
      data = data.filter(inv =>
        inv.codigo_unico?.toLowerCase().includes(term) ||
        inv.plaza?.toLowerCase().includes(term) ||
        inv.ubicacion?.toLowerCase().includes(term) ||
        inv.tipo_de_cara?.toLowerCase().includes(term) ||
        inv.nivel_socioeconomico?.toLowerCase().includes(term) ||
        inv.mueble?.toLowerCase().includes(term)
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

    // Spot único - collapse digital items to 1 row per inventario
    if (showSpotUnico) {
      data = filterSpotUnico(data);
    }

    // Filter by isla - toggle: SI / NO / off
    if (islaFilter === 'si') {
      data = data.filter(inv => inv.isla?.toUpperCase() === 'SI');
    } else if (islaFilter === 'no') {
      data = data.filter(inv => !inv.isla || inv.isla.toUpperCase() !== 'SI');
    }

    // Filter by mundialista - toggle: SI / NO / off
    if (mundialistaFilter === 'si') {
      data = data.filter(inv => (inv as any).mueble_isla?.toUpperCase() === 'SI');
    } else if (mundialistaFilter === 'no') {
      data = data.filter(inv => !(inv as any).mueble_isla || (inv as any).mueble_isla.toUpperCase() !== 'SI');
    }

    // Apply grouping (distance or list)
    if (groupByDistance) {
      data = groupMode === 'distancia' ? groupByDistanceFunc(data) : groupByListFunc(data);
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
        case 'isla':
          aVal = a.isla || '';
          bVal = b.isla || '';
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
  }, [inventarioDisponible, disponiblesSearchTerm, poiFilterIds, flujoFilter, showOnlyUnicos, showOnlyCompletos, showOnlyUnicosDigitales, showSpotUnico, islaFilter, mundialistaFilter, groupByDistance, groupMode, filterUnicos, filterCompletos, filterUnicosDigitales, filterSpotUnico, groupByDistanceFunc, groupByListFunc, sortColumn, sortDirection, reservas]);

  // Check if an inventory item is selected
  const isInventorySelected = useCallback((inv: InventarioDisponible | ProcessedInventoryItem): boolean => {
    return selectedInventory.has(getInventoryKey(inv));
  }, [selectedInventory, getInventoryKey]);

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
      inv.tradicional_digital === 'Digital'
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
    setShowSpotUnico(false);
    setIslaFilter('off');
    setMundialistaFilter('off');
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

      // Match with inventory - try multiple possible column names
      const matched = parsedData.map(row => {
        const codigoUnico = getValueByColumnName(row, 'codigo_unico')
          || getValueByColumnName(row, 'codigo')
          || getValueByColumnName(row, 'código')
          || getValueByColumnName(row, 'código_único')
          || getValueByColumnName(row, 'codigo_unico');
        const code = codigoUnico?.trim() || '';
        const exists = code !== '' && processedInventory.some(inv => inv.codigo_unico === code);
        return {
          codigo_unico: code || 'N/A',
          disponibilidad: exists ? 'Disponible' as const : 'No Disponible' as const,
        };
      });

      setCsvData(matched);
      setShowCsvSection(true);
    };

    reader.readAsText(file);
  }, [processedInventory]);

  const handleSelectFromCsv = useCallback(() => {
    const availableCodes = new Set(
      csvData
        .filter(row => row.disponibilidad === 'Disponible')
        .map(row => row.codigo_unico)
    );

    setShowCsvSection(false);

    // Select directly from processedInventory (what the table shows RIGHT NOW)
    const newKeys = new Set<string>();
    processedInventory.forEach(inv => {
      if (inv.codigo_unico && availableCodes.has(inv.codigo_unico)) {
        newKeys.add(getInventoryKey(inv));
      }
    });
    setSelectedInventory(newKeys);
  }, [csvData, processedInventory, getInventoryKey]);

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
    const headers = ['codigo_unico', 'Tipo', 'Plaza', 'NSE', 'Ubicación'];

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
    const allSelected = items.every(inv => isInventorySelected(inv));
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
    console.log('[Reservar] selectedInventory size:', selectedInventory.size, 'keys:', [...selectedInventory]);
    console.log('[Reservar] selectedCaraForSearch:', selectedCaraForSearch ? { id: selectedCaraForSearch.id, caras_flujo: selectedCaraForSearch.caras_flujo, caras_contraflujo: selectedCaraForSearch.caras_contraflujo } : null);
    console.log('[Reservar] remainingToAssign:', remainingToAssign);
    if (!selectedCaraForSearch || selectedInventory.size === 0) { console.log('[Reservar] ABORT: no cara or no selection'); return; }

    // Get all selected items from processedInventory
    const selectedItems = processedInventory.filter(i => isInventorySelected(i));
    console.log('[Reservar] selectedItems:', selectedItems.length, selectedItems.map(i => ({ key: getInventoryKey(i), codigo: i.codigo_unico, tipo: i.tipo_de_cara, id: i.id, isCompleto: i.isCompleto })));
    if (selectedItems.length === 0) { console.log('[Reservar] ABORT: no items matched'); return; }
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
        const hasFlujo = selectedItems.some(i => i.codigo_unico?.startsWith(baseCode) && String(i.tipo_de_cara).startsWith('Flujo'));
        const hasContra = selectedItems.some(i => i.codigo_unico?.startsWith(baseCode) && String(i.tipo_de_cara).startsWith('Contraflujo'));
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
          const tipo = String(inv.tipo_de_cara).startsWith('Flujo') ? 'Flujo' : 'Contraflujo';
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

      console.log('[Reservar] newReservas:', newReservas.length, newReservas);
      console.log('[Reservar] flujoCount:', flujoCount, 'contraflujoCount:', contraflujoCount);
      if (newReservas.length === 0) {
        console.log('[Reservar] ABORT: 0 reservas built. remainingToAssign:', remainingToAssign);
        // Build specific error message
        const reasons: string[] = [];
        if (remainingToAssign.flujo <= 0 && remainingToAssign.contraflujo <= 0 && remainingToAssign.bonificacion <= 0) {
          reasons.push('Todas las caras (Flujo, Contraflujo y Bonificación) ya están completas');
        } else {
          if (remainingToAssign.flujo <= 0) reasons.push('Flujo ya está completo');
          if (remainingToAssign.contraflujo <= 0) reasons.push('Contraflujo ya está completo');
          const selectedItems = Array.from(selectedInventory).map(id => processedInventory.find(i => Number(i.id) === Number(id))).filter(Boolean);
          const selectedFlujo = selectedItems.filter(i => String(i!.tipo_de_cara).startsWith('Flujo')).length;
          const selectedContra = selectedItems.filter(i => String(i!.tipo_de_cara).startsWith('Contraflujo')).length;
          if (selectedFlujo > 0 && remainingToAssign.flujo <= 0) reasons.push(`Seleccionaste ${selectedFlujo} Flujo pero ya no caben más`);
          if (selectedContra > 0 && remainingToAssign.contraflujo <= 0) reasons.push(`Seleccionaste ${selectedContra} Contraflujo pero ya no caben más`);
        }
        showToast(reasons.length > 0 ? reasons.join('. ') : 'No hay caras disponibles para reservar', 'error');
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

    const isCT = (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT');
    setConfirmModal({
      isOpen: true,
      title: isCT ? 'Confirmar Cortesía' : 'Confirmar Bonificación',
      message: `¿Estás seguro de ${isCT ? 'asignar como cortesía' : 'bonificar'} ${selectedInventory.size} espacios?`,
      confirmText: isCT ? 'Cortesía' : 'Bonificar',
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

    // Filter by isla - only show items that have "ISLA" in the isla column
    if (showOnlyIslaReservados) {
      data = data.filter(r => r.isla?.toUpperCase() === 'SI');
    }

    // Filter by search term
    if (reservadosSearchTerm.trim()) {
      const term = reservadosSearchTerm.toLowerCase();
      data = data.filter(r =>
        r.codigo_unico?.toLowerCase().includes(term) ||
        r.plaza?.toLowerCase().includes(term) ||
        r.ubicacion?.toLowerCase().includes(term) ||
        r.tipo?.toLowerCase().includes(term) ||
        r.formato?.toLowerCase().includes(term) ||
        r.isla?.toLowerCase().includes(term)
      );
    }

    // Apply grouping (distance or list)
    if (groupByDistanceReservados) {
      data = groupModeReservados === 'distancia' ? groupByDistanceFuncReservados(data) : groupByListFuncReservados(data);
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
  }, [currentCaraReservasMerged, reservadosSearchTerm, reservadosTipoFilter, showOnlyIslaReservados, groupByDistanceReservados, groupModeReservados, groupByDistanceFuncReservados, groupByListFuncReservados, reservadosSortColumn, reservadosSortDirection]);

  // Group reservados by distance (computed from filteredReservados)
  const groupedReservadosByDistance = useMemo(() => {
    if (!groupByDistanceReservados) return null;

    const groups: Record<string, ReservaItem[]> = {};
    filteredReservados.forEach(r => {
      const groupName = r.grupo || 'Sin grupo';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(r);
    });

    return Object.entries(groups).sort((a, b) => {
      const numA = parseInt(a[0].replace('Grupo ', '')) || 999;
      const numB = parseInt(b[0].replace('Grupo ', '')) || 999;
      return numA - numB;
    });
  }, [filteredReservados, groupByDistanceReservados]);

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

  // Toggle distance group expansion (reservados)
  const toggleGroupExpansionReservados = (groupName: string) => {
    setExpandedGroupsReservados(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  // Toggle all items in a distance group (reservados)
  const toggleAllInGroupReservados = (items: ReservaItem[]) => {
    const allSelected = items.every(r => selectedReservados.has(r.id));
    setSelectedReservados(prev => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach(r => next.delete(r.id));
      } else {
        items.forEach(r => next.add(r.id));
      }
      return next;
    });
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
    // Handle "completo" grouped items (muebles completos)
    if (reservaId.startsWith('completo-')) {
      const grupoId = Number(reservaId.replace('completo-', ''));
      const groupReservas = reservas.filter(r => r.grupo_completo_id === grupoId);
      const backendIds = groupReservas.filter(r => r.reservaId).map(r => r.reservaId!);

      if (backendIds.length === 0) {
        setReservas(prev => prev.filter(r => r.grupo_completo_id !== grupoId));
        return;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Eliminar Mueble Completo',
        message: `¿Seguro que quieres eliminar este mueble completo? (${groupReservas.length} reservas)`,
        confirmText: 'Eliminar',
        isDestructive: true,
        onConfirm: async () => {
          setIsSaving(true);
          try {
            await propuestasService.deleteReservas(propuesta.id, backendIds);
            queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
            queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] });
            handleRefetchDisponibles();

            setReservas(prev => prev.filter(r => r.grupo_completo_id !== grupoId));
            showToast('Mueble completo eliminado correctamente', 'success');
          } catch (error) {
            console.error('Error deleting grupo completo:', error);
            showToast('Error al eliminar mueble completo', 'error');
          } finally {
            setIsSaving(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        }
      });
      return;
    }

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
        setIsSaving(true);
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
          setIsSaving(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Open edit panel for reserva
  const handleEditReserva = (reserva: ReservaItem) => {
    setEditingReserva(reserva);
    setEditingFormato(reserva.formato || '');
    setEditingPlaza(reserva.plaza || '');
  };

  // Save edited formato and plaza
  const handleSaveFormato = () => {
    if (!editingReserva) return;
    setReservas(prev => prev.map(r =>
      r.id === editingReserva.id
        ? { ...r, formato: editingFormato, plaza: editingPlaza }
        : r
    ));
    setEditingReserva(null);
    setEditingFormato('');
    setEditingPlaza('');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingReserva(null);
    setEditingFormato('');
    setEditingPlaza('');
  };

  // Bulk delete selected reservas
  const handleBulkDeleteReservas = () => {
    // Expand "completo-" IDs to their individual reservas
    const expandedIds = new Set<string>();
    selectedReservados.forEach(id => {
      if (id.startsWith('completo-')) {
        const grupoId = Number(id.replace('completo-', ''));
        reservas.filter(r => r.grupo_completo_id === grupoId).forEach(r => expandedIds.add(r.id));
      } else {
        expandedIds.add(id);
      }
    });
    // Get selected reservas
    const selectedReservasList = reservas.filter(r => expandedIds.has(r.id));
    if (selectedReservasList.length === 0) return;

    // Separate reservas with backend IDs from those without
    const reservasWithBackendId = selectedReservasList.filter(r => r.reservaId);
    const reservasLocalOnly = selectedReservasList.filter(r => !r.reservaId);
    const backendIds = reservasWithBackendId.map(r => r.reservaId!);

    // If all are local-only (not saved to DB yet), just remove from state
    if (backendIds.length === 0) {
      setReservas(prev => prev.filter(r => !expandedIds.has(r.id)));
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
        setIsSaving(true);
        try {
          // Delete from backend if there are any with reservaId
          if (backendIds.length > 0) {
            await propuestasService.deleteReservas(propuesta.id, backendIds);
            queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', propuesta.id] });
            queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', propuesta.id] });
            handleRefetchDisponibles();
          }

          // Remove all selected from local state
          setReservas(prev => prev.filter(r => !expandedIds.has(r.id)));
          setSelectedReservados(new Set());
          showToast(`${selectedReservasList.length} reserva(s) eliminada(s) correctamente`, 'success');
        } catch (error) {
          console.error('Error deleting reservas:', error);
          showToast('Error al eliminar reservas', 'error');
        } finally {
          setIsSaving(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (!isOpen) return null;

  // Overlay bloqueante global cuando se está guardando fuera del confirmModal
  const savingOverlayJSX = isSaving && !confirmModal.isOpen && (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[1px]" role="status" aria-live="polite">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900'}`}>
        <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        <span className="text-sm font-medium">Guardando...</span>
        <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Por favor no cierres ni navegues</span>
      </div>
    </div>
  );

  // Confirmation modal content reused in both views
  const confirmModalJSX = confirmModal.isOpen && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isSaving && setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
      <div className={`relative ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-xl shadow-2xl p-6 w-[400px] animate-in fade-in zoom-in duration-200`}>
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>{confirmModal.title}</h3>
        <p className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-6`}>{confirmModal.message}</p>
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
            className={`px-4 py-2 rounded-lg ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmModal.cancelText || 'Cancelar'}
          </button>
          <button
            onClick={confirmModal.onConfirm}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg ${isDark ? 'text-white' : 'text-gray-900'} transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${confirmModal.isDestructive
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
        {savingOverlayJSX}
        {confirmModalJSX}
        {toastJSX}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleBackToMain} />

        <div className={`relative w-[95vw] max-w-[1600px] h-[90vh] ${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border border-purple-500/20 shadow-2xl flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Buscar Inventario</h2>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  {selectedCaraForSearch?.formato} - {selectedCaraForSearch?.ciudad || selectedCaraForSearch?.estados}
                </p>
              </div>
            </div>
            <button onClick={handleBackToMain} className={`p-2 rounded-lg ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Compact KPIs with progress bars */}
          <div className={`px-6 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900/90' : 'bg-gradient-to-r from-gray-50 via-gray-50/95 to-gray-50/90'}`}>
            <div className="flex items-center gap-4">
              {/* Flujo KPI */}
              <div className={`flex-1 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-xl p-3 border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} flex items-center gap-1.5`}>
                    <div className={`w-2 h-2 rounded-full ${isNoInventoryArticle((selectedCaraForSearch?.articulo || '').toUpperCase()) ? (isEspecialArticle((selectedCaraForSearch?.articulo || '').toUpperCase()) ? 'bg-violet-500' : 'bg-amber-500') : 'bg-blue-500'}`} />
                    {isEspecialArticle((selectedCaraForSearch?.articulo || '').toUpperCase()) ? 'Ejec. Especiales' : (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('IM') ? 'Impresiones' : 'Flujo'}
                  </span>
                  <span className="text-sm font-bold text-blue-400">
                    {adjustedCarasFlujo.flujo - remainingToAssign.flujo} / {adjustedCarasFlujo.flujo}
                  </span>
                </div>
                <div className={`w-full h-2 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200/50'} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (adjustedCarasFlujo.flujo - remainingToAssign.flujo) / (adjustedCarasFlujo.flujo || 1) * 100)}%` }}
                  />
                </div>
                <div className={`mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <span className="text-blue-400 font-medium">{remainingToAssign.flujo}</span> restantes
                </div>
              </div>

              {/* % Distribucion - only for Digital */}
              {selectedCaraForSearch?.tipo === 'Digital' && <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-xl ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50/30'} border ${isDark ? 'border-zinc-700/20' : 'border-gray-200/20'} min-w-[70px]`}>
                <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1`}>Distribución</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={flujoPct}
                    onChange={async (e) => {
                      const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                      setFlujoPct(v);
                      if (!selectedCaraForSearch?.id) return;
                      const totalRenta = selectedCaraForSearch.caras || ((selectedCaraForSearch.caras_flujo || 0) + (selectedCaraForSearch.caras_contraflujo || 0));
                      if (totalRenta === 0) return;
                      const newFlujo = Math.ceil(totalRenta * v / 100);
                      const newContra = totalRenta - newFlujo;
                      setSavingPct(true);
                      try {
                        await propuestasService.updateCara(propuesta.id, selectedCaraForSearch.id, {
                          caras_flujo: newFlujo,
                          caras_contraflujo: newContra,
                        } as any);
                        const updatedCara = { ...selectedCaraForSearch, caras_flujo: newFlujo, caras_contraflujo: newContra };
                        setSelectedCaraForSearch(updatedCara);
                        setCaras(prev => prev.map(c => c.id === selectedCaraForSearch.id
                          ? { ...c, caras_flujo: newFlujo, caras_contraflujo: newContra }
                          : c
                        ));
                      } catch (err) {
                        console.error('Error guardando distribución:', err);
                      } finally {
                        setSavingPct(false);
                      }
                    }}
                    className={`w-10 text-center text-xs font-bold ${isDark ? 'bg-zinc-800 border-zinc-700 text-blue-400' : 'bg-white border-gray-200 text-blue-600'} border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                  />
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>%</span>
                </div>
                <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-gray-300'} mt-0.5`}>{savingPct ? '...' : `${flujoPct}/${100 - flujoPct}`}</span>
              </div>}

              {/* Contraflujo KPI */}
              <div className={`flex-1 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-xl p-3 border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} flex items-center gap-1.5`}>
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Contraflujo
                  </span>
                  <span className="text-sm font-bold text-blue-400">
                    {adjustedCarasFlujo.contraflujo - remainingToAssign.contraflujo} / {adjustedCarasFlujo.contraflujo}
                  </span>
                </div>
                <div className={`w-full h-2 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200/50'} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (adjustedCarasFlujo.contraflujo - remainingToAssign.contraflujo) / (adjustedCarasFlujo.contraflujo || 1) * 100)}%` }}
                  />
                </div>
                <div className={`mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <span className="text-blue-400 font-medium">{remainingToAssign.contraflujo}</span> restantes
                </div>
              </div>

              {/* Bonificacion/Cortesia KPI */}
              <div className={`flex-1 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-xl p-3 border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} flex items-center gap-1.5`}>
                    <div className={`w-2 h-2 rounded-full ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
                    {(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}
                  </span>
                  <span className={`text-sm font-bold ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {(selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion} / {selectedCaraForSearch?.bonificacion || 0}
                  </span>
                </div>
                <div className={`w-full h-2 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200/50'} rounded-full overflow-hidden`}>
                  <div
                    className={`h-full bg-gradient-to-r ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'from-cyan-500 to-cyan-400' : 'from-emerald-500 to-emerald-400'} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, ((selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion) / (selectedCaraForSearch?.bonificacion || 1) * 100)}%` }}
                  />
                </div>
                <div className={`mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <span className={`${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'text-cyan-400' : 'text-emerald-400'} font-medium`}>{remainingToAssign.bonificacion}</span> restantes
                </div>
              </div>

              {/* Selection count */}
              <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 min-w-[100px]">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span className="text-xl font-bold text-purple-300">{searchViewTab === 'buscar' ? selectedInventory.size : currentCaraReservas.length}</span>
                </div>
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{searchViewTab === 'buscar' ? 'seleccionados' : 'reservados'}</span>
              </div>
            </div>
          </div>

          {/* Tabs: Buscar / Reservados */}
          <div className={`px-6 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900/70' : 'bg-gray-50/70'}`}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchViewTab('buscar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchViewTab === 'buscar'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`
                  }`}
              >
                <Search className="h-4 w-4" />
                Buscar Disponibles
              </button>
              <button
                onClick={() => setSearchViewTab('reservados')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${searchViewTab === 'reservados'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`
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
              <div className={`px-6 py-2.5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900/50' : 'bg-gray-50/50'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Flujo Toggle */}
                  <div className={`flex ${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} rounded-lg p-0.5 border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'}`}>
                    {(['Todos', 'Flujo', 'Contraflujo'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setFlujoFilter(opt)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${flujoFilter === opt
                          ? 'bg-blue-500 text-white shadow'
                          : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className={`w-px h-6 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

                  {/* Complete filter */}
                  <button
                    onClick={() => { setShowOnlyCompletos(!showOnlyCompletos); if (!showOnlyCompletos) setShowOnlyUnicos(false); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyCompletos
                      ? 'bg-pink-500 text-white shadow'
                      : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
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
                        : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
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
                        : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                        }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Únicos Digitales
                      {showOnlyUnicosDigitales && (
                        <X className="h-3 w-3 ml-0.5 hover:text-orange-200" onClick={(e) => { e.stopPropagation(); setShowOnlyUnicosDigitales(false); }} />
                      )}
                    </button>
                  )}

                  {/* Spot único filter - only show when there are digital items */}
                  {hasDigitalInventory && (
                    <button
                      onClick={() => setShowSpotUnico(!showSpotUnico)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showSpotUnico
                        ? 'bg-violet-500 text-white shadow'
                        : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                        }`}
                      title="Mostrar inventarios digitales una sola vez con indicador de spots disponibles"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Spot único
                      {showSpotUnico && (
                        <X className="h-3 w-3 ml-0.5 hover:text-violet-200" onClick={(e) => { e.stopPropagation(); setShowSpotUnico(false); }} />
                      )}
                    </button>
                  )}

                  {/* Isla filter - 3-state toggle: off → SI → NO → off */}
                  <button
                    onClick={() => {
                      const next = islaFilter === 'off' ? 'si' : islaFilter === 'si' ? 'no' : 'off';
                      setIslaFilter(next);
                      if (next === 'si') { setSortColumn('codigo_unico'); setSortDirection('asc'); }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${islaFilter === 'si'
                      ? 'bg-teal-500 text-white shadow'
                      : islaFilter === 'no'
                        ? 'bg-red-500/80 text-white shadow'
                        : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                      }`}
                    title={islaFilter === 'off' ? 'Filtrar islas' : islaFilter === 'si' ? 'Mostrando islas (click: sin islas)' : 'Sin islas (click: quitar filtro)'}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {islaFilter === 'si' ? 'Isla ✓' : islaFilter === 'no' ? 'Isla ✗' : 'Isla'}
                  </button>

                  {/* Mundialista filter - 3-state toggle: off → SI → NO → off */}
                  <button
                    onClick={() => {
                      const next = mundialistaFilter === 'off' ? 'si' : mundialistaFilter === 'si' ? 'no' : 'off';
                      setMundialistaFilter(next);
                      if (next === 'si') { setSortColumn('codigo_unico'); setSortDirection('asc'); }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${mundialistaFilter === 'si'
                      ? 'bg-green-600 text-white shadow'
                      : mundialistaFilter === 'no'
                        ? 'bg-red-500/80 text-white shadow'
                        : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                      }`}
                    title={mundialistaFilter === 'off' ? 'Filtrar mundialista' : mundialistaFilter === 'si' ? 'Mostrando mundialistas (click: sin mundialistas)' : 'Sin mundialistas (click: quitar filtro)'}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {mundialistaFilter === 'si' ? 'Mundial ✓' : mundialistaFilter === 'no' ? 'Mundial ✗' : 'Mundial'}
                  </button>

                  {/* Grouping */}
                  <button
                    onClick={() => setGroupByDistance(!groupByDistance)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${groupByDistance
                      ? 'bg-green-500 text-white shadow'
                      : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
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
                      <div className={`flex items-center gap-0.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg p-0.5`}>
                        <button
                          onClick={() => setGroupMode('distancia')}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupMode === 'distancia' ? 'bg-green-500/30 text-green-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}`}
                        >
                          Distancia
                        </button>
                        <button
                          onClick={() => setGroupMode('listado')}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupMode === 'listado' ? 'bg-green-500/30 text-green-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}`}
                        >
                          Listado
                        </button>
                      </div>
                      {groupMode === 'distancia' && (
                        <select
                          value={distanciaGrupos}
                          onChange={(e) => setDistanciaGrupos(parseInt(e.target.value))}
                          className={`px-2 py-1 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg ${isDark ? 'text-white' : 'text-gray-900'}`}
                        >
                          <option value={100}>100m</option>
                          <option value={200}>200m</option>
                          <option value={500}>500m</option>
                          <option value={1000}>1km</option>
                          <option value={1500}>1.5km</option>
                          <option value={2000}>2km</option>
                          <option value={3000}>3km</option>
                        </select>
                      )}
                      <input
                        type="number"
                        value={tamanoGrupo}
                        onChange={(e) => setTamanoGrupo(parseInt(e.target.value) || 10)}
                        className={`w-14 px-2 py-1 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg ${isDark ? 'text-white' : 'text-gray-900'}`}
                        min={2}
                        max={50}
                        title="Tamaño de grupo"
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

                  {/* Category Exclusion Filter - HIDDEN */}

                  <div className={`w-px h-6 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

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
                      : `${isDark ? 'bg-zinc-800/80' : 'bg-gray-100/80'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'}`
                      }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {csvFile ? csvFile.name.substring(0, 15) + '...' : 'Subir CSV'}
                  </button>
                  <button
                    onClick={() => {
                      const csv = '\ufeffcodigo_unico\nEJEMPLO-001_Flujo_Ciudad';
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'plantilla_inventario.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700/50 transition-all"
                    title="Descargar plantilla CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
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

                  <div className={`w-px h-6 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />

                  {/* Text search */}
                  <div className="relative">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      value={disponiblesSearchTerm}
                      onChange={(e) => setDisponiblesSearchTerm(e.target.value)}
                      placeholder="Buscar código, plaza, ubicación..."
                      className={`w-56 pl-8 pr-8 py-1.5 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-white placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                    />
                    {disponiblesSearchTerm && (
                      <button
                        onClick={() => setDisponiblesSearchTerm('')}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} px-2`}>
                      <span className="text-purple-300 font-bold">{processedInventory.length}</span> resultados
                    </span>

                    {/* Clear all filters */}
                    {(flujoFilter !== 'Todos' || showOnlyCompletos || showOnlyUnicos || showOnlyUnicosDigitales || showSpotUnico || islaFilter !== 'off' || mundialistaFilter !== 'off' || groupByDistance || poiFilterIds !== null || disponiblesSearchTerm) && (
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
                      className={`p-1.5 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50`}
                      title="Descargar CSV"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Refresh */}
                    <button
                      onClick={handleRefetchDisponibles}
                      disabled={isSearching}
                      className={`p-1.5 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50`}
                      title="Recargar datos"
                    >
                      <Search className={`h-4 w-4 ${isSearching ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CSV Results Panel */}
              {showCsvSection && csvData.length > 0 && (
                <div className={`px-6 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} bg-orange-500/5`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-300">Resultados del CSV</span>
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
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
                        className={`p-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
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
                <div className={`w-1/2 border-r ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex flex-col`}>
                  <div className="flex-1 overflow-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                      </div>
                    ) : processedInventory.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center h-full ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        <MapPin className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-lg">No hay inventario disponible</p>
                        <p className="text-sm">Intenta cambiar los filtros o la cara seleccionada</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className={`${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} sticky top-0`}>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium w-10`}>
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
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                              <th className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>
                                Espacio
                              </th>
                            )}
                            <th
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
                              onClick={() => handleSort('isla')}
                            >
                              <div className="flex items-center gap-1">
                                Isla
                                {sortColumn === 'isla' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'isla' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                              </div>
                            </th>
                            <th className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>
                              M. Isla
                            </th>
                            <th
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                              className={`px-3 py-2 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                                  className={`${isDark ? 'bg-zinc-800/70' : 'bg-gray-50/70'} cursor-pointer ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`}
                                  onClick={() => toggleGroupExpansion(groupName)}
                                >
                                  <td colSpan={hasDigitalInventory ? 8 : 7} className="px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      {expandedGroups.has(groupName) ? (
                                        <ChevronDown className="h-4 w-4 text-purple-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-purple-400" />
                                      )}
                                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupName}</span>
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
                                        {items.every(inv => isInventorySelected(inv)) ? 'Deseleccionar' : 'Seleccionar todos'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {/* Group Items */}
                                {expandedGroups.has(groupName) && items.map((inv) => (
                                  <tr
                                    key={getInventoryKey(inv)}
                                    onClick={() => toggleInventorySelection(getInventoryKey(inv))}
                                    className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} cursor-pointer transition-colors ${isInventorySelected(inv)
                                      ? 'bg-purple-500/10'
                                      : inv.ya_reservado_para_cara
                                        ? 'bg-green-500/5'
                                        : isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'
                                      }`}
                                  >
                                    <td className="px-3 py-2 pl-8">
                                      <input
                                        type="checkbox"
                                        checked={isInventorySelected(inv)}
                                        onChange={() => toggleInventorySelection(getInventoryKey(inv))}
                                        onClick={(e) => e.stopPropagation()}
                                        className="checkbox-purple"
                                      />
                                    </td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-mono text-xs`}>{inv.codigo_unico}</td>
                                    {hasDigitalInventory && (
                                      <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-xs`}>
                                        {inv.isCollapsedSpot ? (
                                          <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs">
                                            {inv.spots_disponibles}/{inv.total_espacios}
                                          </span>
                                        ) : inv.numero_espacio && inv.total_espacios ? (
                                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs">
                                            {inv.numero_espacio} de {inv.total_espacios}
                                          </span>
                                        ) : '-'}
                                      </td>
                                    )}
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${inv.tipo_de_cara === 'Completo'
                                        ? 'bg-purple-500/20 text-purple-300'
                                        : 'bg-blue-500/20 text-blue-300'
                                        }`}>
                                        {inv.tipo_de_cara || '-'}
                                      </span>
                                    </td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm`}>{inv.plaza}</td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{inv.isla || '-'}</td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{(inv as any).mueble_isla || '-'}</td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{inv.nivel_socioeconomico || '-'}</td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`} title={inv.ubicacion || ''}>
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
                                className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} cursor-pointer transition-colors ${isInventorySelected(inv)
                                  ? 'bg-purple-500/10'
                                  : inv.ya_reservado_para_cara
                                    ? 'bg-green-500/5'
                                    : isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'
                                  }`}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={isInventorySelected(inv)}
                                    onChange={() => toggleInventorySelection(getInventoryKey(inv))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="checkbox-purple"
                                  />
                                </td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-mono text-xs`}>{inv.codigo_unico}</td>
                                {hasDigitalInventory && (
                                  <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-xs`}>
                                    {inv.isCollapsedSpot ? (
                                      <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs">
                                        {inv.spots_disponibles}/{inv.total_espacios}
                                      </span>
                                    ) : inv.numero_espacio && inv.total_espacios ? (
                                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-xs">
                                        {inv.numero_espacio} de {inv.total_espacios}
                                      </span>
                                    ) : '-'}
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${inv.tipo_de_cara === 'Completo'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                    {inv.tipo_de_cara || '-'}
                                  </span>
                                </td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'} text-sm`}>{inv.plaza}</td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{inv.isla || '-'}</td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{(inv as any).mueble_isla || '-'}</td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{inv.nivel_socioeconomico || '-'}</td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`} title={inv.ubicacion || ''}>
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
                  <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'}/50 space-y-3`}>
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
                      {!isNoInventoryArticle((selectedCaraForSearch?.articulo || '').toUpperCase()) && <button
                        onClick={handleReserveAsBonificacion}
                        disabled={isSaving || selectedInventory.size === 0 || remainingToAssign.bonificacion <= 0}
                        className={`flex-1 px-4 py-2.5 ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'} border rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                      >
                        {isSaving ? (
                          <>
                            <div className={`h-4 w-4 border-2 ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'border-cyan-300' : 'border-emerald-300'} border-t-transparent rounded-full animate-spin`} />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Gift className="h-4 w-4" />
                            {(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}
                          </>
                        )}
                      </button>}
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
                    <div className={`flex items-center justify-center h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
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
              <div className={`w-1/2 flex flex-col border-r ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                {/* Search Bar and Tools for Reservados */}
                <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'}/50 space-y-2`}>
                  {/* Row 1: Search and Delete */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                      <input
                        type="text"
                        value={reservadosSearchTerm}
                        onChange={(e) => setReservadosSearchTerm(e.target.value)}
                        placeholder="Buscar por código, plaza, ubicación..."
                        className={`w-full pl-9 pr-4 py-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
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
                    {/* Type Filter - Toggle Buttons */}
                    <div className={`flex items-center gap-0.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg p-0.5`}>
                      {(['Todos', 'Flujo', 'Contraflujo', 'Bonificacion'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setReservadosTipoFilter(opt)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${reservadosTipoFilter === opt
                            ? opt === 'Todos' ? `${isDark ? 'bg-zinc-600' : 'bg-gray-300'} ${isDark ? 'text-white' : 'text-gray-900'} shadow`
                              : opt === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500 text-white shadow' : 'bg-emerald-500 text-white shadow')
                              : 'bg-blue-500 text-white shadow'
                            : `${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'}`
                          }`}
                        >
                          {opt === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonif.') : opt === 'Flujo' && isEspecialArticle((selectedCaraForSearch?.articulo || '').toUpperCase()) ? 'Ejec. Especiales' : opt === 'Flujo' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('IM') ? 'Impresiones' : opt}
                        </button>
                      ))}
                    </div>

                    {/* Isla filter */}
                    <button
                      onClick={() => {
                        setShowOnlyIslaReservados(!showOnlyIslaReservados);
                        // When activating isla filter, auto-sort by codigo ascending
                        if (!showOnlyIslaReservados) {
                          setReservadosSortColumn('codigo');
                          setReservadosSortDirection('asc');
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showOnlyIslaReservados
                        ? 'bg-teal-500 text-white shadow'
                        : `${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                        }`}
                    >
                      <MapPin className="h-3 w-3" />
                      Isla
                      {showOnlyIslaReservados && (
                        <X className="h-3 w-3 ml-0.5 hover:text-teal-200" onClick={(e) => { e.stopPropagation(); setShowOnlyIslaReservados(false); }} />
                      )}
                    </button>

                    {/* Grouping */}
                    <button
                      onClick={() => setGroupByDistanceReservados(!groupByDistanceReservados)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${groupByDistanceReservados
                        ? 'bg-green-500 text-white shadow'
                        : `${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                        }`}
                    >
                      <Ruler className="h-3.5 w-3.5" />
                      Agrupar
                      {groupByDistanceReservados && (
                        <X className="h-3 w-3 ml-0.5 hover:text-green-200" onClick={(e) => { e.stopPropagation(); setGroupByDistanceReservados(false); }} />
                      )}
                    </button>
                    {groupByDistanceReservados && (
                      <>
                        <div className={`flex items-center gap-0.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg p-0.5`}>
                          <button
                            onClick={() => setGroupModeReservados('distancia')}
                            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupModeReservados === 'distancia' ? 'bg-green-500/30 text-green-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`}`}
                          >
                            Distancia
                          </button>
                          <button
                            onClick={() => setGroupModeReservados('listado')}
                            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupModeReservados === 'listado' ? 'bg-green-500/30 text-green-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`}`}
                          >
                            Listado
                          </button>
                        </div>
                        {groupModeReservados === 'distancia' && (
                          <select
                            value={distanciaGruposReservados}
                            onChange={(e) => setDistanciaGruposReservados(parseInt(e.target.value))}
                            className={`px-2 py-1 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-white`}
                          >
                            <option value={100}>100m</option>
                            <option value={200}>200m</option>
                            <option value={500}>500m</option>
                            <option value={1000}>1km</option>
                          </select>
                        )}
                        <input
                          type="number"
                          value={tamanoGrupoReservados}
                          onChange={(e) => setTamanoGrupoReservados(parseInt(e.target.value) || 10)}
                          className={`w-14 px-2 py-1 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-white`}
                          min={2}
                          max={50}
                          title="Tamaño de grupo"
                        />
                      </>
                    )}

                    {/* Sort */}
                    <div className={`flex items-center gap-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg px-2 py-1`}>
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Ordenar:</span>
                      <button
                        onClick={() => toggleReservadosSort('ciudad')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'ciudad' ? 'bg-purple-500/30 text-purple-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`}`}
                      >
                        Ciudad {reservadosSortColumn === 'ciudad' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        onClick={() => toggleReservadosSort('codigo')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'codigo' ? 'bg-purple-500/30 text-purple-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`}`}
                      >
                        Código {reservadosSortColumn === 'codigo' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        onClick={() => toggleReservadosSort('tipo')}
                        className={`px-1.5 py-0.5 text-xs rounded ${reservadosSortColumn === 'tipo' ? 'bg-purple-500/30 text-purple-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`}`}
                      >
                        Tipo {reservadosSortColumn === 'tipo' && (reservadosSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>

                    {/* Toggle Grouped/Flat View */}
                    <button
                      onClick={() => setShowReservasFlatList(!showReservasFlatList)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        showReservasFlatList
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : `${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-white`
                      }`}
                      title={showReservasFlatList ? 'Mostrar agrupado' : 'Mostrar lista plana'}
                    >
                      <Layers className="h-3 w-3" />
                      {showReservasFlatList ? 'Agrupar' : 'Lista Plana'}
                    </button>

                    {/* Expand/Collapse All - Only show when grouped */}
                    {!showReservasFlatList && (
                      <button
                        onClick={toggleAllReservadosHierarchy}
                        className={`flex items-center gap-1 px-2 py-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
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
                    )}

                    {/* Download CSV Reservados */}
                    <button
                      onClick={() => {
                        if (filteredReservados.length === 0) return;
                        const headers = ['Código', 'Tipo', 'Plaza', 'Formato', 'Ubicación', 'Isla'];
                        const rows = filteredReservados.map(r => [
                          r.codigo_unico || '', r.tipo || '', r.plaza || '', r.formato || '', r.ubicacion || '', r.isla || ''
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`));
                        const csv = '\ufeff' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `reservados_${selectedCaraForSearch?.articulo || 'cara'}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      disabled={filteredReservados.length === 0}
                      className={`p-1.5 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50`}
                      title="Descargar CSV"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Results count */}
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} ml-auto`}>
                      {filteredReservados.length} de {currentCaraReservas.length}
                    </span>
                  </div>
                </div>

                {currentCaraReservas.length === 0 ? (
                  <div className={`flex-1 flex flex-col items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    <Layers className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay reservas</p>
                    <p className="text-sm">Agrega inventarios desde la pestaña "Buscar Disponibles"</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <table className="w-full">
                      <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900' : 'bg-white'}/95 backdrop-blur-sm z-10`}>
                        <tr className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                          <th className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={filteredReservados.length > 0 && selectedReservados.size === filteredReservados.length}
                              onChange={handleToggleSelectAllReservados}
                              className="checkbox-purple"
                            />
                          </th>
                          <th className={`px-4 py-3 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Código</th>
                          <th className={`px-4 py-3 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Tipo</th>
                          <th className={`px-4 py-3 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Formato</th>
                          <th className={`px-4 py-3 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Isla</th>
                          <th className={`px-4 py-3 text-left text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Ubicación</th>
                          {effectiveCanEdit && <th className={`px-4 py-3 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-medium`}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Distance Grouped View */}
                        {groupByDistanceReservados && groupedReservadosByDistance ? (
                          groupedReservadosByDistance.map(([groupName, items]) => (
                            <React.Fragment key={groupName}>
                              {/* Group Header */}
                              <tr
                                className={`${isDark ? 'bg-zinc-800/70' : 'bg-gray-50/70'} cursor-pointer ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`}
                                onClick={() => toggleGroupExpansionReservados(groupName)}
                              >
                                <td colSpan={effectiveCanEdit ? 7 : 6} className="px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    {expandedGroupsReservados.has(groupName) ? (
                                      <ChevronDown className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-green-400" />
                                    )}
                                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupName}</span>
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs">
                                      {items.length} sitios
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAllInGroupReservados(items);
                                      }}
                                      className="ml-auto text-xs text-green-400 hover:text-green-300"
                                    >
                                      {items.every(r => selectedReservados.has(r.id)) ? 'Deseleccionar' : 'Seleccionar todos'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {/* Group Items */}
                              {expandedGroupsReservados.has(groupName) && items.map((reserva) => (
                                <tr
                                  key={reserva.id}
                                  className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'} cursor-pointer ${
                                    selectedReservados.has(reserva.id) ? 'bg-purple-500/10' : ''
                                  }`}
                                  onClick={() => handleToggleReservadoSelection(reserva.id)}
                                >
                                  <td className="px-3 py-2 pl-8">
                                    <input
                                      type="checkbox"
                                      checked={selectedReservados.has(reserva.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleReservadoSelection(reserva.id);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="checkbox-purple"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{reserva.codigo_unico}</span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                      {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{reserva.formato}</td>
                                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{reserva.isla || '-'}</td>
                                  <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{reserva.plaza}</td>
                                  {effectiveCanEdit && (
                                    <td className="px-4 py-2 text-center">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveReserva(reserva.id); }}
                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                        ) : showReservasFlatList ? (
                          /* Flat List View */
                          filteredReservados.map((reserva) => (
                            <tr
                              key={reserva.id}
                              className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'} cursor-pointer ${
                                selectedReservados.has(reserva.id) ? 'bg-purple-500/10' : ''
                              } ${selectedMapReservas.has(reserva.id) ? 'ring-1 ring-purple-500' : ''}`}
                              onClick={() => handleToggleReservadoSelection(reserva.id)}
                            >
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedReservados.has(reserva.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleReservadoSelection(reserva.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="checkbox-purple"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{reserva.codigo_unico}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
                                </span>
                              </td>
                              <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{reserva.formato}</td>
                              <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{reserva.isla || '-'}</td>
                              <td className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{reserva.plaza}</td>
                              {effectiveCanEdit && (
                                <td className="px-4 py-2 text-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveReserva(reserva.id); }}
                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          /* Hierarchical: Catorcena > Artículo > Plaza > Formato */
                          catorcenaKeys.map((catKey) => {
                            const catItems = flattenHierarchy(groupedReservadosHierarchy[catKey]);
                            const catBreakdown = getReservadosBreakdown(catItems);
                            const catExpanded = expandedReservadosHierarchy.has(catKey);

                            return (
                              <React.Fragment key={catKey}>
                                {/* Level 0: Catorcena Header */}
                                <tr
                                  className={`${isDark ? 'bg-zinc-800/90' : 'bg-gray-50/90'} cursor-pointer ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`}
                                  onClick={() => toggleReservadosHierarchy(catKey)}
                                >
                                  <td colSpan={7} className="px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      {catExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-purple-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-purple-400" />
                                      )}
                                      <Calendar className="h-4 w-4 text-purple-400" />
                                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{catKey}</span>
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
                                      className={`${isDark ? 'bg-zinc-800/60' : 'bg-gray-50/60'} cursor-pointer ${isDark ? 'hover:bg-zinc-800/80' : 'hover:bg-gray-50/80'}`}
                                      onClick={() => toggleReservadosHierarchy(artKeyFull)}
                                    >
                                      <td colSpan={7} className="px-3 py-2 pl-8">
                                        <div className="flex items-center gap-3">
                                          {artExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-indigo-400" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-indigo-400" />
                                          )}
                                          <Package className="h-4 w-4 text-indigo-400" />
                                          <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{artKey}</span>
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
                                            className={`${isDark ? 'bg-zinc-800/40' : 'bg-gray-50/40'} cursor-pointer ${isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-gray-50/60'}`}
                                            onClick={() => toggleReservadosHierarchy(plzKeyFull)}
                                          >
                                            <td colSpan={7} className="px-3 py-2 pl-14">
                                              <div className="flex items-center gap-3">
                                                {plzExpanded ? (
                                                  <ChevronDown className="h-4 w-4 text-cyan-400" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4 text-cyan-400" />
                                                )}
                                                <MapPin className="h-4 w-4 text-cyan-400" />
                                                <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{plzKey}</span>
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
                                                  className={`${isDark ? 'bg-zinc-800/20' : 'bg-gray-50/20'} cursor-pointer ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50/40'}`}
                                                  onClick={() => toggleReservadosHierarchy(fmtKeyFull)}
                                                >
                                                  <td colSpan={7} className="px-3 py-2 pl-20">
                                                    <div className="flex items-center gap-3">
                                                      {fmtExpanded ? (
                                                        <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                                      ) : (
                                                        <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                                      )}
                                                      <LayoutGrid className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                                      <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{fmtKey}</span>
                                                      <span className={`px-2 py-0.5 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} ${isDark ? 'text-zinc-300' : 'text-gray-700'} rounded-full text-xs`}>
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
                                                    className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} cursor-pointer transition-colors ${selectedReservados.has(reserva.id) ? 'bg-purple-500/10' : `${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'}`}`}
                                                  >
                                                    <td className="px-3 py-3 pl-24 text-center" onClick={(e) => e.stopPropagation()}>
                                                      <input
                                                        type="checkbox"
                                                        checked={selectedReservados.has(reserva.id)}
                                                        onChange={() => handleToggleReservadoSelection(reserva.id)}
                                                        className="checkbox-purple"
                                                      />
                                                    </td>
                                                    <td className={`px-4 py-3 ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-mono text-sm`}>{reserva.codigo_unico}</td>
                                                    <td className="px-4 py-3">
                                                      {reserva.codigo_unico?.includes('_Completo') ? (
                                                        <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300">
                                                          Completo
                                                        </span>
                                                      ) : (
                                                        <span className={`px-2 py-1 rounded-full text-xs ${reserva.tipo === 'Flujo'
                                                          ? 'bg-blue-500/20 text-blue-300'
                                                          : reserva.tipo === 'Bonificacion'
                                                            ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300')
                                                            : 'bg-amber-500/20 text-amber-300'
                                                          }`}>
                                                          {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className={`px-4 py-3 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{reserva.formato || '-'}</td>
                                                    <td className={`px-4 py-3 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`} title={reserva.ubicacion || ''}>
                                                      {reserva.ubicacion || '-'}
                                                    </td>
                                                    {effectiveCanEdit && (
                                                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                          onClick={() => handleRemoveReserva(reserva.id)}
                                                          className={`p-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'} hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors`}
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
                        })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Lateral Edit Panel */}
                {editingReserva && (
                  <div className={`absolute right-0 top-0 bottom-0 w-80 ${isDark ? 'bg-zinc-900' : 'bg-white'} border-l ${isDark ? 'border-zinc-700' : 'border-gray-200'} shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200`}>
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-between`}>
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Editar Reserva</h3>
                      <button
                        onClick={handleCancelEdit}
                        className={`p-1.5 rounded-lg ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} transition-colors`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 p-4 space-y-4 overflow-auto">
                      <div>
                        <label className={`block text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1`}>Código</label>
                        <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-mono`}>{editingReserva.codigo_unico}</p>
                      </div>
                      <div>
                        <label className={`block text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1`}>Tipo</label>
                        <span className={`px-2 py-1 rounded-full text-xs ${editingReserva.tipo === 'Flujo'
                          ? 'bg-blue-500/20 text-blue-300'
                          : editingReserva.tipo === 'Bonificacion'
                            ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300')
                            : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {editingReserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : editingReserva.tipo}
                        </span>
                      </div>
                      <div>
                        <label className={`block text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1.5`}>Plaza</label>
                        <input
                          type="text"
                          value={editingPlaza}
                          onChange={(e) => setEditingPlaza(e.target.value)}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                          placeholder="Ej: CDMX, GDL, MTY..."
                        />
                      </div>
                      <div>
                        <label className={`block text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1`}>Ubicación</label>
                        <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{editingReserva.ubicacion || '-'}</p>
                      </div>
                      <div>
                        <label className={`block text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1.5`}>Formato</label>
                        <select
                          value={editingFormato}
                          onChange={(e) => setEditingFormato(e.target.value)}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
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
                    <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex gap-3`}>
                      <button
                        onClick={handleCancelEdit}
                        className={`flex-1 px-4 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-300' : 'text-gray-700'} rounded-lg text-sm font-medium ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'} transition-colors`}
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
                  <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'}/50`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          <span className="text-blue-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Flujo').length}</span> Flujo
                        </span>
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          <span className="text-blue-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Contraflujo').length}</span> Contraflujo
                        </span>
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          <span className={`${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'text-cyan-400' : 'text-emerald-400'} font-medium`}>{currentCaraReservas.filter(r => r.tipo === 'Bonificacion').length}</span> {(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}
                        </span>
                      </div>
                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Total: <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{currentCaraReservasMerged.length}</span> reservados
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
                        styles: isDark ? DARK_MAP_STYLES : [],
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
                                : reserva.tipo === 'Flujo' ? '#3b82f6' : reserva.tipo === 'Bonificacion' ? '#10b981' : '#06b6d4',
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
                    <div className={`absolute bottom-4 right-3 z-10 ${isDark ? 'bg-zinc-900' : 'bg-white'}/95 border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg p-3 text-xs max-w-[200px]`}>
                      <div className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} font-semibold mb-2 flex items-center gap-1.5`}>
                        <MapPin className="h-3.5 w-3.5 text-purple-400" />
                        Leyenda del Mapa
                      </div>

                      {/* Dirección del tráfico */}
                      <div className="space-y-1.5 mb-2">
                        <div className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[10px] uppercase tracking-wide`}>Dirección del tráfico</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 ring-1 ring-blue-400/30" />
                          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Flujo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-cyan-500 ring-1 ring-cyan-400/30" />
                          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Contraflujo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500 ring-1 ring-purple-400/30" />
                          <div>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Completo</span>
                            <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[10px] ml-1`}>(F+C)</span>
                          </div>
                        </div>
                      </div>

                      {/* Estado */}
                      <div className={`border-t ${isDark ? 'border-zinc-700/70' : 'border-gray-200/70'} pt-2 space-y-1.5`}>
                        <div className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[10px] uppercase tracking-wide`}>Estado</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 ring-1 ring-emerald-400/30" />
                          <div>
                            <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
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

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasChanges || modifiedCaras.size > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Cambios sin guardar',
        message: `Tienes ${[
          hasChanges ? 'cambios en la propuesta' : '',
          modifiedCaras.size > 0 ? `${modifiedCaras.size} circuito(s) editado(s)` : '',
        ].filter(Boolean).join(' y ')} sin guardar. ¿Seguro que quieres cerrar?`,
        confirmText: 'Cerrar sin guardar',
        cancelText: 'Volver',
        isDestructive: true,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  // Main view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className={`relative w-[95vw] max-w-[1400px] h-[90vh] ${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border border-purple-500/20 shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Asignar Inventario</h2>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuesta #{propuesta.id}</p>
          </div>
          <div className="flex items-center gap-3">
            
            <button onClick={handleClose} className={`p-2 rounded-lg ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>
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
              <div className={`${isDark ? 'bg-zinc-800/30' : 'bg-gray-50/30'} rounded-2xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'}`}>
                  <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <FileText className="h-4 w-4 text-purple-400" />
                    Resumen de Propuesta
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* Client info */}
                  {canEditCliente ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Seleccionar Cliente (CUIC)</label>
                        <button
                          type="button"
                          onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
                            selectedClienteCuic
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : `${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'hover:border-zinc-600' : 'hover:border-gray-300'}`
                          }`}
                        >
                          <span className="truncate text-left flex-1">
                            {selectedClienteCuic ? (
                              <span>
                                <span className="font-medium">{selectedClienteCuic.T2_U_Marca || 'Sin marca'}</span>
                                <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} ml-2`}>{selectedClienteCuic.CUIC} | {selectedClienteCuic.T2_U_Producto || ''}</span>
                              </span>
                            ) : (
                              <span>{solicitudDetails?.solicitud.cuic ? `${solicitudDetails.solicitud.marca_nombre || ''} (CUIC: ${solicitudDetails.solicitud.cuic})` : 'Seleccionar CUIC'}</span>
                            )}
                          </span>
                          {selectedClienteCuic ? (
                            <X className={`h-4 w-4 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} flex-shrink-0`} onClick={(e) => { e.stopPropagation(); setSelectedClienteCuic(null); setClienteChanged(false); }} />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>
                        {showClienteDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => { setShowClienteDropdown(false); setClienteSearchTerm(''); }} />
                            <div className={`absolute top-full left-0 right-0 mt-1 z-50 w-full min-w-[350px] rounded-xl border border-purple-500/20 ${isDark ? 'bg-zinc-900' : 'bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
                              <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                                <div className="relative">
                                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                  <input
                                    type="text"
                                    placeholder="Buscar por marca, CUIC, razón social..."
                                    value={clienteSearchTerm}
                                    onChange={(e) => setClienteSearchTerm(e.target.value)}
                                    className={`w-full pl-9 pr-3 py-2 text-sm ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'border-zinc-700' : 'border-gray-200'} text-white placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="max-h-72 overflow-auto">
                                {cuicLoading ? (
                                  <div className={`px-3 py-4 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Cargando...</div>
                                ) : filteredCuicOptions.length === 0 ? (
                                  <div className={`px-3 py-4 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>No se encontraron resultados</div>
                                ) : (
                                  filteredCuicOptions.slice(0, 100).map((item: CuicItem, idx: number) => (
                                    <button
                                      key={`${item.CUIC}-${idx}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedClienteCuic(item);
                                        setClienteChanged(true);
                                        setShowClienteDropdown(false);
                                        setClienteSearchTerm('');
                                      }}
                                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} last:border-0 ${
                                        selectedClienteCuic?.CUIC === item.CUIC
                                          ? 'bg-purple-500/20 text-purple-300'
                                          : `${isDark ? 'text-zinc-300' : 'text-gray-700'} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'}`
                                      }`}
                                    >
                                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.T2_U_Marca || 'Sin marca'}</div>
                                      <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.CUIC} | {item.T2_U_Producto || 'Sin producto'} | {item.T0_U_RazonSocial || ''}</div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {/* Show selected or current client details */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CUIC</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.CUIC : (solicitudDetails?.solicitud.cuic || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Razón Social</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} truncate`}>
                            {selectedClienteCuic ? selectedClienteCuic.T0_U_RazonSocial : (solicitudDetails?.solicitud.razon_social || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Marca</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.T2_U_Marca : (solicitudDetails?.solicitud.marca_nombre || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Asesor</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.ASESOR_U_Asesor : (solicitudDetails?.solicitud.asesor || '-')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CUIC</label>
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                          {solicitudDetails?.solicitud.cuic || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Razón Social</label>
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} truncate`}>
                          {solicitudDetails?.solicitud.razon_social || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Marca</label>
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                          {solicitudDetails?.solicitud.marca_nombre || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Asesor</label>
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                          {solicitudDetails?.solicitud.asesor || '-'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Nombre de Campaña</label>
                      <input
                        type="text"
                        value={nombreCampania}
                        onChange={(e) => canEditResumen && setNombreCampania(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Nombre de la campaña"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Asignados</label>
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
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
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
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-700 border-purple-200'}`}
                            >
                              {user.nombre}
                              {canEditResumen && (
                                <button
                                  onClick={() => setAsignados(prev => prev.filter(u => u.id !== user.id))}
                                  className={`${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {!canEditResumen && asignados.length === 0 && (
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                          Sin asignados
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Period - Same style as EditSolicitudModal */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Año Inicio</label>
                      <select
                        value={yearInicio || ''}
                        onChange={(e) => canEditResumen && (setYearInicio(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaInicio(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {yearInicioOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cat. Inicio</label>
                      <select
                        value={catorcenaInicio || ''}
                        onChange={(e) => canEditResumen && setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearInicio}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Año Fin</label>
                      <select
                        value={yearFin || ''}
                        onChange={(e) => canEditResumen && (setYearFin(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaFin(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {yearFinOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cat. Fin</label>
                      <select
                        value={catorcenaFin || ''}
                        onChange={(e) => canEditResumen && setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearFin}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
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
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Notas Dirección</label>
                      <textarea
                        value={notas}
                        onChange={(e) => canEditResumen && setNotas(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Descripción Trafico</label>
                      <textarea
                        value={descripcion}
                        onChange={(e) => canEditResumen && setDescripcion(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Descripción de la propuesta..."
                      />
                    </div>
                  </div>

                  {/* Archivo section - Same style as EditSolicitudModal */}
                  <div className="space-y-2">
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Archivo (opcional)</label>
                    <input
                      ref={archivoInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleArchivoUpload}
                    />
                    {archivoPropuesta ? (
                      <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border border-emerald-500/30 rounded-xl`}>
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
                            className={`w-16 h-16 flex items-center justify-center ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} rounded-lg ${isDark ? 'hover:bg-zinc-600' : 'hover:bg-gray-300'} transition-colors`}
                          >
                            <FileText className={`h-6 w-6 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                          </a>
                        )}
                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-emerald-400 font-medium">Archivo adjunto</div>
                          <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate`}>{tipoArchivoPropuesta || 'Archivo'}</div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <a
                            href={archivoPropuesta}
                            download
                            className={`p-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} ${isDark ? 'hover:bg-zinc-600' : 'hover:bg-gray-300'} ${isDark ? 'text-zinc-300' : 'text-gray-700'} rounded-lg transition-colors`}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          {canEditResumen && (
                            <>
                              <button
                                type="button"
                                onClick={() => archivoInputRef.current?.click()}
                                className={`px-3 py-2 text-xs ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} ${isDark ? 'hover:bg-zinc-600' : 'hover:bg-gray-300'} ${isDark ? 'text-zinc-300' : 'text-gray-700'} rounded-lg transition-colors`}
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
                        className={`w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed ${isDark ? 'border-zinc-700' : 'border-gray-200'} hover:border-violet-500/50 rounded-xl ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-violet-300 transition-colors`}
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-sm">Seleccionar archivo</span>
                      </button>
                    ) : (
                      <div className={`w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} rounded-xl ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        <span className="text-sm">Sin archivo adjunto</span>
                      </div>
                    )}
                  </div>

                  {/* IMU checkbox */}
                  <label className={`flex items-center gap-3 ${canEditResumen ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={imu}
                      onChange={(e) => canEditResumen && setImu(e.target.checked)}
                      disabled={!canEditResumen}
                      className="checkbox-purple w-5 h-5"
                    />
                    <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>IMU (Impresión IMU)</span>
                  </label>

                  {/* Invalid caras warning */}
                  {invalidCaras.length > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        <strong>{invalidCaras.length} cara{invalidCaras.length > 1 ? 's' : ''}</strong> tiene{invalidCaras.length > 1 ? 'n' : ''} catorcenas fuera del rango actual. Elimínalas o ajusta el rango de catorcenas antes de actualizar.
                      </span>
                    </div>
                  )}

                  {/* Pending changes indicator for propuesta summary */}
                  {canEditResumen && hasChanges && (
                    <div className={`flex items-center gap-2 pt-2 border-t ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} text-sm text-purple-400`}>
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      Cambios pendientes — se guardarán con el botón "Guardar Cambios"
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Caras/Formatos */}
              <div className={`${isDark ? 'bg-zinc-800/30' : 'bg-gray-50/30'} rounded-2xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} flex items-center justify-between`}>
                  <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <Layers className="h-4 w-4 text-purple-400" />
                    Formatos / Circuitos
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Renta: <span className={`${isDark ? 'text-purple-300' : 'text-purple-700'} font-medium`}>{carasKPIs.totalRenta}</span>
                    </span>
                    {carasKPIs.totalImpresiones > 0 && (
                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Impresiones: <span className={`${isDark ? 'text-amber-300' : 'text-amber-700'} font-medium`}>{carasKPIs.totalImpresiones}</span>
                      </span>
                    )}
                    {carasKPIs.totalEspeciales > 0 && (
                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Ejec. Especiales: <span className={`${isDark ? 'text-violet-300' : 'text-violet-700'} font-medium`}>{carasKPIs.totalEspeciales}</span>
                      </span>
                    )}
                    <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Bonificación: <span className={`${isDark ? 'text-emerald-300' : 'text-emerald-700'} font-medium`}>{carasKPIs.totalBonificacion}</span>
                    </span>
                    {carasKPIs.totalCortesia > 0 && (
                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Cortesía: <span className={`${isDark ? 'text-cyan-300' : 'text-cyan-700'} font-medium`}>{carasKPIs.totalCortesia}</span>
                      </span>
                    )}
                    <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Inversión: <span className={`${isDark ? 'text-amber-300' : 'text-amber-700'} font-medium`}>{formatCurrency(carasKPIs.totalInversion)}</span>
                    </span>
                    {effectiveCanEdit && canEditResumen && (
                      <button
                        onClick={() => { setShowAddCaraForm(true); setEditingCaraId(null); setNewCara(EMPTY_CARA); setSelectedArticulo(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar Circuito
                      </button>
                    )}
                  </div>
                </div>

                {/* Add/Edit Cara Form */}
                {showAddCaraForm && (
                  <div ref={caraFormRef} className={`px-5 py-4 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'}`}>
                    <h4 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
                      {editingCaraId ? 'Editar Circuito' : 'Nuevo Circuito'}
                    </h4>

                    {/* Artículo selector */}
                    <div className="mb-4">
                      <label className={`text-xs mb-1 block ${(editingCaraHasReservas || (editingCaraId && !permissions.canEditArticuloOnEdit)) ? 'text-zinc-800' : `${isDark ? 'text-zinc-500' : 'text-gray-400'}`}`}>Artículo SAP</label>
                      {canEditResumen && !editingCaraHasReservas && (!editingCaraId || permissions.canEditArticuloOnEdit) ? (
                        <SearchableSelect
                          label="Seleccionar artículo"
                          options={articulosData || []}
                          value={selectedArticulo}
                          onChange={(item: SAPArticulo) => {
                            setSelectedArticulo(item);
                            // Auto-complete all fields from article
                            const tarifa = getTarifaPublicaFromArticulo(item);
                            const tarifaPiso = getTarifaPisoFromArticulo(item);
                            const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName);
                            const formato = getFormatoFromArticulo(item.ItemName);
                            const tipo = getTipoFromName(item.ItemName);
                            const isCortesia = item.ItemCode.toUpperCase().startsWith('CT');
                            const isIntercambio = item.ItemCode.toUpperCase().startsWith('IN');
                            const isImpresion = item.ItemCode.toUpperCase().startsWith('IM');
                            const isEspecial = isEspecialArticle(item.ItemCode.toUpperCase());
                            const isTarifaCero = isCortesia;
                            setNewCara({
                              ...newCara,
                              articulo: item.ItemCode,
                              tarifa_publica: isTarifaCero ? 0 : tarifa,  // CT = 0, todo lo demás usa SAP
                              costo: isTarifaCero ? 0 : tarifaPiso,  // Tarifa piso desde PriceList 11
                              caras: isCortesia ? 0 : newCara.caras,
                              caras_flujo: isCortesia ? 0 : newCara.caras_flujo,
                              caras_contraflujo: isCortesia ? 0 : newCara.caras_contraflujo,
                              bonificacion: (isImpresion || isIntercambio || isEspecial) ? 0 : newCara.bonificacion,
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
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.ItemCode}</div>
                              <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.ItemName}</div>
                            </div>
                          )}
                          renderSelected={(item: SAPArticulo) => (
                            <div className="text-left">
                              <div className="font-medium text-sm">{item.ItemCode}</div>
                              <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} truncate`}>{item.ItemName}</div>
                            </div>
                          )}
                        />
                      ) : (
                        <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                          {selectedArticulo ? `${selectedArticulo.ItemCode} - ${selectedArticulo.ItemName}` : newCara.articulo || 'Sin artículo'}
                        </div>
                      )}
                    </div>

                    {/* Periodo - catorcena o mes, filtrada por rango de propuesta */}
                    <div className="mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          Periodo {editingCaraHasReservas && <span className="text-amber-400 text-[10px]">(bloqueado)</span>}
                          {tipoPeriodo !== 'mensual' && catorcenaInicio && yearInicio && catorcenaFin && yearFin && (
                            <span className={`${isDark ? 'text-zinc-600' : 'text-gray-400'} ml-1`}>
                              (Rango: {catorcenaInicio}/{yearInicio} - {catorcenaFin}/{yearFin})
                            </span>
                          )}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Catorcena/Mes Inicio */}
                          <select
                            value={newCara.catorcena_inicio && newCara.anio_inicio ? `${newCara.anio_inicio}-${newCara.catorcena_inicio}` : ''}
                            onChange={(e) => {
                              if (!canEditResumen || editingCaraHasReservas) return;
                              if (e.target.value) {
                                const [year, cat] = e.target.value.split('-').map(Number);
                                if (tipoPeriodo === 'mensual') {
                                  const fechaIni = new Date(year, cat - 1, 1);
                                  // If no fin selected or fin < inicio, set fin = inicio
                                  const finYear = newCara.anio_fin && (newCara.anio_fin * 100 + (newCara.catorcena_fin || 0)) >= (year * 100 + cat) ? newCara.anio_fin : year;
                                  const finCat = newCara.catorcena_fin && (newCara.anio_fin || 0) * 100 + newCara.catorcena_fin >= year * 100 + cat ? newCara.catorcena_fin : cat;
                                  const fechaFin = new Date(finYear, finCat, 0);
                                  setNewCara({
                                    ...newCara,
                                    catorcena_inicio: cat,
                                    anio_inicio: year,
                                    catorcena_fin: finCat,
                                    anio_fin: finYear,
                                    inicio_periodo: fechaIni.toISOString().split('T')[0],
                                    fin_periodo: fechaFin.toISOString().split('T')[0]
                                  });
                                } else {
                                  const periodIni = catorcenasData?.data.find(c => c.a_o === year && c.numero_catorcena === cat);
                                  // If no fin or fin < inicio, set fin = inicio
                                  const currentFinVal = (newCara.anio_fin || 0) * 100 + (newCara.catorcena_fin || 0);
                                  const newIniVal = year * 100 + cat;
                                  let finCat = newCara.catorcena_fin;
                                  let finYear = newCara.anio_fin;
                                  let finPeriodo = newCara.fin_periodo;
                                  if (!finCat || currentFinVal < newIniVal) {
                                    finCat = cat;
                                    finYear = year;
                                    finPeriodo = periodIni?.fecha_fin || '';
                                  }
                                  setNewCara({
                                    ...newCara,
                                    catorcena_inicio: cat,
                                    anio_inicio: year,
                                    catorcena_fin: finCat,
                                    anio_fin: finYear,
                                    inicio_periodo: periodIni?.fecha_inicio || '',
                                    fin_periodo: finPeriodo
                                  });
                                }
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
                            className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <option value="">{tipoPeriodo === 'mensual' ? 'Mes inicio' : 'Cat. inicio'}</option>
                            {tipoPeriodo === 'mensual' ? (
                              (() => {
                                const options: { year: number; month: number }[] = [];
                                if (propuesta.fecha_inicio && propuesta.fecha_fin) {
                                  const start = new Date(propuesta.fecha_inicio);
                                  const end = new Date(propuesta.fecha_fin);
                                  let y = start.getFullYear(), m = start.getMonth() + 1;
                                  const endY = end.getFullYear(), endM = end.getMonth() + 1;
                                  while (y < endY || (y === endY && m <= endM)) {
                                    options.push({ year: y, month: m });
                                    m++;
                                    if (m > 12) { m = 1; y++; }
                                  }
                                }
                                return options.map(o => (
                                  <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                                    {MESES_LABEL[o.month - 1]} {o.year}
                                  </option>
                                ));
                              })()
                            ) : (
                              catorcenasData?.data
                                .filter(c => {
                                  if (!catorcenaInicio || !yearInicio || !catorcenaFin || !yearFin) return true;
                                  const catValue = c.a_o * 100 + c.numero_catorcena;
                                  return catValue >= yearInicio * 100 + catorcenaInicio && catValue <= yearFin * 100 + catorcenaFin;
                                })
                                .map(c => (
                                  <option key={`${c.a_o}-${c.numero_catorcena}`} value={`${c.a_o}-${c.numero_catorcena}`}>
                                    Cat {c.numero_catorcena} / {c.a_o}
                                  </option>
                                ))
                            )}
                          </select>

                          {/* Catorcena/Mes Fin */}
                          <select
                            value={newCara.catorcena_fin && newCara.anio_fin ? `${newCara.anio_fin}-${newCara.catorcena_fin}` : ''}
                            onChange={(e) => {
                              if (!canEditResumen || editingCaraHasReservas) return;
                              if (e.target.value) {
                                const [year, cat] = e.target.value.split('-').map(Number);
                                if (tipoPeriodo === 'mensual') {
                                  const fechaFin = new Date(year, cat, 0);
                                  setNewCara({
                                    ...newCara,
                                    catorcena_fin: cat,
                                    anio_fin: year,
                                    fin_periodo: fechaFin.toISOString().split('T')[0]
                                  });
                                } else {
                                  const periodFin = catorcenasData?.data.find(c => c.a_o === year && c.numero_catorcena === cat);
                                  setNewCara({
                                    ...newCara,
                                    catorcena_fin: cat,
                                    anio_fin: year,
                                    fin_periodo: periodFin?.fecha_fin || ''
                                  });
                                }
                              }
                            }}
                            disabled={!canEditResumen || editingCaraHasReservas || !newCara.catorcena_inicio}
                            className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas || !newCara.catorcena_inicio) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <option value="">{tipoPeriodo === 'mensual' ? 'Mes fin' : 'Cat. fin'}</option>
                            {tipoPeriodo === 'mensual' ? (
                              (() => {
                                const options: { year: number; month: number }[] = [];
                                if (propuesta.fecha_inicio && propuesta.fecha_fin && newCara.catorcena_inicio && newCara.anio_inicio) {
                                  const start = new Date(propuesta.fecha_inicio);
                                  const end = new Date(propuesta.fecha_fin);
                                  let y = start.getFullYear(), m = start.getMonth() + 1;
                                  const endY = end.getFullYear(), endM = end.getMonth() + 1;
                                  const minVal = newCara.anio_inicio * 100 + newCara.catorcena_inicio;
                                  while (y < endY || (y === endY && m <= endM)) {
                                    if (y * 100 + m >= minVal) options.push({ year: y, month: m });
                                    m++;
                                    if (m > 12) { m = 1; y++; }
                                  }
                                }
                                return options.map(o => (
                                  <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                                    {MESES_LABEL[o.month - 1]} {o.year}
                                  </option>
                                ));
                              })()
                            ) : (
                              catorcenasData?.data
                                .filter(c => {
                                  const catValue = c.a_o * 100 + c.numero_catorcena;
                                  const minValue = (newCara.anio_inicio || 0) * 100 + (newCara.catorcena_inicio || 0);
                                  const maxValue = (yearFin || 9999) * 100 + (catorcenaFin || 99);
                                  return catValue >= minValue && catValue <= maxValue;
                                })
                                .map(c => (
                                  <option key={`${c.a_o}-${c.numero_catorcena}`} value={`${c.a_o}-${c.numero_catorcena}`}>
                                    Cat {c.numero_catorcena} / {c.a_o}
                                  </option>
                                ))
                            )}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : `${isDark ? 'text-zinc-500' : 'text-gray-400'}`}`}>Estados {newCara.estados && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.estados.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
                          <MultiSelectDropdown
                            options={['Ciudad de México / AM', ...(solicitudFilters?.estados || [])]}
                            selected={newCara.estados ? newCara.estados.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setNewCara({ ...newCara, estados: selected.join(', '), ciudad: '' })}
                            placeholder="Seleccionar estados..."
                          />
                        ) : (
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} truncate`}>
                            {newCara.estados || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : `${isDark ? 'text-zinc-500' : 'text-gray-400'}`}`}>Ciudades {newCara.ciudad && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.ciudad.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
                          <MultiSelectDropdown
                            options={
                              (() => {
                                const isAM = newCara.estados?.includes('Ciudad de México / AM');
                                const AM_EDO_MEX_CITIES = ['ATIZAPÁN', 'CUAUTITLÁN IZCALLI', 'ECATEPEC', 'HUIXQUILUCAN', 'NAUCALPAN', 'TLALNEPANTLA', 'TULTITLÁN'];
                                return solicitudFilters?.ciudades
                                  .filter(c => {
                                    if (!newCara.estados) return true;
                                    const selectedEstados = newCara.estados.split(',').map(s => s.trim()).flatMap(s => s === 'Ciudad de México / AM' ? ['Ciudad de México', 'Estado de México'] : [s]);
                                    return selectedEstados.includes(c.estado);
                                  })
                                  .filter(c => !isAM || c.estado !== 'Estado de México' || AM_EDO_MEX_CITIES.includes(c.ciudad.toUpperCase()))
                                  .map(c => c.ciudad) || [];
                              })()
                            }
                            selected={newCara.ciudad ? newCara.ciudad.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setNewCara({ ...newCara, ciudad: selected.join(', ') })}
                            placeholder="Seleccionar ciudades..."
                          />
                        ) : (
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} truncate`}>
                            {newCara.ciudad || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : `${isDark ? 'text-zinc-500' : 'text-gray-400'}`}`}>Formatos {newCara.formato && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.formato.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
                          <MultiSelectDropdown
                            options={solicitudFilters?.formatos || []}
                            selected={newCara.formato ? newCara.formato.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setNewCara({ ...newCara, formato: selected.join(', ') })}
                            placeholder="Seleccionar formatos..."
                          />
                        ) : (
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} truncate`}>
                            {newCara.formato || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${(editingCaraHasReservas || editingCaraId) ? 'text-zinc-800' : `${isDark ? 'text-zinc-500' : 'text-gray-400'}`}`}>Tipo</label>
                        <select
                          value={newCara.tipo}
                          onChange={(e) => canEditResumen && !editingCaraHasReservas && !editingCaraId && setNewCara({ ...newCara, tipo: e.target.value })}
                          disabled={!canEditResumen || editingCaraHasReservas || !!editingCaraId}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas || editingCaraId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">Seleccionar</option>
                          <option value="Tradicional">Tradicional</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {isEspecialArticle((newCara.articulo || '').toUpperCase()) ? 'Ejec. Especiales' : newCara.articulo?.toUpperCase().startsWith('IM') ? 'Impresiones' : 'Caras en Renta'}
                          {newCara.articulo?.toUpperCase().startsWith('CT') && (
                            <span className="ml-1 text-cyan-400 text-[10px]">(Cortesía)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={newCara.caras || ''}
                          onChange={(e) => {
                            if (!canEditResumen) return;
                            const val = parseInt(e.target.value) || 0;
                            const flujo = Math.ceil(val / 2);
                            const contraflujo = Math.floor(val / 2);
                            setNewCara({ ...newCara, caras: val, caras_flujo: flujo, caras_contraflujo: contraflujo });
                          }}
                          disabled={!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')) ? 'opacity-40 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                        <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Flujo: {newCara.caras_flujo || 0} | Contraflujo: {newCara.caras_contraflujo || 0}</span>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{newCara.articulo?.toUpperCase().startsWith('CT') ? 'Cortesía' : 'Caras Bonificadas'}</label>
                        <input
                          type="number"
                          value={newCara.bonificacion || ''}
                          onChange={(e) => canEditResumen && setNewCara({ ...newCara, bonificacion: parseInt(e.target.value) || 0 })}
                          disabled={!canEditResumen || isNoInventoryArticle((newCara.articulo || '').toUpperCase()) || newCara.articulo?.toUpperCase().startsWith('IN')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || isNoInventoryArticle((newCara.articulo || '').toUpperCase()) || newCara.articulo?.toUpperCase().startsWith('IN')) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Tarifa Pública</label>
                        <input
                          type="number"
                          value={newCara.tarifa_publica || ''}
                          onChange={(e) => canEditResumen && setNewCara({ ...newCara, tarifa_publica: parseFloat(e.target.value) || 0 })}
                          disabled={!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg text-sm ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')) ? 'opacity-40 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>NSE {newCara.nivel_socioeconomico && <span className="text-purple-400">({newCara.nivel_socioeconomico.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={solicitudFilters?.nse || []}
                          selected={newCara.nivel_socioeconomico ? newCara.nivel_socioeconomico.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, nivel_socioeconomico: selected.join(', ') })}
                          placeholder="Seleccionar NSE..."
                        />
                      </div>
                    </div>

                    {/* Artículo BF - below the grid when bonificacion > 0 */}
                    {(newCara.bonificacion || 0) > 0
                      && !newCara.articulo?.toUpperCase().startsWith('CT')
                      && !newCara.articulo?.toUpperCase().startsWith('IM')
                      && !newCara.articulo?.toUpperCase().startsWith('BF')
                      && !newCara.articulo?.toUpperCase().startsWith('CF')
                      && !isEspecialArticle((newCara.articulo || '').toUpperCase()) && (
                      <div className={`mt-3 mb-4 p-3 ${isDark ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} rounded-lg border`}>
                        <label className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'} mb-1 block`}>Artículo de Bonificación (BF)</label>
                        <SearchableSelect
                          label=""
                          options={(articulosData || []).filter(a => a.ItemCode.toUpperCase().startsWith('BF') || a.ItemCode.toUpperCase().startsWith('CF'))}
                          value={newCara.articuloBf || null}
                          onChange={(item: SAPArticulo) => setNewCara({ ...newCara, articuloBf: item })}
                          onClear={() => setNewCara({ ...newCara, articuloBf: null })}
                          displayKey="ItemName"
                          valueKey="ItemCode"
                          searchKeys={['ItemCode', 'ItemName']}
                          renderOption={(item: SAPArticulo) => (
                            <div>
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.ItemCode}</div>
                              <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.ItemName}</div>
                            </div>
                          )}
                          renderSelected={(item: SAPArticulo) => (
                            <div className="text-left">
                              <div className={`text-xs font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{item.ItemCode}</div>
                            </div>
                          )}
                        />
                      </div>
                    )}

                    {/* Preview calculation - Resumen y cálculos */}
                    {(newCara.caras || 0) > 0 && (newCara.tarifa_publica || 0) > 0 && (
                      <div className={`mt-4 p-3 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} space-y-2`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Inversión (Tarifa Cliente):</span>
                          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                            {newCara.caras} caras × {formatCurrency(newCara.tarifa_publica)} = <span className="text-emerald-400 font-medium">{formatCurrency((newCara.caras || 0) * (newCara.tarifa_publica || 0))}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Caras Totales:</span>
                          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                            {newCara.caras || 0} caras + {newCara.bonificacion || 0} bonif. = <span className="text-blue-400 font-medium">{(newCara.caras || 0) + (newCara.bonificacion || 0)} caras totales</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Tarifa Efectiva:</span>
                          <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                            {formatCurrency((newCara.caras || 0) * (newCara.tarifa_publica || 0))} ÷ {(newCara.caras || 0) + (newCara.bonificacion || 0)} = <span className="text-purple-400 font-medium">{formatCurrency(((newCara.caras || 0) + (newCara.bonificacion || 0)) > 0 ? ((newCara.caras || 0) * (newCara.tarifa_publica || 0)) / ((newCara.caras || 0) + (newCara.bonificacion || 0)) : 0)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={handleCancelCaraForm}
                        className={`px-4 py-2 ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} ${isDark ? 'text-zinc-300' : 'text-gray-700'} rounded-lg text-sm ${isDark ? 'hover:bg-zinc-600' : 'hover:bg-gray-300'} transition-colors`}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveCara}
                        disabled={!editingCaraId && newCara.formato !== 'Kiosco' && (newCara.caras + (newCara.bonificacion || 0)) > 0 && (newCara.caras + (newCara.bonificacion || 0)) % 2 !== 0}
                        className={`px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors ${!editingCaraId && newCara.formato !== 'Kiosco' && (newCara.caras + (newCara.bonificacion || 0)) > 0 && (newCara.caras + (newCara.bonificacion || 0)) % 2 !== 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!editingCaraId && newCara.formato !== 'Kiosco' && (newCara.caras + (newCara.bonificacion || 0)) > 0 && (newCara.caras + (newCara.bonificacion || 0)) % 2 !== 0 ? 'Caras impar — no se puede guardar' : undefined}
                      >
                        {editingCaraId ? 'Actualizar' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                )}

                <div ref={caraTableRef} className="divide-y divide-zinc-700/30">
                  {caras.length === 0 ? (
                    <div className={`p-8 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
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
                      const catorcenaLabel = tipoPeriodo === 'mensual' && groupData.catorcenaNum
                        ? `${MESES_LABEL[groupData.catorcenaNum - 1]} ${groupData.year || ''}`
                        : groupData.catorcenaNum
                        ? `Cat ${groupData.catorcenaNum} / ${groupData.year || ''}`
                        : (() => {
                            const parts = periodo.split('-');
                            if (parts.length >= 2) {
                              const m = parseInt(parts[1]);
                              return `${MESES_LABEL[m - 1] || periodo} ${parts[0]}`;
                            }
                            return `Periodo: ${periodo}`;
                          })();

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
                            <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
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
                            const esImpresion = cara.articulo ? isImpresionArticle(cara.articulo) : false;
                            const esEspecial = cara.articulo ? isEspecialArticle(cara.articulo) : false;
                            // Purple = especial, Blue = impresión (informativo), Green = complete, Amber = incomplete
                            const statusColor = esEspecial ? 'purple' : esImpresion ? 'blue' : status.isComplete ? 'emerald' : 'amber';

                            // Display text for diff:
                            // - Missing (totalDiff < 0): show "faltan X"
                            // - Excess (totalDiff > 0): show "quitar X"
                            const diffDisplay = status.totalDiff === 0
                              ? null
                              : status.totalDiff > 0
                                ? `quitar ${status.totalDiff}`
                                : `faltan ${Math.abs(status.totalDiff)}`;

                            return (
                              <div key={cara.localId} className={`${statusColor === 'blue' ? 'bg-blue-500/5' : statusColor === 'emerald' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                                {/* Cara row */}
                                <div className={`flex items-center gap-3 px-5 py-3 ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'} transition-colors`}>
                                  {/* Completion indicator */}
                                  <div className={`w-2 h-2 rounded-full ${
                                    statusColor === 'blue' ? 'bg-blue-500' : statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                  }`} />

                                  <div className="flex-1 grid grid-cols-8 gap-3 text-sm">
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Formato</span>
                                      <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{cara.formato || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Tipo</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                        {cara.tipo || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Ciudad</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs truncate`} title={cara.ciudad || cara.estados}>{cara.ciudad || cara.estados || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Artículo</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{cara.articulo || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>F. Inicio</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{cara.inicio_periodo ? new Date(cara.inicio_periodo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>F. Fin</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{cara.fin_periodo ? new Date(cara.fin_periodo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Caras</span>
                                      {esImpresion ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">Impresión</span>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{status.totalReservado}/{totalCaras}</p>
                                          {diffDisplay && (
                                            <span className={`text-xs font-medium ${status.totalDiff > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                              ({diffDisplay})
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Autorización</span>
                                      <div className="flex flex-col gap-0.5">
                                        {cara.autorizacion_dg === 'aprobado' && cara.autorizacion_dcm === 'aprobado' && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Aprobado</span>
                                        )}
                                        {(cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado') && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-400">Rechazado</span>
                                        )}
                                        {cara.autorizacion_dg === 'pendiente' && cara.autorizacion_dcm !== 'rechazado' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Pend. DG</span>
                                        )}
                                        {cara.autorizacion_dcm === 'pendiente' && cara.autorizacion_dg !== 'rechazado' && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Pend. DCM</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Botón Buscar Inventario - oculto para impresión, deshabilitado si hay autorizaciones pendientes */}
                                    {effectiveCanEdit && permissions.canBuscarInventarioEnModal && !esImpresion && (() => {
                                      const isLocallyModified = cara.id ? modifiedCaras.has(cara.id) : false;
                                      const tienePendientes = !isLocallyModified && (cara.autorizacion_dg === 'pendiente' || cara.autorizacion_dcm === 'pendiente');
                                      const tieneRechazado = cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado';
                                      const bloqueado = tienePendientes || tieneRechazado;

                                      return (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (!bloqueado) handleSearchInventory(cara); }}
                                          disabled={bloqueado}
                                          className={`p-2 rounded-lg border transition-colors ${
                                            bloqueado
                                              ? `bg-zinc-500/10 ${isDark ? 'text-zinc-500' : 'text-gray-400'} border-zinc-500/20 cursor-not-allowed`
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
                                    {effectiveCanEdit && (() => {
                                      const caraAuthPendienteSaved = caras.some(c => !modifiedCaras.has(c.id!) && ((c._originalDg || c.autorizacion_dg) === 'pendiente' || (c._originalDcm || c.autorizacion_dcm) === 'pendiente'));
                                      return (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (!caraAuthPendienteSaved) handleEditCara(cara); }}
                                          disabled={caraAuthPendienteSaved}
                                          className={`p-2 rounded-lg border transition-colors ${caraAuthPendienteSaved
                                            ? `bg-zinc-500/10 ${isDark ? 'text-zinc-500' : 'text-gray-400'} border-zinc-500/20 cursor-not-allowed`
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                          }`}
                                          title={caraAuthPendienteSaved ? 'Autorización pendiente - no se puede editar' : 'Editar'}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                        {canEditResumen && (() => {
                                            const reservaBlocked = hasReservas && !permissions.canDeleteCaraConReservas;
                                            const isDisabled = reservaBlocked || caraAuthPendienteSaved;
                                            return (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (!isDisabled) handleDeleteCara(cara.localId); }}
                                            disabled={isDisabled}
                                            className={`p-2 rounded-lg border transition-colors ${isDisabled
                                              ? `bg-zinc-500/10 ${isDark ? 'text-zinc-500' : 'text-gray-400'} border-zinc-500/20 cursor-not-allowed`
                                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                              }`}
                                            title={caraAuthPendienteSaved ? 'Autorización pendiente' : reservaBlocked ? 'No se puede eliminar (tiene reservas)' : 'Eliminar'}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                            );
                                        })()}
                                      </>
                                      );
                                    })()}
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
                  // Pan map to the selected reserva's location
                  const reserva = filteredReservas.find(r => r.id === id);
                  if (reserva?.latitud && reserva?.longitud && resumenReservasMapRef.current) {
                    resumenReservasMapRef.current.panTo({ lat: reserva.latitud, lng: reserva.longitud });
                    resumenReservasMapRef.current.setZoom(15);
                  }
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
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200/50'} ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                        {breakdown.total}
                      </span>
                    </div>
                  );
                };

                return (
                  <div className={`${isDark ? 'bg-zinc-800/30' : 'bg-gray-50/30'} rounded-2xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} overflow-hidden`}>
                    <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} flex items-center justify-between`}>
                      <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
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
                                ? `bg-purple-600 ${isDark ? 'text-white' : 'text-gray-900'} border border-purple-500`
                                : isDark ? 'bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 border border-purple-300'
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
                                <button onClick={() => setShowFiltersReservas(false)} className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>
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
                                      className={`w-[130px] text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      {FILTER_FIELDS_RESERVAS.map((f) => (
                                        <option key={f.field} value={f.field}>{f.label}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={filter.operator}
                                      onChange={(e) => updateFilterReservas(filter.id, { operator: e.target.value as FilterOperator })}
                                      className={`w-[110px] text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
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
                                      className={`flex-1 text-xs ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded px-2 py-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
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
                                  <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-3`}>Sin filtros. Haz clic en "Añadir".</p>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-900/30">
                                <button onClick={addFilterReservas} className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 ${isDark ? 'text-white' : 'text-gray-900'} rounded`}>
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
                                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{filteredReservas.length} de {reservasMerged.length} registros</span>
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
                              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide px-2 py-1`}>Agrupar por (max 3)</p>
                              {AVAILABLE_GROUPINGS_RESERVAS.map(({ field, label }) => (
                                <button
                                  key={field}
                                  onClick={() => toggleGroupingReservas(field)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-purple-900/30 transition-colors ${
                                    activeGroupingsReservas.includes(field) ? 'text-purple-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'}`
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    activeGroupingsReservas.includes(field) ? 'bg-purple-600 border-purple-600' : 'border-purple-500/50'
                                  }`}>
                                    {activeGroupingsReservas.includes(field) && <Check className={`h-3 w-3 ${isDark ? 'text-white' : 'text-gray-900'}`} />}
                                  </div>
                                  {label}
                                  {activeGroupingsReservas.indexOf(field) === 0 && <span className="ml-auto text-[10px] text-purple-400">1°</span>}
                                  {activeGroupingsReservas.indexOf(field) === 1 && <span className="ml-auto text-[10px] text-pink-400">2°</span>}
                                  {activeGroupingsReservas.indexOf(field) === 2 && <span className="ml-auto text-[10px] text-cyan-400">3°</span>}
                                </button>
                              ))}
                              <div className="border-t border-purple-900/30 mt-2 pt-2">
                                <button onClick={() => setActiveGroupingsReservas([])} className={`w-full text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} ${isDark ? 'hover:text-zinc-300' : 'hover:text-gray-700'} py-1`}>
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
                              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide px-2 py-1`}>Ordenar por</p>
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
                                    sortFieldReservas === field ? 'text-purple-300' : `${isDark ? 'text-zinc-400' : 'text-gray-500'}`
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
                                <button onClick={() => setSortFieldReservas(null)} className={`w-full text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} ${isDark ? 'hover:text-zinc-300' : 'hover:text-gray-700'} py-1`}>
                                  Quitar orden
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedMapReservas.size > 0 && (
                          <>
                            <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} text-xs`}>{selectedMapReservas.size} sel.</span>
                            <button onClick={() => setSelectedMapReservas(new Set())} className="text-purple-400 hover:text-purple-300 text-xs">
                              Limpiar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex h-[520px]">
                      {/* Selection Panel */}
                      <div className={`w-96 border-r ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-900' : 'bg-white'}/30 flex flex-col flex-shrink-0`}>
                        {/* Select All Header */}
                        <div className={`px-4 py-2.5 border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'}`}>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMapReservas.size === filteredReservas.length && filteredReservas.length > 0}
                                onChange={toggleAllMapReservas}
                                className="checkbox-purple"
                              />
                              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Seleccionar</span>
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                                {filteredReservas.length}
                              </span>
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setExpandedReservasGroups(new Set(groupKeys))}
                                className={`p-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-purple-400 hover:bg-purple-900/30 rounded transition-colors`}
                                title="Expandir todo"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setExpandedReservasGroups(new Set())}
                                className={`p-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'} hover:text-purple-400 hover:bg-purple-900/30 rounded transition-colors`}
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
                              <div key={groupKey} className={`border-b ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                                <button
                                  onClick={() => toggleReservasGroup(groupKey)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-900/20 to-zinc-800/30 hover:from-purple-900/30 hover:to-zinc-800/50 transition-all"
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-400" /> : <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />}
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
                                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex-1 text-left truncate`}>{groupKey}</span>
                                  <TypeBreakdownBadges items={level1Items} />
                                </button>
                                {isExpanded && (
                                  <div className={`${isDark ? 'bg-zinc-900' : 'bg-white'}/40 border-l-2 border-purple-500/30 ml-3`}>
                                    {isLevel1Array ? (
                                      // Direct items
                                      (groupData as ReservaItem[]).map(reserva => (
                                        <label
                                          key={reserva.id}
                                          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                                            selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : `${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50/40'}`
                                          }`}
                                        >
                                          <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                          <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono text-[11px]`}>{reserva.codigo_unico}</span>
                                          <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[11px] truncate max-w-[80px]`}>{reserva.plaza}</span>
                                          <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[11px]`}>{reserva.formato}</span>
                                          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                                            reserva.codigo_unico?.includes('_Completo') ? 'bg-purple-500/20 text-purple-300' :
                                            reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                          }`}>{reserva.codigo_unico?.includes('_Completo') ? 'Completo' : reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonif') : reserva.tipo}</span>
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
                                              className={`w-full flex items-center gap-2 px-2 py-1.5 ${isDark ? 'bg-zinc-800/20' : 'bg-gray-50/20'} ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50/40'}`}
                                            >
                                              {isSubExpanded ? <ChevronDown className="h-3 w-3 text-pink-400" /> : <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />}
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
                                              <span className={`text-[11px] ${isDark ? 'text-white' : 'text-gray-900'} flex-1 text-left truncate`}>{subKey}</span>
                                              <TypeBreakdownBadges items={subItems} />
                                            </button>
                                            {isSubExpanded && (
                                              <div className="ml-2 border-l border-cyan-500/20">
                                                {isLevel2Array ? (
                                                  (subData as ReservaItem[]).map(reserva => (
                                                    <label
                                                      key={reserva.id}
                                                      className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-[11px] ${
                                                        selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : `${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50/40'}`
                                                      }`}
                                                    >
                                                      <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                                      <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{reserva.codigo_unico}</span>
                                                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                                                        reserva.codigo_unico?.includes('_Completo') ? 'bg-purple-500/20 text-purple-300' :
                                                        reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                                      }`}>{reserva.codigo_unico?.includes('_Completo') ? 'Completo' : reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonif') : reserva.tipo}</span>
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
                                                          className={`w-full flex items-center gap-2 px-2 py-1 ${isDark ? 'bg-zinc-800/10' : 'bg-gray-50/10'} ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50/30'}`}
                                                        >
                                                          {isThirdExpanded ? <ChevronDown className="h-3 w-3 text-cyan-400" /> : <ChevronRight className={`h-3 w-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />}
                                                          <span className="text-[10px] text-cyan-400">
                                                            {AVAILABLE_GROUPINGS_RESERVAS.find(g => g.field === activeGroupingsReservas[2])?.label}:
                                                          </span>
                                                          <span className={`text-[11px] ${isDark ? 'text-white' : 'text-gray-900'} flex-1 text-left truncate`}>{thirdKey}</span>
                                                          <TypeBreakdownBadges items={thirdItems} />
                                                        </button>
                                                        {isThirdExpanded && thirdItems.map(reserva => (
                                                          <label
                                                            key={reserva.id}
                                                            className={`flex items-center gap-2 px-4 py-1 cursor-pointer text-[11px] ${
                                                              selectedMapReservas.has(reserva.id) ? 'bg-purple-500/15' : `${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50/40'}`
                                                            }`}
                                                          >
                                                            <input type="checkbox" checked={selectedMapReservas.has(reserva.id)} onChange={() => toggleSingleMapReserva(reserva.id)} className="checkbox-purple" />
                                                            <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{reserva.codigo_unico}</span>
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
                        <div className={`p-3 border-t ${isDark ? 'border-zinc-700/50' : 'border-gray-200/50'} ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'}`}>
                          <div className={`grid gap-2 text-center text-xs ${reservasKPIs.completos > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            <div>
                              <p className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Flujo</p>
                              <p className="text-blue-400 font-bold">{reservasKPIs.flujo}</p>
                            </div>
                            <div>
                              <p className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Contra</p>
                              <p className="text-blue-400 font-bold">{reservasKPIs.contraflujo}</p>
                            </div>
                            {reservasKPIs.completos > 0 && (
                              <div>
                                <p className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Completo</p>
                                <p className="text-purple-400 font-bold">{reservasKPIs.completos}</p>
                              </div>
                            )}
                            <div>
                              <p className={`${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Bonif</p>
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
                              center={filteredReservas.find(r => r.latitud && r.longitud) ? { lat: filteredReservas.find(r => r.latitud && r.longitud)!.latitud, lng: filteredReservas.find(r => r.latitud && r.longitud)!.longitud } : { lat: 20.6597, lng: -103.3496 }}
                              zoom={11}
                              options={{
                                styles: isDark ? DARK_MAP_STYLES : [],
                                disableDefaultUI: true,
                                zoomControl: true,
                              }}
                              onLoad={(map) => {
                                resumenReservasMapRef.current = map;
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
                                        reserva.tipo === 'Contraflujo' ? '#06b6d4' : '#10b981',
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
                            <div className={`absolute bottom-3 right-3 z-10 ${isDark ? 'bg-zinc-900' : 'bg-white'}/95 border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-lg p-2.5 text-xs max-w-[180px]`}>
                              <div className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} font-semibold mb-1.5 flex items-center gap-1.5`}>
                                <MapPin className="h-3 w-3 text-purple-400" />
                                Leyenda
                              </div>

                              {/* Dirección del tráfico */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                  <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Flujo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                                  <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Contraflujo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                  <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Completo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                  <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}</span>
                                </div>
                              </div>

                              {/* Estado de selección */}
                              <div className={`border-t ${isDark ? 'border-zinc-700/70' : 'border-gray-200/70'} pt-1.5 mt-1.5 space-y-1`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-white/50" />
                                  <span className={`${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Seleccionado</span>
                                  <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-[10px]`}>({selectedMapReservas.size})</span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className={`flex items-center justify-center h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
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

        {/* Footer with Guardar Cambios button */}
        {(caras.length > 0 || hasChanges) && (
          <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} ${isDark ? 'bg-zinc-900' : 'bg-white'}/80 flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              {/* Status summary */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${allCarasComplete ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    {allCarasComplete ? (
                      <span className="text-emerald-400">Todas las caras completas</span>
                    ) : (
                      <span className="text-amber-400">
                        {caras.filter(c => !getCaraCompletionStatus(c).isComplete).length} Circuito(s) incompleto(s)
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
                {(modifiedCaras.size > 0 || hasChanges) && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    {[
                      hasChanges ? 'Propuesta' : '',
                      modifiedCaras.size > 0 ? `${modifiedCaras.size} circuito(s)` : '',
                    ].filter(Boolean).join(' + ')} pendiente(s)
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
              >
                Cerrar
              </button>
              {effectiveCanEdit && (
                <button
                  disabled={(!hasChanges && modifiedCaras.size === 0) || isSaving}
                  onClick={handleBulkSaveChanges}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                    (hasChanges || modifiedCaras.size > 0) && !isSaving
                      ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/25'
                      : `${isDark ? 'bg-zinc-700' : 'bg-gray-200'} ${isDark ? 'text-zinc-500' : 'text-gray-400'} cursor-not-allowed`
                  }`}
                >
                  {isSaving ? (
                    <div className="h-4 w-4 inline-block mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 inline-block mr-2" />
                  )}
                  {isSaving ? 'Guardando...' : `Guardar Cambios${(hasChanges || modifiedCaras.size > 0) ? ` (${(hasChanges ? 1 : 0) + modifiedCaras.size})` : ''}`}
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
          <div className={`flex flex-col items-center gap-4 p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border ${isDark ? 'border-zinc-800' : 'border-gray-200'} shadow-xl`}>
            <div className={`animate-spin rounded-full h-10 w-10 border-4 ${isDark ? 'border-zinc-700' : 'border-gray-200'} border-t-purple-500`} />
            <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} font-medium animate-pulse`}>Procesando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
