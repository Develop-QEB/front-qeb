import api from '../lib/api';
import { Propuesta, PropuestaStats, PaginatedResponse, ApiResponse } from '../types';

export interface PropuestasParams {
  page?: number;
  limit?: number;
  status?: string;
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
};
