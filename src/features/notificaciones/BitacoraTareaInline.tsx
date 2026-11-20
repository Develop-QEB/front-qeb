import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { notificacionesService, HistorialTareaRow } from '../../services/notificaciones.service';
import { formatDate } from '../../lib/utils';

// Compartido entre el drawer de Notificaciones y el detalle de la actividad en
// el tablero de Historial de Acciones (tab Actividad Comercial). `className`
// reemplaza el contenedor por defecto del drawer cuando se usa en otro layout.
// Bitacora de ediciones de la tarea. Se muestra en el drawer lateral debajo
// del bloque amarillo "Informacion de la Actividad" (feedback Jos 2026-11-06).
// El back ya registra cada edicion via logHistorial con un diff por campo;
// este componente solo lo renderiza. Para no romper si una fila trae mal el
// JSON de `detalles`, cada parse se protege con try/catch.
export function BitacoraTareaInline({ tareaId, isDark, className }: { tareaId: number; isDark: boolean; className?: string }) {
  // Colapsado por defecto: una tarea puede acumular muchas ediciones y no
  // conviene que ocupe la mitad del drawer antes de que el usuario pida verlo.
  const [collapsed, setCollapsed] = useState(true);
  const { data: rows = [], isLoading } = useQuery<HistorialTareaRow[]>({
    queryKey: ['historial-tarea', tareaId],
    queryFn: () => notificacionesService.getHistorialTarea(tareaId),
    staleTime: 30_000,
    retry: false,
  });

  const parsed = useMemo(() => rows.map(r => {
    let cambios: Array<{ campo?: string; label?: string; antes?: unknown; despues?: unknown }> = [];
    let usuarioNombre: string | null = null;
    try {
      if (r.detalles) {
        const j = JSON.parse(r.detalles) as { cambios?: typeof cambios; usuario?: string };
        if (Array.isArray(j.cambios)) cambios = j.cambios;
        if (typeof j.usuario === 'string') usuarioNombre = j.usuario;
      }
    } catch { /* fila corrupta: la ignoramos silenciosamente */ }
    return { ...r, cambios, usuarioNombre };
  }), [rows]);

  if (isLoading) return null;
  if (parsed.length === 0) return null;

  const borderCls = isDark ? 'border-zinc-800/50' : 'border-gray-200';
  const subText = isDark ? 'text-zinc-500' : 'text-gray-400';
  const headText = isDark ? 'text-zinc-400' : 'text-gray-500';

  // Formato: fechas ISO salen bonitas, el resto va tal cual. Detectar fecha
  // por regex para no confundir con numeros u otros strings (el back no manda
  // tipo).
  const fmt = (v: unknown): string => {
    if (v == null || v === '') return '—';
    if (Array.isArray(v)) return v.length === 0 ? '—' : v.map(x => fmt(x)).join(', ');
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      try { return formatDate(v); } catch { return v; }
    }
    return String(v);
  };

  return (
    <div className={className ?? `p-5 border-b ${borderCls}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg transition-colors ${
          collapsed
            ? (isDark
              ? 'bg-amber-500/10 border border-amber-500/30 px-3 py-2 hover:bg-amber-500/20'
              : 'bg-amber-50 border border-amber-300 px-3 py-2 hover:bg-amber-100')
            : 'mb-3'
        }`}
      >
        <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
          collapsed ? (isDark ? 'text-amber-200' : 'text-amber-700') : headText
        }`}>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Historial de cambios
          <span className={`normal-case tracking-normal font-normal ${
            collapsed ? (isDark ? 'text-amber-300/80' : 'text-amber-600') : subText
          }`}>({parsed.length})</span>
        </h3>
        {collapsed && (
          <span className={`text-[10px] font-medium ${isDark ? 'text-amber-300/80' : 'text-amber-600'}`}>Ver</span>
        )}
      </button>
      {!collapsed && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {parsed.map((row, idx) => (
            <div key={`${row.id}-${idx}`} className={`rounded-lg border px-3 py-2 ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={`text-xs font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                  {row.accion}
                </div>
                <div className={`text-[10px] shrink-0 ${subText}`}>
                  {formatDate(row.fecha_hora)}
                </div>
              </div>
              {row.usuarioNombre && (
                <div className={`text-[10px] mt-0.5 ${subText}`}>por {row.usuarioNombre}</div>
              )}
              {row.cambios.length > 0 && (
                <div className="mt-2 space-y-1">
                  {row.cambios.map((c, i) => (
                    <div key={i} className="text-[11px] flex items-start gap-2">
                      <span className={`shrink-0 font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{c.label || c.campo || '—'}:</span>
                      <span className={isDark ? 'text-zinc-300' : 'text-gray-700'}>
                        <span className={isDark ? 'text-zinc-500 line-through' : 'text-gray-400 line-through'}>{fmt(c.antes)}</span>
                        <span className="mx-1">→</span>
                        <span className={isDark ? 'text-zinc-100 font-medium' : 'text-gray-900 font-medium'}>{fmt(c.despues)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
