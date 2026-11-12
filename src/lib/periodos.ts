// Shared helpers for period display (catorcena vs mensual)
// tipoPeriodo:
//   - 'catorcena': shows "Cat 8 / 2026"
//   - 'mensual': shows "Abril 2026" (long) / "Abr 2026" (short)

import { esArticuloUDC } from './udc';

export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toIsoString(dateVal: unknown): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) return dateVal.toISOString();
  return String(dateVal);
}

// "2026-04-15" -> { year: 2026, month: 3, day: 15 }
function parseDateParts(dateVal: unknown): { year: number; month: number; day: number } | null {
  const iso = toIsoString(dateVal);
  if (!iso) return null;
  const parts = iso.split(/[-T]/);
  if (parts.length < 3) return null;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11) return null;
  return { year, month, day };
}

// "Abril 2026"
export function monthLabelLong(dateVal: unknown): string {
  const p = parseDateParts(dateVal);
  if (!p) return '';
  return `${MESES_LARGO[p.month]} ${p.year}`;
}

// "Abr 2026"
export function monthLabelShort(dateVal: unknown): string {
  const p = parseDateParts(dateVal);
  if (!p) return '';
  return `${MESES_CORTO[p.month]} ${p.year}`;
}

// "15 Abr"
export function dayMonthShort(dateVal: unknown): string {
  const p = parseDateParts(dateVal);
  if (!p) return '';
  return `${p.day} ${MESES_CORTO[p.month]}`;
}

// "15 Abr 2026"
export function dayMonthYear(dateVal: unknown): string {
  const p = parseDateParts(dateVal);
  if (!p) return '';
  return `${p.day} ${MESES_CORTO[p.month]} ${p.year}`;
}

// YYYY-MM key for grouping (timezone-safe — parses string directly)
export function monthKey(dateVal: unknown): string {
  const p = parseDateParts(dateVal);
  if (!p) return '';
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`;
}

// Get the period label for table columns based on tipo_periodo
// mensual: "Abr 2026" / catorcena: "Cat 8 / 2026"
export function tablePeriodoLabel(
  tipoPeriodo: string | undefined,
  dateVal: unknown,
  catorcenaNum: number | null | undefined,
  catorcenaYear: number | null | undefined,
): string {
  if (tipoPeriodo === 'mensual' && dateVal) {
    return monthLabelShort(dateVal);
  }
  if (catorcenaNum && catorcenaYear) {
    return `Cat ${catorcenaNum} / ${catorcenaYear}`;
  }
  return '-';
}

// Group header label: "Abril 2026" for mensual / "Cat 8 / 2026" for catorcena
export function groupPeriodoLabel(
  tipoPeriodo: string | undefined,
  dateVal: unknown,
  catorcenaNum: number | null | undefined,
  catorcenaYear: number | null | undefined,
): string {
  if (tipoPeriodo === 'mensual' && dateVal) {
    return monthLabelLong(dateVal);
  }
  if (catorcenaNum && catorcenaYear) {
    return `Cat ${catorcenaNum} / ${catorcenaYear}`;
  }
  return '';
}

// Periodo requerido por un artículo según su nombre SAP.
// Gran Formato (Kioscos, Boleros, Mi Macro, Puentes Peatonales, Carteleras/
// Unipolares, Bajo Puentes) es MENSUAL; PB/Columna y todo lo demás es catorcenal.
// Se usa para filtrar el dropdown de artículos por el periodo de la solicitud/
// propuesta/campaña (mensual → solo Gran Formato; catorcena → excluye Gran Formato).
export function getRequiredPeriodoForArticulo(itemName: string, itemCode?: string): 'catorcena' | 'mensual' {
  // UDC (aeropuerto AICM): todo es MENSUAL. Se detecta por código o nombre.
  if (esArticuloUDC(itemCode, itemName)) return 'mensual';
  if (!itemName) return 'catorcena';
  const name = itemName.toUpperCase();
  if (name.includes('KIOSCO') || name.includes('KIOSKO')) return 'mensual';
  if (name.includes('BOLERO')) return 'mensual';
  if (name.includes('MI MACRO')) return 'mensual';
  if (name.includes('PEATONAL')) return 'mensual';
  if (name.includes('BAJO PUENTE')) return 'mensual';
  if (name.includes('CARTELERA')) return 'mensual';
  if (name.includes('UNIPOLAR')) return 'mensual';
  return 'catorcena';
}

// ¿El artículo es DIGITAL? Código con DIG o nombre con DIGITAL (mismo criterio que
// getTipoFromName del flujo de alta). Los digitales PROGRAMÁTICOS (ej. RT-DIG-01-MX)
// traen DIG en el código aunque el nombre no diga el formato.
export function esArticuloDigital(itemName?: string, itemCode?: string): boolean {
  if ((itemCode || '').toUpperCase().includes('DIG')) return true;
  return (itemName || '').toUpperCase().includes('DIGITAL');
}

// ¿Un artículo se puede SELECCIONAR bajo este tipo de periodo?
// Base: cada formato tiene su periodo natural (getRequiredPeriodoForArticulo).
// EXCEPCIÓN (oct 2026, pedido Dirección): los artículos DIGITALES de pantalla
// (parabús, columna y los digitales PROGRAMÁTICOS) también se permiten en MENSUAL
// (además de su catorcena natural), para probar digital con rangos libres de días
// / un solo día. Se reflejan como periodos mensuales y entran al tab UN+.
//
// Se habilita cualquier DIGITAL cuyo periodo natural sea CATORCENA. Eso:
//   - deja fuera lo que YA es mensual (UDC aeropuerto, gran formato digital),
//   - incluye TODO el inventario digital de pantalla, incluidos los programáticos
//     cuyo nombre no trae "PARABUS"/"COLUMNA" (ej. RT-DIG-01-MX).
// Antes se exigía PARABUS/COLUMNA en el nombre + DIG en el código, y por eso
// faltaban los digitales programáticos (reporte Jos: solo salía RT-DIG-PRG-PB).
export function esDigitalSeleccionableEnMensual(itemName: string, itemCode?: string): boolean {
  if (!esArticuloDigital(itemName, itemCode)) return false;
  return getRequiredPeriodoForArticulo(itemName, itemCode) === 'catorcena';
}

// ¿El artículo es GRAN FORMATO "mensual" (Kioscos, Boleros, Mi Macro, Puentes
// Peatonales, Carteleras, Unipolares, Bajo Puentes) y NO una pantalla UDC del
// aeropuerto? Se usa para INYECTAR estos artículos del catálogo CIMU dentro del
// flujo UDC (una propuesta/campaña de aeropuerto también puede vender gran
// formato) y para decidir, POR CARA, si el buscador usa el inventario real
// (gran formato → buscador normal) o la ficha técnica de pantallas (UDC).
// Nota: UDC pantalla (RT-PANT-1-A, "GRAN PANTALLA"…) NO cae aquí porque su
// periodo natural por nombre es catorcena y esArticuloUDC lo excluiría.
export function esArticuloGranFormato(itemName: string, itemCode?: string): boolean {
  if (esArticuloUDC(itemCode, itemName)) return false;
  return getRequiredPeriodoForArticulo(itemName, itemCode) === 'mensual';
}

export function articuloValidoEnPeriodo(
  itemName: string,
  itemCode: string | undefined,
  tipoPeriodo: 'catorcena' | 'mensual',
): boolean {
  if (getRequiredPeriodoForArticulo(itemName, itemCode) === tipoPeriodo) return true;
  // Digital PB/CL: permitido también en mensual.
  if (tipoPeriodo === 'mensual' && esDigitalSeleccionableEnMensual(itemName, itemCode)) return true;
  return false;
}

// Franja horaria de un circuito digital: "08:00–22:00". Vacío si no hay horas.
// Feature "Horario inicio/fin - Digital": aplica a todos los días del rango.
export function horarioLabel(horaInicio?: string | null, horaFin?: string | null): string {
  const a = (horaInicio ?? '').toString().trim().slice(0, 5);
  const b = (horaFin ?? '').toString().trim().slice(0, 5);
  if (a && b) return `${a}–${b}`;
  if (a) return `desde ${a}`;
  if (b) return `hasta ${b}`;
  return '';
}

// Hora HH:MM (24h) → 12h con am/pm para mostrar junto a la fecha en la tarjeta
// del circuito: "23:51" → "11:51 pm", "08:00" → "8:00 am". Vacío si no es válida.
export function hora12h(hhmm?: string | null): string {
  const m = (hhmm ?? '').toString().trim().slice(0, 5).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  if (isNaN(h) || h > 23) return '';
  const ampm = h < 12 ? 'am' : 'pm';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ampm}`;
}

// Agrega la franja horaria a un texto de periodo ya formateado:
// "1 Abr – 30 Abr" + ("08:00","22:00") => "1 Abr – 30 Abr · 08:00–22:00".
export function conHorario(periodoTexto: string, horaInicio?: string | null, horaFin?: string | null): string {
  const h = horarioLabel(horaInicio, horaFin);
  if (!h) return periodoTexto;
  return periodoTexto ? `${periodoTexto} · ${h}` : h;
}

// Format a date range as "1 Abr – 30 Abr" (same month) or "1 Abr – 15 May" (cross month)
export function dateRangeShort(from: unknown, to: unknown): string {
  const a = dayMonthShort(from);
  const b = dayMonthShort(to);
  if (!a || !b) return a || b || '';
  return `${a} – ${b}`;
}
