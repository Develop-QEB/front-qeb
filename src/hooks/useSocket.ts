import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifToastStore } from '../store/notifToastStore';
import type { PreferenciasNotif } from '../services/notificaciones.service';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

// Eventos que el servidor puede emitir
export const SOCKET_EVENTS = {
  // Tareas
  TAREA_CREADA: 'tarea:creada',
  TAREA_ACTUALIZADA: 'tarea:actualizada',
  TAREA_ELIMINADA: 'tarea:eliminada',

  // Notificaciones
  NOTIFICACION_NUEVA: 'notificacion:nueva',
  NOTIFICACION_LEIDA: 'notificacion:leida',

  // Artes
  ARTE_SUBIDO: 'arte:subido',
  ARTE_APROBADO: 'arte:aprobado',
  ARTE_RECHAZADO: 'arte:rechazado',
  ARTE_ESTATUS_OPERACIONES_ACTUALIZADO: 'arte:estatus-operaciones:actualizado',

  // Inventario
  INVENTARIO_ACTUALIZADO: 'inventario:actualizado',
  INVENTARIO_CREADO: 'inventario:creado',
  INVENTARIO_ELIMINADO: 'inventario:eliminado',
  // Real-time: buscadores de inventario marcan/quitan espacios ocupados en vivo.
  INVENTARIO_OCUPADO: 'inventario:ocupado',
  INVENTARIO_LIBERADO: 'inventario:liberado',

  // Reservas y Propuestas
  RESERVA_CREADA: 'reserva:creada',
  RESERVA_ELIMINADA: 'reserva:eliminada',
  RESERVA_PROGRESO: 'reserva:progreso',
  PROPUESTA_ACTUALIZADA: 'propuesta:actualizada',
  PROPUESTA_CREADA: 'propuesta:creada',
  PROPUESTA_ELIMINADA: 'propuesta:eliminada',
  PROPUESTA_STATUS_CHANGED: 'propuesta:status:changed',

  // Autorizaciones
  AUTORIZACION_APROBADA: 'autorizacion:aprobada',
  AUTORIZACION_RECHAZADA: 'autorizacion:rechazada',

  // Equipos
  EQUIPO_MIEMBROS_ACTUALIZADO: 'equipo:miembros:actualizado',

  // Solicitudes
  SOLICITUD_CREADA: 'solicitud:creada',
  SOLICITUD_ACTUALIZADA: 'solicitud:actualizada',
  SOLICITUD_ELIMINADA: 'solicitud:eliminada',
  SOLICITUD_STATUS_CHANGED: 'solicitud:status:changed',

  // Campañas
  CAMPANA_CREADA: 'campana:creada',
  CAMPANA_ACTUALIZADA: 'campana:actualizada',
  CAMPANA_ELIMINADA: 'campana:eliminada',
  CAMPANA_STATUS_CHANGED: 'campana:status:changed',
  CAMPANA_COMENTARIO_CREADO: 'campana:comentario:creado',
  CAMPANA_APS_POSTED: 'campana:aps:posted',

  // Clientes
  CLIENTE_CREADO: 'cliente:creado',
  CLIENTE_ACTUALIZADO: 'cliente:actualizado',
  CLIENTE_ELIMINADO: 'cliente:eliminado',

  // Proveedores
  PROVEEDOR_CREADO: 'proveedor:creado',
  PROVEEDOR_ACTUALIZADO: 'proveedor:actualizado',
  PROVEEDOR_ELIMINADO: 'proveedor:eliminado',

  // Dashboard
  DASHBOARD_UPDATED: 'dashboard:updated',
  DASHBOARD_STATS_CHANGED: 'dashboard:stats:changed',

  // General
  DATOS_ACTUALIZADOS: 'datos:actualizados',

  // Chatbot
  CHATBOT_LOG_NUEVO: 'chatbot:log:nuevo',

  // Tickets Historial
  TICKET_MENSAJE_NUEVO: 'ticket:mensaje:nuevo',
  TICKET_STATUS_CHANGED: 'ticket:status:changed',
  TICKET_CHAT_NUEVO: 'ticket:chat:nuevo',

  // Historial de Acciones
  HISTORIAL_NUEVA: 'historial:nueva',
};

let socketInstance: Socket | null = null;

// Track active rooms for automatic re-join on reconnection
const activeRooms = new Set<string>();

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Conectado al servidor:', socketInstance?.id);
      // Re-join all active rooms on reconnection
      if (activeRooms.size > 0) {
        console.log('[Socket] Re-joining rooms:', Array.from(activeRooms));
        for (const room of activeRooms) {
          socketInstance?.emit(room);
        }
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Desconectado:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket] Error de conexión:', error.message);
    });
  }
  return socketInstance;
}

/**
 * Join a socket room and track it for automatic re-joining on reconnection
 */
function joinRoom(socket: Socket, roomEvent: string) {
  activeRooms.add(roomEvent);
  socket.emit(roomEvent);
}

/**
 * Leave a socket room and stop tracking it
 */
function leaveRoom(socket: Socket, roomEvent: string) {
  activeRooms.delete(roomEvent);
  socket.emit(roomEvent.replace('join-', 'leave-'));
}

/**
 * Hook para manejar conexión WebSocket y suscribirse a eventos de una campaña
 */
export function useSocketCampana(campanaId: number | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!campanaId || campanaId <= 0) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Unirse al room de la campaña
    if (joinedRoomRef.current !== campanaId) {
      if (joinedRoomRef.current) {
        socket.emit('leave-campana', joinedRoomRef.current);
      }
      socket.emit('join-campana', campanaId);
      joinedRoomRef.current = campanaId;
      console.log('[Socket] Unido a campaña:', campanaId);
    }

    // Handlers para eventos de tareas
    const handleTareaCreada = (data: { tareaId: number; campanaId: number }) => {
      console.log('[Socket] Tarea creada:', data);
      // Invalidar query de tareas para que se recargue
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', data.campanaId] });
    };

    const handleTareaActualizada = (data: { tareaId: number; campanaId: number }) => {
      console.log('[Socket] Tarea actualizada:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', data.campanaId] });
    };

    const handleTareaEliminada = (data: { tareaId: number; campanaId: number }) => {
      console.log('[Socket] Tarea eliminada:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', data.campanaId] });
    };

    const handleArteSubido = (data: { campanaId: number }) => {
      console.log('[Socket] Arte subido:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes', data.campanaId] });
    };

    const handleArteAprobado = (data: { campanaId: number }) => {
      console.log('[Socket] Arte aprobado:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', data.campanaId] });
    };

    const handleArteRechazado = (data: { campanaId: number }) => {
      console.log('[Socket] Arte rechazado:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', data.campanaId] });
    };

    const handleArteEstatusOperacionesActualizado = (data: { campanaId: number; archivo: string }) => {
      console.log('[Socket] Estatus operaciones actualizado:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-tareas', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['tradicional-file-summaries', data.campanaId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['digital-file-summaries', data.campanaId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['artes-tradicionales', data.campanaId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['imagenes-digitales', data.campanaId], exact: false });
    };

    const handleInventarioActualizado = (data: { campanaId: number }) => {
      console.log('[Socket] Inventario actualizado:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes', data.campanaId] });
    };

    const handleAutorizacionAprobadaCampana = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización aprobada (campaña):', data);
      // Invalidar caras de la campaña para refrescar estados de autorización
      queryClient.invalidateQueries({ queryKey: ['campana-caras'] });
      queryClient.invalidateQueries({ queryKey: ['campana-full'] });
    };

    const handleAutorizacionRechazadaCampana = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización rechazada (campaña):', data);
      queryClient.invalidateQueries({ queryKey: ['campana-caras'] });
      queryClient.invalidateQueries({ queryKey: ['campana-full'] });
    };

    const handleComentarioCreado = (data: { campanaId: number; comentario: { id: number; autor_id: number; autor_nombre: string; autor_foto?: string | null; contenido: string; fecha: string } }) => {
      console.log('[Socket] Comentario creado:', data);
      // Agregar comentario al cache sin recargar toda la campaña
      queryClient.setQueryData(['campana', data.campanaId], (old: any) => {
        if (!old) return old;
        // Verificar si el comentario ya existe por ID o por contenido+autor (para optimistic updates)
        const existingComment = old.comentarios?.find((c: any) =>
          c.id === data.comentario.id ||
          (c.contenido === data.comentario.contenido && c.autor_id === data.comentario.autor_id)
        );
        if (existingComment) {
          // Si existe un comentario temporal con el mismo contenido, actualizar solo el ID (preservar foto)
          return {
            ...old,
            comentarios: old.comentarios.map((c: any) =>
              (c.contenido === data.comentario.contenido && c.autor_id === data.comentario.autor_id && c.id > 1000000000000)
                ? { ...c, id: data.comentario.id } // Solo actualizar el ID, preservar la foto
                : c
            ),
          };
        }
        return {
          ...old,
          comentarios: [...(old.comentarios || []), data.comentario],
        };
      });
    };

    const handleAPSPosted = (data: { campanaId: number; posted_aps: number[] }) => {
      console.log('[Socket] APS posteados:', data);
      queryClient.setQueryData(['campana', data.campanaId], (old: any) => {
        if (!old) return old;
        return { ...old, posted_aps: data.posted_aps };
      });
    };

    // Suscribirse a eventos
    socket.on(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
    socket.on(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
    socket.on(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);
    socket.on(SOCKET_EVENTS.ARTE_SUBIDO, handleArteSubido);
    socket.on(SOCKET_EVENTS.ARTE_APROBADO, handleArteAprobado);
    socket.on(SOCKET_EVENTS.ARTE_RECHAZADO, handleArteRechazado);
    socket.on(SOCKET_EVENTS.ARTE_ESTATUS_OPERACIONES_ACTUALIZADO, handleArteEstatusOperacionesActualizado);
    socket.on(SOCKET_EVENTS.INVENTARIO_ACTUALIZADO, handleInventarioActualizado);
    socket.on(SOCKET_EVENTS.CAMPANA_COMENTARIO_CREADO, handleComentarioCreado);
    socket.on(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobadaCampana);
    socket.on(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazadaCampana);
    socket.on(SOCKET_EVENTS.CAMPANA_APS_POSTED, handleAPSPosted);

    return () => {
      // Limpiar listeners al desmontar
      socket.off(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
      socket.off(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
      socket.off(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);
      socket.off(SOCKET_EVENTS.ARTE_SUBIDO, handleArteSubido);
      socket.off(SOCKET_EVENTS.ARTE_APROBADO, handleArteAprobado);
      socket.off(SOCKET_EVENTS.ARTE_RECHAZADO, handleArteRechazado);
      socket.off(SOCKET_EVENTS.ARTE_ESTATUS_OPERACIONES_ACTUALIZADO, handleArteEstatusOperacionesActualizado);
      socket.off(SOCKET_EVENTS.INVENTARIO_ACTUALIZADO, handleInventarioActualizado);
      socket.off(SOCKET_EVENTS.CAMPANA_COMENTARIO_CREADO, handleComentarioCreado);
      socket.off(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobadaCampana);
      socket.off(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazadaCampana);
      socket.off(SOCKET_EVENTS.CAMPANA_APS_POSTED, handleAPSPosted);
    };
  }, [campanaId, queryClient]);

  // Función para emitir eventos manualmente si se necesita
  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar notificaciones globales
 */
export function useSocketNotificaciones(
  userId?: number | null,
  opts?: { popups?: boolean }
) {
  const queryClient = useQueryClient();
  // popups: solo una instancia (el Header) debe mostrar popups para no duplicar.
  const popups = opts?.popups ?? false;

  useEffect(() => {
    const socket = getSocket();

    const handleNotificacionNueva = (payload?: {
      tipo?: string;
      clase?: 'notificacion' | 'tarea';
      categoria?: string;
      titulo?: string;
      descripcion?: string;
      tarea_id?: number;
      historial_id?: number;
      fecha_entrega?: string;
      destinatarios?: number[];
    }) => {
      console.log('[Socket] Nueva notificación', payload);

      // Filtrar por destinatario. Si el evento viene "dirigido" (trae lista de
      // destinatarios) y yo no estoy en ella, no es para mí: ni refresco ni popup.
      const dest = payload?.destinatarios;
      const dirigido = Array.isArray(dest);
      const paraMi = dirigido && userId != null && dest!.includes(userId);
      if (dirigido && !paraMi) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'], refetchType: 'active' });

      // Popup SOLO para eventos dirigidos a mí. Los eventos antiguos sin
      // `destinatarios` refrescan la lista pero no disparan popup (evita popups
      // masivos a todos los usuarios conectados).
      if (!popups || !paraMi) return;

      // Decidir el popup según las preferencias del usuario (opt-out: si no hay
      // preferencias cargadas o no hay regla, se muestra).
      const prefsData = queryClient.getQueryData<{ preferencias: PreferenciasNotif }>(['notif-preferencias']);
      const prefs = prefsData?.preferencias;
      const clase: 'tarea' | 'notificacion' = payload?.clase === 'tarea' ? 'tarea' : 'notificacion';
      const clave = clase === 'tarea' ? (payload?.tipo || '') : (payload?.categoria || 'general');

      let permitido = true;
      if (prefs) {
        const canal = prefs.popup;
        const masterClase = clase === 'tarea' ? canal.masterTarea : canal.masterNotificacion;
        if (!canal.master) permitido = false;
        else if (masterClase === false) permitido = false;
        else if (canal[clase]?.[clave] === false) permitido = false;
      }
      if (!permitido) return;

      const esRecordatorio = payload?.tipo === 'Recordatorio';
      useNotifToastStore.getState().push({
        titulo: payload?.titulo || (esRecordatorio ? 'Recordatorio QEB' : 'Nueva notificación'),
        descripcion: payload?.descripcion
          ?? (payload?.fecha_entrega ? `Fecha: ${new Date(payload.fecha_entrega).toLocaleDateString('es-MX')}` : undefined),
        tareaId: payload?.tarea_id,
        tipo: payload?.tipo,
        requireInteraction: esRecordatorio,
      });
    };

    const handleNotificacionLeida = () => {
      console.log('[Socket] Notificación leída');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'], refetchType: 'active' });
    };

    const handleTareaCreada = () => {
      console.log('[Socket] Tarea creada');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'], refetchType: 'active' });
    };

    const handleTareaActualizada = () => {
      console.log('[Socket] Tarea actualizada');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'], refetchType: 'active' });
    };

    const handleTareaEliminada = () => {
      console.log('[Socket] Tarea eliminada');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.NOTIFICACION_NUEVA, handleNotificacionNueva);
    socket.on(SOCKET_EVENTS.NOTIFICACION_LEIDA, handleNotificacionLeida);
    socket.on(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
    socket.on(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
    socket.on(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICACION_NUEVA, handleNotificacionNueva);
      socket.off(SOCKET_EVENTS.NOTIFICACION_LEIDA, handleNotificacionLeida);
      socket.off(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
      socket.off(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
      socket.off(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);
    };
  }, [queryClient, userId, popups]);
}

/**
 * Hook para escuchar eventos de propuestas y reservas
 */
export function useSocketPropuesta(propuestaId: number | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!propuestaId || propuestaId <= 0) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Unirse al room de la propuesta
    if (joinedRoomRef.current !== propuestaId) {
      if (joinedRoomRef.current) {
        socket.emit('leave-propuesta', joinedRoomRef.current);
      }
      socket.emit('join-propuesta', propuestaId);
      joinedRoomRef.current = propuestaId;
      console.log('[Socket] Unido a propuesta:', propuestaId);
    }

    // Handlers para eventos de reservas
    const handleReservaCreada = (data: { propuestaId: number }) => {
      console.log('[Socket] Reserva creada:', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
    };

    const handleReservaEliminada = (data: { propuestaId: number }) => {
      console.log('[Socket] Reserva eliminada:', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
    };

    const handlePropuestaActualizada = (data: { propuestaId: number }) => {
      console.log('[Socket] Propuesta actualizada:', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
    };

    const handleAutorizacionAprobada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización aprobada:', data);
      queryClient.invalidateQueries({ queryKey: ['autorizacion-caras', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-resumen', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    };

    const handleAutorizacionRechazada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización rechazada:', data);
      queryClient.invalidateQueries({ queryKey: ['autorizacion-caras', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-resumen', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-full', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    };

    // Suscribirse a eventos
    socket.on(SOCKET_EVENTS.RESERVA_CREADA, handleReservaCreada);
    socket.on(SOCKET_EVENTS.RESERVA_ELIMINADA, handleReservaEliminada);
    socket.on(SOCKET_EVENTS.PROPUESTA_ACTUALIZADA, handlePropuestaActualizada);
    socket.on(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
    socket.on(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);

    return () => {
      socket.off(SOCKET_EVENTS.RESERVA_CREADA, handleReservaCreada);
      socket.off(SOCKET_EVENTS.RESERVA_ELIMINADA, handleReservaEliminada);
      socket.off(SOCKET_EVENTS.PROPUESTA_ACTUALIZADA, handlePropuestaActualizada);
      socket.off(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
      socket.off(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);
    };
  }, [propuestaId, queryClient]);

  // Función para emitir eventos manualmente
  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de "inventario ocupado/liberado" en tiempo real.
 * Lo usan los buscadores de inventario (AssignInventarioModal/...) para
 * quitar/agregar espacios de su listado en vivo cuando otro usuario reserva.
 *
 * El callback recibe { espacioId, inventarioId, fechaInicio, fechaFin } y el
 * tipo de evento ('ocupado' o 'liberado'). Si el periodo no se solapa con el
 * filtrado, el caller decide si lo ignora.
 */
export interface InventarioRealtimePayload {
  espacioId: number;
  inventarioId: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}
export function useSocketInventarioRealtime(
  onOcupado: (data: InventarioRealtimePayload) => void,
  onLiberado: (data: InventarioRealtimePayload) => void,
) {
  const ocupadoRef = useRef(onOcupado);
  const liberadoRef = useRef(onLiberado);
  ocupadoRef.current = onOcupado;
  liberadoRef.current = onLiberado;

  useEffect(() => {
    const socket = getSocket();
    const handleOcupado = (d: InventarioRealtimePayload) => ocupadoRef.current(d);
    const handleLiberado = (d: InventarioRealtimePayload) => liberadoRef.current(d);
    socket.on(SOCKET_EVENTS.INVENTARIO_OCUPADO, handleOcupado);
    socket.on(SOCKET_EVENTS.INVENTARIO_LIBERADO, handleLiberado);
    return () => {
      socket.off(SOCKET_EVENTS.INVENTARIO_OCUPADO, handleOcupado);
      socket.off(SOCKET_EVENTS.INVENTARIO_LIBERADO, handleLiberado);
    };
  }, []);
}

/**
 * Hook para escuchar cambios en miembros de equipos (para actualizar selects de asignados)
 */
export function useSocketEquipos() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handleEquipoMiembrosActualizado = (data: { equipoId: number; usuarioIds: number[]; action: string }) => {
      console.log('[Socket] Miembros de equipo actualizados:', data);
      // Invalidar queries de usuarios para que se recarguen los selects de asignados
      queryClient.invalidateQueries({ queryKey: ['solicitudes-users'] });
      queryClient.invalidateQueries({ queryKey: ['campanas-usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['equipos'] });
    };

    socket.on(SOCKET_EVENTS.EQUIPO_MIEMBROS_ACTUALIZADO, handleEquipoMiembrosActualizado);

    return () => {
      socket.off(SOCKET_EVENTS.EQUIPO_MIEMBROS_ACTUALIZADO, handleEquipoMiembrosActualizado);
    };
  }, [queryClient]);
}

/**
 * Hook para escuchar eventos de una solicitud específica
 */
export function useSocketSolicitud(solicitudId: number | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!solicitudId || solicitudId <= 0) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Unirse al room de la solicitud
    if (joinedRoomRef.current !== solicitudId) {
      if (joinedRoomRef.current) {
        socket.emit('leave-solicitud', joinedRoomRef.current);
      }
      socket.emit('join-solicitud', solicitudId);
      joinedRoomRef.current = solicitudId;
      console.log('[Socket] Unido a solicitud:', solicitudId);
    }

    const handleSolicitudActualizada = (data: { solicitudId: number }) => {
      console.log('[Socket] Solicitud actualizada:', data);
      queryClient.invalidateQueries({ queryKey: ['solicitud', data.solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details', data.solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-comments', data.solicitudId] });
    };

    const handleSolicitudStatusChanged = (data: { solicitudId: number }) => {
      console.log('[Socket] Status de solicitud cambiado:', data);
      queryClient.invalidateQueries({ queryKey: ['solicitud', data.solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details', data.solicitudId] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
    };

    const handleAutorizacionAprobada = (data: { solicitudId?: number; propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización aprobada (solicitud):', data);
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras'] });
    };

    const handleAutorizacionRechazada = (data: { solicitudId?: number; propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización rechazada (solicitud):', data);
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras'] });
    };

    socket.on(SOCKET_EVENTS.SOLICITUD_ACTUALIZADA, handleSolicitudActualizada);
    socket.on(SOCKET_EVENTS.SOLICITUD_STATUS_CHANGED, handleSolicitudStatusChanged);
    socket.on(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
    socket.on(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);

    return () => {
      socket.off(SOCKET_EVENTS.SOLICITUD_ACTUALIZADA, handleSolicitudActualizada);
      socket.off(SOCKET_EVENTS.SOLICITUD_STATUS_CHANGED, handleSolicitudStatusChanged);
      socket.off(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
      socket.off(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);
    };
  }, [solicitudId, queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de solicitudes
 */
export function useSocketSolicitudes() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Unirse al room de solicitudes (con tracking para reconexión)
    if (!joinedRef.current) {
      joinRoom(socket, 'join-solicitudes');
      joinedRef.current = true;
      console.log('[Socket] Unido a solicitudes');
    }

    const handleSolicitudCreada = () => {
      console.log('[Socket] Solicitud creada');
      queryClient.invalidateQueries({ queryKey: ['solicitudes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    const handleSolicitudActualizada = () => {
      console.log('[Socket] Solicitud actualizada');
      queryClient.invalidateQueries({ queryKey: ['solicitudes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'], refetchType: 'active' });
    };

    const handleSolicitudEliminada = () => {
      console.log('[Socket] Solicitud eliminada');
      queryClient.invalidateQueries({ queryKey: ['solicitudes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    const handleSolicitudStatusChanged = () => {
      console.log('[Socket] Status de solicitud cambiado');
      queryClient.invalidateQueries({ queryKey: ['solicitudes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.SOLICITUD_CREADA, handleSolicitudCreada);
    socket.on(SOCKET_EVENTS.SOLICITUD_ACTUALIZADA, handleSolicitudActualizada);
    socket.on(SOCKET_EVENTS.SOLICITUD_ELIMINADA, handleSolicitudEliminada);
    socket.on(SOCKET_EVENTS.SOLICITUD_STATUS_CHANGED, handleSolicitudStatusChanged);

    return () => {
      socket.off(SOCKET_EVENTS.SOLICITUD_CREADA, handleSolicitudCreada);
      socket.off(SOCKET_EVENTS.SOLICITUD_ACTUALIZADA, handleSolicitudActualizada);
      socket.off(SOCKET_EVENTS.SOLICITUD_ELIMINADA, handleSolicitudEliminada);
      socket.off(SOCKET_EVENTS.SOLICITUD_STATUS_CHANGED, handleSolicitudStatusChanged);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de propuestas (global, no específico de una propuesta)
 */
export function useSocketPropuestas() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!joinedRef.current) {
      joinRoom(socket, 'join-propuestas');
      joinedRef.current = true;
      console.log('[Socket] Unido a propuestas');
    }

    const handlePropuestaCreada = () => {
      console.log('[Socket] Propuesta creada');
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'], refetchType: 'active' });
    };

    const handlePropuestaActualizada = () => {
      console.log('[Socket] Propuesta actualizada');
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'], refetchType: 'active' });
      // Refresca la bitácora abierta (comentarios) del detalle de la propuesta.
      queryClient.invalidateQueries({ queryKey: ['propuesta-comments'], refetchType: 'active' });
    };

    const handlePropuestaStatusChanged = () => {
      console.log('[Socket] Status de propuesta cambiado');
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    const handleAutorizacionAprobada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización aprobada (global):', data);
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', data.propuestaId], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'], refetchType: 'active' });
    };

    const handleAutorizacionRechazada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización rechazada (global):', data);
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuesta-caras', data.propuestaId], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitud-full-details'], refetchType: 'active' });
    };

    const handleReservaCreada = (data: { propuestaId: number }) => {
      console.log('[Socket] Reserva creada (global):', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
    };

    const handleReservaEliminada = (data: { propuestaId: number }) => {
      console.log('[Socket] Reserva eliminada (global):', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['propuestas'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.PROPUESTA_CREADA, handlePropuestaCreada);
    socket.on(SOCKET_EVENTS.PROPUESTA_ACTUALIZADA, handlePropuestaActualizada);
    socket.on(SOCKET_EVENTS.PROPUESTA_STATUS_CHANGED, handlePropuestaStatusChanged);
    socket.on(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
    socket.on(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);
    socket.on(SOCKET_EVENTS.RESERVA_CREADA, handleReservaCreada);
    socket.on(SOCKET_EVENTS.RESERVA_ELIMINADA, handleReservaEliminada);

    return () => {
      socket.off(SOCKET_EVENTS.PROPUESTA_CREADA, handlePropuestaCreada);
      socket.off(SOCKET_EVENTS.PROPUESTA_ACTUALIZADA, handlePropuestaActualizada);
      socket.off(SOCKET_EVENTS.PROPUESTA_STATUS_CHANGED, handlePropuestaStatusChanged);
      socket.off(SOCKET_EVENTS.AUTORIZACION_APROBADA, handleAutorizacionAprobada);
      socket.off(SOCKET_EVENTS.AUTORIZACION_RECHAZADA, handleAutorizacionRechazada);
      socket.off(SOCKET_EVENTS.RESERVA_CREADA, handleReservaCreada);
      socket.off(SOCKET_EVENTS.RESERVA_ELIMINADA, handleReservaEliminada);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de campañas (global)
 */
export function useSocketCampanas() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!joinedRef.current) {
      joinRoom(socket, 'join-campanas');
      joinedRef.current = true;
      console.log('[Socket] Unido a campanas');
    }

    const handleCampanaCreada = () => {
      console.log('[Socket] Campaña creada');
      queryClient.invalidateQueries({ queryKey: ['campanas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campanas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    const handleCampanaActualizada = () => {
      console.log('[Socket] Campaña actualizada');
      queryClient.invalidateQueries({ queryKey: ['campanas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campanas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campana-full'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campana'], refetchType: 'active' });
    };

    const handleCampanaStatusChanged = () => {
      console.log('[Socket] Status de campaña cambiado');
      queryClient.invalidateQueries({ queryKey: ['campanas'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campanas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campana-full'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campana'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.CAMPANA_CREADA, handleCampanaCreada);
    socket.on(SOCKET_EVENTS.CAMPANA_ACTUALIZADA, handleCampanaActualizada);
    socket.on(SOCKET_EVENTS.CAMPANA_STATUS_CHANGED, handleCampanaStatusChanged);

    return () => {
      socket.off(SOCKET_EVENTS.CAMPANA_CREADA, handleCampanaCreada);
      socket.off(SOCKET_EVENTS.CAMPANA_ACTUALIZADA, handleCampanaActualizada);
      socket.off(SOCKET_EVENTS.CAMPANA_STATUS_CHANGED, handleCampanaStatusChanged);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de clientes
 */
export function useSocketClientes() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!joinedRef.current) {
      joinRoom(socket, 'join-clientes');
      joinedRef.current = true;
      console.log('[Socket] Unido a clientes');
    }

    const handleClienteCreado = () => {
      console.log('[Socket] Cliente creado');
      queryClient.invalidateQueries({ queryKey: ['clientes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'], refetchType: 'active' });
    };

    const handleClienteActualizado = () => {
      console.log('[Socket] Cliente actualizado');
      queryClient.invalidateQueries({ queryKey: ['clientes'], refetchType: 'active' });
    };

    const handleClienteEliminado = () => {
      console.log('[Socket] Cliente eliminado');
      queryClient.invalidateQueries({ queryKey: ['clientes'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.CLIENTE_CREADO, handleClienteCreado);
    socket.on(SOCKET_EVENTS.CLIENTE_ACTUALIZADO, handleClienteActualizado);
    socket.on(SOCKET_EVENTS.CLIENTE_ELIMINADO, handleClienteEliminado);

    return () => {
      socket.off(SOCKET_EVENTS.CLIENTE_CREADO, handleClienteCreado);
      socket.off(SOCKET_EVENTS.CLIENTE_ACTUALIZADO, handleClienteActualizado);
      socket.off(SOCKET_EVENTS.CLIENTE_ELIMINADO, handleClienteEliminado);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos de proveedores
 */
export function useSocketProveedores() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!joinedRef.current) {
      joinRoom(socket, 'join-proveedores');
      joinedRef.current = true;
      console.log('[Socket] Unido a proveedores');
    }

    const handleProveedorCreado = () => {
      console.log('[Socket] Proveedor creado');
      queryClient.invalidateQueries({ queryKey: ['proveedores'], refetchType: 'active' });
    };

    const handleProveedorActualizado = () => {
      console.log('[Socket] Proveedor actualizado');
      queryClient.invalidateQueries({ queryKey: ['proveedores'], refetchType: 'active' });
    };

    const handleProveedorEliminado = () => {
      console.log('[Socket] Proveedor eliminado');
      queryClient.invalidateQueries({ queryKey: ['proveedores'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.PROVEEDOR_CREADO, handleProveedorCreado);
    socket.on(SOCKET_EVENTS.PROVEEDOR_ACTUALIZADO, handleProveedorActualizado);
    socket.on(SOCKET_EVENTS.PROVEEDOR_ELIMINADO, handleProveedorEliminado);

    return () => {
      socket.off(SOCKET_EVENTS.PROVEEDOR_CREADO, handleProveedorCreado);
      socket.off(SOCKET_EVENTS.PROVEEDOR_ACTUALIZADO, handleProveedorActualizado);
      socket.off(SOCKET_EVENTS.PROVEEDOR_ELIMINADO, handleProveedorEliminado);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar eventos del dashboard
 */
export function useSocketDashboard() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!joinedRef.current) {
      joinRoom(socket, 'join-dashboard');
      joinedRef.current = true;
      console.log('[Socket] Unido a dashboard');
    }

    const handleDashboardUpdated = () => {
      console.log('[Socket] Dashboard actualizado');
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campanas-stats'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['clientes-stats'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.DASHBOARD_UPDATED, handleDashboardUpdated);
    socket.on(SOCKET_EVENTS.DASHBOARD_STATS_CHANGED, handleDashboardUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.DASHBOARD_UPDATED, handleDashboardUpdated);
      socket.off(SOCKET_EVENTS.DASHBOARD_STATS_CHANGED, handleDashboardUpdated);
    };
  }, [queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

/**
 * Hook para escuchar progreso de creación de reservas
 */
export function useSocketReservaProgreso(
  propuestaId: number | null,
  onProgress?: (data: {
    propuestaId: number;
    procesadas: number;
    total: number;
    creadas: number;
    porcentaje: number;
  }) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!propuestaId || propuestaId <= 0 || !onProgress) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Unirse al room de la propuesta
    if (joinedRoomRef.current !== propuestaId) {
      if (joinedRoomRef.current) {
        socket.emit('leave-propuesta', joinedRoomRef.current);
      }
      socket.emit('join-propuesta', propuestaId);
      joinedRoomRef.current = propuestaId;
      console.log('[Socket] Unido a propuesta para progreso:', propuestaId);
    }

    const handleReservaProgreso = (data: {
      propuestaId: number;
      procesadas: number;
      total: number;
      creadas: number;
      porcentaje: number;
    }) => {
      if (data.propuestaId === propuestaId) {
        console.log('[Socket] Progreso de reserva:', data);
        onProgress(data);
      }
    };

    socket.on(SOCKET_EVENTS.RESERVA_PROGRESO, handleReservaProgreso);

    return () => {
      socket.off(SOCKET_EVENTS.RESERVA_PROGRESO, handleReservaProgreso);
    };
  }, [propuestaId, onProgress]);
}

/**
 * Hook para el modal de Orden de Montaje: invalida las queries de
 * ordenes-montaje-cat / ordenes-montaje-invian cuando se crea o elimina
 * cualquier reserva, para que la columna Diferencia se refresque sola.
 */
export function useSocketOrdenesMontaje(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    const handle = () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-montaje-cat'] });
      queryClient.invalidateQueries({ queryKey: ['ordenes-montaje-invian'] });
    };

    socket.on(SOCKET_EVENTS.RESERVA_CREADA, handle);
    socket.on(SOCKET_EVENTS.RESERVA_ELIMINADA, handle);

    return () => {
      socket.off(SOCKET_EVENTS.RESERVA_CREADA, handle);
      socket.off(SOCKET_EVENTS.RESERVA_ELIMINADA, handle);
    };
  }, [enabled, queryClient]);
}

/**
 * Hook para admins: escucha nuevos logs del chatbot en tiempo real
 */
export function useSocketChatbotAdmin(onNuevoLog: () => void) {
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();

    if (!joinedRef.current) {
      joinRoom(socket, 'join-chatbot-admin');
      joinedRef.current = true;
    }

    socket.on(SOCKET_EVENTS.CHATBOT_LOG_NUEVO, onNuevoLog);

    return () => {
      socket.off(SOCKET_EVENTS.CHATBOT_LOG_NUEVO, onNuevoLog);
      leaveRoom(socket, 'join-chatbot-admin');
      joinedRef.current = false;
    };
  }, [onNuevoLog]);
}

/**
 * Hook para escuchar eventos del historial de tickets (lista general)
 */
export function useSocketTicketsHistorial() {
  const queryClient = useQueryClient();
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();

    if (!joinedRef.current) {
      joinRoom(socket, 'join-tickets-historial');
      joinedRef.current = true;
    }

    const handleMensajeNuevo = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'], refetchType: 'active' });
    };

    const handleChatNuevo = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['tickets-chat-unread-count'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'], refetchType: 'active' });
    };

    const handleStatusChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-historial'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleMensajeNuevo);
    socket.on(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleChatNuevo);
    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleMensajeNuevo);
      socket.off(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleChatNuevo);
      socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
      leaveRoom(socket, 'join-tickets-historial');
      joinedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * Hook para actualizar rankings de tickets en tiempo real
 */
export function useSocketTicketRankings() {
  const queryClient = useQueryClient();
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();

    if (!joinedRef.current) {
      joinRoom(socket, 'join-tickets-historial');
      joinedRef.current = true;
    }

    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rankings'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleRefresh);
    socket.on(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleRefresh);
    socket.on(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleRefresh);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleRefresh);
      socket.off(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleRefresh);
      socket.off(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleRefresh);
      leaveRoom(socket, 'join-tickets-historial');
      joinedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * Hook para actualizar reportes especiales en tiempo real
 */
export function useSocketReportesEspeciales() {
  const queryClient = useQueryClient();
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();

    if (!joinedRef.current) {
      joinRoom(socket, 'join-tickets-historial');
      joinedRef.current = true;
    }

    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['reportes-especiales'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleRefresh);
    socket.on(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleRefresh);
    socket.on(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleRefresh);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleRefresh);
      socket.off(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, handleRefresh);
      socket.off(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleRefresh);
      leaveRoom(socket, 'join-tickets-historial');
      joinedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * Hook para escuchar mensajes nuevos en un ticket específico (chat)
 */
export function useSocketTicketChat(ticketId: number | null, onNuevoMensaje: () => void) {
  const joinedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ticketId) return;

    const socket = getSocket();

    if (joinedRef.current !== ticketId) {
      if (joinedRef.current) socket.emit('leave-ticket', joinedRef.current);
      socket.emit('join-ticket', ticketId);
      joinedRef.current = ticketId;
    }

    socket.on(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, onNuevoMensaje);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_MENSAJE_NUEVO, onNuevoMensaje);
      if (joinedRef.current) {
        socket.emit('leave-ticket', joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [ticketId, onNuevoMensaje]);
}

/**
 * Hook para escuchar mensajes del chat de soporte de un ticket
 */
export function useSocketTicketChatSoporte(ticketId: number | null, onNuevoMensaje: () => void) {
  const joinedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ticketId) return;

    const socket = getSocket();

    if (joinedRef.current !== ticketId) {
      if (joinedRef.current) socket.emit('leave-ticket-chat', joinedRef.current);
      socket.emit('join-ticket-chat', ticketId);
      joinedRef.current = ticketId;
    }

    socket.on(SOCKET_EVENTS.TICKET_CHAT_NUEVO, onNuevoMensaje);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_CHAT_NUEVO, onNuevoMensaje);
      if (joinedRef.current) {
        socket.emit('leave-ticket-chat', joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [ticketId, onNuevoMensaje]);
}

/**
 * Hook global: escucha notificaciones de chat de soporte para el usuario actual.
 * Se une al room user-notifications-{userId} y invalida el query de unread count.
 */
export function useSocketChatNotifications(userId: number | null) {
  const queryClient = useQueryClient();
  const joinedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    if (joinedRef.current !== userId) {
      if (joinedRef.current) socket.emit('leave-user-notifications', joinedRef.current);
      socket.emit('join-user-notifications', userId);
      joinedRef.current = userId;
    }

    const handleChatNuevo = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-chat-unread-count'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleChatNuevo);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_CHAT_NUEVO, handleChatNuevo);
      if (joinedRef.current) {
        socket.emit('leave-user-notifications', joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [userId, queryClient]);
}

/**
 * Hook para escuchar nuevas entradas en el historial de acciones
 */
export function useSocketHistorialAcciones() {
  const queryClient = useQueryClient();
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();

    if (!joinedRef.current) {
      joinRoom(socket, 'join-historial');
      joinedRef.current = true;
    }

    const handleNueva = () => {
      queryClient.invalidateQueries({ queryKey: ['historial-acciones'], refetchType: 'active' });
    };

    socket.on(SOCKET_EVENTS.HISTORIAL_NUEVA, handleNueva);

    return () => {
      socket.off(SOCKET_EVENTS.HISTORIAL_NUEVA, handleNueva);
      leaveRoom(socket, 'join-historial');
      joinedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * Desconectar el socket (llamar al hacer logout)
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log('[Socket] Desconectado manualmente');
  }
}
