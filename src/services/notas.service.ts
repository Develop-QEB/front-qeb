import api from '../lib/api';
import { ApiResponse } from '../types';

export interface NotaPersonal {
  id: number;
  usuario_id: number;
  titulo: string | null;
  contenido: string;
  color: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export interface CreateNotaParams {
  titulo?: string;
  contenido: string;
  color?: string;
}

export interface UpdateNotaParams {
  titulo?: string;
  contenido?: string;
  color?: string;
}

export const notasService = {
  async getAll(): Promise<NotaPersonal[]> {
    const response = await api.get<ApiResponse<NotaPersonal[]>>('/notas');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener notas');
    }
    return response.data.data;
  },

  async getById(id: number): Promise<NotaPersonal> {
    const response = await api.get<ApiResponse<NotaPersonal>>(`/notas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener nota');
    }
    return response.data.data;
  },

  async create(params: CreateNotaParams): Promise<NotaPersonal> {
    const response = await api.post<ApiResponse<NotaPersonal>>('/notas', params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear nota');
    }
    return response.data.data;
  },

  async update(id: number, params: UpdateNotaParams): Promise<NotaPersonal> {
    const response = await api.patch<ApiResponse<NotaPersonal>>(`/notas/${id}`, params);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar nota');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/notas/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar nota');
    }
  },
};
