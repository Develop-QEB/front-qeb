import { useEffect, useState } from 'react';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import api from '../../lib/api';

interface LinkMeta {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  favicon?: string | null;
  host?: string | null;
}

const cache = new Map<string, LinkMeta>();

/**
 * Card de vista previa de un enlace: muestra og:image (si existe),
 * titulo/host y un boton "abrir". Si el back no puede obtener metadata,
 * cae a una card minima con favicon + URL.
 */
export function LinkPreview({ url, isDark = true }: { url: string; isDark?: boolean }) {
  const [meta, setMeta] = useState<LinkMeta | null>(cache.get(url) || null);
  const [loading, setLoading] = useState(!cache.has(url));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(url)) { setMeta(cache.get(url) || null); setLoading(false); return; }
    setLoading(true);
    api.get('/uploads/link-preview', { params: { url } })
      .then(res => {
        if (cancelled) return;
        const data = res.data?.data || { url };
        cache.set(url, data);
        setMeta(data);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback: LinkMeta = { url };
        cache.set(url, fallback);
        setMeta(fallback);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  const cardCls = `block rounded-lg border overflow-hidden transition-colors ${
    isDark ? 'bg-zinc-800/40 border-zinc-700 hover:border-purple-500/50' : 'bg-gray-50 border-gray-200 hover:border-purple-300'
  }`;

  if (loading) {
    return (
      <div className={`${cardCls} animate-pulse`}>
        <div className={`h-32 ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'}`} />
        <div className="p-3 space-y-2">
          <div className={`h-3 w-3/4 rounded ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'}`} />
          <div className={`h-2 w-1/2 rounded ${isDark ? 'bg-zinc-700/50' : 'bg-gray-200'}`} />
        </div>
      </div>
    );
  }

  const m = meta || { url };
  const showImage = !!m.image && !imgError;
  const titleText = m.title || m.url;
  // Normaliza URLs sin scheme (p.ej. "www.link.com") para que <a href> abra
  // el sitio externo en vez de tratarlo como ruta relativa.
  const safeHref = /^https?:\/\//i.test(m.url) ? m.url : `https://${m.url}`;
  // Host seguro: si el back no devolvió host y new URL revienta porque la
  // URL no tiene scheme, caemos al string original en vez de crashear la pantalla.
  const safeHost = (() => {
    if (m.host) return m.host;
    try { return new URL(safeHref).host; } catch { return m.url; }
  })();

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer" className={cardCls}>
      {showImage && (
        <img
          src={m.image as string}
          alt={titleText}
          className="w-full h-32 object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      )}
      <div className="p-3 flex items-start gap-2">
        {!showImage && (
          m.favicon ? (
            <img src={m.favicon} alt="" className="h-4 w-4 mt-0.5 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <LinkIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          )
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{titleText}</p>
          {m.description && (
            <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{m.description}</p>
          )}
          <p className={`text-[10px] mt-1 truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'} flex items-center gap-1`}>
            <ExternalLink className="h-3 w-3" />
            {safeHost}
          </p>
        </div>
      </div>
    </a>
  );
}
