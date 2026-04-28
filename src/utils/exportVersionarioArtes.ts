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
}

export async function exportVersionarioArtes({ campana, items }: VersionarioArtesExportArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QEB';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Versionario Artes');

  const headers = [
    'Plaza',
    'Tipo',
    'Asesor Comercial',
    'APS Global - ID QEB',
    'CUIC',
    'Fecha Inicio Periodo',
    'Fecha Fin Periodo',
    'Cliente Comercial',
    'Marca',
    'Campaña',
    'Número de artículo',
    'Artículo',
    'Caras',
    'Tarifa',
    'Estado del Arte',
    'Arte',
  ];
  sheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 26 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 30 },
    { width: 18 },
    { width: 26 },
    { width: 18 },
    { width: 18 },
    { width: 8 },
    { width: 12 },
    { width: 16 },
    { width: 22 },
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

  const cuic = campana.cuic ? String(campana.cuic) : '';
  const asesor = (campana as any).T0_U_Asesor || (campana as any).asesor || '';
  const cliente = (campana as any).T0_U_RazonSocial || (campana as any).cliente || (campana as any).T1_U_Cliente || '';
  const marca = (campana as any).T2_U_Marca || (campana as any).marca || '';
  const campaniaNombre = campana.nombre || campana.nombre_campania || '';

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
  const ARTE_COL_INDEX = headers.length - 1; // 0-based, columna "Arte" (última)

  for (const it of items) {
    const tipo = it.tipo_medio || it.tipo_de_cara_display || it.tipo_de_cara || '';
    const plaza = it.plaza || it.municipio || it.estado || '';
    const numeroArticulo = it.articulo || '';
    const articuloLabel = it.articulo || '';
    const tarifa = Number(it.tarifa_publica) || 0;
    const arteEstado = it.arte_aprobado || (it.archivo ? 'Pendiente' : 'Sin arte');

    const row = sheet.addRow([
      plaza,
      tipo,
      asesor,
      campana.id,
      cuic,
      formatDate(it.inicio_periodo),
      formatDate(it.fin_periodo),
      cliente,
      marca,
      campaniaNombre,
      numeroArticulo,
      articuloLabel,
      1,
      tarifa,
      arteEstado,
      '',
    ]);
    row.height = ROW_HEIGHT;
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    if (it.archivo) {
      const imageId = await getImageId(it.archivo);
      if (imageId !== null) {
        sheet.addImage(imageId, {
          tl: { col: ARTE_COL_INDEX + 0.05, row: row.number - 1 + 0.05 },
          ext: { width: 130, height: 80 },
          editAs: 'oneCell',
        });
      } else {
        row.getCell(ARTE_COL_INDEX + 1).value = { text: 'Ver arte', hyperlink: it.archivo };
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
