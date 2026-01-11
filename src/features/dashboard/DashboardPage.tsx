import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useLoadScript, Circle, InfoWindow } from '@react-google-maps/api';
import { usePrefetch } from '../../hooks/usePrefetch';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import {
  Package,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Lock,
  Filter,
  X,
  TrendingUp,
  Users,
  Calendar,
  Activity,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import {
  dashboardService,
  DashboardFilters,
  ChartData,
  PlazaMapData,
  InventoryCoord,
} from '../../services/dashboard.service';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyB7Bzwydh91xZPdR8mGgqAV2hO72W1EVaw';

// Dark map styles for Google Maps
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1025' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1025' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#6b21a8' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#c084fc' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#a855f7' }, { weight: 2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#7c3aed' }, { weight: 1.5 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#e879f9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2040' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3b3060' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8b5cf6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0a1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#06b6d4' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1030' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a1030' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1030' }] },
];

// Chart colors matching Propuestas/Solicitudes style
const CHART_COLORS = [
  '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const name = data.nombre || data.name || data.label || label;
    const percentage = data.percentage || data.percent;

    return (
      <div className="bg-[#1a1025]/95 border border-purple-500/40 p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[150px] z-[9999]">
        <p className="text-purple-200 font-medium mb-2 text-sm border-b border-purple-500/20 pb-1">{name}</p>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shadow-lg"
            style={{ backgroundColor: data.fill || payload[0].color || '#a855f7' }}
          />
          <div className="flex flex-col">
            <span className="text-white text-lg font-bold">{value?.toLocaleString()}</span>
            {percentage !== undefined && (
              <span className="text-xs text-purple-400">{typeof percentage === 'number' ? percentage.toFixed(1) : percentage}%</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

type EstatusType = 'total' | 'Disponible' | 'Reservado' | 'Vendido' | 'Bloqueado';

// Glass Card Component
function GlassCard({ children, className = '', ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#1a1025]/90 via-[#1e1535]/80 to-[#1a1025]/90 backdrop-blur-xl shadow-xl shadow-purple-900/20 ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none" />
      {children}
    </div>
  );
}

// Filter Select
function FilterSelect({ label, value, onChange, options, placeholder = 'Todos' }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1 block font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-purple-500/30 bg-[#1a1025]/80 px-3 text-sm text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
      >
        <option value="" className="bg-[#1a1025]">{placeholder}</option>
        {options.map((opt) => (<option key={opt} value={opt} className="bg-[#1a1025]">{opt}</option>))}
      </select>
    </div>
  );
}

// KPI Card
function KPICard({ title, value, icon: Icon, color, isActive, onClick, isLoading }: {
  title: string; value: number; icon: React.ElementType;
  color: 'pink' | 'cyan' | 'yellow' | 'green' | 'purple';
  isActive: boolean; onClick: () => void; isLoading: boolean;
}) {
  const colors = {
    pink: { bg: 'from-pink-500/20 to-rose-500/10', border: 'border-pink-500/50', text: 'text-pink-400', glow: 'shadow-pink-500/30' },
    cyan: { bg: 'from-cyan-500/20 to-blue-500/10', border: 'border-cyan-500/50', text: 'text-cyan-400', glow: 'shadow-cyan-500/30' },
    yellow: { bg: 'from-yellow-500/20 to-orange-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
    green: { bg: 'from-green-500/20 to-emerald-500/10', border: 'border-green-500/50', text: 'text-green-400', glow: 'shadow-green-500/30' },
    purple: { bg: 'from-purple-500/20 to-violet-500/10', border: 'border-purple-500/50', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  };
  const c = colors[color];

  return (
    <GlassCard
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isActive ? `bg-gradient-to-br ${c.bg} ${c.border} shadow-lg ${c.glow}` : 'hover:border-purple-400/40'}`}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1 font-medium">{title}</p>
            {isLoading ? <Skeleton className="h-8 w-20 bg-purple-900/30" /> : (
              <p className={`text-3xl font-light ${c.text}`}>{value.toLocaleString()}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${c.bg} ${isActive ? 'ring-2 ring-white/20' : ''}`}>
            <Icon className={`h-6 w-6 ${c.text}`} />
          </div>
        </div>
        {isActive && (
          <div className={`mt-3 text-xs ${c.text} flex items-center gap-1`}>
            <CheckCircle2 className="h-3 w-3" /> Filtro activo
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Google Maps Component with density circles + individual pins
function GoogleMapsChart({
  plazaData,
  allCoords,
  showPins,
  onTogglePins,
  selectedPlaza,
  onSelectPlaza,
  selectedInventoryIds
}: {
  plazaData: PlazaMapData[];
  allCoords: InventoryCoord[];
  showPins: boolean;
  onTogglePins: () => void;
  selectedPlaza: string | null;
  onSelectPlaza: (p: string | null) => void;
  selectedInventoryIds: Set<number>;
}) {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const center = useMemo(() => ({ lat: 23.6345, lng: -102.5528 }), []);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(5);

  // Umbral de zoom para ocultar círculos de densidad (cuando zoom > 7, ocultar círculos)
  const ZOOM_THRESHOLD_HIDE_CIRCLES = 7;

  // Filtrar plazas que tengan coordenadas válidas Y count > 0
  const validPlazas = useMemo(() => plazaData.filter(d => d.lat && d.lng && d.count > 0), [plazaData]);
  const maxCount = Math.max(...validPlazas.map(d => d.count), 1);

  // Color para cada ciudad segun densidad
  const getCircleColor = useCallback((count: number) => {
    const intensity = Math.min(count / maxCount, 1);
    // De púrpura claro a rosa intenso
    if (intensity > 0.7) return { fill: '#ec4899', stroke: '#db2777', opacity: 0.6 };
    if (intensity > 0.4) return { fill: '#d946ef', stroke: '#c026d3', opacity: 0.5 };
    if (intensity > 0.2) return { fill: '#a855f7', stroke: '#9333ea', opacity: 0.4 };
    return { fill: '#8b5cf6', stroke: '#7c3aed', opacity: 0.3 };
  }, [maxCount]);

  // Radio del círculo según cantidad (reducido para mejor visualización)
  const getCircleRadius = useCallback((count: number) => {
    const base = 3000; // 3km base
    const scale = Math.sqrt(count / maxCount);
    return base + (scale * 8000); // hasta 11km máximo
  }, [maxCount]);

  const mapOptions = useMemo(() => ({
    styles: DARK_MAP_STYLES,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  }), []);

  // Filter coords based on selection
  const filteredCoords = useMemo(() => {
    if (selectedInventoryIds.size === 0) {
      return allCoords; // No selection, show all
    }
    return allCoords.filter(coord => selectedInventoryIds.has(coord.id));
  }, [allCoords, selectedInventoryIds]);
// Auto-fit bounds when data changes (allCoords viene filtrado del backend)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // Delay para asegurar que el mapa está renderizado
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;

      // Usar allCoords (ya viene filtrado del backend por ciudad/estado)
      if (allCoords.length > 0) {
        // Limitar a primeros 1000 para calcular bounds más rápido
        const coordsForBounds = allCoords.slice(0, 1000);
        coordsForBounds.forEach(coord => {
          bounds.extend({ lat: coord.lat, lng: coord.lng });
          hasPoints = true;
        });
      }

      if (hasPoints) {
        // Ajustar el mapa a los bounds con padding
        mapRef.current.fitBounds(bounds, {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        });

        // Limitar zoom
        const listener = google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
          const currentZoom = mapRef.current?.getZoom();
          if (currentZoom) {
            if (currentZoom > 14) {
              mapRef.current?.setZoom(14);
            } else if (currentZoom < 4) {
              mapRef.current?.setZoom(4);
            }
          }
        });

        return () => {
          google.maps.event.removeListener(listener);
        };
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [allCoords, mapReady]);

  // Auto-fit bounds when selection changes (checkboxes in table)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (selectedInventoryIds.size === 0) return; // No selection, don't adjust

    // Get coordinates for selected items
    const selectedCoords = allCoords.filter(coord => selectedInventoryIds.has(coord.id));
    if (selectedCoords.length === 0) return;

    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      const bounds = new google.maps.LatLngBounds();
      selectedCoords.forEach(coord => {
        bounds.extend({ lat: coord.lat, lng: coord.lng });
      });

      // Ajustar el mapa a los bounds de los items seleccionados
      mapRef.current.fitBounds(bounds, {
        top: 80,
        right: 80,
        bottom: 80,
        left: 80,
      });

      // Limitar zoom - si hay pocos items, no hacer zoom extremo
      const listener = google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        const currentZoom = mapRef.current?.getZoom();
        if (currentZoom) {
          if (currentZoom > 16) {
            mapRef.current?.setZoom(16); // Más zoom permitido para selección
          } else if (currentZoom < 4) {
            mapRef.current?.setZoom(4);
          }
        }
      });

      return () => {
        google.maps.event.removeListener(listener);
      };
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [selectedInventoryIds, allCoords, mapReady]);

  // Manejar pines con clustering optimizado para rendimiento
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    if (showPins && filteredCoords.length > 0) {
      // Crear marcadores para cada inventario (sin límite)
      const markers = filteredCoords.map(coord => {
        const marker = new google.maps.Marker({
          position: { lat: coord.lat, lng: coord.lng },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 4,
            fillColor: coord.estatus === 'Reservado' ? '#facc15' :
                       coord.estatus === 'Vendido' ? '#06b6d4' :
                       coord.estatus === 'Bloqueado' ? '#f43f5e' : '#22c55e',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 1,
          },
          title: `${coord.plaza} - ${coord.estatus}`,
        });
        return marker;
      });

      markersRef.current = markers;

      // Usar SuperClusterAlgorithm - radio 80 para balance entre agrupación y visibilidad
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers,
        algorithm: new SuperClusterAlgorithm({
          radius: 80,   // Radio moderado para ver más clusters
          maxZoom: 15,  // Nivel máximo de zoom para clustering
        }),
        onClusterClick: (event, cluster, map) => {
          // Al hacer click en un cluster, hacer zoom para ver los markers que contiene
          const bounds = new google.maps.LatLngBounds();
          cluster.markers?.forEach(marker => {
            // Handle both legacy Marker (getPosition) and AdvancedMarkerElement (position)
            const pos = 'getPosition' in marker && typeof marker.getPosition === 'function'
              ? marker.getPosition()
              : (marker as any).position;
            if (pos) bounds.extend(pos);
          });
          map.fitBounds(bounds);
        },
        renderer: {
          render: ({ count, position }) => {
            const color = count > 500 ? '#ec4899' : count > 100 ? '#d946ef' : '#8b5cf6';
            const scale = count > 1000 ? 14 : count > 100 ? 12 : 10;
            return new google.maps.Marker({
              position,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale,
                fillColor: color,
                fillOpacity: 0.85,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
              label: {
                text: count > 999 ? `${(count/1000).toFixed(1)}k` : String(count),
                color: '#fff',
                fontSize: '9px',
                fontWeight: 'bold',
              },
              zIndex: count,
            });
          },
        },
      });
    }

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
    };
  }, [showPins, filteredCoords, isLoaded, allCoords.length]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);

    // Listener para actualizar el nivel de zoom
    map.addListener('zoom_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined) {
        setZoomLevel(currentZoom);
      }
    });
  }, []);

  if (!isLoaded) {
    return (
      <GlassCard className="h-full">
        <div className="p-6"><div className="text-sm text-purple-400 uppercase tracking-wider flex items-center gap-2"><MapPin className="h-4 w-4" /> Mapa de Inventario</div></div>
        <div className="h-[500px] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
      </GlassCard>
    );
  }

  const total = validPlazas.reduce((sum, d) => sum + d.count, 0);

  return (
    <GlassCard className="h-full overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/10">
            <MapPin className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Mapa de Inventario</h3>
            <p className="text-xs text-purple-400/60">{total.toLocaleString()} inventarios en {validPlazas.length} plazas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedInventoryIds.size > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-pink-500/20 text-pink-300 text-xs font-medium border border-pink-500/30">
              {filteredCoords.length} de {allCoords.length.toLocaleString()} pines
            </span>
          )}
          <button
            onClick={onTogglePins}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${showPins
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-lg shadow-pink-500/20'
              : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
            }`}
          >
            {showPins ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showPins ? `Ocultar Pines` : `Mostrar Pines`}
          </button>
        </div>
      </div>
      <div className="h-[500px] relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={5}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {/* Círculos de densidad removidos - solo se muestran los pines/clusters */}

          {/* InfoWindow para plaza seleccionada */}
          {selectedPlaza && validPlazas.find(d => d.plaza === selectedPlaza) && (
            <InfoWindow
              position={{ lat: validPlazas.find(d => d.plaza === selectedPlaza)!.lat!, lng: validPlazas.find(d => d.plaza === selectedPlaza)!.lng! }}
              onCloseClick={() => onSelectPlaza(null)}
            >
              <div className="p-2 min-w-[140px]">
                <p className="font-bold text-gray-800 text-base">{selectedPlaza}</p>
                <p className="text-sm text-gray-600">{validPlazas.find(d => d.plaza === selectedPlaza)?.count.toLocaleString()} inventarios</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-[#1a1025]/95 p-4 rounded-xl border border-purple-500/30 backdrop-blur-sm max-w-[220px]">
          <p className="text-xs text-purple-200 mb-3 font-medium uppercase tracking-wider">Densidad por Plaza</p>
          <div className="space-y-2 mb-4">
            {validPlazas.slice(0, 5).map((plaza, i) => (
              <div
                key={plaza.plaza}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedPlaza === plaza.plaza ? 'bg-purple-500/20 border border-purple-500/40' : 'hover:bg-purple-500/10'}`}
                onClick={() => onSelectPlaza(plaza.plaza)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getCircleColor(plaza.count).fill }}
                />
                <span className="text-xs text-zinc-300 flex-1 truncate">{plaza.plaza}</span>
                <span className="text-xs text-white font-bold">{plaza.count.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Leyenda de colores de pines */}
          {showPins && (
            <>
              <div className="border-t border-purple-500/20 pt-3 mt-3">
                <p className="text-[10px] text-purple-400 mb-2 uppercase tracking-wider">Estatus de Pines</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/><span className="text-zinc-400">Disponible</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"/><span className="text-zinc-400">Reservado</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"/><span className="text-zinc-400">Vendido</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"/><span className="text-zinc-400">Bloqueado</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// Pie Chart for Municipio
function MunicipioPieChart({ data, title }: { data: ChartData[]; title: string }) {
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
    const total = sorted.reduce((sum, item) => sum + item.cantidad, 0);
    return sorted.map((item, index) => ({
      label: item.nombre, name: item.nombre, value: item.cantidad,
      color: CHART_COLORS[index % CHART_COLORS.length], fill: CHART_COLORS[index % CHART_COLORS.length],
      percent: total > 0 ? ((item.cantidad / total) * 100).toFixed(1) : '0',
    }));
  }, [data]);

  return (
    <GlassCard className="h-full">
      <div className="p-4 border-b border-purple-500/20">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4 h-[300px]">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Sin datos</div>
        ) : (
          <div className="w-full h-full flex items-center">
            <div className="h-full w-[160px]">
              <ResponsiveContainer width={160} height={268}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 pl-4 overflow-y-auto max-h-[280px]">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#1e1535]/50 border border-purple-500/10">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{item.value.toLocaleString()}</div>
                    <div className="text-[9px] text-zinc-400 uppercase truncate" title={item.label}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Pie Chart for Tipo
function TipoPieChart({ data, title }: { data: ChartData[]; title: string }) {
  const chartData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.cantidad, 0);
    return data.map((item, index) => ({
      label: item.nombre, name: item.nombre, value: item.cantidad,
      color: index === 0 ? '#06b6d4' : '#ec4899', fill: index === 0 ? '#06b6d4' : '#ec4899',
      percent: total > 0 ? ((item.cantidad / total) * 100).toFixed(1) : '0',
    }));
  }, [data]);

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <GlassCard className="h-full">
      <div className="p-4 border-b border-purple-500/20">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4 h-[300px]">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Sin datos</div>
        ) : (
          <div className="w-full h-full flex items-center">
            <div className="h-full w-[160px] relative">
              <ResponsiveContainer width={160} height={268}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="text-2xl font-bold text-white">{total.toLocaleString()}</span>
                  <span className="block text-[9px] text-purple-400 uppercase">Total</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-3 pl-6 justify-center">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1535]/50 border border-purple-500/10">
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <div className="text-xl font-bold text-white">{item.value.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400">{item.label} ({item.percent}%)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Bar Charts
function HorizontalBarChart({ data, color, title }: { data: ChartData[]; color: string; title: string }) {
  const sortedData = useMemo(() => [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8), [data]);
  const colorHex = { pink: '#ec4899', cyan: '#06b6d4', yellow: '#facc15', green: '#22c55e', purple: '#a855f7' }[color] || '#a855f7';

  return (
    <GlassCard className="h-full">
      <div className="p-4 border-b border-purple-500/20">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: colorHex }} /> {title}
        </h3>
      </div>
      <div className="p-4 h-[300px]">
        {sortedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-purple-300/40">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={268}>
            <BarChart layout="vertical" data={sortedData} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre" tick={{ fill: '#c4b5fd', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
              <RechartsTooltip cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }} content={<CustomTooltip />} />
              <Bar dataKey="cantidad" fill={colorHex} radius={[0, 6, 6, 0]} barSize={20}>
                {sortedData.map((_, index) => (<Cell key={index} fillOpacity={0.7 + (index % 2) * 0.3} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

function SimpleBarChart({ data, title }: { data: ChartData[]; title: string }) {
  return (
    <GlassCard className="h-full">
      <div className="p-4 border-b border-purple-500/20">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4 h-[300px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-purple-300/40">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={268}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="nombre" tick={{ fill: '#c4b5fd', fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }} content={<CustomTooltip />} />
              <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} barSize={40}>
                {data.map((_, index) => (<Cell key={index} fill={index % 2 === 0 ? '#8b5cf6' : '#d946ef'} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

// Inventory Table with Pagination and Checkboxes
function InventoryTable({ data, isLoading, page, totalPages, total, onPageChange, selectedIds, onSelectionChange }: {
  data: any[]; isLoading: boolean; page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
  selectedIds: Set<number>; onSelectionChange: (ids: Set<number>) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleToggleItem = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const handleToggleAll = () => {
    if (data.every(item => selectedIds.has(item.id))) {
      // Deselect all on current page
      const newSet = new Set(selectedIds);
      data.forEach(item => newSet.delete(item.id));
      onSelectionChange(newSet);
    } else {
      // Select all on current page
      const newSet = new Set(selectedIds);
      data.forEach(item => newSet.add(item.id));
      onSelectionChange(newSet);
    }
  };

  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  const allCurrentPageSelected = data.length > 0 && data.every(item => selectedIds.has(item.id));
  const someCurrentPageSelected = data.some(item => selectedIds.has(item.id));

  return (
    <GlassCard className="overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-purple-500/5 transition-colors border-b border-purple-500/20"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/10">
            <Package className="h-4 w-4 text-pink-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Inventario Detallado</h3>
            <p className="text-xs text-purple-400/60">{total.toLocaleString()} inventarios totales</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-medium border border-pink-500/30">
                {selectedIds.size} seleccionados
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleClearSelection(); }}
                className="p-1.5 rounded-lg bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                title="Limpiar selección"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-purple-300">
              <span>Página {page} de {totalPages}</span>
            </div>
          )}
          {expanded ? <ChevronUp className="h-5 w-5 text-purple-400" /> : <ChevronDown className="h-5 w-5 text-purple-400" />}
        </div>
      </div>

      {expanded && (
        <>
          {isLoading ? (
            <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
          ) : (
            <>
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1a1025]/98 backdrop-blur-sm z-10">
                    <tr className="border-b border-purple-500/20">
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          ref={(el) => { if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected; }}
                          onChange={handleToggleAll}
                          className="w-4 h-4 rounded border-purple-500/50 bg-transparent text-pink-500 focus:ring-pink-500/50 focus:ring-offset-0 cursor-pointer"
                        />
                      </th>
                      {['ID', 'Plaza', 'Municipio', 'Mueble', 'Tipo', 'Estatus', 'Cliente'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No hay inventarios</td></tr>
                    ) : (
                      data.map((item, idx) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <tr
                            key={item.id || idx}
                            className={`border-b border-purple-500/10 hover:bg-purple-500/5 transition-colors cursor-pointer ${isSelected ? 'bg-pink-500/10' : ''}`}
                            onClick={() => handleToggleItem(item.id)}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItem(item.id)}
                                className="w-4 h-4 rounded border-purple-500/50 bg-transparent text-pink-500 focus:ring-pink-500/50 focus:ring-offset-0 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-300">{item.codigo_unico || item.id}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white">{item.plaza || '-'}</td>
                            <td className="px-4 py-3 text-sm text-zinc-400">{item.municipio || '-'}</td>
                            <td className="px-4 py-3 text-sm text-zinc-300">{item.mueble || item.tipo_de_mueble || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.tradicional_digital === 'Digital' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'}`}>
                                {item.tradicional_digital || 'Tradicional'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                item.estatus === 'Vendido' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                item.estatus === 'Reservado' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                item.estatus === 'Bloqueado' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                'bg-green-500/20 text-green-300 border border-green-500/30'
                              }`}>
                                {item.estatus || 'Disponible'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-400 truncate max-w-[150px]">{item.cliente_nombre || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-purple-500/20 flex items-center justify-between">
                  <div className="text-xs text-purple-400">
                    Mostrando {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} de {total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onPageChange(page - 1); }}
                      disabled={page === 1}
                      className="p-2 rounded-lg bg-purple-500/10 text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500/20 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (page <= 3) pageNum = i + 1;
                        else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = page - 2 + i;

                        return (
                          <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); onPageChange(pageNum); }}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pageNum === page
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onPageChange(page + 1); }}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg bg-purple-500/10 text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500/20 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </GlassCard>
  );
}

// Catorcena Indicator
function CatorcenaIndicator({ catorcena, filteredCatorcena }: { catorcena: any; filteredCatorcena: any }) {
  const displayCatorcena = filteredCatorcena || catorcena;
  if (!displayCatorcena) return null;

  const isFiltered = filteredCatorcena && filteredCatorcena.id !== catorcena?.id;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-sm ${isFiltered ? 'bg-purple-500/10 border-purple-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
      <Calendar className={`h-4 w-4 ${isFiltered ? 'text-purple-400' : 'text-emerald-400'}`} />
      <div>
        <span className={`text-[10px] font-medium uppercase tracking-wider ${isFiltered ? 'text-purple-400' : 'text-emerald-400'}`}>
          {isFiltered ? 'Catorcena Filtrada' : 'Catorcena Actual'}
        </span>
        <span className="text-white text-sm font-semibold ml-2">Cat. {displayCatorcena.numero} / {displayCatorcena.ano}</span>
      </div>
      {displayCatorcena.fecha_inicio && (
        <span className={`text-xs ${isFiltered ? 'text-purple-400/70' : 'text-emerald-400/70'}`}>
          {new Date(displayCatorcena.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} -
          {new Date(displayCatorcena.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// Main Dashboard Component
export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeEstatus, setActiveEstatus] = useState<EstatusType>('total');
  const [showFilters, setShowFilters] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [selectedPlaza, setSelectedPlaza] = useState<string | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<number>>(new Set());

  // Prefetch todas las vistas al cargar el dashboard
  const { prefetchAll } = usePrefetch();

  useEffect(() => {
    // Precargar datos de todas las vistas en background
    prefetchAll();
  }, [prefetchAll]);

  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard', 'filter-options'],
    queryFn: () => dashboardService.getFilterOptions(),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', 'stats', filters],
    queryFn: () => dashboardService.getStats(filters),
  });

  const { data: estatusStats } = useQuery({
    queryKey: ['dashboard', 'stats', activeEstatus, filters],
    queryFn: () => activeEstatus === 'total' ? Promise.resolve(null) : dashboardService.getStatsByEstatus(activeEstatus, filters),
    enabled: activeEstatus !== 'total',
  });

  const { data: inventoryData, isLoading: loadingInventory } = useQuery({
    queryKey: ['dashboard', 'inventory-detail', filters, activeEstatus, inventoryPage],
    queryFn: () => dashboardService.getInventoryDetail({
      ...filters,
      estatus: activeEstatus !== 'total' ? activeEstatus : undefined,
      page: inventoryPage,
      limit: 50,
    }),
  });

  const { data: activity } = useQuery({ queryKey: ['dashboard', 'activity'], queryFn: () => dashboardService.getRecentActivity() });
  const { data: proximasCatorcenas } = useQuery({ queryKey: ['dashboard', 'catorcenas'], queryFn: () => dashboardService.getUpcomingCatorcenas() });
  const { data: topClientes } = useQuery({ queryKey: ['dashboard', 'top-clientes'], queryFn: () => dashboardService.getTopClientes() });

  const graficas = useMemo(() => activeEstatus !== 'total' && estatusStats ? estatusStats.graficas : stats?.graficas, [activeEstatus, estatusStats, stats]);

  const filteredCatorcena = useMemo(() => {
    if (!filters.catorcena_id || !filterOptions?.catorcenas) return null;
    return filterOptions.catorcenas.find(c => c.id === filters.catorcena_id) || null;
  }, [filters.catorcena_id, filterOptions]);

  const handleClearFilters = () => { setFilters({}); setActiveEstatus('total'); setInventoryPage(1); };
  const hasActiveFilters = filters.estado || filters.ciudad || filters.formato || filters.nse || filters.catorcena_id;

  const handleEstatusChange = (estatus: EstatusType) => { setActiveEstatus(estatus); setInventoryPage(1); };

  return (
    <div className="min-h-screen">
      <Header title="DASHBOARD / HOME" />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg font-light text-white">Resumen de Inventario</h2>
              <CatorcenaIndicator catorcena={filterOptions?.catorcenaActual} filteredCatorcena={filteredCatorcena} />
              {activeEstatus !== 'total' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30">
                  <span className="text-sm text-pink-400 font-medium">{activeEstatus}</span>
                  <button onClick={() => handleEstatusChange('total')} className="text-pink-400 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-2 text-purple-400 hover:text-white">
                  <RotateCcw className="h-4 w-4" /> Limpiar
                </Button>
              )}
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Ocultar' : 'Filtros'}
                {hasActiveFilters && !showFilters && (
                  <span className="ml-1 h-5 w-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center">
                    {Object.values(filters).filter(Boolean).length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {showFilters && (
            <GlassCard>
              <div className="p-4 grid gap-4 md:grid-cols-6">
                <FilterSelect label="Estado" value={filters.estado || ''} onChange={(v) => { setFilters(p => ({ ...p, estado: v || undefined })); setInventoryPage(1); }} options={filterOptions?.estados || []} />
                <FilterSelect label="Ciudad" value={filters.ciudad || ''} onChange={(v) => { setFilters(p => ({ ...p, ciudad: v || undefined })); setInventoryPage(1); }} options={filterOptions?.ciudades || []} placeholder="Todas" />
                <FilterSelect label="Formato" value={filters.formato || ''} onChange={(v) => { setFilters(p => ({ ...p, formato: v || undefined })); setInventoryPage(1); }} options={filterOptions?.formatos || []} />
                <FilterSelect label="NSE" value={filters.nse || ''} onChange={(v) => { setFilters(p => ({ ...p, nse: v || undefined })); setInventoryPage(1); }} options={filterOptions?.nses || []} />
                <div className="md:col-span-2">
                  <label className="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1 block font-medium">Catorcena</label>
                  <select
                    value={filters.catorcena_id?.toString() || ''}
                    onChange={(e) => { setFilters(p => ({ ...p, catorcena_id: e.target.value ? parseInt(e.target.value) : undefined })); setInventoryPage(1); }}
                    className="h-9 w-full rounded-xl border border-purple-500/30 bg-[#1a1025]/80 px-3 text-sm text-white focus:ring-2 focus:ring-pink-500/50"
                  >
                    <option value="" className="bg-[#1a1025]">Todas</option>
                    {filterOptions?.catorcenaActual && (
                      <option value={filterOptions.catorcenaActual.id.toString()} className="bg-[#1a1025] text-pink-400">{filterOptions.catorcenaActual.label}</option>
                    )}
                    <option disabled className="bg-[#1a1025]">──────────</option>
                    {filterOptions?.catorcenas.map((cat) => (<option key={cat.id} value={cat.id.toString()} className="bg-[#1a1025]">{cat.label}</option>))}
                  </select>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5">
          <KPICard title="Total" value={stats?.kpis.total || 0} icon={Package} color="purple" isActive={activeEstatus === 'total'} onClick={() => handleEstatusChange('total')} isLoading={loadingStats} />
          <KPICard title="Disponible" value={stats?.kpis.disponibles || 0} icon={CheckCircle2} color="green" isActive={activeEstatus === 'Disponible'} onClick={() => handleEstatusChange('Disponible')} isLoading={loadingStats} />
          <KPICard title="Reservado" value={stats?.kpis.reservados || 0} icon={Clock} color="yellow" isActive={activeEstatus === 'Reservado'} onClick={() => handleEstatusChange('Reservado')} isLoading={loadingStats} />
          <KPICard title="Vendido" value={stats?.kpis.vendidos || 0} icon={ShoppingCart} color="cyan" isActive={activeEstatus === 'Vendido'} onClick={() => handleEstatusChange('Vendido')} isLoading={loadingStats} />
          <KPICard title="Bloqueado" value={stats?.kpis.bloqueados || 0} icon={Lock} color="pink" isActive={activeEstatus === 'Bloqueado'} onClick={() => handleEstatusChange('Bloqueado')} isLoading={loadingStats} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalBarChart data={graficas?.porMueble || []} color="pink" title="Por Mueble" />
          <TipoPieChart data={graficas?.porTipo || []} title="Por Tipo (Tradicional vs Digital)" />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MunicipioPieChart data={graficas?.porMunicipio || []} title="Por Municipio" />
          <SimpleBarChart data={graficas?.porNSE || []} title="Por Nivel Socioeconómico" />
        </div>

        {/* Map */}
        <GoogleMapsChart
          plazaData={inventoryData?.byPlaza || []}
          allCoords={inventoryData?.allCoords || []}
          showPins={showPins}
          onTogglePins={() => setShowPins(!showPins)}
          selectedPlaza={selectedPlaza}
          onSelectPlaza={setSelectedPlaza}
          selectedInventoryIds={selectedInventoryIds}
        />

        {/* Inventory Table */}
        <InventoryTable
          data={inventoryData?.items || []}
          isLoading={loadingInventory}
          page={inventoryPage}
          totalPages={inventoryData?.pagination.totalPages || 1}
          total={inventoryData?.pagination.total || 0}
          onPageChange={setInventoryPage}
          selectedIds={selectedInventoryIds}
          onSelectionChange={setSelectedInventoryIds}
        />

        {/* Widgets */}
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard>
            <div className="p-4 border-b border-purple-500/20 flex items-center gap-2">
              <Activity className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-medium text-white uppercase tracking-wider">Actividad Reciente</h3>
            </div>
            <div className="p-4 space-y-2">
              {activity?.solicitudes.slice(0, 4).map((sol) => (
                <div key={sol.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-purple-500/10 transition-colors">
                  <div className="h-2 w-2 rounded-full bg-pink-500 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{sol.descripcion}</p>
                    <p className="text-xs text-purple-400/60">{sol.razon_social || 'Sin cliente'} - {sol.status}</p>
                  </div>
                </div>
              ))}
              {!activity?.solicitudes.length && <p className="text-center text-purple-400/60 py-4">Sin actividad</p>}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="p-4 border-b border-purple-500/20 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white uppercase tracking-wider">Próximas Catorcenas</h3>
            </div>
            <div className="p-4 space-y-2">
              {proximasCatorcenas?.slice(0, 5).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-purple-500/10 transition-colors">
                  <div>
                    <p className="text-sm text-white">Cat {cat.numero} - {cat.ano}</p>
                    <p className="text-xs text-purple-400/60">
                      {new Date(cat.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} - {new Date(cat.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-xs text-cyan-400">{Math.ceil((new Date(cat.fecha_inicio).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} días</span>
                </div>
              ))}
              {!proximasCatorcenas?.length && <p className="text-center text-purple-400/60 py-4">Sin catorcenas</p>}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="p-4 border-b border-purple-500/20 flex items-center gap-2">
              <Users className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-white uppercase tracking-wider">Top Clientes</h3>
            </div>
            <div className="p-4 space-y-2">
              {topClientes?.map((cliente, index) => (
                <div key={cliente.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-purple-500/10 transition-colors">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-300 text-black' : index === 2 ? 'bg-orange-600 text-white' : 'bg-purple-800 text-white'}`}>
                    {index + 1}
                  </div>
                  <p className="text-sm text-white flex-1 truncate">{cliente.nombre}</p>
                  <span className="text-sm text-purple-300">{cliente.totalReservas}</span>
                </div>
              ))}
              {!topClientes?.length && <p className="text-center text-purple-400/60 py-4">Sin datos</p>}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
