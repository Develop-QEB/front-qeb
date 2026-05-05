// Circuitos Digitales IMU — helper compartido backend + frontend
//
// Un "circuito" es un grupo predefinido de ~50 inventarios (20 en MR)
// identificados por la combinación CTO + plaza en la tabla inventarios.
// Se venden como un artículo único tipo `RT-DIG-{nn}-{plazaCode}`.
//
// Ejemplos:
//   RT-DIG-03-MX → Renta circuito 3, Ciudad de México / AM
//   BF-DIG-01-MTY → Bonificación circuito 1, Monterrey
//
// Reglas:
// - Bonificación usa el MISMO artículo RT-DIG-NN (no hay BF paralelo)
// - Total fijo = count de inventarios del circuito
// - Auto-reserva todo-o-nada al crear propuesta
// - Autorización: aprobado automático (pending tabulador real)

export const CIRCUITO_REGEX = /^(RT|BF|CT|CF)-DIG-(\d+)-([A-Z]+)$/i;

// IMPORTANTE: los valores deben coincidir EXACTAMENTE con `inventarios.plaza`
// porque el front los usa como `value` en los <select> de plaza, y las options
// vienen de ese campo (ej. "PUEBLA" en MAYÚSCULAS).
// Ciudad de México es la única excepción: usa una opción especial "Ciudad de
// México / AM" que combina CDMX + Estado de México.
export const PLAZA_CODE_TO_LABEL: Record<string, string> = {
  MX: 'Ciudad de México / AM',
  MTY: 'MONTERREY',
  GD: 'GUADALAJARA',
  GDL: 'GUADALAJARA',
  PB: 'PUEBLA',
  MR: 'MÉRIDA',
  MER: 'MÉRIDA',
  TOL: 'TOLUCA',
};

export interface CircuitoInfo {
  tipo: 'RT' | 'BF' | 'CT' | 'CF';
  cto: number;
  ctoLabel: string;
  plazaCode: string;
  plazaLabel: string;
  itemCode: string;
}

export function parseCircuitoDigital(itemCode: string | null | undefined): CircuitoInfo | null {
  if (!itemCode) return null;
  const m = itemCode.trim().match(CIRCUITO_REGEX);
  if (!m) return null;
  const tipo = m[1].toUpperCase() as CircuitoInfo['tipo'];
  const cto = parseInt(m[2], 10);
  if (!Number.isFinite(cto) || cto <= 0) return null;
  const plazaCode = m[3].toUpperCase();
  return {
    tipo,
    cto,
    ctoLabel: `CTO ${cto}`,
    plazaCode,
    plazaLabel: PLAZA_CODE_TO_LABEL[plazaCode] || plazaCode,
    itemCode: itemCode.trim(),
  };
}

export function isCircuitoDigital(itemCode: string | null | undefined): boolean {
  return parseCircuitoDigital(itemCode) !== null;
}

export function circuitoKey(info: CircuitoInfo): string {
  return `CTO${info.cto}-${info.plazaCode}`;
}
