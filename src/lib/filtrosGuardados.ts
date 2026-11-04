import type { FiltrosDatos } from './tableroVistas';

// Helpers de lectura defensiva de la foto de filtros que guarda una vista
// (VistaTablero.filtros, ver lib/tableroVistas y VistasGuardadasMenu).
//
// Cada pagina arma la foto como JSON plano y la lee de vuelta con estos
// helpers: lo que hay en localStorage pudo escribirlo una version anterior
// del front o editarse a mano, asi que nunca se confia en el tipo.

export type { FiltrosDatos };

// ---------- Lectura defensiva de la foto ----------
//
// Cada helper regresa el valor si tiene la forma esperada y el default si no.
// Asi una foto vieja o editada a mano nunca mete un tipo raro en el estado.

export function leerString(v: unknown, def = ''): string {
  return typeof v === 'string' ? v : def;
}
export function leerStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
/** Solo acepta valores de una lista cerrada (p.ej. 'todas' | 'con' | 'sin'). */
export function leerEnum<T extends string>(v: unknown, validos: readonly T[], def: T): T {
  return typeof v === 'string' && (validos as readonly string[]).includes(v) ? (v as T) : def;
}
export function leerEnums<T extends string>(v: unknown, validos: readonly T[]): T[] {
  return leerStrings(v).filter((x): x is T => (validos as readonly string[]).includes(x));
}
export function leerNumeroOpcional(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
export function leerBool(v: unknown, def = false): boolean {
  return typeof v === 'boolean' ? v : def;
}
/** Objeto plano cuyos valores son todos strings (p.ej. el filtro de historial). */
export function leerObjetoStrings(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  Object.entries(v as Record<string, unknown>).forEach(([k, val]) => {
    if (typeof val === 'string') out[k] = val;
  });
  return out;
}
/**
 * Lista de objetos con al menos `field`, `operator` y `value` string: la forma
 * comun de las condiciones del filtro avanzado en los tres modulos. El resto
 * de campos (id, connector) se pasan tal cual.
 */
export function leerCondiciones<T extends { field: string; operator: string; value: string }>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is T => (
    !!c && typeof c === 'object'
    && typeof (c as Record<string, unknown>).field === 'string'
    && typeof (c as Record<string, unknown>).operator === 'string'
    && typeof (c as Record<string, unknown>).value === 'string'
  ));
}
