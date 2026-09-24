import { useMemo, useState, type ReactNode } from 'react';
import { Monitor, Clock, Users, Search, Plane, Maximize2, CheckSquare, Square, Download } from 'lucide-react';
import { UDC_FICHA_TECNICA, UDC_ZONAS_ORDEN, udcPantallaNum, type UdcPantalla } from '../../lib/udc';

// Panel de "lista de inventarios" UDC (aeropuerto AICM). Reemplaza al mapa en el
// buscador cuando la propuesta/campaña es UDC: los inventarios del aeropuerto no
// tienen geolocalización, así que en vez del mapa mostramos la ficha técnica
// (zona · medida · duración · reel) en una lista filtrable.
//
// Si se pasan props de selección (selected/keyByNombre/onToggle) el panel se
// vuelve INTERACTIVO: cada pantalla es el inventario seleccionable (checkbox) y
// engancha al flujo de reserva del modal. Sin esas props queda como ficha de
// solo lectura (compatibilidad).

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

interface UdcFichaTecnicaPanelProps {
  isDark: boolean;
  // Selección (opcional): habilita checkboxes y engancha al flujo de reserva.
  selected?: Set<string>;
  keyByNombre?: Map<string, string>;
  onToggle?: (key: string) => void;
  // Marca/desmarca todas las pantallas visibles (según filtros actuales).
  onToggleVisible?: (keys: string[], allSelected: boolean) => void;
}

export function UdcFichaTecnicaPanel({ isDark, selected, keyByNombre, onToggle, onToggleVisible }: UdcFichaTecnicaPanelProps) {
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState<string | 'all'>('all');
  const [durFilter, setDurFilter] = useState<number | 'all'>('all');

  const selectable = !!(selected && keyByNombre && onToggle);
  const keyOf = (p: UdcPantalla): string | undefined => keyByNombre?.get(udcPantallaNum(p.nombre));
  const isChecked = (p: UdcPantalla): boolean => {
    const k = keyOf(p);
    return !!(k && selected?.has(k));
  };

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

  // Selección sobre lo VISIBLE (para el "seleccionar todo" del header).
  const visibleKeys = useMemo(
    () => (selectable ? filtradas.map(keyOf).filter((k): k is string => !!k) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtradas, keyByNombre, selectable]
  );
  const seleccionadasVisibles = useMemo(
    () => visibleKeys.filter(k => selected?.has(k)).length,
    [visibleKeys, selected]
  );
  const todasVisiblesSel = visibleKeys.length > 0 && seleccionadasVisibles === visibleKeys.length;

  const cardCls = isDark ? 'bg-zinc-800/40 border-zinc-700/50' : 'bg-white border-gray-200';
  const cardSelCls = 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30';
  const subtle = isDark ? 'text-zinc-500' : 'text-gray-400';

  const totalSel = selectable ? (selected?.size ?? 0) : 0;

  // Descargar la lista visible (según filtros) como CSV — equivalente al botón
  // de descarga del buscador estándar, pero con los campos de la ficha UDC.
  const downloadCsv = () => {
    const header = ['Pantalla', 'Zona', 'Medida (px)', 'Duracion (seg)', 'Anunciantes (reel)'];
    const filas = filtradas.map(p => [
      p.nombre,
      p.zona,
      p.ancho && p.alto ? `${p.ancho}x${p.alto}` : p.medida,
      String(p.duracion),
      String(p.reel),
    ]);
    const csv = [header, ...filas]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventario_udc_aicm.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="flex items-center gap-2">
            {selectable && totalSel > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {totalSel} sel.
              </span>
            )}
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              {filtradas.length} / {UDC_FICHA_TECNICA.length}
            </span>
          </div>
        </div>

        {/* Barra de filtros horizontal ("al largo"), estilo buscador estándar:
            búsqueda + zona + duración a lo ancho, y acciones (seleccionar todo,
            descargar) a la derecha. Solo van los filtros que aplican a UDC. */}
        <div className="flex items-center gap-2 flex-wrap mt-2.5">
          {/* Búsqueda */}
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

          <span className={`h-5 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />

          {/* Zona */}
          <span className={`text-[10px] uppercase font-semibold tracking-wide ${subtle}`}>Zona</span>
          <Chip active={zonaFilter === 'all'} onClick={() => setZonaFilter('all')} isDark={isDark}>Todas</Chip>
          {UDC_ZONAS_ORDEN.map(z => (
            <Chip key={z} active={zonaFilter === z} onClick={() => setZonaFilter(z)} isDark={isDark}>{z}</Chip>
          ))}

          <span className={`h-5 w-px ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />

          {/* Duración */}
          <span className={`text-[10px] uppercase font-semibold tracking-wide ${subtle}`}>Duración</span>
          <Chip active={durFilter === 'all'} onClick={() => setDurFilter('all')} isDark={isDark}>Cualquiera</Chip>
          {duraciones.map(d => (
            <Chip key={d} active={durFilter === d} onClick={() => setDurFilter(d)} isDark={isDark}>{d} seg</Chip>
          ))}

          {/* Empuja las acciones a la derecha */}
          <div className="flex-1 min-w-[8px]" />

          {/* Seleccionar todo (visible) */}
          {selectable && (
            <button
              type="button"
              onClick={() => onToggleVisible?.(visibleKeys, todasVisiblesSel)}
              disabled={visibleKeys.length === 0}
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

          {/* Descargar CSV */}
          <button
            type="button"
            onClick={downloadCsv}
            disabled={filtradas.length === 0}
            title="Descargar CSV"
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${isDark
              ? 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
          >
            <Download className="h-4 w-4" />
          </button>
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
              {items.map(p => {
                const checked = isChecked(p);
                const k = keyOf(p);
                return (
                  <div
                    key={p.nombre}
                    onClick={selectable && k ? () => onToggle?.(k) : undefined}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${checked ? cardSelCls : cardCls} ${selectable ? 'cursor-pointer hover:border-cyan-500/40' : 'hover:border-cyan-500/40'}`}
                  >
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => k && onToggle?.(k)}
                        onClick={e => e.stopPropagation()}
                        className="checkbox-purple shrink-0"
                      />
                    )}
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
                    </div>
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
