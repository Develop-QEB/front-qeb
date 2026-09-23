import type { InventarioDisponible } from '../services/inventarios.service';

// UDC (aeropuerto AICM, compañía SAP SBOUDC) — helper de autorrelleno.
//
// Los artículos UDC son TODOS digitales, periodo MENSUAL y disponibilidad
// ilimitada (como un parabús digital). NO traen campo de plaza ni U_IMU_*: la
// zona (terminal / bloque / circuito / familia) viene dentro del ItemCode y el
// ItemName. El prefijo (RT/BF/CF/CT/IN/IM/ES) lo maneja QEB aparte
// (renta/bonif/cortesía/etc.).
//
// Familias detectadas en el catálogo (Articulos UDC.xlsx, 870 reales + 6 basura):
//   BLT  Back Light   BF-UDC-BLT-T1-01
//   VWL  Video Wall   BF-VWL-EPC-17 / BF-VWL-MXI-34-FA
//   PAQ  Paquete      BF-PAQ-VWL-NAL-02
//   BLOQ Bloque       BF-BLOQB-AICM-CDMX
//   CIRC Circuito     BF-CIRCA-PAQU1-AICM-CDMX

// AICM está en CDMX → la plaza (campo `estados`) reusa la opción combinada de
// Ciudad de México / Área Metropolitana que ya existe en QEB.
export const UDC_PLAZA_LABEL = 'Ciudad de México / AM';
export const UDC_CIUDAD_BASE = 'AICM';

// Prefijos reales de artículo. Todo lo demás en el catálogo UDC es basura
// (gorras, reembolsos, "otros activos": EDS*, INT-*, s1xx, S112-*).
const PREFIJOS_REALES = new Set(['RT', 'BF', 'CF', 'CT', 'IN', 'IM', 'ES']);

export type FamiliaUDC = 'BLT' | 'VWL' | 'PAQ' | 'BLOQ' | 'CIRC' | 'OTRA';

export interface ArticuloUDCInfo {
  familia: FamiliaUDC;
  familiaLabel: string;    // formato de display (BACK LIGHT / VIDEO WALL / ...)
  terminal: 'T1' | 'T2' | null;
  plazaLabel: string;      // → campo `estados` (plaza)
  ciudad: string;          // → campo `ciudad` (ej. "AICM T1")
  tipo: 'Digital';         // UDC siempre digital
}

const FAMILIA_LABEL: Record<FamiliaUDC, string> = {
  BLT: 'BACK LIGHT',
  VWL: 'VIDEO WALL',
  PAQ: 'PAQUETE',
  BLOQ: 'BLOQUE',
  CIRC: 'CIRCUITO',
  OTRA: '',
};

// Normaliza en-dash/em-dash a guion ASCII (algunos ItemCode traen U+2013) y
// pasa a MAYÚSCULAS para comparar.
const normCode = (s?: string | null): string =>
  (s || '').normalize('NFKC').replace(/[‒-―]/g, '-').trim().toUpperCase();

// ¿El artículo es una de las filas basura del catálogo UDC (no es inventario)?
export function esArticuloUDCBasura(itemCode?: string | null): boolean {
  const c = normCode(itemCode);
  if (!c) return true;
  const pref = c.split('-')[0];
  return !PREFIJOS_REALES.has(pref);
}

// ¿El artículo parece de UDC? Fallback cuando NO tenemos el sap_database a la
// mano. La señal fuerte es el contexto (cliente/campaña con sap_database='UDC');
// esto es solo un respaldo por patrón de código/nombre.
export function esArticuloUDC(itemCode?: string | null, itemName?: string | null): boolean {
  const c = normCode(itemCode);
  if (!c) return false;
  const toks = c.split('-');
  if (toks.includes('UDC') || toks.includes('AICM')) return true;
  const seg2 = toks[1] || '';
  if (seg2 === 'VWL' || seg2 === 'PAQ' || /^BLOQ/.test(seg2) || /^CIRC/.test(seg2)) return true;
  const n = (itemName || '').toUpperCase();
  if (n.includes('AICM') || n.includes('UDCVW')) return true;
  return false;
}

// Parsea un ItemCode/ItemName UDC → info de autorrelleno. Devuelve null si el
// código viene vacío. Familia 'OTRA' + label vacío si no reconocemos el patrón
// (el usuario puede ajustar a mano; lo importante es tipo=Digital + plaza AICM).
export function parseArticuloUDC(itemCode?: string | null, _itemName?: string | null): ArticuloUDCInfo | null {
  const c = normCode(itemCode);
  if (!c) return null;
  const toks = c.split('-');
  const seg2 = toks[1] || '';

  let familia: FamiliaUDC = 'OTRA';
  if (toks.includes('BLT')) familia = 'BLT';
  else if (seg2 === 'VWL' || toks.includes('VWL')) familia = 'VWL';
  else if (seg2 === 'PAQ' || toks.includes('PAQ')) familia = 'PAQ';
  else if (/^BLOQ/.test(seg2)) familia = 'BLOQ';
  else if (/^CIRC/.test(seg2)) familia = 'CIRC';

  const terminal: ArticuloUDCInfo['terminal'] =
    /-T1(-|$)/.test(c) ? 'T1' : /-T2(-|$)/.test(c) ? 'T2' : null;
  const ciudad = terminal ? `${UDC_CIUDAD_BASE} ${terminal}` : UDC_CIUDAD_BASE;

  return {
    familia,
    familiaLabel: FAMILIA_LABEL[familia],
    terminal,
    plazaLabel: UDC_PLAZA_LABEL,
    ciudad,
    tipo: 'Digital',
  };
}

// Zona de un artículo UDC a partir de su ItemCode SAP (para el Orden de Montaje).
// Los circuitos/bloques llevan la zona embebida en el código:
//   CIRC{A..D} / BLOQ{A..D} → "Zona A".."Zona D"
//   (ej. RT-CIRCA-PAQU1-AICM-CDMX → Zona A; CT-CIRCC-PAQU2-… → Zona C)
//   MXI = Módulo XI (Zona D). Como respaldo mínimo detecta la terminal T1/T2.
// Devuelve '' cuando el código no trae señal de zona (ej. RT-P1-DIG-MX): es
// esperado — esos artículos "segmentados" no codifican la zona en SAP.
export function udcZonaDeArticulo(itemCode?: string | null): string {
  const c = normCode(itemCode);
  if (!c) return '';
  const zl = c.match(/(?:CIRC|BLOQ)([A-D])(?![A-Z])/);
  if (zl) return `Zona ${zl[1]}`;
  if (/(^|-)MXI(-|$)/.test(c) || c.includes('MODXI')) return 'Zona D · Módulo XI';
  const term = /-T2(-|$)/.test(c) ? '2' : /-T1(-|$)/.test(c) ? '1' : '';
  if (term) return `Terminal ${term}`;
  return '';
}

// ── Ficha técnica del inventario UDC (aeropuerto AICM) ───────────────────────
// Catálogo de pantallas digitales por zona, con medida (px), duración (seg) y
// reel (# de anunciantes). Fuente: ficha técnica IMU. Se usa como "lista de
// inventarios" en el buscador de UDC (en vez del mapa, que no aplica).
export interface UdcPantalla {
  nombre: string;        // "DIGITAL 2"
  zona: string;          // grupo/zona
  medida: string;        // "1920 x 720" | "Pte. ficha técnica"
  ancho: number | null;  // px (null si pendiente)
  alto: number | null;   // px
  duracion: number;      // segundos por spot
  reel: number;          // anunciantes en el reel
}

const mk = (nombre: string, zona: string, ancho: number | null, alto: number | null, duracion: number, reel = 6): UdcPantalla => ({
  nombre, zona, ancho, alto, duracion, reel,
  medida: ancho && alto ? `${ancho} x ${alto}` : 'Pte. ficha técnica',
});

const rango = (base: string, desde: number, hasta: number, zona: string, ancho: number, alto: number, duracion: number): UdcPantalla[] => {
  const out: UdcPantalla[] = [];
  for (let n = desde; n <= hasta; n++) out.push(mk(`${base} ${n}`, zona, ancho, alto, duracion));
  return out;
};

export const UDC_ZONA_A = 'Zona A';
export const UDC_ZONA_C8 = 'Zona C · 8 pantallas';
export const UDC_ZONA_C5 = 'Zona C · 5 pantallas';
export const UDC_ZONA_IND = 'Digital';

export const UDC_FICHA_TECNICA: UdcPantalla[] = [
  // Zona A (2 pantallas)
  mk('DIGITAL 2', UDC_ZONA_A, 1920, 720, 20),
  mk('DIGITAL 3', UDC_ZONA_A, 2895, 790, 20),
  // Zona C (8 pantallas) — DIGITAL 20..27
  ...rango('DIGITAL', 20, 27, UDC_ZONA_C8, 1920, 1080, 10),
  // Zona C (5 pantallas) — DIGITAL 34..38
  ...rango('DIGITAL', 34, 38, UDC_ZONA_C5, 1920, 1080, 20),
  // Digital (individuales)
  mk('DIGITAL 1-A', UDC_ZONA_IND, 5376, 1152, 10),
  mk('DIGITAL 1-B', UDC_ZONA_IND, 2560, 1152, 10),
  mk('DIGITAL 17', UDC_ZONA_IND, 1920, 1080, 10),
  mk('DIGITAL 18', UDC_ZONA_IND, 1920, 1080, 10),
  mk('DIGITAL 19', UDC_ZONA_IND, 1920, 1080, 10),
  mk('DIGITAL 41', UDC_ZONA_IND, 1536, 768, 10),
  mk('DIGITAL 43', UDC_ZONA_IND, 3072, 384, 20),
  mk('DIGITAL T2', UDC_ZONA_IND, 3684, 1316, 10),
];

export const UDC_ZONAS_ORDEN = [UDC_ZONA_A, UDC_ZONA_C8, UDC_ZONA_C5, UDC_ZONA_IND];

// Normaliza cualquier código de pantalla a un ID canónico por número, para
// emparejar la ficha/imágenes/mapa aunque el string del inventario venga
// distinto. Ejemplos: "DIG- 02_Flujo_Ciudad de México"→"2", "DIG- 1A"→"1A",
// "DIG- 01 T2"→"T2", "DIGITAL 2"→"2", "DIGITAL 1-A"→"1A", "DIGITAL T2"→"T2".
export function udcPantallaNum(codigo?: string | null): string {
  let s = String(codigo || '').split('_')[0];               // quita sufijo _Flujo_Ciudad…
  // Quita el prefijo DIGITAL o DIG (DIGITAL primero para no comerse su "DIG").
  s = s.toUpperCase().replace(/^(DIGITAL|DIG)-?\s*/, '').trim();
  s = s.replace(/[-\s]/g, '');                                // "1-A"→"1A", "01 T2"→"01T2"
  if (s.includes('T2')) return 'T2';
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));        // "02"→"2"
  return s;                                                   // "1A", "1B", …
}

// Índice de la ficha técnica por número de pantalla + búsqueda por código.
const UDC_FICHA_BY_NUM: Map<string, UdcPantalla> = new Map(
  UDC_FICHA_TECNICA.map(p => [udcPantallaNum(p.nombre), p])
);
export function udcFichaDe(codigo?: string | null): UdcPantalla | undefined {
  const n = udcPantallaNum(codigo);
  return n ? UDC_FICHA_BY_NUM.get(n) : undefined;
}

// ── Ficha técnica en imagen (JPG) por pantalla ───────────────────────────────
// Cada pantalla del aeropuerto tiene una ficha técnica (imagen). Viven en
// `front/public/udc-fichas/`. Hay imagen individual para 1A/1B/2/3/17/18/19/41/
// 43/T2, y dos genéricas por zona: Zona C (pasillo, pantallas 20–27) y Zona D
// (Módulo XI, pantallas 34–38). DIGITAL H aún no trae ficha.
// OJO (supuestos a confirmar): 20–27 → Zona C, 34–38 → Zona D, H → sin ficha.
const UDC_FICHA_IMG_BASE = '/udc-fichas/';
// Keyed by número canónico (ver udcPantallaNum).
const UDC_FICHA_IMG_MAP: Record<string, string> = {
  '2': 'digital-2.jpg',
  '3': 'digital-3.jpg',
  '1A': 'digital-1a.jpg',
  '1B': 'digital-1b.jpg',
  '17': 'digital-17.jpg',
  '18': 'digital-18.jpg',
  '19': 'digital-19.jpg',
  '41': 'digital-41.jpg',
  '43': 'digital-43.jpg',
  'T2': 'digital-t2.jpg',
};

// ── Posición de cada pantalla en el mapa del aeropuerto ──────────────────────
// Coordenadas en % (x,y) sobre la imagen `udc-mapa-aicm-t1.jpg` (Terminal 1 ·
// Planta Alta). Detectadas automáticamente de los puntos verdes del propio mapa
// (centro de cada caja "Di N"). Solo están las pantallas que aparecen en ESE
// mapa: 17-19, 20-27, 34-38 y 41. Las demás (2, 3, 1-A, 1-B, 43, T2, H) son de
// otra zona/terminal y no tienen punto aquí.
// Keyed por número canónico (ver udcPantallaNum).
export const UDC_MAPA_COORDS: Record<string, { x: number; y: number }> = {
  '36': { x: 7.6, y: 23.6 },
  '37': { x: 9.6, y: 34.6 },
  '35': { x: 10.3, y: 41.6 },
  '38': { x: 9.6, y: 59.0 },
  '34': { x: 10.3, y: 64.3 },
  '19': { x: 39.9, y: 64.6 },
  '18': { x: 42.4, y: 74.4 },
  '17': { x: 42.4, y: 82.0 },
  '41': { x: 82.6, y: 62.1 },
  '27': { x: 19.7, y: 91.4 },
  '26': { x: 20.9, y: 91.4 },
  '25': { x: 23.8, y: 91.4 },
  '24': { x: 27.3, y: 91.4 },
  '23': { x: 28.8, y: 91.4 },
  '22': { x: 31.5, y: 91.4 },
  '21': { x: 35.0, y: 91.4 },
  '20': { x: 36.4, y: 91.4 },
};

// Terminal 1 · Planta Baja (segundo plano). De mis pantallas digitales, la
// única que vive aquí es la 43 (Sala E3). Detectada del pin verde del plano.
export const UDC_MAPA_COORDS_PB: Record<string, { x: number; y: number }> = {
  '43': { x: 29.8, y: 86.9 },
};

export function udcMapaCoord(codigoUnico?: string | null): { x: number; y: number } | null {
  const n = udcPantallaNum(codigoUnico);
  if (!n) return null;
  return UDC_MAPA_COORDS[n] ?? UDC_MAPA_COORDS_PB[n] ?? null;
}

// Devuelve la URL pública de la ficha técnica (imagen) de una pantalla UDC a
// partir de su código (acepta el real "DIG- 02_…" o el de ficha "DIGITAL 2").
export function udcFichaImg(codigoUnico?: string | null): string | null {
  const n = udcPantallaNum(codigoUnico);
  if (!n) return null;
  if (UDC_FICHA_IMG_MAP[n]) return UDC_FICHA_IMG_BASE + UDC_FICHA_IMG_MAP[n];
  const num = parseInt(n, 10);
  if (num >= 20 && num <= 27) return UDC_FICHA_IMG_BASE + 'zona-c.jpg'; // Zona C · pasillo
  if (num >= 34 && num <= 38) return UDC_FICHA_IMG_BASE + 'zona-d.jpg'; // Zona D · Módulo XI
  return null;
}

// ── Inventario "sintético" UDC ───────────────────────────────────────────────
// El aeropuerto AICM NO vive en la tabla `inventarios` (son artículos SAP, sin
// geo ni codigo_unico). Para que el buscador de UDC pueda mostrar las pantallas
// como INVENTARIO seleccionable (checkbox) y engancharlas al flujo de reserva
// normal, "inventamos" una fila InventarioDisponible por cada pantalla de la
// ficha técnica. El id es NEGATIVO (-(1000+i)) para que sea inconfundiblemente
// sintético y no choque con ids reales. El orden coincide 1:1 con
// UDC_FICHA_TECNICA (mismo `codigo_unico` = nombre de pantalla).
//
// OJO: al reservar se manda `inventario_id` al backend; con id negativo el back
// lo rechazará hasta que existan filas UDC reales en `inventarios` (paso aparte
// de siembra). Esta síntesis habilita la SELECCIÓN/visualización, no la
// persistencia de la reserva.
export function buildUdcInventarioDisponible(): InventarioDisponible[] {
  return UDC_FICHA_TECNICA.map((p, i) => ({
    id: -(1000 + i),
    codigo_unico: p.nombre,
    ubicacion: p.zona,
    tipo_de_cara: 'Flujo',
    cara: 'A',
    mueble: 'PANTALLA DIGITAL AICM',
    latitud: 0,
    longitud: 0,
    plaza: 'CIUDAD DE MEXICO',
    estado: 'Ciudad de México',
    municipio: UDC_CIUDAD_BASE,
    cp: null,
    tradicional_digital: 'Digital',
    sentido: null,
    tipo_de_mueble: p.zona,
    ancho: p.ancho ?? 0,
    alto: p.alto ?? 0,
    archivos_id: null,
    nivel_socioeconomico: null,
    total_espacios: null,
    tiempo: p.duracion,
    estatus: 'Disponible',
    codigo: null,
    isla: 'NO',
    mueble_isla: null,
    entre_calle_1: null,
    entre_calle_2: null,
    orientacion: null,
    tarifa_piso: null,
    tarifa_publica: null,
    cto: null,
    estatus_real: 'Disponible',
    espacios: [],
    espacios_count: 0,
    ya_reservado_para_cara: false,
    espacio_id: null,
    numero_espacio: null,
  }));
}
