import api from '../lib/api';

// Estatus posibles de una prueba de color.
// Transiciones: solicitada -> enviada_proveedor -> aprobada | rechazada.
// aprobada y rechazada son terminales — para una nueva iteracion se crea
// otra prueba con version incrementada (el back lo maneja automatico).
export type EstatusPruebaColor = 'solicitada' | 'enviada_proveedor' | 'aprobada' | 'rechazada';

export interface PruebaColor {
  id: number;
  propuesta_id: number;
  sc_id: number;
  campania_id: number | null;
  reserva_id: number | null;
  archivo: string;
  archivo_data: string | null;
  nombre_arte: string | null;
  notas: string | null;
  estatus: EstatusPruebaColor;
  version: number;
  created_by: number;
  created_by_nombre: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CrearPruebaColorInput {
  propuesta_id: number;
  sc_id: number;
  archivo: string;
  archivo_data?: string | null;
  nombre_arte?: string | null;
  notas?: string | null;
}

export interface ListarPruebaColorParams {
  propuesta_id?: number;
  campania_id?: number;
  sc_id?: number;
}

export const pruebasColorService = {
  async listar(params: ListarPruebaColorParams): Promise<PruebaColor[]> {
    const query = new URLSearchParams();
    if (params.propuesta_id) query.set('propuesta_id', String(params.propuesta_id));
    if (params.campania_id) query.set('campania_id', String(params.campania_id));
    if (params.sc_id) query.set('sc_id', String(params.sc_id));
    const { data } = await api.get(`/pruebas-color?${query.toString()}`);
    if (!data.success) throw new Error(data.error || 'Error al listar pruebas de color');
    return data.data as PruebaColor[];
  },

  async crear(input: CrearPruebaColorInput): Promise<PruebaColor> {
    const { data } = await api.post('/pruebas-color', input);
    if (!data.success) throw new Error(data.error || 'Error al crear prueba de color');
    return data.data as PruebaColor;
  },

  async actualizarEstatus(id: number, estatus: EstatusPruebaColor): Promise<PruebaColor> {
    const { data } = await api.patch(`/pruebas-color/${id}/estatus`, { estatus });
    if (!data.success) throw new Error(data.error || 'Error al actualizar estatus');
    return data.data as PruebaColor;
  },

  async eliminar(id: number): Promise<void> {
    const { data } = await api.delete(`/pruebas-color/${id}`);
    if (!data.success) throw new Error(data.error || 'Error al eliminar prueba de color');
  },
};

// Etiquetas legibles para el UI.
export const ESTATUS_LABEL: Record<EstatusPruebaColor, string> = {
  solicitada: 'Solicitada',
  enviada_proveedor: 'Enviada al proveedor',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

// Transiciones validas por estatus actual (mismo criterio que el back).
export const TRANSICIONES: Record<EstatusPruebaColor, EstatusPruebaColor[]> = {
  solicitada: ['enviada_proveedor', 'aprobada', 'rechazada'],
  enviada_proveedor: ['aprobada', 'rechazada'],
  aprobada: [],
  rechazada: [],
};

// Roles con permiso para crear / cambiar estatus de una prueba de color.
// Debe estar sincronizado con ROLES_PRUEBA_COLOR del back
// (services/pruebasColor.service.ts).
const ROLES_PRUEBA_COLOR = new Set<string>([
  'Coordinador de Diseño',
  'Coordinador de Diseno',
  'Diseñador',
  'Diseñadores',
  'Encargado de Producción',
  'Coordinador de Producción',
  'Producción',
  'Asesor Comercial',
  'Asesor Comercial Aeropuerto',
  'Administrador',
  'DEV',
]);

// Feature flag: mientras Jos no de luz verde para el rollout, todos los
// botones de "Prueba de color" quedan ocultos. Se cambia a false para
// re-habilitar sin tocar los puntos de entrada (PropuestasPage, CampanasPage,
// TareaSeguimientoPage) — los 3 dependen de este helper.
const PRUEBA_COLOR_OCULTA = true;

export function puedeGestionarPruebaColor(rol: string | null | undefined): boolean {
  if (PRUEBA_COLOR_OCULTA) return false;
  return !!rol && ROLES_PRUEBA_COLOR.has(rol);
}
