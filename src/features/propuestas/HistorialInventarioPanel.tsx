import { useMemo, useState } from 'react';
import { History, Search, Download, RotateCcw, Ban, ArrowRightLeft, Trash2, Lock } from 'lucide-react';
import type { ReservaHistorialItem } from '../../services/propuestas.service';

// Tab "Historial" del buscador de formatos (propuestas y campañas): muestra el
// inventario que SALIÓ del circuito — quitado, desplazado o por bloqueo — con
// opción de regresarlo a reservados (solo si sigue disponible y habilitado) y
// descarga CSV. Los items ya vienen filtrados por la cara seleccionada.

const fmtFecha = (s: string | null): string => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtPeriodo = (ini: string | null, fin: string | null): string => {
  const a = (ini || '').slice(0, 10);
  const b = (fin || '').slice(0, 10);
  if (a && b) return `${a} → ${b}`;
  return a || b || '—';
};

type Motivo = 'Bloqueado' | 'Desplazado' | 'Quitado';
const MOTIVO_META: Record<string, { icon: typeof Ban; cls: string }> = {
  Bloqueado: { icon: Lock, cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  Desplazado: { icon: ArrowRightLeft, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  Quitado: { icon: Trash2, cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
};

function Chip({ active, onClick, children, isDark }: { active: boolean; onClick: () => void; children: React.ReactNode; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${active
        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        : isDark
          ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:text-zinc-200'
          : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-800'}`}
    >
      {children}
    </button>
  );
}

interface Props {
  items: ReservaHistorialItem[];
  isDark: boolean;
  tipoPeriodo?: string;
  canEdit?: boolean;
  reReservandoId?: number | null; // reserva_id en curso (spinner)
  onReReservar?: (item: ReservaHistorialItem) => void;
}

export function HistorialInventarioPanel({ items, isDark, canEdit, reReservandoId, onReReservar }: Props) {
  const [q, setQ] = useState('');
  const [motivoFilter, setMotivoFilter] = useState<'all' | Motivo>('all');
  const [soloDisponibles, setSoloDisponibles] = useState(false);

  const motivosPresentes = useMemo(() => {
    const s = new Set<string>();
    items.forEach(it => s.add(it.motivo_salida));
    return (['Quitado', 'Desplazado', 'Bloqueado'] as Motivo[]).filter(m => s.has(m));
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(it => {
      if (motivoFilter !== 'all' && it.motivo_salida !== motivoFilter) return false;
      if (soloDisponibles && !it.disponible) return false;
      if (s && !`${it.codigo_unico || ''} ${it.ubicacion || ''} ${it.formato || ''} ${it.plaza || ''} ${it.municipio || ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, q, motivoFilter, soloDisponibles]);

  const nDisponibles = useMemo(() => filtered.filter(it => it.disponible).length, [filtered]);

  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-purple-300/80' : 'text-purple-700'}`;
  const td = `px-3 py-2.5 text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'}`;

  const downloadCsv = () => {
    const header = ['Codigo', 'Ubicacion', 'Mueble', 'Plaza', 'Municipio', 'Motivo salida', 'Estatus previo', 'Fecha salida', 'Periodo', 'Disponible'];
    const filas = filtered.map(it => [
      it.codigo_unico || '',
      it.ubicacion || '',
      it.formato || '',
      it.plaza || '',
      it.municipio || '',
      it.motivo_salida || '',
      it.estatus || '',
      fmtFecha(it.deleted_at),
      fmtPeriodo(it.inicio_periodo, it.fin_periodo),
      it.disponible ? 'Si' : `No (${it.motivo_no_disponible || ''})`,
    ]);
    const csv = [header, ...filas].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historial_inventario_circuito.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header + filtros */}
      <div className={`px-4 pt-3 pb-2.5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
            <History className="h-4 w-4" />
            Historial del circuito
            <span className={`text-xs font-normal ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>({items.length} · {nDisponibles} disponible{nDisponibles !== 1 ? 's' : ''})</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar código, ubicación…"
                className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border w-52 focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${isDark ? 'bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'}`}
              />
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              title="Descargar CSV"
              className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(motivosPresentes.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <span className={`text-[10px] uppercase font-semibold tracking-wide ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Motivo</span>
            <Chip active={motivoFilter === 'all'} onClick={() => setMotivoFilter('all')} isDark={isDark}>Todos</Chip>
            {motivosPresentes.map(m => (
              <Chip key={m} active={motivoFilter === m} onClick={() => setMotivoFilter(m)} isDark={isDark}>{m}</Chip>
            ))}
            <span className={`h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
            <Chip active={soloDisponibles} onClick={() => setSoloDisponibles(v => !v)} isDark={isDark}>Solo disponibles</Chip>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            <History className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">{items.length === 0 ? 'Sin movimientos en este circuito' : 'Sin resultados con esos filtros'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className={`${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} sticky top-0`}>
              <tr>
                <th className={th}>Código</th>
                <th className={th}>Ubicación / Mueble</th>
                <th className={th}>Plaza</th>
                <th className={th}>Motivo</th>
                <th className={th}>Estatus previo</th>
                <th className={th}>Salió</th>
                <th className={`${th} text-right`}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, i) => {
                const meta = MOTIVO_META[it.motivo_salida] || MOTIVO_META.Quitado;
                const Icon = meta.icon;
                const enCurso = reReservandoId === it.reserva_id;
                return (
                  <tr key={`${it.reserva_id}-${i}`} className={`border-t ${isDark ? 'border-zinc-800 hover:bg-purple-500/5' : 'border-gray-100 hover:bg-purple-50/40'}`}>
                    <td className={`${td} font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{it.codigo_unico || '—'}</td>
                    <td className={td}>
                      <div className="truncate max-w-[220px]" title={it.ubicacion || ''}>{it.ubicacion || '—'}</div>
                      <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{it.formato || ''}</div>
                    </td>
                    <td className={td}>{it.plaza || it.municipio || '—'}</td>
                    <td className={td}>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${meta.cls}`}>
                        <Icon className="h-3 w-3" />{it.motivo_salida}
                      </span>
                    </td>
                    <td className={td}>{it.estatus || '—'}</td>
                    <td className={`${td} ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{fmtFecha(it.deleted_at)}</td>
                    <td className={`${td} text-right`}>
                      {canEdit && onReReservar ? (
                        it.disponible ? (
                          <button
                            type="button"
                            disabled={enCurso}
                            onClick={() => onReReservar(it)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            {enCurso ? (
                              <><div className="h-3 w-3 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" /> Regresando…</>
                            ) : (
                              <><RotateCcw className="h-3.5 w-3.5" /> Regresar</>
                            )}
                          </button>
                        ) : (
                          <span
                            title={it.motivo_no_disponible || 'No disponible'}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border cursor-help ${isDark ? 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                          >
                            <Ban className="h-3.5 w-3.5" /> {it.motivo_no_disponible || 'No disponible'}
                          </span>
                        )
                      ) : (
                        <span className={`text-[11px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{it.disponible ? 'Disponible' : (it.motivo_no_disponible || 'No disponible')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
