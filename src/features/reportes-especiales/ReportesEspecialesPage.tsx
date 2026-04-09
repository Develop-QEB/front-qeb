import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, Clock, CheckCircle2, Loader2,
  TrendingUp, Award, Timer, Zap, Building2, UserCheck, Target,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { useThemeStore } from '../../store/themeStore';
import api from '../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface ReportesData {
  hoy: {
    total: number;
    nuevos: number;
    enProgreso: number;
    enValidacion: number;
    resueltosYCerrados: number;
    prioridad: { normal: number; alta: number; urgente: number };
    ticketsPorHora: { hora: number; count: number }[];
  };
  global: {
    total: number;
    nuevos: number;
    enProgreso: number;
    enValidacion: number;
    resueltosYCerrados: number;
    tiempoPromedioResolucion: number;
  };
  rankings: {
    areas: { nombre: string; count: number }[];
    usuarios: { nombre: string; count: number }[];
    tecnicos: { nombre: string; count: number }[];
    resolucionDia: { nombre: string; count: number }[];
  };
  graficas: {
    ticketsPorHora: { hora: number; count: number }[];
    ticketsPorDiaSemana: { dia: string; count: number }[];
    horaPico: { hora: number; count: number };
  };
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];

interface DetalleFilter {
  tipo: 'area' | 'usuario';
  valor: string;
}

export function ReportesEspecialesPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const [detalleFilter, setDetalleFilter] = useState<DetalleFilter | null>(null);

  // Fechas: default hoy
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
  const [fechaInicio, setFechaInicio] = useState(todayStr);
  const [fechaFin, setFechaFin] = useState(todayStr);

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-especiales', fechaInicio, fechaFin],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      const res = await api.get<{ success: boolean; data: ReportesData }>(`/tickets/reportes-especiales?${params}`);
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const esHoy = fechaInicio === todayStr && fechaFin === todayStr;
  const labelPeriodo = esHoy
    ? new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City' })
    : `${fechaInicio} — ${fechaFin}`;

  if (isLoading || !data) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
        <Header />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
        </div>
      </div>
    );
  }

  const tasaResolucionGlobal = data.global.total > 0
    ? Math.round((data.global.resueltosYCerrados / data.global.total) * 100)
    : 0;

  const kpiCards = [
    { label: esHoy ? 'Tickets Hoy' : 'Tickets Periodo', value: data.hoy.total, icon: BarChart3, color: 'purple' },
    { label: 'Nuevos', value: data.hoy.nuevos, icon: Zap, color: 'blue' },
    { label: 'En Atención', value: data.hoy.enProgreso + data.hoy.enValidacion, icon: Clock, color: 'amber' },
    { label: esHoy ? 'Resueltos Hoy' : 'Resueltos Periodo', value: data.hoy.resueltosYCerrados, icon: CheckCircle2, color: 'emerald' },
    { label: 'Total Resueltos', value: data.global.resueltosYCerrados, icon: Award, color: 'cyan' },
    { label: 'Total Global', value: data.global.total, icon: TrendingUp, color: 'purple' },
  ];

  const iconColorMap: Record<string, string> = {
    purple: 'text-purple-400', blue: 'text-blue-400', amber: 'text-amber-400',
    cyan: 'text-cyan-400', emerald: 'text-emerald-400',
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Título + Filtros de fecha */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reportes Especiales
            </h1>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1 capitalize`}>
              {labelPeriodo} {esHoy ? '— Datos en tiempo real' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-purple-500`}
              />
            </div>
            {!esHoy && (
              <button
                onClick={() => { setFechaInicio(todayStr); setFechaFin(todayStr); }}
                className={`px-3 py-1.5 rounded-lg text-xs ${isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'} transition-colors`}
              >
                Hoy
              </button>
            )}
            {esHoy && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} border`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4 w-4 ${iconColorMap[kpi.color]}`} />
                <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Hora pico + Global + Resueltos */}
        {/* Hora Pico */}
        <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5 flex items-center gap-6`}>
          <Zap className="h-8 w-8 text-amber-400" />
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hora Pico General</h3>
            <p className={`text-3xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {data.graficas.horaPico.hora}:00
            </p>
          </div>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            {data.graficas.horaPico.count} tickets en esa hora — promedio histórico de mayor actividad
          </p>
        </div>

        {/* Top Técnicos */}
        <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-purple-400" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Tickets Resueltos por Técnico</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.rankings.tecnicos.map((t, i) => (
              <div key={t.nombre} className={`text-center p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
                {i === 0 && <Award className="h-5 w-5 text-amber-400 mx-auto mb-2" />}
                <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.count}</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{t.nombre}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfica tickets por hora HOY */}
        <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Actividad por Hora {esHoy ? '— Hoy' : `— ${fechaInicio} a ${fechaFin}`}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.hoy.ticketsPorHora}>
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} tickFormatter={(h) => `${h}h`} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: isDark ? '#18181b' : '#fff', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.hoy.ticketsPorHora.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráficas: distribución por hora global + día semana */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Distribución por Hora (Global)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.graficas.ticketsPorHora}>
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} tickFormatter={(h) => `${h}h`} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: isDark ? '#18181b' : '#fff', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Actividad por Día de la Semana</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.graficas.ticketsPorDiaSemana}>
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: isDark ? '#18181b' : '#fff', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking áreas */}
        <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-blue-400" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Áreas con más Actividad</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.rankings.areas.slice(0, 8).map((a, i) => (
              <div
                key={a.nombre}
                onClick={() => setDetalleFilter({ tipo: 'area', valor: a.nombre })}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-gray-50 hover:bg-gray-100'}`}
              >
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${i < 3 ? 'bg-blue-500/20 text-blue-300' : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{a.nombre}</p>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Ranking usuarios que más crearon tickets — paginado */}
        <RankingUsuariosTable usuarios={data.rankings.usuarios} isDark={isDark} onUserClick={(nombre) => setDetalleFilter({ tipo: 'usuario', valor: nombre })} />

        {/* Modal detalle */}
        {detalleFilter && (
          <DetalleModal filter={detalleFilter} isDark={isDark} onClose={() => setDetalleFilter(null)} />
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

function RankingUsuariosTable({ usuarios, isDark, onUserClick }: { usuarios: { nombre: string; count: number }[]; isDark: boolean; onUserClick: (nombre: string) => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(usuarios.length / PAGE_SIZE);
  const paginated = usuarios.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-fuchsia-400" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Tickets Creados por Usuario ({usuarios.length})
          </h3>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 disabled:text-zinc-700' : 'hover:bg-gray-100 text-gray-500 disabled:text-gray-300'} transition-colors disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400 disabled:text-zinc-700' : 'hover:bg-gray-100 text-gray-500 disabled:text-gray-300'} transition-colors disabled:cursor-not-allowed`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className={`text-left text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <th className="pb-2 w-12">#</th>
            <th className="pb-2">Usuario</th>
            <th className="pb-2 text-right">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((u, i) => {
            const rank = page * PAGE_SIZE + i + 1;
            return (
              <tr key={u.nombre} onClick={() => onUserClick(u.nombre)} className={`border-b cursor-pointer transition-colors ${isDark ? 'border-zinc-800/50 hover:bg-zinc-800/50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <td className={`py-2.5 text-sm ${rank <= 3 ? 'font-bold text-purple-400' : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  {rank}
                </td>
                <td className={`py-2.5 text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  {u.nombre}
                </td>
                <td className={`py-2.5 text-sm text-right font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {u.count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface DetalleData {
  resumen: { total: number; nuevo: number; enProgreso: number; enValidacion: number; resuelto: number; cerrado: number };
  tickets: { id: number; titulo: string; status: string; prioridad: string; usuario_nombre: string; created_at: string; resumenAI: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  'Nuevo': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'En Progreso': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Validación': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Resuelto': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Cerrado': 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function DetalleModal({ filter, isDark, onClose }: { filter: DetalleFilter; isDark: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reportes-detalle', filter.tipo, filter.valor],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DetalleData }>(`/tickets/reportes-especiales/detalle?tipo=${filter.tipo}&valor=${encodeURIComponent(filter.valor)}`);
      return res.data.data;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'} border rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col max-h-[85vh]`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {filter.tipo === 'area' ? `Área: ${filter.valor}` : filter.valor}
            </h2>
            {data && <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-0.5`}>{data.resumen.total} tickets</p>}
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors text-xl`}>&times;</button>
        </div>

        {data && (
          <div className={`flex gap-2 px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex-wrap`}>
            {[
              { label: 'Nuevo', count: data.resumen.nuevo },
              { label: 'En Progreso', count: data.resumen.enProgreso },
              { label: 'Validación', count: data.resumen.enValidacion },
              { label: 'Resuelto', count: data.resumen.resuelto },
              { label: 'Cerrado', count: data.resumen.cerrado },
            ].filter(s => s.count > 0).map(s => (
              <span key={s.label} className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[s.label] || ''}`}>
                {s.label}: {s.count}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
            </div>
          ) : data?.tickets.map(t => (
            <div key={t.id} className={`p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} space-y-1`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>#{t.id} — {t.titulo}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLORS[t.status] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'}`}>{t.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{t.usuario_nombre}</span>
                <span className={`text-[11px] ${isDark ? 'text-zinc-600' : 'text-gray-300'}`}>
                  {new Date(t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                </span>
              </div>
              {t.resumenAI && (
                <p className={`text-xs ${isDark ? 'text-purple-300/80' : 'text-purple-600'} italic mt-1`}>{t.resumenAI}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
