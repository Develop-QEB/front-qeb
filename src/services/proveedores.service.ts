import api from '../lib/api';
import { Proveedor, PaginatedResponse, ApiResponse } from '../types';

export interface ProveedoresParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: 'activo' | 'inactivo';
}

export interface ProveedorInput {
  nombre: string;
  direccion?: string;
  ciudad?: string;
  codigo_postal?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  contacto_principal?: string;
  categoria?: string;
  estado?: 'activo' | 'inactivo';
  notas?: string;
}

export interface ProveedorHistory {
  proveedor: Proveedor;
  tareas: Array<{
    id: number;
    titulo: string | null;
    descripcion: string | null;
    tipo: string | null;
    estatus: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    campania: {
      id: number;
      nombre: string;
      status: string;
    } | null;
  }>;
  totalTareas: number;
}

export const proveedoresService = {
  async getAll(params: ProveedoresParams = {}): Promise<PaginatedResponse<Proveedor>> {
    const response = await api.get<PaginatedResponse<Proveedor>>('/proveedores', { params });
    return response.data;
  },

  async getById(id: number): Promise<Proveedor> {
    const response = await api.get<ApiResponse<Proveedor>>(`/proveedores/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener proveedor');
    }
    return response.data.data;
  },

  async create(data: ProveedorInput): Promise<Proveedor> {
    const response = await api.post<ApiResponse<Proveedor>>('/proveedores', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear proveedor');
    }
    return response.data.data;
  },

  async update(id: number, data: ProveedorInput): Promise<Proveedor> {
    const response = await api.put<ApiResponse<Proveedor>>(`/proveedores/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar proveedor');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse>(`/proveedores/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar proveedor');
    }
  },

  async getHistory(id: number): Promise<ProveedorHistory> {
    const response = await api.get<ApiResponse<ProveedorHistory>>(`/proveedores/${id}/history`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener historial');
    }
    return response.data.data;
  },
};
