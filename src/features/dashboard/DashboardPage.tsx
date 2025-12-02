import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
        isActive
          ? `bg-gradient-to-r ${colorClass.bg} ${colorClass.border} shadow-lg ${colorClass.glow}`
          : 'hover:border-purple-600/50'
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
            className={`p-3 rounded-xl bg-gradient-to-r ${colorClass.bg} ${
              isActive ? 'ring-2 ring-offset-2 ring-offset-[#1a1025]' : ''
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

// Componente de grafica de barras horizontal con animacion
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
  const [animate, setAnimate] = useState(false);

  const colors = {
    pink: 'from-pink-500 to-purple-500',
    cyan: 'from-cyan-400 to-blue-500',
    yellow: 'from-yellow-400 to-orange-500',
    green: 'from-green-400 to-teal-500',
    purple: 'from-purple-400 to-pink-500',
  };

  const glowColors = {
    pink: 'shadow-pink-500/30',
    cyan: 'shadow-cyan-500/30',
    yellow: 'shadow-yellow-500/30',
    green: 'shadow-green-500/30',
    purple: 'shadow-purple-500/30',
  };

  const sortedData = useMemo(() =>
    [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, maxItems),
    [data, maxItems]
  );
  const maxValue = Math.max(...sortedData.map((d) => d.cantidad), 1);

  // Trigger animation when data changes
  useEffect(() => {
    setAnimate(false);
    const timer = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-pink-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedData.length === 0 ? (
          <div className="text-center py-8 text-purple-400/60">Sin datos</div>
        ) : (
          <div className="space-y-3">
            {sortedData.map((item, index) => (
              <div key={item.nombre} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-300/70 truncate max-w-[70%]">
                    {item.nombre}
                  </span>
                  <span className="text-white font-medium">{item.cantidad.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-purple-900/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colors[color]} rounded-full shadow-lg ${glowColors[color]} transition-all duration-700 ease-out`}
                    style={{
                      width: animate ? `${(item.cantidad / maxValue) * 100}%` : '0%',
                      transitionDelay: `${index * 80}ms`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente de comparacion para 2 valores (Tradicional vs Digital)
function ComparisonChart({
  data,
  title,
}: {
  data: ChartData[];
  title: string;
}) {
  const [animate, setAnimate] = useState(false);

  const sortedData = useMemo(() =>
    [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, 2),
    [data]
  );

  const total = sortedData.reduce((sum, d) => sum + d.cantidad, 0);
  const leftItem = sortedData[0];
  const rightItem = sortedData[1];

  const leftPercent = total > 0 ? (leftItem?.cantidad || 0) / total * 100 : 50;
  const rightPercent = total > 0 ? (rightItem?.cantidad || 0) / total * 100 : 50;

  useEffect(() => {
    setAnimate(false);
    const timer = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center h-[calc(100%-4rem)]">
        {sortedData.length === 0 ? (
          <div className="text-center py-8 text-purple-400/60">Sin datos</div>
        ) : (
          <div className="w-full space-y-6">
            {/* Barra de comparacion */}
            <div className="relative h-12 rounded-full overflow-hidden bg-purple-900/30">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700 ease-out flex items-center justify-end pr-3"
                style={{ width: animate ? `${leftPercent}%` : '0%' }}
              >
                {leftPercent > 15 && (
                  <span className="text-white font-bold text-lg drop-shadow-lg">
                    {leftPercent.toFixed(0)}%
                  </span>
                )}
              </div>
              <div
                className="absolute right-0 top-0 h-full bg-gradient-to-l from-pink-500 to-pink-400 transition-all duration-700 ease-out flex items-center justify-start pl-3"
                style={{ width: animate ? `${rightPercent}%` : '0%' }}
              >
                {rightPercent > 15 && (
                  <span className="text-white font-bold text-lg drop-shadow-lg">
                    {rightPercent.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* Labels y valores */}
            <div className="flex justify-between items-start">
              <div className="text-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" />
                  <span className="text-lg font-medium text-cyan-400">
                    {leftItem?.nombre || 'N/A'}
                  </span>
                </div>
                <p className="text-2xl font-light text-white">
                  {(leftItem?.cantidad || 0).toLocaleString()}
                </p>
              </div>

              <div className="text-center px-4">
                <span className="text-purple-400/60 text-sm">vs</span>
              </div>

              <div className="text-center">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="text-lg font-medium text-pink-400">
                    {rightItem?.nombre || 'N/A'}
                  </span>
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-pink-400" />
                </div>
                <p className="text-2xl font-light text-white">
                  {(rightItem?.cantidad || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="text-center pt-2 border-t border-purple-800/30">
              <span className="text-purple-400/60 text-sm">Total: </span>
              <span className="text-white font-medium">{total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente de grafica circular/donut con animación de segmentos que crecen
function DonutChart({
  data,
  title,
  maxItems = 6,
}: {
  data: ChartData[];
  title: string;
  maxItems?: number;
}) {
  const [animate, setAnimate] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const colors = [
    '#ec4899', // pink
    '#22d3ee', // cyan
    '#facc15', // yellow
    '#22c55e', // green
    '#a855f7', // purple
    '#f97316', // orange
  ];

  const sortedData = useMemo(() =>
    [...data].sort((a, b) => b.cantidad - a.cantidad).slice(0, maxItems),
    [data, maxItems]
  );
  const total = sortedData.reduce((sum, d) => sum + d.cantidad, 0);

  // Trigger animation cuando cambian los datos
  useEffect(() => {
    setAnimate(false);
    setAnimationKey(prev => prev + 1);
    const timer = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, [data]);

  // Calcular segmentos del donut
  let currentAngle = 0;
  const segments = sortedData.map((item, index) => {
    const percentage = total > 0 ? (item.cantidad / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const segment = {
      ...item,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color: colors[index % colors.length],
    };
    currentAngle += angle;
    return segment;
  });

  // Calcular el stroke-dasharray para animación de "dibujo"
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center h-[calc(100%-4rem)]">
        {sortedData.length === 0 ? (
          <div className="text-center py-8 text-purple-400/60">Sin datos</div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
            {/* Donut Chart con animación de stroke */}
            <div className="relative w-56 h-56">
              <svg
                key={animationKey}
                viewBox="0 0 100 100"
                className="w-full h-full -rotate-90"
              >
                {/* Fondo del donut */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.1)"
                  strokeWidth="20"
                />
                {/* Segmentos animados */}
                {segments.map((segment, index) => {
                  const segmentLength = (segment.percentage / 100) * circumference;
                  const previousSegments = segments.slice(0, index);
                  const offset = previousSegments.reduce((acc, s) => acc + (s.percentage / 100) * circumference, 0);

                  return (
                    <circle
                      key={index}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="20"
                      strokeDasharray={`${segmentLength} ${circumference}`}
                      strokeDashoffset={-offset}
                      className="transition-all duration-700 ease-out"
                      style={{
                        filter: `drop-shadow(0 0 6px ${segment.color}80)`,
                        strokeDasharray: animate
                          ? `${segmentLength} ${circumference}`
                          : `0 ${circumference}`,
                        transitionDelay: `${index * 100}ms`,
                      }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-light text-white">{total.toLocaleString()}</span>
                <span className="text-xs text-purple-400/60">Total</span>
              </div>
            </div>
            {/* Legend - Horizontal */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full">
              {segments.map((segment, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-purple-300/70 truncate flex-1">{segment.nombre}</span>
                  <span className="text-white font-medium">{segment.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
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
            <Card className="overflow-hidden">
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
          <ComparisonChart
            data={graficas?.porTipo || []}
            title="Por Tipo (Tradicional vs Digital)"
          />
        </div>

        {/* Segunda fila de graficas */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart data={graficas?.porMunicipio || []} title="Por Municipio" />
          <DonutChart data={graficas?.porNSE || []} title="Por Nivel Socioeconomico" />
        </div>

        {/* Tercera fila - Por Plaza */}
        <div className="grid gap-4 lg:grid-cols-1">
          <HorizontalBarChart
            data={graficas?.porPlaza || []}
            color="cyan"
            title="Por Plaza"
            maxItems={10}
          />
        </div>

        {/* Widgets adicionales */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Actividad reciente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
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
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index === 0
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
