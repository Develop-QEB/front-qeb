// Origen del inventario en la Vista Compartir de una CAMPAÑA.
//
// Cuando un pase a ventas queda INCOMPLETO (piezas que se pierden contra otra
// campaña ya firme), el asesor repone inventario ya dentro de la campaña. El
// backend guarda la foto de lo que cruzo en el pase a ventas
// (pase_ventas_reserva) y marca cada fila con:
//
//   origen_reserva = 'propuesta' -> cruzo en el pase a ventas   -> AZUL
//   origen_reserva = 'campana'   -> se agrego dentro de campaña -> VERDE
//   origen_reserva = null        -> sin foto (no se puede saber) -> sin color
//
// Solo aplica en contexto campaña (?ctx=campana). El gris de "no vigente"
// (ver versionCompletado.ts) SIEMPRE gana: primero importa si la pieza sigue
// siendo parte del circuito, luego de donde vino.
import type { CellHookData } from 'jspdf-autotable';
import { esNoVigente, PDF_GRIS_TEXTO, PDF_GRIS_FONDO, type ConVersion } from './versionCompletado';

export type OrigenReserva = 'propuesta' | 'campana';

export interface ConOrigen {
  origen_reserva?: OrigenReserva | null;
}

// Azul y verde IMU (mismos de la marca que ya usan PDF y vista publica).
export const ORIGEN_COLOR: Record<OrigenReserva, string> = {
  propuesta: '#0054A6',
  campana: '#7AB800',
};

export const ORIGEN_LABEL: Record<OrigenReserva, string> = {
  propuesta: 'De la propuesta',
  campana: 'Agregado en campaña',
};

export const ORIGEN_LEYENDA =
  'Azul: inventario que se vino de la propuesta en el pase a ventas. Verde: agregado después, ya dentro de la campaña.';

export function origenDe(item: ConOrigen | null | undefined): OrigenReserva | null {
  const o = item?.origen_reserva;
  return o === 'propuesta' || o === 'campana' ? o : null;
}

/** ¿El backend pudo clasificar el origen? (hay foto de pase a ventas). */
export function tieneOrigen(items: ConOrigen[] | null | undefined): boolean {
  return !!items && items.some(i => origenDe(i) !== null);
}

/** ¿Hay piezas agregadas ya dentro de la campaña? (pase a ventas incompleto). */
export function hayAgregadasEnCampana(items: ConOrigen[] | null | undefined): boolean {
  return !!items && items.some(i => origenDe(i) === 'campana');
}

export function contarPorOrigen(items: ConOrigen[] | null | undefined): { propuesta: number; campana: number } {
  const r = { propuesta: 0, campana: 0 };
  for (const i of items || []) {
    const o = origenDe(i);
    if (o) r[o] += Number((i as { caras_totales?: number }).caras_totales ?? 1) || 1;
  }
  return r;
}

/** Color de pin/borde. `null` si no aplica (sin clasificar o no es campaña). */
export function origenColor(item: ConOrigen, mostrar: boolean): string | null {
  if (!mostrar) return null;
  const o = origenDe(item);
  return o ? ORIGEN_COLOR[o] : null;
}

/** Texto para columnas "Origen" de PDF/Excel. */
export function origenTexto(item: ConOrigen, mostrar: boolean): string {
  if (!mostrar) return '';
  const o = origenDe(item);
  return o ? ORIGEN_LABEL[o] : '';
}

// ---------- PDF (jspdf-autotable) ----------
// Tintes muy claros para no pelear con la lectura del texto.
export const PDF_ORIGEN_FONDO: Record<OrigenReserva, [number, number, number]> = {
  propuesta: [222, 236, 250],
  campana: [232, 244, 214],
};

/**
 * Hook `didParseCell` unico para las tablas de la Vista Compartir:
 *   - fila 'no_vigente' -> gris (gana siempre)
 *   - si no, y hay contexto campaña -> tinte azul/verde segun origen
 * `items` debe ir en el mismo orden que el `body` de la tabla.
 */
export function pdfEstiloCompartir(items: (ConVersion & ConOrigen)[], mostrarOrigen: boolean) {
  return (data: CellHookData) => {
    if (data.section !== 'body') return;
    const item = items[data.row.index];
    if (!item) return;
    if (esNoVigente(item)) {
      data.cell.styles.textColor = PDF_GRIS_TEXTO;
      data.cell.styles.fillColor = PDF_GRIS_FONDO;
      data.cell.styles.fontStyle = 'italic';
      return;
    }
    const o = mostrarOrigen ? origenDe(item) : null;
    if (o) data.cell.styles.fillColor = PDF_ORIGEN_FONDO[o];
  };
}

// ---------- Excel (ExcelJS, ARGB) ----------
export const XLS_ORIGEN_FONDO: Record<OrigenReserva, string> = {
  propuesta: 'FFDEECFA',
  campana: 'FFE8F4D6',
};

/** Relleno ARGB para la fila, o undefined si va sin tinte. */
export function excelFondoOrigen(item: ConOrigen, mostrar: boolean): string | undefined {
  const o = origenColor(item, mostrar) ? origenDe(item) : null;
  return o ? XLS_ORIGEN_FONDO[o] : undefined;
}
