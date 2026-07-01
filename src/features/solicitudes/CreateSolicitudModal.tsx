import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useModalTracker } from '../../hooks/useModalTracker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, Upload, ChevronDown, ChevronRight, Check, Users, Building2,
  Package, Calendar, FileText, MapPin, Layers, Hash, RefreshCw, AlertTriangle, Pencil
} from 'lucide-react';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { clientesService } from '../../services/clientes.service';
import { formatCurrency } from '../../lib/utils';
import { getSapCache, setSapCache, SAP_CACHE_KEYS, clearSapCache } from '../../lib/sapCache';
import { SAP_BASE_URL } from '../../store/environmentStore';
import { filterAllowedArticulos } from '../../config/allowedDigitalArticles';
import type { SapDatabase } from '../../store/environmentStore';
import { useSocketEquipos } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import { getPermissions } from '../../lib/permissions';
import { useThemeStore } from '../../store/themeStore';
import { useFormPersist } from '../../hooks/useFormPersist';
import { uploadsService } from '../../services/uploads.service';
import { parseCircuitoDigital, type CircuitoInfo } from '../../lib/circuitos';
import { circuitosService } from '../../services/circuitos.service';
import { CircuitCheckbox } from '../../components/ui/CircuitCheckbox';
import { DeleteCircuitoConfirmModal } from '../../components/DeleteCircuitoConfirmModal';
import { BULK_DELETE_ENABLED } from '../../config/featureFlags';

// Tarifas now come from SAP (U_IMU_PublicPrice = tarifa publica, PriceList 11 = tarifa piso)

// Formato auto-detection from article name
const CODE_FORMATO_MAP: Record<string, string> = {
  pb: 'PARABUS', cl: 'COLUMNA', bol: 'BOLERO', kco: 'Kiosco',
};
const CODE_PLAZA_MAP_SOL: Record<string, { estado: string; ciudades: string[] }> = {
  mx:  { estado: 'Ciudad de México / AM', ciudades: [] },
  mty: { estado: 'Nuevo León', ciudades: ['Monterrey', 'Guadalupe', 'San Nicolás de los Garza', 'Santa Catarina'] },
  gd:  { estado: 'Jalisco', ciudades: ['Guadalajara', 'Zapopan', 'Tlaquepaque'] },
  gdl: { estado: 'Jalisco', ciudades: ['Guadalajara', 'Zapopan', 'Tlaquepaque'] },
  ver: { estado: 'Veracruz', ciudades: ['Veracruz', 'Alvarado', 'Boca del Río'] },
  pv:  { estado: 'Jalisco', ciudades: ['Puerto Vallarta'] },
  tl:  { estado: 'Estado de México', ciudades: ['Toluca'] },
  nauc: { estado: 'Estado de México', ciudades: ['NAUCALPAN'] },
  em:  { estado: 'Estado de México', ciudades: [] },
  mr:  { estado: 'Yucatán', ciudades: ['Mérida'] },
  mer: { estado: 'Yucatán', ciudades: ['Mérida'] },
};

const CODE_TO_PLAZA_DISPLAY: Record<string, string> = {
  mx: 'Ciudad de México / AM', mty: 'Monterrey',
  gd: 'Guadalajara', gdl: 'Guadalajara',
  ver: 'Veracruz', pv: 'Puerto Vallarta', tl: 'Toluca',
  mr: 'Mérida', mer: 'Mérida',
};

// Quita acentos para comparar plazas/ciudades sin que falle por "MÉRIDA" vs "MERIDA",
// "LEÓN" vs "LEON", etc. (las plazas en `inventarios.plaza` traen acentos pero los
// nombres en ItemName de SAP suelen venir sin acentos, y viceversa).
const stripAccents = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const getPlazaFromArticle = (articulo: string, fallback?: string): string => {
  const segs = (articulo || '').toLowerCase().split('-');
  for (const seg of segs) { if (CODE_TO_PLAZA_DISPLAY[seg]) return CODE_TO_PLAZA_DISPLAY[seg]; }
  return fallback || articulo || '-';
};

const getFormatoFromArticulo = (itemName: string, itemCode?: string): string => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();

  // Bajo Puente - el backend solo tiene 'BAJO PUENTE' como mueble.
  // Los sub-tipos (Gran Terraza, Colorines, etc.) se distinguen por ciudad/ubicación, no por mueble.
  if (name.includes('BAJO PUENTE') || name.includes('TUNEL')) return 'BAJO PUENTE';

  // MI MACRO - detectar sub-tipo y mapear a los muebles válidos del backend
  // (los formatos del dropdown vienen de inventarios.mueble distintos)
  if (name.includes('MI MACRO')) {
    const codeUp = (itemCode || '').toUpperCase();
    // Vidrio
    if (name.includes('VIDRIO INTERIOR') || codeUp.endsWith('-VI')) return 'VIDRIO INTERIOR';
    if (name.includes('VIDRIO EXTERIOR') || codeUp.endsWith('-VE')) return 'VIDRIOS EXTERIOR';
    // Parabus con Mupi (chequear ANTES de PARABUS/MUPI solos)
    if (codeUp.endsWith('-PBMUP') || (name.includes('PARABUS') && name.includes('MUPI'))) return 'PARABUS CON MUPI';
    if (name.includes('MUPI') || codeUp.endsWith('-MP')) return 'MUPIS';
    if (name.includes('PARABUS') || codeUp.endsWith('-PB')) return 'PARABUS';
    // Modulos
    if (name.includes('MODULO A') || codeUp.endsWith('-MA')) return 'MODULO TIPO A';
    if (name.includes('MODULO B') || codeUp.endsWith('-MB')) return 'MODULO TIPO B';
    if (name.includes('MODULO C') || codeUp.endsWith('-MC')) return 'MODULO TIPO C';
    if (name.includes('MODULO D') || codeUp.endsWith('-MD')) return 'MODULO TIPO D';
  }

  // Puente Peatonal (antes de checks genéricos)
  if (name.includes('PUENTE PEATONAL')) return 'PUENTE PEATONAL';

  // Kiosco (SAP usa "KIOSKO" con K). Backend mueble = 'KIOSCO' en mayúsculas.
  if (name.includes('KIOSCO') || name.includes('KIOSKO')) return 'KIOSCO';

  // Formatos estándar — todos en MAYÚSCULAS para coincidir con muebles del backend
  if (name.includes('PARABUS') && name.includes('MUPI')) return 'PARABUS CON MUPI';
  if (name.includes('MUPI')) return 'MUPIS';
  if (name.includes('PARABUS')) return 'PARABUS';
  if (name.includes('VIDRIO INTERIOR')) return 'VIDRIO INTERIOR';
  if (name.includes('VIDRIO EXTERIOR')) return 'VIDRIOS EXTERIOR';
  if (name.includes('COLUMNA')) return 'COLUMNA';
  if (name.includes('BOLERO')) return 'BOLERO';
  if (name.includes('UNIPOLAR')) return 'UNIPOLAR';
  if (name.includes('MULTISERVICIO')) return 'MULTISERVICIO';
  if (itemCode) {
    for (const seg of itemCode.toLowerCase().split('-')) {
      if (CODE_FORMATO_MAP[seg]) return CODE_FORMATO_MAP[seg];
    }
  }
  return '';
};

// Mapeo formato → tipo de periodo requerido
// CATORCENAL: PB y Columna, Digital PB y Columna
// MENSUAL: Kioscos, Boleros, Mi Macro, Puentes Peatonales, Carteleras Digitales/Unipolares, Bajo Puentes
// Formatos mensuales (lista fija). Incluye los muebles del backend de Mi Macro
// (VIDRIO INTERIOR, MUPIS, MODULO TIPO X, etc.) que retorna getFormatoFromArticulo.
const FORMATOS_MENSUALES = [
  'Kiosco',
  'KIOSCO',
  'BOLERO',
  'MI MACRO',
  // Muebles backend de Mi Macro
  'VIDRIO INTERIOR',
  'VIDRIOS EXTERIOR',
  'MUPIS',
  'PARABUS',
  'PARABUS CON MUPI',
  'MODULO TIPO A',
  'MODULO TIPO B',
  'MODULO TIPO C',
  'MODULO TIPO D',
  // Legacy labels (compatibilidad con caras viejas)
  'MI MACRO Vidrio Int',
  'MI MACRO Vidrio Ext',
  'MI MACRO MUPI Int',
  'MI MACRO Parabus',
  'MI MACRO Modulos',
  'Puente Peatonal',
  'PUENTE PEATONAL',
  'Bajo Puente',
  'BAJO PUENTE',
  'Bajo Puente Gran Terraza',
  'Bajo Puente Circuito Geografos',
  'Bajo Puente Circuito del Parque',
  'Bajo Puente Fuentes',
  'Bajo Puente Colorines Bloque 1',
  'Bajo Puente Colorines Bloque 2',
  'Bajo Puente Colorines Bloque 3',
  'Bajo Puente Colorines Bloque 4',
  'Cartelera Digital',
  'Unipolar',
  'UNIPOLAR',
];

const FORMATOS_MENSUALES_SET = new Set(FORMATOS_MENSUALES);

const getRequiredPeriodoForFormato = (formato: string): 'catorcena' | 'mensual' => {
  if (FORMATOS_MENSUALES_SET.has(formato)) return 'mensual';
  return 'catorcena';
};

const isEspecialArticle = (itemCode: string): boolean => {
  const code = itemCode.toUpperCase();
  return code.startsWith('ESP') || code.startsWith('ES-');
};
const isNoInventoryArticle = (itemCode: string): boolean => {
  return itemCode.toUpperCase().startsWith('IM') || isEspecialArticle(itemCode);
};

// "Gestion QTO" — artículos para Querétaro/Celaya (sufijo `-QR`).
// Reservar es OPCIONAL — pase a ventas funciona con o sin reservas.
// La UI de reservar sigue activa (a diferencia de IM/ESP).
const isQuretaroArticle = (itemCode: string): boolean => {
  return (itemCode || '').toUpperCase().endsWith('-QR');
};

const getRequiredPeriodoForArticulo = (itemName: string): 'catorcena' | 'mensual' => {
  if (!itemName) return 'catorcena';
  const name = itemName.toUpperCase();
  // Mensual: Kioscos, Boleros, Mi Macro, Puentes Peatonales, Carteleras/Unipolares, Bajo Puentes
  if (name.includes('KIOSCO') || name.includes('KIOSKO')) return 'mensual';
  if (name.includes('BOLERO')) return 'mensual';
  if (name.includes('MI MACRO')) return 'mensual';
  if (name.includes('PEATONAL')) return 'mensual';
  if (name.includes('BAJO PUENTE')) return 'mensual';
  if (name.includes('CARTELERA')) return 'mensual';
  if (name.includes('UNIPOLAR')) return 'mensual';
  // Catorcenal: PB y Columna, Digital PB y Columna (y todo lo demás)
  return 'catorcena';
};

// Tipo auto-detection from article name (Tradicional or Digital)
const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' => {
  if (!itemName) return 'Tradicional';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  return 'Tradicional';
};

// Get tarifa publica and costo (tarifa piso) from SAP article data
const getTarifaFromArticulo = (articulo: SAPArticulo): { costo: number; tarifa_publica: number } => {
  if (!articulo) return { costo: 0, tarifa_publica: 0 };
  // SAP a veces devuelve U_IMU_PublicPrice como string ("30000.50") — parseFloat preserva decimales
  const tarifa_publica = parseFloat(String(articulo.U_IMU_PublicPrice ?? 0)) || 0;
  const pl11 = articulo.ItemPrices?.find(p => p.PriceList === 11);
  const costo = parseFloat(String(pl11?.Price ?? 0)) || 0;
  return { costo, tarifa_publica };
};

// Multi-city auto-fill rules for specific article patterns
// Order matters: more specific patterns BEFORE generic ones (e.g. PUERTO VALLARTA before GD)
// All estado/ciudad values MUST match DB inventarios exactly (with accents, municipios in UPPERCASE)
const MULTI_CITY_RULES: { pattern: RegExp; estado: string; ciudades: string[] }[] = [
  { pattern: /\bPUERTO VALLARTA\b|\bPV\b/, estado: 'Jalisco', ciudades: ['PUERTO VALLARTA'] },
  { pattern: /\bGD\b|\bGUADALAJARA\b|\bGDL\b/, estado: 'Jalisco', ciudades: ['GUADALAJARA', 'ZAPOPAN', 'SAN PEDRO TLAQUEPAQUE'] },
  { pattern: /\bMTY\b|\bMONTERREY\b/, estado: 'Nuevo León', ciudades: ['MONTERREY', 'GUADALUPE', 'SAN NICOLÁS DE LOS GARZA', 'SANTA CATARINA'] },
  { pattern: /\bBOCA DEL RIO\b/, estado: 'Veracruz', ciudades: ['BOCA DEL RIO'] },
  { pattern: /\bVERACRUZ\b|\bVER\b/, estado: 'Veracruz', ciudades: ['VERACRUZ', 'ALVARADO', 'BOCA DEL RIO'] },
  { pattern: /\bCHOLULA\b/, estado: 'Puebla', ciudades: ['SAN ANDRES CHOLULA', 'SAN PEDRO CHOLULA'] },
  { pattern: /\bPUEBLA\b|\bPB\b/, estado: 'Puebla', ciudades: ['PUEBLA', 'SAN ANDRES CHOLULA', 'SAN PEDRO CHOLULA'] },
  { pattern: /\bMERIDA\b|\bMR\b/, estado: 'Yucatán', ciudades: ['MÉRIDA'] },
  { pattern: /\bLEON\b|\bLEN\b/, estado: 'Guanajuato', ciudades: ['LEÓN'] },
  { pattern: /\bSALAMANCA\b/, estado: 'Guanajuato', ciudades: ['SALAMANCA'] },
  { pattern: /\bCELAYA\b/, estado: 'Guanajuato', ciudades: ['CELAYA'] },
  { pattern: /\bIRAPUATO\b/, estado: 'Guanajuato', ciudades: ['IRAPUATO'] },
  { pattern: /\bGUANAJUATO\b|\bGTO\b/, estado: 'Guanajuato', ciudades: [] },
  { pattern: /\bOAXACA\b|\bOAX\b/, estado: 'Oaxaca de Juárez', ciudades: ['OAXACA DE JUÁREZ'] },
  { pattern: /\bAGS\b|\bAGUASCALIENTES\b/, estado: 'Aguascalientes', ciudades: ['AGUASCALIENTES'] },
  { pattern: /\bCULIACAN\b/, estado: 'Sinaloa', ciudades: ['CULIACÁN'] },
  { pattern: /\bMAZATLAN\b|\bMZ\b/, estado: 'Sinaloa', ciudades: ['MAZATLÁN'] },
  { pattern: /\bSLP\b|\bSAN LUIS POTOSI\b/, estado: 'San Luis Potosí', ciudades: ['SAN LUIS POTOSÍ'] },
  { pattern: /\bTIJUANA\b|\bTJ\b/, estado: 'Baja California', ciudades: ['TIJUANA'] },
  { pattern: /\bACAPULCO\b|\bAC\b/, estado: 'Guerrero', ciudades: ['ACAPULCO DE JUÁREZ'] },
  { pattern: /\bPACHUCA\b|\bPH\b/, estado: 'Hidalgo', ciudades: ['PACHUCA DE SOTO'] },
  { pattern: /\bTOLUCA\b|\bTL\b/, estado: 'Estado de México', ciudades: ['TOLUCA', 'METEPEC', 'LERMA', 'SAN MATEO ATENCO'] },
  { pattern: /\bCUERNAVACA\b|\bCV\b/, estado: 'Morelos', ciudades: ['CUERNAVACA'] },
  { pattern: /\bTAMPICO\b|\bTM\b/, estado: 'Tamaulipas', ciudades: ['TAMPICO'] },
  { pattern: /\bTORREON\b|\bTR\b/, estado: 'Coahuila', ciudades: ['TORREON'] },
  { pattern: /\bQUERETARO\b|\bQR\b/, estado: 'Querétaro', ciudades: ['QUERÉTARO'] },
  { pattern: /\bTUXTLA\b|\bTG\b/, estado: 'Chiapas', ciudades: ['TUXTLA GUTIERREZ'] },
  { pattern: /\bTABASCO\b|\bVILLAHERMOSA\b|\bTB\b/, estado: 'Tabasco', ciudades: ['VILLAHERMOSA'] },
  { pattern: /\bMORELIA\b/, estado: 'Michoacán', ciudades: ['MORELIA'] },
  { pattern: /\bCANCUN\b/, estado: 'Quintana Roo', ciudades: ['BENITO JUÁREZ'] },
  { pattern: /\bCDMX\b|\bCIUDAD DE MEXICO\b|\bDF\b|\bMEXICO\b(?!\s*(Y\s*AM|WI-?FI))|\bMX\b/, estado: 'Ciudad de México / AM', ciudades: [] },
  { pattern: /\bNAUC\w*|\bNAUCALPAN\b/, estado: 'Estado de México', ciudades: ['NAUCALPAN'] },
  { pattern: /\bEM\b/, estado: 'Estado de México', ciudades: [] },
];

// Extract city from article name and return estado/ciudades
const getCiudadEstadoFromArticulo = (itemName: string, itemCode?: string): { estado: string; ciudades: string[] } | null => {
  if (!itemName) return null;
  // Sin acentos: las reglas regex usan "MERIDA"/"LEON"/etc. sin tilde, pero los
  // ItemName de SAP pueden traer "MÉRIDA"/"LEÓN". Normalizamos para que matcheen.
  const name = stripAccents(itemName.toUpperCase());

  // Check multi-city rules (order matters)
  for (const rule of MULTI_CITY_RULES) {
    if (rule.pattern.test(name)) {
      return { estado: rule.estado, ciudades: rule.ciudades };
    }
  }
  if (itemCode) {
    for (const seg of itemCode.toLowerCase().split('-')) {
      if (CODE_PLAZA_MAP_SOL[seg]) return CODE_PLAZA_MAP_SOL[seg];
    }
  }
  return null;
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// "Ciudad de México / AM" es un super-estado virtual que combina CDMX + Estado de México
const CDMX_AM_LABEL = 'Ciudad de México / AM';
const CDMX_AM_STATES = ['Ciudad de México', 'Estado de México'];
const CDMX_AM_EDO_MEX_CITIES = ['ATIZAPÁN', 'CUAUTITLÁN IZCALLI', 'ECATEPEC', 'HUIXQUILUCAN', 'NAUCALPAN', 'TLALNEPANTLA', 'TULTITLÁN'];
const resolveEstados = (estado: string): string[] => estado === CDMX_AM_LABEL ? CDMX_AM_STATES : [estado];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

const getFilePreviewUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) return `${STATIC_URL}${url}`;
  return url;
};

interface SAPCuicItem {
  id: number;  // cliente.id en BD QEB — único por cliente (vs CUIC y card_code que pueden repetirse cuando 1 cliente legal tiene varias marcas)
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
  ACA_U_SAPCode: string;
  ASESOR_U_SAPCode_Original?: number;
  sap_database?: string | null;
}

interface SAPArticulo {
  ItemCode: string;
  ItemName: string;
  U_IMU_PublicPrice?: number | null;
  ItemPrices?: { PriceList: number; Price: number }[];
}

interface CaraEntry {
  id: string;
  articulo: SAPArticulo;
  estado: string;
  ciudades: string[];
  plaza?: string; // display-only (derived from plaza selection); backend still uses estado+ciudades
  circuito?: CircuitoInfo; // marcado si el artículo es un circuito digital (RT-DIG-NN-XX)
  circuitoTotal?: number; // total de inventarios del circuito (para fijar caras)
  circuitoFlujo?: number; // count real de inventarios tipo Flujo del circuito
  circuitoContraflujo?: number; // count real de inventarios tipo Contraflujo del circuito
  formato: string;
  tipo: string;
  nse: string[];
  catorcenaNum: number;
  catorcenaYear: number;
  periodoInicio: string;
  periodoFin: string;
  renta: number;
  bonificacion: number;
  tarifaPublica: number;
  tarifaEfectiva?: number;
  descuento: number;
  precioTotal: number;
  autorizacion_dg?: 'aprobado' | 'pendiente' | 'rechazado';
  autorizacion_dcm?: 'aprobado' | 'pendiente' | 'rechazado';
  // Valores originales del backend (antes de contaminación)
  _originalDg?: 'aprobado' | 'pendiente' | 'rechazado';
  _originalDcm?: 'aprobado' | 'pendiente' | 'rechazado';
  // RT/BF grouping
  grupo_rt_bf?: number;
  esBf?: boolean; // true if this is the BF row of a RT/BF pair
  // Masivo grouping: same articulo+plaza+formato+tipo+nse across multiple catorcenas
  grupo_masivo_id?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editSolicitudId?: number;
}

// Searchable Select Component - Shows ALL options
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
  disabled,
}: {
  label: string;
  options: any[];
  value: any;
  onChange: (item: any) => void;
  onClear: () => void;
  displayKey: string;
  valueKey: string;
  searchKeys: string[]; // Support multiple search keys
  renderOption?: (item: any) => React.ReactNode;
  renderSelected?: (item: any) => React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Show ALL options, only filter when searching - search across multiple keys
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
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${value
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
          : isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
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
                  className={`w-full pl-9 pr-3 py-2 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
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
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-200/50'} last:border-0 ${value && value[valueKey] === option[valueKey]
                      ? 'bg-purple-500/20 text-purple-300'
                      : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {renderOption ? renderOption(option) : (
                      <span>{option[displayKey]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className={`px-3 py-1.5 border-t ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'} text-[10px]`}>
              Mostrando {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select with tags - Add button at top
function MultiSelectTags({
  label,
  options,
  selected,
  onChange,
  displayKey,
  valueKey,
  searchKey,
}: {
  label: string;
  options: any[];
  selected: any[];
  onChange: (items: any[]) => void;
  displayKey: string;
  valueKey: string;
  searchKey: string;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt =>
      String(opt[searchKey] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchKey]);

  const toggle = (item: any) => {
    const exists = selected.find(s => s[valueKey] === item[valueKey]);
    if (exists) {
      onChange(selected.filter(s => s[valueKey] !== item[valueKey]));
    } else {
      onChange([...selected, item]);
    }
  };

  const remove = (item: any) => {
    onChange(selected.filter(s => s[valueKey] !== item[valueKey]));
  };

  return (
    <div className="space-y-2">
      {/* Add button at TOP */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 ${isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'} border rounded-lg text-xs transition-all`}
        >
          <Plus className="h-3 w-3" />
          Agregar {label}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearchTerm(''); }} />
            <div className={`absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-purple-500/20 ${isDark ? 'bg-zinc-900' : 'bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
              {/* Search at top */}
              <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <input
                  type="text"
                  placeholder={`Buscar...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full px-3 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  autoFocus
                />
              </div>
              {/* Options below */}
              <div className="max-h-52 overflow-auto">
                {filteredOptions.map((option) => {
                  const isSelected = selected.find(s => s[valueKey] === option[valueKey]);
                  return (
                    <button
                      key={option[valueKey]}
                      type="button"
                      onClick={() => toggle(option)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-purple-500/20 text-purple-300' : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : isDark ? 'border-zinc-600' : 'border-gray-300'
                        }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <span>{option[displayKey]}</span>
                        {option.area && (
                          <span className={`ml-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({option.area})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Selected tags below button */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item[valueKey]}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs"
            >
              {item[displayKey]}
              {item.area && <span className="text-[10px] text-purple-400/70">({item.area})</span>}
              <button type="button" onClick={() => remove(item)} className={isDark ? 'hover:text-white' : 'hover:text-gray-900'}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CreateSolicitudModal — también funciona como EDITAR SOLICITUD
// Si recibe editSolicitudId, entra en modo edición (isEditMode)
// ============================================================
export function CreateSolicitudModal({ isOpen, onClose, editSolicitudId }: Props) {
  const queryClient = useQueryClient();
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const isEditMode = !!editSolicitudId; // <-- MODO EDITAR si tiene ID
  useModalTracker(isEditMode ? 'Editar Solicitud' : 'Nueva Solicitud', isOpen);

  // Socket para actualizar usuarios en tiempo real cuando cambian miembros de equipos
  useSocketEquipos();

  // Current user for default asignado
  const currentUser = useAuthStore((state) => state.user);
  const permissions = getPermissions(currentUser?.rol);
  const canEditCliente = permissions.canEditClienteEnFormularios;

  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Helper to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ show: true, message, type });
  };

  // Prevent double-submit (covers async file upload gap before mutation starts)
  const isSubmittingRef = useRef(false);
  const circuitFormRef = useRef<HTMLDivElement>(null);
  const circuitTableRef = useRef<HTMLDivElement>(null);
  const editFormPopulatedRef = useRef(false);
  // Snapshot del formulario al iniciar edición (para detectar cambios no guardados)
  const initialSnapshotRef = useRef<string | null>(null);
  // Marca síncrona de que se restauró un borrador (evita que el effect de reset
  // borre los campos que el effect de carga de borrador acaba de poblar).
  const draftRestoredRef = useRef(false);

  // Form state
  const [step, setStep] = useState(1);

  // Client section
  const [selectedCuic, setSelectedCuic] = useState<SAPCuicItem | null>(null);

  // Asignados
  const [selectedAsignados, setSelectedAsignados] = useState<UserOption[]>([]);

  // Campaign data
  const [nombreCampania, setNombreCampania] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // Dates
  const [tipoPeriodo, setTipoPeriodo] = useState<'catorcena' | 'mensual'>('catorcena');
  const [yearInicio, setYearInicio] = useState<number | undefined>();
  const [yearFin, setYearFin] = useState<number | undefined>();
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>();
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>();
  // Mensual mode: month range
  const [mesInicio, setMesInicio] = useState<number | undefined>(); // 1-12
  const [mesFin, setMesFin] = useState<number | undefined>(); // 1-12

  // Caras data with full info per entry
  const [caras, setCaras] = useState<CaraEntry[]>([]);
  // Modo masivo: ON = rango de catorcenas (crea N caras); OFF = una catorcena
  const [modoMasivo, setModoMasivo] = useState(false);
  // Distribución de muebles del circuito actualmente seleccionado en newCara
  const [circuitoMuebles, setCircuitoMuebles] = useState<Record<string, number> | null>(null);
  // Conteo real de Flujo/Contraflujo del circuito actual (para no dividir entre 2)
  const [circuitoFlujoContra, setCircuitoFlujoContra] = useState<{ flujo: number; contraflujo: number } | null>(null);

  // New cara form
  const [newCara, setNewCara] = useState({
    articulo: null as SAPArticulo | null,
    plaza: '', // UI-facing plaza; populates estado/ciudades on change
    estado: '',
    ciudades: [] as string[],
    formato: '',
    tipo: '' as 'Tradicional' | 'Digital' | '',
    nse: [] as string[],
    periodo: '',
    periodoFinCat: '', // Catorcena fin for range mode (e.g., "2026-8")
    // Custom period dates (mensual mode - per cara dates within month)
    periodoInicioCustom: '',
    periodoFinCustom: '',
    renta: 0,
    bonificacion: 0,
    tarifaPublica: 0,
    articuloBf: null as SAPArticulo | null,
  });
  const [tarifaPublicaInput, setTarifaPublicaInput] = useState<string>('');
  const [tarifaPublicaFocused, setTarifaPublicaFocused] = useState(false);

  // File
  const [archivo, setArchivo] = useState<string | null>(null);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [tipoArchivo, setTipoArchivo] = useState<string | null>(null);

  // IMU
  const [imu, setImu] = useState(false);

  // Draft persistence
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const { save: saveDraft, load: loadDraft, clear: clearDraft } = useFormPersist('qeb_solicitud_draft');

  // Expanded catorcenas in table
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());

  // Selección masiva de circuitos (para eliminar en lote por circuito / catorcena)
  const [selectedCaraIds, setSelectedCaraIds] = useState<Set<string>>(new Set());
  // Modal de confirmación para el borrado masivo
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    isOpen: boolean;
    count: number;
    tienePareja: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, count: 0, tienePareja: false, onConfirm: () => {} });

  // Editing cara state
  const [editingCaraId, setEditingCaraId] = useState<string | null>(null);

  // Confirmación al cerrar con cambios sin guardar
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Fetch users (filtered by team)
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users', 'team-filtered'],
    queryFn: () => solicitudesService.getUsers(undefined, true),
    enabled: isOpen,
  });

  // Fetch inventory filters
  const { data: inventarioFilters } = useQuery({
    queryKey: ['inventario-filters'],
    queryFn: () => solicitudesService.getInventarioFilters(),
    enabled: isOpen,
  });

  // Fetch catorcenas
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  // Fetch existing solicitud data for edit mode
  const { data: editSolicitudData, isLoading: editDataLoading } = useQuery({
    queryKey: ['solicitud-edit', editSolicitudId],
    queryFn: () => solicitudesService.getFullDetails(editSolicitudId!),
    enabled: isOpen && isEditMode,
  });

  // State for forcing SAP refresh
  const [forceRefreshSap, setForceRefreshSap] = useState(0);

  // SAP database filter for CUIC selector
  const [sapDbFilter, setSapDbFilter] = useState<SapDatabase | 'ALL'>('ALL');

  // Fetch CUIC data from local DB instead of SAP
  const { data: cuicDataRaw, isLoading: cuicLoading, refetch: refetchCuic, isFetching: cuicFetching } = useQuery({
    queryKey: ['clientes-full-for-solicitud'],
    queryFn: async () => {
      const result = await clientesService.getAllFull();
      // Map to SAPCuicItem-compatible format
      return (result.data || []).map(c => ({
        id: c.id,
        CUIC: c.CUIC!,
        T0_U_RazonSocial: c.T0_U_RazonSocial || '',
        T0_U_Cliente: c.T0_U_Cliente || '',
        T1_U_UnidadNegocio: c.T1_U_UnidadNegocio || '',
        T0_U_Agencia: c.T0_U_Agencia || '',
        ASESOR_U_IDAsesor: c.ASESOR_U_IDAsesor || String(c.T0_U_IDAsesor || ''),
        ASESOR_U_Asesor: c.ASESOR_U_Asesor || c.T0_U_Asesor || '',
        T1_U_IDMarca: c.T1_U_IDMarca || 0,
        T2_U_Marca: c.T2_U_Marca || '',
        T2_U_IDProducto: c.T2_U_IDProducto || 0,
        T2_U_Producto: c.T2_U_Producto || '',
        T2_U_IDCategoria: c.T2_U_IDCategoria || 0,
        T2_U_Categoria: c.T2_U_Categoria || '',
        ACA_U_SAPCode: c.card_code || '',
        ASESOR_U_SAPCode_Original: c.salesperson_code ?? undefined,
        sap_database: c.sap_database || null,
      }));
    },
    enabled: isOpen,
    staleTime: 2 * 60 * 1000,
  });

  // Filter cuicData by selected SAP database
  const cuicData = useMemo(() => {
    if (!cuicDataRaw) return [];
    if (sapDbFilter === 'ALL') return cuicDataRaw;
    return cuicDataRaw.filter(c => c.sap_database === sapDbFilter);
  }, [cuicDataRaw, sapDbFilter]);

  // Fetch ALL articulos from SAP with cache
  const { data: articulosData, isLoading: articulosLoading, refetch: refetchArticulos, isFetching: articulosFetching } = useQuery({
    queryKey: ['sap-articulos-all', forceRefreshSap],
    queryFn: async () => {
      // Try cache first (unless forcing refresh)
      if (forceRefreshSap === 0) {
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) {
          return cached;
        }
      }
      // Fetch from SAP
      try {
        const response = await fetch(`${SAP_BASE_URL}/articulos`);
        if (!response.ok) throw new Error('Error fetching articulos data');
        const data = await response.json();
        const raw = (data.value || data) as SAPArticulo[];
        const items = filterAllowedArticulos(raw);
        // Save to cache
        if (items && items.length > 0) {
          setSapCache(SAP_CACHE_KEYS.ARTICULOS, items);
        }
        return items;
      } catch (error) {
        // If fetch fails, try to return cached data
        const cached = getSapCache<SAPArticulo[]>(SAP_CACHE_KEYS.ARTICULOS);
        if (cached && cached.length > 0) {
          console.warn('SAP articulos fetch failed, using cached data');
          return cached;
        }
        throw error;
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Filter articulos by current tipoPeriodo. Excluir BF/CF del dropdown principal:
  // los BF/CF solo deben aparecer en el selector de bonificación (cuando bonif > 0).
  const articulosFiltrados = useMemo(() => {
    if (!articulosData) return [];
    return articulosData.filter(a => {
      const code = a.ItemCode.toUpperCase();
      if (code.startsWith('BF') || code.startsWith('CF')) return false;
      return getRequiredPeriodoForArticulo(a.ItemName) === tipoPeriodo;
    });
  }, [articulosData, tipoPeriodo]);

  // Function to force refresh data
  const handleRefreshSap = () => {
    clearSapCache();
    setForceRefreshSap(prev => prev + 1);
    queryClient.invalidateQueries({ queryKey: ['clientes-full-for-solicitud'] });
  };

  // Fetch cascade-filtered options (formatos, tipos, NSE) by estado/ciudades
  const { data: inventarioOptions } = useQuery({
    queryKey: ['inventario-options', newCara.estado, newCara.ciudades],
    queryFn: () => solicitudesService.getInventarioOptions(resolveEstados(newCara.estado), newCara.ciudades),
    enabled: isOpen && (!!newCara.estado || newCara.ciudades.length > 0),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch next available ID
  const { data: nextId } = useQuery({
    queryKey: ['solicitudes-next-id'],
    queryFn: () => solicitudesService.getNextId(),
    enabled: isOpen,
  });

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Cargar borrador de localStorage al montar (solo en modo crear)
  useEffect(() => {
    if (isEditMode) return;
    const draft = loadDraft<{
      step: number;
      selectedCuic: typeof selectedCuic;
      selectedAsignados: typeof selectedAsignados;
      nombreCampania: string;
      descripcion: string;
      notas: string;
      yearInicio?: number;
      yearFin?: number;
      catorcenaInicio?: number;
      catorcenaFin?: number;
      caras: typeof caras;
      imu: boolean;
      newCara: typeof newCara;
    }>();
    if (!draft) return;
    const hasData = draft.nombreCampania || draft.selectedCuic || draft.caras?.length > 0;
    if (!hasData) return;
    draftRestoredRef.current = true; // síncrono: bloquea el reset en el mismo commit
    if (draft.step) setStep(draft.step);
    if (draft.selectedCuic) setSelectedCuic(draft.selectedCuic);
    if (draft.selectedAsignados?.length) setSelectedAsignados(draft.selectedAsignados);
    if (draft.nombreCampania) setNombreCampania(draft.nombreCampania);
    if (draft.descripcion) setDescripcion(draft.descripcion);
    if (draft.notas) setNotas(draft.notas);
    if (draft.yearInicio !== undefined) setYearInicio(draft.yearInicio);
    if (draft.yearFin !== undefined) setYearFin(draft.yearFin);
    if (draft.catorcenaInicio !== undefined) setCatorcenaInicio(draft.catorcenaInicio);
    if (draft.catorcenaFin !== undefined) setCatorcenaFin(draft.catorcenaFin);
    if (draft.caras?.length) setCaras(draft.caras);
    if (draft.imu !== undefined) setImu(draft.imu);
    if (draft.newCara) setNewCara(draft.newCara);
    setRestoredFromDraft(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar borrador en localStorage cuando cambia el estado (solo en modo crear)
  useEffect(() => {
    if (isEditMode) return;
    if (!isOpen) return; // No guardar cuando el modal está cerrado (evita re-guardar tras submit)
    if (!nombreCampania && !selectedCuic && !caras.length && !descripcion && !notas) {
      // Si el formulario está vacío, limpiar activamente el borrador
      clearDraft();
      return;
    }
    saveDraft({
      step,
      selectedCuic,
      selectedAsignados,
      nombreCampania,
      descripcion,
      notas,
      yearInicio,
      yearFin,
      catorcenaInicio,
      catorcenaFin,
      caras,
      imu,
      newCara,
    });
  }, [isOpen, step, selectedCuic, selectedAsignados, nombreCampania, descripcion, notas, yearInicio, yearFin, catorcenaInicio, catorcenaFin, caras, imu, newCara, isEditMode, saveDraft, clearDraft]);

  // Reset form when opening modal in create mode
  useEffect(() => {
    if (isOpen && !isEditMode && !restoredFromDraft && !draftRestoredRef.current) {
      // Reset all form state for a fresh start
      editFormPopulatedRef.current = false;
      setStep(1);
      setSelectedCuic(null);
      // Pre-populate asignados with the current user (creator)
      if (currentUser) {
        setSelectedAsignados([{
          id: currentUser.id,
          nombre: currentUser.nombre,
          area: currentUser.area,
          puesto: currentUser.puesto
        }]);
      } else {
        setSelectedAsignados([]);
      }
      setNombreCampania('');
      setDescripcion('');
      setNotas('');
      setTipoPeriodo('catorcena');
      setYearInicio(undefined);
      setYearFin(undefined);
      setCatorcenaInicio(undefined);
      setCatorcenaFin(undefined);
      setMesInicio(undefined);
      setMesFin(undefined);
      setCaras([]);
      setArchivo(null);
      setArchivoFile(null);
      setTipoArchivo(null);
      setImu(false);
      setExpandedCatorcenas(new Set());
      setSelectedCaraIds(new Set());
      setNewCara({
        articulo: null,
        plaza: '',
        estado: '',
        ciudades: [],
        formato: '',
        tipo: '',
        nse: [],
        periodo: '',
        periodoFinCat: '',
        periodoInicioCustom: '',
        periodoFinCustom: '',
        renta: 0,
        bonificacion: 0,
        tarifaPublica: 0,
        articuloBf: null,
      });
    }
  }, [isOpen, isEditMode, currentUser, restoredFromDraft]);

  // Reset form state when switching between different solicitudes in edit mode
  useEffect(() => {
    if (isOpen && isEditMode && editSolicitudId) {
      // Reset state before loading new solicitud data
      editFormPopulatedRef.current = false;
      initialSnapshotRef.current = null;
      setRestoredFromDraft(false);
      setSelectedCuic(null);
      setSelectedAsignados([]);
      setNombreCampania('');
      setDescripcion('');
      setNotas('');
      setCaras([]);
      setArchivo(null);
      setArchivoFile(null);
      setTipoArchivo(null);
      setImu(false);
    }
  }, [editSolicitudId]);

  // Filter cities by estado
  const filteredCiudades = useMemo(() => {
    if (!inventarioFilters?.ciudades || !newCara.estado) return [];
    const estadosReales = resolveEstados(newCara.estado);
    const isAM = newCara.estado === CDMX_AM_LABEL;
    return inventarioFilters.ciudades
      .filter(c => estadosReales.includes(c.estado))
      .map(c => c.ciudad)
      .filter((c): c is string => !!c)
      .filter(c => !isAM || !['Ciudad de México', 'Estado de México'].includes(c) ? true : true)
      .filter(c => {
        if (!isAM) return true;
        // For AM: allow all CDMX cities, but only specific Edo Mex cities
        const ciudadUpper = c.toUpperCase();
        const estadoCiudad = inventarioFilters.ciudades.find(ci => ci.ciudad === c)?.estado || '';
        const isEdoMex = estadoCiudad.toUpperCase().includes('ESTADO DE M');
        return !isEdoMex || CDMX_AM_EDO_MEX_CITIES.includes(ciudadUpper);
      });
  }, [inventarioFilters, newCara.estado]);

  // Cascade-filtered formatos/tipos/NSE from inventario-options API
  const filteredFormatos = useMemo(() => {
    if (inventarioOptions?.formatos) return inventarioOptions.formatos;
    return inventarioFilters?.formatos || [];
  }, [inventarioOptions, inventarioFilters]);

  const filteredTipos = useMemo(() => {
    if (inventarioOptions?.tipos) return inventarioOptions.tipos;
    return ['Tradicional', 'Digital'];
  }, [inventarioOptions]);

  const filteredNse = useMemo(() => {
    if (inventarioOptions?.nse) return inventarioOptions.nse;
    return inventarioFilters?.nse || [];
  }, [inventarioOptions, inventarioFilters]);

  // Clear incompatible selections when filtered options change
  // EXCEPCIÓN: si el artículo seleccionado es un Circuito Digital, no resetear
  //   formato (MIXTO) ni tipo (Digital), pues son valores fijos del circuito
  //   y no aparecen en la lista de inventarioOptions.
  useEffect(() => {
    if (!inventarioOptions) return;
    setNewCara(prev => {
      const esCircuito = prev.articulo ? !!parseCircuitoDigital(prev.articulo.ItemCode) : false;
      // Si hay artículo seleccionado, no resetear formato/tipo auto-derivados
      // (el usuario los puede ajustar manualmente). Solo resetear NSE inválidos.
      const tieneArticulo = !!prev.articulo;
      let changed = false;
      const updates: Partial<typeof prev> = {};
      if (!esCircuito && !tieneArticulo && prev.formato && !inventarioOptions.formatos.includes(prev.formato)) {
        updates.formato = '';
        changed = true;
      }
      if (!esCircuito && !tieneArticulo && prev.tipo && !inventarioOptions.tipos.includes(prev.tipo)) {
        updates.tipo = '' as typeof prev.tipo;
        changed = true;
      }
      if (!esCircuito && prev.nse.length > 0) {
        const validNse = prev.nse.filter(n => inventarioOptions.nse.includes(n));
        if (validNse.length !== prev.nse.length) {
          updates.nse = validNse;
          changed = true;
        }
      }
      return changed ? { ...prev, ...updates } : prev;
    });
  }, [inventarioOptions]);

  // Year options with validation
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

  // Catorcena options
  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) {
      return cats.filter(c => c.numero_catorcena <= catorcenaFin);
    }
    return cats;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) {
      return cats.filter(c => c.numero_catorcena >= catorcenaInicio);
    }
    return cats;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Mes options with validation
  const mesInicioOptions = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    if (yearInicio && yearFin && yearInicio === yearFin && mesFin !== undefined) {
      return all.filter(m => m <= mesFin);
    }
    return all;
  }, [yearInicio, yearFin, mesFin]);

  const mesFinOptions = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    if (yearInicio && yearFin && yearInicio === yearFin && mesInicio !== undefined) {
      return all.filter(m => m >= mesInicio);
    }
    return all;
  }, [yearInicio, yearFin, mesInicio]);

  // Get periods from selected range
  const availablePeriods = useMemo(() => {
    if (tipoPeriodo === 'mensual') {
      // Generate monthly periods
      if (!yearInicio || !yearFin || mesInicio === undefined || mesFin === undefined) return [];
      const periods: { id: number; a_o: number; numero_catorcena: number; fecha_inicio: string; fecha_fin: string; label: string }[] = [];
      let y = yearInicio, m = mesInicio;
      while (y < yearFin || (y === yearFin && m <= mesFin)) {
        const fechaIni = new Date(y, m - 1, 1);
        const fechaFinMes = new Date(y, m, 0);
        periods.push({
          id: y * 100 + m,
          a_o: y,
          numero_catorcena: m,
          fecha_inicio: fechaIni.toISOString().split('T')[0],
          fecha_fin: fechaFinMes.toISOString().split('T')[0],
          label: `${MESES[m - 1]} ${y}`,
        });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return periods;
    }

    // Catorcena mode
    if (!catorcenasData?.data || !yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];

    return catorcenasData.data.filter(c => {
      if (c.a_o < yearInicio || c.a_o > yearFin) return false;
      if (c.a_o === yearInicio && c.numero_catorcena < catorcenaInicio) return false;
      if (c.a_o === yearFin && c.numero_catorcena > catorcenaFin) return false;
      return true;
    });
  }, [tipoPeriodo, catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin, mesInicio, mesFin]);

  // Detect caras whose period is outside the current availablePeriods range
  // O cuyas fechas reales (inicio_periodo / fin_periodo) salen del rango global
  // de la solicitud (fechaInicio / fechaFin).
  const invalidCaras = useMemo(() => {
    if (caras.length === 0) return [];
    const rangeConfigured = tipoPeriodo === 'mensual'
      ? (yearInicio && yearFin && mesInicio !== undefined && mesFin !== undefined)
      : (yearInicio && yearFin && catorcenaInicio && catorcenaFin);
    if (!rangeConfigured) return [];

    const validKeys = new Set(availablePeriods.map(p => `${p.a_o}-${p.numero_catorcena}`));

    // Rango global: usado para verificar fechas exactas
    let rangoIni = '';
    let rangoFin = '';
    if (tipoPeriodo === 'mensual' && yearInicio && yearFin && mesInicio && mesFin) {
      rangoIni = `${yearInicio}-${String(mesInicio).padStart(2, '0')}-01`;
      const lastDay = new Date(yearFin, mesFin, 0).getDate();
      rangoFin = `${yearFin}-${String(mesFin).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (catorcenasData?.data && yearInicio && yearFin && catorcenaInicio && catorcenaFin) {
      const ini = catorcenasData.data.find(c => c.a_o === yearInicio && c.numero_catorcena === catorcenaInicio);
      const fin = catorcenasData.data.find(c => c.a_o === yearFin && c.numero_catorcena === catorcenaFin);
      if (ini) rangoIni = String(ini.fecha_inicio).split('T')[0];
      if (fin) rangoFin = String(fin.fecha_fin).split('T')[0];
    }

    return caras.filter(c => {
      // Inválida si la (catorcena/mes, año) no está en el rango
      if (!validKeys.has(`${c.catorcenaYear}-${c.catorcenaNum}`)) return true;
      // O si las fechas reales del circuito se salen del rango global
      if (rangoIni && rangoFin && c.periodoInicio && c.periodoFin) {
        const ini = String(c.periodoInicio).split('T')[0];
        const fin = String(c.periodoFin).split('T')[0];
        if (ini < rangoIni || fin > rangoFin) return true;
      }
      return false;
    });
  }, [caras, availablePeriods, tipoPeriodo, yearInicio, yearFin, catorcenaInicio, catorcenaFin, mesInicio, mesFin, catorcenasData]);

  // Calculate fecha_inicio and fecha_fin from catorcenas or months
  const fechaInicio = useMemo(() => {
    if (tipoPeriodo === 'mensual') {
      if (!yearInicio || mesInicio === undefined) return '';
      return new Date(yearInicio, mesInicio - 1, 1).toISOString().split('T')[0];
    }
    if (!catorcenasData?.data || !yearInicio || !catorcenaInicio) return '';
    const cat = catorcenasData.data.find(c => c.a_o === yearInicio && c.numero_catorcena === catorcenaInicio);
    return cat ? cat.fecha_inicio : '';
  }, [tipoPeriodo, catorcenasData, yearInicio, catorcenaInicio, mesInicio]);

  const fechaFin = useMemo(() => {
    if (tipoPeriodo === 'mensual') {
      if (!yearFin || mesFin === undefined) return '';
      return new Date(yearFin, mesFin, 0).toISOString().split('T')[0];
    }
    if (!catorcenasData?.data || !yearFin || !catorcenaFin) return '';
    const cat = catorcenasData.data.find(c => c.a_o === yearFin && c.numero_catorcena === catorcenaFin);
    return cat ? cat.fecha_fin : '';
  }, [tipoPeriodo, catorcenasData, yearFin, catorcenaFin, mesFin]);

  // Add cara entry
  const handleAddCara = async () => {
    // Bloqueo: con autorización de dirección pendiente no se pueden AGREGAR
    // circuitos nuevos (editar uno existente sí, por eso el !editingCaraId).
    if (authBlocked && !editingCaraId) {
      showToast('Hay circuito(s) con autorización pendiente de DG/DCM. No puedes agregar nuevos circuitos hasta que dirección los apruebe o rechace.', 'error');
      return;
    }
    // Circuitos: NSE no es requerido (los inventarios del circuito ya están fijos)
    const esCircuitoNew = newCara.articulo ? !!parseCircuitoDigital(newCara.articulo.ItemCode) : false;
    if (!newCara.articulo || !newCara.estado || !newCara.formato || !newCara.tipo) return;
    if (!esCircuitoNew && newCara.nse.length === 0) return;

    // Validar tarifa pública: si es 0, solo CT, BF/CF, IM, IN (intercambio) y
    // ESP/ES- pueden avanzar.
    const artCode = newCara.articulo.ItemCode?.toUpperCase() || '';
    const esCortesia = artCode.startsWith('CT');
    const esBonificacion = artCode.startsWith('BF') || artCode.startsWith('CF');
    const esImpresion = artCode.startsWith('IM');
    const esIntercambio = artCode.startsWith('IN');
    const esEspecial = isEspecialArticle(artCode);
    if (newCara.tarifaPublica <= 0 && !esCortesia && !esBonificacion && !esImpresion && !esIntercambio && !esEspecial) {
      alert('La tarifa pública no puede ser 0. Por favor ingresa una tarifa válida.');
      return;
    }

    // BF validation: if bonificacion > 0 on a regular RT article, require articuloBf
    const needsBfArticle = newCara.bonificacion > 0 && !esCortesia && !esBonificacion && !esImpresion && !esEspecial;
    if (needsBfArticle && !newCara.articuloBf) {
      alert('Debes seleccionar el artículo de bonificación (BF) antes de guardar, o quita las caras de bonificación a 0.');
      return;
    }

    // No permitir bonificación sin renta (la bonif es ADICIONAL a la renta).
    // Excepción: artículos puros de bonificación (BF/CF/CT) y especiales que no requieren renta.
    if (newCara.bonificacion > 0 && newCara.renta <= 0 && !esCortesia && !esBonificacion && !esImpresion && !esEspecial) {
      alert('No puedes agregar bonificación sin tener al menos 1 cara de renta. Sube la renta o quita la bonificación.');
      return;
    }

    let catorcenaYear: number;
    let catorcenaNum: number;
    let periodoInicioVal: string;
    let periodoFinVal: string;

    if (tipoPeriodo === 'mensual') {
      // Mensual: month from dropdown + custom dates per cara (libres dentro del rango total)
      if (!newCara.periodo || !newCara.periodoInicioCustom || !newCara.periodoFinCustom) return;
      const [yearStr, mesStr] = newCara.periodo.split('-');
      catorcenaYear = parseInt(yearStr);
      catorcenaNum = parseInt(mesStr); // month number (1-12) for grouping
      periodoInicioVal = newCara.periodoInicioCustom;
      periodoFinVal = newCara.periodoFinCustom;
    } else {
      // Catorcena mode - supports range (inicio to fin)
      if (!newCara.periodo) return;
      const [yearStr, catStr] = newCara.periodo.split('-');
      catorcenaYear = parseInt(yearStr);
      catorcenaNum = parseInt(catStr);
      const periodInicio = availablePeriods.find(p => p.a_o === catorcenaYear && p.numero_catorcena === catorcenaNum);
      if (!periodInicio) return;
      periodoInicioVal = periodInicio.fecha_inicio;
      periodoFinVal = periodInicio.fecha_fin;
    }

    // Calculate descuento: if renta=100, bonif=10, then descuento is 10/(100+10) = 9.09%
    const totalCaras = newCara.renta + newCara.bonificacion;
    const descuento = totalCaras > 0 ? (newCara.bonificacion / totalCaras) : 0;
    const precioTotal = newCara.tarifaPublica * newCara.renta;
    // When BF pair: save tarifa efectiva (inversión ÷ total caras) instead of raw tarifa pública
    const hasBfPair = newCara.bonificacion > 0 && !!newCara.articuloBf;
    const tarifaToSave = (hasBfPair && totalCaras > 0)
      ? precioTotal / totalCaras
      : newCara.tarifaPublica;

    // Evaluar estado de autorización con el backend
    // En modo edición, si solo cambiaron NSE o ciudad, mantener autorización original
    let autorizacion_dg: CaraEntry['autorizacion_dg'] = undefined;
    let autorizacion_dcm: CaraEntry['autorizacion_dcm'] = undefined;
    const editingOriginal = editingCaraId ? caras.find(c => c.id === editingCaraId) : null;
    const skipAuthEval = isEditMode && editingOriginal && (
      newCara.renta === editingOriginal.renta
      && newCara.bonificacion === editingOriginal.bonificacion
      && newCara.tarifaPublica === editingOriginal.tarifaPublica
      && newCara.formato === editingOriginal.formato
      && newCara.tipo === editingOriginal.tipo
      && newCara.articulo?.ItemCode === editingOriginal.articulo?.ItemCode
    );

    // Circuitos Digitales: aprobado automático (pending tabulador real)
    const esCircuito = !!(newCara.articulo && parseCircuitoDigital(newCara.articulo.ItemCode));
    // Cortesías no requieren autorización — se aprueban automáticamente
    if (esCortesia || esCircuito) {
      autorizacion_dg = 'aprobado';
      autorizacion_dcm = 'aprobado';
    } else if (skipAuthEval && editingOriginal) {
      // Solo cambió NSE/ciudad: conservar el estado mostrado ACTUAL (local), no el de BD
      autorizacion_dg = editingOriginal.autorizacion_dg ?? editingOriginal._originalDg;
      autorizacion_dcm = editingOriginal.autorizacion_dcm ?? editingOriginal._originalDcm;
    } else {
      try {
        const ciudadesStr = newCara.ciudades.length > 0
          ? newCara.ciudades.join(', ')
          : filteredCiudades.join(', ');

        const resultado = await solicitudesService.evaluarAutorizacion({
          ciudad: ciudadesStr,
          estado: newCara.estado,
          formato: newCara.formato,
          tipo: newCara.tipo,
          caras: newCara.renta,
          bonificacion: newCara.bonificacion,
          costo: precioTotal,
          tarifa_publica: newCara.tarifaPublica,
          articulo: newCara.articulo?.ItemCode || null,
        });
        autorizacion_dg = resultado.autorizacion_dg;
        autorizacion_dcm = resultado.autorizacion_dcm;
      } catch (error: any) {
        console.error('[handleAddCara] Error evaluando autorización:', error?.response?.data || error?.message || error);
      }
    }

    // Build list of periods to create caras for (modo masivo: rango catorcena)
    const periodsToCreate: Array<{ catorcenaNum: number; catorcenaYear: number; periodoInicio: string; periodoFin: string }> = [];
    const isMasivoActivo = tipoPeriodo === 'catorcena' && modoMasivo && newCara.periodoFinCat && newCara.periodoFinCat !== newCara.periodo;

    if (isMasivoActivo) {
      // Range mode (catorcena, modo masivo): crear/actualizar una cara por catorcena
      const [yearFinStr, catFinStr] = newCara.periodoFinCat.split('-');
      const yearFin = parseInt(yearFinStr);
      const catFin = parseInt(catFinStr);
      const rangePeriods = availablePeriods.filter(p => {
        const key = p.a_o * 100 + p.numero_catorcena;
        return key >= catorcenaYear * 100 + catorcenaNum && key <= yearFin * 100 + catFin;
      }).sort((a, b) => (a.a_o * 100 + a.numero_catorcena) - (b.a_o * 100 + b.numero_catorcena));

      for (const p of rangePeriods) {
        periodsToCreate.push({ catorcenaNum: p.numero_catorcena, catorcenaYear: p.a_o, periodoInicio: p.fecha_inicio, periodoFin: p.fecha_fin });
      }
    } else {
      // Single period
      periodsToCreate.push({ catorcenaNum, catorcenaYear, periodoInicio: periodoInicioVal, periodoFin: periodoFinVal });
    }

    // Circuito Digital: unicidad por (CTO, plaza, catorcena/mes) — se permite repetir en periodos distintos
    const circuitoCheck = newCara.articulo ? parseCircuitoDigital(newCara.articulo.ItemCode) : null;
    if (circuitoCheck) {
      const conflictos = caras.filter(c => {
        if (editingCaraId && c.id === editingCaraId) return false;
        if (c.esBf) return false;
        if (!c.circuito) return false;
        if (c.circuito.cto !== circuitoCheck.cto || c.circuito.plazaCode !== circuitoCheck.plazaCode) return false;
        return periodsToCreate.some(p => p.catorcenaYear === c.catorcenaYear && p.catorcenaNum === c.catorcenaNum);
      });
      if (conflictos.length > 0) {
        const periodos = [...new Set(conflictos.map(c => `${c.catorcenaNum}/${c.catorcenaYear}`))].join(', ');
        alert(`Ya tienes el circuito ${circuitoCheck.ctoLabel} (${circuitoCheck.plazaLabel}) en ${tipoPeriodo === 'mensual' ? 'el(los) mes(es)' : 'la(s) catorcena(s)'} ${periodos}. Solo se puede incluir una vez por periodo.`);
        return;
      }
    }

    const tieneBfPair = newCara.bonificacion > 0 && newCara.articuloBf;
    const ciudadesToUse = newCara.ciudades.length > 0 ? newCara.ciudades : filteredCiudades;

    // grupo_masivo_id: identifica caras del mismo artículo+config a través de varias catorcenas
    // Si edita una cara que ya pertenece a un grupo masivo, preservar su grupo_masivo_id;
    // si crea/edita masivo (>1 periodo) sin grupo previo, generar uno nuevo
    const editingCaraExistente = editingCaraId ? caras.find(c => c.id === editingCaraId) : null;
    const grupoMasivoId = editingCaraExistente?.grupo_masivo_id
      ?? (periodsToCreate.length > 1 ? Math.floor(Date.now() / 1000) % 2000000000 : undefined);

    const newCaras: CaraEntry[] = [];
    for (const [idx, period] of periodsToCreate.entries()) {
      // Detectar si es circuito digital
      const circuitoInfo = newCara.articulo ? parseCircuitoDigital(newCara.articulo.ItemCode) : null;
      // Cada catorcena del rango necesita su PROPIO grupoRtBf para que el RT y BF de ese mes se emparejen
      const grupoRtBf = tieneBfPair ? (Date.now() + idx) % 2000000000 : undefined;

      // RT cara (renta) — se respeta tal cual lo puso el usuario
      // (para circuitos digitales: el form ajusta renta = total - bonif al cambiar bonif,
      //  asi que aqui no necesitamos volver a restar)
      const rentaRT = newCara.renta;
      newCaras.push({
        id: editingCaraId && idx === 0 ? editingCaraId : `${Date.now()}-${Math.random()}-rt-${idx}`,
        articulo: newCara.articulo!,
        estado: newCara.estado,
        ciudades: ciudadesToUse,
        plaza: newCara.plaza || newCara.estado,
        circuito: circuitoInfo || undefined,
        circuitoTotal: circuitoInfo ? (newCara.renta + newCara.bonificacion) : undefined,
        circuitoFlujo: circuitoInfo && circuitoFlujoContra ? circuitoFlujoContra.flujo : undefined,
        circuitoContraflujo: circuitoInfo && circuitoFlujoContra ? circuitoFlujoContra.contraflujo : undefined,
        formato: newCara.formato,
        tipo: newCara.tipo,
        nse: newCara.nse,
        catorcenaNum: period.catorcenaNum,
        catorcenaYear: period.catorcenaYear,
        periodoInicio: period.periodoInicio,
        periodoFin: period.periodoFin,
        renta: rentaRT,
        bonificacion: grupoRtBf ? 0 : newCara.bonificacion, // If BF separate, RT has 0 bonif
        tarifaPublica: newCara.tarifaPublica,
        tarifaEfectiva: tarifaToSave,
        descuento: descuento * 100,
        precioTotal,
        autorizacion_dg,
        autorizacion_dcm,
        // _original* refleja SOLO el estado guardado en BD (no la evaluación local).
        // Cara existente editada: conserva su valor de BD. Cara nueva: undefined.
        // Esto evita que una edición sin guardar bloquee la edición de los demás circuitos.
        _originalDg: editingCaraId ? editingOriginal?._originalDg : undefined,
        _originalDcm: editingCaraId ? editingOriginal?._originalDcm : undefined,
        grupo_rt_bf: grupoRtBf,
        grupo_masivo_id: grupoMasivoId,
      });

      // BF cara (bonificación) - only if articuloBf is selected
      if (grupoRtBf && newCara.articuloBf) {
        newCaras.push({
          id: `${Date.now()}-${Math.random()}-bf-${idx}`,
          articulo: newCara.articuloBf,
          estado: newCara.estado,
          ciudades: ciudadesToUse,
          plaza: newCara.plaza || newCara.estado,
          formato: newCara.formato,
          tipo: newCara.tipo,
          nse: newCara.nse,
          catorcenaNum: period.catorcenaNum,
          catorcenaYear: period.catorcenaYear,
          periodoInicio: period.periodoInicio,
          periodoFin: period.periodoFin,
          renta: newCara.bonificacion, // BF caras go in renta field
          bonificacion: 0,
          tarifaPublica: 0, // BF is free
          tarifaEfectiva: 0,
          descuento: 0,
          precioTotal: 0,
          autorizacion_dg, // BF inherits RT auth state
          autorizacion_dcm,
          // _original* = estado de BD (BF hereda el del RT existente; nueva = undefined)
          _originalDg: editingCaraId ? editingOriginal?._originalDg : undefined,
          _originalDcm: editingCaraId ? editingOriginal?._originalDcm : undefined,
          grupo_rt_bf: grupoRtBf,
          grupo_masivo_id: grupoMasivoId,
          esBf: true,
        });
      }
    }

    // Add or update caras, then recalculate DG contamination from originals
    setCaras(prev => {
      let updated: CaraEntry[];
      if (editingCaraId && isMasivoActivo) {
        // Edición MASIVA: reemplazar todas las caras del mismo articulo dentro del rango Cat ini-fin
        const editingCara = prev.find(c => c.id === editingCaraId);
        if (!editingCara) return prev;
        const articuloCode = editingCara.articulo.ItemCode;
        const articuloBfCode = editingCara.grupo_rt_bf
          ? prev.find(c => c.grupo_rt_bf === editingCara.grupo_rt_bf && c.esBf)?.articulo.ItemCode
          : null;
        // Catorcenas del rango (year*100 + cat)
        const rangoKeys = new Set(periodsToCreate.map(p => p.catorcenaYear * 100 + p.catorcenaNum));
        // Quitar las viejas que matchean (RT y BF del mismo articulo en el rango)
        updated = prev.filter(c => {
          const key = c.catorcenaYear * 100 + c.catorcenaNum;
          if (!rangoKeys.has(key)) return true;
          const codeMatch = c.articulo.ItemCode === articuloCode || (articuloBfCode && c.articulo.ItemCode === articuloBfCode);
          return !codeMatch;
        });
        // Agregar las nuevas (RT + BF si aplica)
        updated.push(...newCaras);
      } else if (editingCaraId) {
        const editingCara = prev.find(c => c.id === editingCaraId);
        // Replace RT cara
        updated = prev.map(c => c.id === editingCaraId ? newCaras[0] : c);
        // If editing a RT/BF pair, remove old BF and add new BF (if any)
        if (editingCara?.grupo_rt_bf) {
          updated = updated.filter(c => !(c.esBf && c.grupo_rt_bf === editingCara.grupo_rt_bf && c.catorcenaNum === editingCara.catorcenaNum && c.catorcenaYear === editingCara.catorcenaYear));
        }
        // Add new BF caras (from newCaras[1+])
        const bfCaras = newCaras.filter(c => c.esBf);
        if (bfCaras.length > 0) updated.push(...bfCaras);
      } else {
        updated = [...prev, ...newCaras];
      }
      // Mostrar el estado REAL/local de cada circuito en su badge (autorizacion_*),
      // SIN tocar _original* (que refleja solo lo guardado en BD y gobierna el bloqueo).
      // Así, editar un circuito a "pendiente" no congela la edición de los demás
      // hasta que se guarde. La contaminación DG se aplica al guardar (backend).
      return updated;
    });
    const wasEditing = !!editingCaraId;
    if (editingCaraId) setEditingCaraId(null);

    if (wasEditing) {
      setTimeout(() => circuitTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    // Auto expand all catorcenas created
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      for (const c of newCaras) next.add(`${c.catorcenaYear}-${c.catorcenaNum}`);
      return next;
    });

    // Keep filter values intact, only reset quantities and period
    setNewCara({
      ...newCara,
      periodo: '',
      periodoFinCat: '',
      periodoInicioCustom: '',
      periodoFinCustom: '',
      renta: 0,
      bonificacion: 0,
      articuloBf: null,
      // Keep articulo, estado, ciudades, formato, tipo, nse, tarifaPublica
    });
  };

  // Clear all new cara fields
  const handleClearNewCara = () => {
    setNewCara({
      articulo: null,
      plaza: '',
      estado: '',
      ciudades: [],
      formato: '',
      tipo: '',
      nse: [],
      periodo: '',
      periodoFinCat: '',
      periodoInicioCustom: '',
      periodoFinCustom: '',
      renta: 0,
      bonificacion: 0,
      tarifaPublica: 0,
      articuloBf: null,
    });
  };

  // Remove cara
  const handleRemoveCara = (id: string) => {
    const cara = caras.find(c => c.id === id);
    if (!cara) return;

    // Si modoMasivo está ON y la cara pertenece a un grupo masivo, eliminar TODO el grupo
    // (incluye sus pares RT/BF)
    if (modoMasivo && cara.grupo_masivo_id) {
      const grupoSize = caras.filter(c => c.grupo_masivo_id === cara.grupo_masivo_id && !c.esBf).length;
      if (grupoSize > 1) {
        const ok = window.confirm(
          `Modo masivo ON: esta cara pertenece a un grupo de ${grupoSize} catorcenas.\n\n` +
          `Aceptar = eliminar TODO el grupo masivo (RT + BF de ${grupoSize} catorcenas)\n` +
          `Cancelar = no eliminar nada`
        );
        if (!ok) return;
        setCaras(caras.filter(c => c.grupo_masivo_id !== cara.grupo_masivo_id));
        if (editingCaraId === id) setEditingCaraId(null);
        return;
      }
    }

    // If RT/BF pair, remove both
    if (cara.grupo_rt_bf) {
      setCaras(caras.filter(c => !(c.grupo_rt_bf === cara.grupo_rt_bf && c.catorcenaNum === cara.catorcenaNum && c.catorcenaYear === cara.catorcenaYear)));
    } else {
      setCaras(caras.filter(c => c.id !== id));
    }
    if (editingCaraId === id) {
      setEditingCaraId(null);
    }
  };

  // ── Selección masiva de circuitos ──────────────────────────────────────────
  // Permite seleccionar 1, varios circuitos o una catorcena completa y eliminarlos
  // en lote (misma acción que el bote de basura individual: arrastra pares RT/BF).
  const toggleCaraSelection = (id: string) => {
    setSelectedCaraIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecciona / deselecciona todos los circuitos de una catorcena (items del grupo)
  const toggleCatorcenaSelection = (items: CaraEntry[]) => {
    const ids = items.map(c => c.id);
    setSelectedCaraIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every(id => next.has(id));
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  // Elimina en lote todas las caras seleccionadas. Reutiliza la lógica del borrado
  // individual: si una cara tiene par RT/BF, se elimina también su pareja.
  // Abre el modal de confirmación estilizado antes de borrar.
  const handleBulkRemove = () => {
    if (selectedCaraIds.size === 0) return;

    const toRemove = new Set<string>();
    selectedCaraIds.forEach(id => {
      const cara = caras.find(c => c.id === id);
      if (!cara) return;
      if (cara.grupo_rt_bf) {
        caras
          .filter(c => c.grupo_rt_bf === cara.grupo_rt_bf && c.catorcenaNum === cara.catorcenaNum && c.catorcenaYear === cara.catorcenaYear)
          .forEach(c => toRemove.add(c.id));
      } else {
        toRemove.add(id);
      }
    });

    const cuenta = caras.filter(c => selectedCaraIds.has(c.id) && !c.esBf).length || selectedCaraIds.size;
    const tienePareja = toRemove.size > selectedCaraIds.size;

    setBulkDeleteModal({
      isOpen: true,
      count: cuenta,
      tienePareja,
      onConfirm: () => {
        setCaras(prev => prev.filter(c => !toRemove.has(c.id)));
        if (editingCaraId && toRemove.has(editingCaraId)) setEditingCaraId(null);
        setSelectedCaraIds(new Set());
        setBulkDeleteModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Reenviar a autorización un circuito rechazado: re-evalúa criterios con los
  // datos actuales (sin editar) y lo deja en pendiente/aprobado. Al guardar, el
  // backend lo persiste y vuelve a crear la tarea de autorización si quedó pendiente.
  const handleReenviarAutorizacion = async (id: string) => {
    const cara = caras.find(c => c.id === id);
    if (!cara) return;
    try {
      const resultado = await solicitudesService.evaluarAutorizacion({
        ciudad: cara.ciudades.join(', '),
        estado: cara.estado,
        formato: cara.formato,
        tipo: cara.tipo,
        caras: cara.renta,
        bonificacion: cara.bonificacion,
        costo: cara.precioTotal,
        tarifa_publica: cara.tarifaPublica,
        articulo: cara.articulo?.ItemCode || null,
      });
      // Solo se actualiza autorizacion_* (badge/local). _original* se mantiene
      // (estado de BD) para no interferir con el bloqueo de edición.
      setCaras(prev => prev.map(c => c.id === id
        ? { ...c, autorizacion_dg: resultado.autorizacion_dg, autorizacion_dcm: resultado.autorizacion_dcm }
        : c));
      const irAuth = resultado.autorizacion_dg === 'pendiente' || resultado.autorizacion_dcm === 'pendiente';
      showToast(irAuth ? 'Circuito reenviado a autorización' : 'Circuito reprocesado: ya no requiere autorización', 'success');
    } catch {
      showToast('No se pudo reenviar a autorización', 'error');
    }
  };

  // Edit cara - loads cara data into form. If RT/BF pair, load both.
  const handleEditCara = (cara: CaraEntry) => {
    // If this is a BF row, find and edit the RT row instead
    if (cara.esBf && cara.grupo_rt_bf) {
      const rtCara = caras.find(c => c.grupo_rt_bf === cara.grupo_rt_bf && !c.esBf && c.catorcenaNum === cara.catorcenaNum && c.catorcenaYear === cara.catorcenaYear);
      if (rtCara) { handleEditCara(rtCara); return; }
    }

    // Find BF pair if exists
    const bfPair = cara.grupo_rt_bf ? caras.find(c => c.grupo_rt_bf === cara.grupo_rt_bf && c.esBf && c.catorcenaNum === cara.catorcenaNum && c.catorcenaYear === cara.catorcenaYear) : null;

    setEditingCaraId(cara.id);

    // Si la cara pertenece a un grupo masivo y modoMasivo está ON, popular el rango completo
    // del grupo para que al guardar la edición se propague a todas las caras del grupo
    let periodoIni = `${cara.catorcenaYear}-${cara.catorcenaNum}`;
    let periodoFin = '';
    if (cara.grupo_masivo_id && modoMasivo) {
      const grupoCaras = caras.filter(c => c.grupo_masivo_id === cara.grupo_masivo_id && !c.esBf);
      if (grupoCaras.length > 1) {
        const sorted = [...grupoCaras].sort((a, b) =>
          (a.catorcenaYear * 100 + a.catorcenaNum) - (b.catorcenaYear * 100 + b.catorcenaNum)
        );
        periodoIni = `${sorted[0].catorcenaYear}-${sorted[0].catorcenaNum}`;
        const last = sorted[sorted.length - 1];
        periodoFin = `${last.catorcenaYear}-${last.catorcenaNum}`;
      }
    }

    setNewCara({
      articulo: cara.articulo,
      plaza: cara.plaza || cara.estado,
      estado: cara.estado,
      ciudades: cara.ciudades,
      formato: cara.formato,
      tipo: cara.tipo as 'Tradicional' | 'Digital' | '',
      nse: cara.nse,
      periodo: periodoIni,
      periodoFinCat: periodoFin,
      // <input type="date"> espera 'YYYY-MM-DD'; truncamos por si viene como ISO completo
      periodoInicioCustom: tipoPeriodo === 'mensual' ? String(cara.periodoInicio || '').slice(0, 10) : '',
      periodoFinCustom: tipoPeriodo === 'mensual' ? String(cara.periodoFin || '').slice(0, 10) : '',
      renta: cara.renta,
      bonificacion: bfPair ? bfPair.renta : cara.bonificacion,
      tarifaPublica: cara.tarifaPublica,
      articuloBf: bfPair ? bfPair.articulo : null,
    });
    setTimeout(() => circuitFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCaraId(null);
    setTimeout(() => circuitTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    setNewCara({
      articulo: null,
      plaza: '',
      estado: '',
      ciudades: [],
      formato: '',
      tipo: '',
      nse: [],
      periodo: '',
      periodoFinCat: '',
      periodoInicioCustom: '',
      periodoFinCustom: '',
      renta: 0,
      bonificacion: 0,
      tarifaPublica: 0,
      articuloBf: null,
    });
  };

  // Helper to format date for display — parsea YYYY-MM-DD directo del string
  // para evitar timezone shift en MX (UTC-6)
  const formatDateShort = (dateStr: string) => {
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const month = parseInt(m[2]) - 1;
      if (month >= 0 && month < 12) return `${parseInt(m[3])} ${meses[month]} ${m[1]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Group caras by period (catorcena number or month number)
  const groupedCaras = useMemo(() => {
    const groups: Record<string, CaraEntry[]> = {};
    caras.forEach(cara => {
      const key = `${cara.catorcenaYear}-${cara.catorcenaNum}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(cara);
    });
    return Object.entries(groups).sort((a, b) => {
      const [yearA, catA] = a[0].split('-').map(Number);
      const [yearB, catB] = b[0].split('-').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return catA - catB;
    });
  }, [caras]);

  // Helper to get period label from group key
  const getPeriodLabel = (key: string) => {
    const [year, num] = key.split('-');
    if (tipoPeriodo === 'mensual') {
      const m = parseInt(num);
      return `${MESES[m - 1] || `Mes ${num}`} ${year}`;
    }
    return `Cat ${num} / ${year}`;
  };

  // Autorización bloqueada: en edición, si hay circuitos guardados pendientes no se
  // puede editar/eliminar (ni en lote). Mismo criterio que el botón individual.
  const authBlocked = useMemo(
    () => isEditMode && caras.some(c => c._originalDg === 'pendiente' || c._originalDcm === 'pendiente'),
    [isEditMode, caras]
  );

  // Toggle catorcena expansion
  const toggleCatorcena = (key: string) => {
    setExpandedCatorcenas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalRenta = caras.reduce((acc, c) => acc + (c.esBf ? 0 : c.renta), 0);
    const totalBonificacion = caras.reduce((acc, c) => acc + (c.esBf ? c.renta : c.bonificacion), 0);
    const totalPrecio = caras.reduce((acc, c) => acc + c.precioTotal, 0);
    const totalCarasAll = totalRenta + totalBonificacion;
    // Tarifa Efectiva = Inversión Total / Total Caras (renta + bonificación)
    const tarifaEfectiva = totalCarasAll > 0 ? totalPrecio / totalCarasAll : 0;
    // Regla: si el total global es impar, todas requieren autorización DG
    const totalCarasImpar = totalCarasAll > 0 && totalCarasAll % 2 !== 0;
    // Si TODAS las caras son puente peatonal, los labels dicen "Puentes" en vez de "Caras"
    const allPuentePeatonal = caras.length > 0 && caras.every(c => (c.formato || '').toUpperCase().includes('PUENTE PEATONAL'));
    return { totalRenta, totalBonificacion, totalCaras: totalRenta, totalPrecio, tarifaEfectiva, totalCarasImpar, allPuentePeatonal };
  }, [caras]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArchivoFile(file);
      setArchivo(file.name);
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => solicitudesService.create(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });

      // Check for pending authorizations and show appropriate toast
      if (response?.autorizacion?.tienePendientes) {
        const total = (response.autorizacion.pendientesDg || 0) + (response.autorizacion.pendientesDcm || 0);
        showToast(`Solicitud creada. ${total} cara(s) requieren autorización de DG/DCM.`, 'warning');
      } else {
        showToast('Solicitud creada exitosamente', 'success');
      }

      onClose();
      resetForm();
    },
    onSettled: () => { isSubmittingRef.current = false; },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => solicitudesService.update(editSolicitudId!, data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-edit', editSolicitudId] });

      // Check for pending authorizations and show appropriate toast
      if (response?.autorizacion?.tienePendientes) {
        const total = (response.autorizacion.pendientesDg || 0) + (response.autorizacion.pendientesDcm || 0);
        showToast(`Solicitud actualizada. ${total} cara(s) requieren autorización de DG/DCM.`, 'warning');
      } else {
        showToast('Solicitud actualizada exitosamente', 'success');
      }

      onClose();
      resetForm();
    },
    onSettled: () => { isSubmittingRef.current = false; },
  });

  // Reset form
  const resetForm = () => {
    isSubmittingRef.current = false;
    clearDraft();
    draftRestoredRef.current = false;
    setRestoredFromDraft(false);
    setStep(1);
    setSelectedCuic(null);
    setSelectedAsignados([]);
    setNombreCampania('');
    setDescripcion('');
    setNotas('');
    setTipoPeriodo('catorcena');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setMesInicio(undefined);
    setMesFin(undefined);
    setCaras([]);
    if (archivo && archivo.startsWith('blob:')) {
      URL.revokeObjectURL(archivo);
    }
    setArchivo(null);
    setArchivoFile(null);
    setTipoArchivo(null);
    setImu(false);
    setExpandedCatorcenas(new Set());
    setSelectedCaraIds(new Set());
  };

  // Handle submit
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    if (!selectedCuic || caras.length === 0 || !fechaInicio || !fechaFin || selectedAsignados.length === 0) {
      return;
    }
    isSubmittingRef.current = true;
    if (invalidCaras.length > 0) {
      showToast('Hay circuitos con catorcenas fuera del rango de campaña. Corrígelos antes de guardar.', 'error');
      return;
    }

    // No permitir guardar si quedan circuitos rechazados sin resolver. El usuario
    // debe editarlos o usar "Reenviar a autorización" en TODOS antes de guardar.
    const rechazadasSinResolver = caras.filter(c => c.autorizacion_dg === 'rechazado' || c.autorizacion_dcm === 'rechazado');
    if (rechazadasSinResolver.length > 0) {
      showToast(`Tienes ${rechazadasSinResolver.length} circuito(s) rechazado(s) sin resolver. Edítalos o usa "Reenviar a autorización" antes de guardar.`, 'error');
      isSubmittingRef.current = false;
      return;
    }

    // Si hay archivo nuevo (File), subirlo primero a Spaces
    let archivoUrl = archivo;
    if (archivoFile) {
      try {
        const uploaded = await uploadsService.uploadFile(archivoFile, 'solicitudes');
        archivoUrl = uploaded.url;
      } catch (err) {
        showToast('Error al subir el archivo', 'error');
        isSubmittingRef.current = false;
        return;
      }
    }

    // Resolver cliente.id real desde el CUIC + sap_database. El SAPCuicItem
    // solo trae CUIC (que puede duplicarse entre filas de cliente), por eso
    // hacemos lookup local para mandar el cliente.id correcto al back.
    let resolvedClienteId: number;
    try {
      const resolved = await clientesService.resolveByCuic(selectedCuic.CUIC, (selectedCuic as any).sap_database || null);
      resolvedClienteId = resolved.id;
    } catch (err) {
      showToast(`No se pudo resolver cliente para CUIC ${selectedCuic.CUIC}. Verifica que exista en la tabla de clientes local.`, 'error');
      isSubmittingRef.current = false;
      return;
    }

    const data = {
      cliente_id: resolvedClienteId,
      cuic: selectedCuic.CUIC,
      razon_social: selectedCuic.T0_U_RazonSocial,
      unidad_negocio: selectedCuic.T1_U_UnidadNegocio,
      marca_id: selectedCuic.T1_U_IDMarca,
      marca_nombre: selectedCuic.T2_U_Marca,
      asesor: selectedCuic.ASESOR_U_Asesor,
      producto_id: selectedCuic.T2_U_IDProducto,
      producto_nombre: selectedCuic.T2_U_Producto,
      agencia: selectedCuic.T0_U_Agencia,
      categoria_id: selectedCuic.T2_U_IDCategoria,
      categoria_nombre: selectedCuic.T2_U_Categoria,
      card_code: selectedCuic.ACA_U_SAPCode,
      salesperson_code: selectedCuic.ASESOR_U_SAPCode_Original,
      sap_database: (selectedCuic as any).sap_database || null,
      nombre_campania: nombreCampania,
      descripcion,
      notas,
      articulo: caras[0]?.articulo.ItemCode || '',
      asignados: selectedAsignados.map(u => ({ id: u.id, nombre: u.nombre })),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_periodo: tipoPeriodo,
      archivo: archivoUrl || undefined,
      tipo_archivo: tipoArchivo || undefined,
      IMU: imu,
      caras: caras.map(c => {
        // Si el artículo principal es BF- o CF-, tratarlo como bonificación pura
        // (no como renta) aunque no sea par RT/BF formal.
        const articuloUp = (c.articulo?.ItemCode || '').toUpperCase();
        const isBonifArt = articuloUp.startsWith('BF') || articuloUp.startsWith('CF');
        const treatAsBf = c.esBf || isBonifArt;
        return ({
        ciudad: c.ciudades.join(', '),
        // Mandamos la plaza (ej. "GUADALAJARA") como `estado` porque el backend
        // guarda este campo en `solicitudCaras.estados` y la UI de propuestas
        // espera plazas (no estados). El campo `c.estado` ("Jalisco") solo se usa
        // internamente en el form de solicitud para filtrar ciudades.
        estado: c.plaza || c.estado,
        tipo: c.tipo,
        flujo: 'Ambos',
        bonificacion: treatAsBf ? c.renta : c.bonificacion,
        caras: treatAsBf ? 0 : c.renta,
        nivel_socioeconomico: c.nse.join(','),
        formato: c.formato,
        costo: c.precioTotal,
        tarifa_publica: c.tarifaPublica,
        inicio_periodo: c.periodoInicio,
        fin_periodo: c.periodoFin,
        // Para circuito: si la renta es < total del circuito, distribuir flujo/contraflujo
        // proporcionalmente respetando los topes del circuito
        caras_flujo: treatAsBf ? 0 : (() => {
          // Mensual = todo a Flujo (Gran Formato)
          if (tipoPeriodo === 'mensual') return c.renta;
          if (c.circuitoFlujo != null && c.circuitoContraflujo != null) {
            const totalCirc = c.circuitoFlujo + c.circuitoContraflujo;
            if (totalCirc > 0 && c.renta < totalCirc) {
              let flujoCalc = Math.round(c.renta * c.circuitoFlujo / totalCirc);
              flujoCalc = Math.min(flujoCalc, c.circuitoFlujo);
              let contraCalc = Math.min(c.renta - flujoCalc, c.circuitoContraflujo);
              return c.renta - contraCalc;
            }
            return c.circuitoFlujo;
          }
          return Math.ceil(c.renta / 2);
        })(),
        caras_contraflujo: treatAsBf ? 0 : (() => {
          // Mensual = sin Contraflujo
          if (tipoPeriodo === 'mensual') return 0;
          if (c.circuitoFlujo != null && c.circuitoContraflujo != null) {
            const totalCirc = c.circuitoFlujo + c.circuitoContraflujo;
            if (totalCirc > 0 && c.renta < totalCirc) {
              let flujoCalc = Math.round(c.renta * c.circuitoFlujo / totalCirc);
              flujoCalc = Math.min(flujoCalc, c.circuitoFlujo);
              return Math.min(c.renta - flujoCalc, c.circuitoContraflujo);
            }
            return c.circuitoContraflujo;
          }
          return Math.floor(c.renta / 2);
        })(),
        descuento: c.descuento,
        articulo: c.articulo.ItemCode,
        autorizacion_dg: c.autorizacion_dg,
        autorizacion_dcm: c.autorizacion_dcm,
        grupo_rt_bf: c.grupo_rt_bf || null,
        grupo_masivo_id: c.grupo_masivo_id || null,
        });
      }),
    };

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (isEditMode && editSolicitudData && cuicDataRaw && articulosData && catorcenasData?.data && !editFormPopulatedRef.current) {
      editFormPopulatedRef.current = true;
      const sol = editSolicitudData.solicitud;

      // Find the CUIC item from local DB data.
      // cliente.id es la única clave verdaderamente única: CUIC y card_code pueden
      // repetirse cuando un mismo cliente legal (razon social) tiene varias marcas
      // (ej. FRABEL/LOREAL CUIC 5171 y FRABEL/MAYBELLINE CUIC 5177 comparten card_code).
      // Por eso priorizamos cliente_id antes que cualquier otro identificador.
      const solClienteId = sol.cliente_id || null;
      const solCuic = sol.cuic ? parseInt(sol.cuic, 10) : null;
      const solSapDb = sol.sap_database || null;
      const solCardCode = sol.card_code || null;
      const solRazonSocial = sol.razon_social || null;
      const cuicItem =
        // Best match: cliente_id (único por cliente en BD)
        (solClienteId ? cuicDataRaw.find(c => c.id === solClienteId) : null)
        // Fallback: card_code + sap_database
        || (solCardCode && solSapDb ? cuicDataRaw.find(c => c.ACA_U_SAPCode === solCardCode && c.sap_database === solSapDb) : null)
        // Fallback: card_code only
        || (solCardCode ? cuicDataRaw.find(c => c.ACA_U_SAPCode === solCardCode) : null)
        // Fallback: CUIC + razon_social
        || (solRazonSocial ? cuicDataRaw.find(c => c.CUIC === solCuic && c.T0_U_RazonSocial === solRazonSocial) : null)
        // Last resort: CUIC only
        || cuicDataRaw.find(c => c.CUIC === solCuic);
      if (cuicItem) {
        setSelectedCuic(cuicItem);
        if (cuicItem.sap_database) {
          setSapDbFilter(cuicItem.sap_database as SapDatabase);
        }
      }

      // Set campaign data - nombre_campania might come from cotizacion
      const nombreCampania = editSolicitudData.cotizacion?.nombre_campania || editSolicitudData.campania?.nombre || '';
      setNombreCampania(nombreCampania);
      setDescripcion(sol.descripcion || '');
      setNotas(sol.notas || '');
      setImu(Boolean(sol.IMU));

      // Set asignados - parse from id_asignado and asignado strings
      if (sol.id_asignado && sol.asignado) {
        const ids = sol.id_asignado.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
        const nombres = sol.asignado.split(',').map(n => n.trim());
        const asignadosData = ids.map((id, idx) => ({
          id,
          nombre: nombres[idx] || '',
          area: '',
          puesto: ''
        }));
        setSelectedAsignados(asignadosData);
      } else {
        // No asignados in this solicitud - clear the state
        setSelectedAsignados([]);
      }

      // Load archivo from solicitud
      if (sol.archivo) {
        setArchivo(sol.archivo);
        setArchivoFile(null);
        setTipoArchivo(sol.tipo_archivo || null);
      }

      // Load period type and dates from cotizacion
      const cotizacion = editSolicitudData.cotizacion;
      const loadedTipoPeriodo = (cotizacion as any)?.tipo_periodo || 'catorcena';
      setTipoPeriodo(loadedTipoPeriodo);

      if (cotizacion?.fecha_inicio && cotizacion?.fecha_fin) {
        if (loadedTipoPeriodo === 'mensual') {
          // Parse YYYY-MM directo del string para evitar timezone shift en MX (UTC-6)
          // que convierte '2026-03-01T00:00:00.000Z' en '2026-02-28' local → mes Feb (mal)
          const parseYM = (val: any): { year: number; month: number } | null => {
            const m = String(val).match(/^(\d{4})-(\d{2})/);
            if (!m) return null;
            return { year: parseInt(m[1]), month: parseInt(m[2]) };
          };
          const ymIni = parseYM(cotizacion.fecha_inicio);
          const ymFin = parseYM(cotizacion.fecha_fin);
          if (ymIni) {
            setYearInicio(ymIni.year);
            setMesInicio(ymIni.month);
          }
          if (ymFin) {
            setYearFin(ymFin.year);
            setMesFin(ymFin.month);
          }
        } else {
          const fechaInicioDate = new Date(cotizacion.fecha_inicio);
          const fechaFinDate = new Date(cotizacion.fecha_fin);

          const inicioCat = catorcenasData.data.find(c => {
            const cInicio = new Date(c.fecha_inicio);
            const cFin = new Date(c.fecha_fin);
            return fechaInicioDate >= cInicio && fechaInicioDate <= cFin;
          });

          const finCat = catorcenasData.data.find(c => {
            const cInicio = new Date(c.fecha_inicio);
            const cFin = new Date(c.fecha_fin);
            return fechaFinDate >= cInicio && fechaFinDate <= cFin;
          });

          if (inicioCat) {
            setYearInicio(inicioCat.a_o);
            setCatorcenaInicio(inicioCat.numero_catorcena);
          }
          if (finCat) {
            setYearFin(finCat.a_o);
            setCatorcenaFin(finCat.numero_catorcena);
          }
        }
      }

      // Set caras from the fetched data
      if (editSolicitudData.caras && editSolicitudData.caras.length > 0) {
        const loadedCaras: CaraEntry[] = editSolicitudData.caras.map((cara, idx) => {
          const articulo = articulosData.find(a => a.ItemCode === cara.articulo) || {
            ItemCode: cara.articulo || '',
            ItemName: cara.articulo || ''
          };

          // Find matching catorcena/month from dates
          let catNum = 1;
          let catYear = new Date().getFullYear();
          if (cara.inicio_periodo) {
            const initDate = new Date(cara.inicio_periodo);
            if (!isNaN(initDate.getTime())) {
              if (loadedTipoPeriodo === 'mensual') {
                // Mensual mode: month number for grouping
                catYear = initDate.getFullYear();
                catNum = initDate.getMonth() + 1; // 1-12
              } else {
                // Catorcena mode: find matching catorcena
                const initDateStr = initDate.toISOString().split('T')[0];
                const matchingCat = catorcenasData.data.find(cat => {
                  const catStartStr = new Date(cat.fecha_inicio).toISOString().split('T')[0];
                  return catStartStr === initDateStr;
                });

                if (matchingCat) {
                  catNum = matchingCat.numero_catorcena;
                  catYear = matchingCat.a_o;
                } else {
                  const matchingRange = catorcenasData.data.find(cat => {
                    const catStart = new Date(cat.fecha_inicio);
                    const catEnd = new Date(cat.fecha_fin);
                    return initDate >= catStart && initDate <= catEnd;
                  });
                  if (matchingRange) {
                    catNum = matchingRange.numero_catorcena;
                    catYear = matchingRange.a_o;
                  } else {
                    catYear = initDate.getFullYear();
                  }
                }
              }
            }
          }

          // Detectar si la cara cargada es un circuito digital
          const circuitoLoaded = parseCircuitoDigital(cara.articulo || '');

          return {
            id: `edit-${idx}-${Date.now()}-${Math.random()}`,
            articulo,
            estado: cara.estados || '',
            ciudades: cara.ciudad ? cara.ciudad.split(', ').map(c => c.trim()) : [],
            plaza: circuitoLoaded ? circuitoLoaded.plazaLabel : getPlazaFromArticle(cara.articulo || '', cara.estados || cara.ciudad || ''),
            circuito: circuitoLoaded || undefined,
            circuitoTotal: circuitoLoaded ? (Number(cara.caras) || 0) + (Number(cara.bonificacion) || 0) : undefined,
            circuitoFlujo: circuitoLoaded ? Number((cara as any).caras_flujo) || 0 : undefined,
            circuitoContraflujo: circuitoLoaded ? Number((cara as any).caras_contraflujo) || 0 : undefined,
            formato: cara.formato || '',
            tipo: cara.tipo || '',
            nse: cara.nivel_socioeconomico ? cara.nivel_socioeconomico.split(',') : [],
            catorcenaNum: catNum,
            catorcenaYear: catYear,
            // Truncar a YYYY-MM-DD para que <input type="date"> lo reconozca al editar
            periodoInicio: String(cara.inicio_periodo || '').slice(0, 10),
            periodoFin: String(cara.fin_periodo || '').slice(0, 10),
            // Convención frontend: BF guarda cantidad en renta. Backend persiste BF con
            // caras=0 y bonificacion=cantidad, así que invertimos al cargar.
            renta: ((cara.articulo || '').toUpperCase().startsWith('BF') || (cara.articulo || '').toUpperCase().startsWith('CF'))
              ? (Number(cara.bonificacion) || 0)
              : (Number(cara.caras) || 0),
            bonificacion: ((cara.articulo || '').toUpperCase().startsWith('BF') || (cara.articulo || '').toUpperCase().startsWith('CF'))
              ? 0
              : (Number(cara.bonificacion) || 0),
            tarifaPublica: (cara.caras || 0) > 0 ? (Number(cara.costo) || 0) / (cara.caras || 1) : Number(cara.tarifa_publica) || 0,
            tarifaEfectiva: Number(cara.tarifa_publica) || 0, // recalculated below with grupo_rt_bf
            descuento: Number(cara.descuento) || 0,
            precioTotal: Number(cara.costo) || 0,
            grupo_rt_bf: cara.grupo_rt_bf || undefined,
            grupo_masivo_id: (cara as any).grupo_masivo_id || undefined,
            esBf: (cara.articulo || '').toUpperCase().startsWith('BF') || (cara.articulo || '').toUpperCase().startsWith('CF'),
            autorizacion_dg: cara.autorizacion_dg as CaraEntry['autorizacion_dg'],
            autorizacion_dcm: cara.autorizacion_dcm as CaraEntry['autorizacion_dcm'],
            _originalDg: cara.autorizacion_dg as CaraEntry['autorizacion_dg'],
            _originalDcm: cara.autorizacion_dcm as CaraEntry['autorizacion_dcm'],
          };
        });
        // Recalculate tarifaEfectiva using grupo_rt_bf total caras
        const grupoTotalMap = new Map<number, number>();
        for (const c of loadedCaras) {
          if (c.grupo_rt_bf) {
            grupoTotalMap.set(c.grupo_rt_bf, (grupoTotalMap.get(c.grupo_rt_bf) || 0) + c.renta + c.bonificacion);
          }
        }
        for (const c of loadedCaras) {
          if (c.grupo_rt_bf && !c.esBf) {
            const totalGrupo = grupoTotalMap.get(c.grupo_rt_bf) || (c.renta + c.bonificacion);
            c.tarifaEfectiva = totalGrupo > 0 ? c.precioTotal / totalGrupo : 0;
          }
        }

        setCaras(loadedCaras);

        // Auto-expand all catorcenas in edit mode so user can see them
        if (loadedCaras.length > 0) {
          const catKeys = new Set(loadedCaras.map(c => `${c.catorcenaYear}-${c.catorcenaNum}`));
          setExpandedCatorcenas(catKeys);
        }
      }
    }
  }, [isEditMode, editSolicitudData, cuicDataRaw, articulosData, catorcenasData]);

  // Huella de los campos relevantes del formulario, para detectar cambios sin guardar.
  const formSnapshot = useMemo(() => JSON.stringify({
    cuic: selectedCuic?.id ?? null,
    asignados: selectedAsignados.map(a => a.id).slice().sort(),
    nombreCampania, descripcion, notas,
    tipoPeriodo, yearInicio, yearFin, catorcenaInicio, catorcenaFin, mesInicio, mesFin,
    imu, archivo,
    caras: caras.map(c => ({
      a: c.articulo?.ItemCode, e: c.estado, ci: c.ciudades, f: c.formato, t: c.tipo,
      n: c.nse, r: c.renta, b: c.bonificacion, d: c.descuento,
      pi: c.periodoInicio, pf: c.periodoFin, cn: c.catorcenaNum, cy: c.catorcenaYear,
    })),
  }), [selectedCuic, selectedAsignados, nombreCampania, descripcion, notas, tipoPeriodo,
       yearInicio, yearFin, catorcenaInicio, catorcenaFin, mesInicio, mesFin, imu, archivo, caras]);

  // Captura el snapshot inicial una vez que el formulario de edición terminó de poblarse.
  useEffect(() => {
    if (!isOpen || !isEditMode) return;
    if (editFormPopulatedRef.current && initialSnapshotRef.current === null) {
      initialSnapshotRef.current = formSnapshot;
    }
  }, [isOpen, isEditMode, formSnapshot]);

  // ¿Hay cambios sin guardar?
  const isFormDirty = (): boolean => {
    if (isEditMode) {
      if (!editFormPopulatedRef.current || initialSnapshotRef.current === null) return false;
      return formSnapshot !== initialSnapshotRef.current;
    }
    // Modo crear: hay trabajo si se ingresó cualquier dato significativo
    const soloCreador = selectedAsignados.length <= 1;
    return Boolean(
      nombreCampania || selectedCuic || caras.length > 0 || descripcion || notas ||
      !soloCreador || archivo || newCara.articulo
    );
  };

  // Intento de cierre: avisa si hay cambios sin guardar, si no cierra directo.
  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // Toggle NSE
  const toggleNse = (nse: string) => {
    if (newCara.nse.includes(nse)) {
      setNewCara({ ...newCara, nse: newCara.nse.filter(n => n !== nse) });
    } else {
      setNewCara({ ...newCara, nse: [...newCara.nse, nse] });
    }
  };

  // Validacion de campos requeridos por paso para bloquear avance.
  // El checkbox IMU no entra: puede o no estar activo, no afecta completar.
  const isStepComplete = (s: number): boolean => {
    if (s === 1) {
      // Cliente: CUIC seleccionado + al menos un asignado
      return Boolean(selectedCuic) && selectedAsignados.length > 0;
    }
    if (s === 2) {
      // Campaña: nombre + rango de fechas valido + descripcion + notas
      if (!nombreCampania.trim()) return false;
      if (!yearInicio || !yearFin) return false;
      if (tipoPeriodo === 'catorcena') {
        if (!catorcenaInicio || !catorcenaFin) return false;
      } else {
        if (!mesInicio || !mesFin) return false;
      }
      if (!descripcion.trim()) return false;
      if (!notas.trim()) return false;
      return true;
    }
    if (s === 3) {
      // Asignar Circuitos: al menos un circuito agregado
      return caras.length > 0;
    }
    return true;
  };
  // Para avanzar al paso N hay que tener completos los pasos 1..N-1.
  const canAdvanceToStep = (target: number): boolean => {
    if (target <= step) return true; // siempre puede regresar
    for (let i = 1; i < target; i++) {
      if (!isStepComplete(i)) return false;
    }
    return true;
  };
  // En modo edición no bloqueamos (los datos ya existen y pueden ajustarse).
  const enforceStepLock = !isEditMode;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className={`relative w-full max-w-5xl max-h-[95vh] h-[95vh] ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} rounded-2xl border shadow-2xl overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {isEditMode ? 'Editar Solicitud' : 'Nueva Solicitud'}
            </h2>
            {/* Articulos status */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} rounded-lg text-[10px]`}>
                <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Art:</span>
                <span className={articulosData && articulosData.length > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {articulosData?.length || 0}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshSap}
                disabled={articulosFetching}
                className={`p-1.5 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors disabled:opacity-50`}
                title="Refrescar artículos SAP"
              >
                <RefreshCw className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'} ${articulosFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <button onClick={handleAttemptClose} className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors`}>
            <X className={`h-5 w-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Progress steps */}
        <div className={`px-6 py-3 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'}`}>
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Cliente', icon: Building2 },
              { num: 2, label: 'Campaña', icon: FileText },
              { num: 3, label: 'Asignar Circuitos', icon: MapPin },
              { num: 4, label: 'Resumen', icon: Layers },
            ].map((s, i) => {
              const stepLocked = enforceStepLock && !canAdvanceToStep(s.num);
              return (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => { if (!stepLocked) setStep(s.num); }}
                  disabled={stepLocked}
                  title={stepLocked ? 'Completa los campos del paso actual antes de avanzar' : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${stepLocked ? 'cursor-not-allowed opacity-60' : ''} ${step === s.num
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : step > s.num
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : isDark ? 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50' : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
                {i < 3 && <div className={`flex-1 h-px ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`} />}
              </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Banner de borrador restaurado */}
        {restoredFromDraft && !isEditMode && (
          <div className="mx-4 mt-2 mb-1 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <span>Borrador restaurado. Puedes continuar donde lo dejaste.</span>
            <button
              type="button"
              onClick={() => { clearDraft(); resetForm(); }}
              className="ml-3 underline hover:text-amber-100 transition-colors whitespace-nowrap"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-6">
              {/* CUIC Select - Shows Marca first, then CUIC + Producto */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                  <Building2 className="h-4 w-4 text-purple-400" />
                  CUIC / Cliente
                </label>
                {/* SAP Database filter buttons */}
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'CIMU', 'TRADE'] as const).map(db => (
                    <button
                      key={db}
                      type="button"
                      onClick={() => { setSapDbFilter(db); setSelectedCuic(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        sapDbFilter === db
                          ? db === 'ALL' ? 'bg-purple-600 text-white border-purple-500'
                          : db === 'CIMU' ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-emerald-600 text-white border-emerald-500'
                          : isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                      }`}
                    >
                      {db === 'ALL' ? 'Todos' : db}
                    </button>
                  ))}
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} ml-2`}>
                    {cuicData?.length || 0} clientes
                  </span>
                </div>
                <SearchableSelect
                  label="Seleccionar CUIC"
                  options={cuicData || []}
                  value={selectedCuic}
                  onChange={(cuic: SAPCuicItem) => {
                    setSelectedCuic(cuic);
                    // Auto-asignar asesor si hay match por sap_asesor_id
                    const asesorId = cuic.ASESOR_U_IDAsesor ? parseInt(String(cuic.ASESOR_U_IDAsesor)) : null;
                    if (asesorId && users) {
                      const asesorUser = users.find((u: any) => u.sap_asesor_id === asesorId);
                      if (asesorUser && !selectedAsignados.some(a => a.id === asesorUser.id)) {
                        setSelectedAsignados(prev => [...prev, { id: asesorUser.id, nombre: asesorUser.nombre, area: asesorUser.area || '', puesto: asesorUser.puesto || '' }]);
                      }
                    }
                  }}
                  onClear={() => setSelectedCuic(null)}
                  displayKey="T2_U_Marca"
                  valueKey="CUIC"
                  searchKeys={['T2_U_Marca', 'T2_U_Producto', 'T0_U_RazonSocial', 'T0_U_Cliente', 'CUIC']}
                  loading={cuicLoading}
                  disabled={isEditMode && !canEditCliente}
                  renderOption={(item) => (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.T2_U_Marca || 'Sin marca'}</div>
                        <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {item.CUIC} | {item.T2_U_Producto || 'Sin producto'}
                        </div>
                      </div>
                      {item.sap_database && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          item.sap_database === 'CIMU' ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.sap_database === 'TEST' ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200' :
                          item.sap_database === 'TRADE' ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>{item.sap_database}</span>
                      )}
                    </div>
                  )}
                  renderSelected={(item) => (
                    <div className="text-left flex items-center gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{item.T2_U_Marca || 'Sin marca'}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.CUIC} | {item.T2_U_Producto || ''}</div>
                      </div>
                      {item.sap_database && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          item.sap_database === 'CIMU' ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.sap_database === 'TEST' ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200' :
                          item.sap_database === 'TRADE' ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>{item.sap_database}</span>
                      )}
                    </div>
                  )}
                />
              </div>

              {/* Selected client info - Complete */}
              {selectedCuic && (
                <div className={`p-4 ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-xl border`}>
                  {/* Header con CUIC destacado */}
                  <div className={`flex items-start justify-between mb-3 pb-3 border-b ${isDark ? 'border-zinc-700/50' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-purple-400 uppercase tracking-wider">CUIC</span>
                        <div className="text-xl font-bold text-purple-400">{selectedCuic.CUIC}</div>
                      </div>
                      {selectedCuic.sap_database && (
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${
                          selectedCuic.sap_database === 'CIMU' ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200' :
                          selectedCuic.sap_database === 'TEST' ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200' :
                          selectedCuic.sap_database === 'TRADE' ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>{selectedCuic.sap_database}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider`}>Categoría</span>
                      <div className="text-sm font-medium text-amber-400">{selectedCuic.T2_U_Categoria || '-'}</div>
                    </div>
                  </div>

                  {/* Grid de información 2 columnas */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Marca:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{selectedCuic.T2_U_Marca || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Producto:</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>{selectedCuic.T2_U_Producto || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Cliente:</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>{selectedCuic.T0_U_Cliente || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Razón Social:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} truncate max-w-[180px]`} title={selectedCuic.T0_U_RazonSocial || '-'}>{selectedCuic.T0_U_RazonSocial || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Asesor:</span>
                      <span className="text-emerald-400 font-medium">{selectedCuic.ASESOR_U_Asesor || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Agencia:</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>{selectedCuic.T0_U_Agencia || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Asignados with tags - search at bottom */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                    <Users className="h-4 w-4 text-purple-400" />
                    Asignados
                  </label>
                  {selectedAsignados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedAsignados([])}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpiar todos
                    </button>
                  )}
                </div>
                <MultiSelectTags
                  label="usuario"
                  options={users || []}
                  selected={selectedAsignados}
                  onChange={setSelectedAsignados}
                  displayKey="nombre"
                  valueKey="id"
                  searchKey="nombre"
                />
              </div>
            </div>
          )}

          {/* Step 2: Campaña */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Warning: caras with invalid periods */}
              {invalidCaras.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>{invalidCaras.length} circuito{invalidCaras.length > 1 ? 's' : ''}</strong> asignado{invalidCaras.length > 1 ? 's' : ''} ya no pertenece{invalidCaras.length > 1 ? 'n' : ''} al rango de catorcenas actual. Ve a "Asignar Circuito" y elimínalos o ajusta el rango.
                  </span>
                </div>
              )}
              {/* Campaign name */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Nombre de Campaña</label>
                <input
                  type="text"
                  value={nombreCampania}
                  onChange={(e) => setNombreCampania(e.target.value)}
                  placeholder="Nombre de la campaña..."
                  className={`w-full px-4 py-3 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                />
              </div>

              {/* Date range */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Rango de Fechas
                  </label>
                  {/* Toggle Catorcena / Mensual */}
                  <div className={`flex items-center ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'} rounded-lg border p-0.5`}>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoPeriodo('catorcena');
                        setMesInicio(undefined);
                        setMesFin(undefined);
                        setCaras([]);
                        // Clear articulo/formato if incompatible with new period type
                        if (newCara.articulo && getRequiredPeriodoForArticulo(newCara.articulo.ItemName) !== 'catorcena') {
                          setNewCara(prev => ({ ...prev, articulo: null, formato: '', tipo: '', plaza: '', estado: '', ciudades: [], tarifaPublica: 0 }));
                        } else if (newCara.formato && getRequiredPeriodoForFormato(newCara.formato) !== 'catorcena') {
                          setNewCara(prev => ({ ...prev, formato: '' }));
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${tipoPeriodo === 'catorcena' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Catorcena
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoPeriodo('mensual');
                        setCatorcenaInicio(undefined);
                        setCatorcenaFin(undefined);
                        setCaras([]);
                        // Clear articulo/formato if incompatible with new period type
                        if (newCara.articulo && getRequiredPeriodoForArticulo(newCara.articulo.ItemName) !== 'mensual') {
                          setNewCara(prev => ({ ...prev, articulo: null, formato: '', tipo: '', plaza: '', estado: '', ciudades: [], tarifaPublica: 0 }));
                        } else if (newCara.formato && getRequiredPeriodoForFormato(newCara.formato) !== 'mensual') {
                          setNewCara(prev => ({ ...prev, formato: '' }));
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${tipoPeriodo === 'mensual' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Mensual
                    </button>
                  </div>
                </div>

                {tipoPeriodo === 'catorcena' ? (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Años */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Inicio</label>
                        <select
                          value={yearInicio || ''}
                          onChange={(e) => {
                            setYearInicio(e.target.value ? parseInt(e.target.value) : undefined);
                            setCatorcenaInicio(undefined);
                          }}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        >
                          <option value="">Seleccionar</option>
                          {yearInicioOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Fin</label>
                        <select
                          value={yearFin || ''}
                          onChange={(e) => {
                            setYearFin(e.target.value ? parseInt(e.target.value) : undefined);
                            setCatorcenaFin(undefined);
                          }}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        >
                          <option value="">Seleccionar</option>
                          {yearFinOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Catorcenas */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cat. Inicio</label>
                        <select
                          value={catorcenaInicio || ''}
                          onChange={(e) => setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                          disabled={!yearInicio}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Seleccionar</option>
                          {catorcenasInicioOptions.map(c => (
                            <option key={c.id} value={c.numero_catorcena}>
                              Cat {c.numero_catorcena} / {c.a_o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cat. Fin</label>
                        <select
                          value={catorcenaFin || ''}
                          onChange={(e) => setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                          disabled={!yearFin}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Seleccionar</option>
                          {catorcenasFinOptions.map(c => (
                            <option key={c.id} value={c.numero_catorcena}>
                              Cat {c.numero_catorcena} / {c.a_o}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Años */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Inicio</label>
                        <select
                          value={yearInicio || ''}
                          onChange={(e) => {
                            setYearInicio(e.target.value ? parseInt(e.target.value) : undefined);
                            setMesInicio(undefined);
                          }}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        >
                          <option value="">Seleccionar</option>
                          {yearInicioOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Fin</label>
                        <select
                          value={yearFin || ''}
                          onChange={(e) => {
                            setYearFin(e.target.value ? parseInt(e.target.value) : undefined);
                            setMesFin(undefined);
                          }}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        >
                          <option value="">Seleccionar</option>
                          {yearFinOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Meses */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Mes Inicio</label>
                        <select
                          value={mesInicio || ''}
                          onChange={(e) => setMesInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                          disabled={!yearInicio}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Seleccionar</option>
                          {mesInicioOptions.map(m => (
                            <option key={m} value={m}>{MESES[m - 1]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Mes Fin</label>
                        <select
                          value={mesFin || ''}
                          onChange={(e) => setMesFin(e.target.value ? parseInt(e.target.value) : undefined)}
                          disabled={!yearFin}
                          className={`w-full px-3 py-2.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Seleccionar</option>
                          {mesFinOptions.map(m => (
                            <option key={m} value={m}>{MESES[m - 1]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Descripción Trafico</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción detallada de la campaña..."
                  rows={4}
                  className={`w-full px-4 py-3 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none`}
                />
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Notas Dirección</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas breves..."
                  rows={4}
                  className={`w-full px-4 py-3 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none`}
                />
              </div>
            </div>
          )}

          {/* Step 3: Ubicaciones */}
          {step === 3 && (
            <div className="space-y-6">
              {/* KPIs Totales */}
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totals.totalRenta}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Renta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{totals.totalBonificacion}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Bonificación</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalRenta + totals.totalBonificacion}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Total {totals.allPuentePeatonal ? 'Puentes' : 'Caras'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{formatCurrency(totals.totalPrecio)}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Inversión</div>
                  </div>
                </div>
              </div>

              {/* Add cara form */}
              <div ref={circuitFormRef} className={`p-4 ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-xl border`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <Plus className="h-4 w-4 text-purple-400" />
                    {editingCaraId ? 'Editar Circuito' : 'Agregar Circuito'}
                  </h3>
                  {/* Toggle Modo Masivo (solo catorcena) */}
                  {tipoPeriodo === 'catorcena' && (
                    <label className={`flex items-center gap-2 text-xs cursor-pointer select-none ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                      <span>Modo masivo</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !modoMasivo;
                          setModoMasivo(next);
                          // Al apagar, limpiar el cat fin
                          if (!next) setNewCara({ ...newCara, periodoFinCat: '' });
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${modoMasivo ? 'bg-purple-500' : (isDark ? 'bg-zinc-700' : 'bg-gray-300')}`}
                        title="Crea o actualiza varias caras en un rango de catorcenas"
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoMasivo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <span className={`text-[10px] uppercase font-semibold ${modoMasivo ? 'text-purple-400' : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}>
                        {modoMasivo ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  )}
                </div>

                {/* Row 1: Articulo SAP */}
                <div className="mb-4">
                  <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} flex items-center gap-1`}>
                    <Package className="h-3 w-3" />
                    Artículo SAP
                  </label>
                  <SearchableSelect
                    label="Seleccionar artículo"
                    options={articulosFiltrados}
                    value={newCara.articulo}
                    onChange={async (item) => {
                      // Detectar CIRCUITO DIGITAL
                      const circuito = parseCircuitoDigital(item.ItemCode);
                      if (circuito) {
                        // Unicidad por catorcena se valida en handleAddCara — el mismo CTO+plaza
                        // se permite en distintas catorcenas/meses
                        try {
                          const det = await circuitosService.detalle(item.ItemCode);
                          const tarifa = getTarifaFromArticulo(item);
                          setCircuitoMuebles(det.muebles);
                          setCircuitoFlujoContra({ flujo: det.flujo, contraflujo: det.contraflujo });
                          // Formato como lista de los muebles reales del circuito (en lugar
                          // del placeholder "MIXTO"). Como es multi-select, se ven varios
                          // chips con cada formato presente en los inventarios del circuito.
                          const formatosCircuito = Object.keys(det.muebles || {}).filter(Boolean);
                          setNewCara({
                            ...newCara,
                            articulo: item,
                            plaza: circuito.plazaLabel,
                            estado: circuito.plazaLabel,
                            ciudades: [],
                            formato: formatosCircuito.length > 0 ? formatosCircuito.join(', ') : 'MIXTO',
                            tipo: 'Digital',
                            tarifaPublica: tarifa.tarifa_publica,
                            renta: det.total, // fijo al tamaño del circuito
                            bonificacion: 0,
                            articuloBf: null,
                          });
                          return;
                        } catch (e: any) {
                          alert(`Error al cargar circuito: ${e?.message || e}`);
                          return;
                        }
                      }

                      // Auto-set tarifa publica from ItemCode mapping
                      const tarifa = getTarifaFromArticulo(item);
                      // Auto-set estado and ciudades from ItemName (fallback to ItemCode)
                      const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName, item.ItemCode);
                      // Auto-set plaza: buscar el nombre de plaza dentro del ItemName (descripción SAP).
                      // Ej: "BONIFICACION DE ESPACIOS MI MACRO GUADALAJARA MODULO C" → match "GUADALAJARA"
                      // Comparamos SIN ACENTOS porque las plazas en BD pueden traer tilde
                      // (ej. "MÉRIDA") pero los ItemName de SAP vienen sin acento.
                      const itemNameNorm = stripAccents((item.ItemName || '').toUpperCase());
                      const plazaPorNombre = inventarioFilters?.plazas?.find(p =>
                        itemNameNorm.includes(stripAccents(p.plaza.toUpperCase()))
                      );
                      // Si no se encuentra por nombre, fallback al segmento del ItemCode (gd, gdl, mty, mx, mr, etc.)
                      const plazaAutoRaw = getPlazaFromArticle(item.ItemCode);
                      const plazaPorCodigo = inventarioFilters?.plazas?.find(p =>
                        stripAccents(p.plaza.toLowerCase()) === stripAccents(plazaAutoRaw.toLowerCase())
                      );
                      // Fallback: si MULTI_CITY_RULES dio un estado (ej. "Estado de México" para NAUC),
                      // intentar match contra plazas del backend (ej. "ESTADO DE MÉXICO")
                      const plazaPorEstado = ciudadEstado?.estado
                        ? inventarioFilters?.plazas?.find(p =>
                            p.plaza.toUpperCase() === ciudadEstado.estado.toUpperCase()
                          )
                        : null;
                      const plazaAuto = plazaPorNombre?.plaza
                        || plazaPorCodigo?.plaza
                        || plazaPorEstado?.plaza
                        || (plazaAutoRaw !== item.ItemCode ? plazaAutoRaw : '');
                      // Auto-set formato from ItemName (fallback to ItemCode)
                      const formatoBase = getFormatoFromArticulo(item.ItemName, item.ItemCode);
                      // Auto-set tipo from ItemName
                      const tipo = getTipoFromName(item.ItemName);
                      // Para artículos digitales: incluir PARABUS y MUPIS (los muebles físicos
                      // donde corre la pantalla digital rotando ambos formatos).
                      // Si el formato detectado es otro (ej. COLUMNA), agregar MUPIS además.
                      const formato = tipo === 'Digital'
                        ? (formatoBase && formatoBase !== 'PARABUS'
                            ? `${formatoBase}, PARABUS, MUPIS`
                            : 'PARABUS, MUPIS')
                        : formatoBase;
                      // Detect CT (cortesia) articles
                      const isCortesia = item.ItemCode.toUpperCase().startsWith('CT');
                      const isIntercambio = item.ItemCode.toUpperCase().startsWith('IN');
                      const isImpresion = item.ItemCode.toUpperCase().startsWith('IM');
                      const isEspecial = isEspecialArticle(item.ItemCode);
                      const isTarifaCero = isCortesia;

                      setNewCara({
                        ...newCara,
                        articulo: item,
                        tarifaPublica: isTarifaCero ? 0 : tarifa.tarifa_publica,
                        renta: isCortesia ? 0 : newCara.renta,
                        bonificacion: (isImpresion || isIntercambio || isEspecial) ? 0 : newCara.bonificacion,
                        plaza: plazaAuto || newCara.plaza,
                        estado: ciudadEstado?.estado || newCara.estado,
                        ciudades: ciudadEstado?.ciudades && ciudadEstado.ciudades.length > 0 ? ciudadEstado.ciudades : newCara.ciudades,
                        formato: formato || newCara.formato,
                        tipo: tipo || newCara.tipo,
                      });
                    }}
                    onClear={() => setNewCara({ ...newCara, articulo: null, tarifaPublica: 0, plaza: '', estado: '', ciudades: [], formato: '', tipo: '' })}
                    displayKey="ItemName"
                    valueKey="ItemCode"
                    searchKeys={['ItemCode', 'ItemName']}
                    loading={articulosLoading}
                    renderOption={(item) => (
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.ItemCode}</div>
                        <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.ItemName}</div>
                      </div>
                    )}
                    renderSelected={(item) => (
                      <div className="text-left">
                        <div className="font-medium text-sm">{item.ItemCode}</div>
                        <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.ItemName}</div>
                      </div>
                    )}
                  />
                </div>

                {/* Row 2: Plaza, Ciudad (opcional), Formato, Tipo */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {/* Plaza (UI); internally seleciona estado+ciudades */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Plaza</label>
                    <select
                      value={newCara.plaza || newCara.estado}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Special: CDMX / AM combina 2 estados
                        if (val === CDMX_AM_LABEL) {
                          setNewCara({ ...newCara, plaza: val, estado: val, ciudades: [] });
                          return;
                        }
                        // Buscar plaza en filtros
                        const plazaInfo = inventarioFilters?.plazas?.find(p => p.plaza === val);
                        if (plazaInfo) {
                          const estadoPrim = plazaInfo.estados[0] || '';
                          setNewCara({
                            ...newCara,
                            plaza: val,
                            estado: estadoPrim,
                            ciudades: [],
                          });
                        } else {
                          // Fallback: val puede ser un estado (backward compat)
                          setNewCara({ ...newCara, plaza: val, estado: val, ciudades: [] });
                        }
                      }}
                      className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                    >
                      <option value="">Seleccionar</option>
                      <option value={CDMX_AM_LABEL}>{CDMX_AM_LABEL}</option>
                      {(inventarioFilters?.plazas && inventarioFilters.plazas.length > 0
                        ? inventarioFilters.plazas.map(p => p.plaza)
                        : (inventarioFilters?.estados || [])
                      ).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ciudad (opcional) */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Ciudad (opcional)</label>
                    <MultiSelectTags
                      label="ciudad"
                      options={filteredCiudades.map(c => ({ ciudad: c }))}
                      selected={newCara.ciudades.map(c => ({ ciudad: c }))}
                      onChange={(items) => setNewCara({ ...newCara, ciudades: items.map(i => i.ciudad) })}
                      displayKey="ciudad"
                      valueKey="ciudad"
                      searchKey="ciudad"
                    />
                  </div>

                  {/* Formato */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      Formato {newCara.formato && <span className="text-purple-400">({newCara.formato.split(',').filter(Boolean).length})</span>}
                    </label>
                    {(() => {
                      // Multi-select de formatos (igual que en propuestas/campañas) para que
                      // se puedan combinar PARABUS + MUPIS en artículos digitales.
                      const baseOptions = newCara.articulo && parseCircuitoDigital(newCara.articulo.ItemCode)
                        ? ['MIXTO']
                        : [];
                      const periodOptions = tipoPeriodo === 'mensual'
                        ? (inventarioFilters?.formatos && inventarioFilters.formatos.length > 0
                            ? inventarioFilters.formatos
                            : FORMATOS_MENSUALES)
                        : filteredFormatos;
                      const optionsArr = [...baseOptions, ...periodOptions.filter(f => !baseOptions.includes(f))]
                        .map(f => ({ formato: f }));
                      const selectedArr = (newCara.formato ? newCara.formato.split(',').map(s => s.trim()).filter(Boolean) : [])
                        .map(f => ({ formato: f }));
                      return (
                        <MultiSelectTags
                          label="formato"
                          options={optionsArr}
                          selected={selectedArr}
                          onChange={(items) => setNewCara({ ...newCara, formato: items.map((i: { formato: string }) => i.formato).join(', ') })}
                          displayKey="formato"
                          valueKey="formato"
                          searchKey="formato"
                        />
                      );
                    })()}
                  </div>

                  {/* Tipo (selector con autocompletado).
                      Al crear circuito el tipo queda fijo (se deriva del artículo).
                      Solo al editar un circuito existente se puede cambiar manualmente. */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tipo</label>
                    <select
                      value={newCara.tipo}
                      onChange={(e) => editingCaraId && setNewCara({ ...newCara, tipo: e.target.value as 'Tradicional' | 'Digital' | '' })}
                      disabled={!editingCaraId}
                      className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!editingCaraId ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Seleccionar</option>
                      {filteredTipos.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Periodo, Renta, Bonificación, Tarifa Pública */}
                <div className={`grid ${tipoPeriodo === 'mensual' ? 'grid-cols-6' : 'grid-cols-4'} gap-3 mb-4`}>
                  {/* Periodo */}
                  {tipoPeriodo === 'mensual' ? (
                    <>
                      <div>
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Mes</label>
                        <select
                          value={newCara.periodo}
                          onChange={(e) => {
                            const val = e.target.value;
                            const match = availablePeriods.find(p => `${p.a_o}-${p.numero_catorcena}` === val);
                            setNewCara({ ...newCara, periodo: val, periodoInicioCustom: match?.fecha_inicio || '', periodoFinCustom: match?.fecha_fin || '' });
                          }}
                          disabled={availablePeriods.length === 0}
                          className={`w-full px-2 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Seleccionar</option>
                          {availablePeriods.map(p => (
                            <option key={`${p.a_o}-${p.numero_catorcena}`} value={`${p.a_o}-${p.numero_catorcena}`}>
                              {MESES[p.numero_catorcena - 1]} {p.a_o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Fecha Inicio</label>
                        <input
                          type="date"
                          value={newCara.periodoInicioCustom}
                          onChange={(e) => setNewCara({ ...newCara, periodoInicioCustom: e.target.value })}
                          disabled={!newCara.periodo}
                          min={availablePeriods.length > 0 ? availablePeriods[0].fecha_inicio : undefined}
                          max={newCara.periodoFinCustom || (availablePeriods.length > 0 ? availablePeriods[availablePeriods.length - 1].fecha_fin : undefined)}
                          className={`w-full px-2 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        />
                      </div>
                      <div>
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Fecha Fin</label>
                        <input
                          type="date"
                          value={newCara.periodoFinCustom}
                          onChange={(e) => setNewCara({ ...newCara, periodoFinCustom: e.target.value })}
                          disabled={!newCara.periodo}
                          min={newCara.periodoInicioCustom || (availablePeriods.length > 0 ? availablePeriods[0].fecha_inicio : undefined)}
                          max={availablePeriods.length > 0 ? availablePeriods[availablePeriods.length - 1].fecha_fin : undefined}
                          className={`w-full px-2 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                    <div>
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{modoMasivo ? 'Cat. Inicio' : 'Periodo'}</label>
                      <select
                        value={newCara.periodo}
                        onChange={(e) => setNewCara({ ...newCara, periodo: e.target.value })}
                        disabled={availablePeriods.length === 0}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                      >
                        <option value="">Seleccionar</option>
                        {availablePeriods.map(p => (
                          <option key={`${p.a_o}-${p.numero_catorcena}`} value={`${p.a_o}-${p.numero_catorcena}`}>
                            Cat {p.numero_catorcena} / {p.a_o}
                          </option>
                        ))}
                      </select>
                    </div>
                    {modoMasivo && (
                      <div>
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cat. Fin</label>
                        <select
                          value={newCara.periodoFinCat}
                          onChange={(e) => setNewCara({ ...newCara, periodoFinCat: e.target.value })}
                          disabled={!newCara.periodo}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50`}
                        >
                          <option value="">Solo {newCara.periodo ? `Cat ${newCara.periodo.split('-')[1]}` : 'una'}</option>
                          {availablePeriods
                            .filter(p => {
                              if (!newCara.periodo) return false;
                              const [yStr, cStr] = newCara.periodo.split('-');
                              const yIni = parseInt(yStr);
                              const cIni = parseInt(cStr);
                              return (p.a_o * 100 + p.numero_catorcena) >= (yIni * 100 + cIni);
                            })
                            .map(p => (
                              <option key={`${p.a_o}-${p.numero_catorcena}-fin`} value={`${p.a_o}-${p.numero_catorcena}`}>
                                Cat {p.numero_catorcena} / {p.a_o}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    </>
                  )}

                  {/* Renta */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      {newCara.articulo?.ItemCode?.toUpperCase().startsWith('IM') ? 'Impresiones' : newCara.articulo?.ItemCode?.toUpperCase().startsWith('IN') ? 'Intercambio' : isEspecialArticle(newCara.articulo?.ItemCode || '') ? 'Ejec. Especiales' : 'Renta'}
                      {newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT') && (
                        <span className="ml-1 text-cyan-400 text-[10px]">(Cortesía)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newCara.renta || ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setNewCara({ ...newCara, renta: v });
                      }}
                      placeholder='0'
                      disabled={newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT')}
                      className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed`}
                    />
                  </div>

                  {/* Bonificacion */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      {newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT') ? undefined : newCara.renta}
                      value={newCara.bonificacion || ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setNewCara({ ...newCara, bonificacion: v });
                      }}
                      placeholder='0'
                      disabled={newCara.articulo?.ItemCode?.toUpperCase().startsWith('IM') || newCara.articulo?.ItemCode?.toUpperCase().startsWith('IN') || isEspecialArticle(newCara.articulo?.ItemCode || '')}
                      className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${(newCara.articulo?.ItemCode?.toUpperCase().startsWith('IM') || newCara.articulo?.ItemCode?.toUpperCase().startsWith('IN') || isEspecialArticle(newCara.articulo?.ItemCode || '')) ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </div>

                  {/* Tarifa Publica - Editable. Display siempre con 2 decimales (6127 → 6127.00).
                      Usa type="text" porque type="number" descarta trailing zeros del valor mostrado. */}
                  <div>
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tarifa Pública</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tarifaPublicaFocused
                        ? tarifaPublicaInput
                        : (newCara.tarifaPublica > 0 ? newCara.tarifaPublica.toFixed(2) : '')}
                      onFocus={() => {
                        setTarifaPublicaInput(newCara.tarifaPublica > 0 ? String(newCara.tarifaPublica) : '');
                        setTarifaPublicaFocused(true);
                      }}
                      onBlur={() => setTarifaPublicaFocused(false)}
                      onChange={(e) => {
                        // Permitir solo dígitos, un punto y máximo 2 decimales mientras se escribe
                        const cleaned = e.target.value.replace(/[^\d.]/g, '');
                        const parts = cleaned.split('.');
                        const normalized = parts.length > 1
                          ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
                          : cleaned;
                        setTarifaPublicaInput(normalized);
                        setNewCara({ ...newCara, tarifaPublica: parseFloat(normalized) || 0 });
                      }}
                      placeholder="0.00"
                      disabled={newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT')}
                      className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'} border rounded-lg text-emerald-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-40 disabled:cursor-not-allowed`}
                    />
                  </div>
                </div>

                {/* Row 4: NSE */}
                <div className="mb-4">
                  <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Nivel Socioeconómico</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {filteredNse.map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleNse(n)}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${newCara.nse.includes(n)
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : isDark ? 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:border-zinc-500' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview: Cortesia info */}
                {newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT') && newCara.bonificacion > 0 && (
                  <div className="mt-4 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyan-300 font-medium">Cortesía</span>
                      <span className="text-cyan-300">{newCara.bonificacion} caras (sin costo)</span>
                    </div>
                  </div>
                )}

                {/* Preview: Circuito Digital info */}
                {newCara.articulo && (() => {
                  const circ = parseCircuitoDigital(newCara.articulo.ItemCode);
                  if (!circ) return null;
                  const total = newCara.renta + newCara.bonificacion;
                  const muebles = circuitoMuebles
                    ? Object.entries(circuitoMuebles).map(([m, c]) => `${m}: ${c}`).join(' · ')
                    : '';
                  return (
                    <div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                          🔁 Circuito Digital · {circ.ctoLabel} · {circ.plazaLabel}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-violet-200' : 'text-violet-700'}`}>
                          Total: {total} caras (fijo) · Auto-reserva al crear propuesta
                        </span>
                      </div>
                      {muebles && (
                        <div className={`text-[10px] ${isDark ? 'text-violet-300' : 'text-violet-600'} mb-1`}>
                          Mezcla: {muebles}
                        </div>
                      )}
                      <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Renta: {newCara.renta} · Bonif: {newCara.bonificacion} · Autorización: aprobado automático
                      </div>
                    </div>
                  );
                })()}

                {/* Artículo BF - below the grid when bonificacion > 0 */}
                {newCara.bonificacion > 0 && !newCara.articulo?.ItemCode?.toUpperCase().startsWith('CT') && !newCara.articulo?.ItemCode?.toUpperCase().startsWith('IM') && !isEspecialArticle(newCara.articulo?.ItemCode || '') && (
                  <div className={`mt-3 p-3 ${isDark ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} rounded-lg border`}>
                    <label className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'} mb-1 block`}>Artículo de Bonificación (BF)</label>
                    <SearchableSelect
                      label=""
                      options={(articulosData || []).filter(a => a.ItemCode.toUpperCase().startsWith('BF') || a.ItemCode.toUpperCase().startsWith('CF'))}
                      value={newCara.articuloBf}
                      onChange={(item: SAPArticulo) => setNewCara({ ...newCara, articuloBf: item })}
                      onClear={() => setNewCara({ ...newCara, articuloBf: null })}
                      displayKey="ItemName"
                      valueKey="ItemCode"
                      searchKeys={['ItemCode', 'ItemName']}
                      renderOption={(item) => (
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.ItemCode}</div>
                          <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.ItemName}</div>
                        </div>
                      )}
                      renderSelected={(item) => (
                        <div className="text-left">
                          <div className={`text-xs font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{item.ItemCode}</div>
                        </div>
                      )}
                    />
                  </div>
                )}

                {/* Preview calculation */}
                {newCara.renta > 0 && newCara.tarifaPublica > 0 && (
                  <div className={`mt-4 p-3 ${isDark ? 'bg-zinc-800/50 border-zinc-700/30' : 'bg-gray-50 border-gray-200'} rounded-lg border space-y-2`}>
                    {(() => {
                      const isPP = (newCara.articulo?.ItemName || newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL');
                      const sing = isPP ? 'puentes' : 'caras';
                      const cap = isPP ? 'Puentes' : 'Caras';
                      return (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Inversión (Tarifa Cliente):</span>
                            <span className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                              {newCara.renta} {sing} × {formatCurrency(newCara.tarifaPublica)} = <span className="text-emerald-400 font-medium">{formatCurrency(newCara.renta * newCara.tarifaPublica)}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{cap} Totales:</span>
                            <span className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                              {newCara.renta} {sing} + {newCara.bonificacion} bonif. = <span className="text-blue-400 font-medium">{newCara.renta + newCara.bonificacion} {sing} totales</span>
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    <div className="flex items-center justify-between text-xs">
                      <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Tarifa Efectiva:</span>
                      <span className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                        {formatCurrency(newCara.renta * newCara.tarifaPublica)} ÷ {newCara.renta + newCara.bonificacion} = <span className="text-purple-400 font-medium">{formatCurrency((newCara.renta * newCara.tarifaPublica) / (newCara.renta + newCara.bonificacion))}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddCara}
                    disabled={(() => {
                      const esCirc = newCara.articulo ? !!parseCircuitoDigital(newCara.articulo.ItemCode) : false;
                      const baseInvalid = !newCara.articulo || !newCara.estado || !newCara.formato || !newCara.tipo || !newCara.periodo || (tipoPeriodo === 'mensual' && (!newCara.periodoInicioCustom || !newCara.periodoFinCustom));
                      // NSE solo requerido si NO es circuito
                      const nseInvalid = !esCirc && newCara.nse.length === 0;
                      // Bloqueo: con autorización de dirección pendiente no se
                      // pueden AGREGAR circuitos nuevos (editar uno existente sí).
                      return baseInvalid || nseInvalid || (authBlocked && !editingCaraId);
                    })()}
                    className={`flex items-center gap-2 px-4 py-2 ${editingCaraId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'} ${isDark ? 'disabled:bg-zinc-700 disabled:text-zinc-500' : 'disabled:bg-gray-200 disabled:text-gray-400'} text-white rounded-lg text-sm font-medium transition-colors`}
                  >
                    {editingCaraId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingCaraId ? 'Actualizar Circuito' : 'Agregar Circuito'}
                  </button>
                  {editingCaraId ? (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                    >
                      <X className="h-4 w-4" />
                      Cancelar Edición
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearNewCara}
                      className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Limpiar Campos
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de acciones masivas: aparece al seleccionar circuitos */}
              {BULK_DELETE_ENABLED && permissions.canEditCircuitoExistente && !authBlocked && selectedCaraIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 mb-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <span className="text-sm font-medium text-red-300">
                    {caras.filter(c => selectedCaraIds.has(c.id) && !c.esBf).length} circuito(s) seleccionado(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCaraIds(new Set())}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'text-zinc-300 hover:bg-zinc-700/50' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkRemove}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar seleccionados
                    </button>
                  </div>
                </div>
              )}

              {/* Caras table - grouped by catorcena */}
              <div ref={circuitTableRef} className={`rounded-xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200'} overflow-hidden`}>
                {groupedCaras.length === 0 ? (
                  <div className={`px-4 py-8 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                    No hay circuitos agregados
                  </div>
                ) : (
                  <div>
                    {groupedCaras.map(([key, items]) => {
                      const isExpanded = expandedCatorcenas.has(key);
                      const groupTotal = items.reduce((acc, c) => acc + c.precioTotal, 0);
                      const groupRenta = items.filter(c => !c.esBf).reduce((acc, c) => acc + c.renta, 0);
                      const groupBonif = items.filter(c => c.esBf).reduce((acc, c) => acc + c.renta, 0) + items.reduce((acc, c) => acc + c.bonificacion, 0);
                      const groupAllPP = items.length > 0 && items.every(i => (i.formato || '').toUpperCase().includes('PUENTE PEATONAL'));
                      const carasHeader = groupAllPP ? 'Puentes' : 'Caras';

                      const groupAllSelected = items.length > 0 && items.every(i => selectedCaraIds.has(i.id));
                      const groupSomeSelected = items.some(i => selectedCaraIds.has(i.id));

                      return (
                        <div key={key}>
                          {/* Period header */}
                          <div className={`w-full flex items-center justify-between px-4 py-3 ${isDark ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} transition-colors border-b`}>
                            <div className="flex items-center gap-3">
                              {BULK_DELETE_ENABLED && permissions.canEditCircuitoExistente && !authBlocked && (
                                <CircuitCheckbox
                                  checked={groupAllSelected}
                                  indeterminate={!groupAllSelected && groupSomeSelected}
                                  stopPropagation
                                  onChange={() => toggleCatorcenaSelection(items)}
                                  title="Seleccionar toda la catorcena"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => toggleCatorcena(key)}
                                className="flex items-center gap-3 text-left"
                              >
                                {isExpanded ? <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} /> : <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />}
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{getPeriodLabel(key)}</span>
                                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({items.filter(c => !c.esBf).length} circuitos)</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCatorcena(key)}
                              className="flex items-center gap-4 text-sm"
                            >
                              <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{groupRenta} renta</span>
                              <span className="text-emerald-400">{groupBonif} bonif.</span>
                              <span className="text-amber-400 font-medium">{formatCurrency(groupTotal)}</span>
                            </button>
                          </div>

                          {/* Expanded items */}
                          {isExpanded && (
                            <div className={`${isDark ? 'bg-zinc-900/50' : 'bg-white'} overflow-x-auto`}>
                              <table className="w-full min-w-[1000px]">
                                <thead>
                                  <tr className={isDark ? 'bg-zinc-800/30' : 'bg-gray-50'}>
                                    {BULK_DELETE_ENABLED && permissions.canEditCircuitoExistente && !authBlocked && (
                                      <th className="px-2 py-2 w-8"></th>
                                    )}
                                    <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Artículo</th>
                                    <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Plaza</th>
                                    <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tipo</th>
                                    <th className={`px-2 py-2 text-left text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Formato</th>
                                    <th className={`px-2 py-2 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{carasHeader}</th>
                                    <th className={`px-2 py-2 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Bonif.</th>
                                    <th className={`px-2 py-2 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Total</th>
                                    <th className={`px-2 py-2 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tarifa Púb.</th>
                                    <th className={`px-2 py-2 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tarifa Efect.</th>
                                    <th className={`px-2 py-2 text-right text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Precio Total</th>
                                    <th className={`px-2 py-2 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Estado</th>
                                    <th className={`px-2 py-2 text-center text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((cara) => {
                                    const totalCaras = cara.renta + cara.bonificacion;
                                    const precioTotal = cara.precioTotal || (cara.tarifaPublica * cara.renta);
                                    const descuento = totalCaras > 0 ? ((cara.bonificacion / totalCaras) * 100) : 0;

                                    return (
                                      <tr key={cara.id} className={`border-t ${selectedCaraIds.has(cara.id) ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : ''} ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/20' : 'border-gray-100 hover:bg-gray-50'}`}>
                                        {BULK_DELETE_ENABLED && permissions.canEditCircuitoExistente && !authBlocked && (
                                          <td className="px-2 py-2 text-center">
                                            <CircuitCheckbox
                                              checked={selectedCaraIds.has(cara.id)}
                                              onChange={() => toggleCaraSelection(cara.id)}
                                              title="Seleccionar circuito"
                                            />
                                          </td>
                                        )}
                                        <td className={`px-2 py-2 text-xs ${isDark ? 'text-white' : 'text-gray-900'} max-w-[140px]`} title={`${cara.articulo.ItemCode} - ${cara.articulo.ItemName}`}>
                                          <div className="truncate font-medium">{cara.articulo.ItemCode}</div>
                                          <div className={`truncate text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{cara.articulo.ItemName}</div>
                                        </td>
                                        <td className={`px-2 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[80px] truncate`} title={cara.plaza || getPlazaFromArticle(cara.articulo?.ItemCode || '', cara.estado)}>
                                          {cara.plaza || getPlazaFromArticle(cara.articulo?.ItemCode || '', cara.estado)}
                                        </td>
                                        <td className="px-2 py-2">
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                                            }`}>
                                            {cara.tipo}
                                          </span>
                                        </td>
                                        <td className={`px-2 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{cara.formato}</td>
                                        <td className={`px-2 py-2 text-xs text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{cara.esBf ? 0 : cara.renta}</td>
                                        <td className="px-2 py-2 text-xs text-center text-emerald-400">{cara.esBf ? cara.renta : cara.bonificacion}</td>
                                        <td className={`px-2 py-2 text-xs text-center ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{totalCaras}</td>
                                        <td className={`px-2 py-2 text-xs text-right ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{formatCurrency(cara.tarifaPublica)}</td>
                                        <td className={`px-2 py-2 text-xs text-right ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{formatCurrency(cara.tarifaEfectiva ?? cara.tarifaPublica)}</td>
                                        <td className="px-2 py-2 text-xs text-right text-emerald-400 font-medium">{formatCurrency(precioTotal)}</td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            // Mostrar estado real de cada circuito tal como esta en BD.
                                            // Antes se forzaba CT a "aprobado" suponiendo que las cortesias
                                            // no requerian autorizacion, pero pueden ser escaladas a DG y
                                            // rechazadas — el back si las valida (commit 79c59e5) y bloquea
                                            // Atender si hay rechazos. Caso reproducido en 80822.
                                            const dgEfectivo = cara.autorizacion_dg;
                                            const dcmEfectivo = cara.autorizacion_dcm;
                                            return (
                                              <div className="flex flex-col gap-0.5">
                                                {dgEfectivo === 'aprobado' && dcmEfectivo === 'aprobado' && (
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                                    Aprobado
                                                  </span>
                                                )}
                                                {(dgEfectivo === 'rechazado' || dcmEfectivo === 'rechazado') && (
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/30 text-red-400">
                                                    Rechazado
                                                  </span>
                                                )}
                                                {dgEfectivo === 'pendiente' && dcmEfectivo !== 'rechazado' && (
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300" title="Requiere autorización DG">
                                                    Pend. DG
                                                  </span>
                                                )}
                                                {dcmEfectivo === 'pendiente' && dgEfectivo !== 'rechazado' && (
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300" title="Requiere autorización DCM">
                                                    Pend. DCM
                                                  </span>
                                                )}
                                                {!dgEfectivo && !dcmEfectivo && (
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-600/30 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>
                                                    Por evaluar
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const anyPendingSaved = caras.some(c => c._originalDg === 'pendiente' || c._originalDcm === 'pendiente');
                                            const authBlocked = isEditMode && anyPendingSaved;
                                            return (
                                          <div className="flex items-center justify-center gap-1">
                                            {(cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado') && (
                                              <button
                                                type="button"
                                                onClick={() => handleReenviarAutorizacion(cara.id)}
                                                className="p-1 rounded text-[10px] hover:bg-blue-500/20 text-blue-400"
                                                title="Reenviar a autorización (reprocesar este circuito)"
                                              >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {permissions.canEditCircuitoExistente && (
                                              <button
                                                type="button"
                                                onClick={() => { if (!authBlocked) handleEditCara(cara); }}
                                                disabled={authBlocked}
                                                className={`p-1 rounded text-[10px] ${authBlocked ? 'text-zinc-600 cursor-not-allowed' : editingCaraId === cara.id ? 'bg-purple-500/30 text-purple-300' : 'hover:bg-purple-500/20 text-purple-400'}`}
                                                title={authBlocked ? 'Autorización pendiente - no se puede editar' : 'Editar'}
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {permissions.canEditCircuitoExistente && (
                                              <button
                                                type="button"
                                                onClick={() => { if (!authBlocked) handleRemoveCara(cara.id); }}
                                                disabled={authBlocked}
                                                className={`p-1 rounded text-[10px] ${authBlocked ? 'text-zinc-600 cursor-not-allowed' : 'hover:bg-red-500/20 text-red-400'}`}
                                                title={authBlocked ? 'Autorización pendiente' : 'Eliminar'}
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                            );
                                          })()}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Totals footer */}
                    <div className={`px-4 py-3 ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border-t`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Totales:</span>
                        <div className="flex items-center gap-6 text-sm">
                          <span className={isDark ? 'text-white' : 'text-gray-900'}>{totals.totalRenta} renta</span>
                          <span className="text-emerald-400">{totals.totalBonificacion} bonif.</span>
                          <span className="text-amber-400 font-bold">{formatCurrency(totals.totalPrecio)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Resumen */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Warning: invalid caras */}
              {invalidCaras.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>{invalidCaras.length} circuito{invalidCaras.length > 1 ? 's' : ''}</strong> tienen catorcenas fuera del rango de campaña. Regresa a "Campaña" o "Asignar Circuito" para corregirlo.
                  </span>
                </div>
              )}
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-xl border`}>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-3`}>Cliente</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>CUIC:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{selectedCuic?.CUIC || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Marca:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{selectedCuic?.T2_U_Marca || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Producto:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{selectedCuic?.T2_U_Producto || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-xl border`}>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-3`}>Campaña</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Nombre:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{nombreCampania || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Circuitos:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>{caras.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Fechas:</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm`}>
                        {(() => {
                          // Mostrar como "Mes año a Mes año" (no fechas exactas)
                          if (!fechaInicio || !fechaFin) return '-';
                          const mesesFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                          const ini = String(fechaInicio).match(/^(\d{4})-(\d{2})/);
                          const fin = String(fechaFin).match(/^(\d{4})-(\d{2})/);
                          if (!ini || !fin) return '-';
                          const ml = (ym: RegExpMatchArray) => `${mesesFull[parseInt(ym[2]) - 1]} ${ym[1]}`;
                          return `${ml(ini)} a ${ml(fin)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totals.totalRenta}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Renta</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{totals.totalBonificacion}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Bonificación</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalRenta + totals.totalBonificacion}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Total {totals.allPuentePeatonal ? 'Puentes' : 'Caras'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{formatCurrency(totals.totalPrecio)}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Inversión</div>
                  </div>
                </div>
              </div>

              {/* Resumen de Catorcenas y Artículos */}
              <div className={`rounded-xl border ${isDark ? 'border-zinc-700/50' : 'border-gray-200'} overflow-hidden`}>
                <div className={`px-4 py-3 ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} border-b`}>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Desglose por Periodo
                  </h3>
                </div>
                {groupedCaras.length === 0 ? (
                  <div className={`px-4 py-6 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>
                    No hay caras agregadas
                  </div>
                ) : (
                  <div className={`divide-y ${isDark ? 'divide-zinc-700/50' : 'divide-gray-200'}`}>
                    {groupedCaras.map(([key, items]) => {
                      const groupTotal = items.reduce((acc, c) => acc + c.precioTotal, 0);
                      const groupRenta = items.filter(c => !c.esBf).reduce((acc, c) => acc + c.renta, 0);
                      const groupBonif = items.filter(c => c.esBf).reduce((acc, c) => acc + c.renta, 0) + items.reduce((acc, c) => acc + c.bonificacion, 0);

                      // Group by articulo within this period
                      const byArticulo = items.reduce((acc, cara) => {
                        const artKey = cara.articulo.ItemCode;
                        if (!acc[artKey]) {
                          acc[artKey] = {
                            articulo: cara.articulo,
                            renta: 0,
                            bonificacion: 0,
                            precioTotal: 0,
                            items: []
                          };
                        }
                        acc[artKey].renta += cara.esBf ? 0 : cara.renta;
                        acc[artKey].bonificacion += cara.esBf ? cara.renta : cara.bonificacion;
                        acc[artKey].precioTotal += cara.precioTotal;
                        acc[artKey].items.push(cara);
                        return acc;
                      }, {} as Record<string, { articulo: any; renta: number; bonificacion: number; precioTotal: number; items: any[] }>);

                      return (
                        <div key={key} className={isDark ? 'bg-zinc-900/30' : 'bg-white'}>
                          {/* Period header */}
                          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{getPeriodLabel(key)}</span>
                              <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({Object.keys(byArticulo).length} artículos)</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{groupRenta} renta</span>
                              <span className="text-emerald-400">{groupBonif} bonif.</span>
                              <span className="text-amber-400 font-medium">{formatCurrency(groupTotal)}</span>
                            </div>
                          </div>
                          {/* Artículos dentro de esta catorcena */}
                          <div className="px-4 py-2 space-y-1">
                            {Object.entries(byArticulo).map(([artCode, data]) => (
                              <div key={artCode} className={`flex items-center justify-between py-1.5 px-3 ${isDark ? 'bg-zinc-800/20' : 'bg-gray-50'} rounded-lg`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-purple-400 font-medium">{data.articulo.ItemCode}</span>
                                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} truncate max-w-[200px]`}>{data.articulo.ItemName}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={isDark ? 'text-white' : 'text-gray-900'}>{data.renta} renta</span>
                                  <span className="text-emerald-400">{data.bonificacion} bonif.</span>
                                  <span className="text-amber-400">{formatCurrency(data.precioTotal)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Asignados */}
              <div className={`p-4 ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-xl border`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'} mb-3`}>Asignados</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAsignados.map(u => (
                    <span key={u.id} className={`px-3 py-1 ${isDark ? 'bg-zinc-700/50 text-white' : 'bg-gray-200 text-gray-700'} text-xs rounded-full`}>
                      {u.nombre}
                    </span>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                  <Upload className="h-4 w-4 text-purple-400" />
                  Archivo (opcional)
                </label>
                {archivo ? (
                  <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} border border-emerald-500/30 rounded-xl`}>
                    {tipoArchivo?.startsWith('image/') ? (
                      <img src={getFilePreviewUrl(archivo) || ''} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                    ) : (
                      <div className={`w-16 h-16 flex items-center justify-center ${isDark ? 'bg-zinc-700' : 'bg-gray-200'} rounded-lg`}>
                        <FileText className={`h-6 w-6 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-sm text-emerald-400 font-medium">Archivo cargado</div>
                      <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{tipoArchivo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setArchivo(null); setArchivoFile(null); setTipoArchivo(null); }}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className={`w-full px-4 py-3 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600`}
                  />
                )}
              </div>

              {/* IMU checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imu}
                  onChange={(e) => setImu(e.target.checked)}
                  className="checkbox-purple w-5 h-5"
                />
                <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>IMU (Impresión  IMU)</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'}`}>
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : handleAttemptClose()}
            className={`px-4 py-2 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-lg text-sm font-medium transition-colors`}
          >
            {step === 1 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 4 ? (
            (() => {
              const blockNext = enforceStepLock && !isStepComplete(step);
              const missingHint = step === 1
                ? 'Selecciona CUIC y al menos un asignado'
                : step === 2
                  ? 'Completa nombre, rango de fechas, descripcion y notas'
                  : step === 3
                    ? 'Agrega al menos un circuito'
                    : '';
              return (
                <button
                  type="button"
                  onClick={() => { if (!blockNext) setStep(step + 1); }}
                  disabled={blockNext}
                  title={blockNext ? missingHint : undefined}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:bg-purple-600/40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              );
            })()
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(isEditMode ? updateMutation.isPending : createMutation.isPending) || !selectedCuic || caras.length === 0 || selectedAsignados.length === 0 || invalidCaras.length > 0}
              className={`px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 ${isDark ? 'disabled:bg-zinc-700 disabled:text-zinc-500' : 'disabled:bg-gray-200 disabled:text-gray-400'} transition-colors flex items-center gap-2`}
              title={selectedAsignados.length === 0 ? 'Debes asignar al menos un usuario' : undefined}
            >
              {(isEditMode ? updateMutation.isPending : createMutation.isPending) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {isEditMode ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {isEditMode ? 'Guardar Cambios' : 'Crear Solicitud'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Confirmación de cierre con cambios sin guardar */}
      {/* Modal de confirmación de borrado masivo */}
      <DeleteCircuitoConfirmModal
        isOpen={bulkDeleteModal.isOpen}
        onClose={() => setBulkDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => bulkDeleteModal.onConfirm()}
        ubicacion=""
        articulo=""
        tieneReservas={false}
        tienePareja={bulkDeleteModal.tienePareja}
        count={bulkDeleteModal.count}
      />

      {showCloseConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCloseConfirm(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 rounded-full bg-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ¿Salir sin guardar?
                </h3>
                <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  {isEditMode
                    ? 'Tienes cambios sin guardar en esta solicitud. Si sales ahora, se perderán.'
                    : 'Tienes una solicitud en progreso sin guardar. Si sales ahora, se perderán los cambios.'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Regresar
              </button>
              <button
                type="button"
                onClick={() => { setShowCloseConfirm(false); if (!isEditMode) resetForm(); onClose(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-[70] animate-in slide-in-from-top fade-in duration-300 max-w-md">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
            toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
            'bg-amber-500/20 border-amber-500/50 text-amber-300'
          }`}>
            {toast.type === 'success' && <Check className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'error' && <X className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
