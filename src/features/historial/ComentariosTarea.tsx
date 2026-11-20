import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { notificacionesService } from '../../services/notificaciones.service';
import type { ComentarioTarea } from '../../types';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../lib/utils';

// Bitácora de comentarios de una tarea, para el detalle de la Actividad
// Comercial en el tablero de Historial de Acciones. Usa los MISMOS endpoints
// que el drawer de Notificaciones (/notificaciones/:id/comentarios), así que lo
// que se escribe en un lado se ve en el otro.
export function ComentariosTarea({ tareaId, isDark }: { tareaId: number; isDark: boolean }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const queryKey = ['tarea-comentarios', tareaId];

  const { data: comentarios = [], isLoading, isError } = useQuery<ComentarioTarea[]>({
    queryKey,
    queryFn: () => notificacionesService.getComments(tareaId),
    staleTime: 30_000,
    retry: false,
  });

  const agregar = useMutation({
    mutationFn: (contenido: string) => notificacionesService.addComment(tareaId, contenido),
    onSuccess: () => {
      setTexto('');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const enviar = () => {
    const t = texto.trim();
    if (!t || agregar.isPending) return;
    agregar.mutate(t);
  };

  const subText = isDark ? 'text-zinc-400' : 'text-gray-500';
  const panel = isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200';

  return (
    <div className={`rounded-xl border p-4 ${panel}`}>
      <div className={`text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2 ${subText}`}>
        <MessageSquare className="h-3.5 w-3.5" />
        Comentarios
        {comentarios.length > 0 && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] normal-case tracking-normal ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-600'}`}>
            {comentarios.length}
          </span>
        )}
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto mb-3 pr-1 scrollbar-purple">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className={`h-4 w-4 animate-spin ${subText}`} /></div>
        ) : isError ? (
          <p className="text-xs text-red-400 text-center py-4">No se pudieron cargar los comentarios</p>
        ) : comentarios.length === 0 ? (
          <p className={`text-xs text-center py-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>No hay comentarios aún</p>
        ) : (
          comentarios.map((c) => {
            const autor = c.autor_nombre || c.usuario_nombre || 'Usuario';
            return (
              <div key={c.id} className="flex gap-3">
                <UserAvatar nombre={autor} foto_perfil={c.autor_foto} size="lg" className="w-7 h-7" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{autor}</span>
                    <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{formatDate(c.fecha)}</span>
                  </div>
                  <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{c.contenido}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`flex items-center gap-2 p-2 rounded-xl border focus-within:border-amber-500/50 transition-colors ${isDark ? 'bg-zinc-900/60 border-zinc-700' : 'bg-white border-gray-200'}`}>
        <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="sm" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Escribe un comentario..."
          className={`flex-1 bg-transparent text-sm focus:outline-none ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-gray-900 placeholder:text-gray-400'}`}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || agregar.isPending}
          title="Enviar comentario"
          className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {agregar.isPending ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Send className="h-3.5 w-3.5 text-white" />}
        </button>
      </div>
      {agregar.isError && (
        <p className="text-xs text-red-400 mt-2">No se pudo guardar el comentario. Intenta de nuevo.</p>
      )}
    </div>
  );
}
