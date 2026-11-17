// Exporta la Propuesta Económica a Excel y PDF con el formato del archivo
// original "GRUPO IMU - Propuesta de Servicio" (hoja "PROPUESTA IMU"):
// mismas columnas D..N, anchos, colores, bordes, formatos numéricos y fórmulas.
//
// Diferencias deliberadas contra el original:
//  - Las secciones Aeropuertos y WiFi (que el original no tenía en la hoja) se
//    dibujan con la misma tabla de Vía Pública, y solo si tienen filas.
//  - La fecha es la del día en que se genera, fija (el original usaba =TODAY(),
//    que cambia cada vez que el cliente abre el archivo).
//  - No se incluye la hoja oculta "Catálogo" ni las listas desplegables: la
//    captura ahora se hace en el sistema.
import type ExcelJSType from 'exceljs';
import {
  PropuestaEconomicaData, LineaTarifa, SECCIONES_TARIFA,
  descuentoDe, inversionPorPeriodo, inversionTotal, inversionImpresion,
  totalesTarifa, totalesImpresiones, totalesGenerales,
  fechaLarga, moneda, porcentaje,
} from '../services/propuestaEconomica.service';
import { IVA } from '../config/propuestaEconomicaCatalogo';

const LOGO_URL = '/logo-imu-propuesta.png';

// Colores del original (tema Office 2023 + colores directos)
const NAVY = '0E2841';        // theme dk2: título y encabezados de tabla
const NAVY_LABEL = '0D243B';  // etiquetas de encabezado y T&C
const BLUE_BAND = '1B62D5';   // franja bajo el título
const BORDER = '0066FF';      // bordes de tablas
const DATE_FILL = 'CFECF7';   // accent4 al 80% (celda de fecha)
const TEXT_SOFT = '264059';   // dk2 aclarado (valores del encabezado)
const TEXT_TERMS = '4A5E71';  // dk2 aclarado 25% (texto de T&C)

const FMT_MONEDA = '\\$#,##0.00;[Red]"($"#,##0.00\\);\\-';
const FMT_FECHA = '[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy';
const FUENTE = 'Aptos Narrow';

const TARIFA_HEADERS = [
  'Plaza', 'Medio/Soporte', 'Formato', 'Tarifa Publicada', 'Descuento', 'Tarifa Aplicada',
  'Caras/Unidades', 'Periodo', 'Periodos Cotizados', 'Inversión por Periodo', 'Inversión total',
];

const nombreArchivo = (nombre: string) =>
  (nombre || 'PROPUESTA ECONOMICA').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

const descargar = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

interface Logo { buffer: ArrayBuffer; dataUrl: string; w: number; h: number }

const cargarLogo = async (): Promise<Logo | null> => {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('logo'));
      img.src = dataUrl;
    });
    return { buffer, dataUrl, w, h };
  } catch {
    return null; // sin logo el documento sigue siendo válido
  }
};

// ═════════════════════════ EXCEL ═════════════════════════

interface Estilo {
  fill?: string;
  color?: string;
  bold?: boolean;
  size?: number;
  font?: string;
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'middle';
  wrap?: boolean;
  border?: boolean;
  numFmt?: string;
}

// Columnas de la hoja (1-based): D=4 … N=14
const D = 4, E = 5, F = 6, G = 7, H = 8, I = 9, J = 10, K = 11, L = 12, M = 13, N = 14;
const col = (c: number) => String.fromCharCode(64 + c);

export async function exportPropuestaEconomicaExcel(d: PropuestaEconomicaData, nombre: string): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof ExcelJSType }).default ?? (mod as unknown as typeof ExcelJSType);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QEB';
  wb.created = new Date();

  const ws = wb.addWorksheet('PROPUESTA IMU', {
    views: [{ showGridLines: false, zoomScale: 70 }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  const anchos: Record<number, number> = {
    1: 6, [D]: 36.2, [E]: 41, [F]: 27.1, [G]: 21.2, [H]: 24, [I]: 20.8,
    [J]: 15.6, [K]: 13.3, [L]: 31.8, [M]: 26.8, [N]: 19.2,
  };
  Object.entries(anchos).forEach(([c, w]) => { ws.getColumn(Number(c)).width = w; });

  const borde = { style: 'thin' as const, color: { argb: `FF${BORDER}` } };
  const aplicar = (r: number, c: number, s: Estilo) => {
    const cell = ws.getCell(r, c);
    cell.font = {
      name: s.font || FUENTE, size: s.size ?? 11, bold: !!s.bold,
      color: { argb: `FF${s.color || '000000'}` },
    };
    if (s.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${s.fill}` } };
    cell.alignment = { horizontal: s.h || 'center', vertical: s.v || 'middle', wrapText: !!s.wrap };
    if (s.border) cell.border = { top: borde, left: borde, bottom: borde, right: borde };
    if (s.numFmt) cell.numFmt = s.numFmt;
    return cell;
  };
  /** Escribe un valor en (r,c1), combina hasta (r2,c2) y aplica el estilo a todo el rango. */
  const bloque = (
    r: number, c1: number, c2: number, valor: ExcelJSType.CellValue, s: Estilo, r2: number = r,
  ) => {
    for (let rr = r; rr <= r2; rr++) for (let cc = c1; cc <= c2; cc++) aplicar(rr, cc, s);
    if (c2 > c1 || r2 > r) ws.mergeCells(r, c1, r2, c2);
    ws.getCell(r, c1).value = valor;
  };
  const alto = (r: number, h: number) => { ws.getRow(r).height = h; };

  // ── Encabezado (filas 1-11, igual que el original) ──
  alto(1, 14.25); alto(2, 0.75); alto(3, 86.55); alto(4, 18); alto(5, 18); alto(6, 3);
  alto(7, 18); alto(8, 3); alto(9, 18); alto(10, 18); alto(11, 18); alto(12, 18);

  bloque(3, E, L, 'GRUPO IMU\nPropuesta de Servicio', { fill: NAVY, color: 'FFFFFF', bold: true, size: 20, wrap: true });
  bloque(4, D, N, null, { fill: BLUE_BAND, color: 'FFFFFF', bold: true, size: 16, font: 'Arial' });

  const logo = await cargarLogo();
  if (logo) {
    const imgId = wb.addImage({ buffer: logo.buffer, extension: 'png' });
    const hPx = 73;
    ws.addImage(imgId, {
      tl: { col: 3.67, row: 2.25 },
      ext: { width: Math.round(hPx * (logo.w / logo.h)), height: hPx },
    });
  }

  const hoy = new Date();
  bloque(7, D, E, new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())),
    { fill: DATE_FILL, size: 14, border: true, numFmt: FMT_FECHA });

  const etiqueta: Estilo = { fill: NAVY_LABEL, color: 'FFFFFF', size: 14, border: true, wrap: true };
  const valor: Estilo = { fill: 'FFFFFF', color: TEXT_SOFT, size: 14, border: true, h: 'left', wrap: true };
  const valorCentro: Estilo = { ...valor, h: 'center' };

  bloque(9, D, E, 'Nombre del Asesor:', etiqueta);
  bloque(9, F, N, d.asesor, valor);
  bloque(10, D, E, 'Cliente:', etiqueta);
  bloque(10, F, H, d.cliente, valor);
  bloque(10, I, J, 'Marca:', etiqueta);
  bloque(10, K, N, d.marca, valor);
  bloque(11, D, E, 'Periodicidad de Campaña:', etiqueta);
  bloque(11, F, G, 'Fecha de inicio:', valorCentro);
  bloque(11, H, I, fechaLarga(d.fechaInicio), valorCentro);
  bloque(11, J, L, 'Fecha de cierre:', valorCentro);
  bloque(11, M, N, fechaLarga(d.fechaFin), valorCentro);

  // ── Tablas ──
  const thead: Estilo = { fill: NAVY, color: 'FFFFFF', bold: true, border: true, wrap: true };
  const tcell: Estilo = { border: true, wrap: true };
  const tmoney: Estilo = { ...tcell, numFmt: FMT_MONEDA };
  const totLabel: Estilo = { fill: NAVY, color: 'FFFFFF', bold: true, border: true, h: 'left' };
  const totValue: Estilo = { fill: NAVY, color: 'FFFFFF', bold: true, border: true, numFmt: FMT_MONEDA };

  let r = 13;
  const subtotalRefs: string[] = [];

  /** SUB TOTAL / IVA / TOTAL bajo una tabla. Devuelve la fila siguiente. */
  const pieTotales = (fila: number, primera: number, ultima: number, t: { subtotal: number; iva: number; total: number }) => {
    bloque(fila, M, M, 'SUB TOTAL', totLabel);
    bloque(fila, N, N, { formula: `SUM(N${primera}:N${ultima})`, result: t.subtotal }, totValue);
    bloque(fila + 1, M, M, 'IVA', totLabel);
    bloque(fila + 1, N, N, { formula: `IFERROR(N${fila}*${IVA},0)`, result: t.iva }, totValue);
    bloque(fila + 2, M, M, 'TOTAL', totLabel);
    bloque(fila + 2, N, N, { formula: `IFERROR(N${fila}+N${fila + 1},0)`, result: t.total }, totValue);
    alto(fila + 1, 18);
    subtotalRefs.push(`N${fila}`);
    return fila + 3;
  };

  const tablaTarifa = (titulo: string, lineas: LineaTarifa[]) => {
    bloque(r, D, D, titulo, { fill: 'FFFFFF', bold: true, size: 14 });
    alto(r, 18);
    r++;
    TARIFA_HEADERS.forEach((h, i) => bloque(r, D + i, D + i, h, thead));
    alto(r, 21);
    r++;
    const primera = r;
    for (const l of lineas) {
      bloque(r, D, D, l.plaza, tcell);
      bloque(r, E, E, l.medio, tcell);
      bloque(r, F, F, l.formato, tcell);
      bloque(r, G, G, l.tarifaPublicada, tmoney);
      bloque(r, H, H, {
        formula: `IF(OR($G${r}="",$I${r}="",$G${r}=0),"",IFERROR(1-($I${r}/$G${r}),""))`,
        result: descuentoDe(l) ?? '',
      }, { ...tcell, numFmt: '0%' });
      bloque(r, I, I, l.tarifaAplicada, tmoney);
      bloque(r, J, J, l.unidades, { ...tcell, numFmt: '0' });
      bloque(r, K, K, l.periodo, tcell);
      bloque(r, L, L, l.periodosCotizados, { ...tcell, numFmt: '0' });
      bloque(r, M, M, {
        formula: `IF(OR($I${r}="",$J${r}=""),"",IFERROR($I${r}*$J${r},""))`,
        result: inversionPorPeriodo(l) ?? '',
      }, tmoney);
      bloque(r, N, N, {
        formula: `IF(OR($M${r}="",$L${r}=""),"",IFERROR($M${r}*$L${r},""))`,
        result: inversionTotal(l) ?? '',
      }, tmoney);
      alto(r, 16.35);
      r++;
    }
    r = pieTotales(r, primera, r - 1, totalesTarifa(lineas));
  };

  for (const s of SECCIONES_TARIFA) {
    if (d[s.key].length) tablaTarifa(s.titulo, d[s.key]);
  }

  if (d.impresiones.length) {
    bloque(r, D, D, 'Impresiones', { fill: 'FFFFFF', bold: true, size: 14 });
    alto(r, 16.35);
    r++;
    const heads = ['Plaza', 'Medio/Soporte', 'Materiales', 'Tarifa Aplicada', 'Unidades', '', '', '', '', '', 'Inversión total'];
    heads.forEach((h, i) => bloque(r, D + i, D + i, h, thead));
    alto(r, 16.35);
    r++;
    const primera = r;
    for (const l of d.impresiones) {
      bloque(r, D, D, l.plaza, tcell);
      bloque(r, E, E, l.medio, tcell);
      bloque(r, F, F, l.material, tcell);
      bloque(r, G, G, l.tarifaAplicada, tmoney);
      bloque(r, H, H, l.unidades, { ...tcell, numFmt: '0' });
      for (let c = I; c <= M; c++) bloque(r, c, c, null, tcell);
      bloque(r, N, N, {
        formula: `IF(OR($G${r}="",$H${r}=""),"",IFERROR($G${r}*$H${r},""))`,
        result: inversionImpresion(l) ?? '',
      }, { ...tmoney, bold: true });
      alto(r, 16.35);
      r++;
    }
    r = pieTotales(r, primera, r - 1, totalesImpresiones(d.impresiones));
  }

  // ── Valor Total Propuesta ──
  r++;
  const tg = totalesGenerales(d);
  const gen: Estilo = { fill: NAVY, color: 'FFFFFF', bold: true };
  bloque(r, J, K, 'Valor Total Propuesta', gen, r + 2);
  bloque(r, L, M, 'SUB TOTAL General', gen);
  bloque(r, N, N, { formula: `SUM(${subtotalRefs.join('+') || '0'})`, result: tg.subtotal }, totValue);
  bloque(r + 1, L, M, 'IVA General', gen);
  bloque(r + 1, N, N, { formula: `IFERROR(N${r}*${IVA},0)`, result: tg.iva }, totValue);
  bloque(r + 2, L, M, 'TOTAL General', gen);
  bloque(r + 2, N, N, { formula: `IFERROR(N${r}+N${r + 1},0)`, result: tg.total }, totValue);
  alto(r, 24); alto(r + 1, 24); alto(r + 2, 24);
  r += 5;

  // ── Términos y Condiciones / Observaciones ──
  const tituloBloque: Estilo = { fill: NAVY_LABEL, color: 'FFFFFF', size: 14, h: 'left' };
  bloque(r, D, I, 'TÉRMINOS Y CONDICIONES', tituloBloque, r + 1);
  bloque(r, J, N, 'OBSERVACIONES', tituloBloque, r + 1);
  alto(r, 24); alto(r + 1, 24);
  r += 2;
  const FILAS_TEXTO = 12;
  const texto: Estilo = { fill: 'FFFFFF', color: TEXT_TERMS, size: 12, h: 'left', v: 'top', wrap: true, border: true };
  bloque(r, D, I, d.terminos, texto, r + FILAS_TEXTO - 1);
  bloque(r, J, N, d.observaciones, texto, r + FILAS_TEXTO - 1);
  for (let i = 0; i < FILAS_TEXTO; i++) alto(r + i, 24);
  r += FILAS_TEXTO;

  ws.pageSetup.printArea = `${col(D)}1:${col(N)}${r - 1}`;

  const buffer = await wb.xlsx.writeBuffer();
  descargar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${nombreArchivo(nombre)}.xlsx`,
  );
}

// ═════════════════════════ PDF ═════════════════════════

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [
  parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16),
];

export async function exportPropuestaEconomicaPDF(d: PropuestaEconomicaData, nombre: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MX = 10;
  const ancho = W - MX * 2;
  const cNavy = rgb(NAVY), cLabel = rgb(NAVY_LABEL), cBorder = rgb(BORDER);
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Título ──
  const logo = await cargarLogo();
  const altoTitulo = 22;
  const anchoLogo = 44;
  let y = 10;
  if (logo) {
    const lh = altoTitulo - 4;
    const lw = lh * (logo.w / logo.h);
    doc.addImage(logo.dataUrl, 'PNG', MX + (anchoLogo - lw) / 2, y + 2, lw, lh);
  }
  doc.setFillColor(...cNavy);
  doc.rect(MX + anchoLogo, y, ancho - anchoLogo, altoTitulo, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const cx = MX + anchoLogo + (ancho - anchoLogo) / 2;
  doc.text('GRUPO IMU', cx, y + 9.5, { align: 'center' });
  doc.text('Propuesta de Servicio', cx, y + 17, { align: 'center' });
  y += altoTitulo;
  doc.setFillColor(...rgb(BLUE_BAND));
  doc.rect(MX, y, ancho, 4, 'F');
  y += 6;

  // ── Fecha ──
  const fechaHoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  autoTable(doc, {
    startY: y,
    margin: { left: MX },
    tableWidth: 80,
    theme: 'grid',
    body: [[fechaHoy]],
    styles: { fontSize: 9, halign: 'center', fillColor: rgb(DATE_FILL), textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1.4 },
  });
  y = finalY() + 2;

  // ── Datos generales ──
  const lab = { fillColor: cLabel, textColor: [255, 255, 255] as RGB, halign: 'center' as const };
  const val = { textColor: rgb(TEXT_SOFT) };
  const valC = { ...val, halign: 'center' as const };
  autoTable(doc, {
    startY: y,
    margin: { left: MX, right: MX },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.4, lineColor: cBorder, lineWidth: 0.1, valign: 'middle' },
    // 6 columnas de ancho fijo: sin esto autoTable aplasta las últimas (Marca / Fecha de cierre)
    columnStyles: Object.fromEntries(
      [52, ...Array(5).fill((ancho - 52) / 5)].map((w, i) => [i, { cellWidth: w }]),
    ),
    body: [
      [{ content: 'Nombre del Asesor:', styles: lab }, { content: d.asesor, colSpan: 5, styles: val }],
      [
        { content: 'Cliente:', styles: lab }, { content: d.cliente, colSpan: 2, styles: val },
        { content: 'Marca:', styles: lab }, { content: d.marca, colSpan: 2, styles: val },
      ],
      [
        { content: 'Periodicidad de Campaña:', styles: lab },
        { content: 'Fecha de inicio:', styles: valC }, { content: fechaLarga(d.fechaInicio), styles: valC },
        { content: 'Fecha de cierre:', styles: valC }, { content: fechaLarga(d.fechaFin), colSpan: 2, styles: valC },
      ],
    ],
  });
  y = finalY() + 5;

  // ── Tablas ──
  const tituloSeccion = (t: string) => {
    if (y > PH - 40) { doc.addPage(); y = 12; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(t, MX + 2, y + 3);
    y += 5;
  };
  const tot = { fillColor: cNavy, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const };
  const vacio = (colSpan: number) => ({ content: '', colSpan, styles: { lineWidth: 0, fillColor: [255, 255, 255] as RGB } });
  const filasTotales = (span: number, t: { subtotal: number; iva: number; total: number }) => [
    [vacio(span), { content: 'SUB TOTAL', styles: { ...tot, halign: 'left' as const } }, { content: moneda(t.subtotal), styles: tot }],
    [vacio(span), { content: 'IVA', styles: { ...tot, halign: 'left' as const } }, { content: moneda(t.iva), styles: tot }],
    [vacio(span), { content: 'TOTAL', styles: { ...tot, halign: 'left' as const } }, { content: moneda(t.total), styles: tot }],
  ];
  const estiloTabla = {
    margin: { left: MX, right: MX },
    theme: 'grid' as const,
    styles: { fontSize: 7.5, cellPadding: 1.2, halign: 'center' as const, valign: 'middle' as const, lineColor: cBorder, lineWidth: 0.1, textColor: [0, 0, 0] as RGB },
    headStyles: { fillColor: cNavy, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const, lineColor: cBorder, lineWidth: 0.1 },
    rowPageBreak: 'avoid' as const,
  };

  for (const s of SECCIONES_TARIFA) {
    const lineas = d[s.key];
    if (!lineas.length) continue;
    tituloSeccion(s.titulo);
    autoTable(doc, {
      ...estiloTabla,
      startY: y,
      head: [TARIFA_HEADERS],
      body: [
        ...lineas.map(l => [
          l.plaza, l.medio, l.formato, moneda(l.tarifaPublicada), porcentaje(descuentoDe(l)),
          moneda(l.tarifaAplicada), l.unidades ?? '', l.periodo, l.periodosCotizados ?? '',
          moneda(inversionPorPeriodo(l)), moneda(inversionTotal(l)),
        ]),
        ...filasTotales(9, totalesTarifa(lineas)),
      ],
      columnStyles: { 1: { cellWidth: 46 }, 9: { cellWidth: 30 }, 10: { cellWidth: 30 } },
    });
    y = finalY() + 5;
  }

  if (d.impresiones.length) {
    tituloSeccion('Impresiones');
    autoTable(doc, {
      ...estiloTabla,
      startY: y,
      head: [['Plaza', 'Medio/Soporte', 'Materiales', 'Tarifa Aplicada', 'Unidades', 'Inversión total']],
      body: [
        ...d.impresiones.map(l => [
          l.plaza, l.medio, l.material, moneda(l.tarifaAplicada), l.unidades ?? '', moneda(inversionImpresion(l)),
        ]),
        ...filasTotales(4, totalesImpresiones(d.impresiones)),
      ],
      columnStyles: { 4: { cellWidth: 30 }, 5: { cellWidth: 30 } },
    });
    y = finalY() + 5;
  }

  // ── Valor Total Propuesta ──
  const tg = totalesGenerales(d);
  if (y > PH - 30) { doc.addPage(); y = 12; }
  autoTable(doc, {
    startY: y,
    margin: { left: W - MX - 140 },
    tableWidth: 140,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.6, halign: 'center', valign: 'middle', fillColor: cNavy, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: cBorder, lineWidth: 0.1 },
    body: [
      [{ content: 'Valor Total Propuesta', rowSpan: 3 }, 'SUB TOTAL General', moneda(tg.subtotal)],
      ['IVA General', moneda(tg.iva)],
      ['TOTAL General', moneda(tg.total)],
    ],
    pageBreak: 'avoid',
  });
  y = finalY() + 6;

  // ── Términos y Condiciones / Observaciones ──
  if (y > PH - 60) { doc.addPage(); y = 12; }
  autoTable(doc, {
    startY: y,
    margin: { left: MX, right: MX },
    theme: 'grid',
    head: [['TÉRMINOS Y CONDICIONES', 'OBSERVACIONES']],
    body: [[d.terminos, d.observaciones]],
    headStyles: { fillColor: cLabel, textColor: [255, 255, 255], fontStyle: 'normal', fontSize: 9, halign: 'left' },
    styles: { fontSize: 7, cellPadding: 1.8, valign: 'top', textColor: rgb(TEXT_TERMS), lineColor: cBorder, lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: ancho * 0.6 }, 1: { cellWidth: ancho * 0.4 } },
  });

  doc.save(`${nombreArchivo(nombre)}.pdf`);
}
