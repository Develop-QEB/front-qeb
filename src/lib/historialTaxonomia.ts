// Espejo FRONT (solo lo necesario para el filtro embebido "tipo de acción") del
// eje CATEGORIAS de back/src/utils/historialTaxonomia.ts — "qué se hizo".
//
// La página global de Historial filtra por `categoria` que calcula el BACK por
// fila. Los historiales EMBEBIDOS (Solicitud/Propuesta/Campaña) reciben el array
// crudo (sin `categoria`), así que replicamos aquí el mismo clasificador para
// que el filtro "tipo de acción" use exactamente las mismas categorías.
//
// Mantener en sync con el back si cambian las reglas. El evaluador JS es idéntico
// (minúsculas + sin diacríticos, para emular la collation de MySQL). Las reglas
// de CATEGORIAS dependen SOLO del texto de `accion`.

type CampoPatron = 'tipo' | 'accion';
type OpPatron = 'equals' | 'startsWith' | 'contains';
interface Patron { campo: CampoPatron; op: OpPatron; valor: string; }
interface Regla { value: string; label: string; patrones: Patron[]; }

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const p = (campo: CampoPatron, op: OpPatron, valor: string): Patron => ({ campo, op, valor });
const conVariantes = (campo: CampoPatron, op: OpPatron, vs: string[]): Patron[] => {
  const todos = new Set<string>();
  for (const v of vs) { todos.add(v); todos.add(sinAcentos(v)); }
  return [...todos].map(v => p(campo, op, v));
};
const accionContiene = (...vs: string[]) => conVariantes('accion', 'contains', vs);
const accionEs = (...vs: string[]) => conVariantes('accion', 'equals', vs);

// Mismo ORDEN DE PRIORIDAD que el back (gana la primera regla que matchea).
export const CATEGORIAS: Regla[] = [
  { value: 'desposteo', label: 'Desposteo', patrones: accionContiene('desposteo') },
  { value: 'posteo', label: 'Posteo a SAP', patrones: accionContiene('post aps', 'post a sap', 'cancelar post') },
  { value: 'solicitud_autorizacion', label: 'Solicitud de autorización', patrones: accionContiene('solicitó autorización', 'solicito autorizacion') },
  { value: 'rechazo', label: 'Rechazo', patrones: accionContiene('echaz', 'devolvió para corrección', 'devolvio para correccion') },
  { value: 'liberacion', label: 'Liberación', patrones: [...accionContiene('iberaci', 'iberadas', 'iberados'), ...accionEs('Liberada')] },
  { value: 'cambio_estado', label: 'Cambio de estado', patrones: [...accionEs('Cambio de estado', 'Pasó a ventas', 'Vendida', 'Reservada', 'Atendida', 'Activación', 'Finalización'), ...accionContiene('cambió status', 'cambio status')] },
  { value: 'autorizacion', label: 'Autorización', patrones: accionContiene('probaci', 'probó', 'probo ', 'probada', 'probado', 'escalado') },
  { value: 'eliminacion', label: 'Eliminación', patrones: accionContiene('liminaci', 'liminó', 'limino ', 'emoci', 'emovió') },
  { value: 'creacion', label: 'Creación', patrones: [...accionContiene('reaci', 'creó', 'creo ', 'creada', 'creado', 'agregó', 'agrego ', 'adición', 'adicion'), ...accionEs('Inicio')] },
  { value: 'edicion', label: 'Edición', patrones: accionContiene('dici', 'ditó', 'edito ', 'editada', 'ctualiz', 'odific', 'cambió ', 'cambio de') },
  { value: 'asignacion', label: 'Asignación', patrones: accionContiene('signaci', 'signó', 'signo ', 'easign') },
  { value: 'comentario', label: 'Comentario', patrones: accionContiene('coment', 'espondió', 'espondio ') },
  { value: 'revision', label: 'Revisión', patrones: [...accionContiene('evisi'), ...accionEs('Validación', 'Rotación', 'Limpieza', 'Pendiente')] },
];

export const CATEGORIA_OTRA = { value: 'otro', label: 'Otro' };

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function patronMatchea(pat: Patron, tipo: string, accion: string): boolean {
  const campo = norm(pat.campo === 'tipo' ? tipo : accion);
  const valor = norm(pat.valor);
  switch (pat.op) {
    case 'equals': return campo === valor;
    case 'startsWith': return campo.startsWith(valor);
    case 'contains': return campo.includes(valor);
  }
  return false;
}

const reglaMatchea = (r: Regla, tipo: string, accion: string): boolean =>
  r.patrones.some(pat => patronMatchea(pat, tipo, accion));

/** Clasifica una fila del historial en su categoria ("qué se hizo"). */
export function categoriaDe(tipo?: string | null, accion?: string | null): { value: string; label: string } {
  const t = tipo ?? '';
  const a = accion ?? '';
  const r = CATEGORIAS.find(regla => reglaMatchea(regla, t, a));
  return r ? { value: r.value, label: r.label } : CATEGORIA_OTRA;
}
