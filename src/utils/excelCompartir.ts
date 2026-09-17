// Excel de la Vista Compartir (interna, publica y mapa) con ExcelJS.
//
// Se usa ExcelJS (y no `xlsx` community) porque necesitamos ESTILO de celda:
// las filas de inventario 'no_vigente' (desplazado/quitado despues de completar
// el circuito) van con fondo gris y texto gris/italica para que se noten, ademas
// de la columna "Estado". `xlsx` CE ignora los estilos.
import { FMT_COORD, FMT_ENTERO, FMT_MONEDA } from './excelFormat';

export { FMT_COORD, FMT_ENTERO, FMT_MONEDA };

export interface FilaExcel {
  valores: (string | number | null | undefined)[];
  /** true -> fila gris (inventario no vigente). Gana sobre `fondoArgb`. */
  noVigente?: boolean;
  /** Relleno ARGB opcional (p.ej. origen propuesta/campaña). */
  fondoArgb?: string;
}

export interface HojaExcel {
  nombre: string;
  /** Fila 1 opcional (leyenda de contexto: "Circuitos Muestra"/"Circuitos Confirmados"). */
  leyenda?: string;
  /** Fila 2 opcional (p.ej. "Última versión completada: ..."). */
  subLeyenda?: string;
  headers: string[];
  filas: FilaExcel[];
  /** indice de columna (0-based) -> numFmt para celdas numericas. */
  formatos?: Record<number, string>;
}

const GRIS_FONDO = 'FFEDEDED';
const GRIS_TEXTO = 'FF808080';
const HEADER_FONDO = 'FFE6F0FA';
const HEADER_TEXTO = 'FF0054A6';

export async function descargarExcelCompartir(nombreArchivo: string, hojas: HojaExcel[], notaPie?: string): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? (mod as unknown as typeof import('exceljs'));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QEB';

  const usados = new Set<string>();
  for (const hoja of hojas) {
    // Nombres de hoja: max 31 chars, sin caracteres invalidos y unicos.
    let nombre = (hoja.nombre || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim().substring(0, 31) || 'Hoja';
    let n = 2;
    while (usados.has(nombre.toLowerCase())) nombre = `${nombre.substring(0, 28)} ${n++}`;
    usados.add(nombre.toLowerCase());
    const ws = wb.addWorksheet(nombre);

    let filaHeader = 1;
    if (hoja.leyenda) {
      const r = ws.addRow([hoja.leyenda]);
      r.font = { bold: true, size: 12, color: { argb: HEADER_TEXTO } };
      filaHeader++;
    }
    if (hoja.subLeyenda) {
      const r = ws.addRow([hoja.subLeyenda]);
      r.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
      filaHeader++;
    }

    const header = ws.addRow(hoja.headers);
    header.font = { bold: true, color: { argb: HEADER_TEXTO } };
    header.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FONDO } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB0C4DE' } } };
    });

    const anchos = hoja.headers.map(h => Math.max(10, Math.min(50, String(h).length + 2)));
    let hayGris = false;
    for (const fila of hoja.filas) {
      const valores = fila.valores.map(v => (v === undefined ? null : v));
      const r = ws.addRow(valores);
      valores.forEach((v, idx) => {
        const len = v === null ? 0 : String(v).length + 2;
        if (len > anchos[idx]) anchos[idx] = Math.min(60, len);
        const fmt = hoja.formatos?.[idx];
        if (fmt && typeof v === 'number') r.getCell(idx + 1).numFmt = fmt;
      });
      // Gris de "no vigente" gana sobre el tinte de origen.
      const fondo = fila.noVigente ? GRIS_FONDO : fila.fondoArgb;
      if (fondo) {
        if (fila.noVigente) hayGris = true;
        // Se recorre por indice (no eachCell) para pintar tambien las celdas
        // vacias y que la fila quede pareja de extremo a extremo.
        for (let c = 1; c <= hoja.headers.length; c++) {
          const cell = r.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
          if (fila.noVigente) cell.font = { italic: true, color: { argb: GRIS_TEXTO } };
        }
      }
    }
    anchos.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });
    ws.views = [{ state: 'frozen', ySplit: filaHeader }];

    if (notaPie && hayGris) {
      ws.addRow([]);
      const r = ws.addRow([notaPie]);
      r.font = { italic: true, size: 9, color: { argb: GRIS_TEXTO } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
