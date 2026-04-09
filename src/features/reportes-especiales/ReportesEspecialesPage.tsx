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

export function ReportesEspecialesPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-especiales'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ReportesData }>('/tickets/reportes-especiales');
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

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
    { label: 'Tickets Hoy', value: data.hoy.total, icon: BarChart3, color: 'purple' },
    { label: 'Nuevos', value: data.hoy.nuevos, icon: Zap, color: 'blue' },
    { label: 'En Atención', value: data.hoy.enProgreso + data.hoy.enValidacion, icon: Clock, color: 'amber' },
    { label: 'Resueltos Hoy', value: data.hoy.resueltosYCerrados, icon: CheckCircle2, color: 'emerald' },
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
        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reportes Especiales
            </h1>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1 capitalize`}>
              {hoy} — Datos en tiempo real
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} border`}>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            En vivo
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
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Actividad por Hora — Hoy</h3>
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
              <div key={a.nombre} className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
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
        <RankingUsuariosTable usuarios={data.rankings.usuarios} isDark={isDark} />
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

function RankingUsuariosTable({ usuarios, isDark }: { usuarios: { nombre: string; count: number }[]; isDark: boolean }) {
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
              <tr key={u.nombre} className={`border-b ${isDark ? 'border-zinc-800/50' : 'border-gray-100'}`}>
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
