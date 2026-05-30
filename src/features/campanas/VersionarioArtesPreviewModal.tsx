import { useMemo, useState, useEffect } from 'react';
import { X, Download, Search, Image as ImageIcon, Film, ChevronDown, Filter, Calendar } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import type { VersionarioArtesPreview, VersionarioArtesPreviewRow } from '../../utils/exportVersionarioArtes';
import type { Catorcena } from '../../types';

// ---- FilterChipModal — versión local del FilterChip para uso dentro del modal ----
function FilterChipModal({
  label,
  options,
  value,
  onChange,
  onClear,
  isDark = true
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  const handleClose = () => { setOpen(false); setSearchTerm(''); };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${value
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
          : isDark
            ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600'
            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
        }`}
      >
        <span>{value || label}</span>
        {value ? (
          <X className={`h-3 w-3 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); onClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={handleClose} />
          <div className={`absolute top-full left-0 mt-1.5 z-[100] w-64 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <input
                type="text"
                placeholder={`Buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-52 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-3 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'} text-center`}>
                  {options.length === 0 ? 'Sin opciones' : 'No se encontraron resultados'}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => { onChange(option); handleClose(); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${value === option
                      ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                      : isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
            <div className={`px-3 py-1.5 border-t ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-gray-400'} text-[10px]`}>
              {filteredOptions.length} de {options.length} opciones
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- NotasPopover — muestra notas de artes en un popover compacto ----
function NotasPopover({ notas, isDark }: { notas: string; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const lines = notas.split('\n').filter(l => l.trim());
  if (lines.length === 0) return <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>-</span>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${isDark ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'}`}
      >
        Ver notas ({lines.length})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className={`absolute bottom-full left-0 mb-1.5 z-[100] w-72 max-h-60 overflow-auto rounded-xl border shadow-2xl ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'}`}>
            <div className={`sticky top-0 px-3 py-2 border-b ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Notas ({lines.length})</span>
            </div>
            <div className="p-2 space-y-1">
              {lines.map((line, i) => (
                <div key={i} className={`px-2 py-1.5 rounded text-[11px] ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- NombreArtePopover — muestra nombres de artes en popover para evitar desborde ----
function NombreArtePopover({ nombreArte, isDark }: { nombreArte: string; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const lines = nombreArte.split('\n').filter(l => l.trim());
  if (lines.length === 0) return <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>-</span>;

  const shortLabel = lines.length === 1
    ? (lines[0].length > 28 ? lines[0].slice(0, 28) + '...' : lines[0])
    : `${lines.length} artes`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors text-left max-w-[160px] truncate block ${isDark ? 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 border border-zinc-700/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
        title={nombreArte}
      >
        {shortLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className={`absolute bottom-full left-0 mb-1.5 z-[100] w-80 max-h-60 overflow-auto rounded-xl border shadow-2xl ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'}`}>
            <div className={`sticky top-0 px-3 py-2 border-b ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-white'}`}>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Nombres de Arte ({lines.length})</span>
            </div>
            <div className="p-2 space-y-1">
              {lines.map((line, i) => (
                <div key={i} className={`px-2 py-1.5 rounded text-[11px] break-all ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-gray-50 text-gray-700'}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- PeriodFilterModal — filtro de periodo (año/catorcena) para uso dentro del modal ----
function PeriodFilterModal({
  catorcenasData,
  yearInicio,
  yearFin,
  catorcenaInicio,
  catorcenaFin,
  onApply,
  onClear,
  isDark = true
}: {
  catorcenasData: { years: number[]; data: Catorcena[] } | undefined;
  yearInicio: number | undefined;
  yearFin: number | undefined;
  catorcenaInicio: number | undefined;
  catorcenaFin: number | undefined;
  onApply: (yearInicio: number, yearFin: number, catorcenaInicio?: number, catorcenaFin?: number) => void;
  onClear: () => void;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tempYearInicio, setTempYearInicio] = useState<number | undefined>(yearInicio);
  const [tempYearFin, setTempYearFin] = useState<number | undefined>(yearFin);
  const [tempCatorcenaInicio, setTempCatorcenaInicio] = useState<number | undefined>(catorcenaInicio);
  const [tempCatorcenaFin, setTempCatorcenaFin] = useState<number | undefined>(catorcenaFin);

  useEffect(() => {
    setTempYearInicio(yearInicio);
    setTempYearFin(yearFin);
    setTempCatorcenaInicio(catorcenaInicio);
    setTempCatorcenaFin(catorcenaFin);
  }, [yearInicio, yearFin, catorcenaInicio, catorcenaFin]);

  const years = catorcenasData?.years || [];

  const yearInicioOptions = useMemo(() => {
    if (tempYearFin) return years.filter(y => y <= tempYearFin);
    return years;
  }, [years, tempYearFin]);

  const yearFinOptions = useMemo(() => {
    if (tempYearInicio) return years.filter(y => y >= tempYearInicio);
    return years;
  }, [years, tempYearInicio]);

  const catorcenasInicioOptions = useMemo(() => {
    if (!catorcenasData?.data || !tempYearInicio) return [];
    const catorcenas = catorcenasData.data.filter(c => c.a_o === tempYearInicio);
    if (tempYearInicio === tempYearFin && tempCatorcenaFin) {
      return catorcenas.filter(c => c.numero_catorcena <= tempCatorcenaFin);
    }
    return catorcenas;
  }, [catorcenasData, tempYearInicio, tempYearFin, tempCatorcenaFin]);

  const catorcenasFinOptions = useMemo(() => {
    if (!catorcenasData?.data || !tempYearFin) return [];
    const catorcenas = catorcenasData.data.filter(c => c.a_o === tempYearFin);
    if (tempYearInicio === tempYearFin && tempCatorcenaInicio) {
      return catorcenas.filter(c => c.numero_catorcena >= tempCatorcenaInicio);
    }
    return catorcenas;
  }, [catorcenasData, tempYearFin, tempYearInicio, tempCatorcenaInicio]);

  const isActive = yearInicio !== undefined && yearFin !== undefined;
  const canApply = tempYearInicio !== undefined && tempYearFin !== undefined;

  const handleApply = () => {
    if (canApply) {
      onApply(tempYearInicio!, tempYearFin!, tempCatorcenaInicio, tempCatorcenaFin);
      setOpen(false);
    }
  };

  const handleClear = () => {
    setTempYearInicio(undefined);
    setTempYearFin(undefined);
    setTempCatorcenaInicio(undefined);
    setTempCatorcenaFin(undefined);
    onClear();
    setOpen(false);
  };

  const getDisplayText = () => {
    if (!isActive) return 'Periodo';
    let text = `${yearInicio}`;
    if (catorcenaInicio) text += `/C${catorcenaInicio}`;
    text += ` - ${yearFin}`;
    if (catorcenaFin) text += `/C${catorcenaFin}`;
    return text;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${isActive
          ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
          : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
        }`}
      >
        <Calendar className="h-3 w-3" />
        <span>{getDisplayText()}</span>
        {isActive ? (
          <X className={`h-3 w-3 ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`} onClick={(e) => { e.stopPropagation(); handleClear(); }} />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className={`absolute top-full left-0 mt-1.5 z-[100] w-80 rounded-xl border ${isDark ? 'border-purple-500/20 bg-zinc-900' : 'border-purple-200 bg-white'} backdrop-blur-xl shadow-2xl overflow-hidden`}>
            <div className={`p-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                <Calendar className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Filtro de Periodo
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mt-1`}>Selecciona año inicio y fin</p>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Año Inicio *</label>
                  <select
                    value={tempYearInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempYearInicio(val);
                      setTempCatorcenaInicio(undefined);
                      if (val && tempYearFin && val > tempYearFin) { setTempYearFin(undefined); setTempCatorcenaFin(undefined); }
                    }}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearInicioOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Inicio</label>
                  <select
                    value={tempCatorcenaInicio || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempCatorcenaInicio(val);
                      if (val && tempYearInicio === tempYearFin && tempCatorcenaFin && val > tempCatorcenaFin) setTempCatorcenaFin(undefined);
                    }}
                    disabled={!tempYearInicio}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Todas</option>
                    {catorcenasInicioOptions.map(c => <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Año Fin *</label>
                  <select
                    value={tempYearFin || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempYearFin(val);
                      setTempCatorcenaFin(undefined);
                      if (val && tempYearInicio && val < tempYearInicio) { setTempYearInicio(undefined); setTempCatorcenaInicio(undefined); }
                    }}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                  >
                    <option value="">Seleccionar</option>
                    {yearFinOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'} mb-1 block`}>Cat. Fin</label>
                  <select
                    value={tempCatorcenaFin || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      setTempCatorcenaFin(val);
                      if (val && tempYearInicio === tempYearFin && tempCatorcenaInicio && val < tempCatorcenaInicio) setTempCatorcenaInicio(undefined);
                    }}
                    disabled={!tempYearFin}
                    className={`w-full px-2 py-1.5 text-xs ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50`}
                  >
                    <option value="">Todas</option>
                    {catorcenasFinOptions.map(c => <option key={c.id} value={c.numero_catorcena}>Cat. {c.numero_catorcena}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={`p-3 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'} flex items-center justify-between gap-2`}>
              <button onClick={handleClear} className={`px-3 py-1.5 text-xs ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                Limpiar
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className={`px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 ${isDark ? 'disabled:bg-zinc-700 disabled:text-zinc-500' : 'disabled:bg-gray-200 disabled:text-gray-400'} text-white rounded-lg font-medium transition-colors`}
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
  catorcenasData?: { years: number[]; data: Catorcena[] };
  onReloadPeriod?: (yearInicio: number, yearFin: number, catInicio?: number, catFin?: number) => void;
  initialPeriod?: { year: number; catorcena: number };
}

const PAGE_SIZE = 25;

// Detecta si un URL apunta a un archivo de video (no se puede previsualizar
// como imagen). Cubre las extensiones comunes que se suben para artes digitales.
const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const u = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|avi|webm|mkv|m4v|wmv|flv)$/.test(u);
};

// Extrae nombre limpio del archivo desde la URL (quita el prefijo timestamp-random-).
const extractFileName = (url: string): string => {
  if (!url) return '';
  try {
    const last = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
    return last.replace(/^\d{10,}-[a-z0-9]+-/i, '') || last;
  } catch {
    return url.split('/').pop() || '';
  }
};

// Miniatura de arte. Si es video, muestra etiqueta "Video subido + nombre"
// en lugar de intentar previsualizar.
function ArteThumb({ url, onClick }: { url: string; onClick?: () => void }) {
  const [errored, setErrored] = useState(false);
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const handleClick = onClick || (() => window.open(url, '_blank', 'noopener,noreferrer'));

  if (!url) {
    return (
      <div className={`w-16 h-12 rounded flex items-center justify-center ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
        <ImageIcon className={`h-4 w-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
      </div>
    );
  }

  // Video → etiqueta + nombre (no se previsualiza)
  if (isVideoUrl(url)) {
    const name = extractFileName(url);
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex flex-col items-start gap-1 px-2 py-1 rounded border max-w-[180px] text-left transition-colors ${isDark ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100'}`}
        title={`Video subido: ${name}\nClick para abrir galeria`}
      >
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
          <Film className="h-3 w-3" />
          Video subido
        </span>
        <span className={`text-[10px] break-all leading-tight ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{name}</span>
      </button>
    );
  }

  // Imagen → miniatura normal; si falla la carga mostramos icono fallback
  if (errored) {
    return (
      <div className={`w-16 h-12 rounded flex items-center justify-center ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
        <ImageIcon className={`h-4 w-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-16 h-12 rounded overflow-hidden border border-zinc-700 hover:border-purple-400/60 transition-colors bg-zinc-800"
      title="Abrir galeria de artes"
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

// ArtesGalleryModal — vista carrusel para previsualizar/descargar artes del row.
// Estilo similar a la galeria del modal de Ordenes de Montaje.
function ArtesGalleryModal({ urls, initialIndex, onClose, isDark }: {
  urls: string[]; initialIndex: number; onClose: () => void; isDark: boolean;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [erroredKeys, setErroredKeys] = useState<Set<number>>(new Set());
  const safeIdx = Math.max(0, Math.min(idx, urls.length - 1));
  const current = urls[safeIdx];
  const isVid = isVideoUrl(current);
  const filename = extractFileName(current);

  const handleDownload = async () => {
    try {
      const res = await fetch(current);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'arte';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: abrir en pestaña nueva si fetch falla por CORS
      window.open(current, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(urls.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, urls.length]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85" onClick={onClose} />
      <div className={`relative w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col rounded-xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-purple-500/40' : 'bg-white border-purple-200'}`}>
        <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ImageIcon className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'} shrink-0`} />
            <div className="min-w-0">
              <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Arte {safeIdx + 1} de {urls.length}
              </h3>
              <p className={`text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} title={current}>
                {filename}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow"
              title="Descargar arte"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={`flex-1 flex items-center justify-center overflow-hidden p-4 ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
          {!current ? (
            <div className="text-zinc-500">Sin arte</div>
          ) : isVid ? (
            <video src={current} controls className="max-w-full max-h-full" />
          ) : erroredKeys.has(safeIdx) ? (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <ImageIcon className="h-12 w-12" />
              <span className="text-xs">No se pudo cargar la imagen</span>
              <a href={current} target="_blank" rel="noopener noreferrer" className={`text-xs underline ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                Abrir en pestaña nueva
              </a>
            </div>
          ) : (
            <img
              src={current}
              alt="arte"
              onError={() => setErroredKeys(prev => { const n = new Set(prev); n.add(safeIdx); return n; })}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {urls.length > 1 && (
            <>
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={safeIdx === 0}
                className={`absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full ${isDark ? 'bg-zinc-800/80 hover:bg-zinc-700' : 'bg-white/90 hover:bg-white shadow'} ${safeIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Anterior"
              >
                <ChevronDown className={`h-4 w-4 rotate-90 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`} />
              </button>
              <button
                onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
                disabled={safeIdx === urls.length - 1}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full ${isDark ? 'bg-zinc-800/80 hover:bg-zinc-700' : 'bg-white/90 hover:bg-white shadow'} ${safeIdx === urls.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Siguiente"
              >
                <ChevronDown className={`h-4 w-4 -rotate-90 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`} />
              </button>
            </>
          )}
        </div>
        {urls.length > 1 && (
          <div className={`flex items-center gap-2 p-2 border-t border-border overflow-x-auto ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
            {urls.map((u, i) => {
              const vid = isVideoUrl(u);
              return (
                <button
                  key={`th-${i}`}
                  onClick={() => setIdx(i)}
                  className={`flex-shrink-0 w-14 h-12 rounded overflow-hidden border-2 ${i === safeIdx ? 'border-purple-500' : 'border-transparent hover:border-purple-300'} transition-colors bg-zinc-800`}
                  title={extractFileName(u)}
                >
                  {vid ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-4 w-4 text-cyan-400" />
                    </div>
                  ) : (
                    <img src={u} alt={`arte-${i + 1}`} className="w-full h-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function VersionarioArtesPreviewModal({ isOpen, onClose, preview, isLoading, isDownloading, loadingProgress, onDownload, catorcenasData, onReloadPeriod, initialPeriod }: Props) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [currentPage, setCurrentPage] = useState(1);
  // Galería de artes que abre al clickear una miniatura
  const [galleryUrls, setGalleryUrls] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const openGallery = (urls: string[], idx: number) => { setGalleryUrls(urls); setGalleryIndex(idx); };
  const closeGallery = () => setGalleryUrls(null);
  const [search, setSearch] = useState('');

  // --- Filtros internos del modal ---
  const [filterEstatus, setFilterEstatus] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterPlaza, setFilterPlaza] = useState('');
  const [filterArte, setFilterArte] = useState<'' | 'con_arte' | 'sin_arte'>('');
  const [filterAps, setFilterAps] = useState<'' | 'con_aps' | 'sin_aps'>('');
  const [filterPost, setFilterPost] = useState<'' | 'con_post' | 'sin_post'>('');
  const [filterTipoArchivo, setFilterTipoArchivo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filtro de periodo
  const [periodYearInicio, setPeriodYearInicio] = useState<number | undefined>(undefined);
  const [periodYearFin, setPeriodYearFin] = useState<number | undefined>(undefined);
  const [periodCatInicio, setPeriodCatInicio] = useState<number | undefined>(undefined);
  const [periodCatFin, setPeriodCatFin] = useState<number | undefined>(undefined);

  // Reset paginacion/search/filtros al cerrar/abrir
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(1);
      setSearch('');
      setFilterEstatus('');
      setFilterCliente('');
      setFilterPlaza('');
      setFilterArte('');
      setFilterAps('');
      setFilterPost('');
      setFilterTipoArchivo('');
      setShowFilters(false);
      setPeriodYearInicio(undefined);
      setPeriodYearFin(undefined);
      setPeriodCatInicio(undefined);
      setPeriodCatFin(undefined);
    } else if (initialPeriod) {
      setPeriodYearInicio(initialPeriod.year);
      setPeriodYearFin(initialPeriod.year);
      setPeriodCatInicio(initialPeriod.catorcena);
      setPeriodCatFin(initialPeriod.catorcena);
      setShowFilters(true);
    }
  }, [isOpen]);

  // Opciones derivadas de los datos cargados
  const filterOptions = useMemo(() => {
    if (!preview) return { estatuses: [] as string[], clientes: [] as string[], plazas: [] as string[], tiposArchivo: [] as string[] };
    const estatusSet = new Set<string>();
    const clienteSet = new Set<string>();
    const plazaSet = new Set<string>();
    const extSet = new Set<string>();
    for (const r of preview.rows) {
      if (r.estatusBreakdown) {
        for (const b of r.estatusBreakdown) estatusSet.add(b.label);
      }
      if (r.cliente) clienteSet.add(r.cliente);
      if (r.plaza) plazaSet.add(r.plaza);
      for (const url of r.artesUrls) {
        if (!url) continue;
        const match = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
        if (match) extSet.add(match[1].toLowerCase());
      }
    }
    return {
      estatuses: [...estatusSet].sort(),
      clientes: [...clienteSet].sort(),
      plazas: [...plazaSet].sort(),
      tiposArchivo: [...extSet].sort(),
    };
  }, [preview]);

  const isPeriodActive = periodYearInicio !== undefined && periodYearFin !== undefined;
  const activeFilterCount = [filterEstatus, filterCliente, filterPlaza, filterArte, filterAps, filterPost, filterTipoArchivo].filter(Boolean).length + (isPeriodActive ? 1 : 0);

  // El filtro de periodo dispara una recarga desde el backend (onReloadPeriod),
  // por lo que no necesitamos filtrar client-side por periodo — los datos
  // ya vienen filtrados al nuevo rango tras la recarga.

  // Filas filtradas por filtros + busqueda libre
  const filteredRows: VersionarioArtesPreviewRow[] = useMemo(() => {
    if (!preview) return [];
    let rows = preview.rows;

    // Filtro Estatus
    if (filterEstatus) {
      rows = rows.filter(r =>
        r.estatusBreakdown?.some(b => b.label === filterEstatus)
      );
    }

    // Filtro Cliente
    if (filterCliente) {
      rows = rows.filter(r => r.cliente === filterCliente);
    }

    // Filtro Plaza
    if (filterPlaza) {
      rows = rows.filter(r => r.plaza === filterPlaza);
    }

    // Filtro Con/Sin Arte
    if (filterArte === 'con_arte') {
      rows = rows.filter(r => r.artesUrls.some(u => !!u));
    } else if (filterArte === 'sin_arte') {
      rows = rows.filter(r => !r.artesUrls.some(u => !!u));
    }

    // Filtro Con/Sin APS
    if (filterAps === 'con_aps') {
      rows = rows.filter(r => r.apsQebId != null && r.apsQebId !== '' && r.apsQebId !== 0);
    } else if (filterAps === 'sin_aps') {
      rows = rows.filter(r => !r.apsQebId || r.apsQebId === '' || r.apsQebId === 0);
    }

    // Filtro Con/Sin POST
    if (filterPost === 'con_post') {
      rows = rows.filter(r => r.posted);
    } else if (filterPost === 'sin_post') {
      rows = rows.filter(r => !r.posted);
    }

    // Filtro Tipo de Archivo
    if (filterTipoArchivo) {
      const ext = `.${filterTipoArchivo}`;
      rows = rows.filter(r =>
        r.artesUrls.some(u => u && u.split('?')[0].toLowerCase().endsWith(ext))
      );
    }

    // Busqueda textual
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r => {
        const haystack = [String(r.idCampana), r.plaza, r.tipo, r.formato, r.asesor, r.cliente, r.marca, r.campania, r.estatus, r.notas, r.nombreArte, String(r.apsQebId)]
          .join(' | ').toLowerCase();
        return haystack.includes(q);
      });
    }

    return rows;
  }, [preview, search, filterEstatus, filterCliente, filterPlaza, filterArte, filterAps, filterPost, filterTipoArchivo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Cuando cambia cualquier filtro, reset a pagina 1
  useEffect(() => { setCurrentPage(1); }, [search, filterEstatus, filterCliente, filterPlaza, filterArte, filterAps, filterPost, filterTipoArchivo]);

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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`relative flex items-center gap-2 px-2 py-1 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 focus-within:border-purple-500' : 'bg-white border-gray-300 focus-within:border-purple-500'} w-72 max-w-full`}>
              <Search className={`h-3.5 w-3.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar plaza, cliente, campaña..."
                className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
              />
              {search && (
                <button onClick={() => setSearch('')} className={`shrink-0 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                showFilters || activeFilterCount > 0
                  ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'
                  : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              <Filter className="h-3 w-3" />
              <span>Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!isLoading && (
              <span>{filteredRows.length} mostradas{(search || activeFilterCount > 0) ? ` (de ${totalFilas})` : ''}</span>
            )}
          </div>
        </div>

        {/* Barra de filtros */}
        {showFilters && !isLoading && (
          <div className={`flex items-center gap-2 flex-wrap px-4 py-2 border-b ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-gray-200 bg-gray-50/80'}`}>
            <PeriodFilterModal
              catorcenasData={catorcenasData}
              yearInicio={periodYearInicio}
              yearFin={periodYearFin}
              catorcenaInicio={periodCatInicio}
              catorcenaFin={periodCatFin}
              onApply={(yi, yf, ci, cf) => {
                setPeriodYearInicio(yi); setPeriodYearFin(yf); setPeriodCatInicio(ci); setPeriodCatFin(cf);
                if (onReloadPeriod) onReloadPeriod(yi, yf, ci, cf);
              }}
              onClear={() => { setPeriodYearInicio(undefined); setPeriodYearFin(undefined); setPeriodCatInicio(undefined); setPeriodCatFin(undefined); }}
              isDark={isDark}
            />
            <FilterChipModal
              label="Estatus"
              options={filterOptions.estatuses}
              value={filterEstatus}
              onChange={setFilterEstatus}
              onClear={() => setFilterEstatus('')}
              isDark={isDark}
            />
            <FilterChipModal
              label="Cliente"
              options={filterOptions.clientes}
              value={filterCliente}
              onChange={setFilterCliente}
              onClear={() => setFilterCliente('')}
              isDark={isDark}
            />
            <FilterChipModal
              label="Plaza"
              options={filterOptions.plazas}
              value={filterPlaza}
              onChange={setFilterPlaza}
              onClear={() => setFilterPlaza('')}
              isDark={isDark}
            />
            <FilterChipModal
              label="Tipo archivo"
              options={filterOptions.tiposArchivo}
              value={filterTipoArchivo}
              onChange={setFilterTipoArchivo}
              onClear={() => setFilterTipoArchivo('')}
              isDark={isDark}
            />
            {/* Filtro Con/Sin Arte */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterArte(filterArte === 'con_arte' ? '' : 'con_arte')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterArte === 'con_arte'
                    ? isDark ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'bg-green-100 text-green-700 border border-green-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Con arte
              </button>
              <button
                onClick={() => setFilterArte(filterArte === 'sin_arte' ? '' : 'sin_arte')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterArte === 'sin_arte'
                    ? isDark ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-orange-100 text-orange-700 border border-orange-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Sin arte
              </button>
            </div>
            {/* Filtro Con/Sin APS */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterAps(filterAps === 'con_aps' ? '' : 'con_aps')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterAps === 'con_aps'
                    ? isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-blue-100 text-blue-700 border border-blue-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Con APS
              </button>
              <button
                onClick={() => setFilterAps(filterAps === 'sin_aps' ? '' : 'sin_aps')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterAps === 'sin_aps'
                    ? isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-700 border border-amber-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Sin APS
              </button>
            </div>
            {/* Filtro Con/Sin POST */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterPost(filterPost === 'con_post' ? '' : 'con_post')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterPost === 'con_post'
                    ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Con POST
              </button>
              <button
                onClick={() => setFilterPost(filterPost === 'sin_post' ? '' : 'sin_post')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  filterPost === 'sin_post'
                    ? isDark ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-red-100 text-red-700 border border-red-200'
                    : isDark ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                Sin POST
              </button>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterEstatus(''); setFilterCliente(''); setFilterPlaza(''); setFilterArte(''); setFilterAps(''); setFilterPost(''); setFilterTipoArchivo(''); setPeriodYearInicio(undefined); setPeriodYearFin(undefined); setPeriodCatInicio(undefined); setPeriodCatFin(undefined); }}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-700'}`}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Tabla */}
        <div className="flex-1 overflow-auto px-5 py-2">
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
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px] text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-purple-500/20 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 backdrop-blur-sm">
                  {preview?.headers.map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  {Array.from({ length: arteCols }).map((_, i) => (
                    <th key={`arte-${i}`} className="px-3 py-3 text-left text-[10px] font-semibold text-purple-300 uppercase tracking-wider whitespace-nowrap">Arte {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, idx) => (
                  <tr key={`${r.idCampana}-${r.apsQebId}-${r.plaza}-${idx}`} className={`border-b ${isDark ? 'border-zinc-800/50 hover:bg-purple-900/10' : 'border-gray-100 hover:bg-purple-50'}`}>
                    <td className="p-2 whitespace-nowrap">{r.idCampana}</td>
                    <td className="p-2 whitespace-nowrap">{r.plaza}</td>
                    <td className="p-2 whitespace-nowrap">{r.tipo}</td>
                    <td className="p-2 whitespace-nowrap">{r.formato || '-'}</td>
                    <td className="p-2 whitespace-nowrap">{r.asesor}</td>
                    <td className="p-2 whitespace-nowrap">{r.apsQebId}</td>
                    <td className="p-2 whitespace-nowrap">{r.fechaInicio}</td>
                    <td className="p-2 whitespace-nowrap">{r.fechaFin}</td>
                    <td className="p-2 whitespace-nowrap max-w-[180px] truncate" title={r.cliente}>{r.cliente}</td>
                    <td className="p-2 whitespace-nowrap">{r.marca}</td>
                    <td className="p-2 whitespace-nowrap max-w-[200px] truncate" title={r.campania}>{r.campania}</td>
                    <td className="p-2 text-right">{r.caras}</td>
                    <td className="p-2 whitespace-nowrap">
                      {(() => {
                        const items = r.estatusBreakdown || [];
                        if (items.length === 0) return <span className="text-zinc-600">-</span>;
                        const getCls = (label: string): string => {
                          const lower = label.toLowerCase();
                          if (lower === 'subir artes') return isDark ? 'bg-zinc-600/40 text-zinc-200 border border-zinc-500/30' : 'bg-gray-100 text-gray-700 border border-gray-200';
                          if (lower === 'sin revisar') return isDark ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30' : 'bg-gray-100 text-gray-600 border border-gray-200';
                          if (lower === 'en revisión') return isDark ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                          if (lower === 'aprobado') return isDark ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200';
                          if (lower === 'rechazado') return isDark ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-100 text-red-700 border border-red-200';
                          if (lower === 'pendiente') return isDark ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-200';
                          if (lower === 'en programación') return isDark ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border border-cyan-200';
                          if (lower === 'en impresión') return isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200';
                          if (lower === 'pendiente de recepción') return isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border border-indigo-200';
                          if (lower === 'recibido') return isDark ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40' : 'bg-indigo-200 text-indigo-800 border border-indigo-300';
                          if (lower === 'por instalar') return isDark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                          if (lower === 'instaladas') return isDark ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-700 border border-emerald-200';
                          if (lower === 'testigo') return isDark ? 'bg-emerald-600/40 text-emerald-100 border border-emerald-500/50' : 'bg-emerald-200 text-emerald-800 border border-emerald-300';
                          return isDark ? 'bg-zinc-700/40 text-zinc-300' : 'bg-gray-200 text-gray-700';
                        };
                        // Si solo hay 1 estatus → mostramos solo el label (sin conteo redundante)
                        if (items.length === 1) {
                          const it = items[0];
                          return <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getCls(it.label)}`}>{it.label}</span>;
                        }
                        // Mixto → varios badges con su conteo, en orden por nivel descendente
                        return (
                          <div className="flex flex-wrap gap-1">
                            {items.map(it => (
                              <span key={it.label} className={`px-2 py-0.5 rounded text-[10px] font-medium ${getCls(it.label)}`}>
                                {it.count} {it.label}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-2">
                      <NotasPopover notas={r.notas} isDark={isDark} />
                    </td>
                    <td className="p-2">
                      <NombreArtePopover nombreArte={r.nombreArte} isDark={isDark} />
                    </td>
                    <td className="p-2 max-w-[240px]">
                      {r.artesUrls.length === 0 ? (
                        <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>-</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {r.artesUrls.map((u, ui) => (
                            <a
                              key={`u-${ui}`}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-[10px] truncate hover:underline ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-700'}`}
                              title={u}
                            >
                              {u}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    {Array.from({ length: arteCols }).map((_, i) => (
                      <td key={`a-${idx}-${i}`} className="p-2">
                        {r.artesUrls[i]
                          ? <ArteThumb url={r.artesUrls[i]} onClick={() => openGallery(r.artesUrls, i)} />
                          : <span className="text-zinc-600">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Footer con paginacion + acciones */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-border flex-shrink-0 flex-wrap">
          <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}>
            Cerrar
          </button>
          {/* Paginacion centrada */}
          {totalPages > 1 && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${safePage === 1 ? 'opacity-40 cursor-not-allowed' : isDark ? 'border-zinc-700 hover:bg-zinc-800 hover:border-purple-500/50' : 'border-gray-300 hover:bg-gray-100'}`}
              >
                ← Anterior
              </button>
              <span className="px-3 font-medium">Página {safePage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${safePage === totalPages ? 'opacity-40 cursor-not-allowed' : isDark ? 'border-zinc-700 hover:bg-zinc-800 hover:border-purple-500/50' : 'border-gray-300 hover:bg-gray-100'}`}
              >
                Siguiente →
              </button>
            </div>
          )}
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
      {/* Galería de artes (carrusel + descarga) */}
      {galleryUrls && galleryUrls.length > 0 && (
        <ArtesGalleryModal
          urls={galleryUrls}
          initialIndex={galleryIndex}
          onClose={closeGallery}
          isDark={isDark}
        />
      )}
    </div>
  );
}
