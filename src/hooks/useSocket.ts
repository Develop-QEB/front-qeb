import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

// Eventos que el servidor puede emitir
export const SOCKET_EVENTS = {
  TAREA_CREADA: 'tarea:creada',
  TAREA_ACTUALIZADA: 'tarea:actualizada',
  TAREA_ELIMINADA: 'tarea:eliminada',
  NOTIFICACION_NUEVA: 'notificacion:nueva',
  NOTIFICACION_LEIDA: 'notificacion:leida',
  ARTE_SUBIDO: 'arte:subido',
  ARTE_APROBADO: 'arte:aprobado',
  ARTE_RECHAZADO: 'arte:rechazado',
  INVENTARIO_ACTUALIZADO: 'inventario:actualizado',
  DATOS_ACTUALIZADOS: 'datos:actualizados',
  // Nuevos eventos para propuestas y reservas
  RESERVA_CREADA: 'reserva:creada',
  RESERVA_ELIMINADA: 'reserva:eliminada',
  PROPUESTA_ACTUALIZADA: 'propuesta:actualizada',
  AUTORIZACION_APROBADA: 'autorizacion:aprobada',
  AUTORIZACION_RECHAZADA: 'autorizacion:rechazada',
};

let socketInstance: Socket | null = null;

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

    const handleInventarioActualizado = (data: { campanaId: number }) => {
      console.log('[Socket] Inventario actualizado:', data);
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-sin-arte', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-inventario-testigos', data.campanaId] });
      queryClient.invalidateQueries({ queryKey: ['campana-artes-existentes', data.campanaId] });
    };

    // Suscribirse a eventos
    socket.on(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
    socket.on(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
    socket.on(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);
    socket.on(SOCKET_EVENTS.ARTE_SUBIDO, handleArteSubido);
    socket.on(SOCKET_EVENTS.ARTE_APROBADO, handleArteAprobado);
    socket.on(SOCKET_EVENTS.ARTE_RECHAZADO, handleArteRechazado);
    socket.on(SOCKET_EVENTS.INVENTARIO_ACTUALIZADO, handleInventarioActualizado);

    return () => {
      // Limpiar listeners al desmontar
      socket.off(SOCKET_EVENTS.TAREA_CREADA, handleTareaCreada);
      socket.off(SOCKET_EVENTS.TAREA_ACTUALIZADA, handleTareaActualizada);
      socket.off(SOCKET_EVENTS.TAREA_ELIMINADA, handleTareaEliminada);
      socket.off(SOCKET_EVENTS.ARTE_SUBIDO, handleArteSubido);
      socket.off(SOCKET_EVENTS.ARTE_APROBADO, handleArteAprobado);
      socket.off(SOCKET_EVENTS.ARTE_RECHAZADO, handleArteRechazado);
      socket.off(SOCKET_EVENTS.INVENTARIO_ACTUALIZADO, handleInventarioActualizado);
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
export function useSocketNotificaciones() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handleNotificacionNueva = () => {
      console.log('[Socket] Nueva notificación');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    };

    const handleNotificacionLeida = () => {
      console.log('[Socket] Notificación leída');
      queryClient.invalidateQueries({ queryKey: ['notificaciones-stats'] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    };

    socket.on(SOCKET_EVENTS.NOTIFICACION_NUEVA, handleNotificacionNueva);
    socket.on(SOCKET_EVENTS.NOTIFICACION_LEIDA, handleNotificacionLeida);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICACION_NUEVA, handleNotificacionNueva);
      socket.off(SOCKET_EVENTS.NOTIFICACION_LEIDA, handleNotificacionLeida);
    };
  }, [queryClient]);
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
      queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
    };

    const handleReservaEliminada = (data: { propuestaId: number }) => {
      console.log('[Socket] Reserva eliminada:', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta-reservas-modal', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta-inventario', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
    };

    const handlePropuestaActualizada = (data: { propuestaId: number }) => {
      console.log('[Socket] Propuesta actualizada:', data);
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
    };

    const handleAutorizacionAprobada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización aprobada:', data);
      queryClient.invalidateQueries({ queryKey: ['autorizacion-caras', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-resumen', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    };

    const handleAutorizacionRechazada = (data: { propuestaId: number; idquote: string }) => {
      console.log('[Socket] Autorización rechazada:', data);
      queryClient.invalidateQueries({ queryKey: ['autorizacion-caras', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['autorizacion-resumen', data.idquote] });
      queryClient.invalidateQueries({ queryKey: ['propuesta', data.propuestaId] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
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
 * Desconectar el socket (llamar al hacer logout)
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log('[Socket] Desconectado manualmente');
  }
}
