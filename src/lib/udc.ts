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
  mk('DIGITAL H', UDC_ZONA_IND, null, null, 10),
];

export const UDC_ZONAS_ORDEN = [UDC_ZONA_A, UDC_ZONA_C8, UDC_ZONA_C5, UDC_ZONA_IND];
