import ExcelJS from 'exceljs';
import type { Campana } from '../types';
import type { InventarioConArte } from '../services/campanas.service';
import api from '../lib/api';

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

type FetchedImage = { buffer: ArrayBuffer; ext: 'png' | 'jpeg' | 'gif' };

const detectExt = (urlOrType: string): 'png' | 'jpeg' | 'gif' => {
  const s = urlOrType.toLowerCase();
  if (s.includes('png')) return 'png';
  if (s.includes('gif')) return 'gif';
  return 'jpeg';
};

const dataUrlToBuffer = (dataUrl: string): FetchedImage | null => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) view[i] = binary.charCodeAt(i);
  return { buffer, ext: detectExt(mime) };
};

// Extrae nombre legible de arte desde la URL de Spaces.
// Spaces patron: ${folder}/${timestamp}-${random}-${sanitizedFilename}
// Ej.: /artes/1775568848792-3s97habp-imagotipo-negro.png -> "imagotipo-negro.png"
const extractArteName = (url: string): string => {
  if (!url) return '';
  try {
    const path = url.split('?')[0]; // sin querystring
    const last = decodeURIComponent(path.split('/').pop() || '');
    // Patron timestamp-random-rest: \d{10,}-[a-z0-9]+-
    const stripped = last.replace(/^\d{10,}-[a-z0-9]+-/i, '');
    return stripped || last;
  } catch {
    return url.split('/').pop() || '';
  }
};

// "Arte 1: nombre.png\nArte 2: otro.png" — un nombre por linea.
const buildNombresArtesText = (urls: string[]): string => {
  if (!urls || urls.length === 0) return '';
  return urls.map((u, idx) => `Arte ${idx + 1}: ${extractArteName(u)}`).join('\n');
};

const fetchImage = async (url: string): Promise<FetchedImage | null> => {
  if (!url) return null;
  if (url.startsWith('data:')) return dataUrlToBuffer(url);
  // Usamos el proxy del backend para evitar CORS (Spaces no manda
  // Access-Control-Allow-Origin para fetch desde el front).
  try {
    const res = await api.get('/uploads/proxy-image', {
      params: { url },
      responseType: 'arraybuffer',
    });
    const contentType = String(res.headers['content-type'] || '');
    return { buffer: res.data as ArrayBuffer, ext: detectExt(contentType || url) };
  } catch {
    return null;
  }
};

export interface VersionarioArtesExportArgs {
  campana: Campana;
  items: InventarioConArte[];
  // Mapa opcional: rsv_id → URLs de archivos digitales (de imagenes_digitales).
  // Cuando se pasa, las URLs se agregan a las columnas "Arte N" deduplicadas.
  digitalFilesByReserva?: Map<number, string[]>;
  // Mapa opcional URL → nota: nota cargada al subir el arte (tradicional o digital).
  // La clave es la misma URL que termina en artesPorPlaza.
  notesByUrl?: Map<string, string>;
}

export async function exportVersionarioArtes({ campana, items, digitalFilesByReserva, notesByUrl }: VersionarioArtesExportArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QEB';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Versionario Artes');

  const cuic = campana.cuic ? String(campana.cuic) : '';
  const asesor = (campana as any).T0_U_Asesor || (campana as any).asesor || '';
  const cliente = (campana as any).T0_U_RazonSocial || (campana as any).cliente || (campana as any).T1_U_Cliente || '';
  const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
  const campaniaNombre = campana.nombre || campana.nombre_campania || '';

  // Agrupar items por plaza (mismo criterio que ya usaba la columna "Plaza")
  const getPlaza = (it: InventarioConArte): string => it.plaza || it.municipio || it.estado || '';
  const byPlaza = new Map<string, InventarioConArte[]>();
  for (const it of items) {
    const plaza = getPlaza(it);
    if (!byPlaza.has(plaza)) byPlaza.set(plaza, []);
    byPlaza.get(plaza)!.push(it);
  }

  // Para cada plaza, lista deduplicada de URLs de arte (mismo archivo en varios espacios = 1 sola miniatura).
  // Combina rsv.archivo (legacy 1 arte) con imagenes_digitales[*] (artes múltiples) cuando se pasa el mapa.
  const getRsvIds = (it: any): number[] =>
    String(it.rsv_id || it.rsv_ids || '')
      .split(',')
      .map((s: string) => parseInt(s.trim()))
      .filter((n: number) => !isNaN(n));
  const artesPorPlaza = new Map<string, string[]>();
  let maxArtesUnicos = 0;
  for (const [plaza, arr] of byPlaza) {
    const urls: string[] = [];
    const seen = new Set<string>();
    const pushUrl = (u: string | null | undefined) => {
      if (u && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    };
    for (const it of arr) {
      // 1) rsv.archivo (legacy, 1 arte por reserva)
      pushUrl(it.archivo);
      // 2) artes_tradicionales (múltiples artes tradicionales) — vienen del backend
      //    en it.artes_multiples como string separado por '||'
      const artesMultiples: string | null | undefined = (it as any).artes_multiples;
      if (artesMultiples) {
        for (const u of artesMultiples.split('||')) pushUrl(u.trim());
      }
      // 3) imagenes_digitales (múltiples artes digitales) — pasados en el mapa
      if (digitalFilesByReserva) {
        for (const rsvId of getRsvIds(it)) {
          const digitalUrls = digitalFilesByReserva.get(rsvId) || [];
          for (const u of digitalUrls) pushUrl(u);
        }
      }
    }
    artesPorPlaza.set(plaza, urls);
    if (urls.length > maxArtesUnicos) maxArtesUnicos = urls.length;
  }

  const baseHeaders = [
    'Plaza',
    'Tipo',
    'Asesor Comercial',
    'APS Global - ID QEB',
    'Fecha Inicio Periodo',
    'Fecha Fin Periodo',
    'Cliente Comercial',
    'Marca',
    'Campaña',
    'Caras',
    'Estatus',
    'Notas',
    'Nombre Arte',
  ];
  const arteHeaders = Array.from({ length: maxArtesUnicos }, (_, i) => `Arte ${i + 1}`);
  const headers = [...baseHeaders, ...arteHeaders];

  const baseWidths = [22, 14, 26, 14, 14, 14, 30, 18, 26, 8, 18, 50, 40];
  sheet.columns = [
    ...baseWidths.map(w => ({ width: w })),
    ...Array(maxArtesUnicos).fill(null).map(() => ({ width: 22 })),
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6B21A8' },
  };
  headerRow.height = 22;

  const imageCache = new Map<string, number | null>();
  const getImageId = async (url: string | null | undefined): Promise<number | null> => {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url) ?? null;
    const fetched = await fetchImage(url);
    if (!fetched) {
      imageCache.set(url, null);
      return null;
    }
    const id = workbook.addImage({ buffer: fetched.buffer, extension: fetched.ext });
    imageCache.set(url, id);
    return id;
  };

  const ROW_HEIGHT = 70;
  const ARTE_COL_START = baseHeaders.length; // 0-based, primera columna de arte

  // "Varios" si los valores varían dentro de la plaza, si todos iguales el valor único
  const uniqueOrVarios = (vals: string[]): string => {
    const set = new Set(vals.filter(v => v != null && v !== ''));
    if (set.size === 0) return '';
    if (set.size === 1) return [...set][0];
    return 'Varios';
  };

  const buildNotasText = (urls: string[]): string => {
    if (!notesByUrl || notesByUrl.size === 0) return '';
    const lines: string[] = [];
    urls.forEach((url, idx) => {
      const nota = (notesByUrl.get(url) || '').trim();
      if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
    });
    return lines.join('\n');
  };

  // Lista ordenada (alfabético por nombre de plaza) — 1 fila por plaza
  const plazas = [...byPlaza.keys()].sort((a, b) => a.localeCompare(b));

  for (const plaza of plazas) {
    const arr = byPlaza.get(plaza)!;
    const tipos = arr.map(it => it.tipo_medio || it.tipo_de_cara_display || it.tipo_de_cara || '');
    const numerosArticulo = arr.map(it => it.articulo || '');
    const articulos = arr.map(it => it.articulo || '');
    // Tarifa: si todas las caras de la plaza tienen la misma tarifa, mostrar
    // ese valor numérico. Si difieren, mostrar "Varios". El back ya entrega
    // sc.tarifa_publica (la negociada), no inv.tarifa_publica (catálogo en 0).
    const tarifasUnicas = Array.from(new Set(arr.map(it => Number(it.tarifa_publica) || 0).filter(t => t > 0)));
    const tarifaDisplay: number | string = tarifasUnicas.length === 1
      ? tarifasUnicas[0]
      : tarifasUnicas.length === 0 ? 0 : 'Varios';
    // Caras: contar inventarios únicos (espacios físicos), no filas
    // (cada fila era inventario × catorcena → inflaba el número).
    const caras = new Set(arr.map(it => it.id)).size;

    const urls = artesPorPlaza.get(plaza) || [];
    const notasResumen = buildNotasText(urls);
    const estatusDisplay = uniqueOrVarios(arr.map(it => mapItemToEstatus(it)));

    // Min/max de fechas dentro de la plaza
    const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
    const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
    const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
    const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';

    const rowValues: any[] = [
      plaza,
      uniqueOrVarios(tipos),
      asesor,
      campana.id,
      formatDate(minInicio),
      formatDate(maxFin),
      cliente,
      marca,
      campaniaNombre,
      caras,
      estatusDisplay,
      notasResumen,
      buildNombresArtesText(urls),
    ];
    // Padding vacío para celdas de arte
    for (let i = 0; i < maxArtesUnicos; i++) rowValues.push('');

    const row = sheet.addRow(rowValues);
    row.height = ROW_HEIGHT;
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Insertar miniaturas de arte en columnas Arte 1..N (deduplicadas por URL)
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const colIndex = ARTE_COL_START + i; // 0-based
      const imageId = await getImageId(url);
      if (imageId !== null) {
        sheet.addImage(imageId, {
          tl: { col: colIndex + 0.05, row: row.number - 1 + 0.05 },
          ext: { width: 130, height: 80 },
          editAs: 'oneCell',
        });
      } else {
        row.getCell(colIndex + 1).value = { text: 'Ver arte', hyperlink: url };
      }
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `versionario_artes_${campaniaNombre.replace(/[^\w\-]+/g, '_') || campana.id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Versión multi-campaña: 1 fila por (campaña, plaza).
// Usado por el botón "Versionario Artes" del screen Campañas (tab Versionario).
// ============================================================

export interface VersionarioArtesMultiArgs {
  campanas: Array<{
    campana: Campana;
    items: InventarioConArte[];
    digitalFilesByReserva?: Map<number, string[]>;
    notesByUrl?: Map<string, string>;
  }>;
  fileNameSuffix?: string;
}

// Fila lista para mostrar como preview (mismas columnas que se exportan).
export interface VersionarioArtesPreviewRow {
  plaza: string;
  tipo: string;
  asesor: string;
  apsQebId: number | string;
  cuic: string;
  fechaInicio: string;
  fechaFin: string;
  cliente: string;
  marca: string;
  campania: string;
  numeroArticulo: string;
  articulo: string;
  caras: number;
  tarifa: number | string;
  estatus: string; // Sin Revisar / En Revision / Aprobado / Rechazado / Pendiente / Varios
  notas: string;
  nombreArte: string;
  artesUrls: string[]; // urls deduplicadas, cada una se renderiza como thumbnail
}

// Mapea un item de inventario al label de estatus que corresponde a la
// tab/sub-tab donde vive en el Gestor de Artes. Considera todas las
// etapas del ciclo: Carga → Revision → Aprobado/Rechazado → Programado
// → Impresion → Recepcion → Instalado.
//
// Prioridad: estado terminal primero (Instalado), luego tarea activa
// (Programación/Impresión/Recepción), luego decision de arte (Aprobado/
// Rechazado/Pendiente/En Revisión), y al final el estado inicial
// (Sin Revisar si tiene archivo subido, Carga de Artes si no).
const mapItemToEstatus = (item: any): string => {
  // 1) Instalado (tab Validar Instalación)
  if (item.instalado === true || item.instalado === 1) return 'Instalado';

  // 2) Tarea activa: refleja la sub-tab actual de las main tabs
  //    Programación / Impresiones (sub: Orden, En Impresión, Recepción)
  const tarea = String(item.tarea || '').toLowerCase();
  if (tarea.includes('recepc')) return 'Artes Recibidos';
  if (tarea.includes('impres')) return 'En Impresión';
  if (tarea.includes('program')) return 'Programado';

  // 3) Decisión del arte (sub-tabs de Revisar y Aprobar)
  const v = String(item.arte_aprobado || '').toLowerCase().trim();
  if (v === 'aprobado') return 'Aprobado';
  if (v === 'rechazado') return 'Rechazado';
  if (v === 'pendiente') return 'Pendiente';
  if (v === 'en revision' || v === 'en revisión') return 'En Revisión';

  // 4) Estados iniciales (tab Subir Artes)
  if (item.archivo) return 'Sin Revisar';
  return 'Carga de Artes';
};


export interface VersionarioArtesPreview {
  headers: string[];           // headers base (sin contar Arte 1..N)
  arteCols: number;            // numero de columnas Arte X (max de artes por fila)
  rows: VersionarioArtesPreviewRow[];
}

// Construye las filas preview (sin escribir Excel). Usado por el modal preview
// y por el exporter para garantizar mismas columnas en preview y descarga.
export function buildVersionarioArtesPreview({ campanas }: { campanas: VersionarioArtesMultiArgs['campanas'] }): VersionarioArtesPreview {
  const getPlaza = (it: InventarioConArte): string => it.plaza || it.municipio || it.estado || '';
  const getRsvIds = (it: any): number[] =>
    String(it.rsv_id || it.rsv_ids || '')
      .split(',')
      .map((s: string) => parseInt(s.trim()))
      .filter((n: number) => !isNaN(n));

  const uniqueOrVarios = (vals: string[]): string => {
    const set = new Set(vals.filter(v => v != null && v !== ''));
    if (set.size === 0) return '';
    if (set.size === 1) return [...set][0];
    return 'Varios';
  };

  const rows: VersionarioArtesPreviewRow[] = [];
  let maxArtesUnicos = 0;

  for (const { campana, items, digitalFilesByReserva, notesByUrl } of campanas) {
    const byPlaza = new Map<string, InventarioConArte[]>();
    for (const it of items) {
      const p = getPlaza(it);
      if (!byPlaza.has(p)) byPlaza.set(p, []);
      byPlaza.get(p)!.push(it);
    }
    for (const [plaza, arr] of byPlaza) {
      const urls: string[] = [];
      const seen = new Set<string>();
      const pushUrl = (u: string | null | undefined) => {
        if (u && !seen.has(u)) {
          seen.add(u);
          urls.push(u);
        }
      };
      for (const it of arr) {
        pushUrl(it.archivo);
        const artesMultiples: string | null | undefined = (it as any).artes_multiples;
        if (artesMultiples) {
          for (const u of artesMultiples.split('||')) pushUrl(u.trim());
        }
        if (digitalFilesByReserva) {
          for (const rsvId of getRsvIds(it)) {
            const digitalUrls = digitalFilesByReserva.get(rsvId) || [];
            for (const u of digitalUrls) pushUrl(u);
          }
        }
      }
      if (urls.length > maxArtesUnicos) maxArtesUnicos = urls.length;

      const cuic = campana.cuic ? String(campana.cuic) : '';
      const asesor = (campana as any).T0_U_Asesor || (campana as any).asesor || '';
      const cliente = (campana as any).T0_U_RazonSocial || (campana as any).cliente || (campana as any).T1_U_Cliente || '';
      const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
      const campaniaNombre = campana.nombre || campana.nombre_campania || '';

      const tipos = arr.map(it => it.tipo_medio || it.tipo_de_cara_display || it.tipo_de_cara || '');
      const numerosArticulo = arr.map(it => it.articulo || '');
      const articulos = arr.map(it => it.articulo || '');
      const tarifasUnicas = Array.from(new Set(arr.map(it => Number(it.tarifa_publica) || 0).filter(t => t > 0)));
      const tarifaDisplay: number | string = tarifasUnicas.length === 1
        ? tarifasUnicas[0]
        : tarifasUnicas.length === 0 ? 0 : 'Varios';
      const caras = new Set(arr.map(it => it.id)).size;

      const notasResumen = (() => {
        if (!notesByUrl || notesByUrl.size === 0) return '';
        const lines: string[] = [];
        urls.forEach((url, idx) => {
          const nota = (notesByUrl.get(url) || '').trim();
          if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
        });
        return lines.join('\n');
      })();

      const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
      const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
      const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
      const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';

      // Estatus del arte: unico valor o "Varios" si difieren entre los items de la plaza.
      const estatusList = arr.map(it => mapItemToEstatus(it));
      const estatusDisplay = uniqueOrVarios(estatusList);

      rows.push({
        plaza,
        tipo: uniqueOrVarios(tipos),
        asesor,
        apsQebId: campana.id,
        cuic,
        fechaInicio: formatDate(minInicio),
        fechaFin: formatDate(maxFin),
        cliente,
        marca,
        campania: campaniaNombre,
        numeroArticulo: uniqueOrVarios(numerosArticulo),
        articulo: uniqueOrVarios(articulos),
        caras,
        tarifa: tarifaDisplay,
        estatus: estatusDisplay,
        notas: notasResumen,
        nombreArte: buildNombresArtesText(urls),
        artesUrls: urls,
      });
    }
  }

  return {
    headers: [
      'Plaza', 'Tipo', 'Asesor Comercial', 'APS Global - ID QEB', 'CUIC',
      'Fecha Inicio Periodo', 'Fecha Fin Periodo', 'Cliente Comercial',
      'Marca', 'Campaña', 'Número de artículo', 'Artículo', 'Caras', 'Tarifa',
      'Estatus', 'Notas', 'Nombre Arte',
    ],
    arteCols: maxArtesUnicos,
    rows,
  };
}

export async function exportVersionarioArtesMulti({ campanas, fileNameSuffix }: VersionarioArtesMultiArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QEB';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Versionario Artes');

  const getPlaza = (it: InventarioConArte): string => it.plaza || it.municipio || it.estado || '';
  const getRsvIds = (it: any): number[] =>
    String(it.rsv_id || it.rsv_ids || '')
      .split(',')
      .map((s: string) => parseInt(s.trim()))
      .filter((n: number) => !isNaN(n));

  // Estructura por bloque (campaña, plaza)
  type Bloque = {
    campana: Campana;
    plaza: string;
    items: InventarioConArte[];
    artesUrls: string[];
    notesByUrl?: Map<string, string>;
  };
  const bloques: Bloque[] = [];
  let maxArtesUnicos = 0;

  for (const { campana, items, digitalFilesByReserva, notesByUrl } of campanas) {
    const byPlaza = new Map<string, InventarioConArte[]>();
    for (const it of items) {
      const p = getPlaza(it);
      if (!byPlaza.has(p)) byPlaza.set(p, []);
      byPlaza.get(p)!.push(it);
    }
    for (const [plaza, arr] of byPlaza) {
      const urls: string[] = [];
      const seen = new Set<string>();
      const pushUrl = (u: string | null | undefined) => {
        if (u && !seen.has(u)) {
          seen.add(u);
          urls.push(u);
        }
      };
      for (const it of arr) {
        pushUrl(it.archivo);
        const artesMultiples: string | null | undefined = (it as any).artes_multiples;
        if (artesMultiples) {
          for (const u of artesMultiples.split('||')) pushUrl(u.trim());
        }
        if (digitalFilesByReserva) {
          for (const rsvId of getRsvIds(it)) {
            const digitalUrls = digitalFilesByReserva.get(rsvId) || [];
            for (const u of digitalUrls) pushUrl(u);
          }
        }
      }
      bloques.push({ campana, plaza, items: arr, artesUrls: urls, notesByUrl });
      if (urls.length > maxArtesUnicos) maxArtesUnicos = urls.length;
    }
  }

  // Orden: por nombre de campaña, luego por plaza
  bloques.sort((a, b) => {
    const ca = (a.campana.nombre || a.campana.nombre_campania || '').toString();
    const cb = (b.campana.nombre || b.campana.nombre_campania || '').toString();
    const cmp = ca.localeCompare(cb);
    if (cmp !== 0) return cmp;
    return a.plaza.localeCompare(b.plaza);
  });

  const baseHeaders = [
    'Plaza',
    'Tipo',
    'Asesor Comercial',
    'APS Global - ID QEB',
    'Fecha Inicio Periodo',
    'Fecha Fin Periodo',
    'Cliente Comercial',
    'Marca',
    'Campaña',
    'Caras',
    'Estatus',
    'Notas',
    'Nombre Arte',
  ];
  const arteHeaders = Array.from({ length: maxArtesUnicos }, (_, i) => `Arte ${i + 1}`);
  const headers = [...baseHeaders, ...arteHeaders];

  const baseWidths = [22, 14, 26, 14, 14, 14, 30, 18, 26, 8, 18, 50, 40];
  sheet.columns = [
    ...baseWidths.map(w => ({ width: w })),
    ...Array(maxArtesUnicos).fill(null).map(() => ({ width: 22 })),
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6B21A8' },
  };
  headerRow.height = 22;

  const imageCache = new Map<string, number | null>();
  const getImageId = async (url: string | null | undefined): Promise<number | null> => {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url) ?? null;
    const fetched = await fetchImage(url);
    if (!fetched) {
      imageCache.set(url, null);
      return null;
    }
    const id = workbook.addImage({ buffer: fetched.buffer, extension: fetched.ext });
    imageCache.set(url, id);
    return id;
  };

  const ROW_HEIGHT = 70;
  const ARTE_COL_START = baseHeaders.length;

  const uniqueOrVarios = (vals: string[]): string => {
    const set = new Set(vals.filter(v => v != null && v !== ''));
    if (set.size === 0) return '';
    if (set.size === 1) return [...set][0];
    return 'Varios';
  };

  for (const bloque of bloques) {
    const { campana, plaza, items: arr, artesUrls, notesByUrl } = bloque;

    const cuic = campana.cuic ? String(campana.cuic) : '';
    const asesor = (campana as any).T0_U_Asesor || (campana as any).asesor || '';
    const cliente = (campana as any).T0_U_RazonSocial || (campana as any).cliente || (campana as any).T1_U_Cliente || '';
    const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
    const campaniaNombre = campana.nombre || campana.nombre_campania || '';

    const tipos = arr.map(it => it.tipo_medio || it.tipo_de_cara_display || it.tipo_de_cara || '');
    const numerosArticulo = arr.map(it => it.articulo || '');
    const articulos = arr.map(it => it.articulo || '');
    // Tarifa: único valor o "Varios" (no suma de filas, eso inflaría).
    const tarifasUnicas = Array.from(new Set(arr.map(it => Number(it.tarifa_publica) || 0).filter(t => t > 0)));
    const tarifaDisplay: number | string = tarifasUnicas.length === 1
      ? tarifasUnicas[0]
      : tarifasUnicas.length === 0 ? 0 : 'Varios';
    // Caras: inventarios únicos, no filas (cada fila era inventario × catorcena).
    const caras = new Set(arr.map(it => it.id)).size;

    const notasResumen = (() => {
      if (!notesByUrl || notesByUrl.size === 0) return '';
      const lines: string[] = [];
      artesUrls.forEach((url, idx) => {
        const nota = (notesByUrl.get(url) || '').trim();
        if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
      });
      return lines.join('\n');
    })();

    const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
    const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
    const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
    const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';
    const estatusDisplay = uniqueOrVarios(arr.map(it => mapItemToEstatus(it)));

    const rowValues: any[] = [
      plaza,
      uniqueOrVarios(tipos),
      asesor,
      campana.id,
      formatDate(minInicio),
      formatDate(maxFin),
      cliente,
      marca,
      campaniaNombre,
      caras,
      estatusDisplay,
      notasResumen,
      buildNombresArtesText(artesUrls),
    ];
    for (let i = 0; i < maxArtesUnicos; i++) rowValues.push('');

    const row = sheet.addRow(rowValues);
    row.height = ROW_HEIGHT;
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    for (let i = 0; i < artesUrls.length; i++) {
      const url = artesUrls[i];
      const colIndex = ARTE_COL_START + i;
      const imageId = await getImageId(url);
      if (imageId !== null) {
        sheet.addImage(imageId, {
          tl: { col: colIndex + 0.05, row: row.number - 1 + 0.05 },
          ext: { width: 130, height: 80 },
          editAs: 'oneCell',
        });
      } else {
        row.getCell(colIndex + 1).value = { text: 'Ver arte', hyperlink: url };
      }
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sufijo = fileNameSuffix ? `_${fileNameSuffix}` : '';
  a.download = `versionario_artes${sufijo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
