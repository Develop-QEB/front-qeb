import api from '../lib/api';
import { Inventario, InventarioMapItem, InventarioStats, PaginatedResponse, ApiResponse } from '../types';

export interface InventariosParams {
  page?: number;
  limit?: number;
  search?: string;
  tipo?: string;
  estatus?: string;
  plaza?: string;
}

export const inventariosService = {
  async getAll(params: InventariosParams = {}): Promise<PaginatedResponse<Inventario>> {
    const response = await api.get<PaginatedResponse<Inventario>>('/inventarios', { params });
    return response.data;
  },

  async getForMap(params: { tipo?: string; estatus?: string; plaza?: string } = {}): Promise<InventarioMapItem[]> {
    const response = await api.get<ApiResponse<InventarioMapItem[]>>('/inventarios/map', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventarios para mapa');
    }
    return response.data.data;
  },

  async getById(id: number): Promise<Inventario> {
    const response = await api.get<ApiResponse<Inventario>>(`/inventarios/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario');
    }
    return response.data.data;
  },

  async getStats(): Promise<InventarioStats> {
    const response = await api.get<ApiResponse<InventarioStats>>('/inventarios/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getTipos(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/tipos');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener tipos');
    }
    return response.data.data;
  },

  async getPlazas(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/plazas');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener plazas');
    }
    return response.data.data;
  },

  async getEstatus(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/inventarios/estatus');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estatus');
    }
    return response.data.data;
  },
};
