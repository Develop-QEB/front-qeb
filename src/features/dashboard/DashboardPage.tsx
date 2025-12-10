import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
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
  RotateCcw,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import {
  dashboardService,
  DashboardFilters,
  ChartData,
} from '../../services/dashboard.service';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const name = data.nombre || data.name || label;
    const percentage = data.percentage;

    return (
      <div className="bg-[#1a1025]/95 border border-purple-500/30 p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[150px] z-[9999]">
        <p className="text-purple-200 font-medium mb-2 text-sm border-b border-purple-500/20 pb-1">{name}</p>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
            style={{ backgroundColor: data.fill || payload[0].color || payload[0].fill || '#a855f7' }}
          />
          <div className="flex flex-col">
            <span className="text-white text-lg font-bold tracking-tight">
              {value?.toLocaleString()}
            </span>
            {percentage !== undefined && (
              <span className="text-xs text-purple-400 font-medium">
                {percentage.toFixed(1)}% del total
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Tipos de estatus para KPIs
type EstatusType = 'total' | 'Disponible' | 'Reservado' | 'Vendido' | 'Bloqueado';

// Componente Select personalizado para el dashboard
function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Todos',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-purple-400/60 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full appearance-none rounded-lg border border-purple-800/30 bg-purple-900/20 px-3 py-1 pr-8 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" className="bg-[#1a1025] text-white">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#1a1025] text-white">
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// Componente de KPI Card
function KPICard({
  title,
  value,
  icon: Icon,
  color,
  isActive,
  onClick,
  isLoading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'pink' | 'cyan' | 'yellow' | 'green' | 'purple';
  isActive: boolean;
  onClick: () => void;
  isLoading: boolean;
}) {
  const colors = {
    pink: {
      bg: 'from-pink-600/20 to-purple-600/20',
      border: 'border-pink-500/50',
      text: 'text-pink-400',
      glow: 'shadow-pink-500/20',
    },
    cyan: {
      bg: 'from-cyan-600/20 to-blue-600/20',
      border: 'border-cyan-500/50',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/20',
    },
    yellow: {
      bg: 'from-yellow-600/20 to-orange-600/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      glow: 'shadow-yellow-500/20',
    },
    green: {
      bg: 'from-green-600/20 to-teal-600/20',
      border: 'border-green-500/50',
      text: 'text-green-400',
      glow: 'shadow-green-500/20',
    },
    purple: {
      bg: 'from-purple-600/20 to-pink-600/20',
      border: 'border-purple-500/50',
      text: 'text-purple-400',
      glow: 'shadow-purple-500/20',
    },
  };

  const colorClass = colors[color];

  return (
    <Card
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md ${isActive
          ? `bg-gradient-to-r ${colorClass.bg} ${colorClass.border} shadow-lg ${colorClass.glow}`
          : 'hover:border-purple-600/50 hover:bg-[#1a1025]/90'
        }`}
      onClick={onClick}
    >
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-400/60 uppercase tracking-wider mb-1">
              {title}
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 bg-purple-900/30" />
            ) : (
              <p className={`text-3xl font-light ${colorClass.text}`}>
                {value.toLocaleString()}
              </p>
            )}
          </div>
          <div
            className={`p-3 rounded-xl bg-gradient-to-r ${colorClass.bg} ${isActive ? 'ring-2 ring-offset-2 ring-offset-[#1a1025]' : ''
              }`}
          >
            <Icon className={`h-6 w-6 ${colorClass.text}`} />
          </div>
        </div>
        {isActive && (
          <div className={`mt-3 text-xs ${colorClass.text} flex items-center gap-1`}>
            <CheckCircle2 className="h-3 w-3" />
            Filtro activo
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 1. Mapa de México para Plazas (Ciudades)
const CITY_COORDINATES: Record<string, [number, number]> = {
  'Monterrey': [25.6761, -100.3153],
  'CDMX': [19.4326, -99.1332],
  'Guadalajara': [20.6597, -103.3496],
  'Merida': [20.9674, -89.5926],
  'Cancun': [21.1619, -86.8515],
  'Puebla': [19.0414, -98.2063],
  'Tijuana': [32.5149, -117.0382],
  'Queretaro': [20.5888, -100.3899],
  'Leon': [21.1221, -101.6664],
  'Toluca': [19.2826, -99.6557],
  'San Luis Potosi': [22.1565, -100.9855],
  'Aguascalientes': [21.8853, -102.2916],
  'Chihuahua': [28.6353, -106.0889],
  'Hermosillo': [29.0730, -110.9559],
  'Saltillo': [25.4383, -101.0000],
  'Mexicali': [32.6245, -115.4523],
  'Culiacan': [24.8059, -107.3944],
  'Acapulco': [16.8531, -99.8237],
  'Veracruz': [19.1738, -96.1342],
  'Villahermosa': [17.9895, -92.9475],
  'Mazatlan': [23.2494, -106.4111],
  'Tampico': [22.2331, -97.8611],
  'Morelia': [19.7008, -101.1844],
  'Torreon': [25.5428, -103.4189],
  'Ciudad Juarez': [31.6904, -106.4245],
};

function MexicoMapChart({ data, title }: { data: ChartData[]; title: string }) {
  const center: [number, number] = [23.6345, -102.5528];

  const mapData = useMemo(() => {
    return data
      .map(item => {
        const cityKey = Object.keys(CITY_COORDINATES).find(key =>
          item.nombre.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(item.nombre.toLowerCase())
        );
        return {
          ...item,
          coords: cityKey ? CITY_COORDINATES[cityKey] : null
        };
      })
      .filter(item => item.coords !== null)
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [data]);

  const maxVal = Math.max(...mapData.map(d => d.cantidad), 1);

  return (
    <Card className="h-full border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-purple-100">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] p-0 relative">
        <MapContainer
          center={center}
          zoom={5}
          style={{ height: '100%', width: '100%', background: '#130e24' }}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {mapData.map((city, idx) => (
            <CircleMarker
              key={idx}
              center={city.coords!}
              pathOptions={{
                fillColor: idx === 0 ? '#facc15' : idx < 3 ? '#ec4899' : '#22d3ee',
                color: idx === 0 ? '#facc15' : idx < 3 ? '#ec4899' : '#22d3ee',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
              }}
              radius={Math.max(5, (city.cantidad / maxVal) * 20) + 2}
            >
              <Popup className="custom-popup">
                <div className="p-2 text-center text-slate-800">
                  <p className="font-bold">{city.nombre}</p>
                  <p className="text-purple-600 font-bold">{city.cantidad} Inventario</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="absolute bottom-4 left-4 bg-[#1a1025]/90 p-3 rounded-lg border border-purple-500/20 backdrop-blur-sm z-[1000] pointer-events-none">
          <p className="text-xs text-purple-200 mb-2 font-medium">Top Plazas</p>
          {mapData.slice(0, 3).map((city, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-yellow-400' : 'bg-pink-500'}`} />
              <span className="text-[10px] text-zinc-300">{city.nombre}</span>
              <span className="text-[10px] text-white font-bold">{city.cantidad}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// 2. Vertical Bar Chart Simple (para NSE)
function SimpleBarChart({
  data,
  title,
  color = "blue"
}: {
  data: ChartData[];
  title: string;
  color?: string;
}) {
  return (
    <Card className="h-full border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-purple-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="nombre"
              tick={{ fill: '#e9d5ff', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
              content={<CustomTooltip />}
            />
            <Bar
              dataKey="cantidad"
              radius={[4, 4, 0, 0]}
              barSize={40}
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#d946ef'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// 3. Donut Chart (Simple Pie) para Municipio (Replaces Treemap)
function DonutChart({
  data,
  title,
  maxItems = 6,
}: {
  data: ChartData[];
  title: string;
  maxItems?: number;
}) {
  const processedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, maxItems);
    const total = sorted.reduce((sum, item) => sum + item.cantidad, 0);
    return sorted.map((item, index) => ({
      ...item,
      percentage: total > 0 ? (item.cantidad / total) * 100 : 0,
      fill: ['#ec4899', '#8b5cf6', '#22d3ee', '#facc15', '#22c55e'][index % 5]
    }));
  }, [data, maxItems]);

  return (
    <Card className="h-full border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-purple-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        {processedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-purple-300/40">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="cantidad"
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                formatter={(value, entry: any) => (
                  <span className="text-purple-200 text-xs ml-1 font-medium">{entry.payload.nombre}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Reuse HorizontalBarChart (Standard)
function HorizontalBarChart({
  data,
  color,
  title,
  maxItems = 8,
}: {
  data: ChartData[];
  color: 'pink' | 'cyan' | 'yellow' | 'green' | 'purple';
  title: string;
  maxItems?: number;
}) {
  const sortedData = useMemo(() =>
    [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, maxItems),
    [data, maxItems]
  );

  const colorsMap = {
    pink: '#ec4899',
    cyan: '#22d3ee',
    yellow: '#facc15',
    green: '#22c55e',
    purple: '#a855f7',
  };

  return (
    <Card className="h-full border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-purple-100">
          <TrendingUp className={`h-4 w-4 text-${color}-400`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {sortedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-purple-300/40">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sortedData}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={100}
                tick={{ fill: '#e9d5ff', fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                cursor={{ fill: 'rgba(168, 85, 247, 0.1)' }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey="cantidad"
                fill={colorsMap[color]}
                radius={[0, 4, 4, 0]}
                barSize={24}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colorsMap[color]}
                    fillOpacity={0.8 + (index % 2) * 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ComparisonChart (Trad vs Digital) - Semi-Circle Donut (Gauge)
function ComparisonChart({
  data,
  title,
}: {
  data: ChartData[];
  title: string;
}) {
  const sortedData = useMemo(() => {
    const total = data.reduce((acc, curr) => acc + curr.cantidad, 0);
    return [...data]
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((item, index) => ({
        ...item,
        percentage: total > 0 ? (item.cantidad / total) * 100 : 0,
        fill: index === 0 ? '#22d3ee' : '#ec4899',
      }));
  }, [data]);

  const total = sortedData.reduce((acc, curr) => acc + curr.cantidad, 0);

  return (
    <Card className="h-full border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-purple-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px] flex items-center justify-center relative">
        {sortedData.length === 0 ? (
          <div className="text-purple-300/40">Sin datos</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sortedData}
                  cx="50%"
                  cy="70%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="cantidad"
                >
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Stats (Positioned slightly lower for semi-circle) */}
            <div className="absolute inset-x-0 bottom-10 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-white tracking-tight">{total.toLocaleString()}</span>
              <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">Total</span>
            </div>
            {/* Legend */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              {sortedData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: item.fill }} />
                  <span className="text-[10px] text-zinc-300 font-medium">{item.nombre}: {item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Componente principal del Dashboard
export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeEstatus, setActiveEstatus] = useState<EstatusType>('total');
  const [showFilters, setShowFilters] = useState(false);

  // Query para opciones de filtros
  const { data: filterOptions } = useQuery({
    queryKey: ['dashboard', 'filter-options'],
    queryFn: () => dashboardService.getFilterOptions(),
  });

  // Query para estadisticas principales
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', 'stats', filters],
    queryFn: () => dashboardService.getStats(filters),
  });

  // Query para estadisticas filtradas por estatus
  const { data: estatusStats } = useQuery({
    queryKey: ['dashboard', 'stats', activeEstatus, filters],
    queryFn: () =>
      activeEstatus === 'total'
        ? Promise.resolve(null)
        : dashboardService.getStatsByEstatus(activeEstatus, filters),
    enabled: activeEstatus !== 'total',
  });

  // Query para actividad reciente
  const { data: activity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardService.getRecentActivity(),
  });

  // Query para proximas catorcenas
  const { data: proximasCatorcenas } = useQuery({
    queryKey: ['dashboard', 'catorcenas'],
    queryFn: () => dashboardService.getUpcomingCatorcenas(),
  });

  // Query para top clientes
  const { data: topClientes } = useQuery({
    queryKey: ['dashboard', 'top-clientes'],
    queryFn: () => dashboardService.getTopClientes(),
  });

  // Graficas a mostrar (filtradas por estatus o generales)
  const graficas = useMemo(() => {
    if (activeEstatus !== 'total' && estatusStats) {
      return estatusStats.graficas;
    }
    return stats?.graficas;
  }, [activeEstatus, estatusStats, stats]);

  // Limpiar filtros
  const handleClearFilters = () => {
    setFilters({});
    setActiveEstatus('total');
  };

  // Verificar si hay filtros activos
  const hasActiveFilters =
    filters.estado ||
    filters.ciudad ||
    filters.formato ||
    filters.nse ||
    filters.catorcena_id;

  return (
    <div className="min-h-screen">
      <Header title="DASHBOARD / HOME" />

      <div className="p-6 space-y-6">
        {/* Header con filtros integrados */}
        <div className="flex flex-col gap-4">
          {/* Fila superior: Titulo, estatus activo y acciones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-light text-white">Resumen de Inventario</h2>
              {activeEstatus !== 'total' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30">
                  <span className="text-sm text-pink-400 font-medium">{activeEstatus}</span>
                  <button
                    onClick={() => setActiveEstatus('total')}
                    className="text-pink-400 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="gap-2 text-purple-400 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpiar filtros
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

          {/* Panel de filtros expandible - diseño horizontal */}
          {showFilters && (
            <Card className="overflow-hidden border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md">
              <CardContent className="py-4">
                <div className="grid gap-4 md:grid-cols-6">
                  <FilterSelect
                    label="Estado"
                    value={filters.estado || ''}
                    onChange={(value) => setFilters((prev) => ({ ...prev, estado: value || undefined }))}
                    options={filterOptions?.estados || []}
                    placeholder="Todos"
                  />

                  <FilterSelect
                    label="Ciudad"
                    value={filters.ciudad || ''}
                    onChange={(value) => setFilters((prev) => ({ ...prev, ciudad: value || undefined }))}
                    options={filterOptions?.ciudades || []}
                    placeholder="Todas"
                  />

                  <FilterSelect
                    label="Formato"
                    value={filters.formato || ''}
                    onChange={(value) => setFilters((prev) => ({ ...prev, formato: value || undefined }))}
                    options={filterOptions?.formatos || []}
                    placeholder="Todos"
                  />

                  <FilterSelect
                    label="NSE"
                    value={filters.nse || ''}
                    onChange={(value) => setFilters((prev) => ({ ...prev, nse: value || undefined }))}
                    options={filterOptions?.nses || []}
                    placeholder="Todos"
                  />

                  <div className="md:col-span-2">
                    <label className="text-xs text-purple-400/60 uppercase tracking-wider mb-1 block">
                      Catorcena
                    </label>
                    <select
                      value={filters.catorcena_id?.toString() || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          catorcena_id: e.target.value ? parseInt(e.target.value) : undefined,
                        }))
                      }
                      className="flex h-9 w-full appearance-none rounded-lg border border-purple-800/30 bg-purple-900/20 px-3 py-1 pr-8 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                    >
                      <option value="" className="bg-[#1a1025] text-white">
                        Todas
                      </option>
                      {filterOptions?.catorcenaActual && (
                        <option
                          key={filterOptions.catorcenaActual.id}
                          value={filterOptions.catorcenaActual.id.toString()}
                          className="bg-[#1a1025] text-pink-400 font-medium"
                        >
                          {filterOptions.catorcenaActual.label}
                        </option>
                      )}
                      <option disabled className="bg-[#1a1025] text-purple-400/40">
                        ──────────
                      </option>
                      {filterOptions?.catorcenas.map((cat) => (
                        <option key={cat.id} value={cat.id.toString()} className="bg-[#1a1025] text-white">
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5">
          <KPICard
            title="Total Inventario"
            value={stats?.kpis.total || 0}
            icon={Package}
            color="purple"
            isActive={activeEstatus === 'total'}
            onClick={() => setActiveEstatus('total')}
            isLoading={loadingStats}
          />
          <KPICard
            title="Disponible"
            value={stats?.kpis.disponibles || 0}
            icon={CheckCircle2}
            color="green"
            isActive={activeEstatus === 'Disponible'}
            onClick={() => setActiveEstatus('Disponible')}
            isLoading={loadingStats}
          />
          <KPICard
            title="Reservado"
            value={stats?.kpis.reservados || 0}
            icon={Clock}
            color="yellow"
            isActive={activeEstatus === 'Reservado'}
            onClick={() => setActiveEstatus('Reservado')}
            isLoading={loadingStats}
          />
          <KPICard
            title="Vendido"
            value={stats?.kpis.vendidos || 0}
            icon={ShoppingCart}
            color="cyan"
            isActive={activeEstatus === 'Vendido'}
            onClick={() => setActiveEstatus('Vendido')}
            isLoading={loadingStats}
          />
          <KPICard
            title="Bloqueado"
            value={stats?.kpis.bloqueados || 0}
            icon={Lock}
            color="pink"
            isActive={activeEstatus === 'Bloqueado'}
            onClick={() => setActiveEstatus('Bloqueado')}
            isLoading={loadingStats}
          />
        </div>

        {/* Graficas principales */}
        <div className="grid gap-4 lg:grid-cols-2">
          <HorizontalBarChart
            data={graficas?.porMueble || []}
            color="pink"
            title="Por Mueble"
          />
          {/* Comparison - Tradicional vs Digital (NOW SEMI-CIRCLE GAUGE) */}
          <ComparisonChart
            data={graficas?.porTipo || []}
            title="Por Tipo (Tradicional vs Digital)"
          />
        </div>

        {/* Segunda fila de graficas */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Donut Chart para Municipio (NOW PIE with hole) */}
          <DonutChart data={graficas?.porMunicipio || []} title="Por Municipio" />
          {/* Simple Bar Chart para NSE */}
          <SimpleBarChart data={graficas?.porNSE || []} title="Por Nivel Socioeconomico" />
        </div>

        {/* Tercera fila - Por Plaza (MAPA - KEPT) */}
        <div className="grid gap-4 lg:grid-cols-1">
          <MexicoMapChart
            data={graficas?.porPlaza || []}
            title="Ubicacion de Plazas (Ciudades)"
          />
        </div>

        {/* Widgets adicionales (Actividad y Catorcenas) */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Actividad reciente */}
          <Card className="border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-purple-100">
                <Activity className="h-4 w-4 text-pink-400" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity?.solicitudes.slice(0, 4).map((sol) => (
                  <div
                    key={sol.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-purple-900/20 transition-colors"
                  >
                    <div className="h-2 w-2 rounded-full bg-pink-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{sol.descripcion}</p>
                      <p className="text-xs text-purple-400/60">
                        {sol.razon_social || 'Sin cliente'} - {sol.status}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-purple-400/40 flex-shrink-0" />
                  </div>
                ))}
                {!activity?.solicitudes.length && (
                  <p className="text-center text-purple-400/60 py-4">Sin actividad</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Proximas catorcenas */}
          <Card className="border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-purple-100">
                <Calendar className="h-4 w-4 text-cyan-400" />
                Proximas Catorcenas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {proximasCatorcenas?.slice(0, 5).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-purple-900/20 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-white">
                        Cat {cat.numero} - {cat.ano}
                      </p>
                      <p className="text-xs text-purple-400/60">
                        {new Date(cat.fecha_inicio).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        -{' '}
                        {new Date(cat.fecha_fin).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div className="text-xs text-cyan-400">
                      {Math.ceil(
                        (new Date(cat.fecha_inicio).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </div>
                  </div>
                ))}
                {!proximasCatorcenas?.length && (
                  <p className="text-center text-purple-400/60 py-4">Sin catorcenas proximas</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top clientes */}
          <Card className="border border-purple-500/20 bg-[#130e24]/80 backdrop-blur-md shadow-lg shadow-purple-900/10">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-purple-100">
                <Users className="h-4 w-4 text-yellow-400" />
                Top Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topClientes?.map((cliente, index) => (
                  <div
                    key={cliente.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-purple-900/20 transition-colors"
                  >
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${index === 0
                          ? 'bg-yellow-500 text-black'
                          : index === 1
                            ? 'bg-gray-300 text-black'
                            : index === 2
                              ? 'bg-orange-600 text-white'
                              : 'bg-purple-800 text-white'
                        }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{cliente.nombre}</p>
                    </div>
                    <div className="text-sm text-purple-300">{cliente.totalReservas} reservas</div>
                  </div>
                ))}
                {!topClientes?.length && (
                  <p className="text-center text-purple-400/60 py-4">Sin datos</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
