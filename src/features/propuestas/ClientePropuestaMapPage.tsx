import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Map as MapIcon, Loader2, ExternalLink, Copy, Check, Download, ChevronDown, ChevronRight,
  Search, FileSpreadsheet, SlidersHorizontal, X, Layers,
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete, InfoWindow } from '@react-google-maps/api';
import { formatCurrency } from '../../lib/utils';
import { toNum, applyNumberFormats, FMT_ENTERO, FMT_MONEDA, FMT_COORD } from '../../utils/excelFormat';

// Config UNICA de Google Maps (mismo id/key/libraries en toda la app) para
// que el script se inyecte una sola vez. Ver src/config/googleMaps.ts.
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../../config/googleMaps';

const IMU_BLUE = '#0054A6';
const IMU_GREEN = '#7AB800';
const IMU_DARK = '#003B71';

// Paleta de colores para diferenciar catorcenas (se cicla si hay mas de 14).
const CAT_COLORS = [
  '#0054A6', '#7AB800', '#E4002B', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4',
  '#10B981', '#F97316', '#6366F1', '#14B8A6', '#A855F7', '#DC2626', '#84CC16',
];

const IMU_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c5e8c5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7AB800' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e4f5' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0054A6' }] },
];

interface InventarioReservado {
  id: number;
  codigo_unico: string;
  mueble: string | null;
  estado: string | null;
  municipio: string | null;
  ubicacion: string | null;
  tipo_de_cara: string | null;
  caras_totales: number;
  caras_bonificadas: number;
  caras_renta: number;
  latitud: number;
  longitud: number;
  plaza: string | null;
  articulo: string | null;
  tipo_de_mueble: string | null;
  tradicional_digital?: string | null;
  tarifa_publica: number | null;
  tarifa_bruta_sc?: number | null; // tarifa publica SIN descuento (costo/caras)
  grupo_completo_id?: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
  inicio_periodo?: string | null;
}

// Fila normalizada: una reserva por (ubicacion x catorcena), con metadatos de agrupacion.
type Row = InventarioReservado & { _rk: string; _catKey: string; _catLabel: string };

interface PublicPropuestaData {
  propuesta: {
    id: number;
    status: string;
    descripcion: string;
    notas: string;
    fecha: string;
    catorcena_inicio: number | null;
    anio_inicio: number | null;
    catorcena_fin: number | null;
    anio_fin: number | null;
  };
  solicitud: { cuic: string; cliente: string; razon_social: string; unidad_negocio: string; marca_nombre: string; asesor: string; agencia: string; producto_nombre: string; categoria_nombre: string } | null;
  cotizacion: { nombre_campania: string; fecha_inicio: string; fecha_fin: string; numero_caras: number; bonificacion: number; precio: number; tipo_periodo?: string } | null;
  campania: { id: number; nombre: string; status: string } | null;
  caras: { caras: number; bonificacion: number; tarifa_publica: number }[];
  inventario: InventarioReservado[];
}

interface POIMarker {
  id: string;
  position: { lat: number; lng: number };
  name: string;
  range: number;
}

const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Inversion bruta = tarifa_bruta_sc x caras_totales (mismo criterio que la vista de compartir).
function tarifaBruta(item: InventarioReservado): number {
  return Number(item.tarifa_bruta_sc) || Number(item.tarifa_publica) || 0;
}

// Clave estable de catorcena (mensual usa "YYYY-MM"; catorcenal usa "YYYY-NN").
function catKeyOf(item: InventarioReservado, tipoPeriodo?: string): string {
  if (tipoPeriodo === 'mensual' && item.inicio_periodo) return item.inicio_periodo.substring(0, 7);
  if (item.numero_catorcena && item.anio_catorcena) return `${item.anio_catorcena}-${item.numero_catorcena}`;
  return 'sin';
}

function catLabelOf(item: InventarioReservado, tipoPeriodo?: string): string {
  if (tipoPeriodo === 'mensual' && item.inicio_periodo) {
    const parts = item.inicio_periodo.split('-');
    if (parts.length >= 2) return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  if (item.numero_catorcena && item.anio_catorcena) return `Cat ${item.numero_catorcena} / ${item.anio_catorcena}`;
  return 'Sin asignar';
}

// Orden de catorcenas: por la clave (YYYY-MM o YYYY-NN ordena cronologicamente con padding).
function catSortValue(key: string): string {
  return key.split('-').map(p => p.padStart(4, '0')).join('-');
}

// #RRGGBB -> aabbggrr (formato de color de KML, opacidad total).
function hexToKmlColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = h.substring(0, 2), g = h.substring(2, 4), b = h.substring(4, 6);
  return `ff${b}${g}${r}`.toLowerCase();
}

function kmlEscape(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchPublicPropuesta(id: number): Promise<PublicPropuestaData> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await fetch(`${API_URL}/public/propuestas/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// Checkbox de 3 estados (marcado / indeterminado / vacio) para seleccion jerarquica.
function TriCheckbox({ checked, indeterminate, onChange, className }: {
  checked: boolean; indeterminate: boolean; onChange: () => void; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className={className || 'h-3.5 w-3.5 accent-[#0054A6] cursor-pointer'}
    />
  );
}

export function ClientePropuestaMapPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const propuestaId = id ? parseInt(id, 10) : 0;

  // Alcance inicial compartido desde "Compartir" / "Expandir Mapa". Prioridad:
  //   ?sel=id@catorcena,...  -> subconjunto EXACTO por reserva (id + catorcena). Es la
  //      clave que evita arrastrar otras catorcenas del mismo inventario.
  //   ?periodos=YYYY-NN,...  -> solo ciertas catorcenas (todo su inventario).
  //   ?ids=1,2,3             -> legado (por id de inventario, sin distinguir catorcena).
  //   sin params             -> todo el inventario.
  const selParam = searchParams.get('sel') || '';
  const periodosParam = searchParams.get('periodos') || '';
  const idsParam = searchParams.get('ids') || '';
  const selKeySet = useMemo(
    () => new Set(selParam.split(',').map(s => s.trim()).filter(Boolean)),
    [selParam]
  );
  const periodoSet = useMemo(
    () => new Set(periodosParam.split(',').map(s => s.trim()).filter(Boolean)),
    [periodosParam]
  );
  const selectedIdSet = useMemo(
    () => new Set(idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n))),
    [idsParam]
  );
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [selectedMarker, setSelectedMarker] = useState<Row | null>(null);
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [showList, setShowList] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set()); // vacio = todas
  const [plazaFilter, setPlazaFilter] = useState('');
  const [formatoFilter, setFormatoFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  // Seleccion (por _rk) para descargas y resaltado
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Grupos colapsados en la lista lateral
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const { isLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-propuesta', propuestaId],
    queryFn: () => fetchPublicPropuesta(propuestaId),
    enabled: propuestaId > 0,
  });

  const tipoPeriodo = data?.cotizacion?.tipo_periodo || 'catorcena';

  // Filas base: alcance por ?ids= y normalizacion (NO se deduplica para mantener
  // separadas las reservas por catorcena). _rk = clave estable por fila.
  const baseRows = useMemo<Row[]>(() => {
    const raw = data?.inventario || [];
    let scoped = raw;
    if (selKeySet.size > 0) {
      scoped = raw.filter(i => selKeySet.has(`${i.id}@${catKeyOf(i, tipoPeriodo)}`));
    } else if (periodoSet.size > 0) {
      scoped = raw.filter(i => periodoSet.has(catKeyOf(i, tipoPeriodo)));
    } else if (selectedIdSet.size > 0) {
      scoped = raw.filter(i => selectedIdSet.has(i.id));
    }
    return scoped.map((i, idx) => ({
      ...i,
      _rk: `${idx}`,
      _catKey: catKeyOf(i, tipoPeriodo),
      _catLabel: catLabelOf(i, tipoPeriodo),
    }));
  }, [data, selKeySet, periodoSet, selectedIdSet, tipoPeriodo]);

  // Catorcenas presentes, ordenadas, con color asignado.
  const catorcenas = useMemo(() => {
    const map = new Map<string, string>();
    baseRows.forEach(r => { if (!map.has(r._catKey)) map.set(r._catKey, r._catLabel); });
    return Array.from(map.entries())
      .sort((a, b) => catSortValue(a[0]).localeCompare(catSortValue(b[0])))
      .map(([key, label], idx) => ({ key, label, color: CAT_COLORS[idx % CAT_COLORS.length] }));
  }, [baseRows]);

  const colorByCat = useMemo(() => {
    const m = new Map<string, string>();
    catorcenas.forEach(c => m.set(c.key, c.color));
    return m;
  }, [catorcenas]);
  const colorFor = (key: string) => colorByCat.get(key) || IMU_BLUE;

  // Opciones de filtros
  const plazaOptions = useMemo(() => [...new Set(baseRows.map(r => r.plaza).filter(Boolean) as string[])].sort(), [baseRows]);
  const formatoOptions = useMemo(() => [...new Set(baseRows.map(r => r.mueble).filter(Boolean) as string[])].sort(), [baseRows]);
  const tipoOptions = useMemo(() => [...new Set(baseRows.map(r => r.tipo_de_cara).filter(Boolean) as string[])].sort(), [baseRows]);

  // Filas visibles tras aplicar filtros (es lo que pinta el mapa y la lista).
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseRows.filter(r => {
      if (catFilter.size > 0 && !catFilter.has(r._catKey)) return false;
      if (plazaFilter && r.plaza !== plazaFilter) return false;
      if (formatoFilter && r.mueble !== formatoFilter) return false;
      if (tipoFilter && r.tipo_de_cara !== tipoFilter) return false;
      if (q) {
        const hay = `${r.codigo_unico || ''} ${r.plaza || ''} ${r.ubicacion || ''} ${r.mueble || ''} ${r.articulo || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseRows, search, catFilter, plazaFilter, formatoFilter, tipoFilter]);

  // Conjunto efectivo: si hay seleccion solo se muestra lo seleccionado; si no, lo visible.
  // Unifica lo que pinta el mapa con lo que exportan las descargas.
  const effectiveRows = useMemo(
    () => (selected.size > 0 ? visibleRows.filter(r => selected.has(r._rk)) : visibleRows),
    [selected, visibleRows]
  );

  // Solo filas con coordenadas para el mapa.
  const mapRows = useMemo(() => effectiveRows.filter(r => r.latitud && r.longitud), [effectiveRows]);

  // Lista agrupada: catorcena -> circuito (articulo) -> filas. Ordenada como inventario.
  const grouped = useMemo(() => {
    const byCat = new Map<string, Map<string, Row[]>>();
    visibleRows.forEach(r => {
      if (!byCat.has(r._catKey)) byCat.set(r._catKey, new Map());
      const circ = r.articulo || 'Sin circuito';
      const m = byCat.get(r._catKey)!;
      if (!m.has(circ)) m.set(circ, []);
      m.get(circ)!.push(r);
    });
    return catorcenas
      .filter(c => byCat.has(c.key))
      .map(c => {
        const circMap = byCat.get(c.key)!;
        const circuitos = Array.from(circMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([articulo, rows]) => ({
            articulo,
            rows: rows.sort((a, b) => (a.codigo_unico || '').localeCompare(b.codigo_unico || '')),
          }));
        const count = circuitos.reduce((s, ci) => s + ci.rows.length, 0);
        return { ...c, circuitos, count };
      });
  }, [visibleRows, catorcenas]);

  // Descargas: mismo conjunto que muestra el mapa (seleccion o lo visible).
  const downloadRows = effectiveRows;

  const mapCenter = useMemo(() => {
    if (mapRows.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const avgLat = mapRows.reduce((s, i) => s + i.latitud, 0) / mapRows.length;
    const avgLng = mapRows.reduce((s, i) => s + i.longitud, 0) / mapRows.length;
    return { lat: avgLat, lng: avgLng };
  }, [mapRows]);

  // Reencuadrar el mapa cuando cambia el conjunto visible.
  useEffect(() => {
    if (!mapRef.current || mapRows.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    mapRows.forEach(i => bounds.extend({ lat: i.latitud, lng: i.longitud }));
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 60);
  }, [mapRows]);

  // ----- Seleccion -----
  const toggleRow = (rk: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(rk)) next.delete(rk); else next.add(rk);
    return next;
  });
  const toggleMany = (rks: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    rks.forEach(rk => (on ? next.add(rk) : next.delete(rk)));
    return next;
  });
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(r => selected.has(r._rk));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) toggleMany(visibleRows.map(r => r._rk), false);
    else toggleMany(visibleRows.map(r => r._rk), true);
  };

  const toggleCatFilter = (key: string) => setCatFilter(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleCollapse = (key: string) => setCollapsedCats(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const hasFilters = !!search || catFilter.size > 0 || !!plazaFilter || !!formatoFilter || !!tipoFilter;
  const clearFilters = () => {
    setSearch(''); setCatFilter(new Set()); setPlazaFilter(''); setFormatoFilter(''); setTipoFilter('');
  };

  // ----- Descargas (respetan seleccion / visible) -----
  const handleDownloadXLSX = () => {
    import('xlsx').then(XLSX => {
      const headers = ['Catorcena', 'Circuito', 'Codigo', 'Plaza', 'Ubicacion', 'Tipo Cara', 'Formato', 'Tipo Inventario', 'Articulo', 'Caras', 'Tarifa', 'Latitud', 'Longitud'];
      const rows = downloadRows.map(i => [
        i._catLabel, i.articulo || '', i.codigo_unico, i.plaza, i.ubicacion, i.tipo_de_cara, i.mueble,
        i.tradicional_digital || '', i.articulo, toNum(i.caras_totales), tarifaBruta(i), toNum(i.latitud), toNum(i.longitud),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      // Caras (9), Tarifa (10), Latitud (11), Longitud (12) como celdas tipo número
      applyNumberFormats(XLSX, ws, rows.length, { 9: FMT_ENTERO, 10: FMT_MONEDA, 11: FMT_COORD, 12: FMT_COORD });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
      XLSX.writeFile(wb, `reservas_propuesta_${propuestaId}.xlsx`);
    });
  };

  // KML agrupado por catorcena: un <Folder> y color por catorcena. Al importarlo
  // en Google My Maps recrea automaticamente las capas CAT con su color.
  const handleDownloadKML = () => {
    const rowsWithCoords = downloadRows.filter(r => r.latitud && r.longitud);
    const byCat = new Map<string, Row[]>();
    rowsWithCoords.forEach(r => {
      if (!byCat.has(r._catKey)) byCat.set(r._catKey, []);
      byCat.get(r._catKey)!.push(r);
    });
    const orderedKeys = catorcenas.map(c => c.key).filter(k => byCat.has(k));

    const styles = orderedKeys.map(k => {
      const styleId = `cat_${k.replace(/[^a-z0-9]/gi, '_')}`;
      return `<Style id="${styleId}"><IconStyle><color>${hexToKmlColor(colorFor(k))}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle></Style>`;
    }).join('');

    const folders = orderedKeys.map(k => {
      const styleId = `cat_${k.replace(/[^a-z0-9]/gi, '_')}`;
      const label = catorcenas.find(c => c.key === k)?.label || k;
      const placemarks = byCat.get(k)!.map(i => `
      <Placemark>
        <name>${kmlEscape(i.codigo_unico)}</name>
        <styleUrl>#${styleId}</styleUrl>
        <description><![CDATA[Catorcena: ${kmlEscape(label)}<br/>Plaza: ${i.plaza || 'N/A'}<br/>Circuito: ${i.articulo || 'N/A'}<br/>Tipo: ${i.tipo_de_cara || 'N/A'}<br/>Formato: ${i.mueble || 'N/A'}<br/>Ubicacion: ${i.ubicacion || 'N/A'}<br/>Caras: ${i.caras_totales}<br/>Tarifa: ${formatCurrency(tarifaBruta(i))}]]></description>
        <Point><coordinates>${i.longitud},${i.latitud},0</coordinates></Point>
      </Placemark>`).join('');
      return `<Folder><name>${kmlEscape(label)} (${byCat.get(k)!.length})</name>${placemarks}</Folder>`;
    }).join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Propuesta ${propuestaId}</name>
    ${styles}
    ${folders}
  </Document>
</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propuesta_${propuestaId}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- Mapa -----
  const periodoInicio = catorcenas[0]?.label || 'N/A';
  const periodoFin = catorcenas[catorcenas.length - 1]?.label || 'N/A';

  const handleFocusLocation = (item: Row) => {
    if (!item.latitud || !item.longitud) return;
    setSelectedMarker(item);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: item.latitud, lng: item.longitud });
      mapRef.current.setZoom(16);
    }
  };

  const handlePOIPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const newMarker: POIMarker = {
        id: `poi-${Date.now()}`,
        position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
        name: place.name || 'POI',
        range: searchRange,
      };
      setPoiMarkers(prev => [...prev, newMarker]);
      mapRef.current?.setCenter(newMarker.position);
      mapRef.current?.setZoom(15);
      setPoiSearch('');
    }
  };

  // Copiar enlace "a la medida": si el usuario seleccionó filas en este mapa, el enlace
  // codifica EXACTAMENTE esa seleccion (?sel=id@catorcena). Si no hay seleccion, preserva
  // el alcance con el que se abrió el mapa (sel / periodos / ids).
  const handleCopyLink = () => {
    const params = new URLSearchParams();
    if (selected.size > 0) {
      const chosen = baseRows.filter(r => selected.has(r._rk) && r.latitud && r.longitud);
      const sel = Array.from(new Set(chosen.map(r => `${r.id}@${r._catKey}`)));
      if (sel.length > 0) params.set('sel', sel.join(','));
    } else {
      for (const k of ['sel', 'periodos', 'ids'] as const) {
        const v = searchParams.get(k);
        if (v) params.set(k, v);
      }
    }
    const qs = params.toString();
    const publicUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}/mapa${qs ? `?${qs}` : ''}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-white via-blue-50 to-green-50">
        <div className="text-center">
          <img src="/logo-grupo-imu.png" alt="IMU" className="h-20 w-auto mx-auto mb-4 animate-pulse" />
          <Loader2 className="h-8 w-8 animate-spin text-[#0054A6] mx-auto" />
          <p className="text-gray-500 mt-2">Cargando propuesta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-white via-blue-50 to-green-50">
        <div className="text-center">
          <img src="/logo-grupo-imu.png" alt="IMU" className="h-16 w-auto mx-auto mb-4" />
          <p className="text-red-600 font-medium">Error al cargar la propuesta</p>
        </div>
      </div>
    );
  }

  const selectClass = 'px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0054A6] max-w-[8.5rem]';

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-green-50/30 text-gray-800 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur shadow-md border-b bg-white/95 border-gray-200">
        <div className="max-w-full mx-auto px-3 sm:px-4 py-2.5 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <img src="/logo-grupo-imu.png" alt="IMU" className="h-9 sm:h-14 w-auto object-contain shrink-0" />
            <div className="border-l pl-2 sm:pl-4 border-gray-300 min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-[#0054A6] truncate">Propuesta de Campaña</h1>
              <p className="text-[11px] sm:text-sm text-gray-500">Referencia #{propuestaId}</p>
            </div>
          </div>

          {/* Info de campaña (oculta en movil) */}
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#0054A6]">{data?.cotizacion?.nombre_campania || 'Propuesta'}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Inicio: <span className="text-[#0054A6] font-medium">{periodoInicio}</span></span>
                <span>Fin: <span className="text-[#0054A6] font-medium">{periodoFin}</span></span>
              </div>
            </div>
            <div className="border-l border-gray-200 pl-4 text-right">
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="text-sm font-medium text-gray-800">{data?.solicitud?.cliente || 'N/A'}</p>
            </div>
            <div className="bg-[#7AB800]/10 text-[#7AB800] px-3 py-1 rounded-full text-sm font-medium">
              {data?.propuesta?.status || 'Propuesta'}
            </div>
          </div>

          {/* Botones de accion */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href={`/cliente/propuesta/${propuestaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 border rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-colors bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
              title="Ver propuesta completa"
            >
              <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">Ver Completa</span>
            </a>
            <button
              onClick={handleDownloadXLSX}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-[#7AB800] hover:bg-[#689c00] text-white rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-colors"
              title="Descargar Excel de lo seleccionado o lo visible en el mapa"
            >
              <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={handleDownloadKML}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-[#0054A6] hover:bg-[#003B71] text-white rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-colors"
              title="Descargar KML (agrupado por catorcena) de lo seleccionado o lo visible"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">KML</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-colors"
              title="Copiar enlace de este mapa"
            >
              {copied ? <Check className="h-4 w-4 text-[#7AB800]" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar Enlace'}</span>
            </button>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="px-3 sm:px-4 pb-2.5 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar codigo, ubicacion, circuito..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0054A6] text-gray-700"
              />
            </div>

            {/* Selects: visibles en desktop, plegables en movil */}
            <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex items-center gap-2 flex-wrap w-full sm:w-auto`}>
              <select value={plazaFilter} onChange={(e) => setPlazaFilter(e.target.value)} className={selectClass} title="Plaza">
                <option value="">Plaza (todas)</option>
                {plazaOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={formatoFilter} onChange={(e) => setFormatoFilter(e.target.value)} className={selectClass} title="Formato">
                <option value="">Formato (todos)</option>
                {formatoOptions.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className={selectClass} title="Tipo de cara">
                <option value="">Tipo (todos)</option>
                {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs hover:bg-red-100 transition-colors">
                  <X className="h-3.5 w-3.5" /> Limpiar
                </button>
              )}
            </div>

            {/* Toggle de filtros en movil */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 bg-white"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            </button>
          </div>

          {/* Chips de catorcena (color + toggle de capa). Tambien sirven de leyenda. */}
          {catorcenas.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              <Layers className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {catorcenas.map(c => {
                const active = catFilter.size === 0 || catFilter.has(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCatFilter(c.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                      active ? 'border-transparent text-white shadow-sm' : 'bg-white text-gray-500 border-gray-200 opacity-60'
                    }`}
                    style={active ? { backgroundColor: c.color } : undefined}
                    title={`Mostrar/ocultar ${c.label}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? '#fff' : c.color }} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Mapa */}
      <div className="flex-1 relative min-h-0">
        {/* Panel lateral: lista agrupada */}
        <div
          className="absolute top-3 left-3 z-10 w-[19rem] max-w-[calc(100%-1.5rem)] flex flex-col bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 overflow-hidden"
          style={{ maxHeight: 'calc(100% - 1.5rem)' }}
        >
          <button
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-gray-50 transition-colors shrink-0"
          >
            <MapIcon className="h-4 w-4 text-[#0054A6]" />
            <span className="text-sm font-semibold text-[#0054A6]">Ubicaciones</span>
            <span className="text-xs text-gray-400 ml-1">({visibleRows.length})</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 ml-auto transition-transform ${showList ? '' : '-rotate-90'}`} />
          </button>

          {showList && (
            <>
              {/* Acciones de seleccion */}
              <div className="px-3 py-2 border-t border-b border-gray-100 flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <TriCheckbox
                    checked={allVisibleSelected}
                    indeterminate={selected.size > 0 && !allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                  Todo
                </label>
                <span className="text-xs text-gray-400 ml-auto">
                  {selected.size > 0 ? `${selected.size} seleccionados` : 'sin seleccion'}
                </span>
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} className="text-xs text-red-500 hover:text-red-700" title="Limpiar seleccion">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lista */}
              <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5 space-y-1">
                {grouped.map(cat => {
                  const catRks = cat.circuitos.flatMap(ci => ci.rows.map(r => r._rk));
                  const catAll = catRks.length > 0 && catRks.every(rk => selected.has(rk));
                  const catSome = catRks.some(rk => selected.has(rk));
                  const collapsed = collapsedCats.has(cat.key);
                  return (
                    <div key={cat.key} className="rounded-lg border border-gray-100 overflow-hidden">
                      {/* Encabezado catorcena */}
                      <div className="flex items-center gap-2 px-2 py-1.5" style={{ backgroundColor: `${cat.color}14` }}>
                        <TriCheckbox checked={catAll} indeterminate={catSome && !catAll} onChange={() => toggleMany(catRks, !catAll)} />
                        <button onClick={() => toggleCollapse(cat.key)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-xs font-semibold text-gray-800 truncate">{cat.label}</span>
                          <span className="text-[10px] text-gray-400 ml-1 shrink-0">{cat.count}</span>
                        </button>
                      </div>

                      {!collapsed && cat.circuitos.map(ci => {
                        const ciRks = ci.rows.map(r => r._rk);
                        const ciAll = ciRks.every(rk => selected.has(rk));
                        const ciSome = ciRks.some(rk => selected.has(rk));
                        return (
                          <div key={ci.articulo} className="pl-2">
                            {/* Circuito */}
                            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50/60">
                              <TriCheckbox checked={ciAll} indeterminate={ciSome && !ciAll} onChange={() => toggleMany(ciRks, !ciAll)} />
                              <span className="text-[11px] font-medium text-gray-600 truncate">{ci.articulo}</span>
                              <span className="text-[10px] text-gray-400 ml-auto shrink-0">{ci.rows.length}</span>
                            </div>
                            {/* Inventarios */}
                            {ci.rows.map(item => {
                              const isActive = selectedMarker?._rk === item._rk;
                              return (
                                <div
                                  key={item._rk}
                                  className={`flex items-center gap-2 pl-3 pr-2 py-1.5 border-l-2 cursor-pointer ${isActive ? 'bg-[#0054A6]/10' : 'hover:bg-gray-50'}`}
                                  style={{ borderColor: cat.color }}
                                  onClick={() => handleFocusLocation(item)}
                                >
                                  <TriCheckbox checked={selected.has(item._rk)} indeterminate={false} onChange={() => toggleRow(item._rk)} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-semibold text-gray-800 truncate">{item.codigo_unico}</div>
                                    <div className="text-[10px] text-gray-400 truncate">{[item.mueble, item.plaza].filter(Boolean).join(' · ') || item.ubicacion || 'Sin ubicacion'}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {grouped.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">Sin resultados con los filtros actuales</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* POI search */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-2.5 py-2 max-w-[calc(100%-1.5rem)]">
          <select value={searchRange} onChange={(e) => setSearchRange(parseInt(e.target.value))} className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700">
            <option value={100}>100m</option>
            <option value={200}>200m</option>
            <option value={300}>300m</option>
            <option value={500}>500m</option>
            <option value={1000}>1km</option>
          </select>
          {isLoaded && (
            <Autocomplete onLoad={(ac) => { autocompleteRef.current = ac; }} onPlaceChanged={handlePOIPlaceChanged} options={{ componentRestrictions: { country: 'mx' } }}>
              <input type="text" value={poiSearch} onChange={(e) => setPoiSearch(e.target.value)} placeholder="Buscar POI..." className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm w-28 sm:w-48 focus:outline-none focus:ring-2 focus:ring-[#0054A6] text-gray-700" />
            </Autocomplete>
          )}
          {poiMarkers.length > 0 && (
            <button onClick={() => setPoiMarkers([])} className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs hover:bg-red-100 transition-colors">Limpiar</button>
          )}
        </div>

        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={12}
            options={{ styles: IMU_MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
            onLoad={(map) => {
              mapRef.current = map;
              if (mapRows.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                mapRows.forEach(item => bounds.extend({ lat: item.latitud, lng: item.longitud }));
                if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
              }
            }}
          >
            {mapRows.map((item) => {
              const isActive = selectedMarker?._rk === item._rk;
              return (
                <Marker
                  key={item._rk}
                  position={{ lat: item.latitud, lng: item.longitud }}
                  onClick={() => setSelectedMarker(item)}
                  zIndex={isActive ? 999 : undefined}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isActive ? 11 : 7,
                    fillColor: colorFor(item._catKey),
                    fillOpacity: 0.9,
                    strokeColor: isActive ? IMU_DARK : '#ffffff',
                    strokeWeight: isActive ? 3 : 1.5,
                  }}
                />
              );
            })}
            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.latitud, lng: selectedMarker.longitud }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="p-2 min-w-[210px]" style={{ color: '#000' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(selectedMarker._catKey) }} />
                    <h4 className="font-bold text-sm" style={{ color: IMU_DARK }}>{selectedMarker.codigo_unico}</h4>
                  </div>
                  <div className="text-xs space-y-1">
                    <p><strong>Catorcena:</strong> {selectedMarker._catLabel}</p>
                    <p><strong>Circuito:</strong> {selectedMarker.articulo || 'N/A'}</p>
                    <p><strong>Plaza:</strong> {selectedMarker.plaza || 'N/A'}</p>
                    <p><strong>Tipo:</strong> {selectedMarker.tipo_de_cara || 'N/A'}</p>
                    <p><strong>Formato:</strong> {selectedMarker.mueble || 'N/A'}</p>
                    <p><strong>Ubicacion:</strong> {selectedMarker.ubicacion || 'N/A'}</p>
                    <p><strong>{(selectedMarker.mueble || '').toUpperCase().includes('PUENTE PEATONAL') ? 'Puentes' : 'Caras'}:</strong> {selectedMarker.caras_totales}</p>
                    <p><strong>Tarifa:</strong> {formatCurrency(tarifaBruta(selectedMarker))}</p>
                  </div>
                </div>
              </InfoWindow>
            )}
            {poiMarkers.map(marker => (
              <Circle key={marker.id} center={marker.position} radius={marker.range} options={{ strokeColor: IMU_GREEN, strokeOpacity: 0.8, strokeWeight: 2, fillColor: IMU_GREEN, fillOpacity: 0.15 }} />
            ))}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <Loader2 className="h-8 w-8 animate-spin text-[#0054A6]" />
          </div>
        )}
      </div>
    </div>
  );
}
