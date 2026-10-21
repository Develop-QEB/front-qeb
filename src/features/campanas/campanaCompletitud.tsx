// Criterio de "Incompleta" y su badge con desglose por catorcena, para Campanas.
//
// Vivian dentro de CampanasPage; se extrajeron cuando la Vista Tablero necesito
// el mismo badge: duplicarlo habria dejado dos versiones del mismo criterio.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { campanasService } from '../../services/campanas.service';
import { Campana } from '../../types';

// Campaña con reservas por debajo de las caras esperadas (totales del listado,
// mismo criterio/exclusiones que el badge "Incompleta" del detalle de campaña).
export function esCampanaIncompleta(c: Campana): boolean {
  return c.caras_esperadas_total != null
    && Number(c.caras_esperadas_total) > 0
    && Number(c.reservas_validas_total ?? 0) < Number(c.caras_esperadas_total);
}

// Badge "Incompleta (X/Y caras)" para la tabla de campañas. Al dar clic abre el
// MISMO desglose por catorcena que el detalle de campaña (incompleteness_detail);
// el detalle se pide con getById solo cuando se abre, no en el render de la lista.
// Popover con position:fixed para que no lo recorte el overflow de la tabla.
export function IncompletaBadge({ campana, isDark }: { campana: Campana; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const { data: detalle, isLoading } = useQuery({
    queryKey: ['campana-incompleteness', campana.id],
    queryFn: () => campanasService.getById(campana.id),
    enabled: open,
    staleTime: 60000,
  });

  const esperadas = Number(campana.caras_esperadas_total) || 0;
  const reservadas = Number(campana.reservas_validas_total) || 0;
  // `incompleteness_detail` ya esta en el tipo Campana, que CampanaWithComments
  // extiende: el cast a any que traia este bloque no hacia falta.
  const detail = detalle?.incompleteness_detail;

  const POPOVER_W = 260;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anclado bajo el badge, alineado a su izquierda sin salirse del viewport.
      setPos({
        top: r.bottom + 8,
        left: Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8)),
      });
    }
    setOpen(v => !v);
  };

  // El popover es position:fixed (para que no lo recorte el overflow de la
  // tabla), así que al hacer scroll DE LA PÁGINA quedaría "volando" lejos del
  // badge: cerrarlo en cuanto se scrollea o cambia el tamaño de la ventana.
  // EXCEPCIÓN: el scroll de la lista interna del propio popover (desglose con
  // muchas catorcenas) no debe cerrarlo.
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
      {/* Portal a document.body: si el popover se renderiza dentro de la fila,
          cualquier ancestro con transform/backdrop-filter cambia el containing
          block de position:fixed y el popover aparece lejos del badge. */}
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            ref={popRef}
            className={`fixed z-50 rounded-xl border shadow-2xl overflow-hidden ${isDark ? 'bg-zinc-900 border-yellow-500/40 shadow-black/60' : 'bg-white border-yellow-400 shadow-gray-400/40'}`}
            style={{ top: pos.top, left: pos.left, width: POPOVER_W }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Flecha apuntando al badge */}
            <div
              className={`absolute -top-[7px] left-6 w-3 h-3 rotate-45 border-l border-t ${isDark ? 'bg-zinc-900 border-yellow-500/40' : 'bg-yellow-50 border-yellow-400'}`}
            />
            {/* Header */}
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
            {/* Body */}
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
