import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Share2, Download, FileText, Map, Copy, Check, Loader2,
  ChevronDown, ChevronRight, Filter, ArrowUpDown, Layers, FileSpreadsheet
} from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete } from '@react-google-maps/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { propuestasService, InventarioReservado, PropuestaFullDetails } from '../../services/propuestas.service';
import { formatCurrency, formatDate } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';
const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

// IMU Brand Colors
const IMU_BLUE = '#0054A6';
const IMU_GREEN = '#7AB800';
const IMU_DARK = '#003B71';

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

  // POI states
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');

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
    <name>Reservas Propuesta ${propuestaId}</name>
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

  const handleGeneratePDF = async () => {
    // Dynamic import of jspdf
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFillColor(0, 84, 166); // IMU Blue
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('IMU - PROPUESTA DE CAMPAÑA PUBLICITARIA', pageWidth / 2, 12, { align: 'center' });

    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(9);
    doc.text(fechaActual, pageWidth - marginX, 8, { align: 'right' });

    y = 30;

    // Client info section
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('INFORMACIÓN DEL CLIENTE', marginX + 3, y + 4);
    y += 10;

    const clientFields = [
      ['CUIC', details?.solicitud?.cuic || 'N/A'],
      ['Cliente', details?.solicitud?.cliente || 'N/A'],
      ['Razón Social', details?.solicitud?.razon_social || 'N/A'],
      ['Marca', details?.solicitud?.marca_nombre || 'N/A'],
      ['Asesor', details?.solicitud?.asesor || 'N/A'],
      ['Agencia', details?.solicitud?.agencia || 'N/A'],
    ];

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    clientFields.forEach(([label, value], idx) => {
      const x = marginX + (idx % 3) * 90;
      const row = Math.floor(idx / 3);
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, x, y + row * 6);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), x + 25, y + row * 6);
    });
    y += 20;

    // Campaign info
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('DATOS DE LA PROPUESTA', marginX + 3, y + 4);
    y += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Nombre Campaña:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(details?.cotizacion?.nombre_campania || 'N/A', marginX + 35, y);
    y += 6;

    if (details?.propuesta?.descripcion) {
      doc.setFont('helvetica', 'bold');
      doc.text('Descripción:', marginX, y);
      doc.setFont('helvetica', 'normal');
      const desc = doc.splitTextToSize(details.propuesta.descripcion, pageWidth - marginX * 2 - 30);
      doc.text(desc, marginX + 25, y);
      y += desc.length * 4 + 4;
    }
    y += 10;

    // KPIs
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('MÉTRICAS', marginX + 3, y + 4);
    y += 10;

    const kpiData = [
      ['Total Caras', String(kpis.total)],
      ['En Renta', String(kpis.renta)],
      ['Bonificadas', String(kpis.bonificadas)],
      ['Inversión', formatCurrency(kpis.inversion)],
    ];

    doc.setTextColor(0, 0, 0);
    kpiData.forEach(([label, value], idx) => {
      const x = marginX + idx * 50;
      doc.setFont('helvetica', 'bold');
      doc.text(label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, x, y + 5);
    });
    y += 15;

    // Table
    if (inventario && inventario.length > 0) {
      const headers = ['Código', 'Plaza', 'Tipo', 'Formato', 'Caras', 'Tarifa', 'Periodo'];
      const rows = inventario.map(i => [
        i.codigo_unico || '',
        i.plaza || '',
        i.tipo_de_cara || '',
        i.tipo_de_mueble || '',
        String(i.caras_totales),
        formatCurrency(i.tarifa_publica || 0),
        formatInicioPeriodo(i),
      ]);

      (doc as any).autoTable({
        head: [headers],
        body: rows,
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 7 },
        headStyles: { fillColor: [0, 84, 166] },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 84, 166);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('IMU. desarrollado por QEB', pageWidth / 2, pageHeight - 7, { align: 'center' });

    doc.save(`Propuesta_${propuestaId}.pdf`);
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
  const COLORS = ['#0054A6', '#0066CC', '#0077E6', '#3399FF', '#66B3FF']; // IMU Blue palette

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/propuestas')} className="p-2 hover:bg-zinc-800 rounded-lg">
              <ArrowLeft className="h-5 w-5 text-zinc-400" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-500" />
                <h1 className="text-xl font-bold text-white">Vista Compartir</h1>
              </div>
              <p className="text-sm text-zinc-400">Propuesta #{propuestaId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Enlace'}
            </button>
            <button
              onClick={handleDownloadKML}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Map className="h-4 w-4" />
              KML
            </button>
            <button
              onClick={handleGeneratePDF}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Campaign Header */}
        <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/30 rounded-2xl p-6 border border-blue-500/20">
          <h2 className="text-2xl font-bold text-white mb-2">
            {details?.cotizacion?.nombre_campania || 'Propuesta sin nombre'}
          </h2>
          <p className="text-zinc-400">{details?.propuesta?.descripcion || 'Sin descripción'}</p>
          {details?.propuesta?.notas && (
            <p className="text-sm text-zinc-500 mt-2">Notas: {details.propuesta.notas}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm">
            <span className="text-blue-300">
              Inicio: {details?.cotizacion?.fecha_inicio ? formatDate(details.cotizacion.fecha_inicio) : 'N/A'}
            </span>
            <span className="text-blue-300">
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
            <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="text-sm font-medium text-white truncate">{value || 'N/A'}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Reservas por Ciudad</h3>
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

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Reservas por Tipo</h3>
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
            { label: 'Total Caras', value: kpis.total, color: 'text-white' },
            { label: 'En Renta', value: kpis.renta, color: 'text-blue-400' },
            { label: 'Bonificadas', value: kpis.bonificadas, color: 'text-emerald-400' },
            { label: 'Inversión Total', value: formatCurrency(kpis.inversion), color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Table Controls */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Agrupar:</span>
              {(['numero_catorcena', 'articulo', 'plaza', 'tipo_de_cara'] as GroupByField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleGrouping(field)}
                  className={`px-2 py-1 rounded text-xs ${activeGroupings.includes(field)
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                  {field === 'numero_catorcena' ? 'Catorcena' : field.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-zinc-500" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white"
              >
                <option value="">Sin ordenar</option>
                <option value="codigo_unico">Código</option>
                <option value="plaza">Plaza</option>
                <option value="tipo_de_cara">Tipo</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
          </div>

          {/* Grouped Table */}
          <div className="max-h-[500px] overflow-auto">
            {Object.entries(groupedData).map(([groupKey, items]) => (
              <div key={groupKey} className="border-b border-zinc-800">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-left"
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
                {expandedGroups.has(groupKey) && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-900/50 text-xs text-zinc-500">
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
                        <tr key={idx} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
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
            ))}
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
