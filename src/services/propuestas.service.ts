import api from '../lib/api';
import { Propuesta, PaginatedResponse, ApiResponse } from '../types';

export interface PropuestasParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
}

export interface PropuestaStats {
  total: number;
  byStatus: Record<string, number>;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

export interface PropuestaComentario {
  id: number;
  comentario: string;
  creado_en: string;
  autor_nombre: string;
}

export interface ApproveParams {
  precio_simulado?: number;
  asignados?: string;
  id_asignados?: string;
}

export const propuestasService = {
  async getAll(params: PropuestasParams = {}): Promise<PaginatedResponse<Propuesta>> {
    const response = await api.get<PaginatedResponse<Propuesta>>('/propuestas', { params });
    return response.data;
  },

  async getById(id: number): Promise<Propuesta> {
    const response = await api.get<ApiResponse<Propuesta>>(`/propuestas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener propuesta');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string, comentario_cambio_status?: string): Promise<Propuesta> {
    const response = await api.patch<ApiResponse<Propuesta>>(`/propuestas/${id}/status`, {
      status,
      comentario_cambio_status
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async getStats(): Promise<PropuestaStats> {
    const response = await api.get<ApiResponse<PropuestaStats>>('/propuestas/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getComments(id: number): Promise<PropuestaComentario[]> {
    const response = await api.get<ApiResponse<PropuestaComentario[]>>(`/propuestas/${id}/comments`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al obtener comentarios');
    }
    return response.data.data || [];
  },

  async addComment(id: number, comentario: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/propuestas/${id}/comments`, { comentario });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
  },

  async approve(id: number, params: ApproveParams): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/propuestas/${id}/approve`, params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al aprobar propuesta');
    }
  },
};
