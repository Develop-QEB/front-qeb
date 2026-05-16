import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useRef } from 'react';
import { Map as MapIcon, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, Circle, Autocomplete, InfoWindow } from '@react-google-maps/api';
import { formatCurrency } from '../../lib/utils';

// Config UNICA de Google Maps (mismo id/key/libraries en toda la app) para
// que el script se inyecte una sola vez. Ver src/config/googleMaps.ts.
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../../config/googleMaps';

const IMU_BLUE = '#0054A6';
const IMU_GREEN = '#7AB800';
const IMU_DARK = '#003B71';

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
  tarifa_publica: number | null;
  numero_catorcena?: number | null;
  anio_catorcena?: number | null;
  inicio_periodo?: string | null;
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

async function fetchPublicPropuesta(id: number): Promise<PublicPropuestaData> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await fetch(`${API_URL}/public/propuestas/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export function ClientePropuestaMapPage() {
  const { id } = useParams<{ id: string }>();
  const propuestaId = id ? parseInt(id, 10) : 0;
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [selectedMarker, setSelectedMarker] = useState<InventarioReservado | null>(null);
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [searchRange, setSearchRange] = useState(300);
  const [poiSearch, setPoiSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const { isLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-propuesta', propuestaId],
    queryFn: () => fetchPublicPropuesta(propuestaId),
    enabled: propuestaId > 0,
  });

  const inventario = data?.inventario || [];
  const tipoPeriodo = (data?.cotizacion as any)?.tipo_periodo || 'catorcena';

  const periodoInicio = useMemo(() => {
    if (tipoPeriodo === 'mensual' && data?.cotizacion?.fecha_inicio) {
      const parts = data.cotizacion.fecha_inicio.split('-');
      if (parts.length >= 2) return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    if (data?.propuesta?.catorcena_inicio && data?.propuesta?.anio_inicio) {
      return `Cat ${data.propuesta.catorcena_inicio} / ${data.propuesta.anio_inicio}`;
    }
    const catorcenas = inventario
      .filter(i => i.numero_catorcena && i.anio_catorcena)
      .map(i => ({ num: i.numero_catorcena!, year: i.anio_catorcena! }));
    if (catorcenas.length > 0) {
      const sorted = catorcenas.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);
      return `Cat ${sorted[0].num} / ${sorted[0].year}`;
    }
    return 'N/A';
  }, [data, inventario, tipoPeriodo]);

  const periodoFin = useMemo(() => {
    if (tipoPeriodo === 'mensual' && data?.cotizacion?.fecha_fin) {
      const parts = data.cotizacion.fecha_fin.split('-');
      if (parts.length >= 2) return `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    if (data?.propuesta?.catorcena_fin && data?.propuesta?.anio_fin) {
      return `Cat ${data.propuesta.catorcena_fin} / ${data.propuesta.anio_fin}`;
    }
    const catorcenas = inventario
      .filter(i => i.numero_catorcena && i.anio_catorcena)
      .map(i => ({ num: i.numero_catorcena!, year: i.anio_catorcena! }));
    if (catorcenas.length > 0) {
      const sorted = catorcenas.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);
      const last = sorted[sorted.length - 1];
      return `Cat ${last.num} / ${last.year}`;
    }
    return 'N/A';
  }, [data, inventario, tipoPeriodo]);

  const mapCenter = useMemo(() => {
    if (inventario.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const validItems = inventario.filter(i => i.latitud && i.longitud);
    if (validItems.length === 0) return { lat: 20.6597, lng: -103.3496 };
    const avgLat = validItems.reduce((sum, i) => sum + i.latitud, 0) / validItems.length;
    const avgLng = validItems.reduce((sum, i) => sum + i.longitud, 0) / validItems.length;
    return { lat: avgLat, lng: avgLng };
  }, [inventario]);

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

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/cliente/propuesta/${propuestaId}`;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-green-50/30 text-gray-800 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur shadow-md border-b bg-white/95 border-gray-200">
        <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center">
              <img src="/logo-grupo-imu.png" alt="IMU" className="h-14 w-auto object-contain" />
            </div>
            <div className="border-l pl-4 border-gray-300">
              <h1 className="text-xl font-bold text-[#0054A6]">Propuesta de Campana</h1>
              <p className="text-sm text-gray-500">Referencia #{propuestaId}</p>
            </div>
          </div>

          {/* Campaign & Client Info inline */}
          <div className="hidden md:flex items-center gap-6">
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
            <div className="text-right">
              <p className="text-xs text-gray-500">Marca</p>
              <p className="text-sm font-medium text-gray-800">{data?.solicitud?.marca_nombre || 'N/A'}</p>
            </div>
            <div className="bg-[#7AB800]/10 text-[#7AB800] px-3 py-1 rounded-full text-sm font-medium">
              {data?.propuesta?.status || 'Propuesta'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <a
              href={`/cliente/propuesta/${propuestaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm transition-colors bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
            >
              <ExternalLink className="h-4 w-4" /> Ver Completa
            </a>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-[#0054A6] hover:bg-[#003B71] text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Enlace'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile client info */}
      <div className="md:hidden px-4 py-3 bg-white border-b border-gray-200">
        <p className="text-sm font-semibold text-[#0054A6]">{data?.cotizacion?.nombre_campania || 'Propuesta'}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
          <span>Cliente: <span className="text-gray-800 font-medium">{data?.solicitud?.cliente || 'N/A'}</span></span>
          <span>Marca: <span className="text-gray-800 font-medium">{data?.solicitud?.marca_nombre || 'N/A'}</span></span>
          <span className="bg-[#7AB800]/10 text-[#7AB800] px-2 py-0.5 rounded-full text-xs font-medium">{data?.propuesta?.status}</span>
        </div>
      </div>

      {/* Map - Full remaining height */}
      <div className="flex-1 relative">
        {/* Map toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-4 py-2.5">
          <MapIcon className="h-4 w-4 text-[#0054A6]" />
          <span className="text-sm font-semibold text-[#0054A6]">Mapa de Ubicaciones</span>
          <span className="text-xs text-gray-400 ml-1">({inventario.filter(i => i.latitud && i.longitud).length} puntos)</span>
        </div>

        {/* POI search controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-3 py-2">
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
                    fillColor: String(item.tipo_de_cara).startsWith('Flujo') ? '#ef4444' : String(item.tipo_de_cara).startsWith('Contraflujo') ? '#3b82f6' : IMU_BLUE,
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
                    <p><strong>Formato:</strong> {selectedMarker.mueble || 'N/A'}</p>
                    <p><strong>Ubicacion:</strong> {selectedMarker.ubicacion || 'N/A'}</p>
                    <p><strong>{(selectedMarker.mueble || '').toUpperCase().includes('PUENTE PEATONAL') ? 'Puentes' : 'Caras'}:</strong> {selectedMarker.caras_totales}</p>
                    <p><strong>Tarifa:</strong> {formatCurrency(selectedMarker.tarifa_publica || 0)}</p>
                    {selectedMarker.numero_catorcena && (
                      <p><strong>Periodo:</strong> {tipoPeriodo === 'mensual' && selectedMarker.inicio_periodo ? (() => { const parts = selectedMarker.inicio_periodo!.split('-'); return parts.length >= 2 ? `${MESES_LABEL[parseInt(parts[1]) - 1]} ${parts[0]}` : `Cat ${selectedMarker.numero_catorcena} / ${selectedMarker.anio_catorcena}`; })() : `Cat ${selectedMarker.numero_catorcena} / ${selectedMarker.anio_catorcena}`}</p>
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
  );
}
