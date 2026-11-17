import api from '../lib/api';
import { ApiResponse } from '../types';
import {
  IVA, IMP_FACTOR_ADICIONAL, IMP_MEDIO_DEFAULT, IMP_MATERIALES,
  OBSERVACIONES_DEFAULT, TERMINOS_Y_CONDICIONES,
} from '../config/propuestaEconomicaCatalogo';

// ───────────────────────── Modelo ─────────────────────────

/** Fila de las tablas con tarifa (Vía Pública, Aeropuertos, WiFi). */
export interface LineaTarifa {
  id: string;
  plaza: string;
  medio: string;
  formato: string;
  tarifaPublicada: number | null;
  tarifaAplicada: number | null;
  unidades: number | null;
  periodo: string;
  periodosCotizados: number | null;
}

/** Fila de la tabla de Impresiones. */
export interface LineaImpresion {
  id: string;
  plaza: string;
  medio: string;
  material: string;
  tarifaAplicada: number | null;
  unidades: number | null;
}

export type SeccionTarifa = 'viaPublica' | 'aeropuertos' | 'wifi';

export interface PropuestaEconomicaData {
  asesor: string;
  cliente: string;
  marca: string;
  /** YYYY-MM-DD */
  fechaInicio: string;
  /** YYYY-MM-DD */
  fechaFin: string;
  viaPublica: LineaTarifa[];
  aeropuertos: LineaTarifa[];
  wifi: LineaTarifa[];
  impresiones: LineaImpresion[];
  terminos: string;
  observaciones: string;
}

export interface PropuestaEconomica {
  id: number;
  usuario_id: number;
  nombre: string;
  data: PropuestaEconomicaData;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  is_owner?: boolean;
}

export const SECCIONES_TARIFA: { key: SeccionTarifa; titulo: string }[] = [
  { key: 'viaPublica', titulo: 'Vía Pública' },
  { key: 'aeropuertos', titulo: 'Aeropuertos' },
  { key: 'wifi', titulo: 'WiFi' },
];

// ───────────────────────── Fábricas ─────────────────────────

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const nuevaLineaTarifa = (parcial: Partial<LineaTarifa> = {}): LineaTarifa => ({
  id: uid(), plaza: '', medio: '', formato: '', tarifaPublicada: null, tarifaAplicada: null,
  unidades: null, periodo: '', periodosCotizados: null, ...parcial,
});

export const nuevaLineaImpresion = (parcial: Partial<LineaImpresion> = {}): LineaImpresion => ({
  id: uid(), plaza: '', medio: IMP_MEDIO_DEFAULT, material: IMP_MATERIALES[0],
  tarifaAplicada: null, unidades: null, ...parcial,
});

export const propuestaVacia = (asesor = ''): PropuestaEconomicaData => ({
  asesor, cliente: '', marca: '', fechaInicio: '', fechaFin: '',
  viaPublica: [nuevaLineaTarifa()], aeropuertos: [], wifi: [], impresiones: [],
  terminos: TERMINOS_Y_CONDICIONES, observaciones: OBSERVACIONES_DEFAULT,
});

/** Rellena campos faltantes de una propuesta guardada (tolerante a versiones viejas). */
export const normalizarPropuesta = (d: Partial<PropuestaEconomicaData> | null | undefined): PropuestaEconomicaData => {
  const base = propuestaVacia();
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...base,
    ...(d || {}),
    viaPublica: arr<LineaTarifa>(d?.viaPublica),
    aeropuertos: arr<LineaTarifa>(d?.aeropuertos),
    wifi: arr<LineaTarifa>(d?.wifi),
    impresiones: arr<LineaImpresion>(d?.impresiones),
    terminos: d?.terminos || base.terminos,
    observaciones: d?.observaciones ?? base.observaciones,
  };
};

// ───────────────────────── Cálculos (mismas fórmulas del Excel) ─────────────────────────

const num = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * Descuento % = (Tarifa Publicada − Tarifa Aplicada) ÷ Tarifa Publicada.
 * Devuelve fracción (0.71 = 71%) o null si falta algún dato o la publicada es 0.
 */
export const descuentoDe = (l: Pick<LineaTarifa, 'tarifaPublicada' | 'tarifaAplicada'>): number | null => {
  const pub = num(l.tarifaPublicada);
  const apl = num(l.tarifaAplicada);
  if (pub === null || apl === null || pub === 0) return null;
  return (pub - apl) / pub;
};

/** Inversión por Periodo = Tarifa Aplicada × Caras/Unidades. */
export const inversionPorPeriodo = (l: Pick<LineaTarifa, 'tarifaAplicada' | 'unidades'>): number | null => {
  const apl = num(l.tarifaAplicada);
  const uni = num(l.unidades);
  if (apl === null || uni === null) return null;
  return apl * uni;
};

/** Inversión total = Inversión por Periodo × Periodos Cotizados. */
export const inversionTotal = (l: LineaTarifa): number | null => {
  const porPeriodo = inversionPorPeriodo(l);
  const periodos = num(l.periodosCotizados);
  if (porPeriodo === null || periodos === null) return null;
  return porPeriodo * periodos;
};

/** Inversión total de impresión = Tarifa Aplicada × Unidades. */
export const inversionImpresion = (l: LineaImpresion): number | null => {
  const apl = num(l.tarifaAplicada);
  const uni = num(l.unidades);
  if (apl === null || uni === null) return null;
  return apl * uni;
};

export interface Totales { subtotal: number; iva: number; total: number }

const totalesDe = (subtotal: number): Totales => {
  const iva = subtotal * IVA;
  return { subtotal, iva, total: subtotal + iva };
};

export const totalesTarifa = (lineas: LineaTarifa[]): Totales =>
  totalesDe(lineas.reduce((s, l) => s + (inversionTotal(l) ?? 0), 0));

export const totalesImpresiones = (lineas: LineaImpresion[]): Totales =>
  totalesDe(lineas.reduce((s, l) => s + (inversionImpresion(l) ?? 0), 0));

export const totalesGenerales = (d: PropuestaEconomicaData): Totales =>
  totalesDe(
    totalesTarifa(d.viaPublica).subtotal +
    totalesTarifa(d.aeropuertos).subtotal +
    totalesTarifa(d.wifi).subtotal +
    totalesImpresiones(d.impresiones).subtotal
  );

/** Unidades a imprimir = caras + 30% adicional (igual que `=(J*30%)+J` del Excel). */
export const unidadesImpresion = (caras: number): number =>
  Math.round(caras * (1 + IMP_FACTOR_ADICIONAL) * 100) / 100;

/**
 * Una fila de impresión por cada fila de Vía Pública en formato Fijo (lo digital
 * no se imprime), con caras + 30%. Conserva material y tarifa de la fila previa
 * en la misma posición si ya existía, para no perder lo capturado al regenerar.
 */
export const impresionesDesdeViaPublica = (
  viaPublica: LineaTarifa[],
  previas: LineaImpresion[] = [],
): LineaImpresion[] => {
  const fijas = viaPublica.filter(l => l.plaza && l.formato === 'Fijo' && num(l.unidades) !== null);
  return fijas.map((l, i) => nuevaLineaImpresion({
    plaza: l.plaza,
    medio: previas[i]?.medio || IMP_MEDIO_DEFAULT,
    material: previas[i]?.material || previas[0]?.material || IMP_MATERIALES[0],
    tarifaAplicada: previas[i]?.tarifaAplicada ?? previas[0]?.tarifaAplicada ?? null,
    unidades: unidadesImpresion(l.unidades as number),
  }));
};

// ───────────────────────── Validación (mismas reglas que el Excel) ─────────────────────────

const lineaTarifaVacia = (l: LineaTarifa) =>
  !l.plaza && !l.medio && !l.formato && l.tarifaPublicada === null && l.tarifaAplicada === null &&
  l.unidades === null && l.periodosCotizados === null;

const lineaImpresionVacia = (l: LineaImpresion) =>
  !l.plaza && l.tarifaAplicada === null && l.unidades === null;

/** Quita las filas que el usuario dejó completamente en blanco. */
export const limpiarPropuesta = (d: PropuestaEconomicaData): PropuestaEconomicaData => ({
  ...d,
  viaPublica: d.viaPublica.filter(l => !lineaTarifaVacia(l)),
  aeropuertos: d.aeropuertos.filter(l => !lineaTarifaVacia(l)),
  wifi: d.wifi.filter(l => !lineaTarifaVacia(l)),
  impresiones: d.impresiones.filter(l => !lineaImpresionVacia(l)),
});

/** Errores de una fila con tarifa; [] si está completa y es válida. */
export const erroresLineaTarifa = (l: LineaTarifa): string[] => {
  const e: string[] = [];
  if (!l.plaza) e.push('plaza');
  if (!l.medio) e.push('medio/soporte');
  if (!l.formato) e.push('formato');
  const pub = num(l.tarifaPublicada);
  const apl = num(l.tarifaAplicada);
  if (pub === null || pub <= 0) e.push('tarifa publicada mayor a 0');
  if (apl === null || apl < 0) e.push('tarifa aplicada');
  else if (pub !== null && apl > pub) e.push('tarifa aplicada no mayor a la publicada');
  const uni = num(l.unidades);
  if (uni === null || uni <= 0) e.push('caras/unidades mayor a 0');
  if (!l.periodo) e.push('periodo');
  const per = num(l.periodosCotizados);
  if (per === null || per <= 0) e.push('periodos cotizados mayor a 0');
  return e;
};

export const erroresLineaImpresion = (l: LineaImpresion): string[] => {
  const e: string[] = [];
  if (!l.plaza) e.push('plaza');
  if (!l.medio) e.push('medio/soporte');
  if (!l.material) e.push('material');
  const apl = num(l.tarifaAplicada);
  if (apl === null || apl < 0) e.push('tarifa aplicada');
  const uni = num(l.unidades);
  if (uni === null || uni <= 0) e.push('unidades mayor a 0');
  return e;
};

/** Primer problema que impide guardar/exportar, o null si todo está bien. `d` ya limpia. */
export const validarPropuesta = (d: PropuestaEconomicaData): string | null => {
  if (!d.asesor.trim()) return 'Falta el nombre del asesor.';
  if (!d.cliente.trim()) return 'Falta el cliente.';
  if (!d.marca.trim()) return 'Falta la marca.';
  if (!d.fechaInicio || !d.fechaFin) return 'Faltan las fechas de inicio y cierre de la campaña.';
  if (d.fechaFin < d.fechaInicio) return 'La fecha de cierre no puede ser anterior a la de inicio.';
  const totalFilas = d.viaPublica.length + d.aeropuertos.length + d.wifi.length + d.impresiones.length;
  if (totalFilas === 0) return 'Agrega al menos una fila a la propuesta.';
  for (const s of SECCIONES_TARIFA) {
    const filas = d[s.key];
    for (let i = 0; i < filas.length; i++) {
      const e = erroresLineaTarifa(filas[i]);
      if (e.length) return `${s.titulo}, fila ${i + 1}: falta ${e.join(', ')}.`;
    }
  }
  for (let i = 0; i < d.impresiones.length; i++) {
    const e = erroresLineaImpresion(d.impresiones[i]);
    if (e.length) return `Impresiones, fila ${i + 1}: falta ${e.join(', ')}.`;
  }
  return null;
};

// ───────────────────────── Formato ─────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "2026-08-18" → "18 de agosto 2026" (como lo escriben en el Excel). */
export const fechaLarga = (iso: string): string => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || '';
  return `${parseInt(m[3], 10)} de ${MESES[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

export const moneda = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
    : '';

export const porcentaje = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '';

/** Nombre sugerido para guardar / para el archivo. */
export const nombreSugerido = (d: PropuestaEconomicaData): string => {
  const anio = (d.fechaInicio || '').slice(0, 4);
  return ['PROPUESTA', (d.marca || d.cliente).trim().toUpperCase(), anio].filter(Boolean).join(' ');
};

// ───────────────────────── API ─────────────────────────

const BASE = '/propuestas-economicas';

const hidratar = (p: PropuestaEconomica): PropuestaEconomica => ({ ...p, data: normalizarPropuesta(p.data) });

export const propuestaEconomicaService = {
  async list(): Promise<PropuestaEconomica[]> {
    const response = await api.get<ApiResponse<PropuestaEconomica[]>>(BASE);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener propuestas económicas');
    }
    return response.data.data.map(hidratar);
  },

  async get(id: number): Promise<PropuestaEconomica> {
    const response = await api.get<ApiResponse<PropuestaEconomica>>(`${BASE}/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener la propuesta económica');
    }
    return hidratar(response.data.data);
  },

  async create(nombre: string, data: PropuestaEconomicaData): Promise<PropuestaEconomica> {
    const response = await api.post<ApiResponse<PropuestaEconomica>>(BASE, { nombre, data });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al guardar la propuesta económica');
    }
    return hidratar(response.data.data);
  },

  async update(id: number, nombre: string, data: PropuestaEconomicaData): Promise<PropuestaEconomica> {
    const response = await api.put<ApiResponse<PropuestaEconomica>>(`${BASE}/${id}`, { nombre, data });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar la propuesta económica');
    }
    return hidratar(response.data.data);
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<unknown>>(`${BASE}/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar la propuesta económica');
    }
  },
};
