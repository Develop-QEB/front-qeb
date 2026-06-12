import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useModalTracker } from '../../hooks/useModalTracker';
import { useQuery } from '@tanstack/react-query';
import { useSocketOrdenesMontaje } from '../../hooks/useSocket';
import {
  X, Download, Filter, ChevronDown, ChevronRight, Calendar, Loader2, FileSpreadsheet,
  Monitor,
  Building2, ClipboardList, Layers, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Check,
  Image, Link2, Film, FileText, ChevronLeft, Play, Search
} from 'lucide-react';
import { campanasService, OrdenMontajeCAT, OrdenMontajeINVIAN, ImagenDigital } from '../../services/campanas.service';
import { ALLOWED_DIGITAL_ITEM_CODES } from '../../config/allowedDigitalArticles';
import { solicitudesService } from '../../services/solicitudes.service';
import { Catorcena } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import * as XLSX from 'xlsx';

// URL base para archivos estáticos
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STATIC_URL = API_URL.replace(/\/api$/, '');

// Helper para normalizar URLs de archivos
const getFileUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;

  // Si es data URL (base64), usarla directamente
  if (url.startsWith('data:')) return url;

  // Si ya es una URL completa (http/https), usarla tal cual
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Si es localhost, convertirla a la URL del entorno actual
    if (url.includes('localhost')) {
      try {
        const urlObj = new URL(url);
        return `${STATIC_URL}${urlObj.pathname}`;
      } catch {
        const match = url.match(/localhost:\d+(.+)/);
        if (match) return `${STATIC_URL}${match[1]}`;
      }
    }
    return url;
  }

  // Si es una ruta relativa, agregar la URL base
  if (url.startsWith('/')) {
    return `${STATIC_URL}${url}`;
  }

  // Si no tiene slash al inicio, agregarlo
  return `${STATIC_URL}/${url}`;
};

// Helper to check if URL is an image
const isImageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  const lower = url.toLowerCase();
  const ext = lower.split(/[?#]/)[0].split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return true;
  // Common image hosting patterns
  if (lower.includes('googleusercontent.com') || lower.includes('imgur.com') || lower.includes('cloudinary.com')) return true;
  return false;
};

// Digital Gallery Modal for Órdenes de Montaje
function OMDigitalGalleryModal({
  isOpen,
  onClose,
  imagenes,
  isLoading,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  imagenes: ImagenDigital[];
  isLoading: boolean;
  title?: string;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imagenes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < imagenes.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentImage = imagenes[currentIndex];
  const getImgUrl = (img: ImagenDigital | undefined) => {
    if (!img) return null;
    return getFileUrl(img.archivoData || img.archivo);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-gray-200'} rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-700' : 'border-gray-200'} flex-shrink-0`}>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-400" />
            {title || 'Galería Digital'}
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-600/30 text-cyan-300 border border-cyan-500/30">
              {imagenes.length} archivo{imagenes.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <button onClick={onClose} className={`p-1 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-colors`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : imagenes.length === 0 ? (
            <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              <div className="text-center">
                <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No hay archivos digitales</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 relative bg-black rounded-lg flex items-center justify-center min-h-[300px]">
                {currentImage?.tipo === 'video' ? (
                  <video
                    key={currentImage.id}
                    src={getImgUrl(currentImage) || ''}
                    controls
                    controlsList="nodownload"
                    className="max-w-full max-h-[450px] rounded"
                    style={{ minHeight: '200px' }}
                  />
                ) : (
                  <img
                    key={currentImage?.id}
                    src={getImgUrl(currentImage) || ''}
                    alt={`Imagen ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

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

                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs">
                  Spot {currentImage?.spot} de {imagenes.length}
                </div>
              </div>

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
                        <div className={`w-full h-full ${isDark ? 'bg-zinc-800' : 'bg-gray-100'} flex items-center justify-center`}>
                          <Play className="h-6 w-6 text-cyan-400" />
                        </div>
                      ) : (
                        <img
                          src={getImgUrl(img) || ''}
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

        <div className={`flex items-center justify-end gap-2 p-4 border-t ${isDark ? 'border-zinc-700' : 'border-gray-200'} flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrdenesMontajeModalProps {
  isOpen: boolean;
  onClose: () => void;
  canExport?: boolean;
}

type TabType = 'cat' | 'ocupacion-digital' | 'digital' | 'invian' | 'invian-digital' | 'invian-unmas';

// Limpia el nombre de un arte quitando el prefijo de Digital Ocean Spaces
// (formato: "<timestamp>-<hash>-<nombreReal>.<ext>") y la extensión.
// Ejemplo: "1778275777548-tdu7x4pm-Bankaool_Abuela.png" -> "Bankaool_Abuela".
// Soporta múltiples nombres separados por coma.
const cleanArteName = (raw?: string | null): string => {
  if (!raw) return '';
  return String(raw)
    .split(',')
    .map(s => {
      const trimmed = s.trim();
      if (!trimmed) return '';
      const noPrefix = trimmed.replace(/^\d+-[a-z0-9]+-/i, '');
      return noPrefix.replace(/\.[a-z0-9]+$/i, '');
    })
    .filter(Boolean)
    .join(', ');
};

// Nombre de arte para el Orden de Montaje: prioriza el nombre_arte MANUAL
// (campo de la carga de artes); si no hay, cae al nombre de archivo limpio.
const arteNombreMontaje = (item: OrdenMontajeINVIAN): string => {
  const manual = (item.nombre_arte_manual || '').trim();
  if (manual) return manual;
  return cleanArteName(item.nombres_artes_digitales || item.ArteFileName || (item.ArteUrl === 'HAS_ARTE' ? '' : item.ArteUrl?.split('/').pop()) || '');
};

// Origen del arte para el Orden de Montaje: URL(s) de Digital Ocean donde está
// almacenado el arte (separadas por coma si hay varios). Fallback al ArteUrl.
const arteOrigenMontaje = (item: OrdenMontajeINVIAN): string => {
  const urls = (item.urls_artes_do || '').trim();
  if (urls) return urls;
  return item.ArteUrl === 'HAS_ARTE' ? '' : (getFileUrl(item.ArteUrl) || '');
};

// Gran formato (UN+): formatos que van a las órdenes "UN+" (Ocupación UN+ e
// Inventario UN+). Una fila es UN+ si es MENSUAL y su formato cae en esta lista.
// Incluye vidrios (exterior/interior) — antes faltaban y se quedaban fuera.
const GRAN_FORMATO_KEYWORDS = ['mi macro', 'mimacro', 'kiosco', 'bolero', 'bajo puente', 'puente peatonal', 'vidrio'];
const esGranFormato = (formato: string | null | undefined): boolean => {
  const f = (formato || '').toLowerCase();
  if (!f) return false;
  return GRAN_FORMATO_KEYWORDS.some(kw => f.includes(kw));
};
const esMensual = (tipoPeriodo: string | null | undefined): boolean =>
  (tipoPeriodo || '').toLowerCase() === 'mensual';

// Extrae la ciudad del codigo_unico de inventarios.
// Formato esperado: 'CODIGO_SENTIDO_CIUDAD' (ej. 'AC3033_Contraflujo2_Acapulco de Juárez').
// Casos especiales en la data: separador con coma en lugar de _ (ej. '21061_Flujo,Monterrey'
// o '21061_Contraflujo ,Monterrey'). Se toma el último segmento por '_', y si tiene coma,
// el último segmento por ',', con trim final.
const extractCiudadFromCodigoUnico = (codigoUnico?: string | null): string => {
  if (!codigoUnico) return '';
  const parts = String(codigoUnico).split('_');
  let last = parts[parts.length - 1] || '';
  if (last.includes(',')) {
    const commaParts = last.split(',');
    last = commaParts[commaParts.length - 1];
  }
  return last.trim();
};

// Status options for filter
const STATUS_OPTIONS = ['Aprobada', 'inactiva', 'finalizada', 'por iniciar', 'en curso'];

// Advanced Filter Types
type FilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface AdvancedFilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterFieldConfig {
  field: string;
  label: string;
}

// CAT Filter Fields
const CAT_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo', label: 'Tipo' },
  { field: 'asesor', label: 'Asesor' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'numero_articulo', label: 'Artículo' },
  { field: 'negociacion', label: 'Negociación' },
];

// INVIAN Filter Fields
const INVIAN_FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'Campania', label: 'Campaña' },
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Operacion', label: 'Operación' },
  { field: 'Vendedor', label: 'Vendedor' },
  { field: 'Ciudad', label: 'Plaza' },
  { field: 'Unidad', label: 'Unidad' },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

// CAT Grouping options
type CATGroupByField = 'plaza' | 'tipo' | 'cliente' | 'campania' | 'numero_articulo';

const CAT_GROUPINGS: { field: CATGroupByField; label: string }[] = [
  { field: 'tipo', label: 'Tipo' },
  { field: 'plaza', label: 'Plaza' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'numero_articulo', label: 'Artículo' },
];

// INVIAN Grouping options
type INVIANGroupByField = 'Anunciante' | 'Operacion' | 'Vendedor' | 'Ciudad';

const INVIAN_GROUPINGS: { field: INVIANGroupByField; label: string }[] = [
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Operacion', label: 'Operación' },
  { field: 'Vendedor', label: 'Vendedor' },
  { field: 'Ciudad', label: 'Plaza' },
];

// CAT Sort Fields
const CAT_SORT_FIELDS = [
  { field: 'plaza', label: 'Plaza' },
  { field: 'tipo', label: 'Tipo' },
  { field: 'cliente', label: 'Cliente' },
  { field: 'campania', label: 'Campaña' },
  { field: 'monto_total', label: 'Monto Total' },
  { field: 'caras', label: 'Caras' },
];

// INVIAN Sort Fields
const INVIAN_SORT_FIELDS = [
  { field: 'Campania', label: 'Campaña' },
  { field: 'Anunciante', label: 'Anunciante' },
  { field: 'Ciudad', label: 'Plaza' },
  { field: 'PrecioPorCara', label: 'Precio/Cara' },
];

// Apply advanced filters function
function applyAdvancedFilters<T extends Record<string, unknown>>(data: T[], filters: AdvancedFilterCondition[]): T[] {
  if (filters.length === 0) return data;

  return data.filter(item => {
    return filters.every(filter => {
      const value = String(item[filter.field] || '').toLowerCase();
      const filterValue = filter.value.toLowerCase();

      switch (filter.operator) {
        case '=':
          return value === filterValue;
        case '!=':
          return value !== filterValue;
        case 'contains':
          return value.includes(filterValue);
        case 'not_contains':
          return !value.includes(filterValue);
        default:
          return true;
      }
    });
  });
}

// Helper to get initials for avatar
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// Helper to get avatar color based on name
function getAvatarColor(name: string | null): string {
  if (!name) return 'bg-zinc-600';
  const colors = [
    'bg-purple-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Maps de colores estáticos para CATRow / INVIANRow — antes se reconstruían
// dentro de cada fila via switch. Misma paleta, lookup O(1) y sin objetos
// nuevos por render.
type NegColorClasses = string;

const NEGOCIACION_COLORS_DARK: Record<string, NegColorClasses> = {
  BONIFICACION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  CORTESIA:     'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  INTERCAMBIO:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  __default:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};
const NEGOCIACION_COLORS_LIGHT: Record<string, NegColorClasses> = {
  BONIFICACION: 'bg-amber-50 text-amber-700 border-amber-200',
  CORTESIA:     'bg-cyan-50 text-cyan-700 border-cyan-200',
  INTERCAMBIO:  'bg-purple-50 text-purple-700 border-purple-200',
  __default:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const getNegociacionColorCls = (neg: string | null, isDark: boolean): NegColorClasses => {
  const map = isDark ? NEGOCIACION_COLORS_DARK : NEGOCIACION_COLORS_LIGHT;
  return (neg && map[neg]) || map.__default;
};

// Mismos colores semánticos para operación/tipoDistribución en INVIANRow.
const getOperacionColorCls = getNegociacionColorCls;

// Format date helper
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  // Extract date parts directly from ISO string to avoid timezone shifts
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrdenesMontajeModal({ isOpen, onClose, canExport = true }: OrdenesMontajeModalProps) {
  useModalTracker('Órdenes de Montaje', isOpen);
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('cat');
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  // Period filters (kept for API query)
  const [status, setStatus] = useState('');
  const [yearInicio, setYearInicio] = useState<number | undefined>(undefined);
  const [yearFin, setYearFin] = useState<number | undefined>(undefined);
  const [catorcenaInicio, setCatorcenaInicio] = useState<number | undefined>(undefined);
  const [catorcenaFin, setCatorcenaFin] = useState<number | undefined>(undefined);

  // Multiselect catorcena filter
  const [selectedCatorcenas, setSelectedCatorcenas] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [showCatorcenaPopup, setShowCatorcenaPopup] = useState(false);

  // Filtros globales (aplican en todas las pestañas)
  const [sapDbFilter, setSapDbFilter] = useState<'todas' | 'TRADE' | 'CIMU'>('todas');
  const [apsEspecificoFilter, setApsEspecificoFilter] = useState<'todas' | 'con' | 'sin'>('todas');
  const [postFilter, setPostFilter] = useState<'todas' | 'con' | 'sin'>('todas');

  // Búsqueda de texto con tags (estilo Solicitudes/Propuestas/Campañas)
  const [searchInput, setSearchInput] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [debouncedSearchInput, setDebouncedSearchInput] = useState('');
  const [debouncedSearchTags, setDebouncedSearchTags] = useState<string[]>([]);

  const addSearchTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !searchTags.includes(trimmed)) {
      setSearchTags(prev => [...prev, trimmed]);
    }
    setSearchInput('');
  };

  const removeSearchTag = (tag: string) => {
    setSearchTags(prev => prev.filter(t => t !== tag));
  };

  // Debounce conjunto: un solo timer para input + tags. Antes había dos
  // efectos paralelos que provocaban renders dobles cuando ambos cambiaban a
  // la vez (típico al presionar Enter para crear un tag, que limpia el input
  // y actualiza tags en el mismo render).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchInput(searchInput);
      setDebouncedSearchTags(searchTags);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, searchTags]);

  const allSearchTerms = useMemo(() => {
    const terms = [...debouncedSearchTags];
    if (debouncedSearchInput.trim()) terms.push(debouncedSearchInput.trim());
    return terms.map(t => t.toLowerCase());
  }, [debouncedSearchTags, debouncedSearchInput]);

  // Construye haystack con TODOS los valores escalares del objeto (string/number/bigint/boolean).
  // Cada término debe matchear (AND); cada término matchea si aparece en cualquier campo (OR).
  const buildHaystack = (item: Record<string, unknown>) => {
    const parts: string[] = [];
    for (const v of Object.values(item)) {
      if (v == null) continue;
      const t = typeof v;
      if (t === 'string' || t === 'number' || t === 'bigint' || t === 'boolean') {
        parts.push(String(v).toLowerCase());
      }
    }
    return parts.join(' | ');
  };

  // matchesSearchCAT / matchesSearchINVIAN se definen MÁS ABAJO, después de
  // que `catData` e `invianData` están declarados (ver useQuery). Las
  // declaraciones viven cerca de los useMemo de filtrado para mantener la
  // proximidad de la lógica de búsqueda.

  // CAT filters/sort/group
  const [catFilters, setCatFilters] = useState<AdvancedFilterCondition[]>([]);
  const [catGroupings, setCatGroupings] = useState<CATGroupByField[]>([]);
  const [catSortField, setCatSortField] = useState<string | null>(null);
  const [catSortDirection, setCatSortDirection] = useState<'asc' | 'desc'>('desc');
  const [catExpandedGroups, setCatExpandedGroups] = useState<Set<string>>(new Set());

  // INVIAN filters/sort/group
  const [invianFilters, setInvianFilters] = useState<AdvancedFilterCondition[]>([]);
  const [invianGroupings, setInvianGroupings] = useState<INVIANGroupByField[]>([]);
  const [invianSortField, setInvianSortField] = useState<string | null>(null);
  const [invianSortDirection, setInvianSortDirection] = useState<'asc' | 'desc'>('desc');
  const [invianExpandedGroups, setInvianExpandedGroups] = useState<Set<string>>(new Set());

  // Digital Gallery state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ImagenDigital[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState('');

  const handleOpenGallery = useCallback(async (item: OrdenMontajeINVIAN) => {
    if (!item.CodigoContrato || !item.rsv_id) return;
    setIsGalleryOpen(true);
    setIsGalleryLoading(true);
    setGalleryTitle(`Artes - ${item.Campania || 'Campaña'}`);
    try {
      const images = await campanasService.getImagenesDigitales(item.CodigoContrato, item.rsv_id);
      if (images.length > 0) {
        setGalleryImages(images);
      } else if (item.ArteUrl === 'HAS_ARTE') {
        // Item tradicional: cargar archivo de la reserva bajo demanda
        const archivo = await campanasService.getReservaArchivo(item.CodigoContrato, item.rsv_id);
        if (archivo) {
          setGalleryImages([{
            id: 0,
            idReserva: item.rsv_id,
            archivo: archivo.startsWith('data:') ? 'arte.jpg' : archivo,
            archivoData: archivo,
            comentario: '',
            estado: '',
            respuesta: '',
            spot: 1,
            tipo: 'image',
          }]);
        } else {
          setGalleryImages([]);
        }
      } else {
        setGalleryImages([]);
      }
    } catch (err) {
      console.error('Error loading gallery images:', err);
      setGalleryImages([]);
    } finally {
      setIsGalleryLoading(false);
    }
  }, []);

  // Popup visibility
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [showSortPopup, setShowSortPopup] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Get catorcenas for filter
  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas'],
    queryFn: () => solicitudesService.getCatorcenas(),
  });

  // Set default catorcena filter to current catorcena on open
  useEffect(() => {
    if (isOpen && catorcenasData?.data && selectedCatorcenas.length === 0) {
      const now = new Date();
      const catActual = catorcenasData.data.find((c: any) => new Date(c.fecha_inicio) <= now && new Date(c.fecha_fin) >= now);
      if (catActual) {
        setSelectedCatorcenas([`${catActual.numero_catorcena}-${catActual.a_o}`]);
      }
    }
  }, [isOpen, catorcenasData]);

  // Calculate API range from selected catorcenas
  const apiCatorcenaRange = useMemo(() => {
    if (selectedCatorcenas.length === 0) return {};
    const parsed = selectedCatorcenas.map(s => { const [n, y] = s.split('-'); return { numero: parseInt(n), year: parseInt(y) }; });
    const sorted = parsed.sort((a, b) => a.year !== b.year ? a.year - b.year : a.numero - b.numero);
    return {
      catorcenaInicio: sorted[0].numero,
      yearInicio: sorted[0].year,
      catorcenaFin: sorted[sorted.length - 1].numero,
      yearFin: sorted[sorted.length - 1].year,
    };
  }, [selectedCatorcenas]);

  // Query for CAT data
  const { data: catData, isLoading: isLoadingCAT } = useQuery({
    queryKey: ['ordenes-montaje-cat', status, apiCatorcenaRange, selectedCatorcenas],
    queryFn: () => campanasService.getOrdenMontajeCAT({
      status: status || undefined,
      ...apiCatorcenaRange,
    }),
    enabled: isOpen && (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital'),
  });

  // Refresca la columna Diferencia en tiempo real cuando alguien crea/borra reservas
  useSocketOrdenesMontaje(isOpen);

  // Query for INVIAN data
  const { data: invianData, isLoading: isLoadingINVIAN } = useQuery({
    queryKey: ['ordenes-montaje-invian', status, apiCatorcenaRange, selectedCatorcenas],
    queryFn: () => campanasService.getOrdenMontajeINVIAN({
      status: status || undefined,
      ...apiCatorcenaRange,
    }),
    enabled: isOpen && (activeTab === 'invian' || activeTab === 'invian-digital' || activeTab === 'invian-unmas'),
  });

  // Haystack precalculado por item — antes `buildHaystack` se ejecutaba en
  // CADA filtrado × CADA item, y los 3-5 useMemo de filtros lo recorrían cada
  // uno. Con N=1000 items × 5 vistas = 5000 reconstrucciones por keystroke.
  // Ahora se calcula UNA vez cuando llega `catData` (o cambia la ref) y se
  // guarda en un Map; los `matchesSearch*` solo hacen `string.includes`.
  // Mismos campos, misma semántica — solo cacheado.
  const catHaystackMap = useMemo(() => {
    const m = new Map<OrdenMontajeCAT, string>();
    if (!catData) return m;
    for (const item of catData) m.set(item, buildHaystack(item as unknown as Record<string, unknown>));
    return m;
  }, [catData]);

  const invianHaystackMap = useMemo(() => {
    const m = new Map<OrdenMontajeINVIAN, string>();
    if (!invianData) return m;
    for (const item of invianData) m.set(item, buildHaystack(item as unknown as Record<string, unknown>));
    return m;
  }, [invianData]);

  const matchesSearchCAT = useCallback((item: OrdenMontajeCAT) => {
    if (allSearchTerms.length === 0) return true;
    // Fallback a recálculo en caliente si el item no está en el cache
    // (defensivo: items agregados fuera del flujo normal de useQuery).
    const haystack = catHaystackMap.get(item) ?? buildHaystack(item as unknown as Record<string, unknown>);
    return allSearchTerms.every(term => haystack.includes(term));
  }, [allSearchTerms, catHaystackMap]);

  const matchesSearchINVIAN = useCallback((item: OrdenMontajeINVIAN) => {
    if (allSearchTerms.length === 0) return true;
    const haystack = invianHaystackMap.get(item) ?? buildHaystack(item as unknown as Record<string, unknown>);
    return allSearchTerms.every(term => haystack.includes(term));
  }, [allSearchTerms, invianHaystackMap]);

  const years = catorcenasData?.years || [];

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearInicio) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearInicio);
    if (yearInicio === yearFin && catorcenaFin) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena <= catorcenaFin);
    }
    return catorcenas;
  }, [catorcenasData, yearInicio, yearFin, catorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !yearFin) return [];
    const catorcenas = catorcenasData.data.filter((c: Catorcena) => c.a_o === yearFin);
    if (yearInicio === yearFin && catorcenaInicio) {
      return catorcenas.filter((c: Catorcena) => c.numero_catorcena >= catorcenaInicio);
    }
    return catorcenas;
  }, [catorcenasData, yearFin, yearInicio, catorcenaInicio]);

  // Periodo multiselect options - sirve para campañas mensuales y de catorcena.
  // Etiqueta enriquecida con rango de fechas para identificar qué mes cubre cada catorcena.
  const catorcenaOptions = useMemo(() => {
    if (!catorcenasData?.data) return [];
    const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fmt = (s: string) => {
      const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return '';
      return `${parseInt(m[3])} ${MESES_ABREV[parseInt(m[2]) - 1]}`;
    };
    return catorcenasData.data.map((c: any) => ({
      id: `${c.numero_catorcena}-${c.a_o}`,
      label: `Cat ${c.numero_catorcena} / ${c.a_o}${c.fecha_inicio && c.fecha_fin ? ` (${fmt(c.fecha_inicio)}–${fmt(c.fecha_fin)})` : ''}`,
      numero: c.numero_catorcena,
      year: c.a_o,
    })).sort((a: any, b: any) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.numero - a.numero;
    });
  }, [catorcenasData]);

    // Filtered and sorted CAT data
  const filteredCATData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Exclude digital items (they have their own tab)
    items = items.filter(item => {
      const td = (item.tradicional_digital || '').toUpperCase();
      return td !== 'DIGITAL';
    });

    // Búsqueda de texto
    if (allSearchTerms.length > 0) {
      items = items.filter(matchesSearchCAT);
    }

    // Filtros globales: SAP DB + APS Específico
    if (sapDbFilter !== 'todas') {
      items = items.filter(item => (item.sap_database || '').toUpperCase() === sapDbFilter);
    }
    if (apsEspecificoFilter === 'con') {
      items = items.filter(item => item.aps_especifico !== null && item.aps_especifico !== '');
    } else if (apsEspecificoFilter === 'sin') {
      items = items.filter(item => item.aps_especifico === null || item.aps_especifico === '');
    }
    if (postFilter === 'con') {
      items = items.filter(item => item.posted === true);
    } else if (postFilter === 'sin') {
      items = items.filter(item => item.posted !== true);
    }

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio_periodo) return false;
        const itemDate = new Date(item.fecha_inicio_periodo);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as unknown as OrdenMontajeCAT[];
    }

    // Apply sorting
    if (catSortField && items.length > 0) {
      items.sort((a, b) => {
        const aVal = a[catSortField as keyof OrdenMontajeCAT];
        const bVal = b[catSortField as keyof OrdenMontajeCAT];
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return catSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return catSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [catData, selectedCatorcenas, fechaInicio, fechaFin, catFilters, catSortField, catSortDirection, sapDbFilter, apsEspecificoFilter, postFilter, allSearchTerms, matchesSearchCAT]);

  // Filtered Ocupacion Digital data (CAT only digital items)
  const filteredOcupacionDigitalData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Only digital items (tradicional_digital = 'Digital')
    items = items.filter(item => {
      const td = (item.tradicional_digital || '').toUpperCase();
      return td === 'DIGITAL';
    });

    // Búsqueda de texto
    if (allSearchTerms.length > 0) {
      items = items.filter(matchesSearchCAT);
    }

    // Filtros globales
    if (sapDbFilter !== 'todas') {
      items = items.filter(item => (item.sap_database || '').toUpperCase() === sapDbFilter);
    }
    if (apsEspecificoFilter === 'con') {
      items = items.filter(item => item.aps_especifico !== null && item.aps_especifico !== '');
    } else if (apsEspecificoFilter === 'sin') {
      items = items.filter(item => item.aps_especifico === null || item.aps_especifico === '');
    }
    if (postFilter === 'con') {
      items = items.filter(item => item.posted === true);
    } else if (postFilter === 'sin') {
      items = items.filter(item => item.posted !== true);
    }

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio_periodo) return false;
        const itemDate = new Date(item.fecha_inicio_periodo);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as unknown as OrdenMontajeCAT[];
    }

    // Sort
    if (catSortField) {
      items.sort((a, b) => {
        const aVal = a[catSortField as keyof OrdenMontajeCAT];
        const bVal = b[catSortField as keyof OrdenMontajeCAT];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return catSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        return catSortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return items;
  }, [catData, selectedCatorcenas, fechaInicio, fechaFin, catFilters, catSortField, catSortDirection, sapDbFilter, apsEspecificoFilter, postFilter, allSearchTerms, matchesSearchCAT]);

  // Filter Ocupacion UN+ data: solo gran formato (mi macro, kioscos, boleros,
  // bajo puentes, puentes peatonales) Y solo periodos mensuales.
  // Excluye parabus, columnas, tradicional y digital.
  const filteredDigitalData = useMemo(() => {
    if (!catData) return [];
    let items = [...catData];

    // Solo periodos mensuales + gran formato (incluye vidrios; ver helper).
    items = items.filter(item => esMensual(item.tipo_periodo) && esGranFormato(item.tipo));

    // Filtros globales
    if (sapDbFilter !== 'todas') {
      items = items.filter(item => (item.sap_database || '').toUpperCase() === sapDbFilter);
    }
    if (apsEspecificoFilter === 'con') {
      items = items.filter(item => item.aps_especifico !== null && item.aps_especifico !== '');
    } else if (apsEspecificoFilter === 'sin') {
      items = items.filter(item => item.aps_especifico === null || item.aps_especifico === '');
    }
    if (postFilter === 'con') {
      items = items.filter(item => item.posted === true);
    } else if (postFilter === 'sin') {
      items = items.filter(item => item.posted !== true);
    }

    // Excluir digital (tradicional_digital === 'Digital')
    items = items.filter(item => {
      const td = (item.tradicional_digital || '').toUpperCase();
      return td !== 'DIGITAL';
    });

    // Búsqueda de texto
    if (allSearchTerms.length > 0) {
      items = items.filter(matchesSearchCAT);
    }

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio_periodo) return false;
        const itemDate = new Date(item.fecha_inicio_periodo);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters (reuse cat filters for digital)
    if (catFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], catFilters) as unknown as OrdenMontajeCAT[];
    }

    // Sort
    if (catSortField) {
      items.sort((a, b) => {
        const aVal = a[catSortField as keyof OrdenMontajeCAT];
        const bVal = b[catSortField as keyof OrdenMontajeCAT];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return catSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        return catSortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return items;
  }, [catData, selectedCatorcenas, fechaInicio, fechaFin, catFilters, catSortField, catSortDirection, sapDbFilter, apsEspecificoFilter, postFilter, allSearchTerms, matchesSearchCAT]);

  // Group CAT data
  const getCATGroupValue = (item: OrdenMontajeCAT, field: CATGroupByField): string => {
    const val = item[field as keyof OrdenMontajeCAT];
    return val ? String(val) : `Sin ${CAT_GROUPINGS.find(g => g.field === field)?.label || 'asignar'}`;
  };

  const groupedCATData = useMemo(() => {
    if (catGroupings.length === 0 || !filteredCATData.length) return null;

    const groups: Record<string, OrdenMontajeCAT[]> = {};
    filteredCATData.forEach(item => {
      const key = getCATGroupValue(item, catGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredCATData, catGroupings]);

  // Group Ocupacion Digital data
  const groupedOcupacionDigitalData = useMemo(() => {
    if (catGroupings.length === 0 || !filteredOcupacionDigitalData.length) return null;

    const groups: Record<string, OrdenMontajeCAT[]> = {};
    filteredOcupacionDigitalData.forEach(item => {
      const key = getCATGroupValue(item, catGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredOcupacionDigitalData, catGroupings]);

  // Filtered and sorted INVIAN data
  const filteredINVIANData = useMemo(() => {
    if (!invianData) return [];
    let items = [...invianData];

    // Excluir digitales — usar el campo `tradicional_digital` del inventario
    // (fuente de verdad). Antes filtrábamos por una whitelist hardcodeada de
    // ItemCodes y se colaban los digitales nuevos que no estaban listados
    // (ej. RT-PB-SEG-MX, BF-P2-COB-AC). Whitelist queda como fallback solo
    // cuando `tradicional_digital` viene NULL.
    items = items.filter(item => {
      const td = (item.tradicional_digital || '').toUpperCase();
      if (td === 'DIGITAL') return false;
      if (td === 'TRADICIONAL') return true;
      // Sin tradicional_digital definido (data sucia) → fallback a whitelist
      return !item.numero_articulo || !ALLOWED_DIGITAL_ITEM_CODES.has(item.numero_articulo);
    });

    // Búsqueda de texto
    if (allSearchTerms.length > 0) {
      items = items.filter(matchesSearchINVIAN);
    }

    // Filtro global SAP DB
    if (sapDbFilter !== 'todas') {
      items = items.filter(item => (item.sap_database || '').toUpperCase() === sapDbFilter);
    }
    if (postFilter === 'con') {
      items = items.filter(item => item.posted === true);
    } else if (postFilter === 'sin') {
      items = items.filter(item => item.posted !== true);
    }
    // Filtro APS: en INVIAN la APS vive en CodigoContrato (back: rsv.APS AS rsv_aps).
    // "sin APS" = null o 0 (mismo criterio que el back: APS IS NULL OR APS = 0).
    if (apsEspecificoFilter === 'con') {
      items = items.filter(item => item.CodigoContrato != null && item.CodigoContrato !== 0);
    } else if (apsEspecificoFilter === 'sin') {
      items = items.filter(item => item.CodigoContrato == null || item.CodigoContrato === 0);
    }

    // Filter by date range if set
    if (fechaInicio || fechaFin) {
      const startDate = fechaInicio ? new Date(fechaInicio) : null;
      const endDate = fechaFin ? new Date(fechaFin) : null;
      // Ajustar endDate al final del día
      if (endDate) endDate.setHours(23, 59, 59, 999);
      items = items.filter(item => {
        if (!item.fecha_inicio) return false;
        const itemDate = new Date(item.fecha_inicio);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    // Filter by selected catorcenas if any
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (invianFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], invianFilters) as unknown as OrdenMontajeINVIAN[];
    }

    // Apply sorting
    if (invianSortField && items.length > 0) {
      items.sort((a, b) => {
        const aVal = a[invianSortField as keyof OrdenMontajeINVIAN];
        const bVal = b[invianSortField as keyof OrdenMontajeINVIAN];
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return invianSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return invianSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [invianData, selectedCatorcenas, fechaInicio, fechaFin, invianFilters, invianSortField, invianSortDirection, sapDbFilter, apsEspecificoFilter, postFilter, allSearchTerms, matchesSearchINVIAN]);

  // Group INVIAN data
  const getINVIANGroupValue = (item: OrdenMontajeINVIAN, field: INVIANGroupByField): string => {
    const val = item[field as keyof OrdenMontajeINVIAN];
    return val ? String(val) : `Sin ${INVIAN_GROUPINGS.find(g => g.field === field)?.label || 'asignar'}`;
  };

  const groupedINVIANData = useMemo(() => {
    if (invianGroupings.length === 0 || !filteredINVIANData.length) return null;

    const groups: Record<string, OrdenMontajeINVIAN[]> = {};
    filteredINVIANData.forEach(item => {
      const key = getINVIANGroupValue(item, invianGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredINVIANData, invianGroupings]);

  // Filtered INVIAN Digital data — solo digitales (inverso del filtro de VP)
  const filteredINVIANDigitalData = useMemo(() => {
    let items = invianData || [];

    // Solo digitales — usar tradicional_digital del back. Whitelist como
    // fallback cuando tradicional_digital viene NULL (data sucia).
    items = items.filter(item => {
      const td = (item.tradicional_digital || '').toUpperCase();
      if (td === 'DIGITAL') return true;
      if (td === 'TRADICIONAL') return false;
      return item.numero_articulo != null && ALLOWED_DIGITAL_ITEM_CODES.has(item.numero_articulo);
    });

    // Búsqueda de texto
    if (allSearchTerms.length > 0) {
      items = items.filter(matchesSearchINVIAN);
    }

    // Filtro global SAP DB
    if (sapDbFilter !== 'todas') {
      items = items.filter(item => (item.sap_database || '').toUpperCase() === sapDbFilter);
    }
    if (postFilter === 'con') {
      items = items.filter(item => item.posted === true);
    } else if (postFilter === 'sin') {
      items = items.filter(item => item.posted !== true);
    }
    // Filtro APS: en INVIAN la APS vive en CodigoContrato (back: rsv.APS AS rsv_aps).
    // "sin APS" = null o 0 (mismo criterio que el back: APS IS NULL OR APS = 0).
    if (apsEspecificoFilter === 'con') {
      items = items.filter(item => item.CodigoContrato != null && item.CodigoContrato !== 0);
    } else if (apsEspecificoFilter === 'sin') {
      items = items.filter(item => item.CodigoContrato == null || item.CodigoContrato === 0);
    }

    // Filter by date range
    if (fechaInicio || fechaFin) {
      items = items.filter(item => {
        const fecha = item.fecha_inicio ? new Date(item.fecha_inicio) : null;
        if (!fecha) return false;
        const isAfterInicio = !fechaInicio || fecha >= new Date(fechaInicio);
        const isBeforeFin = !fechaFin || fecha <= new Date(fechaFin);
        return isAfterInicio && isBeforeFin;
      });
    }

    // Filter by catorcenas
    if (selectedCatorcenas.length > 0) {
      items = items.filter(item => {
        if (!item.catorcena_numero || !item.catorcena_year) return false;
        const catorcenaId = `${item.catorcena_numero}-${item.catorcena_year}`;
        return selectedCatorcenas.includes(catorcenaId);
      });
    }

    // Apply advanced filters
    if (invianFilters.length > 0) {
      items = applyAdvancedFilters(items as unknown as Record<string, unknown>[], invianFilters) as unknown as OrdenMontajeINVIAN[];
    }

    // Apply sorting
    if (invianSortField && items.length > 0) {
      items.sort((a, b) => {
        const aVal = a[invianSortField as keyof OrdenMontajeINVIAN];
        const bVal = b[invianSortField as keyof OrdenMontajeINVIAN];
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return invianSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return invianSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [invianData, selectedCatorcenas, fechaInicio, fechaFin, invianFilters, invianSortField, invianSortDirection, sapDbFilter, apsEspecificoFilter, postFilter, allSearchTerms, matchesSearchINVIAN]);

  // Group INVIAN Digital data
  const groupedINVIANDigitalData = useMemo(() => {
    if (invianGroupings.length === 0 || !filteredINVIANDigitalData.length) return null;

    const groups: Record<string, OrdenMontajeINVIAN[]> = {};
    filteredINVIANDigitalData.forEach(item => {
      const key = getINVIANGroupValue(item, invianGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredINVIANDigitalData, invianGroupings]);

  // Inventario UN+ — igual que Inventario VP pero SOLO mensual + gran formato.
  // Se deriva de filteredINVIANData (que ya aplicó búsqueda/filtros/orden), solo
  // se acota a mensual + gran formato (incluye vidrios; ver esGranFormato).
  const filteredINVIANUnmasData = useMemo(
    () => filteredINVIANData.filter(item => esMensual(item.tipo_periodo) && esGranFormato(item.formato)),
    [filteredINVIANData]
  );

  const groupedINVIANUnmasData = useMemo(() => {
    if (invianGroupings.length === 0 || !filteredINVIANUnmasData.length) return null;
    const groups: Record<string, OrdenMontajeINVIAN[]> = {};
    filteredINVIANUnmasData.forEach(item => {
      const key = getINVIANGroupValue(item, invianGroupings[0]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredINVIANUnmasData, invianGroupings]);

  // Calculate totals - ensure numeric addition (based on filtered data)
  const catTotals = useMemo(() => {
    if (!filteredCATData || filteredCATData.length === 0) return { caras: 0, tarifa: 0, monto: 0 };
    return {
      caras: filteredCATData.reduce((sum, i) => sum + (Number(i.caras) || 0), 0),
      tarifa: filteredCATData.reduce((sum, i) => sum + (Number(i.tarifa) || 0), 0),
      monto: filteredCATData.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0),
    };
  }, [filteredCATData]);

  const ocupacionDigitalTotals = useMemo(() => {
    if (!filteredOcupacionDigitalData || filteredOcupacionDigitalData.length === 0) return { caras: 0, tarifa: 0, monto: 0 };
    return {
      caras: filteredOcupacionDigitalData.reduce((sum, i) => sum + (Number(i.caras) || 0), 0),
      tarifa: filteredOcupacionDigitalData.reduce((sum, i) => sum + (Number(i.tarifa) || 0), 0),
      monto: filteredOcupacionDigitalData.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0),
    };
  }, [filteredOcupacionDigitalData]);

  // Export to XLSX
  const handleExportXLSX = () => {
    if (activeTab === 'cat' && filteredCATData.length > 0) {
      const negociacionLabel = (neg: string) => {
        switch (neg) {
          case 'RENTA': return 'RENTA';
          case 'BONIFICACION': return 'BONIFICACION';
          case 'CORTESIA': return 'CORTESIA';
          case 'INTERCAMBIO': return 'IN - RENTA (INTERCAMBIO)';
          case 'IMPRESION': return 'IMPRESION';
          default: return neg || '';
        }
      };
      const formatDateCSV = (dateStr: string | null) => {
        if (!dateStr) return '';
        // Handle ISO date strings - extract date part directly to avoid timezone issues
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      };
      const carasKeyCAT = filteredCATData.length > 0 && filteredCATData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Suma de Puentes' : 'Suma de Caras';
      const wsData = filteredCATData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor Comercial': item.asesor || '',
        'APS Global': item.campania_id || item.aps_global || '',
        'APS Específico': item.aps_especifico || '',
        'CUIC': item.cuic || '',
        'Fecha Inicio Periodo': formatDateCSV(item.fecha_inicio_periodo),
        'Fecha Fin Periodo': formatDateCSV(item.fecha_fin_periodo),
        'Cliente Comercial': item.cliente || '',
        'Marca': item.marca || '',
        'Campaña': item.campania || '',
        'Número de artículo': item.numero_articulo || '',
        'Articulo': negociacionLabel(item.negociacion),
        [carasKeyCAT]: Number(item.caras) || 0,
        'Suma de Tarifa': Number(item.tarifa) || 0,
        'Suma de Monto Total': Number(item.monto_total) || 0,
        'Diferencia': (() => { const d = Number(item.delta_caras) || 0; if (d === 0) return '✓'; return d > 0 ? `+${d}` : `${d}`; })(),
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje CAT');
      XLSX.writeFile(wb, `orden_montaje_ocupacion_vp_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'ocupacion-digital' && filteredOcupacionDigitalData.length > 0) {
      const carasKeyOD = filteredOcupacionDigitalData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Puentes' : 'Caras';
      const wsData = filteredOcupacionDigitalData.map(item => ({
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor': item.asesor || '',
        'APS Global': item.campania_id || item.aps_global || '',
        'APS Específico': item.aps_especifico || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? formatDate(item.fecha_inicio_periodo) : '',
        'Fecha Fin': item.fecha_fin_periodo ? formatDate(item.fecha_fin_periodo) : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Unidad de Negocio': item.unidad_negocio || '',
        'Campaña': item.campania || '',
        'Artículo': item.numero_articulo || '',
        'Negociación': item.negociacion || '',
        [carasKeyOD]: Number(item.caras) || 0,
        'Tarifa': Number(item.tarifa) || 0,
        'Monto Total': Number(item.monto_total) || 0,
        'Diferencia': (() => { const d = Number(item.delta_caras) || 0; if (d === 0) return '✓'; return d > 0 ? `+${d}` : `${d}`; })(),
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ocupacion Digital');
      XLSX.writeFile(wb, `orden_montaje_ocupacion_digital_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'digital' && filteredDigitalData.length > 0) {
      const carasKeyDig = filteredDigitalData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Puentes' : 'Caras';
      const wsData = filteredDigitalData.map(item => ({
        'Mes': mesFromDate(item.fecha_inicio_periodo),
        'Plaza': item.plaza || '',
        'Tipo': item.tipo || '',
        'Asesor Comercial': item.asesor || '',
        'APS Global': item.campania_id || item.aps_global || '',
        'APS Específico': item.aps_especifico || '',
        'CUIC': item.cuic || '',
        'Fecha Inicio': item.fecha_inicio_periodo ? new Date(item.fecha_inicio_periodo).toLocaleDateString() : '',
        'Fecha Fin': item.fecha_fin_periodo ? new Date(item.fecha_fin_periodo).toLocaleDateString() : '',
        'Cliente': item.cliente || '',
        'Marca': item.marca || '',
        'Unidad de Negocio': item.unidad_negocio || '',
        'Campaña': item.campania || '',
        'No. Artículo': item.numero_articulo || '',
        'Negociación': item.negociacion || '',
        [carasKeyDig]: item.caras || 0,
        'Tarifa': Number(item.tarifa) || 0,
        'Monto Total': Number(item.monto_total) || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Digital');
      XLSX.writeFile(wb, `orden_montaje_digital_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if ((activeTab === 'invian' || activeTab === 'invian-unmas') && (activeTab === 'invian-unmas' ? filteredINVIANUnmasData : filteredINVIANData).length > 0) {
      // Inventario VP y Inventario UN+ comparten las MISMAS columnas (formato
      // para importar a INVIAN). UN+ solo cambia el subconjunto de filas
      // (mensual + gran formato) y el nombre del archivo.
      const invSource = activeTab === 'invian-unmas' ? filteredINVIANUnmasData : filteredINVIANData;
      const wsData = invSource.map(item => {
        const plazaDerivada = extractCiudadFromCodigoUnico(item.Unidad) || item.Ciudad || '';
        return {
          'Campaña': item.Campania || '',
          'Anunciante': item.Anunciante || '',
          'Operación': item.Operacion || '',
          'Código de contrato (Opcional)': item.CodigoContrato || '',
          'Precio por cara (Opcional)': Number(item.PrecioPorCara) || 0,
          'Vendedor': item.Vendedor || '',
          'Descripción (Opcional)': item.Descripcion || '',
          'Inicio o Periodo': item.InicioPeriodo || '',
          'Fin o Segmento': item.FinSegmento || '',
          // Arte = nombre_arte MANUAL (el de la carga de artes). Si no hay nombre
          // manual, cae al nombre de archivo limpio.
          'Arte': arteNombreMontaje(item),
          // Notas de los artes (separadas por coma si hay varios).
          'Notas': item.notas_artes || '',
          'Código de arte (Opcional)': '',
          // Origen = URL(s) de Digital Ocean donde está almacenado el arte.
          'Origen del arte (Opcional)': arteOrigenMontaje(item),
          'Unidad': (item.Unidad || '').split('_')[0] || '',
          'Cara': item.Cara || '',
          'Plaza': plazaDerivada,
          'Código Único': item.Unidad || '',
          'Tipo Inventario': item.tradicional_digital || '',
          'Tipo de Distribución': item.TipoDistribucion || '',
          'Reproducciones': item.Reproducciones || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      const esUnmas = activeTab === 'invian-unmas';
      XLSX.utils.book_append_sheet(wb, ws, esUnmas ? 'Orden Montaje INVIAN UN+' : 'Orden Montaje INVIAN');
      XLSX.writeFile(wb, `orden_montaje_invian${esUnmas ? '_unmas' : ''}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'invian-digital' && filteredINVIANDigitalData.length > 0) {
      const wsData = filteredINVIANDigitalData.map(item => {
        const plazaDerivada = extractCiudadFromCodigoUnico(item.Unidad) || item.Ciudad || '';
        return {
          'Campaña': item.Campania || '',
          'Anunciante': item.Anunciante || '',
          'Operación': item.Operacion || '',
          'Código de contrato (Opcional)': item.CodigoContrato || '',
          'Precio por cara (Opcional)': Number(item.PrecioPorCara) || 0,
          'Vendedor': item.Vendedor || '',
          'Descripción (Opcional)': item.Descripcion || '',
          'Inicio o Periodo': item.InicioPeriodo || '',
          'Fin o Segmento': item.FinSegmento || '',
          // Arte = nombre_arte MANUAL (el de la carga de artes). Si no hay nombre
          // manual, cae al nombre de archivo limpio.
          'Arte': arteNombreMontaje(item),
          // Notas de los artes (separadas por coma si hay varios).
          'Notas': item.notas_artes || '',
          'Código de arte (Opcional)': '',
          // Origen = URL(s) de Digital Ocean donde está almacenado el arte.
          'Origen del arte (Opcional)': arteOrigenMontaje(item),
          'Unidad': (item.Unidad || '').split('_')[0] || '',
          'Cara': item.Cara || '',
          'Plaza': plazaDerivada,
          'Código Único': item.Unidad || '',
          'Tipo Inventario': item.tradicional_digital || '',
          'Tipo de Distribución': item.TipoDistribucion || '',
          'Reproducciones': item.Reproducciones || '',
          'Artículo': item.numero_articulo || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden Montaje INVIAN Digital');
      XLSX.writeFile(wb, `orden_montaje_invian_digital_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Get unique values for filter dropdowns
  const getCATUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!catData) return valuesMap;
    CAT_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      catData.forEach(item => {
        const val = item[fieldConfig.field as keyof OrdenMontajeCAT];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [catData]);

  const getINVIANUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!invianData) return valuesMap;
    INVIAN_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      invianData.forEach(item => {
        const val = item[fieldConfig.field as keyof OrdenMontajeINVIAN];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [invianData]);

  // Unique values for INVIAN Digital filters
  const getINVIANDigitalUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    if (!invianData) return valuesMap;
    const digitalItems = invianData.filter(item => item.numero_articulo != null && ALLOWED_DIGITAL_ITEM_CODES.has(item.numero_articulo));
    INVIAN_FILTER_FIELDS.forEach(fieldConfig => {
      const values = new Set<string>();
      digitalItems.forEach(item => {
        const val = item[fieldConfig.field as keyof OrdenMontajeINVIAN];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fieldConfig.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [invianData]);

  // Filter management callbacks
  const addFilter = useCallback(() => {
    const fields = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
    const newFilter: AdvancedFilterCondition = {
      id: `filter-${Date.now()}`,
      field: fields[0].field,
      operator: '=',
      value: '',
    };
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatFilters(prev => [...prev, newFilter]);
    } else {
      setInvianFilters(prev => [...prev, newFilter]);
    }
  }, [activeTab]);

  const updateFilter = useCallback((id: string, updates: Partial<AdvancedFilterCondition>) => {
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    } else {
      setInvianFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    }
  }, [activeTab]);

  const removeFilter = useCallback((id: string) => {
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatFilters(prev => prev.filter(f => f.id !== id));
    } else {
      setInvianFilters(prev => prev.filter(f => f.id !== id));
    }
  }, [activeTab]);

  const clearCurrentFilters = useCallback(() => {
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatFilters([]);
    } else {
      setInvianFilters([]);
    }
  }, [activeTab]);

  // Grouping toggle
  const toggleGrouping = useCallback((field: string) => {
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatGroupings(prev => {
        if (prev.includes(field as CATGroupByField)) {
          return prev.filter(f => f !== field);
        }
        return [field as CATGroupByField];
      });
    } else {
      setInvianGroupings(prev => {
        if (prev.includes(field as INVIANGroupByField)) {
          return prev.filter(f => f !== field);
        }
        return [field as INVIANGroupByField];
      });
    }
  }, [activeTab]);

  // Toggle expanded groups
  const toggleGroup = useCallback((groupName: string) => {
    if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
      setCatExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupName)) next.delete(groupName);
        else next.add(groupName);
        return next;
      });
    } else {
      setInvianExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(groupName)) next.delete(groupName);
        else next.add(groupName);
        return next;
      });
    }
  }, [activeTab]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStatus('');
    setYearInicio(undefined);
    setYearFin(undefined);
    setCatorcenaInicio(undefined);
    setCatorcenaFin(undefined);
    setSelectedCatorcenas([]);
    setFechaInicio('');
    setFechaFin('');
    setCatFilters([]);
    setCatGroupings([]);
    setCatSortField(null);
    setInvianFilters([]);
    setInvianGroupings([]);
    setInvianSortField(null);
    setCurrentPage(1);
  }, []);

  // Current tab data
  const currentFilters = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? catFilters : invianFilters;
  const currentGroupings = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? catGroupings : invianGroupings;
  const currentSortField = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? catSortField : invianSortField;
  const currentSortDirection = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? catSortDirection : invianSortDirection;
  const currentFilterFields = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? CAT_FILTER_FIELDS : INVIAN_FILTER_FIELDS;
  const currentGroupOptions = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? CAT_GROUPINGS : INVIAN_GROUPINGS;
  const currentSortOptions = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? CAT_SORT_FIELDS : INVIAN_SORT_FIELDS;
  const currentUniqueValues = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? getCATUniqueValues : activeTab === 'invian-digital' ? getINVIANDigitalUniqueValues : getINVIANUniqueValues;

  const hasActiveFilters = currentFilters.length > 0 || currentGroupings.length > 0 || currentSortField !== null || selectedCatorcenas.length > 0 || fechaInicio || fechaFin || sapDbFilter !== 'todas' || apsEspecificoFilter !== 'todas' || postFilter !== 'todas';

  if (!isOpen) return null;

  const isLoading = activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital' ? isLoadingCAT : isLoadingINVIAN;
  const dataCount = activeTab === 'cat' ? filteredCATData.length : activeTab === 'ocupacion-digital' ? filteredOcupacionDigitalData.length : activeTab === 'digital' ? filteredDigitalData.length : activeTab === 'invian-digital' ? filteredINVIANDigitalData.length : activeTab === 'invian-unmas' ? filteredINVIANUnmasData.length : filteredINVIANData.length;
  // Ocupación VP: total = registros NO digitales del endpoint CAT (los digitales
  // viven en la pestaña Ocupación Digital y confundía verlos restados del total).
  const totalCount = activeTab === 'cat'
    ? (catData?.filter(i => (i.tradicional_digital || '').toUpperCase() !== 'DIGITAL').length || 0)
    : activeTab === 'ocupacion-digital' ? filteredOcupacionDigitalData.length
    : activeTab === 'digital' ? filteredDigitalData.length
    : activeTab === 'invian-digital' ? filteredINVIANDigitalData.length
    : activeTab === 'invian-unmas' ? filteredINVIANUnmasData.length
    : (invianData?.length || 0);

  const totalPages = Math.max(1, Math.ceil(dataCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginated slices (only used when no grouping active)
  const paginatedCATData = filteredCATData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const paginatedOcupacionDigitalData = filteredOcupacionDigitalData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const paginatedDigitalData = filteredDigitalData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const paginatedINVIANData = filteredINVIANData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const paginatedINVIANDigitalData = filteredINVIANDigitalData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  const paginatedINVIANUnmasData = filteredINVIANUnmasData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-[95vw] max-w-7xl h-[90vh] ${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-800/80 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-900/30' : 'border-gray-200 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-purple-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Órdenes de Montaje</h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Gestión y exportación de órdenes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'} transition-colors`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controles (arriba) + Tabs (abajo), en 2 filas para no amontonar */}
        <div className={`flex flex-col gap-3 px-6 py-3 border-b ${isDark ? 'border-zinc-800/50 bg-zinc-900/80' : 'border-gray-200 bg-gray-50/80'}`}>
          {/* Tabs ARRIBA: tira pareja de 6 columnas iguales (no cambian de tamaño al seleccionar) */}
          <div className={`order-1 grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 ${isDark ? 'bg-zinc-800/80 border-zinc-700/50' : 'bg-gray-100 border-gray-200'} rounded-xl border`}>
            <button
              onClick={() => { setActiveTab('cat'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cat'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Ocupacion VP
            </button>
            <button
              onClick={() => { setActiveTab('ocupacion-digital'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ocupacion-digital'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Ocupacion Digital
            </button>
            <button
              onClick={() => { setActiveTab('digital'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'digital'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Ocupacion UN+
            </button>
            <button
              onClick={() => { setActiveTab('invian'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invian'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Inventario VP
            </button>
            <button
              onClick={() => { setActiveTab('invian-digital'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invian-digital'
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Inventario Digital
            </button>
            <button
              onClick={() => { setActiveTab('invian-unmas'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'invian-unmas'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Inventario UN+
            </button>
          </div>

          {/* Controles (abajo de los tabs): contador → filtro → exportar */}
          <div className="order-2 flex items-center gap-3">
            {/* Filters Button */}
            <div className="relative order-2">
              <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  hasActiveFilters
                    ? 'bg-purple-600 text-white'
                    : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                    {(selectedCatorcenas.length > 0 ? 1 : 0) + (fechaInicio ? 1 : 0) + (sapDbFilter !== 'todas' ? 1 : 0) + (apsEspecificoFilter !== 'todas' ? 1 : 0) + (postFilter !== 'todas' ? 1 : 0) + currentFilters.length + currentGroupings.length + (currentSortField ? 1 : 0)}
                  </span>
                )}
              </button>

              {showFilterPopup && (
                <div className="absolute right-0 top-full mt-2 z-[60] w-[480px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Filtros y Opciones</span>
                    <button onClick={() => setShowFilterPopup(false)} className="text-zinc-400 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {/* BDD SAP */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">BDD SAP</label>
                      <div className="flex gap-2">
                        {(['todas', 'TRADE', 'CIMU'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => setSapDbFilter(opt)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              sapDbFilter === opt
                                ? 'bg-purple-600 text-white border border-purple-500'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                            }`}
                          >
                            {opt === 'todas' ? 'Todas' : opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* APS Específico */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">APS Específico</label>
                      <div className="flex gap-2">
                        {(['todas', 'con', 'sin'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => setApsEspecificoFilter(opt)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              apsEspecificoFilter === opt
                                ? 'bg-purple-600 text-white border border-purple-500'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                            }`}
                          >
                            {opt === 'todas' ? 'Todas' : opt === 'con' ? 'Con APS' : 'Sin APS'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* POST a SAP */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">POST a SAP</label>
                      <div className="flex gap-2">
                        {(['todas', 'con', 'sin'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => setPostFilter(opt)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              postFilter === opt
                                ? 'bg-purple-600 text-white border border-purple-500'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                            }`}
                          >
                            {opt === 'todas' ? 'Todas' : opt === 'con' ? 'Con POST' : 'Sin POST'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick: Catorcena Actual */}
                    <div>
                      <button
                        onClick={() => {
                          if (catorcenasData?.data) {
                            const now = new Date();
                            const catActual = catorcenasData.data.find((c: any) => new Date(c.fecha_inicio) <= now && new Date(c.fecha_fin) >= now);
                            if (catActual) {
                              setSelectedCatorcenas([`${catActual.numero_catorcena}-${catActual.a_o}`]);
                              setFechaInicio('');
                              setFechaFin('');
                            }
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-colors"
                      >
                        ⏱ Aplicar catorcena actual
                      </button>
                    </div>

                    {/* Date Range */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Periodo de Fechas</label>
                        {(fechaInicio || fechaFin) && (
                          <button
                            onClick={() => { setFechaInicio(''); setFechaFin(''); }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 mb-1 block">Desde</label>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => {
                              setFechaInicio(e.target.value);
                              // Clear catorcenas when using date range (mutually exclusive)
                              if (e.target.value) setSelectedCatorcenas([]);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm border text-white focus:outline-none ${
                              fechaInicio
                                ? 'bg-purple-900/30 border-purple-500/50 focus:border-purple-400'
                                : 'bg-zinc-800 border-zinc-700 focus:border-purple-500'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col items-center justify-center pt-4">
                          <div className="w-8 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 mb-1 block">Hasta</label>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => {
                              setFechaFin(e.target.value);
                              // Clear catorcenas when using date range (mutually exclusive)
                              if (e.target.value) setSelectedCatorcenas([]);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm border text-white focus:outline-none ${
                              fechaFin
                                ? 'bg-purple-900/30 border-purple-500/50 focus:border-purple-400'
                                : 'bg-zinc-800 border-zinc-700 focus:border-purple-500'
                            }`}
                          />
                        </div>
                      </div>
                      {(fechaInicio && fechaFin) && (
                        <div className="mt-2 px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-purple-300">Rango seleccionado:</span>
                            <span className="text-white font-medium">
                              {new Date(fechaInicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' → '}
                              {new Date(fechaFin).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Periodos (catorcenas — sirve para mensual y catorcena) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Periodos ({selectedCatorcenas.length} seleccionados)</label>
                        {selectedCatorcenas.length > 0 && (
                          <button
                            onClick={() => setSelectedCatorcenas([])}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      {(fechaInicio || fechaFin) && (
                        <div className="mb-2 px-2 py-1.5 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                          <span className="text-xs text-amber-400">Limpia el rango de fechas para seleccionar periodos</span>
                        </div>
                      )}
                      <div className={`flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50 ${(fechaInicio || fechaFin) ? 'opacity-50 pointer-events-none' : ''}`}>
                        {catorcenaOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              // Clear date range when selecting catorcenas (mutually exclusive)
                              setFechaInicio('');
                              setFechaFin('');
                              setSelectedCatorcenas(prev =>
                                prev.includes(option.id)
                                  ? prev.filter(id => id !== option.id)
                                  : [...prev, option.id]
                              );
                            }}
                            disabled={!!(fechaInicio || fechaFin)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              selectedCatorcenas.includes(option.id)
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                        {catorcenaOptions.length === 0 && (
                          <span className="text-xs text-zinc-500">No hay periodos</span>
                        )}
                      </div>
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">Ordenar por</label>
                      <div className="flex gap-2">
                        <select
                          value={currentSortField || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
                              setCatSortField(val);
                            } else {
                              setInvianSortField(val);
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Sin ordenar</option>
                          {currentSortOptions.map(opt => (
                            <option key={opt.field} value={opt.field}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
                              setCatSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setInvianSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 text-sm"
                        >
                          {currentSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>
                    </div>

                    {/* Group */}
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">Agrupar por</label>
                      <select
                        value={currentGroupings[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeTab === 'cat' || activeTab === 'digital' || activeTab === 'ocupacion-digital') {
                            setCatGroupings(val ? [val as CATGroupByField] : []);
                          } else {
                            setInvianGroupings(val ? [val as INVIANGroupByField] : []);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="">Sin agrupar</option>
                        {currentGroupOptions.map(opt => (
                          <option key={opt.field} value={opt.field}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-800 flex justify-between">
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Limpiar todo
                    </button>
                    <button
                      onClick={() => setShowFilterPopup(false)}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Count (primero) */}
            <span className="order-1 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
              {dataCount}{dataCount !== totalCount && ` / ${totalCount}`} filas
            </span>

            {/* Export (al final) */}
            {canExport && (
              <button
                onClick={handleExportXLSX}
                disabled={isLoading || dataCount === 0}
                className="order-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Exportar
              </button>
            )}

            {/* Buscador: a la derecha de Exportar, se estira hasta donde topan los tabs */}
            <div className={`order-4 relative flex-1 min-w-[200px] flex items-center flex-wrap gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900/80 hover:border-purple-500/40' : 'border-purple-200 bg-white hover:border-gray-300'} focus-within:ring-2 focus-within:ring-purple-500/30 focus-within:border-purple-500/40 transition-all`}>
            <Search className={`h-4 w-4 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            {searchTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}
              >
                {tag}
                <button
                  onClick={() => removeSearchTag(tag)}
                  className={`rounded-full p-0.5 transition-colors ${isDark ? 'hover:bg-purple-500/30' : 'hover:bg-purple-200'}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder={searchTags.length === 0 ? 'Buscar por id, cliente, asesor, campaña, artículo, plaza... (Enter para agregar)' : 'Agregar filtro...'}
              className={`flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === 'Tab') && searchInput.trim()) {
                  e.preventDefault();
                  addSearchTag(searchInput);
                }
                if (e.key === 'Backspace' && !searchInput && searchTags.length > 0) {
                  removeSearchTag(searchTags[searchTags.length - 1]);
                }
              }}
            />
            {(searchTags.length > 0 || searchInput) && (
              <button
                onClick={() => { setSearchTags([]); setSearchInput(''); }}
                className={`shrink-0 p-1 rounded-full transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : activeTab === 'cat' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Asesor Comercial</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">APS Global</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">APS Específico</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">CUIC</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Nº Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">{filteredCATData.length > 0 && filteredCATData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Puentes' : 'Caras'}</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Monto Total</th>
                    <th className="px-3 py-3 text-center text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCATData ? (
                    groupedCATData.map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        <tr
                          onClick={() => toggleGroup(groupName)}
                          className="bg-purple-500/10 border-b border-purple-500/20 cursor-pointer hover:bg-purple-500/15 transition-colors"
                        >
                          <td colSpan={14} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {catExpandedGroups.has(groupName) ? (
                                <ChevronDown className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-purple-400" />
                              )}
                              <span className="font-semibold text-white text-sm">{groupName}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300">
                                {items.length} registros
                              </span>
                              <span className="text-xs text-zinc-400">
                                Caras: {items.reduce((sum, i) => sum + (Number(i.caras) || 0), 0).toLocaleString()}
                              </span>
                              <span className="text-xs text-emerald-400">
                                Total: ${items.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0).toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {catExpandedGroups.has(groupName) && items.map((item, idx) => (
                          <CATRow key={`${groupName}-${idx}`} item={item} isDark={isDark} showApsEspecifico />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    paginatedCATData.map((item, idx) => (
                      <CATRow key={idx} item={item} isDark={isDark} showApsEspecifico />
                    ))
                  )}
                  {filteredCATData.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                          <ClipboardList className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredCATData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                    <tr className="border-t-2 border-purple-500/40">
                      <td colSpan={12} className="px-3 py-3 text-right text-sm font-semibold text-purple-300">
                        Totales:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        {catTotals.caras.toLocaleString()}
                      </td>
                      {/* <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        ${catTotals.tarifa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td> */}
                      <td className="px-3 py-3 text-right text-sm font-bold text-emerald-400">
                        ${catTotals.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : activeTab === 'ocupacion-digital' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-sky-500/20 bg-gradient-to-r from-sky-900/40 via-indigo-900/30 to-sky-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Asesor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">APS Global</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">APS Específico</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">U. Negocio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Negociación</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-sky-300 uppercase tracking-wider">{filteredOcupacionDigitalData.length > 0 && filteredOcupacionDigitalData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Puentes' : 'Caras'}</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Monto Total</th>
                    <th className="px-3 py-3 text-center text-[10px] font-semibold text-sky-300 uppercase tracking-wider">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedOcupacionDigitalData ? (
                    groupedOcupacionDigitalData.map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        <tr
                          onClick={() => toggleGroup(groupName)}
                          className="bg-sky-500/10 border-b border-sky-500/20 cursor-pointer hover:bg-sky-500/15 transition-colors"
                        >
                          <td colSpan={16} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {catExpandedGroups.has(groupName) ? (
                                <ChevronDown className="h-4 w-4 text-sky-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-sky-400" />
                              )}
                              <span className="font-semibold text-white text-sm">{groupName}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/20 text-sky-300">
                                {items.length} registros
                              </span>
                              <span className="text-xs text-zinc-400">
                                Caras: {items.reduce((sum, i) => sum + (Number(i.caras) || 0), 0).toLocaleString()}
                              </span>
                              <span className="text-xs text-emerald-400">
                                Total: ${items.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0).toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {catExpandedGroups.has(groupName) && items.map((item, idx) => (
                          <CATRow key={`${groupName}-${idx}`} item={item} isDark={isDark} showApsEspecifico />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    paginatedOcupacionDigitalData.map((item, idx) => (
                      <CATRow key={idx} item={item} isDark={isDark} showApsEspecifico />
                    ))
                  )}
                  {filteredOcupacionDigitalData.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-500/10 mb-4">
                          <Monitor className="w-8 h-8 text-sky-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros digitales</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredOcupacionDigitalData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                    <tr className="border-t-2 border-sky-500/40">
                      <td colSpan={12} className="px-3 py-3 text-right text-sm font-semibold text-sky-300">
                        Totales:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        {ocupacionDigitalTotals.caras.toLocaleString()}
                      </td>
                      <td></td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-emerald-400">
                        ${ocupacionDigitalTotals.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : activeTab === 'digital' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1700px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-orange-500/20 bg-gradient-to-r from-orange-900/40 via-amber-900/30 to-orange-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Mes</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Asesor Comercial</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">APS Global</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">APS Específico</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">CUIC</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">F. Inicio</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">F. Fin</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Cliente</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Marca</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Nº Artículo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Artículo</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">{filteredDigitalData.length > 0 && filteredDigitalData.every(i => (i.tipo || '').toUpperCase().includes('PUENTE PEATONAL')) ? 'Puentes' : 'Caras'}</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Tarifa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Monto Total</th>
                    <th className="px-3 py-3 text-center text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDigitalData.map((item, idx) => (
                    <CATRow key={idx} item={item} isDark={isDark} showApsEspecifico showMes />
                  ))}
                  {filteredDigitalData.length === 0 && (
                    <tr>
                      <td colSpan={18} className="px-4 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-4">
                          <Monitor className="w-8 h-8 text-orange-400" />
                        </div>
                        <p className="text-zinc-500">No se encontraron registros</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredDigitalData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm">
                    <tr className="border-t-2 border-orange-500/40">
                      <td colSpan={14} className="px-3 py-3 text-right text-sm font-semibold text-orange-300">
                        Totales:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-white">
                        {filteredDigitalData.reduce((sum, i) => sum + (Number(i.caras) || 0), 0).toLocaleString()}
                      </td>
                      <td></td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-emerald-400">
                        ${filteredDigitalData.reduce((sum, i) => sum + (Number(i.monto_total) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Campaña</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Anunciante</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Operación</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cód. Contrato</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Precio/Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Vendedor</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Inicio/Periodo</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Fin/Segmento</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Arte</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Notas</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Código de arte (Opcional)</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Origen del arte (Opcional)</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Unidad</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Cara</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Plaza</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Código Único</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo Inventario</th>
                    {activeTab === 'invian-digital' && (
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">CTO</th>
                    )}
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Tipo Dist.</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const currentDataFull = activeTab === 'invian-digital' ? filteredINVIANDigitalData : activeTab === 'invian-unmas' ? filteredINVIANUnmasData : filteredINVIANData;
                    const currentData = activeTab === 'invian-digital' ? paginatedINVIANDigitalData : activeTab === 'invian-unmas' ? paginatedINVIANUnmasData : paginatedINVIANData;
                    const currentGrouped = activeTab === 'invian-digital' ? groupedINVIANDigitalData : activeTab === 'invian-unmas' ? groupedINVIANUnmasData : groupedINVIANData;
                    const showCto = activeTab === 'invian-digital';
                    const showCodigoUnico = true;
                    const showTipoInventario = true;
                    const invianColSpan = 16 + (showCto ? 1 : 0) + (showCodigoUnico ? 1 : 0) + (showTipoInventario ? 1 : 0);
                    return (
                      <>
                        {currentGrouped ? (
                          currentGrouped.map(([groupName, items]) => (
                            <React.Fragment key={groupName}>
                              <tr
                                onClick={() => toggleGroup(groupName)}
                                className="bg-cyan-500/10 border-b border-cyan-500/20 cursor-pointer hover:bg-cyan-500/15 transition-colors"
                              >
                                <td colSpan={invianColSpan} className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    {invianExpandedGroups.has(groupName) ? (
                                      <ChevronDown className="h-4 w-4 text-cyan-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-cyan-400" />
                                    )}
                                    <span className="font-semibold text-white text-sm">{groupName}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300">
                                      {items.length} registros
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {invianExpandedGroups.has(groupName) && items.map((item, idx) => (
                                <INVIANRow key={`${groupName}-${idx}`} item={item} isDark={isDark} onOpenGallery={handleOpenGallery} showCto={showCto} showCodigoUnico={showCodigoUnico} showTipoInventario={showTipoInventario} />
                              ))}
                            </React.Fragment>
                          ))
                        ) : (
                          currentData.map((item, idx) => (
                            <INVIANRow key={idx} item={item} isDark={isDark} onOpenGallery={handleOpenGallery} showCto={showCto} showCodigoUnico={showCodigoUnico} showTipoInventario={showTipoInventario} />
                          ))
                        )}
                        {currentDataFull.length === 0 && (
                          <tr>
                            <td colSpan={invianColSpan} className="px-4 py-12 text-center">
                              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                                <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                              </div>
                              <p className="text-zinc-500">No se encontraron registros{activeTab === 'invian-digital' ? ' digitales' : ''}</p>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-6 py-3 border-t ${isDark ? 'border-zinc-800/50 bg-zinc-900/80' : 'border-gray-200 bg-gray-50/80'}`}>
            <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Mostrando {((safeCurrentPage - 1) * PAGE_SIZE) + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, dataCount)} de {dataCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentPage(1); contentRef.current?.scrollTo(0, 0); }}
                disabled={safeCurrentPage <= 1}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${safeCurrentPage <= 1 ? 'opacity-30 cursor-not-allowed' : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                Primera
              </button>
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); contentRef.current?.scrollTo(0, 0); }}
                disabled={safeCurrentPage <= 1}
                className={`p-1 rounded transition-all ${safeCurrentPage <= 1 ? 'opacity-30 cursor-not-allowed' : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); contentRef.current?.scrollTo(0, 0); }}
                disabled={safeCurrentPage >= totalPages}
                className={`p-1 rounded transition-all ${safeCurrentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setCurrentPage(totalPages); contentRef.current?.scrollTo(0, 0); }}
                disabled={safeCurrentPage >= totalPages}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${safeCurrentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Digital Gallery Modal — lazy-mount: solo existe en el árbol cuando
          está abierto. Antes sus hooks (useState/useEffect del slider) corrían
          aunque la galería estuviera cerrada. */}
      {isGalleryOpen && (
        <OMDigitalGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => { setIsGalleryOpen(false); setGalleryImages([]); }}
          imagenes={galleryImages}
          isLoading={isGalleryLoading}
          title={galleryTitle}
        />
      )}
    </div>
  );
}

// Row components
const MES_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function mesFromDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const m = dateStr.match(/^(\d{4})-(\d{2})/);
  if (m) return `${MES_LABELS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${MES_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

// Memoizado: solo se re-renderiza si cambia item, isDark o las flags de
// visualización. Antes se redibujaban TODAS las filas en cada render del
// padre. `isDark` ahora llega como prop para no suscribir el store por fila.
const CATRow = React.memo(function CATRow({ item, isDark, showApsEspecifico = false, showMes = false }: { item: OrdenMontajeCAT; isDark: boolean; showApsEspecifico?: boolean; showMes?: boolean }) {
  const negociacionColor = getNegociacionColorCls(item.negociacion, isDark);
  const negociacionLabel = (() => {
    switch (item.negociacion) {
      case 'INTERCAMBIO': return 'IN - RENTA (INTERCAMBIO)';
      case 'IMPRESION': return 'IMPRESION';
      default: return item.negociacion || '';
    }
  })();

  return (
    <tr className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
      {showMes && (
        <td className={`px-3 py-2 text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{mesFromDate(item.fecha_inicio_periodo)}</td>
      )}
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{item.plaza || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{item.tipo || '-'}</td>
      <td className="px-3 py-2">
        {item.asesor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.asesor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.asesor)}
            </div>
            <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} truncate max-w-[100px]`} title={item.asesor}>{item.asesor}</span>
          </div>
        ) : (
          <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-fuchsia-300 font-mono">{item.campania_id || item.aps_global || '-'}</td>
      {showApsEspecifico && (
        <td className="px-3 py-2 text-xs text-fuchsia-200 font-mono">{item.aps_especifico ?? '-'}</td>
      )}
      <td className="px-3 py-2 text-xs text-purple-300 font-mono">{item.cuic || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{formatDate(item.fecha_inicio_periodo)}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{formatDate(item.fecha_fin_periodo)}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[120px] truncate`} title={item.cliente || ''}>{item.cliente || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{item.marca || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-white' : 'text-gray-900'} font-medium max-w-[150px] truncate`} title={item.campania || ''}>{item.campania || '-'}</td>
      <td className="px-3 py-2 text-xs text-violet-300 font-mono">{item.numero_articulo || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${negociacionColor}`}>
          {negociacionLabel}
        </span>
      </td>
      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{Number(item.caras) || 0}</td>
      <td className={`px-3 py-2 text-xs text-right ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>${(Number(item.tarifa) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.monto_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2 text-xs text-center font-medium">
        {(() => {
          const delta = Number(item.delta_caras) || 0;
          if (delta === 0) return <span className="text-emerald-400">✓</span>;
          if (delta > 0) return <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30">+{delta}</span>;
          return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">{delta}</span>;
        })()}
      </td>
    </tr>
  );
});

// Memoizado: misma motivación que CATRow. `onOpenGallery` se asume estable
// (useCallback en el padre) — si no lo fuera, React.memo aún funciona pero
// re-renderiza cuando cambia la ref.
const INVIANRow = React.memo(function INVIANRow({ item, isDark, onOpenGallery, showCto = false, showCodigoUnico = false, showTipoInventario = false }: { item: OrdenMontajeINVIAN; isDark: boolean; onOpenGallery: (item: OrdenMontajeINVIAN) => void; showCto?: boolean; showCodigoUnico?: boolean; showTipoInventario?: boolean }) {
  const operacionColor = getOperacionColorCls(item.Operacion, isDark);
  const tipoDistColor = getOperacionColorCls(item.TipoDistribucion, isDark);

  const hasTraditionalArte = item.ArteUrl === 'HAS_ARTE';
  const arteUrl = hasTraditionalArte ? null : getFileUrl(item.ArteUrl);

  return (
    <tr className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-white' : 'text-gray-900'} font-medium max-w-[140px] truncate`} title={item.Campania || ''}>{item.Campania || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[120px] truncate`} title={item.Anunciante || ''}>{item.Anunciante || '-'}</td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${operacionColor}`}>
          {item.Operacion || '-'}
        </span>
      </td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'} font-mono`}>{item.CodigoContrato || '-'}</td>
      <td className="px-3 py-2 text-xs text-right text-emerald-400 font-medium">${(Number(item.PrecioPorCara) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="px-3 py-2">
        {item.Vendedor ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(item.Vendedor)} flex items-center justify-center text-[10px] font-bold text-white`}>
              {getInitials(item.Vendedor)}
            </div>
            <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} truncate max-w-[80px]`} title={item.Vendedor}>{item.Vendedor}</span>
          </div>
        ) : (
          <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>-</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.InicioPeriodo || '-'}</td>
      <td className="px-3 py-2 text-xs text-purple-300">{item.FinSegmento || '-'}</td>
      {/* Arte = nombre_arte MANUAL (carga de artes). Si no hay, cae al nombre
          de archivo limpio. */}
      {(() => {
        const nombre = arteNombreMontaje(item);
        return (
          <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[180px] truncate`} title={nombre}>
            {nombre || '-'}
          </td>
        );
      })()}
      {/* Notas de los artes (separadas por coma si hay varios) */}
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} max-w-[180px] truncate`} title={item.notas_artes || ''}>
        {item.notas_artes || '-'}
      </td>
      {/* Código de arte (Opcional) — intencionalmente vacío */}
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} max-w-[150px] truncate`}>
        -
      </td>
      {/* Artes */}
      <td className="px-3 py-2 text-xs">
        {(() => {
          if ((item.num_artes_digitales || 0) > 1) {
            return (
              <button
                onClick={() => onOpenGallery(item)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors text-[10px] font-medium"
                title={`${item.num_artes_digitales} artes digitales`}
              >
                <Film className="h-3 w-3" />
                {item.num_artes_digitales}
              </button>
            );
          }
          if (hasTraditionalArte) {
            return (
              <button
                onClick={() => onOpenGallery(item)}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                title="Ver arte"
              >
                <Image className="h-3.5 w-3.5" />
              </button>
            );
          }
          if (arteUrl && isImageUrl(item.ArteUrl)) {
            return (
              <a
                href={arteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
                title="Ver imagen"
              >
                <img
                  src={arteUrl}
                  alt="Arte"
                  className={`w-10 h-[30px] object-cover rounded border ${isDark ? 'border-zinc-700' : 'border-gray-200'} hover:border-purple-400 transition-colors`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            );
          }
          if (arteUrl) {
            return (
              <a
                href={arteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                title="Abrir arte"
              >
                <Image className="h-3.5 w-3.5" />
              </a>
            );
          }
          return <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>-</span>;
        })()}
      </td>
      {/* Unidad: solo el código (antes del primer '_'). codigo_unico viene
          como 'TJ1129_Flujo_Tijuana' pero solo queremos 'TJ1129'. */}
      <td className="px-3 py-2 text-xs text-violet-300 font-mono" title={item.Unidad || ''}>{(item.Unidad || '').split('_')[0] || '-'}</td>
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{item.Cara || '-'}</td>
      {/* Plaza: derivar la ciudad capitalizada del codigo_unico. */}
      <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
        {(showCodigoUnico ? extractCiudadFromCodigoUnico(item.Unidad) : '') || item.Ciudad || '-'}
      </td>
      {showCodigoUnico && (
        <td className="px-3 py-2 text-xs text-violet-300 font-mono" title={item.Unidad || ''}>{item.Unidad || '-'}</td>
      )}
      {showTipoInventario && (
        <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{item.tradicional_digital || '-'}</td>
      )}
      {showCto && (
        <td className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} font-mono`}>{item.cto || '-'}</td>
      )}
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${tipoDistColor}`}>
          {item.TipoDistribucion || '-'}
        </span>
      </td>
    </tr>
  );
});
