import { useMemo, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { categoriaDe } from '../../lib/historialTaxonomia';
import { formatHistorialDetalles } from '../../lib/historial';

// Historial embebido con buscador + filtros (rango de fechas, tipo de acción,
// usuario) para los detalles de Solicitud / Propuesta / Campaña. Encapsula el
// estado de filtros y la barra; cada vista pinta su propia fila vía `renderItem`,
// así no se toca su layout. El filtrado es CLIENT-SIDE sobre el array ya cargado.
// El "tipo de acción" usa la misma taxonomía que la página global (categoriaDe).

export interface HistItem {
  tipo?: string | null;
  accion?: string | null;
  fecha_hora?: string | Date | null;
  detalles?: string | null;
}

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Usuario de una fila: del JSON `detalles` (usuario / aprobadoPor / rechazadoPor).
function usuarioDe(it: HistItem): string {
  const d = it.detalles;
  if (!d) return '';
  const s = String(d).trim();
  if (!s.startsWith('{')) return '';
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    const u = o.usuario ?? o.aprobadoPor ?? o.rechazadoPor;
    return u ? String(u).trim() : '';
  } catch { return ''; }
}

export function HistorialFiltrado<T extends HistItem>({
  items,
  isDark,
  renderItem,
  maxH = 'max-h-[360px]',
  emptyLabel = 'Ningún registro coincide con los filtros',
}: {
  items: T[];
  isDark: boolean;
  renderItem: (item: T, idx: number) => ReactNode;
  maxH?: string;
  emptyLabel?: string;
}) {
  const lista = items || [];
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [usuarios, setUsuarios] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState(false);

  const catOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of lista) { const c = categoriaDe(it.tipo, it.accion); m.set(c.value, c.label); }
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [lista]);

  const userOpts = useMemo(() => {
    const s = new Set<string>();
    for (const it of lista) { const u = usuarioDe(it); if (u) s.add(u); }
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [lista]);

  const filtrados = useMemo(() => {
    const nq = norm(q.trim());
    const dDesde = desde ? new Date(`${desde}T00:00:00`) : null;
    const dHasta = hasta ? new Date(`${hasta}T23:59:59`) : null;
    return lista.filter((it) => {
      if (cats.size && !cats.has(categoriaDe(it.tipo, it.accion).value)) return false;
      if (usuarios.size) { const u = usuarioDe(it); if (!u || !usuarios.has(u)) return false; }
      if (dDesde || dHasta) {
        const f = it.fecha_hora ? new Date(it.fecha_hora) : null;
        if (!f || isNaN(f.getTime())) return false;
        if (dDesde && f < dDesde) return false;
        if (dHasta && f > dHasta) return false;
      }
      if (nq) {
        const hay = norm(`${it.accion || ''} ${formatHistorialDetalles(it.detalles)} ${usuarioDe(it)}`);
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
  }, [lista, q, desde, hasta, cats, usuarios]);

  const toggleSet = (set: Set<string>, setSet: (s: Set<string>) => void, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    setSet(n);
  };

  const nFiltros = (desde ? 1 : 0) + (hasta ? 1 : 0) + cats.size + usuarios.size;
  const hayAlgo = nFiltros > 0 || !!q;
  const limpiar = () => { setQ(''); setDesde(''); setHasta(''); setCats(new Set()); setUsuarios(new Set()); };

  const inputCls = `w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 placeholder-zinc-500' : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'}`;
  const chip = (active: boolean) => `px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${active
    ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
    : isDark ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-700'}`;
  const lbl = `text-[10px] uppercase font-semibold tracking-wide ${isDark ? 'text-zinc-500' : 'text-gray-400'}`;

  return (
    <div className="space-y-2">
      {/* Buscador + toggle de filtros + contador */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en el historial…"
            className={`${inputCls} pl-7`}
          />
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={`relative flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 ${abierto || nFiltros > 0
            ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
            : isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-300' : 'bg-white border-gray-300 text-gray-600'}`}
          title="Filtros avanzados"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {nFiltros > 0 && (
            <span className="ml-0.5 px-1.5 rounded-full bg-violet-500 text-white text-[10px] font-semibold">{nFiltros}</span>
          )}
        </button>
      </div>

      {/* Panel de filtros avanzados */}
      {abierto && (
        <div className={`rounded-xl border p-3 space-y-3 ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-50/70 border-gray-200'}`}>
          {/* Rango de fechas */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={`${lbl} block mb-1`}>Desde</label>
              <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`${lbl} block mb-1`}>Hasta</label>
              <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Tipo de acción */}
          {catOpts.length > 0 && (
            <div>
              <span className={`${lbl} block mb-1`}>Tipo de acción</span>
              <div className="flex flex-wrap gap-1.5">
                {catOpts.map((c) => (
                  <button key={c.value} type="button" className={chip(cats.has(c.value))} onClick={() => toggleSet(cats, setCats, c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Usuario */}
          {userOpts.length > 0 && (
            <div>
              <span className={`${lbl} block mb-1`}>Usuario</span>
              <div className="flex flex-wrap gap-1.5">
                {userOpts.map((u) => (
                  <button key={u} type="button" className={chip(usuarios.has(u))} onClick={() => toggleSet(usuarios, setUsuarios, u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contador + limpiar */}
      {hayAlgo && (
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {filtrados.length} de {lista.length}
          </span>
          <button type="button" onClick={limpiar} className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700'}`}>
            <X className="h-3 w-3" /> Limpiar filtros
          </button>
        </div>
      )}

      {/* Lista filtrada */}
      {filtrados.length === 0 ? (
        <div className={`text-center py-6 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{emptyLabel}</div>
      ) : (
        <div className={`space-y-2 ${maxH} overflow-y-auto scrollbar-purple pr-1`}>
          {filtrados.map((it, idx) => renderItem(it, idx))}
        </div>
      )}
    </div>
  );
}
