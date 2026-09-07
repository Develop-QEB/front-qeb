import api from '../lib/api';
import { Notificacion, NotificacionStats, PaginatedResponse, ApiResponse, ComentarioTarea } from '../types';

export interface NotificacionesParams {
  page?: number;
  limit?: number;
  tipo?: string;
  estatus?: string;
  leida?: boolean;
  search?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  /**
   * Pestaña de /notificaciones. El back aplica el MISMO criterio de destinatario
   * que el badge de la campanita, de modo que el `total` que regresa es el conteo
   * real y no depende de cuántas filas alcance a bajar el `limit`.
   */
  vista?: 'notificaciones' | 'tareas';
  /** Filtro rápido resuelto en servidor: 'pendientes' | 'finalizadas' | 'no_leidas' | 'leidas' */
  quick?: string;
}

export interface CreateTareaParams {
  titulo: string;
  descripcion?: string;
  tipo?: string;
  fecha_fin?: string;
  id_responsable?: number;
  responsable?: string;
  asignado?: string;
  id_asignado?: string;
  id_solicitud?: string;
  id_propuesta?: string;
  campania_id?: number;
}

export interface UpdateTareaParams {
  titulo?: string;
  descripcion?: string;
  tipo?: string;
  estatus?: string;
  fecha_fin?: string;
  asignado?: string;
  id_asignado?: string;
  archivo?: string;
  evidencia?: string;
}

// ==================== PREFERENCIAS DE NOTIFICACIONES ====================

export interface PreferenciasMatrizCanal {
  master: boolean;
  masterNotificacion: boolean;
  masterTarea: boolean;
  notificacion: Record<string, boolean>;
  tarea: Record<string, boolean>;
}

export interface PreferenciasNotif {
  popup: PreferenciasMatrizCanal;
  email: PreferenciasMatrizCanal;
}

export interface CatalogoItem {
  clave: string;
  label: string;
  /** false = este tipo no envía correo → se oculta su toggle de correo. */
  email?: boolean;
}

export interface CatalogoNotif {
  notificacion: CatalogoItem[];
  tarea: CatalogoItem[];
}

export interface PreferenciaUpdateItem {
  canal: 'popup' | 'email';
  clase: 'notificacion' | 'tarea' | '__global__';
  clave: string;
  habilitado: boolean;
}

export const notificacionesService = {
  async getAll(params: NotificacionesParams = {}): Promise<PaginatedResponse<Notificacion>> {
    const response = await api.get<PaginatedResponse<Notificacion>>('/notificaciones', { params });
    return response.data;
  },

  async getById(id: number): Promise<Notificacion & { comentarios?: ComentarioTarea[] }> {
    const response = await api.get<ApiResponse<Notificacion & { comentarios?: ComentarioTarea[] }>>(`/notificaciones/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener notificación');
    }
    return response.data.data;
  },

  async create(params: CreateTareaParams): Promise<Notificacion> {
    const response = await api.post<ApiResponse<Notificacion>>('/notificaciones', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear tarea');
    }
    return response.data.data;
  },

  async update(id: number, params: UpdateTareaParams): Promise<Notificacion> {
    const response = await api.patch<ApiResponse<Notificacion>>(`/notificaciones/${id}`, params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar tarea');
    }
    return response.data.data;
  },

  async marcarLeida(id: number): Promise<Notificacion> {
    const response = await api.patch<ApiResponse<Notificacion>>(`/notificaciones/${id}/leer`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al marcar notificación como leída');
    }
    return response.data.data;
  },

  async marcarTodasLeidas(): Promise<void> {
    const response = await api.patch<ApiResponse<null>>('/notificaciones/leer-todas');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al marcar todas las notificaciones como leídas');
    }
  },

  // Bulk update de estatus: una sola request al back en lugar de N paralelas.
  async bulkUpdateEstatus(ids: number[], estatus: string): Promise<{ affected: number }> {
    const response = await api.patch<ApiResponse<{ affected: number }>>(
      '/notificaciones/bulk-estatus',
      { ids, estatus }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error en bulk update');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/notificaciones/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar notificación');
    }
  },

  async getStats(): Promise<NotificacionStats> {
    const response = await api.get<ApiResponse<NotificacionStats>>('/notificaciones/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadísticas');
    }
    return response.data.data;
  },

  async getComments(id: number): Promise<ComentarioTarea[]> {
    const response = await api.get<ApiResponse<ComentarioTarea[]>>(`/notificaciones/${id}/comentarios`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener comentarios');
    }
    return response.data.data;
  },

  async addComment(id: number, contenido: string): Promise<ComentarioTarea> {
    const response = await api.post<ApiResponse<ComentarioTarea>>(`/notificaciones/${id}/comentarios`, { contenido });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
    return response.data.data;
  },

  // ==================== AUTORIZACIÓN ====================

  async getResumenAutorizacion(idquote: string): Promise<ResumenAutorizacion> {
    const response = await api.get<ApiResponse<ResumenAutorizacion>>(`/notificaciones/autorizacion/${idquote}/resumen`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener resumen de autorización');
    }
    return response.data.data;
  },

  async getCarasAutorizacion(idquote: string): Promise<CaraAutorizacion[]> {
    const response = await api.get<ApiResponse<CaraAutorizacion[]>>(`/notificaciones/autorizacion/${idquote}/caras`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener caras de autorización');
    }
    return response.data.data;
  },

  async aprobarAutorizacion(idquote: string, tipo: 'dg' | 'dcm'): Promise<{ carasAprobadas: number }> {
    const response = await api.post<ApiResponse<{ carasAprobadas: number }>>(`/notificaciones/autorizacion/${idquote}/aprobar/${tipo}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al aprobar autorización');
    }
    return response.data.data;
  },

  async rechazarAutorizacion(idquote: string, comentario: string): Promise<void> {
    const response = await api.post<ApiResponse<null>>(`/notificaciones/autorizacion/${idquote}/rechazar`, { comentario });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al rechazar solicitud');
    }
  },

  // Autorización de ELIMINACIÓN de circuitos (por tareaId, solo campañas).
  // Aprobar: si es Filtro → pasa a DG; si es DG → ejecuta el borrado real.
  // Rechazar: no borra, guarda el motivo.
  async aprobarEliminacion(tareaId: number, comentario?: string): Promise<{ accion: string; eliminadas?: number }> {
    const response = await api.post<ApiResponse<{ accion: string; eliminadas?: number }>>(`/notificaciones/autorizacion/eliminacion/${tareaId}/aprobar`, { comentario });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al aprobar eliminación');
    }
    return response.data.data || { accion: 'ok' };
  },

  async rechazarEliminacion(tareaId: number, motivo: string): Promise<void> {
    const response = await api.post<ApiResponse<null>>(`/notificaciones/autorizacion/eliminacion/${tareaId}/rechazar`, { motivo });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al rechazar eliminación');
    }
  },

  async getHistorialAutorizacion(idquote: string): Promise<HistorialAutorizacion[]> {
    const response = await api.get<ApiResponse<HistorialAutorizacion[]>>(`/notificaciones/autorizacion/${idquote}/historial`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener historial');
    }
    return response.data.data;
  },

  // Filtro DG (Gerente Comercial VP/Plazas) — paso previo a Autorización DG.
  // Feedback 2026-08-15: aprobar acepta comentario opcional. Si viene con
  // texto, el back crea una tarea 'Notificación' al asesor con el comentario.
  async aprobarFiltroDg(tareaId: number, comentario?: string): Promise<{ tareaDgId: number; tareaNotifAsesorId: number | null }> {
    const response = await api.post<ApiResponse<{ tareaDgId: number; tareaNotifAsesorId: number | null }>>(`/solicitudes/filtro-dg/${tareaId}/aprobar`, { comentario });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al aprobar filtro DG');
    }
    return response.data.data;
  },

  async rechazarFiltroDg(tareaId: number, motivo: string): Promise<{ tareaCorreccionId: number }> {
    const response = await api.post<ApiResponse<{ tareaCorreccionId: number }>>(`/solicitudes/filtro-dg/${tareaId}/rechazar`, { motivo });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al rechazar filtro DG');
    }
    return response.data.data;
  },

  // Filtro DCM (Gerente Comercial Aeropuerto) — espejo del filtro DG para
  // la dimensión DCM. Feedback 2026-08-15.
  async aprobarFiltroDcm(tareaId: number, comentario?: string): Promise<{ tareaDcmId: number; tareaNotifAsesorId: number | null }> {
    const response = await api.post<ApiResponse<{ tareaDcmId: number; tareaNotifAsesorId: number | null }>>(`/solicitudes/filtro-dcm/${tareaId}/aprobar`, { comentario });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al aprobar filtro DCM');
    }
    return response.data.data;
  },

  async rechazarFiltroDcm(tareaId: number, motivo: string): Promise<{ tareaCorreccionId: number }> {
    const response = await api.post<ApiResponse<{ tareaCorreccionId: number }>>(`/solicitudes/filtro-dcm/${tareaId}/rechazar`, { motivo });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al rechazar filtro DCM');
    }
    return response.data.data;
  },

  // ==================== PREFERENCIAS ====================

  async getPreferencias(): Promise<{ preferencias: PreferenciasNotif; catalogo: CatalogoNotif }> {
    const response = await api.get<ApiResponse<{ preferencias: PreferenciasNotif; catalogo: CatalogoNotif }>>(
      '/notificaciones/preferencias'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener preferencias');
    }
    return response.data.data;
  },

  async updatePreferencias(items: PreferenciaUpdateItem[]): Promise<{ preferencias: PreferenciasNotif }> {
    const response = await api.put<ApiResponse<{ preferencias: PreferenciasNotif }>>(
      '/notificaciones/preferencias',
      { items }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al guardar preferencias');
    }
    return response.data.data;
  },

  // ==================== ACTIVIDAD COMERCIAL ====================

  async getCampanasParaActividad(search?: string): Promise<ActividadRef[]> {
    const response = await api.get<ApiResponse<ActividadRefCampana[]>>(
      '/notificaciones/actividad-comercial/campanas',
      { params: search ? { search } : undefined }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener campañas');
    }
    return response.data.data.map(c => ({
      id: c.id,
      label: `#${c.id} — ${c.nombre}`,
      cliente: c.cliente,
      marca: c.marca,
      status: c.status,
    }));
  },

  async getPropuestasParaActividad(search?: string): Promise<ActividadRef[]> {
    const response = await api.get<ApiResponse<ActividadRefPropuesta[]>>(
      '/notificaciones/actividad-comercial/propuestas',
      { params: search ? { search } : undefined }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener propuestas');
    }
    return response.data.data.map(p => ({
      id: p.id,
      label: `#${p.id}${p.cliente ? ' — ' + p.cliente : ''}`,
      cliente: p.cliente,
      marca: p.marca,
      status: p.status,
    }));
  },

  async crearActividadComercial(payload: CrearActividadComercialInput): Promise<ActividadComercialCreated> {
    const response = await api.post<ApiResponse<ActividadComercialCreated>>(
      '/notificaciones/actividad-comercial',
      payload
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear actividad comercial');
    }
    return response.data.data;
  },
};

// ==================== TIPOS ACTIVIDAD COMERCIAL ====================

export type ActividadSubtipo = 'Campaña' | 'Propuesta' | 'Lead';

export interface ActividadRefCampana {
  id: number;
  nombre: string;
  status: string;
  cliente: string | null;
  marca: string | null;
}

export interface ActividadRefPropuesta {
  id: number;
  status: string;
  cliente: string | null;
  marca: string | null;
}

export interface ActividadRef {
  id: number;
  label: string;
  cliente: string | null;
  marca: string | null;
  status: string;
}

export interface CrearActividadComercialInput {
  // Campaña/Propuesta opcional (feedback Jos 2026-07-31). Si el usuario no
  // seleccionó nada, se omiten subtipo y ref_id.
  subtipo?: ActividadSubtipo;
  ref_id?: number;
  // Cliente y marca son campos independientes que el usuario puede escribir a
  // mano o dejar en blanco. Si vienen del payload, mandan sobre lo que el back
  // pudiera derivar del ref_id.
  cliente?: string;
  marca?: string;
  descripcion: string;
  fecha_fin?: string;
  activar_recordatorio?: boolean;
  recordar_dias_antes?: number;
  // Ajuste feedback 2026-08-15: campos manuales que clasifican la actividad.
  // Todos opcionales para no romper el submit sin ellos.
  anio?: number;                        // Año
  catorcena?: number;                   // Periodo (1..26)
  estatus_actividad?: 'Abierto' | 'Cerrado';
  base?: 'CIMU' | 'TRADE';              // Base SAP
}

export interface ActividadComercialCreated {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  categoria: string;
  estatus: string;
  fecha_creacion: string;
  fecha_fin: string;
  responsable: string;
  asignado: string;
  cliente: string | null;
  marca: string | null;
  // Opcionales: pueden venir null si no se seleccionó campaña/propuesta.
  subtipo: ActividadSubtipo | null;
  ref_id: number | null;
}

// Tipos de autorización
export interface ResumenAutorizacion {
  totalCaras: number;
  aprobadas: number;
  pendientesDg: number;
  pendientesDcm: number;
  rechazadas: number;
  puedeContinuar: boolean;
}

export interface HistorialAutorizacion {
  id: number;
  tipo: string;
  accion: string;
  fecha: string;
  detalles: any;
}

export interface CaraAutorizacion {
  id: number;
  clave: string;
  ciudad: string;
  estados?: string;
  formato: string;
  tipo: string;
  caras: number;
  bonificacion: number;
  costo: number;
  tarifa_publica: number;
  autorizacion_dg: string;
  autorizacion_dcm: string;
  total_caras: number;
  tarifa_efectiva: number;
  articulo?: string;
  cliente?: string;
  campana?: string;
  catorcena?: string;
  fin_periodo?: string;
  inicio_periodo?: string;
  asesor?: string;
}
