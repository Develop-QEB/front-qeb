// Helpers compartidos del versionado de circuitos completados (Vista Compartir
// interna, vista publica del cliente y visor de mapa).
//
// El backend (inventario-propuesta.service) devuelve cada fila de inventario con:
//   estado_version:   'vigente'     -> pieza de la ultima version completada, sigue reservada
//                     'no_vigente'  -> estaba en la ultima version completada pero se
//                                      desplazo (multireservas) o se quito a mano -> GRIS
//                     'sin_version' -> el circuito nunca ha estado completo; se muestra lo actual
//   version_completado / fecha_completado: version y fecha del circuito al que pertenece
//   motivo_no_vigente: texto corto (solo en no_vigente)

// Solo tipos: no bundlea jspdf-autotable en el chunk principal.
import type { CellHookData } from 'jspdf-autotable';

export type EstadoVersion = 'vigente' | 'no_vigente' | 'sin_version';

export interface ConVersion {
  estado_version?: EstadoVersion | null;
  version_completado?: number | null;
  fecha_completado?: string | null;
  motivo_no_vigente?: string | null;
}

export const NO_VIGENTE_LABEL = 'No vigente';
export const NO_VIGENTE_LEYENDA =
  'En gris: inventario desplazado o quitado después de completar el circuito. Se muestra la última versión completada de cada circuito.';

export function esNoVigente(item: ConVersion | null | undefined): boolean {
  return item?.estado_version === 'no_vigente';
}

export function hayNoVigentes(items: ConVersion[] | null | undefined): boolean {
  return !!items && items.some(esNoVigente);
}

/** Texto para columnas "Estado" en PDF/Excel. Vacio si la pieza esta vigente. */
export function estadoTexto(item: ConVersion): string {
  if (!esNoVigente(item)) return '';
  return item.motivo_no_vigente ? `${NO_VIGENTE_LABEL} (${item.motivo_no_vigente})` : NO_VIGENTE_LABEL;
}

/** Fecha ISO de la version completada mas reciente entre las filas, o null. */
export function ultimaFechaCompletado(items: ConVersion[] | null | undefined): string | null {
  if (!items) return null;
  let max: string | null = null;
  for (const i of items) {
    if (!i.fecha_completado) continue;
    if (!max || new Date(i.fecha_completado) > new Date(max)) max = i.fecha_completado;
  }
  return max;
}

export function formatFechaCompletado(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Leyenda de cabecera: "Última versión completada: dd/mm/yyyy HH:mm" (o '' si no hay). */
export function leyendaVersion(items: ConVersion[] | null | undefined): string {
  const f = formatFechaCompletado(ultimaFechaCompletado(items));
  return f ? `Última versión completada: ${f}` : '';
}

// ---------- PDF (jspdf-autotable) ----------
export const PDF_GRIS_TEXTO: [number, number, number] = [150, 150, 150];
export const PDF_GRIS_FONDO: [number, number, number] = [236, 236, 236];

/**
 * Hook `didParseCell` para autoTable: pinta en gris claro (texto y fondo) las
 * filas cuyo item esta 'no_vigente'. `items` debe ir en el mismo orden que `body`.
 */
export function pdfEstiloNoVigente(items: ConVersion[]) {
  return (data: CellHookData) => {
    if (data.section !== 'body') return;
    const item = items[data.row.index];
    if (!esNoVigente(item)) return;
    data.cell.styles.textColor = PDF_GRIS_TEXTO;
    data.cell.styles.fillColor = PDF_GRIS_FONDO;
    data.cell.styles.fontStyle = 'italic';
  };
}

// ---------- Mapa ----------
export const MAPA_GRIS = '#9ca3af';
