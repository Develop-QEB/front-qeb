import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useModalTracker } from '../../hooks/useModalTracker';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  X, Search, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Users,
  FileText, MapPin, Layers, Pencil, Map as MapIcon, Package, Calendar,
  Gift, Target, Save, ArrowLeft, Filter, Grid, LayoutGrid, Ruler, ArrowUpDown, ArrowUp, ArrowDown, Download, Eye, Funnel, Check, Upload, Monitor, Loader2, Trophy, AlertTriangle
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../../config/googleMaps';
import { AdvancedMapComponent } from '../propuestas/AdvancedMapComponent';
import { Campana, CampanaWithComments } from '../../types';
import { solicitudesService, UserOption } from '../../services/solicitudes.service';
import { inventariosService, InventarioDisponible } from '../../services/inventarios.service';
import { campanasService, ReservaModalItem } from '../../services/campanas.service';
import { clientesService } from '../../services/clientes.service';
import { formatCurrency } from '../../lib/utils';
import { monthLabelLong, monthLabelShort, dayMonthShort } from '../../lib/periodos';
import { parseCircuitoDigital } from '../../lib/circuitos';
import { circuitosService } from '../../services/circuitos.service';
import { useEnvironmentStore, getEndpoints } from '../../store/environmentStore';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../lib/permissions';
import { filterAllowedArticulos } from '../../config/allowedDigitalArticles';
import { useSocketEquipos, useSocketCampana, useSocketInventarioRealtime, type InventarioRealtimePayload } from '../../hooks/useSocket';
import { useThemeStore } from '../../store/themeStore';

// GOOGLE_MAPS_API_KEY / LIBRARIES centralizados en src/config/googleMaps.ts
// (evita que la API de Google Maps se cargue dos veces y trabe la pantalla).

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
  campana: Campana | null;
}

interface CaraItem {
  localId: string;
  id?: number;
  ciudad: string;
  estados: string;
  plaza?: string;
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
  // RT/BF grouping: pair an RT (renta) cara with a BF (bonificación) cara
  grupo_rt_bf?: number | null;
  grupo_masivo_id?: number | null;
  esBf?: boolean; // true if this cara is the BF row of an RT/BF pair
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

// Detectar si un artículo no requiere inventario (impresión o ejecución especial)
const isNoInventoryArticle = (itemCode: string, itemName?: string): boolean => {
  return isImpresionArticle(itemCode, itemName) || isEspecialArticle(itemCode, itemName);
};

// "Gestion QTO" — artículos para Querétaro/Celaya (sufijo `-QR`, ej. `RT-P1-COB-QR`).
// Comportamiento: la reserva de inventario es OPCIONAL — pase a ventas funciona
// con o sin reservas y la cara se ve siempre "completa" (verde). La UI de reservar
// sigue ACTIVA (a diferencia de IM/ESP que la bloquean) — el usuario puede
// reservar si quiere, pero no es requisito.
const isQuretaroArticle = (itemCode: string): boolean => {
  return (itemCode || '').toUpperCase().endsWith('-QR');
};

// Artículos que son 100% bonificación (BF/CF/CT). El KPI de bonificación
// se divide en 2 (Flujo / Contraflujo) sin tocar BD; reservas siguen como tipo='Bonificacion'.
// NOTA: IN (Intercambio) NO entra aquí — en todo el flujo (caras, KPIs, autorización,
// SAP) se cuenta como Renta con tarifa flexible, no como bonificación.
const isBonifSplitArticle = (articulo?: string | null): boolean => {
  const a = (articulo || '').toUpperCase();
  return a.startsWith('BF') || a.startsWith('CF') || a.startsWith('CT');
};

// Tarifas from SAP (U_IMU_PublicPrice = tarifa publica, PriceList 11 = tarifa piso)

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

// Code-based fallback maps for short article codes
const CODE_FORMATO_MAP: Record<string, string> = {
  pb: 'PARABUS', cl: 'COLUMNA', bol: 'BOLERO', kco: 'Kiosco',
};
const CODE_PLAZA_MAP: Record<string, { estado: string; ciudad: string }> = {
  mx:  { estado: 'Ciudad de México / AM', ciudad: '' },
  mty: { estado: 'Nuevo León', ciudad: 'Monterrey,Guadalupe,San Nicolás de los Garza,Santa Catarina' },
  gd:  { estado: 'Jalisco', ciudad: 'Guadalajara,Zapopan,Tlaquepaque' },
  gdl: { estado: 'Jalisco', ciudad: 'Guadalajara,Zapopan,Tlaquepaque' },
  ver: { estado: 'Veracruz', ciudad: 'Veracruz,Alvarado,Boca del Río' },
  pv:  { estado: 'Jalisco', ciudad: 'Puerto Vallarta' },
  tl:  { estado: 'Estado de México', ciudad: 'Toluca' },
  mr:  { estado: 'Yucatán', ciudad: 'Mérida' },
  mer: { estado: 'Yucatán', ciudad: 'Mérida' },
};

// Quita acentos para comparar plazas/ciudades sin que falle por "MÉRIDA" vs "MERIDA",
// "LEÓN" vs "LEON", etc. (las plazas en `inventarios.plaza` traen acentos pero los
// nombres en ItemName de SAP suelen venir sin acentos, y viceversa).
const stripAccents = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Formato auto-detection from article name + optional code fallback
const getFormatoFromArticulo = (itemName: string, itemCode?: string): string => {
  if (!itemName) return '';
  const name = itemName.toUpperCase();

  // Bajo Puente / Tunel - el backend solo tiene 'BAJO PUENTE' como mueble
  if (name.includes('BAJO PUENTE') || name.includes('TUNEL')) return 'BAJO PUENTE';

  // MI MACRO - sub-tipos mapeados a muebles válidos del backend
  if (name.includes('MI MACRO')) {
    const codeUp = (itemCode || '').toUpperCase();
    if (name.includes('VIDRIO INTERIOR') || codeUp.endsWith('-VI')) return 'VIDRIO INTERIOR';
    if (name.includes('VIDRIO EXTERIOR') || codeUp.endsWith('-VE')) return 'VIDRIOS EXTERIOR';
    if (codeUp.endsWith('-PBMUP') || (name.includes('PARABUS') && name.includes('MUPI'))) return 'PARABUS CON MUPI';
    if (name.includes('MUPI') || codeUp.endsWith('-MP')) return 'MUPIS';
    if (name.includes('PARABUS') || codeUp.endsWith('-PB')) return 'PARABUS';
    if (name.includes('MODULO A') || codeUp.endsWith('-MA')) return 'MODULO TIPO A';
    if (name.includes('MODULO B') || codeUp.endsWith('-MB')) return 'MODULO TIPO B';
    if (name.includes('MODULO C') || codeUp.endsWith('-MC')) return 'MODULO TIPO C';
    if (name.includes('MODULO D') || codeUp.endsWith('-MD')) return 'MODULO TIPO D';
  }

  if (name.includes('PUENTE PEATONAL')) return 'PUENTE PEATONAL';
  if (name.includes('KIOSCO') || name.includes('KIOSKO')) return 'KIOSCO';
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

// Tipo auto-detection from article name
const getTipoFromName = (itemName: string): 'Tradicional' | 'Digital' => {
  if (!itemName) return 'Tradicional';
  const name = itemName.toUpperCase();
  if (name.includes('DIGITAL') || name.includes('DIG')) return 'Digital';
  return 'Tradicional';
};

// Get tarifa publica from SAP article
const getTarifaPublicaFromArticulo = (articulo: SAPArticulo): number => {
  if (!articulo) return 0;
  return articulo.U_IMU_PublicPrice || 0;
};

// Get tarifa piso from PriceList 11
const getTarifaPisoFromArticulo = (articulo: SAPArticulo): number => {
  if (!articulo?.ItemPrices) return 0;
  const pl11 = articulo.ItemPrices.find(p => p.PriceList === 11);
  return pl11?.Price || 0;
};

// Multi-city auto-fill rules for specific article patterns
// Order matters: more specific patterns BEFORE generic ones
const MULTI_CITY_RULES: { pattern: RegExp; estado: string; ciudad: string }[] = [
  { pattern: /\bPUERTO VALLARTA\b|\bPV\b/, estado: 'Jalisco', ciudad: 'Puerto Vallarta' },
  { pattern: /\bGD\b|\bGUADALAJARA\b|\bGDL\b/, estado: 'Jalisco', ciudad: 'GUADALAJARA,ZAPOPAN,SAN PEDRO TLAQUEPAQUE' },
  { pattern: /\bMTY\b|\bMONTERREY\b/, estado: 'Nuevo León', ciudad: 'MONTERREY,GUADALUPE,SAN NICOLÁS DE LOS GARZA,SANTA CATARINA' },
  { pattern: /\bBOCA DEL RIO\b/, estado: 'Veracruz', ciudad: 'BOCA DEL RIO' },
  { pattern: /\bVERACRUZ\b|\bVER\b/, estado: 'Veracruz', ciudad: 'VERACRUZ,ALVARADO,BOCA DEL RIO' },
  { pattern: /\bCHOLULA\b/, estado: 'Puebla', ciudad: 'SAN ANDRES CHOLULA,SAN PEDRO CHOLULA' },
  { pattern: /\bPUEBLA\b|\bPB\b/, estado: 'Puebla', ciudad: 'PUEBLA,SAN ANDRES CHOLULA,SAN PEDRO CHOLULA' },
  { pattern: /\bMERIDA\b|\bMR\b/, estado: 'Yucatán', ciudad: 'MÉRIDA' },
  { pattern: /\bLEON\b|\bLEN\b/, estado: 'Guanajuato', ciudad: 'LEÓN' },
  { pattern: /\bSALAMANCA\b/, estado: 'Guanajuato', ciudad: 'SALAMANCA' },
  { pattern: /\bCELAYA\b/, estado: 'Guanajuato', ciudad: 'CELAYA' },
  { pattern: /\bIRAPUATO\b/, estado: 'Guanajuato', ciudad: 'IRAPUATO' },
  { pattern: /\bGUANAJUATO\b|\bGTO\b/, estado: 'Guanajuato', ciudad: '' },
  { pattern: /\bOAXACA\b|\bOAX\b/, estado: 'Oaxaca de Juárez', ciudad: 'OAXACA DE JUÁREZ' },
  { pattern: /\bAGS\b|\bAGUASCALIENTES\b/, estado: 'Aguascalientes', ciudad: 'AGUASCALIENTES' },
  { pattern: /\bCULIACAN\b/, estado: 'Sinaloa', ciudad: 'CULIACÁN' },
  { pattern: /\bMAZATLAN\b|\bMZ\b/, estado: 'Sinaloa', ciudad: 'MAZATLÁN' },
  { pattern: /\bSLP\b|\bSAN LUIS POTOSI\b/, estado: 'San Luis Potosí', ciudad: 'SAN LUIS POTOSÍ' },
  { pattern: /\bTIJUANA\b|\bTJ\b/, estado: 'Baja California', ciudad: 'TIJUANA' },
  { pattern: /\bACAPULCO\b|\bAC\b/, estado: 'Guerrero', ciudad: 'ACAPULCO DE JUÁREZ' },
  { pattern: /\bPACHUCA\b|\bPH\b/, estado: 'Hidalgo', ciudad: 'PACHUCA DE SOTO' },
  { pattern: /\bTOLUCA\b|\bTL\b/, estado: 'Estado de México', ciudad: 'TOLUCA,METEPEC,LERMA,SAN MATEO ATENCO' },
  { pattern: /\bCUERNAVACA\b|\bCV\b/, estado: 'Morelos', ciudad: 'CUERNAVACA' },
  { pattern: /\bTAMPICO\b|\bTM\b/, estado: 'Tamaulipas', ciudad: 'TAMPICO' },
  { pattern: /\bTORREON\b|\bTR\b/, estado: 'Coahuila', ciudad: 'TORREON' },
  { pattern: /\bQUERETARO\b|\bQR\b/, estado: 'Querétaro', ciudad: 'QUERÉTARO' },
  { pattern: /\bTUXTLA\b|\bTG\b/, estado: 'Chiapas', ciudad: 'TUXTLA GUTIERREZ' },
  { pattern: /\bTABASCO\b|\bVILLAHERMOSA\b|\bTB\b/, estado: 'Tabasco', ciudad: 'VILLAHERMOSA' },
  { pattern: /\bMORELIA\b/, estado: 'Michoacán', ciudad: 'MORELIA' },
  { pattern: /\bCANCUN\b/, estado: 'Quintana Roo', ciudad: 'BENITO JUÁREZ' },
  { pattern: /\bCDMX\b|\bCIUDAD DE MEXICO\b|\bDF\b|\bMEXICO\b(?!\s*(Y\s*AM|WI-?FI))|\bMX\b/, estado: 'Ciudad de México / AM', ciudad: '' },
  { pattern: /\bNAUC\w*|\bNAUCALPAN\b/, estado: 'Estado de México', ciudad: 'NAUCALPAN' },
  { pattern: /\bEM\b/, estado: 'Estado de México', ciudad: '' },
];

// Extract city/state from article name (sorted by length to avoid false positives) + optional code fallback
const getCiudadEstadoFromArticulo = (itemName: string, itemCode?: string): { estado: string; ciudad: string } | null => {
  if (!itemName) return null;
  // Sin acentos: las reglas regex usan "MERIDA"/"LEON"/etc. sin tilde, pero los
  // ItemName de SAP pueden traer "MÉRIDA"/"LEÓN". Normalizamos para que matcheen.
  const name = stripAccents(itemName.toUpperCase());

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
  if (itemCode) {
    for (const seg of itemCode.toLowerCase().split('-')) {
      if (CODE_PLAZA_MAP[seg]) return CODE_PLAZA_MAP[seg];
    }
  }
  return null;
};

interface ReservaItem {
  id: string;
  inventario_id: number;
  codigo_unico: string;
  tipo: 'Flujo' | 'Contraflujo' | 'Bonificacion';
  tipoCaraFisica?: 'Flujo' | 'Contraflujo'; // Dirección física del inventario (para split bonif. en BF/CT/IN)
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
  aps?: number | null; // APS asignado (si > 0, no se puede editar)
  articulo?: string; // Artículo SAP de la cara
  grupo?: string; // Distance group name
  estatus_inventario?: string | null;
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

// Campos para filtrar inventario disponible (tabla "Buscar Disponibles")
const FILTER_FIELDS_DISPONIBLES: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Código', type: 'string' },
  { field: 'tipo_de_cara', label: 'Cara', type: 'string' },
  { field: 'mueble', label: 'Mueble', type: 'string' },
  { field: 'plaza', label: 'Plaza', type: 'string' },
  { field: 'isla', label: 'Isla', type: 'string' },
  { field: 'mueble_isla', label: 'M. Isla', type: 'string' },
  { field: 'sentido', label: 'Sentido', type: 'string' },
  { field: 'nivel_socioeconomico', label: 'NSE', type: 'string' },
  { field: 'ubicacion', label: 'Ubicación', type: 'string' },
  { field: 'tradicional_digital', label: 'Tipo', type: 'string' },
  { field: 'mundialista', label: 'Mundialista', type: 'string' },
];

// Tipo extendido con conector Y/O entre filtros
interface AdvancedFilterCondition extends FilterCondition {
  connector?: 'Y' | 'O';
}

function evalAdvancedCondition<T extends Record<string, unknown>>(item: T, filter: AdvancedFilterCondition): boolean {
  const fieldValue = item[filter.field];
  const filterValue = filter.value;
  if (!filterValue) return true;
  if (fieldValue === null || fieldValue === undefined) {
    return filter.operator === '!=' || filter.operator === 'not_contains';
  }
  const strValue = String(fieldValue).toLowerCase();
  const strFilterValue = filterValue.toLowerCase();
  switch (filter.operator) {
    case '=': return strValue === strFilterValue;
    case '!=': return strValue !== strFilterValue;
    case 'contains': return strValue.includes(strFilterValue);
    case 'not_contains': return !strValue.includes(strFilterValue);
    case '>': return Number(fieldValue) > Number(filterValue);
    case '<': return Number(fieldValue) < Number(filterValue);
    case '>=': return Number(fieldValue) >= Number(filterValue);
    case '<=': return Number(fieldValue) <= Number(filterValue);
    default: return true;
  }
}

function applyAdvancedFilters<T extends Record<string, unknown>>(data: T[], filters: AdvancedFilterCondition[]): T[] {
  if (filters.length === 0) return data;
  return data.filter(item => {
    let result = evalAdvancedCondition(item, filters[0]);
    for (let i = 1; i < filters.length; i++) {
      const val = evalAdvancedCondition(item, filters[i]);
      const connector = filters[i].connector || 'Y';
      if (connector === 'O') result = result || val;
      else result = result && val;
    }
    return result;
  });
}

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
          {loading && !value ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </span>
          ) : value && renderSelected ? renderSelected(value) : (displayValue || label)}
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
                <div className="px-3 py-6 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  <span className="text-sm text-zinc-500">Cargando artículos...</span>
                </div>
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

// LIBRARIES movido a src/config/googleMaps.ts (GOOGLE_MAPS_LIBRARIES).

const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function AssignInventarioCampanaModal({ isOpen, onClose, campana }: Props) {
  useModalTracker('Editar Campaña', isOpen);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = usePermissions(user?.rol);
  // tipoPeriodo: arranca con el del prop (campañas list a veces lo trae) y se
  // sincroniza con el detail endpoint cuando carga, que es la fuente de verdad.
  // Crítico para que la regla "mensual = solo Flujo" se aplique al teclear caras.
  // Tipo string (no literal union) para evitar narrowing dentro de ramas JSX que
  // hacen el `tipoPeriodo === 'mensual'` "no overlap" después de un check previo.
  const [tipoPeriodo, setTipoPeriodo] = useState<string>(
    (campana as any)?.tipo_periodo === 'mensual' ? 'mensual' : 'catorcena'
  );

  // Socket para actualizar usuarios en tiempo real
  useSocketEquipos();
  // Socket para escuchar cambios en la campaña (autorizaciones, reservas, etc.)
  useSocketCampana(campana?.id || null);

  const effectiveCanEdit = permissions.canAsignarInventario;
  const canEditResumen = permissions.canEditResumenPropuesta;
  const canEditCliente = permissions.canEditClienteEnFormularios;

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

  const mapRef = useRef<google.maps.Map | null>(null);
  const reservadosMapRef = useRef<google.maps.Map | null>(null);
  const resumenReservasMapRef = useRef<google.maps.Map | null>(null);

  // Load Google Maps con la configuracion UNICA compartida (mismo id/key/libraries
  // en toda la app) para que el script se inyecte una sola vez.
  const { isLoaded: mapsLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);

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
  const [archivoCampana, setArchivoCampana] = useState<string | null>(null);
  const [tipoArchivoCampana, setTipoArchivoCampana] = useState<string | null>(null);
  const [imu, setImu] = useState(false);

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
  const [isUpdatingCampana, setIsUpdatingCampana] = useState(false);

  // Caras state
  const [caras, setCaras] = useState<CaraItem[]>([]);
  const [expandedCaras, setExpandedCaras] = useState<Set<string>>(new Set());
  const [expandedCatorcenas, setExpandedCatorcenas] = useState<Set<string>>(new Set());
  const [editingCaraId, setEditingCaraId] = useState<string | null>(null);
  // Track locally modified caras (caraDbId -> CaraUpdateData) for bulk save
  const [modifiedCaras, setModifiedCaras] = useState<Map<number, Record<string, unknown>>>(new Map());
  const initialValuesSetRef = useRef(false);

  // New cara form
  const [newCara, setNewCara] = useState<Omit<CaraItem, 'localId'>>(EMPTY_CARA);
  const [tarifaPublicaInput, setTarifaPublicaInput] = useState<string>('');
  const [tarifaPublicaFocused, setTarifaPublicaFocused] = useState(false);
  const [selectedArticulo, setSelectedArticulo] = useState<SAPArticulo | null>(null);
  // RT/BF pairing: articulo BF (bonificación) paired with the RT primary articulo
  const [articuloBf, setArticuloBf] = useState<SAPArticulo | null>(null);
  const [showAddCaraForm, setShowAddCaraForm] = useState(false);
  const [modoMasivoC, setModoMasivoC] = useState(false);
  const caraFormRef = useRef<HTMLDivElement>(null);
  const caraTableRef = useRef<HTMLDivElement>(null);

  // Reservas state
  const [reservas, setReservas] = useState<ReservaItem[]>([]);

  // Track APS posted to SAP
  // postedAPSGroups and editingCaraHasReservas moved after campanaDetails declaration

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
  const [flujoPct, setFlujoPct] = useState(50);
  const [savingPct, setSavingPct] = useState(false);
  const [flujoFilter, setFlujoFilter] = useState<'Todos' | 'Flujo' | 'Contraflujo'>(tipoPeriodo === 'mensual' ? 'Flujo' : 'Todos');
  const [islaFilter, setIslaFilter] = useState<'off' | 'si' | 'no'>('off');
  const [mundialistaFilter, setMundialistaFilter] = useState<'off' | 'si' | 'no'>('off');
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

  // Real-time: cuando OTRO usuario reserva un espacio cuyo período se solapa
  // con la cara que estoy buscando, lo quito de mi listado en vivo.
  useSocketInventarioRealtime(
    (payload: InventarioRealtimePayload) => {
      if (!selectedCaraForSearch) return;
      const ini = selectedCaraForSearch.inicio_periodo;
      const fin = selectedCaraForSearch.fin_periodo;
      if (!ini || !fin || !payload.fechaInicio || !payload.fechaFin) return;
      const overlap = new Date(payload.fechaInicio) <= new Date(fin) && new Date(payload.fechaFin) >= new Date(ini);
      if (!overlap) return;
      setInventarioDisponible(prev =>
        prev.filter(inv =>
          inv.espacio_id !== payload.espacioId &&
          (payload.inventarioId == null || inv.id !== payload.inventarioId)
        )
      );
    },
    () => {
      // LIBERADO: no agregamos directo (requeriría refetch que conoce filtros).
    },
  );
  // Reserva Masiva: toggle (solo aparece cuando la cara tiene grupo_masivo_id)
  const [reservaMasivaC, setReservaMasivaC] = useState<boolean>(false);
  // Exclusión por categoría de cliente: oculta inventario disponible cerca de
  // piezas reservadas por clientes de la categoría seleccionada.
  const [excluirCategoria, setExcluirCategoria] = useState<string>('');
  const [excluirDistanciaKm, setExcluirDistanciaKm] = useState<number>(1);
  // Eliminar Reservas Masivo: replica el delete a las reservas equivalentes
  // (mismo codigo_unico) en otras caras del mismo grupo_masivo_id
  const [eliminarMasivoC, setEliminarMasivoC] = useState<boolean>(false);
  const [loadingCaraAction, setLoadingCaraAction] = useState<{ caraId: string; action: 'edit' | 'search' } | null>(null);

  // Filtros avanzados (embudo) para tabla Buscar Disponibles
  const [disponiblesAdvFilters, setDisponiblesAdvFilters] = useState<AdvancedFilterCondition[]>([]);
  const [showDisponiblesAdvFilters, setShowDisponiblesAdvFilters] = useState(false);

  // POI filter state
  const [poiFilterIds, setPoiFilterIds] = useState<Set<number> | null>(null);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{
    codigo_unico: string;
    estado: 'libre' | 'ya_reservado_para_cara' | 'ocupado' | 'no_existe';
    mensaje: string;
  }[]>([]);
  const [showCsvSection, setShowCsvSection] = useState(false);
  const [isCheckingCsv, setIsCheckingCsv] = useState(false);
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

  // Fetch campaign details
  const { data: campanaDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['campana-details', campana?.id],
    queryFn: () => campanasService.getById(campana!.id),
    enabled: isOpen && !!campana?.id,
  });

  // Fetch caras for campaign
  const { data: carasData, isLoading: carasLoading } = useQuery({
    queryKey: ['campana-caras', campana?.id],
    queryFn: () => campanasService.getCaras(campana!.id),
    enabled: isOpen && !!campana?.id,
  });

  // Track APS posted to SAP
  const postedAPSGroups = useMemo(() => {
    const posted = new Set<number>();
    try {
      const postedAps = (campanaDetails as any)?.posted_aps;
      if (Array.isArray(postedAps)) {
        postedAps.forEach((a: number) => posted.add(a));
      }
    } catch { /* ignore */ }
    return posted;
  }, [campanaDetails]);

  // Check if the cara being edited should be blocked
  // Block if: has APS posted to SAP, OR has any reservas with APS assigned (migrated campaigns)
  const editingCaraHasReservas = useMemo(() => {
    if (!editingCaraId) return false;
    const editingCara = caras.find(c => c.localId === editingCaraId);
    if (!editingCara) return false;
    const caraReservas = reservas.filter(r =>
      r.id.startsWith(editingCaraId) || r.solicitudCaraId === editingCara.id
    );
    if (caraReservas.length === 0) return false;
    // If posted_aps exists, use it; otherwise block if cara has any APS
    if (postedAPSGroups.size > 0) {
      const caraAPS = new Set(caraReservas.map(r => r.aps).filter(Boolean));
      return [...caraAPS].some(aps => postedAPSGroups.has(aps as number));
    }
    // For migrated campaigns (no posted_aps): block if has any reservas with APS
    const hasAPS = caraReservas.some(r => r.aps && r.aps > 0);
    return hasAPS;
  }, [editingCaraId, caras, reservas, postedAPSGroups]);

  // Check if the selected cara for search/reservas view is APS blocked
  const selectedCaraAPSBlocked = useMemo(() => {
    if (!selectedCaraForSearch) return false;
    const caraReservas = reservas.filter(r =>
      r.id.startsWith(selectedCaraForSearch.localId) || r.solicitudCaraId === selectedCaraForSearch.id
    );
    if (caraReservas.length === 0) return false;
    if (postedAPSGroups.size > 0) {
      return caraReservas.some(r => r.aps && postedAPSGroups.has(r.aps as number));
    }
    return caraReservas.some(r => r.aps && r.aps > 0);
  }, [selectedCaraForSearch, reservas, postedAPSGroups]);

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users', 'all'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
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
    queryKey: ['campana-reservas-modal', campana!.id],
    queryFn: () => campanasService.getReservasForModal(campana!.id),
    enabled: isOpen && !!campana!.id,
    refetchOnMount: 'always',
  });

  // Load existing reservas into state when data arrives
  useEffect(() => {
    if (existingReservas && existingReservas.length > 0 && caras.length > 0) {
      const loadedReservas: ReservaItem[] = existingReservas.map((r: ReservaModalItem) => {
        // Find the cara that matches this reserva
        const matchingCara = caras.find(c => c.id === r.solicitud_cara_id);
        // Mensual = todo cuenta como Flujo (regla Gran Formato), aunque el inventario
        // físico sea Contraflujo (caso de circuitos digitales).
        const tipo = r.estatus === 'Bonificado'
          ? 'Bonificacion'
          : (tipoPeriodo === 'mensual' ? 'Flujo' : (String(r.tipo_de_cara).startsWith('Flujo') ? 'Flujo' : 'Contraflujo'));

        return {
          id: matchingCara
            ? `${matchingCara.localId}-${r.inventario_id}-${tipo.toLowerCase()}-${r.reserva_id}`
            : `existing-${r.reserva_id}-${r.inventario_id}-${tipo.toLowerCase()}-${Date.now()}`,
          inventario_id: r.inventario_id,
          codigo_unico: r.codigo_unico || `INV-${r.inventario_id}`,
          tipo: tipo as 'Flujo' | 'Contraflujo' | 'Bonificacion',
          tipoCaraFisica: String(r.tipo_de_cara).startsWith('Flujo') ? 'Flujo' : 'Contraflujo',
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
          aps: r.aps,
          articulo: matchingCara?.articulo || r.articulo || '',
          estatus_inventario: r.estatus_inventario,
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

  // Categorías de cliente — solo las que tienen reservas activas.
  const { data: categoriasCliente } = useQuery({
    queryKey: ['categorias-cliente'],
    queryFn: () => inventariosService.getCategoriasCliente(),
    enabled: isOpen && viewState === 'search-inventory',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch CUIC data for client editing
  const { data: cuicData, isLoading: cuicLoading } = useQuery({
    queryKey: ['clientes-full-for-campana'],
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

  // Initialize form from campaign details
  useEffect(() => {
    if (campanaDetails && isOpen) {
      // Set campaign name
      const campaniaNombre = campanaDetails.nombre || campanaDetails.nombre_campania || '';
      setNombreCampania(campaniaNombre);

      // Set notes and description
      const notasVal = campanaDetails.notas || '';
      const descripcionVal = campanaDetails.descripcion || '';
      setNotas(notasVal);
      setDescripcion(descripcionVal);

      // Set IMU flag from solicitud (included in campanaDetails response)
      const imuVal = Boolean((campanaDetails as any).IMU);
      setImu(imuVal);

      // Archivo: viene de propuesta.archivo (subido en el modal de propuestas) o
      // solicitud.archivo como fallback. tipo_archivo solo existe en solicitud.
      const archivoVal = (campanaDetails as any).archivo || null;
      const tipoArchivoVal = (campanaDetails as any).tipo_archivo || null;
      setArchivoCampana(archivoVal);
      setTipoArchivoCampana(tipoArchivoVal);

      // Sincronizar tipoPeriodo con el detail (fuente de verdad).
      const tpDetail = (campanaDetails as any).tipo_periodo;
      if (tpDetail === 'mensual' || tpDetail === 'catorcena') {
        setTipoPeriodo(tpDetail);
      }

      // Set period from campaign data
      // Para mensual: derivar mes desde fecha_inicio/fecha_fin (parseando YYYY-MM directo
      // del string para evitar timezone shift en MX UTC-6).
      // Para catorcena: usar catorcena_inicio_num/fin_num del backend.
      let yInicio: number | undefined;
      let cInicio: number | undefined;
      let yFin: number | undefined;
      let cFin: number | undefined;

      if (tipoPeriodo === 'mensual') {
        const parseYM = (val: any): { year: number; month: number } | null => {
          if (!val) return null;
          const m = String(val).match(/^(\d{4})-(\d{2})/);
          if (!m) return null;
          return { year: parseInt(m[1]), month: parseInt(m[2]) };
        };
        const ymIni = parseYM((campanaDetails as any).fecha_inicio);
        const ymFin = parseYM((campanaDetails as any).fecha_fin);
        if (ymIni) { yInicio = ymIni.year; cInicio = ymIni.month; }
        if (ymFin) { yFin = ymFin.year; cFin = ymFin.month; }
      } else {
        yInicio = campanaDetails.catorcena_inicio_anio ?? undefined;
        cInicio = campanaDetails.catorcena_inicio_num ?? undefined;
        yFin = campanaDetails.catorcena_fin_anio ?? undefined;
        cFin = campanaDetails.catorcena_fin_num ?? undefined;
      }

      if (yInicio) setYearInicio(yInicio);
      if (cInicio) setCatorcenaInicio(cInicio);
      if (yFin) setYearFin(yFin);
      if (cFin) setCatorcenaFin(cFin);

      // Initialize asignados from campaign data
      const loadedAsignados: UserOption[] = [];
      // Try to load from T0_U_IDAsesor (single asesor)
      if (campanaDetails.T0_U_IDAsesor && users) {
        const foundUser = users.find((u: UserOption) => u.id === campanaDetails.T0_U_IDAsesor);
        if (foundUser) {
          loadedAsignados.push(foundUser);
        }
      }
      // Also try id_asignado (could be comma-separated)
      if (campanaDetails.id_asignado && users) {
        const ids = campanaDetails.id_asignado.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        ids.forEach((id: number) => {
          if (!loadedAsignados.find(u => u.id === id)) {
            const foundUser = users.find((u: UserOption) => u.id === id);
            if (foundUser) {
              loadedAsignados.push(foundUser);
            }
          }
        });
      }
      setAsignados(loadedAsignados);

      // Reset client editing state on load
      setSelectedClienteCuic(null);
      setClienteChanged(false);
      setClienteSearchTerm('');
      setShowClienteDropdown(false);

      // Store initial values for change detection — only on first load
      if (!initialValuesSetRef.current) {
        const asignadosIdsStr = loadedAsignados.map(u => u.id).join(',');
        setInitialValues({
          nombreCampania: campaniaNombre,
          notas: notasVal,
          descripcion: descripcionVal,
          yearInicio: yInicio ?? undefined,
          yearFin: yFin ?? undefined,
          catorcenaInicio: cInicio ?? undefined,
          catorcenaFin: cFin ?? undefined,
          asignadosIds: asignadosIdsStr,
          imu: imuVal,
        });
        initialValuesSetRef.current = true;
      }
    }
  }, [campanaDetails, isOpen, users]);

  // Initialize caras from API
  useEffect(() => {
    if (carasData && isOpen) {
      const carasWithIds: CaraItem[] = carasData.map((cara: any, idx: number) => {
        // Calculate catorcena/mes from inicio_periodo según tipo_periodo
        let catorcenaInicioCara: number | undefined;
        let anioInicioCara: number | undefined;
        if (cara.inicio_periodo) {
          if (tipoPeriodo === 'mensual') {
            const raw = cara.inicio_periodo as unknown;
            const s = raw instanceof Date ? raw.toISOString() : String(raw);
            const parts = s.split(/[-T]/);
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
              catorcenaInicioCara = m;
              anioInicioCara = y;
            }
          } else if (catorcenasData?.data) {
            const inicioPeriodoDate = new Date(cara.inicio_periodo);
            const catInicio = catorcenasData.data.find((c: any) => {
              const cInicioDate = new Date(c.fecha_inicio);
              const cFinDate = new Date(c.fecha_fin);
              return inicioPeriodoDate >= cInicioDate && inicioPeriodoDate <= cFinDate;
            });
            if (catInicio) {
              catorcenaInicioCara = catInicio.numero_catorcena;
              anioInicioCara = catInicio.a_o;
            }
          }
        }

        const articuloCode = (cara.articulo || '').toUpperCase();
        const grupoRtBf = cara.grupo_rt_bf ? Number(cara.grupo_rt_bf) : null;
        // Mark as BF row if articulo starts with BF/CF AND cara belongs to an RT/BF group
        const esBf = !!grupoRtBf && (articuloCode.startsWith('BF') || articuloCode.startsWith('CF'));
        // Si es circuito, plaza se deriva del ItemCode (ej. RT-DIG-03-MX → "Ciudad de México / AM")
        const circuitoLoad = parseCircuitoDigital(cara.articulo || '');
        const plazaDerivada = circuitoLoad ? circuitoLoad.plazaLabel : '';

        return {
          localId: `cara-${cara.id || idx}-${Date.now()}`,
          id: cara.id,
          ciudad: cara.ciudad || '',
          estados: cara.estados || '',
          plaza: plazaDerivada,
          tipo: cara.tipo || '',
          flujo: cara.flujo || '',
          bonificacion: Number(cara.bonificacion) || 0,
          caras: Number(cara.caras) || 0,
          nivel_socioeconomico: cara.nivel_socioeconomico || '',
          formato: cara.formato || '',
          costo: Number(cara.costo) || 0,
          tarifa_publica: (Number(cara.caras) || 0) > 0
            ? (Number(cara.costo) || 0) / (Number(cara.caras) || 1)
            : Number(cara.tarifa_publica) || 0,
          // Truncar a YYYY-MM-DD para que <input type="date"> autocomplete al editar
          inicio_periodo: String(cara.inicio_periodo || '').slice(0, 10),
          fin_periodo: String(cara.fin_periodo || '').slice(0, 10),
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
          grupo_rt_bf: grupoRtBf,
          grupo_masivo_id: (cara as any).grupo_masivo_id != null ? Number((cara as any).grupo_masivo_id) : null,
          esBf,
        };
      });
      setCaras(carasWithIds);
    }
  }, [carasData, isOpen, catorcenasData, tipoPeriodo]);

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
      setArticuloBf(null);
      setModifiedCaras(new Map());
      initialValuesSetRef.current = false;
    }
  }, [isOpen]);

  // Collapse all catorcenas by default — user expands on demand (perf: avoids rendering 100+ caras at once)
  useEffect(() => {
    if (caras.length > 0) {
      setExpandedCatorcenas(new Set());
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

  // Handle update campaign
  const handleUpdateCampana = async () => {
    if (invalidCaras.length > 0) {
      alert(`No se puede actualizar: ${invalidCaras.length} cara(s) tienen catorcenas fuera del rango configurado. Elimínalas o ajusta el rango.`);
      return;
    }
    setIsUpdatingCampana(true);
    try {
      // Resolver cliente.id real desde CUIC + sap_database (SAPCuicItem solo trae CUIC).
      let resolvedClienteId: number | null = null;
      if (clienteChanged && selectedClienteCuic) {
        try {
          const resolved = await clientesService.resolveByCuic(selectedClienteCuic.CUIC, (selectedClienteCuic as any).sap_database || null);
          resolvedClienteId = resolved.id;
        } catch (err) {
          alert(`No se pudo resolver cliente para CUIC ${selectedClienteCuic.CUIC}`);
          setIsUpdatingCampana(false);
          return;
        }
      }
      const asignadosStr = asignados.map(u => u.nombre).join(', ');
      const asignadosIdsStr = asignados.map(u => u.id).join(',');
      await campanasService.update(campana!.id, {
        nombre: nombreCampania,
        notas,
        descripcion,
        catorcenaInicioNum: catorcenaInicio,
        catorcenaInicioAnio: yearInicio,
        catorcenaFinNum: catorcenaFin,
        catorcenaFinAnio: yearFin,
        asignados: asignadosStr,
        id_asignado: asignadosIdsStr,
        IMU: imu,
        ...(clienteChanged && selectedClienteCuic && resolvedClienteId ? {
          cliente_id: resolvedClienteId,
          cuic: selectedClienteCuic.CUIC,
          razon_social: selectedClienteCuic.T0_U_RazonSocial,
          marca_nombre: selectedClienteCuic.T2_U_Marca,
          asesor: selectedClienteCuic.ASESOR_U_Asesor,
          sap_database: selectedClienteCuic.sap_database,
        } : {}),
      });

      // Update initial values to current values
      const newAsignadosIds = asignados.map(u => u.id).join(',');
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

      queryClient.invalidateQueries({ queryKey: ['campana-details', campana?.id] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      alert('Campaña actualizada correctamente');
    } catch (error) {
      console.error('Error updating campaign:', error);
      alert('Error al actualizar campaña');
    } finally {
      setIsUpdatingCampana(false);
    }
  };

  // Handle archivo upload
  const archivoInputRef = useRef<HTMLInputElement>(null);
  const handleArchivoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // TODO: Implement archivo upload for campaigns if needed
      // const result = await campanasService.uploadArchivo(campana?.id, file);
      const result = { url: '' };
      setArchivoCampana(result.url);
      queryClient.invalidateQueries({ queryKey: ['campana-details', campana?.id] });
      alert('Archivo subido correctamente');
    } catch (error) {
      console.error('Error uploading archivo:', error);
      alert('Error al subir archivo');
    }
  };

  // Índices O(1) para evitar caras.find() y catorcenasData.data.find()
  // dentro de loops grandes (perf con muchas catorcenas).
  const carasByLocalId = useMemo(() => {
    const map = new Map<string, CaraItem>();
    caras.forEach(c => map.set(c.localId, c));
    return map;
  }, [caras]);

  const carasByDbId = useMemo(() => {
    const map = new Map<number, CaraItem>();
    caras.forEach(c => { if (c.id != null) map.set(c.id, c); });
    return map;
  }, [caras]);

  const catorcenasByYearNum = useMemo(() => {
    const map = new Map<string, { id: number; a_o: number; numero_catorcena: number; fecha_inicio: string; fecha_fin: string }>();
    catorcenasData?.data?.forEach((c: any) => map.set(`${c.a_o}-${c.numero_catorcena}`, c));
    return map;
  }, [catorcenasData]);

  const catorcenasByFechaInicio = useMemo(() => {
    const map = new Map<string, { numero_catorcena: number; a_o: number }>();
    catorcenasData?.data?.forEach((c: any) => map.set(String(c.fecha_inicio).slice(0, 10), c));
    return map;
  }, [catorcenasData]);

  // Calculate KPIs for caras (single pass — antes hacía 6 .filter sobre caras)
  const carasKPIs = useMemo(() => {
    let totalRenta = 0, totalImpresiones = 0, totalEspeciales = 0;
    let totalBonificacion = 0, totalCortesia = 0, totalInversion = 0;
    for (const c of caras) {
      const art = (c.articulo || '').toUpperCase();
      const caras_n = c.caras || 0;
      const bonif = c.bonificacion || 0;
      const noInv = isNoInventoryArticle(c.articulo || '');
      const esp = isEspecialArticle(c.articulo || '');
      const ct = art.startsWith('CT');
      const im = art.startsWith('IM');
      if (!noInv) totalRenta += caras_n;
      if (im) totalImpresiones += caras_n;
      if (esp) totalEspeciales += caras_n;
      if (!ct && !noInv) totalBonificacion += bonif;
      if (ct) totalCortesia += bonif;
      totalInversion += Number(c.costo) || 0;
    }
    return { totalRenta, totalImpresiones, totalEspeciales, totalBonificacion, totalCortesia, totalInversion };
  }, [caras]);

  // Pre-compute reservas indexed by cara for O(1) lookup instead of O(n) per cara.
  // Antes: O(reservas × caras). Ahora: O(reservas) via carasByDbId, con fallback
  // sólo para reservas locales sin solicitudCaraId (raro).
  const reservasByCara = useMemo(() => {
    const map = new Map<string, ReservaItem[]>();
    for (const r of reservas) {
      let cara: CaraItem | undefined;
      if (r.solicitudCaraId != null) cara = carasByDbId.get(r.solicitudCaraId);
      if (!cara) {
        for (const c of caras) {
          if (r.id.startsWith(c.localId)) { cara = c; break; }
        }
      }
      if (cara) {
        const arr = map.get(cara.localId);
        if (arr) arr.push(r); else map.set(cara.localId, [r]);
      }
    }
    return map;
  }, [reservas, caras, carasByDbId]);

  // Pre-compute RT pair map for O(1) lookup
  const rtPairMap = useMemo(() => {
    const map = new Map<string, CaraItem>();
    caras.forEach(cara => {
      if (cara.esBf && cara.grupo_rt_bf) {
        const rtPair = caras.find(c => !c.esBf && c.grupo_rt_bf === cara.grupo_rt_bf && c.inicio_periodo === cara.inicio_periodo && c.fin_periodo === cara.fin_periodo);
        if (rtPair) map.set(cara.localId, rtPair);
      }
    });
    return map;
  }, [caras]);

  // Índice por grupo_completo_id en una sola pasada (antes O(R²)).
  const reservasByGrupoCompleto = useMemo(() => {
    const map = new Map<number, ReservaItem[]>();
    for (const r of reservas) {
      if (r.grupo_completo_id != null) {
        const arr = map.get(r.grupo_completo_id);
        if (arr) arr.push(r); else map.set(r.grupo_completo_id, [r]);
      }
    }
    return map;
  }, [reservas]);

  // Merge all reservas by grupo_completo_id (for display) — O(R) usando el índice.
  const reservasMerged = useMemo(() => {
    const result: ReservaItem[] = [];
    const processedGrupos = new Set<number>();

    for (const r of reservas) {
      if (r.grupo_completo_id != null) {
        if (processedGrupos.has(r.grupo_completo_id)) continue;
        processedGrupos.add(r.grupo_completo_id);
        const groupReservas = reservasByGrupoCompleto.get(r.grupo_completo_id) || [];
        if (groupReservas.length >= 2) {
          const baseCode = r.codigo_unico?.replace(/_Flujo|_Contraflujo/gi, '') || '';
          result.push({
            ...r,
            id: `completo-${r.grupo_completo_id}`,
            codigo_unico: `${baseCode}_Completo`,
            tipo: 'Flujo' as const,
          });
        } else {
          result.push(r);
        }
      } else {
        result.push(r);
      }
    }

    return result;
  }, [reservas, reservasByGrupoCompleto]);

  // Calculate KPIs for reservas (including completo count) — single pass O(R)
  // usando reservasByGrupoCompleto y carasByDbId (antes O(R² + R×C)).
  const reservasKPIs = useMemo(() => {
    let flujo = 0, contraflujo = 0, bonificadas = 0;
    let dineroTotal = 0, digitales = 0;
    const seenGrupos = new Set<number>();
    let completos = 0;

    for (const r of reservas) {
      // Tipos
      if (r.tipo === 'Flujo') flujo++;
      else if (r.tipo === 'Contraflujo') contraflujo++;
      else if (r.tipo === 'Bonificacion') bonificadas++;

      // Completos (sin re-iterar reservas)
      if (r.grupo_completo_id != null && !seenGrupos.has(r.grupo_completo_id)) {
        seenGrupos.add(r.grupo_completo_id);
        const groupReservas = reservasByGrupoCompleto.get(r.grupo_completo_id);
        if (groupReservas && groupReservas.length >= 2) completos++;
      }

      // Dinero y digitales (O(1) lookup vía solicitudCaraId / fallback startsWith)
      let cara: CaraItem | undefined;
      if (r.solicitudCaraId != null) cara = carasByDbId.get(r.solicitudCaraId);
      if (!cara) {
        for (const c of caras) {
          if (r.id.startsWith(c.localId)) { cara = c; break; }
        }
      }
      if (cara) {
        if (r.tipo !== 'Bonificacion') dineroTotal += (cara.tarifa_publica || 0);
        if (cara.tipo?.toLowerCase().includes('digital')) digitales++;
      }
    }

    return {
      flujo,
      contraflujo,
      bonificadas,
      renta: flujo + contraflujo,
      total: reservas.length,
      dineroTotal,
      digitales,
      completos,
    };
  }, [reservas, caras, carasByDbId, reservasByGrupoCompleto]);

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

  // Grouping multi-nivel precomputado en una sola pasada (antes era recursivo en
  // cada render con O(N×L) y un .filter() de getTypeBreakdown por nodo). Esto
  // construye, en O(N×L):
  //   - grouped: el árbol que el JSX consume
  //   - flatBySubKey: items flat por path (groupKey, "groupKey-subKey", ...)
  //   - breakdownBySubKey: {flujo, contraflujo, bonificacion, total} por path
  type GroupedData = Record<string, ReservaItem[] | Record<string, ReservaItem[] | Record<string, ReservaItem[]>>>;
  const reservasGroupingData = useMemo(() => {
    const fields = activeGroupingsReservas;
    const grouped: GroupedData = {};
    const flatBySubKey = new Map<string, ReservaItem[]>();
    const breakdownBySubKey = new Map<string, { flujo: number; contraflujo: number; bonificacion: number; total: number }>();

    if (fields.length === 0) {
      return { grouped, groupKeys: [] as string[], flatBySubKey, breakdownBySubKey };
    }

    const getKey = (r: ReservaItem, field: GroupByFieldReservas): string => {
      switch (field) {
        case 'catorcena': return tipoPeriodo === 'mensual'
          ? `${MESES_LABEL[r.catorcena - 1] || `Mes ${r.catorcena}`} ${r.anio}`
          : `Cat ${r.catorcena}/${r.anio}`;
        case 'tipo': return r.tipo;
        case 'plaza': return r.plaza || 'Sin Plaza';
        case 'formato': return r.formato || 'Sin Formato';
        case 'grupo': return r.grupo_completo_id ? `Grupo ${r.grupo_completo_id}` : 'Sin Grupo';
        case 'articulo': return r.articulo || 'Sin Artículo';
        default: return 'Otros';
      }
    };

    const pushFlat = (path: string, r: ReservaItem) => {
      let arr = flatBySubKey.get(path);
      if (!arr) { arr = []; flatBySubKey.set(path, arr); }
      arr.push(r);
      let b = breakdownBySubKey.get(path);
      if (!b) { b = { flujo: 0, contraflujo: 0, bonificacion: 0, total: 0 }; breakdownBySubKey.set(path, b); }
      b.total++;
      if (r.tipo === 'Flujo') b.flujo++;
      else if (r.tipo === 'Contraflujo') b.contraflujo++;
      else if (r.tipo === 'Bonificacion') b.bonificacion++;
    };

    for (const r of filteredReservasData) {
      const k1 = getKey(r, fields[0]);
      pushFlat(k1, r);
      if (fields.length === 1) {
        let arr = grouped[k1] as ReservaItem[] | undefined;
        if (!arr) { arr = []; grouped[k1] = arr; }
        arr.push(r);
        continue;
      }
      const k2 = getKey(r, fields[1]);
      const path2 = `${k1}-${k2}`;
      pushFlat(path2, r);
      let level1 = grouped[k1] as Record<string, ReservaItem[] | Record<string, ReservaItem[]>> | undefined;
      if (!level1) { level1 = {}; grouped[k1] = level1; }
      if (fields.length === 2) {
        let arr = level1[k2] as ReservaItem[] | undefined;
        if (!arr) { arr = []; level1[k2] = arr; }
        arr.push(r);
        continue;
      }
      const k3 = getKey(r, fields[2]);
      const path3 = `${path2}-${k3}`;
      pushFlat(path3, r);
      let level2 = level1[k2] as Record<string, ReservaItem[]> | undefined;
      if (!level2) { level2 = {}; level1[k2] = level2; }
      let arr3 = level2[k3];
      if (!arr3) { arr3 = []; level2[k3] = arr3; }
      arr3.push(r);
    }

    return { grouped, groupKeys: Object.keys(grouped).sort(), flatBySubKey, breakdownBySubKey };
  }, [filteredReservasData, activeGroupingsReservas, tipoPeriodo]);
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

  // Calculate remaining to assign for selected cara
  // Recalculate flujo/contraflujo based on editable %
  // Mensual = todo cuenta como Flujo (regla Gran Formato), no aplicar split por %
  const adjustedCarasFlujo = useMemo(() => {
    if (!selectedCaraForSearch) return { flujo: 0, contraflujo: 0 };
    const totalRenta = (selectedCaraForSearch.caras_flujo || 0) + (selectedCaraForSearch.caras_contraflujo || 0);
    if (tipoPeriodo === 'mensual') {
      return { flujo: totalRenta, contraflujo: 0 };
    }
    const flujo = Math.ceil(totalRenta * flujoPct / 100);
    const contraflujo = totalRenta - flujo;
    return { flujo, contraflujo };
  }, [selectedCaraForSearch, flujoPct, tipoPeriodo]);

  // Para BF/CF/CT: split visual del KPI bonificación en Flujo/Contraflujo.
  // No toca BD — caras_flujo/caras_contraflujo siguen en 0; total = bonificacion.
  // Mismo comportamiento para Tradicional y Digital: respeta flujoPct (el input
  // % front-only). La distribución es libre y la validación cuenta solo el TOTAL,
  // no el ratio.
  const bonifSplit = useMemo(() => {
    if (!selectedCaraForSearch || !isBonifSplitArticle(selectedCaraForSearch.articulo)) {
      return { targetFlujo: 0, targetContra: 0, reservadoFlujo: 0, reservadoContra: 0 };
    }
    const total = selectedCaraForSearch.bonificacion || 0;
    const pct = flujoPct;
    const targetFlujo = Math.ceil(total * pct / 100);
    const targetContra = total - targetFlujo;
    const caraReservas = reservas.filter(r =>
      r.id.startsWith(selectedCaraForSearch.localId) || r.solicitudCaraId === selectedCaraForSearch.id
    );
    const bonifs = caraReservas.filter(r => r.tipo === 'Bonificacion');
    const reservadoFlujo = bonifs.filter(r => r.tipoCaraFisica === 'Flujo').length;
    const reservadoContra = bonifs.filter(r => r.tipoCaraFisica === 'Contraflujo').length;
    return { targetFlujo, targetContra, reservadoFlujo, reservadoContra };
  }, [selectedCaraForSearch, reservas, flujoPct]);

  const remainingToAssign = useMemo(() => {
    if (!selectedCaraForSearch) return { flujo: 0, contraflujo: 0, bonificacion: 0, bonifFlujo: 0, bonifContra: 0 };

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
      bonifFlujo: bonifSplit.targetFlujo - bonifSplit.reservadoFlujo,
      bonifContra: bonifSplit.targetContra - bonifSplit.reservadoContra,
    };
  }, [selectedCaraForSearch, reservas, adjustedCarasFlujo, bonifSplit]);

  // Check if cara has reservas
  const caraHasReservas = (localId: string, caraId?: number) => {
    return reservas.some(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
  };

  // Check if cara has any reservas with APS assigned (non-null and > 0)
  const caraHasAPS = (localId: string, caraId?: number) => {
    const caraReservas = reservas.filter(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
    return caraReservas.some(r => r.aps && r.aps > 0);
  };

  // Get count of reservas with APS for a cara
  const getCaraAPSCount = (localId: string, caraId?: number) => {
    const caraReservas = reservas.filter(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
    return caraReservas.filter(r => r.aps && r.aps > 0).length;
  };

  // Get unique APS numbers for a cara
  const getCaraAPSNumbers = (localId: string, caraId?: number): number[] => {
    const caraReservas = reservas.filter(r => r.id.startsWith(localId) || r.solicitudCaraId === caraId);
    const apsNumbers = caraReservas
      .filter(r => r.aps && r.aps > 0)
      .map(r => r.aps as number);
    return [...new Set(apsNumbers)].sort((a, b) => a - b);
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

    // Mensual = todo cuenta como Flujo. Cubre caras viejas con split 50/50 en DB.
    const rawFlujo = cara.caras_flujo || 0;
    const rawContra = cara.caras_contraflujo || 0;
    const flujoRequerido = tipoPeriodo === 'mensual' ? rawFlujo + rawContra : rawFlujo;
    const contraflujoRequerido = tipoPeriodo === 'mensual' ? 0 : rawContra;
    const bonificacionRequerido = cara.bonificacion || 0;

    // BF/CF/CT/IN: la bonificación se valida solo por TOTAL (no por ratio).
    // El split flujo/contraflujo es cosmético — el % se elige libre con flujoPct
    // (front-only, NO se guarda en BD). Aplica igual a Tradicional y Digital:
    // la vista no puede saber el ratio físico real una vez reservado, así que
    // la completitud cuenta el total de reservas tipo='Bonificacion'.
    const isSplitBonif = isBonifSplitArticle(cara.articulo);
    const esBonifSplitDigital = isSplitBonif; // alias histórico — ahora vale para todos los tipos bonif-split
    const bonifTargetFlujo = isSplitBonif ? Math.ceil(bonificacionRequerido * flujoPct / 100) : 0;
    const bonifTargetContra = isSplitBonif ? bonificacionRequerido - bonifTargetFlujo : 0;
    const bonifReservadoFlujo = isSplitBonif
      ? caraReservas.filter(r => r.tipo === 'Bonificacion' && r.tipoCaraFisica === 'Flujo').length
      : 0;
    const bonifReservadoContra = isSplitBonif
      ? caraReservas.filter(r => r.tipo === 'Bonificacion' && r.tipoCaraFisica === 'Contraflujo').length
      : 0;

    // For migrated campaigns: if total reservas >= total required, consider complete
    // This handles cases where tipo classification doesn't match exactly (CT, BF, IN, etc.)
    const totalReservadoAll = caraReservas.length;
    const totalRequeridoAll = flujoRequerido + contraflujoRequerido + bonificacionRequerido;
    const totalMatch = totalReservadoAll >= totalRequeridoAll && totalRequeridoAll > 0;

    // Complete: exact match per type, OR total match (covers migrated/special articles)
    const flujoCompleto = flujoReservado === flujoRequerido || totalMatch;
    const contraflujoCompleto = contraflujoReservado === contraflujoRequerido || totalMatch;
    // Para BF/CF/CT/IN: bonificación completa si AMBOS lados del split coinciden con su target,
    // O si totalMatch (campañas migradas sin tipoCaraFisica preciso).
    const bonificacionCompleto = isSplitBonif
      ? (esBonifSplitDigital
          ? (bonificacionReservado === bonificacionRequerido || totalMatch)
          : ((bonifReservadoFlujo === bonifTargetFlujo && bonifReservadoContra === bonifTargetContra) || totalMatch))
      : (bonificacionReservado === bonificacionRequerido || totalMatch);

    const totalRequerido = flujoRequerido + contraflujoRequerido + bonificacionRequerido;
    const totalReservado = flujoReservado + contraflujoReservado + bonificacionReservado;

    // Calculate differences (positive = over, negative = under)
    const flujoDiff = flujoReservado - flujoRequerido;
    const contraflujoDiff = contraflujoReservado - contraflujoRequerido;
    const bonificacionDiff = bonificacionReservado - bonificacionRequerido;
    const totalDiff = totalReservado - totalRequerido;

    // Check if needs attention (has differences)
    const splitNeedsAttention = isSplitBonif && !esBonifSplitDigital
      && !totalMatch
      && (bonifReservadoFlujo !== bonifTargetFlujo || bonifReservadoContra !== bonifTargetContra);
    const needsAttention = flujoDiff !== 0 || contraflujoDiff !== 0 || bonificacionDiff !== 0 || splitNeedsAttention;

    // QR (Gestión QTO): reservar es opcional. Siempre se considera completa para
    // pase a ventas. Verde con o sin reservas.
    const esQr = !!(cara.articulo && isQuretaroArticle(cara.articulo));
    const allComplete = flujoCompleto && contraflujoCompleto && bonificacionCompleto;
    return {
      flujoReservado,
      contraflujoReservado,
      bonificacionReservado,
      flujoRequerido,
      contraflujoRequerido,
      bonificacionRequerido,
      flujoCompleto: esQr ? true : flujoCompleto,
      contraflujoCompleto: esQr ? true : contraflujoCompleto,
      bonificacionCompleto: esQr ? true : bonificacionCompleto,
      isComplete: esQr ? true : allComplete,
      totalReservado,
      totalRequerido,
      flujoDiff,
      contraflujoDiff,
      bonificacionDiff,
      totalDiff,
      needsAttention: esQr ? false : needsAttention,
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

  // Saved-pending lock: existe alguna cara YA GUARDADA en BD (id != null) con
  // autorización original pendiente y que NO ha sido modificada localmente.
  // Solo dispara el bloqueo cuando hay pendientes reales en BD, no locales.
  const hasSavedPendingAuth = useMemo(() => {
    return caras.some(c =>
      c.id != null &&
      !modifiedCaras.has(c.id) &&
      (c._originalDg === 'pendiente' || c._originalDcm === 'pendiente')
    );
  }, [caras, modifiedCaras]);

  // Group caras by catorcena period with catorcena info — O(C) usando catorcenasByFechaInicio.
  const carasGroupedByCatorcena = useMemo(() => {
    const groups: Record<string, { caras: CaraItem[]; catorcenaNum?: number; year?: number }> = {};
    for (const cara of caras) {
      let periodo = cara.inicio_periodo || 'Sin periodo';
      let parsedMonth: number | undefined;
      let parsedYear: number | undefined;
      if (tipoPeriodo === 'mensual' && cara.inicio_periodo) {
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
          const periodoStr = String(periodo).slice(0, 10);
          const catorcenaInfo = catorcenasByFechaInicio.get(periodoStr);
          groups[periodo] = { caras: [], catorcenaNum: catorcenaInfo?.numero_catorcena, year: catorcenaInfo?.a_o };
        }
      }
      groups[periodo].caras.push(cara);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [caras, catorcenasByFechaInicio, tipoPeriodo]);

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
    // Mensual: generar meses (1-12)
    if (tipoPeriodo === 'mensual') {
      if (!yearInicio) return [];
      const baseMonths = Array.from({ length: 12 }, (_, i) => ({ id: yearInicio * 100 + (i + 1), a_o: yearInicio, numero_catorcena: i + 1, fecha_inicio: '', fecha_fin: '' }));
      if (yearInicio === yearFin && catorcenaFin) return baseMonths.filter(m => m.numero_catorcena <= catorcenaFin);
      return baseMonths;
    }
    if (!catorcenasData?.data || !yearInicio) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) return cats.filter(c => c.numero_catorcena <= catorcenaFin);
    return cats;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin, tipoPeriodo]);

  const catorcenasFinOptions = useMemo(() => {
    // Mensual: generar meses (1-12)
    if (tipoPeriodo === 'mensual') {
      if (!yearFin) return [];
      const baseMonths = Array.from({ length: 12 }, (_, i) => ({ id: yearFin * 100 + (i + 1), a_o: yearFin, numero_catorcena: i + 1, fecha_inicio: '', fecha_fin: '' }));
      if (yearInicio === yearFin && catorcenaInicio) return baseMonths.filter(m => m.numero_catorcena >= catorcenaInicio);
      return baseMonths;
    }
    if (!catorcenasData?.data || !yearFin) return [];
    const cats = catorcenasData.data.filter(c => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) return cats.filter(c => c.numero_catorcena >= catorcenaInicio);
    return cats;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio, tipoPeriodo]);

  // Available periods based on year range
  const availablePeriods = useMemo(() => {
    if (!yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];
    // Mensual: generar periodos por mes (1-12) entre yearInicio/mesInicio y yearFin/mesFin
    if (tipoPeriodo === 'mensual') {
      const periods: { id: number; a_o: number; numero_catorcena: number; fecha_inicio: string; fecha_fin: string }[] = [];
      let y = yearInicio, m = catorcenaInicio;
      while (y < yearFin || (y === yearFin && m <= catorcenaFin)) {
        const fechaIni = new Date(y, m - 1, 1);
        const fechaFinMes = new Date(y, m, 0);
        periods.push({
          id: y * 100 + m,
          a_o: y,
          numero_catorcena: m,
          fecha_inicio: fechaIni.toISOString().split('T')[0],
          fecha_fin: fechaFinMes.toISOString().split('T')[0],
        });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return periods;
    }
    if (!catorcenasData?.data) return [];
    return catorcenasData.data.filter(c => {
      if (c.a_o < yearInicio || c.a_o > yearFin) return false;
      if (c.a_o === yearInicio && c.numero_catorcena < catorcenaInicio) return false;
      if (c.a_o === yearFin && c.numero_catorcena > catorcenaFin) return false;
      return true;
    });
  }, [catorcenasData, yearInicio, yearFin, catorcenaInicio, catorcenaFin, tipoPeriodo]);

  // Detect caras whose period is outside the current availablePeriods range
  const invalidCaras = useMemo(() => {
    if (caras.length === 0) return [];
    if (!yearInicio || !yearFin || !catorcenaInicio || !catorcenaFin) return [];
    const validKeys = new Set(availablePeriods.map(p => `${p.a_o}-${p.numero_catorcena}`));

    // Rango global: para verificar fechas exactas del circuito
    let rangoIni = '';
    let rangoFin = '';
    if (tipoPeriodo === 'mensual') {
      rangoIni = `${yearInicio}-${String(catorcenaInicio).padStart(2, '0')}-01`;
      const lastDay = new Date(yearFin, catorcenaFin, 0).getDate();
      rangoFin = `${yearFin}-${String(catorcenaFin).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const ini = catorcenasByYearNum.get(`${yearInicio}-${catorcenaInicio}`);
      const fin = catorcenasByYearNum.get(`${yearFin}-${catorcenaFin}`);
      if (ini) rangoIni = String(ini.fecha_inicio).split('T')[0];
      if (fin) rangoFin = String(fin.fecha_fin).split('T')[0];
    }

    return caras.filter(c => {
      if (!c.anio_inicio || !c.catorcena_inicio) return false;
      if (!validKeys.has(`${c.anio_inicio}-${c.catorcena_inicio}`)) return true;
      // También verificar fechas reales del circuito vs rango global
      if (rangoIni && rangoFin && c.inicio_periodo && c.fin_periodo) {
        const ini = String(c.inicio_periodo).split('T')[0];
        const fin = String(c.fin_periodo).split('T')[0];
        if (ini < rangoIni || fin > rangoFin) return true;
      }
      return false;
    });
  }, [caras, availablePeriods, yearInicio, yearFin, catorcenaInicio, catorcenaFin, tipoPeriodo, catorcenasByYearNum]);

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

    // Eliminar circuito siempre actúa sobre la cara individual (NO masivo).
    // Si su par RT/BF existe, también se elimina la pareja del MISMO periodo.

    // If cara is part of an RT/BF pair, also delete the paired cara
    // (limited to same period to be safe with multi-period campaigns)
    const pairedCaras: CaraItem[] = [];
    if (caraToDelete?.grupo_rt_bf) {
      const pair = caras.filter(c =>
        c.grupo_rt_bf === caraToDelete.grupo_rt_bf &&
        c.localId !== caraToDelete.localId &&
        c.inicio_periodo === caraToDelete.inicio_periodo
      );
      // Block the delete if any paired cara has reservas
      for (const p of pair) {
        if (caraHasReservas(p.localId, p.id)) {
          alert('No puedes eliminar esta cara: su cara pareja (RT/BF) tiene reservas. Primero elimina las reservas.');
          return;
        }
      }
      pairedCaras.push(...pair);
    }

    const isPair = pairedCaras.length > 0;

    setConfirmModal({
      isOpen: true,
      title: isPair ? 'Eliminar RT + BF' : 'Eliminar Formato',
      message: isPair
        ? '¿Estás seguro de que deseas eliminar este formato junto con su cara pareja (RT/BF) de la campaña?'
        : '¿Estás seguro de que deseas eliminar este formato de la campaña?',
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        // Delete all caras in the pair (+ the primary) from DB if they have IDs
        const toDelete = [caraToDelete, ...pairedCaras].filter(Boolean) as CaraItem[];
        for (const c of toDelete) {
          if (c.id) {
            try {
              await campanasService.deleteCara(campana!.id, c.id);
            } catch (error) {
              console.error('Error deleting cara:', error);
              alert('Error al eliminar el formato de la base de datos');
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              return;
            }
          }
        }
        // Update local state
        const deletedLocalIds = new Set(toDelete.map(c => c.localId));
        setCaras(prev => prev.filter(c => !deletedLocalIds.has(c.localId)));
        setReservas(prev => prev.filter(r => !toDelete.some(c => r.id.startsWith(c.localId))));
        // Also drop any pending modifications for deleted caras
        setModifiedCaras(prev => {
          const next = new Map(prev);
          for (const c of toDelete) if (c.id) next.delete(c.id);
          return next;
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle edit cara - permite edición parcial cuando hay reservas
  const handleEditCara = (cara: CaraItem) => {
    // If editing a BF row, find and edit the RT row instead (BF rows are not edited directly)
    if (cara.esBf && cara.grupo_rt_bf) {
      const rtCara = caras.find(c =>
        c.grupo_rt_bf === cara.grupo_rt_bf &&
        !c.esBf &&
        c.inicio_periodo === cara.inicio_periodo
      );
      if (rtCara) { handleEditCara(rtCara); return; }
    }

    // Ya no bloqueamos completamente - permitimos edición de ciudad, formatos y NSE
    setEditingCaraId(cara.localId);

    // Find and set the selectedArticulo if we have the articulo code
    if (cara.articulo && articulosData) {
      const foundArticulo = articulosData.find(a => a.ItemCode === cara.articulo);
      if (foundArticulo) {
        setSelectedArticulo(foundArticulo);
      }
    }

    // RT/BF: find the BF pair to load its article + caras count into the form
    let bfPair: CaraItem | null = null;
    if (cara.grupo_rt_bf && !cara.esBf) {
      bfPair = caras.find(c =>
        c.grupo_rt_bf === cara.grupo_rt_bf &&
        c.esBf &&
        c.inicio_periodo === cara.inicio_periodo
      ) || null;
    }
    if (bfPair && articulosData) {
      const foundBf = articulosData.find(a => a.ItemCode === bfPair!.articulo);
      setArticuloBf(foundBf || null);
    } else {
      setArticuloBf(null);
    }

    // Calculate caras en renta (flujo + contraflujo)
    const carasEnRenta = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0);

    const bonificacionForForm = bfPair ? (bfPair.bonificacion || 0) : cara.bonificacion;

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
      bonificacion: bonificacionForForm,
      caras: carasEnRenta,
      nivel_socioeconomico: cara.nivel_socioeconomico,
      formato: cara.formato,
      costo: cara.costo,
      tarifa_publica: cara.tarifa_publica,
      // Truncar a YYYY-MM-DD para que <input type="date"> lo reconozca
      inicio_periodo: String(cara.inicio_periodo || '').slice(0, 10),
      fin_periodo: String(cara.fin_periodo || '').slice(0, 10),
      caras_flujo: cara.caras_flujo,
      caras_contraflujo: cara.caras_contraflujo,
      articulo: cara.articulo,
      descuento: cara.descuento,
      catorcena_inicio: catorcenaInicioVal,
      anio_inicio: anioInicioVal,
      catorcena_fin: catorcenaFinVal,
      anio_fin: anioFinVal,
      grupo_rt_bf: cara.grupo_rt_bf || null,
      esBf: cara.esBf || false,
    });
    setShowAddCaraForm(true);
    setTimeout(() => {
      caraFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setLoadingCaraAction(null);
    }, 150);
  };

  // Handle save cara (add or update)
  // EDIT: only updates local state + tracks in modifiedCaras (bulk save later)
  // CREATE: still persists to DB immediately (needs ID for reservas)
  const handleSaveCara = async (forcedPeriod?: { catorcena: number; anio: number; inicio_periodo: string; fin_periodo: string }) => {
    if (!newCara.formato || !newCara.estados) {
      alert('Por favor completa al menos el formato y estado');
      return;
    }

    const artCode = (newCara.articulo || '').toUpperCase();
    const esCortesia = artCode.startsWith('CT');
    const esBonificacion = artCode.startsWith('BF') || artCode.startsWith('CF');
    const esImpresion = artCode.startsWith('IM');
    const esIntercambio = artCode.startsWith('IN');
    if (newCara.tarifa_publica <= 0 && !esCortesia && !esBonificacion && !esImpresion && !esIntercambio) {
      alert('La tarifa pública no puede ser 0. Por favor ingresa una tarifa válida.');
      return;
    }

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

    // RT/BF pairing conditions:
    // - User selected an articuloBf AND entered bonificacion > 0 AND primary article supports BF
    //   (not cortesia, not impresión, not intercambio, not ejec. especial, not already BF)
    const articuloSupportsBf =
      !esCortesia &&
      !esBonificacion &&
      !artCode.startsWith('IM') &&
      !artCode.startsWith('IN') &&
      !isEspecialArticle(newCara.articulo || '');
    const wantsPair = !!articuloBf && (newCara.bonificacion || 0) > 0 && articuloSupportsBf;

    // No permitir bonificación sin renta (la bonif es ADICIONAL a la renta).
    // Excepción: artículos puros BF/CF/CT/IM y especiales que no requieren renta.
    if ((newCara.bonificacion || 0) > 0 && (newCara.caras || 0) <= 0 && articuloSupportsBf) {
      alert('No puedes agregar bonificación sin tener al menos 1 cara de renta. Sube las caras o quita la bonificación.');
      return;
    }

    // The RT row holds 0 bonificacion when paired (BF count lives on the BF row as renta/caras)
    const rtBonificacion = wantsPair ? 0 : (newCara.bonificacion || 0);
    const costoCalculado = (newCara.caras || 0) * (newCara.tarifa_publica || 0);
    // Override de fechas para modo masivo (iteración por catorcena)
    const inicioPeriodoUsar = forcedPeriod?.inicio_periodo ?? newCara.inicio_periodo;
    const finPeriodoUsar = forcedPeriod?.fin_periodo ?? newCara.fin_periodo;

    // Build the RT caraData (what the backend sees)
    const buildRtCaraData = (grupoRtBf: number | null): Record<string, unknown> => ({
      ciudad: ciudadToSave,
      estados: newCara.estados,
      tipo: newCara.tipo,
      flujo: newCara.flujo,
      bonificacion: rtBonificacion,
      caras: newCara.caras,
      nivel_socioeconomico: newCara.nivel_socioeconomico,
      formato: newCara.formato,
      costo: costoCalculado,
      tarifa_publica: newCara.tarifa_publica,
      inicio_periodo: inicioPeriodoUsar,
      fin_periodo: finPeriodoUsar,
      caras_flujo: newCara.caras_flujo,
      caras_contraflujo: newCara.caras_contraflujo,
      articulo: newCara.articulo,
      descuento: newCara.descuento,
      grupo_rt_bf: grupoRtBf,
    });

    // Build a BF caraData given the BF article and count
    const buildBfCaraData = (bfArticuloCode: string, bfCount: number, grupoRtBf: number): Record<string, unknown> => {
      return {
        ciudad: ciudadToSave,
        estados: newCara.estados,
        tipo: newCara.tipo,
        flujo: newCara.flujo,
        bonificacion: bfCount,
        caras: 0,
        nivel_socioeconomico: newCara.nivel_socioeconomico,
        formato: newCara.formato,
        costo: 0,
        tarifa_publica: 0,
        inicio_periodo: inicioPeriodoUsar,
        fin_periodo: finPeriodoUsar,
        caras_flujo: 0,
        caras_contraflujo: 0,
        articulo: bfArticuloCode,
        descuento: 0,
        grupo_rt_bf: grupoRtBf,
      };
    };

    try {
      if (editingCaraId) {
        // ---- LOCAL-ONLY UPDATE for RT cara; CREATE/UPDATE/DELETE BF pair as needed ----
        const caraToEdit = caras.find(c => c.localId === editingCaraId);
        if (!caraToEdit?.id) {
          setEditingCaraId(null);
          return;
        }

        // Determine grupo_rt_bf: reuse existing, or generate a new one if pairing now.
        let grupoRtBf: number | null = caraToEdit.grupo_rt_bf || null;
        if (wantsPair && !grupoRtBf) grupoRtBf = Date.now() % 2000000000;
        if (!wantsPair) grupoRtBf = null;

        // Find existing BF pair (if any)
        const existingBfPair = caraToEdit.grupo_rt_bf
          ? caras.find(c =>
              c.grupo_rt_bf === caraToEdit.grupo_rt_bf &&
              c.esBf &&
              c.inicio_periodo === caraToEdit.inicio_periodo &&
              c.localId !== caraToEdit.localId
            ) || null
          : null;

        // Block pair changes if APS is posted on any side of the pair (safety guard)
        const apsOnRt = !!(caraToEdit.id && caras.some(c => c.id === caraToEdit.id));
        const bfCaraReservas = existingBfPair ? reservas.filter(r => r.id.startsWith(existingBfPair.localId) || r.solicitudCaraId === existingBfPair.id) : [];
        const bfApsBlocked = postedAPSGroups.size > 0
          ? bfCaraReservas.some(r => r.aps && postedAPSGroups.has(r.aps as number))
          : bfCaraReservas.some(r => r.aps && r.aps > 0);
        const rtCaraReservas = reservas.filter(r => r.id.startsWith(caraToEdit.localId) || r.solicitudCaraId === caraToEdit.id);
        const rtApsBlocked = postedAPSGroups.size > 0
          ? rtCaraReservas.some(r => r.aps && postedAPSGroups.has(r.aps as number))
          : rtCaraReservas.some(r => r.aps && r.aps > 0);
        // Changes in pair structure (adding/removing/swapping BF) require no APS block on either row
        const pairStructureChanging =
          (!!existingBfPair !== wantsPair) ||
          (existingBfPair && articuloBf && existingBfPair.articulo !== articuloBf.ItemCode);
        if (pairStructureChanging && (rtApsBlocked || bfApsBlocked)) {
          alert('No se puede modificar la pareja RT/BF: el grupo tiene APS asignadas en SAP.');
          return;
        }
        void apsOnRt;

        // Re-evaluate authorization when auth fields change on the RT row
        let autorizacion_dg = caraToEdit.autorizacion_dg || 'aprobado';
        let autorizacion_dcm = caraToEdit.autorizacion_dcm || 'aprobado';
        const authFieldsChanged = newCara.caras !== caraToEdit.caras_flujo + caraToEdit.caras_contraflujo
          || rtBonificacion !== (caraToEdit.bonificacion || 0)
          || newCara.tarifa_publica !== (caraToEdit.tarifa_publica || 0)
          || newCara.formato !== (caraToEdit.formato || '')
          || newCara.tipo !== (caraToEdit.tipo || '')
          || newCara.articulo !== (caraToEdit.articulo || '');
        if (authFieldsChanged) {
          try {
            const resultado = await solicitudesService.evaluarAutorizacion({
              ciudad: ciudadToSave,
              estado: newCara.estados,
              formato: newCara.formato,
              tipo: newCara.tipo,
              caras: newCara.caras,
              bonificacion: rtBonificacion,
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

        const rtCaraData = buildRtCaraData(grupoRtBf);

        // Handle BF side: create / update / delete
        let createdBfItem: CaraItem | null = null;
        let bfCaraDataForPersist: Record<string, unknown> | null = null;
        let bfCaraDbIdForPersist: number | null = null;
        let deletedBfId: number | null = null;

        const bfCount = newCara.bonificacion || 0;

        if (wantsPair && articuloBf && grupoRtBf) {
          if (existingBfPair) {
            // Update existing BF pair
            bfCaraDataForPersist = buildBfCaraData(articuloBf.ItemCode, bfCount, grupoRtBf);
            bfCaraDbIdForPersist = existingBfPair.id || null;
          } else {
            // Create a new BF row in DB (needs a DB id to tie reservas later)
            const bfData = buildBfCaraData(articuloBf.ItemCode, bfCount, grupoRtBf);
            const createdBf = await campanasService.createCara(campana!.id, bfData as any);
            createdBfItem = {
              localId: `cara-${createdBf.id}`,
              id: createdBf.id,
              ciudad: ciudadToSave || '',
              estados: newCara.estados,
              tipo: newCara.tipo,
              flujo: newCara.flujo,
              bonificacion: bfCount,
              caras: 0,
              nivel_socioeconomico: newCara.nivel_socioeconomico,
              formato: newCara.formato,
              costo: 0,
              tarifa_publica: 0,
              inicio_periodo: inicioPeriodoUsar,
              fin_periodo: finPeriodoUsar,
              caras_flujo: 0,
              caras_contraflujo: 0,
              articulo: articuloBf.ItemCode,
              descuento: 0,
              catorcena_inicio: newCara.catorcena_inicio,
              anio_inicio: newCara.anio_inicio,
              catorcena_fin: newCara.catorcena_fin,
              anio_fin: newCara.anio_fin,
              autorizacion_dg: createdBf.autorizacion_dg || 'aprobado',
              autorizacion_dcm: createdBf.autorizacion_dcm || 'aprobado',
              _originalDg: createdBf.autorizacion_dg || 'aprobado',
              _originalDcm: createdBf.autorizacion_dcm || 'aprobado',
              grupo_rt_bf: grupoRtBf,
              esBf: true,
            };
          }
        } else if (!wantsPair && existingBfPair?.id) {
          // User removed BF pairing: delete BF row from DB
          try {
            await campanasService.deleteCara(campana!.id, existingBfPair.id);
            deletedBfId = existingBfPair.id;
          } catch (error) {
            console.error('Error deleting BF pair:', error);
            alert('Error al eliminar la cara BF pareja');
            return;
          }
        }

        // Update local state only for RT (saved in bulk later)
        setCaras(prev => {
          let updated = prev.map(c =>
            c.localId === editingCaraId
              ? {
                  ...c,
                  ...newCara,
                  bonificacion: rtBonificacion,
                  ciudad: ciudadToSave || newCara.ciudad,
                  costo: costoCalculado,
                  autorizacion_dg,
                  autorizacion_dcm,
                  _originalDg: autorizacion_dg,
                  _originalDcm: autorizacion_dcm,
                  grupo_rt_bf: grupoRtBf,
                  esBf: false,
                }
              : c
          );

          // Apply BF updates locally
          if (deletedBfId) {
            updated = updated.filter(c => c.id !== deletedBfId);
          }
          if (existingBfPair && wantsPair && articuloBf) {
            updated = updated.map(c =>
              c.localId === existingBfPair.localId
                ? {
                    ...c,
                    bonificacion: bfCount,
                    caras: 0,
                    caras_flujo: 0,
                    caras_contraflujo: 0,
                    articulo: articuloBf.ItemCode,
                    tarifa_publica: 0,
                    costo: 0,
                    descuento: 0,
                    grupo_rt_bf: grupoRtBf,
                    esBf: true,
                    ciudad: ciudadToSave || newCara.ciudad,
                    estados: newCara.estados,
                    formato: newCara.formato,
                    tipo: newCara.tipo,
                    nivel_socioeconomico: newCara.nivel_socioeconomico,
                    inicio_periodo: inicioPeriodoUsar,
                    fin_periodo: finPeriodoUsar,
                  }
                : c
            );
          }
          if (createdBfItem) {
            updated = [...updated, createdBfItem];
          }

          if (authFieldsChanged) {
            updated = updated.map(c => ({ ...c, autorizacion_dg: c._originalDg || c.autorizacion_dg, autorizacion_dcm: c._originalDcm || c.autorizacion_dcm }));
            const hayDG = updated.some(c => c.autorizacion_dg === 'pendiente');
            if (hayDG) updated = updated.map(c => c.autorizacion_dcm === 'pendiente' ? { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' } : c);
          }
          return updated;
        });

        // Track RT as modified for bulk save
        setModifiedCaras(prev => {
          const next = new Map(prev);
          next.set(caraToEdit.id!, rtCaraData);
          // Track existing BF update for bulk save
          if (bfCaraDataForPersist && bfCaraDbIdForPersist) {
            next.set(bfCaraDbIdForPersist, bfCaraDataForPersist);
          }
          // Drop any pending modifications for a deleted BF
          if (deletedBfId) next.delete(deletedBfId);
          return next;
        });

        // Propagación masiva: si el toggle modoMasivoC está ON y la cara pertenece
        // a un grupo masivo, replicar los cambios NO-temporales a las demás caras
        // del grupo (manteniendo cada cara su propio periodo y su par BF).
        if (modoMasivoC && caraToEdit.grupo_masivo_id) {
          const otrasCarasGrupo = caras.filter(c =>
            c.grupo_masivo_id === caraToEdit.grupo_masivo_id &&
            c.id !== caraToEdit.id &&
            !c.esBf
          );
          if (otrasCarasGrupo.length > 0) {
            setModifiedCaras(prev => {
              const next = new Map(prev);
              for (const otra of otrasCarasGrupo) {
                if (!otra.id) continue;
                // Conservar el grupo_rt_bf y periodo propios de la otra cara
                next.set(otra.id, {
                  ...rtCaraData,
                  inicio_periodo: otra.inicio_periodo,
                  fin_periodo: otra.fin_periodo,
                  grupo_rt_bf: otra.grupo_rt_bf ?? null,
                });
                // También su par BF si existe
                if (otra.grupo_rt_bf && bfCaraDataForPersist) {
                  const bfPair = caras.find(c =>
                    c.localId !== otra.localId &&
                    c.esBf &&
                    c.grupo_rt_bf === otra.grupo_rt_bf &&
                    c.inicio_periodo === otra.inicio_periodo &&
                    c.fin_periodo === otra.fin_periodo
                  );
                  if (bfPair?.id) {
                    next.set(bfPair.id, {
                      ...bfCaraDataForPersist,
                      inicio_periodo: otra.inicio_periodo,
                      fin_periodo: otra.fin_periodo,
                      grupo_rt_bf: otra.grupo_rt_bf,
                    });
                  }
                }
              }
              return next;
            });
            // Replicar cambios al estado local INMEDIATAMENTE para que se vea en UI
            const grupoIdsRT = new Set(otrasCarasGrupo.map(o => o.id));
            const grupoIdsBfPares = new Set<number>();
            for (const otra of otrasCarasGrupo) {
              if (otra.grupo_rt_bf) {
                const bfPair = caras.find(c =>
                  c.localId !== otra.localId &&
                  c.esBf &&
                  c.grupo_rt_bf === otra.grupo_rt_bf &&
                  c.inicio_periodo === otra.inicio_periodo &&
                  c.fin_periodo === otra.fin_periodo
                );
                if (bfPair?.id) grupoIdsBfPares.add(bfPair.id);
              }
            }
            setCaras(prev => prev.map(c => {
              if (c.id && grupoIdsRT.has(c.id)) {
                return {
                  ...c,
                  articulo: newCara.articulo,
                  estados: newCara.estados,
                  ciudad: ciudadToSave || c.ciudad,
                  plaza: newCara.plaza || c.plaza,
                  formato: newCara.formato,
                  tipo: newCara.tipo,
                  nivel_socioeconomico: newCara.nivel_socioeconomico,
                  caras: newCara.caras,
                  bonificacion: rtBonificacion,
                  tarifa_publica: newCara.tarifa_publica,
                  costo: costoCalculado,
                  descuento: newCara.descuento,
                  caras_flujo: newCara.caras_flujo,
                  caras_contraflujo: newCara.caras_contraflujo,
                };
              }
              if (c.id && grupoIdsBfPares.has(c.id)) {
                return {
                  ...c,
                  bonificacion: bfCount,
                  caras: 0,
                  caras_flujo: 0,
                  caras_contraflujo: 0,
                  articulo: articuloBf?.ItemCode || c.articulo,
                  formato: newCara.formato,
                  tipo: newCara.tipo,
                };
              }
              return c;
            }));
            showToast(`Cambios replicados a ${otrasCarasGrupo.length} cara(s) más del grupo masivo`, 'success');
          }
        }

        setEditingCaraId(null);
        setTimeout(() => caraTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else {
        // ---- CREATE ----
        // If pairing requested, generate a grupo id
        const grupoRtBf: number | null = wantsPair ? Date.now() % 2000000000 : null;
        const rtCaraData = buildRtCaraData(grupoRtBf);

        // Create BF cara FIRST (so backend can look it up when evaluating RT auth)
        let newBfItem: CaraItem | null = null;
        if (wantsPair && articuloBf && grupoRtBf) {
          const bfCount = newCara.bonificacion || 0;
          const bfData = buildBfCaraData(articuloBf.ItemCode, bfCount, grupoRtBf);
          const createdBf = await campanasService.createCara(campana!.id, bfData as any);
          newBfItem = {
            localId: `cara-${createdBf.id}`,
            id: createdBf.id,
            ciudad: ciudadToSave || '',
            estados: newCara.estados,
            tipo: newCara.tipo,
            flujo: newCara.flujo,
            bonificacion: bfCount,
            caras: 0,
            nivel_socioeconomico: newCara.nivel_socioeconomico,
            formato: newCara.formato,
            costo: 0,
            tarifa_publica: 0,
            inicio_periodo: inicioPeriodoUsar,
            fin_periodo: finPeriodoUsar,
            caras_flujo: 0,
            caras_contraflujo: 0,
            articulo: articuloBf.ItemCode,
            descuento: 0,
            catorcena_inicio: newCara.catorcena_inicio,
            anio_inicio: newCara.anio_inicio,
            catorcena_fin: newCara.catorcena_fin,
            anio_fin: newCara.anio_fin,
            autorizacion_dg: createdBf.autorizacion_dg || 'aprobado',
            autorizacion_dcm: createdBf.autorizacion_dcm || 'aprobado',
            _originalDg: createdBf.autorizacion_dg || 'aprobado',
            _originalDcm: createdBf.autorizacion_dcm || 'aprobado',
            grupo_rt_bf: grupoRtBf,
            esBf: true,
          };
        }

        // Create RT cara after BF (so backend auth lookup finds BF pair)
        const createdCara = await campanasService.createCara(campana!.id, rtCaraData as any);
        const newRtItem: CaraItem = {
          ...newCara,
          id: createdCara.id,
          localId: `cara-${createdCara.id}`,
          bonificacion: rtBonificacion,
          costo: costoCalculado,
          autorizacion_dg: createdCara.autorizacion_dg || 'aprobado',
          autorizacion_dcm: createdCara.autorizacion_dcm || 'aprobado',
          _originalDg: createdCara.autorizacion_dg || 'aprobado',
          _originalDcm: createdCara.autorizacion_dcm || 'aprobado',
          grupo_rt_bf: grupoRtBf,
          esBf: false,
        };

        setCaras(prev => {
          let updated = [...prev, newRtItem];
          if (newBfItem) updated = [...updated, newBfItem];
          updated = updated.map(c => ({ ...c, autorizacion_dg: c._originalDg || c.autorizacion_dg, autorizacion_dcm: c._originalDcm || c.autorizacion_dcm }));
          const hayDG = updated.some(c => c.autorizacion_dg === 'pendiente');
          if (hayDG) updated = updated.map(c => c.autorizacion_dcm === 'pendiente' ? { ...c, autorizacion_dg: 'pendiente', autorizacion_dcm: 'aprobado' } : c);
          return updated;
        });

        // Track as modified so it doesn't block editing (auth processed on bulk save)
        setModifiedCaras(prev => {
          const next = new Map(prev);
          next.set(createdCara.id, rtCaraData);
          return next;
        });
      }

      setNewCara(EMPTY_CARA);
      setSelectedArticulo(null);
      setArticuloBf(null);
      setShowAddCaraForm(false);
    } catch (error) {
      console.error('Error saving cara:', error);
      alert('Error al guardar la cara');
    }
  };

  // Bulk save ALL pending changes (campaign summary + modified caras) in one action
  const handleBulkSaveChanges = async () => {
    const hasCampanaChanges = hasChanges;
    const hasCaraChanges = modifiedCaras.size > 0;

    if (!hasCampanaChanges && !hasCaraChanges) {
      showToast('No hay cambios pendientes', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const messages: string[] = [];

      // 1. Save campaign summary changes if any
      if (hasCampanaChanges) {
        // Resolver cliente.id real desde CUIC + sap_database.
        let resolvedClienteIdBulk: number | null = null;
        if (clienteChanged && selectedClienteCuic) {
          try {
            const resolved = await clientesService.resolveByCuic(selectedClienteCuic.CUIC, (selectedClienteCuic as any).sap_database || null);
            resolvedClienteIdBulk = resolved.id;
          } catch (err) {
            showToast(`No se pudo resolver cliente para CUIC ${selectedClienteCuic.CUIC}`, 'error');
            setIsSaving(false);
            return;
          }
        }
        const asignadosStr = asignados.map(u => u.nombre).join(', ');
        const asignadosIdsStr = asignados.map(u => u.id).join(',');
        await campanasService.update(campana!.id, {
          nombre: nombreCampania,
          notas,
          descripcion,
          catorcenaInicioNum: catorcenaInicio,
          catorcenaInicioAnio: yearInicio,
          catorcenaFinNum: catorcenaFin,
          catorcenaFinAnio: yearFin,
          asignados: asignadosStr,
          id_asignado: asignadosIdsStr,
          IMU: imu,
          ...(clienteChanged && selectedClienteCuic && resolvedClienteIdBulk ? {
            cliente_id: resolvedClienteIdBulk,
            cuic: selectedClienteCuic.CUIC,
            razon_social: selectedClienteCuic.T0_U_RazonSocial,
            marca_nombre: selectedClienteCuic.T2_U_Marca,
            asesor: selectedClienteCuic.ASESOR_U_Asesor,
            sap_database: selectedClienteCuic.sap_database,
          } : {}),
        });

        setInitialValues({
          nombreCampania,
          notas,
          descripcion,
          yearInicio,
          yearFin,
          catorcenaInicio,
          catorcenaFin,
          asignadosIds: asignadosIdsStr,
          imu,
        });
        setClienteChanged(false);
        messages.push('Campaña actualizada');
      }

      // 2. Bulk save modified caras if any
      if (hasCaraChanges) {
        const carasArray = Array.from(modifiedCaras.entries()).map(([caraId, data]) => ({
          caraId,
          data,
        }));

        const result = await campanasService.bulkUpdateCaras(campana!.id, carasArray);

        if (result.updated && result.updated.length > 0) {
          setCaras(prev => {
            let updated = prev.map(c => {
              const serverCara = result.updated.find(u => u.id === c.id);
              if (serverCara) {
                return { ...c, autorizacion_dg: serverCara.autorizacion_dg || c.autorizacion_dg, autorizacion_dcm: serverCara.autorizacion_dcm || c.autorizacion_dcm, _originalDg: serverCara.autorizacion_dg || c.autorizacion_dg, _originalDcm: serverCara.autorizacion_dcm || c.autorizacion_dcm };
              }
              return c;
            });
            // Server already returned correct authorization - no need to re-apply impar/contamination
            return updated;
          });
        }

        setModifiedCaras(new Map());
        messages.push(result.message || `${carasArray.length} circuito(s) actualizados`);
      }

      // Refresh data — incluye reservas modal para que circuitos se redibujen verdes/llenos tras redistribuir
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['campana-full', campana!.id] }),
        queryClient.invalidateQueries({ queryKey: ['campana-caras', campana!.id] }),
        queryClient.invalidateQueries({ queryKey: ['campana-details', campana?.id] }),
        queryClient.invalidateQueries({ queryKey: ['campanas'] }),
        queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] }),
      ]);

      showToast(messages.join(' | '), 'success');
    } catch (error) {
      console.error('Error in bulk save:', error);
      // Extraer mensaje del backend si es AxiosError
      const axiosError = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      const backendMsg = axiosError?.response?.data?.error || axiosError?.response?.data?.message;
      const msg = backendMsg || (error instanceof Error ? error.message : 'Error desconocido');
      showToast(`Error al guardar: ${msg}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel cara form
  const handleCancelCaraForm = () => {
    const wasEditing = !!editingCaraId;
    setNewCara(EMPTY_CARA);
    setSelectedArticulo(null);
    setArticuloBf(null);
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
    setLoadingCaraAction({ caraId: cara.localId, action: 'search' });
    setSelectedCaraForSearch(cara);
    setViewState('search-inventory');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setGroupByDistance(false);
    setSelectedInventory(new Set());
    setFlujoFilter(tipoPeriodo === 'mensual' ? 'Flujo' : 'Todos');
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

      const estadoParam = cara.estados === 'Ciudad de México / AM' ? 'Ciudad de México,Estado de México' : cara.estados;

      // Si Reserva Masiva está ON y la cara tiene grupo_masivo_id, usar rango total del grupo
      let fechaIniSearch = cara.inicio_periodo || undefined;
      let fechaFinSearch = cara.fin_periodo || undefined;
      if (reservaMasivaC && cara.grupo_masivo_id) {
        const grupo = caras.filter(c => c.grupo_masivo_id === cara.grupo_masivo_id && !c.esBf);
        const fechasIni = grupo.map(c => c.inicio_periodo).filter(Boolean).sort();
        const fechasFin = grupo.map(c => c.fin_periodo).filter(Boolean).sort();
        if (fechasIni.length) fechaIniSearch = fechasIni[0];
        if (fechasFin.length) fechaFinSearch = fechasFin[fechasFin.length - 1];
      }

      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: estadoParam || undefined,
        formato: cara.formato || undefined,
        // Don't filter by flujo in backend - get all and filter in frontend
        nse: cara.nivel_socioeconomico || undefined,
        tipo: cara.tipo || undefined,
        fecha_inicio: fechaIniSearch,
        fecha_fin: fechaFinSearch,
        solicitudCaraId: cara.id,
        excluir_mi_macro: tipoPeriodo === 'catorcena' ? 1 : undefined,
        excluir_categoria: excluirCategoria || undefined,
        excluir_distancia_km: excluirCategoria ? excluirDistanciaKm : undefined,
      });
      // CDMX/AM no incluye TOLUCA — el AM real son solo ciertos municipios de Edomex.
      // El back filtra por estado="Ciudad de México,Estado de México" y se cuela Toluca
      // porque vive en Edomex. Filtramos aquí para no traerlo en CDMX/AM.
      const isAM = cara.estados === 'Ciudad de México / AM';
      const data = (response.data || []).filter(inv =>
        !isAM || (inv.plaza || '').toUpperCase() !== 'TOLUCA'
      );
      setInventarioDisponible(data);
    } catch (error) {
      console.error('Error fetching disponibles:', error);
      setInventarioDisponible([]);
    } finally {
      setIsSearching(false);
      setLoadingCaraAction(null);
    }
  };

  // Re-search cuando se prende/apaga reserva masiva
  useEffect(() => {
    if (viewState === 'search-inventory' && selectedCaraForSearch?.grupo_masivo_id) {
      handleSearchInventory(selectedCaraForSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaMasivaC]);

  // Re-search cuando cambia exclusión por categoría o distancia
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

      let fechaIniSearch2 = selectedCaraForSearch.inicio_periodo || undefined;
      let fechaFinSearch2 = selectedCaraForSearch.fin_periodo || undefined;
      if (reservaMasivaC && selectedCaraForSearch.grupo_masivo_id) {
        const grupo = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && !c.esBf);
        const fechasIni = grupo.map(c => c.inicio_periodo).filter(Boolean).sort();
        const fechasFin = grupo.map(c => c.fin_periodo).filter(Boolean).sort();
        if (fechasIni.length) fechaIniSearch2 = fechasIni[0];
        if (fechasFin.length) fechaFinSearch2 = fechasFin[fechasFin.length - 1];
      }

      const response = await inventariosService.getDisponibles({
        ciudad: ciudadFilter,
        estado: estadoParam2 || undefined,
        formato: selectedCaraForSearch.formato || undefined,
        // Don't filter by flujo in backend - get all and filter in frontend
        nse: selectedCaraForSearch.nivel_socioeconomico || undefined,
        tipo: selectedCaraForSearch.tipo || undefined,
        fecha_inicio: fechaIniSearch2,
        fecha_fin: fechaFinSearch2,
        solicitudCaraId: selectedCaraForSearch.id,
        excluir_mi_macro: tipoPeriodo === 'catorcena' ? 1 : undefined,
        excluir_categoria: excluirCategoria || undefined,
        excluir_distancia_km: excluirCategoria ? excluirDistanciaKm : undefined,
      });
      // CDMX/AM no incluye TOLUCA — filtrar Toluca cuando la cara es AM.
      const isAM2 = selectedCaraForSearch.estados === 'Ciudad de México / AM';
      const data2 = (response.data || []).filter(inv =>
        !isAM2 || (inv.plaza || '').toUpperCase() !== 'TOLUCA'
      );
      setInventarioDisponible(data2);
    } catch (error) {
      console.error('Error fetching disponibles:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered and processed inventory data
  const processedInventory = useMemo((): ProcessedInventoryItem[] => {
    let data: ProcessedInventoryItem[] = [...inventarioDisponible];

    // Filter out items reserved ONLY for the current cara (not all caras)
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
      data = data.filter(inv => (inv as any).mundialista?.toUpperCase() === 'SI');
    } else if (mundialistaFilter === 'no') {
      data = data.filter(inv => !(inv as any).mundialista || (inv as any).mundialista.toUpperCase() !== 'SI');
    }

    // Filtros avanzados (embudo)
    if (disponiblesAdvFilters.length > 0) {
      data = applyAdvancedFilters(data as unknown as Record<string, unknown>[], disponiblesAdvFilters) as unknown as typeof data;
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
  }, [inventarioDisponible, disponiblesSearchTerm, poiFilterIds, flujoFilter, showOnlyUnicos, showOnlyCompletos, showOnlyUnicosDigitales, showSpotUnico, islaFilter, mundialistaFilter, disponiblesAdvFilters, groupByDistance, groupMode, filterUnicos, filterCompletos, filterUnicosDigitales, filterSpotUnico, groupByDistanceFunc, groupByListFunc, sortColumn, sortDirection, reservas]);

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
    setFlujoFilter(tipoPeriodo === 'mensual' ? 'Flujo' : 'Todos');
    setShowOnlyUnicos(false);
    setShowOnlyCompletos(false);
    setShowOnlyUnicosDigitales(false);
    setShowSpotUnico(false);
    setIslaFilter('off');
    setMundialistaFilter('off');
    setGroupByDistance(false);
    setPoiFilterIds(null);
    setDisponiblesSearchTerm('');
  }, [tipoPeriodo]);

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
    if (!selectedCaraForSearch) {
      showToast('Primero selecciona una cara para buscar inventario', 'error');
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        showToast('El CSV está vacío o no tiene datos', 'error');
        return;
      }

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

      const codigos = parsedData
        .map(row => {
          const c = getValueByColumnName(row, 'codigo_unico')
            || getValueByColumnName(row, 'codigo')
            || getValueByColumnName(row, 'código')
            || getValueByColumnName(row, 'código_único');
          return c?.trim() || '';
        })
        .filter(c => c.length > 0);

      if (codigos.length === 0) {
        showToast('No se encontraron códigos en el CSV. Revisa que la columna se llame "codigo_unico"', 'error');
        return;
      }

      setIsCheckingCsv(true);
      try {
        const fechaInicio = selectedCaraForSearch.inicio_periodo
          || campanaDetails?.fecha_inicio
          || new Date().toISOString();
        const fechaFin = selectedCaraForSearch.fin_periodo
          || campanaDetails?.fecha_fin
          || new Date().toISOString();
        const result = await inventariosService.checkCodigos({
          codigos,
          solicitudCaraId: selectedCaraForSearch.id ?? null,
          fechaInicio,
          fechaFin,
        });
        setCsvData(result.codigos);
        setShowCsvSection(true);
      } catch (error) {
        console.error('Error checking CSV codes:', error);
        showToast(
          `Error al verificar el CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          'error'
        );
      } finally {
        setIsCheckingCsv(false);
      }
    };

    reader.readAsText(file);
  }, [selectedCaraForSearch, campanaDetails, showToast]);

  const handleSelectFromCsv = useCallback(() => {
    const libresCodes = new Set(
      csvData
        .filter(row => row.estado === 'libre')
        .map(row => row.codigo_unico)
    );

    const newKeys = new Set<string>();
    processedInventory.forEach(inv => {
      if (inv.codigo_unico && libresCodes.has(inv.codigo_unico)) {
        newKeys.add(getInventoryKey(inv));
      }
    });
    setSelectedInventory(newKeys);
    setShowCsvSection(false);
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
          // Regular item - reserve based on tipo_de_cara.
          // Mensual = todo cuenta como Flujo (regla Gran Formato).
          const tipo: 'Flujo' | 'Contraflujo' = tipoPeriodo === 'mensual'
            ? 'Flujo'
            : (String(inv.tipo_de_cara).startsWith('Flujo') ? 'Flujo' : 'Contraflujo');
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
        const reasons: string[] = [];
        if (remainingToAssign.flujo <= 0 && remainingToAssign.contraflujo <= 0 && remainingToAssign.bonificacion <= 0) {
          reasons.push('Todas las caras (Flujo, Contraflujo y Bonificación) ya están completas');
        } else {
          if (remainingToAssign.flujo <= 0) reasons.push('Flujo ya está completo');
          if (remainingToAssign.contraflujo <= 0) reasons.push('Contraflujo ya está completo');
        }
        showToast(reasons.length > 0 ? reasons.join('. ') : 'No hay caras disponibles para reservar', 'error');
        return;
      }

      // Call API immediately
      setIsSaving(true);
      try {
        const clienteId = campanaDetails?.cliente_id ?? campana?.cliente_id;
        const fechaInicio = selectedCaraForSearch.inicio_periodo || campanaDetails?.fecha_inicio || new Date().toISOString();
        const fechaFin = selectedCaraForSearch.fin_periodo || campanaDetails?.fecha_fin || new Date().toISOString();

        if (clienteId === undefined || clienteId === null) throw new Error("Cliente ID no encontrado");

        // Replicar a todas las caras del grupo masivo si reservaMasivaC está ON
        const carasObjetivo = (reservaMasivaC && selectedCaraForSearch.grupo_masivo_id)
          ? caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && !c.esBf && c.id)
          : [selectedCaraForSearch];

        let totalReservasCreadas = 0;
        let totalReservasOmitidas = 0;
        for (const cTarget of carasObjetivo) {
          const fIni = cTarget.inicio_periodo || fechaInicio;
          const fFin = cTarget.fin_periodo || fechaFin;
          const result = await campanasService.createReservas(campana!.id, {
            reservas: newReservas,
            solicitudCaraId: cTarget.id!,
            clienteId,
            fechaInicio: fIni,
            fechaFin: fFin,
            agruparComoCompleto: shouldGroup,
          });
          totalReservasCreadas += result.reservasCreadas;
          totalReservasOmitidas += result.reservasOmitidas ?? 0;
        }

        queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] });
        queryClient.invalidateQueries({ queryKey: ['campana-inventario', campana!.id] }); // Refresh map
        queryClient.invalidateQueries({ queryKey: ['campanas'] });
        // Also refresh disponibles
        handleRefetchDisponibles();

        const sufijo = carasObjetivo.length > 1 ? ` en ${carasObjetivo.length} periodos` : '';
        if (totalReservasOmitidas > 0 && totalReservasCreadas === 0) {
          showToast(
            `No se reservó ningún espacio${sufijo}. ${totalReservasOmitidas} se omitieron porque ya estaban ocupados`,
            'error'
          );
        } else if (totalReservasOmitidas > 0) {
          showToast(
            `Se reservaron ${totalReservasCreadas} espacios${sufijo}. ${totalReservasOmitidas} se omitieron porque ya estaban ocupados`,
            'success'
          );
        } else {
          showToast(`Se guardaron ${totalReservasCreadas} reservas exitosamente${sufijo}`, 'success');
        }
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving reservas:', error);
        const axErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
        const backendMsg = axErr?.response?.data?.error || axErr?.response?.data?.message;
        const msg = backendMsg || (error instanceof Error ? error.message : 'Error desconocido');
        showToast(`Error al guardar: ${msg}`, 'error');
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
      // Hay pares pero NO está activo el filtro completos
      // Si reserva masiva está ON, igual confirmar (más reservas en juego)
      if (reservaMasivaC && selectedCaraForSearch?.grupo_masivo_id) {
        const grupoSize = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && !c.esBf && c.id).length;
        setConfirmModal({
          isOpen: true,
          title: 'Reserva Masiva',
          message: `Vas a crear ${selectedInventory.size * grupoSize} reservas (${selectedInventory.size} inventario${selectedInventory.size > 1 ? 's' : ''} × ${grupoSize} periodos del grupo masivo). ¿Confirmas?`,
          confirmText: `Reservar en ${grupoSize} periodos`,
          onConfirm: () => runReservation(false),
        });
      } else {
        runReservation(false);
      }
    } else {
      // Si reserva masiva está ON, mostrar mensaje específico de masiva
      if (reservaMasivaC && selectedCaraForSearch?.grupo_masivo_id) {
        const grupoSize = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && !c.esBf && c.id).length;
        setConfirmModal({
          isOpen: true,
          title: 'Reserva Masiva',
          message: `Vas a crear ${selectedInventory.size * grupoSize} reservas (${selectedInventory.size} inventario${selectedInventory.size > 1 ? 's' : ''} × ${grupoSize} periodos del grupo masivo). ¿Confirmas?`,
          confirmText: `Reservar en ${grupoSize} periodos`,
          onConfirm: () => runReservation(false),
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
    }
  };

  // Handle reserve as bonificacion - IMMEDIATE SAVE
  const handleReserveAsBonificacion = () => {
    if (!selectedCaraForSearch || selectedInventory.size === 0) return;
    if (selectedInventory.size > remainingToAssign.bonificacion) {
      showToast(`Solo puedes reservar ${remainingToAssign.bonificacion} caras de bonificación`, 'error');
      return;
    }

    // BF/CF/CT/IN: validar que la selección respete el split 50/50 (front-only).
    // Cuenta caras seleccionadas por tipo_de_cara físico y compara contra bonifFlujo/bonifContra restantes.
    if (isBonifSplitArticle(selectedCaraForSearch.articulo)) {
      const selectedItems = Array.from(selectedInventory)
        .map(invKey => processedInventory.find(i => getInventoryKey(i) === invKey))
        .filter(Boolean) as typeof processedInventory;
      const selFlujo = selectedItems.filter(i => String(i.tipo_de_cara).startsWith('Flujo')).length;
      const selContra = selectedItems.filter(i => String(i.tipo_de_cara).startsWith('Contraflujo')).length;
      const reasons: string[] = [];
      if (selFlujo > remainingToAssign.bonifFlujo) {
        reasons.push(`Seleccionaste ${selFlujo} de Flujo pero solo caben ${remainingToAssign.bonifFlujo} en Bonif. Flujo`);
      }
      if (selContra > remainingToAssign.bonifContra) {
        reasons.push(`Seleccionaste ${selContra} de Contraflujo pero solo caben ${remainingToAssign.bonifContra} en Bonif. Contraflujo`);
      }
      if (reasons.length > 0) {
        showToast(reasons.join('. '), 'error');
        return;
      }
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
        const clienteId = campanaDetails?.cliente_id ?? campana?.cliente_id;
        const fechaInicio = selectedCaraForSearch.inicio_periodo || campanaDetails?.fecha_inicio || new Date().toISOString();
        const fechaFin = selectedCaraForSearch.fin_periodo || campanaDetails?.fecha_fin || new Date().toISOString();

        if (clienteId === undefined || clienteId === null) throw new Error("Cliente ID no encontrado");

        // Replicar bonificación a todas las caras BF del grupo masivo si reservaMasivaC está ON
        const carasObjetivo = (reservaMasivaC && selectedCaraForSearch.grupo_masivo_id)
          ? caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && c.esBf && c.id)
          : [selectedCaraForSearch];

        let totalReservasCreadas = 0;
        let totalReservasOmitidas = 0;
        for (const cTarget of carasObjetivo) {
          const fIni = cTarget.inicio_periodo || fechaInicio;
          const fFin = cTarget.fin_periodo || fechaFin;
          const result = await campanasService.createReservas(campana!.id, {
            reservas: newReservas,
            solicitudCaraId: cTarget.id!,
            clienteId,
            fechaInicio: fIni,
            fechaFin: fFin,
            agruparComoCompleto: false,
          });
          totalReservasCreadas += result.reservasCreadas;
          totalReservasOmitidas += result.reservasOmitidas ?? 0;
        }

        queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] });
        queryClient.invalidateQueries({ queryKey: ['campana-inventario', campana!.id] });
        queryClient.invalidateQueries({ queryKey: ['campanas'] });
        handleRefetchDisponibles();

        const sufijo = carasObjetivo.length > 1 ? ` en ${carasObjetivo.length} periodos` : '';
        if (totalReservasOmitidas > 0 && totalReservasCreadas === 0) {
          showToast(
            `No se aplicó ninguna bonificación${sufijo}. ${totalReservasOmitidas} se omitieron porque ya estaban ocupadas`,
            'error'
          );
        } else if (totalReservasOmitidas > 0) {
          showToast(
            `Se aplicaron ${totalReservasCreadas} bonificaciones${sufijo}. ${totalReservasOmitidas} se omitieron porque ya estaban ocupadas`,
            'success'
          );
        } else {
          showToast(`Se guardaron ${totalReservasCreadas} bonificaciones exitosamente${sufijo}`, 'success');
        }
        setSelectedInventory(new Set());
      } catch (error) {
        console.error('Error saving bonificaciones:', error);
        const axErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
        const backendMsg = axErr?.response?.data?.error || axErr?.response?.data?.message;
        const msg = backendMsg || (error instanceof Error ? error.message : 'Error desconocido');
        showToast(`Error al guardar: ${msg}`, 'error');
      } finally {
        setIsSaving(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    };

    const isCT = (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT');
    // Si reserva masiva está ON, mostrar mensaje específico
    if (reservaMasivaC && selectedCaraForSearch?.grupo_masivo_id) {
      const grupoBfCount = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && c.esBf && c.id).length;
      setConfirmModal({
        isOpen: true,
        title: isCT ? 'Cortesía Masiva' : 'Bonificación Masiva',
        message: `Vas a crear ${selectedInventory.size * grupoBfCount} ${isCT ? 'cortesías' : 'bonificaciones'} (${selectedInventory.size} inventario${selectedInventory.size > 1 ? 's' : ''} × ${grupoBfCount} periodos del grupo masivo). ¿Confirmas?`,
        confirmText: `${isCT ? 'Cortesía' : 'Bonificar'} en ${grupoBfCount} periodos`,
        onConfirm: runBonificacion,
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: isCT ? 'Confirmar Cortesía' : 'Confirmar Bonificación',
        message: `¿Estás seguro de ${isCT ? 'asignar como cortesía' : 'bonificar'} ${selectedInventory.size} espacios?`,
        confirmText: isCT ? 'Cortesía' : 'Bonificar',
        onConfirm: runBonificacion,
      });
    }
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
      data = data.filter(r => r.isla?.toUpperCase().includes('ISLA'));
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
      const catorcenaKey = tipoPeriodo === 'mensual'
        ? `${MESES_LABEL[r.catorcena - 1] || `Mes ${r.catorcena}`} ${r.anio}`
        : `Cat ${r.catorcena}/${r.anio}`;
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
  }, [filteredReservados, tipoPeriodo]);

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
    // Block deletion if the selected cara has APS assigned
    if (selectedCaraAPSBlocked) {
      showToast('No se puede eliminar inventario de un grupo con APS asignado', 'error');
      return;
    }

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
            await campanasService.deleteReservas(campana!.id, backendIds);
            queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] });
            queryClient.invalidateQueries({ queryKey: ['campana-inventario', campana!.id] });
            queryClient.invalidateQueries({ queryKey: ['campanas'] });
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

    // Si Eliminar Masivo está ON y la cara dueña pertenece a un grupo masivo,
    // buscar las reservas equivalentes (mismo codigo_unico) en las demás caras del grupo
    let reservasAEliminar: typeof reservas = [reserva];
    let masivoLabel = '';
    if (eliminarMasivoC && reserva.solicitudCaraId) {
      const caraDuenia = caras.find(c => c.id === reserva.solicitudCaraId);
      if (caraDuenia?.grupo_masivo_id) {
        const carasGrupo = caras.filter(c => c.grupo_masivo_id === caraDuenia.grupo_masivo_id && c.id);
        const equivalentes = reservas.filter(r =>
          r.codigo_unico === reserva.codigo_unico &&
          carasGrupo.some(c => c.id === r.solicitudCaraId) &&
          r.reservaId
        );
        if (equivalentes.length > 1) {
          reservasAEliminar = equivalentes;
          masivoLabel = ` (${equivalentes.length} reservas en grupo masivo)`;
        }
      }
    }

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Reserva',
      message: `¿Seguro que quieres eliminar esta reserva${masivoLabel}?`,
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        setIsSaving(true);
        try {
          const ids = reservasAEliminar.map(r => r.reservaId!).filter(Boolean);
          await campanasService.deleteReservas(campana!.id, ids);
          queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] });
          queryClient.invalidateQueries({ queryKey: ['campana-inventario', campana!.id] });
          queryClient.invalidateQueries({ queryKey: ['campanas'] });
          handleRefetchDisponibles();

          const idsLocales = new Set(reservasAEliminar.map(r => r.id));
          setReservas(prev => prev.filter(r => !idsLocales.has(r.id)));
          showToast(`${reservasAEliminar.length} reserva(s) eliminada(s) correctamente`, 'success');
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
    // Block deletion if the selected cara has APS assigned
    if (selectedCaraAPSBlocked) {
      showToast('No se puede eliminar inventario de un grupo con APS asignado', 'error');
      return;
    }

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

    // Si Eliminar Masivo está ON, expandir cada reserva seleccionada con sus equivalentes
    // (mismo codigo_unico) en otras caras del grupo masivo
    let finalSelected = selectedReservasList;
    let masivoLabel = '';
    if (eliminarMasivoC) {
      const expanded = new Map<string, typeof selectedReservasList[0]>();
      for (const r of selectedReservasList) {
        expanded.set(r.id, r);
        if (r.solicitudCaraId) {
          const caraDuenia = caras.find(c => c.id === r.solicitudCaraId);
          if (caraDuenia?.grupo_masivo_id) {
            const carasGrupo = caras.filter(c => c.grupo_masivo_id === caraDuenia.grupo_masivo_id && c.id);
            const equivalentes = reservas.filter(r2 =>
              r2.codigo_unico === r.codigo_unico &&
              carasGrupo.some(c => c.id === r2.solicitudCaraId)
            );
            equivalentes.forEach(eq => expanded.set(eq.id, eq));
          }
        }
      }
      finalSelected = Array.from(expanded.values());
      const replicadas = finalSelected.length - selectedReservasList.length;
      if (replicadas > 0) masivoLabel = ` (+ ${replicadas} replicadas en grupo masivo)`;
    }

    // Separate reservas with backend IDs from those without
    const reservasWithBackendId = finalSelected.filter(r => r.reservaId);
    const reservasLocalOnly = finalSelected.filter(r => !r.reservaId);
    const backendIds = reservasWithBackendId.map(r => r.reservaId!);
    const finalIds = new Set(finalSelected.map(r => r.id));

    // If all are local-only (not saved to DB yet), just remove from state
    if (backendIds.length === 0) {
      setReservas(prev => prev.filter(r => !finalIds.has(r.id)));
      setSelectedReservados(new Set());
      showToast(`${finalSelected.length} reservas eliminadas${masivoLabel}`, 'success');
      return;
    }

    // Show confirmation for backend deletion
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Reservas',
      message: `¿Seguro que quieres eliminar ${finalSelected.length} reserva(s)?${masivoLabel}${reservasLocalOnly.length > 0 ? ` (${reservasLocalOnly.length} pendientes + ${backendIds.length} guardadas)` : ''}`,
      confirmText: 'Eliminar',
      isDestructive: true,
      onConfirm: async () => {
        setIsSaving(true);
        try {
          // Delete from backend if there are any with reservaId
          if (backendIds.length > 0) {
            await campanasService.deleteReservas(campana!.id, backendIds);
            queryClient.invalidateQueries({ queryKey: ['campana-reservas-modal', campana!.id] });
            queryClient.invalidateQueries({ queryKey: ['campana-inventario', campana!.id] });
            queryClient.invalidateQueries({ queryKey: ['campanas'] });
            handleRefetchDisponibles();
          }

          // Remove all selected from local state
          setReservas(prev => prev.filter(r => !finalIds.has(r.id)));
          setSelectedReservados(new Set());
          showToast(`${finalSelected.length} reserva(s) eliminada(s) correctamente${masivoLabel}`, 'success');
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
      <div className={`relative ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-6 w-[400px] animate-in fade-in zoom-in duration-200`}>
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
            className={`px-4 py-2 rounded-lg ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'} transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
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
                className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'} transition-colors`}
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
            <button onClick={handleBackToMain} className="p-2 rounded-lg text-zinc-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Compact KPIs with progress bars */}
          <div className="px-6 py-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900/90">
            <div className="flex items-center gap-4">
              {/* Si el artículo es BF/CF/CT/IN, el KPI normal de Flujo/Contraflujo se oculta:
                  esos artículos son 100% bonificación, y el KPI bonificación se renderiza más abajo
                  dividido en 2 (Bonif. Flujo / Bonif. Contraflujo). */}
              {!isBonifSplitArticle(selectedCaraForSearch?.articulo) && (
              <>
              {/* Flujo KPI */}
              <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isNoInventoryArticle(selectedCaraForSearch?.articulo || '') ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    {(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('IM') ? 'Impresiones' : isEspecialArticle(selectedCaraForSearch?.articulo || '') ? 'Ejec. Especiales' : 'Flujo'}
                  </span>
                  <span className="text-sm font-bold text-blue-400">
                    {adjustedCarasFlujo.flujo - remainingToAssign.flujo} / {adjustedCarasFlujo.flujo}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (adjustedCarasFlujo.flujo - remainingToAssign.flujo) / (adjustedCarasFlujo.flujo || 1) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="text-blue-400 font-medium">{remainingToAssign.flujo}</span> restantes
                </div>
              </div>

              {/* % Distribucion — para TODOS los tipos (Tradicional + Digital).
                  Cambiar el % actualiza caras_flujo / caras_contraflujo en BD para
                  que el target del KPI refleje la distribución elegida. */}
              {!!selectedCaraForSearch && (() => {
                // Distribución libre 0-100 (el usuario puede elegir cómo split
                // entre Flujo y Contraflujo; en Tradicional las reservas reales
                // siguen su propio conteo, esto solo cambia el target esperado).
                const minPct = 0;
                const maxPct = 100;
                return (
                <div className="flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-zinc-800/30 border border-zinc-700/20 min-w-[70px]">
                <span className="text-[9px] text-zinc-500 mb-1">Distribución</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={minPct}
                    max={maxPct}
                    value={flujoPct}
                    onChange={async (e) => {
                      const v = Math.max(minPct, Math.min(maxPct, parseInt(e.target.value) || 0));
                      setFlujoPct(v);
                      if (!selectedCaraForSearch?.id || !campana) return;
                      const totalRenta = selectedCaraForSearch.caras || ((selectedCaraForSearch.caras_flujo || 0) + (selectedCaraForSearch.caras_contraflujo || 0));
                      if (totalRenta === 0) return;
                      const newFlujo = Math.ceil(totalRenta * v / 100);
                      const newContra = totalRenta - newFlujo;
                      setSavingPct(true);
                      try {
                        await campanasService.updateCara(campana.id, selectedCaraForSearch.id, {
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
                    className="w-10 text-center text-xs font-bold bg-zinc-800 border-zinc-700 text-blue-400 border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                  <span className="text-[10px] text-zinc-500">%</span>
                </div>
                <span className="text-[9px] text-zinc-600 mt-0.5">{savingPct ? '...' : `${flujoPct}/${100 - flujoPct}`}</span>
              </div>
                );
              })()}

              {/* Contraflujo KPI — solo en catorcena */}
              {tipoPeriodo !== 'mensual' && (
                <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Contraflujo
                    </span>
                    <span className="text-sm font-bold text-blue-400">
                      {adjustedCarasFlujo.contraflujo - remainingToAssign.contraflujo} / {adjustedCarasFlujo.contraflujo}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (adjustedCarasFlujo.contraflujo - remainingToAssign.contraflujo) / (adjustedCarasFlujo.contraflujo || 1) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    <span className="text-blue-400 font-medium">{remainingToAssign.contraflujo}</span> restantes
                  </div>
                </div>
              )}
              </>
              )}

              {/* % Distribución para BF/CF/CT (todos los tipos — Tradicional y Digital).
                  Front-only: solo mueve flujoPct local que alimenta bonifSplit.
                  NO escribe caras_flujo/caras_contraflujo en BD (regla Balance Flujos:
                  la bonificación se queda como total en BD, el split es visual).
                  La validación de completitud cuenta solo el TOTAL de bonif, no el ratio. */}
              {isBonifSplitArticle(selectedCaraForSearch?.articulo) && (
                <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-xl ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50/30'} border ${isDark ? 'border-zinc-700/20' : 'border-gray-200/20'} min-w-[70px]`}>
                  <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1`}>Distribución</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={flujoPct}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        setFlujoPct(v);
                      }}
                      className={`w-10 text-center text-xs font-bold ${isDark ? 'bg-zinc-800 border-zinc-700 text-cyan-400' : 'bg-white border-gray-200 text-cyan-600'} border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50`}
                    />
                    <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>%</span>
                  </div>
                  <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-gray-300'} mt-0.5`}>{flujoPct}/{100 - flujoPct}</span>
                </div>
              )}

              {/* Bonificación/Cortesía KPI — para BF/CF/CT se divide en 2 KPIs (Bonif. Flujo / Bonif. Contraflujo).
                  El total y el botón de reservar siguen creando reservas con tipo='Bonificacion' en BD.
                  Para artículos no-split (ej. RT/DIG con bonificación opcional) se muestra el KPI único como antes. */}
              {isBonifSplitArticle(selectedCaraForSearch?.articulo) ? (
                <>
                  {(() => {
                    const isCT = (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT');
                    const label = isCT ? 'Cortesía' : 'Bonificación';
                    const dotColor = isCT ? 'bg-cyan-500' : 'bg-emerald-500';
                    const textColor = isCT ? 'text-cyan-400' : 'text-emerald-400';
                    const gradientFrom = isCT ? 'from-cyan-500' : 'from-emerald-500';
                    const gradientTo = isCT ? 'to-cyan-400' : 'to-emerald-400';
                    const reservadoFlujo = bonifSplit.reservadoFlujo;
                    const reservadoContra = bonifSplit.reservadoContra;
                    const targetFlujo = bonifSplit.targetFlujo;
                    const targetContra = bonifSplit.targetContra;
                    return (
                      <>
                        {/* Bonif. Flujo */}
                        <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                              {label} Flujo
                            </span>
                            <span className={`text-sm font-bold ${textColor}`}>
                              {reservadoFlujo} / {targetFlujo}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full transition-all`}
                              style={{ width: `${Math.min(100, reservadoFlujo / (targetFlujo || 1) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            <span className={`${textColor} font-medium`}>{Math.max(0, targetFlujo - reservadoFlujo)}</span> restantes
                          </div>
                        </div>
                        {/* Bonif. Contraflujo */}
                        <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                              {label} Contraflujo
                            </span>
                            <span className={`text-sm font-bold ${textColor}`}>
                              {reservadoContra} / {targetContra}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full transition-all`}
                              style={{ width: `${Math.min(100, reservadoContra / (targetContra || 1) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            <span className={`${textColor} font-medium`}>{Math.max(0, targetContra - reservadoContra)}</span> restantes
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
                      {(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}
                    </span>
                    <span className={`text-sm font-bold ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      {(selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion} / {selectedCaraForSearch?.bonificacion || 0}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'from-cyan-500 to-cyan-400' : 'from-emerald-500 to-emerald-400'} rounded-full transition-all`}
                      style={{ width: `${Math.min(100, ((selectedCaraForSearch?.bonificacion || 0) - remainingToAssign.bonificacion) / (selectedCaraForSearch?.bonificacion || 1) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    <span className={`${(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'text-cyan-400' : 'text-emerald-400'} font-medium`}>{remainingToAssign.bonificacion}</span> restantes
                  </div>
                </div>
              )}

              {/* Selection count */}
              <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 min-w-[100px]">
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span className="text-xl font-bold text-purple-300">{searchViewTab === 'buscar' ? selectedInventory.size : currentCaraReservas.length}</span>
                </div>
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{searchViewTab === 'buscar' ? 'seleccionados' : 'reservados'}</span>
              </div>
            </div>
          </div>

          {/* Tabs: Buscar / Reservados */}
          <div className={`px-6 py-2 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-gray-200 bg-gray-50/70'}`}>
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
                  <span className={`px-1.5 py-0.5 ${isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'} rounded-full text-xs`}>
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
              <div className={`px-6 py-2.5 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Flujo Toggle — para mensual solo Flujo (no Contraflujo) */}
                  {tipoPeriodo === 'mensual' ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isDark ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                      <span className="text-[10px] uppercase font-semibold text-blue-400">Flujo</span>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>(mensual)</span>
                    </div>
                  ) : (
                    <div className={`flex ${isDark ? 'bg-zinc-800/80 border-zinc-700/50' : 'bg-gray-100 border-gray-200'} rounded-lg p-0.5 border`}>
                      {(['Todos', 'Flujo', 'Contraflujo'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFlujoFilter(opt)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${flujoFilter === opt
                            ? 'bg-blue-500 text-white shadow'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="w-px h-6 bg-zinc-700" />

                  {/* Complete filter — solo aplica en catorcena (Flujo+Contraflujo). En mensual no tiene sentido. */}
                  {tipoPeriodo !== 'mensual' && (
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
                  )}

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

                  {/* Spot único filter - only show when there are digital items */}
                  {hasDigitalInventory && (
                    <button
                      onClick={() => setShowSpotUnico(!showSpotUnico)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${showSpotUnico
                        ? 'bg-violet-500 text-white shadow'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
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

                  {/* Filtros avanzados (embudo) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDisponiblesAdvFilters(!showDisponiblesAdvFilters)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${disponiblesAdvFilters.length > 0
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white'
                        }`}
                      title="Filtros avanzados"
                    >
                      <Funnel className="h-3.5 w-3.5" />
                      Filtrar
                      {disponiblesAdvFilters.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-800 text-white">
                          {disponiblesAdvFilters.length}
                        </span>
                      )}
                    </button>
                    {showDisponiblesAdvFilters && (
                      <div className="absolute left-0 top-full mt-1 z-[100] w-[540px] bg-zinc-900 border border-purple-500/30 rounded-xl shadow-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-300">Filtros avanzados</span>
                          <button
                            onClick={() => setShowDisponiblesAdvFilters(false)}
                            className="text-zinc-500 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-visible pr-1">
                          {disponiblesAdvFilters.map((filter, index) => (
                            <div key={filter.id} className="flex items-center gap-2">
                              {index > 0 ? (
                                <button
                                  onClick={() => {
                                    const updated = [...disponiblesAdvFilters];
                                    updated[index] = { ...updated[index], connector: updated[index].connector === 'Y' ? 'O' : 'Y' };
                                    setDisponiblesAdvFilters(updated);
                                  }}
                                  className={`text-[10px] font-bold w-8 rounded px-1 py-0.5 transition-colors ${filter.connector === 'O' ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'}`}
                                  title={`Click para cambiar a ${filter.connector === 'Y' ? 'O' : 'Y'}`}
                                >
                                  {filter.connector || 'Y'}
                                </button>
                              ) : (<span className="w-8"></span>)}
                              <select
                                value={filter.field}
                                onChange={(e) => {
                                  const updated = [...disponiblesAdvFilters];
                                  updated[index] = { ...updated[index], field: e.target.value };
                                  setDisponiblesAdvFilters(updated);
                                }}
                                className="w-[130px] text-xs bg-zinc-800 border-zinc-700 text-white border rounded px-2 py-1.5"
                              >
                                {FILTER_FIELDS_DISPONIBLES.map((f) => (
                                  <option key={f.field} value={f.field}>{f.label}</option>
                                ))}
                              </select>
                              <select
                                value={filter.operator}
                                onChange={(e) => {
                                  const updated = [...disponiblesAdvFilters];
                                  updated[index] = { ...updated[index], operator: e.target.value as FilterOperator };
                                  setDisponiblesAdvFilters(updated);
                                }}
                                className="w-[110px] text-xs bg-zinc-800 border-zinc-700 text-white border rounded px-2 py-1.5"
                              >
                                {FILTER_OPERATORS.filter(op => {
                                  const fieldConfig = FILTER_FIELDS_DISPONIBLES.find(f => f.field === filter.field);
                                  return fieldConfig && op.forTypes.includes(fieldConfig.type);
                                }).map((op) => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={filter.value}
                                placeholder="Valor..."
                                onChange={(e) => {
                                  const updated = [...disponiblesAdvFilters];
                                  updated[index] = { ...updated[index], value: e.target.value };
                                  setDisponiblesAdvFilters(updated);
                                }}
                                className="flex-1 text-xs bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 border rounded px-2 py-1.5"
                              />
                              <button
                                onClick={() => setDisponiblesAdvFilters(disponiblesAdvFilters.filter(f => f.id !== filter.id))}
                                className="text-zinc-500 hover:text-red-400"
                                title="Eliminar filtro"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50">
                          <button
                            onClick={() => {
                              const newFilter: AdvancedFilterCondition = {
                                id: `f-${Date.now()}`,
                                field: 'codigo_unico',
                                operator: 'contains',
                                value: '',
                                connector: 'Y',
                              };
                              setDisponiblesAdvFilters([...disponiblesAdvFilters, newFilter]);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar filtro
                          </button>
                          {disponiblesAdvFilters.length > 0 && (
                            <button
                              onClick={() => setDisponiblesAdvFilters([])}
                              className="text-xs text-zinc-500 hover:text-white"
                            >
                              Limpiar todos
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Grouping */}
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
                      <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
                        <button
                          onClick={() => setGroupMode('distancia')}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupMode === 'distancia' ? 'bg-green-500/30 text-green-300' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Distancia
                        </button>
                        <button
                          onClick={() => setGroupMode('listado')}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupMode === 'listado' ? 'bg-green-500/30 text-green-300' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Listado
                        </button>
                      </div>
                      {groupMode === 'distancia' && (
                        <select
                          value={distanciaGrupos}
                          onChange={(e) => setDistanciaGrupos(parseInt(e.target.value))}
                          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                        className="w-14 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                    disabled={isCheckingCsv}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${csvFile
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-white hover:bg-zinc-700'
                      }`}
                  >
                    <FileText className={`h-3.5 w-3.5 ${isCheckingCsv ? 'animate-pulse' : ''}`} />
                    {isCheckingCsv ? 'Verificando...' : (csvFile ? csvFile.name.substring(0, 15) + '...' : 'Subir CSV')}
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

                  {/* Toggle Reserva Masiva (solo si la cara tiene grupo masivo) */}
                  {selectedCaraForSearch?.grupo_masivo_id && (() => {
                    const grupo = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id && !c.esBf);
                    return (
                      <label className={`flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded-lg border ${reservaMasivaC ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                        <span>Reserva masiva ({grupo.length} periodos)</span>
                        <button
                          type="button"
                          onClick={() => setReservaMasivaC(!reservaMasivaC)}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${reservaMasivaC ? 'bg-purple-500' : 'bg-zinc-700'}`}
                          title="Filtra inventario disponible en TODO el rango y replica cada reserva a las caras del grupo"
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${reservaMasivaC ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    );
                  })()}

                  {/* Exclusión por categoría de cliente — esconde inventario
                      cercano a piezas reservadas por clientes de una categoría
                      X dentro del radio elegido (Haversine en back). */}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${excluirCategoria ? 'bg-amber-500/15 border-amber-500/40' : 'bg-zinc-800 border-zinc-700'}`} title="Excluye inventario disponible que esté cerca de piezas reservadas por clientes de la categoría seleccionada.">
                    <span className={`text-[10px] uppercase ${excluirCategoria ? 'text-amber-300' : 'text-zinc-500'}`}>Excluir cat.</span>
                    <select
                      value={excluirCategoria}
                      onChange={(e) => setExcluirCategoria(e.target.value)}
                      className="px-1.5 py-0.5 rounded text-xs border-0 focus:ring-1 focus:ring-amber-500/50 bg-zinc-900 text-zinc-200"
                    >
                      <option value="">— ninguna —</option>
                      {(categoriasCliente || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {excluirCategoria && (
                      <select
                        value={excluirDistanciaKm}
                        onChange={(e) => setExcluirDistanciaKm(Number(e.target.value))}
                        className="px-1.5 py-0.5 rounded text-xs border-0 focus:ring-1 focus:ring-amber-500/50 bg-zinc-900 text-amber-300"
                        title="Distancia mínima al inventario excluido"
                      >
                        <option value={0.5}>500 m</option>
                        <option value={1}>1 km</option>
                        <option value={1.5}>1.5 km</option>
                        <option value={2}>2 km</option>
                        <option value={2.5}>2.5 km</option>
                        <option value={3}>3 km</option>
                      </select>
                    )}
                    {excluirCategoria && (
                      <button
                        type="button"
                        onClick={() => setExcluirCategoria('')}
                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400"
                        title="Quitar filtro de exclusión"
                      >
                        <X className="h-3 w-3" />
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
              {showCsvSection && csvData.length > 0 && (() => {
                const libres = csvData.filter(d => d.estado === 'libre').length;
                const yaReservadas = csvData.filter(d => d.estado === 'ya_reservado_para_cara').length;
                const ocupadas = csvData.filter(d => d.estado === 'ocupado').length;
                const noExisten = csvData.filter(d => d.estado === 'no_existe').length;
                return (
                  <div className="px-6 py-3 border-b border-zinc-800 bg-orange-500/5">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-orange-300">Resultados del CSV</span>
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="text-emerald-400">{libres} libres</span>
                          {yaReservadas > 0 && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-blue-400">{yaReservadas} ya reservadas</span>
                            </>
                          )}
                          {ocupadas > 0 && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-amber-400">{ocupadas} ocupadas</span>
                            </>
                          )}
                          {noExisten > 0 && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="text-red-400">{noExisten} no existen</span>
                            </>
                          )}
                          <span className={isDark ? 'text-zinc-500' : 'text-gray-500'}>
                            ({csvData.length} total)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={handleSelectFromCsv}
                          disabled={libres === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <Target className="h-3.5 w-3.5" />
                          Seleccionar libres ({libres})
                        </button>
                        <button
                          onClick={() => setShowCsvSection(false)}
                          className="p-1.5 text-zinc-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                      {csvData.map((item, idx) => {
                        const styles = item.estado === 'libre'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : item.estado === 'ya_reservado_para_cara'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : item.estado === 'ocupado'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30';
                        return (
                          <span
                            key={idx}
                            title={item.mensaje}
                            className={`px-2 py-1 rounded text-xs font-mono border cursor-help ${styles}`}
                          >
                            {item.codigo_unico}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                        <thead className={`${isDark ? 'bg-zinc-800/50' : 'bg-gray-100'} sticky top-0`}>
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
                              className="px-3 py-2 text-left text-xs text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort('sentido')}
                            >
                              <div className="flex items-center gap-1">
                                Sentido
                                {sortColumn === 'sentido' && (
                                  sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                                {sortColumn !== 'sentido' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
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
                                  <td colSpan={hasDigitalInventory ? 8 : 7} className="px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      {expandedGroups.has(groupName) ? (
                                        <ChevronDown className="h-4 w-4 text-purple-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-purple-400" />
                                      )}
                                      <span className="text-sm font-medium text-white">{groupName}</span>
                                      <span className={`px-2 py-0.5 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded-full text-xs`}>
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
                                        {inv.tradicional_digital === 'Digital' ? (
                                          <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs">
                                            Sin límite
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
                                    <td className="px-3 py-2 text-zinc-300 text-sm">{inv.plaza}</td>
                                    <td className="px-3 py-2 text-zinc-400 text-sm">{inv.isla || '-'}</td>
                                    <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{(inv as any).mueble_isla || '-'}</td>
                                    <td className="px-3 py-2 text-zinc-400 text-sm">{(inv as any).sentido || '-'}</td>
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
                                    {inv.tradicional_digital === 'Digital' ? (
                                      <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs">
                                        Sin límite
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
                                <td className="px-3 py-2 text-zinc-300 text-sm">{inv.plaza}</td>
                                <td className="px-3 py-2 text-zinc-400 text-sm">{inv.isla || '-'}</td>
                                <td className={`px-3 py-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'} text-sm`}>{(inv as any).mueble_isla || '-'}</td>
                                <td className="px-3 py-2 text-zinc-400 text-sm">{(inv as any).sentido || '-'}</td>
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
                  <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'} space-y-3`}>
                    <div className="flex items-center gap-3">
                      {/* Para BF/CF/CT/IN se oculta "Reservar" — solo aplica el botón de Bonificación/Cortesía */}
                      {!isBonifSplitArticle(selectedCaraForSearch?.articulo) && (
                      <button
                        onClick={handleReservar}
                        disabled={isSaving || selectedInventory.size === 0 || (remainingToAssign.flujo <= 0 && remainingToAssign.contraflujo <= 0)}
                        className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'}`}
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
                      )}
                      {!isNoInventoryArticle(selectedCaraForSearch?.articulo || '') && <button
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
                    <div className={`flex items-center justify-center h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
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
                    {/* Toggle Eliminar Masivo (visible si la cara seleccionada tiene grupo masivo) */}
                    {selectedCaraForSearch?.grupo_masivo_id && (() => {
                      const grupo = caras.filter(c => c.grupo_masivo_id === selectedCaraForSearch.grupo_masivo_id);
                      return (
                        <label className={`flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded-lg border ${eliminarMasivoC ? 'bg-red-500/20 border-red-500/40 text-red-300' : (isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-700')}`}>
                          <span>Eliminar masivo ({grupo.length} periodos)</span>
                          <button
                            type="button"
                            onClick={() => setEliminarMasivoC(!eliminarMasivoC)}
                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${eliminarMasivoC ? 'bg-red-500' : (isDark ? 'bg-zinc-700' : 'bg-gray-300')}`}
                            title="Al eliminar una reserva, replica el delete a las equivalentes (mismo inventario) en otras caras del grupo masivo"
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${eliminarMasivoC ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </button>
                        </label>
                      );
                    })()}
                    {effectiveCanEdit && selectedReservados.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded-full">
                          {selectedReservados.size} seleccionados
                        </span>
                        <button
                          onClick={handleBulkDeleteReservas}
                          disabled={selectedCaraAPSBlocked}
                          className={`flex items-center gap-1 px-2 py-1 border rounded-lg text-xs transition-colors ${selectedCaraAPSBlocked ? 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30 cursor-not-allowed' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'}`}
                          title={selectedCaraAPSBlocked ? 'Grupo con APS asignado - no se puede eliminar' : 'Eliminar seleccionados'}
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
                    <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
                      {(['Todos', 'Flujo', 'Contraflujo', 'Bonificacion'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setReservadosTipoFilter(opt)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${reservadosTipoFilter === opt
                            ? opt === 'Todos' ? 'bg-zinc-600 text-white shadow'
                              : opt === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500 text-white shadow' : 'bg-emerald-500 text-white shadow')
                              : 'bg-blue-500 text-white shadow'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                          }`}
                        >
                          {opt === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonif.') : opt === 'Flujo' && isNoInventoryArticle(selectedCaraForSearch?.articulo || '') ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('IM') ? 'Impresiones' : 'Ejec. Especiales') : opt}
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
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
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
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
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
                        <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
                          <button
                            onClick={() => setGroupModeReservados('distancia')}
                            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupModeReservados === 'distancia' ? 'bg-green-500/30 text-green-300' : 'text-zinc-400 hover:text-white'}`}
                          >
                            Distancia
                          </button>
                          <button
                            onClick={() => setGroupModeReservados('listado')}
                            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${groupModeReservados === 'listado' ? 'bg-green-500/30 text-green-300' : 'text-zinc-400 hover:text-white'}`}
                          >
                            Listado
                          </button>
                        </div>
                        {groupModeReservados === 'distancia' && (
                          <select
                            value={distanciaGruposReservados}
                            onChange={(e) => setDistanciaGruposReservados(parseInt(e.target.value))}
                            className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                          className="w-14 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                          min={2}
                          max={50}
                          title="Tamaño de grupo"
                        />
                      </>
                    )}

                    {/* Sort */}
                    <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1">
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Ordenar:</span>
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

                    {/* Toggle Grouped/Flat View */}
                    <button
                      onClick={() => setShowReservasFlatList(!showReservasFlatList)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        showReservasFlatList
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white'
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
                    )}

                    {/* Download CSV Reservados */}
                    <button
                      onClick={() => {
                        if (filteredReservados.length === 0) return;
                        const headers = ['Código', 'Tipo', 'Plaza', 'Formato', 'Ubicación', 'Isla'];
                        const rows = filteredReservados.map(r => [
                          r.codigo_unico || '', r.tipo || '', r.plaza || '', r.formato || '', r.ubicacion || '', r.isla || ''
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`));
                        const csv = '﻿' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
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
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                    <Layers className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay reservas</p>
                    <p className="text-sm">Agrega inventarios desde la pestaña "Buscar Disponibles"</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <table className="w-full">
                      <thead className={`sticky top-0 ${isDark ? 'bg-zinc-900/95' : 'bg-white/95'} backdrop-blur-sm z-10`}>
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
                                className="bg-zinc-800/70 cursor-pointer hover:bg-zinc-800"
                                onClick={() => toggleGroupExpansionReservados(groupName)}
                              >
                                <td colSpan={effectiveCanEdit ? 7 : 6} className="px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    {expandedGroupsReservados.has(groupName) ? (
                                      <ChevronDown className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-green-400" />
                                    )}
                                    <span className="text-sm font-medium text-white">{groupName}</span>
                                    <span className={`px-2 py-0.5 ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'} rounded-full text-xs`}>
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
                                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer ${
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
                                    <span className="text-sm text-white font-medium">{reserva.codigo_unico}</span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                      {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-zinc-300">{reserva.formato}</td>
                                  <td className="px-4 py-2 text-sm text-zinc-400">{reserva.isla || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-zinc-400">{reserva.plaza}</td>
                                  {effectiveCanEdit && (
                                    <td className="px-4 py-2 text-center">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (!selectedCaraAPSBlocked) handleRemoveReserva(reserva.id); }}
                                        disabled={selectedCaraAPSBlocked}
                                        className={`p-1.5 rounded-lg transition-colors ${selectedCaraAPSBlocked ? 'bg-zinc-500/10 text-zinc-500 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                                        title={selectedCaraAPSBlocked ? 'Grupo con APS asignado - no se puede eliminar' : 'Eliminar'}
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
                              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer ${
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
                                <span className="text-sm text-white font-medium">{reserva.codigo_unico}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  reserva.tipo === 'Bonificacion' ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300') : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-zinc-300">{reserva.formato}</td>
                              <td className="px-4 py-2 text-sm text-zinc-400">{reserva.isla || '-'}</td>
                              <td className="px-4 py-2 text-sm text-zinc-400">{reserva.plaza}</td>
                              {effectiveCanEdit && (
                                <td className="px-4 py-2 text-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (!selectedCaraAPSBlocked) handleRemoveReserva(reserva.id); }}
                                    disabled={selectedCaraAPSBlocked}
                                    className={`p-1.5 rounded-lg transition-colors ${selectedCaraAPSBlocked ? 'bg-zinc-500/10 text-zinc-500 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                                    title={selectedCaraAPSBlocked ? 'Grupo con APS asignado - no se puede eliminar' : 'Eliminar'}
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
                                  className="bg-zinc-800/90 cursor-pointer hover:bg-zinc-800"
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
                                      <span className="text-sm font-semibold text-white">{catKey}</span>
                                      <span className={`px-2 py-0.5 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded-full text-xs`}>
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
                                      <td colSpan={7} className="px-3 py-2 pl-8">
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
                                            <td colSpan={7} className="px-3 py-2 pl-14">
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
                                                  <td colSpan={7} className="px-3 py-2 pl-20">
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
                                                            ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300')
                                                            : 'bg-amber-500/20 text-amber-300'
                                                          }`}>
                                                          {reserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : reserva.tipo}
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
                                                          onClick={() => { if (!selectedCaraAPSBlocked) handleRemoveReserva(reserva.id); }}
                                                          disabled={selectedCaraAPSBlocked}
                                                          className={`p-1.5 rounded-lg transition-colors ${selectedCaraAPSBlocked ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'}`}
                                                          title={selectedCaraAPSBlocked ? 'Grupo con APS asignado - no se puede eliminar' : 'Quitar reserva'}
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
                  <div className={`absolute right-0 top-0 bottom-0 w-80 ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'} border-l shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200`}>
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-between`}>
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Editar Reserva</h3>
                      <button
                        onClick={handleCancelEdit}
                        className={`p-1.5 rounded-lg ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} transition-colors`}
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
                            ? ((selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300')
                            : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {editingReserva.tipo === 'Bonificacion' && (selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : editingReserva.tipo}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1.5">Plaza</label>
                        <input
                          type="text"
                          value={editingPlaza}
                          onChange={(e) => setEditingPlaza(e.target.value)}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                          placeholder="Ej: CDMX, GDL, MTY..."
                        />
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
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
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
                        className={`flex-1 px-4 py-2 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} rounded-lg text-sm font-medium transition-colors`}
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
                  <div className={`p-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          <span className="text-blue-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Flujo').length}</span> Flujo
                        </span>
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          <span className="text-blue-400 font-medium">{currentCaraReservas.filter(r => r.tipo === 'Contraflujo').length}</span> Contraflujo
                        </span>
                        <span className={`${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
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
                    <div className={`absolute bottom-4 right-3 z-10 ${isDark ? 'bg-zinc-900/95 border-zinc-700 text-zinc-300' : 'bg-white/95 border-gray-200 text-gray-700'} border rounded-lg p-3 text-xs max-w-[200px]`}>
                      <div className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} font-semibold mb-2 flex items-center gap-1.5`}>
                        <MapPin className="h-3.5 w-3.5 text-purple-400" />
                        Leyenda del Mapa
                      </div>

                      {/* Dirección del tráfico */}
                      <div className="space-y-1.5 mb-2">
                        <div className="text-zinc-500 text-[10px] uppercase tracking-wide">Dirección del tráfico</div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 ring-1 ring-blue-400/30" />
                          <span className="text-zinc-300">Flujo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-cyan-500 ring-1 ring-cyan-400/30" />
                          <span className="text-zinc-300">Contraflujo</span>
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
                            <span className="text-zinc-300">{(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
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
          hasChanges ? 'cambios en la campaña' : '',
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
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Propuesta #{campana!.id}</p>
          </div>
          <div className="flex items-center gap-3">

            <button onClick={handleClose} className="p-2 rounded-lg text-zinc-400 hover:text-white">
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
              {/* Section 1: Campaña Summary */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-2xl border overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-gray-200 bg-gray-100/50'}`}>
                  <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <FileText className="h-4 w-4 text-purple-400" />
                    Resumen de Campaña
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
                              <span>{campanaDetails?.cuic ? `${(campanaDetails as any)?.T2_U_Marca || (campanaDetails as any)?.marca_nombre || ''} (CUIC: ${campanaDetails.cuic})` : 'Seleccionar CUIC'}</span>
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
                                    className={`w-full pl-9 pr-3 py-2 text-sm ${isDark ? 'bg-zinc-800' : 'bg-gray-50'} ${isDark ? 'border-zinc-700' : 'border-gray-200'} ${isDark ? 'text-white' : 'text-gray-900'} placeholder:${isDark ? 'text-zinc-500' : 'text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
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
                                      <div className="flex items-center justify-between">
                                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.T2_U_Marca || 'Sin marca'}</div>
                                        {item.sap_database && (
                                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                                            item.sap_database === 'CIMU' ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200' :
                                            item.sap_database === 'TEST' ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200' :
                                            item.sap_database === 'TRADE' ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            isDark ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' : 'bg-gray-50 text-gray-700 border-gray-200'
                                          }`}>{item.sap_database}</span>
                                        )}
                                      </div>
                                      <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.CUIC} | {item.T2_U_Producto || 'Sin producto'} | {item.T0_U_RazonSocial || ''}</div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CUIC</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.CUIC : (campanaDetails?.cuic || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Razón Social</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} truncate`}>
                            {selectedClienteCuic ? selectedClienteCuic.T0_U_RazonSocial : ((campanaDetails as any)?.T0_U_RazonSocial || (campanaDetails as any)?.razon_social || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Marca</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.T2_U_Marca : ((campanaDetails as any)?.T2_U_Marca || (campanaDetails as any)?.marca_nombre || '-')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Asesor</label>
                          <div className={`px-3 py-2 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50/50'} rounded-lg text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} border ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'}`}>
                            {selectedClienteCuic ? selectedClienteCuic.ASESOR_U_Asesor : ((campanaDetails as any)?.T0_U_Asesor || (campanaDetails as any)?.asesor || '-')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>CUIC</label>
                        <div className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/30' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {campanaDetails?.cuic || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Razón Social</label>
                        <div className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/30' : 'bg-gray-100 text-gray-700 border-gray-200'} truncate`}>
                          {(campanaDetails as any)?.T0_U_RazonSocial || (campanaDetails as any)?.razon_social || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Marca</label>
                        <div className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/30' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {(campanaDetails as any)?.T2_U_Marca || (campanaDetails as any)?.marca_nombre || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Asesor</label>
                        <div className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/30' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {(campanaDetails as any)?.T0_U_Asesor || (campanaDetails as any)?.asesor || '-'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Nombre de Campaña</label>
                      <input
                        type="text"
                        value={nombreCampania}
                        onChange={(e) => canEditResumen && setNombreCampania(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Nombre de la campaña"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Asignados</label>
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
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
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
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-700 border-purple-300'}`}
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
                        <div className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/30' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          Sin asignados
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Period - Same style as EditSolicitudModal */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Inicio</label>
                      <select
                        value={yearInicio || ''}
                        onChange={(e) => canEditResumen && (setYearInicio(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaInicio(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {yearInicioOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{tipoPeriodo === 'mensual' ? 'Mes Inicio' : 'Cat. Inicio'}</label>
                      <select
                        value={catorcenaInicio || ''}
                        onChange={(e) => canEditResumen && setCatorcenaInicio(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearInicio}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasInicioOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            {tipoPeriodo === 'mensual' ? (MESES_LABEL[c.numero_catorcena - 1] || `Mes ${c.numero_catorcena}`) : `Cat. ${c.numero_catorcena}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Año Fin</label>
                      <select
                        value={yearFin || ''}
                        onChange={(e) => canEditResumen && (setYearFin(e.target.value ? parseInt(e.target.value) : undefined), setCatorcenaFin(undefined))}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {yearFinOptions.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{tipoPeriodo === 'mensual' ? 'Mes Fin' : 'Cat. Fin'}</label>
                      <select
                        value={catorcenaFin || ''}
                        onChange={(e) => canEditResumen && setCatorcenaFin(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!canEditResumen || !yearFin}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 ${!canEditResumen ? 'cursor-not-allowed' : ''}`}
                      >
                        <option value="">Seleccionar</option>
                        {catorcenasFinOptions.map(c => (
                          <option key={c.id} value={c.numero_catorcena}>
                            {tipoPeriodo === 'mensual' ? (MESES_LABEL[c.numero_catorcena - 1] || `Mes ${c.numero_catorcena}`) : `Cat. ${c.numero_catorcena}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes and Description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Notas Dirección</label>
                      <textarea
                        value={notas}
                        onChange={(e) => canEditResumen && setNotas(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Descripción Trafico</label>
                      <textarea
                        value={descripcion}
                        onChange={(e) => canEditResumen && setDescripcion(e.target.value)}
                        disabled={!canEditResumen}
                        className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none h-20 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="Descripción de la campaña..."
                      />
                    </div>
                  </div>

                  {/* Archivo section - Same style as EditSolicitudModal */}
                  <div className="space-y-2">
                    <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Archivo (opcional)</label>
                    <input
                      ref={archivoInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleArchivoUpload}
                    />
                    {archivoCampana ? (
                      <div className="flex items-center gap-3 p-3 bg-zinc-800 border border-emerald-500/30 rounded-xl">
                        {/* Preview - image or file icon */}
                        {tipoArchivoCampana?.startsWith('image/') ? (
                          <a
                            href={archivoCampana}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={archivoCampana}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ) : (
                          <a
                            href={archivoCampana}
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
                          <div className="text-xs text-zinc-500 truncate">{tipoArchivoCampana || 'Archivo'}</div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <a
                            href={archivoCampana}
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
                                onClick={() => { setArchivoCampana(null); setTipoArchivoCampana(null); }}
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

                  {/* Pending changes indicator for campaign summary */}
                  {canEditResumen && hasChanges && (
                    <div className={`flex items-center gap-2 pt-2 border-t ${isDark ? 'border-zinc-700/30' : 'border-gray-200/30'} text-sm text-purple-400`}>
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      Cambios pendientes — se guardarán con el botón "Guardar Cambios"
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Caras/Formatos */}
              <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-2xl border overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-gray-200 bg-gray-100/50'} flex items-center justify-between`}>
                  <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <Layers className="h-4 w-4 text-purple-400" />
                    Formatos / Caras
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-400">
                      Renta: <span className="text-purple-300 font-medium">{carasKPIs.totalRenta}</span>
                    </span>
                    {carasKPIs.totalImpresiones > 0 && (
                      <span className="text-zinc-400">
                        Impresiones: <span className="text-amber-300 font-medium">{carasKPIs.totalImpresiones}</span>
                      </span>
                    )}
                    {carasKPIs.totalEspeciales > 0 && (
                      <span className="text-zinc-400">
                        Ejec. Especiales: <span className="text-purple-300 font-medium">{carasKPIs.totalEspeciales}</span>
                      </span>
                    )}
                    <span className="text-zinc-400">
                      Bonificación: <span className="text-emerald-300 font-medium">{carasKPIs.totalBonificacion}</span>
                    </span>
                    {carasKPIs.totalCortesia > 0 && (
                      <span className="text-zinc-400">
                        Cortesía: <span className="text-cyan-300 font-medium">{carasKPIs.totalCortesia}</span>
                      </span>
                    )}
                    <span className="text-zinc-400">
                      Inversión: <span className="text-amber-300 font-medium">{formatCurrency(carasKPIs.totalInversion)}</span>
                    </span>
                    {effectiveCanEdit && canEditResumen && (
                      <button
                        onClick={() => { setShowAddCaraForm(true); setEditingCaraId(null); setNewCara(EMPTY_CARA); setSelectedArticulo(null); setArticuloBf(null); }}
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
                  <div ref={caraFormRef} className="px-5 py-4 bg-zinc-800/50 border-b border-zinc-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-white">
                        {editingCaraId ? 'Editar Cara' : 'Nueva Cara'}
                      </h4>
                      <div className="flex items-center gap-3">
                        {/* Toggle "Aplicar a grupo masivo" — visible al editar cara con grupo_masivo_id */}
                        {editingCaraId && (() => {
                          const caraEdit = caras.find(c => c.localId === editingCaraId);
                          if (!caraEdit?.grupo_masivo_id) return null;
                          const grupo = caras.filter(c => c.grupo_masivo_id === caraEdit.grupo_masivo_id && !c.esBf);
                          if (grupo.length <= 1) return null;
                          return (
                            <label className={`flex items-center gap-2 text-xs cursor-pointer select-none ${modoMasivoC ? 'text-purple-300' : 'text-zinc-400'}`}>
                              <span>Aplicar a grupo masivo ({grupo.length})</span>
                              <button
                                type="button"
                                onClick={() => setModoMasivoC(!modoMasivoC)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${modoMasivoC ? 'bg-purple-500' : 'bg-zinc-700'}`}
                                title="Replica los cambios de esta cara a todas las del grupo masivo (mantiene los periodos individuales)"
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoMasivoC ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                              <span className={`text-[10px] uppercase font-semibold ${modoMasivoC ? 'text-purple-400' : 'text-zinc-500'}`}>
                                {modoMasivoC ? 'ON' : 'OFF'}
                              </span>
                            </label>
                          );
                        })()}
                        {tipoPeriodo === 'catorcena' && !editingCaraId && (
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-zinc-300">
                            <span>Modo masivo</span>
                            <button
                              type="button"
                              onClick={() => setModoMasivoC(!modoMasivoC)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${modoMasivoC ? 'bg-purple-500' : 'bg-zinc-700'}`}
                              title="Crea varias caras en un rango de catorcenas"
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoMasivoC ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                            <span className={`text-[10px] uppercase font-semibold ${modoMasivoC ? 'text-purple-400' : 'text-zinc-500'}`}>
                              {modoMasivoC ? 'ON' : 'OFF'}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Artículo selector */}
                    <div className="mb-4">
                      <label className={`text-xs mb-1 block ${((editingCaraHasReservas || editingCaraId) && !permissions.canEditArticuloOnEdit) ? 'text-zinc-800' : 'text-zinc-500'}`}>Artículo SAP</label>
                      {canEditResumen && (permissions.canEditArticuloOnEdit || (!editingCaraHasReservas && !editingCaraId)) ? (
                        <SearchableSelect
                          label="Seleccionar artículo"
                          options={(articulosData || []).filter(a => {
                            const code = a.ItemCode.toUpperCase();
                            // BF/CF solo aparecen en el dropdown de bonificación, no en el principal
                            return !code.startsWith('BF') && !code.startsWith('CF');
                          })}
                          value={selectedArticulo}
                          onChange={async (item: SAPArticulo) => {
                            setSelectedArticulo(item);
                            // Detectar CIRCUITO DIGITAL
                            const circuito = parseCircuitoDigital(item.ItemCode);
                            if (circuito) {
                              // Validar unicidad: mismo CTO+plaza+catorcena/mes solo una vez
                              // Se permite repetir en distintas catorcenas/meses
                              if (newCara.catorcena_inicio && newCara.anio_inicio) {
                                const ya = caras.find(c => {
                                  if (editingCaraId && c.localId === editingCaraId) return false;
                                  if (c.esBf) return false;
                                  const ci = parseCircuitoDigital(c.articulo);
                                  if (!ci || ci.cto !== circuito.cto || ci.plazaCode !== circuito.plazaCode) return false;
                                  return c.catorcena_inicio === newCara.catorcena_inicio && c.anio_inicio === newCara.anio_inicio;
                                });
                                if (ya) {
                                  alert(`Ya tienes el circuito ${circuito.ctoLabel} (${circuito.plazaLabel}) en ese ${tipoPeriodo === 'mensual' ? 'mes' : 'catorcena'}. Solo se puede incluir una vez por periodo.`);
                                  setSelectedArticulo(null);
                                  return;
                                }
                              }
                              try {
                                const det = await circuitosService.detalle(item.ItemCode);
                                const tarifa = getTarifaPublicaFromArticulo(item);
                                const tarifaPiso = getTarifaPisoFromArticulo(item);
                                // Formato como muebles reales del circuito (en lugar de "MIXTO").
                                const formatosCircuito = Object.keys((det as any).muebles || {}).filter(Boolean);
                                setNewCara({
                                  ...newCara,
                                  articulo: item.ItemCode,
                                  tarifa_publica: tarifa,
                                  costo: tarifaPiso,
                                  caras: det.total,
                                  // Mensual = solo Flujo. Catorcena = conteos reales del circuito.
                                  caras_flujo: tipoPeriodo === 'mensual' ? det.total : det.flujo,
                                  caras_contraflujo: tipoPeriodo === 'mensual' ? 0 : det.contraflujo,
                                  bonificacion: 0,
                                  estados: circuito.plazaLabel,
                                  ciudad: '',
                                  formato: formatosCircuito.length > 0 ? formatosCircuito.join(', ') : 'MIXTO',
                                  tipo: 'Digital',
                                });
                                return;
                              } catch (e: any) {
                                alert(`Error al cargar circuito: ${e?.message || e}`);
                                setSelectedArticulo(null);
                                return;
                              }
                            }

                            // Auto-complete all fields from article
                            const tarifa = getTarifaPublicaFromArticulo(item);
                            const tarifaPiso = getTarifaPisoFromArticulo(item);
                            const ciudadEstado = getCiudadEstadoFromArticulo(item.ItemName, item.ItemCode);
                            // Auto-set plaza buscando el nombre de plaza dentro del ItemName.
                            // Comparamos SIN ACENTOS porque las plazas en BD pueden traer
                            // tilde (ej. "MÉRIDA") pero los ItemName de SAP vienen sin acento.
                            const itemNameNorm = stripAccents((item.ItemName || '').toUpperCase());
                            const plazasBackend = (solicitudFilters as any)?.plazas as { plaza: string }[] | undefined;
                            const plazaPorNombre = plazasBackend?.find(p => itemNameNorm.includes(stripAccents(p.plaza.toUpperCase())));
                            const formatoBase = getFormatoFromArticulo(item.ItemName, item.ItemCode);
                            const tipo = getTipoFromName(item.ItemName);
                            // Para artículos digitales: incluir PARABUS y MUPIS (los muebles
                            // físicos donde corre la pantalla rotando ambos formatos).
                            const formato = tipo === 'Digital'
                              ? (formatoBase && formatoBase !== 'PARABUS'
                                  ? `${formatoBase}, PARABUS, MUPIS`
                                  : 'PARABUS, MUPIS')
                              : formatoBase;
                            const isCortesia = item.ItemCode.toUpperCase().startsWith('CT');
                            const isIntercambio = item.ItemCode.toUpperCase().startsWith('IN');
                            const isImpresion = item.ItemCode.toUpperCase().startsWith('IM');
                            const isEspecial = isEspecialArticle(item.ItemCode);
                            const isTarifaCero = isCortesia;
                            setNewCara({
                              ...newCara,
                              articulo: item.ItemCode,
                              tarifa_publica: isTarifaCero ? 0 : tarifa,
                              costo: isTarifaCero ? 0 : tarifaPiso,
                              caras: isCortesia ? 0 : newCara.caras,
                              caras_flujo: isCortesia ? 0 : newCara.caras_flujo,
                              caras_contraflujo: isCortesia ? 0 : newCara.caras_contraflujo,
                              bonificacion: (isImpresion || isIntercambio || isEspecial) ? 0 : newCara.bonificacion,
                              estados: plazaPorNombre?.plaza || ciudadEstado?.estado || newCara.estados,
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
                              <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{item.ItemName}</div>
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

                    {/* Periodo - catorcena o mes, filtrada por rango de campaña */}
                    <div className="mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          Periodo {editingCaraHasReservas && <span className="text-amber-400 text-[10px]">(bloqueado)</span>}
                          {tipoPeriodo !== 'mensual' && campana!.catorcena_inicio_num && campana!.catorcena_inicio_anio && campana!.catorcena_fin_num && campana!.catorcena_fin_anio && (
                            <span className="text-zinc-600 ml-1">
                              (Rango: {campana!.catorcena_inicio_num}/{campana!.catorcena_inicio_anio} - {campana!.catorcena_fin_num}/{campana!.catorcena_fin_anio})
                            </span>
                          )}
                        </label>
                        {tipoPeriodo === 'mensual' ? (
                          // Mensual: dropdown Mes + 2 date inputs (Fecha Inicio + Fecha Fin)
                          (() => {
                            const minDate = (yearInicio && catorcenaInicio)
                              ? new Date(yearInicio, catorcenaInicio - 1, 1).toISOString().split('T')[0]
                              : (campana?.fecha_inicio ? String(campana.fecha_inicio).split('T')[0] : undefined);
                            const maxDate = (yearFin && catorcenaFin)
                              ? new Date(yearFin, catorcenaFin, 0).toISOString().split('T')[0]
                              : (campana?.fecha_fin ? String(campana.fecha_fin).split('T')[0] : undefined);
                            const mesOptions: { year: number; month: number }[] = [];
                            if (yearInicio && catorcenaInicio && yearFin && catorcenaFin) {
                              let y = yearInicio, m = catorcenaInicio;
                              while (y < yearFin || (y === yearFin && m <= catorcenaFin)) {
                                mesOptions.push({ year: y, month: m });
                                m++;
                                if (m > 12) { m = 1; y++; }
                              }
                            }
                            return (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-600 block mb-1">Mes</label>
                              <select
                                value={newCara.catorcena_inicio && newCara.anio_inicio ? `${newCara.anio_inicio}-${newCara.catorcena_inicio}` : ''}
                                onChange={(e) => {
                                  if (!canEditResumen) return;
                                  const val = e.target.value;
                                  if (!val) {
                                    setNewCara({ ...newCara, catorcena_inicio: undefined, anio_inicio: undefined, catorcena_fin: undefined, anio_fin: undefined, inicio_periodo: '', fin_periodo: '' });
                                    return;
                                  }
                                  const [y, m] = val.split('-').map(Number);
                                  const fechaIni = new Date(y, m - 1, 1).toISOString().split('T')[0];
                                  const fechaFin = new Date(y, m, 0).toISOString().split('T')[0];
                                  setNewCara({
                                    ...newCara,
                                    catorcena_inicio: m,
                                    anio_inicio: y,
                                    catorcena_fin: m,
                                    anio_fin: y,
                                    inicio_periodo: fechaIni,
                                    fin_periodo: fechaFin,
                                  });
                                }}
                                disabled={!canEditResumen || mesOptions.length === 0}
                                className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <option value="">Seleccionar</option>
                                {mesOptions.map(o => (
                                  <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                                    {MESES_LABEL[o.month - 1]} {o.year}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-600 block mb-1">Fecha Inicio</label>
                              <input
                                type="date"
                                value={newCara.inicio_periodo || ''}
                                onChange={(e) => {
                                  if (!canEditResumen) return;
                                  const v = e.target.value;
                                  if (!v) {
                                    setNewCara({ ...newCara, inicio_periodo: '', catorcena_inicio: undefined, anio_inicio: undefined });
                                    return;
                                  }
                                  const [yStr, mStr] = v.split('-');
                                  const y = parseInt(yStr);
                                  const m = parseInt(mStr);
                                  const newIniVal = y * 100 + m;
                                  const curFinVal = (newCara.anio_fin || 0) * 100 + (newCara.catorcena_fin || 0);
                                  let finPeriodo = newCara.fin_periodo;
                                  let finCat = newCara.catorcena_fin;
                                  let finYear = newCara.anio_fin;
                                  if (!finPeriodo || curFinVal < newIniVal) {
                                    const lastDay = new Date(y, m, 0);
                                    finPeriodo = lastDay.toISOString().split('T')[0];
                                    finCat = m;
                                    finYear = y;
                                  }
                                  setNewCara({
                                    ...newCara,
                                    inicio_periodo: v,
                                    catorcena_inicio: m,
                                    anio_inicio: y,
                                    fin_periodo: finPeriodo,
                                    catorcena_fin: finCat,
                                    anio_fin: finYear,
                                  });
                                }}
                                min={minDate}
                                max={maxDate}
                                disabled={!canEditResumen}
                                className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${!canEditResumen ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-600 block mb-1">Fecha Fin</label>
                              <input
                                type="date"
                                value={newCara.fin_periodo || ''}
                                onChange={(e) => {
                                  if (!canEditResumen) return;
                                  const v = e.target.value;
                                  if (!v) {
                                    setNewCara({ ...newCara, fin_periodo: '', catorcena_fin: undefined, anio_fin: undefined });
                                    return;
                                  }
                                  const [yStr, mStr] = v.split('-');
                                  const y = parseInt(yStr);
                                  const m = parseInt(mStr);
                                  setNewCara({ ...newCara, fin_periodo: v, catorcena_fin: m, anio_fin: y });
                                }}
                                min={newCara.inicio_periodo || minDate}
                                max={maxDate}
                                disabled={!canEditResumen || !newCara.inicio_periodo}
                                className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || !newCara.inicio_periodo) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            </div>
                          </div>
                            );
                          })()
                        ) : (
                        <select
                          value={newCara.catorcena_inicio && newCara.anio_inicio ? `${newCara.anio_inicio}-${newCara.catorcena_inicio}` : ''}
                          onChange={(e) => {
                            if (!canEditResumen || editingCaraHasReservas) return;
                            if (e.target.value) {
                              const [year, cat] = e.target.value.split('-').map(Number);
                              if (tipoPeriodo === 'mensual') {
                                const fechaIni = new Date(year, cat - 1, 1);
                                const fechaFin = new Date(year, cat, 0);
                                setNewCara({
                                  ...newCara,
                                  catorcena_inicio: cat,
                                  anio_inicio: year,
                                  catorcena_fin: cat,
                                  anio_fin: year,
                                  inicio_periodo: fechaIni.toISOString().split('T')[0],
                                  fin_periodo: fechaFin.toISOString().split('T')[0]
                                });
                              } else {
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
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || editingCaraHasReservas) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">{tipoPeriodo === 'mensual' ? 'Seleccionar mes' : 'Seleccionar catorcena'}</option>
                          {tipoPeriodo === 'mensual' ? (
                            (() => {
                              // Generate monthly options from propuesta date range
                              const options: { year: number; month: number }[] = [];
                              if (campana!.fecha_inicio && campana!.fecha_fin) {
                                const start = new Date(campana!.fecha_inicio);
                                const end = new Date(campana!.fecha_fin);
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
                                if (!campana!.catorcena_inicio_num || !campana!.catorcena_inicio_anio || !campana!.catorcena_fin_num || !campana!.catorcena_fin_anio) {
                                  return true;
                                }
                                const catValue = c.a_o * 100 + c.numero_catorcena;
                                const minValue = campana!.catorcena_inicio_anio * 100 + campana!.catorcena_inicio_num;
                                const maxValue = campana!.catorcena_fin_anio * 100 + campana!.catorcena_fin_num;
                                return catValue >= minValue && catValue <= maxValue;
                              })
                              .map(c => (
                                <option key={`${c.a_o}-${c.numero_catorcena}`} value={`${c.a_o}-${c.numero_catorcena}`}>
                                  Cat {c.numero_catorcena} / {c.a_o}
                                </option>
                              ))
                          )}
                        </select>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : 'text-zinc-500'}`}>Plazas {newCara.estados && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.estados.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
                          <MultiSelectDropdown
                            options={(() => {
                              const plazas = (solicitudFilters as any)?.plazas?.map((p: any) => p.plaza) as string[] | undefined;
                              if (plazas && plazas.length > 0) return ['Ciudad de México / AM', ...plazas];
                              return ['Ciudad de México / AM', ...(solicitudFilters?.estados || [])];
                            })()}
                            selected={newCara.estados ? newCara.estados.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => {
                              // CDMX/AM es mutuamente excluyente con CDMX y EdoMex sueltos
                              // (CDMX/AM ya engloba ambos con sus reglas especiales).
                              const previo = newCara.estados ? newCara.estados.split(',').map(s => s.trim()).filter(Boolean) : [];
                              const teniaAM = previo.some(p => p.toUpperCase() === 'CIUDAD DE MÉXICO / AM');
                              const ahoraAM = selected.some(p => p.toUpperCase() === 'CIUDAD DE MÉXICO / AM');
                              let final = selected;
                              if (ahoraAM && !teniaAM) {
                                // Acaba de seleccionar /AM → quitar CDMX y EdoMex sueltos
                                final = selected.filter(p => {
                                  const u = p.toUpperCase();
                                  return u !== 'CIUDAD DE MÉXICO' && u !== 'CIUDAD DE MEXICO' && u !== 'ESTADO DE MÉXICO' && u !== 'ESTADO DE MEXICO';
                                });
                              } else if (!ahoraAM && teniaAM) {
                                // Acaba de seleccionar CDMX o EdoMex después de /AM → /AM ya quitado por el cambio
                                // (no acción extra)
                              } else if (ahoraAM) {
                                // /AM ya estaba; si agregaron CDMX/EdoMex, quitar /AM
                                const hasNuevoSuelto = selected.some(p => {
                                  const u = p.toUpperCase();
                                  return u === 'CIUDAD DE MÉXICO' || u === 'CIUDAD DE MEXICO' || u === 'ESTADO DE MÉXICO' || u === 'ESTADO DE MEXICO';
                                });
                                if (hasNuevoSuelto) final = selected.filter(p => p.toUpperCase() !== 'CIUDAD DE MÉXICO / AM');
                              }
                              setNewCara({ ...newCara, estados: final.join(', '), ciudad: '' });
                            }}
                            placeholder="Seleccionar plazas..."
                          />
                        ) : (
                          <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300 truncate">
                            {newCara.estados || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : 'text-zinc-500'}`}>Ciudades {newCara.ciudad && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.ciudad.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
                          <MultiSelectDropdown
                            options={
                              (() => {
                                const isAM = newCara.estados?.includes('Ciudad de México / AM');
                                const AM_EDO_MEX_CITIES = ['ATIZAPÁN', 'CUAUTITLÁN IZCALLI', 'ECATEPEC', 'HUIXQUILUCAN', 'NAUCALPAN', 'TLALNEPANTLA', 'TULTITLÁN'];
                                return solicitudFilters?.ciudades
                                  .filter(c => {
                                    if (!newCara.estados) return true;
                                    const selectedRaw = newCara.estados.split(',').map(s => s.trim()).filter(Boolean);
                                    const selectedExpanded = selectedRaw.flatMap(s => s === 'Ciudad de México / AM' ? ['Ciudad de México', 'Estado de México'] : [s]);
                                    const selectedUpper = selectedRaw.map(s => s.toUpperCase());
                                    const matchEstado = selectedExpanded.includes(c.estado);
                                    const matchPlaza = (c as { plaza?: string }).plaza
                                      ? selectedUpper.includes(((c as { plaza?: string }).plaza || '').toUpperCase())
                                      : false;
                                    return matchEstado || matchPlaza;
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
                          <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300 truncate">
                            {newCara.ciudad || '-'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${((editingCaraHasReservas && !permissions.canEditCaraFiltersOnEdit) || (editingCaraId && !permissions.canEditCaraFiltersOnEdit)) ? 'text-zinc-800' : 'text-zinc-500'}`}>Formatos {newCara.formato && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) && <span className="text-purple-400">({newCara.formato.split(',').filter(Boolean).length})</span>}</label>
                        {canEditResumen && (!editingCaraHasReservas || permissions.canEditCaraFiltersOnEdit) && (!editingCaraId || permissions.canEditCaraFiltersOnEdit) ? (
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
                        {/* Tipo: bloqueado al CREAR (se deriva del artículo). Editable solo al EDITAR un circuito existente. */}
                        <label className="text-xs text-zinc-500">Tipo</label>
                        <select
                          value={newCara.tipo}
                          onChange={(e) => canEditResumen && editingCaraId && setNewCara({ ...newCara, tipo: e.target.value })}
                          disabled={!canEditResumen || !editingCaraId}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || !editingCaraId) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">Seleccionar</option>
                          <option value="Tradicional">Tradicional</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          {newCara.articulo?.toUpperCase().startsWith('IM') ? 'Impresiones' : newCara.articulo?.toUpperCase().startsWith('IN') ? 'Intercambio' : isEspecialArticle(newCara.articulo || '') ? 'Ejec. Especiales' : (newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'Puentes en Renta' : 'Caras en Renta'}
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
                            // Mensual = solo Flujo (Gran Formato).
                            // Catorcena = split 50/50 flujo/contraflujo (ceil/floor).
                            const flujo = tipoPeriodo === 'mensual' ? val : Math.ceil(val / 2);
                            const contraflujo = tipoPeriodo === 'mensual' ? 0 : Math.floor(val / 2);
                            setNewCara({ ...newCara, caras: val, caras_flujo: flujo, caras_contraflujo: contraflujo });
                          }}
                          disabled={!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')) ? 'opacity-40 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                        <span className="text-[10px] text-zinc-600">Flujo: {newCara.caras_flujo || 0} | Contraflujo: {newCara.caras_contraflujo || 0}</span>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{newCara.articulo?.toUpperCase().startsWith('CT') ? 'Cortesía' : (newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'Puentes Bonificados' : 'Caras Bonificadas'}</label>
                        <input
                          type="number"
                          value={newCara.bonificacion || ''}
                          onChange={(e) => {
                            if (!canEditResumen) return;
                            const val = parseInt(e.target.value) || 0;
                            setNewCara({ ...newCara, bonificacion: val });
                          }}
                          disabled={!canEditResumen || isNoInventoryArticle(newCara.articulo || '') || newCara.articulo?.toUpperCase().startsWith('IN')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || isNoInventoryArticle(newCara.articulo || '') || newCara.articulo?.toUpperCase().startsWith('IN')) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Tarifa Pública</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tarifaPublicaFocused
                            ? tarifaPublicaInput
                            : ((newCara.tarifa_publica || 0) > 0 ? (newCara.tarifa_publica || 0).toFixed(2) : '')}
                          onFocus={() => {
                            setTarifaPublicaInput((newCara.tarifa_publica || 0) > 0 ? String(newCara.tarifa_publica) : '');
                            setTarifaPublicaFocused(true);
                          }}
                          onBlur={() => setTarifaPublicaFocused(false)}
                          onChange={(e) => {
                            if (!canEditResumen) return;
                            const cleaned = e.target.value.replace(/[^\d.]/g, '');
                            const parts = cleaned.split('.');
                            const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` : cleaned;
                            setTarifaPublicaInput(normalized);
                            setNewCara({ ...newCara, tarifa_publica: parseFloat(normalized) || 0 });
                          }}
                          placeholder="0.00"
                          disabled={!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')}
                          className={`w-full px-3 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${(!canEditResumen || newCara.articulo?.toUpperCase().startsWith('CT')) ? 'opacity-40 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>NSE {newCara.nivel_socioeconomico && <span className="text-purple-400">({newCara.nivel_socioeconomico.split(',').filter(Boolean).length})</span>}</label>
                        <MultiSelectDropdown
                          options={solicitudFilters?.nse || []}
                          selected={newCara.nivel_socioeconomico ? newCara.nivel_socioeconomico.split(',').map(s => s.trim()).filter(Boolean) : []}
                          onChange={(selected) => setNewCara({ ...newCara, nivel_socioeconomico: selected.join(', ') })}
                          placeholder="Seleccionar NSE..."
                        />
                      </div>
                    </div>

                    {/* Artículo BF (Bonificación) selector — visible when bonificacion > 0 and articulo supports pairing */}
                    {(newCara.bonificacion || 0) > 0 &&
                      !newCara.articulo?.toUpperCase().startsWith('CT') &&
                      !newCara.articulo?.toUpperCase().startsWith('IM') &&
                      !newCara.articulo?.toUpperCase().startsWith('IN') &&
                      !newCara.articulo?.toUpperCase().startsWith('BF') &&
                      !newCara.articulo?.toUpperCase().startsWith('CF') &&
                      !isEspecialArticle(newCara.articulo || '') && (
                        <div className={`mt-3 p-3 ${isDark ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} rounded-lg border`}>
                          <label className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'} mb-1 block`}>
                            Artículo de Bonificación (BF) — opcional
                            {editingCaraHasReservas && <span className="text-amber-400 text-[10px] ml-2">(bloqueado por APS)</span>}
                          </label>
                          {canEditResumen && !editingCaraHasReservas ? (
                            <SearchableSelect
                              label=""
                              options={(articulosData || []).filter((a: SAPArticulo) => a.ItemCode.toUpperCase().startsWith('BF') || a.ItemCode.toUpperCase().startsWith('CF'))}
                              value={articuloBf}
                              onChange={(item: SAPArticulo) => setArticuloBf(item)}
                              onClear={() => setArticuloBf(null)}
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
                                  <div className="text-[10px] text-zinc-500 truncate">{item.ItemName}</div>
                                </div>
                              )}
                            />
                          ) : (
                            <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-sm text-zinc-300">
                              {articuloBf ? `${articuloBf.ItemCode} - ${articuloBf.ItemName}` : 'Sin artículo BF'}
                            </div>
                          )}
                          {articuloBf && (
                            <p className="text-[10px] text-emerald-400/80 mt-1">
                              Se creará una cara BF pareja con {newCara.bonificacion} caras de {articuloBf.ItemCode} ligada a esta renta (tarifa 0).
                            </p>
                          )}
                        </div>
                      )}

                    {/* Preview calculation - Resumen y cálculos */}
                    {(newCara.caras || 0) > 0 && (newCara.tarifa_publica || 0) > 0 && (
                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Inversión (Tarifa Cliente):</span>
                          <span className="text-zinc-300">
                            {newCara.caras} {(newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras'} × {formatCurrency(newCara.tarifa_publica)} = <span className="text-emerald-400 font-medium">{formatCurrency((newCara.caras || 0) * (newCara.tarifa_publica || 0))}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">{(newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'Puentes' : 'Caras'} Totales:</span>
                          <span className="text-zinc-300">
                            {newCara.caras || 0} {(newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras'} + {newCara.bonificacion || 0} bonif. = <span className="text-blue-400 font-medium">{(newCara.caras || 0) + (newCara.bonificacion || 0)} {(newCara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras'} totales</span>
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
                        onClick={async () => {
                          const isMasivoActivo = tipoPeriodo === 'catorcena' && modoMasivoC
                            && newCara.catorcena_inicio && newCara.anio_inicio
                            && newCara.catorcena_fin && newCara.anio_fin
                            && (newCara.anio_inicio * 100 + newCara.catorcena_inicio) !== (newCara.anio_fin * 100 + newCara.catorcena_fin);
                          if (!isMasivoActivo) {
                            await handleSaveCara();
                            return;
                          }
                          const cats = (catorcenasData?.data || [])
                            .filter(c => {
                              const k = c.a_o * 100 + c.numero_catorcena;
                              return k >= (newCara.anio_inicio! * 100 + newCara.catorcena_inicio!)
                                  && k <= (newCara.anio_fin! * 100 + newCara.catorcena_fin!);
                            })
                            .sort((a, b) => (a.a_o * 100 + a.numero_catorcena) - (b.a_o * 100 + b.numero_catorcena));
                          if (cats.length === 0) {
                            await handleSaveCara();
                            return;
                          }
                          for (const cat of cats) {
                            await handleSaveCara({
                              catorcena: cat.numero_catorcena,
                              anio: cat.a_o,
                              inicio_periodo: cat.fecha_inicio,
                              fin_periodo: cat.fecha_fin,
                            });
                          }
                        }}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
                      >
                        {editingCaraId ? 'Actualizar' : 'Agregar'}{modoMasivoC && newCara.catorcena_inicio !== newCara.catorcena_fin ? ' (rango)' : ''}
                      </button>
                    </div>
                  </div>
                )}

                {invalidCaras.length > 0 && (
                  <div className="mx-5 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>{invalidCaras.length} cara{invalidCaras.length > 1 ? 's' : ''}</strong> tiene{invalidCaras.length > 1 ? 'n' : ''} catorcenas fuera del rango actual. Elimínalas o ajusta el rango de catorcenas antes de actualizar.
                    </span>
                  </div>
                )}
                <div ref={caraTableRef} className={`divide-y ${isDark ? 'divide-zinc-700/30' : 'divide-gray-200'}`}>
                  {caras.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                      <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>No hay formatos/caras en esta campaña</p>
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
                        : tipoPeriodo === 'mensual'
                        ? (() => {
                            const parts = periodo.split('-');
                            if (parts.length >= 2) {
                              const m = parseInt(parts[1]);
                              return `${MESES_LABEL[m - 1] || periodo} ${parts[0]}`;
                            }
                            return `Periodo: ${periodo}`;
                          })()
                        : `Periodo: ${periodo.slice(0, 10)}`;

                      const groupFechas = groupData.caras.map(c => c.inicio_periodo).filter(Boolean).sort();
                      const groupFechasFin = groupData.caras.map(c => c.fin_periodo).filter(Boolean).sort();
                      const groupFechaInicio = groupFechas.length ? groupFechas[0] : null;
                      const groupFechaFin = groupFechasFin.length ? groupFechasFin[groupFechasFin.length - 1] : null;
                      // For mensual mode, always prefer the month label derived from actual cara dates
                      const headerLabel = tipoPeriodo === 'mensual' && groupFechaInicio
                        ? monthLabelLong(groupFechaInicio)
                        : catorcenaLabel;

                      return (
                        <div key={periodo}>
                          {/* Period Header - Collapsible */}
                          <div
                            className={`px-5 py-3 border-b flex items-center gap-3 cursor-pointer transition-colors ${isDark ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15' : 'bg-purple-50 border-purple-100 hover:bg-purple-100'}`}
                            onClick={() => toggleCatorcena(periodo)}
                          >
                            <button className="text-purple-400">
                              {isCatorcenaExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                              {headerLabel}
                            </span>
                            {tipoPeriodo === 'mensual' && groupFechaInicio && groupFechaFin && (
                              <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                {dayMonthShort(groupFechaInicio)} – {dayMonthShort(groupFechaFin)}
                              </span>
                            )}
                            <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                              ({groupData.caras.length} {groupData.caras.length === 1 ? 'formato' : 'formatos'})
                            </span>
                          </div>

                          {isCatorcenaExpanded && groupData.caras.map((cara) => {
                            const isExpanded = expandedCaras.has(cara.localId);
                            const caraReservas = reservasByCara.get(cara.localId) || [];
                            const hasReservas = caraReservas.length > 0;
                            const caraHasAPS = caraReservas.some(r => r.aps && r.aps > 0);
                            const caraAPSBlocked = postedAPSGroups.size > 0
                              ? caraReservas.some(r => r.aps && postedAPSGroups.has(r.aps as number))
                              : caraHasAPS;
                            const status = getCaraCompletionStatus(cara);
                            const totalCaras = (cara.caras_flujo || 0) + (cara.caras_contraflujo || 0) + (cara.bonificacion || 0);
                            const carasFaltantes = status.totalRequerido - status.totalReservado;

                            // Determine status color and indicator
                            const esImpresion = cara.articulo ? isImpresionArticle(cara.articulo) : false;
                            const esEspecial = cara.articulo ? isEspecialArticle(cara.articulo) : false;
                            // Blue = impresión, Purple = ejec especial, Red = sobran (quitar), Green = exacto, Amber = faltan
                            const statusColor = esImpresion ? 'blue' : esEspecial ? 'purple' : status.totalDiff > 0 ? 'red' : status.isComplete ? 'emerald' : 'amber';

                            // Display text for diff:
                            // - Missing (totalDiff < 0): show "faltan X"
                            // - Excess (totalDiff > 0): show "quitar X"
                            const diffDisplay = status.totalDiff === 0
                              ? null
                              : status.totalDiff > 0
                                ? `quitar ${status.totalDiff}`
                                : `faltan ${Math.abs(status.totalDiff)}`;

                            return (
                              <div key={cara.localId} className={`${statusColor === 'blue' ? 'bg-blue-500/5' : statusColor === 'purple' ? 'bg-purple-500/5' : statusColor === 'red' ? 'bg-red-500/5' : statusColor === 'emerald' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                                {/* Cara row */}
                                <div className={`flex items-center gap-3 px-5 py-3 transition-colors ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-gray-50'}`}>
                                  {/* Completion indicator */}
                                  <div className={`w-2 h-2 rounded-full ${
                                    statusColor === 'blue' ? 'bg-blue-500' : statusColor === 'purple' ? 'bg-purple-500' : statusColor === 'red' ? 'bg-red-500' : statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                  }`} />

                                  <div className="flex-1 grid grid-cols-8 gap-3 text-sm">
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Formato</span>
                                      <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{cara.formato || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Tipo</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${cara.tipo === 'Digital' ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')}`}>
                                        {cara.tipo || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Plaza</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs truncate`} title={cara.plaza || cara.estados || cara.ciudad}>{cara.plaza || cara.estados || cara.ciudad || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Artículo</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{cara.articulo || '-'}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>F. Inicio</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{(() => {
                                        // Parsea YYYY-MM-DD directo del string para evitar timezone shift en MX UTC-6
                                        const m = String(cara.inicio_periodo || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
                                        if (!m) return '-';
                                        const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                                        return `${m[3]} ${meses[parseInt(m[2]) - 1]} ${m[1]}`;
                                      })()}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>F. Fin</span>
                                      <p className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} text-xs`}>{(() => {
                                        const m = String(cara.fin_periodo || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
                                        if (!m) return '-';
                                        const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                                        return `${m[3]} ${meses[parseInt(m[2]) - 1]} ${m[1]}`;
                                      })()}</p>
                                    </div>
                                    <div>
                                      <span className={`${isDark ? 'text-zinc-500' : 'text-gray-400'} text-xs`}>Caras</span>
                                      {esImpresion ? (
                                        <div className="flex items-center gap-1">
                                          <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{cara.caras || 0}</p>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">Impresiones</span>
                                        </div>
                                      ) : esEspecial ? (
                                        <div className="flex items-center gap-1">
                                          <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{cara.caras || 0}</p>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">Ejec. Especiales</span>
                                        </div>
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
                                      {(() => {
                                        let dgDisplay = cara.autorizacion_dg;
                                        let dcmDisplay = cara.autorizacion_dcm;
                                        if (cara.esBf && cara.grupo_rt_bf) {
                                          const rtPair = rtPairMap.get(cara.localId);
                                          if (rtPair) { dgDisplay = rtPair.autorizacion_dg; dcmDisplay = rtPair.autorizacion_dcm; }
                                        }
                                        return (
                                      <div className="flex flex-col gap-0.5">
                                        {dgDisplay === 'aprobado' && dcmDisplay === 'aprobado' && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Aprobado</span>
                                        )}
                                        {(dgDisplay === 'rechazado' || dcmDisplay === 'rechazado') && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-red-600/30 text-red-400' : 'bg-red-100 text-red-700'}`}>Rechazado</span>
                                        )}
                                        {dgDisplay === 'pendiente' && dcmDisplay !== 'rechazado' && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>Pend. DG</span>
                                        )}
                                        {dcmDisplay === 'pendiente' && dgDisplay !== 'rechazado' && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>Pend. DCM</span>
                                        )}
                                      </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Botón Buscar Inventario - oculto para impresión, deshabilitado si hay autorizaciones pendientes */}
                                    {effectiveCanEdit && permissions.canBuscarInventarioEnModal && !esImpresion && (() => {
                                      const isLocallyModified = cara.id ? modifiedCaras.has(cara.id) : false;
                                      let tienePendientes = !isLocallyModified && (cara.autorizacion_dg === 'pendiente' || cara.autorizacion_dcm === 'pendiente');
                                      let tieneRechazado = cara.autorizacion_dg === 'rechazado' || cara.autorizacion_dcm === 'rechazado';
                                      if (cara.esBf && cara.grupo_rt_bf) {
                                        const rtPair = rtPairMap.get(cara.localId);
                                        if (rtPair) {
                                          const rtModified = rtPair.id ? modifiedCaras.has(rtPair.id) : false;
                                          if (!rtModified && (rtPair.autorizacion_dg === 'pendiente' || rtPair.autorizacion_dcm === 'pendiente')) tienePendientes = true;
                                          if (rtPair.autorizacion_dg === 'rechazado' || rtPair.autorizacion_dcm === 'rechazado') tieneRechazado = true;
                                        }
                                      }
                                      const bloqueado = tienePendientes || tieneRechazado || caraAPSBlocked || hasPendingAuthorization;
                                      const isLoadingThis = loadingCaraAction?.caraId === cara.localId && loadingCaraAction?.action === 'search';

                                      return (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (!bloqueado && !loadingCaraAction) handleSearchInventory(cara); }}
                                          disabled={bloqueado || !!loadingCaraAction}
                                          className={`p-2 rounded-lg border transition-colors ${
                                            bloqueado || !!loadingCaraAction
                                              ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed'
                                              : status.isComplete
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                          }`}
                                          title={
                                            caraAPSBlocked ? 'Grupo con APS asignado - no se puede modificar inventario' :
                                            tieneRechazado ? 'Cara rechazada - no se puede asignar inventario' :
                                            tienePendientes ? 'Esta cara necesita autorización antes de asignar inventario' :
                                            hasPendingAuthorization ? 'Hay otra cara en esta campaña pendiente de autorización. Apruébala primero.' :
                                            isLoadingThis ? 'Buscando inventario...' :
                                            status.isComplete ? 'Completo - clic para modificar' : 'Buscar inventario'
                                          }
                                        >
                                          {isLoadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </button>
                                      );
                                    })()}
                                    {effectiveCanEdit && (() => {
                                      const editBlocked = hasSavedPendingAuth || caraAPSBlocked;
                                      const isLoadingThis = loadingCaraAction?.caraId === cara.localId && loadingCaraAction?.action === 'edit';
                                      const blockReason = caraAPSBlocked ? 'Grupo con APS asignado - no se puede editar' : hasSavedPendingAuth ? 'Hay circuitos pendientes de autorizacion - no se pueden editar otros' : isLoadingThis ? 'Cargando editor...' : 'Editar';
                                      return (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); if (!editBlocked && !loadingCaraAction) handleEditCara(cara); }}
                                          disabled={editBlocked || !!loadingCaraAction}
                                          className={`p-2 rounded-lg border transition-colors ${editBlocked || !!loadingCaraAction
                                            ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                          }`}
                                          title={blockReason}
                                        >
                                          {isLoadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                        </button>
                                        {canEditResumen && (() => {
                                          const reservaBlocked = hasReservas && !permissions.canDeleteCaraConReservas;
                                          const isDisabled = reservaBlocked || hasSavedPendingAuth || caraAPSBlocked || !!loadingCaraAction;
                                          return (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (!isDisabled) handleDeleteCara(cara.localId); }}
                                            disabled={isDisabled}
                                            className={`p-2 rounded-lg border transition-colors ${isDisabled
                                              ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 cursor-not-allowed'
                                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                              }`}
                                            title={caraAPSBlocked ? 'Grupo con APS asignado - no se puede eliminar' : hasSavedPendingAuth ? 'Hay circuitos pendientes de autorizacion - no se pueden eliminar otros' : reservaBlocked ? 'No se puede eliminar (tiene reservas)' : 'Eliminar'}
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
                // Use filtered+grouped data from useMemo (perf: precomputado fuera del render)
                const filteredReservas = filteredReservasData;
                const groupedReservas = reservasGroupingData.grouped;
                const groupKeys = reservasGroupingData.groupKeys;
                const flatBySubKey = reservasGroupingData.flatBySubKey;
                const breakdownBySubKey = reservasGroupingData.breakdownBySubKey;

                // Helpers que ahora son simples lookups O(1) en los mapas precomputados.
                const flattenForKey = (path: string): ReservaItem[] => flatBySubKey.get(path) || [];
                const countForKey = (path: string): number => (flatBySubKey.get(path)?.length) || 0;
                const breakdownForKey = (path: string) => breakdownBySubKey.get(path) || { flujo: 0, contraflujo: 0, bonificacion: 0, total: 0 };

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

                // Render type breakdown badges (usa breakdown precomputado por path)
                const TypeBreakdownBadges = ({ path }: { path: string }) => {
                  const breakdown = breakdownForKey(path);
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
                  <div className={`${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-2xl border overflow-hidden`}>
                    <div className={`px-5 py-3 border-b ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-gray-200 bg-gray-100/50'} flex items-center justify-between`}>
                      <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                        <MapIcon className="h-4 w-4 text-purple-400" />
                        Resumen de Reservas
                        <span className={`px-2 py-0.5 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded-full text-xs`}>
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
                      <div className={`w-96 border-r ${isDark ? 'border-zinc-700/50 bg-zinc-900/30' : 'border-gray-200 bg-gray-50/30'} flex flex-col flex-shrink-0`}>
                        {/* Select All Header */}
                        <div className={`px-4 py-2.5 border-b ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-gray-200 bg-gray-100/50'}`}>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMapReservas.size === filteredReservas.length && filteredReservas.length > 0}
                                onChange={toggleAllMapReservas}
                                className="checkbox-purple"
                              />
                              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Seleccionar</span>
                              <span className={`px-2 py-0.5 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded-full text-xs`}>
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
                            const level1Items = flattenForKey(groupKey);
                            const totalItems = countForKey(groupKey);
                            void totalItems;
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
                                  <TypeBreakdownBadges path={groupKey} />
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
                                          {reserva.estatus_inventario === 'Bloqueado' && (
                                            <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Bloqueado</span>
                                          )}
                                          <span className="text-zinc-500 text-[11px] truncate max-w-[80px]">{reserva.plaza}</span>
                                          <span className="text-zinc-500 text-[11px]">{reserva.formato}</span>
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
                                        const subItems = flattenForKey(subFullKey);
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
                                              <TypeBreakdownBadges path={subFullKey} />
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
                                                      {reserva.estatus_inventario === 'Bloqueado' && (
                                                        <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Bloqueado</span>
                                                      )}
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
                                                          className="w-full flex items-center gap-2 px-2 py-1 bg-zinc-800/10 hover:bg-zinc-800/30"
                                                        >
                                                          {isThirdExpanded ? <ChevronDown className="h-3 w-3 text-cyan-400" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                                                          <span className="text-[10px] text-cyan-400">
                                                            {AVAILABLE_GROUPINGS_RESERVAS.find(g => g.field === activeGroupingsReservas[2])?.label}:
                                                          </span>
                                                          <span className="text-[11px] text-white flex-1 text-left truncate">{thirdKey}</span>
                                                          <TypeBreakdownBadges path={thirdFullKey} />
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
                                                            {reserva.estatus_inventario === 'Bloqueado' && (
                                                              <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Bloqueado</span>
                                                            )}
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
                        <div className={`p-3 border-t ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className={`grid gap-2 text-center text-xs ${reservasKPIs.completos > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            <div>
                              <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Flujo</p>
                              <p className={`${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold`}>{reservasKPIs.flujo}</p>
                            </div>
                            <div>
                              <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Contra</p>
                              <p className={`${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold`}>{reservasKPIs.contraflujo}</p>
                            </div>
                            {reservasKPIs.completos > 0 && (
                              <div>
                                <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Completo</p>
                                <p className={`${isDark ? 'text-purple-400' : 'text-purple-600'} font-bold`}>{reservasKPIs.completos}</p>
                              </div>
                            )}
                            <div>
                              <p className={isDark ? 'text-zinc-500' : 'text-gray-400'}>Bonif</p>
                              <p className={`${isDark ? 'text-emerald-400' : 'text-emerald-600'} font-bold`}>{reservasKPIs.bonificadas}</p>
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
                              {(() => {
                                // Umbral: con muchas reservas el Marker legacy de Google Maps
                                // bloquea el main thread. Por arriba del límite solo dibujamos
                                // los seleccionados (el usuario selecciona desde la lista izq).
                                const MARKERS_LIMIT = 500;
                                const tooMany = filteredReservas.length > MARKERS_LIMIT;
                                const source = tooMany
                                  ? filteredReservas.filter(r => selectedMapReservas.has(r.id))
                                  : filteredReservas;
                                return source.map(reserva => {
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
                                });
                              })()}
                            </GoogleMap>
                            {filteredReservas.length > 500 && (
                              <div className={`absolute top-3 left-3 z-10 ${isDark ? 'bg-zinc-900/95 border-amber-500/40 text-amber-300' : 'bg-white/95 border-amber-300 text-amber-700'} border rounded-lg px-3 py-2 text-[11px] max-w-[260px] shadow-lg`}>
                                <strong>Mapa optimizado:</strong> {filteredReservas.length} reservas. Solo se dibujan las seleccionadas ({selectedMapReservas.size}) para no trabar la página. Selecciona desde la lista para verlas en el mapa.
                              </div>
                            )}

                            {/* Map Legend */}
                            <div className={`absolute bottom-3 right-3 z-10 ${isDark ? 'bg-zinc-900/95 border-zinc-700' : 'bg-white/95 border-gray-200'} border rounded-lg p-2.5 text-xs max-w-[180px]`}>
                              <div className={`${isDark ? 'text-zinc-300' : 'text-gray-700'} font-semibold mb-1.5 flex items-center gap-1.5`}>
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
                                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                                  <span className="text-zinc-300">Contraflujo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                  <span className="text-zinc-300">Completo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                  <span className="text-zinc-300">{(selectedCaraForSearch?.articulo || '').toUpperCase().startsWith('CT') ? 'Cortesía' : 'Bonificación'}</span>
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

        {/* Footer with Guardar Cambios button */}
        {(caras.length > 0 || hasChanges) && (
          <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/80' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              {/* Status summary */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${allCarasComplete ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>
                    {allCarasComplete ? (
                      <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Todas las caras completas</span>
                    ) : (
                      <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                        {caras.filter(c => !getCaraCompletionStatus(c).isComplete).length} cara(s) incompleta(s)
                      </span>
                    )}
                  </span>
                </div>
                {hasPendingAuthorization && (
                  <div className={`flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Autorizaciones pendientes
                  </div>
                )}
                {(modifiedCaras.size > 0 || hasChanges) && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    {[
                      hasChanges ? 'Campaña' : '',
                      modifiedCaras.size > 0 ? `${modifiedCaras.size} circuito(s)` : '',
                    ].filter(Boolean).join(' + ')} pendiente(s)
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
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
                      : `${isDark ? 'bg-zinc-700 text-zinc-500' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
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
          <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-zinc-700 border-t-purple-500" />
            <p className="text-zinc-300 font-medium animate-pulse">Procesando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
