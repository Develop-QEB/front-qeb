import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { capasMapaService } from '../../services/capasMapa.service';
import { CapaMapa, MODO_LABEL, MODO_DESCRIPCION, ORIGEN_CAPA_LABEL, colorCapa, resumenCapa } from './capasMapa';

// Pestaña "Capas" del modal de Buscar Inventario (propuestas y campañas):
// gestion de las capas de POI/KML guardadas del circuito abierto. Aqui se
// pueden ocultar al cliente o eliminar sin tener que ir a la Vista Compartir.
// Eliminar una capa solo quita su visualizacion; el inventario no cambia.
interface Props {
  solicitudCarasId: number | null;
  canEdit: boolean;
  isDark: boolean;
}

export function CapasCircuitoPanel({ solicitudCarasId, canEdit, isDark }: Props) {
  const queryClient = useQueryClient();
  const { data: capas = [], isLoading } = useQuery({
    queryKey: ['capas-mapa-circuito', solicitudCarasId],
    queryFn: () => capasMapaService.listarPorCircuito(solicitudCarasId!),
    enabled: !!solicitudCarasId,
  });
  const [ocupadaId, setOcupadaId] = useState<number | null>(null);

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['capas-mapa-circuito', solicitudCarasId] });
    // La Vista Compartir interna cachea por propuesta con otra clave.
    void queryClient.invalidateQueries({ queryKey: ['capas-mapa'] });
  };

  const handleCambiarVisible = async (capa: CapaMapa) => {
    setOcupadaId(capa.id);
    try {
      await capasMapaService.actualizar(capa.id, { visibleCliente: !capa.visible_cliente });
      invalidar();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo actualizar la capa');
    } finally {
      setOcupadaId(null);
    }
  };

  const handleEliminar = async (capa: CapaMapa) => {
    if (!window.confirm(`¿Eliminar la capa "${capa.nombre}"?\n\nDejará de verse en la Vista Compartir y en el link del cliente. El inventario del circuito no cambia.`)) return;
    setOcupadaId(capa.id);
    try {
      await capasMapaService.eliminar(capa.id);
      invalidar();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo eliminar la capa');
    } finally {
      setOcupadaId(null);
    }
  };

  const txt = isDark ? 'text-zinc-200' : 'text-gray-800';
  const sub = isDark ? 'text-zinc-500' : 'text-gray-400';
  const borde = isDark ? 'border-zinc-800' : 'border-gray-200';

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-sky-500" />
          <h3 className={`text-sm font-semibold ${txt}`}>Capas de Tráfico del circuito</h3>
          {capas.length > 0 && <span className={`text-xs ${sub}`}>({capas.length})</span>}
        </div>
        <p className={`text-xs ${sub}`}>
          Pines y polígonos guardados al usar "Conservar con/sin POIs" en el buscador. Se muestran como
          capas activables en la Vista Compartir y en el link del cliente. Eliminar una capa solo quita
          esa visualización; el inventario reservado no cambia.
        </p>

        {!solicitudCarasId ? (
          <p className={`text-sm ${sub} py-8 text-center`}>Selecciona un circuito para ver sus capas.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>
        ) : capas.length === 0 ? (
          <p className={`text-sm ${sub} py-8 text-center`}>
            Este circuito no tiene capas guardadas. Se crean desde las herramientas de puntos de interés
            del buscador, al apretar "Conservar con/sin POIs".
          </p>
        ) : (
          <div className={`rounded-xl border ${borde} divide-y ${isDark ? 'divide-zinc-800' : 'divide-gray-200'} overflow-hidden`}>
            {capas.map(capa => {
              const color = colorCapa(capa);
              const ocupada = ocupadaId === capa.id;
              return (
                <div key={capa.id} className={`flex items-start gap-3 p-3 ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50'}`}>
                  <span className="mt-1 inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${txt}`}>{capa.nombre}</p>
                    <p className={`text-xs ${sub}`} title={MODO_DESCRIPCION[capa.modo]}>
                      {MODO_LABEL[capa.modo]} · {resumenCapa(capa)} · {ORIGEN_CAPA_LABEL[capa.origen]}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${sub}`}>
                      {capa.creado_por_nombre ? `${capa.creado_por_nombre} · ` : ''}
                      {new Date(capa.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {!capa.visible_cliente && (
                        <span className={`ml-2 px-1.5 py-px rounded text-[10px] font-semibold border ${isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          Oculta para el cliente
                        </span>
                      )}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      {ocupada ? (
                        <Loader2 className={`h-4 w-4 animate-spin ${sub}`} />
                      ) : (
                        <>
                          <button
                            onClick={() => void handleCambiarVisible(capa)}
                            className={`p-1.5 rounded-lg ${sub} hover:text-sky-500 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}
                            title={capa.visible_cliente ? 'Ocultar para el cliente' : 'Mostrar al cliente'}
                          >
                            {capa.visible_cliente ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => void handleEliminar(capa)}
                            className={`p-1.5 rounded-lg ${sub} hover:text-red-500 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}
                            title="Eliminar capa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
