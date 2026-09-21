import { forwardRef, useImperativeHandle, useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Loader2, MessageSquare, MessageSquareOff, Send, X } from 'lucide-react';
import { propuestasService } from '../services/propuestas.service';
import { campanasService } from '../services/campanas.service';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { UserAvatar } from './ui/user-avatar';
import { formatDate } from '../lib/utils';

// Bitacora inline: se monta ARRIBA del modal de edicion de propuesta o campana.
// Permite al usuario cambiar estatus y agregar comentarios como parte del mismo
// flujo de edicion — pero SIN aplicar los cambios hasta que el padre invoque
// commit() (tipicamente en el mismo boton "Guardar Cambios" que ya existe abajo
// del modal).
//
// Diseñado para NO reemplazar el flujo desde la tabla general: los modales
// StatusModal (propuesta) y StatusCampanaModal siguen funcionando igual. Este
// componente es un extra para editar estatus/bitacora en linea al hacer otros
// cambios en la propuesta/campana.

export type BitacoraEntityKind = 'propuesta' | 'campana';

export interface BitacoraEstatusInlineHandle {
  hasPending: () => boolean;
  pendingCount: () => number;
  // Aplica los cambios pendientes (comentarios en cola + status) al backend.
  // Los comentarios se aplican PRIMERO (aditivos, menos propensos a error) y
  // el status al final. Si algo revienta, lanza para que el padre muestre el
  // toast de error de su flujo. No hace reset automatico — quien llama decide.
  commit: () => Promise<void>;
  reset: () => void;
}

export type StatusValidation = { disabled: boolean; reason?: string };

interface Props {
  kind: BitacoraEntityKind;
  entityId: number;
  currentStatus: string;
  // Opciones a mostrar en el select de estatus. Si el actual no esta en la
  // lista se agrega como disabled/actual arriba (mismo patron que StatusModal).
  statusOptions: string[];
  // Validacion por-status delegada al padre (bloqueo por autorizacion abierta,
  // cliente lead sin CUIC, etc.). Debe devolver disabled=true + reason cuando
  // ese status no se pueda seleccionar.
  getStatusValidation?: (status: string) => StatusValidation;
  canEditStatus?: boolean;
  canComment?: boolean;
  // Nombre visible del contexto (ej. "Propuesta #123", "Campaña Coca 2026-Q4")
  // — usado solo para el header/tooltips.
  contextLabel?: string;
  // Se invoca cuando cambia el estado "hay algo pendiente" para que el padre
  // habilite/pinte su boton principal de Guardar.
  onPendingChange?: (hasPending: boolean, count: number) => void;
  // Estado inicial del collapse. Default: expandido si estamos editando.
  defaultCollapsed?: boolean;
  // Si el padre esta guardando (bloquea inputs).
  saving?: boolean;
}

interface NormalizedComment {
  id: number | string;
  autor_nombre: string;
  autor_foto?: string | null;
  contenido: string;
  fecha: string;
  optimistic?: boolean;
}

export const BitacoraEstatusInline = forwardRef<BitacoraEstatusInlineHandle, Props>(function BitacoraEstatusInline(
  {
    kind,
    entityId,
    currentStatus,
    statusOptions,
    getStatusValidation,
    canEditStatus = true,
    canComment = true,
    contextLabel,
    onPendingChange,
    defaultCollapsed = false,
    saving = false,
  },
  ref,
) {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [pendingStatus, setPendingStatus] = useState<string>(currentStatus);
  const [pendingComments, setPendingComments] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  // Cambio de entidad => resetear todo lo pendiente (nueva propuesta/campana).
  // No sincronizamos automaticamente cuando cambia solo currentStatus para no
  // pisar la eleccion en curso del usuario si otro cliente cambio el estatus
  // por socket.
  useEffect(() => {
    setPendingStatus(currentStatus);
    setPendingComments([]);
    setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Fetch comentarios existentes. Reusa las mismas queryKeys del sistema para
  // aprovechar cache y socket refetches sin duplicar suscripciones.
  const { data: rawComments, isLoading: commentsLoading } = useQuery({
    queryKey: kind === 'propuesta' ? ['propuesta-comments', entityId] : ['campana', entityId],
    queryFn: async () => {
      if (kind === 'propuesta') {
        return await propuestasService.getComments(entityId);
      }
      const c = await campanasService.getById(entityId);
      return c?.comentarios || [];
    },
    enabled: !!entityId,
    staleTime: 60_000,
  });

  const comments: NormalizedComment[] = useMemo(() => {
    const list = Array.isArray(rawComments) ? rawComments : [];
    if (kind === 'propuesta') {
      return (list as Array<{ id: number; autor_nombre: string; autor_foto?: string | null; comentario: string; creado_en: string }>).map((c) => ({
        id: c.id,
        autor_nombre: c.autor_nombre || 'Usuario',
        autor_foto: c.autor_foto || null,
        contenido: c.comentario || '',
        fecha: c.creado_en,
      }));
    }
    return (list as Array<{ id: number; autor_nombre?: string; autor_foto?: string | null; contenido: string; fecha: string }>).map((c) => ({
      id: c.id,
      autor_nombre: c.autor_nombre || 'Usuario',
      autor_foto: c.autor_foto || null,
      contenido: c.contenido || '',
      fecha: c.fecha,
    }));
  }, [rawComments, kind]);

  const statusChanged = pendingStatus !== currentStatus && !!pendingStatus;
  const draftHasContent = draft.trim().length > 0;
  const hasPending = statusChanged || pendingComments.length > 0 || draftHasContent;
  const pendingCount = (statusChanged ? 1 : 0) + pendingComments.length + (draftHasContent ? 1 : 0);

  // Notificar al padre cada vez que cambia el estado "hay algo pendiente".
  useEffect(() => {
    onPendingChange?.(hasPending, pendingCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending, pendingCount]);

  // Auto-scroll al final cuando se agrega un comentario nuevo.
  useEffect(() => {
    if (!collapsed) listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [comments.length, pendingComments.length, collapsed]);

  const validationForPending = getStatusValidation?.(pendingStatus);
  const pendingStatusBlocked = validationForPending?.disabled === true && pendingStatus !== currentStatus;

  useImperativeHandle(
    ref,
    () => ({
      hasPending: () => hasPending,
      pendingCount: () => pendingCount,
      async commit() {
        // Consolidar draft en la cola antes de commit (por si el usuario
        // escribio algo y le dio directo al Guardar sin agregar).
        const toSend = [...pendingComments];
        const draftTrim = draft.trim();
        if (draftTrim) toSend.push(draftTrim);

        // 1) Comentarios (aditivos)
        for (const texto of toSend) {
          if (kind === 'propuesta') await propuestasService.addComment(entityId, texto);
          else await campanasService.addComment(entityId, texto);
        }

        // 2) Status change (validado por el padre, si trae reason lo rebota)
        if (statusChanged) {
          if (pendingStatusBlocked) {
            throw new Error(validationForPending?.reason || 'Cambio de estatus bloqueado');
          }
          if (kind === 'propuesta') {
            await propuestasService.updateStatus(entityId, pendingStatus);
          } else {
            await campanasService.updateStatus(entityId, pendingStatus);
          }
        }

        // 3) Invalidar queries relacionadas.
        if (kind === 'propuesta') {
          queryClient.invalidateQueries({ queryKey: ['propuesta-comments', entityId] });
          queryClient.invalidateQueries({ queryKey: ['propuestas'] });
          queryClient.invalidateQueries({ queryKey: ['propuestas-stats'] });
          queryClient.invalidateQueries({ queryKey: ['propuesta-fresh', entityId] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['campana', entityId] });
          queryClient.invalidateQueries({ queryKey: ['campanas'] });
        }

        // 4) Reset local. pendingStatus se sincronizara via prop currentStatus
        //    (que el padre recibira actualizado tras invalidar).
        setPendingComments([]);
        setDraft('');
      },
      reset() {
        setPendingStatus(currentStatus);
        setPendingComments([]);
        setDraft('');
      },
    }),
    // Dependencias: usar refs implicitas via closures. Reincluir todo lo que
    // toque commit para evitar closures stale entre renders.
    [hasPending, pendingCount, pendingComments, draft, statusChanged, pendingStatus, currentStatus, kind, entityId, queryClient, pendingStatusBlocked, validationForPending?.reason],
  );

  const queueDraft = () => {
    const t = draft.trim();
    if (!t) return;
    setPendingComments((prev) => [...prev, t]);
    setDraft('');
  };
  const removeQueued = (idx: number) => {
    setPendingComments((prev) => prev.filter((_, i) => i !== idx));
  };

  const inputDisabled = saving || !canComment;
  const statusDisabled = saving || !canEditStatus;

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-gray-50/30 border-gray-200/50'} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 border-b ${isDark ? 'border-zinc-700/50 hover:bg-zinc-800/50' : 'border-gray-200/50 hover:bg-gray-50/50'} transition-colors`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? <ChevronRight className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'} flex-shrink-0`} /> : <ChevronDown className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'} flex-shrink-0`} />}
          <MessageSquare className="h-4 w-4 text-purple-400 flex-shrink-0" />
          <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
            Estatus y Bitácora
            {contextLabel && <span className={`ml-2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>· {contextLabel}</span>}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isDark ? 'bg-zinc-800/60 text-zinc-300 border-zinc-700' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {currentStatus || 'Sin estatus'}
          </span>
          {hasPending && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {/* Aviso: se aplica al Guardar Cambios */}
          <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
            Los cambios de estatus y los nuevos comentarios se guardarán junto con el botón <strong>Guardar Cambios</strong> al final del modal.
          </div>

          {/* Status Selector */}
          {canEditStatus && (
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'} mb-1.5`}>Cambiar estatus a</label>
              <div className="flex items-center gap-2">
                <select
                  value={pendingStatus}
                  disabled={statusDisabled}
                  onChange={(e) => setPendingStatus(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-900'} border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {currentStatus && !statusOptions.includes(currentStatus) && (
                    <option value={currentStatus} disabled>{currentStatus} (actual)</option>
                  )}
                  {statusOptions.map((s) => {
                    const v = getStatusValidation?.(s) || { disabled: false };
                    const isCurrent = s === currentStatus;
                    return (
                      <option key={s} value={s} disabled={!isCurrent && v.disabled}>
                        {s}{!isCurrent && v.disabled && v.reason ? ` (${v.reason})` : ''}{isCurrent ? ' (actual)' : ''}
                      </option>
                    );
                  })}
                </select>
                {statusChanged && (
                  <button
                    type="button"
                    onClick={() => setPendingStatus(currentStatus)}
                    disabled={saving}
                    className={`px-2.5 py-2 text-xs rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'} transition-colors disabled:opacity-50`}
                    title="Cancelar cambio de estatus"
                  >
                    Deshacer
                  </button>
                )}
              </div>
              {statusChanged && !pendingStatusBlocked && (
                <p className={`text-[10px] mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  Se cambiará de <strong>{currentStatus}</strong> a <strong>{pendingStatus}</strong> al guardar.
                </p>
              )}
              {statusChanged && pendingStatusBlocked && (
                <p className={`text-[10px] mt-1 flex items-center gap-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  <AlertTriangle className="h-3 w-3" />
                  {validationForPending?.reason || 'Este estatus está bloqueado.'}
                </p>
              )}
            </div>
          )}

          {/* Comentarios: existentes + cola pendiente */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                Bitácora ({comments.length}{pendingComments.length > 0 ? ` + ${pendingComments.length} pendiente${pendingComments.length === 1 ? '' : 's'}` : ''})
              </label>
              {commentsLoading && <Loader2 className="h-3 w-3 animate-spin text-purple-400" />}
            </div>
            <div className={`max-h-[180px] overflow-auto rounded-lg border ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'} p-2 space-y-2`}>
              {comments.length === 0 && pendingComments.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-4 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <MessageSquareOff className="h-6 w-6 opacity-40 mb-1" />
                  <p className="text-xs">Sin comentarios</p>
                </div>
              ) : (
                <>
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <UserAvatar nombre={c.autor_nombre} foto_perfil={c.autor_foto || undefined} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.autor_nombre}</span>
                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{c.fecha ? formatDate(c.fecha) : ''}</span>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-gray-700'} mt-0.5 whitespace-pre-wrap break-words`}>{c.contenido}</p>
                      </div>
                    </div>
                  ))}
                  {pendingComments.map((texto, idx) => (
                    <div key={`pending-${idx}`} className={`flex gap-2 rounded-lg p-1.5 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                      <UserAvatar nombre={user?.nombre} foto_perfil={user?.foto_perfil} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.nombre || 'Tú'}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/40 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Pendiente
                          </span>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-zinc-200' : 'text-gray-800'} mt-0.5 whitespace-pre-wrap break-words`}>{texto}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQueued(idx)}
                        disabled={saving}
                        className={`self-start p-0.5 rounded ${isDark ? 'text-zinc-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} disabled:opacity-40`}
                        title="Quitar comentario pendiente"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div ref={listEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Nuevo comentario */}
          {canComment && (
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'} mb-1.5`}>
                Nuevo comentario
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      queueDraft();
                    }
                  }}
                  disabled={inputDisabled}
                  placeholder="Escribe un comentario... (Ctrl/⌘+Enter para agregar a pendientes)"
                  rows={2}
                  className={`flex-1 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'} border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none disabled:opacity-60`}
                />
                <button
                  type="button"
                  onClick={queueDraft}
                  disabled={inputDisabled || !draftHasContent}
                  className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Agregar a pendientes"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                El comentario se enviará al Guardar Cambios. También puedes agregarlo a pendientes con el botón — de cualquier forma se guarda hasta que le des Guardar Cambios abajo.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BitacoraEstatusInline;
