import api from '../lib/api';

export interface Correo {
  id: number;
  remitente: string;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  fecha_envio: string;
  leido: boolean;
}

export interface CorreosParams {
  page?: number;
  limit?: number;
  search?: string;
  leido?: boolean | '';
}

export interface CorreosResponse {
  data: Correo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CorreosStats {
  total: number;
  no_leidos: number;
}

export const correosService = {
  getAll: async (params: CorreosParams = {}): Promise<CorreosResponse> => {
    const response = await api.get('/correos', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Correo> => {
    const response = await api.get(`/correos/${id}`);
    return response.data;
  },

  getStats: async (): Promise<CorreosStats> => {
    const response = await api.get('/correos/stats');
    return response.data;
  },

  toggleLeido: async (id: number): Promise<Correo> => {
    const response = await api.put(`/correos/${id}/toggle-leido`);
    return response.data;
  },
};
