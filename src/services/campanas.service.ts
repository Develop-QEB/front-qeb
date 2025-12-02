import api from '../lib/api';
import { Campana, CampanaStats, PaginatedResponse, ApiResponse } from '../types';

export interface CampanasParams {
  page?: number;
  limit?: number;
  status?: string;
}

export const campanasService = {
  async getAll(params: CampanasParams = {}): Promise<PaginatedResponse<Campana>> {
    const response = await api.get<PaginatedResponse<Campana>>('/campanas', { params });
    return response.data;
  },

  async getById(id: number): Promise<Campana> {
    const response = await api.get<ApiResponse<Campana>>(`/campanas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener campana');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string): Promise<Campana> {
    const response = await api.patch<ApiResponse<Campana>>(`/campanas/${id}/status`, { status });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async getStats(): Promise<CampanaStats> {
    const response = await api.get<ApiResponse<CampanaStats>>('/campanas/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },
};
