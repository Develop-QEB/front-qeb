import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, Clock, CheckCircle2, AlertCircle, Loader2,
  TrendingUp, Award, Timer, Zap, Building2, UserCheck,
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { useThemeStore } from '../../store/themeStore';
import api from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
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
    refetchInterval: 60000, // Auto-refresh cada minuto
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

  const kpiCards = [
    { label: 'Tickets Hoy', value: data.hoy.total, icon: BarChart3, color: 'purple' },
    { label: 'Nuevos', value: data.hoy.nuevos, icon: AlertCircle, color: 'blue' },
    { label: 'En Progreso', value: data.hoy.enProgreso, icon: Clock, color: 'amber' },
    { label: 'En Validación', value: data.hoy.enValidacion, icon: Timer, color: 'cyan' },
    { label: 'Resueltos / Cerrados', value: data.hoy.resueltosYCerrados, icon: CheckCircle2, color: 'emerald' },
    { label: 'Urgentes Hoy', value: data.hoy.prioridad.urgente, icon: Zap, color: 'red' },
  ];

  const colorMap: Record<string, string> = {
    purple: isDark ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
    blue: isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    amber: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200',
    emerald: isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: isDark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
  };

  const iconColorMap: Record<string, string> = {
    purple: 'text-purple-400', blue: 'text-blue-400', amber: 'text-amber-400',
    cyan: 'text-cyan-400', emerald: 'text-emerald-400', red: 'text-red-400',
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

        {/* KPIs del día */}
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

        {/* Hora pico + Stats globales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-amber-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hora Pico</h3>
            </div>
            <p className={`text-4xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {data.graficas.horaPico.hora}:00
            </p>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>
              {data.graficas.horaPico.count} tickets en esa hora
            </p>
          </div>

          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Global</h3>
            </div>
            <p className={`text-4xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
              {data.global.total}
            </p>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>
              tickets totales en el sistema
            </p>
          </div>

          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-5 w-5 text-cyan-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Tiempo Promedio</h3>
            </div>
            <p className={`text-4xl font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
              {data.global.tiempoPromedioResolucion}h
            </p>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'} mt-1`}>
              resolución promedio
            </p>
          </div>
        </div>

        {/* Resolución del día (ranking simulado) + Ranking técnicos global */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Resolución del Día</h3>
            </div>
            <div className="space-y-3">
              {data.rankings.resolucionDia.sort((a, b) => b.count - a.count).map((r, i) => {
                const maxCount = Math.max(...data.rankings.resolucionDia.map(x => x.count));
                const pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
                return (
                  <div key={r.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                        {i === 0 && <Award className="h-4 w-4 text-amber-400" />}
                        {r.nombre}
                      </span>
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.count}</span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} overflow-hidden`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-purple-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Técnicos (Global)</h3>
            </div>
            <div className="space-y-2">
              {data.rankings.tecnicos.slice(0, 8).map((t, i) => (
                <div key={t.nombre} className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i < 3 ? 'bg-purple-500/20 text-purple-300' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
                      {i + 1}
                    </span>
                    {t.nombre}
                  </span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráfica tickets por hora HOY */}
        <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Tickets por Hora — Hoy</h3>
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

        {/* Gráfica hora pico global + día semana */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Tickets por Hora (Global)</h3>
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
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Tickets por Día de la Semana</h3>
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

        {/* Rankings: Áreas + Usuarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-blue-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ranking de Áreas</h3>
            </div>
            <div className="space-y-2">
              {data.rankings.areas.slice(0, 10).map((a, i) => (
                <div key={a.nombre} className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i < 3 ? 'bg-blue-500/20 text-blue-300' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
                      {i + 1}
                    </span>
                    {a.nombre}
                  </span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-gray-200'} border rounded-xl p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-fuchsia-400" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Usuarios (más tickets)</h3>
            </div>
            <div className="space-y-2">
              {data.rankings.usuarios.slice(0, 10).map((u, i) => (
                <div key={u.nombre} className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} flex items-center gap-2`}>
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i < 3 ? 'bg-fuchsia-500/20 text-fuchsia-300' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
                      {i + 1}
                    </span>
                    {u.nombre}
                  </span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
