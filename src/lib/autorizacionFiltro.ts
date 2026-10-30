import type { AutorizacionResumen } from '../types';

// Filtro por AUTORIZACIÓN DE CIRCUITOS en los listados de Solicitudes,
// Propuestas y Campañas. Espejo de back/utils/autorizacionFiltro.ts.
//
// La autorización vive por circuito (autorizacion_dg / autorizacion_dcm), no
// por registro: un registro "tiene" un estatus de autorización si AL MENOS UN
// circuito lo cumple. Con filtro de Periodo activo, el back acota los circuitos
// a los que solapan ese periodo (tanto en el filtro del servidor como en el
// `autorizacion_resumen` que llega por fila y que usa el filtro avanzado en
// cliente); sin periodo cuentan todos los circuitos.
//
// Las cinco claves viajan al back como `autorizacion=<key>`; en la UI se
// muestran con el prefijo "Aut." para no confundirlas con los estatus de la
// entidad ('Aprobada', 'Rechazada', ...).

export type AutorizacionFiltroKey = 'aprobado' | 'pend_dg' | 'pend_dcm' | 'correccion' | 'rechazado';

export interface AutorizacionFiltroOpcion {
  key: AutorizacionFiltroKey;
  label: string;
  hint: string;
}

export const AUTORIZACION_OPCIONES: AutorizacionFiltroOpcion[] = [
  { key: 'aprobado', label: 'Aut. Aprobado', hint: 'Circuitos aprobados por DG y DCM' },
  { key: 'pend_dg', label: 'Aut. Pend. DG', hint: 'Circuitos pendientes de Dirección General' },
  { key: 'pend_dcm', label: 'Aut. Pend. DCM', hint: 'Circuitos pendientes de Dirección Comercial' },
  { key: 'correccion', label: 'Aut. Corrección', hint: 'Circuitos devueltos a corrección por el Gerente Comercial' },
  { key: 'rechazado', label: 'Aut. Rechazo', hint: 'Circuitos rechazados por DG o DCM' },
];

export const AUTORIZACION_LABELS: string[] = AUTORIZACION_OPCIONES.map(o => o.label);

// Prefijo con el que viaja un estatus de autorización en el filtro de
// Historial (`estatusValor=auth:pend_dg`) y en las claves de `cambios`.
export const AUTORIZACION_PREFIX = 'auth:';

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** 'Aut. Pend. DG' → 'pend_dg'; cualquier otro texto → null. */
export function autorizacionKeyDeLabel(label: string | null | undefined): AutorizacionFiltroKey | null {
  if (!label) return null;
  const n = norm(label);
  const op = AUTORIZACION_OPCIONES.find(o => norm(o.label) === n || o.key === n);
  return op ? op.key : null;
}

export function autorizacionLabelDeKey(key: AutorizacionFiltroKey): string {
  return AUTORIZACION_OPCIONES.find(o => o.key === key)?.label || key;
}

export function esLabelAutorizacion(v: string | null | undefined): boolean {
  return autorizacionKeyDeLabel(v) !== null;
}

/** Valor para el filtro de Historial ("Cambió a ..."). */
export function estatusValorDeAutorizacion(key: AutorizacionFiltroKey): string {
  return `${AUTORIZACION_PREFIX}${key}`;
}

/** Texto visible de un `estatusValor` (estatus de entidad o `auth:<key>`). */
export function labelDeEstatusValor(estatusValor: string | null | undefined): string {
  if (!estatusValor) return '';
  if (estatusValor.startsWith(AUTORIZACION_PREFIX)) {
    const k = estatusValor.slice(AUTORIZACION_PREFIX.length) as AutorizacionFiltroKey;
    return autorizacionLabelDeKey(k);
  }
  return estatusValor;
}

/**
 * Divide la selección del chip "Status" (multiselect) en lo que va al back:
 * estatus de entidad → `status` (CSV), etiquetas de autorización →
 * `autorizacion` (CSV), y los pseudo-estatus que se filtran en cliente
 * (Incompleta / Completa) → `pseudo`. El back aplica OR entre estatus y
 * autorización; los pseudo-estatus los aplica cada página.
 */
export function splitStatusSeleccion(
  seleccion: readonly string[],
  pseudoEstatus: readonly string[] = [],
): { status?: string; autorizacion?: string; pseudo: string[] } {
  const status: string[] = [];
  const autorizacion: string[] = [];
  const pseudo: string[] = [];
  for (const v of seleccion) {
    if (!v) continue;
    if (pseudoEstatus.includes(v)) { pseudo.push(v); continue; }
    const key = autorizacionKeyDeLabel(v);
    if (key) { if (!autorizacion.includes(key)) autorizacion.push(key); continue; }
    if (!status.includes(v)) status.push(v);
  }
  return {
    status: status.length > 0 ? status.join(',') : undefined,
    autorizacion: autorizacion.length > 0 ? autorizacion.join(',') : undefined,
    pseudo,
  };
}

/** ¿El registro tiene al menos un circuito con ese estatus de autorización? */
export function resumenCumple(resumen: AutorizacionResumen | null | undefined, key: AutorizacionFiltroKey): boolean {
  if (!resumen) return false;
  return (resumen[key] ?? 0) > 0;
}

/**
 * Evaluación del filtro avanzado sobre el campo `status` cuando el valor es
 * una etiqueta de autorización. Devuelve null si el valor NO es de
 * autorización (el llamador sigue con su evaluación normal).
 */
export function evalAutorizacionAvanzado(
  resumen: AutorizacionResumen | null | undefined,
  operator: string,
  value: string,
): boolean | null {
  const key = autorizacionKeyDeLabel(value);
  if (!key) return null;
  const cumple = resumenCumple(resumen, key);
  if (operator === '!=' || operator === 'not_contains') return !cumple;
  return cumple;
}
