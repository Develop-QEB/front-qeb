/**
 * Helpers para notificaciones de escritorio/navegador (Notification API).
 *
 * Flujo:
 *  1. Al login, llamar requestNotificationPermission() una vez.
 *  2. Cuando llegue un evento de socket con tipo='Recordatorio', llamar
 *     showRecordatorioNotification() para disparar una notificacion nativa.
 *  3. La notificacion incluye un "tarea_id" como tag/data; al hacer click,
 *     navega a /notificaciones?tareaId=X para que el usuario pueda abrirla
 *     y editarla.
 */

const STORAGE_KEY = 'qeb.notifications.permissionAsked';

export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationStatus;
}

/**
 * Pide permiso si no se ha preguntado antes. Idempotente: si ya esta
 * concedido o denegado, no muestra el prompt de nuevo.
 */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  // Solo preguntamos una vez por sesion para no molestar
  const asked = sessionStorage.getItem(STORAGE_KEY) === '1';
  if (asked) return Notification.permission as NotificationStatus;
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
    const result = await Notification.requestPermission();
    return result as NotificationStatus;
  } catch {
    return 'default';
  }
}

export interface DesktopNotifPayload {
  titulo: string;
  descripcion?: string | null;
  tareaId?: number | null;
  /** Tag para deduplicar (evita popups dobles si el evento llega 2 veces). */
  tag?: string;
  /** Si true, la notificación no se cierra sola (p.ej. recordatorios). */
  requireInteraction?: boolean;
}

/**
 * Dispara una notificación nativa genérica del navegador, respetando permiso.
 * Al hacer click navega a /notificaciones?tareaId=X (si hay tareaId) y enfoca.
 */
export function showDesktopNotification(payload: DesktopNotifPayload): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const body = payload.descripcion || 'Tienes una nueva notificación';
  try {
    const notif = new Notification(payload.titulo || 'QEB', {
      body,
      tag: payload.tag || (payload.tareaId ? `notif-${payload.tareaId}` : undefined),
      requireInteraction: !!payload.requireInteraction,
      icon: '/favicon.ico',
      data: { tareaId: payload.tareaId },
    });

    notif.onclick = () => {
      try {
        window.focus();
        const params = payload.tareaId ? `?tareaId=${payload.tareaId}` : '';
        const target = `/notificaciones${params}`;
        if (window.location.pathname.startsWith('/notificaciones')) {
          window.history.pushState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = target;
        }
      } finally {
        notif.close();
      }
    };
  } catch (err) {
    console.warn('[DesktopNotif] No se pudo crear la notificacion:', err);
  }
}

export interface RecordatorioNotifPayload {
  titulo: string;
  descripcion?: string | null;
  tareaId?: number | null;
  fecha_entrega?: string | null;
  historial_id?: number | null;
}

/**
 * Dispara una notificacion nativa del navegador. Si el navegador no soporta
 * Notification API o el usuario no dio permiso, no hace nada.
 *
 * onclick: navega a /notificaciones?tareaId=X y enfoca la ventana.
 */
export function showRecordatorioNotification(payload: RecordatorioNotifPayload): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const body = payload.descripcion || (payload.fecha_entrega ? `Fecha: ${new Date(payload.fecha_entrega).toLocaleDateString('es-MX')}` : 'Tienes una actividad programada');

  try {
    const notif = new Notification(payload.titulo || 'Recordatorio QEB', {
      body,
      tag: payload.tareaId ? `recordatorio-${payload.tareaId}` : `recordatorio-${Date.now()}`,
      requireInteraction: true, // No se cierra sola — el usuario decide
      icon: '/favicon.ico',
      data: {
        tareaId: payload.tareaId,
        historialId: payload.historial_id,
      },
    });

    notif.onclick = () => {
      try {
        window.focus();
        const params = payload.tareaId ? `?tareaId=${payload.tareaId}` : '';
        // Navegacion suave si ya estamos en el SPA, si no full reload.
        const target = `/notificaciones${params}`;
        if (window.location.pathname.startsWith('/notificaciones')) {
          // Actualiza la query sin reload
          window.history.pushState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          window.location.href = target;
        }
      } finally {
        notif.close();
      }
    };
  } catch (err) {
    console.warn('[DesktopNotif] No se pudo crear la notificacion:', err);
  }
}
