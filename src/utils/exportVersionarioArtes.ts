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

// Detecta si una URL apunta a un archivo de video (no se puede previsualizar
// como imagen en Excel ni en el modal). En esos casos mostramos "Video subido"
// con el nombre del archivo en vez de la miniatura.
const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const u = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|avi|webm|mkv|m4v|wmv|flv)$/.test(u);
};

// "Arte 1: nombre.png\nArte 2: otro.png" — un nombre por linea.
// Si se pasa namesByUrl con nombre_arte manual del usuario, se usa ese en lugar
// del nombre del archivo extraido de la URL.
const buildNombresArtesText = (urls: string[], namesByUrl?: Map<string, string>): string => {
  if (!urls || urls.length === 0) return '';
  return urls.map((u, idx) => {
    const manual = namesByUrl?.get(u)?.trim();
    const name = manual || extractArteName(u);
    return `Arte ${idx + 1}: ${name}`;
  }).join('\n');
};

// Extrae los nombre_arte por URL a partir de items.artes_detalle (JSON del back).
// Para items multi-arte tradicional. Para artes digitales no hay nombre_arte
// en preview lightweight — se obtiene al descargar via notesByUrl/namesByUrl
// que se llenan en handleDownloadVersionarioFromPreview.
const extractNamesByUrl = (arr: any[]): Map<string, string> => {
  const m = new Map<string, string>();
  for (const it of arr) {
    const detalle = it.artes_detalle;
    if (!detalle) continue;
    try {
      const parsed = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const archivo = (entry.archivo || '').trim();
          const nombre = (entry.nombre_arte || '').trim();
          if (archivo && nombre && !m.has(archivo)) m.set(archivo, nombre);
        }
      }
    } catch { /* ignore */ }
  }
  return m;
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
  // Filtros activos en el modal preview (set de circuitKey). Si se pasa, solo
  // se exportan los circuitos cuya key este en el set — respeta filtros UI.
  filterKeys?: Set<string> | null;
  // Saltar embed de miniaturas para descarga rapida. Las columnas "Arte N"
  // quedan con la URL en texto en vez de la imagen.
  skipImages?: boolean;
}

export async function exportVersionarioArtes({ campana, items, digitalFilesByReserva, notesByUrl, filterKeys, skipImages }: VersionarioArtesExportArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QEB';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Versionario Artes');

  const cuic = campana.cuic ? String(campana.cuic) : '';
  const asesor = (campana as any).T0_U_Asesor || (campana as any).asesor || '';
  const cliente = (campana as any).cliente_razon_social
    || (campana as any).cliente_nombre
    || (campana as any).T0_U_RazonSocial
    || (campana as any).T0_U_Cliente
    || (campana as any).T1_U_Cliente
    || (campana as any).cliente
    || '';
  const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
  const campaniaNombre = campana.nombre || campana.nombre_campania || '';

  // Agrupar items por CIRCUITO (solicitudCaras.id) — antes era por plaza.
  // Cada circuito = 1 fila. Granularidad de "Ocupacion BP".
  const getPlaza = (it: InventarioConArte): string => it.plaza || it.municipio || it.estado || '';
  const getCircuitoKey = (it: any): string => {
    const k = it.solicitudCarasId ?? it.grupo ?? null;
    if (k != null && k !== '') return String(k);
    return String(it.id || it.codigo_unico || Math.random());
  };
  const byPlaza = new Map<string, InventarioConArte[]>();
  for (const it of items) {
    const k = getCircuitoKey(it);
    // Si filterKeys esta dado, respetar el filtro UI del modal. La key del
    // preview es `${campana.id}::${circuitId}`.
    if (filterKeys && !filterKeys.has(`${campana.id}::${k}`)) continue;
    if (!byPlaza.has(k)) byPlaza.set(k, []);
    byPlaza.get(k)!.push(it);
  }

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
    'ID Campaña',
    'Plaza',
    'Tipo',
    'Formato',
    'Asesor Comercial',
    'APS QEB',
    'Fecha Inicio Periodo',
    'Fecha Fin Periodo',
    'Cliente Comercial',
    'Marca',
    'Campaña',
    'Caras',
    'Estatus',
    'Notas',
    'Nombre Arte',
    'URL Arte',
  ];
  const arteHeaders = Array.from({ length: maxArtesUnicos }, (_, i) => `Arte ${i + 1}`);
  const headers = [...baseHeaders, ...arteHeaders];

  const baseWidths = [12, 22, 14, 14, 26, 14, 14, 14, 30, 18, 26, 8, 18, 50, 40, 60];
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
    // Caras del circuito: SUMA de caras_totales por item (cada item es un
    // grupo/reserva del back y trae su propio count de reservas). Da el total
    // del circuito aun cuando un inventario fisico tenga multiples reservas.
    const caras = arr.reduce((sum, it) => sum + (Number((it as any).caras_totales) || 1), 0);

    const urls = artesPorPlaza.get(plaza) || [];
    const notasResumen = buildNotasText(urls);
    const { text: estatusDisplay } = buildEstatusCircuito(arr);

    // Min/max de fechas dentro de la plaza
    const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
    const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
    const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
    const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';

    // Plaza display: como ahora la `plaza` del loop es la key del circuito,
    // sacamos el nombre real de la plaza desde los items del circuito.
    const plazaDisplay = uniqueOrVarios(arr.map(it => getPlaza(it)));
    const formatoDisplay = uniqueOrVarios(arr.map(it => (it.mueble || (it as any).formato || it.tipo_de_mueble || '').toString()));
    const urlArteText = urls.join('\n');

    const rowValues: any[] = [
      campana.id,
      plazaDisplay,
      uniqueOrVarios(tipos),
      formatoDisplay,
      asesor,
      computeApsDisplay(arr),
      formatDate(minInicio),
      formatDate(maxFin),
      cliente,
      marca,
      campaniaNombre,
      caras,
      estatusDisplay,
      notasResumen,
      buildNombresArtesText(urls, extractNamesByUrl(arr)),
      urlArteText,
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
      // Si es video no se puede embed → texto "Video subido: nombre"
      if (isVideoUrl(url)) {
        const name = extractArteName(url);
        row.getCell(colIndex + 1).value = { text: `Video subido: ${name}`, hyperlink: url };
        continue;
      }
      // Modo rapido: no embed de imagen, solo hyperlink "Ver arte". Evita
      // los segundos por imagen del fetch + addImage.
      if (skipImages) {
        row.getCell(colIndex + 1).value = { text: 'Ver arte', hyperlink: url };
        continue;
      }
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
  const sufijo = skipImages ? '_sin_miniaturas' : '';
  a.download = `versionario_artes_${campaniaNombre.replace(/[^\w\-]+/g, '_') || campana.id}${sufijo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  // Filtros activos en el modal preview (set de circuitKey). Si se pasa, solo
  // se exportan los circuitos cuya key este en el set — respeta filtros UI.
  filterKeys?: Set<string> | null;
  // Saltar embed de miniaturas para descarga rapida. Las columnas "Arte N"
  // quedan con la URL en texto en vez de la imagen.
  skipImages?: boolean;
}

// Fila lista para mostrar como preview (mismas columnas que se exportan).
// Granularidad: 1 fila por CIRCUITO (= solicitudCaras.id), no por plaza.
// Un circuito vive dentro de una campaña y representa un grupo de caras del
// mismo formato/articulo, mismo periodo y mismo APS. Es la misma granularidad
// que muestra "Ocupacion BP" en el modal de Ordenes de Montaje.
export interface VersionarioArtesPreviewRow {
  // ID sintetico del circuito para vincular preview ↔ export (filtrar al
  // descargar). Se construye con solicitudCaras.id (o fallback) + idCampana
  // para que sea unico cuando hay multiples campañas en un mismo Excel.
  circuitKey: string;
  idCampana: number | string; // ID de la campaña (APS Global - ID QEB era ambiguo)
  plaza: string;
  tipo: string;
  formato: string; // PARABUS, MUPIS, COLUMNA, etc. (de inv.mueble / sc.formato)
  asesor: string;
  apsQebId: number | string; // APS asignado al circuito
  cuic: string;
  fechaInicio: string;
  fechaFin: string;
  fechaInicioRaw: string;
  fechaFinRaw: string;
  cliente: string;
  marca: string;
  campania: string;
  numeroArticulo: string;
  articulo: string;
  caras: number; // total de caras del circuito
  tarifa: number | string;
  estatus: string; // "Instaladas" | "1 Subir Artes, 2 Instaladas" | etc.
  estatusBreakdown: EstatusBreakdownItem[]; // desglose para renderizar badges
  notas: string;
  nombreArte: string;
  artesUrls: string[];
  posted: boolean;
}

// Determina el estatus jerarquico de un item: nivel + label.
// Cada item se asigna al nivel MAS ALTO al que ha llegado. Niveles:
//   1 - Subir Artes        (label: "Subir Artes")
//   2 - Revisar y Aprobar  (sub-tabs: Sin Revisar / En Revision / Aprobado / Rechazado / Pendiente)
//   3 - Programacion       (label: "En Programacion")
//   4 - Impresiones        (sub-tabs: En Impresion / Pendiente de Recepcion / Recibido)
//   5 - Validar Instalacion (sub-tabs: Por Instalar / Instaladas / Testigo)
//
// Prioridad descendente: chequea nivel 5 → 4 → 3 → 2 → 1.
const getItemLevelStatus = (item: any): { level: number; label: string } => {
  const tarea = String(item.tarea || '').toLowerCase();
  const status = String(item.status_mostrar || item.estatus || '').toLowerCase();

  // Nivel 5: Validar Instalacion
  if (item.testigo_status === 'validado' || tarea.includes('testigo')) {
    return { level: 5, label: 'Testigo' };
  }
  if (item.instalado === true || item.instalado === 1) {
    return { level: 5, label: 'Instaladas' };
  }
  if (tarea.includes('instalac')) {
    return { level: 5, label: 'Por Instalar' };
  }

  // Nivel 4: Impresiones
  if (tarea.includes('recepc')) {
    // Si la tarea de recepcion ya esta atendida → Recibido. Si no, Pendiente.
    if (status.includes('atendido') || status.includes('completado')) {
      return { level: 4, label: 'Recibido' };
    }
    return { level: 4, label: 'Pendiente de Recepción' };
  }
  if (tarea.includes('impres')) {
    return { level: 4, label: 'En Impresión' };
  }

  // Nivel 3: Programacion
  if (tarea.includes('program')) {
    return { level: 3, label: 'En Programación' };
  }

  // Nivel 2: Revisar y Aprobar
  const v = String(item.arte_aprobado || '').toLowerCase().trim();
  if (v === 'aprobado') return { level: 2, label: 'Aprobado' };
  if (v === 'rechazado') return { level: 2, label: 'Rechazado' };
  if (v === 'pendiente') return { level: 2, label: 'Pendiente' };
  if (v === 'en revision' || v === 'en revisión') return { level: 2, label: 'En Revisión' };
  if (item.archivo) return { level: 2, label: 'Sin Revisar' };

  // Nivel 1: Subir Artes
  return { level: 1, label: 'Subir Artes' };
};

// Construye el display de Estatus para un circuito.
// Recibe los items del circuito y devuelve un string del tipo:
//   - "Instaladas"                                      (todos iguales)
//   - "1 Subir Artes, 1 Recibido, 2 Instaladas"         (mixto)
// Tambien expone el desglose estructurado para renderizar badges en el modal.
export interface EstatusBreakdownItem { label: string; count: number; level: number; }

const buildEstatusCircuito = (arr: any[]): { text: string; breakdown: EstatusBreakdownItem[] } => {
  if (!arr || arr.length === 0) return { text: '', breakdown: [] };
  const counts = new Map<string, { count: number; level: number }>();
  for (const item of arr) {
    const { level, label } = getItemLevelStatus(item);
    // Cada item representa caras_totales reservas (cuando el back agrupa).
    const weight = Number(item.caras_totales) || 1;
    const cur = counts.get(label);
    if (cur) counts.set(label, { count: cur.count + weight, level });
    else counts.set(label, { count: weight, level });
  }
  // Ordenar por nivel descendente (mas alto primero)
  const breakdown: EstatusBreakdownItem[] = [...counts.entries()]
    .map(([label, { count, level }]) => ({ label, count, level }))
    .sort((a, b) => b.level - a.level);
  if (breakdown.length === 1) {
    // Un solo estatus → solo el label (sin conteo redundante)
    return { text: breakdown[0].label, breakdown };
  }
  // Mixto: "N Label, M Label, ..."
  const text = breakdown.map(b => `${b.count} ${b.label}`).join(', ');
  return { text, breakdown };
};

// APS Global - ID QEB: del campo APS de cada inventario (no del id de campana).
// Si todos los inventarios de la plaza tienen el mismo APS lo devuelve numerico.
// Si tienen varios, los devuelve separados por coma (ej: "81330, 81335, 81340").
// Vacio si no hay APS asignado.
const computeApsDisplay = (arr: any[]): number | string => {
  const apsList = arr.map(it => String(it.APS ?? '')).filter(v => v !== '' && v !== 'null');
  const set = new Set(apsList);
  if (set.size === 0) return '';
  if (set.size === 1) {
    const n = Number([...set][0]);
    return Number.isFinite(n) ? n : [...set][0];
  }
  // Varios → lista ordenada y separada por coma
  return [...set].sort((a, b) => Number(a) - Number(b)).join(', ');
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

  // Helper: id del circuito (solicitudCaras) — back lo expone como `grupo` o
  // `solicitudCarasId` segun el endpoint. Fallback al codigo unico si por
  // alguna razon no viene seteado.
  const getCircuitoKey = (it: any): string => {
    const k = it.solicitudCarasId ?? it.grupo ?? null;
    if (k != null && k !== '') return String(k);
    return String(it.id || it.codigo_unico || Math.random());
  };

  for (const { campana, items, digitalFilesByReserva, notesByUrl } of campanas) {
    // Agrupar por CIRCUITO (no por plaza). 1 fila por solicitudCaras.id
    const byCircuito = new Map<string, InventarioConArte[]>();
    for (const it of items) {
      const k = getCircuitoKey(it);
      if (!byCircuito.has(k)) byCircuito.set(k, []);
      byCircuito.get(k)!.push(it);
    }
    for (const [circuitId, arr] of byCircuito) {
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
      const cliente = (campana as any).cliente_razon_social
    || (campana as any).cliente_nombre
    || (campana as any).T0_U_RazonSocial
    || (campana as any).T0_U_Cliente
    || (campana as any).T1_U_Cliente
    || (campana as any).cliente
    || '';
      const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
      const campaniaNombre = campana.nombre || campana.nombre_campania || '';

      // Por circuito normalmente plaza/tipo/articulo/asesor/etc. son uniformes,
      // pero igual usamos uniqueOrVarios por defensa.
      const plazas = arr.map(it => getPlaza(it));
      const plazaDisplay = uniqueOrVarios(plazas);

      const tipos = arr.map(it => it.tipo_medio || it.tipo_de_cara_display || it.tipo_de_cara || '');
      const numerosArticulo = arr.map(it => it.articulo || '');
      const articulos = arr.map(it => it.articulo || '');
      const tarifasUnicas = Array.from(new Set(arr.map(it => Number(it.tarifa_publica) || 0).filter(t => t > 0)));
      const tarifaDisplay: number | string = tarifasUnicas.length === 1
        ? tarifasUnicas[0]
        : tarifasUnicas.length === 0 ? 0 : 'Varios';
      // Caras del circuito: SUMA de caras_totales por item (cada item es un
    // grupo/reserva del back y trae su propio count de reservas). Da el total
    // del circuito aun cuando un inventario fisico tenga multiples reservas.
    const caras = arr.reduce((sum, it) => sum + (Number((it as any).caras_totales) || 1), 0);

      const notasResumen = (() => {
        // Primero intentar notesByUrl (disponible en fase de descarga con datos enriquecidos)
        if (notesByUrl && notesByUrl.size > 0) {
          const lines: string[] = [];
          urls.forEach((url, idx) => {
            const nota = (notesByUrl.get(url) || '').trim();
            if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
          });
          if (lines.length > 0) return lines.join('\n');
        }
        // Fallback: extraer notas desde artes_detalle, alineadas con las URLs únicas
        const notaByArchivo = new Map<string, string>();
        for (const it of arr) {
          const detalle = (it as any).artes_detalle;
          if (!detalle) continue;
          try {
            const parsed = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
            if (Array.isArray(parsed)) {
              for (const entry of parsed) {
                const archivo = (entry.archivo || '').trim();
                const nota = (entry.nota || '').trim();
                if (archivo && nota && !notaByArchivo.has(archivo)) {
                  notaByArchivo.set(archivo, nota);
                }
              }
            }
          } catch { /* ignore */ }
        }
        if (notaByArchivo.size === 0) return '';
        const lines: string[] = [];
        urls.forEach((url, idx) => {
          const nota = notaByArchivo.get(url) || '';
          if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
        });
        return lines.join('\n');
      })();

      const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
      const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
      const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
      const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';

      const { text: estatusText, breakdown: estatusBreakdown } = buildEstatusCircuito(arr);

      const apsNumbers = arr.map(it => Number((it as any).APS)).filter(n => !isNaN(n) && n > 0);
      const uniqueAps = [...new Set(apsNumbers)];
      let posted = false;
      if ((campana as any).posted_to_sap) {
        posted = true;
      } else if ((campana as any).posted_aps && uniqueAps.length > 0) {
        // posted_aps puede venir como array, JSON string "[1,2,3]" o CSV "1,2,3".
        // Sin esta normalizacion, .map() crashea cuando es string y la funcion
        // tira excepcion → modal queda vacio.
        const raw = (campana as any).posted_aps;
        let postedApsArr: number[] = [];
        if (Array.isArray(raw)) {
          postedApsArr = raw.map(Number).filter(n => !isNaN(n));
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) postedApsArr = parsed.map(Number).filter(n => !isNaN(n));
            } catch { /* malformed JSON, ignore */ }
          } else if (trimmed) {
            postedApsArr = trimmed.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
          }
        }
        if (postedApsArr.length > 0) {
          const postedApsSet = new Set(postedApsArr);
          posted = uniqueAps.every(a => postedApsSet.has(a));
        }
      }

      // Formato: PARABUS / MUPIS / COLUMNA / etc. — prioriza inv.mueble,
      // fallback a sc.formato. Si difieren entre items de la plaza, "Varios".
      const formatos = arr.map(it => (it.mueble || (it as any).formato || it.tipo_de_mueble || '').toString());
      const formatoDisplay = uniqueOrVarios(formatos);

      rows.push({
        circuitKey: `${campana.id}::${circuitId}`,
        idCampana: campana.id,
        plaza: plazaDisplay,
        tipo: uniqueOrVarios(tipos),
        formato: formatoDisplay,
        asesor,
        apsQebId: computeApsDisplay(arr),
        cuic,
        fechaInicio: formatDate(minInicio),
        fechaFin: formatDate(maxFin),
        fechaInicioRaw: minInicio,
        fechaFinRaw: maxFin,
        cliente,
        marca,
        campania: campaniaNombre,
        numeroArticulo: uniqueOrVarios(numerosArticulo),
        articulo: uniqueOrVarios(articulos),
        caras,
        tarifa: tarifaDisplay,
        estatus: estatusText,
        estatusBreakdown,
        notas: notasResumen,
        nombreArte: buildNombresArtesText(urls, extractNamesByUrl(arr)),
        artesUrls: urls,
        posted,
      });
    }
  }

  return {
    headers: [
      'ID Campaña', 'Plaza', 'Tipo', 'Formato', 'Asesor Comercial', 'APS QEB',
      'Fecha Inicio Periodo', 'Fecha Fin Periodo', 'Cliente Comercial',
      'Marca', 'Campaña', 'Caras', 'Estatus', 'Notas', 'Nombre Arte', 'URL Arte',
    ],
    arteCols: maxArtesUnicos,
    rows,
  };
}

export async function exportVersionarioArtesMulti({ campanas, fileNameSuffix, filterKeys, skipImages }: VersionarioArtesMultiArgs): Promise<void> {
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

  // Agrupar por CIRCUITO (no por plaza). 1 fila por circuito.
  const getCircuitoKey = (it: any): string => {
    const k = it.solicitudCarasId ?? it.grupo ?? null;
    if (k != null && k !== '') return String(k);
    return String(it.id || it.codigo_unico || Math.random());
  };
  for (const { campana, items, digitalFilesByReserva, notesByUrl } of campanas) {
    const byCircuito = new Map<string, InventarioConArte[]>();
    for (const it of items) {
      const k = getCircuitoKey(it);
      // Respetar filtros del modal preview cuando se descarga.
      if (filterKeys && !filterKeys.has(`${campana.id}::${k}`)) continue;
      if (!byCircuito.has(k)) byCircuito.set(k, []);
      byCircuito.get(k)!.push(it);
    }
    for (const [circuitId, arr] of byCircuito) {
      // Plaza display: inline porque uniqueOrVarios se define mas abajo
      const plazaSet = new Set(arr.map(it => getPlaza(it)).filter(v => v != null && v !== ''));
      const plaza = plazaSet.size === 0 ? '' : plazaSet.size === 1 ? [...plazaSet][0] : 'Varios';
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
    'ID Campaña',
    'Plaza',
    'Tipo',
    'Formato',
    'Asesor Comercial',
    'APS QEB',
    'Fecha Inicio Periodo',
    'Fecha Fin Periodo',
    'Cliente Comercial',
    'Marca',
    'Campaña',
    'Caras',
    'Estatus',
    'Notas',
    'Nombre Arte',
    'URL Arte',
  ];
  const arteHeaders = Array.from({ length: maxArtesUnicos }, (_, i) => `Arte ${i + 1}`);
  const headers = [...baseHeaders, ...arteHeaders];

  const baseWidths = [12, 22, 14, 14, 26, 14, 14, 14, 30, 18, 26, 8, 18, 50, 40, 60];
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
    const cliente = (campana as any).cliente_razon_social
    || (campana as any).cliente_nombre
    || (campana as any).T0_U_RazonSocial
    || (campana as any).T0_U_Cliente
    || (campana as any).T1_U_Cliente
    || (campana as any).cliente
    || '';
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
    // Caras del circuito: SUMA de caras_totales por item (cada item es un
    // grupo/reserva del back y trae su propio count de reservas). Da el total
    // del circuito aun cuando un inventario fisico tenga multiples reservas.
    const caras = arr.reduce((sum, it) => sum + (Number((it as any).caras_totales) || 1), 0);

    const notasResumen = (() => {
      if (notesByUrl && notesByUrl.size > 0) {
        const lines: string[] = [];
        artesUrls.forEach((url, idx) => {
          const nota = (notesByUrl.get(url) || '').trim();
          if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
        });
        if (lines.length > 0) return lines.join('\n');
      }
      // Fallback: extraer notas desde artes_detalle, alineadas con URLs únicas
      const notaByArchivo = new Map<string, string>();
      for (const it of arr) {
        const detalle = (it as any).artes_detalle;
        if (!detalle) continue;
        try {
          const parsed = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              const archivo = (entry.archivo || '').trim();
              const nota = (entry.nota || '').trim();
              if (archivo && nota && !notaByArchivo.has(archivo)) {
                notaByArchivo.set(archivo, nota);
              }
            }
          }
        } catch { /* ignore */ }
      }
      if (notaByArchivo.size === 0) return '';
      const lines: string[] = [];
      artesUrls.forEach((url, idx) => {
        const nota = notaByArchivo.get(url) || '';
        if (nota) lines.push(`Arte ${idx + 1}: ${nota}`);
      });
      return lines.join('\n');
    })();

    const inicios = arr.map(it => it.inicio_periodo).filter(Boolean) as string[];
    const fines = arr.map(it => it.fin_periodo).filter(Boolean) as string[];
    const minInicio = inicios.length ? inicios.slice().sort()[0] : '';
    const maxFin = fines.length ? fines.slice().sort().reverse()[0] : '';
    const { text: estatusDisplay } = buildEstatusCircuito(arr);
    const formatoDisplay = uniqueOrVarios(arr.map(it => (it.mueble || (it as any).formato || it.tipo_de_mueble || '').toString()));
    const urlArteText = artesUrls.join('\n');

    const rowValues: any[] = [
      campana.id,
      plaza,
      uniqueOrVarios(tipos),
      formatoDisplay,
      asesor,
      computeApsDisplay(arr),
      formatDate(minInicio),
      formatDate(maxFin),
      cliente,
      marca,
      campaniaNombre,
      caras,
      estatusDisplay,
      notasResumen,
      buildNombresArtesText(artesUrls, extractNamesByUrl(arr)),
      urlArteText,
    ];
    for (let i = 0; i < maxArtesUnicos; i++) rowValues.push('');

    const row = sheet.addRow(rowValues);
    row.height = ROW_HEIGHT;
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    for (let i = 0; i < artesUrls.length; i++) {
      const url = artesUrls[i];
      const colIndex = ARTE_COL_START + i;
      // Video → "Video subido: nombre" (no se puede embed en Excel)
      if (isVideoUrl(url)) {
        const name = extractArteName(url);
        row.getCell(colIndex + 1).value = { text: `Video subido: ${name}`, hyperlink: url };
        continue;
      }
      // Modo rapido: solo hyperlink, sin fetch ni embed.
      if (skipImages) {
        row.getCell(colIndex + 1).value = { text: 'Ver arte', hyperlink: url };
        continue;
      }
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
  const rapidoTag = skipImages ? '_sin_miniaturas' : '';
  a.download = `versionario_artes${sufijo}${rapidoTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
