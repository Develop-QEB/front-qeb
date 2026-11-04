import { AUTORIZACION_OPCIONES, AUTORIZACION_PREFIX } from './autorizacionFiltro';

// Vistas de Tablero (Propuestas / Campañas): orden rápido, filtro de
// incompletos y vistas guardadas por usuario.
//
// Las vistas viven en localStorage y se guardan por usuario + módulo, con el
// mismo criterio que las agrupaciones del Desglose (ver
// PropuestasVersionarioView): es configuración de UI, no dato de negocio, y no
// justifica tabla ni endpoints. Contra conocido: no siguen al usuario si
// cambia de navegador o de equipo.

export type TableroScope = 'solicitudes' | 'propuestas' | 'campanas';

// Orden de las tarjetas del tablero y de las filas de la tabla.
//
// Un solo criterio a la vez, cada uno con sus dos sentidos:
//   - 'nueva_vieja' / 'vieja_nueva'       → fecha de creación
//   - 'presupuesto_alto' / 'presupuesto_bajo' → presupuesto / inversión
//   - 'reciente' / 'reciente_viejo'       → último cambio (edición, estatus,
//     autorización de circuitos; ver fechaUltimoCambio)
//
// 'reciente' es el default FIJO del tablero: arriba lo que cambió más
// recientemente, que es lo que el tablero debe responder de un vistazo.
// Las claves viejas ('reciente', 'nueva_vieja', 'vieja_nueva') se conservan a
// propósito: viven en las vistas guardadas en localStorage.
export type OrdenRapido =
  | 'reciente' | 'reciente_viejo'
  | 'nueva_vieja' | 'vieja_nueva'
  | 'presupuesto_alto' | 'presupuesto_bajo';

export type OrdenCampo = 'creacion' | 'presupuesto' | 'cambio';

export interface OrdenOpcion { value: OrdenRapido; label: string; hint: string }
export interface OrdenCriterio {
  campo: OrdenCampo;
  label: string;
  hint: string;
  /** [sentido descendente, sentido ascendente] */
  opciones: readonly [OrdenOpcion, OrdenOpcion];
}

/** Criterios del menú "Ordenar", en el orden en que se pintan. */
export const ORDEN_CRITERIOS: readonly OrdenCriterio[] = [
  {
    campo: 'creacion', label: 'Fecha de creación', hint: 'Por la fecha en que se creó el registro',
    opciones: [
      { value: 'nueva_vieja', label: 'Nueva', hint: 'De la más nueva a la más vieja (fecha de creación)' },
      { value: 'vieja_nueva', label: 'Vieja', hint: 'De la más vieja a la más nueva (fecha de creación)' },
    ],
  },
  {
    campo: 'presupuesto', label: 'Presupuesto', hint: 'Por presupuesto / inversión',
    opciones: [
      { value: 'presupuesto_alto', label: 'Alto', hint: 'Del presupuesto más alto al más bajo' },
      { value: 'presupuesto_bajo', label: 'Bajo', hint: 'Del presupuesto más bajo al más alto' },
    ],
  },
  {
    campo: 'cambio', label: 'Último cambio', hint: 'Por la fecha del último cambio: edición, cambio de estatus o autorización de circuitos',
    opciones: [
      { value: 'reciente', label: 'Nueva', hint: 'Arriba lo que cambió más recientemente' },
      { value: 'reciente_viejo', label: 'Vieja', hint: 'Arriba lo que lleva más tiempo sin cambios' },
    ],
  },
];

/** Lista plana (una entrada por orden) con etiqueta "Criterio · Sentido". */
export const ORDEN_RAPIDO_OPCIONES: { value: OrdenRapido; label: string; hint: string; campo: OrdenCampo; asc: boolean }[] =
  ORDEN_CRITERIOS.flatMap(c => c.opciones.map((o, i) => ({
    value: o.value, label: `${c.label} · ${o.label}`, hint: o.hint, campo: c.campo, asc: i === 1,
  })));

export function ordenCampo(orden: OrdenRapido): OrdenCampo {
  return ORDEN_RAPIDO_OPCIONES.find(o => o.value === orden)?.campo ?? 'creacion';
}
export function ordenEsAsc(orden: OrdenRapido): boolean {
  return ORDEN_RAPIDO_OPCIONES.find(o => o.value === orden)?.asc ?? false;
}
export function ordenLabel(orden: OrdenRapido): string {
  return ORDEN_RAPIDO_OPCIONES.find(o => o.value === orden)?.label ?? orden;
}

// Default FIJO del tablero: arriba el cambio mas reciente.
export const ORDEN_RAPIDO_DEFAULT: OrdenRapido = 'reciente';

// Default de la Vista Tabla. NO es 'reciente' a proposito: 'nueva_vieja'
// equivale al ORDER BY pr.id DESC / fecha DESC que ya hace el backend, asi que
// la tabla sigue paginando de 20 en 20 y la carga inicial no cambia de costo.
// Ordenar por ultimo cambio obliga a traer el universo completo para no
// ordenar solo la pagina visible, y eso no debe pagarse en cada visita.
export const ORDEN_RAPIDO_TABLA_DEFAULT: OrdenRapido = 'nueva_vieja';

/**
 * Foto de la barra de filtros de un modulo (estatus, periodo, historial,
 * agrupacion, filtros avanzados, busqueda...). JSON plano: cada pagina decide
 * que guarda y lo lee de vuelta con validacion (ver lib/filtrosGuardados).
 */
export type FiltrosDatos = Record<string, unknown>;

/**
 * Una vista guardada: columnas del tablero, orden, "solo incompletos" y la
 * foto de la barra de filtros. Aplica igual en Tabla, Desglose y Tablero (las
 * columnas solo se notan en el tablero).
 */
export interface VistaTablero {
  id: string;
  nombre: string;
  columnas: string[];
  orden: OrdenRapido;
  soloIncompletos: boolean;
  /** Ausente en vistas guardadas antes de que existiera: equivale a "sin filtros". */
  filtros?: FiltrosDatos;
  /**
   * Vista fija: se aplica sola cada vez que el usuario entra al tablero.
   * Como mucho una por modulo; marcar otra desmarca la anterior.
   */
  predeterminada?: boolean;
}

// ---------- Estatus ----------

/**
 * Normaliza un estatus para comparar columnas.
 *
 * Los estatus en BD están en caja y puntuación mixtas por capas históricas:
 * propuestas guarda 'Ajuste Cto-Cliente' y 'Pase a ventas', campañas guarda
 * 'Ajuste CTO Cliente' pero también 'por iniciar' y 'finalizada' en minúsculas.
 * Comparar el string crudo dejaría columnas vacías con datos dentro, así que
 * bajamos a minúsculas, quitamos acentos y colapsamos espacios/guiones:
 * 'Ajuste Cto-Cliente' y 'Ajuste CTO Cliente' caen en la misma clave.
 */
export function normalizaEstatus(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Mapa estatus-normalizado -> clave de columna, a partir de las columnas y sus alias. */
export function buildMapaColumnas(
  columnas: readonly { key: string; alias?: readonly string[] }[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  columnas.forEach(col => {
    mapa.set(normalizaEstatus(col.key), col.key);
    col.alias?.forEach(a => mapa.set(normalizaEstatus(a), col.key));
  });
  return mapa;
}

// ---------- Fechas ----------

// Las fechas llegan como ISO ('2026-10-20T18:30:00.000Z') o como datetime de
// MySQL ('2026-10-20 18:30:00'). El segundo formato no es parseable por
// `new Date` en Safari, así que lo normalizamos a ISO antes de parsear.
export function parseFechaMs(valor: string | Date | null | undefined): number | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    const t = valor.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const normalizado = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(valor) ? valor.replace(' ', 'T') : valor;
  const t = new Date(normalizado).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Ordena una copia de `items` según el orden rápido elegido.
 *
 * Los registros sin valor van siempre al final (en los dos sentidos): un nulo
 * no es "lo más viejo" ni "lo más barato", es un dato que falta, y colarlo
 * arriba en el sentido ascendente llenaría el tope con tarjetas sin dato.
 *
 * `getPresupuesto` es opcional: sin él, un orden por presupuesto deja la
 * lista como está (todo cuenta como "sin dato") en vez de fingir un orden.
 */
export function ordenarTablero<T>(
  items: T[],
  orden: OrdenRapido,
  getCreado: (item: T) => string | Date | null | undefined,
  getEditado: (item: T) => string | Date | null | undefined,
  getPresupuesto?: (item: T) => number | string | null | undefined,
): T[] {
  const campo = ordenCampo(orden);
  const asc = ordenEsAsc(orden);
  const valor = (item: T): number | null => {
    if (campo === 'presupuesto') {
      const raw = getPresupuesto?.(item);
      if (raw === null || raw === undefined || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    return parseFechaMs(campo === 'cambio' ? getEditado(item) : getCreado(item));
  };
  return [...items].sort((a, b) => {
    const ta = valor(a);
    const tb = valor(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return asc ? ta - tb : tb - ta;
  });
}

// ---------- "Último cambio": qué cambios cuentan ----------
//
// El orden 'reciente' pone arriba lo que cambió más recientemente. Por default
// cuenta CUALQUIER cambio (edición de datos, cambio de estatus y cambios de
// autorización de los circuitos). El usuario puede acotar qué cambios cuentan
// desde el popover del chip "Último cambio" (lista con buscador).
//
// Las fechas por estatus llegan del back en `item.cambios` (solo cuando el
// listado pide `includeCambios`): claves `estatus:<Estatus>` y `auth:<key>`.
// La edición de datos es `updated_at`.

export type CambioGrupo = 'edicion' | 'estatus' | 'autorizacion';

export interface CambioOpcion {
  key: string;
  label: string;
  grupo: CambioGrupo;
}

export const CAMBIO_EDICION_KEY = 'edicion';
export const CAMBIO_ESTATUS_PREFIX = 'estatus:';

/** Opciones del popover: edición + estatus de la entidad + autorización de circuitos. */
export function construirOpcionesCambio(estatus: readonly string[]): CambioOpcion[] {
  const out: CambioOpcion[] = [{ key: CAMBIO_EDICION_KEY, label: 'Edición de datos', grupo: 'edicion' }];
  const vistos = new Set<string>();
  estatus.forEach(s => {
    const n = normalizaEstatus(s);
    if (!n || vistos.has(n)) return;
    vistos.add(n);
    out.push({ key: `${CAMBIO_ESTATUS_PREFIX}${s}`, label: s, grupo: 'estatus' });
  });
  AUTORIZACION_OPCIONES.forEach(o => {
    out.push({ key: `${AUTORIZACION_PREFIX}${o.key}`, label: o.label, grupo: 'autorizacion' });
  });
  return out;
}

// Los estatus llegan del historial tal como se escribieron ('Pase a ventas',
// 'por iniciar'...): se comparan normalizados, igual que las columnas del tablero.
function normalizaClaveCambio(k: string): string {
  if (k.startsWith(CAMBIO_ESTATUS_PREFIX)) return `${CAMBIO_ESTATUS_PREFIX}${normalizaEstatus(k.slice(CAMBIO_ESTATUS_PREFIX.length))}`;
  return k;
}

/**
 * Fecha del último cambio del registro considerando solo los cambios en
 * `seleccion` (null = todos). Sin `cambios` del back, equivale a `updated_at`.
 */
export function fechaUltimoCambio(
  item: { updated_at?: string | null; cambios?: Record<string, string> | null },
  seleccion: readonly string[] | null,
): string | null {
  const todos = seleccion === null;
  const sel = todos ? null : new Set(seleccion.map(normalizaClaveCambio));
  let mejorMs: number | null = null;
  let mejor: string | null = null;
  const considerar = (v: string | null | undefined) => {
    const t = parseFechaMs(v);
    if (t !== null && (mejorMs === null || t > mejorMs)) { mejorMs = t; mejor = v ?? null; }
  };
  if (todos || sel!.has(CAMBIO_EDICION_KEY)) considerar(item.updated_at);
  if (item.cambios) {
    for (const [k, v] of Object.entries(item.cambios)) {
      if (todos || sel!.has(normalizaClaveCambio(k))) considerar(v);
    }
  }
  return mejor;
}

// ---------- Persistencia ----------

const STORAGE_PREFIX = 'qeb:tablero';

// La clave incluye el id de usuario para que dos cuentas en el mismo navegador
// no se pisen las vistas.
function storageKey(scope: TableroScope, userId: number | string | null | undefined): string {
  return `${STORAGE_PREFIX}:${scope}:v1:${userId ?? 'anon'}`;
}

export function esOrdenValido(v: unknown): v is OrdenRapido {
  return typeof v === 'string' && ORDEN_RAPIDO_OPCIONES.some(o => o.value === v);
}

/**
 * Lee las vistas guardadas. `columnasValidas` descarta columnas que ya no
 * existen (si mañana se renombra un estatus, la vista guardada no se rompe:
 * pierde esa columna y conserva el resto).
 */
export function loadVistas(
  scope: TableroScope,
  userId: number | string | null | undefined,
  columnasValidas: readonly string[],
): VistaTablero[] {
  try {
    const raw = localStorage.getItem(storageKey(scope, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validas = new Set(columnasValidas);
    return parsed.flatMap((v: unknown): VistaTablero[] => {
      if (!v || typeof v !== 'object') return [];
      const o = v as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.nombre !== 'string') return [];
      const columnas = Array.isArray(o.columnas)
        ? o.columnas.filter((c): c is string => typeof c === 'string' && validas.has(c))
        : [];
      if (columnas.length === 0) return [];
      return [{
        id: o.id,
        nombre: o.nombre,
        columnas,
        orden: esOrdenValido(o.orden) ? o.orden : ORDEN_RAPIDO_DEFAULT,
        soloIncompletos: o.soloIncompletos === true,
        filtros: o.filtros && typeof o.filtros === 'object' && !Array.isArray(o.filtros) ? (o.filtros as FiltrosDatos) : undefined,
        predeterminada: o.predeterminada === true,
      }];
    });
  } catch {
    return [];
  }
}

export function saveVistas(
  scope: TableroScope,
  userId: number | string | null | undefined,
  vistas: VistaTablero[],
): void {
  try {
    localStorage.setItem(storageKey(scope, userId), JSON.stringify(vistas));
  } catch {
    /* localStorage lleno o bloqueado: la vista se pierde al recargar, no rompe la sesión */
  }
}

export function nuevaVistaId(): string {
  return `vista-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
