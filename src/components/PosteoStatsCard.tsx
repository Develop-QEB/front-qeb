import React from 'react';
import { Clock3, Send, DollarSign } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useThemeStore } from '../store/themeStore';
import type { PosteoStats } from '../services/dashboard.service';
import { formatMoneyMXN } from '../lib/utils';

const fmtExacto = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;

// Bloque: estado de POST a SAP (pendientes por postear vs posteadas), con
// conteo y monto. El monto total exacto se muestra en el tooltip.
//
// Se usa en el Dashboard (universo: campañas activas + filtros de inventario)
// y en Campañas (universo: las campañas que lista la página). En Campañas se
// pasa `inversionTotal`: la suma de la columna Inversión del listado, que va
// como celda principal del bloque ("Inversión total"). Si no se pasa, el
// bloque es solo el estado de posteo (como en el Dashboard).
export function PosteoStatsCard({
  data,
  isLoading,
  periodoLabel,
  inversionTotal,
  inversionSubLabel,
}: {
  data?: PosteoStats | null;
  isLoading: boolean;
  periodoLabel?: string | null;
  /** Inversión total del universo (misma suma que el listado). */
  inversionTotal?: number | null;
  /** Texto chico bajo la inversión total (p. ej. "799 campañas · Todas"). */
  inversionSubLabel?: string | null;
}) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const pendientes = data?.pendientes ?? { count: 0, monto: 0 };
  const posteadas = data?.posteadas ?? { count: 0, monto: 0 };
  const totalCount = (data?.total.count ?? 0) || 1; // evita /0 en la barra
  const pctPosteadas = (posteadas.count / totalCount) * 100;
  const conInversion = inversionTotal !== undefined && inversionTotal !== null;

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
    <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'border-purple-900/30 bg-[#1a1025]/90 shadow-purple-900/10' : 'border-purple-200/50 bg-white/90 shadow-purple-100/20'} backdrop-blur-xl shadow-xl`}>
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
          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} title={fmtExacto(data.total.monto)}>
            {data.total.count.toLocaleString()} circuitos · {formatMoneyMXN(data.total.monto)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className={`grid gap-3 ${conInversion ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {/* Inversión total: suma de la columna Inversión del listado (con o sin filtro). */}
          {conInversion && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} border ${isDark ? 'border-white/5' : 'border-black/5'}`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className={`h-4 w-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Inversión total</span>
              </div>
              {isLoading ? (
                <Skeleton className={`h-9 w-28 ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`} />
              ) : (
                <>
                  <div
                    className={`text-3xl font-light ${isDark ? 'text-white' : 'text-gray-800'}`}
                    title={fmtExacto(inversionTotal as number)}
                  >
                    {formatMoneyMXN(inversionTotal as number)}
                  </div>
                  {inversionSubLabel && (
                    <div className={`mt-1 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{inversionSubLabel}</div>
                  )}
                </>
              )}
            </div>
          )}
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
                  <div className={`mt-1 text-sm font-semibold ${cell.accent}`} title={fmtExacto(cell.bucket.monto)}>
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
    </div>
  );
}
