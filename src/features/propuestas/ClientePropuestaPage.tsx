import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import {
  FileText, Map as MapIcon, Loader2, ChevronDown, ChevronRight,
  Filter, ArrowUpDown, Layers, FileSpreadsheet, X
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete, InfoWindow } from '@react-google-maps/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency, formatDate } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';
const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

// IMU Color Palette
const IMU_BLUE = '#0054A6';
const IMU_GREEN = '#7AB800';
const IMU_DARK = '#003B71';
const IMU_LIGHT_BLUE = '#E6F0FA';
const IMU_LIGHT_GREEN = '#F0F9E6';

// IMU Map styles (Light - Clean Professional)
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
  latitud: number;
  longitud: number;
  plaza: string | null;
  articulo: string | null;
  tipo_de_mueble: string | null;
  tarifa_publica: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
}

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
  cotizacion: { nombre_campania: string; fecha_inicio: string; fecha_fin: string; numero_caras: number; bonificacion: number; precio: number } | null;
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

// Advanced filter types
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

const FILTER_FIELDS: FilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'Codigo', type: 'string' },
  { field: 'plaza', label: 'Plaza', type: 'string' },
  { field: 'tipo_de_cara', label: 'Tipo', type: 'string' },
  { field: 'tipo_de_mueble', label: 'Formato', type: 'string' },
  { field: 'articulo', label: 'Articulo', type: 'string' },
  { field: 'caras_totales', label: 'Caras', type: 'number' },
  { field: 'tarifa_publica', label: 'Tarifa', type: 'number' },
];

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

// Resumen types
interface ResumenArticuloGroup {
  articulo: string;
  items: InventarioReservado[];
  totalCaras: number;
  totalInversion: number;
  formatos: string[];
  tipos: string[];
  plazas: string[];
}

interface ResumenCatorcenaGroup {
  catorcena: string;
  articulos: ResumenArticuloGroup[];
  totalCaras: number;
  totalInversion: number;
}

function formatInicioPeriodo(item: InventarioReservado): string {
  if (item.numero_catorcena && item.anio_catorcena) {
    return `Catorcena ${item.numero_catorcena}, ${item.anio_catorcena}`;
  }
  return 'Sin asignar';
}

function applyFilters(data: InventarioReservado[], filters: FilterCondition[]): InventarioReservado[] {
  if (filters.length === 0) return data;
  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = (item as unknown as Record<string, unknown>)[filter.field];
      const filterValue = filter.value;
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
    });
  });
}

// Fetch from public endpoint
async function fetchPublicPropuesta(id: number): Promise<PublicPropuestaData> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await fetch(`${API_URL}/public/propuestas/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export function ClientePropuestaPage() {
  const { id } = useParams<{ id: string }>();
  const propuestaId = id ? parseInt(id, 10) : 0;
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // States
  const [expandedResumen, setExpandedResumen] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<InventarioReservado | null>(null);

  // Advanced filter states
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-propuesta', propuestaId],
    queryFn: () => fetchPublicPropuesta(propuestaId),
    enabled: propuestaId > 0,
  });

  const inventario = data?.inventario || [];

  // Computed data
  const kpis = useMemo(() => {
    if (!data) return { total: 0, renta: 0, bonificadas: 0, inversion: 0 };

    const total = inventario.reduce((sum, i) => sum + Number(i.caras_totales || 0), 0);
    const inversion = inventario.reduce((sum, i) => sum + (Number(i.tarifa_publica || 0) * Number(i.caras_totales || 1)), 0);
    const bonificadas = data.caras?.reduce((sum, c) => sum + Number(c.bonificacion || 0), 0) || 0;

    return { total: total + bonificadas, renta: total, bonificadas, inversion };
  }, [data, inventario]);

  // Filtered inventario (used by resumen)
  const filteredInventario = useMemo(() => {
    let filtered = inventario;
    if (filters.length > 0) {
      filtered = applyFilters(filtered, filters);
    }
    if (filterText) {
      const search = filterText.toLowerCase();
      filtered = filtered.filter(i =>
        i.codigo_unico?.toLowerCase().includes(search) ||
        i.plaza?.toLowerCase().includes(search) ||
        i.ubicacion?.toLowerCase().includes(search) ||
        i.tipo_de_mueble?.toLowerCase().includes(search) ||
        i.articulo?.toLowerCase().includes(search)
      );
    }
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = String(a[sortField as keyof InventarioReservado] || '');
        const bVal = String(b[sortField as keyof InventarioReservado] || '');
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return filtered;
  }, [inventario, filters, filterText, sortField, sortOrder]);

  // Resumen de Caras (grouped by catorcena > articulo from filtered data)
  const resumenCaras = useMemo((): ResumenCatorcenaGroup[] => {
    if (filteredInventario.length === 0) return [];

    const catorcenaMap = new Map<string, Map<string, InventarioReservado[]>>();

    filteredInventario.forEach(item => {
      const catKey = formatInicioPeriodo(item);
      const artKey = item.articulo || 'Sin articulo';
      if (!catorcenaMap.has(catKey)) catorcenaMap.set(catKey, new Map());
      const artMap = catorcenaMap.get(catKey)!;
      if (!artMap.has(artKey)) artMap.set(artKey, []);
      artMap.get(artKey)!.push(item);
    });

    return Array.from(catorcenaMap.entries()).map(([catorcena, artMap]) => {
      const articulos: ResumenArticuloGroup[] = Array.from(artMap.entries()).map(([articulo, items]) => ({
        articulo,
        items,
        totalCaras: items.reduce((sum, i) => sum + (Number(i.caras_totales) || 0), 0),
        totalInversion: items.reduce((sum, i) => sum + ((Number(i.tarifa_publica) || 0) * (Number(i.caras_totales) || 1)), 0),
        formatos: [...new Set(items.map(i => i.tipo_de_mueble || 'N/A'))],
        tipos: [...new Set(items.map(i => i.tipo_de_cara || 'N/A'))],
        plazas: [...new Set(items.map(i => i.plaza || 'N/A'))],
      }));

      return {
        catorcena,
        articulos,
        totalCaras: articulos.reduce((sum, a) => sum + a.totalCaras, 0),
        totalInversion: articulos.reduce((sum, a) => sum + a.totalInversion, 0),
      };
    });
  }, [filteredInventario]);

  const chartCiudades = useMemo(() => {
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const ciudad = i.plaza || 'Sin ciudad';
      counts[ciudad] = (counts[ciudad] || 0) + (Number(i.caras_totales) || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [inventario]);

  const chartFormatos = useMemo(() => {
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const formato = i.tipo_de_mueble || 'Otros';
      counts[formato] = (counts[formato] || 0) + (Number(i.caras_totales) || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inventario]);

  const mapCenter = useMemo(() => {
    if (inventario.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const validItems = inventario.filter(i => i.latitud && i.longitud);
    if (validItems.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const avgLat = validItems.reduce((sum, i) => sum + i.latitud, 0) / validItems.length;
    const avgLng = validItems.reduce((sum, i) => sum + i.longitud, 0) / validItems.length;
    return { lat: avgLat, lng: avgLng };
  }, [inventario]);

  // Catorcena period display helpers
  const periodoInicio = useMemo(() => {
    if (data?.propuesta?.catorcena_inicio && data?.propuesta?.anio_inicio) {
      return `Catorcena ${data.propuesta.catorcena_inicio}, ${data.propuesta.anio_inicio}`;
    }
    // Fallback: compute from inventario
    const catorcenas = inventario
      .filter(i => i.numero_catorcena && i.anio_catorcena)
      .map(i => ({ num: i.numero_catorcena!, year: i.anio_catorcena! }));
    if (catorcenas.length > 0) {
      const sorted = catorcenas.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);
      return `Catorcena ${sorted[0].num}, ${sorted[0].year}`;
    }
    return 'N/A';
  }, [data, inventario]);

  const periodoFin = useMemo(() => {
    if (data?.propuesta?.catorcena_fin && data?.propuesta?.anio_fin) {
      return `Catorcena ${data.propuesta.catorcena_fin}, ${data.propuesta.anio_fin}`;
    }
    const catorcenas = inventario
      .filter(i => i.numero_catorcena && i.anio_catorcena)
      .map(i => ({ num: i.numero_catorcena!, year: i.anio_catorcena! }));
    if (catorcenas.length > 0) {
      const sorted = catorcenas.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);
      const last = sorted[sorted.length - 1];
      return `Catorcena ${last.num}, ${last.year}`;
    }
    return 'N/A';
  }, [data, inventario]);

  // Handlers
  const handleDownloadCSV = () => {
    const headers = ['Codigo', 'Plaza', 'Ubicacion', 'Tipo Cara', 'Formato', 'Articulo', 'Caras', 'Tarifa', 'Periodo'];
    const rows = inventario.map(i => [
      i.codigo_unico, i.plaza, i.ubicacion, i.tipo_de_cara, i.tipo_de_mueble, i.articulo,
      i.caras_totales, i.tarifa_publica, formatInicioPeriodo(i)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas_propuesta_${propuestaId}.csv`;
    a.click();
  };

  const handleDownloadKML = () => {
    const placemarks = inventario
      .filter(i => i.latitud && i.longitud)
      .map(i => `
        <Placemark>
          <name>${i.codigo_unico}</name>
          <description>
            <![CDATA[
              Plaza: ${i.plaza || 'N/A'}<br/>
              Tipo: ${i.tipo_de_cara || 'N/A'}<br/>
              Formato: ${i.tipo_de_mueble || 'N/A'}<br/>
              Caras: ${i.caras_totales}<br/>
              Tarifa: ${formatCurrency(i.tarifa_publica || 0)}
            ]]>
          </description>
          <Point><coordinates>${i.longitud},${i.latitud},0</coordinates></Point>
        </Placemark>
      `).join('');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Propuesta ${propuestaId}</name>${placemarks}</Document>
</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propuesta_${propuestaId}.kml`;
    a.click();
  };

  const handleGeneratePDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    const PDF_BLUE = [0, 84, 166] as const;
    const PDF_GREEN = [122, 184, 0] as const;

    const clientViewUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;

    const addSectionTitle = (title: string, yPos: number) => {
      doc.setFillColor(PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]);
      doc.rect(marginX, yPos, pageWidth - marginX * 2, 7, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, marginX + 4, yPos + 5);
      return yPos + 12;
    };

    const createFieldRow = (fields: { label: string; value: string }[], yPos: number) => {
      const fieldWidth = (pageWidth - marginX * 2) / fields.length;
      fields.forEach((field, idx) => {
        const x = marginX + (fieldWidth * idx);
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(220, 220, 220);
        doc.rect(x + 1, yPos, fieldWidth - 2, 14, 'FD');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]);
        doc.text(field.label, x + 3, yPos + 4);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(field.value === 'N/A' ? 150 : 40, field.value === 'N/A' ? 150 : 40, field.value === 'N/A' ? 150 : 40);
        const valueText = doc.splitTextToSize(field.value, fieldWidth - 6);
        doc.text(valueText[0] || '', x + 3, yPos + 10);
      });
      return yPos + 18;
    };

    // Header
    doc.setFillColor(PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setFillColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
    doc.rect(0, 20, pageWidth, 2, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPUESTA DE CAMPAÑA PUBLICITARIA', pageWidth / 2, 13, { align: 'center' });
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaActual, pageWidth - marginX, 8, { align: 'right' });
    doc.setTextColor(200, 230, 255);
    const linkText = 'Ver propuesta en linea';
    const linkWidth = doc.getTextWidth(linkText);
    doc.textWithLink(linkText, pageWidth - marginX - linkWidth, 15, { url: clientViewUrl });
    y = 30;

    // Client Info
    y = addSectionTitle('INFORMACION DEL CLIENTE', y);
    y = createFieldRow([
      { label: 'Cliente', value: data?.solicitud?.cliente || 'N/A' },
      { label: 'Razon Social', value: data?.solicitud?.razon_social || 'N/A' },
      { label: 'Marca', value: data?.solicitud?.marca_nombre || 'N/A' },
    ], y);
    y = createFieldRow([
      { label: 'Asesor Comercial', value: data?.solicitud?.asesor || 'N/A' },
      { label: 'Agencia', value: data?.solicitud?.agencia || 'N/A' },
      { label: 'Producto', value: data?.solicitud?.producto_nombre || 'N/A' },
      { label: 'Categoria', value: data?.solicitud?.categoria_nombre || 'N/A' },
    ], y);
    y += 5;

    // Campaign
    y = addSectionTitle('DATOS DE LA CAMPAÑA', y);
    y = createFieldRow([
      { label: 'Nombre de Campaña', value: data?.cotizacion?.nombre_campania || 'N/A' },
    ], y);
    y += 3;

    // Period
    y = addSectionTitle('PERIODO DE CAMPAÑA', y);
    y = createFieldRow([
      { label: 'Catorcena de Inicio', value: periodoInicio },
      { label: 'Catorcena de Fin', value: periodoFin },
    ], y);
    y += 5;

    // KPIs
    y = addSectionTitle('RESUMEN DE INVERSION', y);
    const kpiBoxWidth = (pageWidth - marginX * 2 - 15) / 4;
    const kpiItems = [
      { label: 'Caras Totales', value: String(kpis.total), color: PDF_BLUE },
      { label: 'En Renta', value: String(kpis.renta), color: [66, 133, 244] as const },
      { label: 'Bonificadas', value: String(kpis.bonificadas), color: PDF_GREEN },
      { label: 'Inversion Total', value: formatCurrency(kpis.inversion), color: [0, 59, 113] as const },
    ];
    kpiItems.forEach((kpi, idx) => {
      const x = marginX + idx * (kpiBoxWidth + 5);
      doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.roundedRect(x, y, kpiBoxWidth, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + kpiBoxWidth / 2, y + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, x + kpiBoxWidth / 2, y + 15, { align: 'center' });
    });
    y += 30;

    // Grouped inventory table
    if (inventario.length > 0) {
      const grouped: Record<string, Record<string, typeof inventario>> = {};
      inventario.forEach(item => {
        const catKey = formatInicioPeriodo(item);
        const artKey = item.articulo || 'Sin articulo';
        if (!grouped[catKey]) grouped[catKey] = {};
        if (!grouped[catKey][artKey]) grouped[catKey][artKey] = [];
        grouped[catKey][artKey].push(item);
      });

      Object.entries(grouped).forEach(([catorcena, articulos]) => {
        doc.setFillColor(PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8, 1, 1, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(catorcena, marginX + 5, y + 5.5);
        y += 10;

        Object.entries(articulos).forEach(([articulo, items]) => {
          const groupCaras = items.reduce((sum, i) => sum + (Number(i.caras_totales) || 0), 0);
          const groupTarifa = items.reduce((sum, i) => sum + (Number(i.tarifa_publica) || 0) * (Number(i.caras_totales) || 0), 0);

          doc.setFillColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
          doc.roundedRect(marginX + 5, y, pageWidth - marginX * 2 - 10, 6, 1, 1, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(`${articulo}`, marginX + 10, y + 4);
          doc.setFont('helvetica', 'normal');
          doc.text(`Caras: ${groupCaras}  |  Inversion: ${formatCurrency(groupTarifa)}`, pageWidth - marginX - 10, y + 4, { align: 'right' });
          y += 8;

          autoTable(doc, {
            head: [['Ciudad', 'Ubicacion', 'Formato', 'Orientacion', 'Caras', 'Periodo']],
            body: items.map(i => [
              i.plaza || '-',
              (i.ubicacion || '-').substring(0, 50),
              i.tipo_de_mueble || '-',
              i.tipo_de_cara || '-',
              String(i.caras_totales || 0),
              formatInicioPeriodo(i),
            ]),
            startY: y,
            margin: { left: marginX + 5, right: marginX + 5 },
            styles: { fontSize: 7, cellPadding: 2, textColor: [40, 40, 40] },
            headStyles: { fillColor: [230, 240, 250], textColor: [PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]], fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [250, 252, 255] },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 80 },
              4: { halign: 'center', cellWidth: 20 },
              5: { cellWidth: 45 },
            },
          });

          y = (doc as any).lastAutoTable.finalY + 5;
          if (y > pageHeight - 40) { doc.addPage(); y = 20; }
        });
        y += 5;
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(PDF_BLUE[0], PDF_BLUE[1], PDF_BLUE[2]);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
      doc.setFillColor(PDF_GREEN[0], PDF_GREEN[1], PDF_GREEN[2]);
      doc.rect(0, pageHeight - 14, 4, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('IMU - Grupo IMU', marginX + 5, pageHeight - 6);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Desarrollado por QEB', marginX + 5, pageHeight - 2);
      doc.setFontSize(8);
      doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
    }

    doc.save(`Propuesta_${data?.cotizacion?.nombre_campania || propuestaId}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Revisa la consola para mas detalles.');
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

  const toggleResumen = (key: string) => {
    const next = new Set(expandedResumen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedResumen(next);
  };

  const COLORS = ['#0054A6', '#7AB800', '#003B71', '#5FA800', '#0077E6', '#8BC34A'];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-green-50/30 text-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center">
              <img src="/logo-grupo-imu.png" alt="IMU" className="h-14 w-auto object-contain" />
            </div>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-bold text-[#0054A6]">Propuesta de Campaña</h1>
              <p className="text-sm text-gray-500">Referencia #{propuestaId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadKML} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium shadow-sm transition-colors">
              <MapIcon className="h-4 w-4" /> KML
            </button>
            <button onClick={handleGeneratePDF} className="flex items-center gap-2 px-4 py-2 bg-[#0054A6] hover:bg-[#003B71] text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Campaign Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-[#0054A6]">
                {data?.cotizacion?.nombre_campania || 'Propuesta'}
              </h2>
              <p className="text-gray-600">{data?.propuesta?.descripcion || ''}</p>
            </div>
            <div className="bg-[#7AB800]/10 text-[#7AB800] px-3 py-1 rounded-full text-sm font-medium">
              {data?.propuesta?.status || 'Propuesta'}
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700">Inicio:</span>
              <span className="text-[#0054A6] font-medium">{periodoInicio}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700">Fin:</span>
              <span className="text-[#0054A6] font-medium">{periodoFin}</span>
            </span>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cliente', value: data?.solicitud?.cliente },
            { label: 'Razon Social', value: data?.solicitud?.razon_social },
            { label: 'Marca', value: data?.solicitud?.marca_nombre },
            { label: 'Asesor', value: data?.solicitud?.asesor },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold truncate text-[#0054A6]">{value || 'N/A'}</p>
            </div>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Caras', value: kpis.total, bg: 'bg-gradient-to-br from-[#0054A6] to-[#003B71]' },
            { label: 'En Renta', value: kpis.renta, bg: 'bg-gradient-to-br from-blue-500 to-blue-600' },
            { label: 'Bonificadas', value: kpis.bonificadas, bg: 'bg-gradient-to-br from-[#7AB800] to-[#5FA800]' },
            { label: 'Inversion Total', value: formatCurrency(kpis.inversion), bg: 'bg-gradient-to-br from-amber-500 to-amber-600' },
          ].map(({ label, value, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-5 text-center shadow-lg`}>
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Resumen de Caras - Tabla principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0054A6]/5 to-[#7AB800]/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#0054A6] flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Resumen de Caras
                <span className="text-xs text-gray-400 font-normal">({filteredInventario.length} inventarios)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7AB800] hover:bg-[#5FA800] text-white rounded-lg text-xs font-medium shadow-sm transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0054A6] focus:border-transparent w-44"
                />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 ${showFilters || filters.length > 0
                    ? 'bg-[#0054A6] text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  Filtros {filters.length > 0 && `(${filters.length})`}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700">
                  <option value="">Sin ordenar</option>
                  <option value="codigo_unico">Codigo</option>
                  <option value="plaza">Plaza</option>
                  <option value="tipo_de_cara">Tipo</option>
                  <option value="tarifa_publica">Tarifa</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-600"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              {(filterText || filters.length > 0) && (
                <button
                  onClick={() => { setFilterText(''); setFilters([]); }}
                  className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs hover:bg-red-100"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="p-4 border-b border-gray-200 bg-blue-50/30">
              <div className="flex flex-wrap gap-2 mb-3">
                {filters.map(filter => {
                  const fieldConfig = FILTER_FIELDS.find(f => f.field === filter.field);
                  const operatorConfig = FILTER_OPERATORS.find(o => o.value === filter.operator);
                  return (
                    <div key={filter.id} className="flex items-center gap-1 px-2 py-1 bg-[#0054A6]/10 rounded-lg text-xs">
                      <span className="text-[#0054A6]">{fieldConfig?.label || filter.field}</span>
                      <span className="text-gray-400">{operatorConfig?.label || filter.operator}</span>
                      <span className="text-gray-800 font-medium">{filter.value}</span>
                      <button onClick={() => setFilters(filters.filter(f => f.id !== filter.id))} className="ml-1 text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <select id="filter-field-client" className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700" defaultValue="">
                  <option value="" disabled>Campo</option>
                  {FILTER_FIELDS.map(f => (<option key={f.field} value={f.field}>{f.label}</option>))}
                </select>
                <select id="filter-operator-client" className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700" defaultValue="=">
                  {FILTER_OPERATORS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
                <input id="filter-value-client" type="text" placeholder="Valor" className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 w-32" />
                <button
                  onClick={() => {
                    const field = (document.getElementById('filter-field-client') as HTMLSelectElement).value;
                    const operator = (document.getElementById('filter-operator-client') as HTMLSelectElement).value as FilterOperator;
                    const value = (document.getElementById('filter-value-client') as HTMLInputElement).value;
                    if (field && value) {
                      setFilters([...filters, { id: `filter-${Date.now()}`, field, operator, value }]);
                      (document.getElementById('filter-value-client') as HTMLInputElement).value = '';
                    }
                  }}
                  className="px-3 py-1 bg-[#0054A6] hover:bg-[#003B71] text-white rounded text-xs"
                >Agregar</button>
                {filters.length > 0 && (
                  <button onClick={() => setFilters([])} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-xs">Limpiar</button>
                )}
              </div>
            </div>
          )}
            <div className="divide-y divide-gray-100">
              {resumenCaras.map((catGroup) => (
                <div key={catGroup.catorcena}>
                  {/* Catorcena Header */}
                  <button
                    onClick={() => toggleResumen(catGroup.catorcena)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-blue-50/50 transition-colors bg-[#0054A6]/5"
                  >
                    <div className="flex items-center gap-3">
                      {expandedResumen.has(catGroup.catorcena) ? (
                        <ChevronDown className="h-4 w-4 text-[#0054A6]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#0054A6]/50" />
                      )}
                      <span className="px-3 py-1 rounded-lg bg-[#0054A6]/10 text-[#0054A6] text-xs font-medium border border-[#0054A6]/20">
                        {catGroup.catorcena}
                      </span>
                      <span className="text-gray-400 text-xs">
                        ({catGroup.articulos.length} articulo{catGroup.articulos.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-xs">Caras:</span>
                        <span className="text-gray-800 text-sm font-semibold">{catGroup.totalCaras}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                        <span className="text-[#7AB800] text-xs">Inversion:</span>
                        <span className="text-[#7AB800] text-sm font-semibold">{formatCurrency(catGroup.totalInversion)}</span>
                      </div>
                    </div>
                  </button>

                  {/* Articulo Groups */}
                  {expandedResumen.has(catGroup.catorcena) && (
                    <div className="pl-6 border-l-2 border-[#0054A6]/20 ml-5">
                      {catGroup.articulos.map((artGroup) => {
                        const artKey = `${catGroup.catorcena}|${artGroup.articulo}`;
                        return (
                          <div key={artKey} className="border-b border-gray-100 last:border-b-0">
                            <button
                              onClick={() => toggleResumen(artKey)}
                              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-green-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {expandedResumen.has(artKey) ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-[#7AB800]" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-[#7AB800]/50" />
                                )}
                                <span className="px-2.5 py-0.5 rounded-md bg-[#7AB800]/10 text-[#7AB800] text-xs font-medium border border-[#7AB800]/20">
                                  {artGroup.articulo}
                                </span>
                                <span className="text-gray-400 text-xs">
                                  ({artGroup.items.length} inventario{artGroup.items.length > 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-gray-400">Caras: <span className="text-gray-700 font-medium">{artGroup.totalCaras}</span></span>
                                <span className="text-[#7AB800]">{formatCurrency(artGroup.totalInversion)}</span>
                              </div>
                            </button>

                            {expandedResumen.has(artKey) && (
                              <div className="px-4 pb-3">
                                {/* Summary badges */}
                                <div className="flex flex-wrap gap-2 mb-3 px-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400">Formatos:</span>
                                    {artGroup.formatos.map(f => (
                                      <span key={f} className="px-2 py-0.5 bg-blue-50 text-[#0054A6] rounded text-[10px] font-medium border border-blue-100">{f}</span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400">Tipos:</span>
                                    {artGroup.tipos.map(t => (
                                      <span key={t} className="px-2 py-0.5 bg-green-50 text-[#7AB800] rounded text-[10px] font-medium border border-green-100">{t}</span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400">Plazas:</span>
                                    {artGroup.plazas.map(p => (
                                      <span key={p} className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-medium border border-gray-200">{p}</span>
                                    ))}
                                  </div>
                                </div>
                                {/* Detail table */}
                                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-[#0054A6]/5">
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#0054A6]">Plaza</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#0054A6]">Formato</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#0054A6]">Tipo</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-[#0054A6]">Caras</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-amber-600">Tarifa</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-[#7AB800]">Inversion</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {artGroup.items.map((item, idx) => {
                                        const inv = (Number(item.tarifa_publica) || 0) * (Number(item.caras_totales) || 0);
                                        return (
                                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2 text-gray-700 text-xs">{item.plaza || '-'}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">{item.tipo_de_mueble || '-'}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">{item.tipo_de_cara || '-'}</td>
                                            <td className="px-3 py-2 text-center font-semibold text-gray-800 text-xs">{item.caras_totales}</td>
                                            <td className="px-3 py-2 text-right text-amber-600 text-xs">{formatCurrency(item.tarifa_publica || 0)}</td>
                                            <td className="px-3 py-2 text-right text-[#7AB800] font-medium text-xs">{formatCurrency(inv)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-[#0054A6]">Reservas por Ciudad</h3>
            {chartCiudades.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartCiudades} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#374151' }}
                    labelStyle={{ color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}
                    cursor={{ fill: 'rgba(0, 84, 166, 0.05)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartCiudades.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-500 text-center py-10">No hay inventario reservado</p>}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-[#0054A6]">Reservas por Tipo</h3>
            {chartFormatos.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartFormatos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#374151' }}
                    labelStyle={{ color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}
                    cursor={{ fill: 'rgba(0, 84, 166, 0.05)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartFormatos.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-500 text-center py-10">No hay inventario reservado</p>}
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
            <MapIcon className="h-5 w-5 text-[#0054A6]" />
            <h3 className="text-lg font-semibold text-[#0054A6]">Mapa de Ubicaciones</h3>
            <div className="flex items-center gap-2 ml-auto">
              <select value={searchRange} onChange={(e) => setSearchRange(parseInt(e.target.value))} className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700">
                <option value={100}>100m</option>
                <option value={200}>200m</option>
                <option value={300}>300m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
              </select>
              {isLoaded && (
                <Autocomplete onLoad={(ac) => { autocompleteRef.current = ac; }} onPlaceChanged={handlePOIPlaceChanged} options={{ componentRestrictions: { country: 'mx' } }}>
                  <input type="text" value={poiSearch} onChange={(e) => setPoiSearch(e.target.value)} placeholder="Buscar POI..." className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#0054A6] text-gray-700" />
                </Autocomplete>
              )}
              {poiMarkers.length > 0 && (
                <button onClick={() => setPoiMarkers([])} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs hover:bg-red-100 transition-colors">Limpiar</button>
              )}
            </div>
          </div>
          <div className="h-[500px]">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={12}
                options={{ styles: IMU_MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
                onLoad={(map) => {
                  mapRef.current = map;
                  if (inventario.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    inventario.forEach(item => {
                      if (item.latitud && item.longitud) {
                        bounds.extend({ lat: item.latitud, lng: item.longitud });
                      }
                    });
                    if (!bounds.isEmpty()) {
                      map.fitBounds(bounds, 50);
                    }
                  }
                }}
              >
                {inventario.map((item) => (
                  item.latitud && item.longitud && (
                    <Marker
                      key={item.id}
                      position={{ lat: item.latitud, lng: item.longitud }}
                      onClick={() => setSelectedMarker(item)}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: item.tipo_de_cara === 'Flujo' ? '#ef4444' : item.tipo_de_cara === 'Contraflujo' ? '#3b82f6' : IMU_BLUE,
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                      }}
                    />
                  )
                ))}
                {selectedMarker && (
                  <InfoWindow
                    position={{ lat: selectedMarker.latitud, lng: selectedMarker.longitud }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-2 min-w-[200px]" style={{ color: '#000' }}>
                      <h4 className="font-bold text-sm mb-2" style={{ color: IMU_DARK }}>{selectedMarker.codigo_unico}</h4>
                      <div className="text-xs space-y-1">
                        <p><strong>Plaza:</strong> {selectedMarker.plaza || 'N/A'}</p>
                        <p><strong>Tipo:</strong> {selectedMarker.tipo_de_cara || 'N/A'}</p>
                        <p><strong>Formato:</strong> {selectedMarker.tipo_de_mueble || 'N/A'}</p>
                        <p><strong>Ubicacion:</strong> {selectedMarker.ubicacion || 'N/A'}</p>
                        <p><strong>Caras:</strong> {selectedMarker.caras_totales}</p>
                        <p><strong>Tarifa:</strong> {formatCurrency(selectedMarker.tarifa_publica || 0)}</p>
                        {selectedMarker.numero_catorcena && (
                          <p><strong>Periodo:</strong> Catorcena {selectedMarker.numero_catorcena}, {selectedMarker.anio_catorcena}</p>
                        )}
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

        {/* Footer */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/logo-grupo-imu.png" alt="IMU" className="h-10 w-auto" />
              <div className="border-l border-gray-200 pl-4">
                <p className="text-sm font-medium text-gray-700">Grupo IMU</p>
                <p className="text-xs text-gray-500">Soluciones en publicidad exterior</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Todos los derechos reservados</p>
              <p className="text-xs text-gray-400 mt-1">Esta propuesta es confidencial y de uso exclusivo para el destinatario</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
