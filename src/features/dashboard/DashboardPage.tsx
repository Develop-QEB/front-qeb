import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useLoadScript, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../../config/googleMaps';

import { useSocketDashboard } from '../../hooks/useSocket';
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
  Calendar,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MapPin,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Check,
  Trash2,
  Download,
  Loader2,
  Send,
  Clock3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Header } from '../../components/layout/Header';
import { Skeleton } from '../../components/ui/skeleton';
import { useThemeStore } from '../../store/themeStore';
import { Button } from '../../components/ui/button';
import {
  dashboardService,
  resolveCatorcenaActual,
  DashboardFilters,
  ChartData,
  PlazaMapData,
  InventoryCoord,
  PosteoStats,
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
  LabelList,
} from 'recharts';

// Google Maps API Key
// GOOGLE_MAPS_API_KEY centralizado en src/config/googleMaps.ts
// (config unica para que Google Maps se cargue una sola vez en toda la app).

// Dark map styles for Google Maps
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1025' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0a18' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2d1f3d' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#7c3aed' }, { weight: 2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#6d28d9' }, { weight: 1.5 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d1f3d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3b2d4f' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0a18' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1025' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1a1025' }] },
];

// Light map styles for Google Maps
const LIGHT_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f3f7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b21a8' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e9d5ff' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#a855f7' }, { weight: 2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#c084fc' }, { weight: 1.5 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ede9fe' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b21a8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#ddd6fe' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f3e8ff' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7c3aed' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#f3e8ff' }] },
];

// Chart colors matching Propuestas/Solicitudes style
const CHART_COLORS = [
  '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const name = data.nombre || data.name || data.label || label;
    const percentage = data.percentage || data.percent;

    return (
      <div className={`${isDark ? 'bg-[#1a1025]/95 border-purple-500/20' : 'bg-white/95 border-purple-200'} border p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[150px] z-[9999]`}>
        <p className={`${isDark ? 'text-purple-300 border-purple-500/20' : 'text-purple-700 border-purple-200'} font-medium mb-2 text-sm border-b pb-1`}>{name}</p>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shadow-lg"
            style={{ backgroundColor: data.fill || payload[0].color || '#a855f7' }}
          />
          <div className="flex flex-col">
            <span className={`${isDark ? 'text-white' : 'text-gray-800'} text-lg font-bold`}>{value?.toLocaleString()}</span>
            {percentage !== undefined && (
              <span className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>{typeof percentage === 'number' ? percentage.toFixed(1) : percentage}%</span>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${isDark ? 'border-purple-900/30 bg-[#1a1025]/90 shadow-purple-900/10' : 'border-purple-200/50 bg-white/90 shadow-purple-100/20'} backdrop-blur-xl shadow-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Multi Select Filter (checkbox dropdown — render en portal para evitar overflow:hidden de ancestros)
function MultiSelectFilter({ label, values, onChange, options, placeholder = 'Todos' }: {
  label: string; values: string[]; onChange: (v: string[]) => void; options: string[]; placeholder?: string;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    const handleScrollOrResize = () => updatePosition();
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, updatePosition]);

  const toggle = (opt: string) => {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(s));
  }, [options, search]);

  const display = values.length === 0
    ? placeholder
    : values.length === 1
      ? values[0]
      : `${values.length} seleccionados`;

  return (
    <div className="relative">
      <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider mb-1 block font-medium`}>{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-9 w-full rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white' : 'border-purple-200 bg-gray-50 text-gray-800'} px-3 text-sm flex items-center justify-between gap-2 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all`}
      >
        <span className={`truncate ${values.length === 0 ? (isDark ? 'text-zinc-400' : 'text-gray-400') : ''}`}>{display}</span>
        <span className="flex items-center gap-1">
          {values.length > 0 && (
            <span
              role="button"
              onClick={clearAll}
              className={`p-0.5 rounded hover:bg-purple-500/20 ${isDark ? 'text-zinc-300' : 'text-gray-500'}`}
              aria-label="Limpiar"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && menuRect && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuRect.top, left: menuRect.left, width: menuRect.width, zIndex: 9999 }}
          className={`rounded-xl border ${isDark ? 'border-purple-500/30 bg-[#1a1025] shadow-purple-900/30' : 'border-purple-200 bg-white shadow-purple-100/40'} shadow-2xl backdrop-blur-xl`}
        >
          {options.length > 8 && (
            <div className={`p-2 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-100'}`}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className={`h-7 w-full rounded-lg border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white placeholder:text-zinc-500' : 'border-purple-200 bg-gray-50 text-gray-800 placeholder:text-gray-400'} px-2 text-xs focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all`}
                autoFocus
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className={`px-3 py-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin resultados</div>
            ) : (
              filtered.map((opt) => {
                const checked = values.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-purple-500/10 text-white' : 'hover:bg-purple-50 text-gray-800'}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'bg-purple-500 border-purple-500' : (isDark ? 'border-purple-500/40' : 'border-purple-300')}`}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Color solido de la barrita de proporcion de cada KPI
const PCT_BAR_COLOR: Record<'pink' | 'cyan' | 'yellow' | 'green' | 'purple', string> = {
  pink: '#ec4899',
  cyan: '#06b6d4',
  yellow: '#eab308',
  green: '#22c55e',
  purple: '#a855f7',
};

// KPI Card
function KPICard({ title, value, icon: Icon, color, isActive, onClick, isLoading, total }: {
  title: string; value: number; icon: React.ElementType;
  color: 'pink' | 'cyan' | 'yellow' | 'green' | 'purple';
  isActive: boolean; onClick: () => void; isLoading: boolean;
  // Cuando se pasa `total`, la card muestra el % que este KPI representa sobre
  // el total de inventarios. El KPI "Total" no lo recibe (seria siempre 100%).
  total?: number;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const colors = {
    pink: {
      bg: isDark ? 'from-pink-500/10 to-rose-500/10' : 'from-pink-50 to-rose-50',
      border: isDark ? 'border-pink-500/30' : 'border-pink-300',
      text: isDark ? 'text-pink-300' : 'text-pink-600',
      glow: isDark ? 'shadow-pink-500/10' : 'shadow-pink-100/50',
    },
    cyan: {
      bg: isDark ? 'from-cyan-500/10 to-blue-500/10' : 'from-cyan-50 to-blue-50',
      border: isDark ? 'border-cyan-500/30' : 'border-cyan-300',
      text: isDark ? 'text-cyan-300' : 'text-cyan-600',
      glow: isDark ? 'shadow-cyan-500/10' : 'shadow-cyan-100/50',
    },
    yellow: {
      bg: isDark ? 'from-yellow-500/10 to-orange-500/10' : 'from-yellow-50 to-orange-50',
      border: isDark ? 'border-yellow-500/30' : 'border-yellow-300',
      text: isDark ? 'text-yellow-300' : 'text-yellow-600',
      glow: isDark ? 'shadow-yellow-500/10' : 'shadow-yellow-100/50',
    },
    green: {
      bg: isDark ? 'from-green-500/10 to-emerald-500/10' : 'from-green-50 to-emerald-50',
      border: isDark ? 'border-green-500/30' : 'border-green-300',
      text: isDark ? 'text-green-300' : 'text-green-600',
      glow: isDark ? 'shadow-green-500/10' : 'shadow-green-100/50',
    },
    purple: {
      bg: isDark ? 'from-purple-500/10 to-violet-500/10' : 'from-purple-50 to-violet-50',
      border: isDark ? 'border-purple-500/30' : 'border-purple-300',
      text: isDark ? 'text-purple-300' : 'text-purple-600',
      glow: isDark ? 'shadow-purple-500/10' : 'shadow-purple-100/50',
    },
  };
  const c = colors[color];
  const pct = total && total > 0 ? (value / total) * 100 : null;

  return (
    <GlassCard
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isActive ? `bg-gradient-to-br ${c.bg} ${c.border} shadow-lg ${c.glow}` : `${isDark ? 'hover:border-purple-500/40' : 'hover:border-purple-300'}`}`}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase tracking-wider mb-1 font-medium`}>{title}</p>
            {isLoading ? <Skeleton className={`h-8 w-20 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`} /> : (
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-light ${c.text}`}>{value.toLocaleString()}</p>
                {pct !== null && (
                  <span className={`text-sm font-semibold ${c.text} opacity-80`}>{pct.toFixed(1)}%</span>
                )}
              </div>
            )}
            {/* Barra de proporcion sobre el total */}
            {!isLoading && pct !== null && (
              <div className={`mt-2 h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: PCT_BAR_COLOR[color] }}
                />
              </div>
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
  const { isLoaded } = useLoadScript(GOOGLE_MAPS_LOADER_OPTIONS);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const center = useMemo(() => ({ lat: 23.6345, lng: -102.5528 }), []);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Tope de marcadores creados. El costo real no es agrupar (SuperCluster indexa
  // los puntos una sola vez) sino instanciar google.maps.Marker; por encima de
  // este numero el navegador empieza a sufrir en el render inicial.
  const MAX_MARKERS = 15000;

  // Filtrar plazas que tengan coordenadas validas Y count > 0
  const validPlazas = useMemo(() => plazaData.filter(d => d.lat && d.lng && d.count > 0), [plazaData]);
  const maxCount = Math.max(...validPlazas.map(d => d.count), 1);

  // Color para cada ciudad segun densidad
  const getCircleColor = useCallback((count: number) => {
    const intensity = Math.min(count / maxCount, 1);
    // De purpura claro a rosa intenso
    if (intensity > 0.7) return { fill: '#ec4899', stroke: '#db2777', opacity: 0.6 };
    if (intensity > 0.4) return { fill: '#d946ef', stroke: '#c026d3', opacity: 0.5 };
    if (intensity > 0.2) return { fill: '#a855f7', stroke: '#9333ea', opacity: 0.4 };
    return { fill: '#8b5cf6', stroke: '#7c3aed', opacity: 0.3 };
  }, [maxCount]);

  const mapOptions = useMemo(() => ({
    styles: theme === 'dark' ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  }), [theme]);

  // Filter coords based on selection
  const filteredCoords = useMemo(() => {
    if (selectedInventoryIds.size === 0) {
      return allCoords; // No selection, show all
    }
    return allCoords.filter(coord => selectedInventoryIds.has(coord.id));
  }, [allCoords, selectedInventoryIds]);

  // Antes se recortaba por viewport + zoom >= 11, lo que obligaba a hacer mucho
  // zoom antes de ver nada y ademas recreaba TODOS los markers en cada paneo.
  // Ahora se instancian una sola vez y el clusterer decide que dibujar segun el
  // zoom, asi que hay burbujas visibles desde el nivel pais.
  const markerCoords = useMemo(
    () => (filteredCoords.length > MAX_MARKERS ? filteredCoords.slice(0, MAX_MARKERS) : filteredCoords),
    [filteredCoords]
  );
  const coordsTruncados = filteredCoords.length > MAX_MARKERS;

  // Firma estable del conjunto de plazas (nombre + coord). Cambia cuando cambian
  // los FILTROS (otro set de plazas), pero NO cuando el usuario prende/apaga
  // pines (ahi el back devuelve las mismas plazas). Se usa como unica dependencia
  // del auto-encuadre para que el toggle de pines no reposicione el mapa.
  const plazaSignature = useMemo(
    () => validPlazas.map(p => `${p.plaza}:${p.lat},${p.lng}`).join('|'),
    [validPlazas]
  );

  // Auto-encuadre SOLO cuando cambia el set de plazas (filtros) o al primer
  // render. Antes dependia de allCoords, que se puebla al mostrar pines, y por
  // eso el toggle hacia zoom a CDMX. Ahora encuadra a los centroides de plaza.
  useEffect(() => {
    if (!mapRef.current || !mapReady || validPlazas.length === 0) return;

    // Delay para asegurar que el mapa esta renderizado
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;

      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;
      validPlazas.forEach(plaza => {
        bounds.extend({ lat: plaza.lat!, lng: plaza.lng! });
        hasPoints = true;
      });

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
    // Depende SOLO de plazaSignature (no de allCoords) para que el toggle de
    // pines no vuelva a encuadrar. validPlazas se lee dentro pero su contenido
    // esta capturado por la firma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plazaSignature, mapReady]);

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
            mapRef.current?.setZoom(16); // Mas zoom permitido para seleccion
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

    if (showPins && markerCoords.length > 0) {
      // Se crean una unica vez por cambio de datos; el clusterer se encarga de
      // mostrar/ocultar segun zoom y viewport.
      const markers = markerCoords.map(coord => {
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

      // Usar SuperClusterAlgorithm - radio 80 para balance entre agrupacion y visibilidad
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers,
        algorithm: new SuperClusterAlgorithm({
          radius: 60,   // Radio mas chico = los grupos se abren antes al acercar
          maxZoom: 16,  // A partir de este zoom se ven pines individuales
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
  }, [showPins, markerCoords, isLoaded, mapReady]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  if (!isLoaded) {
    return (
      <GlassCard className="h-full">
        <div className="p-6"><div className={`text-sm uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}><MapPin className="h-4 w-4" /> Mapa de Inventario</div></div>
        <div className="h-[500px] flex items-center justify-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-purple-500' : 'border-purple-600'}`} /></div>
      </GlassCard>
    );
  }

  const total = validPlazas.reduce((sum, d) => sum + d.count, 0);

  return (
    <GlassCard className="h-full overflow-hidden">
      <div className={`p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
            <MapPin className={`h-4 w-4 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>Mapa de Inventario</h3>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{total.toLocaleString()} inventarios en {validPlazas.length} plazas</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showPins && coordsTruncados && (
            <span className={`px-3 py-1.5 rounded-xl text-xs border ${isDark ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
              title={`Se dibujan los primeros ${MAX_MARKERS.toLocaleString()} de ${filteredCoords.length.toLocaleString()}. Filtra por estado o plaza para ver el resto.`}>
              Mostrando {MAX_MARKERS.toLocaleString()} de {filteredCoords.length.toLocaleString()}
            </span>
          )}
          {showPins && !coordsTruncados && selectedInventoryIds.size === 0 && (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-600 border-pink-200'}`}>
              {markerCoords.length.toLocaleString()} pines
            </span>
          )}
          {selectedInventoryIds.size > 0 && (
            <span className={`px-3 py-1.5 rounded-xl ${isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-600 border-pink-200'} text-xs font-medium border`}>
              {filteredCoords.length} de {allCoords.length.toLocaleString()} pines
            </span>
          )}
          <button
            onClick={onTogglePins}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${showPins
              ? `${isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-pink-500/10' : 'bg-pink-50 text-pink-600 border-pink-200 shadow-pink-100/30'} border shadow-lg`
              : `${isDark ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-700' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'} border`
            }`}
          >
            {showPins ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showPins ? `Ocultar Pines` : `Mostrar Pines`}
          </button>
        </div>
      </div>
      <div className="h-[360px] md:h-[500px] relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={5}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {/* Circulos de densidad removidos - solo se muestran los pines/clusters */}

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
        <div className={`absolute bottom-4 left-4 ${isDark ? 'bg-[#1a1025]/95 border-purple-500/20' : 'bg-white/95 border-purple-200'} p-4 rounded-xl border backdrop-blur-sm max-w-[220px] shadow-lg`}>
          <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'} mb-3 font-medium uppercase tracking-wider`}>Densidad por Plaza</p>
          <div className="space-y-2 mb-4">
            {validPlazas.slice(0, 5).map((plaza, i) => (
              <div
                key={plaza.plaza}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedPlaza === plaza.plaza ? `${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-300'} border` : `${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'}`}`}
                onClick={() => onSelectPlaza(plaza.plaza)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getCircleColor(plaza.count).fill }}
                />
                <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-600'} flex-1 truncate`}>{plaza.plaza}</span>
                <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'} font-bold`}>{plaza.count.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Leyenda de colores de pines */}
          {showPins && (
            <>
              <div className={`border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'} pt-3 mt-3`}>
                <p className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} mb-2 uppercase tracking-wider`}>Estatus de Pines</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/><span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Disponible</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"/><span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Reservado</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"/><span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Vendido</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"/><span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>Bloqueado</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// Pie Chart de distribucion generica (top 8) — se usa para "Por Plaza"
function DistribucionPieChart({ data, title }: { data: ChartData[]; title: string }) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  // % calculado sobre el total real (todas las plazas), no solo el top 8.
  const total = useMemo(() => data.reduce((sum, item) => sum + item.cantidad, 0), [data]);
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
    return sorted.map((item, index) => ({
      label: item.nombre, name: item.nombre, value: item.cantidad,
      color: CHART_COLORS[index % CHART_COLORS.length], fill: CHART_COLORS[index % CHART_COLORS.length],
      percent: total > 0 ? ((item.cantidad / total) * 100).toFixed(1) : '0',
    }));
  }, [data, total]);

  return (
    <GlassCard className="h-full">
      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'} flex items-center justify-between gap-2`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'} uppercase tracking-wider`}>{title}</h3>
        {data.length > chartData.length && (
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Top {chartData.length} de {data.length}</span>
        )}
      </div>
      <div className="p-4 h-[300px]">
        {chartData.length === 0 ? (
          <div className={`h-full flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Sin datos</div>
        ) : (
          <div className="w-full h-full flex items-center">
            <div className="h-full w-[160px] relative">
              <ResponsiveContainer width={160} height={268}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{total.toLocaleString()}</span>
                  <span className={`block text-[9px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase`}>Total</span>
                </div>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 pl-4 overflow-y-auto max-h-[280px]">
              {chartData.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-zinc-800/50 border-purple-500/20' : 'bg-gray-50 border-purple-100'} border`}>
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.value.toLocaleString()}</span>
                      <span className={`text-[10px] font-medium ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>{item.percent}%</span>
                    </div>
                    <div className={`text-[9px] ${isDark ? 'text-zinc-400' : 'text-gray-500'} uppercase truncate`} title={item.label}>{item.label}</div>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
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
      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'} uppercase tracking-wider`}>{title}</h3>
      </div>
      <div className="p-4 h-[300px]">
        {chartData.length === 0 ? (
          <div className={`h-full flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-sm`}>Sin datos</div>
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
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{total.toLocaleString()}</span>
                  <span className={`block text-[9px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase`}>Total</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-3 pl-6 justify-center">
              {chartData.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-zinc-800/50 border-purple-500/20' : 'bg-gray-50 border-purple-100'} border`}>
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.value.toLocaleString()}</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{item.label} ({item.percent}%)</div>
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
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const sortedData = useMemo(() => [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8), [data]);
  // Total sobre TODOS los muebles (no solo el top 8) para que el % sea real.
  const totalCantidad = useMemo(() => data.reduce((sum, d) => sum + d.cantidad, 0), [data]);
  const colorHex = { pink: '#ec4899', cyan: '#06b6d4', yellow: '#facc15', green: '#22c55e', purple: '#a855f7' }[color] || '#a855f7';

  return (
    <GlassCard className="h-full">
      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'} uppercase tracking-wider flex items-center gap-2`}>
          <TrendingUp className="h-4 w-4" style={{ color: colorHex }} /> {title}
        </h3>
      </div>
      <div className="p-4 h-[300px]">
        {sortedData.length === 0 ? (
          <div className={`h-full flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={268}>
            <BarChart layout="vertical" data={sortedData} margin={{ top: 5, right: 70, left: 60, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre" tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
              <RechartsTooltip cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }} content={<CustomTooltip />} />
              <Bar dataKey="cantidad" fill={colorHex} radius={[0, 6, 6, 0]} barSize={20}>
                {sortedData.map((_, index) => (<Cell key={index} fillOpacity={0.7 + (index % 2) * 0.3} />))}
                {/* Etiqueta al final de cada barra: cantidad + % sobre el total del grafico */}
                <LabelList
                  dataKey="cantidad"
                  position="right"
                  offset={8}
                  fill={isDark ? '#e4e4e7' : '#374151'}
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: unknown) => {
                    const n = Number(v) || 0;
                    return totalCantidad > 0
                      ? `${n.toLocaleString()} (${((n / totalCantidad) * 100).toFixed(1)}%)`
                      : n.toLocaleString();
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

function SimpleBarChart({ data, title }: { data: ChartData[]; title: string }) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  return (
    <GlassCard className="h-full">
      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'} uppercase tracking-wider`}>{title}</h3>
      </div>
      <div className="p-4 h-[300px]">
        {data.length === 0 ? (
          <div className={`h-full flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={268}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="nombre" tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }} content={<CustomTooltip />} />
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
// ============ TIPOS Y CONFIGURACION DE FILTROS INVENTARIO ============
type InvFilterOperator = '=' | '!=' | 'contains' | 'not_contains';

interface InvFilterCondition {
  id: string;
  field: string;
  operator: InvFilterOperator;
  value: string;
}

interface InvFilterFieldConfig {
  field: string;
  label: string;
  type: 'string' | 'number';
}

const INV_FILTER_FIELDS: InvFilterFieldConfig[] = [
  { field: 'codigo_unico', label: 'ID', type: 'string' },
  { field: 'plaza', label: 'Plaza', type: 'string' },
  { field: 'municipio', label: 'Municipio', type: 'string' },
  { field: 'mueble', label: 'Mueble', type: 'string' },
  { field: 'tradicional_digital', label: 'Tipo', type: 'string' },
  { field: 'estatus', label: 'Estatus', type: 'string' },
  { field: 'cliente_nombre', label: 'Cliente', type: 'string' },
];

type InvGroupByField = 'plaza' | 'municipio' | 'estatus' | 'tradicional_digital' | 'mueble';

const INV_AVAILABLE_GROUPINGS: { field: InvGroupByField; label: string }[] = [
  { field: 'plaza', label: 'Plaza' },
  { field: 'municipio', label: 'Municipio' },
  { field: 'estatus', label: 'Estatus' },
  { field: 'tradicional_digital', label: 'Tipo' },
  { field: 'mueble', label: 'Mueble' },
];

const INV_OPERATORS: { value: InvFilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '!=', label: 'Diferente de' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
];

function applyInventoryFilters(data: any[], filters: InvFilterCondition[]): any[] {
  if (filters.length === 0) return data;
  return data.filter(item => {
    return filters.every(filter => {
      const fieldValue = item[filter.field];
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
        default: return true;
      }
    });
  });
}

function InvGroupHeader({ groupName, count, expanded, onToggle, level = 1, isDark }: {
  groupName: string; count: number; expanded: boolean; onToggle: () => void; level?: 1 | 2; isDark: boolean;
}) {
  const isLevel1 = level === 1;
  return (
    <tr
      onClick={onToggle}
      className={`border-b cursor-pointer transition-colors ${
        isLevel1
          ? `${isDark ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' : 'bg-purple-50 border-purple-200/50 hover:bg-purple-100/50'}`
          : `${isDark ? 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/15' : 'bg-fuchsia-50/50 border-fuchsia-100 hover:bg-fuchsia-50'}`
      }`}
    >
      <td colSpan={8} className={`px-5 py-3 ${isLevel1 ? '' : 'pl-10'}`}>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${isLevel1 ? 'text-purple-500' : 'text-fuchsia-400'}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${isLevel1 ? 'text-purple-500' : 'text-fuchsia-400'}`} />
          )}
          <span className={`font-semibold ${isLevel1 ? `${isDark ? 'text-white' : 'text-gray-800'}` : `${isDark ? 'text-zinc-300' : 'text-gray-600'} text-sm`}`}>
            {groupName || 'Sin asignar'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            isLevel1 ? `${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}` : `${isDark ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-600'}`
          }`}>
            {count}
          </span>
        </div>
      </td>
    </tr>
  );
}

function InventoryTable({ data, isLoading, page, totalPages, total, onPageChange, selectedIds, onSelectionChange, filters, activeEstatus }: {
  data: any[]; isLoading: boolean; page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
  selectedIds: Set<number>; onSelectionChange: (ids: Set<number>) => void;
  filters?: DashboardFilters; activeEstatus?: string;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  // Filter/Group/Sort state
  const [invFilters, setInvFilters] = useState<InvFilterCondition[]>([]);
  const [showInvFilterPopup, setShowInvFilterPopup] = useState(false);
  const [invGroupings, setInvGroupings] = useState<InvGroupByField[]>([]);
  const [showInvGroupPopup, setShowInvGroupPopup] = useState(false);
  const [invSortField, setInvSortField] = useState<string | null>(null);
  const [invSortDirection, setInvSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showInvSortPopup, setShowInvSortPopup] = useState(false);
  const [invExpandedGroups, setInvExpandedGroups] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [loadingAllPages, setLoadingAllPages] = useState(false);

  const handleToggleItem = (id: number) => {
    setSelectAllPages(false);
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    onSelectionChange(newSet);
  };

  const handleClearSelection = () => { setSelectAllPages(false); onSelectionChange(new Set()); };

  // Filter functions
  const addInvFilter = useCallback(() => {
    setInvFilters(prev => [...prev, { id: `filter-${Date.now()}`, field: INV_FILTER_FIELDS[0].field, operator: '=', value: '' }]);
  }, []);
  const updateInvFilter = useCallback((id: string, updates: Partial<InvFilterCondition>) => {
    setInvFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);
  const removeInvFilter = useCallback((id: string) => {
    setInvFilters(prev => prev.filter(f => f.id !== id));
  }, []);
  const clearInvFilters = useCallback(() => setInvFilters([]), []);
  const toggleInvGrouping = useCallback((field: InvGroupByField) => {
    setInvGroupings(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field);
      if (prev.length >= 2) return [prev[1], field];
      return [...prev, field];
    });
  }, []);
  const toggleInvGroup = (groupName: string) => {
    setInvExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
      return next;
    });
  };
  const hasInvActiveFilters = invFilters.length > 0 || invGroupings.length > 0 || invSortField !== null;
  const clearAllInvFilters = () => {
    setInvFilters([]); setInvGroupings([]); setInvSortField(null); setInvSortDirection('asc'); setInvExpandedGroups(new Set());
  };

  // Unique values for autocomplete
  const invUniqueValues = useMemo(() => {
    const valuesMap: Record<string, string[]> = {};
    INV_FILTER_FIELDS.forEach(fc => {
      const values = new Set<string>();
      data.forEach(item => {
        const val = item[fc.field];
        if (val !== null && val !== undefined && val !== '') values.add(String(val));
      });
      valuesMap[fc.field] = Array.from(values).sort();
    });
    return valuesMap;
  }, [data]);

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let result = applyInventoryFilters(data, invFilters);
    if (invSortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[invSortField]; const bVal = b[invSortField];
        if (aVal === null || aVal === undefined) return invSortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return invSortDirection === 'asc' ? -1 : 1;
        const comparison = String(aVal).localeCompare(String(bVal));
        return invSortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [data, invFilters, invSortField, invSortDirection]);

  const downloadCSV = useCallback(async () => {
    const generateCSV = (items: any[]) => {
      const headers = ['Codigo', 'Plaza', 'Municipio', 'Mueble', 'Tipo', 'Estatus', 'Cliente', 'CUIC', 'Marca', 'ID', 'Nombre', 'APS'];
      const rows = items.map(item => [
        item.codigo_unico || item.id,
        item.plaza || '',
        item.municipio || '',
        item.mueble || '',
        item.tradicional_digital || 'Tradicional',
        item.estatus || 'Disponible',
        item.cliente || '',
        item.cuic || '',
        item.marca || '',
        item.propuesta_id || '',
        item.nombre_campania || '',
        item.APS || '',
      ]);
      return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    };

    let csvContent: string;
    if (selectAllPages) {
      setLoadingAllPages(true);
      try {
        const allData = await dashboardService.getInventoryDetail({
          ...filters,
          estatus: activeEstatus && activeEstatus !== 'total' ? activeEstatus : undefined,
          page: 1,
          limit: total,
          includeCoords: false,
        });
        csvContent = generateCSV(allData.items);
      } catch (err) {
        console.error('Error al descargar:', err);
        return;
      } finally {
        setLoadingAllPages(false);
      }
    } else {
      const selected = filteredData.filter(item => selectedIds.has(item.id));
      if (selected.length === 0) return;
      csvContent = generateCSV(selected);
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredData, selectedIds, selectAllPages, filters, activeEstatus, total]);

  const downloadAllCSV = useCallback(async () => {
    setLoadingAllPages(true);
    try {
      const allData = await dashboardService.getInventoryDetail({
        ...filters,
        estatus: activeEstatus && activeEstatus !== 'total' ? activeEstatus : undefined,
        page: 1,
        limit: total,
        includeCoords: false,
      });
      const items = allData.items;
      if (items.length === 0) return;
      const headers = ['Codigo', 'Plaza', 'Municipio', 'Mueble', 'Tipo de Mueble', 'Tipo', 'Estatus', 'Cliente', 'CUIC', 'Marca', 'ID', 'Nombre', 'APS'];
      const rows = items.map((item: any) => [
        item.codigo_unico || item.id,
        item.plaza || '',
        item.municipio || '',
        item.mueble || '',
        item.tipo_de_mueble || '',
        item.tradicional_digital || 'Tradicional',
        item.estatus || 'Disponible',
        item.cliente || '',
        item.cuic || '',
        item.marca || '',
        item.propuesta_id || '',
        item.nombre_campania || '',
        item.APS || '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_detallado_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar todos:', err);
    } finally {
      setLoadingAllPages(false);
    }
  }, [filters, activeEstatus, total]);

  // Grouped data (up to 2 levels)
  interface InvGroupedLevel1 { name: string; items: any[]; subgroups?: { name: string; items: any[] }[] }
  const groupedData = useMemo((): InvGroupedLevel1[] | null => {
    if (invGroupings.length === 0) return null;
    const gk1 = invGroupings[0];
    const gk2 = invGroupings.length > 1 ? invGroupings[1] : null;
    const groups: Record<string, any[]> = {};
    filteredData.forEach(item => {
      const key = String(item[gk1] || 'Sin asignar');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const sortGroups = (entries: [string, any[]][]) => {
      if (invSortField) return entries.sort((a, b) => invSortDirection === 'asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]));
      return entries.sort((a, b) => b[1].length - a[1].length);
    };
    return sortGroups(Object.entries(groups)).map(([name, items]) => {
      if (gk2) {
        const subMap: Record<string, any[]> = {};
        items.forEach(item => {
          const sk = String(item[gk2] || 'Sin asignar');
          if (!subMap[sk]) subMap[sk] = [];
          subMap[sk].push(item);
        });
        const subgroups = sortGroups(Object.entries(subMap)).map(([sn, si]) => ({ name: sn, items: si }));
        return { name, items, subgroups };
      }
      return { name, items };
    });
  }, [filteredData, invGroupings, invSortField, invSortDirection]);

  const handleToggleAll = () => {
    const displayItems = filteredData;
    if (displayItems.every(item => selectedIds.has(item.id))) {
      setSelectAllPages(false);
      const newSet = new Set(selectedIds);
      displayItems.forEach(item => newSet.delete(item.id));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      displayItems.forEach(item => newSet.add(item.id));
      onSelectionChange(newSet);
    }
  };

  const handleSelectAllPages = async () => {
    setLoadingAllPages(true);
    try {
      const allData = await dashboardService.getInventoryDetail({
        ...filters,
        estatus: activeEstatus && activeEstatus !== 'total' ? activeEstatus : undefined,
        page: 1,
        limit: total,
        includeCoords: false,
      });
      const allIds = new Set<number>(allData.items.map((item: any) => item.id));
      onSelectionChange(allIds);
      setSelectAllPages(true);
    } catch (err) {
      console.error('Error al seleccionar todos:', err);
    } finally {
      setLoadingAllPages(false);
    }
  };

  const allCurrentPageSelected = filteredData.length > 0 && filteredData.every(item => selectedIds.has(item.id));
  const someCurrentPageSelected = filteredData.some(item => selectedIds.has(item.id));

  // Row renderer
  const renderRow = (item: any, idx: number) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <tr
        key={item.id || idx}
        className={`border-b ${isDark ? 'border-purple-900/20 hover:bg-purple-500/10' : 'border-purple-100 hover:bg-purple-50/50'} transition-colors cursor-pointer ${isSelected ? `${isDark ? 'bg-pink-500/10' : 'bg-pink-50'}` : ''}`}
        onClick={() => handleToggleItem(item.id)}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => handleToggleItem(item.id)}
            className={`w-4 h-4 rounded ${isDark ? 'border-purple-500/30' : 'border-purple-300'} bg-transparent text-purple-600 focus:ring-purple-500/30 focus:ring-offset-0 cursor-pointer`} />
        </td>
        <td className="px-4 py-3">
          <span className={`font-mono text-xs px-2 py-1 rounded-md ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-600'}`}>{item.codigo_unico || item.id}</span>
        </td>
        <td className={`px-4 py-3 text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.plaza || '-'}</td>
        <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{item.municipio || '-'}</td>
        <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
          {item.mueble || '-'}
          {item.tipo_de_mueble && item.tipo_de_mueble?.toUpperCase() !== item.mueble?.toUpperCase() && (
            <span className={`block text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.tipo_de_mueble}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.tradicional_digital === 'Digital' ? `${isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200'} border` : `${isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-700 border-pink-200'} border`}`}>
            {item.tradicional_digital || 'Tradicional'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            item.estatus === 'Vendido' ? `${isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200'} border` :
            item.estatus === 'Reservado' ? `${isDark ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200'} border` :
            item.estatus === 'Bloqueado' ? `${isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200'} border` :
            `${isDark ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200'} border`
          }`}>
            {item.estatus || 'Disponible'}
          </span>
        </td>
        <td className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} truncate max-w-[150px]`}>{item.cliente_nombre || '-'}</td>
        {/* Columna APS oculta por el momento
        <td className="px-4 py-3">
          {item.APS ? (
            <span
              onClick={(e) => { e.stopPropagation(); if (item.campana_id) navigate(`/campanas/detail/${item.campana_id}`); }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} ${item.campana_id ? 'cursor-pointer hover:opacity-75' : ''}`}
            >{item.APS}</span>
          ) : (
            <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>-</span>
          )}
        </td>
        */}
      </tr>
    );
  };

  return (
    <GlassCard className="overflow-hidden">
      <div
        className={`p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50/50'} transition-colors border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-pink-500/10' : 'bg-pink-50'}`}>
            <Package className={`h-4 w-4 ${isDark ? 'text-pink-300' : 'text-pink-600'}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>Inventario Detallado</h3>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{total.toLocaleString()} inventarios totales</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); downloadAllCSV(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 border-pink-500/20' : 'bg-pink-50 text-pink-600 hover:bg-pink-100 border-pink-200'} border transition-colors`}
            title="Descargar tabla completa como CSV"
          >
            <Download className="h-3.5 w-3.5" />
            {loadingAllPages ? 'Cargando...' : `Exportar CSV (${total.toLocaleString()})`}
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full ${isDark ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-50 text-pink-600 border-pink-200'} text-xs font-medium border`}>
                {selectAllPages ? total.toLocaleString() : selectedIds.size} seleccionados
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); downloadCSV(); }}
                disabled={loadingAllPages}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'} transition-colors disabled:opacity-50`}
                title="Descargar CSV"
              >
                <Download className="h-3.5 w-3.5" />
                {loadingAllPages ? 'Cargando...' : 'Descargar CSV'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClearSelection(); }}
                className={`p-1.5 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200'} transition-colors`}
                title="Limpiar seleccion"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {!isLoading && totalPages > 1 && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              <span>Pagina {page} de {totalPages}</span>
            </div>
          )}
          {expanded ? <ChevronUp className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} /> : <ChevronDown className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />}
        </div>
      </div>

      {expanded && (
        <>
          {/* Toolbar: Filtrar, Agrupar, Ordenar */}
          <div className={`px-4 py-2 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'} flex items-center justify-between gap-2 relative z-[45]`}>
            <div className="flex items-center gap-2">
              {/* Filtros */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInvFilterPopup(!showInvFilterPopup); }}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    invFilters.length > 0 ? 'bg-purple-600 text-white' : `${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-purple-500/20 text-purple-300' : 'bg-gray-100 hover:bg-gray-200 border-purple-200 text-purple-600'} border`
                  }`}
                  title="Filtrar"
                >
                  <Filter className="h-3.5 w-3.5" />
                  {invFilters.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white px-0.5">
                      {invFilters.length}
                    </span>
                  )}
                </button>
                {showInvFilterPopup && (
                  <div className={`absolute left-0 top-full mt-1 z-[60] w-[520px] max-w-[calc(100vw-2rem)] ${isDark ? 'bg-[#1a1025] border-purple-500/20' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Filtros de busqueda</span>
                      <button onClick={() => setShowInvFilterPopup(false)} className={`${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {invFilters.map((filter, index) => (
                        <div key={filter.id} className="flex items-center gap-2">
                          {index > 0 && <span className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} font-medium w-8`}>AND</span>}
                          {index === 0 && <span className="w-8"></span>}
                          <select value={filter.field} onChange={(e) => updateInvFilter(filter.id, { field: e.target.value })}
                            className={`w-[130px] text-xs ${isDark ? 'bg-zinc-800/50 border-purple-500/20 text-white' : 'bg-gray-50 border-purple-200 text-gray-800'} border rounded px-2 py-1.5`}>
                            {INV_FILTER_FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
                          </select>
                          <select value={filter.operator} onChange={(e) => updateInvFilter(filter.id, { operator: e.target.value as InvFilterOperator })}
                            className={`w-[110px] text-xs ${isDark ? 'bg-zinc-800/50 border-purple-500/20 text-white' : 'bg-gray-50 border-purple-200 text-gray-800'} border rounded px-2 py-1.5`}>
                            {INV_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                          </select>
                          <input type="text" list={`inv-datalist-${filter.id}`} value={filter.value}
                            onChange={(e) => updateInvFilter(filter.id, { value: e.target.value })}
                            placeholder="Escribe o selecciona..."
                            className={`flex-1 text-xs ${isDark ? 'bg-zinc-800/50 border-purple-500/20 text-white placeholder:text-zinc-500' : 'bg-gray-50 border-purple-200 text-gray-800 placeholder:text-gray-400'} border rounded px-2 py-1.5 focus:outline-none focus:border-purple-500`} />
                          <datalist id={`inv-datalist-${filter.id}`}>
                            {invUniqueValues[filter.field]?.map(val => <option key={val} value={val} />)}
                          </datalist>
                          <button onClick={() => removeInvFilter(filter.id)} className={`p-0.5 ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600'}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {invFilters.length === 0 && (
                        <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center py-3`}>Sin filtros. Haz clic en "Anadir".</p>
                      )}
                    </div>
                    <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                      <button onClick={addInvFilter} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                        <Plus className="h-3 w-3" /> Anadir
                      </button>
                      <button onClick={clearInvFilters} disabled={invFilters.length === 0}
                        className={`px-2 py-1 text-xs font-medium border rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30 border-red-500/30' : 'text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
                        Limpiar
                      </button>
                    </div>
                    {invFilters.length > 0 && (
                      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                        <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{filteredData.length} de {data.length} registros</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Agrupar */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInvGroupPopup(!showInvGroupPopup); }}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    invGroupings.length > 0 ? 'bg-purple-600 text-white' : `${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-purple-500/20 text-purple-300' : 'bg-gray-100 hover:bg-gray-200 border-purple-200 text-purple-600'} border`
                  }`}
                  title="Agrupar"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {invGroupings.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white px-0.5">
                      {invGroupings.length}
                    </span>
                  )}
                </button>
                {showInvGroupPopup && (
                  <div className={`absolute left-0 top-full mt-1 z-[60] ${isDark ? 'bg-[#1a1025] border-purple-500/20' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-2 min-w-[180px]`}>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wide px-2 py-1`}>Agrupar por (max 2)</p>
                    {INV_AVAILABLE_GROUPINGS.map(({ field, label }) => (
                      <button key={field} onClick={() => toggleInvGrouping(field)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'} transition-colors ${
                          invGroupings.includes(field) ? `${isDark ? 'text-purple-300' : 'text-purple-600'}` : `${isDark ? 'text-zinc-400' : 'text-gray-500'}`
                        }`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          invGroupings.includes(field) ? 'bg-purple-600 border-purple-600' : `${isDark ? 'border-purple-500/30' : 'border-purple-300'}`
                        }`}>
                          {invGroupings.includes(field) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        {label}
                        {invGroupings.indexOf(field) === 0 && <span className={`ml-auto text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>1</span>}
                        {invGroupings.indexOf(field) === 1 && <span className={`ml-auto text-[10px] ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>2</span>}
                      </button>
                    ))}
                    <div className={`border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'} mt-2 pt-2`}>
                      <button onClick={() => setInvGroupings([])} className={`w-full text-xs ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'} py-1`}>
                        Quitar agrupacion
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ordenar */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInvSortPopup(!showInvSortPopup); }}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    invSortField ? 'bg-purple-600 text-white' : `${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-purple-500/20 text-purple-300' : 'bg-gray-100 hover:bg-gray-200 border-purple-200 text-purple-600'} border`
                  }`}
                  title="Ordenar"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
                {showInvSortPopup && (
                  <div className={`absolute left-0 top-full mt-1 z-[60] w-[300px] ${isDark ? 'bg-[#1a1025] border-purple-500/20' : 'bg-white border-purple-200'} border rounded-lg shadow-xl p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Ordenar por</span>
                      <button onClick={() => setShowInvSortPopup(false)} className={`${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-1">
                      {INV_FILTER_FIELDS.map(field => (
                        <div key={field.field}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                            invSortField === field.field ? `${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border` : `${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'}`
                          }`}>
                          <span className={invSortField === field.field ? `${isDark ? 'text-purple-300' : 'text-purple-600'} font-medium` : `${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>{field.label}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setInvSortField(field.field); setInvSortDirection('asc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                invSortField === field.field && invSortDirection === 'asc' ? 'bg-purple-600 text-white' : `${isDark ? 'text-zinc-500 hover:text-white hover:bg-purple-500/10' : 'text-gray-400 hover:text-gray-700 hover:bg-purple-100'}`
                              }`} title="Ascendente (A-Z)">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { setInvSortField(field.field); setInvSortDirection('desc'); }}
                              className={`p-1.5 rounded transition-colors ${
                                invSortField === field.field && invSortDirection === 'desc' ? 'bg-purple-600 text-white' : `${isDark ? 'text-zinc-500 hover:text-white hover:bg-purple-500/10' : 'text-gray-400 hover:text-gray-700 hover:bg-purple-100'}`
                              }`} title="Descendente (Z-A)">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {invSortField && (
                      <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                        <button onClick={() => { setInvSortField(null); setInvSortDirection('asc'); }}
                          className={`w-full px-2 py-1 text-xs font-medium border rounded transition-colors ${isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30 border-red-500/30' : 'text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
                          Quitar ordenamiento
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Limpiar todo */}
              {hasInvActiveFilters && (
                <button onClick={(e) => { e.stopPropagation(); clearAllInvFilters(); }}
                  className={`flex items-center justify-center w-8 h-8 ${isDark ? 'text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 border-gray-200'} rounded-lg border transition-colors`}
                  title="Limpiar filtros">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Info badge */}
            {hasInvActiveFilters && (
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${isDark ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-600'} border text-[10px]`}>
                <Filter className="h-3 w-3" />
                {filteredData.length} resultados
                {invGroupings.length > 0 && (
                  <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>
                    | Agrupado por {invGroupings.map(g => INV_AVAILABLE_GROUPINGS.find(ag => ag.field === g)?.label).join(' -> ')}
                  </span>
                )}
                {invSortField && (
                  <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>| Ordenado por {INV_FILTER_FIELDS.find(f => f.field === invSortField)?.label} ({invSortDirection === 'asc' ? '\u2191' : '\u2193'})</span>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 flex justify-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-purple-500' : 'border-purple-600'}`} /></div>
          ) : (
            <>
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full min-w-[900px]">
                  <thead className={`sticky top-0 ${isDark ? 'bg-[#1a1025]/98' : 'bg-white/98'} backdrop-blur-sm z-10`}>
                    <tr className={`border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'}`}>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          ref={(el) => { if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected; }}
                          onChange={handleToggleAll}
                          className={`w-4 h-4 rounded ${isDark ? 'border-purple-500/30' : 'border-purple-300'} bg-transparent text-purple-600 focus:ring-purple-500/30 focus:ring-offset-0 cursor-pointer`}
                        />
                      </th>
                      {/* Columna APS oculta por el momento (tambien su <td> y los colSpan) */}
                      {['ID', 'Plaza', 'Municipio', 'Mueble', 'Tipo', 'Estatus', 'Cliente'].map((h) => (
                        <th key={h} className={`px-4 py-3 text-left text-[10px] font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'} uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={8} className={`px-4 py-8 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>No hay inventarios</td></tr>
                    ) : groupedData ? (
                      groupedData.map(group => (
                        <React.Fragment key={`group-${group.name}`}>
                          <InvGroupHeader groupName={group.name} count={group.items.length}
                            expanded={invExpandedGroups.has(group.name)} onToggle={() => toggleInvGroup(group.name)} level={1} isDark={isDark} />
                          {invExpandedGroups.has(group.name) && (
                            group.subgroups ? (
                              group.subgroups.map(subgroup => (
                                <React.Fragment key={`sub-${group.name}-${subgroup.name}`}>
                                  <InvGroupHeader groupName={subgroup.name} count={subgroup.items.length}
                                    expanded={invExpandedGroups.has(`${group.name}|${subgroup.name}`)}
                                    onToggle={() => toggleInvGroup(`${group.name}|${subgroup.name}`)} level={2} isDark={isDark} />
                                  {invExpandedGroups.has(`${group.name}|${subgroup.name}`) &&
                                    subgroup.items.map((item, idx) => renderRow(item, idx))}
                                </React.Fragment>
                              ))
                            ) : group.items.map((item, idx) => renderRow(item, idx))
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredData.map((item, idx) => renderRow(item, idx))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Banner de "Seleccionar todos" */}
              {allCurrentPageSelected && totalPages > 1 && !selectAllPages && (
                <div className={`px-4 py-2 text-center text-xs border-t ${isDark ? 'border-purple-900/30 bg-purple-500/5' : 'border-purple-200/50 bg-purple-50'}`}>
                  <span className={isDark ? 'text-purple-300' : 'text-purple-600'}>
                    {filteredData.length} elementos de esta página seleccionados.
                  </span>
                  {' '}
                  <button
                    onClick={handleSelectAllPages}
                    disabled={loadingAllPages}
                    className={`font-semibold underline underline-offset-2 ${isDark ? 'text-pink-400 hover:text-pink-300' : 'text-pink-600 hover:text-pink-500'} transition-colors`}
                  >
                    {loadingAllPages ? 'Cargando...' : `Seleccionar todos los ${total.toLocaleString()} registros`}
                  </button>
                </div>
              )}
              {selectAllPages && (
                <div className={`px-4 py-2 text-center text-xs border-t ${isDark ? 'border-pink-900/30 bg-pink-500/10' : 'border-pink-200/50 bg-pink-50'}`}>
                  <span className={`font-semibold ${isDark ? 'text-pink-300' : 'text-pink-600'}`}>
                    Los {total.toLocaleString()} registros están seleccionados.
                  </span>
                  {' '}
                  <button
                    onClick={handleClearSelection}
                    className={`underline underline-offset-2 ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                  >
                    Limpiar selección
                  </button>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'} flex items-center justify-between`}>
                  <div className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
                    Mostrando {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} de {total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onPageChange(page - 1); }}
                      disabled={page === 1}
                      className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
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
                              : `${isDark ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`
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
                      className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
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

// Catorcena / rango de fechas Indicator
function CatorcenaIndicator({
  catorcena,
  filteredCatorcena,
  fechaInicio,
  fechaFin,
}: {
  catorcena: any;
  filteredCatorcena: any;
  fechaInicio?: string;
  fechaFin?: string;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  // si hay un rango de fechas manual filtrado, muéstralo en lugar de la catorcena.
  // timeZone UTC: las fechas vienen a medianoche UTC; formatearlas en hora local
  // (UTC-6) las corría un día hacia atrás ("20 jul" para una catorcena del 21).
  if (fechaInicio || fechaFin) {
    const start = fechaInicio ? new Date(fechaInicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '...';
    const end = fechaFin ? new Date(fechaFin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '...';
    return (
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-sm bg-purple-500/10 border-purple-500/30">
        <Calendar className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
        <div>
          <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>Periodo Filtrado</span>
          <span className={`${isDark ? 'text-white' : 'text-gray-800'} text-sm font-semibold ml-2`}>{start} – {end}</span>
        </div>
      </div>
    );
  }

  const displayCatorcena = filteredCatorcena || catorcena;
  if (!displayCatorcena) return null;

  const isFiltered = filteredCatorcena && filteredCatorcena.id !== catorcena?.id;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border backdrop-blur-sm ${isFiltered ? `${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}` : `${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}`}>
      <Calendar className={`h-4 w-4 ${isFiltered ? `${isDark ? 'text-purple-400' : 'text-purple-500'}` : `${isDark ? 'text-emerald-300' : 'text-emerald-400'}`}`} />
      <div>
        <span className={`text-[10px] font-medium uppercase tracking-wider ${isFiltered ? `${isDark ? 'text-purple-400' : 'text-purple-500'}` : `${isDark ? 'text-emerald-300' : 'text-emerald-400'}`}`}>
          {isFiltered ? 'Periodo Filtrado' : 'Periodo Actual'}
        </span>
        <span className={`${isDark ? 'text-white' : 'text-gray-800'} text-sm font-semibold ml-2`}>Cat. {displayCatorcena.numero} / {displayCatorcena.ano}</span>
      </div>
      {displayCatorcena.fecha_inicio && (
        <span className={`text-xs ${isFiltered ? (isDark ? 'text-purple-500/70' : 'text-purple-400') : (isDark ? 'text-emerald-400/70' : 'text-emerald-500')}`}>
          {/* Hora local a proposito: las fechas de catorcenas vienen corridas
              +1 dia (medianoche UTC = 6pm del dia anterior en MX), asi que el
              formato local muestra las fechas REALES de operacion. */}
          {new Date(displayCatorcena.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} -
          {new Date(displayCatorcena.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// Formatea montos como moneda MXN compacta ($1.2M, $850.0K, $1,234)
function formatMoneyMXN(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('es-MX')}`;
}

// Bloque: estado de POST a SAP (pendientes por postear vs posteadas), con
// conteo y monto. El monto total exacto se muestra en el tooltip.
function PosteoStatsCard({ data, isLoading, periodoLabel }: { data?: PosteoStats; isLoading: boolean; periodoLabel?: string | null }) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const pendientes = data?.pendientes ?? { count: 0, monto: 0 };
  const posteadas = data?.posteadas ?? { count: 0, monto: 0 };
  const totalCount = (data?.total.count ?? 0) || 1; // evita /0 en la barra
  const pctPosteadas = (posteadas.count / totalCount) * 100;

  const cells: Array<{
    key: string; label: string; icon: React.ElementType; bucket: { count: number; monto: number };
    accent: string; bg: string; bar: string;
  }> = [
    {
      key: 'pendientes', label: 'Pendientes por postear', icon: Clock3, bucket: pendientes,
      accent: isDark ? 'text-amber-300' : 'text-amber-600',
      bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
      bar: '#f59e0b',
    },
    {
      key: 'posteadas', label: 'Posteadas a SAP', icon: Send, bucket: posteadas,
      accent: isDark ? 'text-emerald-300' : 'text-emerald-600',
      bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      bar: '#10b981',
    },
  ];

  return (
    <GlassCard>
      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-purple-200/50'} flex flex-wrap items-center justify-between gap-2`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'} uppercase tracking-wider flex items-center gap-2`}>
          <Send className="h-4 w-4 text-emerald-500" /> Estado de POST a SAP
          {periodoLabel && (
            <span className={`normal-case tracking-normal text-[11px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
              {periodoLabel}
            </span>
          )}
        </h3>
        {data && (
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {data.total.count.toLocaleString()} circuitos · {formatMoneyMXN(data.total.monto)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {cells.map((cell) => (
            <div key={cell.key} className={`rounded-xl p-4 ${cell.bg} border ${isDark ? 'border-white/5' : 'border-black/5'}`}>
              <div className="flex items-center gap-2 mb-2">
                <cell.icon className={`h-4 w-4 ${cell.accent}`} />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${cell.accent}`}>{cell.label}</span>
              </div>
              {isLoading ? (
                <Skeleton className={`h-9 w-24 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`} />
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-light ${isDark ? 'text-white' : 'text-gray-800'}`}>{cell.bucket.count.toLocaleString()}</span>
                    <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>circuitos</span>
                  </div>
                  <div className={`mt-1 text-sm font-semibold ${cell.accent}`} title={`$${cell.bucket.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`}>
                    {formatMoneyMXN(cell.bucket.monto)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {/* Barra de avance de posteo */}
        {!isLoading && data && data.total.count > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Avance de posteo</span>
              <span className={`text-xs font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>{pctPosteadas.toFixed(1)}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(pctPosteadas, 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Main Dashboard Component
export function DashboardPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeEstatus, setActiveEstatus] = useState<EstatusType>('total');
  const [showFilters, setShowFilters] = useState(false);
  const [dateMode, setDateMode] = useState<'catorcenal' | 'periodo'>('catorcenal');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCatNum, setSelectedCatNum] = useState<number | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [selectedPlaza, setSelectedPlaza] = useState<string | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<number>>(new Set());

  // WebSocket para actualizaciones en tiempo real
  useSocketDashboard();

  const { data: filterOptions, isError: filterOptionsError } = useQuery({
    queryKey: ['dashboard', 'filter-options'],
    queryFn: () => dashboardService.getFilterOptions(),
  });

  // Catorcena "actual" efectiva. El back puede regresar catorcenaActual null
  // (p. ej. el ultimo dia de la catorcena con el cache de 1h aun sin el fix de
  // fecha, o un hueco en la tabla); resolveCatorcenaActual la deriva de la
  // lista en ese caso.
  const catorcenaDefault = useMemo(() => resolveCatorcenaActual(filterOptions), [filterOptions]);

  // Filtro por defecto: la catorcena actual. Se aplica una sola vez cuando
  // llegan las opciones de filtro y solo si el usuario aun no eligio periodo,
  // para no pisar una seleccion manual hecha mientras cargaba la query.
  // Las queries de datos esperan a `periodoListo` para no disparar primero la
  // version sin periodo (todo el historico — las queries mas caras del back)
  // y refetchear un instante despues con la catorcena.
  const [periodoListo, setPeriodoListo] = useState(false);
  const defaultCatorcenaAplicada = useRef(false);
  useEffect(() => {
    if (defaultCatorcenaAplicada.current) return;
    // Aun cargando opciones: esperar (si fallo, seguimos sin default).
    if (!filterOptions && !filterOptionsError) return;
    defaultCatorcenaAplicada.current = true;
    const actual = catorcenaDefault;
    if (actual) {
      setFilters(p => {
        if (p.catorcena_id || p.fecha_inicio || p.fecha_fin) return p;
        return { ...p, catorcena_id: actual.id };
      });
      setSelectedYear(prev => prev ?? actual.ano);
      setSelectedCatNum(prev => prev ?? actual.numero);
    }
    // Mismo batch que setFilters: las queries se habilitan ya con la catorcena.
    setPeriodoListo(true);
  }, [filterOptions, filterOptionsError, catorcenaDefault]);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', 'stats', filters],
    queryFn: () => dashboardService.getStats(filters),
    enabled: periodoListo,
  });

  const { data: estatusStats, isLoading: loadingEstatus } = useQuery({
    queryKey: ['dashboard', 'stats', activeEstatus, filters],
    queryFn: () => activeEstatus === 'total' ? Promise.resolve(null) : dashboardService.getStatsByEstatus(activeEstatus, filters),
    enabled: periodoListo && activeEstatus !== 'total',
  });

  const { data: inventoryData, isLoading: loadingInventory } = useQuery({
    queryKey: ['dashboard', 'inventory-detail', filters, activeEstatus, inventoryPage, showPins],
    queryFn: () => dashboardService.getInventoryDetail({
      ...filters,
      estatus: activeEstatus !== 'total' ? activeEstatus : undefined,
      page: inventoryPage,
      limit: 50,
      includeCoords: showPins,
    }),
    enabled: periodoListo,
  });

  const filteredCatorcena = useMemo(() => {
    if (!filters.catorcena_id || !filterOptions?.catorcenas) return null;
    return filterOptions.catorcenas.find(c => c.id === filters.catorcena_id) || null;
  }, [filters.catorcena_id, filterOptions]);

  // Estado de POST a SAP — solo depende del periodo (catorcena / rango de fechas).
  // El dashboard SIEMPRE opera sobre un periodo: si el usuario no eligio uno,
  // usamos la catorcena actual (la que muestra el indicador "Periodo Actual"),
  // no todo el historico.
  const posteoFilters = useMemo(() => {
    if (filters.catorcena_id) return { catorcena_id: filters.catorcena_id };
    if (filters.fecha_inicio && filters.fecha_fin) return { fecha_inicio: filters.fecha_inicio, fecha_fin: filters.fecha_fin };
    if (catorcenaDefault?.id) return { catorcena_id: catorcenaDefault.id };
    return {};
  }, [filters.catorcena_id, filters.fecha_inicio, filters.fecha_fin, catorcenaDefault?.id]);
  const { data: posteoStats, isLoading: loadingPosteo } = useQuery({
    queryKey: ['dashboard', 'posteo-stats', posteoFilters],
    queryFn: () => dashboardService.getPosteoStats(posteoFilters),
    // Espera al periodo default: con posteoFilters {} el back agrega TODO el
    // historico de solicitudCaras.
    enabled: periodoListo,
  });

  // Etiqueta del periodo que refleja el bloque de posteo (para dejar claro que
  // los montos son de esa catorcena, no del historico completo).
  const posteoPeriodoLabel = useMemo(() => {
    if (filters.fecha_inicio && filters.fecha_fin) {
      // timeZone UTC: 'YYYY-MM-DD' se parsea como medianoche UTC; en hora local
      // se mostraria un dia antes.
      const fmt = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      return `${fmt(filters.fecha_inicio)} – ${fmt(filters.fecha_fin)}`;
    }
    const cat = filteredCatorcena || catorcenaDefault;
    return cat ? `Cat. ${cat.numero} / ${cat.ano}` : null;
  }, [filters.fecha_inicio, filters.fecha_fin, filteredCatorcena, catorcenaDefault]);

  const graficas = useMemo(() => activeEstatus !== 'total' && estatusStats ? estatusStats.graficas : stats?.graficas, [activeEstatus, estatusStats, stats]);

  // Base para los % de los KPIs: el total de inventarios con los filtros activos.
  const kpiTotal = stats?.kpis.total || 0;

  // "Limpiar" regresa al estado por defecto: catorcena actual seleccionada.
  const handleClearFilters = () => {
    const actual = catorcenaDefault;
    setFilters(actual ? { catorcena_id: actual.id } : {});
    setActiveEstatus('total');
    setInventoryPage(1);
    setSelectedYear(actual?.ano ?? null);
    setSelectedCatNum(actual?.numero ?? null);
    setDateMode('catorcenal');
  };
  // La catorcena actual es el default, no cuenta como filtro activo.
  const esCatorcenaDefault = !!filters.catorcena_id && filters.catorcena_id === catorcenaDefault?.id;
  const activeFilterCount =
    (filters.estado?.length || 0) +
    (filters.ciudad?.length || 0) +
    (filters.formato?.length || 0) +
    (filters.nse?.length || 0) +
    (filters.tipo?.length || 0) +
    (filters.catorcena_id && !esCatorcenaDefault ? 1 : 0) +
    (filters.fecha_inicio ? 1 : 0) +
    (filters.fecha_fin ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const handleEstatusChange = (estatus: EstatusType) => { setActiveEstatus(estatus); setInventoryPage(1); };

  // Descarga el reporte "Pase a ventas" (CSV generado al dia por el back).
  const [descargandoPaseVentas, setDescargandoPaseVentas] = useState(false);
  const descargarPaseAVentas = useCallback(async () => {
    setDescargandoPaseVentas(true);
    try {
      const res = await api.get('/dashboard/pase-a-ventas-report', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pase_a_ventas_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error descargando reporte pase a ventas:', e);
      alert('No se pudo descargar el reporte de pase a ventas.');
    } finally {
      setDescargandoPaseVentas(false);
    }
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="DASHBOARD / HOME" />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
              <h2 className={`text-base md:text-lg font-light ${isDark ? 'text-white' : 'text-gray-800'}`}>Resumen de Inventario</h2>
              <CatorcenaIndicator
                catorcena={catorcenaDefault}
                filteredCatorcena={filteredCatorcena}
                fechaInicio={filters.fecha_inicio}
                fechaFin={filters.fecha_fin}
              />
              {activeEstatus !== 'total' && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'border-pink-500/30' : 'border-pink-200'}`} style={{ background: isDark ? 'linear-gradient(to right, rgba(236,72,153,0.1), rgba(168,85,247,0.1))' : 'linear-gradient(to right, #fdf2f8, #faf5ff)' }}>
                  <span className={`text-sm ${isDark ? 'text-pink-300' : 'text-pink-600'} font-medium`}>{activeEstatus}</span>
                  <button onClick={() => handleEstatusChange('total')} className={`${isDark ? 'text-pink-300 hover:text-pink-200' : 'text-pink-400 hover:text-pink-700'}`}><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className={`gap-2 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-500 hover:text-purple-700'}`}>
                  <RotateCcw className="h-4 w-4" /> Limpiar
                </Button>
              )}
              {/* Reporte Pase a Ventas — solo visible al filtrar por KPI "Vendido" */}
              {activeEstatus === 'Vendido' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={descargarPaseAVentas}
                  disabled={descargandoPaseVentas}
                  className="gap-2"
                  title="Reporte Pase a Ventas"
                >
                  <Download className="h-4 w-4" />
                  {descargandoPaseVentas ? 'Generando...' : 'Reporte Pase a Ventas'}
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
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {showFilters && (
            <GlassCard>
              <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                <MultiSelectFilter
                  label="Estado"
                  values={filters.estado || []}
                  onChange={(v) => {
                    setFilters(p => ({ ...p, estado: v.length ? v : undefined, ciudad: undefined, formato: undefined, nse: undefined }));
                    setInventoryPage(1);
                  }}
                  options={filterOptions?.estados || []}
                />
                <MultiSelectFilter
                  label="Plaza"
                  placeholder="Todas"
                  values={filters.ciudad || []}
                  onChange={(v) => {
                    setFilters(p => ({ ...p, ciudad: v.length ? v : undefined, formato: undefined, nse: undefined }));
                    setInventoryPage(1);
                  }}
                  options={[...new Set(
                    (filterOptions?.ciudades || [])
                      .filter(c => !filters.estado?.length || filters.estado.includes(c.estado))
                      .map(c => c.ciudad)
                  )].sort()}
                />
                <MultiSelectFilter
                  label="Formato"
                  values={filters.formato || []}
                  onChange={(v) => {
                    setFilters(p => ({ ...p, formato: v.length ? v : undefined, nse: undefined }));
                    setInventoryPage(1);
                  }}
                  options={[...new Set(
                    (filterOptions?.formatos || [])
                      .filter(f =>
                        (!filters.estado?.length || filters.estado.includes(f.estado)) &&
                        (!filters.ciudad?.length || filters.ciudad.includes(f.ciudad))
                      )
                      .map(f => f.formato)
                  )].sort()}
                />
                <MultiSelectFilter
                  label="Tipo de formato"
                  values={filters.tipo || []}
                  onChange={(v) => {
                    setFilters(p => ({ ...p, tipo: v.length ? v : undefined }));
                    setInventoryPage(1);
                  }}
                  options={filterOptions?.tipos || []}
                />
                <MultiSelectFilter
                  label="NSE"
                  values={filters.nse || []}
                  onChange={(v) => {
                    setFilters(p => ({ ...p, nse: v.length ? v : undefined }));
                    setInventoryPage(1);
                  }}
                  options={[...new Set(
                    (filterOptions?.nses || [])
                      .filter(n =>
                        (!filters.estado?.length || filters.estado.includes(n.estado)) &&
                        (!filters.ciudad?.length || filters.ciudad.includes(n.ciudad))
                      )
                      .map(n => n.nse)
                  )].sort()}
                />
              </div>
              <div className={`px-4 pb-4 pt-0`}>
                <div className="flex items-center gap-2 mb-3">
                  <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider font-medium`}>Tipo de fecha</label>
                  <div className={`inline-flex rounded-lg border ${isDark ? 'border-purple-500/20' : 'border-purple-200'} overflow-hidden`}>
                    <button
                      onClick={() => {
                        setDateMode('catorcenal');
                        setFilters(p => ({ ...p, fecha_inicio: undefined, fecha_fin: undefined }));
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-all ${dateMode === 'catorcenal'
                        ? `${isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`
                        : `${isDark ? 'bg-zinc-800/50 text-zinc-400 hover:text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-800'}`
                      }`}
                    >
                      Catorcenal
                    </button>
                    <button
                      onClick={() => {
                        setDateMode('periodo');
                        setSelectedYear(null);
                        setSelectedCatNum(null);
                        setFilters(p => ({ ...p, catorcena_id: undefined }));
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-all ${dateMode === 'periodo'
                        ? `${isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`
                        : `${isDark ? 'bg-zinc-800/50 text-zinc-400 hover:text-white' : 'bg-gray-50 text-gray-500 hover:text-gray-800'}`
                      }`}
                    >
                      Periodo
                    </button>
                  </div>
                </div>
                {dateMode === 'catorcenal' ? (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider mb-1 block font-medium`}>Año</label>
                      <select
                        value={selectedYear?.toString() || ''}
                        onChange={(e) => {
                          const yr = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedYear(yr);
                          setSelectedCatNum(null);
                          setFilters(p => ({ ...p, catorcena_id: undefined }));
                          setInventoryPage(1);
                        }}
                        className={`h-9 w-full rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white' : 'border-purple-200 bg-gray-50 text-gray-800'} px-3 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all`}
                      >
                        <option value="" className={isDark ? 'bg-zinc-800' : 'bg-white'}>Seleccionar</option>
                        {[...new Set((filterOptions?.catorcenas || []).map(c => c.ano))].sort((a, b) => b - a).map(yr => (
                          <option key={yr} value={yr.toString()} className={isDark ? 'bg-zinc-800' : 'bg-white'}>{yr}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider mb-1 block font-medium`}>Catorcena</label>
                      <select
                        value={selectedCatNum?.toString() || ''}
                        disabled={!selectedYear}
                        onChange={(e) => {
                          const num = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedCatNum(num);
                          if (num && selectedYear) {
                            const cat = (filterOptions?.catorcenas || []).find(c => c.ano === selectedYear && c.numero === num);
                            if (cat) {
                              setFilters(p => ({ ...p, catorcena_id: cat.id, fecha_inicio: undefined, fecha_fin: undefined }));
                            }
                          } else {
                            setFilters(p => ({ ...p, catorcena_id: undefined }));
                          }
                          setInventoryPage(1);
                        }}
                        className={`h-9 w-full rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white' : 'border-purple-200 bg-gray-50 text-gray-800'} px-3 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all ${!selectedYear ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="" className={isDark ? 'bg-zinc-800' : 'bg-white'}>Seleccionar</option>
                        {(filterOptions?.catorcenas || []).filter(c => c.ano === selectedYear).sort((a, b) => a.numero - b.numero).map(c => (
                          <option key={c.id} value={c.numero.toString()} className={isDark ? 'bg-zinc-800' : 'bg-white'}>
                            Cat. {c.numero}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider mb-1 block font-medium`}>Inicio</label>
                      <input
                        type="date"
                        value={filters.fecha_inicio || ''}
                        onChange={(e) => {
                          setFilters(p => ({
                            ...p,
                            fecha_inicio: e.target.value || undefined,
                            catorcena_id: undefined,
                          }));
                          setInventoryPage(1);
                        }}
                        className={`h-9 w-full rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white' : 'border-purple-200 bg-gray-50 text-gray-800'} px-3 text-sm focus:ring-2 focus:ring-purple-500/30`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-500'} uppercase tracking-wider mb-1 block font-medium`}>Fin</label>
                      <input
                        type="date"
                        value={filters.fecha_fin || ''}
                        onChange={(e) => {
                          setFilters(p => ({
                            ...p,
                            fecha_fin: e.target.value || undefined,
                            catorcena_id: undefined,
                          }));
                          setInventoryPage(1);
                        }}
                        className={`h-9 w-full rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-800/50 text-white' : 'border-purple-200 bg-gray-50 text-gray-800'} px-3 text-sm focus:ring-2 focus:ring-purple-500/30`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <KPICard title="Total" value={kpiTotal} icon={Package} color="purple" isActive={activeEstatus === 'total'} onClick={() => handleEstatusChange('total')} isLoading={loadingStats} />
          <KPICard title="Disponible" value={stats?.kpis.disponibles || 0} icon={CheckCircle2} color="green" isActive={activeEstatus === 'Disponible'} onClick={() => handleEstatusChange('Disponible')} isLoading={loadingStats} total={kpiTotal} />
          <KPICard title="Reservado" value={stats?.kpis.reservados || 0} icon={Clock} color="yellow" isActive={activeEstatus === 'Reservado'} onClick={() => handleEstatusChange('Reservado')} isLoading={loadingStats} total={kpiTotal} />
          <KPICard title="Vendido" value={stats?.kpis.vendidos || 0} icon={ShoppingCart} color="cyan" isActive={activeEstatus === 'Vendido'} onClick={() => handleEstatusChange('Vendido')} isLoading={loadingStats} total={kpiTotal} />
          <KPICard title="Bloqueado" value={stats?.kpis.bloqueados || 0} icon={Lock} color="pink" isActive={activeEstatus === 'Bloqueado'} onClick={() => handleEstatusChange('Bloqueado')} isLoading={loadingStats} total={kpiTotal} />
        </div>

        {/* Estado de POST a SAP: pendientes por postear vs posteadas */}
        <PosteoStatsCard data={posteoStats} isLoading={loadingPosteo} periodoLabel={posteoPeriodoLabel} />

        {/* Charts Row 1 */}
        {(loadingEstatus || loadingInventory) && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <span className="ml-2 text-sm text-zinc-400">Calculando...</span>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalBarChart data={graficas?.porMueble || []} color="pink" title="Por Mueble" />
          <TipoPieChart data={graficas?.porTipo || []} title="Por Tipo (Tradicional vs Digital)" />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DistribucionPieChart data={graficas?.porPlaza || []} title="Por Plaza" />
          <SimpleBarChart data={graficas?.porNSE || []} title="Por Nivel Socioeconomico" />
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
          filters={filters}
          activeEstatus={activeEstatus}
        />
      </div>
    </div>
  );
}
