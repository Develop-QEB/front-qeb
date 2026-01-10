import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Share2, Download, FileText, Map, Copy, Check, Loader2,
  ChevronDown, ChevronRight, Filter, ArrowUpDown, Layers, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete, InfoWindow } from '@react-google-maps/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { propuestasService, InventarioReservado, PropuestaFullDetails } from '../../services/propuestas.service';
import { formatCurrency, formatDate } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';
const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

// Purple Brand Colors for Compartir
const PURPLE_PRIMARY = '#8B5CF6';
const PURPLE_DARK = '#6D28D9';
const PURPLE_LIGHT = '#A78BFA';
const PURPLE_ACCENT = '#C084FC';

// Dark map styles with IMU colors
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#60a5fa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
];

type GroupByField = 'numero_catorcena' | 'articulo' | 'plaza' | 'tipo_de_cara' | 'estatus_reserva';

interface POIMarker {
  id: string;
  position: { lat: number; lng: number };
  name: string;
  range: number;
}

// Helper functions
function formatInicioPeriodo(item: InventarioReservado): string {
  if (item.numero_catorcena && item.anio_catorcena) {
    return `Catorcena ${item.numero_catorcena}, ${item.anio_catorcena}`;
  }
  return 'Sin asignar';
}

function getGroupValue(item: InventarioReservado, field: GroupByField): string {
  if (field === 'numero_catorcena') return formatInicioPeriodo(item);
  return String(item[field] || 'Sin asignar');
}

// Filter types (from CampanaDetailPage)
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

function applyFilters<T>(data: T[], filters: FilterCondition[]): T[] {
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

export function CompartirPropuestaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propuestaId = id ? parseInt(id, 10) : 0;
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // States
  const [copied, setCopied] = useState(false);
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>(['numero_catorcena', 'articulo']);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Filter states
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // POI states
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<InventarioReservado | null>(null);

  // Google Maps
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // Queries
  const { data: details, isLoading: loadingDetails } = useQuery({
    queryKey: ['propuesta-full', propuestaId],
    queryFn: () => propuestasService.getFullDetails(propuestaId),
    enabled: propuestaId > 0,
  });

  const { data: inventario, isLoading: loadingInventario } = useQuery({
    queryKey: ['propuesta-inventario', propuestaId],
    queryFn: () => propuestasService.getInventarioReservado(propuestaId),
    enabled: propuestaId > 0,
  });

  // Computed data
  const kpis = useMemo(() => {
    if (!details?.caras) return { total: 0, renta: 0, bonificadas: 0, inversion: 0 };

    // Calculate from propuesta caras (the source of truth)
    const renta = details.caras.reduce((sum, c) => sum + Number(c.caras || 0), 0);
    const bonificadas = details.caras.reduce((sum, c) => sum + Number(c.bonificacion || 0), 0);
    const total = renta + bonificadas;

    // Inversion from inventario tarifa_publica
    const inversion = inventario?.reduce((sum, i) => sum + (Number(i.tarifa_publica || 0) * Number(i.caras_totales || 1)), 0) || 0;

    return { total, renta, bonificadas, inversion };
  }, [inventario, details]);

  // Charts data
  const chartCiudades = useMemo(() => {
    if (!inventario) return [];
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const ciudad = i.plaza || 'Sin ciudad';
      counts[ciudad] = (counts[ciudad] || 0) + (Number(i.caras_totales) || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [inventario]);

  const chartFormatos = useMemo(() => {
    if (!inventario) return [];
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const formato = i.tipo_de_mueble || 'Otros';
      counts[formato] = (counts[formato] || 0) + (Number(i.caras_totales) || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inventario]);

  // Map center
  const mapCenter = useMemo(() => {
    if (!inventario || inventario.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const validItems = inventario.filter(i => i.latitud && i.longitud);
    if (validItems.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const avgLat = validItems.reduce((sum, i) => sum + i.latitud, 0) / validItems.length;
    const avgLng = validItems.reduce((sum, i) => sum + i.longitud, 0) / validItems.length;
    return { lat: avgLat, lng: avgLng };
  }, [inventario]);

  // Grouped data
  const groupedData = useMemo(() => {
    if (!inventario) return {};
    let filtered = inventario;

    if (filterText) {
      const search = filterText.toLowerCase();
      filtered = inventario.filter(i =>
        i.codigo_unico?.toLowerCase().includes(search) ||
        i.plaza?.toLowerCase().includes(search) ||
        i.ubicacion?.toLowerCase().includes(search)
      );
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = String(a[sortField as keyof InventarioReservado] || '');
        const bVal = String(b[sortField as keyof InventarioReservado] || '');
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    const grouped: Record<string, InventarioReservado[]> = {};
    filtered.forEach(item => {
      const keys = activeGroupings.map(g => getGroupValue(item, g));
      const key = keys.join(' | ');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }, [inventario, activeGroupings, filterText, sortField, sortOrder]);

  // Handlers
  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!inventario) return;
    const headers = ['Código', 'Plaza', 'Ubicación', 'Tipo Cara', 'Formato', 'Caras', 'Tarifa', 'Periodo'];
    const rows = inventario.map(i => [
      i.codigo_unico, i.plaza, i.ubicacion, i.tipo_de_cara, i.tipo_de_mueble,
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

  // Download ALL items as KML
  const handleDownloadKMLAll = () => {
    if (!inventario) return;

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
              Caras: ${i.caras_totales}
            ]]>
          </description>
          <Point>
            <coordinates>${i.longitud},${i.latitud},0</coordinates>
          </Point>
        </Placemark>
      `).join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Reservas Propuesta ${propuestaId} - Todos</name>
    ${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas_propuesta_${propuestaId}_todos.kml`;
    a.click();
  };

  // Download only SELECTED items as KML
  const handleDownloadKMLSelected = () => {
    if (!inventario || selectedItems.size === 0) return;

    const itemsToExport = inventario.filter(i => selectedItems.has(i.id));

    const placemarks = itemsToExport
      .filter(i => i.latitud && i.longitud)
      .map(i => `
        <Placemark>
          <name>${i.codigo_unico}</name>
          <description>
            <![CDATA[
              Plaza: ${i.plaza || 'N/A'}<br/>
              Tipo: ${i.tipo_de_cara || 'N/A'}<br/>
              Formato: ${i.tipo_de_mueble || 'N/A'}<br/>
              Caras: ${i.caras_totales}
            ]]>
          </description>
          <Point>
            <coordinates>${i.longitud},${i.latitud},0</coordinates>
          </Point>
        </Placemark>
      `).join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Reservas Propuesta ${propuestaId} - ${selectedItems.size} seleccionados</name>
    ${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas_propuesta_${propuestaId}_seleccionados.kml`;
    a.click();
  };

  // Download KML for a specific group
  const handleDownloadGroupKML = (groupName: string, items: InventarioReservado[]) => {
    const placemarks = items
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
              Periodo: ${i.numero_catorcena ? `Catorcena ${i.numero_catorcena}, ${i.anio_catorcena}` : 'N/A'}
            ]]>
          </description>
          <Point>
            <coordinates>${i.longitud},${i.latitud},0</coordinates>
          </Point>
        </Placemark>
      `).join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${groupName} - ${items.length} inventarios</name>
    ${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `grupo_${safeName}_propuesta_${propuestaId}.kml`;
    a.click();
  };

  // Center map on group items
  const handleShowGroupOnMap = (items: InventarioReservado[]) => {
    const validItems = items.filter(i => i.latitud && i.longitud);
    if (validItems.length === 0 || !mapRef.current) return;

    // Create bounds
    const bounds = new google.maps.LatLngBounds();
    validItems.forEach(item => {
      bounds.extend({ lat: item.latitud, lng: item.longitud });
    });
    mapRef.current.fitBounds(bounds, 50);

    // Also select these items
    setSelectedItems(new Set(items.map(i => i.id)));
  };

  // Toggle item selection
  const toggleItemSelection = (id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all in a group
  const toggleGroupSelection = (items: InventarioReservado[]) => {
    const groupIds = items.map(i => i.id);
    const allSelected = groupIds.every(id => selectedItems.has(id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Select all
  const toggleSelectAll = () => {
    if (!inventario) return;
    if (selectedItems.size === inventario.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventario.map(i => i.id)));
    }
  };

  const handleGeneratePDF = async () => {
    // Dynamic import of jspdf
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // IMU Brand Colors
    const IMU_BLUE: [number, number, number] = [0, 84, 166]; // #0054A6
    const IMU_GREEN: [number, number, number] = [122, 184, 0]; // #7AB800
    const IMU_DARK: [number, number, number] = [0, 61, 122]; // Darker blue
    const WHITE: [number, number, number] = [255, 255, 255];

    // Header - Clean white background with colored accents
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Top accent bar - green
    doc.setFillColor(...IMU_GREEN);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Bottom accent bar - blue
    doc.setFillColor(...IMU_BLUE);
    doc.rect(0, 27, pageWidth, 3, 'F');

    // IMU Logo - Load and add image with correct proportions
    try {
      const logoImg = new Image();
      logoImg.src = '/logo-grupo-imu.png';
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        setTimeout(resolve, 1000);
      });
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        // Calculate aspect ratio to avoid squishing
        const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoHeight = 18;
        const logoWidth = logoHeight * aspectRatio;
        doc.addImage(logoImg, 'PNG', marginX, 6, logoWidth, logoHeight);
      }
    } catch {
      // Fallback to styled text
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...IMU_BLUE);
      doc.text('GRUPO IMU', marginX, 18);
    }

    // Title - centered
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...IMU_DARK);
    doc.text('PROPUESTA DE CAMPAÑA PUBLICITARIA', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Documento Interno', pageWidth / 2, 20, { align: 'center' });

    // Right side info
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(fechaActual, pageWidth - marginX, 10, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...IMU_BLUE);
    doc.text(`Propuesta #${propuestaId}`, pageWidth - marginX, 16, { align: 'right' });

    // Link styled as button
    const clientViewUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;
    doc.setFillColor(...IMU_GREEN);
    doc.roundedRect(pageWidth - marginX - 45, 19, 45, 6, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.textWithLink('Ver propuesta cliente >', pageWidth - marginX - 43, 23, { url: clientViewUrl });

    y = 38;

    // Client info section
    doc.setFillColor(...IMU_BLUE);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text('INFORMACIÓN DEL CLIENTE', marginX + 5, y + 5);
    y += 12;

    const clientFields = [
      ['CUIC', details?.solicitud?.cuic || 'N/A'],
      ['Cliente', details?.solicitud?.cliente || 'N/A'],
      ['Razón Social', details?.solicitud?.razon_social || 'N/A'],
      ['Marca', details?.solicitud?.marca_nombre || 'N/A'],
      ['Asesor', details?.solicitud?.asesor || 'N/A'],
      ['Agencia', details?.solicitud?.agencia || 'N/A'],
    ];

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    clientFields.forEach(([label, value], idx) => {
      const x = marginX + (idx % 3) * 95;
      const row = Math.floor(idx / 3);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...IMU_BLUE);
      doc.text(`${label}:`, x, y + row * 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(value), x + 30, y + row * 7);
    });
    y += 22;

    // Campaign info
    doc.setFillColor(...IMU_BLUE);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setTextColor(...WHITE);
    doc.text('DATOS DE LA PROPUESTA', marginX + 5, y + 5);
    y += 12;

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...IMU_BLUE);
    doc.text('Nombre Campaña:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(details?.cotizacion?.nombre_campania || 'N/A', marginX + 40, y);

    // Calculate catorcena range from inventory
    if (inventario && inventario.length > 0) {
      const catorcenas = inventario
        .filter(i => i.numero_catorcena && i.anio_catorcena)
        .map(i => ({ num: i.numero_catorcena!, year: i.anio_catorcena! }));

      if (catorcenas.length > 0) {
        const sorted = catorcenas.sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.num - b.num
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...IMU_BLUE);
        doc.text('Periodo:', marginX + 150, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const periodoText = first.year === last.year && first.num === last.num
          ? `Catorcena ${first.num}, ${first.year}`
          : `Catorcena ${first.num}/${first.year} - Catorcena ${last.num}/${last.year}`;
        doc.text(periodoText, marginX + 170, y);
      }
    }
    y += 8;

    if (details?.propuesta?.descripcion) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...IMU_BLUE);
      doc.text('Descripción:', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const desc = doc.splitTextToSize(details.propuesta.descripcion, pageWidth - marginX * 2 - 35);
      doc.text(desc, marginX + 28, y);
      y += desc.length * 5 + 2;
    }
    y += 8;

    // KPIs with IMU colored boxes
    doc.setFillColor(...IMU_BLUE);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setTextColor(...WHITE);
    doc.text('RESUMEN DE MÉTRICAS', marginX + 5, y + 5);
    y += 12;

    const kpiData = [
      { label: 'Total Caras', value: String(kpis.total), color: IMU_BLUE },
      { label: 'En Renta', value: String(kpis.renta), color: IMU_GREEN },
      { label: 'Bonificadas', value: String(kpis.bonificadas), color: [0, 150, 180] as [number, number, number] }, // Cyan
      { label: 'Inversión Total', value: formatCurrency(kpis.inversion), color: [220, 160, 0] as [number, number, number] }, // Amber
    ];

    const kpiWidth = (pageWidth - marginX * 2 - 15) / 4;
    kpiData.forEach((kpi, idx) => {
      const x = marginX + idx * (kpiWidth + 5);
      doc.setFillColor(...kpi.color);
      doc.roundedRect(x, y, kpiWidth, 15, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(kpi.label, x + kpiWidth / 2, y + 5, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, x + kpiWidth / 2, y + 12, { align: 'center' });
    });
    y += 25;

    // Table grouped by Catorcena > Artículo (separate rows)
    if (inventario && inventario.length > 0) {
      // Group by catorcena first, then by articulo
      const grouped: Record<string, Record<string, typeof inventario>> = {};
      inventario.forEach(item => {
        const catKey = formatInicioPeriodo(item);
        const artKey = item.articulo || 'Sin artículo';
        if (!grouped[catKey]) grouped[catKey] = {};
        if (!grouped[catKey][artKey]) grouped[catKey][artKey] = [];
        grouped[catKey][artKey].push(item);
      });

      Object.entries(grouped).forEach(([catorcena, articulos]) => {
        // === CATORCENA HEADER (separate section) ===
        doc.setFillColor(...IMU_BLUE);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 8, 1, 1, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...WHITE);
        doc.text(catorcena, marginX + 5, y + 5.5);
        y += 10;

        Object.entries(articulos).forEach(([articulo, items]) => {
          // Calculate group totals
          const groupCaras = items.reduce((sum, i) => sum + (Number(i.caras_totales) || 0), 0);
          const groupTarifa = items.reduce((sum, i) => sum + (Number(i.tarifa_publica) || 0) * (Number(i.caras_totales) || 0), 0);

          // === ARTICULO SUB-HEADER ===
          doc.setFillColor(...IMU_GREEN);
          doc.roundedRect(marginX + 5, y, pageWidth - marginX * 2 - 10, 6, 1, 1, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...WHITE);
          doc.text(`${articulo}`, marginX + 10, y + 4);
          doc.setFont('helvetica', 'normal');
          doc.text(`Caras: ${groupCaras}  |  Inversion: ${formatCurrency(groupTarifa)}`, pageWidth - marginX - 10, y + 4, { align: 'right' });
          y += 8;

          // === TABLE FOR THIS ARTICULO ===
          const tableData = items.map(i => [
            i.codigo_unico || '',
            i.plaza || '',
            i.tipo_de_cara || '',
            i.tipo_de_mueble || '',
            String(i.caras_totales),
            (i.ubicacion || '').substring(0, 40),
          ]);

          autoTable(doc, {
            head: [['Código', 'Plaza', 'Tipo', 'Formato', 'Caras', 'Ubicación']],
            body: tableData,
            startY: y,
            margin: { left: marginX + 5, right: marginX + 5 },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [230, 240, 250], textColor: IMU_BLUE, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [250, 252, 255] },
            columnStyles: {
              0: { cellWidth: 32 },
              4: { halign: 'center', cellWidth: 14 },
            },
          });

          y = (doc as any).lastAutoTable.finalY + 5;

          // Check page break
          if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
          }
        });

        y += 5; // Extra space after catorcena group
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...IMU_GREEN);
      doc.rect(0, pageHeight - 12, pageWidth, 1, 'F');
      doc.setFillColor(...IMU_BLUE);
      doc.rect(0, pageHeight - 11, pageWidth, 11, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Grupo IMU | Documento generado automaticamente', marginX, pageHeight - 4);
      doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 4, { align: 'right' });
    }

    doc.save(`Propuesta_Interna_${propuestaId}.pdf`);
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

  const toggleGrouping = (field: GroupByField) => {
    if (activeGroupings.includes(field)) {
      setActiveGroupings(activeGroupings.filter(g => g !== field));
    } else {
      setActiveGroupings([...activeGroupings, field]);
    }
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const isLoading = loadingDetails || loadingInventario;
  const COLORS = ['#8B5CF6', '#A78BFA', '#C084FC', '#DDD6FE', '#6D28D9', '#7C3AED']; // Purple palette

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-zinc-900/95 via-purple-900/20 to-zinc-900/95 backdrop-blur border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/propuestas')} className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5 text-zinc-400" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-purple-500" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">Vista Compartir</h1>
              </div>
              <p className="text-sm text-zinc-400">Propuesta #{propuestaId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/cliente/propuesta/${propuestaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en navegador
            </a>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Enlace'}
            </button>
            <button
              onClick={handleDownloadKMLAll}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-purple-500/20 text-white rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
              title="Descargar KML de todos los inventarios"
            >
              <Map className="h-4 w-4" />
              KML Todo
            </button>
            <button
              onClick={handleGeneratePDF}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-purple-500/20 text-white rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Campaign Header */}
        <div className="bg-gradient-to-r from-purple-900/40 via-violet-900/30 to-pink-900/20 rounded-2xl p-6 border border-purple-500/30 shadow-xl shadow-purple-500/10">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
            {details?.cotizacion?.nombre_campania || 'Propuesta sin nombre'}
          </h2>
          <p className="text-zinc-400">{details?.propuesta?.descripcion || 'Sin descripción'}</p>
          {details?.propuesta?.notas && (
            <p className="text-sm text-zinc-500 mt-2">Notas: {details.propuesta.notas}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm">
            <span className="text-purple-300">
              Inicio: {details?.cotizacion?.fecha_inicio ? formatDate(details.cotizacion.fecha_inicio) : 'N/A'}
            </span>
            <span className="text-purple-300">
              Fin: {details?.cotizacion?.fecha_fin ? formatDate(details.cotizacion.fecha_fin) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'CUIC', value: details?.solicitud?.cuic },
            { label: 'Cliente', value: details?.solicitud?.cliente },
            { label: 'Razón Social', value: details?.solicitud?.razon_social },
            { label: 'Unidad de Negocio', value: details?.solicitud?.unidad_negocio },
            { label: 'Marca', value: details?.solicitud?.marca_nombre },
            { label: 'Asesor', value: details?.solicitud?.asesor },
            { label: 'Agencia', value: details?.solicitud?.agencia },
            { label: 'Producto', value: details?.solicitud?.producto_nombre },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gradient-to-br from-zinc-900 to-zinc-900/80 rounded-xl p-4 border border-purple-500/10 hover:border-purple-500/30 transition-colors">
              <p className="text-xs text-purple-500/70">{label}</p>
              <p className="text-sm font-medium text-white truncate">{value || 'N/A'}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-zinc-900 to-purple-900/10 rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">Reservas por Ciudad</h3>
            {chartCiudades.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartCiudades} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#888" />
                  <YAxis dataKey="name" type="category" stroke="#888" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartCiudades.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-500 text-center py-10">No hay inventario reservado</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-purple-900/10 rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent mb-4">Reservas por Tipo</h3>
            {chartFormatos.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartFormatos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartFormatos.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-500 text-center py-10">No hay inventario reservado</p>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Caras', value: kpis.total, color: 'text-purple-500', bg: 'from-purple-500/20 to-purple-600/10' },
            { label: 'En Renta', value: kpis.renta, color: 'text-violet-400', bg: 'from-pink-400/20 to-violet-400/10' },
            { label: 'Bonificadas', value: kpis.bonificadas, color: 'text-pink-400', bg: 'from-pink-400/20 to-violet-400/10' },
            { label: 'Inversión Total', value: formatCurrency(kpis.inversion), color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/10' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`bg-gradient-to-br ${bg} rounded-xl p-4 border border-purple-500/20 text-center`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Table Controls */}
        <div className="bg-gradient-to-br from-zinc-900 to-purple-900/5 rounded-2xl border border-purple-500/20 overflow-hidden">
          <div className="p-4 border-b border-purple-500/10 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-purple-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-3 py-1.5 bg-zinc-800/80 border border-purple-500/20 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 ${showFilters || filters.length > 0
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-purple-500/20'
                }`}
              >
                <Filter className="h-3 w-3" />
                Filtros {filters.length > 0 && `(${filters.length})`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-zinc-500">Agrupar:</span>
              {(['numero_catorcena', 'articulo', 'plaza', 'tipo_de_cara'] as GroupByField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleGrouping(field)}
                  className={`px-2 py-1 rounded text-xs transition-all ${activeGroupings.includes(field)
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-purple-500/20'
                    }`}
                >
                  {field === 'numero_catorcena' ? 'Catorcena' : field.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-purple-500" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="px-2 py-1 bg-zinc-800 border border-purple-500/20 rounded text-xs text-white focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Sin ordenar</option>
                <option value="codigo_unico">Código</option>
                <option value="plaza">Plaza</option>
                <option value="tipo_de_cara">Tipo</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 bg-zinc-800 hover:bg-purple-500/20 rounded text-xs text-zinc-400"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-sm shadow-lg shadow-emerald-500/20"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </button>
              {selectedItems.size > 0 && (
                <button
                  onClick={handleDownloadKMLSelected}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg text-sm shadow-lg shadow-blue-500/20"
                  title={`Descargar KML de ${selectedItems.size} seleccionados`}
                >
                  <Map className="h-4 w-4" />
                  KML ({selectedItems.size})
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="p-4 border-b border-purple-500/10 bg-zinc-800/30">
              <div className="flex flex-wrap gap-2 mb-3">
                {filters.map(filter => {
                  const fieldConfig = FILTER_FIELDS.find(f => f.field === filter.field);
                  const operatorConfig = FILTER_OPERATORS.find(o => o.value === filter.operator);
                  return (
                    <div key={filter.id} className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg text-xs">
                      <span className="text-purple-300">{fieldConfig?.label || filter.field}</span>
                      <span className="text-zinc-500">{operatorConfig?.label || filter.operator}</span>
                      <span className="text-white font-medium">{filter.value}</span>
                      <button
                        onClick={() => setFilters(filters.filter(f => f.id !== filter.id))}
                        className="ml-1 text-zinc-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <select
                  id="filter-field"
                  className="px-2 py-1 bg-zinc-800 border border-purple-500/20 rounded text-xs text-white"
                  defaultValue=""
                >
                  <option value="" disabled>Campo</option>
                  {FILTER_FIELDS.map(f => (
                    <option key={f.field} value={f.field}>{f.label}</option>
                  ))}
                </select>
                <select
                  id="filter-operator"
                  className="px-2 py-1 bg-zinc-800 border border-purple-500/20 rounded text-xs text-white"
                  defaultValue="="
                >
                  {FILTER_OPERATORS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  id="filter-value"
                  type="text"
                  placeholder="Valor"
                  className="px-2 py-1 bg-zinc-800 border border-purple-500/20 rounded text-xs text-white w-32"
                />
                <button
                  onClick={() => {
                    const field = (document.getElementById('filter-field') as HTMLSelectElement).value;
                    const operator = (document.getElementById('filter-operator') as HTMLSelectElement).value as FilterOperator;
                    const value = (document.getElementById('filter-value') as HTMLInputElement).value;
                    if (field && value) {
                      setFilters([...filters, { id: `filter-${Date.now()}`, field, operator, value }]);
                      (document.getElementById('filter-value') as HTMLInputElement).value = '';
                    }
                  }}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs"
                >
                  Agregar
                </button>
                {filters.length > 0 && (
                  <button
                    onClick={() => setFilters([])}
                    className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Selection info and actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <span className="text-sm text-purple-300">{selectedItems.size} seleccionados</span>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Limpiar selección
              </button>
            </div>
          )}

          {/* Grouped Table */}
          <div className="max-h-[500px] overflow-auto">
            {Object.entries(groupedData).map(([groupKey, items]) => {
              const groupItemIds = items.map(i => i.id);
              const allGroupSelected = groupItemIds.every(id => selectedItems.has(id));
              const someGroupSelected = groupItemIds.some(id => selectedItems.has(id));

              return (
                <div key={groupKey} className="border-b border-zinc-800">
                  <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                      onChange={() => toggleGroupSelection(items)}
                      className="checkbox-purple"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      {expandedGroups.has(groupKey) ? (
                        <ChevronDown className="h-4 w-4 text-blue-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-blue-400" />
                      )}
                      <span className="text-sm font-medium text-white">{groupKey}</span>
                      <span className="text-xs text-zinc-500">({items.length} items)</span>
                    </button>
                    {/* Group action buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400">
                        {items.reduce((sum, i) => sum + (Number(i.caras_totales) || 0), 0)} caras
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowGroupOnMap(items); }}
                        className="p-1.5 hover:bg-purple-500/20 rounded text-purple-400 transition-colors"
                        title="Ver en mapa"
                      >
                        <Map className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadGroupKML(groupKey, items); }}
                        className="p-1.5 hover:bg-blue-500/20 rounded text-blue-400 transition-colors"
                        title="Descargar KML del grupo"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedGroups.has(groupKey) && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-900/50 text-xs text-zinc-500">
                          <th className="px-3 py-2 w-10"></th>
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-left">Plaza</th>
                          <th className="px-4 py-2 text-left">Ubicación</th>
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-left">Formato</th>
                          <th className="px-4 py-2 text-center">Caras</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr
                            key={idx}
                            onClick={() => toggleItemSelection(item.id)}
                            className={`border-t border-zinc-800/50 cursor-pointer transition-colors ${selectedItems.has(item.id) ? 'bg-purple-500/10' : 'hover:bg-zinc-800/30'}`}
                          >
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                className="checkbox-purple"
                              />
                            </td>
                            <td className="px-4 py-2 text-blue-300 font-mono text-xs">{item.codigo_unico}</td>
                            <td className="px-4 py-2 text-zinc-300">{item.plaza}</td>
                            <td className="px-4 py-2 text-zinc-400 text-xs truncate max-w-[200px]">{item.ubicacion}</td>
                            <td className="px-4 py-2 text-zinc-300">{item.tipo_de_cara}</td>
                            <td className="px-4 py-2 text-zinc-400">{item.tipo_de_mueble}</td>
                            <td className="px-4 py-2 text-center text-white">{item.caras_totales}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
            <Map className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">Mapa de Reservas</h3>

            <div className="flex items-center gap-2 ml-auto">
              <select
                value={searchRange}
                onChange={(e) => setSearchRange(parseInt(e.target.value))}
                className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
              >
                <option value={100}>100m</option>
                <option value={200}>200m</option>
                <option value={300}>300m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
              </select>

              {isLoaded && (
                <Autocomplete
                  onLoad={(ac) => { autocompleteRef.current = ac; }}
                  onPlaceChanged={handlePOIPlaceChanged}
                  options={{ componentRestrictions: { country: 'mx' } }}
                >
                  <input
                    type="text"
                    value={poiSearch}
                    onChange={(e) => setPoiSearch(e.target.value)}
                    placeholder="Buscar POI..."
                    className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                  />
                </Autocomplete>
              )}

              {poiMarkers.length > 0 && (
                <button
                  onClick={() => setPoiMarkers([])}
                  className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-xs"
                >
                  Limpiar POIs
                </button>
              )}
            </div>
          </div>

          <div className="h-[500px]">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={12}
                options={{ styles: DARK_MAP_STYLES, disableDefaultUI: true, zoomControl: true }}
                onLoad={(map) => {
                  mapRef.current = map;
                  // Fit bounds to all inventory items on load
                  if (inventario && inventario.length > 0) {
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
                {inventario?.map((item) => (
                  item.latitud && item.longitud && (
                    <Marker
                      key={item.id}
                      position={{ lat: item.latitud, lng: item.longitud }}
                      onClick={() => {
                        setSelectedMarker(item);
                        toggleItemSelection(item.id);
                      }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: selectedItems.has(item.id) ? 10 : 7,
                        fillColor: selectedItems.has(item.id)
                          ? '#22c55e' // Verde si está seleccionado
                          : item.tipo_de_cara === 'Flujo' ? '#ef4444' : item.tipo_de_cara === 'Contraflujo' ? '#3b82f6' : '#a855f7',
                        fillOpacity: selectedItems.has(item.id) ? 1 : 0.9,
                        strokeColor: selectedItems.has(item.id) ? '#fff' : '#fff',
                        strokeWeight: selectedItems.has(item.id) ? 3 : 1.5,
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
                      <h4 className="font-bold text-sm mb-2" style={{ color: '#1a1a2e' }}>{selectedMarker.codigo_unico}</h4>
                      <div className="text-xs space-y-1">
                        <p><strong>Plaza:</strong> {selectedMarker.plaza || 'N/A'}</p>
                        <p><strong>Tipo:</strong> {selectedMarker.tipo_de_cara || 'N/A'}</p>
                        <p><strong>Formato:</strong> {selectedMarker.tipo_de_mueble || 'N/A'}</p>
                        <p><strong>Ubicación:</strong> {selectedMarker.ubicacion || 'N/A'}</p>
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
                  <Circle
                    key={marker.id}
                    center={marker.position}
                    radius={marker.range}
                    options={{
                      strokeColor: '#a855f7',
                      strokeOpacity: 0.7,
                      strokeWeight: 2,
                      fillColor: '#a855f7',
                      fillOpacity: 0.15,
                    }}
                  />
                ))}
              </GoogleMap>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
