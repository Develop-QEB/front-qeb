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

export const TIPOS_BLOQUEO_INVENTARIO = ['No Disponible', 'Inhabilitado'] as const;
export type TipoBloqueoInventario = (typeof TIPOS_BLOQUEO_INVENTARIO)[number];

export const TIPO_BLOQUEO_DEFAULT: TipoBloqueoInventario = 'No Disponible';

// Valores de estatus que cuentan como bloqueo (seleccionables + legacy).
const ESTATUS_BLOQUEO_RECONOCIDOS = [...TIPOS_BLOQUEO_INVENTARIO, 'Bloqueado'] as const;

/** ¿El inventario está bloqueado administrativamente (No Disponible, Bloqueado legacy o Inhabilitado)? */
export function esInventarioBloqueado(estatus: string | null | undefined): boolean {
  return !!estatus && (ESTATUS_BLOQUEO_RECONOCIDOS as readonly string[]).includes(estatus);
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
