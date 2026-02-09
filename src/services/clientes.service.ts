import api from '../lib/api';
import { Cliente, PaginatedResponse, ApiResponse } from '../types';

export interface ClientesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ClientesStats {
  total: number;
  agencias: number;
  marcas: number;
  categorias: number;
  topAgencias: { nombre: string; cantidad: number }[];
  topMarcas: { nombre: string; cantidad: number }[];
  categoriaDistribution: { nombre: string; cantidad: number }[];
}

export interface ClientesFilterOptions {
  agencias: string[];
  marcas: string[];
  categorias: string[];
}

export interface SAPClientesResponse {
  success: boolean;
  data: Cliente[];
  total: number;
  cached: boolean;
}

export interface FullClientesResponse {
  success: boolean;
  data: Cliente[];
  total: number;
}

export const clientesService = {
  async getAll(params: ClientesParams = {}): Promise<PaginatedResponse<Cliente>> {
    const response = await api.get<PaginatedResponse<Cliente>>('/clientes', { params });
    return response.data;
  },

  async getAllFull(search?: string): Promise<FullClientesResponse> {
    const response = await api.get<FullClientesResponse>('/clientes/full', {
      params: search ? { search } : undefined
    });
    return response.data;
  },

  async getStats(): Promise<ClientesStats> {
    const response = await api.get<ApiResponse<ClientesStats>>('/clientes/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async getFilterOptions(): Promise<ClientesFilterOptions> {
    const response = await api.get<ApiResponse<ClientesFilterOptions>>('/clientes/filter-options');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener opciones de filtro');
    }
    return response.data.data;
  },

  async getSAPClientes(search?: string): Promise<SAPClientesResponse> {
    const response = await api.get<SAPClientesResponse>('/clientes/sap', {
      params: search ? { search } : undefined
    });
    return response.data;
  },

  async getSAPClientesByDB(database: string, search?: string): Promise<SAPClientesResponse> {
    const response = await api.get<SAPClientesResponse>(`/clientes/sap/${database}`, {
      params: search ? { search } : undefined
    });
    return response.data;
  },

  async getById(id: number): Promise<Cliente> {
    const response = await api.get<ApiResponse<Cliente>>(`/clientes/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener cliente');
    }
    return response.data.data;
  },

  async create(cliente: Partial<Cliente>): Promise<Cliente> {
    const response = await api.post<ApiResponse<Cliente>>('/clientes', cliente);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear cliente');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/clientes/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar cliente');
    }
  },
};
