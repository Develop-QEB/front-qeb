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
}

export interface CreateTareaParams {
  titulo: string;
  descripcion?: string;
  tipo?: string;
  fecha_fin?: string;
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
};
