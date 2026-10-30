import { AxiosError } from 'axios';
import api from '../lib/api';

// Extrae el `error` que devuelve el back en `{success:false, error:'...'}`
// cuando axios ya lanzó por status >=400. Cae al mensaje default si no lo hay.
function extractApiError(err: unknown, fallback: string): Error {
  if (err instanceof AxiosError) {
    const serverError = err.response?.data as { error?: string } | undefined;
    if (serverError?.error) return new Error(serverError.error);
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

// Estatus posibles de una prueba de color. Feedback Jos 2026-09-25:
// nuevo flujo con revisión de arte previa + tarea de seguimiento.
//   revision_artes → arte_aprobado → enviada_proveedor → aprobada
//                                                      ↘ rechazada
//   revision_artes → rechazada
// 'solicitada' se mantiene como valor de compat para pruebas viejas.
export type EstatusPruebaColor =
  | 'solicitada'
  | 'revision_artes'
  | 'arte_aprobado'
  | 'enviada_proveedor'
  | 'aprobada'
  | 'rechazada';

// Jos 2026-10-23: expansion a dos flujos coexistentes en la misma tabla.
//   'prueba_color'       -> flujo original (default).
//   'revision_anticipada'-> arte revisado antes de pisada; al aprobar vincula
//                           a biblioteca de artes con etiqueta "RA vN".
export type TipoPrueba = 'prueba_color' | 'revision_anticipada';

export interface PruebaColor {
  id: number;
  propuesta_id: number;
  sc_id: number;
  campania_id: number | null;
  reserva_id: number | null;
  archivo: string;
  archivo_data: string | null;
  // Jos 2026-10-12: link externo opcional. Puede coexistir con archivo.
  enlace_externo: string | null;
  nombre_arte: string | null;
  notas: string | null;
  estatus: EstatusPruebaColor;
  // Jos 2026-10-23: opcional porque los registros creados antes de la
  // migracion no tienen el campo. Si falta, trata como 'prueba_color'.
  tipo?: TipoPrueba | null;
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
  enlace_externo?: string | null;
  nombre_arte?: string | null;
  notas?: string | null;
  tipo?: TipoPrueba;
}

export interface ListarPruebaColorParams {
  propuesta_id?: number;
  campania_id?: number;
  sc_id?: number;
  tipo?: TipoPrueba;
}

// Tarea asociada a una prueba de color (Revisión de artes / Seguimiento).
export interface TareaAsociadaPruebaColor {
  id: number;
  tipo: string | null;
  titulo: string | null;
  descripcion: string | null;
  estatus: string | null;
  asignado: string | null;
  responsable: string | null;
  archivo: string | null;
  contenido: string | null;
  // JSON string con la resolucion: motivoRechazo | comentarioResolucion,
  // resueltaPor, resueltaPorId, resueltaAt. Se lee en el modal para
  // mostrar quien y por que atendio la tarea cuando ya no esta Pendiente.
  evidencia: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export type AccionResolverTarea = 'aprobar' | 'rechazar' | 'finalizar';

export const pruebasColorService = {
  async listar(params: ListarPruebaColorParams): Promise<PruebaColor[]> {
    try {
      const query = new URLSearchParams();
      if (params.propuesta_id) query.set('propuesta_id', String(params.propuesta_id));
      if (params.campania_id) query.set('campania_id', String(params.campania_id));
      if (params.sc_id) query.set('sc_id', String(params.sc_id));
      if (params.tipo) query.set('tipo', params.tipo);
      const { data } = await api.get(`/pruebas-color?${query.toString()}`);
      if (!data.success) throw new Error(data.error || 'Error al listar pruebas de color');
      return data.data as PruebaColor[];
    } catch (err) {
      throw extractApiError(err, 'Error al listar pruebas de color');
    }
  },

  async crear(input: CrearPruebaColorInput): Promise<PruebaColor> {
    try {
      const { data } = await api.post('/pruebas-color', input);
      if (!data.success) throw new Error(data.error || 'Error al crear prueba de color');
      return data.data as PruebaColor;
    } catch (err) {
      throw extractApiError(err, 'Error al crear prueba de color');
    }
  },

  async actualizarEstatus(id: number, estatus: EstatusPruebaColor): Promise<PruebaColor> {
    try {
      const { data } = await api.patch(`/pruebas-color/${id}/estatus`, { estatus });
      if (!data.success) throw new Error(data.error || 'Error al actualizar estatus');
      return data.data as PruebaColor;
    } catch (err) {
      throw extractApiError(err, 'Error al actualizar estatus');
    }
  },

  async eliminar(id: number): Promise<void> {
    try {
      const { data } = await api.delete(`/pruebas-color/${id}`);
      if (!data.success) throw new Error(data.error || 'Error al eliminar prueba de color');
    } catch (err) {
      throw extractApiError(err, 'Error al eliminar prueba de color');
    }
  },

  // Lista las tareas asociadas a una prueba (Revisión / Seguimiento).
  // Feedback Jos 2026-10-02: se consumen desde la ventana del modal.
  async listarTareas(pruebaId: number): Promise<TareaAsociadaPruebaColor[]> {
    try {
      const { data } = await api.get(`/pruebas-color/${pruebaId}/tareas`);
      if (!data.success) throw new Error(data.error || 'Error al listar tareas asociadas');
      return data.data as TareaAsociadaPruebaColor[];
    } catch (err) {
      throw extractApiError(err, 'Error al listar tareas asociadas');
    }
  },

  // Resuelve una tarea asociada (aprobar / rechazar / finalizar) desde el modal.
  async resolverTarea(
    pruebaId: number,
    tareaId: number,
    accion: AccionResolverTarea,
    comentario?: string,
    adjuntos?: { archivo_adjunto?: string | null; enlace_adjunto?: string | null },
  ): Promise<void> {
    try {
      const { data } = await api.patch(`/pruebas-color/${pruebaId}/tareas/${tareaId}`, {
        accion,
        comentario,
        archivo_adjunto: adjuntos?.archivo_adjunto || null,
        enlace_adjunto: adjuntos?.enlace_adjunto || null,
      });
      if (!data.success) throw new Error(data.error || 'Error al resolver tarea');
    } catch (err) {
      throw extractApiError(err, 'Error al resolver tarea');
    }
  },

  // Reenviar una prueba rechazada — edita en sitio sobre la misma prueba
  // (archivo, nombre_arte, notas) y la vuelve a 'revision_artes'. Jos
  // 2026-10-12. El back crea nueva tarea de Revisión para los reviewers.
  async reenviar(pruebaId: number, payload: { archivo: string; archivo_data?: string | null; enlace_externo?: string | null; nombre_arte?: string; notas?: string }): Promise<PruebaColor> {
    try {
      const { data } = await api.post(`/pruebas-color/${pruebaId}/reenviar`, payload);
      if (!data.success) throw new Error(data.error || 'Error al reenviar prueba');
      return data.data as PruebaColor;
    } catch (err) {
      throw extractApiError(err, 'Error al reenviar prueba');
    }
  },
};

// Etiquetas legibles para el UI.
export const ESTATUS_LABEL: Record<EstatusPruebaColor, string> = {
  solicitada: 'Revisión de artes',
  revision_artes: 'Revisión de artes',
  arte_aprobado: 'Arte aprobado',
  enviada_proveedor: 'Enviada al proveedor',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

// Transiciones validas por estatus actual (mismo criterio que el back).
// solicitada se conserva como sinonimo de revision_artes (datos viejos).
// La transicion a 'aprobada' desde arte_aprobado/enviada_proveedor la
// hace normalmente el analista al finalizar la tarea Seguimiento.
export const TRANSICIONES: Record<EstatusPruebaColor, EstatusPruebaColor[]> = {
  solicitada: ['arte_aprobado', 'enviada_proveedor', 'aprobada', 'rechazada'],
  revision_artes: ['arte_aprobado', 'rechazada'],
  arte_aprobado: ['enviada_proveedor', 'aprobada', 'rechazada'],
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
  'Analista de Servicio al Cliente',
  'Administrador',
  'DEV',
]);

// Feature flag: Jos dio luz verde 2026-09-25 para activar en stage/dev
// (presentacion en junta). Cambiar a true si hay que ocultar de nuevo.
const PRUEBA_COLOR_OCULTA = false;

export function puedeGestionarPruebaColor(rol: string | null | undefined): boolean {
  if (PRUEBA_COLOR_OCULTA) return false;
  return !!rol && ROLES_PRUEBA_COLOR.has(rol);
}

// Jos 2026-10-12: permisos separados.
// CREAR / SOLICITAR / REENVIAR / FINALIZAR seguimiento: solo analistas y admins.
const ROLES_CREAR_PRUEBA_COLOR = new Set<string>([
  'Analista de Servicio al Cliente',
  'Administrador',
  'DEV',
]);
// APROBAR / RECHAZAR tarea de Revisión: solo area de Diseño.
const ROLES_REVISAR_PRUEBA_COLOR = new Set<string>([
  'Coordinador de Diseño',
  'Coordinador de Diseno',
  'Diseñador',
  'Diseñadores',
  'Administrador',
  'DEV',
]);
export function puedeCrearPruebaColor(rol: string | null | undefined): boolean {
  if (PRUEBA_COLOR_OCULTA) return false;
  return !!rol && ROLES_CREAR_PRUEBA_COLOR.has(rol);
}
export function puedeRevisarPruebaColor(rol: string | null | undefined): boolean {
  if (PRUEBA_COLOR_OCULTA) return false;
  return !!rol && ROLES_REVISAR_PRUEBA_COLOR.has(rol);
}
