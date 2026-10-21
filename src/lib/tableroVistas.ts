// Vistas de Tablero (Propuestas / Campañas): orden rápido, filtro de
// incompletos y vistas guardadas por usuario.
//
// Las vistas viven en localStorage y se guardan por usuario + módulo, con el
// mismo criterio que las agrupaciones del Desglose (ver
// PropuestasVersionarioView): es configuración de UI, no dato de negocio, y no
// justifica tabla ni endpoints. Contra conocido: no siguen al usuario si
// cambia de navegador o de equipo.

export type TableroScope = 'propuestas' | 'campanas';

// Orden de las tarjetas dentro de cada columna.
//
// 'reciente' es el default FIJO del tablero: arriba lo que cambió de estatus
// (o se editó) más recientemente, que es lo que el tablero debe responder de
// un vistazo. Los otros dos ordenan por fecha de creación.
export type OrdenRapido = 'reciente' | 'nueva_vieja' | 'vieja_nueva';

export const ORDEN_RAPIDO_OPCIONES: { value: OrdenRapido; label: string; hint: string }[] = [
  { value: 'reciente', label: 'Último cambio', hint: 'Arriba lo que cambió de estatus o se editó más recientemente' },
  { value: 'nueva_vieja', label: 'Más nueva', hint: 'De la más nueva a la más vieja (fecha de creación)' },
  { value: 'vieja_nueva', label: 'Más vieja', hint: 'De la más vieja a la más nueva (fecha de creación)' },
];

// Default FIJO del tablero: arriba el cambio mas reciente.
export const ORDEN_RAPIDO_DEFAULT: OrdenRapido = 'reciente';

// Default de la Vista Tabla. NO es 'reciente' a proposito: 'nueva_vieja'
// equivale al ORDER BY pr.id DESC / fecha DESC que ya hace el backend, asi que
// la tabla sigue paginando de 20 en 20 y la carga inicial no cambia de costo.
// Ordenar por ultimo cambio obliga a traer el universo completo para no
// ordenar solo la pagina visible, y eso no debe pagarse en cada visita.
export const ORDEN_RAPIDO_TABLA_DEFAULT: OrdenRapido = 'nueva_vieja';

/** Una vista guardada: qué columnas ver y con qué orden/filtro. */
export interface VistaTablero {
  id: string;
  nombre: string;
  columnas: string[];
  orden: OrdenRapido;
  soloIncompletos: boolean;
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
 * Los registros sin fecha van siempre al final (en los dos sentidos): un nulo
 * no es "lo más viejo", es un dato que falta, y colarlo arriba en 'vieja_nueva'
 * llenaría el tope de la columna con tarjetas sin fecha.
 */
export function ordenarTablero<T>(
  items: T[],
  orden: OrdenRapido,
  getCreado: (item: T) => string | Date | null | undefined,
  getEditado: (item: T) => string | Date | null | undefined,
): T[] {
  const get = orden === 'reciente' ? getEditado : getCreado;
  const asc = orden === 'vieja_nueva';
  return [...items].sort((a, b) => {
    const ta = parseFechaMs(get(a));
    const tb = parseFechaMs(get(b));
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return asc ? ta - tb : tb - ta;
  });
}

// ---------- Persistencia ----------

const STORAGE_PREFIX = 'qeb:tablero';

// La clave incluye el id de usuario para que dos cuentas en el mismo navegador
// no se pisen las vistas.
function storageKey(scope: TableroScope, userId: number | string | null | undefined): string {
  return `${STORAGE_PREFIX}:${scope}:v1:${userId ?? 'anon'}`;
}

function esOrdenValido(v: unknown): v is OrdenRapido {
  return v === 'reciente' || v === 'nueva_vieja' || v === 'vieja_nueva';
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
