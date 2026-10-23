// Formateo del campo `detalles` del historial de acciones.
//
// El back guarda `detalles` como texto. A veces es un string plano (ej.
// "Akary aprobó arte de 5 reservas") y a veces es un JSON estructurado (ej.
// {"usuario":"...","cambios":[{"label":"Estado","antes":"Pendiente","despues":"Aprobada"}]}).
//
// Esta funcion convierte el JSON a una linea legible y devuelve el texto
// plano tal cual cuando no es JSON. Si el JSON no encaja en ningun caso
// conocido, intenta un fallback generico (clave: valor) en lugar de
// devolver el JSON literal.

interface Cambio {
  campo?: string;
  label?: string;
  antes?: unknown;
  despues?: unknown;
}

interface CaraInfo {
  articulo?: string;
  caras?: number;
  formato?: string;
  costo?: number;
  catorcena?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  if (isPlainObject(v)) return JSON.stringify(v);
  return String(v);
};

// Un motivo "trivial" (vacío, solo espacios o solo signos de puntuación como
// ".", "-", "..") se trata como SIN motivo, para no mostrar "Motivo: ." .
export function limpiarMotivo(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (!s) return '';
  if (!/[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s)) return ''; // sin letras ni números → trivial
  return s;
}

const money = (v: unknown): string => `$${Number(v).toLocaleString('es-MX')}`;

// Formatea un "circuito" del detalle (eliminar/crear circuito, eliminar
// reservas) con lo que tenga: catorcena · artículo (formato) · N caras · $monto.
export const formatCircuito = (c: Record<string, unknown>): string => {
  const t: string[] = [];
  const cat = c.catorcena ?? c.cat ?? c.numero_catorcena;
  if (cat) t.push(String(cat));
  if (c.articulo) t.push(String(c.articulo));
  if (c.formato) t.push(`(${c.formato})`);
  const nc = c.caras ?? c.caras_totales;
  if (nc !== undefined && nc !== null && nc !== '') {
    const noun = String(c.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras';
    t.push(`${nc} ${noun}`);
  }
  const monto = c.inversion ?? c.costo ?? c.monto;
  if (monto !== undefined && monto !== null && monto !== '' && Number(monto) > 0) t.push(money(monto));
  return t.join(' · ');
};

export function formatHistorialDetalles(detalles: string | null | undefined): string {
  if (!detalles) return '';
  const s = String(detalles).trim();
  if (!s) return '';
  if (!s.startsWith('{') && !s.startsWith('[')) return s;

  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(s);
    if (!isPlainObject(parsed)) return s;
    obj = parsed;
  } catch {
    return s;
  }

  const parts: string[] = [];

  // Casos conocidos del back (autorizaciones, aprobaciones, etc.)
  if (obj.aprobadoPor) {
    parts.push(`Aprobado por: ${formatValue(obj.aprobadoPor)}`);
    if (obj.tipo) parts.push(`Tipo: ${formatValue(obj.tipo)}`);
    if (obj.carasAprobadas) parts.push(`${formatValue(obj.carasAprobadas)} circuito(s)`);
    return parts.join(' | ');
  }

  if (obj.rechazadoPor) {
    parts.push(`Rechazado por: ${formatValue(obj.rechazadoPor)}`);
    if (obj.tipo) parts.push(`Tipo: ${formatValue(obj.tipo)}`);
    parts.push(`Motivo: ${limpiarMotivo(obj.motivo) || 'no especificado'}`);
    return parts.join(' | ');
  }

  // Patron generico: usuario + cambios + origen + cara(s) + pendientes
  if (obj.usuario) parts.push(formatValue(obj.usuario));
  if (obj.origen) parts.push(`Origen: ${formatValue(obj.origen)}`);
  if (obj.accion && obj.usuario) parts.push(`(${formatValue(obj.accion)})`);

  if (Array.isArray(obj.cambios) && obj.cambios.length > 0) {
    for (const c of obj.cambios as Cambio[]) {
      const etiqueta = c.label || c.campo || 'Campo';
      const antes = c.antes !== undefined && c.antes !== null && c.antes !== '' ? formatValue(c.antes) : '(vacio)';
      const despues = c.despues !== undefined && c.despues !== null && c.despues !== '' ? formatValue(c.despues) : '(vacio)';
      parts.push(`${etiqueta}: ${antes} → ${despues}`);
    }
  }

  if (isPlainObject(obj.cara)) {
    const cara = obj.cara as CaraInfo;
    const noun = (cara.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras';
    const trozos: string[] = [];
    if (cara.catorcena) trozos.push(String(cara.catorcena));
    if (cara.articulo) trozos.push(`Articulo: ${cara.articulo}`);
    if (cara.caras !== undefined) trozos.push(`${cara.caras} ${noun}`);
    if (cara.costo !== undefined) trozos.push(`$${Number(cara.costo).toLocaleString('es-MX')}`);
    if (trozos.length > 0) parts.push(trozos.join(', '));
  }

  if (Array.isArray(obj.caras) && obj.caras.length > 0) {
    const first = obj.caras[0] as CaraInfo;
    const noun = (first.formato || '').toUpperCase().includes('PUENTE PEATONAL') ? 'puentes' : 'caras';
    const trozos: string[] = [];
    if (first.articulo) trozos.push(first.articulo);
    if (first.formato) trozos.push(first.formato);
    if (first.caras !== undefined) trozos.push(`${first.caras} ${noun}`);
    if (trozos.length > 0) parts.push(trozos.join(' — '));
    if (obj.caras.length > 1) parts.push(`+${obj.caras.length - 1} más`);
  }

  // Lista de circuitos con detalle (eliminar/crear circuito, eliminar reservas).
  // El back guarda `circuitos` (eliminar circuito de campaña: con catorcena,
  // artículo, caras, tarifa e inversión), `circuitos_eliminados` o
  // `caras_eliminadas` (propuesta). Mostramos cat · artículo (formato) · caras · $.
  const listaCircuitos = (
    Array.isArray(obj.circuitos) && obj.circuitos.length ? obj.circuitos :
    Array.isArray(obj.circuitos_eliminados) && obj.circuitos_eliminados.length ? obj.circuitos_eliminados :
    Array.isArray(obj.caras_eliminadas) && obj.caras_eliminadas.length ? obj.caras_eliminadas :
    null
  ) as Record<string, unknown>[] | null;
  if (listaCircuitos) {
    const lineas = listaCircuitos.slice(0, 3).map(c => formatCircuito(c)).filter(Boolean);
    if (lineas.length > 0) {
      let txt = lineas.join('  |  ');
      if (listaCircuitos.length > 3) txt += `  (+${listaCircuitos.length - 3} más)`;
      parts.push(txt);
    }
  }
  if (obj.reservas_eliminadas !== undefined && obj.reservas_eliminadas !== null && obj.reservas_eliminadas !== '') {
    parts.push(`${formatValue(obj.reservas_eliminadas)} reserva(s) eliminada(s)`);
  }
  const motivoGen = limpiarMotivo(obj.motivo);
  if (motivoGen && !obj.rechazadoPor) parts.push(`Motivo: ${motivoGen}`);

  if (obj.pendientesDg) parts.push(`Pendientes DG: ${formatValue(obj.pendientesDg)}`);
  if (obj.pendientesDcm) parts.push(`Pendientes DCM: ${formatValue(obj.pendientesDcm)}`);

  if (parts.length > 0) return parts.join(' | ');

  // Fallback generico: si el JSON tiene keys pero ninguna conocida, mostrar
  // pares clave: valor en lugar del JSON literal. Mas legible que llaves/comillas.
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${formatValue(v)}`);
  if (entries.length > 0) return entries.join(' | ');

  return s;
}
