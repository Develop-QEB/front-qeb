import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { ticketsService } from '../../services/tickets.service';
import { useThemeStore } from '../../store/themeStore';
import { useSocketTicketRankings } from '../../hooks/useSocket';
import { UserAvatar } from '../../components/ui/user-avatar';

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
                  <span className="text-xl w-8 text-center">{['🥇', '🥈', '🥉'][i]}</span>
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

  useSocketTicketRankings();

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
                🏆 Rankings de Tickets
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
                  🎫 {rankings.totalTickets} tickets totales
                </span>
              </div>
              <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'} border`}>
                <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                  ✅ {rankings.totalResueltos} resueltos
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Empleado del mes */}
        {rankings?.empleadoDelMes && (() => {
          const emp = rankings.empleadoDelMes;
          const nombre = emp.nombre;
          const count = emp.count;
          const topUser = emp.top_usuario;
          const total = rankings.totalTickets;
          const hl = isDark ? 'text-yellow-300' : 'text-yellow-700';

          const leyendas: Record<string, React.ReactNode> = {
            'Akary': (
              <>
                "En los archivos secretos del reino de QEB, se habla en susurros de una hechicera del codigo
                conocida como <strong className={hl}>Akary</strong>. Dicen que sus dedos danzan sobre el teclado
                con la velocidad del rayo, y que ningun bug sobrevive a su mirada. Con {count} criaturas digitales
                sometidas{topUser ? <> — siendo <strong className={hl}>{topUser}</strong> su protegida mas fiel, a quien rescato
                incontables veces de las garras del caos</> : null}, su nombre resuena en cada linea de codigo
                como un encantamiento de proteccion eterna."
              </>
            ),
            'Jos': (
              <>
                "Las leyendas mas antiguas del reino de QEB narran la historia de <strong className={hl}>Jos</strong>,
                el arquitecto silencioso. Se dice que cuando el sistema tiembla y los servidores lloran,
                el aparece como una sombra certera, resolviendo lo imposible con una calma que hiela la sangre
                de los bugs. Con {count} anomalias erradicadas de la faz del codigo
                {topUser ? <> — y con <strong className={hl}>{topUser}</strong> como su aliado mas constante,
                cuyas peticiones siempre encontraron respuesta</> : null}, Jos se convirtio en el guardian
                que todo sistema merece pero pocos logran tener."
              </>
            ),
            'Mario': (
              <>
                "Habia una vez, en las tierras digitales de QEB, un guerrero llamado <strong className={hl}>Mario</strong>.
                No portaba espada ni escudo, sino una terminal y un cafe que nunca se enfriaba.
                Los usuarios lo invocaban cuando toda esperanza se perdia, y el respondia con {count} soluciones
                forjadas en las llamas del debugger
                {topUser ? <>. <strong className={hl}>{topUser}</strong>, su companero de batallas mas frecuente,
                sabe mejor que nadie que donde Mario pisa, los errores tiemblan</> : null}.
                Su leyenda se escribe con cada deploy exitoso."
              </>
            ),
            'Bladi': (
              <>
                "Los pergaminos mas valiosos de QEB hablan de <strong className={hl}>Bladi</strong>,
                el estratega del reino. Mientras otros guerreros luchan con fuerza bruta,
                Bladi observa, analiza y con una sola jugada magistral desmantela {count} fortalezas
                de errores que parecian invencibles
                {topUser ? <>. <strong className={hl}>{topUser}</strong>, testigo de sus hazanas mas memorables,
                puede dar fe de que cada solucion de Bladi es una obra de arte</> : null}.
                En el tablero del soporte tecnico, el siempre va tres movimientos adelante."
              </>
            ),
          };

          const leyendaDefault = (
            <>
              "Cuentan las antiguas cronicas del reino de QEB que, cuando los bugs acechaban
              y los tickets se multiplicaban como dragones en la oscuridad, surgio un heroe de entre las sombras del codigo.
              Con {count} bestias digitales derrotadas
              {topUser ? <> — siendo <strong className={hl}>{topUser}</strong> su aliado mas protegido</> : null}, <strong className={hl}>{nombre}</strong> se
              alzo como leyenda viviente, protector de los usuarios y guardian del sistema."
            </>
          );

          const leyenda = leyendas[nombre] || leyendaDefault;

          return (
            <div className={`rounded-2xl border-2 ${isDark ? 'border-yellow-500/40 bg-gradient-to-r from-yellow-900/20 via-amber-900/15 to-yellow-900/20' : 'border-yellow-300 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50'} p-6 text-center relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-2 left-8 text-6xl">👑</div>
                <div className="absolute top-4 right-12 text-5xl">⭐</div>
                <div className="absolute bottom-2 left-1/4 text-4xl">✨</div>
                <div className="absolute bottom-4 right-1/4 text-4xl">🌟</div>
              </div>
              <div className="relative z-10">
                <div className="flex justify-center mb-3">
                  <span className="text-4xl">👑</span>
                </div>
                <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  Empleado del Mes
                </h2>
                <div className="flex justify-center mb-3">
                  <div className={`rounded-full p-1 ${isDark ? 'bg-gradient-to-br from-yellow-500/40 to-amber-500/40' : 'bg-gradient-to-br from-yellow-200 to-amber-200'}`}>
                    <UserAvatar
                      nombre={nombre}
                      foto_perfil={emp.foto_perfil}
                      size="xl"
                      className="!w-20 !h-20 !text-2xl"
                    />
                  </div>
                </div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {nombre}
                </h3>
                <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  🛠️ {count} tickets resueltos
                </p>
                <div className={`mt-4 max-w-xl mx-auto px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-900/60 border border-yellow-500/10' : 'bg-white/80 border border-yellow-200'}`}>
                  <p className={`text-xs italic leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    {leyenda}
                  </p>
                  <p className={`text-[10px] mt-2 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    — Fragmento del Gran Libro de los Tickets, Capitulo {total}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className={`h-10 w-10 ${isDark ? 'text-purple-400' : 'text-purple-600'} animate-spin`} />
          </div>
        ) : rankings ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RankingCard
              title="Mas tickets creados"
              emoji="📩"
              items={rankings.topCreadores.map((c) => ({ nombre: c.nombre, value: c.count }))}
              valueLabel="tickets"
              color="#F59E0B"
              isDark={isDark}
              emptyText="Nadie ha creado tickets"
            />

            <RankingCard
              title="Mas tickets resueltos"
              emoji="🛠️"
              items={rankings.topTecnicos.map((t) => ({ nombre: t.nombre, value: t.count }))}
              valueLabel="resueltos"
              color="#10B981"
              isDark={isDark}
              emptyText="No hay tickets resueltos"
            />

            <RankingCard
              title="Areas que mas reportan"
              emoji="🏢"
              items={rankings.topAreas.map((a) => ({ nombre: a.nombre, value: a.count }))}
              valueLabel="tickets"
              color="#3B82F6"
              isDark={isDark}
              emptyText="Sin datos de areas"
            />

            <RankingCard
              title="Roles que mas reportan"
              emoji="🎭"
              items={rankings.topRoles.map((r) => ({ nombre: r.nombre, value: r.count }))}
              valueLabel="tickets"
              color="#A855F7"
              isDark={isDark}
              emptyText="Sin datos de roles"
            />

            <RankingCard
              title="Velocidad de resolucion"
              emoji="⚡"
              items={rankings.velocidadTecnicos.map((t) => ({
                nombre: t.nombre,
                value: t.promedio_horas < 24 ? `${t.promedio_horas}h` : `${Math.round(t.promedio_horas / 24)}d`,
              }))}
              valueLabel="prom."
              color="#8B5CF6"
              isDark={isDark}
              emptyText="Sin datos de velocidad"
            />

            <RankingCard
              title="Rey de las urgencias"
              emoji="🔥"
              items={rankings.topUrgentes.map((u) => ({ nombre: u.nombre, value: u.count }))}
              valueLabel="urgentes"
              color="#EF4444"
              isDark={isDark}
              emptyText="No hay tickets urgentes 🎉"
            />

            <RankingCard
              title="Clientes frecuentes"
              emoji="🔄"
              items={rankings.topReincidentes.map((r) => ({ nombre: r.nombre, value: r.count }))}
              valueLabel="seguidos"
              color="#F97316"
              isDark={isDark}
              emptyText="Nadie ha sido reincidente 👍"
            />

            <RankingCard
              title="Dias con mas tickets"
              emoji="📅"
              items={rankings.ticketsPorDia.map((d) => ({ nombre: d.dia, value: d.count }))}
              valueLabel="tickets"
              color="#06B6D4"
              isDark={isDark}
            />

            {/* Hora pico - grafica de barras full width */}
            <div className={`rounded-2xl border ${isDark ? 'border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : 'bg-white border-purple-200'} overflow-hidden lg:col-span-2`}>
              <div className={`px-5 py-4 border-b ${isDark ? 'border-purple-500/20' : 'border-purple-100'} flex items-center gap-3`}>
                <span className="text-2xl">⏰</span>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hora pico de tickets</h3>
              </div>
              <div className="p-5">
                {(() => {
                  const maxCount = Math.max(...rankings.ticketsPorHora.map((e) => e.count), 1);
                  const BAR_MAX_HEIGHT = 140;
                  return (
                    <div className="flex items-end gap-1" style={{ height: `${BAR_MAX_HEIGHT + 30}px` }}>
                      {Array.from({ length: 24 }, (_, h) => {
                        const entry = rankings.ticketsPorHora.find((e) => e.hora === h);
                        const count = entry?.count || 0;
                        const barHeight = count > 0 ? Math.max((count / maxCount) * BAR_MAX_HEIGHT, 4) : 2;
                        const isMax = count === maxCount && count > 0;
                        return (
                          <div key={h} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                            <span className={`text-[9px] font-medium mb-1 ${isMax ? (isDark ? 'text-pink-400' : 'text-pink-600') : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                              {count > 0 ? count : ''}
                            </span>
                            <div
                              className={`w-full max-w-[20px] rounded-t-md ${isMax ? 'bg-gradient-to-t from-pink-600 to-fuchsia-500' : isDark ? 'bg-purple-500/40' : 'bg-purple-300'}`}
                              style={{ height: `${barHeight}px` }}
                            />
                            <span className={`text-[9px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{h}h</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <p className={`text-xs text-center mt-3 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  Hora del dia (0-23) — Cuando se quejan mas? 🤔
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
