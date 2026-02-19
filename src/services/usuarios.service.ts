import api from '../lib/api';
import { ApiResponse } from '../types';

export interface EquipoUsuario {
  id: number;
  nombre: string;
  color: string | null;
  rol_equipo: string | null;
}

export interface EquipoAdmin {
  id: number;
  nombre: string;
  color: string | null;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  area: string | null;
  puesto: string | null;
  rol: string;
  foto_perfil: string | null;
  created_at: string | null;
  total_equipos?: number;
  equipos_admin?: EquipoAdmin[];
  equipos?: EquipoUsuario[];
}

export interface UpdateUsuarioInput {
  nombre?: string;
  correo_electronico?: string;
  area?: string;
  puesto?: string;
  rol?: string;
}

export interface CreateUsuarioInput {
  nombre: string;
  correo_electronico: string;
  password: string;
  area: string;
  puesto: string;
  rol: string;
  foto_perfil?: string;
}

export const usuariosService = {
  async getAll(): Promise<UsuarioAdmin[]> {
    const response = await api.get<ApiResponse<UsuarioAdmin[]>>('/usuarios');

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener usuarios');
    }

    return response.data.data;
  },

  async create(data: CreateUsuarioInput): Promise<UsuarioAdmin> {
    const response = await api.post<ApiResponse<UsuarioAdmin>>('/usuarios', data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al crear usuario');
    }

    return response.data.data;
  },

  async update(id: number, data: UpdateUsuarioInput): Promise<UsuarioAdmin> {
    const response = await api.put<ApiResponse<UsuarioAdmin>>(`/usuarios/${id}`, data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar usuario');
    }

    return response.data.data;
  },

  async deleteMany(ids: number[]): Promise<void> {
    const response = await api.delete<ApiResponse<null>>('/usuarios', { data: { ids } });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al eliminar usuarios');
    }
  },
};
