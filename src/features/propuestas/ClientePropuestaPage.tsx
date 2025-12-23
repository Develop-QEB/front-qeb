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

// IMU Map styles (Dark)
const IMU_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
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
  propuesta: { id: number; status: string; descripcion: string; notas: string; fecha: string };
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
      counts[ciudad] = (counts[ciudad] || 0) + i.caras_totales;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [inventario]);

  const chartFormatos = useMemo(() => {
    const counts: Record<string, number> = {};
    inventario.forEach(i => {
      const formato = i.tipo_de_mueble || 'Otros';
      counts[formato] = (counts[formato] || 0) + i.caras_totales;
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
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header with IMU colors
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

    // Client info
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('INFORMACIÓN DEL CLIENTE', marginX + 3, y + 4);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const clientFields = [
      ['CUIC', data?.solicitud?.cuic],
      ['Cliente', data?.solicitud?.cliente],
      ['Razón Social', data?.solicitud?.razon_social],
      ['Marca', data?.solicitud?.marca_nombre],
    ];
    clientFields.forEach(([label, value], idx) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, marginX + (idx % 4) * 65, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || 'N/A'), marginX + (idx % 4) * 65 + 20, y);
    });
    y += 15;

    // Campaign
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPUESTA', marginX + 3, y + 4);
    y += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Campaña:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data?.cotizacion?.nombre_campania || 'N/A', marginX + 25, y);
    y += 15;

    // KPIs
    doc.setFillColor(0, 84, 166);
    doc.rect(marginX, y, pageWidth - marginX * 2, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('MÉTRICAS', marginX + 3, y + 4);
    y += 10;

    doc.setTextColor(0, 0, 0);
    [['Total', kpis.total], ['Renta', kpis.renta], ['Bonificadas', kpis.bonificadas], ['Inversión', formatCurrency(kpis.inversion)]].forEach(([l, v], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(String(l), marginX + i * 60, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v), marginX + i * 60, y + 5);
    });
    y += 15;

    // Table
    if (inventario.length > 0) {
      (doc as any).autoTable({
        head: [['Código', 'Plaza', 'Tipo', 'Formato', 'Caras', 'Tarifa']],
        body: inventario.map(i => [i.codigo_unico, i.plaza, i.tipo_de_cara, i.tipo_de_mueble, i.caras_totales, formatCurrency(i.tarifa_publica || 0)]),
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

  const COLORS = ['#50277a', '#6b3fa0', '#8b5cf6', '#a78bfa', '#c4b5fd'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <p className="text-red-400">Error al cargar la propuesta</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900 shadow-xl border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
              {/* Use IMU Logo or Icon */}
              <img src="/logo-grupo-imu.png" alt="IMU" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Propuesta de Campaña</h1>
              <p className="text-sm text-zinc-400">#{propuestaId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadKML} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
              <Map className="h-4 w-4" /> KML
            </button>
            <button onClick={handleGeneratePDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Campaign Header */}
        <div className="bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-800">
          <h2 className="text-2xl font-bold mb-2 text-white">
            {data?.cotizacion?.nombre_campania || 'Propuesta'}
          </h2>
          <p className="text-zinc-400">{data?.propuesta?.descripcion || ''}</p>
          <div className="flex gap-4 mt-4 text-sm text-zinc-500">
            <span>Inicio: {data?.cotizacion?.fecha_inicio ? formatDate(data.cotizacion.fecha_inicio) : 'N/A'}</span>
            <span>Fin: {data?.cotizacion?.fecha_fin ? formatDate(data.cotizacion.fecha_fin) : 'N/A'}</span>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cliente', value: data?.solicitud?.cliente },
            { label: 'Razón Social', value: data?.solicitud?.razon_social },
            { label: 'Marca', value: data?.solicitud?.marca_nombre },
            { label: 'Asesor', value: data?.solicitud?.asesor },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="text-sm font-medium truncate text-white">{value || 'N/A'}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4 text-white">Reservas por Ciudad</h3>
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
                    cursor={{ fill: 'rgba(0, 169, 224, 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartCiudades.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-zinc-500 text-center py-10">No hay inventario reservado</p>}
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4 text-white">Reservas por Tipo</h3>
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
                    cursor={{ fill: 'rgba(0, 169, 224, 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartFormatos.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-zinc-500 text-center py-10">No hay inventario reservado</p>}
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

        {/* Table */}
        <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-400" />
              {(['numero_catorcena', 'articulo', 'plaza'] as GroupByField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleGrouping(field)}
                  className={`px-2 py-1 rounded text-xs ${activeGroupings.includes(field) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  {field === 'numero_catorcena' ? 'Catorcena' : field}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-zinc-400" />
              <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white">
                <option value="">Sin ordenar</option>
                <option value="plaza">Plaza</option>
                <option value="tipo_de_cara">Tipo</option>
              </select>
            </div>
            <button onClick={handleDownloadCSV} className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-600/30 rounded-lg text-sm">
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </button>
          </div>

          <div className="max-h-[500px] overflow-auto custom-scrollbar">
            {Object.entries(groupedData).map(([groupKey, items]) => (
              <div key={groupKey} className="border-b border-zinc-800">
                <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center gap-2 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-left transition-colors">
                  {expandedGroups.has(groupKey) ? <ChevronDown className="h-4 w-4 text-blue-400" /> : <ChevronRight className="h-4 w-4 text-blue-400" />}
                  <span className="text-sm font-medium text-white">{groupKey}</span>
                  <span className="text-xs text-zinc-500">({items.length})</span>
                  <span className="ml-auto text-xs text-blue-400">{items.reduce((s, i) => s + i.caras_totales, 0)} caras</span>
                </button>
                {expandedGroups.has(groupKey) && (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-zinc-800/50 text-xs text-zinc-500">
                      <th className="px-4 py-2 text-left">Código</th>
                      <th className="px-4 py-2 text-left">Plaza</th>
                      <th className="px-4 py-2 text-left">Ubicación</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-center">Caras</th>
                      <th className="px-4 py-2 text-right">Tarifa</th>
                    </tr></thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                          <td className="px-4 py-2 font-mono text-xs text-blue-300">{item.codigo_unico}</td>
                          <td className="px-4 py-2 text-zinc-300">{item.plaza}</td>
                          <td className="px-4 py-2 text-zinc-500 text-xs truncate max-w-[200px]">{item.ubicacion}</td>
                          <td className="px-4 py-2 text-zinc-400">{item.tipo_de_cara}</td>
                          <td className="px-4 py-2 text-center font-medium text-white">{item.caras_totales}</td>
                          <td className="px-4 py-2 text-right text-emerald-400">{formatCurrency(item.tarifa_publica || 0)}</td>
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
        <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-4">
            <Map className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-white">Mapa de Ubicaciones</h3>
            <div className="flex items-center gap-2 ml-auto">
              <select value={searchRange} onChange={(e) => setSearchRange(parseInt(e.target.value))} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white">
                <option value={100}>100m</option>
                <option value={300}>300m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
              </select>
              {isLoaded && (
                <Autocomplete onLoad={(ac) => { autocompleteRef.current = ac; }} onPlaceChanged={handlePOIPlaceChanged} options={{ componentRestrictions: { country: 'mx' } }}>
                  <input type="text" value={poiSearch} onChange={(e) => setPoiSearch(e.target.value)} placeholder="Buscar POI..." className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                </Autocomplete>
              )}
              {poiMarkers.length > 0 && (
                <button onClick={() => setPoiMarkers([])} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-500/30">Limpiar</button>
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
                        scale: 7,
                        fillColor: IMU_BLUE,
                        fillOpacity: 0.9,
                        strokeColor: '#fff',
                        strokeWeight: 1.5,
                      }}
                    />
                  )
                ))}
                {poiMarkers.map(marker => (
                  <Circle key={marker.id} center={marker.position} radius={marker.range} options={{ strokeColor: IMU_BLUE, strokeOpacity: 0.7, strokeWeight: 2, fillColor: IMU_BLUE, fillOpacity: 0.15 }} />
                ))}
              </GoogleMap>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-sm text-gray-400">
          IMU - Grupo IMU &copy; {new Date().getFullYear()}
        </div>
      </main>
    </div>
  );
}
