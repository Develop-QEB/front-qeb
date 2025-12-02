import api from '../lib/api';
import { Solicitud, SolicitudStats, PaginatedResponse, ApiResponse, Catorcena } from '../types';

export interface SolicitudesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  groupBy?: string;
}

export interface CatorcenasResponse {
  success: boolean;
  data: Catorcena[];
  years: number[];
}

export const solicitudesService = {
  async getAll(params: SolicitudesParams = {}): Promise<PaginatedResponse<Solicitud>> {
    const response = await api.get<PaginatedResponse<Solicitud>>('/solicitudes', { params });
    return response.data;
  },

  async getById(id: number): Promise<Solicitud> {
    const response = await api.get<ApiResponse<Solicitud>>(`/solicitudes/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener solicitud');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string): Promise<Solicitud> {
    const response = await api.patch<ApiResponse<Solicitud>>(`/solicitudes/${id}/status`, { status });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/solicitudes/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar solicitud');
    }
  },

  async getStats(params: { yearInicio?: number; yearFin?: number; catorcenaInicio?: number; catorcenaFin?: number } = {}): Promise<SolicitudStats> {
    const response = await api.get<ApiResponse<SolicitudStats>>('/solicitudes/stats', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getCatorcenas(year?: number): Promise<CatorcenasResponse> {
    const response = await api.get<CatorcenasResponse>('/solicitudes/catorcenas', {
      params: year ? { year } : {}
    });
    return response.data;
  },

  async exportAll(params: Omit<SolicitudesParams, 'page' | 'limit'> = {}): Promise<Solicitud[]> {
    const response = await api.get<ApiResponse<Solicitud[]>>('/solicitudes/export', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al exportar solicitudes');
    }
    return response.data.data;
  },
};
