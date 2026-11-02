// Helpers del tablero CRM de "Actividad Comercial" (tab en Historial de
// Acciones). Espejo del back (actividad-comercial.service.ts): las 3 columnas
// se derivan de `tareas.estatus` y al soltar una tarjeta se escribe el valor
// canonico de la columna (Finalizado -> 'Atendido', que es lo que todo
// Notificaciones ya trata como resuelto).
import type { ActividadComercialTarea } from '../../services/historial.service';

/** Query key del tablero. useSocketHistorialAcciones la invalida con `historial:nueva`. */
export const QK_ACTIVIDAD_COMERCIAL = ['historial-actividad-comercial'] as const;

export const COLUMNAS_AC = ['Abierto', 'Activo', 'Finalizado'] as const;
export type ColumnaAC = (typeof COLUMNAS_AC)[number];

export const COLUMNA_LABEL: Record<ColumnaAC, string> = {
  Abierto: 'Abierto',
  Activo: 'Activo',
  Finalizado: 'Finalizado',
};

export const COLUMNA_DESCRIPCION: Record<ColumnaAC, string> = {
  Abierto: 'Registradas, aún sin trabajar',
  Activo: 'En seguimiento',
  Finalizado: 'Atendidas o canceladas',
};

// Mismos colores que las columnas del kanban de Notificaciones (azul / ámbar / esmeralda).
export const COLUMNA_COLOR: Record<ColumnaAC, { bg: string; border: string; text: string; dot: string; drop: string }> = {
  Abierto: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500', drop: 'ring-blue-500/60' },
  Activo: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500', drop: 'ring-amber-500/60' },
  Finalizado: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500', drop: 'ring-emerald-500/60' },
};

const ESTATUS_FINALIZADOS = new Set(['Atendido', 'Finalizada', 'Finalizado', 'Completado', 'Cerrado', 'Cancelado']);

export function columnaDeEstatus(estatus: string | null | undefined): ColumnaAC {
  if (estatus === 'Abierto') return 'Abierto';
  if (estatus && ESTATUS_FINALIZADOS.has(estatus)) return 'Finalizado';
  return 'Activo';
}

export function esCancelada(t: Pick<ActividadComercialTarea, 'estatus'>): boolean {
  return t.estatus === 'Cancelado';
}

/** Campos del formulario del asesor, serializados en `contenido`. */
export interface ContenidoAC {
  cliente?: string | null;
  marca?: string | null;
  subtipo?: string | null;
  ref_id?: number | string | null;
  anio?: number | null;
  catorcena?: number | null;
  estatus_actividad?: string | null;
  base?: string | null;
}

export function parseContenidoAC(raw: string | null | undefined): ContenidoAC {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? (o as ContenidoAC) : {};
  } catch {
    return {};
  }
}

/** "Actividad Comercial · Propuesta #81612" -> "Propuesta #81612" (el chip ya dice el tipo). */
export function tituloCorto(titulo: string | null | undefined): string {
  const t = (titulo || '').trim();
  return t.replace(/^Actividad Comercial\s*·\s*/i, '') || 'Actividad Comercial';
}

/** Vencida = fecha_fin pasó y sigue sin finalizar. */
export function estaVencida(t: Pick<ActividadComercialTarea, 'estatus' | 'fecha_fin'>): boolean {
  if (columnaDeEstatus(t.estatus) === 'Finalizado') return false;
  const fin = new Date(t.fecha_fin);
  if (Number.isNaN(fin.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fin < hoy;
}

/** Texto plano para el buscador del tablero. */
export function textoBusqueda(t: ActividadComercialTarea): string {
  const c = parseContenidoAC(t.contenido);
  return [
    t.titulo, t.descripcion, t.responsable, t.asignado, t.asesor, t.cuic, t.cliente_nombre,
    c.cliente, c.marca, c.subtipo, c.ref_id != null ? `#${c.ref_id}` : null, c.base,
    t.campania_id ? `#${t.campania_id}` : null, t.id_propuesta ? `#${t.id_propuesta}` : null,
  ].filter(Boolean).join(' ').toLowerCase();
}

/** Cliente para filtrar: lo que capturó el asesor, o el de la cuenta vinculada. */
export function clienteDe(t: ActividadComercialTarea): string | null {
  const c = parseContenidoAC(t.contenido);
  return (c.cliente || t.cliente_nombre || '').trim() || null;
}

/** ¿Alguno de los IDs de la actividad (tarea, campaña, propuesta, ref) es exactamente `id`? */
export function coincideId(t: ActividadComercialTarea, id: string): boolean {
  const q = id.trim();
  if (!q) return true;
  const c = parseContenidoAC(t.contenido);
  return [t.id, t.campania_id, t.id_propuesta, c.ref_id]
    .filter(v => v !== null && v !== undefined && v !== '')
    .some(v => String(v) === q);
}

// ---------- KPIs del tablero ----------
// Se calculan sobre el ESTADO ACTUAL de las actividades (no sobre el historial
// de transiciones): una actividad en Finalizado se asume que paso por Activo.
// Las canceladas no cuentan como avance ni como finalizadas; se reportan aparte.
export interface KpisAC {
  total: number;
  abiertas: number;
  activas: number;
  /** En columna Finalizado SIN canceladas. */
  finalizadas: number;
  canceladas: number;
  vencidas: number;
  /** total - canceladas: denominador de los porcentajes. */
  base: number;
  /** finalizadas / base. null si base = 0. */
  pctFinalizacion: number | null;
  /** (activas + finalizadas) / base: cuantas ya salieron de Abierto. */
  convAbiertoActivo: number | null;
  /** finalizadas / (activas + finalizadas): cuantas de las que llegaron a Activo terminaron. */
  convActivoFinalizado: number | null;
}

export function calcularKpisAC(tareas: ActividadComercialTarea[]): KpisAC {
  let abiertas = 0, activas = 0, finalizadas = 0, canceladas = 0, vencidas = 0;
  for (const t of tareas) {
    if (esCancelada(t)) { canceladas++; continue; }
    const col = columnaDeEstatus(t.estatus);
    if (col === 'Abierto') abiertas++;
    else if (col === 'Activo') activas++;
    else finalizadas++;
    if (estaVencida(t)) vencidas++;
  }
  const total = tareas.length;
  const base = total - canceladas;
  const llegaronActivo = activas + finalizadas;
  const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
  return {
    total, abiertas, activas, finalizadas, canceladas, vencidas, base,
    pctFinalizacion: ratio(finalizadas, base),
    convAbiertoActivo: ratio(llegaronActivo, base),
    convActivoFinalizado: ratio(finalizadas, llegaronActivo),
  };
}

export function formatPct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

// Filtros rapidos del tablero. Deciden que columnas se muestran.
export type FiltroRapidoAC = 'todas' | 'sin_finalizar' | 'finalizadas';

export const FILTRO_RAPIDO_LABEL: Record<FiltroRapidoAC, string> = {
  todas: 'Todas',
  sin_finalizar: 'Sin finalizar',
  finalizadas: 'Finalizadas',
};

export const COLUMNAS_POR_FILTRO: Record<FiltroRapidoAC, readonly ColumnaAC[]> = {
  todas: COLUMNAS_AC,
  sin_finalizar: ['Abierto', 'Activo'],
  finalizadas: ['Finalizado'],
};
