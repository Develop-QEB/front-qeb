// Colores de estatus y badge de completitud de Propuestas.
//
// Vivian dentro de PropuestasPage; se extrajeron cuando la Vista Tablero
// necesito los mismos helpers: duplicar el popover del desglose por catorcena
// habria dejado dos versiones del mismo criterio de "Incompleta".
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { propuestasService } from '../../services/propuestas.service';
import { Propuesta } from '../../types';

// Status badge colors — dos mapas estáticos. El dark-mode toggle sigue
// funcionando porque al cambiar `isDark` el componente re-renderiza y
// `getStatusColor` selecciona el mapa correcto. Antes se construía un objeto
// completo por cada fila renderizada.
export type StatusColor = { bg: string; text: string; border: string };

export const STATUS_COLORS_DARK: Record<string, StatusColor> = {
  'Abierto': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  'Ajuste Cto-Cliente': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  'Ajuste Inventario': { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  'Ajuste Comercial': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Pase a ventas': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Atendido': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'Liberada': { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  // Legacy (datos históricos)
  'Pendiente': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Por aprobar': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Activa': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  'Aprobada': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  'Rechazada': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'Descartada': { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' },
};

export const STATUS_COLORS_LIGHT: Record<string, StatusColor> = {
  'Abierto': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-500/30' },
  'Ajuste Cto-Cliente': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-500/30' },
  'Ajuste Inventario': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-500/30' },
  'Ajuste Comercial': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-500/30' },
  'Pase a ventas': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  'Atendido': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-500/30' },
  'Liberada': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-500/30' },
  'Pendiente': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-500/30' },
  'Por aprobar': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-500/30' },
  'Activa': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-500/30' },
  'Aprobada': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-500/30' },
  'Rechazada': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-500/30' },
  'Descartada': { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-500/30' },
};

export const DEFAULT_STATUS_COLOR_DARK: StatusColor = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };
export const DEFAULT_STATUS_COLOR_LIGHT: StatusColor = { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-500/30' };

export const getStatusColor = (status: string, isDark: boolean): StatusColor => {
  const map = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  return map[status] || (isDark ? DEFAULT_STATUS_COLOR_DARK : DEFAULT_STATUS_COLOR_LIGHT);
};

export const STATUS_OPTIONS = ['Atendido', 'Abierto', 'Ajuste Cto-Cliente', 'Ajuste Inventario', 'Ajuste Comercial', 'Pase a ventas', 'Liberada', 'Rechazada'];

// Roles para los que una propuesta en 'Abierto' esta bloqueada (todavia no la
// trabaja inventarios, asi que comercial no tiene nada que hacerle).
export const ROLES_LOCKED_BY_ABIERTO = ['Asesor Comercial', 'Director Comercial Aeropuerto', 'Asesor Comercial Aeropuerto'];

/**
 * Propuesta bloqueada para acciones de edicion: Activa o Aprobada (ya se fue a
 * campanas) o Abierto para los roles comerciales. Es la misma regla que usa
 * la fila de la tabla; la Vista Tablero la reusa para no abrir lo que la
 * tabla no abriria.
 */
export function esPropuestaBloqueada(p: Pick<Propuesta, 'status'>, userRol: string): boolean {
  return p.status === 'Activa'
    || p.status === 'Aprobada'
    || (ROLES_LOCKED_BY_ABIERTO.includes(userRol) && p.status === 'Abierto');
}

/**
 * Si el usuario puede abrir la propuesta (boton Asignar/Ver de la fila).
 * Con permiso de asignar inventario, Aprobada y las bloqueadas NO se abren
 * (ya no hay nada que asignar). Sin ese permiso el boton es "Ver Propuesta"
 * y siempre esta disponible. Misma regla que `disabled` del boton de la fila.
 */
export function puedeAbrirPropuesta(p: Pick<Propuesta, 'status'>, userRol: string, canAsignarInventario: boolean): boolean {
  return !(canAsignarInventario && (p.status === 'Aprobada' || esPropuestaBloqueada(p, userRol)));
}

// Pseudo-estatus de completitud para el chip de Status: no son estatus reales
// de la propuesta, se evalúan en cliente contra los totales de reservas.
export const COMPLETITUD_STATUS = ['Incompleta', 'Completa'];

// Propuesta con reservas por debajo de las caras esperadas (totales del
// listado, mismo criterio/exclusiones que el badge "Incompleta" de campañas).
export function esPropuestaIncompleta(p: Propuesta): boolean {
  return p.caras_esperadas_total != null
    && Number(p.caras_esperadas_total) > 0
    && Number(p.reservas_validas_total ?? 0) < Number(p.caras_esperadas_total);
}

// Badge "Incompleta (X/Y)" para la tabla de propuestas. Al dar clic abre el
// desglose por catorcena (GET /propuestas/:id/completitud), igual que el badge
// de campañas. Popover con position:fixed + portal para que no lo recorte el
// overflow de la tabla.
export function IncompletaBadge({ propuesta, isDark }: { propuesta: Propuesta; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['propuesta-completitud', propuesta.id],
    queryFn: () => propuestasService.getCompletitud(propuesta.id),
    enabled: open,
    staleTime: 60000,
  });

  const esperadas = Number(propuesta.caras_esperadas_total) || 0;
  const reservadas = Number(propuesta.reservas_validas_total) || 0;

  const POPOVER_W = 260;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        left: Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8)),
      });
    }
    setOpen(v => !v);
  };

  // position:fixed queda "volando" si se scrollea la página: cerrar en scroll
  // o resize, excepto el scroll interno de la lista del propio popover.
  useEffect(() => {
    if (!open) return;
    const closeOnScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const closeOnResize = () => setOpen(false);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnResize);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`px-1.5 py-0.5 rounded-full text-[9px] flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'} border border-yellow-500/30`}
        title="Ver desglose por catorcena"
      >
        <AlertTriangle className="h-3 w-3" />
        Incompleta ({reservadas}/{esperadas})
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            ref={popRef}
            className={`fixed z-50 rounded-xl border shadow-2xl overflow-hidden ${isDark ? 'bg-zinc-900 border-yellow-500/40 shadow-black/60' : 'bg-white border-yellow-400 shadow-gray-400/40'}`}
            style={{ top: pos.top, left: pos.left, width: POPOVER_W }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`absolute -top-[7px] left-6 w-3 h-3 rotate-45 border-l border-t ${isDark ? 'bg-zinc-900 border-yellow-500/40' : 'bg-yellow-50 border-yellow-400'}`} />
            <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <span className={`text-xs font-semibold truncate ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  Incompleta — {reservadas}/{esperadas} caras
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className={`p-0.5 rounded transition-colors shrink-0 ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3">
              <p className={`text-[10px] uppercase tracking-wide font-semibold mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Desglose por catorcena</p>
              {isLoading ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cargando...</span>
                </div>
              ) : detail && detail.length > 0 ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {detail.map(d => (
                    <div key={`${d.anio}-${d.catorcena}`} className="flex items-center justify-between gap-4">
                      <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Cat {String(d.catorcena).padStart(2, '0')} / {d.anio}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        d.completa
                          ? (isDark ? 'text-green-300 bg-green-500/20 border border-green-500/30' : 'text-green-700 bg-green-50 border border-green-200')
                          : (isDark ? 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/30' : 'text-yellow-700 bg-yellow-50 border border-yellow-200')
                      }`}>
                        {d.reservas_count}/{d.caras_esperadas} {d.completa ? '✓' : `— faltan ${d.caras_esperadas - d.reservas_count}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Sin desglose disponible</p>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
