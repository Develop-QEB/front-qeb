import { useMemo, useState, useEffect, useRef } from 'react';
import { X, Download, Search, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { buildVersionarioArtesPreview } from '../../utils/exportVersionarioArtes';
import type { VersionarioArtesPreviewRow } from '../../utils/exportVersionarioArtes';
import type { Campana } from '../../types';
import type { InventarioConArte } from '../../services/campanas.service';

// =====================================================================
// VersionarioArtesPreviewModal — Preview tabular del Excel "Versionario Artes"
// con lazy-load por campaña: solo fetcheamos los inventarios de las campañas
// visibles en la pagina actual. Las demas quedan como placeholder hasta que
// el usuario navegue a su pagina.
// =====================================================================

export interface VersionarioCacheEntry {
  campana: Campana;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  items?: InventarioConArte[];
  digitalFilesByReserva?: Map<number, string[]>;
  notesByUrl?: Map<string, string>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campanas: Campana[]; // todas las campañas (orden estable)
  cache: Map<number, VersionarioCacheEntry>;
  onFetchIds: (ids: number[]) => void; // pide fetch de campañas pending
  onDownload: () => void;
  isDownloading: boolean;
}

const PAGE_SIZE_CAMPANAS = 25; // campañas por pagina

const HEADERS = [
  'Plaza', 'Tipo', 'Asesor Comercial', 'APS Global - ID QEB', 'CUIC',
  'Fecha Inicio Periodo', 'Fecha Fin Periodo', 'Cliente Comercial',
  'Marca', 'Campaña', 'Número de artículo', 'Artículo', 'Caras', 'Tarifa',
  'Notas', 'Nombre Arte',
];

// Miniatura de arte; si la imagen no carga muestra placeholder.
function ArteThumb({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);
  const isDark = useThemeStore(s => s.theme) === 'dark';
  if (errored || !url) {
    return (
      <div className={`w-16 h-12 rounded flex items-center justify-center ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
        <ImageIcon className={`h-4 w-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      className="w-16 h-12 rounded overflow-hidden border border-zinc-700 hover:border-purple-400/60 transition-colors bg-zinc-800"
      title="Abrir arte en nueva pestaña"
    >
      <img src={url} alt="arte" loading="lazy" onError={() => setErrored(true)} className="w-full h-full object-cover" />
    </button>
  );
}

// Tipo de fila renderizable: o es una fila de datos real, o es un placeholder
// de una campaña que aun no se cargo.
type DisplayRow =
  | { kind: 'data'; row: VersionarioArtesPreviewRow }
  | { kind: 'placeholder'; campana: Campana; status: 'pending' | 'loading' | 'error' };

export function VersionarioArtesPreviewModal({ isOpen, onClose, campanas, cache, onFetchIds, onDownload, isDownloading }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  // Dedupe de ids ya solicitados: evita disparar el mismo fetch dos veces
  // y elimina la posibilidad de loop por re-render del prop `cache`.
  const requestedRef = useRef<Set<number>>(new Set());

  // Reset paginacion/search + dedupe set al cerrar/abrir
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
      setSearch('');
      requestedRef.current = new Set();
    }
  }, [isOpen]);

  // Estado agregado de carga global (para el header)
  const loadedCount = useMemo(() => {
    let n = 0;
    for (const c of campanas) {
      const e = cache.get(c.id);
      if (e && e.status === 'loaded') n++;
    }
    return n;
  }, [campanas, cache]);
  const allLoaded = loadedCount === campanas.length && campanas.length > 0;

  // Total de paginas (basadas en campañas — granularidad estable)
  const totalPages = Math.max(1, Math.ceil(campanas.length / PAGE_SIZE_CAMPANAS));
  const safePage = Math.min(currentPage, totalPages);

  // Campañas visibles en la pagina actual
  const visibleCampanas = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE_CAMPANAS;
    return campanas.slice(start, start + PAGE_SIZE_CAMPANAS);
  }, [campanas, safePage]);

  // Pide fetch de las campañas visibles que aun esten pending y NO hayan sido
  // solicitadas ya en esta sesion. Importante: NO depender de `cache` aqui
  // para no re-disparar cada vez que cache cambia (cambia con cada fetch).
  useEffect(() => {
    if (!isOpen) return;
    const pendingIds: number[] = [];
    for (const c of visibleCampanas) {
      if (requestedRef.current.has(c.id)) continue;
      const e = cache.get(c.id);
      if (e && e.status === 'pending') {
        pendingIds.push(c.id);
        requestedRef.current.add(c.id);
      }
    }
    if (pendingIds.length > 0) onFetchIds(pendingIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visibleCampanas, onFetchIds]);

  // Calculamos arteCols a partir SOLO de lo cargado (para el header dinamico)
  const arteColsLoaded = useMemo(() => {
    let max = 0;
    for (const c of campanas) {
      const e = cache.get(c.id);
      if (e && e.status === 'loaded' && e.items) {
        const { arteCols } = buildVersionarioArtesPreview({
          campanas: [{ campana: e.campana, items: e.items, digitalFilesByReserva: e.digitalFilesByReserva, notesByUrl: e.notesByUrl }],
        });
        if (arteCols > max) max = arteCols;
      }
    }
    return max;
  }, [campanas, cache]);

  // Filas a mostrar en la pagina visible (data o placeholder).
  // Para cada campaña visible:
  // - loaded: 1+ filas reales (por plaza)
  // - pending/loading/error: 1 placeholder
  const displayRows: DisplayRow[] = useMemo(() => {
    const out: DisplayRow[] = [];
    for (const c of visibleCampanas) {
      const e = cache.get(c.id);
      if (e && e.status === 'loaded' && e.items) {
        const { rows } = buildVersionarioArtesPreview({
          campanas: [{ campana: e.campana, items: e.items, digitalFilesByReserva: e.digitalFilesByReserva, notesByUrl: e.notesByUrl }],
        });
        if (rows.length === 0) {
          out.push({ kind: 'placeholder', campana: c, status: 'pending' });
        } else {
          for (const r of rows) out.push({ kind: 'data', row: r });
        }
      } else {
        const st: 'pending' | 'loading' | 'error' = e?.status === 'loading' ? 'loading'
          : e?.status === 'error' ? 'error' : 'pending';
        out.push({ kind: 'placeholder', campana: c, status: st });
      }
    }
    return out;
  }, [visibleCampanas, cache]);

  // Aplicamos search SOLO a las filas de datos (placeholders no se ocultan)
  const filteredRows: DisplayRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayRows;
    return displayRows.filter(r => {
      if (r.kind === 'placeholder') {
        // Permitir matchear placeholders por nombre/id de campaña
        const hay = [r.campana.nombre, r.campana.nombre_campania, String(r.campana.id)].filter(Boolean).join(' | ').toLowerCase();
        return hay.includes(q);
      }
      const row = r.row;
      const hay = [row.plaza, row.tipo, row.asesor, row.cuic, row.cliente, row.marca, row.campania, row.numeroArticulo, row.articulo, row.notas, row.nombreArte, String(row.apsQebId)].join(' | ').toLowerCase();
      return hay.includes(q);
    });
  }, [displayRows, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative w-full max-w-[95vw] mx-4 h-[92vh] flex flex-col rounded-xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-purple-500/30' : 'bg-white border-purple-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <ImageIcon className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Versionario Artes — Preview</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {campanas.length} campañas en total • {loadedCount} cargada(s) {!allLoaded && '• las demás se cargan al navegar por las páginas'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className={`flex items-center justify-between gap-3 px-4 py-2 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`relative flex items-center gap-2 px-2 py-1 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 focus-within:border-purple-500' : 'bg-white border-gray-300 focus-within:border-purple-500'} w-80 max-w-full`}>
            <Search className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar plaza, cliente, campaña, artículo..."
              className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`shrink-0 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Página {safePage} de {totalPages} (de {campanas.length} campañas)</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className={`px-2 py-1 rounded text-xs ${safePage === 1 ? 'opacity-40 cursor-not-allowed' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className={`px-2 py-1 rounded text-xs ${safePage === totalPages ? 'opacity-40 cursor-not-allowed' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto">
          {campanas.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8">
              <p>No hay datos para mostrar.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className={`sticky top-0 z-10 ${isDark ? 'bg-purple-900/40 text-purple-200' : 'bg-purple-100 text-purple-800'}`}>
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} className="p-2 font-semibold text-left whitespace-nowrap border-b border-purple-500/30">{h}</th>
                  ))}
                  {Array.from({ length: arteColsLoaded }).map((_, i) => (
                    <th key={`arte-${i}`} className="p-2 font-semibold text-left whitespace-nowrap border-b border-purple-500/30">Arte {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((dr, idx) => {
                  if (dr.kind === 'placeholder') {
                    return (
                      <tr key={`ph-${dr.campana.id}`} className={`border-b ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                        <td colSpan={HEADERS.length + Math.max(arteColsLoaded, 1)} className={`p-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          {dr.status === 'error' ? (
                            <span className="inline-flex items-center gap-1.5 text-red-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Error al cargar — APS {dr.campana.id} {dr.campana.nombre ? `• ${dr.campana.nombre}` : ''}
                            </span>
                          ) : dr.status === 'loading' ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                              Cargando APS {dr.campana.id} {dr.campana.nombre ? `• ${dr.campana.nombre}` : ''}...
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 opacity-60">
                              <span className="h-2 w-2 rounded-full bg-zinc-500" />
                              Pendiente: APS {dr.campana.id} {dr.campana.nombre ? `• ${dr.campana.nombre}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                  const r = dr.row;
                  return (
                    <tr key={`${r.apsQebId}-${r.plaza}-${idx}`} className={`border-b ${isDark ? 'border-zinc-800 hover:bg-purple-900/10' : 'border-gray-100 hover:bg-purple-50'}`}>
                      <td className="p-2 whitespace-nowrap">{r.plaza}</td>
                      <td className="p-2 whitespace-nowrap">{r.tipo}</td>
                      <td className="p-2 whitespace-nowrap">{r.asesor}</td>
                      <td className="p-2 whitespace-nowrap">{r.apsQebId}</td>
                      <td className="p-2 whitespace-nowrap">{r.cuic}</td>
                      <td className="p-2 whitespace-nowrap">{r.fechaInicio}</td>
                      <td className="p-2 whitespace-nowrap">{r.fechaFin}</td>
                      <td className="p-2 whitespace-nowrap max-w-[180px] truncate" title={r.cliente}>{r.cliente}</td>
                      <td className="p-2 whitespace-nowrap">{r.marca}</td>
                      <td className="p-2 whitespace-nowrap max-w-[200px] truncate" title={r.campania}>{r.campania}</td>
                      <td className="p-2 whitespace-nowrap">{r.numeroArticulo}</td>
                      <td className="p-2 whitespace-nowrap">{r.articulo}</td>
                      <td className="p-2 text-right">{r.caras}</td>
                      <td className="p-2 text-right">{typeof r.tarifa === 'number' ? r.tarifa.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : r.tarifa}</td>
                      <td className="p-2 max-w-[260px] whitespace-pre-wrap text-[11px]">{r.notas || '-'}</td>
                      <td className="p-2 max-w-[260px] whitespace-pre-wrap text-[11px]">{r.nombreArte || '-'}</td>
                      {Array.from({ length: arteColsLoaded }).map((_, i) => (
                        <td key={`a-${idx}-${i}`} className="p-2">
                          {r.artesUrls[i] ? <ArteThumb url={r.artesUrls[i]} /> : <span className="text-zinc-600">-</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}>
            Cerrar
          </button>
          <div className="flex items-center gap-3">
            {!allLoaded && !isDownloading && (
              <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                Al descargar se cargarán las {campanas.length - loadedCount} campañas restantes
              </span>
            )}
            <button
              onClick={onDownload}
              disabled={isDownloading || campanas.length === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                !isDownloading && campanas.length > 0
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : isDark ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Generando Excel...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
