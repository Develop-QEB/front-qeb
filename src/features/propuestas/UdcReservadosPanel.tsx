import { useMemo, useState, type ReactNode } from 'react';
import { Plane, Monitor, Clock, Users, Search, Maximize2, CheckSquare, Square, Trash2 } from 'lucide-react';
import { UDC_ZONAS_ORDEN, udcFichaDe } from '../../lib/udc';

// Panel de "inventario reservado" UDC (aeropuerto AICM) para la tab "Mis
// Reservados" del buscador. Mismo look de tarjetas que UdcFichaTecnicaPanel
// (ficha de "Buscar disponible"), pero mostrando lo YA reservado, con badge de
// tipo (Flujo / Bonificación), checkbox de selección y borrar por tarjeta.
// Enriquece cada reserva con la ficha técnica (medida · duración · reel) por
// coincidencia de codigo_unico = nombre de pantalla.

export interface UdcReservadoItem {
  id: string;
  codigo_unico: string;
  tipo: 'Flujo' | 'Contraflujo' | 'Bonificacion';
  formato?: string;
  articulo?: string;
}

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

interface UdcReservadosPanelProps {
  items: UdcReservadoItem[];
  isDark: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleVisible?: (ids: string[], allSelected: boolean) => void;
  onDelete?: (id: string) => void;
  onBulkDelete?: () => void;
  canEdit?: boolean;
  esCortesia?: boolean; // BF/CT: la "Bonificación" se rotula "Cortesía"
}

export function UdcReservadosPanel({ items, isDark, selected, onToggle, onToggleVisible, onDelete, onBulkDelete, canEdit, esCortesia }: UdcReservadosPanelProps) {
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState<string | 'all'>('all');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'renta' | 'Bonificacion'>('all');

  const enriched = useMemo(() => items.map(it => {
    const f = udcFichaDe(it.codigo_unico);
    return {
      ...it,
      zona: f?.zona ?? 'Otras',
      ancho: f?.ancho ?? null,
      alto: f?.alto ?? null,
      medida: f?.medida ?? (it.formato || '—'),
      duracion: f?.duracion ?? null,
      reel: f?.reel ?? null,
    };
  }), [items]);
  type Enriched = (typeof enriched)[number];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(it => {
      if (zonaFilter !== 'all' && it.zona !== zonaFilter) return false;
      if (tipoFilter === 'Bonificacion' && it.tipo !== 'Bonificacion') return false;
      if (tipoFilter === 'renta' && it.tipo === 'Bonificacion') return false;
      if (q && !(`${it.codigo_unico} ${it.medida} ${it.zona} ${it.articulo || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [enriched, search, zonaFilter, tipoFilter]);

  const porZona = useMemo(() => {
    const map = new Map<string, Enriched[]>();
    for (const z of UDC_ZONAS_ORDEN) map.set(z, []);
    for (const it of filtered) {
      if (!map.has(it.zona)) map.set(it.zona, []);
      map.get(it.zona)!.push(it);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0);
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map(it => it.id), [filtered]);
  const selVisibles = useMemo(() => visibleIds.filter(id => selected.has(id)).length, [visibleIds, selected]);
  const todasVisiblesSel = visibleIds.length > 0 && selVisibles === visibleIds.length;

  const zonasPresentes = useMemo(() => UDC_ZONAS_ORDEN.filter(z => enriched.some(it => it.zona === z)), [enriched]);
  const hayBonif = useMemo(() => enriched.some(it => it.tipo === 'Bonificacion'), [enriched]);

  const cardCls = isDark ? 'bg-zinc-800/40 border-zinc-700/50' : 'bg-white border-gray-200';
  const cardSelCls = 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30';
  const subtle = isDark ? 'text-zinc-500' : 'text-gray-400';
  const bonifLabel = esCortesia ? 'Cortesía' : 'Bonificación';

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
              <h3 className={`text-sm font-semibold leading-tight ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Reservados UDC</h3>
              <p className={`text-[10px] ${subtle}`}>Aeropuerto AICM · pantallas digitales</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && selected.size > 0 && onBulkDelete && (
              <button
                type="button"
                onClick={onBulkDelete}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar ({selected.size})
              </button>
            )}
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              {filtered.length} / {items.length}
            </span>
          </div>
        </div>

        {/* Barra de filtros horizontal ("al largo"), igual que "Buscar disponible" */}
        <div className="flex items-center gap-2 flex-wrap mt-2.5">
          <div className="relative w-52 max-w-full">
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

          {zonasPresentes.length > 0 && (
            <>
              <span className={`h-5 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
              <span className={`text-[10px] uppercase font-semibold tracking-wide ${subtle}`}>Zona</span>
              <Chip active={zonaFilter === 'all'} onClick={() => setZonaFilter('all')} isDark={isDark}>Todas</Chip>
              {zonasPresentes.map(z => (
                <Chip key={z} active={zonaFilter === z} onClick={() => setZonaFilter(z)} isDark={isDark}>{z}</Chip>
              ))}
            </>
          )}

          {hayBonif && (
            <>
              <span className={`h-5 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
              <span className={`text-[10px] uppercase font-semibold tracking-wide ${subtle}`}>Tipo</span>
              <Chip active={tipoFilter === 'all'} onClick={() => setTipoFilter('all')} isDark={isDark}>Todos</Chip>
              <Chip active={tipoFilter === 'renta'} onClick={() => setTipoFilter('renta')} isDark={isDark}>Renta</Chip>
              <Chip active={tipoFilter === 'Bonificacion'} onClick={() => setTipoFilter('Bonificacion')} isDark={isDark}>{bonifLabel}</Chip>
            </>
          )}

          <div className="flex-1 min-w-[8px]" />

          {onToggleVisible && (
            <button
              type="button"
              onClick={() => onToggleVisible(visibleIds, todasVisiblesSel)}
              disabled={visibleIds.length === 0}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border disabled:opacity-40 ${todasVisiblesSel
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : isDark
                  ? 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:text-white'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:text-gray-900'}`}
            >
              {todasVisiblesSel ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {todasVisiblesSel ? 'Quitar selección' : 'Seleccionar todo'}
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {porZona.length === 0 && (
          <div className={`flex flex-col items-center justify-center h-full ${subtle}`}>
            <Monitor className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">{items.length === 0 ? 'Aún no hay pantallas reservadas' : 'Sin pantallas con esos filtros'}</p>
          </div>
        )}
        {porZona.map(([zona, arr]) => (
          <div key={zona}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{zona}</span>
              <span className={`text-[10px] ${subtle}`}>· {arr.length} pantalla{arr.length !== 1 ? 's' : ''}</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
            </div>
            <div className="space-y-2">
              {arr.map(it => {
                const checked = selected.has(it.id);
                const esBonif = it.tipo === 'Bonificacion';
                return (
                  <div
                    key={it.id}
                    onClick={() => onToggle(it.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer hover:border-cyan-500/40 ${checked ? cardSelCls : cardCls}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(it.id)}
                      onClick={e => e.stopPropagation()}
                      className="checkbox-purple shrink-0"
                    />
                    <AspectPreview ancho={it.ancho} alto={it.alto} isDark={isDark} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{it.codigo_unico}</div>
                      <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        <Monitor className="h-3 w-3" />
                        <span className="truncate">{it.medida}{it.ancho && it.alto ? ' px' : ''}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${esBonif
                        ? (esCortesia ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25')
                        : 'bg-blue-500/15 text-blue-300 border-blue-500/25'}`}>
                        {esBonif ? bonifLabel : 'Renta'}
                      </span>
                      {it.duracion != null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          <Clock className="h-3 w-3" />{it.duracion} seg
                        </span>
                      )}
                    </div>
                    {canEdit && onDelete && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onDelete(it.id); }}
                        title="Eliminar reserva"
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
