// Helpers para que las columnas numéricas en los Excel de "compartir" salgan
// como celdas tipo NÚMERO (no texto), para que respondan como números en Excel.

// El tipo se importa solo a nivel de tipos (no bundlea xlsx en el chunk principal).
type XLSXModule = typeof import('xlsx');

/**
 * Convierte un valor a número finito o null (para celda vacía).
 * Acepta strings con formato ("1,234.5", "$1,234") y los limpia.
 */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const limpio = String(v).replace(/[^0-9.\-]/g, '');
  if (limpio === '' || limpio === '-' || limpio === '.') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aplica formato numérico a columnas específicas de una hoja creada con aoa_to_sheet.
 * @param formats mapa { índiceDeColumna: formatoNumFmt }, ej. { 8: '0.000000', 9: '#,##0.00' }
 * @param dataRowCount número de filas de datos (sin contar el header de la fila 0)
 * @param headerRows cuántas filas de encabezado hay antes de los datos (default 1)
 */
export function applyNumberFormats(
  XLSX: XLSXModule,
  ws: Record<string, any>,
  dataRowCount: number,
  formats: Record<number, string>,
  headerRows = 1,
): void {
  for (let r = headerRows; r < headerRows + dataRowCount; r++) {
    for (const colStr of Object.keys(formats)) {
      const c = Number(colStr);
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        cell.t = 'n';        // tipo numérico
        cell.z = formats[c]; // formato de celda (número)
      }
    }
  }
}

// Formatos reutilizables
export const FMT_ENTERO = '#,##0';
export const FMT_MONEDA = '#,##0.00';
export const FMT_COORD = '0.000000';
