import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, ChevronDown, ChevronUp, Send, Loader2, Clock } from 'lucide-react';
import { notasDireccionService, NotaDireccion } from '../../services/notasDireccion.service';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../lib/utils';

const ROLES_QUE_AGREGAN = ['Director General', 'Director Comercial', 'Administrador', 'DEV'];

interface Props {
  idSolicitud: number;
  isDark: boolean;
  bitacoraCount?: number;
  onNotaAgregada?: () => void;
}

export function NotasDireccionBitacora({ idSolicitud, isDark, bitacoraCount, onNotaAgregada }: Props) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');

  const puedeAgregar = !!user?.rol && ROLES_QUE_AGREGAN.includes(user.rol);

  const notasQuery = useQuery({
    queryKey: ['notas-direccion', idSolicitud],
    queryFn: () => notasDireccionService.getAll(idSolicitud),
    enabled: expanded || (bitacoraCount ?? 0) === 0,
  });

  const addMutation = useMutation({
    mutationFn: (texto: string) => notasDireccionService.create(idSolicitud, texto),
    onSuccess: () => {
      setNuevaNota('');
      queryClient.invalidateQueries({ queryKey: ['notas-direccion', idSolicitud] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      onNotaAgregada?.();
    },
  });

  const notas = notasQuery.data ?? [];
  const notaReciente = notas.length > 0 ? notas[notas.length - 1] : null;
  const anteriores = notas.length > 1 ? notas.slice(0, -1) : [];
  const totalAnteriores = anteriores.length;

  return (
    <div className={`p-5 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
      <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
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

      {puedeAgregar && (
        <div className={`mt-4 pt-3 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <label className={`text-[11px] uppercase tracking-wider font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'} block mb-1.5`}>
            Agregar nota nueva
          </label>
          <textarea
            value={nuevaNota}
            onChange={e => setNuevaNota(e.target.value)}
            rows={3}
            placeholder="Escribe la nota que se enviará a Dirección..."
            className={`w-full text-sm rounded-lg px-3 py-2 resize-none ${isDark
              ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 placeholder:text-zinc-600'
              : 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-400'} border focus:outline-none focus:border-purple-500/50`}
            disabled={addMutation.isPending}
          />
          {addMutation.isError && (
            <p className="mt-1 text-xs text-red-400">
              {(addMutation.error as Error)?.message || 'No se pudo agregar la nota.'}
            </p>
          )}
          <div className="flex justify-end mt-2">
            <button
              onClick={() => nuevaNota.trim() && addMutation.mutate(nuevaNota.trim())}
              disabled={!nuevaNota.trim() || addMutation.isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!nuevaNota.trim() || addMutation.isPending
                ? (isDark ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                : (isDark ? 'bg-purple-600/80 hover:bg-purple-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white')}`}
            >
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Agregar nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { NotaDireccion };
