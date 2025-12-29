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
    if (!inventario) return { total: 0, renta: 0, bonificadas: 0, inversion: 0 };

    // Ensure numbers to prevent string concatenation ("05040")
    const total = inventario.reduce((sum, i) => sum + Number(i.caras_totales || 0), 0);
    const inversion = inventario.reduce((sum, i) => sum + (Number(i.tarifa_publica || 0) * Number(i.caras_totales || 1)), 0);

    // Sum bonifications
    const bonificadas = details?.caras?.reduce((sum, c) => sum + Number(c.bonificacion || 0), 0) || 0;

    // Renta is the count from inventory (allocated)
    const renta = total;

    return { total: total + bonificadas, renta, bonificadas, inversion };
  }, [inventario, details]);

  // Charts data
  const chartCiudades = useMemo(() => {
    if (!inventario) return [];
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const ciudad = i.plaza || 'Sin ciudad';
      counts[ciudad] = (counts[ciudad] || 0) + i.caras_totales;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [inventario]);

  const chartFormatos = useMemo(() => {
    if (!inventario) return [];
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const formato = i.tipo_de_mueble || 'Otros';
      counts[formato] = (counts[formato] || 0) + i.caras_totales;
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

  const handleDownloadKML = () => {
    if (!inventario) return;
    // If items are selected, only export those; otherwise export all
    const itemsToExport = selectedItems.size > 0
      ? inventario.filter(i => selectedItems.has(i.id))
      : inventario;

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
    <name>Reservas Propuesta ${propuestaId}${selectedItems.size > 0 ? ` (${selectedItems.size} seleccionados)` : ''}</name>
    ${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas_propuesta_${propuestaId}.kml`;
    a.click();
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
    const IMU_BLUE_R = 0, IMU_BLUE_G = 84, IMU_BLUE_B = 166; // #0054A6
    const IMU_GREEN_R = 122, IMU_GREEN_G = 184, IMU_GREEN_B = 0; // #7AB800

    // Header with IMU blue
    doc.setFillColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
    doc.rect(0, 0, pageWidth, 25, 'F');

    // Add green accent line
    doc.setFillColor(IMU_GREEN_R, IMU_GREEN_G, IMU_GREEN_B);
    doc.rect(0, 23, pageWidth, 2, 'F');

    // IMU Logo (text placeholder - can be replaced with actual image)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(IMU_GREEN_R, IMU_GREEN_G, IMU_GREEN_B);
    doc.text('IMU', marginX, 15);
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO', marginX, 20);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPUESTA DE CAMPAÑA PUBLICITARIA', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Vista Interna', pageWidth / 2, 18, { align: 'center' });

    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8);
    doc.text(fechaActual, pageWidth - marginX, 8, { align: 'right' });
    doc.text(`Propuesta #${propuestaId}`, pageWidth - marginX, 14, { align: 'right' });

    // Link to client view
    const clientViewUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;
    doc.setTextColor(200, 230, 255);
    const linkText = 'Ver propuesta cliente';
    const linkWidth = doc.getTextWidth(linkText);
    doc.textWithLink(linkText, pageWidth - marginX - linkWidth, 15, { url: clientViewUrl });

    y = 35;

    // Client info section
    doc.setFillColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
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
      doc.setTextColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
      doc.text(`${label}:`, x, y + row * 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(String(value), x + 30, y + row * 7);
    });
    y += 22;

    // Campaign info
    doc.setFillColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('DATOS DE LA PROPUESTA', marginX + 5, y + 5);
    y += 12;

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
    doc.text('Nombre Campaña:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(details?.cotizacion?.nombre_campania || 'N/A', marginX + 40, y);

    if (details?.cotizacion?.fecha_inicio && details?.cotizacion?.fecha_fin) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
      doc.text('Periodo:', marginX + 150, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`${formatDate(details.cotizacion.fecha_inicio)} - ${formatDate(details.cotizacion.fecha_fin)}`, marginX + 170, y);
    }
    y += 8;

    if (details?.propuesta?.descripcion) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
      doc.text('Descripción:', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const desc = doc.splitTextToSize(details.propuesta.descripcion, pageWidth - marginX * 2 - 35);
      doc.text(desc, marginX + 28, y);
      y += desc.length * 5 + 2;
    }
    y += 8;

    // KPIs with colored boxes
    doc.setFillColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('RESUMEN DE MÉTRICAS', marginX + 5, y + 5);
    y += 12;

    const kpiData = [
      { label: 'Total Caras', value: String(kpis.total), color: [139, 92, 246] },
      { label: 'En Renta', value: String(kpis.renta), color: [167, 139, 250] },
      { label: 'Bonificadas', value: String(kpis.bonificadas), color: [192, 132, 252] },
      { label: 'Inversión Total', value: formatCurrency(kpis.inversion), color: [109, 40, 217] },
    ];

    const kpiWidth = (pageWidth - marginX * 2 - 15) / 4;
    kpiData.forEach((kpi, idx) => {
      const x = marginX + idx * (kpiWidth + 5);
      doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.roundedRect(x, y, kpiWidth, 15, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(kpi.label, x + kpiWidth / 2, y + 5, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, x + kpiWidth / 2, y + 12, { align: 'center' });
    });
    y += 25;

    // Table grouped by Catorcena > Artículo
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

      const headers = ['Código', 'Plaza', 'Tipo', 'Formato', 'Caras', 'Ubicación'];
      const tableBody: any[] = [];

      Object.entries(grouped).forEach(([catorcena, articulos]) => {
        // Catorcena header row
        tableBody.push([{ content: `📅 ${catorcena}`, colSpan: 6, styles: { fillColor: [IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } }]);

        Object.entries(articulos).forEach(([articulo, items]) => {
          // Calculate group totals
          const groupCaras = items.reduce((sum, i) => sum + i.caras_totales, 0);
          const groupTarifa = items.reduce((sum, i) => sum + (i.tarifa_publica || 0) * i.caras_totales, 0);

          // Articulo sub-header with tarifa
          tableBody.push([{ content: `📦 ${articulo} | Caras: ${groupCaras} | Inversión: ${formatCurrency(groupTarifa)}`, colSpan: 6, styles: { fillColor: [IMU_GREEN_R, IMU_GREEN_G, IMU_GREEN_B], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } }]);

          // Items in this group
          items.forEach(i => {
            tableBody.push([
              i.codigo_unico || '',
              i.plaza || '',
              i.tipo_de_cara || '',
              i.tipo_de_mueble || '',
              String(i.caras_totales),
              (i.ubicacion || '').substring(0, 40),
            ]);
          });
        });
      });

      autoTable(doc, {
        head: [headers],
        body: tableBody,
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        columnStyles: {
          0: { cellWidth: 35 },
          4: { halign: 'center', cellWidth: 15 },
        },
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(IMU_BLUE_R, IMU_BLUE_G, IMU_BLUE_B);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('IMU - Grupo IMU | Documento generado automáticamente', marginX, pageHeight - 5);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
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
              onClick={handleDownloadKML}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-purple-500/20 text-white rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
            >
              <Map className="h-4 w-4" />
              KML
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

            <button
              onClick={handleDownloadCSV}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-sm shadow-lg shadow-emerald-500/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
          </div>

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
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/50"
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
                      <span className="ml-auto text-xs text-blue-400">
                        {items.reduce((sum, i) => sum + i.caras_totales, 0)} caras
                      </span>
                    </button>
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
                          <th className="px-4 py-2 text-right">Tarifa</th>
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
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/50"
                              />
                            </td>
                            <td className="px-4 py-2 text-blue-300 font-mono text-xs">{item.codigo_unico}</td>
                            <td className="px-4 py-2 text-zinc-300">{item.plaza}</td>
                            <td className="px-4 py-2 text-zinc-400 text-xs truncate max-w-[200px]">{item.ubicacion}</td>
                            <td className="px-4 py-2 text-zinc-300">{item.tipo_de_cara}</td>
                            <td className="px-4 py-2 text-zinc-400">{item.tipo_de_mueble}</td>
                            <td className="px-4 py-2 text-center text-white">{item.caras_totales}</td>
                            <td className="px-4 py-2 text-right text-amber-400">{formatCurrency(item.tarifa_publica || 0)}</td>
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
                onLoad={(map) => { mapRef.current = map; }}
              >
                {inventario?.map((item) => (
                  item.latitud && item.longitud && (
                    <Marker
                      key={item.id}
                      position={{ lat: item.latitud, lng: item.longitud }}
                      onClick={() => setSelectedMarker(item)}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 7,
                        fillColor: item.tipo_de_cara === 'Flujo' ? '#ef4444' : item.tipo_de_cara === 'Contraflujo' ? '#3b82f6' : '#a855f7',
                        fillOpacity: 0.9,
                        strokeColor: '#fff',
                        strokeWeight: 1.5,
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
