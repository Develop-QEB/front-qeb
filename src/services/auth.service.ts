import api from '../lib/api';
import { AuthResponse, ApiResponse, User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al iniciar sesion');
    }

    return response.data.data;
  },

  async getProfile(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/profile');

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener perfil');
    }

    return response.data.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await api.post<
      ApiResponse<{ accessToken: string; refreshToken: string }>
    >('/auth/refresh', { refreshToken });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al refrescar token');
    }

    return response.data.data;
  },

  async updateProfile(data: { nombre?: string; area?: string; puesto?: string }): Promise<User> {
    const response = await api.patch<ApiResponse<User>>('/auth/profile', data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar perfil');
    }

    return response.data.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await api.post<ApiResponse<null>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Error al cambiar contraseña');
    }
  },

  async uploadPhoto(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('foto', file);

    const response = await api.post<ApiResponse<User>>('/auth/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al subir foto');
    }

    return response.data.data;
  },
};
