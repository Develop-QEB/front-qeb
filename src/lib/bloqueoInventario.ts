// Bloqueo administrativo del inventario (inventarios.estatus).
//
// Dos clasificaciones que se comportan IGUAL para efectos de ocupación: la pieza
// no se puede utilizar/reservar y al aplicarse se liberan sus reservas
// actuales/futuras. Solo cambia la etiqueta. Espejo de
// ESTATUS_INVENTARIO_BLOQUEO en qeb-Back (inventario-bloqueo.service.ts).

export const TIPOS_BLOQUEO_INVENTARIO = ['Bloqueado', 'Inhabilitado'] as const;
export type TipoBloqueoInventario = (typeof TIPOS_BLOQUEO_INVENTARIO)[number];

export const TIPO_BLOQUEO_DEFAULT: TipoBloqueoInventario = 'Bloqueado';

/** ¿El inventario está bloqueado administrativamente (Bloqueado o Inhabilitado)? */
export function esInventarioBloqueado(estatus: string | null | undefined): boolean {
  return !!estatus && (TIPOS_BLOQUEO_INVENTARIO as readonly string[]).includes(estatus);
}

// Textos por clasificación, para no regar ternarios por los modales.
export const TIPO_BLOQUEO_TEXTOS: Record<TipoBloqueoInventario, {
  opcion: string;       // etiqueta del selector
  descripcion: string;  // ayuda bajo la etiqueta
  infinitivo: string;   // "Bloquear inventario"
  gerundio: string;     // "Bloqueando..."
  participio: string;   // "Bloqueado por: ..."
  sustantivo: string;   // "Fecha de bloqueo"
  revertir: string;     // "Desbloquear"
}> = {
  Bloqueado: {
    opcion: 'Bloqueo',
    descripcion: 'La pieza queda bloqueada y no se puede ocupar.',
    infinitivo: 'Bloquear',
    gerundio: 'Bloqueando',
    participio: 'Bloqueado',
    sustantivo: 'bloqueo',
    revertir: 'Desbloquear',
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
