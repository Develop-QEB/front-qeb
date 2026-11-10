// Bloqueo administrativo del inventario (inventarios.estatus).
//
// Clasificaciones que se comportan IGUAL para efectos de ocupación: la pieza
// no se puede utilizar/reservar y al aplicarse se liberan sus reservas
// actuales/futuras. Solo cambia la etiqueta. Espejo de
// ESTATUS_INVENTARIO_BLOQUEO en qeb-Back (inventario-bloqueo.service.ts).
//
// 'No Disponible' es el nombre nuevo de 'Bloqueado' (rename oct-2026): es lo que
// se ofrece al usuario y lo que se guarda al bloquear. 'Bloqueado' sigue siendo
// un valor VÁLIDO en BD (filas legacy pre-migración) — se reconoce como bloqueado
// pero ya no aparece en el selector.
//
// Vigencia (nov-2026): al bloquear se puede capturar un periodo opcional
// (fecha inicio/fin). Sin fechas = indefinido hasta habilitar a mano. Con fecha
// inicio futura el bloqueo queda PROGRAMADO (la pieza sigue Disponible hasta
// ese día). Al cumplirse la fecha fin, el back crea una tarea
// 'Vigencia Bloqueo Inventario' a quien bloqueó para que rehabilite desde ahí.
// Espejo de qeb-Back/services/vigencia-bloqueo.service.ts.

export const TIPOS_BLOQUEO_INVENTARIO = ['No Disponible', 'Inhabilitado'] as const;
export type TipoBloqueoInventario = (typeof TIPOS_BLOQUEO_INVENTARIO)[number];

export const TIPO_BLOQUEO_DEFAULT: TipoBloqueoInventario = 'No Disponible';

// Valores de estatus que cuentan como bloqueo (seleccionables + legacy).
const ESTATUS_BLOQUEO_RECONOCIDOS = [...TIPOS_BLOQUEO_INVENTARIO, 'Bloqueado'] as const;

/** ¿El inventario está bloqueado administrativamente (No Disponible, Bloqueado legacy o Inhabilitado)? */
export function esInventarioBloqueado(estatus: string | null | undefined): boolean {
  return !!estatus && (ESTATUS_BLOQUEO_RECONOCIDOS as readonly string[]).includes(estatus);
}

// ─── Vigencia ────────────────────────────────────────────────────────────────

/** `tareas.tipo` de la tarea que crea el back al cumplirse la vigencia. */
export const TAREA_TIPO_VIGENCIA_BLOQUEO = 'Vigencia Bloqueo Inventario';

/**
 * Vigencia capturada en los modales de bloqueo. Fechas en 'YYYY-MM-DD'.
 * Ambas null = indefinida (modo por default). En modo "con fechas" las dos
 * son obligatorias; '' = el usuario aún no la captura (inválido para enviar).
 */
export interface VigenciaBloqueo {
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export const VIGENCIA_INDEFINIDA: VigenciaBloqueo = { fecha_inicio: null, fecha_fin: null };

/** Hoy en la zona local del navegador como 'YYYY-MM-DD'. */
export function hoyLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ¿Se puede enviar? Indefinida, o con ambas fechas y fin >= inicio. */
export function vigenciaValida(v: VigenciaBloqueo): boolean {
  if (v.fecha_inicio === null && v.fecha_fin === null) return true;
  if (!v.fecha_inicio || !v.fecha_fin) return false;
  return v.fecha_fin >= v.fecha_inicio;
}

/** ¿La vigencia implica bloqueo programado (inicio después de hoy)? */
export function vigenciaEsProgramada(v: VigenciaBloqueo): boolean {
  return !!v.fecha_inicio && v.fecha_inicio > hoyLocalISO();
}

/** 'YYYY-MM-DD' o ISO datetime (columna DATE serializada) → 'dd/mm/aaaa'. */
export function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.slice(0, 10).split('-');
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

/** Texto humano de la vigencia, para descripciones de tareas y badges. */
export function describirVigencia(v: { fecha_inicio?: string | null; fecha_fin?: string | null } | null | undefined): string {
  if (!v || !v.fecha_fin) {
    return 'Indefinida (hasta habilitar manualmente)';
  }
  return v.fecha_inicio
    ? `Del ${fechaCorta(v.fecha_inicio)} al ${fechaCorta(v.fecha_fin)}`
    : `Hasta ${fechaCorta(v.fecha_fin)}`;
}

/** Campos de vigencia tal como llegan del back en una fila de inventario. */
export interface InventarioConVigencia {
  estatus?: string | null;
  bloqueo_tipo?: string | null;
  bloqueo_fecha_inicio?: string | null;
  bloqueo_fecha_fin?: string | null;
}

/** ¿Tiene un bloqueo programado pendiente (aún Disponible, con tipo y fecha inicio futura)? */
export function esBloqueoProgramado(inv: InventarioConVigencia): boolean {
  return !esInventarioBloqueado(inv.estatus) && !!inv.bloqueo_tipo && !!inv.bloqueo_fecha_inicio;
}

// Textos por clasificación, para no regar ternarios por los modales.
export const TIPO_BLOQUEO_TEXTOS: Record<TipoBloqueoInventario, {
  opcion: string;       // etiqueta del selector
  descripcion: string;  // ayuda bajo la etiqueta
  infinitivo: string;   // "Marcar No Disponible"
  gerundio: string;     // "Marcando No Disponible..."
  participio: string;   // "No Disponible por: ..."
  sustantivo: string;   // "Fecha de bloqueo"
  revertir: string;     // "Marcar Disponible"
}> = {
  'No Disponible': {
    opcion: 'No Disponible',
    descripcion: 'La pieza queda No Disponible y no se puede ocupar.',
    infinitivo: 'Marcar No Disponible',
    gerundio: 'Marcando No Disponible',
    participio: 'No Disponible',
    sustantivo: 'bloqueo',
    revertir: 'Marcar Disponible',
  },
  Inhabilitado: {
    opcion: 'Inhabilitado',
    descripcion: 'La pieza queda inhabilitada y no se puede ocupar.',
    infinitivo: 'Inhabilitar',
    gerundio: 'Inhabilitando',
    participio: 'Inhabilitado',
    sustantivo: 'inhabilitación',
    revertir: 'Habilitar',
  },
};
