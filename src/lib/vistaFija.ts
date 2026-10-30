// Vista fija de un modulo (Solicitudes / Propuestas / Campanas): con cual de
// sus vistas (Tabla, Desglose/Versionario, Tablero) abre el modulo para este
// usuario. Distinto de las "vistas guardadas" del tablero (lib/tableroVistas),
// que son configuraciones DENTRO del tablero.
//
// Vive en localStorage por usuario, igual que el resto de preferencias de UI
// del front; no sigue al usuario a otro equipo.
import type { TableroScope } from './tableroVistas';

const STORAGE_PREFIX = 'qeb:vista-fija';

function storageKey(scope: TableroScope, userId: number | string | null | undefined): string {
  return `${STORAGE_PREFIX}:${scope}:v1:${userId ?? 'anon'}`;
}

/**
 * Vista fija guardada, o null si no hay (el modulo abre en su default).
 * `validas` descarta un valor viejo si una vista se renombra o desaparece.
 */
export function loadVistaFijaModulo<T extends string>(
  scope: TableroScope,
  userId: number | string | null | undefined,
  validas: readonly T[],
): T | null {
  try {
    const raw = localStorage.getItem(storageKey(scope, userId));
    return raw && (validas as readonly string[]).includes(raw) ? (raw as T) : null;
  } catch {
    return null;
  }
}

export function saveVistaFijaModulo(
  scope: TableroScope,
  userId: number | string | null | undefined,
  vista: string | null,
): void {
  try {
    if (vista) localStorage.setItem(storageKey(scope, userId), vista);
    else localStorage.removeItem(storageKey(scope, userId));
  } catch {
    /* localStorage bloqueado: la preferencia no persiste, no rompe nada */
  }
}
