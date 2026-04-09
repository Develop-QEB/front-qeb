import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { ticketsService } from '../../services/tickets.service';
import { useThemeStore } from '../../store/themeStore';

const MEDALS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function RankingCard({
  title,
  emoji,
  items,
  valueLabel,
  color,
  isDark,
  emptyText,
}: {
  title: string;
  emoji: string;
  items: { nombre: string; value: number | string }[];
  valueLabel: string;
  color: string;
  isDark: boolean;
  emptyText?: string;
}) {
  const topEmojis = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];

  return (
    <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white border-purple-200'} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-100'} flex items-center gap-3`}>
        <span className="text-2xl">{emoji}</span>
        <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      </div>
      <div className="p-4 space-y-2">
        {items.length === 0 ? (
          <p className={`text-sm text-center py-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{emptyText || 'Sin datos'}</p>
        ) : (
          items.slice(0, 10).map((item, i) => (
            <div
              key={item.nombre}
              className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                i < 3
                  ? i === 0
                    ? isDark ? 'bg-gradient-to-r from-yellow-900/30 via-amber-900/20 to-transparent border border-yellow-500/30 shadow-lg shadow-yellow-500/5' : 'bg-gradient-to-r from-yellow-50 via-amber-50 to-transparent border border-yellow-200 shadow-md shadow-yellow-100'
                    : i === 1
                      ? isDark ? 'bg-gradient-to-r from-zinc-700/30 to-transparent border border-zinc-400/20' : 'bg-gradient-to-r from-gray-100 to-transparent border border-gray-200'
                      : isDark ? 'bg-gradient-to-r from-orange-900/20 to-transparent border border-orange-500/20' : 'bg-gradient-to-r from-orange-50 to-transparent border border-orange-200'
                  : isDark ? 'bg-zinc-800/30' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {i < 3 ? (
                  <span className="text-xl w-8 text-center">{topEmojis[i]}</span>
                ) : (
                  <div className={`w-8 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500'}`}>
                    {i + 1}
                  </div>
                )}
                <span className={`text-sm font-medium ${i === 0 ? (isDark ? 'text-yellow-200 font-bold' : 'text-yellow-800 font-bold') : isDark ? 'text-zinc-200' : 'text-gray-700'}`}>
                  {item.nombre}
                </span>
              </div>
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full`} style={{ backgroundColor: `${color}15`, color }}>
                {item.value} {valueLabel}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RankingTicketsPage() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const navigate = useNavigate();

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['ticket-rankings'],
    queryFn: () => ticketsService.getRankings(),
  });

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0f0a1a]' : 'bg-gray-50'}`}>
      <Header title="Rankings de Tickets" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/tickets-historial')}
              className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20' : 'bg-purple-50 hover:bg-purple-100 border-purple-200'} border transition-all`}
            >
              <ArrowLeft className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                \ud83c\udfc6 Rankings de Tickets
              </h1>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                Estadisticas y rankings internos del equipo
              </p>
            </div>
          </div>
          {rankings && (
            <div className="flex gap-3">
              <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'} border`}>
                <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                  \ud83c\udfab {rankings.totalTickets} tickets totales
                </span>
              </div>
              <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'} border`}>
                <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                  \u2705 {rankings.totalResueltos} resueltos
                </span>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className={`h-10 w-10 ${isDark ? 'text-purple-400' : 'text-purple-600'} animate-spin`} />
          </div>
        ) : rankings ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top creadores de tickets */}
            <RankingCard
              title="M\u00e1s tickets creados"
              emoji="\ud83d\udce9"
              items={rankings.topCreadores.map((c) => ({ nombre: c.nombre, value: c.count }))}
              valueLabel="tickets"
              color="#F59E0B"
              isDark={isDark}
              emptyText="Nadie ha creado tickets"
            />

            {/* Top tecnicos solucionadores */}
            <RankingCard
              title="M\u00e1s tickets resueltos"
              emoji="\ud83d\udee0\ufe0f"
              items={rankings.topTecnicos.map((t) => ({ nombre: t.nombre, value: t.count }))}
              valueLabel="resueltos"
              color="#10B981"
              isDark={isDark}
              emptyText="No hay tickets resueltos"
            />

            {/* Ranking por area */}
            <RankingCard
              title="Areas que m\u00e1s reportan"
              emoji="\ud83c\udfe2"
              items={rankings.topAreas.map((a) => ({ nombre: a.nombre, value: a.count }))}
              valueLabel="tickets"
              color="#3B82F6"
              isDark={isDark}
              emptyText="Sin datos de areas"
            />

            {/* Ranking por rol */}
            <RankingCard
              title="Roles que m\u00e1s reportan"
              emoji="\ud83c\udfad"
              items={rankings.topRoles.map((r) => ({ nombre: r.nombre, value: r.count }))}
              valueLabel="tickets"
              color="#A855F7"
              isDark={isDark}
              emptyText="Sin datos de roles"
            />

            {/* Velocidad de resolucion */}
            <RankingCard
              title="Velocidad de resoluci\u00f3n"
              emoji="\u26a1"
              items={rankings.velocidadTecnicos.map((t) => ({
                nombre: t.nombre,
                value: t.promedio_horas < 24 ? `${t.promedio_horas}h` : `${Math.round(t.promedio_horas / 24)}d`,
              }))}
              valueLabel="prom."
              color="#8B5CF6"
              isDark={isDark}
              emptyText="Sin datos de velocidad"
            />

            {/* Rey de las urgencias */}
            <RankingCard
              title="Rey de las urgencias"
              emoji="\ud83d\udd25"
              items={rankings.topUrgentes.map((u) => ({ nombre: u.nombre, value: u.count }))}
              valueLabel="urgentes"
              color="#EF4444"
              isDark={isDark}
              emptyText="No hay tickets urgentes \ud83c\udf89"
            />

            {/* Clientes frecuentes */}
            <RankingCard
              title="Clientes frecuentes"
              emoji="\ud83d\udd04"
              items={rankings.topReincidentes.map((r) => ({ nombre: r.nombre, value: r.count }))}
              valueLabel="seguidos"
              color="#F97316"
              isDark={isDark}
              emptyText="Nadie ha sido reincidente \ud83d\udc4d"
            />

            {/* Dia de la semana */}
            <RankingCard
              title="D\u00edas con m\u00e1s tickets"
              emoji="\ud83d\udcc5"
              items={rankings.ticketsPorDia.map((d) => ({ nombre: d.dia, value: d.count }))}
              valueLabel="tickets"
              color="#06B6D4"
              isDark={isDark}
            />

            {/* Hora pico - grafica de barras full width */}
            <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white border-purple-200'} overflow-hidden lg:col-span-2`}>
              <div className={`px-5 py-4 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-100'} flex items-center gap-3`}>
                <span className="text-2xl">\u23f0</span>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hora pico de tickets</h3>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-1 h-40">
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = rankings.ticketsPorHora.find((e) => e.hora === h);
                    const count = entry?.count || 0;
                    const maxCount = Math.max(...rankings.ticketsPorHora.map((e) => e.count), 1);
                    const height = (count / maxCount) * 100;
                    const isMax = count === maxCount && count > 0;
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1">
                        <span className={`text-[9px] font-medium ${isMax ? (isDark ? 'text-pink-400' : 'text-pink-600') : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                          {count > 0 ? count : ''}
                        </span>
                        <div
                          className={`w-full rounded-t-md transition-all ${isMax ? 'bg-gradient-to-t from-pink-600 to-fuchsia-500' : isDark ? 'bg-purple-500/30' : 'bg-purple-200'}`}
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{h}h</span>
                      </div>
                    );
                  })}
                </div>
                <p className={`text-xs text-center mt-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  Hora del d\u00eda (0-23) \u2014 \u00bfCu\u00e1ndo se quejan m\u00e1s? \ud83e\udd14
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
