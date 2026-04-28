// Shared helpers for period display (catorcena vs mensual)
// tipoPeriodo:
//   - 'catorcena': shows "Cat 8 / 2026"
//   - 'mensual': shows "Abril 2026" (long) / "Abr 2026" (short)

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

// Format a date range as "1 Abr – 30 Abr" (same month) or "1 Abr – 15 May" (cross month)
export function dateRangeShort(from: unknown, to: unknown): string {
  const a = dayMonthShort(from);
  const b = dayMonthShort(to);
  if (!a || !b) return a || b || '';
  return `${a} – ${b}`;
}
