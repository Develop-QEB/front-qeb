import api from '../lib/api';
import { ApiResponse } from '../types';
import { UsuarioAdmin } from './usuarios.service';

export interface MiembroEquipo {
  id: number;
  nombre: string;
  email: string;
  area: string | null;
  puesto: string | null;
  rol: string;
  foto_perfil: string | null;
  rol_equipo: string | null;
}

export interface Equipo {
  id: number;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  created_at: string | null;
  miembros: MiembroEquipo[];
}

export interface CreateEquipoInput {
  nombre: string;
  descripcion?: string;
  color?: string;
}

export interface UpdateEquipoInput {
  nombre?: string;
  descripcion?: string;
  color?: string;
}

export const equiposService = {
  async getAll(): Promise<Equipo[]> {
    const response = await api.get<ApiResponse<Equipo[]>>('/equipos');

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener equipos');
    }

    return response.data.data;
  },

  async create(data: CreateEquipoInput): Promise<Equipo> {
    const response = await api.post<ApiResponse<Equipo>>('/equipos', data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear equipo');
    }

    return response.data.data;
  },

  async update(id: number, data: UpdateEquipoInput): Promise<Equipo> {
    const response = await api.put<ApiResponse<Equipo>>(`/equipos/${id}`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar equipo');
    }

    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/equipos/${id}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar equipo');
    }
  },

  async getAvailableUsers(equipoId: number): Promise<UsuarioAdmin[]> {
    const response = await api.get<ApiResponse<UsuarioAdmin[]>>(`/equipos/${equipoId}/available-users`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener usuarios disponibles');
    }

    return response.data.data;
  },

  async addMembers(equipoId: number, usuarioIds: number[], rol?: string): Promise<Equipo> {
    const response = await api.post<ApiResponse<Equipo>>(`/equipos/${equipoId}/members`, {
      usuario_ids: usuarioIds,
      rol,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar miembros');
    }

    return response.data.data;
  },

  async removeMembers(equipoId: number, usuarioIds: number[]): Promise<Equipo> {
    const response = await api.delete<ApiResponse<Equipo>>(`/equipos/${equipoId}/members`, {
      data: { usuario_ids: usuarioIds },
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al remover miembros');
    }

    return response.data.data;
  },
};
