import { useMemo, useState, useEffect } from 'react';
import { X, Download, Search, Image as ImageIcon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import type { VersionarioArtesPreview, VersionarioArtesPreviewRow } from '../../utils/exportVersionarioArtes';

// =====================================================================
// VersionarioArtesPreviewModal — Preview tabular del Excel "Versionario Artes"
// antes de descargar. Mismas columnas que el export, con paginacion y busqueda.
// =====================================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preview: VersionarioArtesPreview | null;
  isLoading: boolean;
  isDownloading: boolean;
  loadingProgress?: { current: number; total: number };
  onDownload: () => void;
}

const PAGE_SIZE = 25;

// Miniatura de arte que usa el proxy del backend para evitar CORS.
function ArteThumb({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);
  const isDark = useThemeStore(s => s.theme) === 'dark';
  // Para previews evitamos descargar binarios y usamos directo la url
  // (las miniaturas son pequenas y casi siempre cargan por CORS publico
  // de Spaces; si falla mostramos icono).
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
      <img
        src={url}
        alt="arte"
        loading="lazy"
        onError={() => setErrored(true)}
        className="w-full h-full object-cover"
      />
    </button>
  );
}

export function VersionarioArtesPreviewModal({ isOpen, onClose, preview, isLoading, isDownloading, loadingProgress, onDownload }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  // Reset paginacion/search al cerrar/abrir
  useEffect(() => { if (!isOpen) { setCurrentPage(1); setSearch(''); } }, [isOpen]);

  // Filas filtradas por busqueda libre (todas las columnas de texto)
  const filteredRows: VersionarioArtesPreviewRow[] = useMemo(() => {
    if (!preview) return [];
    const q = search.trim().toLowerCase();
    if (!q) return preview.rows;
    return preview.rows.filter(r => {
      const haystack = [r.plaza, r.tipo, r.asesor, r.cuic, r.cliente, r.marca, r.campania, r.numeroArticulo, r.articulo, r.notas, r.nombreArte, String(r.apsQebId)]
        .join(' | ').toLowerCase();
      return haystack.includes(q);
    });
  }, [preview, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Cuando cambia el filtro, reset a pagina 1
  useEffect(() => { setCurrentPage(1); }, [search]);

  if (!isOpen) return null;

  const arteCols = preview?.arteCols || 0;
  const totalFilas = preview?.rows.length || 0;

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
                {isLoading
                  ? `Cargando datos${loadingProgress ? ` ${loadingProgress.current}/${loadingProgress.total}` : ''}...`
                  : `${totalFilas} fila(s) listas para descargar`}
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
            {!isLoading && (
              <span>{filteredRows.length} mostradas{search ? ` (filtrado de ${totalFilas})` : ''}</span>
            )}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className={`px-2 py-1 rounded text-xs ${safePage === 1 ? 'opacity-40 cursor-not-allowed' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}
                >
                  Anterior
                </button>
                <span className="px-2">{safePage} / {totalPages}</span>
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
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-5 p-8">
              {/* Logo QEB con animate-pulse — mismo patron que LoadingScreen */}
              <img
                src={isDark ? '/images/logo-bco.png' : '/images/logo-ooh.png'}
                alt="QEB"
                className="h-12 w-auto animate-[pulse_2s_ease-in-out_infinite]"
              />
              {/* Progress bar morada (replica de LoadingScreen) */}
              <div className={`w-64 h-1 rounded-full overflow-hidden ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full animate-[loadingbar_1.5s_ease-in-out_infinite]"
                  style={{ backgroundSize: '200% 100%' }}
                />
              </div>
              <div className="text-center space-y-1">
                <p className={`text-sm animate-pulse ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  Cargando inventarios y artes...
                </p>
                {loadingProgress && loadingProgress.total > 0 && (
                  <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    {loadingProgress.current} de {loadingProgress.total} campañas
                  </p>
                )}
              </div>
              <style>{`
                @keyframes loadingbar {
                  0% { width: 0%; margin-left: 0%; }
                  50% { width: 70%; margin-left: 15%; }
                  100% { width: 0%; margin-left: 100%; }
                }
              `}</style>
            </div>
          ) : preview && totalFilas === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8">
              <p>No hay datos para mostrar.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className={`sticky top-0 z-10 ${isDark ? 'bg-purple-900/40 text-purple-200' : 'bg-purple-100 text-purple-800'}`}>
                <tr>
                  {preview?.headers.map(h => (
                    <th key={h} className="p-2 font-semibold text-left whitespace-nowrap border-b border-purple-500/30">{h}</th>
                  ))}
                  {Array.from({ length: arteCols }).map((_, i) => (
                    <th key={`arte-${i}`} className="p-2 font-semibold text-left whitespace-nowrap border-b border-purple-500/30">Arte {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, idx) => (
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
                    {Array.from({ length: arteCols }).map((_, i) => (
                      <td key={`a-${idx}-${i}`} className="p-2">
                        {r.artesUrls[i] ? <ArteThumb url={r.artesUrls[i]} /> : <span className="text-zinc-600">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}>
            Cerrar
          </button>
          <button
            onClick={onDownload}
            disabled={isLoading || isDownloading || totalFilas === 0}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              !isLoading && !isDownloading && totalFilas > 0
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
  );
}
