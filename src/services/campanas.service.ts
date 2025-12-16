import api from '../lib/api';
import { Campana, CampanaStats, PaginatedResponse, ApiResponse, ComentarioTarea, CampanaWithComments } from '../types';

export type { CampanaWithComments };

export interface InventarioReservado {
  rsv_ids: string;
  id: number;
  codigo_original: string;
  codigo_unico: string;
  ubicacion: string | null;
  tipo_de_cara: string | null;
  cara: string | null;
  mueble: string | null;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estado: string | null;
  municipio: string | null;
  tipo_de_mueble: string | null;
  ancho: number;
  alto: number;
  nivel_socioeconomico: string | null;
  tarifa_publica: number | null;
  tradicional_digital: string | null;
  archivo: string | null;
  espacios_ids: string | null;
  estatus_reserva: string | null;
  calendario_id: number | null;
  espacios: string | null;
  solicitud_caras_id: number | null;
  articulo: string | null;
  tipo_medio: string | null;
  inicio_periodo: string | null;
  fin_periodo: string | null;
  numero_catorcena: number | null;
  anio_catorcena: number | null;
  caras_totales: number;
  grupo_completo_id: number | null;
}

export interface InventarioConAPS extends InventarioReservado {
  aps: number;
}

export interface CampanasParams {
  page?: number;
  limit?: number;
  status?: string;
  yearInicio?: number;
  yearFin?: number;
  catorcenaInicio?: number;
  catorcenaFin?: number;
}

export const campanasService = {
  async getAll(params: CampanasParams = {}): Promise<PaginatedResponse<Campana>> {
    const response = await api.get<PaginatedResponse<Campana>>('/campanas', { params });
    return response.data;
  },

  async getById(id: number): Promise<CampanaWithComments> {
    const response = await api.get<ApiResponse<CampanaWithComments>>(`/campanas/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener campana');
    }
    return response.data.data;
  },

  async updateStatus(id: number, status: string): Promise<Campana> {
    const response = await api.patch<ApiResponse<Campana>>(`/campanas/${id}/status`, { status });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al actualizar status');
    }
    return response.data.data;
  },

  async getStats(): Promise<CampanaStats> {
    const response = await api.get<ApiResponse<CampanaStats>>('/campanas/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener estadisticas');
    }
    return response.data.data;
  },

  async addComment(id: number, contenido: string): Promise<ComentarioTarea> {
    const response = await api.post<ApiResponse<ComentarioTarea>>(`/campanas/${id}/comentarios`, { contenido });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al agregar comentario');
    }
    return response.data.data;
  },

  async getInventarioReservado(id: number): Promise<InventarioReservado[]> {
    const response = await api.get<ApiResponse<InventarioReservado[]>>(`/campanas/${id}/inventario`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario reservado');
    }
    return response.data.data;
  },

  async getInventarioConAPS(id: number): Promise<InventarioConAPS[]> {
    const response = await api.get<ApiResponse<InventarioConAPS[]>>(`/campanas/${id}/inventario-aps`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al obtener inventario con APS');
    }
    return response.data.data;
  },

  async assignAPS(id: number, inventarioIds: number[]): Promise<{ aps: number; message: string }> {
    const response = await api.post<ApiResponse<{ aps: number; message: string }>>(`/campanas/${id}/assign-aps`, { inventarioIds });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Error al asignar APS');
    }
    return response.data.data;
  },
};
