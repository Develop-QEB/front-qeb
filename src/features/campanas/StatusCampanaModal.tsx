import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, MessageSquare, Send, Loader2, MessageSquareOff } from 'lucide-react';
import { campanasService } from '../../services/campanas.service';
import { Campana } from '../../types';
import { UserAvatar } from '../../components/ui/user-avatar';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useSocketCampana } from '../../hooks/useSocket';
import { getPermissions } from '../../lib/permissions';

interface StatusCampanaModalProps {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana;
  statusReadOnly?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'Ajuste CTO Cliente', label: 'Ajuste CTO Cliente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'Atendido', label: 'Atendido', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'Ajuste Comercial', label: 'Ajuste Comercial', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'Aprobada', label: 'Aprobada', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
];

export function StatusCampanaModal({ isOpen, onClose, campana, statusReadOnly = false }: StatusCampanaModalProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user?.rol);
  const [selectedStatus, setSelectedStatus] = useState(campana.status || '');
  const [comment, setComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // WebSocket para actualizar comentarios en tiempo real
  useSocketCampana(isOpen ? campana.id : null);

  // Cargar datos de la campaña con comentarios
  const { data: campanaData, isLoading: isLoadingCampana } = useQuery({
    queryKey: ['campana', campana.id],
    queryFn: () => campanasService.getById(campana.id),
    enabled: isOpen,
  });

  const comentarios = campanaData?.comentarios || [];

  // Scroll al final cuando se agregan nuevos comentarios
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comentarios.length]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => campanasService.updateStatus(campana.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      queryClient.invalidateQueries({ queryKey: ['campana', campana.id] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (contenido: string) => campanasService.addComment(campana.id, contenido),
    onMutate: async (contenido) => {
      await queryClient.cancelQueries({ queryKey: ['campana', campana.id] });
      const previousCampana = queryClient.getQueryData(['campana', campana.id]);

      // Optimistic update
      queryClient.setQueryData(['campana', campana.id], (old: any) => {
        if (!old) return old;
        const newComment = {
          id: Date.now(),
          autor_id: user?.id || 0,
          autor_nombre: user?.nombre || 'Usuario',
          autor_foto: user?.foto_perfil || null,
          contenido,
          fecha: new Date().toISOString(),
        };
        return {
          ...old,
          comentarios: [...(old.comentarios || []), newComment],
        };
      });

      setComment('');
      return { previousCampana };
    },
    onError: (_err, _contenido, context) => {
      if (context?.previousCampana) {
        queryClient.setQueryData(['campana', campana.id], context.previousCampana);
      }
    },
  });

  const handleSave = async () => {
    try {
      if (selectedStatus && selectedStatus !== campana.status) {
        await updateStatusMutation.mutateAsync(selectedStatus);
      }
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  const isLoading = updateStatusMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Cambiar Estatus</h2>
            <p className="text-sm text-zinc-400 mt-0.5 truncate max-w-[350px]" title={campana.nombre}>
              {campana.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status Select */}
          {!statusReadOnly && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Estatus
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="">Seleccionar estatus...</option>
                {STATUS_OPTIONS
                  .filter((option) => !permissions.allowedCampanaStatuses || permissions.allowedCampanaStatuses.includes(option.value))
                  .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Status preview */}
              {selectedStatus && (
                <div className="mt-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                    STATUS_OPTIONS.find(o => o.value === selectedStatus)?.color || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
                  }`}>
                    {selectedStatus}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comentarios Section */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-zinc-800">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-400" />
              Comentarios
              {comentarios.length > 0 && (
                <span className="text-xs text-zinc-500">({comentarios.length})</span>
              )}
            </h3>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-3 min-h-[150px] max-h-[250px] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {isLoadingCampana ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
              </div>
            ) : comentarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <MessageSquareOff className="h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">Sin comentarios</p>
                <p className="text-xs text-zinc-600">Sé el primero en comentar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comentarios.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <UserAvatar nombre={c.autor_nombre} foto_perfil={c.autor_foto} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{c.autor_nombre || 'Usuario'}</span>
                        <span className="text-[10px] text-zinc-500">{formatDate(c.fecha)}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">{c.contenido}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>

          {/* Comment Input */}
          {!statusReadOnly && (
          <div className="p-3 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="md" />
              <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 focus-within:border-purple-500 transition-colors">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Escribe un comentario..."
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder:text-zinc-500"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!comment.trim() || addCommentMutation.isPending}
                  className="p-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        {!statusReadOnly && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !selectedStatus || selectedStatus === campana.status}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Estatus'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
