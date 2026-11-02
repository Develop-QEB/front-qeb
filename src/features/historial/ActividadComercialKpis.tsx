import { useMemo, useState } from 'react';
import { Gauge, ChevronDown, ChevronUp, ArrowRight, AlertTriangle } from 'lucide-react';
import type { ActividadComercialTarea } from '../../services/historial.service';
import { COLUMNA_COLOR, COLUMNA_LABEL, calcularKpisAC, formatPct, type ColumnaAC } from './actividadComercial';

// Caja de indicadores del tablero de Actividad Comercial. Misma anatomia que
// "Inventario Detallado" del dashboard: cabecera clickeable con icono, titulo,
// subtitulo y chevron; contraida por default. Los numeros responden a los
// filtros del tablero (recibe las actividades ya filtradas).
interface Props {
  tareas: ActividadComercialTarea[];
  totalSinFiltro: number;
  filtrosActivos: boolean;
  isDark: boolean;
}

export function ActividadComercialKpis({ tareas, totalSinFiltro, filtrosActivos, isDark }: Props) {
  const [expanded, setExpanded] = useState(false);
  const k = useMemo(() => calcularKpisAC(tareas), [tareas]);

  const txt = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const borde = isDark ? 'border-purple-900/30' : 'border-purple-200/50';

  const subtitulo = [
    `${k.total.toLocaleString()} ${k.total === 1 ? 'actividad' : 'actividades'}${filtrosActivos ? ` de ${totalSinFiltro.toLocaleString()} (con filtros)` : ''}`,
    k.base > 0 ? `${formatPct(k.pctFinalizacion)} finalizadas` : null,
  ].filter(Boolean).join(' · ');

  const etapas: { col: ColumnaAC; n: number }[] = [
    { col: 'Abierto', n: k.abiertas },
    { col: 'Activo', n: k.activas },
    { col: 'Finalizado', n: k.finalizadas },
  ];

  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-xl ${isDark ? 'border-purple-900/30 bg-[#1a1025]/90 shadow-purple-900/10' : 'border-purple-200/50 bg-white/90 shadow-purple-100/20'}`}>
      {/* Cabecera (siempre visible) */}
      <div
        className={`p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50/50'} ${expanded ? `border-b ${borde}` : ''}`}
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Gauge className={`h-4 w-4 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm font-medium truncate ${txt}`}>Indicadores</h3>
            <p className={`text-xs ${sub}`}>{subtitulo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Resumen compacto: una pastilla por etapa (identidad = punto de color + etiqueta, nunca solo color) */}
          {etapas.map(({ col, n }) => (
            <span
              key={col}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${COLUMNA_COLOR[col].bg} ${COLUMNA_COLOR[col].border} ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}
            >
              <span className={`h-2 w-2 rounded-full ${COLUMNA_COLOR[col].dot}`} />
              <span className={sub}>{COLUMNA_LABEL[col]}</span>
              <span className="font-semibold">{n.toLocaleString()}</span>
            </span>
          ))}
          {k.canceladas > 0 && (
            <span className={`text-xs ${sub}`}>{k.canceladas} canceladas</span>
          )}
          {expanded
            ? <ChevronUp className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            : <ChevronDown className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Fila 1: conteo por etapa (stat tiles con meter "% del total") */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              isDark={isDark}
              label="Total de actividades"
              value={k.total}
              nota={k.canceladas > 0 ? `${k.canceladas} canceladas · ${k.base} en curso o finalizadas` : 'Sin canceladas'}
              fill="bg-purple-500"
              track={isDark ? 'bg-purple-500/15' : 'bg-purple-100'}
              ratio={1}
            />
            {etapas.map(({ col, n }) => (
              <StatTile
                key={col}
                isDark={isDark}
                label={COLUMNA_LABEL[col]}
                value={n}
                nota={`${formatPct(k.base > 0 ? n / k.base : null)} del total en curso`}
                fill={COLUMNA_COLOR[col].dot}
                track={COLUMNA_COLOR[col].bg}
                ratio={k.base > 0 ? n / k.base : 0}
                dot
              />
            ))}
          </div>

          {/* Fila 2: ratios (meters) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RatioTile
              isDark={isDark}
              label="Finalización"
              value={k.pctFinalizacion}
              detalle={`${k.finalizadas} finalizadas de ${k.base}`}
              fill={COLUMNA_COLOR.Finalizado.dot}
              track={COLUMNA_COLOR.Finalizado.bg}
            />
            <RatioTile
              isDark={isDark}
              label={<>Conversión <span className={sub}>Abierto</span> <ArrowRight className="inline h-3 w-3" /> <span className={sub}>Activo</span></>}
              value={k.convAbiertoActivo}
              detalle={`${k.activas + k.finalizadas} de ${k.base} ya salieron de Abierto`}
              fill={COLUMNA_COLOR.Activo.dot}
              track={COLUMNA_COLOR.Activo.bg}
            />
            <RatioTile
              isDark={isDark}
              label={<>Conversión <span className={sub}>Activo</span> <ArrowRight className="inline h-3 w-3" /> <span className={sub}>Finalizado</span></>}
              value={k.convActivoFinalizado}
              detalle={`${k.finalizadas} de ${k.activas + k.finalizadas} que llegaron a Activo`}
              fill={COLUMNA_COLOR.Finalizado.dot}
              track={COLUMNA_COLOR.Finalizado.bg}
            />
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-2 text-[11px] ${sub}`}>
            <span>Calculado sobre el estado actual de las actividades filtradas. Las canceladas no cuentan como avance ni como finalizadas.</span>
            {k.vencidas > 0 && (
              <span className="inline-flex items-center gap-1 text-red-400">
                <AlertTriangle className="h-3 w-3" /> {k.vencidas} sin finalizar con fecha de entrega vencida
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat tile: etiqueta · valor (semibold, cifras proporcionales) · nota · meter
// con la pista en un paso mas claro de la misma rampa.
function StatTile({ isDark, label, value, nota, fill, track, ratio, dot = false }: {
  isDark: boolean; label: string; value: number; nota: string; fill: string; track: string; ratio: number; dot?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
      <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        {dot && <span className={`h-2 w-2 rounded-full ${fill}`} />}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{value.toLocaleString()}</div>
      <div className={`mt-1.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{nota}</div>
      <Meter ratio={ratio} fill={fill} track={track} />
    </div>
  );
}

function RatioTile({ isDark, label, value, detalle, fill, track }: {
  isDark: boolean; label: React.ReactNode; value: number | null; detalle: string; fill: string; track: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
      <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{label}</div>
      <div className={`mt-1 text-2xl font-semibold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatPct(value)}</div>
      <div className={`mt-1.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{detalle}</div>
      <Meter ratio={value ?? 0} fill={fill} track={track} />
    </div>
  );
}

function Meter({ ratio, fill, track }: { ratio: number; fill: string; track: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={`mt-2 h-1.5 w-full rounded-full overflow-hidden ${track}`} aria-hidden>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}
