import { useState } from 'react';
import { Layers, ChevronDown, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import {
  CapaMapa, MODO_LABEL, MODO_DESCRIPCION, ORIGEN_CAPA_LABEL, colorCapa, resumenCapa,
  agruparCapasPorCircuito,
} from './capasMapa';

// Panel flotante de capas (Vista Compartir interna y visor publico). Lista las
// capas agrupadas por circuito con un checkbox para prender/apagar cada una.
// Las capas NACEN apagadas: son "activables", no se pintan solas.
//
// `interno` = Vista Compartir del asesor: muestra ademas el chip "oculta para
// el cliente" y las acciones de visibilidad/borrado. El visor publico solo
// recibe capas visibles y no ve nada de eso.
interface Props {
  capas: CapaMapa[];
  activas: Set<number>;
  onToggle: (id: number) => void;
  onToggleTodas: (activar: boolean) => void;
  /** Nombre legible del circuito (articulo/formato). null -> "Circuito #id". */
  nombreCircuito?: (solicitudCarasId: number) => string | null;
  /**
   * Circuitos con inventario visible en el mapa (chips de catorcena, seleccion,
   * ?sel=). Las capas de circuitos fuera de ese conjunto se atenúan. null = sin filtro.
   */
  circuitosVisibles?: Set<number> | null;
  interno?: boolean;
  onCambiarVisible?: (capa: CapaMapa, visible: boolean) => void;
  onEliminar?: (capa: CapaMapa) => void;
  /** id de la capa con una accion en curso (spinner). */
  ocupadaId?: number | null;
  isDark?: boolean;
  className?: string;
}

export function CapasMapaPanel({
  capas, activas, onToggle, onToggleTodas, nombreCircuito, circuitosVisibles,
  interno = false, onCambiarVisible, onEliminar, ocupadaId = null, isDark = false, className = '',
}: Props) {
  const [abierto, setAbierto] = useState(true);
  if (capas.length === 0) return null;

  const grupos = Array.from(agruparCapasPorCircuito(capas).entries());
  const todasActivas = capas.every(c => activas.has(c.id));
  const nActivas = capas.filter(c => activas.has(c.id)).length;

  const txt = isDark ? 'text-zinc-200' : 'text-gray-800';
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const borde = isDark ? 'border-zinc-800' : 'border-gray-200';
  const hover = isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50';

  return (
    <div
      className={`flex flex-col rounded-xl shadow-lg border overflow-hidden backdrop-blur ${isDark ? 'bg-zinc-900/95 border-zinc-700' : 'bg-white/95 border-gray-200'} ${className}`}
    >
      <button
        onClick={() => setAbierto(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 w-full transition-colors shrink-0 ${hover}`}
      >
        <Layers className="h-4 w-4 text-sky-500" />
        <span className={`text-sm font-semibold ${txt}`}>Capas de Tráfico</span>
        <span className={`text-xs ${sub}`}>{nActivas > 0 ? `${nActivas}/${capas.length}` : `(${capas.length})`}</span>
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${sub} ${abierto ? '' : '-rotate-90'}`} />
      </button>

      {abierto && (
        <>
          <div className={`px-3 py-1.5 border-t border-b ${borde} flex items-center gap-2 shrink-0`}>
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              <input
                type="checkbox"
                checked={todasActivas}
                onChange={() => onToggleTodas(!todasActivas)}
                className="h-3.5 w-3.5 accent-sky-500 cursor-pointer"
              />
              Mostrar todas
            </label>
            <span className={`text-[10px] ml-auto ${sub}`}>
              <span className="inline-block h-2 w-2 rounded-full mr-1 align-middle" style={{ backgroundColor: '#0EA5E9' }} />cerca
              <span className="inline-block h-2 w-2 rounded-full ml-2 mr-1 align-middle" style={{ backgroundColor: '#E4002B' }} />lejos
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5 space-y-1.5">
            {grupos.map(([scId, lista]) => {
              const fuera = !!circuitosVisibles && !circuitosVisibles.has(scId);
              const titulo = nombreCircuito?.(scId) || `Circuito #${scId}`;
              return (
                <div key={scId} className={`rounded-lg border ${borde} overflow-hidden ${fuera ? 'opacity-50' : ''}`}>
                  <div className={`px-2 py-1 text-[11px] font-medium truncate ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-gray-50 text-gray-600'}`} title={fuera ? 'Circuito fuera del alcance actual del mapa' : titulo}>
                    {titulo}
                  </div>
                  {lista.map(capa => {
                    const activa = activas.has(capa.id);
                    const color = colorCapa(capa);
                    const ocupada = ocupadaId === capa.id;
                    return (
                      <div
                        key={capa.id}
                        className={`flex items-start gap-2 pl-2 pr-1.5 py-1.5 border-l-2 ${hover}`}
                        style={{ borderColor: activa ? color : 'transparent' }}
                        title={MODO_DESCRIPCION[capa.modo]}
                      >
                        <input
                          type="checkbox"
                          checked={activa}
                          onChange={() => onToggle(capa.id)}
                          className="h-3.5 w-3.5 mt-0.5 cursor-pointer shrink-0"
                          style={{ accentColor: color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-semibold truncate ${txt}`}>
                            <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: color }} />
                            {capa.nombre}
                          </div>
                          <div className={`text-[10px] truncate ${sub}`}>
                            {MODO_LABEL[capa.modo]} · {resumenCapa(capa)} · {ORIGEN_CAPA_LABEL[capa.origen]}
                          </div>
                          {interno && !capa.visible_cliente && (
                            <span className={`inline-block mt-0.5 px-1 py-px rounded text-[9px] font-semibold border ${isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              Oculta para el cliente
                            </span>
                          )}
                        </div>
                        {interno && (onCambiarVisible || onEliminar) && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {ocupada ? (
                              <Loader2 className={`h-3.5 w-3.5 animate-spin ${sub}`} />
                            ) : (
                              <>
                                {onCambiarVisible && (
                                  <button
                                    onClick={() => onCambiarVisible(capa, !capa.visible_cliente)}
                                    className={`p-1 rounded ${sub} hover:text-sky-500`}
                                    title={capa.visible_cliente ? 'Ocultar para el cliente' : 'Mostrar al cliente'}
                                  >
                                    {capa.visible_cliente ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                                {onEliminar && (
                                  <button
                                    onClick={() => onEliminar(capa)}
                                    className={`p-1 rounded ${sub} hover:text-red-500`}
                                    title="Eliminar capa"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
