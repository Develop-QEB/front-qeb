import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import {
  Download, FileText, Map, Loader2, ChevronDown, ChevronRight,
  Filter, ArrowUpDown, Layers, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete } from '@react-google-maps/api';
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

type GroupByField = 'numero_catorcena' | 'articulo' | 'plaza' | 'tipo_de_cara';

interface POIMarker {
  id: string;
  position: { lat: number; lng: number };
  name: string;
  range: number;
}

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
  const [activeGroupings, setActiveGroupings] = useState<GroupByField[]>(['numero_catorcena', 'articulo']);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');

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

    // Ensure numbers to prevent string concatenation
    const total = inventario.reduce((sum, i) => sum + Number(i.caras_totales || 0), 0);
    const inversion = inventario.reduce((sum, i) => sum + (Number(i.tarifa_publica || 0) * Number(i.caras_totales || 1)), 0);

    const bonificadas = data.caras?.reduce((sum, c) => sum + Number(c.bonificacion || 0), 0) || 0;

    return { total: total + bonificadas, renta: total, bonificadas, inversion };
  }, [data, inventario]);

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

  const groupedData = useMemo(() => {
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
  const handleDownloadCSV = () => {
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

  const handleDownloadKML = () => {
    const placemarks = inventario
      .filter(i => i.latitud && i.longitud)
      .map(i => `
        <Placemark>
          <name>${i.codigo_unico}</name>
          <description>Plaza: ${i.plaza || 'N/A'}, Tipo: ${i.tipo_de_cara || 'N/A'}, Caras: ${i.caras_totales}</description>
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

    // IMU Brand Colors
    const IMU_BLUE = [0, 84, 166]; // #0054A6
    const IMU_GREEN = [122, 184, 0]; // #7AB800

    // URL for client view
    const clientViewUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;

    // Helper function for section titles
    const addSectionTitle = (title: string, yPos: number) => {
      doc.setFillColor(IMU_BLUE[0], IMU_BLUE[1], IMU_BLUE[2]);
      doc.rect(marginX, yPos, pageWidth - marginX * 2, 7, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, marginX + 4, yPos + 5);
      return yPos + 12;
    };

    // Helper for compact field rows
    const createFieldRow = (fields: { label: string; value: string }[], yPos: number) => {
      const fieldWidth = (pageWidth - marginX * 2) / fields.length;

      fields.forEach((field, idx) => {
        const x = marginX + (fieldWidth * idx);

        // Field background
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(220, 220, 220);
        doc.rect(x + 1, yPos, fieldWidth - 2, 14, 'FD');

        // Label
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(IMU_BLUE[0], IMU_BLUE[1], IMU_BLUE[2]);
        doc.text(field.label, x + 3, yPos + 4);

        // Value
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(field.value === 'N/A' ? 150 : 40, field.value === 'N/A' ? 150 : 40, field.value === 'N/A' ? 150 : 40);
        const valueText = doc.splitTextToSize(field.value, fieldWidth - 6);
        doc.text(valueText[0] || '', x + 3, yPos + 10);
      });

      return yPos + 18;
    };

    // ========== HEADER ==========
    doc.setFillColor(IMU_BLUE[0], IMU_BLUE[1], IMU_BLUE[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');

    // Green accent line
    doc.setFillColor(IMU_GREEN[0], IMU_GREEN[1], IMU_GREEN[2]);
    doc.rect(0, 20, pageWidth, 2, 'F');

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPUESTA DE CAMPAÑA PUBLICITARIA', pageWidth / 2, 13, { align: 'center' });

    // Date
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaActual, pageWidth - marginX, 8, { align: 'right' });

    // Link to client view
    doc.setTextColor(200, 230, 255);
    const linkText = 'Ver propuesta en línea';
    const linkWidth = doc.getTextWidth(linkText);
    doc.textWithLink(linkText, pageWidth - marginX - linkWidth, 15, { url: clientViewUrl });

    y = 30;

    // ========== INFORMACIÓN DEL CLIENTE ==========
    y = addSectionTitle('INFORMACIÓN DEL CLIENTE', y);

    // Row 1: Cliente, Razón Social, Marca
    y = createFieldRow([
      { label: 'Cliente', value: data?.solicitud?.cliente || 'N/A' },
      { label: 'Razón Social', value: data?.solicitud?.razon_social || 'N/A' },
      { label: 'Marca', value: data?.solicitud?.marca_nombre || 'N/A' },
    ], y);

    // Row 2: Asesor, Agencia, Producto, Categoría
    y = createFieldRow([
      { label: 'Asesor Comercial', value: data?.solicitud?.asesor || 'N/A' },
      { label: 'Agencia', value: data?.solicitud?.agencia || 'N/A' },
      { label: 'Producto', value: data?.solicitud?.producto_nombre || 'N/A' },
      { label: 'Categoría', value: data?.solicitud?.categoria_nombre || 'N/A' },
    ], y);

    y += 5;

    // ========== DATOS DE LA CAMPAÑA ==========
    y = addSectionTitle('DATOS DE LA CAMPAÑA', y);

    // Nombre de campaña
    y = createFieldRow([
      { label: 'Nombre de Campaña', value: data?.cotizacion?.nombre_campania || 'N/A' },
    ], y);

    y += 3;

    // ========== PERIODO DE CAMPAÑA ==========
    y = addSectionTitle('PERIODO DE CAMPAÑA', y);

    // Get catorcena info from propuesta
    const catorcenaInicioStr = data?.propuesta?.catorcena_inicio && data?.propuesta?.anio_inicio
      ? `Catorcena ${data.propuesta.catorcena_inicio} - ${data.propuesta.anio_inicio}`
      : (data?.cotizacion?.fecha_inicio ? formatDate(data.cotizacion.fecha_inicio) : 'N/A');

    const catorcenaFinStr = data?.propuesta?.catorcena_fin && data?.propuesta?.anio_fin
      ? `Catorcena ${data.propuesta.catorcena_fin} - ${data.propuesta.anio_fin}`
      : (data?.cotizacion?.fecha_fin ? formatDate(data.cotizacion.fecha_fin) : 'N/A');

    y = createFieldRow([
      { label: 'Catorcena de Inicio', value: catorcenaInicioStr },
      { label: 'Catorcena de Fin', value: catorcenaFinStr },
    ], y);

    y += 5;

    // ========== RESUMEN DE INVERSIÓN ==========
    y = addSectionTitle('RESUMEN DE INVERSIÓN', y);

    // KPI boxes with colors
    const kpiBoxWidth = (pageWidth - marginX * 2 - 15) / 4;
    const kpiItems = [
      { label: 'Caras Facturadas', value: String(kpis.total), color: IMU_BLUE },
      { label: 'Total de Caras', value: String(kpis.renta), color: [66, 133, 244] },
      { label: 'Caras Bonificadas', value: String(kpis.bonificadas), color: IMU_GREEN },
      { label: 'Inversión Total', value: formatCurrency(kpis.inversion), color: [0, 59, 113] },
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

    // ========== TABLA DE INVENTARIO ==========
    y = addSectionTitle('INVENTARIO RESERVADO', y);

    if (inventario.length > 0) {
      // Only show: Plaza (Ciudad), Ubicación, Formato, Tipo de Cara (as Orientación), Caras, Periodo
      autoTable(doc, {
        head: [['Ciudad', 'Ubicación', 'Formato', 'Orientación', 'Caras', 'Periodo']],
        body: inventario.map(i => [
          i.plaza || '-',
          i.ubicacion || '-',
          i.tipo_de_mueble || '-',
          i.tipo_de_cara || '-',
          String(i.caras_totales || 0),
          formatInicioPeriodo(i),
        ]),
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: [40, 40, 40],
        },
        headStyles: {
          fillColor: [IMU_BLUE[0], IMU_BLUE[1], IMU_BLUE[2]],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 250, 255],
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 80 },
          4: { halign: 'center', cellWidth: 20 },
          5: { cellWidth: 45 },
        },
      });
    }

    // ========== FOOTER ON ALL PAGES ==========
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Footer bar
      doc.setFillColor(IMU_BLUE[0], IMU_BLUE[1], IMU_BLUE[2]);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

      // Green accent
      doc.setFillColor(IMU_GREEN[0], IMU_GREEN[1], IMU_GREEN[2]);
      doc.rect(0, pageHeight - 14, 4, 14, 'F');

      // Footer text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('IMU - Grupo IMU', marginX + 5, pageHeight - 6);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Desarrollado por QEB', marginX + 5, pageHeight - 2);

      // Page number
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
    }

    doc.save(`Propuesta_${data?.cotizacion?.nombre_campania || propuestaId}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Revisa la consola para más detalles.');
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
      setPoiSearch('');
    }
  };

  const toggleGrouping = (field: GroupByField) => {
    if (activeGroupings.includes(field)) setActiveGroupings(activeGroupings.filter(g => g !== field));
    else setActiveGroupings([...activeGroupings, field]);
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const COLORS = ['#0054A6', '#7AB800', '#003B71', '#5FA800', '#0077E6', '#8BC34A']; // IMU Blue & Green palette

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
              {/* Large IMU Logo */}
              <img src="/logo-grupo-imu.png" alt="IMU" className="h-14 w-auto object-contain" />
            </div>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-bold text-[#0054A6]">Propuesta de Campaña</h1>
              <p className="text-sm text-gray-500">Referencia #{propuestaId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadKML} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium shadow-sm transition-colors">
              <Map className="h-4 w-4" /> KML
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
              <span className="font-medium text-gray-700">Inicio:</span> {data?.cotizacion?.fecha_inicio ? formatDate(data.cotizacion.fecha_inicio) : 'N/A'}
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700">Fin:</span> {data?.cotizacion?.fecha_fin ? formatDate(data.cotizacion.fecha_fin) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cliente', value: data?.solicitud?.cliente, icon: '👤' },
            { label: 'Razón Social', value: data?.solicitud?.razon_social, icon: '🏢' },
            { label: 'Marca', value: data?.solicitud?.marca_nombre, icon: '🏷️' },
            { label: 'Asesor', value: data?.solicitud?.asesor, icon: '💼' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{icon}</span>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
              </div>
              <p className="text-sm font-semibold truncate text-[#0054A6]">{value || 'N/A'}</p>
            </div>
          ))}
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

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Caras', value: kpis.total, bg: 'bg-gradient-to-br from-[#0054A6] to-[#003B71]', textColor: 'text-white' },
            { label: 'En Renta', value: kpis.renta, bg: 'bg-gradient-to-br from-blue-500 to-blue-600', textColor: 'text-white' },
            { label: 'Bonificadas', value: kpis.bonificadas, bg: 'bg-gradient-to-br from-[#7AB800] to-[#5FA800]', textColor: 'text-white' },
            { label: 'Inversión Total', value: formatCurrency(kpis.inversion), bg: 'bg-gradient-to-br from-amber-500 to-amber-600', textColor: 'text-white' },
          ].map(({ label, value, bg, textColor }) => (
            <div key={label} className={`${bg} rounded-xl p-5 text-center shadow-lg`}>
              <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
              <p className="text-xs text-white/80 mt-1 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4 bg-gray-50">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0054A6] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-500" />
              {(['numero_catorcena', 'articulo', 'plaza'] as GroupByField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleGrouping(field)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeGroupings.includes(field) ? 'bg-[#0054A6] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {field === 'numero_catorcena' ? 'Catorcena' : field}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-gray-500" />
              <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700">
                <option value="">Sin ordenar</option>
                <option value="plaza">Plaza</option>
                <option value="tipo_de_cara">Tipo</option>
              </select>
            </div>
            <button onClick={handleDownloadCSV} className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-[#7AB800] hover:bg-[#5FA800] text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </button>
          </div>

          <div className="max-h-[500px] overflow-auto">
            {Object.entries(groupedData).map(([groupKey, items]) => (
              <div key={groupKey} className="border-b border-gray-200">
                <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
                  {expandedGroups.has(groupKey) ? <ChevronDown className="h-4 w-4 text-[#0054A6]" /> : <ChevronRight className="h-4 w-4 text-[#0054A6]" />}
                  <span className="text-sm font-medium text-gray-800">{groupKey}</span>
                  <span className="text-xs text-gray-500">({items.length})</span>
                  <span className="ml-auto text-xs font-semibold text-[#0054A6]">{items.reduce((s, i) => s + (Number(i.caras_totales) || 0), 0)} caras</span>
                </button>
                {expandedGroups.has(groupKey) && (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#0054A6]/5 text-xs text-gray-600">
                      <th className="px-4 py-2 text-left font-semibold">Código</th>
                      <th className="px-4 py-2 text-left font-semibold">Plaza</th>
                      <th className="px-4 py-2 text-left font-semibold">Ubicación</th>
                      <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-2 text-center font-semibold">Caras</th>
                      <th className="px-4 py-2 text-right font-semibold">Tarifa</th>
                    </tr></thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs text-[#0054A6] font-medium">{item.codigo_unico}</td>
                          <td className="px-4 py-2 text-gray-700">{item.plaza}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-[200px]">{item.ubicacion}</td>
                          <td className="px-4 py-2 text-gray-600">{item.tipo_de_cara}</td>
                          <td className="px-4 py-2 text-center font-semibold text-gray-800">{item.caras_totales}</td>
                          <td className="px-4 py-2 text-right font-medium text-[#7AB800]">{formatCurrency(item.tarifa_publica || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
            <Map className="h-5 w-5 text-[#0054A6]" />
            <h3 className="text-lg font-semibold text-[#0054A6]">Mapa de Ubicaciones</h3>
            <div className="flex items-center gap-2 ml-auto">
              <select value={searchRange} onChange={(e) => setSearchRange(parseInt(e.target.value))} className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700">
                <option value={100}>100m</option>
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
                onLoad={(map) => { mapRef.current = map; }}
              >
                {inventario.map((item) => (
                  item.latitud && item.longitud && (
                    <Marker
                      key={item.id}
                      position={{ lat: item.latitud, lng: item.longitud }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: IMU_BLUE,
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                      }}
                    />
                  )
                ))}
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
