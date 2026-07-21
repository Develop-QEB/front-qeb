import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronDown, ChevronUp, Loader2, Clock } from 'lucide-react';
import { notasDireccionService, NotaDireccion } from '../../services/notasDireccion.service';
import { formatDate } from '../../lib/utils';

interface Props {
  idSolicitud: number;
  isDark: boolean;
  // Cuenta pre-cargada del back (opcional). Si viene 0 y no hay nota inicial,
  // saltamos el fetch para no gastar round-trip.
  bitacoraCount?: number;
  // Contenedor: 'card' (default, con borde propio) o 'inline' (sin borde,
  // encaja dentro del formulario donde reemplaza el textarea).
  variant?: 'card' | 'inline';
}

// Bitacora de Notas Direccion — SOLO LECTURA.
// La creacion de notas ocurre desde NuevaNotaDireccionModal al guardar cambios
// que disparan autorizacion (feedback de Jos 2026-07-08 — Direccion no agrega,
// solo consume la ultima nota; el asesor pone la nota especifica de cada
// autorizacion desde el mini-modal al guardar).
export function NotasDireccionBitacora({ idSolicitud, isDark, bitacoraCount, variant = 'card' }: Props) {
  const [expanded, setExpanded] = useState(false);

  const notasQuery = useQuery({
    queryKey: ['notas-direccion', idSolicitud],
    queryFn: () => notasDireccionService.getAll(idSolicitud),
    // Siempre que haya idSolicitud, hacer fetch. El bitacoraCount que viene
    // del payload de la notificación puede ser 0 (sin bitácora nueva) aunque
    // la solicitud SÍ tenga notas viejas en solicitud.notas — el endpoint
    // devuelve una entrada "inicial" sintética con ese texto y hay que
    // mostrarla. Antes: enabled: expanded || (bitacoraCount ?? 1) > 0
    // saltaba el fetch cuando bitacoraCount=0 y Gerardo veía "Sin notas
    // registradas" en todas las autorizaciones viejas.
    enabled: idSolicitud > 0,
    staleTime: 30_000,
  });

  const notas = notasQuery.data ?? [];
  const notaReciente = notas.length > 0 ? notas[notas.length - 1] : null;
  const anteriores = notas.length > 1 ? notas.slice(0, -1) : [];
  const totalAnteriores = anteriores.length;

  const wrapperClass = variant === 'card'
    ? `p-5 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`
    : '';

  return (
    <div className={wrapperClass}>
      <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider mb-2 flex items-center gap-2`}>
        <FileText className="h-3.5 w-3.5 text-orange-400" />
        Notas Dirección
      </h3>

      {notasQuery.isLoading && (
        <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando bitácora...
        </div>
      )}

      {!notasQuery.isLoading && notaReciente && (
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800/30 border-zinc-800/50' : 'bg-gray-50 border-gray-200'} border`}>
          <div className={`flex items-center justify-between mb-2 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            <span className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded ${notaReciente.origen === 'inicial'
                ? (isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700')
                : (isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-700')} text-[10px] font-medium uppercase tracking-wide`}>
                {notaReciente.origen === 'inicial' ? 'Nota inicial' : 'Más reciente'}
              </span>
              {notaReciente.autor_nombre && (
                <span>{notaReciente.autor_nombre}{notaReciente.autor_rol ? ` · ${notaReciente.autor_rol}` : ''}</span>
              )}
            </span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(notaReciente.created_at)}</span>
          </div>
          <p className={`text-sm ${isDark ? 'text-zinc-200' : 'text-gray-700'} whitespace-pre-wrap break-words leading-relaxed`}>
            {notaReciente.texto}
          </p>
        </div>
      )}

      {!notasQuery.isLoading && !notaReciente && (
        <p className={`text-xs italic ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Sin notas registradas.</p>
      )}

      {totalAnteriores > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-700'} transition-colors`}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Ocultar historial' : `Ver historial (${totalAnteriores})`}
          </button>

          {expanded && (
            <div className={`mt-3 space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-purple`}>
              {[...anteriores].reverse().map(n => (
                <div key={n.id} className={`p-3 rounded-lg ${isDark ? 'bg-zinc-900/40 border-zinc-800/40' : 'bg-white border-gray-200'} border`}>
                  <div className={`flex items-center justify-between mb-1.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                    <span>{n.autor_nombre || 'Sin autor'}{n.autor_rol ? ` · ${n.autor_rol}` : ''}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(n.created_at)}</span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-gray-700'} whitespace-pre-wrap break-words leading-relaxed`}>
                    {n.texto}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export type { NotaDireccion };
