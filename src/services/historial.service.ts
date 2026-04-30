import api from '../lib/api';

export interface HistorialEntry {
  id: number;
  tipo: string;
  ref_id: number;
  accion: string;
  fecha_hora: string;
  detalles: string | null;
}

export interface HistorialResponse {
  success: boolean;
  data: HistorialEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface HistorialFilters {
  page?: number;
  limit?: number;
  tipo?: string;
  accion?: string;
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export const historialService = {
  async getAll(filters: HistorialFilters = {}): Promise<HistorialResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.accion) params.set('accion', filters.accion);
    if (filters.search) params.set('search', filters.search);
    if (filters.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
    if (filters.fechaHasta) params.set('fechaHasta', filters.fechaHasta);

    const { data } = await api.get(`/historial?${params.toString()}`);
    return data;
  },

  async getTipos(): Promise<string[]> {
    const { data } = await api.get('/historial/tipos');
    return data.data;
  },

  async getAcciones(): Promise<string[]> {
    const { data } = await api.get('/historial/acciones');
    return data.data;
  },

  async addNota(input: { ref_id?: number; tipo: string; nota: string }): Promise<HistorialEntry> {
    const { data } = await api.post('/historial/notas', input);
    return data.data;
  },
};
