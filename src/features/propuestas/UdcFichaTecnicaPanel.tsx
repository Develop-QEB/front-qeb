import { useMemo, useState, type ReactNode } from 'react';
import { Monitor, Clock, Users, Search, Plane, Maximize2 } from 'lucide-react';
import { UDC_FICHA_TECNICA, UDC_ZONAS_ORDEN, type UdcPantalla } from '../../lib/udc';

// Panel de "lista de inventarios" UDC (aeropuerto AICM). Reemplaza al mapa en el
// buscador cuando la propuesta/campaña es UDC: los inventarios del aeropuerto no
// tienen geolocalización, así que en vez del mapa mostramos la ficha técnica
// (zona · medida · duración · reel) en una lista filtrable.

// Mini-preview con el aspect-ratio real de la pantalla (px reales escalados).
function AspectPreview({ ancho, alto, isDark }: { ancho: number | null; alto: number | null; isDark: boolean }) {
  const BOX_W = 72, BOX_H = 46;
  if (!ancho || !alto) {
    return (
      <div
        className={`flex items-center justify-center rounded border border-dashed ${isDark ? 'border-zinc-600 text-zinc-500' : 'border-gray-300 text-gray-400'}`}
        style={{ width: BOX_W, height: BOX_H }}
      >
        <Maximize2 className="h-4 w-4" />
      </div>
    );
  }
  const ratio = ancho / alto;
  let w = BOX_W, h = BOX_W / ratio;
  if (h > BOX_H) { h = BOX_H; w = BOX_H * ratio; }
  return (
    <div className="flex items-center justify-center" style={{ width: BOX_W, height: BOX_H }}>
      <div
        className="rounded-[3px] bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-sm ring-1 ring-cyan-300/40"
        style={{ width: Math.max(8, w), height: Math.max(6, h) }}
        title={`${ancho} × ${alto}px`}
      />
    </div>
  );
}

function Chip({ active, onClick, children, isDark }: { active: boolean; onClick: () => void; children: ReactNode; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${active
        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        : isDark
          ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:text-zinc-200'
          : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-800'}`}
    >
      {children}
    </button>
  );
}

export function UdcFichaTecnicaPanel({ isDark }: { isDark: boolean }) {
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState<string | 'all'>('all');
  const [durFilter, setDurFilter] = useState<number | 'all'>('all');

  const duraciones = useMemo(
    () => Array.from(new Set(UDC_FICHA_TECNICA.map(p => p.duracion))).sort((a, b) => a - b),
    []
  );

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return UDC_FICHA_TECNICA.filter(p => {
      if (zonaFilter !== 'all' && p.zona !== zonaFilter) return false;
      if (durFilter !== 'all' && p.duracion !== durFilter) return false;
      if (q && !(`${p.nombre} ${p.medida} ${p.zona}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, zonaFilter, durFilter]);

  const porZona = useMemo(() => {
    const map = new Map<string, UdcPantalla[]>();
    for (const z of UDC_ZONAS_ORDEN) map.set(z, []);
    for (const p of filtradas) {
      if (!map.has(p.zona)) map.set(p.zona, []);
      map.get(p.zona)!.push(p);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [filtradas]);

  const cardCls = isDark ? 'bg-zinc-800/40 border-zinc-700/50' : 'bg-white border-gray-200';
  const subtle = isDark ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-zinc-900/40' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`px-4 pt-3 pb-2.5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Plane className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold leading-tight ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Inventario UDC</h3>
              <p className={`text-[10px] ${subtle}`}>Aeropuerto AICM · pantallas digitales</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {filtradas.length} / {UDC_FICHA_TECNICA.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-2.5">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${subtle}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pantalla o medida…"
            className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${isDark
              ? 'bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600'
              : 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-400'}`}
          />
        </div>

        {/* Filtros: zona */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Chip active={zonaFilter === 'all'} onClick={() => setZonaFilter('all')} isDark={isDark}>Todas las zonas</Chip>
          {UDC_ZONAS_ORDEN.map(z => (
            <Chip key={z} active={zonaFilter === z} onClick={() => setZonaFilter(z)} isDark={isDark}>{z}</Chip>
          ))}
        </div>
        {/* Filtros: duración */}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Chip active={durFilter === 'all'} onClick={() => setDurFilter('all')} isDark={isDark}>Cualquier duración</Chip>
          {duraciones.map(d => (
            <Chip key={d} active={durFilter === d} onClick={() => setDurFilter(d)} isDark={isDark}>{d} seg</Chip>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {porZona.length === 0 && (
          <div className={`flex flex-col items-center justify-center h-full ${subtle}`}>
            <Monitor className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Sin pantallas con esos filtros</p>
          </div>
        )}
        {porZona.map(([zona, items]) => (
          <div key={zona}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{zona}</span>
              <span className={`text-[10px] ${subtle}`}>· {items.length} pantalla{items.length !== 1 ? 's' : ''}</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
            </div>
            <div className="space-y-2">
              {items.map(p => (
                <div key={p.nombre} className={`flex items-center gap-3 p-2.5 rounded-xl border ${cardCls} transition-colors hover:border-cyan-500/40`}>
                  <AspectPreview ancho={p.ancho} alto={p.alto} isDark={isDark} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{p.nombre}</div>
                    <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      <Monitor className="h-3 w-3" />
                      <span className="truncate">{p.medida}{p.ancho && p.alto ? ' px' : ''}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      <Clock className="h-3 w-3" />{p.duracion} seg
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                      <Users className="h-3 w-3" />{p.reel} anunciantes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
